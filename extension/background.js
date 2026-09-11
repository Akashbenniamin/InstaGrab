// InstaGrab - Background Service Worker (Manifest V3)
const HELPER_BASE = 'http://127.0.0.1:18765';
let cachedToken = null;

// Auto-pair with Desktop Engine
async function getAuthToken() {
  if (cachedToken) return cachedToken;
  try {
    const resp = await fetch(`${HELPER_BASE}/api/pair/auto`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'InstaGrab'
      }
    });
    if (!resp.ok) throw new Error('Auto-pair failed: ' + resp.status);
    const data = await resp.json();
    cachedToken = data.token;
    return cachedToken;
  } catch (err) {
    console.warn('[InstaGrab Service Worker] Engine not responding:', err);
    return null;
  }
}

// Check if Desktop Engine is online
async function checkHealth() {
  try {
    const resp = await fetch(`${HELPER_BASE}/api/health`);
    if (!resp.ok) return { ok: false };
    const data = await resp.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Helper: Trigger native browser download
function triggerBrowserDownload(fileUrl, filename) {
  return new Promise((resolve) => {
    if (!chrome.downloads || !chrome.downloads.download) {
      resolve({ fallback: true });
      return;
    }
    chrome.downloads.download(
      {
        url: fileUrl,
        filename: filename,
        conflictAction: 'uniquify',
        saveAs: false
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.warn('[InstaGrab] chrome.downloads error:', chrome.runtime.lastError.message);
          resolve({ error: chrome.runtime.lastError.message });
        } else {
          console.log('[InstaGrab] Browser download started, id:', downloadId);
          resolve({ downloadId });
        }
      }
    );
  });
}

// Trigger download via Desktop Engine, then invoke native browser download manager
async function downloadMedia(url, formatType = 'video', quality = 'best') {
  let token = await getAuthToken();
  if (!token) {
    return { 
      success: false, 
      offline: true, 
      error: 'InstaGrab Desktop Engine is offline. Please launch InstaGrab on your PC!' 
    };
  }

  try {
    // 1. Submit download request to Engine
    let resp = await fetch(`${HELPER_BASE}/api/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'InstaGrab',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        url: url,
        format_type: formatType || 'video',
        quality: quality || 'best'
      })
    });

    // If token expired, refresh and retry once
    if (resp.status === 401 || resp.status === 403) {
      cachedToken = null;
      token = await getAuthToken();
      if (!token) {
        return { 
          success: false, 
          offline: true, 
          error: 'Desktop Engine authentication failed.' 
        };
      }
      resp = await fetch(`${HELPER_BASE}/api/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'InstaGrab',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          url: url,
          format_type: formatType || 'video',
          quality: quality || 'best'
        })
      });
    }

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      return { success: false, error: errData.error || 'Failed to start download' };
    }

    const { downloadId } = await resp.json();

    // 2. Poll for completion so we can pipe the completed file to the Browser Download Manager
    const startTime = Date.now();
    let completedFilename = null;

    while (Date.now() - startTime < 180000) { // 3 minute timeout
      await new Promise(r => setTimeout(r, 800));

      try {
        const sResp = await fetch(`${HELPER_BASE}/api/download/${downloadId}/status`, {
          headers: {
            'X-Requested-With': 'InstaGrab',
            'Authorization': `Bearer ${token}`
          }
        });
        if (sResp.ok) {
          const status = await sResp.json();
          if (status.state === 'complete') {
            completedFilename = status.filename;
            break;
          } else if (status.state === 'error') {
            return { success: false, error: status.error || 'Download failed during extraction' };
          }
        }
      } catch (pollErr) {
        console.warn('[InstaGrab] Polling error:', pollErr);
      }
    }

    // 3. Trigger Browser Download Manager in Chrome/Edge/Brave!
    if (completedFilename) {
      const streamUrl = `${HELPER_BASE}/api/file/download/${encodeURIComponent(completedFilename)}?token=${token}`;
      await triggerBrowserDownload(streamUrl, completedFilename);
      return { success: true, filename: completedFilename, browserDownload: true };
    }

    // If polling timed out but engine is still running in background
    return { success: true, background: true };

  } catch (err) {
    return { 
      success: false, 
      offline: true, 
      error: 'Cannot reach Desktop Engine. Ensure InstaGrab is running.' 
    };
  }
}

// Message Listener for Content Scripts & Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkHealth') {
    checkHealth().then(sendResponse);
    return true;
  }
  if (request.action === 'download') {
    downloadMedia(request.url, request.format_type, request.quality).then(sendResponse);
    return true;
  }
});

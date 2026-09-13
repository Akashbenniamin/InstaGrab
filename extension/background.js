// InstaGrab - Background Service Worker (Manifest V3)
const HELPER_BASE = 'http://127.0.0.1:18765';
let cachedToken = null;
let currentDownload = null; // { downloadId, state, progress, speed, eta, filename, error }

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

// Sanitize filename for Chrome download API
function sanitizeFilename(name) {
  if (!name) return 'media_download.mp4';
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
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
        filename: sanitizeFilename(filename),
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

function normalizeMediaUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  try {
    let uStr = rawUrl.trim();
    if (!uStr.startsWith('http://') && !uStr.startsWith('https://')) {
      uStr = 'https://' + uStr;
    }
    const u = new URL(uStr);
    if (u.hostname.includes('instagram.com') || u.hostname.includes('instagr.am')) {
      const match = u.pathname.match(/\/(?:p|reel|reels|tv|share\/reel|share\/p)\/([A-Za-z0-9_-]+)/);
      if (match) {
        const type = u.pathname.includes('reel') ? 'reel' : (u.pathname.includes('tv') ? 'tv' : 'p');
        return `https://www.instagram.com/${type}/${match[1]}/`;
      }
    }
  } catch {}
  return rawUrl;
}

// Helper to broadcast progress to both active tab and popup runtime
function broadcastProgress(data, tabId) {
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'downloadProgress', ...data }).catch(() => {});
  }
  chrome.runtime.sendMessage({ action: 'downloadProgress', ...data }).catch(() => {});
}

// Background poller that continues running regardless of whether popup is open
async function pollDownloadStatus(downloadId, token, tabId) {
  const startTime = Date.now();
  let completedFilename = null;

  while (Date.now() - startTime < 300000) { // 5 minute timeout for large files
    await new Promise(r => setTimeout(r, 650));

    try {
      const sResp = await fetch(`${HELPER_BASE}/api/download/${downloadId}/status`, {
        headers: {
          'X-Requested-With': 'InstaGrab',
          'Authorization': `Bearer ${token}`
        }
      });

      if (sResp.ok) {
        const status = await sResp.json();
        
        currentDownload = {
          downloadId,
          state: status.state,
          progress: status.progress || 0,
          speed: status.speed || '',
          eta: status.eta || '',
          filename: status.filename || ''
        };

        broadcastProgress(currentDownload, tabId);

        if (status.state === 'complete') {
          completedFilename = status.filename;
          break;
        } else if (status.state === 'error') {
          currentDownload = {
            downloadId,
            state: 'error',
            error: status.error || 'Download failed during processing'
          };
          broadcastProgress(currentDownload, tabId);
          setTimeout(() => {
            if (currentDownload && currentDownload.downloadId === downloadId) currentDownload = null;
          }, 8000);
          return;
        }
      }
    } catch (pollErr) {
      console.warn('[InstaGrab] Status poll error:', pollErr);
    }
  }

  // Hand-off completed file to native Chrome / Browser Download Manager
  if (completedFilename) {
    const streamUrl = `${HELPER_BASE}/api/file/download/${encodeURIComponent(completedFilename)}?token=${token}`;
    await triggerBrowserDownload(streamUrl, completedFilename);

    currentDownload = {
      downloadId,
      state: 'complete',
      progress: 100,
      filename: completedFilename
    };

    broadcastProgress(currentDownload, tabId);

    setTimeout(() => {
      if (currentDownload && currentDownload.downloadId === downloadId) currentDownload = null;
    }, 10000);
  }
}

// Asynchronous start download job with immediate handshake
async function startDownload(url, formatType, quality, tabId = null) {
  url = normalizeMediaUrl(url);

  // Fallback to active tab ID if triggered from popup
  if (!tabId && chrome.tabs && chrome.tabs.query) {
    try {
      const activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (activeTabs && activeTabs[0]) {
        tabId = activeTabs[0].id;
      } else {
        const anyTabs = await chrome.tabs.query({ active: true });
        if (anyTabs && anyTabs[0]) tabId = anyTabs[0].id;
      }
    } catch {}
  }

  let token = await getAuthToken();
  if (!token) {
    return { 
      success: false, 
      offline: true, 
      error: 'InstaGrab Desktop Engine is offline. Please launch InstaGrab on your PC!' 
    };
  }

  try {
    // 1. Submit download request to Desktop Engine
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

    currentDownload = {
      downloadId,
      state: 'extracting',
      progress: 0,
      speed: '',
      eta: '',
      filename: ''
    };

    // Broadcast starting state immediately
    broadcastProgress(currentDownload, tabId);

    // Launch background status poller without awaiting so caller receives immediate ack
    pollDownloadStatus(downloadId, token, tabId);

    return { success: true, downloadId };

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
  if (request.action === 'getActiveDownload') {
    sendResponse(currentDownload);
    return true;
  }
  if (request.action === 'download') {
    const tabId = sender.tab ? sender.tab.id : null;
    startDownload(request.url, request.format_type, request.quality, tabId).then(sendResponse);
    return true;
  }
});

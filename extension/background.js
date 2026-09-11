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

// Trigger download via Desktop Engine, broadcast live progress to tab, then pipe to Browser Download Manager
async function downloadMedia(url, formatType, quality, tabId = null) {
  url = normalizeMediaUrl(url);

  // Respect saved extension preferences if not explicitly set
  if (!formatType || !quality) {
    const prefs = await new Promise(r => chrome.storage.local.get(['pref_format', 'pref_quality'], r));
    formatType = formatType || prefs.pref_format || 'video';
    quality = quality || prefs.pref_quality || 'best';
  }

  if (!tabId && chrome.tabs && chrome.tabs.query) {
    try {
      const activeTabs = await new Promise(r => chrome.tabs.query({ active: true, currentWindow: true }, r));
      if (activeTabs && activeTabs[0]) tabId = activeTabs[0].id;
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

    // 2. Poll for live status & broadcast progress updates to the active tab
    const startTime = Date.now();
    let completedFilename = null;

    while (Date.now() - startTime < 300000) { // 5 minute timeout for large 4K files
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

          // Broadcast real-time progress to the calling tab
          if (tabId) {
            chrome.tabs.sendMessage(tabId, {
              action: 'downloadProgress',
              downloadId,
              state: status.state,
              progress: status.progress || 0,
              speed: status.speed || '',
              eta: status.eta || '',
              filename: status.filename || ''
            }).catch(() => {});
          }

          if (status.state === 'complete') {
            completedFilename = status.filename;
            break;
          } else if (status.state === 'error') {
            if (tabId) {
              chrome.tabs.sendMessage(tabId, {
                action: 'downloadProgress',
                downloadId,
                state: 'error',
                error: status.error || 'Download failed during processing'
              }).catch(() => {});
            }
            return { success: false, error: status.error || 'Download failed during extraction' };
          }
        }
      } catch (pollErr) {
        console.warn('[InstaGrab] Status poll error:', pollErr);
      }
    }

    // 3. Hand-off completed file to native Chrome / Browser Download Manager
    if (completedFilename) {
      const streamUrl = `${HELPER_BASE}/api/file/download/${encodeURIComponent(completedFilename)}?token=${token}`;
      await triggerBrowserDownload(streamUrl, completedFilename);

      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          action: 'downloadProgress',
          downloadId,
          state: 'complete',
          progress: 100,
          filename: completedFilename
        }).catch(() => {});
      }

      return { success: true, filename: completedFilename, browserDownload: true };
    }

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
    const tabId = sender.tab ? sender.tab.id : null;
    downloadMedia(request.url, request.format_type, request.quality, tabId).then(sendResponse);
    return true;
  }
});

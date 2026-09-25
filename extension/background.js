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

    // 1. YouTube watch URLs: strip playlist and secondary params to prevent runaway playlist downloads
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      if (u.pathname === '/watch' || u.pathname === '/watch_popup') {
        const v = u.searchParams.get('v');
        if (v) return `https://www.youtube.com/watch?v=${v}`;
      }
      if (u.pathname.startsWith('/shorts/')) {
        const sMatch = u.pathname.match(/\/shorts\/([A-Za-z0-9_-]+)/);
        if (sMatch) return `https://www.youtube.com/shorts/${sMatch[1]}`;
      }
      if (u.hostname.includes('youtu.be')) {
        const id = u.pathname.replace(/^\/+/, '').split('/')[0];
        if (id) return `https://www.youtube.com/watch?v=${id}`;
      }
    }

    // 2. Instagram
    if (u.hostname.includes('instagram.com') || u.hostname.includes('instagr.am')) {
      const hlShortMatch = u.pathname.match(/\/s\/([A-Za-z0-9_-]+)/);
      if (hlShortMatch) {
        try {
          const cleanB64 = hlShortMatch[1].replace(/-/g, '+').replace(/_/g, '/');
          const paddedB64 = cleanB64 + '='.repeat((4 - (cleanB64.length % 4)) % 4);
          const decoded = atob(paddedB64);
          const matchId = decoded.match(/highlight:(\d+)/);
          if (matchId) {
            return `https://www.instagram.com/stories/highlights/${matchId[1]}/`;
          }
        } catch (_) {}
        return u.href;
      }
      if (u.pathname.includes('/stories/')) {
        return u.href;
      }
      const match = u.pathname.match(/\/(?:p|reel|reels|tv|share\/reel|share\/p)\/([A-Za-z0-9_-]+)/);
      if (match) {
        const type = u.pathname.includes('reel') ? 'reel' : (u.pathname.includes('tv') ? 'tv' : 'p');
        return `https://www.instagram.com/${type}/${match[1]}/`;
      }
    }

    // 3. Pinterest
    if (u.hostname.includes('pinterest.') || u.hostname.includes('pin.it')) {
      const pinMatch = u.pathname.match(/\/pin\/(\d+)/i);
      if (pinMatch) return `https://www.pinterest.com/pin/${pinMatch[1]}/`;
    }

    // 4. Envato Elements & AudioJungle
    if (u.hostname.includes('envato.com') || u.hostname.includes('audiojungle.net')) {
      const cleanPath = u.pathname.replace(/\/+$/, '');
      if (cleanPath) return `${u.protocol}//${u.host}${cleanPath}`;
    }

    // 5. Epidemic Sound (preserve audiocdn query params)
    if (u.hostname.includes('epidemicsound.com') && !u.hostname.includes('audiocdn.')) {
      const cleanPath = u.pathname.replace(/\/+$/, '');
      if (cleanPath) return `${u.protocol}//${u.host}${cleanPath}/`;
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
  let completedFiles = null;

  while (Date.now() - startTime < 300000) { // 5 minute timeout for large files
    await new Promise(r => setTimeout(r, 350));

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
          completedFiles = status.files;
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

  // Hand-off completed file(s) to native Chrome / Browser Download Manager
  if (completedFiles && completedFiles.length > 1) {
    for (let i = 0; i < completedFiles.length; i++) {
      const f = completedFiles[i];
      const streamUrl = `${HELPER_BASE}/api/file/download/${encodeURIComponent(f)}?token=${token}`;
      await triggerBrowserDownload(streamUrl, f);
      await new Promise(r => setTimeout(r, 350));
    }

    currentDownload = {
      downloadId,
      state: 'complete',
      progress: 100,
      filename: `${completedFiles.length} files saved`
    };

    broadcastProgress(currentDownload, tabId);

    setTimeout(() => {
      if (currentDownload && currentDownload.downloadId === downloadId) currentDownload = null;
    }, 10000);
  } else if (completedFilename) {
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

// Helper to retrieve comprehensive Instagram cookies (domain + host + api)
async function getInstagramCookies() {
  if (!chrome.cookies || !chrome.cookies.getAll) return [];
  const cookieMap = new Map();
  try {
    const results = await Promise.allSettled([
      chrome.cookies.getAll({ domain: 'instagram.com' }),
      chrome.cookies.getAll({ url: 'https://www.instagram.com/' }),
      chrome.cookies.getAll({ url: 'https://i.instagram.com/' })
    ]);
    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        for (const c of res.value) {
          const key = `${c.name}:${c.domain}:${c.path}`;
          if (!cookieMap.has(key)) {
            cookieMap.set(key, c);
          }
        }
      }
    }
  } catch (e) {
    console.warn('[InstaGrab] Cookie extraction error:', e);
  }
  return Array.from(cookieMap.values());
}

// Helper to retrieve active browser cookies for authentication (18+ / private content)
async function getCookiesForUrl(url) {
  if (!chrome.cookies || !chrome.cookies.getAll) return null;
  try {
    // Strictly Instagram only: Instagram requires session cookies for 18+ and stories.
    // YouTube anti-bot defense rejects Chrome browser session cookies with "The page needs to be reloaded".
    if (url && (url.includes('instagram.com') || url.includes('instagr.am'))) {
      const cookies = await getInstagramCookies();
      return (cookies && cookies.length > 0) ? cookies : null;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Background cookie sync to Desktop Engine
async function syncCookiesToHelper(domain = 'instagram.com') {
  if (!chrome.cookies || !chrome.cookies.getAll) return false;
  try {
    let cookies = [];
    if (domain.includes('instagram')) {
      cookies = await getInstagramCookies();
    } else {
      cookies = await chrome.cookies.getAll({ domain });
    }
    if (!cookies || cookies.length === 0) return false;
    const token = await getAuthToken();
    if (!token) return false;
    const resp = await fetch(`${HELPER_BASE}/api/cookies/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'InstaGrab',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ platform: domain.replace('.com', ''), cookies })
    });
    if (resp.ok) {
      const hasLogin = cookies.some(c => c.name === 'sessionid');
      console.log(`[InstaGrab] Successfully synced ${cookies.length} ${domain} cookies to Desktop Engine (Logged In: ${hasLogin})`);
    }
    return resp.ok;
  } catch (e) {
    return false;
  }
}

// Asynchronous start download job with immediate handshake
async function startDownload(url, formatType, quality, tabId = null, options = {}) {
  url = normalizeMediaUrl(url);
  const isAudioPlatform = url && (
    url.includes('envato.com') ||
    url.includes('audiojungle.net') ||
    url.includes('envatousercontent.com') ||
    url.includes('epidemicsound.com')
  );
  if (isAudioPlatform) {
    formatType = 'audio';
  }

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
    const cookies = await getCookiesForUrl(url);
    const downloadPayload = {
      url: url,
      format_type: formatType || 'video',
      quality: quality || 'best',
      as_zip: options.as_zip !== undefined ? options.as_zip : true
    };
    if (options.item_index !== undefined) {
      downloadPayload.item_index = options.item_index;
    }
    if (cookies) downloadPayload.cookies = cookies;

    let resp = await fetch(`${HELPER_BASE}/api/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'InstaGrab',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(downloadPayload)
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
        body: JSON.stringify(downloadPayload)
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

// Extract a clean PNG filename from an image URL
function extractPngFilename(srcUrl) {
  try {
    const urlObj = new URL(srcUrl);
    let pathname = urlObj.pathname;
    let rawName = pathname.split('/').pop() || 'image';
    rawName = decodeURIComponent(rawName).split('?')[0];
    const baseName = rawName.replace(/\.[a-zA-Z0-9]+$/, '') || 'image';
    const cleanName = baseName.replace(/[^a-zA-Z0-9_\-\s]/g, '_').trim() || 'image';
    return `${cleanName}.png`;
  } catch {
    return `image_${Date.now()}.png`;
  }
}

// Convert any image URL (WEBP, AVIF, JPG, SVG, etc.) to pure PNG Data URL in Service Worker
async function convertImageToPngDataUrl(imageUrl) {
  const resp = await fetch(imageUrl);
  if (!resp.ok) throw new Error('Failed to fetch image: ' + resp.status);
  const blob = await resp.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
  const buffer = await pngBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return 'data:image/png;base64,' + btoa(binary);
}

// Handle Right-Click "Save Image as PNG"
async function handleSaveImageAsPng(srcUrl, tab) {
  const tabId = tab ? tab.id : null;
  const filename = extractPngFilename(srcUrl);

  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      action: 'downloadProgress',
      state: 'downloading',
      progress: 25,
      speed: 'Converting to PNG',
      filename: filename
    }).catch(() => {});
  }

  // 1. Try delegating to content script first (can use in-memory rendered DOM <img> without network re-fetch)
  if (tabId) {
    try {
      const result = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { action: 'convertImageToPng', srcUrl }, (res) => {
          if (chrome.runtime.lastError || !res || !res.dataUrl) {
            resolve(null);
          } else {
            resolve(res);
          }
        });
      });

      if (result && result.dataUrl) {
        await triggerBrowserDownload(result.dataUrl, filename);
        chrome.tabs.sendMessage(tabId, {
          action: 'downloadProgress',
          state: 'complete',
          progress: 100,
          filename: filename
        }).catch(() => {});
        return;
      }
    } catch (tabErr) {
      console.warn('[InstaGrab] Tab image conversion fallback to background:', tabErr);
    }
  }

  // 2. Fallback: Convert via Service Worker OffscreenCanvas
  try {
    const dataUrl = await convertImageToPngDataUrl(srcUrl);
    await triggerBrowserDownload(dataUrl, filename);

    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: 'downloadProgress',
        state: 'complete',
        progress: 100,
        filename: filename
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[InstaGrab] Failed to convert image to PNG:', err);
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: 'downloadProgress',
        state: 'error',
        error: 'Failed to convert image to PNG'
      }).catch(() => {});
    }
  }
}

// Register Context Menu on Install & Startup
function setupContextMenu() {
  if (chrome.contextMenus && chrome.contextMenus.create) {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'instagrab-save-as-png',
        title: 'Save Image as PNG (InstaGrab)',
        contexts: ['image']
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[InstaGrab] Context menu setup:', chrome.runtime.lastError.message);
        }
      });
    });
  }
}

chrome.runtime.onInstalled.addListener(setupContextMenu);
chrome.runtime.onStartup.addListener(setupContextMenu);
setupContextMenu();

// Context Menu Click Listener
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'instagrab-save-as-png' && info.srcUrl) {
      handleSaveImageAsPng(info.srcUrl, tab);
    }
  });
}


// Automated Seamless Background Cookie Sync
chrome.runtime.onStartup.addListener(() => {
  syncCookiesToHelper('instagram.com');
});
chrome.runtime.onInstalled.addListener(() => {
  syncCookiesToHelper('instagram.com');
});

// Sync on cookie changes (login, logout, token refresh)
if (chrome.cookies && chrome.cookies.onChanged) {
  let cookieDebounce = null;
  chrome.cookies.onChanged.addListener((changeInfo) => {
    const domain = changeInfo.cookie?.domain || '';
    if (domain.includes('instagram.com')) {
      if (cookieDebounce) clearTimeout(cookieDebounce);
      cookieDebounce = setTimeout(() => {
        syncCookiesToHelper('instagram.com');
      }, 1500);
    }
  });
}

if (chrome.tabs && chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab && tab.url && (tab.url.includes('instagram.com') || tab.url.includes('akashbenniamin.github.io'))) {
      syncCookiesToHelper('instagram.com');
    }
  });
}

if (chrome.alarms) {
  chrome.alarms.create('sync_instagram_cookies', { periodInMinutes: 30 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'sync_instagram_cookies') {
      syncCookiesToHelper('instagram.com');
    }
  });
}

// Message Listener for Content Scripts & Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'syncCookies') {
    syncCookiesToHelper(request.domain || 'instagram.com').then((success) => {
      sendResponse({ success });
    });
    return true;
  }
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

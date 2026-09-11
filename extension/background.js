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

// Trigger download via Desktop Engine
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
    let resp = await fetch(`${HELPER_BASE}/api/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'InstaGrab',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        url: url,
        format_type: formatType,
        quality: quality
      })
    });

    // If token expired, clear cache and retry once
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
          format_type: formatType,
          quality: quality
        })
      });
    }

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      return { success: false, error: errData.error || 'Failed to start download' };
    }

    const data = await resp.json();
    return { success: true, data };
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

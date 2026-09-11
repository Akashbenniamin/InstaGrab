// InstaGrab - Pinterest In-Page Downloader Content Script
(function () {
  const HELPER_BASE = 'http://127.0.0.1:18765';
  let cachedToken = null;

  // SVG Icons
  const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
  const SPINNER_ICON = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle></svg>`;
  const CHECK_ICON = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

  // Toast Notification System
  function showToast(message, isError = false) {
    let toast = document.getElementById('instagrab-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'instagrab-toast';
      toast.className = 'instagrab-toast';
      toast.innerHTML = `
        <div class="instagrab-toast-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </div>
        <span class="instagrab-toast-msg"></span>
      `;
      document.body.appendChild(toast);
    }

    const msgEl = toast.querySelector('.instagrab-toast-msg');
    if (msgEl) msgEl.textContent = message;

    if (isError) {
      toast.style.borderLeft = '4px solid #ef4444';
    } else {
      toast.style.borderLeft = '4px solid #10b981';
    }

    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3800);
  }

  // Get or refresh authorization token from local helper
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
      if (!resp.ok) throw new Error('Failed to auto-pair');
      const data = await resp.json();
      cachedToken = data.token;
      return cachedToken;
    } catch (err) {
      console.warn('[InstaGrab] Desktop engine not responding:', err);
      return null;
    }
  }

  // Trigger download via local helper
  async function downloadPin(pinUrl, button) {
    button.classList.add('instagrab-loading');
    button.innerHTML = `${SPINNER_ICON} <span>Starting...</span>`;

    const token = await getAuthToken();
    if (!token) {
      button.classList.remove('instagrab-loading');
      button.innerHTML = `${DOWNLOAD_ICON} <span>Grab</span>`;
      showToast('⚠️ InstaGrab Desktop Engine is offline. Please launch InstaGrab on your PC!', true);
      return;
    }

    try {
      const resp = await fetch(`${HELPER_BASE}/api/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'InstaGrab',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          url: pinUrl,
          format_type: 'video',
          quality: 'best'
        })
      });

      if (resp.status === 401 || resp.status === 403) {
        cachedToken = null;
        // Retry once after refreshing token
        const freshToken = await getAuthToken();
        if (freshToken) {
          await fetch(`${HELPER_BASE}/api/download`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'InstaGrab',
              'Authorization': `Bearer ${freshToken}`
            },
            body: JSON.stringify({
              url: pinUrl,
              format_type: 'video',
              quality: 'best'
            })
          });
        }
      }

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to start download');
      }

      // Success feedback
      button.classList.remove('instagrab-loading');
      button.classList.add('instagrab-success');
      button.innerHTML = `${CHECK_ICON} <span>Downloading</span>`;
      showToast('✓ InstaGrab: Download started! Saved to your Downloads folder.');

      setTimeout(() => {
        button.classList.remove('instagrab-success');
        button.innerHTML = `${DOWNLOAD_ICON} <span>Grab</span>`;
      }, 4000);

    } catch (error) {
      console.error('[InstaGrab] Download failed:', error);
      button.classList.remove('instagrab-loading');
      button.innerHTML = `${DOWNLOAD_ICON} <span>Grab</span>`;
      showToast('❌ Download failed: ' + (error.message || 'Unknown error'), true);
    }
  }

  // Process and inject buttons on pin elements
  function processPin(container) {
    if (container.dataset.instagrabInjected) return;

    // Find the pin link
    let anchor = container.tagName === 'A' && container.href.includes('/pin/')
      ? container
      : container.querySelector('a[href*="/pin/"]');

    if (!anchor || !anchor.href) return;

    // Normalize pin URL (e.g. https://www.pinterest.com/pin/123456789/)
    const match = anchor.href.match(/https?:\/\/[^/]*pinterest\.[a-z.]+\/pin\/(\d+)/i);
    if (!match) return;

    const pinUrl = `https://www.pinterest.com/pin/${match[1]}/`;
    container.dataset.instagrabInjected = 'true';

    // Ensure container has relative positioning
    const style = window.getComputedStyle(container);
    if (style.position === 'static') {
      container.classList.add('instagrab-pin-container');
    }

    // Create Download button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'instagrab-pin-btn';
    btn.innerHTML = `${DOWNLOAD_ICON} <span>Grab</span>`;
    btn.title = 'Download video/image with InstaGrab';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      downloadPin(pinUrl, btn);
    });

    container.appendChild(btn);
  }

  // Scan document for pins in batches
  function scanPins() {
    const pinSelectors = [
      '[data-test-id="pin"]',
      '[data-test-id="pinWrapper"]',
      'div[data-grid-item="true"]',
      'div[role="listitem"]',
      'div.Pin',
      'a[href*="/pin/"]'
    ];

    const candidates = document.querySelectorAll(pinSelectors.join(','));
    candidates.forEach((el) => {
      // If it's an anchor, find closest container or use anchor directly
      if (el.tagName === 'A') {
        const parentCard = el.closest('[data-test-id="pin"]') || el.parentElement;
        if (parentCard) processPin(parentCard);
        else processPin(el);
      } else {
        processPin(el);
      }
    });
  }

  // Debounced observer using requestAnimationFrame as per guidelines
  let isScanning = false;
  function requestScan() {
    if (isScanning) return;
    isScanning = true;
    requestAnimationFrame(() => {
      scanPins();
      isScanning = false;
    });
  }

  // Observe DOM changes for dynamically loaded pins (infinite scroll)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        requestScan();
        break;
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Initial scan
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanPins);
  } else {
    scanPins();
  }

  console.log('[InstaGrab] Pinterest downloader extension active');
})();

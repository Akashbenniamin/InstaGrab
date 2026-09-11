// InstaGrab - Pinterest Extension In-Page Content Script (Manifest V3)
(function () {
  const HELPER_BASE = 'http://127.0.0.1:18765';
  let cachedToken = null;

  // Clean SVG Icons (no text)
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
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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

    toast.style.borderLeft = isError ? '4px solid #ef4444' : '4px solid #10b981';
    toast.classList.add('show');

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 4200);
  }

  // Fallback direct token retrieval if service worker unavailable
  async function getDirectAuthToken() {
    if (cachedToken) return cachedToken;
    try {
      const resp = await fetch(`${HELPER_BASE}/api/pair/auto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'InstaGrab'
        }
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      cachedToken = data.token;
      return cachedToken;
    } catch {
      return null;
    }
  }

  // Download media via service worker (preferred) or direct fetch fallback
  async function downloadMedia(pinUrl, button, isOpenedView = false) {
    if (button.classList.contains('instagrab-loading')) return;

    button.classList.add('instagrab-loading');
    button.innerHTML = isOpenedView 
      ? `${SPINNER_ICON} <span>Starting Download...</span>` 
      : `${SPINNER_ICON}`;

    const resetBtn = (success = false) => {
      button.classList.remove('instagrab-loading');
      if (success) {
        button.classList.add('instagrab-success');
        button.innerHTML = isOpenedView 
          ? `${CHECK_ICON} <span>Downloading to PC ✓</span>` 
          : `${CHECK_ICON}`;
        setTimeout(() => {
          button.classList.remove('instagrab-success');
          button.innerHTML = isOpenedView 
            ? `${DOWNLOAD_ICON} <span>Download with InstaGrab</span>` 
            : `${DOWNLOAD_ICON}`;
        }, 3500);
      } else {
        button.innerHTML = isOpenedView 
          ? `${DOWNLOAD_ICON} <span>Download with InstaGrab</span>` 
          : `${DOWNLOAD_ICON}`;
      }
    };

    // Method 1: Ask background service worker
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { action: 'download', url: pinUrl, format_type: 'video', quality: 'best' },
            (res) => {
              if (chrome.runtime.lastError) {
                resolve(null);
              } else {
                resolve(res);
              }
            }
          );
        });

        if (response) {
          if (response.success) {
            resetBtn(true);
            showToast('✓ InstaGrab: Download started! Saved to your Downloads folder.');
            return;
          } else if (response.offline) {
            resetBtn(false);
            showToast('⚠️ InstaGrab Desktop Engine is offline. Please launch InstaGrab on your PC!', true);
            return;
          } else {
            resetBtn(false);
            showToast('❌ Download failed: ' + (response.error || 'Server error'), true);
            return;
          }
        }
      }
    } catch (swErr) {
      console.warn('[InstaGrab] Background message failed, trying direct:', swErr);
    }

    // Method 2: Direct fetch fallback
    try {
      let token = await getDirectAuthToken();
      if (!token) {
        resetBtn(false);
        showToast('⚠️ InstaGrab Desktop Engine is offline. Please launch InstaGrab on your PC!', true);
        return;
      }

      let resp = await fetch(`${HELPER_BASE}/api/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'InstaGrab',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url: pinUrl, format_type: 'video', quality: 'best' })
      });

      if (resp.status === 401 || resp.status === 403) {
        cachedToken = null;
        token = await getDirectAuthToken();
        if (token) {
          resp = await fetch(`${HELPER_BASE}/api/download`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'InstaGrab',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ url: pinUrl, format_type: 'video', quality: 'best' })
          });
        }
      }

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to start download');
      }

      resetBtn(true);
      showToast('✓ InstaGrab: Download started! Saved to your Downloads folder.');
    } catch (error) {
      resetBtn(false);
      showToast('❌ Download failed: ' + (error.message || 'Cannot reach Desktop Engine'), true);
    }
  }

  // 1. Process Grid Pins (Circular icon-only button placed to the left of the Save button)
  function processGridPin(container) {
    if (container.dataset.instagrabInjected) return;

    // Do not inject grid pin button inside closeup / opened post modal view
    if (container.closest('[data-test-id="closeup-stage"]') || 
        container.closest('[data-test-id="pin-detail-view"]') ||
        container.closest('div[role="dialog"]')) {
      return;
    }

    // Find the pin anchor link
    let anchor = container.tagName === 'A' && container.href.includes('/pin/')
      ? container
      : container.querySelector('a[href*="/pin/"]');

    if (!anchor || !anchor.href) return;

    const match = anchor.href.match(/https?:\/\/[^/]*pinterest\.[a-z.]+\/pin\/(\d+)/i);
    if (!match) return;

    const pinUrl = `https://www.pinterest.com/pin/${match[1]}/`;
    container.dataset.instagrabInjected = 'true';

    // Ensure relative positioning on card
    const style = window.getComputedStyle(container);
    if (style.position === 'static') {
      container.classList.add('instagrab-pin-container');
    }

    // Create circular icon-only download button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'instagrab-pin-btn';
    btn.innerHTML = DOWNLOAD_ICON;
    btn.title = 'Download video/image with InstaGrab';

    // Position dynamically if Pinterest's Save button has custom width or alignment
    const saveBtn = container.querySelector('[data-test-id="PinBetterSaveCanvas"], button[aria-label*="Save"], button[aria-label*="सुरक्षित"]');
    if (saveBtn) {
      const parentRect = container.getBoundingClientRect();
      const saveRect = saveBtn.getBoundingClientRect();
      if (parentRect.width > 0 && saveRect.width > 0) {
        const offsetFromRight = parentRect.right - saveRect.left + 8;
        if (offsetFromRight > 30 && offsetFromRight < 200) {
          btn.style.right = `${offsetFromRight}px`;
        }
      }
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      downloadMedia(pinUrl, btn, false);
    });

    container.appendChild(btn);
  }

  // 2. Process Opened Pin (Fullscreen / Closeup view: button in the text fields)
  function processOpenedPin() {
    const isPinPage = window.location.pathname.includes('/pin/');
    const dialog = document.querySelector('div[role="dialog"]');
    if (!isPinPage && !dialog) return;

    // Get current opened pin URL
    let pinUrl = window.location.href;
    const pinMatch = pinUrl.match(/https?:\/\/[^/]*pinterest\.[a-z.]+\/pin\/(\d+)/i);
    if (!pinMatch) {
      // Check dialog for link
      if (dialog) {
        const link = dialog.querySelector('a[href*="/pin/"]');
        if (link && link.href) {
          const dMatch = link.href.match(/https?:\/\/[^/]*pinterest\.[a-z.]+\/pin\/(\d+)/i);
          if (dMatch) pinUrl = `https://www.pinterest.com/pin/${dMatch[1]}/`;
        }
      }
    }

    // Check if opened download button already exists and is up to date
    const existingWrap = document.querySelector('.instagrab-opened-wrap');
    if (existingWrap) {
      if (existingWrap.dataset.pinUrl === pinUrl) {
        return; // Already up to date
      } else {
        existingWrap.remove(); // URL changed, recreate
      }
    }

    // Find the text fields area in the opened post (Title, Description, or Creator area)
    const titleEl = document.querySelector('[data-test-id="pin-title"], h1[data-test-id="pin-title"], [data-test-id="closeup-title"], h1');
    const descEl = document.querySelector('[data-test-id="truncated-description"], [data-test-id="closeup-description"], [data-test-id="pin-description"]');
    const creatorEl = document.querySelector('[data-test-id="user-profile-link"], [data-test-id="closeup-user-info"]');
    const stageEl = document.querySelector('[data-test-id="closeup-stage"], [data-test-id="pin-detail-view"], div[role="dialog"]');

    let targetEl = null;
    let insertMode = 'afterend';

    if (titleEl) {
      targetEl = titleEl;
      insertMode = 'afterend';
    } else if (descEl) {
      targetEl = descEl;
      insertMode = 'afterend';
    } else if (creatorEl) {
      targetEl = creatorEl.closest('div') || creatorEl;
      insertMode = 'beforebegin';
    } else if (stageEl) {
      targetEl = stageEl;
      insertMode = 'beforeend';
    }

    if (!targetEl) return;

    // Create Opened Post Download Button
    const wrap = document.createElement('div');
    wrap.className = 'instagrab-opened-wrap';
    wrap.dataset.pinUrl = pinUrl;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'instagrab-opened-btn';
    btn.innerHTML = `${DOWNLOAD_ICON} <span>Download with InstaGrab</span>`;
    btn.title = 'Download full resolution video/image with InstaGrab';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      downloadMedia(pinUrl, btn, true);
    });

    wrap.appendChild(btn);

    if (insertMode === 'afterend' && targetEl.parentNode) {
      targetEl.parentNode.insertBefore(wrap, targetEl.nextSibling);
    } else if (insertMode === 'beforebegin' && targetEl.parentNode) {
      targetEl.parentNode.insertBefore(wrap, targetEl);
    } else {
      targetEl.appendChild(wrap);
    }
  }

  // Scan document for pins & opened view
  function scanAll() {
    // 1. Process opened pin if present
    processOpenedPin();

    // 2. Process grid pins
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
      if (el.tagName === 'A') {
        const parentCard = el.closest('[data-test-id="pin"]') || el.parentElement;
        if (parentCard) processGridPin(parentCard);
        else processGridPin(el);
      } else {
        processGridPin(el);
      }
    });
  }

  // Debounced scanning with requestAnimationFrame
  let isScanning = false;
  function requestScan() {
    if (isScanning) return;
    isScanning = true;
    requestAnimationFrame(() => {
      scanAll();
      isScanning = false;
    });
  }

  // Listen for SPA navigation in Pinterest
  window.addEventListener('popstate', requestScan);
  const origPushState = history.pushState;
  history.pushState = function () {
    origPushState.apply(this, arguments);
    setTimeout(requestScan, 200);
  };
  const origReplaceState = history.replaceState;
  history.replaceState = function () {
    origReplaceState.apply(this, arguments);
    setTimeout(requestScan, 200);
  };

  // MutationObserver for infinite scroll and modal opening
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAll);
  } else {
    scanAll();
  }

  console.log('[InstaGrab] Pinterest extension 1.0.5 active');
})();

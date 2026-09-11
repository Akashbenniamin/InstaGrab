// InstaGrab - Cross-Platform Content Script (Pinterest, YouTube & Instagram)
(function () {
  const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
  const SPINNER_ICON = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle></svg>`;
  const CHECK_ICON = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

  let activeToastTimeout = null;

  // Rich Live Toast Notification with Animated Progress Bar
  function updateToast({ message = '', progress = 0, speed = '', eta = '', state = 'starting', isError = false }) {
    let toast = document.getElementById('instagrab-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'instagrab-toast';
      toast.className = 'instagrab-toast';
      toast.innerHTML = `
        <div class="instagrab-toast-header">
          <div class="instagrab-toast-title-row">
            <div class="instagrab-toast-icon">
              <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </div>
            <span class="instagrab-toast-title">InstaGrab Downloader</span>
          </div>
          <span class="instagrab-toast-badge"></span>
        </div>
        <span class="instagrab-toast-msg">Starting download...</span>
        <div class="instagrab-toast-bar-track">
          <div class="instagrab-toast-bar-fill"></div>
        </div>
      `;
      document.body.appendChild(toast);
    }

    const iconEl = toast.querySelector('.instagrab-toast-icon');
    const badgeEl = toast.querySelector('.instagrab-toast-badge');
    const msgEl = toast.querySelector('.instagrab-toast-msg');
    const fillEl = toast.querySelector('.instagrab-toast-bar-fill');

    if (isError || state === 'error') {
      if (iconEl) {
        iconEl.className = 'instagrab-toast-icon error';
        iconEl.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
      }
      if (badgeEl) badgeEl.textContent = 'Error';
      if (msgEl) msgEl.textContent = message || 'Download failed';
      if (fillEl) {
        fillEl.className = 'instagrab-toast-bar-fill error';
        fillEl.style.width = '100%';
      }
      toast.classList.add('show');
      clearTimeout(activeToastTimeout);
      activeToastTimeout = setTimeout(() => toast.classList.remove('show'), 5000);
      return;
    }

    if (state === 'complete') {
      if (iconEl) {
        iconEl.className = 'instagrab-toast-icon success';
        iconEl.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      }
      if (badgeEl) badgeEl.textContent = '100%';
      if (msgEl) msgEl.textContent = message || '✓ Download complete! Saving to browser...';
      if (fillEl) {
        fillEl.className = 'instagrab-toast-bar-fill complete';
        fillEl.style.width = '100%';
      }
      toast.classList.add('show');
      clearTimeout(activeToastTimeout);
      activeToastTimeout = setTimeout(() => toast.classList.remove('show'), 4200);
      return;
    }

    // Downloading or Processing state
    const pct = Math.max(2, Math.min(100, Math.round(progress)));
    if (iconEl) {
      iconEl.className = 'instagrab-toast-icon';
      iconEl.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
    }
    if (badgeEl) {
      badgeEl.textContent = state === 'processing' ? 'Muxing...' : `${pct}%`;
    }
    if (msgEl) {
      if (state === 'processing') {
        msgEl.textContent = 'Processing & muxing media files... 100%';
      } else if (speed) {
        msgEl.textContent = `${message || 'Downloading'} • ${speed}${eta ? ' • ETA ' + eta : ''}`;
      } else {
        msgEl.textContent = message || `Downloading... ${pct}%`;
      }
    }
    if (fillEl) {
      fillEl.className = 'instagrab-toast-bar-fill';
      fillEl.style.width = `${pct}%`;
    }

    toast.classList.add('show');
    clearTimeout(activeToastTimeout);
  }

  // Listen for live download progress broadcast from background service worker
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.action === 'downloadProgress') {
        updateToast({
          state: msg.state,
          progress: msg.progress,
          speed: msg.speed,
          eta: msg.eta,
          message: msg.filename ? msg.filename : (msg.state === 'processing' ? 'Processing media...' : 'Downloading...'),
          isError: msg.state === 'error'
        });
      }
    });
  }

  // Read user's selected preferences from extension storage (Format & Quality)
  async function getUserPreferences() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['pref_format', 'pref_quality'], (res) => {
          resolve({
            format_type: (res && res.pref_format) ? res.pref_format : 'video',
            quality: (res && res.pref_quality) ? res.pref_quality : 'best'
          });
        });
      } else {
        resolve({ format_type: 'video', quality: 'best' });
      }
    });
  }

  // Trigger download via Background Service Worker -> Browser Download Manager
  async function downloadMedia(url, button, label = 'Download') {
    if (button && button.classList.contains('instagrab-loading')) return;

    let originalContent = '';
    if (button) {
      originalContent = button.innerHTML;
      button.classList.add('instagrab-loading');
      button.innerHTML = originalContent.includes('<span') 
        ? `${SPINNER_ICON} <span>Starting...</span>` 
        : `${SPINNER_ICON}`;
    }

    const resetBtn = (success = false) => {
      if (!button) return;
      button.classList.remove('instagrab-loading');
      if (success) {
        button.classList.add('instagrab-success');
        button.innerHTML = originalContent.includes('<span') 
          ? `${CHECK_ICON} <span>Downloaded ✓</span>` 
          : `${CHECK_ICON}`;
        setTimeout(() => {
          button.classList.remove('instagrab-success');
          button.innerHTML = originalContent;
        }, 3500);
      } else {
        button.innerHTML = originalContent;
      }
    };

    try {
      const prefs = await getUserPreferences();
      const formatLabel = prefs.format_type === 'audio' ? 'Audio (MP3)' : (prefs.quality === 'best' ? 'Full HD' : prefs.quality);

      updateToast({
        message: `Starting ${formatLabel} download...`,
        progress: 5,
        state: 'starting'
      });

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(
          {
            action: 'download',
            url: url,
            format_type: prefs.format_type,
            quality: prefs.quality
          },
          (response) => {
            if (chrome.runtime.lastError || !response) {
              resetBtn(false);
              updateToast({
                message: '⚠️ Desktop Engine is offline. Please launch InstaGrab on your PC!',
                isError: true
              });
              return;
            }

            if (response.success) {
              resetBtn(true);
              updateToast({
                message: '✓ Download complete! Saving to your browser downloads...',
                progress: 100,
                state: 'complete'
              });
            } else if (response.offline) {
              resetBtn(false);
              updateToast({
                message: '⚠️ Desktop Engine is offline. Please launch InstaGrab on your PC!',
                isError: true
              });
            } else {
              resetBtn(false);
              updateToast({
                message: '❌ ' + (response.error || 'Download failed'),
                isError: true
              });
            }
          }
        );
      } else {
        resetBtn(false);
        updateToast({
          message: '⚠️ Extension context error. Please reload the page.',
          isError: true
        });
      }
    } catch (err) {
      resetBtn(false);
      updateToast({
        message: '⚠️ Could not trigger download. Ensure InstaGrab is running.',
        isError: true
      });
    }
  }

  // ================= PINTEREST MODULE =================
  function scanPinterest() {
    const pinMatch = window.location.pathname.match(/\/pin\/(\d+)/i);

    // 1. Opened Pin Closeup (Top Action Bar & Details)
    if (pinMatch || document.querySelector('div[role="dialog"]')) {
      const pinId = pinMatch ? pinMatch[1] : '';
      const pinUrl = pinId ? `https://www.pinterest.com/pin/${pinId}/` : window.location.href;

      // 1A. Top Action Row (Next to Red Save Button)
      const saveBtn = document.querySelector(
        'button[data-test-id="PinBetterSaveCanvas"], div[data-test-id="PinBetterSaveCanvas"], button[data-test-id="official-board-pin-save-button"], [data-test-id="closeup-action-bar"] button'
      );

      if (saveBtn && saveBtn.parentNode && !document.getElementById('instagrab-pin-top-btn')) {
        const topBtn = document.createElement('button');
        topBtn.id = 'instagrab-pin-top-btn';
        topBtn.type = 'button';
        topBtn.className = 'instagrab-opened-top-btn';
        topBtn.innerHTML = `${DOWNLOAD_ICON} <span>Download</span>`;
        topBtn.title = 'Download video/image to browser with InstaGrab';
        topBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          downloadMedia(pinUrl, topBtn, 'Download');
        });

        saveBtn.parentNode.insertBefore(topBtn, saveBtn);
      }

      // 1B. Details / Description Section
      const existingWrap = document.querySelector('.instagrab-opened-wrap');
      if (!existingWrap || existingWrap.dataset.pinUrl !== pinUrl) {
        if (existingWrap) existingWrap.remove();

        const titleEl = document.querySelector('[data-test-id="pin-title"], h1[data-test-id="pin-title"], [data-test-id="closeup-title"], h1');
        const descEl = document.querySelector('[data-test-id="truncated-description"], [data-test-id="closeup-description"], [data-test-id="pin-description"], [data-test-id="user-story-description"]');
        const targetEl = titleEl || descEl;

        if (targetEl && targetEl.parentNode) {
          const wrap = document.createElement('div');
          wrap.className = 'instagrab-opened-wrap';
          wrap.dataset.pinUrl = pinUrl;

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'instagrab-opened-btn';
          btn.innerHTML = `${DOWNLOAD_ICON} <span>Download with InstaGrab</span>`;
          btn.title = 'Download video/image to browser with InstaGrab';
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            downloadMedia(pinUrl, btn, 'Download with InstaGrab');
          });

          wrap.appendChild(btn);
          targetEl.parentNode.insertBefore(wrap, targetEl.nextSibling);
        }
      }
    }

    // 2. Feed Grid Pins (Red Hover-Only Circular Icon-Only Button)
    const pinCards = document.querySelectorAll('[data-test-id="pin"], [data-test-id="pinWrapper"], div[data-grid-item="true"], div.Pin, a[href*="/pin/"]');
    pinCards.forEach((card) => {
      if (card.dataset.instagrabInjected) return;
      if (card.closest('[data-test-id="closeup-stage"]') || card.closest('div[role="dialog"]')) return;

      const anchor = card.tagName === 'A' && card.href.includes('/pin/')
        ? card
        : card.querySelector('a[href*="/pin/"]');

      if (!anchor || !anchor.href) return;
      const match = anchor.href.match(/https?:\/\/[^/]*pinterest\.[a-z.]+\/pin\/(\d+)/i);
      if (!match) return;

      const pinUrl = `https://www.pinterest.com/pin/${match[1]}/`;
      card.dataset.instagrabInjected = 'true';

      const style = window.getComputedStyle(card);
      if (style.position === 'static') card.classList.add('instagrab-pin-container');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'instagrab-pin-btn';
      btn.innerHTML = DOWNLOAD_ICON;
      btn.title = 'Download to browser with InstaGrab';

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        downloadMedia(pinUrl, btn);
      });

      card.appendChild(btn);
    });
  }

  // ================= YOUTUBE MODULE =================
  function scanYouTube() {
    const isWatch = window.location.pathname === '/watch';
    const isShorts = window.location.pathname.startsWith('/shorts/');

    // 1. YouTube Watch Page Action Bar
    if (isWatch) {
      const actionsContainer = document.querySelector('ytd-watch-metadata #actions, #actions #top-level-buttons-computed, ytd-menu-renderer#top-level-buttons-computed');
      if (actionsContainer && !document.getElementById('instagrab-yt-btn')) {
        const btn = document.createElement('button');
        btn.id = 'instagrab-yt-btn';
        btn.type = 'button';
        btn.className = 'instagrab-yt-btn';
        btn.innerHTML = `${DOWNLOAD_ICON} <span>InstaGrab</span>`;
        btn.title = 'Download video/audio to browser with InstaGrab';

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          downloadMedia(window.location.href, btn, 'InstaGrab');
        });

        actionsContainer.insertBefore(btn, actionsContainer.firstChild);
      }
    }

    // 2. YouTube Shorts Vertical Action Bar
    if (isShorts) {
      // Find active Shorts renderer or visible reels action columns
      const actionColumns = document.querySelectorAll(
        'ytd-reel-video-renderer[is-active] #actions, ytd-reel-video-renderer[is-active] ytd-reel-player-overlay-renderer #actions, ytd-reel-player-overlay-renderer #actions, ytd-reel-video-renderer #actions'
      );

      actionColumns.forEach((bar) => {
        if (bar.dataset.instagrabInjected || bar.querySelector('.instagrab-yt-short-wrap')) return;

        // Ensure we're in the visible/active reel if multiple exist
        const renderer = bar.closest('ytd-reel-video-renderer');
        if (renderer && !renderer.hasAttribute('is-active') && actionColumns.length > 1) return;

        bar.dataset.instagrabInjected = 'true';

        const wrap = document.createElement('div');
        wrap.className = 'instagrab-yt-short-wrap';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'instagrab-yt-short-btn';
        btn.innerHTML = DOWNLOAD_ICON;
        btn.title = 'Download Short to browser with InstaGrab';

        const label = document.createElement('span');
        label.className = 'instagrab-yt-short-label';
        label.textContent = 'Download';

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          downloadMedia(window.location.href, btn);
        });

        wrap.appendChild(btn);
        wrap.appendChild(label);

        // Insert at the top of the action buttons column
        bar.insertBefore(wrap, bar.firstChild);
      });
    }
  }

  // ================= INSTAGRAM MODULE =================
  function scanInstagram() {
    // 1. Instagram Feed / Post Action Rows
    const postActionBars = document.querySelectorAll('section > div:has(svg), article section');
    postActionBars.forEach((bar) => {
      if (bar.dataset.instagrabInjected) return;
      const bookmarkSvg = bar.querySelector('svg[aria-label*="Save"], svg[aria-label*="Bookmark"], svg[aria-label*="सुरक्षित"]');
      if (bookmarkSvg) {
        bar.dataset.instagrabInjected = 'true';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'instagrab-ig-btn';
        btn.innerHTML = DOWNLOAD_ICON;
        btn.title = 'Download to browser with InstaGrab';

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const article = bar.closest('article');
          const postLink = article ? article.querySelector('a[href*="/p/"], a[href*="/reel/"]') : null;
          const url = postLink ? `https://www.instagram.com${postLink.getAttribute('href')}` : window.location.href;
          downloadMedia(url, btn);
        });

        const bookmarkContainer = bookmarkSvg.closest('div[role="button"]') || bookmarkSvg.parentElement;
        if (bookmarkContainer && bookmarkContainer.parentNode) {
          bookmarkContainer.parentNode.insertBefore(btn, bookmarkContainer);
        } else {
          bar.appendChild(btn);
        }
      }
    });

    // 2. Instagram Reels Action Stack
    const reelsContainers = document.querySelectorAll('div[role="dialog"] section, div:has(> svg[aria-label*="Like"])');
    reelsContainers.forEach((stack) => {
      if (stack.dataset.instagrabInjected) return;
      if (window.location.pathname.includes('/reels/') || window.location.pathname.includes('/reel/')) {
        const bookmark = stack.querySelector('svg[aria-label*="Save"], svg[aria-label*="Bookmark"]');
        if (bookmark) {
          stack.dataset.instagrabInjected = 'true';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'instagrab-ig-reel-btn';
          btn.innerHTML = DOWNLOAD_ICON;
          btn.title = 'Download Reel to browser with InstaGrab';

          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            downloadMedia(window.location.href, btn);
          });

          const bookmarkBtn = bookmark.closest('div[role="button"]') || bookmark.parentElement;
          if (bookmarkBtn && bookmarkBtn.parentNode) {
            bookmarkBtn.parentNode.insertBefore(btn, bookmarkBtn);
          }
        }
      }
    });
  }

  // ================= DISPATCHER & OBSERVER =================
  function scanAll() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('pinterest.')) {
      scanPinterest();
    } else if (host.includes('youtube.com')) {
      scanYouTube();
    } else if (host.includes('instagram.com')) {
      scanInstagram();
    }
  }

  let isScanning = false;
  function requestScan() {
    if (isScanning) return;
    isScanning = true;
    requestAnimationFrame(() => {
      scanAll();
      isScanning = false;
    });
  }

  window.addEventListener('popstate', requestScan);
  window.addEventListener('yt-navigate-finish', requestScan);

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

  console.log('[InstaGrab] Universal media downloader active (Pinterest, YouTube & Instagram)');
})();

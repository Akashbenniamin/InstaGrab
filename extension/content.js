// InstaGrab - Cross-Platform Content Script (Pinterest, YouTube & Instagram)
(function () {
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

  // Trigger download via Background Service Worker -> Browser Download Manager
  async function downloadMedia(url, button, label = 'Download') {
    if (button.classList.contains('instagrab-loading')) return;

    const originalContent = button.innerHTML;
    button.classList.add('instagrab-loading');
    button.innerHTML = originalContent.includes('<span') 
      ? `${SPINNER_ICON} <span>Starting...</span>` 
      : `${SPINNER_ICON}`;

    const resetBtn = (success = false) => {
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
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(
          { action: 'download', url: url, format_type: 'video', quality: 'best' },
          (response) => {
            if (chrome.runtime.lastError || !response) {
              resetBtn(false);
              showToast('⚠️ Desktop Engine is offline. Please launch InstaGrab on your PC!', true);
              return;
            }

            if (response.success) {
              resetBtn(true);
              showToast('✓ InstaGrab: Downloading to your browser!');
            } else if (response.offline) {
              resetBtn(false);
              showToast('⚠️ Desktop Engine is offline. Please launch InstaGrab on your PC!', true);
            } else {
              resetBtn(false);
              showToast('❌ ' + (response.error || 'Download failed'), true);
            }
          }
        );
      } else {
        resetBtn(false);
        showToast('⚠️ Extension context error. Please reload the page.', true);
      }
    } catch (err) {
      resetBtn(false);
      showToast('⚠️ Could not trigger download. Ensure InstaGrab is running.', true);
    }
  }

  // ================= PINTEREST MODULE =================
  function scanPinterest() {
    // 1. Opened Pin Closeup (Text Fields)
    const isPinPage = window.location.pathname.includes('/pin/');
    const dialog = document.querySelector('div[role="dialog"]');
    if (isPinPage || dialog) {
      let pinUrl = window.location.href;
      const pinMatch = pinUrl.match(/https?:\/\/[^/]*pinterest\.[a-z.]+\/pin\/(\d+)/i);
      if (pinMatch) {
        const existingWrap = document.querySelector('.instagrab-opened-wrap');
        if (!existingWrap || existingWrap.dataset.pinUrl !== pinUrl) {
          if (existingWrap) existingWrap.remove();

          const titleEl = document.querySelector('[data-test-id="pin-title"], h1[data-test-id="pin-title"], [data-test-id="closeup-title"], h1');
          const descEl = document.querySelector('[data-test-id="truncated-description"], [data-test-id="closeup-description"], [data-test-id="pin-description"]');
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
    }

    // 2. Feed Grid Pins (Circular Icon-Only Button left to Save button)
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
      const shortsActions = document.querySelectorAll('ytd-reel-player-overlay-renderer #actions, ytd-reel-video-renderer[is-active] #actions');
      shortsActions.forEach((bar) => {
        if (bar.dataset.instagrabInjected) return;
        bar.dataset.instagrabInjected = 'true';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'instagrab-yt-short-btn';
        btn.innerHTML = DOWNLOAD_ICON;
        btn.title = 'Download Short to browser with InstaGrab';

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          downloadMedia(window.location.href, btn);
        });

        bar.insertBefore(btn, bar.firstChild);
      });
    }
  }

  // ================= INSTAGRAM MODULE =================
  function scanInstagram() {
    // 1. Instagram Feed / Post Action Rows
    const postActionBars = document.querySelectorAll('section > div:has(svg), article section');
    postActionBars.forEach((bar) => {
      if (bar.dataset.instagrabInjected) return;
      // Look for the bookmark/save icon container in the same row
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
          // Find article link or use current page
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

  // SPA navigation listeners
  window.addEventListener('popstate', requestScan);
  window.addEventListener('yt-navigate-finish', requestScan); // YouTube specific SPA event

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

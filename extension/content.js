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
        <div class="instagrab-toast-ad">
          <span class="instagrab-ad-badge">Ad</span>
          <span class="instagrab-ad-text">Fast &amp; Private 4K Video Downloader</span>
          <a href="https://instagrab.app" target="_blank" rel="noopener noreferrer" class="instagrab-ad-link">InstaGrab Pro</a>
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
        fillEl.style.setProperty('width', '100%', 'important');
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
        fillEl.style.setProperty('width', '100%', 'important');
      }
      toast.classList.add('show');
      clearTimeout(activeToastTimeout);
      activeToastTimeout = setTimeout(() => toast.classList.remove('show'), 4200);
      return;
    }

    // Downloading or Processing state
    const pct = Math.max(3, Math.min(100, Math.round(progress)));
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
      fillEl.style.setProperty('width', `${pct}%`, 'important');
    }

    toast.classList.add('show');
    clearTimeout(activeToastTimeout);
  }

  // Detect currently active/playing media on the webpage
  function detectActiveMediaOnPage() {
    const host = window.location.hostname.toLowerCase();
    const path = window.location.pathname;

    // 1. YouTube
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      if (path === '/watch' || path.startsWith('/shorts/')) {
        return { url: window.location.href, platform: 'youtube' };
      }
      const activeShort = document.querySelector('ytd-reel-video-renderer[is-active]');
      if (activeShort) {
        const link = activeShort.querySelector('a[href*="/shorts/"]');
        if (link && link.href) return { url: link.href, platform: 'youtube' };
      }
    }

    // 2. Pinterest
    if (host.includes('pinterest.')) {
      const pinMatch = path.match(/\/pin\/(\d+)/i);
      if (pinMatch) {
        return { url: `https://www.pinterest.com/pin/${pinMatch[1]}/`, platform: 'pinterest' };
      }
      const closeupLink = document.querySelector('[data-test-id="closeup-stage"] a[href*="/pin/"], div[role="dialog"] a[href*="/pin/"]');
      if (closeupLink && closeupLink.href) {
        const m = closeupLink.href.match(/\/pin\/(\d+)/i);
        if (m) return { url: `https://www.pinterest.com/pin/${m[1]}/`, platform: 'pinterest' };
      }
    }

    // 3. Instagram
    if (host.includes('instagram.com')) {
      // Direct post/reel URL
      const directMatch = path.match(/\/(?:p|reel|reels|tv|share\/reel|share\/p)\/([A-Za-z0-9_-]+)/);
      if (directMatch) {
        const type = path.includes('reel') ? 'reel' : (path.includes('tv') ? 'tv' : 'p');
        return { url: `https://www.instagram.com/${type}/${directMatch[1]}/`, platform: 'instagram' };
      }

      // Check open modal/dialog
      const dialog = document.querySelector('div[role="dialog"]');
      if (dialog) {
        const link = dialog.querySelector('a[href*="/reel/"], a[href*="/p/"]');
        if (link) {
          const href = link.getAttribute('href');
          if (href) return { url: new URL(href, window.location.origin).href, platform: 'instagram' };
        }
      }

      // Check active playing video or video closest to screen center
      const videos = Array.from(document.querySelectorAll('video'));
      let targetVideo = videos.find(v => !v.paused && v.offsetWidth > 120);
      if (!targetVideo && videos.length > 0) {
        const vh = window.innerHeight;
        let minDiff = Infinity;
        videos.forEach(v => {
          const rect = v.getBoundingClientRect();
          if (rect.height > 100 && rect.bottom > 0 && rect.top < vh) {
            const diff = Math.abs((rect.top + rect.bottom) / 2 - vh / 2);
            if (diff < minDiff) {
              minDiff = diff;
              targetVideo = v;
            }
          }
        });
      }

      if (targetVideo) {
        const container = targetVideo.closest('article') || targetVideo.closest('div[role="dialog"]') || targetVideo.closest('section') || targetVideo.parentElement?.parentElement?.parentElement;
        if (container) {
          const link = container.querySelector('a[href*="/reel/"], a[href*="/p/"]');
          if (link) {
            const href = link.getAttribute('href');
            if (href) return { url: new URL(href, window.location.origin).href, platform: 'instagram' };
          }
        }
      }
    }

    return null;
  }

  let currentActiveButton = null;
  let currentActiveButtonOriginal = '';

  // Listen for messages from popup and background service worker
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.action === 'detectCurrentMedia') {
        const detected = detectActiveMediaOnPage();
        sendResponse(detected);
        return true;
      }
      if (msg && msg.action === 'convertImageToPng') {
        const srcUrl = msg.srcUrl;
        (async () => {
          try {
            const imgs = Array.from(document.querySelectorAll('img'));
            const matchingImg = imgs.find(img => img.src === srcUrl || img.currentSrc === srcUrl);
            if (matchingImg && matchingImg.naturalWidth && matchingImg.complete) {
              const canvas = document.createElement('canvas');
              canvas.width = matchingImg.naturalWidth;
              canvas.height = matchingImg.naturalHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(matchingImg, 0, 0);
              const dataUrl = canvas.toDataURL('image/png');
              if (dataUrl && dataUrl.startsWith('data:image/png')) {
                sendResponse({ dataUrl });
                return;
              }
            }
          } catch (e) {}

          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL('image/png');
                sendResponse({ dataUrl });
              } catch (err) {
                sendResponse(null);
              }
            };
            img.onerror = () => sendResponse(null);
            img.src = srcUrl;
          } catch (err) {
            sendResponse(null);
          }
        })();
        return true;
      }
      if (msg && msg.action === 'downloadProgress') {
        updateToast({
          state: msg.state,
          progress: msg.progress,
          speed: msg.speed,
          eta: msg.eta,
          message: msg.filename ? msg.filename : (msg.state === 'processing' ? 'Processing media...' : 'Downloading...'),
          isError: msg.state === 'error'
        });

        if (currentActiveButton) {
          if (msg.state === 'complete') {
            currentActiveButton.classList.remove('instagrab-loading');
            currentActiveButton.classList.add('instagrab-success');
            currentActiveButton.innerHTML = currentActiveButtonOriginal.includes('<span')
              ? `${CHECK_ICON} <span>Downloaded ✓</span>`
              : `${CHECK_ICON}`;
            const btnRef = currentActiveButton;
            const orig = currentActiveButtonOriginal;
            setTimeout(() => {
              btnRef.classList.remove('instagrab-success');
              btnRef.innerHTML = orig;
            }, 3500);
            currentActiveButton = null;
          } else if (msg.state === 'error') {
            currentActiveButton.classList.remove('instagrab-loading');
            currentActiveButton.innerHTML = currentActiveButtonOriginal;
            currentActiveButton = null;
          }
        }
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

  // Trigger download via Background Service Worker -> Browser Download Manager
  async function downloadMedia(url, button, label = 'Download') {
    if (button && button.classList.contains('instagrab-loading')) return;
    url = normalizeMediaUrl(url);

    if (button) {
      currentActiveButton = button;
      currentActiveButtonOriginal = button.innerHTML;
      button.classList.add('instagrab-loading');
      button.innerHTML = currentActiveButtonOriginal.includes('<span') 
        ? `${SPINNER_ICON} <span>Starting...</span>` 
        : `${SPINNER_ICON}`;
    }

    const resetBtn = () => {
      if (currentActiveButton) {
        currentActiveButton.classList.remove('instagrab-loading');
        currentActiveButton.innerHTML = currentActiveButtonOriginal;
        currentActiveButton = null;
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
              resetBtn();
              updateToast({
                message: '⚠️ Desktop Engine is offline. Please launch InstaGrab on your PC!',
                isError: true
              });
              return;
            }

            if (response.success) {
              updateToast({
                message: `Downloading ${formatLabel}...`,
                progress: 10,
                state: 'starting'
              });
            } else if (response.offline) {
              resetBtn();
              updateToast({
                message: '⚠️ Desktop Engine is offline. Please launch InstaGrab on your PC!',
                isError: true
              });
            } else {
              resetBtn();
              updateToast({
                message: '❌ ' + (response.error || 'Download failed'),
                isError: true
              });
            }
          }
        );
      } else {
        resetBtn();
        updateToast({
          message: '⚠️ Extension context error. Please reload the page.',
          isError: true
        });
      }
    } catch (err) {
      resetBtn();
      updateToast({
        message: '⚠️ Could not trigger download. Ensure InstaGrab is running.',
        isError: true
      });
    }
  }

  // ================= PINTEREST MODULE =================
  function scanPinterest() {
    const pinMatch = window.location.pathname.match(/\/pin\/(\d+)/i);

    // 1. Opened Pin Closeup (Top Action Bar next to Save)
    if (pinMatch || document.querySelector('div[role="dialog"]') || window.location.pathname.includes('/pin/')) {
      const pinId = pinMatch ? pinMatch[1] : '';
      const pinUrl = pinId ? `https://www.pinterest.com/pin/${pinId}/` : window.location.href;

      // 1A. Top Action Row (Single native button next to Red Save Button)
      let hasTopBtn = !!document.getElementById('instagrab-pin-top-btn');
      if (!hasTopBtn) {
        const allButtons = Array.from(document.querySelectorAll('button, div[role="button"]'));
        const saveBtn = allButtons.find(b => {
          const txt = (b.textContent || '').trim();
          return (txt === 'Save' || txt === 'सहेजें' || txt === 'Enregistrer' || txt === 'Guardar') && b.offsetWidth > 20;
        }) || document.querySelector(
          'button[data-test-id="PinBetterSaveCanvas"], div[data-test-id="PinBetterSaveCanvas"], button[data-test-id="official-board-pin-save-button"], [data-test-id="closeup-action-bar"] button'
        );

        if (saveBtn && saveBtn.parentNode) {
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
          hasTopBtn = true;
        }
      }

      // If top action button exists, remove any description-area duplicate to guarantee strictly ONE button
      if (hasTopBtn) {
        const oldWrap = document.querySelector('.instagrab-opened-wrap');
        if (oldWrap) oldWrap.remove();
      } else {
        // Fallback only if Save button wasn't found
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
            btn.innerHTML = `${DOWNLOAD_ICON} <span>Download</span>`;
            btn.title = 'Download video/image to browser with InstaGrab';
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              downloadMedia(pinUrl, btn, 'Download');
            });

            wrap.appendChild(btn);
            targetEl.parentNode.insertBefore(wrap, targetEl.nextSibling);
          }
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
      const activeReel = document.querySelector('ytd-reel-video-renderer[is-active]') || document.querySelector('ytd-reel-video-renderer');
      const actionColumns = activeReel 
        ? activeReel.querySelectorAll('#actions-inner, #actions')
        : document.querySelectorAll('ytd-reel-video-renderer[is-active] #actions, ytd-reel-video-renderer[is-active] #actions-inner, #actions-inner, #actions');

      actionColumns.forEach((actionColumn) => {
        if (actionColumn.querySelector('.instagrab-yt-short-wrap')) return;

        const likeEl = actionColumn.querySelector('ytd-like-button-renderer, #like-button') || actionColumn.firstElementChild;
        if (!likeEl) return;

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

        if (likeEl.parentElement === actionColumn) {
          actionColumn.insertBefore(wrap, likeEl);
        } else {
          actionColumn.insertBefore(wrap, actionColumn.firstChild);
        }
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
    requestScan();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['is-active', 'class']
  });

  // Dynamic SPA heartbeat scan (every 1000ms) for Shorts and Pinterest modal changes
  setInterval(requestScan, 1000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAll);
  } else {
    scanAll();
  }

  console.log('[InstaGrab] Universal media downloader active (Pinterest, YouTube & Instagram)');
})();

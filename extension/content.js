// InstaGrab - Cross-Platform Content Script (Pinterest, YouTube, Instagram, Spotify, Magnific, Flaticon, Envato & Epidemic Sound)
(function () {
  const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
  const COPY_ICON = `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
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
      if (state === 'processing') {
        badgeEl.textContent = `${pct}%`;
      } else if (state === 'extracting' || state === 'starting') {
        badgeEl.textContent = `${pct}%`;
      } else {
        badgeEl.textContent = `${pct}%`;
      }
    }
    if (msgEl) {
      if (state === 'processing') {
        msgEl.textContent = speed || message || `Processing media files... ${pct}%`;
      } else if (state === 'extracting') {
        msgEl.textContent = speed || 'Extracting media info...';
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
      // Stories & Highlights
      if (path.includes('/stories/') || path.startsWith('/s/')) {
        return { url: window.location.href, platform: 'instagram' };
      }

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

    // 4. Envato Elements & AudioJungle
    if (host.includes('envato.com') || host.includes('audiojungle.net')) {
      const cleanPath = path.replace(/\/+$/, '');
      // Check if on a single item page
      if (/[a-zA-Z0-9-]+-[A-Za-z0-9]{6,10}$/.test(cleanPath) && !cleanPath.endsWith('/sound-effects') && !cleanPath.endsWith('/royalty-free-music')) {
        return { url: window.location.href.split('?')[0], platform: 'envato' };
      }
      if (/\/item\/[^/]+\/\d+/.test(cleanPath)) {
        return { url: window.location.href.split('?')[0], platform: 'envato' };
      }
      // On listing/search pages, check if an <audio> element is currently playing or has progress
      const audios = Array.from(document.querySelectorAll('audio'));
      const activeAudio = audios.find(a => !a.paused || a.currentTime > 0);
      if (activeAudio) {
        const row = activeAudio.parentElement?.parentElement || activeAudio.closest('div');
        const titleLink = row ? row.querySelector('a[data-testid="title-link"], a[href*="-"]') : null;
        if (titleLink && titleLink.getAttribute('href')) {
          return { url: new URL(titleLink.getAttribute('href'), window.location.origin).href, platform: 'envato' };
        }
        const srcEl = activeAudio.querySelector('source[type="audio/mpeg"]') || activeAudio.querySelector('source');
        const srcUrl = activeAudio.currentSrc || (srcEl ? srcEl.src : '');
        if (srcUrl) {
          return { url: srcUrl, platform: 'envato' };
        }
      }
    }

    // 5. Epidemic Sound
    if (host.includes('epidemicsound.com')) {
      const cleanPath = path.replace(/\/+$/, '');
      if (/\/(?:music|sound-effects)\/tracks\/[a-fA-F0-9-]{10,}/.test(cleanPath) || /\/track\/[A-Za-z0-9_-]+/.test(cleanPath)) {
        return { url: window.location.href.split('?')[0], platform: 'epidemic' };
      }
      const audios = Array.from(document.querySelectorAll('audio'));
      const activeAudio = audios.find(a => (!a.paused || a.currentTime > 0) && (a.currentSrc || a.src));
      if (activeAudio) {
        const srcUrl = activeAudio.currentSrc || activeAudio.src;
        if (srcUrl && srcUrl.includes('epidemicsound.com')) {
          return { url: srcUrl, platform: 'epidemic' };
        }
      }
      if (window.location.search.includes('term=')) {
        return { url: window.location.href, platform: 'epidemic' };
      }
    }

    // 6. Magnific / Freepik
    if (host.includes('magnific.') || host.includes('freepik.com')) {
      return { url: window.location.href, platform: 'magnific' };
    }

    // 7. Flaticon
    if (host.includes('flaticon.com')) {
      return { url: window.location.href, platform: 'flaticon' };
    }

    // 8. Spotify
    if (host.includes('spotify.com')) {
      const cleanPath = path.replace(/\/+$/, '');
      if (/\/(?:track|playlist|album)\/[A-Za-z0-9]+/.test(cleanPath)) {
        return { url: window.location.href.split('?')[0], platform: 'spotify' };
      }
      const nowPlayingLink = document.querySelector('[data-testid="now-playing-widget"] a[href*="/track/"], [data-testid="context-item-info-title"] a[href*="/track/"]');
      if (nowPlayingLink && nowPlayingLink.getAttribute('href')) {
        return { url: new URL(nowPlayingLink.getAttribute('href'), window.location.origin).href.split('?')[0], platform: 'spotify' };
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

      // 1. YouTube watch URLs: strip playlist and secondary params
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
    } catch {}
    return rawUrl;
  }

  // Trigger download via Background Service Worker -> Browser Download Manager
  async function downloadMedia(url, button, label = 'Download', extraOptions = {}) {
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
      const isAudioPlatform = url && (
        url.includes('envato.com') ||
        url.includes('audiojungle.net') ||
        url.includes('envatousercontent.com') ||
        url.includes('epidemicsound.com') ||
        url.includes('spotify.com')
      );
      const isVisualPlatform = url && (
        url.includes('magnific.') ||
        url.includes('freepik.com') ||
        url.includes('cdnpk.net') ||
        url.includes('flaticon.com')
      );
      const effectiveFormat = extraOptions.format_type || (isAudioPlatform ? 'audio' : (isVisualPlatform ? 'video' : prefs.format_type));
      const effectiveQuality = extraOptions.quality || prefs.quality;
      const formatLabel = label !== 'Download' ? label : (effectiveFormat === 'audio' ? 'Audio (MP3)' : (effectiveQuality === 'best' ? 'Full HD' : effectiveQuality));

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
            format_type: effectiveFormat,
            quality: effectiveQuality,
            options: extraOptions
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

  // Copy any image/icon URL as a pure PNG to the system clipboard
  async function copyImageAsPngToClipboard(imageUrl, button) {
    if (!imageUrl || (button && button.classList.contains('instagrab-loading'))) return;
    const origHtml = button ? button.innerHTML : '';
    if (button) {
      button.classList.add('instagrab-loading');
      button.innerHTML = origHtml.includes('<span') ? `${SPINNER_ICON} <span>Copying...</span>` : `${SPINNER_ICON}`;
    }

    const restoreBtn = (isSuccess = false) => {
      if (!button) return;
      button.classList.remove('instagrab-loading');
      if (isSuccess) {
        button.classList.add('instagrab-success');
        button.innerHTML = origHtml.includes('<span') ? `${CHECK_ICON} <span>Copied!</span>` : `${CHECK_ICON}`;
        setTimeout(() => {
          button.classList.remove('instagrab-success');
          button.innerHTML = origHtml;
        }, 2500);
      } else {
        button.innerHTML = origHtml;
      }
    };

    try {
      updateToast({
        message: 'Converting & copying PNG to clipboard...',
        progress: 45,
        state: 'processing'
      });

      const dataUrl = await new Promise((resolve, reject) => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'fetchPngDataUrl', url: imageUrl }, (res) => {
            if (chrome.runtime.lastError || !res || !res.success || !res.dataUrl) {
              reject(new Error((res && res.error) || 'Failed to fetch PNG'));
            } else {
              resolve(res.dataUrl);
            }
          });
        } else {
          reject(new Error('Extension runtime unavailable'));
        }
      });

      const resp = await fetch(dataUrl);
      const pngBlob = await resp.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);

      restoreBtn(true);
      updateToast({
        message: '✓ Crisp PNG copied to clipboard!',
        progress: 100,
        state: 'complete'
      });
    } catch (err) {
      console.warn('[InstaGrab] Copy PNG error:', err);
      restoreBtn(false);
      updateToast({
        message: '❌ Could not copy PNG to clipboard: ' + (err.message || 'Permission denied'),
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

    // 3. Instagram Stories & Highlights Viewer
    if (window.location.pathname.includes('/stories/') || window.location.pathname.startsWith('/s/')) {
      const closeBtn = document.querySelector('svg[aria-label*="Close"], svg[aria-label*="बंद करें"]')?.closest('button, div[role="button"]');
      const moreBtn = document.querySelector('svg[aria-label*="More options"], svg[aria-label*="विकल्प"], svg[aria-label*="Options"]')?.closest('button, div[role="button"]');
      const muteBtn = document.querySelector('svg[aria-label*="Audio"], svg[aria-label*="Mute"], svg[aria-label*="Unmute"]')?.closest('button, div[role="button"]');
      const storyHeader = document.querySelector('section header, div[role="dialog"] header, header:has(svg)');
      const targetContainer = (closeBtn?.parentNode) || (moreBtn?.parentNode) || (muteBtn?.parentNode) || storyHeader;

      if (targetContainer && !document.getElementById('instagrab-ig-story-btn')) {
        const btn = document.createElement('button');
        btn.id = 'instagrab-ig-story-btn';
        btn.type = 'button';
        btn.className = 'instagrab-ig-story-btn';
        btn.innerHTML = DOWNLOAD_ICON;
        btn.title = 'Download Story / Highlight with InstaGrab';

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          downloadMedia(window.location.href, btn);
        });

        if (closeBtn && closeBtn.parentNode) {
          closeBtn.parentNode.insertBefore(btn, closeBtn);
        } else if (moreBtn && moreBtn.parentNode) {
          moreBtn.parentNode.insertBefore(btn, moreBtn);
        } else {
          targetContainer.appendChild(btn);
        }
      }
    }
  }

  // ================= ENVATO AUDIO & SFX MODULE =================
  // Helper: Resolve the un-watermarked Play Button <audio data-testid="audio-element"> stream URL
  // (https://public-assets.content-platform.envatousercontent.com/.../preview.mp3)
  // rather than the "Download preview" link (audio-previews.elements.envatousercontent.com).
  function resolveEnvatoPlayButtonUrl(scopeEl, fallbackItemUrl, titleText) {
    try {
      const audioEl = scopeEl
        ? (scopeEl.tagName === 'AUDIO' ? scopeEl : scopeEl.querySelector('audio[data-testid="audio-element"], audio'))
        : document.querySelector('audio[data-testid="audio-element"], audio');
      if (audioEl) {
        const sources = Array.from(audioEl.querySelectorAll('source'));
        const mp3Source = sources.find(s => (s.type === 'audio/mpeg' || (s.src && s.src.includes('.mp3'))) && s.src && s.src.includes('public-assets.content-platform.envatousercontent.com'))
          || sources.find(s => s.src && s.src.includes('public-assets.content-platform.envatousercontent.com'));
        const rawSrc = (mp3Source && mp3Source.src) || (audioEl.currentSrc && audioEl.currentSrc.includes('public-assets.content-platform.envatousercontent.com') ? audioEl.currentSrc : '');
        if (rawSrc) {
          const u = new URL(rawSrc);
          if (titleText) u.searchParams.set('instagrab_title', titleText.trim());
          return u.href;
        }
      }
    } catch (_) {}
    return fallbackItemUrl;
  }

  function scanEnvato() {
    // 1. Track Rows on Envato Elements Music & Sound Effects listings
    const titleLinks = document.querySelectorAll('a[data-testid="title-link"]');
    titleLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;

      // Locate the enclosing track row container that holds both the title link and item-actions / waveform
      let row = link.parentElement;
      for (let i = 0; i < 6 && row; i++) {
        if (row.querySelector('[data-testid="item-actions"]') || row.querySelector('[data-testid="audio-waveform"]')) {
          break;
        }
        row = row.parentElement;
      }
      if (!row || row.dataset.instagrabInjected) return;
      row.dataset.instagrabInjected = 'true';

      const itemUrl = new URL(href, window.location.origin).href;
      const rowTitle = (link.textContent || '').trim();
      const actionsArea = row.querySelector('[data-testid="item-actions"]')?.firstElementChild || row.querySelector('[data-testid="item-actions"]');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'instagrab-envato-row-btn';
      btn.innerHTML = `${DOWNLOAD_ICON} <span>MP3</span>`;
      btn.title = 'Download Play Button Audio (MP3) with InstaGrab';

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetUrl = resolveEnvatoPlayButtonUrl(row, itemUrl, rowTitle);
        downloadMedia(targetUrl, btn, 'MP3');
      });

      if (actionsArea) {
        actionsArea.insertBefore(btn, actionsArea.firstChild);
      } else {
        link.parentElement?.appendChild(btn);
      }
    });

    // 2. Single Audio / SFX Item Detail Page on Envato Elements or AudioJungle
    const cleanPath = window.location.pathname.replace(/\/+$/, '');
    const isItemPage = (
      (/[a-zA-Z0-9-]+-[A-Za-z0-9]{6,10}$/.test(cleanPath) && !cleanPath.endsWith('/sound-effects') && !cleanPath.endsWith('/royalty-free-music')) ||
      /\/item\/[^/]+\/\d+/.test(cleanPath)
    );
    const hasAudioOnPage = !!(document.querySelector('audio') || document.querySelector('[data-testid="audio-waveform"]'));

    if (isItemPage && hasAudioOnPage && !document.getElementById('instagrab-envato-item-btn')) {
      const h1 = document.querySelector('h1');
      if (h1 && h1.parentElement) {
        const btn = document.createElement('button');
        btn.id = 'instagrab-envato-item-btn';
        btn.type = 'button';
        btn.className = 'instagrab-envato-item-btn';
        btn.innerHTML = `${DOWNLOAD_ICON} <span>Download Audio (MP3)</span>`;
        btn.title = 'Download Play Button Audio (MP3) with InstaGrab';

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const currentTitle = document.querySelector('h1')?.textContent?.trim() || '';
          const firstAudio = document.querySelector('audio[data-testid="audio-element"]');
          const pageUrl = window.location.href.split('?')[0];
          const targetUrl = resolveEnvatoPlayButtonUrl(firstAudio, pageUrl, currentTitle);
          downloadMedia(targetUrl, btn, 'Download Audio (MP3)');
        });

        h1.parentElement.appendChild(btn);
      }
    }
  }

  // ================= EPIDEMIC SOUND MODULE =================
  function resolveEpidemicRowTargetUrl(row) {
    try {
      // 1. Check for direct track link inside row
      const trackLink = row.querySelector('a[href*="/music/tracks/"], a[href*="/sound-effects/tracks/"], a[href*="/track/"]');
      if (trackLink && trackLink.getAttribute('href')) {
        return new URL(trackLink.getAttribute('href'), window.location.origin).href;
      }

      // 2. Extract track title from row (<img alt="Title"> or title text element)
      let title = '';
      const imgWithAlt = row.querySelector('img[alt]');
      if (imgWithAlt && imgWithAlt.getAttribute('alt')) {
        const altVal = imgWithAlt.getAttribute('alt').trim();
        if (altVal && altVal.toLowerCase() !== 'cover' && altVal.toLowerCase() !== 'waveform') {
          title = altVal;
        }
      }
      if (!title) {
        const textEls = Array.from(row.querySelectorAll('[class*="Title"], [class*="title"], [class*="_text_"], a, span, p'));
        for (const el of textEls) {
          const t = (el.textContent || '').trim();
          if (t && t.length >= 2 && t.length <= 90 && !/^\d{2}:\d{2}/.test(t) && !/^(MP3|Download|Like|Share|Similar)$/i.test(t)) {
            title = t;
            break;
          }
        }
      }

      // 3. If this row is currently playing (has Pause button) or is the bottom player bar, check active <audio>
      const isPlayingRow = !!row.querySelector('button[aria-label*="Pause"], [aria-label*="Pause"]');
      const isBottomBar = row.tagName === 'FOOTER' || row.closest('footer') || (row.getBoundingClientRect && row.getBoundingClientRect().top > window.innerHeight - 120);
      if (isPlayingRow || isBottomBar) {
        const audios = Array.from(document.querySelectorAll('audio'));
        const activeAudio = audios.find(a => (a.currentSrc || a.src) && (a.currentSrc || a.src).includes('epidemicsound.com'));
        if (activeAudio) {
          const audioSrc = activeAudio.currentSrc || activeAudio.src;
          const u = new URL(audioSrc);
          if (title) u.searchParams.set('instagrab_title', title);
          return u.href;
        }
      }

      // 4. Construct search/title lookup URL resolved by local-helper via /json/search/sfx/ or /json/search/tracks/
      if (title) {
        const isSfx = window.location.pathname.includes('sound-effects') ? '1' : '0';
        const basePath = window.location.pathname.includes('sound-effects') ? '/sound-effects/search' : '/music/search';
        return `https://www.epidemicsound.com${basePath}?term=${encodeURIComponent(title)}&instagrab_title=${encodeURIComponent(title)}&instagrab_sfx=${isSfx}`;
      }
    } catch (_) {}
    return window.location.href;
  }

  function injectEpidemicRowButton(row, insertBeforeEl) {
    if (!row || row.dataset.instagrabInjected) return;
    row.dataset.instagrabInjected = 'true';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'instagrab-epidemic-row-btn';
    btn.innerHTML = `${DOWNLOAD_ICON} <span>MP3</span>`;
    btn.title = 'Download 320kbps MP3 Audio / SFX with InstaGrab';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const targetUrl = resolveEpidemicRowTargetUrl(row);
      downloadMedia(targetUrl, btn, 'MP3');
    });

    if (insertBeforeEl && insertBeforeEl.parentElement) {
      insertBeforeEl.parentElement.insertBefore(btn, insertBeforeEl);
    } else {
      const actionBtn = row.querySelector('button[aria-label*="Download"], button[title*="Download"], button[aria-label*="Like"], button[aria-label*="Add"], button[aria-label*="More"]');
      if (actionBtn && actionBtn.parentElement) {
        actionBtn.parentElement.insertBefore(btn, actionBtn);
      } else {
        row.appendChild(btn);
      }
    }
  }

  function scanEpidemic() {
    // 1A. Scan all native Download buttons on list/carousel/search rows & bottom player bar
    // (Covers /sound-effects/search?term=pop, /music/search, category carousels, and sticky player)
    const nativeDlBtns = document.querySelectorAll('button[aria-label="Download"], button[aria-label*="Download"], a[aria-label="Download"]');
    nativeDlBtns.forEach((dlBtn) => {
      if (dlBtn.classList.contains('instagrab-epidemic-row-btn') || dlBtn.classList.contains('instagrab-epidemic-item-btn')) return;

      // Walk up to find the enclosing track row or player bar container
      let row = dlBtn.closest('[class*="TrackRow"], [role="row"], li, footer');
      if (!row) {
        let curr = dlBtn.parentElement;
        for (let i = 0; i < 6 && curr && curr !== document.body; i++) {
          if (
            curr.querySelector('img[alt]') ||
            curr.querySelector('button[aria-label*="Play"], button[aria-label*="Pause"]') ||
            curr.querySelector('a[href*="/track"]')
          ) {
            row = curr;
            break;
          }
          curr = curr.parentElement;
        }
      }
      if (!row) row = dlBtn.parentElement?.parentElement || dlBtn.parentElement;
      if (!row || row.dataset.instagrabInjected) return;

      injectEpidemicRowButton(row, dlBtn);
    });

    // 1B. Scan any track links that didn't have a native Download button
    const trackLinks = document.querySelectorAll('a[href*="/music/tracks/"], a[href*="/sound-effects/tracks/"], a[href*="/track/"]');
    trackLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;
      const row = link.closest('[class*="TrackRow"], [role="row"], li') || link.parentElement?.parentElement;
      if (!row || row.dataset.instagrabInjected) return;
      injectEpidemicRowButton(row, null);
    });

    // 2. Single Track Detail Page on Epidemic Sound
    const cleanPath = window.location.pathname.replace(/\/+$/, '');
    const isTrackPage = (
      /\/(?:music|sound-effects)\/tracks\/[a-fA-F0-9-]{10,}/.test(cleanPath) ||
      /\/track\/[A-Za-z0-9_-]+/.test(cleanPath)
    );

    if (isTrackPage && !document.getElementById('instagrab-epidemic-item-btn')) {
      const h1 = document.querySelector('h1');
      if (h1 && h1.parentElement) {
        const btn = document.createElement('button');
        btn.id = 'instagrab-epidemic-item-btn';
        btn.type = 'button';
        btn.className = 'instagrab-epidemic-item-btn';
        btn.innerHTML = `${DOWNLOAD_ICON} <span>Download Audio (MP3)</span>`;
        btn.title = 'Download 320kbps MP3 with InstaGrab';

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          downloadMedia(window.location.href.split('?')[0], btn, 'Download Audio (MP3)');
        });

        h1.parentElement.appendChild(btn);
      }
    }
  }

  // ================= MAGNIFIC / FREEPIK MODULE =================
  // Supports:
  // - Search/Grid/Carousel Cards: Direct Preview download (as-is), Video + Video Thumbnail download, Icon PNG + Copy
  // - Opened Detail Modal / Single Page: Full Size (HD 2000px) download, Copy as PNG, Full Video MP4 + HD Thumbnail
  function getMagnificFullImageUrl(imgEl, fallbackUrl) {
    let bestUrl = fallbackUrl || '';
    if (imgEl) {
      const srcset = imgEl.getAttribute('srcset') || '';
      if (srcset) {
        let maxW = 0;
        srcset.split(',').forEach(part => {
          const tokens = part.trim().split(/\s+/);
          if (tokens[0]) {
            const wMatch = (tokens[1] || '').match(/(\d+)w/);
            const w = wMatch ? parseInt(wMatch[1], 10) : 0;
            if (w >= maxW) {
              maxW = w;
              bestUrl = tokens[0];
            }
          }
        });
      }
      if (!bestUrl) {
        bestUrl = imgEl.currentSrc || imgEl.src || '';
      }
    }
    if (bestUrl && bestUrl.includes('img.freepik.com')) {
      try {
        const u = new URL(bestUrl);
        if (!u.searchParams.has('token') && !u.searchParams.has('hmac')) {
          return `${u.origin}${u.pathname}?w=2000`;
        }
      } catch (_) {}
    }
    if (bestUrl && bestUrl.includes('cdn-icons-png.freepik.com')) {
      bestUrl = bestUrl.replace(/\/(?:128|256)\//, '/512/');
    }
    return bestUrl;
  }

  function buildMagnificActionUrl({ pageUrl, mediaUrl, mode, type, title }) {
    try {
      const u = new URL(pageUrl || window.location.href, window.location.origin);
      if (mediaUrl) u.searchParams.set('instagrab_media', mediaUrl);
      if (mode) u.searchParams.set('instagrab_mode', mode);
      if (type) u.searchParams.set('instagrab_type', type);
      if (title) u.searchParams.set('instagrab_title', title.slice(0, 100));
      return u.href;
    } catch (_) {
      return mediaUrl || pageUrl || window.location.href;
    }
  }

  function scanMagnific() {
    const path = window.location.pathname.replace(/\/+$/, '');
    const isSingleItemPage = (
      path.endsWith('.htm') ||
      /\/(?:free|premium)-(?:photo|vector|psd|video|ai-image|icon)\//.test(path) ||
      /\/(?:icon|animated-icon|video)\//.test(path)
    );

    // Detect opened detail modal / drawer on search page or single item page
    const detailModal = document.querySelector(
      'aside[data-cy="resource-detail"], [data-cy="resource-detail-modal"], div[role="dialog"]:has(img[src*="freepik.com"]), div[role="dialog"]:has(video), aside:has(img[src*="img.freepik.com"]), aside:has(video)'
    );
    const detailRoot = detailModal || (isSingleItemPage ? document.querySelector('main') || document.body : null);

    // 1. Opened Item View (Detail Modal or Single Item Page) -> FULL SIZE Download
    if (detailRoot) {
      const videoEl = detailRoot.querySelector('video');
      const allImgs = Array.from(detailRoot.querySelectorAll('img')).filter(img => {
        const src = img.currentSrc || img.src || '';
        if (!src || src.includes('avatar') || src.includes('profile') || src.includes('logo')) return false;
        if (img.closest('.instagrab-card-bar')) return false;
        const rect = img.getBoundingClientRect();
        return rect.width >= 140 || img.naturalWidth >= 200 || src.includes('img.freepik.com') || src.includes('cdn-icons-png');
      });
      const mainImg = allImgs[0] || null;
      const mainSrc = videoEl
        ? (videoEl.currentSrc || videoEl.src || videoEl.querySelector('source')?.src || '')
        : (mainImg ? (mainImg.currentSrc || mainImg.src || '') : '');

      if (mainSrc || isSingleItemPage) {
        const existingBar = detailRoot.querySelector('.instagrab-magnific-detail-bar');
        if (!existingBar || existingBar.dataset.mediaKey !== mainSrc) {
          if (existingBar) existingBar.remove();

          const titleEl = detailRoot.querySelector('h1') || document.querySelector('h1');
          const titleText = (titleEl?.textContent || mainImg?.alt || document.title || 'Magnific Media').trim();
          const isVideoItem = !!videoEl || /\/(?:free|premium)-video\//.test(path) || /\/video\//.test(path);
          const isIconItem = (mainSrc && mainSrc.includes('cdn-icons-png')) || /\/(?:free-)?icon\//.test(path);

          const bar = document.createElement('div');
          bar.className = 'instagrab-magnific-detail-bar';
          bar.dataset.mediaKey = mainSrc;

          if (isVideoItem) {
            const rawVidUrl = mainSrc ? mainSrc.replace('/small.mp4', '/large.mp4').replace('/medium.mp4', '/large.mp4') : '';
            const rawThumbUrl = (videoEl && videoEl.poster) || (mainImg ? getMagnificFullImageUrl(mainImg, mainImg.src) : '');

            const vidBtn = document.createElement('button');
            vidBtn.type = 'button';
            vidBtn.className = 'instagrab-magnific-detail-btn';
            vidBtn.innerHTML = `${DOWNLOAD_ICON} <span>Download Full Video (MP4)</span>`;
            vidBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              const targetUrl = buildMagnificActionUrl({
                pageUrl: window.location.href,
                mediaUrl: rawVidUrl,
                mode: 'full',
                type: 'video',
                title: titleText
              });
              downloadMedia(targetUrl, vidBtn, 'Full Video (MP4)', { quality: 'best' });
            });
            bar.appendChild(vidBtn);

            if (rawThumbUrl) {
              const thumbBtn = document.createElement('button');
              thumbBtn.type = 'button';
              thumbBtn.className = 'instagrab-magnific-detail-btn secondary';
              thumbBtn.innerHTML = `${DOWNLOAD_ICON} <span>Download Video Thumbnail (HD)</span>`;
              thumbBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const targetUrl = buildMagnificActionUrl({
                  pageUrl: window.location.href,
                  mediaUrl: rawThumbUrl,
                  mode: 'full',
                  type: 'thumbnail',
                  title: titleText
                });
                downloadMedia(targetUrl, thumbBtn, 'Video Thumbnail', { quality: 'best' });
              });
              bar.appendChild(thumbBtn);
            }
          } else {
            const fullImgUrl = getMagnificFullImageUrl(mainImg, mainSrc);

            const dlBtn = document.createElement('button');
            dlBtn.type = 'button';
            dlBtn.className = 'instagrab-magnific-detail-btn';
            dlBtn.innerHTML = `${DOWNLOAD_ICON} <span>${isIconItem ? 'Download Icon (512px PNG)' : 'Download Full Size (HD)'}</span>`;
            dlBtn.title = 'Download full-resolution image with InstaGrab';
            dlBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              const targetUrl = buildMagnificActionUrl({
                pageUrl: window.location.href,
                mediaUrl: fullImgUrl,
                mode: 'full',
                type: isIconItem ? 'icon' : 'image',
                title: titleText
              });
              downloadMedia(targetUrl, dlBtn, 'Full Size HD', { quality: 'best' });
            });
            bar.appendChild(dlBtn);

            if (fullImgUrl) {
              const copyBtn = document.createElement('button');
              copyBtn.type = 'button';
              copyBtn.className = 'instagrab-magnific-detail-btn secondary';
              copyBtn.innerHTML = `${COPY_ICON} <span>Copy as PNG</span>`;
              copyBtn.title = 'Copy high-res PNG directly to clipboard';
              copyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                copyImageAsPngToClipboard(fullImgUrl, copyBtn);
              });
              bar.appendChild(copyBtn);
            }
          }

          if (titleEl && titleEl.parentElement) {
            titleEl.parentElement.insertBefore(bar, titleEl.nextSibling);
          } else if (mainImg && mainImg.parentElement) {
            mainImg.parentElement.appendChild(bar);
          } else {
            detailRoot.prepend(bar);
          }
        }
      }
    }

    // 2. Search / Carousel / Grid Cards -> Direct PREVIEW Download (as-is) without opening
    const cardCandidates = document.querySelectorAll(
      'figure, [data-cy*="resource-thumbnail"], div.showcase__item, a[href*=".htm"], a[href*="/free-"], a[href*="/premium-"], a[href*="/icon/"], a[href*="/video/"]'
    );

    cardCandidates.forEach((el) => {
      if (detailModal && detailModal.contains(el)) return;

      const card = el.tagName === 'A' ? (el.closest('figure, [data-cy*="resource-thumbnail"], div.showcase__item, li') || el.parentElement || el) : el;
      if (!card || card.dataset.instagrabInjected) return;

      const videoEl = card.querySelector('video');
      const imgEl = card.querySelector('img');
      if (!videoEl && !imgEl) return;

      // Skip tiny UI icons/avatars
      const imgSrc = imgEl ? (imgEl.currentSrc || imgEl.src || imgEl.getAttribute('data-src') || '') : '';
      if (!videoEl && (!imgSrc || imgSrc.includes('avatar') || imgSrc.includes('profile'))) return;

      card.dataset.instagrabInjected = 'true';
      const style = window.getComputedStyle(card);
      if (style.position === 'static') card.classList.add('instagrab-rel-card');

      const linkEl = card.tagName === 'A' ? card : card.querySelector('a[href]');
      const itemPageUrl = (linkEl && linkEl.href) ? linkEl.href : window.location.href;
      const cardTitle = (imgEl?.alt || linkEl?.getAttribute('title') || linkEl?.textContent || 'Magnific Preview').trim();

      const isVideoCard = !!videoEl || /\/(?:free|premium)-video\//.test(itemPageUrl) || /\/video\//.test(itemPageUrl);
      const isIconCard = imgSrc.includes('cdn-icons-png') || /\/(?:free-)?icon\//.test(itemPageUrl);

      const bar = document.createElement('div');
      bar.className = 'instagrab-card-bar';

      if (isVideoCard) {
        // Video Button + Video Thumbnail Button
        const vidBtn = document.createElement('button');
        vidBtn.type = 'button';
        vidBtn.className = 'instagrab-card-pill';
        vidBtn.innerHTML = `${DOWNLOAD_ICON} <span>Video</span>`;
        vidBtn.title = 'Download Video (MP4)';
        vidBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const vEl = card.querySelector('video');
          const vSrc = vEl ? (vEl.currentSrc || vEl.src || vEl.querySelector('source')?.src || '') : '';
          const targetUrl = buildMagnificActionUrl({
            pageUrl: itemPageUrl,
            mediaUrl: vSrc,
            mode: 'preview',
            type: 'video',
            title: cardTitle
          });
          downloadMedia(targetUrl, vidBtn, 'Video (MP4)', { quality: 'best' });
        });
        bar.appendChild(vidBtn);

        const thumbBtn = document.createElement('button');
        thumbBtn.type = 'button';
        thumbBtn.className = 'instagrab-card-pill secondary';
        thumbBtn.innerHTML = `${DOWNLOAD_ICON} <span>Thumb</span>`;
        thumbBtn.title = 'Download Video Thumbnail Image';
        thumbBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const vEl = card.querySelector('video');
          const iEl = card.querySelector('img');
          const tSrc = (vEl && vEl.poster) || (iEl && (iEl.currentSrc || iEl.src)) || imgSrc;
          const targetUrl = buildMagnificActionUrl({
            pageUrl: itemPageUrl,
            mediaUrl: tSrc,
            mode: 'preview',
            type: 'thumbnail',
            title: cardTitle
          });
          downloadMedia(targetUrl, thumbBtn, 'Thumbnail', { quality: '720p' });
        });
        bar.appendChild(thumbBtn);
      } else if (isIconCard) {
        // Icon PNG Download + Copy PNG
        const iconPngUrl = imgSrc.replace(/\/(?:128|256)\//, '/512/');
        const pngBtn = document.createElement('button');
        pngBtn.type = 'button';
        pngBtn.className = 'instagrab-card-pill';
        pngBtn.innerHTML = `${DOWNLOAD_ICON} <span>PNG</span>`;
        pngBtn.title = 'Download Icon as 512px PNG';
        pngBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const targetUrl = buildMagnificActionUrl({
            pageUrl: itemPageUrl,
            mediaUrl: iconPngUrl,
            mode: 'full',
            type: 'icon',
            title: cardTitle
          });
          downloadMedia(targetUrl, pngBtn, 'Icon PNG', { quality: 'best' });
        });
        bar.appendChild(pngBtn);

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'instagrab-card-pill secondary';
        copyBtn.innerHTML = `${COPY_ICON} <span>Copy</span>`;
        copyBtn.title = 'Copy Icon as PNG to Clipboard';
        copyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          copyImageAsPngToClipboard(iconPngUrl, copyBtn);
        });
        bar.appendChild(copyBtn);
      } else {
        // Standard Image / Vector / AI-Image Card -> Download Preview as-is!
        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'instagrab-card-pill';
        prevBtn.innerHTML = `${DOWNLOAD_ICON} <span>Preview</span>`;
        prevBtn.title = 'Download Preview Image as-is (Open image to download Full Size HD)';
        prevBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const currentImg = card.querySelector('img');
          const previewSrc = (currentImg && (currentImg.currentSrc || currentImg.src)) || imgSrc;
          const targetUrl = buildMagnificActionUrl({
            pageUrl: itemPageUrl,
            mediaUrl: previewSrc,
            mode: 'preview',
            type: 'image',
            title: cardTitle
          });
          downloadMedia(targetUrl, prevBtn, 'Preview Image', { quality: '720p' });
        });
        bar.appendChild(prevBtn);

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'instagrab-card-pill secondary';
        copyBtn.innerHTML = `${COPY_ICON} <span>Copy</span>`;
        copyBtn.title = 'Copy Preview Image as PNG to Clipboard';
        copyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const currentImg = card.querySelector('img');
          const previewSrc = (currentImg && (currentImg.currentSrc || currentImg.src)) || imgSrc;
          copyImageAsPngToClipboard(previewSrc, copyBtn);
        });
        bar.appendChild(copyBtn);
      }

      card.appendChild(bar);
    });
  }

  // ================= FLATICON MODULE =================
  // Supports:
  // - Search & Pack Grid Cards (https://www.flaticon.com/search?word=fail): 512px PNG Download + 512px PNG Copy to Clipboard
  // - Opened Icon Detail Page / Modal: 512px PNG Download + 512px PNG Copy to Clipboard
  function upgradeFlaticonTo512(rawImgSrc, linkHref) {
    if (rawImgSrc && rawImgSrc.includes('cdn-icons-png.flaticon.com')) {
      return rawImgSrc.split('?')[0].replace(/\/(?:64|128|256)\//, '/512/');
    }
    const source = linkHref || rawImgSrc || '';
    const m = source.match(/_(\d+)(?:\.htm)?(?:[/?#]|$)/) || source.match(/\/(\d+)\.png/);
    if (m && m[1]) {
      const iconId = m[1];
      const folder = iconId.length > 3 ? iconId.slice(0, -3) : '0';
      return `https://cdn-icons-png.flaticon.com/512/${folder}/${iconId}.png`;
    }
    return rawImgSrc || '';
  }

  function scanFlaticon() {
    // 1. Search / Pack Grid Icon Cards (e.g. https://www.flaticon.com/search?word=fail)
    const iconCards = document.querySelectorAll('li.icon--item, div.icon--holder, a.view.link-icon-detail, a[href*="/free-icon/"], a[href*="/free-animated-icon/"]');
    iconCards.forEach((el) => {
      const card = el.closest('li.icon--item, div.icon--holder') || (el.tagName === 'A' ? el.parentElement : el);
      if (!card || card.dataset.instagrabInjected) return;

      const imgEl = card.querySelector('img');
      const linkEl = card.tagName === 'A' ? card : card.querySelector('a[href*="/free-icon/"], a[href*="/free-animated-icon/"], a[href]');
      if (!imgEl && !linkEl) return;

      const rawSrc = imgEl ? (imgEl.currentSrc || imgEl.src || imgEl.getAttribute('data-src') || '') : '';
      const linkHref = linkEl ? linkEl.href : window.location.href;
      const png512Url = upgradeFlaticonTo512(rawSrc, linkHref);
      if (!png512Url) return;

      card.dataset.instagrabInjected = 'true';
      const style = window.getComputedStyle(card);
      if (style.position === 'static') card.classList.add('instagrab-rel-card');

      const iconTitle = (imgEl?.alt || linkEl?.getAttribute('title') || 'Flaticon Icon').replace(/\s+free\s+icon$/i, '').trim();

      const bar = document.createElement('div');
      bar.className = 'instagrab-flaticon-bar';

      const dlBtn = document.createElement('button');
      dlBtn.type = 'button';
      dlBtn.className = 'instagrab-card-pill';
      dlBtn.innerHTML = `${DOWNLOAD_ICON} <span>PNG</span>`;
      dlBtn.title = 'Download 512px Transparent PNG';
      dlBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const u = new URL(linkHref || window.location.href, window.location.origin);
        u.searchParams.set('instagrab_media', png512Url);
        u.searchParams.set('instagrab_title', iconTitle);
        downloadMedia(u.href, dlBtn, '512px PNG', { quality: 'best' });
      });
      bar.appendChild(dlBtn);

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'instagrab-card-pill secondary';
      copyBtn.innerHTML = `${COPY_ICON} <span>Copy</span>`;
      copyBtn.title = 'Copy 512px Transparent PNG to Clipboard';
      copyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        copyImageAsPngToClipboard(png512Url, copyBtn);
      });
      bar.appendChild(copyBtn);

      card.appendChild(bar);
    });

    // 2. Opened Icon Detail Page / Modal (/free-icon/...)
    const path = window.location.pathname;
    if (/\/(?:free-icon|free-animated-icon|icon)\/[^/]+/.test(path)) {
      const detailImg = document.querySelector('img[src*="cdn-icons-png.flaticon.com/512/"], div.detail img[src*="cdn-icons-png.flaticon.com"], section img[src*="cdn-icons-png.flaticon.com"]');
      const png512Url = upgradeFlaticonTo512(detailImg?.src || '', window.location.href);
      if (png512Url && !document.getElementById('instagrab-flaticon-detail-bar')) {
        const h1 = document.querySelector('h1');
        const titleText = (h1?.textContent || detailImg?.alt || 'Flaticon Icon').trim();

        const bar = document.createElement('div');
        bar.id = 'instagrab-flaticon-detail-bar';
        bar.className = 'instagrab-magnific-detail-bar';

        const dlBtn = document.createElement('button');
        dlBtn.type = 'button';
        dlBtn.className = 'instagrab-magnific-detail-btn';
        dlBtn.innerHTML = `${DOWNLOAD_ICON} <span>Download PNG (512px)</span>`;
        dlBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const u = new URL(window.location.href);
          u.searchParams.set('instagrab_media', png512Url);
          u.searchParams.set('instagrab_title', titleText);
          downloadMedia(u.href, dlBtn, '512px PNG', { quality: 'best' });
        });
        bar.appendChild(dlBtn);

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'instagrab-magnific-detail-btn secondary';
        copyBtn.innerHTML = `${COPY_ICON} <span>Copy PNG to Clipboard</span>`;
        copyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          copyImageAsPngToClipboard(png512Url, copyBtn);
        });
        bar.appendChild(copyBtn);

        if (h1 && h1.parentElement) {
          h1.parentElement.insertBefore(bar, h1.nextSibling);
        } else if (detailImg && detailImg.parentElement) {
          detailImg.parentElement.appendChild(bar);
        }
      }
    }
  }

  // ================= SPOTIFY MODULE =================
  // Supports:
  // - Single Track MP3 download on every track row ([data-testid="tracklist-row"]), single track page, and bottom player bar
  // - Bulk Playlist / Album download (.ZIP or individual MP3s) on /playlist/<id> and /album/<id>
  function scanSpotify() {
    const cleanPath = window.location.pathname.replace(/\/+$/, '');
    const spMatch = cleanPath.match(/\/(?:intl-[a-zA-Z-]+\/)?(track|playlist|album)\/([A-Za-z0-9]+)/);
    const pageType = spMatch ? spMatch[1] : null;
    const pageId = spMatch ? spMatch[2] : null;
    const canonicalPageUrl = (pageType && pageId) ? `https://open.spotify.com/${pageType}/${pageId}` : window.location.href.split('?')[0];

    // 1. Main Action Bar on Playlist, Album, or Single Track Page
    const actionBar = document.querySelector('[data-testid="action-bar-row"]');
    if (actionBar && pageType && pageId) {
      const existingBar = document.getElementById('instagrab-spotify-action-wrap');
      if (!existingBar || existingBar.dataset.pageUrl !== canonicalPageUrl) {
        if (existingBar) existingBar.remove();

        const wrap = document.createElement('div');
        wrap.id = 'instagrab-spotify-action-wrap';
        wrap.className = 'instagrab-spotify-action-wrap';
        wrap.dataset.pageUrl = canonicalPageUrl;

        if (pageType === 'playlist' || pageType === 'album') {
          const labelNoun = pageType === 'album' ? 'Album' : 'Playlist';

          const zipBtn = document.createElement('button');
          zipBtn.type = 'button';
          zipBtn.className = 'instagrab-spotify-main-btn';
          zipBtn.innerHTML = `${DOWNLOAD_ICON} <span>Download ${labelNoun} (.ZIP)</span>`;
          zipBtn.title = `Bulk download entire Spotify ${labelNoun.toLowerCase()} as a .ZIP of 320kbps MP3s`;
          zipBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            downloadMedia(canonicalPageUrl, zipBtn, `${labelNoun} (.ZIP)`, { format_type: 'audio', as_zip: true });
          });
          wrap.appendChild(zipBtn);

          const multiBtn = document.createElement('button');
          multiBtn.type = 'button';
          multiBtn.className = 'instagrab-spotify-main-btn secondary';
          multiBtn.innerHTML = `${DOWNLOAD_ICON} <span>All MP3s</span>`;
          multiBtn.title = `Download all tracks in ${labelNoun.toLowerCase()} one by one as MP3s`;
          multiBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            downloadMedia(canonicalPageUrl, multiBtn, `All ${labelNoun} MP3s`, { format_type: 'audio', as_zip: false });
          });
          wrap.appendChild(multiBtn);
        } else if (pageType === 'track') {
          const trackBtn = document.createElement('button');
          trackBtn.type = 'button';
          trackBtn.className = 'instagrab-spotify-main-btn';
          trackBtn.innerHTML = `${DOWNLOAD_ICON} <span>Download Track (MP3)</span>`;
          trackBtn.title = 'Download 320kbps MP3 with InstaGrab';
          trackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            downloadMedia(canonicalPageUrl, trackBtn, 'Spotify MP3', { format_type: 'audio' });
          });
          wrap.appendChild(trackBtn);
        }

        actionBar.appendChild(wrap);
      }
    }

    // 2. Individual Track Rows ([data-testid="tracklist-row"])
    const rows = document.querySelectorAll('[data-testid="tracklist-row"]');
    rows.forEach((row, rowIdx) => {
      if (row.dataset.instagrabInjected) return;
      row.dataset.instagrabInjected = 'true';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'instagrab-spotify-row-btn';
      btn.innerHTML = `${DOWNLOAD_ICON} <span>MP3</span>`;
      btn.title = 'Download this track as 320kbps MP3';

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const trackLink = row.querySelector('a[href*="/track/"]');
        if (trackLink && trackLink.getAttribute('href')) {
          const m = trackLink.getAttribute('href').match(/\/track\/([A-Za-z0-9]+)/);
          if (m && m[1]) {
            downloadMedia(`https://open.spotify.com/track/${m[1]}`, btn, 'Track MP3', { format_type: 'audio' });
            return;
          }
        }
        // Fallback for album rows without explicit <a href="/track/...">: use 1-based item_index on the album/playlist URL
        downloadMedia(canonicalPageUrl, btn, `Track #${rowIdx + 1} MP3`, { format_type: 'audio', item_index: rowIdx + 1, as_zip: false });
      });

      const moreBtn = row.querySelector('button[data-testid="more-button"], button[aria-label*="More"]');
      if (moreBtn && moreBtn.parentElement) {
        moreBtn.parentElement.insertBefore(btn, moreBtn);
      } else {
        row.appendChild(btn);
      }
    });

    // 3. Bottom Now-Playing Bar ([data-testid="now-playing-widget"])
    const nowPlaying = document.querySelector('[data-testid="now-playing-widget"]');
    if (nowPlaying && !document.getElementById('instagrab-spotify-now-btn')) {
      const btn = document.createElement('button');
      btn.id = 'instagrab-spotify-now-btn';
      btn.type = 'button';
      btn.className = 'instagrab-spotify-row-btn';
      btn.innerHTML = `${DOWNLOAD_ICON} <span>MP3</span>`;
      btn.title = 'Download currently playing track as MP3';

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const npLink = nowPlaying.querySelector('a[href*="/track/"]');
        if (npLink && npLink.getAttribute('href')) {
          const m = npLink.getAttribute('href').match(/\/track\/([A-Za-z0-9]+)/);
          if (m && m[1]) {
            downloadMedia(`https://open.spotify.com/track/${m[1]}`, btn, 'Now Playing MP3', { format_type: 'audio' });
            return;
          }
        }
        downloadMedia(canonicalPageUrl, btn, 'Spotify MP3', { format_type: 'audio' });
      });

      nowPlaying.appendChild(btn);
    }
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
    } else if (host.includes('envato.com') || host.includes('audiojungle.net')) {
      scanEnvato();
    } else if (host.includes('epidemicsound.com')) {
      scanEpidemic();
    } else if (host.includes('magnific.') || host.includes('freepik.com')) {
      scanMagnific();
    } else if (host.includes('flaticon.com')) {
      scanFlaticon();
    } else if (host.includes('spotify.com')) {
      scanSpotify();
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

  // Seamlessly sync Instagram cookies when visiting Instagram or the InstaGrab Web App
  if (chrome.runtime && chrome.runtime.sendMessage) {
    try {
      chrome.runtime.sendMessage({ action: 'syncCookies', domain: 'instagram.com' }, () => {
        if (chrome.runtime.lastError) {} // Ignore if receiver unavailable
      });
    } catch (_) {}
  }

  console.log('[InstaGrab] Universal media downloader active (Pinterest, YouTube, Instagram, Spotify, Magnific, Flaticon, Envato & Epidemic Sound)');
})();

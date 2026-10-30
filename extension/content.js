// InstaGrab - Cross-Platform Content Script (Pinterest, YouTube, Instagram, Spotify, Magnific, Flaticon, Envato & Epidemic Sound)
(function () {
  const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
  const COPY_ICON = `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
  const SPINNER_ICON = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle></svg>`;
  const CHECK_ICON = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  const PASTE_ICON = `<svg viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M9 12h6"></path><path d="M9 16h6"></path></svg>`;

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
          <div class="instagrab-toast-actions">
            <span class="instagrab-toast-badge"></span>
            <button type="button" class="instagrab-toast-cancel" title="Cancel Download">
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
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
    const cancelBtn = toast.querySelector('.instagrab-toast-cancel');

    if (cancelBtn && !cancelBtn.dataset.bound) {
      cancelBtn.dataset.bound = 'true';
      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        cancelBtn.disabled = true;
        if (msgEl) msgEl.textContent = 'Cancelling download...';
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'cancelDownload' });
        }
      });
    }

    if (cancelBtn) {
      if (isError || state === 'error' || state === 'complete') {
        cancelBtn.style.display = 'none';
      } else {
        cancelBtn.style.display = 'inline-flex';
        cancelBtn.disabled = false;
      }
    }

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

  // Extract direct playable CDN stream/image URL from Instagram DOM / performance resources
  function findInstagramMediaUrl(container = null) {
    try {
      const scope = container || document;

      // 1. Direct active or visible <video> element
      const videos = Array.from(scope.querySelectorAll('video'));
      let targetVideo = videos.find(v => !v.paused && v.offsetWidth > 100);
      if (!targetVideo && videos.length > 0) {
        targetVideo = videos.reduce((prev, curr) => {
          return (curr.offsetWidth * curr.offsetHeight > (prev ? prev.offsetWidth * prev.offsetHeight : 0)) ? curr : prev;
        }, null);
      }

      if (targetVideo) {
        const vSrc = targetVideo.currentSrc || targetVideo.src;
        if (vSrc && vSrc.startsWith('http') && vSrc.includes('cdninstagram.com')) {
          return vSrc;
        }
        const source = targetVideo.querySelector('source');
        if (source && source.src && source.src.startsWith('http') && source.src.includes('cdninstagram.com')) {
          return source.src;
        }
      }

      // 2. If video element uses MediaSource blob: or DASH, inspect performance resource timing for CDN MP4
      if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        const resources = performance.getEntriesByType('resource');
        for (let i = resources.length - 1; i >= 0; i--) {
          const rName = resources[i].name;
          if (rName && rName.includes('cdninstagram.com') && (rName.includes('.mp4') || rName.includes('/v/t60.') || rName.includes('mime_type=video_mp4'))) {
            try {
              const uObj = new URL(rName);
              uObj.searchParams.delete('bytestart');
              uObj.searchParams.delete('byteend');
              return uObj.href;
            } catch (_) {
              return rName;
            }
          }
        }
      }

      // 3. Inspect high-res <img> elements in container for photos / carousels
      const imgs = Array.from(scope.querySelectorAll('img[src*="cdninstagram.com"], img[srcset*="cdninstagram.com"]'));
      let targetImg = imgs.find(img => img.offsetWidth > 200 && img.offsetHeight > 200);
      if (targetImg) {
        if (targetImg.srcset) {
          const parts = targetImg.srcset.split(',').map(s => s.trim().split(/\s+/));
          if (parts.length > 0) {
            parts.sort((a, b) => (parseInt(b[1]) || 0) - (parseInt(a[1]) || 0));
            if (parts[0][0]) return parts[0][0];
          }
        }
        if (targetImg.src && targetImg.src.startsWith('http')) {
          return targetImg.src;
        }
      }
    } catch (e) {
      console.warn('[InstaGrab] findInstagramMediaUrl error:', e);
    }
    return null;
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
      const directMediaUrl = findInstagramMediaUrl();

      // Stories & Highlights
      if (path.includes('/stories/') || path.startsWith('/s/')) {
        return { url: window.location.href, platform: 'instagram', direct_media_url: directMediaUrl };
      }

      // Direct post/reel URL
      const directMatch = path.match(/\/(?:p|reel|reels|tv|share\/reel|share\/p)\/([A-Za-z0-9_-]+)/);
      if (directMatch) {
        const type = path.includes('reel') ? 'reel' : (path.includes('tv') ? 'tv' : 'p');
        return { url: `https://www.instagram.com/${type}/${directMatch[1]}/`, platform: 'instagram', direct_media_url: directMediaUrl };
      }

      // Check open modal/dialog
      const dialog = document.querySelector('div[role="dialog"]');
      if (dialog) {
        const link = dialog.querySelector('a[href*="/reel/"], a[href*="/p/"]');
        if (link) {
          const href = link.getAttribute('href');
          if (href) return { url: new URL(href, window.location.origin).href, platform: 'instagram', direct_media_url: findInstagramMediaUrl(dialog) || directMediaUrl };
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
            if (href) return { url: new URL(href, window.location.origin).href, platform: 'instagram', direct_media_url: findInstagramMediaUrl(container) || directMediaUrl };
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
          message: msg.error ? msg.error : (msg.state === 'error' ? 'Download failed' : (msg.filename ? msg.filename : (msg.state === 'processing' ? 'Processing media...' : 'Downloading...'))),
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
  // Direct Image Download via background service worker (High-Res Browser Fetch + Native Save)
  async function downloadImageDirectly(imageUrl, filename, button, label = 'Image') {
    if (!imageUrl || (button && button.classList.contains('instagrab-loading'))) return;
    const origHtml = button ? button.innerHTML : '';
    if (button) {
      button.classList.add('instagrab-loading');
      button.innerHTML = origHtml.includes('<span') ? `${SPINNER_ICON} <span>Downloading...</span>` : `${SPINNER_ICON}`;
    }

    const restoreBtn = (isSuccess = false) => {
      if (!button) return;
      button.classList.remove('instagrab-loading');
      if (isSuccess) {
        button.classList.add('instagrab-success');
        button.innerHTML = origHtml.includes('<span') ? `${CHECK_ICON} <span>Saved!</span>` : `${CHECK_ICON}`;
        setTimeout(() => {
          button.classList.remove('instagrab-success');
          button.innerHTML = origHtml;
        }, 3000);
      } else {
        button.innerHTML = origHtml;
      }
    };

    updateToast({
      message: `Downloading ${label}...`,
      progress: 30,
      state: 'downloading'
    });

    try {
      const res = await new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            action: 'directDownloadImage',
            url: imageUrl,
            filename: filename
          }, resolve);
        } else {
          resolve({ success: false, error: 'Extension runtime unavailable' });
        }
      });

      if (res && res.success) {
        restoreBtn(true);
        updateToast({
          message: `✓ Saved to Downloads folder!`,
          progress: 100,
          state: 'complete'
        });
      } else {
        console.warn('[InstaGrab] directDownloadImage error, falling back:', res && res.error);
        restoreBtn(false);
        updateToast({
          message: '❌ ' + ((res && res.error) || 'Download failed'),
          isError: true
        });
      }
    } catch (err) {
      console.warn('[InstaGrab] directDownloadImage exception:', err);
      restoreBtn(false);
      updateToast({
        message: '❌ Could not download: ' + (err.message || 'Permission denied'),
        isError: true
      });
    }
  }

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
          const article = bar.closest('article') || bar.closest('section');
          const postLink = article ? article.querySelector('a[href*="/p/"], a[href*="/reel/"]') : null;
          const url = postLink ? `https://www.instagram.com${postLink.getAttribute('href')}` : window.location.href;
          const directMediaUrl = findInstagramMediaUrl(article || bar.closest('div'));
          downloadMedia(url, btn, 'Download', directMediaUrl ? { direct_media_url: directMediaUrl } : {});
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
            const reelContainer = stack.closest('div[role="dialog"]') || stack.closest('article') || stack.closest('section') || stack.parentElement?.parentElement || document;
            const link = reelContainer.querySelector ? reelContainer.querySelector('a[href*="/reel/"], a[href*="/p/"]') : null;
            const targetUrl = link && link.getAttribute('href') ? `https://www.instagram.com${link.getAttribute('href')}` : window.location.href;
            const directMediaUrl = findInstagramMediaUrl(reelContainer);
            downloadMedia(targetUrl, btn, 'Download', directMediaUrl ? { direct_media_url: directMediaUrl } : {});
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
          const storyContainer = document.querySelector('section[role="region"]') || document.querySelector('div[role="dialog"]') || document;
          const directMediaUrl = findInstagramMediaUrl(storyContainer);
          downloadMedia(window.location.href, btn, 'Download', directMediaUrl ? { direct_media_url: directMediaUrl } : {});
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

  // Detects and injects Download + Copy buttons on Freepik / Magnific Expanded Image Views
  function scanMagnificExpandedView() {
    // 1. Find the main expanded image (largest visible image on screen not in carousels/grids)
    const imgs = Array.from(document.querySelectorAll('img')).filter(img => {
      const src = img.currentSrc || img.src || '';
      if (!src) return false;
      if (src.includes('avatar') || src.includes('profile') || src.includes('logo') || src.includes('icon')) return false;
      if (img.closest('.instagrab-ignore') || img.closest('.instagrab-card-bar')) return false;
      if (img.closest('[class*="carousel" i], [class*="similar" i], [class*="related" i], [class*="more-from" i], div.showcase__item')) return false;

      const rect = img.getBoundingClientRect();
      const naturalW = img.naturalWidth || 0;
      const naturalH = img.naturalHeight || 0;
      return (rect.width >= 220 && rect.height >= 220) || (naturalW >= 300 && naturalH >= 300);
    });

    if (imgs.length === 0) return;

    imgs.sort((a, b) => {
      const rA = a.getBoundingClientRect();
      const rB = b.getBoundingClientRect();
      return (rB.width * rB.height) - (rA.width * rA.height);
    });

    const mainImg = imgs[0];
    const mainSrc = mainImg.currentSrc || mainImg.src || '';
    if (!mainSrc) return;

    const fullImgUrl = getMagnificFullImageUrl(mainImg, mainSrc);
    const titleEl = document.querySelector('h1') || document.querySelector('[class*="title" i], [data-cy*="title" i]');
    const rawTitle = (titleEl?.textContent || mainImg.alt || document.title || 'Freepik Media').trim();
    const cleanTitle = rawTitle.replace(/[<>:"/\\|?*]/g, '_').slice(0, 80) || 'Freepik_Image';
    const filename = `${cleanTitle}.png`;

    // A. Inject Floating Pill Bar in Top-Right Corner of the Expanded Image Card
    const imgContainer = mainImg.closest('div[class*="preview" i], div[class*="card" i], div[class*="image" i], div[class*="modal" i], div[class*="dialog" i], figure') || mainImg.parentElement;
    if (imgContainer) {
      if (window.getComputedStyle(imgContainer).position === 'static') {
        imgContainer.style.position = 'relative';
      }

      if (!imgContainer.querySelector('.instagrab-expanded-overlay-bar') || imgContainer.dataset.instagrabMediaKey !== mainSrc) {
        imgContainer.dataset.instagrabMediaKey = mainSrc;
        const oldBar = imgContainer.querySelector('.instagrab-expanded-overlay-bar');
        if (oldBar) oldBar.remove();

        const floatBar = document.createElement('div');
        floatBar.className = 'instagrab-expanded-overlay-bar';

        const dlBtn = document.createElement('button');
        dlBtn.type = 'button';
        dlBtn.className = 'instagrab-magnific-detail-btn';
        dlBtn.innerHTML = `${DOWNLOAD_ICON} <span>Download HD</span>`;
        dlBtn.title = 'Download Full Resolution HD Image (PNG)';
        dlBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          downloadImageDirectly(fullImgUrl, filename, dlBtn, 'Full HD Image');
        });
        floatBar.appendChild(dlBtn);

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'instagrab-magnific-detail-btn secondary';
        copyBtn.innerHTML = `${COPY_ICON} <span>Copy PNG</span>`;
        copyBtn.title = 'Copy crisp transparent PNG to clipboard';
        copyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          copyImageAsPngToClipboard(fullImgUrl, copyBtn);
        });
        floatBar.appendChild(copyBtn);

        imgContainer.appendChild(floatBar);
      }
    }

    // B. Inject Action Buttons near "Remove background", "Resize", "Variations" row
    const actionButtons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
    const rmBgBtn = actionButtons.find(b => {
      const txt = (b.textContent || '').trim().toLowerCase();
      return (txt.includes('remove background') || txt.includes('variations') || txt.includes('resize')) && !b.classList.contains('instagrab-magnific-row-btn');
    });

    if (rmBgBtn && rmBgBtn.parentElement && !rmBgBtn.parentElement.querySelector('.instagrab-magnific-row-btn')) {
      const rowContainer = rmBgBtn.parentElement;

      const dlRowBtn = document.createElement('button');
      dlRowBtn.type = 'button';
      dlRowBtn.className = 'instagrab-magnific-row-btn';
      dlRowBtn.innerHTML = `${DOWNLOAD_ICON} <span>Download HD</span>`;
      dlRowBtn.title = 'Download Full Resolution Image';
      dlRowBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        downloadImageDirectly(fullImgUrl, filename, dlRowBtn, 'Full HD Image');
      });

      const copyRowBtn = document.createElement('button');
      copyRowBtn.type = 'button';
      copyRowBtn.className = 'instagrab-magnific-row-btn secondary';
      copyRowBtn.innerHTML = `${COPY_ICON} <span>Copy PNG</span>`;
      copyRowBtn.title = 'Copy to Clipboard as PNG';
      copyRowBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        copyImageAsPngToClipboard(fullImgUrl, copyRowBtn);
      });

      rowContainer.appendChild(dlRowBtn);
      rowContainer.appendChild(copyRowBtn);
    }

    // C. Inject Buttons in the Right Sidebar (near "Get Premium" or author)
    const premiumBtn = actionButtons.find(b => {
      const txt = (b.textContent || '').trim().toLowerCase();
      return (txt.includes('get premium') || txt === 'download' || txt.startsWith('download ')) &&
             !b.classList.contains('instagrab-magnific-detail-btn') &&
             !b.classList.contains('instagrab-magnific-sidebar-btn');
    });

    if (premiumBtn && premiumBtn.parentElement && !premiumBtn.parentElement.querySelector('.instagrab-magnific-sidebar-bar')) {
      const sideContainer = premiumBtn.parentElement;
      const sideBar = document.createElement('div');
      sideBar.className = 'instagrab-magnific-sidebar-bar';

      const sideDlBtn = document.createElement('button');
      sideDlBtn.type = 'button';
      sideDlBtn.className = 'instagrab-magnific-sidebar-btn';
      sideDlBtn.innerHTML = `${DOWNLOAD_ICON} <span>Download Full Size (HD)</span>`;
      sideDlBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        downloadImageDirectly(fullImgUrl, filename, sideDlBtn, 'Full Size HD');
      });
      sideBar.appendChild(sideDlBtn);

      const sideCopyBtn = document.createElement('button');
      sideCopyBtn.type = 'button';
      sideCopyBtn.className = 'instagrab-magnific-sidebar-btn secondary';
      sideCopyBtn.innerHTML = `${COPY_ICON} <span>Copy as PNG</span>`;
      sideCopyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        copyImageAsPngToClipboard(fullImgUrl, sideCopyBtn);
      });
      sideBar.appendChild(sideCopyBtn);

      sideContainer.insertBefore(sideBar, premiumBtn.nextSibling);
    }
  }

  function scanMagnific() {
    scanMagnificExpandedView();
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
              const safeName = `${titleText.replace(/[<>:"/\\|?*]/g, '_').slice(0, 80)}.png`;
              downloadImageDirectly(fullImgUrl, safeName, dlBtn, isIconItem ? 'Icon PNG' : 'Full Size HD');
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
          const safeName = `${cardTitle.replace(/[<>:"/\\|?*]/g, '_').slice(0, 60)}_preview.png`;
          downloadImageDirectly(previewSrc, safeName, prevBtn, 'Preview Image');
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

  // ================= CANVA BACKGROUND REMOVER MODULE =================
  // Enables 1-click "Copy Image" as transparent PNG to clipboard on Canva's background remover tool,
  // without needing to download files to disk or battle non-copyable overlays.

  function extractCanvaCutout(container) {
    if (!container) return null;

    // 1. Check for canvas elements (often used for background removal renderers)
    const canvases = Array.from(container.querySelectorAll('canvas')).filter(c => c.width > 50 && c.height > 50);
    if (canvases.length > 0) {
      canvases.sort((a, b) => (b.width * b.height) - (a.width * a.height));
      return { type: 'canvas', element: canvases[0] };
    }

    // 2. Check for img elements
    const imgs = Array.from(container.querySelectorAll('img')).filter(img => {
      const src = img.currentSrc || img.src || '';
      if (!src) return false;
      if (src.includes('logo') || src.includes('avatar') || src.includes('icon') || src.includes('brand')) return false;
      const w = img.naturalWidth || img.clientWidth || img.width || 0;
      const h = img.naturalHeight || img.clientHeight || img.height || 0;
      return (w > 100 && h > 100) || src.startsWith('blob:') || src.startsWith('data:');
    });

    if (imgs.length > 0) {
      imgs.sort((a, b) => {
        const aBlob = (a.src || '').startsWith('blob:') || (a.src || '').startsWith('data:');
        const bBlob = (b.src || '').startsWith('blob:') || (b.src || '').startsWith('data:');
        if (aBlob && !bBlob) return -1;
        if (!aBlob && bBlob) return 1;
        const aArea = (a.naturalWidth || a.width || 0) * (a.naturalHeight || a.height || 0);
        const bArea = (b.naturalWidth || b.width || 0) * (b.naturalHeight || b.height || 0);
        return bArea - aArea;
      });
      return { type: 'img', element: imgs[0], url: imgs[0].currentSrc || imgs[0].src };
    }

    // 3. Check for background-image
    const bgEls = Array.from(container.querySelectorAll('div, section, span')).filter(el => {
      const bg = window.getComputedStyle(el).backgroundImage;
      return bg && bg.startsWith('url(') && !bg.includes('logo') && !bg.includes('icon');
    });
    if (bgEls.length > 0) {
      const match = window.getComputedStyle(bgEls[0]).backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
      if (match && match[1]) {
        return { type: 'bg', element: bgEls[0], url: match[1] };
      }
    }

    // 4. Check for <a> or download link
    const dlLinks = Array.from(container.querySelectorAll('a[download], a[href^="blob:"], a[href^="data:"]'));
    if (dlLinks.length > 0 && dlLinks[0].href) {
      return { type: 'link', element: dlLinks[0], url: dlLinks[0].href };
    }

    return null;
  }

  async function copyCanvaCutoutToClipboard(cutoutInfo, button, dlBtn) {
    if (button && button.classList.contains('instagrab-loading')) return;
    const origHtml = button ? button.innerHTML : '';
    if (button) {
      button.classList.add('instagrab-loading');
      button.innerHTML = `${SPINNER_ICON} <span>Copying...</span>`;
    }

    const restoreBtn = (isSuccess) => {
      if (!button) return;
      button.classList.remove('instagrab-loading');
      if (isSuccess) {
        button.classList.add('instagrab-success');
        button.innerHTML = `${CHECK_ICON} <span>Copied!</span>`;
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
        message: 'Converting cutout to crisp PNG...',
        progress: 35,
        state: 'processing'
      });

      let pngBlob = null;

      // 1. Try canvas.toBlob()
      if (cutoutInfo && cutoutInfo.type === 'canvas' && cutoutInfo.element) {
        try {
          pngBlob = await new Promise((resolve) => {
            cutoutInfo.element.toBlob(resolve, 'image/png');
          });
        } catch (_) {}
      }

      // 2. Directly fetch blob: or data: URL without canvas tainting
      let targetUrl = (cutoutInfo && cutoutInfo.url) || (cutoutInfo && cutoutInfo.element && (cutoutInfo.element.currentSrc || cutoutInfo.element.src));
      if (!pngBlob && targetUrl && (targetUrl.startsWith('blob:') || targetUrl.startsWith('data:'))) {
        try {
          const res = await fetch(targetUrl);
          const rawBlob = await res.blob();
          if (rawBlob.type === 'image/png') {
            pngBlob = rawBlob;
          } else {
            const bmp = await createImageBitmap(rawBlob);
            const off = document.createElement('canvas');
            off.width = bmp.width;
            off.height = bmp.height;
            const ctx = off.getContext('2d');
            ctx.drawImage(bmp, 0, 0);
            pngBlob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
          }
        } catch (_) {}
      }

      // 3. If http(s): URL, fetch via background worker to bypass CORS entirely
      if (!pngBlob && targetUrl && targetUrl.startsWith('http')) {
        try {
          const dataUrl = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'fetchPngDataUrl', url: targetUrl }, (res) => {
              if (chrome.runtime.lastError || !res || !res.success || !res.dataUrl) {
                reject(new Error((res && res.error) || 'Failed to fetch image'));
              } else {
                resolve(res.dataUrl);
              }
            });
          });
          const res = await fetch(dataUrl);
          pngBlob = await res.blob();
        } catch (_) {}
      }

      // 4. Fallback: Draw to offscreen canvas only if image is complete and same-origin/safe
      if (!pngBlob && cutoutInfo && cutoutInfo.type === 'img' && cutoutInfo.element) {
        const img = cutoutInfo.element;
        if (img.complete && (img.naturalWidth || img.width)) {
          try {
            const off = document.createElement('canvas');
            const w = img.naturalWidth || img.width || 800;
            const h = img.naturalHeight || img.height || 800;
            off.width = w;
            off.height = h;
            const ctx = off.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            pngBlob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
          } catch (_) {}
        }
      }

      // 4. Fallback: If dlBtn exists, listen for Canva's programmatic anchor click
      if (!pngBlob && dlBtn) {
        let capturedUrl = null;
        const origClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
          if (this.href && (this.href.startsWith('blob:') || this.href.startsWith('data:') || this.href.includes('.png'))) {
            capturedUrl = this.href;
          }
        };
        try {
          dlBtn.click();
        } catch (e) {}
        HTMLAnchorElement.prototype.click = origClick;

        if (capturedUrl) {
          const res = await fetch(capturedUrl);
          pngBlob = await res.blob();
        }
      }

      if (!pngBlob) {
        throw new Error('Unable to capture cutout image data.');
      }

      // Ensure blob is genuine image/png for ClipboardItem
      if (pngBlob.type !== 'image/png') {
        const bmp = await createImageBitmap(pngBlob);
        const off = document.createElement('canvas');
        off.width = bmp.width;
        off.height = bmp.height;
        const ctx = off.getContext('2d');
        ctx.drawImage(bmp, 0, 0);
        pngBlob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
      }

      updateToast({
        message: 'Writing transparent PNG to clipboard...',
        progress: 85,
        state: 'processing'
      });

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob })
      ]);

      restoreBtn(true);
      updateToast({
        message: '✓ Transparent PNG copied to clipboard!',
        progress: 100,
        state: 'complete'
      });
    } catch (err) {
      console.warn('[InstaGrab] Canva copy error:', err);
      restoreBtn(false);
      updateToast({
        message: '❌ Failed to copy PNG: ' + (err.message || 'Permission denied'),
        isError: true
      });
    }
  }

  // Handle pasting image from clipboard directly into Canva
  async function handleCanvaPaste(container, button) {
    if (button && button.classList.contains('instagrab-loading')) return;
    const origHtml = button ? button.innerHTML : '';
    if (button) {
      button.classList.add('instagrab-loading');
      button.innerHTML = `${SPINNER_ICON} <span>Pasting...</span>`;
    }

    const restore = (isSuccess, msg) => {
      if (button) {
        button.classList.remove('instagrab-loading');
        if (isSuccess) {
          button.classList.add('instagrab-success');
          button.innerHTML = `${CHECK_ICON} <span>Pasted!</span>`;
          setTimeout(() => {
            button.classList.remove('instagrab-success');
            button.innerHTML = origHtml;
          }, 2500);
        } else {
          button.innerHTML = origHtml;
        }
      }
      if (msg) {
        updateToast({
          message: msg,
          isError: !isSuccess,
          state: isSuccess ? 'complete' : 'error',
          progress: isSuccess ? 100 : 0
        });
      }
    };

    try {
      updateToast({
        message: 'Reading image from clipboard...',
        progress: 30,
        state: 'processing'
      });

      let imageBlob = null;

      // 1. Read from Async Clipboard API
      if (navigator.clipboard && navigator.clipboard.read) {
        try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            const imgType = item.types.find(t => t.startsWith('image/'));
            if (imgType) {
              imageBlob = await item.getType(imgType);
              break;
            }
          }
        } catch (clipErr) {
          console.warn('[InstaGrab] navigator.clipboard.read warning:', clipErr);
        }
      }

      if (!imageBlob) {
        restore(false, '⚠️ No image found in clipboard! Copy an image first, then click Paste.');
        return;
      }

      const ext = imageBlob.type === 'image/jpeg' ? 'jpg' : (imageBlob.type === 'image/webp' ? 'webp' : 'png');
      const file = new File([imageBlob], `pasted_image_${Date.now()}.${ext}`, {
        type: imageBlob.type || 'image/png',
        lastModified: Date.now()
      });

      const dt = new DataTransfer();
      dt.items.add(file);

      // Method A: Feed directly to Canva input[type="file"]
      const fileInput = container.querySelector('input[type="file"]') || document.querySelector('input[type="file"]');
      if (fileInput) {
        try {
          fileInput.files = dt.files;
        } catch (_) {
          Object.defineProperty(fileInput, 'files', {
            value: dt.files,
            writable: true
          });
        }
        fileInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        fileInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      }

      // Method B: Dispatch synthetic Drag & Drop event on dropzone
      const dropZone = container.querySelector('div[class*="drop" i], div[class*="upload" i], [role="presentation"]') || container;
      if (dropZone) {
        const dropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt
        });
        dropZone.dispatchEvent(dropEvent);
      }

      // Method C: Dispatch synthetic Paste event on document and dropzone
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt
      });
      (dropZone || document.activeElement || document.body).dispatchEvent(pasteEvent);

      restore(true, '✓ Image pasted into Canva background remover!');

    } catch (err) {
      console.error('[InstaGrab] Paste error:', err);
      restore(false, '⚠️ Failed to paste image: ' + (err.message || 'Permission denied'));
    }
  }

  // Inject "Paste Image" button into Canva's background remover & upload interfaces
  function scanCanvaUploadInterfaces() {
    // 1. Look for upload / select buttons: "Select image", "Upload image", "Choose image", "Choose file"
    const allButtons = Array.from(document.querySelectorAll('button, label, div[role="button"]'));
    const selectButtons = allButtons.filter(b => {
      if (b.classList.contains('instagrab-ignore') || b.classList.contains('instagrab-canva-paste-btn')) return false;
      const txt = (b.textContent || '').trim().toLowerCase();
      return (
        txt === 'select image' ||
        txt.includes('select image') ||
        txt.includes('upload image') ||
        txt.includes('choose image') ||
        txt.includes('choose file') ||
        txt.includes('select files')
      );
    });

    selectButtons.forEach(selBtn => {
      const parent = selBtn.parentElement;
      if (!parent || parent.querySelector('.instagrab-canva-paste-btn')) return;

      const container = selBtn.closest('[role="dialog"]') ||
                        selBtn.closest('div[class*="modal" i]') ||
                        selBtn.closest('div[class*="drop" i]') ||
                        selBtn.closest('div[class*="upload" i]') ||
                        selBtn.closest('section') ||
                        parent;

      const pasteBtn = document.createElement('button');
      pasteBtn.type = 'button';
      pasteBtn.className = 'instagrab-canva-paste-btn';
      pasteBtn.innerHTML = `${PASTE_ICON} <span>Paste Image</span>`;
      pasteBtn.title = 'Paste copied image directly from clipboard (or press Ctrl+V)';

      pasteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await handleCanvaPaste(container, pasteBtn);
      });

      if (selBtn.nextSibling) {
        parent.insertBefore(pasteBtn, selBtn.nextSibling);
      } else {
        parent.appendChild(pasteBtn);
      }
    });

    // 2. Also look for dashed drop zones containing "Drop image here" or "Drop files here"
    const dropAreas = Array.from(document.querySelectorAll('div, section, form')).filter(el => {
      if (el.dataset.instagrabPasteBound) return false;
      const txt = (el.innerText || '').toLowerCase();
      return (txt.includes('drop image here') || txt.includes('drag and drop any image') || txt.includes('drop your image')) && el.querySelector('input[type="file"]');
    });

    dropAreas.forEach(dropZone => {
      dropZone.dataset.instagrabPasteBound = 'true';
      dropZone.addEventListener('paste', async (e) => {
        if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
          return;
        }
        e.preventDefault();
        await handleCanvaPaste(dropZone, null);
      });
    });
  }

  function scanCanva() {
    scanCanvaUploadInterfaces();
    // 1. Search for Canva's "Download" buttons on the background remover tool / modal
    const allButtons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
    const dlButtons = allButtons.filter(b => {
      if (b.classList.contains('instagrab-ignore') || b.classList.contains('instagrab-canva-copy-btn')) return false;
      const txt = b.textContent.trim().toLowerCase();
      return txt === 'download' || (txt.startsWith('download') && !txt.includes('app'));
    });

    dlButtons.forEach(dlBtn => {
      const parentBar = dlBtn.parentElement;
      if (!parentBar) return;

      if (parentBar.querySelector('.instagrab-canva-copy-btn')) return;

      const modal = dlBtn.closest('[role="dialog"]') ||
                    dlBtn.closest('div[class*="modal" i]') ||
                    dlBtn.closest('div[class*="dialog" i]') ||
                    dlBtn.closest('section') ||
                    document.body;

      let cutout = extractCanvaCutout(modal);

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'instagrab-canva-copy-btn';
      copyBtn.innerHTML = `${COPY_ICON} <span>Copy Image</span>`;
      copyBtn.title = 'Copy transparent PNG directly to clipboard without downloading';
      copyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const freshCutout = extractCanvaCutout(modal) || cutout;
        copyCanvaCutoutToClipboard(freshCutout, copyBtn, dlBtn);
      });

      if (dlBtn.nextSibling) {
        parentBar.insertBefore(copyBtn, dlBtn.nextSibling);
      } else {
        parentBar.appendChild(copyBtn);
      }

      if (cutout && cutout.element) {
        const previewEl = cutout.element;
        previewEl.style.pointerEvents = 'auto';
        previewEl.style.userSelect = 'auto';

        const previewCard = previewEl.closest('div[class*="preview" i], div[class*="card" i], div[class*="image" i]') || previewEl.parentElement;
        if (previewCard && !previewCard.querySelector('.instagrab-canva-floating-copy')) {
          const floatBtn = document.createElement('button');
          floatBtn.type = 'button';
          floatBtn.className = 'instagrab-canva-floating-copy';
          floatBtn.innerHTML = `${COPY_ICON} <span>Copy PNG</span>`;
          floatBtn.title = 'Copy cutout directly to clipboard';
          floatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const freshCutout = extractCanvaCutout(modal) || cutout;
            copyCanvaCutoutToClipboard(freshCutout, floatBtn, dlBtn);
          });

          const overlays = previewCard.querySelectorAll('div');
          overlays.forEach(ov => {
            if (ov !== previewCard && !ov.contains(floatBtn)) {
              const cs = window.getComputedStyle(ov);
              if (cs.position === 'absolute' && cs.pointerEvents !== 'none' && !ov.innerText.trim()) {
                ov.style.pointerEvents = 'none';
              }
            }
          });

          previewCard.addEventListener('contextmenu', (e) => {
            e.stopPropagation();
          }, true);

          const computedPos = window.getComputedStyle(previewCard).position;
          if (computedPos === 'static') {
            previewCard.style.position = 'relative';
          }
          previewCard.appendChild(floatBtn);
        }
      }
    });

    // 2. Also check opened "Remove background" dialogs
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]'));
    dialogs.forEach(dialog => {
      const text = dialog.textContent.toLowerCase();
      if ((text.includes('remove background') || text.includes('background remover')) && !dialog.querySelector('.instagrab-canva-floating-copy')) {
        const cutout = extractCanvaCutout(dialog);
        if (cutout && cutout.element) {
          const previewCard = cutout.element.closest('div[class*="preview" i], div[class*="card" i]') || cutout.element.parentElement;
          if (previewCard && !previewCard.querySelector('.instagrab-canva-floating-copy')) {
            const floatBtn = document.createElement('button');
            floatBtn.type = 'button';
            floatBtn.className = 'instagrab-canva-floating-copy';
            floatBtn.innerHTML = `${COPY_ICON} <span>Copy PNG</span>`;
            floatBtn.title = 'Copy cutout directly to clipboard';
            floatBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              copyCanvaCutoutToClipboard(cutout, floatBtn, null);
            });
            const computedPos = window.getComputedStyle(previewCard).position;
            if (computedPos === 'static') {
              previewCard.style.position = 'relative';
            }
            previewCard.appendChild(floatBtn);
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
    } else if (host.includes('canva.com')) {
      scanCanva();
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


  // Global Ctrl+V / Cmd+V keyboard shortcut for Canva background remover upload
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable) {
        return;
      }
      const canvaModal = document.querySelector('[role="dialog"], div[class*="modal" i], div[class*="drop" i]');
      if (canvaModal && (canvaModal.innerText || '').toLowerCase().includes('remove background')) {
        handleCanvaPaste(canvaModal, canvaModal.querySelector('.instagrab-canva-paste-btn'));
      }
    }
  });

  console.log('[InstaGrab] Universal media downloader & copy active (Pinterest, YouTube, Instagram, Spotify, Magnific, Flaticon, Canva, Envato & Epidemic Sound)');
})();

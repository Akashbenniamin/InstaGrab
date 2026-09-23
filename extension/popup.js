document.addEventListener('DOMContentLoaded', async () => {
  const dot = document.getElementById('dot');
  const statusText = document.getElementById('status-text');
  const detectedPill = document.getElementById('detected-pill');
  const urlInput = document.getElementById('url-input');
  const downloadBtn = document.getElementById('download-btn');
  const btnText = document.getElementById('btn-text');
  const msgEl = document.getElementById('msg');
  const btnVideo = document.getElementById('btn-video');
  const btnAudio = document.getElementById('btn-audio');
  const qualitySelect = document.getElementById('quality-select');

  const progressBox = document.getElementById('progress-box');
  const progState = document.getElementById('prog-state');
  const progPct = document.getElementById('prog-pct');
  const progFill = document.getElementById('prog-fill');
  const progSpeed = document.getElementById('prog-speed');
  const progEta = document.getElementById('prog-eta');

  let currentFormat = 'video';
  let currentTheme = 'creators';

  // Apply Theme Function
  function setTheme(th) {
    currentTheme = th;
    document.body.className = th;
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ pref_theme: th });
    }
  }

  // Bind theme selector dots
  document.querySelectorAll('.theme-dot').forEach(dotEl => {
    dotEl.addEventListener('click', () => {
      const th = dotEl.getAttribute('data-theme');
      if (th) setTheme(th);
    });
  });

  const VIDEO_QUALITIES = [
    { value: 'best', label: 'Best Quality' },
    { value: '1080p', label: '1080p FHD' },
    { value: '720p', label: '720p HD' },
    { value: '480p', label: '480p SD' }
  ];

  const AUDIO_QUALITIES = [
    { value: 'best', label: 'Best (320k)' },
    { value: '320k', label: '320 kbps' },
    { value: '192k', label: '192 kbps' },
    { value: '128k', label: '128 kbps' }
  ];

  function updateQualityOptions(format, selectedVal = 'best') {
    const list = format === 'audio' ? AUDIO_QUALITIES : VIDEO_QUALITIES;
    qualitySelect.innerHTML = '';
    list.forEach(q => {
      const opt = document.createElement('option');
      opt.value = q.value;
      opt.textContent = q.label;
      if (q.value === selectedVal) opt.selected = true;
      qualitySelect.appendChild(opt);
    });
  }

  // Load saved preferences
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['pref_format', 'pref_quality', 'pref_theme'], (res) => {
      if (res.pref_theme) {
        setTheme(res.pref_theme);
      } else {
        setTheme('creators');
      }

      if (res.pref_format) {
        currentFormat = res.pref_format;
        if (currentFormat === 'audio') {
          btnAudio.classList.add('active');
          btnVideo.classList.remove('active');
        } else {
          btnVideo.classList.add('active');
          btnAudio.classList.remove('active');
        }
      }
      updateQualityOptions(currentFormat, res.pref_quality || 'best');
    });
  } else {
    setTheme('creators');
    updateQualityOptions('video');
  }

  btnVideo.addEventListener('click', () => {
    currentFormat = 'video';
    btnVideo.classList.add('active');
    btnAudio.classList.remove('active');
    updateQualityOptions('video');
    btnText.textContent = 'Download to Browser';
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ pref_format: 'video', pref_quality: qualitySelect.value });
    }
  });

  btnAudio.addEventListener('click', () => {
    currentFormat = 'audio';
    btnAudio.classList.add('active');
    btnVideo.classList.remove('active');
    updateQualityOptions('audio');
    btnText.textContent = 'Download Audio (MP3)';
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ pref_format: 'audio', pref_quality: qualitySelect.value });
    }
  });

  qualitySelect.addEventListener('change', () => {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ pref_quality: qualitySelect.value });
    }
  });

  // Check helper status via background service worker
  if (chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ action: 'checkHealth' }, (res) => {
      if (res && res.ok) {
        dot.classList.add('connected');
        statusText.textContent = 'Active (18765)';
      } else {
        dot.classList.remove('connected');
        statusText.textContent = 'Offline';
        statusText.style.color = '#ef4444';
      }
    });
  }

  // Live progress display logic
  function renderProgress(data) {
    if (!data || !data.state) return;

    if (data.state === 'complete') {
      progressBox.style.display = 'block';
      progFill.style.width = '100%';
      progPct.textContent = '100%';
      progState.textContent = '✓ Download complete!';
      progSpeed.textContent = data.filename || 'Saved to browser downloads';
      progEta.textContent = '';
      downloadBtn.disabled = false;
      btnText.textContent = 'Downloaded ✓';
      showMessage('✓ Saved to your browser downloads!', false);
      setTimeout(() => {
        progressBox.style.display = 'none';
        btnText.textContent = currentFormat === 'audio' ? 'Download Audio (MP3)' : 'Download to Browser';
      }, 4000);
      return;
    }

    if (data.state === 'error') {
      progressBox.style.display = 'none';
      downloadBtn.disabled = false;
      btnText.textContent = currentFormat === 'audio' ? 'Download Audio (MP3)' : 'Download to Browser';
      showMessage(data.error || 'Download failed during extraction', true);
      return;
    }

    // In-progress states (extracting, downloading, processing)
    progressBox.style.display = 'block';
    downloadBtn.disabled = true;
    btnText.textContent = 'Downloading...';

    const pct = Math.max(2, Math.min(100, Math.round(data.progress || 0)));
    progFill.style.width = pct + '%';
    progPct.textContent = pct + '%';

    if (data.state === 'extracting') {
      progState.textContent = 'Extracting media streams...';
      progSpeed.textContent = 'Analyzing source...';
      progEta.textContent = '';
    } else if (data.state === 'processing') {
      progState.textContent = 'Muxing & finalizing video...';
      progSpeed.textContent = 'Applying NLE optimizations';
      progEta.textContent = '';
    } else {
      progState.textContent = 'Downloading...';
      progSpeed.textContent = data.speed || 'Downloading';
      progEta.textContent = data.eta ? 'ETA ' + data.eta : '';
    }
  }

  // Check if a background download is already in progress
  if (chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ action: 'getActiveDownload' }, (dl) => {
      if (dl && dl.downloadId && dl.state !== 'complete' && dl.state !== 'error') {
        renderProgress(dl);
      }
    });

    // Listen for real-time progress broadcast from background.js
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.action === 'downloadProgress') {
        renderProgress(msg);
      }
    });
  }

  // Detect active media on the current tab
  async function detectActiveTabMedia() {
    if (!chrome.tabs || !chrome.tabs.query) return;

    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const activeTab = (tabs && tabs[0]) ? tabs[0] : null;
      if (!activeTab || !activeTab.id) return;

      // Ask content script for precise visible media item
      chrome.tabs.sendMessage(activeTab.id, { action: 'detectCurrentMedia' }, (res) => {
        if (chrome.runtime.lastError) {
          // Content script not loaded on this tab (e.g. Chrome Web Store or local file)
          fallbackTabUrl(activeTab.url);
          return;
        }

        if (res && res.url) {
          urlInput.value = res.url;
          const platformLabel = res.platform === 'instagram' ? 'Reel / Post' : (res.platform === 'youtube' ? 'Video' : 'Pin');
          detectedPill.textContent = `🎯 Active ${platformLabel} detected on page`;
          detectedPill.style.display = 'flex';
        } else {
          fallbackTabUrl(activeTab.url);
        }
      });
    } catch {
      fallbackClipboard();
    }
  }

  function fallbackTabUrl(rawUrl) {
    if (!rawUrl) {
      fallbackClipboard();
      return;
    }
    const clean = normalizeMediaUrl(rawUrl);
    // Don't auto-fill root/generic pages without specific IDs
    if (clean && !isGenericHomepage(clean)) {
      urlInput.value = clean;
    } else {
      fallbackClipboard();
    }
  }

  async function fallbackClipboard() {
    if (urlInput.value) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.includes('instagram.com') || text.includes('youtu') || text.includes('pinterest.'))) {
        const clean = normalizeMediaUrl(text);
        if (clean && !isGenericHomepage(clean)) {
          urlInput.value = clean;
          detectedPill.textContent = '📋 Link pasted from clipboard';
          detectedPill.style.display = 'flex';
        }
      }
    } catch {}
  }

  function isGenericHomepage(uStr) {
    try {
      const u = new URL(uStr);
      const p = u.pathname.replace(/\/+$/, '');
      if (u.hostname.includes('instagram.com')) {
        return p === '' || p === '/reels' || p === '/explore';
      }
      if (u.hostname.includes('pinterest.')) {
        return p === '' || p === '/today';
      }
      if (u.hostname.includes('youtube.com')) {
        return p === '' || p === '/feed/subscriptions' || p === '/feed/trending';
      }
    } catch {}
    return false;
  }

  detectActiveTabMedia();

  downloadBtn.addEventListener('click', async () => {
    let url = urlInput.value.trim();

    if (!url) {
      showMessage('Please paste a link or navigate to a video', true);
      return;
    }

    url = normalizeMediaUrl(url);

    if (isGenericHomepage(url)) {
      showMessage('Please open a specific Reel, Post, Video, or Pin', true);
      return;
    }

    downloadBtn.disabled = true;
    btnText.textContent = 'Starting...';
    msgEl.style.display = 'none';

    // Show progress box immediately
    renderProgress({ state: 'extracting', progress: 5, speed: 'Contacting engine...' });

    chrome.runtime.sendMessage(
      { 
        action: 'download', 
        url, 
        format_type: currentFormat, 
        quality: qualitySelect.value 
      },
      (res) => {
        if (chrome.runtime.lastError || !res) {
          downloadBtn.disabled = false;
          btnText.textContent = currentFormat === 'audio' ? 'Download Audio (MP3)' : 'Download to Browser';
          progressBox.style.display = 'none';
          showMessage('Desktop Engine offline. Please launch InstaGrab.', true);
          return;
        }

        if (res.success) {
          // Download task accepted! Background service worker will stream progress updates
          btnText.textContent = 'Downloading...';
        } else {
          downloadBtn.disabled = false;
          btnText.textContent = currentFormat === 'audio' ? 'Download Audio (MP3)' : 'Download to Browser';
          progressBox.style.display = 'none';
          showMessage(res.error || 'Desktop Engine offline. Please launch InstaGrab.', true);
        }
      }
    );
  });

  function normalizeMediaUrl(rawUrl) {
    if (!rawUrl) return rawUrl;
    try {
      let uStr = rawUrl.trim();
      if (!uStr.startsWith('http://') && !uStr.startsWith('https://')) {
        uStr = 'https://' + uStr;
      }
      const u = new URL(uStr);
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
      if (u.hostname.includes('pinterest.')) {
        const match = u.pathname.match(/\/pin\/(\d+)/);
        if (match) {
          return `https://www.pinterest.com/pin/${match[1]}/`;
        }
      }
    } catch {}
    return rawUrl;
  }

  function showMessage(text, isError) {
    msgEl.textContent = text;
    msgEl.style.color = isError ? '#f87171' : '#34d399';
    msgEl.style.background = isError ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)';
    msgEl.style.display = 'block';
  }
});

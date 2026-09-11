document.addEventListener('DOMContentLoaded', async () => {
  const dot = document.getElementById('dot');
  const statusText = document.getElementById('status-text');
  const urlInput = document.getElementById('url-input');
  const downloadBtn = document.getElementById('download-btn');
  const btnText = document.getElementById('btn-text');
  const msgEl = document.getElementById('msg');
  const btnVideo = document.getElementById('btn-video');
  const btnAudio = document.getElementById('btn-audio');
  const qualitySelect = document.getElementById('quality-select');

  let currentFormat = 'video';

  const VIDEO_QUALITIES = [
    { value: 'best', label: 'Best (Full HD)' },
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
    chrome.storage.local.get(['pref_format', 'pref_quality'], (res) => {
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
        statusText.textContent = 'Active (Port 18765)';
        statusText.style.color = '#10b981';
      } else {
        dot.classList.remove('connected');
        statusText.textContent = 'Offline';
        statusText.style.color = '#ef4444';
      }
    });
  }

  // Auto-populate from clipboard if available
  try {
    const text = await navigator.clipboard.readText();
    if (text && (text.includes('instagram.com') || text.includes('youtu') || text.includes('pinterest.'))) {
      urlInput.value = text;
    }
  } catch {}

  downloadBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (!url) {
      showMessage('Please enter or paste a valid link', true);
      return;
    }

    downloadBtn.disabled = true;
    btnText.textContent = 'Processing...';

    chrome.runtime.sendMessage(
      { 
        action: 'download', 
        url, 
        format_type: currentFormat, 
        quality: qualitySelect.value 
      },
      (res) => {
        downloadBtn.disabled = false;
        btnText.textContent = currentFormat === 'audio' ? 'Download Audio (MP3)' : 'Download to Browser';

        if (res && res.success) {
          showMessage('✓ Download started in browser!', false);
          urlInput.value = '';
        } else {
          showMessage((res && res.error) || 'Desktop Engine offline. Please launch InstaGrab.', true);
        }
      }
    );
  });

  function showMessage(text, isError) {
    msgEl.textContent = text;
    msgEl.style.color = isError ? '#f87171' : '#34d399';
    msgEl.style.background = isError ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)';
    msgEl.style.display = 'block';
  }
});

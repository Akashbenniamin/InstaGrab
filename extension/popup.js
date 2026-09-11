document.addEventListener('DOMContentLoaded', async () => {
  const dot = document.getElementById('dot');
  const statusText = document.getElementById('status-text');
  const urlInput = document.getElementById('url-input');
  const downloadBtn = document.getElementById('download-btn');
  const msgEl = document.getElementById('msg');

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
      showMessage('Please enter a media link', true);
      return;
    }

    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Starting...';

    chrome.runtime.sendMessage(
      { action: 'download', url, format_type: 'video', quality: 'best' },
      (res) => {
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Download via Engine';
        if (res && res.success) {
          showMessage('✓ Download started! Check Downloads folder.', false);
          urlInput.value = '';
        } else {
          showMessage((res && res.error) || 'Engine offline. Please start InstaGrab on your PC.', true);
        }
      }
    );
  });

  function showMessage(text, isError) {
    msgEl.textContent = text;
    msgEl.style.color = isError ? '#ef4444' : '#10b981';
    msgEl.style.display = 'block';
  }
});

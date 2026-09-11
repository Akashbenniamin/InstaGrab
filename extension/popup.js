const HELPER_BASE = 'http://127.0.0.1:18765';

document.addEventListener('DOMContentLoaded', async () => {
  const dot = document.getElementById('dot');
  const statusText = document.getElementById('status-text');
  const urlInput = document.getElementById('url-input');
  const downloadBtn = document.getElementById('download-btn');
  const msgEl = document.getElementById('msg');

  // Check helper status
  try {
    const res = await fetch(`${HELPER_BASE}/api/health`);
    if (res.ok) {
      dot.classList.add('connected');
      statusText.textContent = 'Active (Port 18765)';
      statusText.style.color = '#10b981';
    } else {
      throw new Error();
    }
  } catch {
    dot.classList.remove('connected');
    statusText.textContent = 'Offline';
    statusText.style.color = '#ef4444';
  }

  // Auto-populate from clipboard if available
  try {
    const text = await navigator.clipboard.readText();
    if (text && (text.includes('instagram.com') || text.includes('youtu') || text.includes('pinterest.com'))) {
      urlInput.value = text;
    }
  } catch {}

  downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      showMessage('Please enter a media link', true);
      return;
    }

    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Starting...';

    try {
      // 1. Auto-pair
      const pairRes = await fetch(`${HELPER_BASE}/api/pair/auto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'InstaGrab'
        }
      });
      if (!pairRes.ok) throw new Error('Could not connect to Desktop Engine');
      const { token } = await pairRes.json();

      // 2. Start download
      const dlRes = await fetch(`${HELPER_BASE}/api/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'InstaGrab',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          url,
          format_type: 'video',
          quality: 'best'
        })
      });

      if (!dlRes.ok) throw new Error('Download request failed');

      showMessage('✓ Download started! Check Downloads folder.', false);
      urlInput.value = '';
    } catch (err) {
      showMessage(err.message || 'Engine offline. Please start InstaGrab on your PC.', true);
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = 'Download via Engine';
    }
  });

  function showMessage(text, isError) {
    msgEl.textContent = text;
    msgEl.style.color = isError ? '#ef4444' : '#10b981';
    msgEl.style.display = 'block';
  }
});

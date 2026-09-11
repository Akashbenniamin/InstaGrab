# Troubleshooting

## Helper Not Detected

### Symptoms
- Website shows "Local downloader not detected"
- Connection indicator shows gray dot

### Solutions

**1. Is the helper running?**
- Look for the InstaGrab icon in the Windows system tray (bottom-right, near the clock)
- If not visible, click the "^" arrow to show hidden tray icons
- If not found, launch InstaGrab Helper from the Start Menu or Desktop shortcut

**2. Is the helper on the correct port?**
- Default port: `18765`
- Check `%APPDATA%\InstaGrab\config.json` for the `port` value
- Ensure no other application is using the same port

**3. Is your browser blocking the connection?**
- **Chrome/Edge:** You may see a "wants to access devices on your local network" prompt. Click **Allow**.
- **Firefox:** Should work automatically. Check that no extensions are blocking localhost requests.
- **Safari:** Not supported. Safari blocks HTTP to localhost from HTTPS pages. Use Chrome, Edge, or Firefox.

**4. Is the website origin configured?**
- Check `%APPDATA%\InstaGrab\config.json`
- The `allowed_origins` array must include your website's URL
- For local development: `http://localhost:5173`
- For deployed site: `https://yourusername.github.io`

**5. Firewall issues?**
- The helper only listens on `127.0.0.1` (localhost), so firewall shouldn't be an issue
- If using a VPN or proxy, it might intercept localhost traffic. Try disabling it temporarily.

---

## Pairing Code Not Working

### Symptoms
- Entering the 6-digit code shows an error
- "Invalid pairing code" message

### Solutions

**1. Is the code current?**
- The pairing code changes each time the helper restarts
- Right-click the tray icon to see the current code
- If you restarted the helper, use the new code

**2. Regenerate the code**
- Right-click the tray icon → "Regenerate Pairing Code"
- Enter the new code on the website

**3. Rate limiting**
- Too many failed attempts will temporarily block pairing
- Wait 1 minute and try again

---

## Download Fails

### "This content may require Instagram access"

Instagram rate-limits or blocks unauthenticated requests. Solutions:

1. **Enable browser cookies** (recommended):
   - Right-click tray icon → this will be available in a future settings UI
   - Or edit `%APPDATA%\InstaGrab\config.json`:
     ```json
     {
       "use_browser_cookies": true,
       "browser_for_cookies": "chrome"
     }
     ```
   - Restart the helper
   - This reads your existing Instagram session from your browser (cookies stay local)

2. **Try again later**: Instagram rate limits may be temporary

3. **Update yt-dlp**: Right-click tray icon → "Update yt-dlp"

### "Instagram's page structure prevented the download"

Instagram changed their internal API, breaking yt-dlp's extractor.

1. **Update yt-dlp**: Right-click tray icon → "Update yt-dlp"
2. **Wait for a fix**: If the latest yt-dlp doesn't work, the community usually patches it within days
3. **Check yt-dlp issues**: [github.com/yt-dlp/yt-dlp/issues](https://github.com/yt-dlp/yt-dlp/issues?q=instagram)

### "This Instagram URL isn't supported"

Only certain URL types are supported:
- ✅ `instagram.com/reel/ABC123/`
- ✅ `instagram.com/p/ABC123/`
- ✅ `instagram.com/tv/ABC123/`
- ❌ `instagram.com/stories/...` (stories require authentication)
- ❌ `instagram.com/username/` (profile pages)
- ❌ `instagram.com/explore/...` (explore pages)

### "Couldn't connect to Instagram"

1. Check your internet connection
2. Try opening the Instagram URL in your browser to verify it works
3. Instagram might be down — check [downdetector.com](https://downdetector.com/status/instagram/)

### Download is very slow

- Video download speed depends on your internet connection and Instagram's CDN
- The helper downloads directly from Instagram — there's no proxy or middleman to slow it down
- Large videos (especially long reels) take longer

---

## Antivirus False Positive

### Symptoms
- Windows Defender blocks the installer or helper
- Antivirus flags InstaGrab as malware

### Why this happens
PyInstaller-packaged Python applications are commonly flagged because malware authors also use PyInstaller. This is a false positive.

### Solutions

1. **Allow in Windows Defender:**
   - Open Windows Security → Virus & threat protection → Protection history
   - Find the InstaGrab detection → Actions → Allow

2. **Add exclusion:**
   - Windows Security → Virus & threat protection → Manage settings → Exclusions
   - Add folder: `%LOCALAPPDATA%\InstaGrab`

3. **Submit false positive report:**
   - [Microsoft Security Intelligence](https://www.microsoft.com/en-us/wdsi/filesubmission)
   - Submit as "Software developer" → "Incorrectly detected as malware"

---

## Chrome "Local Network Access" Prompt

### Symptoms
- Chrome shows: "username.github.io wants to access devices on your local network"

### Explanation
Starting with Chrome 142, Chrome requires explicit user permission before a website can communicate with localhost services. This is a security feature.

### Solution
- Click **Allow** when prompted
- This permission is remembered for the site

---

## Downloads Not Appearing

### Where are downloads saved?
- Default: `C:\Users\YourName\Downloads\Instagram\`
- Check `%APPDATA%\InstaGrab\config.json` for the `download_path` setting
- Right-click the tray icon → "Open Downloads Folder" to open the folder directly

### Duplicate filenames
If a file already exists:
- `video.mp4` → `video (1).mp4` → `video (2).mp4`

---

## Helper Crashes or Won't Start

### Check logs
- Logs are written to `%APPDATA%\InstaGrab\logs\`
- Check the latest log file for error messages

### Port conflict
If port 18765 is in use by another application:
1. Edit `%APPDATA%\InstaGrab\config.json`
2. Change `"port": 18765` to another port (e.g., `18766`)
3. Restart the helper

### Reset configuration
If the config file is corrupted:
1. Delete `%APPDATA%\InstaGrab\config.json`
2. Restart the helper (a fresh config will be created)

---

## Still Need Help?

1. Check [GitHub Issues](https://github.com/username/instagram-downloader/issues)
2. Search for your error message
3. If not found, create a new issue with:
   - Your Windows version
   - Browser and version
   - The Instagram URL you tried (if not private)
   - Any error messages you see
   - Helper log files from `%APPDATA%\InstaGrab\logs\`

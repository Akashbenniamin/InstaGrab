# InstaGrab — Project Handover & Developer Briefing

## 1. Project Overview
**InstaGrab** is a cross-platform media downloader tailored for high-quality, NLE-compatible video & image acquisition from Instagram, YouTube (including Shorts), and Pinterest.

The solution consists of three primary components:
1. **Frontend Web App** (`frontend/`): React + TypeScript + Vite + Tailwind CSS + Lucide icons.
2. **Chrome Browser Extension** (`extension/`): Manifest V3 extension injecting download actions, overlay buttons, and communicating directly with the local helper service.
3. **Local Helper Service** (`local-helper/`): Python service (Flask + Waitress + yt-dlp + FFmpeg/ffprobe + Win32 API) packaged via PyInstaller into a standalone system tray app.

---

## 2. Key Directories & File Paths
- **Repository Root**: `C:\Users\ADMIN\.gemini\antigravity\scratch\instagram-downloader`
- **Installed Helper Executable**: `C:\Users\ADMIN\AppData\Local\InstaGrabHelper\InstaGrab Helper.exe`
- **Default Downloads Directory**: `C:\Users\ADMIN\Downloads\InstaGrab`
- **System FFmpeg**: In system PATH (`Gyan.FFmpeg` via WinGet)
- **Local Helper API Port**: `http://127.0.0.1:18765`

---

## 3. Architecture & Key Modules

### A. Local Helper (`local-helper/src/`)
- `main.py`: Application entry point; handles single-instance mutex, system tray icon lifecycle (`tray.py`), desktop station attachment, and starts the Waitress WSGI server.
- `server.py`: Flask API endpoints:
  - `GET /api/health`: Health status and pairing verification.
  - `POST /api/download`: Triggers media extraction & download tasks.
  - `GET /api/progress/<id>`: Polling endpoint for real-time download percentage.
  - `POST /api/open-file`: Reveals downloaded files in Windows File Explorer (`reveal_in_explorer`).
  - `POST /api/open-folder`: Opens the downloads directory.
- `downloader.py`:
  - Uses `yt-dlp` configured with `format_sort: ['vcodec:h264', 'acodec:m4a', 'res', 'fps']` to aggressively prioritize NLE-friendly H.264 video and AAC audio.
  - `_ensure_h264_compatible`: Automatically inspects streams with `ffprobe`. If only VP9 or AV1 is available, or if NLE repair is required, it transcodes to NLE-optimized H.264.
  - Silent execution: All `subprocess` calls (`ffprobe`, `ffmpeg`, `pip`) explicitly pass `creationflags=subprocess.CREATE_NO_WINDOW` and `STARTUPINFO(wShowWindow=SW_HIDE)` to prevent command-prompt flashes.
- `security.py`: Token validation, CORS origin verification, path traversal checks, and URL validation for Instagram, YouTube, and Pinterest.
- `tray.py`: Pystray-based system tray icon with status display, quick folder access, and exit handling.

### B. Chrome Extension (`extension/`)
- `manifest.json`: Manifest V3 specification.
- `content.js`: Content script injecting download overlays into Instagram Reels, Pinterest pins, and YouTube Shorts.
- `popup.js` / `popup.html`: Extension toolbar popup; auto-fills the active tab's URL and displays live download progress.
- `background.js`: Service worker routing extension requests to `http://127.0.0.1:18765`.

### C. Frontend Web App (`frontend/`)
- Modern React application providing manual URL input, media preview, format selection (MP4 / MP3 / PNG), and live progress tracking.

---

## 4. Summary of Recent Major Fixes & Critical Solutions

### 1. Windows File Explorer "View" Button & Desktop Isolation
- **The Problem**: Clicking "View" popped up a momentary terminal or left hidden background processes in Task Manager, without bringing Explorer to the foreground.
- **Root Cause**: Windows Desktop Station Isolation. Subshells run in isolated sandbox desktops (`WinSta0\exebox-*`), and Python's `subprocess.Popen` ignores `lpDesktop`. Additionally, Windows Foreground Lock prevented background processes from stealing focus.
- **The Solution** (in `server.py`):
  - Used native Win32 `kernel32.CreateProcessW` with `STARTUPINFOW(lpDesktop='WinSta0\\Default', wShowWindow=SW_SHOWNORMAL)`.
  - Added single-instance cleanup: enumerates existing `CabinetWClass` windows for `InstaGrab` and sends `WM_CLOSE` to avoid duplicate window clutter.
  - Bypassed Windows Foreground Lock using `AttachThreadInput`, synthesized `VK_MENU` (Alt-key), `SetWindowPos(HWND_TOPMOST)`, and `SetForegroundWindow`.

### 2. Video Codec Compatibility in Adobe After Effects (Audio-Only Bug)
- **The Problem**: Videos like `Video by mamitha.media [1280p].mp4` imported into After Effects as audio-only.
- **Root Cause**: Instagram served the high-res stream in **VP9 / AV1**. Adobe After Effects does not decode VP9 inside an MP4 container.
- **The Solution** (in `downloader.py`):
  - Prioritized `vcodec^=avc` in `yt-dlp` format selectors.
  - Implemented `_ensure_h264_compatible` to automatically transcode VP9/AV1 to H.264.

### 3. Adobe After Effects Playback Stutter & Timeline Jitter Bug
- **The Problem**: Videos like `Video by dronolphy [1920p].mp4` played fine in VLC but jittered/stuttered wildly when scrubbed or previewed in After Effects.
- **Root Cause**:
  - `libx264` default used `b_pyramid=normal` with 3 B-frames and long GOP (~250 frames), causing out-of-order presentation and negative decode timestamps (`dts = -512, -256`). After Effects' importer fails to resolve B-pyramid hierarchies properly.
  - Audio was copied as `HE-AAC` (High Efficiency AAC) with a negative start offset (`-0.114s`), introducing an edit list (`elst`) delay that broke audio/video clock synchronization in Adobe.
- **The Solution**:
  - Re-encoded with editing-optimized parameters:
    ```bash
    ffmpeg -y -i input.mp4 \
      -vf "setpts=PTS-STARTPTS" \
      -af "asetpts=PTS-STARTPTS,aresample=async=1" \
      -c:v libx264 -crf 17 -preset fast -pix_fmt yuv420p \
      -fps_mode cfr -g 60 -keyint_min 60 -bf 0 \
      -avoid_negative_ts make_zero \
      -c:a aac -b:a 192k -ar 48000 \
      -movflags +faststart output.mp4
    ```
  - **`-bf 0`**: Guarantees strictly linear monotonic decoding (`PTS == DTS`). Zero frame reordering jitter.
  - **`-fps_mode cfr`**: Strict Constant Frame Rate.
  - **`-g 60`**: Short GOP (1s keyframes) for instant scrubbing.
  - **`-c:a aac -ar 48000`**: Clean 48 kHz LC-AAC audio starting at `0.000000s`.

### 4. Pinterest & Instagram URL Compatibility
- **Pinterest Image Pins**: If a pin is an image (no video streams), the downloader automatically retrieves the highest-resolution image and saves it as an optimized `.png`.
- **Instagram URLs**: Regex and canonicalization support all reel structures (`/reel/<id>`, `/reels/<id>`, `/<user>/reel/<id>`, `/share/reel/<id>`, etc.).

### 5. Console Window Suppression
- Explicitly passed `subprocess.CREATE_NO_WINDOW` and `STARTUPINFO(wShowWindow=SW_HIDE)` to all FFmpeg/ffprobe invocations to ensure zero terminal flickers.

---

## 5. Build & Deployment Instructions

### Rebuilding the Local Helper:
```powershell
# From C:\Users\ADMIN\.gemini\antigravity\scratch\instagram-downloader\local-helper
python build.py
```
This produces `dist\InstaGrab Helper\`.

### Deploying the Updated Executable:
```powershell
Stop-Process -Name "InstaGrab Helper" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Copy-Item -Path "C:\Users\ADMIN\.gemini\antigravity\scratch\instagram-downloader\local-helper\dist\InstaGrab Helper\*" -Destination "$env:LOCALAPPDATA\InstaGrabHelper" -Recurse -Force
Start-Process -FilePath "$env:LOCALAPPDATA\InstaGrabHelper\InstaGrab Helper.exe" -ArgumentList "--minimized"
```

### Verifying Service Health:
```powershell
curl.exe -s http://127.0.0.1:18765/api/health
# Expected: {"downloadPath":"...","paired":true,"status":"ok","version":"1.0.9",...}
```

---

## 6. Current State & Pending Considerations
- Helper executable is currently running live in the user session under `C:\Users\ADMIN\AppData\Local\InstaGrabHelper\InstaGrab Helper.exe`.
- All downloads in `C:\Users\ADMIN\Downloads\InstaGrab` have been fixed and validated.
- Any future video downloads will automatically receive NLE-optimized formatting.
- Git repository is clean on the `main` branch.

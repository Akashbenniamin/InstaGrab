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
  - `POST /api/info`: Extracts media metadata (`title`, `thumbnail`, `duration`, `uploader`, `playable_url`, `platform`) for live preview cards.
  - `GET /api/file/download/<filename>`: Streams files directly to the browser for native browser downloads via blob download anchor.
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
- `content.js` & `content.css`: Injects clean, theme-matched download buttons into Instagram Reels, Pinterest pins, and YouTube Shorts.
- `popup.js` / `popup.html`: Extension toolbar popup featuring the universal media downloader mark, live download progress, and a 7-theme palette switcher.
- Bundled into `frontend/public/instagrab-extension.zip` for instant user installation from the web app settings modal.

### C. Frontend Web App (`frontend/`)
- Modern React application providing:
  - **Universal Downloader Branding**: Sleek SVG brand mark replacing hardcoded Instagram rainbow gradients.
  - **Browser Download Delivery**: Initiating a download saves locally and triggers a native browser download manager download matching the extension behavior.
  - **Media Preview**: Live thumbnail display, title/uploader metadata, duration badge, and playable video / YouTube embed preview on the right side of the main action card.
  - **Streamlined Layout**: Tightened vertical spacing; removed redundant labels ("Format", "Quality", "Best Quality Selected by default") and removed the bottom privacy notice.
  - **Revamped Quick Mode**: Interactive switch tile adapting dynamically to the active theme palette.
  - **Clutter-Free Settings Modal**: Fixed container height (`h-[520px] max-h-[88vh]`) preventing jarring layout shifts during tab switching; all promotional tip banners removed.
  - **7 Tuned Themes**: High-contrast Creator Blue, Midnight Studio, Clean Light, Cyberpunk Neon, Sunset Amber, OLED Midnight, and Emerald Obsidian.

---

## 4. Summary of Recent Major Fixes & Critical Solutions

### 1. Browser Download Integration
- **The Problem**: Downloads previously only saved to the user's local disk folder, unlike the extension which also streamed files directly into the browser's download manager.
- **The Solution**:
  - Implemented `GET /api/file/download/<filename>` in `server.py` with sanitized path validation.
  - Added `triggerBrowserDownload(filename)` in `helperApi.ts` and wired into `useDownload.ts` to automatically fetch the blob and trigger a browser download.
  - Added instant browser download buttons to each entry in the download history drawer.

### 2. Live Media Preview & Playback
- **The Problem**: Users had no visual confirmation of the media before downloading.
- **The Solution**:
  - Implemented `extract_media_info(url)` in `downloader.py` and `POST /api/info` in `server.py`.
  - Built `MediaPreview.tsx` with instant YouTube thumbnail extraction, interactive HTML5 video playback for direct media, and YouTube embed support.

### 3. Settings Modal Height Jumps & Clutter Removal
- **The Problem**: Switching tabs caused the modal dialog height to expand and contract erratically; cluttered with intrusive tip callouts.
- **The Solution**:
  - Locked modal body to a fixed viewport-friendly height (`h-[520px] max-h-[88vh]`) with smooth vertical scroll.
  - Removed all tip callout banners across all tabs.

### 4. Accessibility & Theme Readability Overhaul
- **The Problem**: On "Creators Blue", green status badges and buttons were illegible. Also, hardcoded Instagram rainbow gradients violated universal downloader identity.
- **The Solution**:
  - Replaced hardcoded gradients with theme CSS variables (`--status-active-bg`, `--status-active-text`, `--quick-mode-bg`, etc.).
  - On Creators Blue, active status displays crisp deep blue (`#1e40af`) on soft blue (`#eff6ff`) with 100% WCAG AA contrast.

### 5. Windows File Explorer "View" Button & Desktop Isolation
- **The Solution**: Native Win32 `CreateProcessW` (`WinSta0\Default`) with single-instance window enumeration (`CabinetWClass`) and Windows Foreground Lock bypass (`AttachThreadInput` + `VK_MENU`).

### 6. Adobe Premiere / After Effects Monotonic Playback
- Strict H.264 CFR 60fps, `-bf 0` (zero B-frames for monotonic PTS == DTS), short GOP (`-g 60`), and normalized 48 kHz LC-AAC at `0.0s`.

### 7. Windows File Lock [WinError 32] Resolution (Adobe After Effects / NLEs)
- **The Problem**: When footage had been imported into Adobe After Effects or Premiere Pro (or opened in a player), re-downloading or updating caused `[WinError 32] The process cannot access the file because it is being used by another process`.
- **Root Cause**: Windows places a mandatory read lock (`FILE_SHARE_READ`) on active footage files, preventing in-place overwrites.
- **The Solution** (in `downloader.py`):
  - All download streams, audio extraction, and ffmpeg muxing now execute entirely inside an isolated per-job temp directory (`.tmp/<download_id>/`).
  - Destination file accessibility is checked via non-blocking write verification (`open(target_path, 'r+b')`).
  - If the file is locked by an NLE or media player, the engine automatically resolves to the next collision-free numbered filename: `Title [1280p] (1).mp4`, `Title [1280p] (2).mp4`, etc., guaranteeing 100% download success without disrupting active editing sessions.

---

## 5. Build & Deployment Instructions

### Rebuilding the Local Helper:
```powershell
# From C:\Users\ADMIN\.gemini\antigravity\scratch\instagram-downloader\local-helper
python build.py
```

### Deploying the Helper Executable:
```powershell
Stop-Process -Name "InstaGrab Helper" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Copy-Item -Path "C:\Users\ADMIN\.gemini\antigravity\scratch\instagram-downloader\local-helper\dist\InstaGrab Helper\*" -Destination "$env:LOCALAPPDATA\InstaGrabHelper" -Recurse -Force
Start-Process -FilePath "$env:LOCALAPPDATA\InstaGrabHelper\InstaGrab Helper.exe" -ArgumentList "--minimized"
```

### Building the Frontend:
```powershell
# From C:\Users\ADMIN\.gemini\antigravity\scratch\instagram-downloader\frontend
npm run build
```

---

## 6. Current State & Verification
- **Local Helper Executable**: Running live at `http://127.0.0.1:18765` (v1.0.9).
- **Frontend**: Clean build, 0 TypeScript errors.
- **Extension**: Re-bundled in `frontend/public/instagrab-extension.zip`.
- **Git status**: Clean on `main`.

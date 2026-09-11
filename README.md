# InstaGrab — Free, Decentralized Instagram & YouTube Downloader

Download Instagram and YouTube videos, reels, shorts, and audio directly to your device. No server-side processing, no paid APIs, no accounts required.

## Features

- **Decentralized Architecture**: Media downloads directly to your device via your local helper.
- **Instagram & YouTube Support**: Automatically detects Instagram Reels, Posts, and YouTube Videos & Shorts.
- **Format Options**: Choose between **MP4 (Video)** and **MP3 (Audio)** extraction.
- **Quality Selector**: Automatic **Highest Quality** selection by default, with custom options (1080p, 720p, 480p, 360p or 320k, 192k, 128k MP3).
- **100% Free**: Static frontend deployable on GitHub Pages at ₹0 cost.

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│  Static Website (GitHub Pages)                          │
│  You paste an Instagram or YouTube URL                  │
│                    │                                    │
│                    ▼                                    │
│  Your Browser ──HTTP──► Local Helper (127.0.0.1:18765) │
│                         │                               │
│                         ▼                               │
│                    yt-dlp (on your PC)                  │
│                         │                               │
│                         ▼                               │
│            Media CDN ──► Your Downloads folder          │
└─────────────────────────────────────────────────────────┘
```

**Your server hosts ONLY static HTML/CSS/JS (~280 KB).**  
**Videos and audio are downloaded directly from Instagram/YouTube to the user's own computer.**  
**Zero media bandwidth on your server. Zero cost.**

## Architecture

| Component | What it does | Where it runs |
|-----------|-------------|---------------|
| **Website** | UI for pasting URLs, showing progress | Static hosting (GitHub Pages) |
| **Local Helper** | Downloads videos via yt-dlp | User's Windows PC |
| **Instagram CDN** | Serves video files | Instagram's servers |

The website **never** touches the video data. It only sends the URL to the local helper and displays progress.

## Quick Start

### For Users

1. **Download** the [InstaGrab Helper installer](https://github.com/username/instagram-downloader/releases/latest)
2. **Run** the installer (no admin rights needed)
3. **Open** the [InstaGrab website](https://username.github.io/instagram-downloader)
4. **Enter** the pairing code from the helper's system tray icon
5. **Paste** an Instagram URL and click Download

### 1-Click Quick Start (Windows)

Simply double-click `start.bat` in the project root folder. It will:
1. Verify Node.js and Python
2. Install npm and pip dependencies automatically if missing
3. Launch both the local helper and frontend dev server
4. Automatically open `http://localhost:5173` in your browser

### For Developers (Manual)

#### Prerequisites
- Node.js 20+
- Python 3.12+
- Git

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

#### Local Helper
```bash
cd local-helper
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python src/main.py
```

## Project Structure

```
instagram-downloader/
├── frontend/               # React + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── hooks/          # React hooks
│   │   ├── services/       # API client, URL validation
│   │   └── types/          # TypeScript types
│   └── ...
│
├── local-helper/           # Python local helper
│   ├── src/
│   │   ├── server.py       # Flask API server
│   │   ├── downloader.py   # yt-dlp wrapper
│   │   ├── security.py     # Auth, validation, sanitization
│   │   ├── config.py       # Configuration management
│   │   ├── progress.py     # Download progress tracking
│   │   ├── tray.py         # System tray integration
│   │   └── main.py         # Entry point
│   ├── installer/          # Inno Setup scripts
│   └── tests/              # Unit tests
│
├── docs/                   # Documentation
│   ├── installation.md
│   ├── architecture.md
│   └── troubleshooting.md
│
└── README.md
```

## Security

The local helper includes multiple layers of protection:

1. **Loopback only** — Binds exclusively to `127.0.0.1` (never exposed to network)
2. **Host validation** — Rejects DNS rebinding attacks
3. **Origin validation** — Only accepts requests from the authorized website
4. **Custom headers** — Forces CORS preflight on all requests
5. **Bearer token** — Cryptographic session authentication
6. **Pairing code** — User-in-the-loop verification on first connection
7. **URL allowlist** — Only accepts valid Instagram URLs
8. **Filename sanitization** — Prevents path traversal attacks
9. **File type validation** — Only allows video file extensions
10. **Size limits** — Configurable maximum file size (default 500 MB)

[Full security documentation →](docs/architecture.md)

## Privacy

- ✅ No user accounts or login
- ✅ No data collection or analytics
- ✅ No video data passes through the website server
- ✅ No Instagram credentials are requested
- ✅ Downloads happen entirely on your device
- ✅ Download history stored only in your browser's localStorage (optional)
- ✅ The helper never uploads downloaded content anywhere

## Browser Support

| Browser | Website ↔ Helper | Notes |
|---------|-----------------|-------|
| Chrome / Edge | ✅ Full support | May show LNA permission prompt |
| Firefox | ✅ Full support | |
| Safari | ❌ Not supported | Mixed content blocks localhost. Use helper's tray UI. |
| Mobile browsers | ℹ️ Website only | Helper requires a desktop computer |

## Supported Content & Formats

| Content | Platform | MP4 Video | MP3 Audio | Notes |
|---------|----------|-----------|-----------|-------|
| **Instagram Reels** | Instagram | ✅ | ✅ | Highest quality / custom resolution |
| **Instagram Video Posts** | Instagram | ✅ | ✅ | Standard feed videos |
| **Instagram IGTV** | Instagram | ✅ | ✅ | Legacy & archived IGTV |
| **YouTube Shorts** | YouTube | ✅ | ✅ | Full vertical video & audio |
| **YouTube Long-form Videos** | YouTube | ✅ | ✅ | Up to 1080p+ & 320 kbps MP3 |
| **YouTube Music / Audio** | YouTube | ✅ | ✅ | Direct 320 kbps MP3 conversion |
| **Private Content** | All | ❌ | ❌ | Requires login (not supported by design) |

## Deployment

### GitHub Pages (Free)

```bash
cd frontend
npm run build
# Deploy the dist/ folder to GitHub Pages
```

See [deployment instructions](docs/installation.md#deployment) for detailed steps.

### Cloudflare Pages (Free)

Connect your GitHub repo. Build command: `cd frontend && npm run build`. Output: `frontend/dist`.

## Legal Notice

Download content only when you have permission or the right to save it. Respect Instagram's terms of service and creators' copyrights. This tool is intended for downloading publicly accessible content that you have the right to save.

## License

MIT

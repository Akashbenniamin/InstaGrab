# Installation Guide

## For Users (Windows)

### Step 1: Download the Installer

Download **InstaGrab-Helper-Setup.exe** from the [latest release](https://github.com/username/instagram-downloader/releases/latest).

> **Note:** Windows Defender or your antivirus may warn about the installer because it's not code-signed. This is a false positive common with Python-packaged applications. You can safely allow it.

### Step 2: Run the Installer

1. Double-click `InstaGrab-Helper-Setup.exe`
2. Follow the installation wizard
3. Choose installation options:
   - ☐ Create desktop shortcut (optional)
   - ☐ Start with Windows (recommended)
4. Click **Install**
5. The helper will launch automatically after installation

> **No admin rights required.** The helper installs to your user profile (`%LOCALAPPDATA%\InstaGrab`).

### Step 3: Find the Pairing Code

After the helper starts, look for the **InstaGrab** icon in your Windows system tray (bottom-right corner of the taskbar, near the clock).

- **Right-click** the tray icon
- Look for **"Pairing Code: XXXXXX"**
- Note this 6-digit code

### Step 4: Open the Website

Open [InstaGrab](https://username.github.io/instagram-downloader) in Chrome, Edge, or Firefox.

### Step 5: Connect

1. The website should detect the helper automatically
2. You'll be prompted to enter the pairing code
3. Enter the 6-digit code from Step 3
4. Click **Connect**

You're now connected! The pairing is saved in your browser, so you only need to do this once.

### Step 6: Download Videos

1. Copy an Instagram video/reel URL
2. Paste it into the input field
3. Click **Download Video**
4. The video will be saved to your `Downloads\Instagram\` folder

---

## For Developers

### Prerequisites

| Tool | Version | Required For |
|------|---------|-------------|
| Node.js | 20+ | Frontend |
| Python | 3.12+ | Local helper |
| Git | Any | Version control |

### Frontend Development

```bash
git clone https://github.com/username/instagram-downloader.git
cd instagram-downloader/frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` by default.

### Local Helper Development

```bash
cd instagram-downloader/local-helper
python -m venv venv
venv\Scripts\activate         # Windows
pip install -r requirements.txt
python src/main.py
```

The helper runs at `http://127.0.0.1:18765`.

### Configuration

The helper stores its config at `%APPDATA%\InstaGrab\config.json`:

```json
{
  "download_path": "C:\\Users\\YourName\\Downloads\\Instagram",
  "port": 18765,
  "allowed_origins": [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://username.github.io"
  ],
  "use_browser_cookies": false,
  "browser_for_cookies": "chrome",
  "max_file_size_mb": 500,
  "auto_start": false
}
```

#### Adding Your Deployed Origin

After deploying the frontend, add your GitHub Pages URL to `allowed_origins`:

```json
"allowed_origins": [
  "http://localhost:5173",
  "https://yourusername.github.io"
]
```

### Running Tests

```bash
cd local-helper
python -m pytest tests/ -v
```

---

## Deployment

### GitHub Pages (Free) {#deployment}

#### Option A: Manual Deployment

```bash
cd frontend
npm run build
```

Then push the `dist/` folder to the `gh-pages` branch:

```bash
# From the frontend directory
npx gh-pages -d dist
```

#### Option B: GitHub Actions (Automated)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      
      - name: Install and Build
        working-directory: frontend
        run: |
          npm ci
          npm run build
      
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./frontend/dist
```

#### Setting the Base Path

In `frontend/vite.config.ts`, ensure `base` matches your repository name:

```typescript
export default defineConfig({
  base: '/instagram-downloader/',
  // ...
})
```

### Cloudflare Pages (Alternative Free Hosting)

1. Connect your GitHub repository to Cloudflare Pages
2. Set build command: `cd frontend && npm run build`
3. Set output directory: `frontend/dist`
4. Set `base: '/'` in `vite.config.ts` (Cloudflare Pages uses root path)

---

## Building the Windows Installer

### Prerequisites
- [Inno Setup 6](https://jrsoftware.org/isdl.php)
- Python 3.12+

### Build Steps

```bash
cd local-helper
installer\build_installer.bat
```

This will:
1. Create a virtual environment
2. Install dependencies
3. Download FFmpeg
4. Package with PyInstaller
5. Build the Inno Setup installer

Output: `installer/output/InstaGrab-Helper-Setup-1.0.0.exe`

---

## Uninstalling

### Windows
1. Open **Settings** → **Apps** → **Installed apps**
2. Find **InstaGrab Helper**
3. Click **Uninstall**

Or run the uninstaller from: `%LOCALAPPDATA%\InstaGrab\unins000.exe`

### Browser Data
To clear saved pairing tokens and download history:
1. Open Chrome DevTools (F12)
2. Go to **Application** → **Local Storage**
3. Delete keys starting with `insta_dl_`

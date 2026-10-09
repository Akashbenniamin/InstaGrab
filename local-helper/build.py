import os
import sys

# Prevent OpenBLAS memory allocation failure in child processes
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"

import PyInstaller.__main__
import shutil
import urllib.request
import zipfile

def ensure_ffmpeg_assets():
    """Ensure ffmpeg.exe and ffprobe.exe are available in local-helper/ffmpeg/."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    ffmpeg_dir = os.path.join(current_dir, "ffmpeg")
    os.makedirs(ffmpeg_dir, exist_ok=True)
    
    ffmpeg_exe = os.path.join(ffmpeg_dir, "ffmpeg.exe")
    ffprobe_exe = os.path.join(ffmpeg_dir, "ffprobe.exe")
    
    if os.path.exists(ffmpeg_exe) and os.path.exists(ffprobe_exe) and os.path.getsize(ffmpeg_exe) > 1000:
        print("[BUILD] FFmpeg binaries already present in ffmpeg/ directory.")
        return ffmpeg_dir

    print("[BUILD] FFmpeg binaries missing. Searching system or downloading...")

    # 1. Check system PATH
    system_ffmpeg = shutil.which("ffmpeg")
    system_ffprobe = shutil.which("ffprobe")
    if system_ffmpeg and system_ffprobe:
        try:
            print(f"[BUILD] Copying FFmpeg from system PATH: {system_ffmpeg}")
            shutil.copy2(system_ffmpeg, ffmpeg_exe)
            shutil.copy2(system_ffprobe, ffprobe_exe)
            return ffmpeg_dir
        except Exception as e:
            print(f"[BUILD] Warning: Could not copy from system PATH: {e}")

    # 2. Check WinGet package location on Windows
    local_appdata = os.environ.get('LOCALAPPDATA', '')
    if local_appdata:
        winget_pkg_dir = os.path.join(local_appdata, 'Microsoft', 'WinGet', 'Packages')
        if os.path.isdir(winget_pkg_dir):
            for entry in os.listdir(winget_pkg_dir):
                if 'ffmpeg' in entry.lower():
                    sub = os.path.join(winget_pkg_dir, entry)
                    for root, dirs, files in os.walk(sub):
                        if 'ffmpeg.exe' in files and 'ffprobe.exe' in files:
                            print(f"[BUILD] Found WinGet FFmpeg in {root}. Copying...")
                            shutil.copy2(os.path.join(root, 'ffmpeg.exe'), ffmpeg_exe)
                            shutil.copy2(os.path.join(root, 'ffprobe.exe'), ffprobe_exe)
                            return ffmpeg_dir

    # 3. Download FFmpeg essentials if not found anywhere
    print("[BUILD] Downloading FFmpeg essentials zip...")
    urls = [
        "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
        "https://github.com/GyanD/codexffmpeg/releases/download/7.1/ffmpeg-7.1-essentials_build.zip"
    ]
    zip_path = os.path.join(ffmpeg_dir, "ffmpeg_download.zip")
    extract_path = os.path.join(ffmpeg_dir, "extract_temp")
    
    downloaded = False
    for url in urls:
        try:
            print(f"[BUILD] Fetching {url}...")
            req = urllib.request.Request(
                url,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) InstaGrabBuild/1.1'}
            )
            with urllib.request.urlopen(req, timeout=60) as resp, open(zip_path, 'wb') as f:
                shutil.copyfileobj(resp, f)
            
            with zipfile.ZipFile(zip_path, 'r') as zf:
                zf.extractall(extract_path)
                
            for root, dirs, files in os.walk(extract_path):
                if 'ffmpeg.exe' in files:
                    shutil.copy2(os.path.join(root, 'ffmpeg.exe'), ffmpeg_exe)
                if 'ffprobe.exe' in files:
                    shutil.copy2(os.path.join(root, 'ffprobe.exe'), ffprobe_exe)
            
            if os.path.exists(ffmpeg_exe) and os.path.exists(ffprobe_exe):
                downloaded = True
                print("[BUILD] FFmpeg extracted successfully.")
                break
        except Exception as e:
            print(f"[BUILD] Failed download from {url}: {e}")
        finally:
            if os.path.exists(zip_path):
                try: os.remove(zip_path)
                except Exception: pass
            if os.path.exists(extract_path):
                try: shutil.rmtree(extract_path, ignore_errors=True)
                except Exception: pass

    if not downloaded:
        print("[BUILD] WARNING: Could not automatically acquire FFmpeg binaries.")
    return ffmpeg_dir

def copy_ffmpeg_to_dist():
    """Copies ffmpeg.exe and ffprobe.exe into dist/InstaGrab Helper/ffmpeg/."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    src_ffmpeg_dir = os.path.join(current_dir, "ffmpeg")
    dist_ffmpeg_dir = os.path.join(current_dir, "dist", "InstaGrab Helper", "ffmpeg")
    
    os.makedirs(dist_ffmpeg_dir, exist_ok=True)
    copied = 0
    for binary in ["ffmpeg.exe", "ffprobe.exe", "ffmpeg", "ffprobe"]:
        src_bin = os.path.join(src_ffmpeg_dir, binary)
        if os.path.exists(src_bin):
            dst_bin = os.path.join(dist_ffmpeg_dir, binary)
            shutil.copy2(src_bin, dst_bin)
            copied += 1
            print(f"[BUILD] Bundled {binary} -> {dist_ffmpeg_dir}")
            
    if copied == 0:
        print("[BUILD] WARNING: No FFmpeg binaries were copied to dist folder!")
    else:
        print(f"[BUILD] Successfully bundled {copied} FFmpeg binaries for distribution.")

def build():
    # 1. Ensure FFmpeg dependencies are available locally before building
    ensure_ffmpeg_assets()

    # 2. Run PyInstaller
    PyInstaller.__main__.run([
        'src/main.py',
        '--noconfirm',
        '--clean',
        '--name=InstaGrab Helper',
        '--onedir',
        '--windowed',
        '--noupx',
        '--icon=assets/icon.ico',
        '--add-data=assets/icon.ico;assets',
        '--hidden-import=pystray',
        '--hidden-import=waitress',
        '--hidden-import=flask',
        '--hidden-import=flask_cors',
        '--hidden-import=yt_dlp',
        '--hidden-import=PIL',
        '--hidden-import=win32com',
        '--hidden-import=win32com.client',
        '--exclude-module=numpy',
        '--exclude-module=pytest',
        '--exclude-module=unittest',
        '--distpath=dist',
        '--workpath=build',
    ])

    # 3. Bundle FFmpeg into dist for packaging by Inno Setup
    copy_ffmpeg_to_dist()

if __name__ == '__main__':
    build()

import json
import subprocess
import yt_dlp
import threading
import os
import sys
import time
import re
from .security import validate_media_url

def get_ffmpeg_dir():
    """Resolves FFmpeg directory whether running as script or frozen bundle."""
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    ffmpeg_dir = os.path.join(base_dir, "ffmpeg")
    if os.path.exists(os.path.join(ffmpeg_dir, "ffmpeg.exe")) or os.path.exists(os.path.join(ffmpeg_dir, "ffmpeg")):
        return ffmpeg_dir
    return None

class Downloader:
    def __init__(self, config, progress_store):
        self.config = config
        self.progress_store = progress_store
        self.active_downloads = {}
        self.active_downloads_lock = threading.Lock()

    def start_download(self, url: str, download_id: str, format_type: str = 'video', quality: str = 'best') -> None:
        self.progress_store.create(download_id)
        thread = threading.Thread(
            target=self._download_thread,
            args=(url, download_id, format_type, quality),
            daemon=True
        )
        thread.start()

    def cancel_download(self, download_id: str) -> bool:
        with self.active_downloads_lock:
            if download_id in self.active_downloads:
                self.active_downloads[download_id]['cancel'] = True
                return True
        return False

    def get_status(self, download_id: str) -> dict:
        return self.progress_store.get(download_id)

    def extract_media_info(self, url: str) -> dict:
        is_valid, err_msg, platform = validate_media_url(url)
        if not is_valid:
            return {'error': err_msg}

        if platform == 'instagram':
            match = re.search(r'/(?:p|reel|reels|tv|share/reel|share/p)/([A-Za-z0-9_-]+)', url)
            if match:
                shortcode = match.group(1)
                content_type = 'reel' if 'reel' in url else ('tv' if '/tv/' in url else 'p')
                url = f"https://www.instagram.com/{content_type}/{shortcode}/"

        ydl_opts = {
            'skip_download': True,
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }
        ffmpeg_dir = get_ffmpeg_dir()
        if ffmpeg_dir:
            ydl_opts['ffmpeg_location'] = ffmpeg_dir

        cookie_file = self.config.get_cookie_file_path()
        if cookie_file:
            ydl_opts['cookiefile'] = cookie_file
        elif self.config.get('use_browser_cookies'):
            browser = self.config.get('browser_for_cookies')
            if browser:
                ydl_opts['cookiesfrombrowser'] = (browser,)

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if not info:
                    return {'error': 'No metadata found'}

                title = info.get('title') or ''
                thumbnail = info.get('thumbnail') or ''
                duration = info.get('duration') or 0
                uploader = info.get('uploader') or info.get('channel') or ''
                
                # Check for direct playable video stream
                playable_url = None
                direct_url = info.get('url')
                if direct_url and (direct_url.startswith('http') and not 'm3u8' in direct_url):
                    playable_url = direct_url
                else:
                    formats = info.get('formats') or []
                    for f in reversed(formats):
                        if f.get('vcodec') != 'none' and f.get('acodec') != 'none' and f.get('url') and f.get('ext') == 'mp4':
                            playable_url = f.get('url')
                            break

                return {
                    'title': title,
                    'thumbnail': thumbnail,
                    'duration': duration,
                    'uploader': uploader,
                    'platform': platform,
                    'playable_url': playable_url,
                }
        except Exception as e:
            err_str = str(e)
            # Pinterest fallback if no video found
            if platform == 'pinterest' and 'pin' in url:
                try:
                    import urllib.request
                    import json
                    pin_match = re.search(r'/pin/(\d+)', url)
                    if pin_match:
                        pin_id = pin_match.group(1)
                        api_url = f"https://www.pinterest.com/resource/PinResource/get/?data={{\"options\":{{\"id\":\"{pin_id}\",\"field_set_key\":\"detailed\"}}}}"
                        req = urllib.request.Request(api_url, headers={
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'X-Requested-With': 'XMLHttpRequest'
                        })
                        with urllib.request.urlopen(req, timeout=5) as resp:
                            res_data = json.loads(resp.read().decode('utf-8'))
                            pin_data = res_data.get('resource_response', {}).get('data', {})
                            images = pin_data.get('images', {})
                            orig = images.get('orig', {})
                            img_url = orig.get('url') if orig else None
                            if img_url:
                                return {
                                    'title': pin_data.get('title') or pin_data.get('grid_title') or f"Pinterest Pin {pin_id}",
                                    'thumbnail': img_url,
                                    'duration': 0,
                                    'uploader': pin_data.get('pinner', {}).get('username') or 'Pinterest',
                                    'platform': 'pinterest',
                                    'playable_url': None
                                }
                except Exception:
                    pass
            return {'error': err_str}

    def update_ytdlp(self) -> tuple[bool, str]:
        import subprocess
        si = None
        creationflags = 0
        if sys.platform == 'win32':
            si = subprocess.STARTUPINFO()
            si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            si.wShowWindow = 0
            creationflags = subprocess.CREATE_NO_WINDOW
        try:
            subprocess.run([sys.executable, '-m', 'pip', 'install', '--upgrade', 'yt-dlp'], startupinfo=si, creationflags=creationflags, check=True, capture_output=True)
            return True, "Updated successfully"
        except Exception as e:
            return False, str(e)

    def _download_thread(self, url: str, download_id: str, format_type: str = 'video', quality: str = 'best'):
        is_valid, err_msg, platform = validate_media_url(url)
        if not is_valid:
            self.progress_store.update(download_id, state='error', error=err_msg, errorType='unknown')
            return

        if platform == 'instagram':
            match = re.search(r'/(?:p|reel|reels|tv|share/reel|share/p)/([A-Za-z0-9_-]+)', url)
            if match:
                shortcode = match.group(1)
                content_type = 'reel' if 'reel' in url else ('tv' if '/tv/' in url else 'p')
                url = f"https://www.instagram.com/{content_type}/{shortcode}/"

        with self.active_downloads_lock:
            self.active_downloads[download_id] = {'cancel': False}

        seen_files = []
        max_seen_pct = [0.0]

        def my_hook(d):
            with self.active_downloads_lock:
                if self.active_downloads.get(download_id, {}).get('cancel'):
                    raise Exception("Download cancelled by user")

            status = d.get('status')
            if status == 'downloading':
                curr_file = d.get('filename', '')
                if curr_file and curr_file not in seen_files:
                    seen_files.append(curr_file)

                stream_idx = len(seen_files)  # 1 for video, 2 for audio

                pct_str = d.get('_percent_str', '0%').strip('\x1b[0;94m').strip('%')
                try:
                    raw_pct = float(pct_str)
                except ValueError:
                    raw_pct = 0.0

                # Map stream 1 to 0..85%, stream 2 to 85..96%
                if stream_idx <= 1:
                    mapped_pct = raw_pct * 0.85
                else:
                    mapped_pct = 85.0 + (raw_pct * 0.11)

                if mapped_pct > max_seen_pct[0]:
                    max_seen_pct[0] = mapped_pct

                pct = round(max_seen_pct[0], 1)
                
                speed = d.get('_speed_str', '')
                if speed:
                    import re
                    speed = re.sub(r'\x1b\[[0-9;]*m', '', speed)
                    speed = speed.replace('MiB/s', ' MB/s').replace('KiB/s', ' KB/s').replace('GiB/s', ' GB/s').strip()
                eta = d.get('_eta_str', '')
                filename = os.path.basename(d.get('filename', ''))
                
                self.progress_store.update(download_id, state='downloading', progress=pct, speed=speed, eta=eta, filename=filename)
            elif status == 'finished':
                filename = os.path.basename(d.get('filename', ''))
                filepath = d.get('filename', '')
                self.progress_store.update(download_id, state='processing', progress=98.0, filename=filename, filepath=filepath)
            elif status == 'error':
                self.progress_store.update(download_id, state='error', error='yt-dlp download error')

        base_path = self.config.get_download_path()
        job_temp_dir = os.path.join(base_path, '.tmp', download_id)
        try:
            os.makedirs(job_temp_dir, exist_ok=True)
        except Exception:
            pass

        # Smart naming to prevent collisions when downloading multiple qualities/formats
        if format_type == 'audio':
            tmpl = '%(title)s [Audio].%(ext)s'
        elif quality and quality != 'best':
            tmpl = f'%(title)s [{quality}].%(ext)s'
        else:
            tmpl = '%(title)s%(height& [{}p]|)s.%(ext)s'

        outtmpl = os.path.join(job_temp_dir, tmpl)
        
        ydl_opts = {
            'paths': {
                'home': job_temp_dir,
                'temp': job_temp_dir
            },
            'outtmpl': outtmpl,
            'overwrites': True,
            'windowsfilenames': True,
            'progress_hooks': [my_hook],
            'quiet': True,
            'no_warnings': True,
        }

        # Set ffmpeg directory if found
        ffmpeg_dir = get_ffmpeg_dir()
        if ffmpeg_dir:
            ydl_opts['ffmpeg_location'] = ffmpeg_dir

        # Format & Quality logic
        if format_type == 'audio':
            # Audio Extraction (MP3)
            audio_bitrate = '320'
            if quality == '192k':
                audio_bitrate = '192'
            elif quality == '128k':
                audio_bitrate = '128'
            elif quality in ('best', '320k'):
                audio_bitrate = '320'

            ydl_opts['format'] = 'bestaudio/best'
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': audio_bitrate,
            }]
        else:
            # Video (MP4) - Prioritize H.264 (AVC) video and AAC (m4a) audio for 100% compatibility with editing software (After Effects, Premiere Pro, etc.)
            ydl_opts['merge_output_format'] = 'mp4'
            ydl_opts['format_sort'] = ['vcodec:h264', 'acodec:m4a', 'res', 'fps']
            if quality == '1080p':
                ydl_opts['format'] = (
                    'bestvideo[height<=1080][vcodec^=avc]+bestaudio[acodec^=mp4a]/'
                    'bestvideo[height<=1080][vcodec^=avc]+bestaudio/'
                    'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/'
                    'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best'
                )
            elif quality == '720p':
                ydl_opts['format'] = (
                    'bestvideo[height<=720][vcodec^=avc]+bestaudio[acodec^=mp4a]/'
                    'bestvideo[height<=720][vcodec^=avc]+bestaudio/'
                    'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/'
                    'bestvideo[height<=720]+bestaudio/best[height<=720]/best'
                )
            elif quality == '480p':
                ydl_opts['format'] = (
                    'bestvideo[height<=480][vcodec^=avc]+bestaudio[acodec^=mp4a]/'
                    'bestvideo[height<=480][vcodec^=avc]+bestaudio/'
                    'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/'
                    'bestvideo[height<=480]+bestaudio/best[height<=480]/best'
                )
            elif quality == '360p':
                ydl_opts['format'] = (
                    'bestvideo[height<=360][vcodec^=avc]+bestaudio[acodec^=mp4a]/'
                    'bestvideo[height<=360][vcodec^=avc]+bestaudio/'
                    'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/'
                    'bestvideo[height<=360]+bestaudio/best[height<=360]/best'
                )
            else:
                # 'best' (Highest Quality available with H.264 preference)
                ydl_opts['format'] = (
                    'bestvideo[vcodec^=avc]+bestaudio[acodec^=mp4a]/'
                    'bestvideo[vcodec^=avc]+bestaudio/'
                    'bestvideo[ext=mp4]+bestaudio[ext=m4a]/'
                    'bestvideo+bestaudio/best'
                )

        cookie_file = self.config.get_cookie_file_path()
        if cookie_file:
            ydl_opts['cookiefile'] = cookie_file
        elif self.config.get('use_browser_cookies'):
            browser = self.config.get('browser_for_cookies')
            if browser:
                ydl_opts['cookiesfrombrowser'] = (browser,)

        try:
            self.progress_store.update(download_id, state='extracting')
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                
                filepath = ydl.prepare_filename(info)
                # If audio postprocessing was applied, file extension will be .mp3
                if format_type == 'audio':
                    base_no_ext, _ = os.path.splitext(filepath)
                    mp3_filepath = base_no_ext + '.mp3'
                    if os.path.exists(mp3_filepath):
                        filepath = mp3_filepath

                if not os.path.exists(filepath):
                    # Check candidates inside job_temp_dir if filename differed
                    candidates = [os.path.join(job_temp_dir, f) for f in os.listdir(job_temp_dir) if not f.endswith('.part') and not f.endswith('.ytdl') and not f.startswith('.')]
                    if candidates:
                        filepath = max(candidates, key=os.path.getsize)

                if os.path.exists(filepath):
                    # Ensure H.264 compatibility for video formats if source only had VP9/AV1
                    if format_type != 'audio' and filepath.lower().endswith('.mp4'):
                        filepath = self._ensure_h264_compatible(filepath, ffmpeg_dir)

                    size_mb = os.path.getsize(filepath) / (1024 * 1024)
                    max_mb = self.config.get('max_file_size_mb')
                    if max_mb and max_mb > 0 and size_mb > max_mb:
                        self.progress_store.update(download_id, state='error', error=f"File exceeds max size of {max_mb}MB", errorType='unknown')
                        try:
                            os.remove(filepath)
                        except Exception:
                            pass
                        return

                    # Safely resolve target filename in base_path to avoid WinError 32 (file lock by After Effects, Premiere, Media Player)
                    desired_filename = os.path.basename(filepath)
                    target_path = os.path.join(base_path, desired_filename)
                    target_filename = desired_filename

                    if os.path.exists(target_path):
                        is_writable = False
                        try:
                            with open(target_path, 'r+b'):
                                is_writable = True
                        except (PermissionError, OSError):
                            is_writable = False

                        if not is_writable:
                            # File is locked by an external process (e.g. Adobe After Effects, Premiere Pro, VLC)
                            # Generate a unique non-conflicting filename: "Title [1280p] (1).mp4", etc.
                            base_name, ext = os.path.splitext(desired_filename)
                            counter = 1
                            while True:
                                cand_name = f"{base_name} ({counter}){ext}"
                                cand_path = os.path.join(base_path, cand_name)
                                if not os.path.exists(cand_path):
                                    target_path = cand_path
                                    target_filename = cand_name
                                    break
                                try:
                                    with open(cand_path, 'r+b'):
                                        target_path = cand_path
                                        target_filename = cand_name
                                        break
                                except (PermissionError, OSError):
                                    counter += 1

                    # Safely move completed media from private temp dir to destination
                    import shutil
                    if os.path.exists(target_path):
                        try:
                            os.remove(target_path)
                        except Exception:
                            pass
                    shutil.move(filepath, target_path)

                    self.progress_store.update(download_id, state='complete', progress=100.0, filepath=target_path, filename=target_filename)
        except Exception as e:
            err_str = str(e)
            # Check if this is a Pinterest image pin where yt-dlp finds no video formats
            if 'pinterest.' in url.lower() and ('no video' in err_str.lower() or 'unable to extract' in err_str.lower() or 'no media' in err_str.lower()):
                try:
                    self._download_pinterest_image(url, download_id, base_path)
                    return
                except Exception as img_err:
                    err_str = f"Pinterest image download failed: {str(img_err)}"

            error_type = 'unknown'
            if 'login' in err_str.lower() or 'private' in err_str.lower() or '401' in err_str or 'sign in' in err_str.lower():
                error_type = 'private_content'
            elif 'unsupported' in err_str.lower() or 'unable to extract' in err_str.lower():
                error_type = 'instagram_changed'
            elif 'urlopen' in err_str.lower() or 'connection' in err_str.lower() or 'timed out' in err_str.lower():
                error_type = 'network'
            elif 'cancelled' in err_str.lower():
                error_type = 'cancelled'
                
            self.progress_store.update(download_id, state='error', error=err_str, errorType=error_type)
        finally:
            import shutil
            try:
                if os.path.exists(job_temp_dir):
                    shutil.rmtree(job_temp_dir, ignore_errors=True)
            except Exception:
                pass
            with self.active_downloads_lock:
                if download_id in self.active_downloads:
                    del self.active_downloads[download_id]
            self.progress_store.cleanup_old()

    def _download_pinterest_image(self, url: str, download_id: str, base_path: str):
        import re
        import json
        import urllib.request
        import urllib.parse
        import io
        from PIL import Image

        pin_match = re.search(r'/pin/(\d+)', url)
        if not pin_match:
            raise Exception("Cannot extract Pinterest Pin ID from URL")

        pin_id = pin_match.group(1)
        self.progress_store.update(download_id, state='downloading', progress=25.0, speed='Extracting pin metadata', filename=f"pinterest_{pin_id}.png")

        endpoint = "https://www.pinterest.com/resource/PinResource/get/"
        params = {
            "data": json.dumps({"options": {"field_set_key": "unauth_react_main_pin", "id": pin_id}})
        }
        api_url = endpoint + "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(
            api_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "X-Pinterest-PWS-Handler": "www/[username].js",
                "Accept": "application/json"
            }
        )

        with urllib.request.urlopen(req, timeout=15) as resp:
            res_data = json.loads(resp.read().decode("utf-8"))
            data = res_data.get("resource_response", {}).get("data", {})
            images = data.get("images", {})
            orig = images.get("orig") or images.get("736x") or images.get("1200x") or {}
            img_url = orig.get("url")
            if not img_url:
                raise Exception("No high-resolution image URL found for pin")

            raw_title = data.get("title") or data.get("grid_title") or data.get("description") or f"pinterest_{pin_id}"
            clean_title = re.sub(r'[^\w\s-]', '', str(raw_title)).strip()[:50]
            if not clean_title:
                clean_title = f"pinterest_{pin_id}"

        self.progress_store.update(download_id, state='downloading', progress=65.0, speed='Downloading image', filename=f"{clean_title}.png")

        img_req = urllib.request.Request(img_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
        with urllib.request.urlopen(img_req, timeout=25) as img_resp:
            img_bytes = img_resp.read()

        self.progress_store.update(download_id, state='processing', progress=92.0, speed='Converting to PNG', filename=f"{clean_title}.png")

        im = Image.open(io.BytesIO(img_bytes))
        if im.mode in ("RGBA", "P"):
            im = im.convert("RGBA")
        else:
            im = im.convert("RGB")

        target_filename = f"{clean_title}.png"
        target_path = os.path.join(base_path, target_filename)

        counter = 1
        while os.path.exists(target_path):
            target_filename = f"{clean_title} ({counter}).png"
            target_path = os.path.join(base_path, target_filename)
            counter += 1

        im.save(target_path, format="PNG", optimize=True)

        self.progress_store.update(
            download_id,
            state='complete',
            progress=100.0,
            filename=target_filename,
            filepath=target_path
        )

    def _ensure_h264_compatible(self, filepath: str, ffmpeg_dir: str = None) -> str:
        """Verifies the output video uses H.264/AVC. If only VP9/AV1 was available, transcodes to H.264 for After Effects & Premiere Pro compatibility."""
        if not filepath or not os.path.exists(filepath) or not filepath.lower().endswith('.mp4'):
            return filepath

        ffprobe_bin = 'ffprobe'
        ffmpeg_bin = 'ffmpeg'
        if ffmpeg_dir:
            cand_probe = os.path.join(ffmpeg_dir, 'ffprobe.exe')
            cand_ffmpeg = os.path.join(ffmpeg_dir, 'ffmpeg.exe')
            if os.path.exists(cand_probe):
                ffprobe_bin = cand_probe
            if os.path.exists(cand_ffmpeg):
                ffmpeg_bin = cand_ffmpeg

        si = None
        creationflags = 0
        if sys.platform == 'win32':
            si = subprocess.STARTUPINFO()
            si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            si.wShowWindow = 0  # SW_HIDE
            creationflags = subprocess.CREATE_NO_WINDOW

        try:
            probe_cmd = [ffprobe_bin, '-v', 'error', '-show_entries', 'stream=codec_name,codec_type', '-of', 'json', filepath]
            probe_res = subprocess.check_output(probe_cmd, startupinfo=si, creationflags=creationflags, timeout=15)
            data = json.loads(probe_res.decode('utf-8'))
            streams = data.get('streams', [])
            video_codecs = [s.get('codec_name', '').lower() for s in streams if s.get('codec_type') == 'video']

            if any(vc in ('vp9', 'vp8', 'av1', 'av01') for vc in video_codecs):
                temp_fixed = filepath + '.compat.mp4'
                transcode_cmd = [
                    ffmpeg_bin, '-y', '-i', filepath,
                    '-vf', 'setpts=PTS-STARTPTS',
                    '-af', 'asetpts=PTS-STARTPTS,aresample=async=1',
                    '-c:v', 'libx264', '-crf', '17', '-preset', 'fast', '-pix_fmt', 'yuv420p',
                    '-fps_mode', 'cfr', '-g', '60', '-keyint_min', '60', '-bf', '0',
                    '-avoid_negative_ts', 'make_zero',
                    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
                    '-movflags', '+faststart',
                    temp_fixed
                ]
                subprocess.run(transcode_cmd, startupinfo=si, creationflags=creationflags, check=True, capture_output=True, timeout=300)
                if os.path.exists(temp_fixed) and os.path.getsize(temp_fixed) > 0:
                    try:
                        os.replace(temp_fixed, filepath)
                    except Exception:
                        import shutil
                        try:
                            os.remove(filepath)
                            shutil.move(temp_fixed, filepath)
                        except Exception:
                            filepath = temp_fixed
        except Exception:
            pass

        return filepath


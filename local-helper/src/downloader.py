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

    def start_download(self, url: str, download_id: str, format_type: str = 'video', quality: str = 'best', item_index: int = None, as_zip: bool = True) -> None:
        self.progress_store.create(download_id)
        thread = threading.Thread(
            target=self._download_thread,
            args=(url, download_id, format_type, quality, item_index, as_zip),
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

        if platform == 'instagram' and not ('/stories/' in url or '/s/' in url):
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

        import shutil
        node_path = shutil.which('node')
        if node_path:
            ydl_opts['js_runtimes'] = {'node': {'path': node_path}}

        if platform == 'instagram':
            cookie_file = self.config.get_cookie_file_path('instagram')
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

                media_type = 'video'
                if '/stories/highlights/' in url or '/s/' in url:
                    media_type = 'highlight'
                elif '/stories/' in url:
                    media_type = 'story'
                elif info.get('_type') == 'playlist' or info.get('entries'):
                    media_type = 'carousel'
                elif not playable_url:
                    formats = info.get('formats') or []
                    if not formats or all(f.get('vcodec') == 'none' for f in formats):
                        media_type = 'photo'

                if not thumbnail and info.get('thumbnails'):
                    thumb_list = info.get('thumbnails')
                    if thumb_list:
                        thumbnail = thumb_list[-1].get('url') or thumb_list[0].get('url')

                carousel_media = []
                item_count = 1
                if platform == 'instagram' and (media_type == 'carousel' or '/p/' in url or '/share/p/' in url):
                    try:
                        ig_info = self._fetch_instagram_post_info(url)
                        if ig_info:
                            carousel_media = ig_info.get('carousel_media', [])
                            item_count = ig_info.get('item_count', 1)
                            if ig_info.get('media_type') == 'carousel':
                                media_type = 'carousel'
                    except Exception:
                        pass

                return {
                    'title': title,
                    'thumbnail': thumbnail,
                    'duration': duration,
                    'uploader': uploader,
                    'platform': platform,
                    'playable_url': playable_url,
                    'media_type': media_type,
                    'carousel_media': carousel_media,
                    'item_count': item_count,
                }
        except Exception as e:
            err_str = str(e)
            # Instagram photo / carousel fallback if yt-dlp finds no video formats or fails
            if platform == 'instagram':
                try:
                    ig_info = self._fetch_instagram_post_info(url)
                    if ig_info:
                        return {
                            'title': ig_info.get('title'),
                            'thumbnail': ig_info.get('thumbnail'),
                            'duration': 0,
                            'uploader': ig_info.get('uploader'),
                            'platform': 'instagram',
                            'playable_url': ig_info.get('playable_url'),
                            'media_type': ig_info.get('media_type', 'photo'),
                            'carousel_media': ig_info.get('carousel_media', []),
                            'item_count': ig_info.get('item_count', 1),
                        }
                except Exception:
                    pass

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

    def _download_thread(self, url: str, download_id: str, format_type: str = 'video', quality: str = 'best', item_index: int = None, as_zip: bool = True):
        is_valid, err_msg, platform = validate_media_url(url)
        if not is_valid:
            self.progress_store.update(download_id, state='error', error=err_msg, errorType='unknown')
            return

        if platform == 'instagram' and not ('/stories/' in url or '/s/' in url):
            match = re.search(r'/(?:p|reel|reels|tv|share/reel|share/p)/([A-Za-z0-9_-]+)', url)
            if match:
                shortcode = match.group(1)
                content_type = 'reel' if 'reel' in url else ('tv' if '/tv/' in url else 'p')
                url = f"https://www.instagram.com/{content_type}/{shortcode}/"

        base_path = self.config.get_download_path()

        # If a specific carousel item index was explicitly requested, download it directly via native extractor
        if platform == 'instagram' and item_index is not None:
            try:
                self._download_instagram_photo_or_carousel(url, download_id, base_path, item_index=item_index, as_zip=False)
                return
            except Exception as e:
                self.progress_store.update(download_id, state='error', error=f"Download failed: {str(e)}", errorType='unknown')
                return

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

        import shutil
        node_path = shutil.which('node')
        if node_path:
            ydl_opts['js_runtimes'] = {'node': {'path': node_path}}

        is_valid, _, platform = validate_media_url(url)
        if platform == 'instagram':
            cookie_file = self.config.get_cookie_file_path('instagram')
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

            # Check if YouTube encountered bot block or "The page needs to be reloaded"
            if ('youtube.' in url.lower() or 'youtu.be' in url.lower()) and any(x in err_str.lower() for x in ['page needs to be reloaded', 'confirm you’re not a bot', 'confirm you are not a bot', 'sign in to confirm']):
                try:
                    self.progress_store.update(download_id, state='extracting', filename='Retrying with YouTube mobile client...')
                    retry_opts = dict(ydl_opts)
                    retry_opts.pop('cookiefile', None)
                    retry_opts.pop('cookiesfrombrowser', None)
                    retry_opts['extractor_args'] = {'youtube': {'player_client': ['ios', 'android', 'web']}}
                    with yt_dlp.YoutubeDL(retry_opts) as retry_ydl:
                        info = retry_ydl.extract_info(url, download=True)
                        filepath = retry_ydl.prepare_filename(info)
                        if format_type == 'audio':
                            base_no_ext, _ = os.path.splitext(filepath)
                            mp3_filepath = base_no_ext + '.mp3'
                            if os.path.exists(mp3_filepath):
                                filepath = mp3_filepath
                        if not os.path.exists(filepath):
                            candidates = [os.path.join(job_temp_dir, f) for f in os.listdir(job_temp_dir) if not f.endswith('.part') and not f.endswith('.ytdl') and not f.startswith('.')]
                            if candidates:
                                filepath = max(candidates, key=os.path.getsize)
                        if os.path.exists(filepath):
                            if format_type != 'audio' and filepath.lower().endswith('.mp4'):
                                filepath = self._ensure_h264_compatible(filepath, ffmpeg_dir)
                            desired_filename = os.path.basename(filepath)
                            target_path = os.path.join(base_path, desired_filename)
                            target_filename = desired_filename
                            if os.path.exists(target_path):
                                try:
                                    os.remove(target_path)
                                except Exception:
                                    pass
                            import shutil
                            shutil.move(filepath, target_path)
                            self.progress_store.update(download_id, state='complete', progress=100.0, filepath=target_path, filename=target_filename)
                            return
                except Exception as retry_err:
                    err_str = f"YouTube download error: {str(retry_err)}"

            # Check if this is an Instagram photo, carousel, or post where yt-dlp finds no video formats or fails
            if 'instagram.' in url.lower() or 'instagr.am' in url.lower():
                try:
                    self._download_instagram_photo_or_carousel(url, download_id, base_path, item_index=item_index, as_zip=as_zip)
                    return
                except Exception as ig_err:
                    err_str = f"Instagram download failed: {str(ig_err)}"

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
            probe_cmd = [ffprobe_bin, '-v', 'error', '-show_entries', 'stream=codec_name,codec_type,width,height,sample_aspect_ratio', '-of', 'json', filepath]
            probe_res = subprocess.check_output(probe_cmd, startupinfo=si, creationflags=creationflags, timeout=15)
            data = json.loads(probe_res.decode('utf-8'))
            streams = data.get('streams', [])
            v_stream = next((s for s in streams if s.get('codec_type') == 'video'), {})
            v_codec = v_stream.get('codec_name', '').lower()
            width = v_stream.get('width')
            height = v_stream.get('height')
            sar = v_stream.get('sample_aspect_ratio')
            is_non_square_sar = bool(sar and sar not in ('1:1', '0:1', '1/1', '0/1'))

            # Case 1: Transcode if using unsupported codecs (VP9, VP8, AV1)
            if v_codec in ('vp9', 'vp8', 'av1', 'av01'):
                temp_fixed = filepath + '.compat.mp4'
                vf_filters = 'setsar=1,setpts=PTS-STARTPTS'
                transcode_cmd = [
                    ffmpeg_bin, '-y', '-i', filepath,
                    '-vf', vf_filters,
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

            # Case 2: Codec is H.264, but has non-square SAR (anamorphic pixels that cause stretching in After Effects)
            elif is_non_square_sar and width and height:
                temp_fixed = filepath + '.sar.mp4'
                # Lossless bitstream SAR normalization to 1:1
                sar_cmd = [
                    ffmpeg_bin, '-y', '-i', filepath,
                    '-c:v', 'copy',
                    '-c:a', 'copy',
                    '-bsf:v', 'h264_metadata=sample_aspect_ratio=1/1',
                    '-aspect', f"{width}:{height}",
                    '-movflags', '+faststart',
                    temp_fixed
                ]
                subprocess.run(sar_cmd, startupinfo=si, creationflags=creationflags, check=True, capture_output=True, timeout=60)
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



    def _fetch_instagram_post_info(self, url: str) -> dict:
        import urllib.request
        import http.cookiejar
        import json
        import re

        match = re.search(r'/(?:p|reel|reels|tv|share/reel|share/p)/([A-Za-z0-9_-]+)', url)
        if not match:
            raise Exception("Could not parse Instagram shortcode from URL")

        shortcode = match.group(1)

        # Convert shortcode to numeric pk
        table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
        sc_clean = shortcode[:-28] if len(shortcode) > 28 else shortcode
        pk = 0
        for char in sc_clean:
            if char in table:
                pk = (pk * 64) + table.index(char)

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'X-IG-App-ID': '936619743392459',
            'X-ASBD-ID': '129477',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://www.instagram.com/',
        }

        cookie_file = self.config.get_cookie_file_path('instagram')
        if cookie_file and os.path.exists(cookie_file):
            try:
                cj = http.cookiejar.MozillaCookieJar(cookie_file)
                cj.load(ignore_discard=True, ignore_expires=True)
                opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
            except Exception:
                opener = urllib.request.build_opener()
        else:
            opener = urllib.request.build_opener()

        item = None
        if pk > 0:
            api_url = f'https://i.instagram.com/api/v1/media/{pk}/info/'
            try:
                req = urllib.request.Request(api_url, headers=headers)
                with opener.open(req, timeout=12) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    items = data.get('items', [])
                    if items:
                        item = items[0]
            except Exception:
                pass

        # Fallback to direct page scraping if API fails or returns no items
        if not item:
            page_req = urllib.request.Request(f'https://www.instagram.com/p/{shortcode}/', headers=headers)
            with opener.open(page_req, timeout=12) as p_resp:
                html = p_resp.read().decode('utf-8', errors='ignore')
                og_img = re.search(r'<meta\s+(?:property|name)=["\']og:image["\']\s+content=["\']([^"\']+)["\']', html)
                og_title = re.search(r'<meta\s+(?:property|name)=["\']og:title["\']\s+content=["\']([^"\']+)["\']', html)
                if not og_img:
                    raise Exception("Could not find media content in this Instagram post")
                img_url = og_img.group(1).replace('&amp;', '&')
                title = og_title.group(1) if og_title else f"instagram_photo_{shortcode}"
                clean_title = re.sub(r'[<>:"/\\|?*]', '_', title)[:60].strip() or f"instagram_{shortcode}"
                return {
                    'title': title,
                    'thumbnail': img_url,
                    'duration': 0,
                    'uploader': 'Instagram',
                    'platform': 'instagram',
                    'playable_url': None,
                    'media_type': 'photo',
                    'targets': [(img_url, False, f"{clean_title}.jpg")]
                }

        caption = item.get('caption', {}).get('text', '') if item.get('caption') else ''
        title = caption.split('\n')[0].strip() or f"instagram_{shortcode}"
        safe_title = re.sub(r'[<>:"/\\|?*]', '_', title)[:60].strip() or f"instagram_{shortcode}"
        uploader = item.get('user', {}).get('username') or 'instagram_user'

        targets = []
        carousel_media = []
        item_type = item.get('media_type')
        playable_url = None

        if item_type == 8 and item.get('carousel_media'):
            media_type = 'carousel'
            for idx, slide in enumerate(item['carousel_media']):
                is_vid = bool(slide.get('video_versions'))
                if is_vid:
                    v_url = slide['video_versions'][0]['url']
                    thumb = slide.get('image_versions2', {}).get('candidates', [{}])[0].get('url', v_url)
                    fname = f"{safe_title}_{idx+1}.mp4"
                    targets.append((v_url, True, fname, thumb))
                    if not playable_url:
                        playable_url = v_url
                elif slide.get('image_versions2', {}).get('candidates'):
                    img_url = slide['image_versions2']['candidates'][0]['url']
                    thumb = img_url
                    fname = f"{safe_title}_{idx+1}.jpg"
                    targets.append((img_url, False, fname, thumb))
                else:
                    continue

                w = slide.get('original_width') or (slide['video_versions'][0].get('width') if is_vid else slide['image_versions2']['candidates'][0].get('width', 1080))
                h = slide.get('original_height') or (slide['video_versions'][0].get('height') if is_vid else slide['image_versions2']['candidates'][0].get('height', 1080))
                carousel_media.append({
                    'index': idx + 1,
                    'media_type': 'video' if is_vid else 'photo',
                    'thumbnail': thumb,
                    'url': targets[-1][0],
                    'filename': fname,
                    'width': w,
                    'height': h
                })
        elif item.get('video_versions'):
            media_type = 'video'
            v_url = item['video_versions'][0]['url']
            playable_url = v_url
            fname = f"{safe_title}.mp4"
            thumb = item.get('image_versions2', {}).get('candidates', [{}])[0].get('url', v_url)
            targets.append((v_url, True, fname, thumb))
        elif item.get('image_versions2', {}).get('candidates'):
            media_type = 'photo'
            img_url = item['image_versions2']['candidates'][0]['url']
            fname = f"{safe_title}.jpg"
            targets.append((img_url, False, fname, img_url))
        else:
            raise Exception("No photos or videos found in this Instagram post")

        thumbnail = None
        if item.get('image_versions2', {}).get('candidates'):
            thumbnail = item['image_versions2']['candidates'][0]['url']
        elif targets:
            thumbnail = targets[0][0]

        return {
            'title': title,
            'thumbnail': thumbnail,
            'duration': 0,
            'uploader': uploader,
            'platform': 'instagram',
            'playable_url': playable_url,
            'media_type': media_type,
            'targets': targets,
            'carousel_media': carousel_media,
            'item_count': len(carousel_media) if carousel_media else 1
        }

    def _download_instagram_photo_or_carousel(self, url: str, download_id: str, base_path: str, item_index: int = None, as_zip: bool = True):
        import urllib.request
        import zipfile
        import os
        import re

        self.progress_store.update(download_id, state='extracting', progress=15.0, filename="Fetching Instagram media...")

        post_info = self._fetch_instagram_post_info(url)
        all_targets = post_info.get('targets', [])

        if not all_targets:
            raise Exception("No photos or media streams found in this Instagram post")

        # Handle individual item selection (1-based index)
        if item_index is not None and 1 <= item_index <= len(all_targets):
            targets = [all_targets[item_index - 1]]
            as_zip = False
        else:
            targets = all_targets

        self.progress_store.update(download_id, state='downloading', progress=30.0, filename=targets[0][2])

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Referer': 'https://www.instagram.com/'
        }

        saved_files = []
        ffmpeg_dir = get_ffmpeg_dir()

        for i, target in enumerate(targets):
            media_url = target[0]
            is_vid = target[1]
            fname = target[2]

            target_file = os.path.join(base_path, fname)
            base_name, ext = os.path.splitext(fname)
            c = 1
            while os.path.exists(target_file):
                target_file = os.path.join(base_path, f"{base_name} ({c}){ext}")
                fname = os.path.basename(target_file)
                c += 1

            req = urllib.request.Request(media_url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                with open(target_file, 'wb') as out_f:
                    out_f.write(resp.read())

            if is_vid and target_file.lower().endswith('.mp4'):
                try:
                    target_file = self._ensure_h264_compatible(target_file, ffmpeg_dir)
                    fname = os.path.basename(target_file)
                except Exception:
                    pass

            saved_files.append((target_file, fname))
            pct = 30.0 + (55.0 * (i + 1) / len(targets))
            self.progress_store.update(download_id, state='downloading', progress=round(pct, 1), filename=fname)

        if not saved_files:
            raise Exception("Failed to save media files")

        # Package as ZIP archive if requested and multiple files exist
        if as_zip and len(saved_files) > 1:
            self.progress_store.update(download_id, state='processing', progress=90.0, filename="Packaging ZIP album...")
            safe_title = post_info.get('title', 'instagram_album')
            safe_title = re.sub(r'[<>:"/\\|?*]', '_', safe_title)[:60].strip() or 'instagram_album'

            zip_filename = f"{safe_title}.zip"
            zip_path = os.path.join(base_path, zip_filename)
            zc = 1
            while os.path.exists(zip_path):
                zip_filename = f"{safe_title} ({zc}).zip"
                zip_path = os.path.join(base_path, zip_filename)
                zc += 1

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                for file_path, arc_name in saved_files:
                    zf.write(file_path, arc_name)

            self.progress_store.update(
                download_id,
                state='complete',
                progress=100.0,
                filepath=zip_path,
                filename=zip_filename,
                files=[zip_filename]
            )
            return

        # Individual item or multiple files for one-by-one downloads
        last_path, last_name = saved_files[0]
        all_filenames = [f[1] for f in saved_files]
        self.progress_store.update(
            download_id, 
            state='complete', 
            progress=100.0, 
            filepath=last_path, 
            filename=last_name,
            files=all_filenames
        )

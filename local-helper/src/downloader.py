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

def normalize_instagram_url(url: str) -> str:
    """Normalizes Instagram URLs, decoding /s/ shortlinks to highlights and cleaning params."""
    if not url or not ('instagram.' in url.lower() or 'instagr.am' in url.lower()):
        return url

    # Decode /s/ shortlink: e.g. /s/aGlnaGxpZ2h0OjE4MDkwOTQ2MDQ4MTIzOTc4
    short_match = re.search(r'/s/([A-Za-z0-9_-]+)', url)
    if short_match:
        token = short_match.group(1)
        try:
            import base64
            clean_token = token.replace('-', '+').replace('_', '/')
            padded = clean_token + '=' * (-len(clean_token) % 4)
            decoded = base64.b64decode(padded).decode('utf-8', errors='ignore')
            id_match = re.search(r'highlight:(\d+)', decoded)
            if id_match:
                return f"https://www.instagram.com/stories/highlights/{id_match.group(1)}/"
        except Exception:
            pass

    # Clean story highlight URL: /stories/highlights/18090946048123978/?story_media_id=...
    highlight_match = re.search(r'/stories/highlights/(\d+)', url)
    if highlight_match:
        return f"https://www.instagram.com/stories/highlights/{highlight_match.group(1)}/"

    # Posts, Reels, TV
    if not ('/stories/' in url):
        match = re.search(r'/(?:p|reel|reels|tv|share/reel|share/p)/([A-Za-z0-9_-]+)', url)
        if match:
            shortcode = match.group(1)
            content_type = 'reel' if 'reel' in url else ('tv' if '/tv/' in url else 'p')
            return f"https://www.instagram.com/{content_type}/{shortcode}/"

    return url

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

        if platform == 'envato':
            try:
                return self._extract_envato_info(url)
            except Exception as e:
                return {'error': str(e)}

        if platform == 'epidemic':
            try:
                return self._extract_epidemic_info(url)
            except Exception as e:
                return {'error': str(e)}

        if platform == 'magnific':
            try:
                return self._extract_magnific_info(url)
            except Exception as e:
                return {'error': str(e)}

        if platform == 'flaticon':
            try:
                return self._extract_flaticon_info(url)
            except Exception as e:
                return {'error': str(e)}

        if platform == 'spotify':
            try:
                return self._extract_spotify_info(url)
            except Exception as e:
                return {'error': str(e)}

        if platform == 'youtube':
            yt_match = re.search(r'(?:youtube\.com/watch\?.*?v=|youtu\.be/)([A-Za-z0-9_-]{11})', url)
            if yt_match:
                url = f"https://www.youtube.com/watch?v={yt_match.group(1)}"

        if platform == 'instagram':
            url = normalize_instagram_url(url)

        ydl_opts = {
            'skip_download': True,
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'noplaylist': (platform == 'youtube'),
            'socket_timeout': 20,
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

                # If playlist entries are present (Instagram carousel or highlight clips)
                if info.get('_type') == 'playlist' or info.get('entries'):
                    entries = [e for e in (info.get('entries') or []) if e]
                    if entries:
                        safe_title = re.sub(r'[<>:"/\\|?*]', '_', title)[:60].strip() or 'media'
                        for idx, entry in enumerate(entries):
                            e_formats = entry.get('formats') or []
                            v_formats = [f for f in e_formats if f.get('vcodec') != 'none' and f.get('acodec') != 'none' and f.get('url')]
                            if not v_formats:
                                v_formats = [f for f in e_formats if f.get('url') and f.get('ext') == 'mp4']

                            is_vid = bool(v_formats)
                            v_url = v_formats[0].get('url') if is_vid else None

                            e_thumb = None
                            if entry.get('thumbnails'):
                                e_thumb = entry['thumbnails'][-1].get('url') or entry['thumbnails'][0].get('url')
                            elif entry.get('thumbnail'):
                                e_thumb = entry.get('thumbnail')

                            slide_url = v_url if is_vid else e_thumb
                            if not slide_url:
                                continue

                            fname = f"{safe_title}_{idx+1}.{'mp4' if is_vid else 'jpg'}"
                            carousel_media.append({
                                'index': idx + 1,
                                'media_type': 'video' if is_vid else 'photo',
                                'thumbnail': e_thumb or slide_url,
                                'url': slide_url,
                                'filename': fname,
                                'width': entry.get('width') or 1080,
                                'height': entry.get('height') or 1080
                            })

                        if carousel_media:
                            item_count = len(carousel_media)
                            if not thumbnail and carousel_media[0].get('thumbnail'):
                                thumbnail = carousel_media[0]['thumbnail']
                            if not playable_url and carousel_media[0]['media_type'] == 'video':
                                playable_url = carousel_media[0]['url']

                if platform == 'instagram' and not carousel_media and (media_type == 'carousel' or '/p/' in url or '/share/p/' in url):
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
            is_ig_auth_error = (
                'empty media response' in err_str.lower()
                or 'login' in err_str.lower()
                or 'private' in err_str.lower()
                or 'registered users' in err_str.lower()
            )
            # Instagram photo / carousel fallback if yt-dlp finds no video formats or fails (and not an auth error)
            if platform == 'instagram' and not is_ig_auth_error:
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

            if is_ig_auth_error:
                raise Exception("This Instagram post is private, age-restricted, or requires login to view.")

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

        if platform == 'youtube':
            yt_match = re.search(r'(?:youtube\.com/watch\?.*?v=|youtu\.be/)([A-Za-z0-9_-]{11})', url)
            if yt_match:
                url = f"https://www.youtube.com/watch?v={yt_match.group(1)}"

        if platform == 'instagram':
            url = normalize_instagram_url(url)

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

        if platform in ('envato', 'epidemic'):
            try:
                self._download_envato_audio(url, download_id, base_path, quality=quality, platform=platform)
            except Exception as e:
                err_str = str(e)
                err_type = 'cancelled' if 'cancelled' in err_str.lower() else 'unknown'
                self.progress_store.update(download_id, state='error', error=err_str, errorType=err_type)
            finally:
                with self.active_downloads_lock:
                    if download_id in self.active_downloads:
                        del self.active_downloads[download_id]
                self.progress_store.cleanup_old()
            return

        if platform in ('magnific', 'flaticon'):
            try:
                self._download_magnific_or_flaticon(url, download_id, base_path, quality=quality, platform=platform)
            except Exception as e:
                err_str = str(e)
                err_type = 'cancelled' if 'cancelled' in err_str.lower() else 'unknown'
                self.progress_store.update(download_id, state='error', error=err_str, errorType=err_type)
            finally:
                with self.active_downloads_lock:
                    if download_id in self.active_downloads:
                        del self.active_downloads[download_id]
                self.progress_store.cleanup_old()
            return

        if platform == 'spotify':
            try:
                self._download_spotify(url, download_id, base_path, quality=quality, item_index=item_index, as_zip=as_zip)
            except Exception as e:
                err_str = str(e)
                err_type = 'cancelled' if 'cancelled' in err_str.lower() else 'unknown'
                self.progress_store.update(download_id, state='error', error=err_str, errorType=err_type)
            finally:
                with self.active_downloads_lock:
                    if download_id in self.active_downloads:
                        del self.active_downloads[download_id]
                self.progress_store.cleanup_old()
            return

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

                stream_idx = len(seen_files)  # 1 for video/audio, 2 for second stream if video+audio

                downloaded = d.get('downloaded_bytes') or 0
                total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
                if total > 0:
                    raw_pct = (downloaded / total) * 100.0
                else:
                    pct_str = d.get('_percent_str', '0%').strip('\x1b[0;94m').strip('%')
                    try:
                        raw_pct = float(pct_str)
                    except ValueError:
                        raw_pct = 0.0

                if format_type == 'audio':
                    # Single audio stream: map 0..90%
                    mapped_pct = raw_pct * 0.90
                else:
                    # Video stream: 0..80%, audio stream: 80..92%
                    if stream_idx <= 1:
                        mapped_pct = raw_pct * 0.80
                    else:
                        mapped_pct = 80.0 + (raw_pct * 0.12)

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
                post_pct = 92.0 if format_type == 'audio' else 94.0
                if post_pct > max_seen_pct[0]:
                    max_seen_pct[0] = post_pct
                post_msg = 'Converting audio to MP3...' if format_type == 'audio' else 'Processing & muxing media...'
                self.progress_store.update(download_id, state='processing', progress=round(max_seen_pct[0], 1), speed=post_msg, filename=filename, filepath=filepath)
            elif status == 'error':
                self.progress_store.update(download_id, state='error', error='yt-dlp download error')

        def my_pp_hook(d):
            with self.active_downloads_lock:
                if self.active_downloads.get(download_id, {}).get('cancel'):
                    raise Exception("Download cancelled by user")

            pp_status = d.get('status')
            pp_name = str(d.get('postprocessor', ''))
            if pp_status == 'started':
                pp_msg = 'Converting audio to MP3...' if ('ExtractAudio' in pp_name or format_type == 'audio') else 'Muxing & finalizing video...'
                cur_pct = max(max_seen_pct[0], 92.0)
                max_seen_pct[0] = cur_pct
                self.progress_store.update(download_id, state='processing', progress=round(cur_pct, 1), speed=pp_msg)
            elif pp_status == 'finished':
                cur_pct = max(max_seen_pct[0], 98.0)
                max_seen_pct[0] = cur_pct
                self.progress_store.update(download_id, state='processing', progress=round(cur_pct, 1), speed='Finalizing media file...')

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
            'noplaylist': (platform == 'youtube'),
            'socket_timeout': 30,
            'retries': 10,
            'fragment_retries': 10,
            'file_access_retries': 3,
            'progress_hooks': [my_hook],
            'postprocessor_hooks': [my_pp_hook],
            'quiet': True,
            'no_warnings': True,
        }

        # Apply chunking exclusively to YouTube to bypass DASH rate-limiting without breaking HLS range requests on Pinterest/Instagram
        if platform == 'youtube':
            ydl_opts['http_chunk_size'] = 10485760

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
            # Video (MP4) - Prioritize progressive H.264 MP4, falling back to AVC+AAC muxing for editing software compatibility
            ydl_opts['merge_output_format'] = 'mp4'
            ydl_opts['format_sort'] = ['vcodec:h264', 'acodec:m4a', 'res', 'fps']
            if quality == '1080p':
                ydl_opts['format'] = (
                    'best[height<=1080][ext=mp4][protocol^=http]/'
                    'bestvideo[height<=1080][vcodec^=avc]+bestaudio[acodec^=mp4a]/'
                    'bestvideo[height<=1080][vcodec^=avc]+bestaudio/'
                    'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/'
                    'best[height<=1080][ext=mp4]/'
                    'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best'
                )
            elif quality == '720p':
                ydl_opts['format'] = (
                    'best[height<=720][ext=mp4][protocol^=http]/'
                    'bestvideo[height<=720][vcodec^=avc]+bestaudio[acodec^=mp4a]/'
                    'bestvideo[height<=720][vcodec^=avc]+bestaudio/'
                    'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/'
                    'best[height<=720][ext=mp4]/'
                    'bestvideo[height<=720]+bestaudio/best[height<=720]/best'
                )
            elif quality == '480p':
                ydl_opts['format'] = (
                    'best[height<=480][ext=mp4][protocol^=http]/'
                    'bestvideo[height<=480][vcodec^=avc]+bestaudio[acodec^=mp4a]/'
                    'bestvideo[height<=480][vcodec^=avc]+bestaudio/'
                    'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/'
                    'best[height<=480][ext=mp4]/'
                    'bestvideo[height<=480]+bestaudio/best[height<=480]/best'
                )
            elif quality == '360p':
                ydl_opts['format'] = (
                    'best[height<=360][ext=mp4][protocol^=http]/'
                    'bestvideo[height<=360][vcodec^=avc]+bestaudio[acodec^=mp4a]/'
                    'bestvideo[height<=360][vcodec^=avc]+bestaudio/'
                    'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/'
                    'best[height<=360][ext=mp4]/'
                    'bestvideo[height<=360]+bestaudio/best[height<=360]/best'
                )
            else:
                # 'best' (Highest Quality available with progressive MP4 preference)
                ydl_opts['format'] = (
                    'best[ext=mp4][protocol^=http]/'
                    'bestvideo[vcodec^=avc]+bestaudio[acodec^=mp4a]/'
                    'bestvideo[vcodec^=avc]+bestaudio/'
                    'bestvideo[ext=mp4]+bestaudio[ext=m4a]/'
                    'best[ext=mp4]/'
                    'bestvideo+bestaudio/best'
                )

        import shutil
        node_path = shutil.which('node')
        if node_path:
            ydl_opts['js_runtimes'] = {'node': {'path': node_path}}

        is_valid, _, platform = validate_media_url(url)
        if platform == 'instagram':
            cookie_file = self.config.get_cookie_file_path('instagram')
            if cookie_file and os.path.exists(cookie_file):
                safe_cookie_file = os.path.join(job_temp_dir, 'cookies.txt')
                try:
                    shutil.copyfile(cookie_file, safe_cookie_file)
                    ydl_opts['cookiefile'] = safe_cookie_file
                except Exception:
                    ydl_opts['cookiefile'] = cookie_file
            elif self.config.get('use_browser_cookies'):
                browser = self.config.get('browser_for_cookies')
                if browser:
                    ydl_opts['cookiesfrombrowser'] = (browser,)

        try:
            self.progress_store.update(download_id, state='extracting', progress=5.0, speed='Fetching stream info...')
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                
                filepath = ydl.prepare_filename(info)
                # If audio postprocessing was applied, file extension will be .mp3
                if format_type == 'audio':
                    base_no_ext, _ = os.path.splitext(filepath)
                    mp3_filepath = base_no_ext + '.mp3'
                    if os.path.exists(mp3_filepath):
                        filepath = mp3_filepath

                MEDIA_EXTS = ('.mp4', '.mkv', '.webm', '.mov', '.avi', '.mp3', '.m4a', '.aac', '.wav', '.flac', '.jpg', '.jpeg', '.png', '.webp')
                all_candidates = [
                    os.path.join(job_temp_dir, f) for f in os.listdir(job_temp_dir)
                    if not f.endswith('.part') and not f.endswith('.ytdl') and not f.startswith('.') and not f.endswith('.txt') and not f.endswith('.temp') and os.path.isfile(os.path.join(job_temp_dir, f))
                ]
                all_candidates = [f for f in all_candidates if os.path.splitext(f)[1].lower() in MEDIA_EXTS]

                if not all_candidates and os.path.exists(filepath):
                    all_candidates = [filepath]

                # Ensure H.264 compatibility for all mp4 videos
                if format_type != 'audio':
                    ensured_candidates = []
                    for cand in all_candidates:
                        if cand.lower().endswith('.mp4'):
                            try:
                                cand = self._ensure_h264_compatible(cand, ffmpeg_dir, platform=platform, download_id=download_id)
                            except Exception:
                                pass
                        ensured_candidates.append(cand)
                    all_candidates = ensured_candidates

                if len(all_candidates) > 1 and as_zip:
                    import zipfile
                    self.progress_store.update(download_id, state='processing', progress=95.0, speed='Packaging ZIP archive...')
                    raw_title = info.get('title') or 'album'
                    safe_title = re.sub(r'[<>:"/\\|?*]', '_', raw_title)[:60].strip() or 'album'
                    zip_filename = f"{safe_title}.zip"
                    target_zip_path = os.path.join(base_path, zip_filename)
                    zc = 1
                    while os.path.exists(target_zip_path):
                        zip_filename = f"{safe_title} ({zc}).zip"
                        target_zip_path = os.path.join(base_path, zip_filename)
                        zc += 1

                    with zipfile.ZipFile(target_zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                        for cand in sorted(all_candidates):
                            zf.write(cand, os.path.basename(cand))

                    self.progress_store.update(
                        download_id,
                        state='complete',
                        progress=100.0,
                        filepath=target_zip_path,
                        filename=zip_filename,
                        files=[zip_filename]
                    )
                    return

                if len(all_candidates) > 1 and not as_zip:
                    import shutil
                    moved_files = []
                    for cand in sorted(all_candidates):
                        cand_name = os.path.basename(cand)
                        target_cand = os.path.join(base_path, cand_name)
                        base_n, ext_n = os.path.splitext(cand_name)
                        c = 1
                        while os.path.exists(target_cand):
                            cand_name = f"{base_n} ({c}){ext_n}"
                            target_cand = os.path.join(base_path, cand_name)
                            c += 1
                        shutil.move(cand, target_cand)
                        moved_files.append((target_cand, cand_name))

                    self.progress_store.update(
                        download_id,
                        state='complete',
                        progress=100.0,
                        filepath=moved_files[0][0],
                        filename=moved_files[0][1],
                        files=[f[1] for f in moved_files]
                    )
                    return

                # Single file candidate
                if all_candidates:
                    filepath = all_candidates[0]

                if os.path.exists(filepath):
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

            # Check if YouTube encountered bot block or "The page needs to be reloaded" or read timeout
            if ('youtube.' in url.lower() or 'youtu.be' in url.lower()) and any(x in err_str.lower() for x in ['page needs to be reloaded', 'confirm you’re not a bot', 'confirm you are not a bot', 'sign in to confirm', 'timed out', 'read operation timed out']):
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
                                filepath = self._ensure_h264_compatible(filepath, ffmpeg_dir, platform=platform, download_id=download_id)
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

            # Check if this error from yt-dlp was due to authentication / private content / empty response
            is_ig_auth_error = False
            if 'instagram.' in url.lower() or 'instagr.am' in url.lower():
                err_lower = err_str.lower()
                if (
                    'empty media response' in err_lower
                    or 'login' in err_lower
                    or 'private' in err_lower
                    or 'registered users' in err_lower
                    or 'checkpoint' in err_lower
                    or 'rate-limit' in err_lower
                    or 'requires authentication' in err_lower
                ):
                    is_ig_auth_error = True

            # Check if this is an Instagram photo, carousel, or post where yt-dlp finds no video formats or fails
            # Skip fallback if yt-dlp already flagged that the post requires login or sent an empty media response
            if ('instagram.' in url.lower() or 'instagr.am' in url.lower()) and not is_ig_auth_error:
                try:
                    self._download_instagram_photo_or_carousel(url, download_id, base_path, item_index=item_index, as_zip=as_zip)
                    return
                except Exception as ig_err:
                    ig_err_str = str(ig_err)
                    if 'private' in ig_err_str.lower() or 'login' in ig_err_str.lower():
                        err_str = ig_err_str
                        is_ig_auth_error = True
                    else:
                        err_str = f"Instagram download failed: {ig_err_str}"

            # Check if this is a Pinterest image pin where yt-dlp finds no video formats
            if 'pinterest.' in url.lower() and ('no video' in err_str.lower() or 'unable to extract' in err_str.lower() or 'no media' in err_str.lower()):
                try:
                    self._download_pinterest_image(url, download_id, base_path)
                    return
                except Exception as img_err:
                    err_str = f"Pinterest image download failed: {str(img_err)}"

            error_type = 'unknown'
            if is_ig_auth_error or 'login' in err_str.lower() or 'private' in err_str.lower() or '401' in err_str or 'sign in' in err_str.lower():
                error_type = 'private_content'
                has_session = False
                cookie_file = self.config.get_cookie_file_path('instagram')
                if cookie_file and os.path.exists(cookie_file):
                    try:
                        with open(cookie_file, 'r', encoding='utf-8', errors='ignore') as f:
                            if 'sessionid' in f.read():
                                has_session = True
                    except Exception:
                        pass
                if has_session:
                    err_str = "This Instagram post is private or restricted. Your saved session does not have access (or has expired). Please verify access in your browser."
                else:
                    err_str = "This Instagram post is private, age-restricted, or requires login. Please log in to Instagram in your browser and use the InstaGrab Extension to download it."
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

    def _ensure_h264_compatible(self, filepath: str, ffmpeg_dir: str = None, platform: str = None, download_id: str = None) -> str:
        """Verifies the output video uses clean, editor-friendly H.264 (CFR, 1:1 square SAR, closed GOP, no B-pyramid).
        Prevents pixel mosaic, macroblocking, green/purple frames, and stretching in Adobe After Effects & Premiere Pro."""
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

        temp_fixed = None
        try:
            probe_cmd = [ffprobe_bin, '-v', 'error', '-show_entries', 'stream=codec_name,codec_type,width,height,sample_aspect_ratio,has_b_frames', '-of', 'json', filepath]
            probe_res = subprocess.check_output(probe_cmd, startupinfo=si, creationflags=creationflags, timeout=15)
            data = json.loads(probe_res.decode('utf-8'))
            streams = data.get('streams', [])
            v_stream = next((s for s in streams if s.get('codec_type') == 'video'), {})
            a_stream = next((s for s in streams if s.get('codec_type') == 'audio'), None)
            v_codec = v_stream.get('codec_name', '').lower()
            width = v_stream.get('width')
            height = v_stream.get('height')
            sar = v_stream.get('sample_aspect_ratio')
            has_b_frames = v_stream.get('has_b_frames', 0)
            is_non_square_sar = bool(sar and sar not in ('1:1', '0:1', '1/1', '0/1'))

            needs_stabilization = False
            # 1. Non-H.264 formats (VP9, VP8, AV1, HEVC)
            if v_codec in ('vp9', 'vp8', 'av1', 'av01', 'hevc', 'h265'):
                needs_stabilization = True
            # 2. Anamorphic non-square pixels that stretch in After Effects
            elif is_non_square_sar and width and height:
                needs_stabilization = True
            # 3. YouTube DASH video streams (contain open GOPs, 250-frame keyframe intervals, and B-pyramid references that crash After Effects' decoder)
            elif platform == 'youtube' or (v_codec == 'h264' and has_b_frames and has_b_frames >= 2):
                needs_stabilization = True

            if needs_stabilization:
                if download_id:
                    self.progress_store.update(download_id, state='processing', progress=95.0, speed='Optimizing for After Effects & Premiere...')

                temp_fixed = filepath + '.ae_fixed.mp4'
                vf_filters = 'setsar=1,setpts=PTS-STARTPTS'
                audio_args = ['-af', 'asetpts=PTS-STARTPTS,aresample=async=1', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000'] if a_stream else ['-an']

                # Attempt hardware acceleration for ultra-fast transcode (AMD AMF, NVIDIA NVENC, Intel QSV)
                # Fall back to libx264 if hardware encoder unavailable
                enc_candidates = [
                    # 1. AMD AMF (e.g. Radeon RX 7800 XT)
                    [
                        ffmpeg_bin, '-y', '-i', filepath,
                        '-vf', vf_filters,
                        *audio_args,
                        '-c:v', 'h264_amf', '-usage', 'transcoding', '-quality', 'quality', '-b:v', '18M', '-maxrate', '25M',
                        '-g', '60', '-bf', '0', '-pix_fmt', 'yuv420p',
                        '-fps_mode', 'cfr', '-avoid_negative_ts', 'make_zero',
                        '-movflags', '+faststart',
                        temp_fixed
                    ],
                    # 2. NVIDIA NVENC
                    [
                        ffmpeg_bin, '-y', '-i', filepath,
                        '-vf', vf_filters,
                        *audio_args,
                        '-c:v', 'h264_nvenc', '-preset', 'p5', '-cq', '17',
                        '-g', '60', '-bf', '0', '-pix_fmt', 'yuv420p',
                        '-fps_mode', 'cfr', '-avoid_negative_ts', 'make_zero',
                        '-movflags', '+faststart',
                        temp_fixed
                    ],
                    # 3. Intel QSV
                    [
                        ffmpeg_bin, '-y', '-i', filepath,
                        '-vf', vf_filters,
                        *audio_args,
                        '-c:v', 'h264_qsv', '-global_quality', '17',
                        '-g', '60', '-bf', '0', '-pix_fmt', 'yuv420p',
                        '-fps_mode', 'cfr', '-avoid_negative_ts', 'make_zero',
                        '-movflags', '+faststart',
                        temp_fixed
                    ],
                    # 4. CPU libx264 (Universal fallback)
                    [
                        ffmpeg_bin, '-y', '-i', filepath,
                        '-vf', vf_filters,
                        *audio_args,
                        '-c:v', 'libx264', '-crf', '17', '-preset', 'veryfast',
                        '-g', '60', '-keyint_min', '60', '-bf', '0', '-pix_fmt', 'yuv420p',
                        '-fps_mode', 'cfr', '-avoid_negative_ts', 'make_zero',
                        '-movflags', '+faststart',
                        temp_fixed
                    ]
                ]

                transcode_ok = False
                for cmd in enc_candidates:
                    try:
                        res = subprocess.run(cmd, startupinfo=si, creationflags=creationflags, capture_output=True, timeout=300)
                        if res.returncode == 0 and os.path.exists(temp_fixed) and os.path.getsize(temp_fixed) > 0:
                            transcode_ok = True
                            break
                    except Exception:
                        continue

                if transcode_ok:
                    try:
                        os.replace(temp_fixed, filepath)
                    except Exception:
                        import shutil
                        try:
                            os.remove(filepath)
                            shutil.move(temp_fixed, filepath)
                        except Exception:
                            filepath = temp_fixed
                else:
                    if os.path.exists(temp_fixed):
                        try:
                            os.remove(temp_fixed)
                        except Exception:
                            pass
        except Exception:
            pass
        finally:
            if temp_fixed and os.path.exists(temp_fixed) and temp_fixed != filepath:
                try:
                    os.remove(temp_fixed)
                except Exception:
                    pass

        return filepath



    def _fetch_instagram_post_info(self, url: str) -> dict:
        import urllib.request
        import http.cookiejar
        import json
        import re

        url = normalize_instagram_url(url)

        # First attempt: Try extracting full playlist / post entries via yt-dlp with noplaylist=False
        ydl_opts = {
            'skip_download': True,
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'noplaylist': False,
        }
        ffmpeg_dir = get_ffmpeg_dir()
        if ffmpeg_dir:
            ydl_opts['ffmpeg_location'] = ffmpeg_dir
        import shutil
        node_path = shutil.which('node')
        if node_path:
            ydl_opts['js_runtimes'] = {'node': {'path': node_path}}

        cookie_file = self.config.get_cookie_file_path('instagram')
        if cookie_file and os.path.exists(cookie_file):
            ydl_opts['cookiefile'] = cookie_file
        elif self.config.get('use_browser_cookies'):
            browser = self.config.get('browser_for_cookies')
            if browser:
                ydl_opts['cookiesfrombrowser'] = (browser,)

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if info:
                    title = info.get('title') or ''
                    safe_title = re.sub(r'[<>:"/\\|?*]', '_', title)[:60].strip() or 'instagram_media'
                    uploader = info.get('uploader') or info.get('channel') or 'Instagram'
                    targets = []
                    carousel_media = []

                    entries = [e for e in (info.get('entries') or []) if e]
                    if entries:
                        for idx, entry in enumerate(entries):
                            e_formats = entry.get('formats') or []
                            v_formats = [f for f in e_formats if f.get('vcodec') != 'none' and f.get('acodec') != 'none' and f.get('url')]
                            if not v_formats:
                                v_formats = [f for f in e_formats if f.get('url') and f.get('ext') == 'mp4']
                            if not v_formats:
                                v_formats = [f for f in e_formats if f.get('url')]

                            is_vid = bool(v_formats)
                            v_url = v_formats[0].get('url') if is_vid else None

                            e_thumb = None
                            if entry.get('thumbnails'):
                                e_thumb = entry['thumbnails'][-1].get('url') or entry['thumbnails'][0].get('url')
                            elif entry.get('thumbnail'):
                                e_thumb = entry.get('thumbnail')

                            media_url = v_url if is_vid else (e_thumb or entry.get('url'))
                            if not media_url:
                                continue

                            fname = f"{safe_title}_{idx+1}.{'mp4' if is_vid else 'jpg'}"
                            targets.append((media_url, is_vid, fname, e_thumb or media_url))
                            carousel_media.append({
                                'index': idx + 1,
                                'media_type': 'video' if is_vid else 'photo',
                                'thumbnail': e_thumb or media_url,
                                'url': media_url,
                                'filename': fname,
                                'width': entry.get('width') or 1080,
                                'height': entry.get('height') or 1080
                            })
                        if targets:
                            return {
                                'title': title,
                                'thumbnail': targets[0][3] if len(targets[0]) > 3 else targets[0][0],
                                'duration': info.get('duration', 0),
                                'uploader': uploader,
                                'platform': 'instagram',
                                'playable_url': targets[0][0] if targets[0][1] else None,
                                'media_type': 'carousel' if len(targets) > 1 else ('video' if targets[0][1] else 'photo'),
                                'targets': targets,
                                'carousel_media': carousel_media,
                                'item_count': len(targets)
                            }
                    else:
                        formats = info.get('formats') or []
                        v_formats = [f for f in formats if f.get('vcodec') != 'none' and f.get('acodec') != 'none' and f.get('url')]
                        if not v_formats:
                            v_formats = [f for f in formats if f.get('url') and f.get('ext') == 'mp4']
                        if not v_formats:
                            v_formats = [f for f in formats if f.get('url')]

                        is_vid = bool(v_formats)
                        v_url = v_formats[0].get('url') if is_vid else None
                        thumb = None
                        if info.get('thumbnails'):
                            thumb = info['thumbnails'][-1].get('url') or info['thumbnails'][0].get('url')
                        elif info.get('thumbnail'):
                            thumb = info.get('thumbnail')

                        media_url = v_url if is_vid else (thumb or info.get('url'))
                        if media_url:
                            fname = f"{safe_title}.{'mp4' if is_vid else 'jpg'}"
                            targets = [(media_url, is_vid, fname, thumb or media_url)]
                            return {
                                'title': title,
                                'thumbnail': thumb or media_url,
                                'duration': info.get('duration', 0),
                                'uploader': uploader,
                                'platform': 'instagram',
                                'playable_url': v_url,
                                'media_type': 'video' if is_vid else 'photo',
                                'targets': targets,
                                'carousel_media': [],
                                'item_count': 1
                            }
        except Exception:
            pass

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
                    if 'httpErrorPage' in html or 'PolarisErrorRoot' in html or 'login' in html or 'checkpoint' in html:
                        raise Exception("This Instagram post is private, age-restricted, or requires login to view.")
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

        self.progress_store.update(download_id, state='downloading', progress=20.0, filename=targets[0][2])

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Referer': 'https://www.instagram.com/'
        }

        cookie_file = self.config.get_cookie_file_path('instagram')
        if cookie_file and os.path.exists(cookie_file):
            try:
                import http.cookiejar
                cj = http.cookiejar.MozillaCookieJar(cookie_file)
                cj.load(ignore_discard=True, ignore_expires=True)
                opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
            except Exception:
                opener = urllib.request.build_opener()
        else:
            opener = urllib.request.build_opener()

        saved_files = []
        ffmpeg_dir = get_ffmpeg_dir()

        for i, target in enumerate(targets):
            with self.active_downloads_lock:
                if self.active_downloads.get(download_id, {}).get('cancel'):
                    raise Exception("Download cancelled by user")

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
            with opener.open(req, timeout=30) as resp:
                with open(target_file, 'wb') as out_f:
                    out_f.write(resp.read())

            if is_vid and target_file.lower().endswith('.mp4'):
                try:
                    target_file = self._ensure_h264_compatible(target_file, ffmpeg_dir, platform='instagram', download_id=download_id)
                    fname = os.path.basename(target_file)
                except Exception:
                    pass

            saved_files.append((target_file, fname))
            pct = 20.0 + (70.0 * (i + 1) / len(targets))
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

    def _extract_envato_info(self, url: str) -> dict:
        import urllib.request
        import urllib.parse
        import html as html_lib

        parsed = urllib.parse.urlparse(url)
        netloc = parsed.netloc.lower()

        # 1. Direct envatousercontent.com audio stream URL
        if 'envatousercontent.com' in netloc:
            qs = urllib.parse.parse_qs(parsed.query)
            custom_title = qs.get('instagrab_title', [None])[0]
            custom_artist = qs.get('instagrab_artist', [None])[0]
            clean_audio_url = urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path, '', '', ''))
            file_id_match = re.search(r'/files/(\d+)/', parsed.path)
            fallback_id = file_id_match.group(1) if file_id_match else 'Track'
            title = custom_title or f"Envato Audio {fallback_id}"
            return {
                'title': title,
                'thumbnail': '',
                'duration': 0,
                'uploader': custom_artist or 'Envato Elements',
                'platform': 'envato',
                'playable_url': clean_audio_url,
                'media_type': 'audio',
                'carousel_media': [],
                'item_count': 1,
            }

        # 2. Envato Elements / AudioJungle item page
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            page_html = resp.read().decode('utf-8', errors='ignore')

        player_audio_url = None
        ld_audio_url = None
        title = None
        uploader = None
        duration = 0
        thumbnail = ''

        # A. Extract the Play Button <audio data-testid="audio-element"> stream FIRST
        # (This is the clean audio that plays when clicking the green Play button, NOT the watermarked "Download preview" file)
        first_audio_tag = re.search(r'<audio[^>]*data-testid=["\']audio-element["\'][^>]*>(.*?)</audio>', page_html, re.DOTALL | re.IGNORECASE)
        if not first_audio_tag:
            first_audio_tag = re.search(r'<audio[^>]*>(.*?)</audio>', page_html, re.DOTALL | re.IGNORECASE)

        if first_audio_tag:
            audio_inner = first_audio_tag.group(1)
            mp3_src = re.search(r'<source[^>]*src=["\'](https://[^"\']+\.mp3)["\']', audio_inner, re.IGNORECASE)
            m4a_src = re.search(r'<source[^>]*src=["\'](https://[^"\']+\.m4a)["\']', audio_inner, re.IGNORECASE)
            if mp3_src:
                player_audio_url = mp3_src.group(1)
            elif m4a_src:
                player_audio_url = m4a_src.group(1)

        if not player_audio_url:
            pub_mp3 = re.search(
                r'https://public-assets\.content-platform\.envatousercontent\.com/[^"\'\s<>]+/preview\.mp3',
                page_html
            )
            if not pub_mp3:
                pub_mp3 = re.search(
                    r'https://public-assets\.content-platform\.envatousercontent\.com/[^"\'\s<>]+/preview\.m4a',
                    page_html
                )
            if pub_mp3:
                player_audio_url = pub_mp3.group(0)

        # B. Parse JSON-LD structured data (@graph with AudioObject / MusicRecording / Person) for title, duration, uploader
        ld_blocks = re.findall(
            r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
            page_html,
            re.DOTALL | re.IGNORECASE
        )
        for block in ld_blocks:
            try:
                data = json.loads(block.strip())
                nodes = []
                if isinstance(data, dict):
                    if '@graph' in data and isinstance(data['@graph'], list):
                        nodes.extend(data['@graph'])
                    else:
                        nodes.append(data)
                elif isinstance(data, list):
                    nodes.extend(data)

                for node in nodes:
                    if not isinstance(node, dict):
                        continue
                    node_type = node.get('@type')
                    if node_type == 'AudioObject':
                        if node.get('contentUrl') and not ld_audio_url:
                            ld_audio_url = node.get('contentUrl')
                        if node.get('name') and not title:
                            title = node.get('name')
                        dur_str = node.get('duration')
                        if dur_str and not duration:
                            dur_m = re.match(r'^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$', str(dur_str))
                            if dur_m:
                                duration = int(dur_m.group(1) or 0) * 3600 + int(dur_m.group(2) or 0) * 60 + int(float(dur_m.group(3) or 0))
                    elif node_type == 'MusicRecording':
                        if node.get('name') and not title:
                            title = node.get('name')
                        dur_str = node.get('duration')
                        if dur_str and not duration:
                            dur_m = re.match(r'^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$', str(dur_str))
                            if dur_m:
                                duration = int(dur_m.group(1) or 0) * 3600 + int(dur_m.group(2) or 0) * 60 + int(float(dur_m.group(3) or 0))
                        audio_obj = node.get('audio')
                        if isinstance(audio_obj, dict) and audio_obj.get('contentUrl') and not ld_audio_url:
                            ld_audio_url = audio_obj.get('contentUrl')
                    elif node_type == 'Person':
                        if node.get('name') and not uploader:
                            uploader = node.get('name')
            except Exception:
                continue

        # Prefer the Play Button stream (player_audio_url) over JSON-LD's watermarked "Download preview" stream
        audio_url = player_audio_url or ld_audio_url

        if not audio_url:
            mp3_match = re.search(
                r'https://[^"\'\s<>]*envatousercontent\.com/[^"\'\s<>]+\.(?:mp3|m4a)',
                page_html
            )
            if mp3_match:
                audio_url = mp3_match.group(0)

        if not audio_url:
            raise Exception("No audio stream found on this Envato page. Please make sure the URL is a valid Envato Audio or Sound Effect track.")

        # Extract OpenGraph image and fallback title if needed
        og_img = re.search(r'<meta\s+(?:property|name)=["\']og:image["\']\s+content=["\']([^"\']+)["\']', page_html, re.IGNORECASE)
        if og_img:
            thumbnail = html_lib.unescape(og_img.group(1))

        if not title:
            og_title = re.search(r'<meta\s+(?:property|name)=["\']og:title["\']\s+content=["\']([^"\']+)["\']', page_html, re.IGNORECASE)
            if og_title:
                title = html_lib.unescape(og_title.group(1))
                title = re.sub(r'\s+by\s+[^|,-]+(?:on\s+Envato\s+Elements|-\s*Envato\s+Elements).*$', '', title, flags=re.IGNORECASE).strip()
                title = re.sub(r'\s*[|-]\s*(?:Royalty-Free\s+Music|Sound\s+Effects|Envato\s+Elements|AudioJungle).*$', '', title, flags=re.IGNORECASE).strip()

        if not title:
            slug_match = re.search(r'/([a-zA-Z0-9-]+)-[A-Za-z0-9]{6,10}/?$', parsed.path)
            if slug_match:
                title = slug_match.group(1).replace('-', ' ').title()
            else:
                title = "Envato Audio Track"
        else:
            title = html_lib.unescape(title).strip()

        return {
            'title': title,
            'thumbnail': thumbnail,
            'duration': duration,
            'uploader': uploader or 'Envato Elements',
            'platform': 'envato',
            'playable_url': audio_url,
            'media_type': 'audio',
            'carousel_media': [],
            'item_count': 1,
        }

    def _extract_epidemic_info(self, url: str) -> dict:
        import urllib.request
        import urllib.parse
        import html as html_lib

        parsed = urllib.parse.urlparse(url)
        netloc = parsed.netloc.lower()

        # 1. Direct audiocdn.epidemicsound.com audio stream URL
        qs = urllib.parse.parse_qs(parsed.query)
        custom_title = qs.get('instagrab_title', [None])[0]
        custom_artist = qs.get('instagrab_artist', [None])[0]
        search_term = custom_title or qs.get('term', [None])[0]

        if 'audiocdn.epidemicsound.com' in netloc:
            clean_audio_url = urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path, '', '', ''))
            fname = os.path.splitext(os.path.basename(parsed.path))[0] or 'Track'
            return {
                'title': custom_title or f"Epidemic Sound {fname}",
                'thumbnail': '',
                'duration': 0,
                'uploader': custom_artist or 'Epidemic Sound',
                'platform': 'epidemic',
                'playable_url': clean_audio_url,
                'media_type': 'audio',
                'carousel_media': [],
                'item_count': 1,
            }

        def _search_epidemic_json_api(term_str: str, prefer_sfx: bool = True):
            if not term_str:
                return None
            endpoints = ['sfx', 'tracks'] if prefer_sfx else ['tracks', 'sfx']
            hdrs = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            }
            for ep in endpoints:
                try:
                    api_u = f"https://www.epidemicsound.com/json/search/{ep}/?term={urllib.parse.quote(term_str.strip())}&limit=10"
                    req_api = urllib.request.Request(api_u, headers=hdrs)
                    with urllib.request.urlopen(req_api, timeout=12) as r_api:
                        api_data = json.loads(r_api.read().decode('utf-8', errors='ignore'))
                    tracks_dict = (api_data.get('entities') or {}).get('tracks') or {}
                    tracks_list = list(tracks_dict.values())
                    if not tracks_list:
                        continue
                    exact = next(
                        (t for t in tracks_list if (t.get('title') or '').strip().lower() == term_str.strip().lower() and ((t.get('stems') or {}).get('full') or {}).get('lqMp3Url')),
                        None
                    )
                    chosen = exact or next((t for t in tracks_list if ((t.get('stems') or {}).get('full') or {}).get('lqMp3Url')), None)
                    if chosen:
                        mp3_u = chosen['stems']['full']['lqMp3Url']
                        dur_sec = max(1, int(round((chosen.get('durationMs') or 0) / 1000.0))) if chosen.get('durationMs') else (chosen.get('length') or 0)
                        thumb_u = chosen.get('cover') or chosen.get('imageUrl') or ''
                        main_artists = (chosen.get('creatives') or {}).get('mainArtists') or []
                        artist_name = 'Epidemic Sound'
                        if main_artists:
                            first_a = main_artists[0]
                            artist_name = first_a.get('name') if isinstance(first_a, dict) else str(first_a)
                        return {
                            'title': chosen.get('title') or term_str,
                            'thumbnail': thumb_u,
                            'duration': dur_sec,
                            'uploader': artist_name or 'Epidemic Sound',
                            'platform': 'epidemic',
                            'playable_url': mp3_u,
                            'media_type': 'audio',
                            'carousel_media': [],
                            'item_count': 1,
                        }
                except Exception:
                    continue
            return None

        # 1B. Epidemic Sound Search / List Row query (e.g. from /sound-effects/search?term=pop)
        track_id_match = re.search(r'/(?:music/tracks|sound-effects/tracks|track)/([^/?#]+)', parsed.path)
        if not track_id_match and search_term:
            prefer_sfx = ('sound-effects' in parsed.path.lower()) or (qs.get('instagrab_sfx', ['0'])[0] == '1')
            api_res = _search_epidemic_json_api(search_term, prefer_sfx=prefer_sfx)
            if api_res:
                return api_res

        # 2. Epidemic Sound Music or SFX Track Page
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            page_html = resp.read().decode('utf-8', errors='ignore')

        title = custom_title
        uploader = custom_artist
        duration = 0
        thumbnail = ''
        audio_url = None

        # Parse JSON-LD (WebPage -> mainEntity -> AudioObject / MusicRecording)
        ld_blocks = re.findall(
            r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
            page_html,
            re.DOTALL | re.IGNORECASE
        )
        for block in ld_blocks:
            try:
                data = json.loads(block.strip())
                if isinstance(data, dict):
                    main_ent = data.get('mainEntity') if isinstance(data.get('mainEntity'), dict) else data
                    if main_ent.get('name') and not title:
                        title = main_ent.get('name')
                    dur_str = main_ent.get('duration')
                    if dur_str and not duration:
                        dur_m = re.match(r'^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$', str(dur_str))
                        if dur_m:
                            duration = int(dur_m.group(1) or 0) * 3600 + int(dur_m.group(2) or 0) * 60 + int(float(dur_m.group(3) or 0))
                    by_artist = main_ent.get('byArtist')
                    if isinstance(by_artist, list) and by_artist and isinstance(by_artist[0], dict):
                        uploader = by_artist[0].get('name')
                    elif isinstance(by_artist, dict):
                        uploader = by_artist.get('name')
            except Exception:
                continue

        # Match the specific track's kosmosId / pathname in Next.js flight data first
        if track_id_match:
            track_id = track_id_match.group(1)
            idx = page_html.find(track_id)
            while idx != -1:
                window = page_html[idx:idx + 2500]
                mp3_m = re.search(r'https://audiocdn\.epidemicsound\.com/[^"\'\s\\]+\.mp3', window)
                if mp3_m:
                    audio_url = mp3_m.group(0)
                    break
                idx = page_html.find(track_id, idx + 1)

        if not audio_url:
            mp3_m = re.search(r'https://audiocdn\.epidemicsound\.com/[^"\'\s\\]+\.mp3', page_html)
            if mp3_m:
                audio_url = mp3_m.group(0)

        if not audio_url and (title or search_term):
            prefer_sfx = 'sound-effects' in parsed.path.lower()
            api_res = _search_epidemic_json_api(title or search_term, prefer_sfx=prefer_sfx)
            if api_res:
                return api_res

        if not audio_url:
            raise Exception("No audio stream found on this Epidemic Sound page. Please provide a valid Epidemic Sound Music or SFX track link.")

        # Extract cover / artwork image
        og_img = re.search(r'<meta\s+(?:property|name)=["\']og:image["\']\s+content=["\']([^"\']+)["\']', page_html, re.IGNORECASE)
        if og_img:
            thumbnail = html_lib.unescape(og_img.group(1))
        if not thumbnail:
            cover_m = re.search(r'https://(?:cdn\.epidemicsound\.com/release-cover-images|images\.ctfassets\.net)/[^"\'\s<>]+', page_html)
            if cover_m:
                thumbnail = html_lib.unescape(cover_m.group(0))

        if not title:
            h1_m = re.search(r'<h1[^>]*>(.*?)</h1>', page_html, re.DOTALL | re.IGNORECASE)
            if h1_m:
                title = re.sub(r'<[^>]+>', '', h1_m.group(1)).strip()

        title = html_lib.unescape(title or 'Epidemic Sound Track').strip()

        return {
            'title': title,
            'thumbnail': thumbnail,
            'duration': duration,
            'uploader': uploader or 'Epidemic Sound',
            'platform': 'epidemic',
            'playable_url': audio_url,
            'media_type': 'audio',
            'carousel_media': [],
            'item_count': 1,
        }

    def _download_envato_audio(self, url: str, download_id: str, base_path: str, quality: str = 'best', platform: str = 'envato'):
        import urllib.request
        import shutil

        label = 'Epidemic Sound' if platform == 'epidemic' else 'Envato'
        self.progress_store.update(download_id, state='extracting', progress=8.0, speed=f'Extracting {label} audio info...')
        info = self._extract_epidemic_info(url) if platform == 'epidemic' else self._extract_envato_info(url)
        audio_url = info.get('playable_url')
        if not audio_url:
            raise Exception(f"Could not locate audio stream for this {label} item.")

        raw_title = info.get('title') or f"{label}_Audio"
        uploader = info.get('uploader') or label
        safe_title = re.sub(r'[<>:"/\\|?*]', '_', raw_title)
        safe_title = re.sub(r'[\x00-\x1f]', '', safe_title).strip()
        safe_title = re.sub(r'\s+', ' ', safe_title)[:100] or f"{label}_Audio"

        job_temp_dir = os.path.join(base_path, '.tmp', download_id)
        os.makedirs(job_temp_dir, exist_ok=True)

        is_m4a = '.m4a' in audio_url.lower()
        raw_ext = '.m4a' if is_m4a else '.mp3'
        temp_raw_path = os.path.join(job_temp_dir, f"{safe_title}_raw{raw_ext}")
        temp_final_path = os.path.join(job_temp_dir, f"{safe_title}.mp3")

        try:
            referer = 'https://www.epidemicsound.com/' if platform == 'epidemic' else 'https://elements.envato.com/'
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Referer': referer,
            }
            req = urllib.request.Request(audio_url, headers=headers)
            start_t = time.time()
            downloaded = 0

            with urllib.request.urlopen(req, timeout=30) as resp:
                total_bytes = int(resp.headers.get('Content-Length') or 0)
                with open(temp_raw_path, 'wb') as out_f:
                    while True:
                        with self.active_downloads_lock:
                            if self.active_downloads.get(download_id, {}).get('cancel'):
                                raise Exception("Download cancelled by user")

                        chunk = resp.read(32768)
                        if not chunk:
                            break
                        out_f.write(chunk)
                        downloaded += len(chunk)

                        elapsed = max(time.time() - start_t, 0.05)
                        bps = downloaded / elapsed
                        if bps >= 1048576:
                            speed_str = f"{bps / 1048576:.1f} MB/s"
                        else:
                            speed_str = f"{bps / 1024:.0f} KB/s"

                        if total_bytes > 0:
                            pct = 15.0 + (downloaded / total_bytes) * 75.0
                        else:
                            pct = min(88.0, 15.0 + (downloaded / 500000.0) * 50.0)

                        self.progress_store.update(
                            download_id,
                            state='downloading',
                            progress=round(min(pct, 90.0), 1),
                            speed=speed_str,
                            filename=f"{safe_title}.mp3"
                        )

            if not os.path.exists(temp_raw_path) or os.path.getsize(temp_raw_path) == 0:
                raise Exception(f"The downloaded {label} audio file is empty.")

            self.progress_store.update(
                download_id,
                state='processing',
                progress=94.0,
                speed='Finalizing MP3 audio...',
                filename=f"{safe_title}.mp3"
            )

            ffmpeg_dir = get_ffmpeg_dir()
            ffmpeg_bin = 'ffmpeg'
            if ffmpeg_dir and os.path.exists(os.path.join(ffmpeg_dir, 'ffmpeg.exe')):
                ffmpeg_bin = os.path.join(ffmpeg_dir, 'ffmpeg.exe')

            si = None
            creationflags = 0
            if sys.platform == 'win32':
                si = subprocess.STARTUPINFO()
                si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                si.wShowWindow = 0
                creationflags = subprocess.CREATE_NO_WINDOW

            # Transcode if input is .m4a or specific lower bitrate requested; otherwise lossless copy with ID3 tags
            needs_reencode = is_m4a or quality in ('128k', '192k')
            bitrate_arg = quality if quality in ('128k', '192k', '320k') else '320k'
            codec_args = ['-c:a', 'libmp3lame', '-b:a', bitrate_arg] if needs_reencode else ['-c:a', 'copy']

            cmd = [
                ffmpeg_bin, '-y', '-i', temp_raw_path,
                *codec_args,
                '-metadata', f'title={raw_title}',
                '-metadata', f'artist={uploader}',
                temp_final_path
            ]
            ff_ok = False
            try:
                res = subprocess.run(cmd, startupinfo=si, creationflags=creationflags, capture_output=True, timeout=60)
                if res.returncode == 0 and os.path.exists(temp_final_path) and os.path.getsize(temp_final_path) > 0:
                    ff_ok = True
            except Exception:
                ff_ok = False

            source_to_move = temp_final_path if ff_ok else temp_raw_path
            desired_filename = f"{safe_title}.mp3"
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
                    counter = 1
                    while True:
                        cand_name = f"{safe_title} ({counter}).mp3"
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

            if os.path.exists(target_path):
                try:
                    os.remove(target_path)
                except Exception:
                    pass
            shutil.move(source_to_move, target_path)

            self.progress_store.update(
                download_id,
                state='complete',
                progress=100.0,
                filepath=target_path,
                filename=target_filename,
                files=[target_filename]
            )
        finally:
            try:
                if os.path.exists(job_temp_dir):
                    shutil.rmtree(job_temp_dir, ignore_errors=True)
            except Exception:
                pass

    def _extract_flaticon_info(self, url: str) -> dict:
        import urllib.parse

        parsed = urllib.parse.urlparse(url)
        qs = urllib.parse.parse_qs(parsed.query)
        custom_title = qs.get('instagrab_title', [None])[0]
        media_param = qs.get('instagrab_media', [None])[0]

        png_url = None
        icon_id = None
        slug = None

        target_u = media_param or url
        t_parsed = urllib.parse.urlparse(target_u)

        if 'cdn-icons' in t_parsed.netloc.lower():
            # Upgrade /64/, /128/, /256/ to /512/ for crisp 512px PNG
            upgraded_path = re.sub(r'/(?:64|128|256)/', '/512/', t_parsed.path)
            png_url = urllib.parse.urlunparse((t_parsed.scheme or 'https', t_parsed.netloc, upgraded_path, '', '', ''))
            id_m = re.search(r'/(\d+)\.(?:png|gif|mp4)', upgraded_path)
            if id_m:
                icon_id = id_m.group(1)
        else:
            m = re.search(r'/(?:free-icon|free-animated-icon|icon)/([^/?#]+?)_(\d+)', parsed.path)
            if m:
                slug, icon_id = m.group(1), m.group(2)
                folder = icon_id[:-3] or '0'
                png_url = f"https://cdn-icons-png.flaticon.com/512/{folder}/{icon_id}.png"

        if not png_url:
            raise Exception("Could not resolve Flaticon PNG URL. Please click the icon's Download/Copy button or provide a valid Flaticon icon link.")

        title = custom_title or (slug.replace('-', ' ').title() if slug else f"Flaticon Icon {icon_id or ''}".strip())
        return {
            'title': title,
            'thumbnail': png_url,
            'duration': 0,
            'uploader': 'Flaticon',
            'platform': 'flaticon',
            'playable_url': None,
            'media_type': 'photo',
            'download_url': png_url,
            'fallback_url': target_u if 'cdn-icons' in t_parsed.netloc.lower() else png_url,
            'is_icon': True,
            'mode': 'full',
            'carousel_media': [],
            'item_count': 1,
        }

    def _extract_magnific_info(self, url: str, quality: str = 'best') -> dict:
        import urllib.parse

        parsed = urllib.parse.urlparse(url)
        qs = urllib.parse.parse_qs(parsed.query)
        custom_title = qs.get('instagrab_title', [None])[0]
        mode_param = qs.get('instagrab_mode', [None])[0]
        type_param = qs.get('instagrab_type', [None])[0]  # 'video', 'thumbnail', 'icon', 'image'
        media_param = qs.get('instagrab_media', [None])[0]
        thumb_param = qs.get('instagrab_thumb', [None])[0]

        if mode_param in ('preview', 'full'):
            mode = mode_param
        elif quality in ('480p', '360p', 'preview'):
            mode = 'preview'
        else:
            mode = 'full'

        raw_media_url = media_param or url
        m_parsed = urllib.parse.urlparse(raw_media_url)
        m_netloc = m_parsed.netloc.lower()

        # Strip internal instagrab_* params from raw_media_url so signed CDN params stay clean
        clean_q_pairs = [(k, v) for k, vals in urllib.parse.parse_qs(m_parsed.query, keep_blank_values=True).items() if not k.startswith('instagrab_') for v in vals]
        clean_query = urllib.parse.urlencode(clean_q_pairs)
        clean_media_url = urllib.parse.urlunparse((m_parsed.scheme or 'https', m_parsed.netloc, m_parsed.path, '', clean_query, ''))

        download_url = None
        fallback_url = None
        is_video = False
        is_icon = False
        slug_title = None

        # Case 1: Direct Video CDN (videocdn.cdnpk.net or .mp4 / .webm)
        if ('videocdn.cdnpk.net' in m_netloc or re.search(r'\.(?:mp4|webm|mov)(?:\?.*)?$', clean_media_url, re.I)) and type_param != 'thumbnail':
            is_video = True
            download_url = clean_media_url
            fallback_url = clean_media_url
            base_n = os.path.splitext(os.path.basename(m_parsed.path))[0]
            slug_title = base_n.replace('-', ' ').replace('_', ' ').title()

        # Case 2: Direct Icon CDN (cdn-icons-png.freepik.com / cdn-icons-png.flaticon.com)
        elif 'cdn-icons' in m_netloc or type_param == 'icon':
            is_icon = True
            if mode == 'full':
                upgraded_path = re.sub(r'/(?:64|128|256)/', '/512/', m_parsed.path)
                download_url = urllib.parse.urlunparse((m_parsed.scheme or 'https', m_parsed.netloc, upgraded_path, '', '', ''))
                fallback_url = clean_media_url
            else:
                download_url = clean_media_url
                fallback_url = clean_media_url
            base_n = os.path.splitext(os.path.basename(m_parsed.path))[0]
            slug_title = f"Magnific Icon {base_n}"

        # Case 3: Direct Image / Vector / Photo / Thumbnail CDN (img.freepik.com / fps.cdnpk.net / cdnpk.net)
        elif any(d in m_netloc for d in ['img.freepik.com', 'fps.cdnpk.net', 'cdnpk.net']):
            base_n = os.path.splitext(os.path.basename(m_parsed.path))[0]
            slug_title = re.sub(r'_\d+(?:-\d+)?$', '', base_n).replace('-', ' ').title()
            if mode == 'preview':
                # Download preview image directly as-is from the search grid / carousel
                download_url = clean_media_url
                fallback_url = clean_media_url
            else:
                # Opened image -> Download Full Size (2000px high-res) with fallback to signed URL
                if 'img.freepik.com' in m_netloc:
                    download_url = f"{m_parsed.scheme or 'https'}://{m_parsed.netloc}{m_parsed.path}?w=2000"
                    fallback_url = clean_media_url
                else:
                    download_url = clean_media_url
                    fallback_url = clean_media_url

        # Case 4: Magnific / Freepik HTML page URL (/free-photo/...htm, /free-vector/...htm, /icon/..._12345)
        else:
            icon_m = re.search(r'/(?:free-icon|free-animated-icon|icon)/([^/?#]+?)_(\d+)', parsed.path)
            htm_m = re.search(r'/((?:free|premium)-(?:photo|vector|psd|ai-image))/([^/?#]+?)\.htm', parsed.path)
            if icon_m:
                is_icon = True
                slug_s, icon_id = icon_m.group(1), icon_m.group(2)
                slug_title = slug_s.replace('-', ' ').title()
                folder = icon_id[:-3] or '0'
                sz = '512' if mode == 'full' else '128'
                download_url = f"https://cdn-icons-png.flaticon.com/{sz}/{folder}/{icon_id}.png"
                fallback_url = f"https://cdn-icons-png.freepik.com/{sz}/{folder}/{icon_id}.png"
            elif htm_m:
                folder_kind, slug_id = htm_m.group(1), htm_m.group(2)
                slug_title = re.sub(r'_\d+(?:-\d+)?$', '', slug_id).replace('-', ' ').title()
                w_val = '2000' if mode == 'full' else '740'
                download_url = f"https://img.freepik.com/{folder_kind}/{slug_id}.jpg?w={w_val}"
                fallback_url = f"https://img.freepik.com/{folder_kind}/{slug_id}.jpg"

        if not download_url:
            raise Exception("Please click the InstaGrab Download button directly on the Magnific image, vector, video, or icon card.")

        title = (custom_title or slug_title or 'Magnific Media').strip()
        thumb = thumb_param or (fallback_url if not is_video else '') or download_url

        return {
            'title': title,
            'thumbnail': thumb,
            'duration': 0,
            'uploader': 'Magnific',
            'platform': 'magnific',
            'playable_url': download_url if is_video else None,
            'media_type': 'video' if is_video else 'photo',
            'download_url': download_url,
            'fallback_url': fallback_url or download_url,
            'is_video': is_video,
            'is_icon': is_icon,
            'is_thumbnail': (type_param == 'thumbnail'),
            'mode': mode,
            'carousel_media': [],
            'item_count': 1,
        }

    def _download_magnific_or_flaticon(self, url: str, download_id: str, base_path: str, quality: str = 'best', platform: str = 'magnific'):
        import urllib.request
        import shutil
        import io
        from PIL import Image

        label = 'Flaticon' if platform == 'flaticon' else 'Magnific'
        self.progress_store.update(download_id, state='extracting', progress=10.0, speed=f'Resolving {label} media...')

        info = self._extract_flaticon_info(url) if platform == 'flaticon' else self._extract_magnific_info(url, quality=quality)
        primary_url = info.get('download_url')
        fallback_url = info.get('fallback_url') or primary_url
        is_video = bool(info.get('is_video'))
        is_icon = bool(info.get('is_icon')) or (platform == 'flaticon')
        is_thumb = bool(info.get('is_thumbnail'))
        mode = info.get('mode') or 'full'

        raw_title = info.get('title') or f"{label}_Media"
        safe_title = re.sub(r'[<>:"/\\|?*]', '_', raw_title)
        safe_title = re.sub(r'[\x00-\x1f]', '', safe_title).strip()
        safe_title = re.sub(r'\s+', ' ', safe_title)[:90] or f"{label}_Media"

        if platform == 'magnific' and not is_video and not is_icon:
            suffix = ' [Thumb]' if is_thumb else (' [Preview]' if mode == 'preview' else ' [Full HD]')
            if not safe_title.endswith(suffix):
                safe_title = f"{safe_title}{suffix}"

        ext = '.mp4' if is_video else ('.png' if is_icon else '.jpg')
        job_temp_dir = os.path.join(base_path, '.tmp', download_id)
        os.makedirs(job_temp_dir, exist_ok=True)
        temp_file = os.path.join(job_temp_dir, f"{safe_title}{ext}")

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Referer': 'https://www.flaticon.com/' if platform == 'flaticon' else 'https://www.magnific.com/',
        }

        try:
            resp_obj = None
            for cand_u in ([primary_url, fallback_url] if fallback_url != primary_url else [primary_url]):
                try:
                    req = urllib.request.Request(cand_u, headers=headers)
                    resp_obj = urllib.request.urlopen(req, timeout=25)
                    break
                except Exception as first_err:
                    if cand_u == fallback_url:
                        raise first_err
                    continue

            with resp_obj as resp:
                total_bytes = int(resp.headers.get('Content-Length') or 0)
                downloaded = 0
                start_t = time.time()
                with open(temp_file, 'wb') as out_f:
                    while True:
                        with self.active_downloads_lock:
                            if self.active_downloads.get(download_id, {}).get('cancel'):
                                raise Exception("Download cancelled by user")
                        chunk = resp.read(32768)
                        if not chunk:
                            break
                        out_f.write(chunk)
                        downloaded += len(chunk)
                        elapsed = max(time.time() - start_t, 0.05)
                        bps = downloaded / elapsed
                        speed_str = f"{bps / 1048576:.1f} MB/s" if bps >= 1048576 else f"{bps / 1024:.0f} KB/s"
                        pct = (15.0 + (downloaded / total_bytes) * 75.0) if total_bytes > 0 else min(88.0, 20.0 + (downloaded / 300000.0) * 50.0)
                        self.progress_store.update(
                            download_id,
                            state='downloading',
                            progress=round(min(pct, 90.0), 1),
                            speed=speed_str,
                            filename=f"{safe_title}{ext}"
                        )

            if is_icon:
                # Guarantee valid PNG with preserved RGBA transparency
                self.progress_store.update(download_id, state='processing', progress=94.0, speed='Finalizing PNG icon...', filename=f"{safe_title}.png")
                with open(temp_file, 'rb') as f_in:
                    raw_bytes = f_in.read()
                im = Image.open(io.BytesIO(raw_bytes))
                if im.mode not in ('RGBA', 'RGB'):
                    im = im.convert('RGBA')
                im.save(temp_file, format='PNG', optimize=True)
            elif is_video:
                ffmpeg_dir = get_ffmpeg_dir()
                temp_file = self._ensure_h264_compatible(temp_file, ffmpeg_dir, platform=platform, download_id=download_id)

            desired_filename = f"{safe_title}{ext}"
            target_path = os.path.join(base_path, desired_filename)
            target_filename = desired_filename
            counter = 1
            while os.path.exists(target_path):
                try:
                    with open(target_path, 'r+b'):
                        break
                except (PermissionError, OSError):
                    target_filename = f"{safe_title} ({counter}){ext}"
                    target_path = os.path.join(base_path, target_filename)
                    counter += 1

            if os.path.exists(target_path):
                try:
                    os.remove(target_path)
                except Exception:
                    pass
            shutil.move(temp_file, target_path)

            self.progress_store.update(
                download_id,
                state='complete',
                progress=100.0,
                filepath=target_path,
                filename=target_filename,
                files=[target_filename]
            )
        finally:
            try:
                if os.path.exists(job_temp_dir):
                    shutil.rmtree(job_temp_dir, ignore_errors=True)
            except Exception:
                pass

    def _extract_spotify_info(self, url: str) -> dict:
        import urllib.request
        import urllib.parse

        m = re.search(r'/(?:intl-[a-zA-Z-]+/)?(?:embed/)?(track|playlist|album)/([A-Za-z0-9]+)', url)
        if not m:
            raise Exception("Invalid Spotify URL. Please provide a Spotify Track, Playlist, or Album link.")

        kind, spotify_id = m.group(1), m.group(2)
        embed_url = f"https://open.spotify.com/embed/{kind}/{spotify_id}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }

        req = urllib.request.Request(embed_url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='ignore')

        nd_m = re.search(r'<script\s+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>', html, re.DOTALL)
        if not nd_m:
            raise Exception("Could not extract Spotify metadata from embed page.")

        nd = json.loads(nd_m.group(1))
        entity = (((nd.get('props') or {}).get('pageProps') or {}).get('state') or {}).get('data', {}).get('entity') or {}
        if not entity:
            raise Exception("Spotify resource not found or unavailable.")

        # Extract cover art
        cover_url = ''
        cover_sources = (entity.get('coverArt') or {}).get('sources') or (entity.get('visualIdentity') or {}).get('image') or []
        if isinstance(cover_sources, list) and cover_sources:
            cover_url = cover_sources[-1].get('url') or cover_sources[0].get('url') or ''
        if not cover_url:
            try:
                oembed_u = f"https://open.spotify.com/oembed?url=https://open.spotify.com/{kind}/{spotify_id}"
                with urllib.request.urlopen(urllib.request.Request(oembed_u, headers=headers), timeout=8) as oe_r:
                    oe_data = json.loads(oe_r.read().decode('utf-8', errors='ignore'))
                    cover_url = oe_data.get('thumbnail_url') or ''
            except Exception:
                pass

        if kind == 'track':
            raw_title = entity.get('title') or entity.get('name') or 'Spotify Track'
            artists_list = [a.get('name') for a in (entity.get('artists') or []) if isinstance(a, dict) and a.get('name')]
            artist_str = ', '.join(artists_list) or entity.get('subtitle') or 'Spotify Artist'
            duration_sec = int(round((entity.get('duration') or 0) / 1000.0))
            preview_url = (entity.get('audioPreview') or {}).get('url')
            full_title = f"{artist_str} - {raw_title}" if artist_str else raw_title
            return {
                'title': full_title,
                'raw_title': raw_title,
                'artist': artist_str,
                'thumbnail': cover_url,
                'duration': duration_sec,
                'uploader': artist_str,
                'platform': 'spotify',
                'playable_url': preview_url,
                'media_type': 'audio',
                'kind': 'track',
                'tracks': [{
                    'index': 1,
                    'title': raw_title,
                    'artist': artist_str,
                    'duration': duration_sec,
                    'preview_url': preview_url,
                    'id': spotify_id,
                }],
                'carousel_media': [],
                'item_count': 1,
            }

        # Playlist or Album (Bulk + Single item support)
        playlist_title = entity.get('title') or entity.get('name') or f"Spotify {kind.title()}"
        subtitle = entity.get('subtitle') or f"Spotify {kind.title()}"
        raw_tracks = entity.get('trackList') or []
        tracks = []
        carousel_media = []

        for idx, t in enumerate(raw_tracks):
            t_title = t.get('title') or f"Track {idx + 1}"
            t_artist = (t.get('subtitle') or subtitle).replace('\xa0', ' ').strip()
            t_dur = int(round((t.get('duration') or 0) / 1000.0))
            t_uri = t.get('uri') or ''
            t_id = t_uri.split(':')[-1] if ':' in t_uri else ''
            t_preview = (t.get('audioPreview') or {}).get('url')
            disp_name = f"{t_artist} - {t_title}" if t_artist else t_title
            safe_fn = re.sub(r'[<>:"/\\|?*]', '_', disp_name)[:80].strip() + '.mp3'
            tracks.append({
                'index': idx + 1,
                'title': t_title,
                'artist': t_artist,
                'duration': t_dur,
                'preview_url': t_preview,
                'id': t_id,
                'filename': f"{idx + 1:02d}. {safe_fn}",
            })
            carousel_media.append({
                'index': idx + 1,
                'media_type': 'audio',
                'title': f"{t_title} — {t_artist}",
                'uploader': t_artist,
                'duration': t_dur,
                'thumbnail': cover_url,
                'url': f"https://open.spotify.com/track/{t_id}" if t_id else url,
                'filename': f"{idx + 1:02d}. {t_title} — {t_artist}",
                'width': 640,
                'height': 640,
            })

        return {
            'title': f"{playlist_title} ({len(tracks)} Tracks)",
            'playlist_title': playlist_title,
            'thumbnail': cover_url,
            'duration': sum(t['duration'] for t in tracks),
            'uploader': subtitle,
            'platform': 'spotify',
            'playable_url': tracks[0].get('preview_url') if tracks else None,
            'media_type': 'carousel' if len(tracks) > 1 else 'audio',
            'kind': kind,
            'tracks': tracks,
            'carousel_media': carousel_media,
            'item_count': len(tracks) or 1,
        }

    def _download_spotify(self, url: str, download_id: str, base_path: str, quality: str = 'best', item_index: int = None, as_zip: bool = True):
        import urllib.request
        import shutil
        import zipfile

        self.progress_store.update(download_id, state='extracting', progress=6.0, speed='Extracting Spotify track metadata...')
        info = self._extract_spotify_info(url)
        all_tracks = info.get('tracks') or []
        if not all_tracks:
            raise Exception("No playable tracks found in this Spotify link.")

        if item_index is not None:
            idx_1based = max(1, int(item_index))
            if 1 <= idx_1based <= len(all_tracks):
                target_tracks = [all_tracks[idx_1based - 1]]
                is_bulk = False
            else:
                target_tracks = [all_tracks[0]]
                is_bulk = False
        else:
            target_tracks = all_tracks
            is_bulk = len(target_tracks) > 1

        job_temp_dir = os.path.join(base_path, '.tmp', download_id)
        os.makedirs(job_temp_dir, exist_ok=True)

        ffmpeg_dir = get_ffmpeg_dir()
        audio_bitrate = '192' if quality == '192k' else ('128' if quality == '128k' else '320')
        node_path = shutil.which('node')

        downloaded_files = []
        total_count = len(target_tracks)

        try:
            for i, tr in enumerate(target_tracks):
                with self.active_downloads_lock:
                    if self.active_downloads.get(download_id, {}).get('cancel'):
                        raise Exception("Download cancelled by user")

                t_title = tr.get('title') or f"Track {i + 1}"
                t_artist = tr.get('artist') or 'Spotify'
                full_label = f"{t_artist} - {t_title}" if t_artist else t_title
                safe_name = re.sub(r'[<>:"/\\|?*]', '_', full_label)
                safe_name = re.sub(r'[\x00-\x1f]', '', safe_name).strip()[:95] or f"Spotify_Track_{i + 1}"
                if is_bulk:
                    safe_name = f"{i + 1:02d} - {safe_name}"

                base_pct = 10.0 + (i / total_count) * 80.0
                step_span = 80.0 / total_count
                status_prefix = f"[{i + 1}/{total_count}] " if is_bulk else ""

                self.progress_store.update(
                    download_id,
                    state='downloading',
                    progress=round(base_pct, 1),
                    speed=f"{status_prefix}Searching & downloading: {full_label[:45]}...",
                    filename=f"{safe_name}.mp3"
                )

                track_out_base = os.path.join(job_temp_dir, safe_name)
                final_mp3 = track_out_base + '.mp3'

                def track_hook(d, _base=base_pct, _span=step_span, _prefix=status_prefix, _fn=f"{safe_name}.mp3"):
                    with self.active_downloads_lock:
                        if self.active_downloads.get(download_id, {}).get('cancel'):
                            raise Exception("Download cancelled by user")
                    if d.get('status') == 'downloading':
                        dl_b = d.get('downloaded_bytes') or 0
                        tot_b = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
                        sub_pct = (dl_b / tot_b) if tot_b > 0 else 0.5
                        cur_p = min(92.0, _base + sub_pct * (_span * 0.85))
                        spd = d.get('_speed_str', '')
                        if spd:
                            spd = re.sub(r'\x1b\[[0-9;]*m', '', spd).replace('MiB/s', ' MB/s').replace('KiB/s', ' KB/s').strip()
                        self.progress_store.update(
                            download_id,
                            state='downloading',
                            progress=round(cur_p, 1),
                            speed=f"{_prefix}{spd}" if spd else f"{_prefix}Downloading MP3...",
                            filename=_fn
                        )

                ydl_opts = {
                    'format': 'bestaudio/best',
                    'outtmpl': track_out_base + '.%(ext)s',
                    'quiet': True,
                    'no_warnings': True,
                    'noplaylist': True,
                    'socket_timeout': 20,
                    'retries': 5,
                    'progress_hooks': [track_hook],
                    'extractor_args': {'youtube': {'player_client': ['ios', 'android', 'web']}},
                    'postprocessors': [{
                        'key': 'FFmpegExtractAudio',
                        'preferredcodec': 'mp3',
                        'preferredquality': audio_bitrate,
                    }],
                    'postprocessor_args': [
                        '-metadata', f'title={t_title}',
                        '-metadata', f'artist={t_artist}',
                        '-metadata', f"album={info.get('playlist_title') or t_title}",
                    ],
                }
                if ffmpeg_dir:
                    ydl_opts['ffmpeg_location'] = ffmpeg_dir
                if node_path:
                    ydl_opts['js_runtimes'] = {'node': {'path': node_path}}

                track_ok = False
                search_query = f"ytsearch1:{t_artist} - {t_title} official audio"
                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        ydl.extract_info(search_query, download=True)
                    if os.path.exists(final_mp3) and os.path.getsize(final_mp3) > 0:
                        track_ok = True
                except Exception:
                    track_ok = False

                # Fallback to Spotify's direct preview MP3 stream if YouTube search fails
                if not track_ok and tr.get('preview_url'):
                    try:
                        req_p = urllib.request.Request(tr['preview_url'], headers={'User-Agent': 'Mozilla/5.0'})
                        with urllib.request.urlopen(req_p, timeout=15) as r_p:
                            with open(final_mp3, 'wb') as f_p:
                                f_p.write(r_p.read())
                        if os.path.exists(final_mp3) and os.path.getsize(final_mp3) > 0:
                            track_ok = True
                    except Exception:
                        pass

                if track_ok and os.path.exists(final_mp3):
                    downloaded_files.append(final_mp3)

            if not downloaded_files:
                raise Exception("Could not download audio stream for this Spotify track.")

            if len(downloaded_files) > 1 and as_zip:
                self.progress_store.update(download_id, state='processing', progress=95.0, speed='Packaging Spotify playlist ZIP...')
                raw_pl_title = info.get('playlist_title') or 'Spotify_Playlist'
                safe_pl = re.sub(r'[<>:"/\\|?*]', '_', raw_pl_title)[:60].strip() or 'Spotify_Playlist'
                zip_filename = f"{safe_pl}.zip"
                target_zip_path = os.path.join(base_path, zip_filename)
                zc = 1
                while os.path.exists(target_zip_path):
                    zip_filename = f"{safe_pl} ({zc}).zip"
                    target_zip_path = os.path.join(base_path, zip_filename)
                    zc += 1

                with zipfile.ZipFile(target_zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                    for mp3_f in downloaded_files:
                        zf.write(mp3_f, os.path.basename(mp3_f))

                self.progress_store.update(
                    download_id,
                    state='complete',
                    progress=100.0,
                    filepath=target_zip_path,
                    filename=zip_filename,
                    files=[zip_filename]
                )
                return

            moved_files = []
            for mp3_f in downloaded_files:
                desired_name = os.path.basename(mp3_f)
                target_p = os.path.join(base_path, desired_name)
                base_n, ext_n = os.path.splitext(desired_name)
                c = 1
                while os.path.exists(target_p):
                    try:
                        with open(target_p, 'r+b'):
                            break
                    except (PermissionError, OSError):
                        desired_name = f"{base_n} ({c}){ext_n}"
                        target_p = os.path.join(base_path, desired_name)
                        c += 1
                if os.path.exists(target_p):
                    try:
                        os.remove(target_p)
                    except Exception:
                        pass
                shutil.move(mp3_f, target_p)
                moved_files.append((target_p, desired_name))

            self.progress_store.update(
                download_id,
                state='complete',
                progress=100.0,
                filepath=moved_files[0][0],
                filename=moved_files[0][1],
                files=[f[1] for f in moved_files]
            )
        finally:
            try:
                if os.path.exists(job_temp_dir):
                    shutil.rmtree(job_temp_dir, ignore_errors=True)
            except Exception:
                pass


import os
import json
import secrets
import random
import re
from urllib.parse import urlparse, urlunparse

def generate_token(length=64) -> str:
    return secrets.token_urlsafe(length)

def generate_pairing_code() -> str:
    return ''.join(str(random.randint(0, 9)) for _ in range(6))

def sanitize_filename(name: str) -> str:
    # Remove or replace dangerous chars
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    name = re.sub(r'[\x00-\x1f]', '', name)
    # limit length
    return name[:200]

def is_safe_path(base_dir: str, path: str) -> bool:
    base_dir = os.path.realpath(base_dir)
    path = os.path.realpath(path)
    return path.startswith(base_dir)

def validate_media_url(url: str) -> tuple[bool, str, str]:
    """
    Validates Instagram and YouTube URLs.
    Returns (is_valid, error_message, platform).
    Platform is 'instagram', 'youtube', or 'unknown'.
    """
    if not url or not isinstance(url, str):
        return False, "URL is required", "unknown"

    url = url.strip()
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return False, "Invalid URL format", "unknown"
        clean_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, '', '', ''))
    except Exception:
        return False, "Invalid URL format", "unknown"

    netloc = parsed.netloc.lower()

    # 1. Instagram validation (Posts, Photos, Reels, TV, Stories, Highlights)
    if any(domain in netloc for domain in ['instagram.com', 'instagr.am']):
        # Stories & Highlights
        if re.search(r'/stories/([^/?#]+)(?:/(\d+))?/?$', parsed.path) or re.search(r'/s/([A-Za-z0-9_-]+)/?$', parsed.path):
            return True, "", "instagram"

        # Posts, Photos, Reels, TV
        match = re.search(r'/(?:p|reel|reels|tv|share/reel|share/p)/([A-Za-z0-9_-]+)/?$', parsed.path)
        if match:
            shortcode = match.group(1)
            if len(shortcode) >= 3:
                return True, "", "instagram"

        return False, "Invalid Instagram URL. Please provide a valid Post, Photo, Reel, Story, or Highlight link.", "instagram"

    # 2. YouTube validation (Shorts, Videos, youtu.be, clips, live)
    if 'youtu.be' in netloc:
        yt_short_pattern = r'^https?://youtu\.be/[A-Za-z0-9_-]+/?$'
        if re.match(yt_short_pattern, clean_url):
            return True, "", "youtube"
        return False, "Invalid YouTube short link.", "youtube"

    if any(domain in netloc for domain in ['youtube.com', 'm.youtube.com', 'www.youtube.com']):
        # Check shorts
        if '/shorts/' in parsed.path:
            yt_shorts_pattern = r'^https?://(www\.|m\.)?youtube\.com/shorts/[A-Za-z0-9_-]+/?$'
            if re.match(yt_shorts_pattern, clean_url):
                return True, "", "youtube"
            return False, "Invalid YouTube Shorts URL.", "youtube"

        # Check watch?v=...
        if parsed.path.rstrip('/') in ['/watch', '/watch_popup']:
            # For watch URLs, we need the query parameter v=
            from urllib.parse import parse_qs
            qs = parse_qs(parsed.query)
            if 'v' in qs and qs['v'] and re.match(r'^[A-Za-z0-9_-]+$', qs['v'][0]):
                return True, "", "youtube"
            return False, "Invalid YouTube video URL (missing or invalid video ID).", "youtube"

        # Check /live/, /embed/, /v/
        yt_embed_pattern = r'^https?://(www\.|m\.)?youtube\.com/(live|embed|v|clip)/[A-Za-z0-9_-]+/?$'
        if re.match(yt_embed_pattern, clean_url):
            return True, "", "youtube"

        return False, "Invalid YouTube URL format.", "youtube"

    # 3. Pinterest validation (Pins, Videos, Images, pin.it shortlinks)
    if 'pin.it' in netloc:
        pinit_pattern = r'^https?://pin\.it/[A-Za-z0-9_-]+/?$'
        if re.match(pinit_pattern, clean_url):
            return True, "", "pinterest"
        return False, "Invalid Pinterest short link.", "pinterest"

    if 'pinterest.' in netloc or 'pinterest.com' in netloc:
        pin_pattern = r'^https?://([a-zA-Z0-9-]+\.)?pinterest\.[a-z.]+/pin/[A-Za-z0-9_-]+/?$'
        if re.match(pin_pattern, clean_url):
            return True, "", "pinterest"
        return False, "Invalid Pinterest Pin URL. Please provide a link to a Pin.", "pinterest"

    # 4. Envato Audio & SFX validation (Envato Elements, AudioJungle, direct audio previews)
    if 'envatousercontent.com' in netloc:
        if re.search(r'\.(?:mp3|m4a|wav|aac|ogg)(?:\?.*)?$', url, re.IGNORECASE):
            return True, "", "envato"
        return False, "Invalid Envato audio stream URL.", "envato"

    if 'elements.envato.com' in netloc or 'audiojungle.net' in netloc or 'envato.com' in netloc:
        path_clean = parsed.path.rstrip('/')
        category_suffixes = (
            '/sound-effects', '/royalty-free-music', '/audio', '/stock-video',
            '/video-templates', '/graphic-templates', '/presentation-templates',
            '/photos', '/fonts', '/add-ons', '/web-templates', '/3d'
        )
        if not any(path_clean.lower().endswith(cat) for cat in category_suffixes):
            if re.search(r'/[a-zA-Z0-9-]+-[A-Za-z0-9]{6,10}$', path_clean) or re.search(r'/item/[^/]+/\d+', path_clean):
                return True, "", "envato"
        return False, "Invalid Envato URL. Please provide a link to a specific Envato Audio or SFX track.", "envato"

    # 5. Epidemic Sound Audio & SFX validation (epidemicsound.com, audiocdn.epidemicsound.com)
    if 'audiocdn.epidemicsound.com' in netloc:
        if re.search(r'\.(?:mp3|m4a|wav|aac|ogg)(?:\?.*)?$', url, re.IGNORECASE):
            return True, "", "epidemic"
        return False, "Invalid Epidemic Sound audio stream URL.", "epidemic"

    if 'epidemicsound.com' in netloc:
        path_clean = parsed.path.rstrip('/')
        if re.search(r'/(?:music/tracks|sound-effects/tracks|track)/[^/]+$', path_clean):
            return True, "", "epidemic"
        if ('term=' in parsed.query or 'instagrab_title=' in parsed.query):
            return True, "", "epidemic"
        return False, "Invalid Epidemic Sound URL. Please provide a link to a specific Epidemic Sound Music or Sound Effect track.", "epidemic"

    # 6. Magnific / Freepik (Images, Vectors, Photos, Videos, Video Thumbnails, Icons)
    if any(d in netloc for d in ['img.freepik.com', 'videocdn.cdnpk.net', 'fps.cdnpk.net', 'cdnpk.net', 'cdn-icons-png.freepik.com']):
        return True, "", "magnific"

    if any(d in netloc for d in ['magnific.com', 'magnific.ai', 'freepik.com']):
        path_clean = parsed.path.rstrip('/')
        if (
            path_clean.endswith('.htm')
            or re.search(r'/(?:free|premium)-(?:photo|vector|psd|video|ai-image|icon)/', path_clean)
            or re.search(r'/(?:icon|animated-icon|video|serie)/', path_clean)
            or 'instagrab_media=' in parsed.query
            or ('/search' in path_clean and ('term=' in parsed.query or 'word=' in parsed.query))
        ):
            return True, "", "magnific"
        return False, "Invalid Magnific URL. Please provide a link to an image, vector, video, icon, or search query.", "magnific"

    # 7. Flaticon (PNG Icons, Animated Icons, Packs)
    if any(d in netloc for d in ['cdn-icons-png.flaticon.com', 'cdn-icons-mp4.flaticon.com', 'cdn-icons-gif.flaticon.com', 'cdn-icons.flaticon.com']):
        return True, "", "flaticon"

    if 'flaticon.com' in netloc:
        path_clean = parsed.path.rstrip('/')
        if (
            re.search(r'/(?:free-icon|free-animated-icon|icon|packs|stickers-pack)/[^/]+', path_clean)
            or 'instagrab_media=' in parsed.query
            or ('/search' in path_clean and 'word=' in parsed.query)
        ):
            return True, "", "flaticon"
        return False, "Invalid Flaticon URL. Please provide a link to a Flaticon icon or search page.", "flaticon"

    # 8. Spotify (Single Track, Playlist, Album)
    if 'open.spotify.com' in netloc or 'play.spotify.com' in netloc:
        path_clean = parsed.path.rstrip('/')
        if re.search(r'/(?:intl-[a-zA-Z-]+/)?(?:embed/)?(?:track|playlist|album)/[A-Za-z0-9]+', path_clean):
            return True, "", "spotify"
        return False, "Invalid Spotify URL. Please provide a link to a Spotify Track, Playlist, or Album.", "spotify"

    return False, "Unsupported platform. Please enter an Instagram, YouTube, Pinterest, Envato, Epidemic Sound, Magnific, Flaticon, or Spotify URL.", "unknown"


def validate_instagram_url(url: str) -> tuple[bool, str]:
    """Compatibility wrapper for Instagram-only validation."""
    valid, err, platform = validate_media_url(url)
    if valid and platform == 'instagram':
        return True, ""
    return valid, err


class TokenManager:
    def __init__(self):
        appdata = os.environ.get('APPDATA', os.path.expanduser('~'))
        self.config_dir = os.path.join(appdata, 'InstaGrab')
        self.tokens_file = os.path.join(self.config_dir, 'tokens.json')
        self.tokens = {}
        self.pairing_code = ""
        self._load()

    def _load(self):
        try:
            if os.path.exists(self.tokens_file):
                with open(self.tokens_file, 'r', encoding='utf-8') as f:
                    self.tokens = json.load(f)
        except Exception:
            self.tokens = {}

    def _save(self):
        try:
            os.makedirs(self.config_dir, exist_ok=True)
            with open(self.tokens_file, 'w', encoding='utf-8') as f:
                json.dump(self.tokens, f)
        except Exception:
            pass

    def save_token(self, token: str, origin: str):
        self.tokens[token] = {'origin': origin}
        self._save()

    def verify_token(self, token: str) -> bool:
        return token in self.tokens

    def get_pairing_code(self) -> str:
        return self.pairing_code

    def set_pairing_code(self, code: str):
        self.pairing_code = code

    def verify_pairing_code(self, code: str) -> tuple[bool, str]:
        if self.pairing_code and code == self.pairing_code:
            # Consume the code and generate a new one
            self.pairing_code = generate_pairing_code()
            new_token = generate_token()
            self.save_token(new_token, "paired")
            return True, new_token
        return False, "Invalid or expired pairing code"

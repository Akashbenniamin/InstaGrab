import pytest
from src.security import validate_instagram_url, validate_media_url

def test_valid_instagram_urls():
    valid_urls = [
        "https://www.instagram.com/reel/C123456789/",
        "http://instagram.com/p/ABCDEF/",
        "https://instagr.am/tv/xyz123",
        "https://www.instagram.com/reel/C123456789/?igsh=123456",
        "https://instagram.com/p/ABCDEF",
        "https://www.instagram.com/explorewithepaphra/reel/DF-mGq-z_0Z/",
        "https://www.instagram.com/explorewithepaphra/reel/DF-mGq-z_0Z/?igsh=MWQ1ZGUxMzBkMA==",
        "https://www.instagram.com/explorewithepaphra/reels/DF-mGq-z_0Z/",
        "https://www.instagram.com/reels/DF-mGq-z_0Z/",
        "https://www.instagram.com/share/reel/DF-mGq-z_0Z/",
        "https://www.instagram.com/stories/username/12345/"
    ]
    for url in valid_urls:
        valid, msg, platform = validate_media_url(url)
        assert valid, f"Failed on valid URL: {url} - {msg}"
        assert platform == "instagram"

def test_valid_youtube_urls():
    valid_urls = [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"),
        ("https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s", "youtube"),
        ("https://m.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"),
        ("https://youtu.be/dQw4w9WgXcQ", "youtube"),
        ("https://www.youtube.com/shorts/3i_JmO7xG-g", "youtube"),
        ("https://youtube.com/shorts/3i_JmO7xG-g?feature=share", "youtube"),
        ("https://www.youtube.com/embed/dQw4w9WgXcQ", "youtube"),
        ("https://www.youtube.com/live/dQw4w9WgXcQ", "youtube")
    ]
    for url, expected_platform in valid_urls:
        valid, msg, platform = validate_media_url(url)
        assert valid, f"Failed on valid YouTube URL: {url} - {msg}"
        assert platform == expected_platform

def test_valid_pinterest_urls():
    valid_urls = [
        "https://www.pinterest.com/pin/123456789/",
        "https://pinterest.com/pin/987654321/",
        "https://in.pinterest.com/pin/1122334455/",
        "https://pin.it/7x9AbCd"
    ]
    for url in valid_urls:
        valid, msg, platform = validate_media_url(url)
        assert valid, f"Failed on valid Pinterest URL: {url} - {msg}"
        assert platform == "pinterest"

def test_valid_envato_urls():
    valid_urls = [
        "https://elements.envato.com/ai-thinking-MUK72ZA",
        "https://elements.envato.com/behbubah-UW6XXLW",
        "https://elements.envato.com/builds-punch-driven-wet-15-9EQB7RU",
        "https://elements.envato.com/es/ai-thinking-MUK72ZA",
        "https://audiojungle.net/item/cinematic-whoosh/12345678",
        "https://audio-previews.elements.envatousercontent.com/files/576361690/preview.mp3",
        "https://public-assets.content-platform.envatousercontent.com/57495a18-d135/3729ef0b/preview.mp3"
    ]
    for url in valid_urls:
        valid, msg, platform = validate_media_url(url)
        assert valid, f"Failed on valid Envato URL: {url} - {msg}"
        assert platform == "envato"

def test_valid_epidemic_urls():
    valid_urls = [
        "https://www.epidemicsound.com/sound-effects/tracks/16bb9f7c-282e-45f4-a253-40ee6d605412/",
        "https://www.epidemicsound.com/music/tracks/f3f4dc47-bf55-4cd1-ac44-d650d157d156/",
        "https://www.epidemicsound.com/track/some-cool-song/",
        "https://audiocdn.epidemicsound.com/lqmp3/01KGPFWR0G2E9K5BTRM61DK4B8.mp3"
    ]
    for url in valid_urls:
        valid, msg, platform = validate_media_url(url)
        assert valid, f"Failed on valid Epidemic Sound URL: {url} - {msg}"
        assert platform == "epidemic"

def test_invalid_urls():
    invalid_urls = [
        "https://www.google.com",
        "",
        "https://www.instagram.com/username/", # Profile
        "https://randomsite.com/instagram.com/reel/123",
        "https://www.instagram.com/reel/123/extra",
        "https://www.youtube.com/user/username",
        "https://www.youtube.com/channel/UC12345",
        "https://elements.envato.com/sound-effects",
        "https://elements.envato.com/audio/royalty-free-music",
        "https://www.epidemicsound.com/sound-effects/",
        "https://www.epidemicsound.com/music/featured/"
    ]
    for url in invalid_urls:
        valid, _, _ = validate_media_url(url)
        assert not valid, f"Incorrectly validated invalid URL: {url}"

def test_normalize_instagram_url():
    from src.downloader import normalize_instagram_url

    # Highlights via /s/ shortlink
    shortlink = "https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDkwOTQ2MDQ4MTIzOTc4?story_media_id=3240212345"
    normalized = normalize_instagram_url(shortlink)
    assert normalized == "https://www.instagram.com/stories/highlights/18090946048123978/"

    # Stories highlight with query params
    hl_url = "https://www.instagram.com/stories/highlights/18090946048123978/?story_media_id=123"
    assert normalize_instagram_url(hl_url) == "https://www.instagram.com/stories/highlights/18090946048123978/"

    # Posts / Reels normalization
    post_url = "https://www.instagram.com/p/DFgdO1xzbZz/?igsh=MWQ1ZGUxMzBkMA=="
    assert normalize_instagram_url(post_url) == "https://www.instagram.com/p/DFgdO1xzbZz/"

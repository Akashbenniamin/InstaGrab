import pytest
from src.security import validate_instagram_url, validate_media_url

def test_valid_instagram_urls():
    valid_urls = [
        "https://www.instagram.com/reel/C123456789/",
        "http://instagram.com/p/ABCDEF/",
        "https://instagr.am/tv/xyz123",
        "https://www.instagram.com/reel/C123456789/?igsh=123456",
        "https://instagram.com/p/ABCDEF"
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

def test_invalid_urls():
    invalid_urls = [
        "https://www.google.com",
        "",
        "https://www.instagram.com/username/", # Profile
        "https://www.instagram.com/stories/username/12345/", # Stories
        "https://randomsite.com/instagram.com/reel/123",
        "https://www.instagram.com/reel/123/extra",
        "https://www.youtube.com/user/username",
        "https://www.youtube.com/channel/UC12345"
    ]
    for url in invalid_urls:
        valid, _, _ = validate_media_url(url)
        assert not valid, f"Incorrectly validated invalid URL: {url}"

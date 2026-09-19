import pytest
import os
import re
from src.config import Config
from src.progress import ProgressStore
from src.downloader import Downloader
from src.security import TokenManager
from src.server import create_app

def test_youtube_url_cleaning():
    url = "https://www.youtube.com/watch?v=YKSe6v-M91o&list=PLGJKPRuLN5rEsdRZIGKgnORDk1BFF3MUg&index=3"
    yt_match = re.search(r'(?:youtube\.com/watch\?.*?v=|youtu\.be/)([A-Za-z0-9_-]{11})', url)
    assert yt_match is not None
    clean_url = f"https://www.youtube.com/watch?v={yt_match.group(1)}"
    assert clean_url == "https://www.youtube.com/watch?v=YKSe6v-M91o"

def test_server_recent_downloads_endpoint():
    config = Config()
    progress_store = ProgressStore()
    downloader = Downloader(config, progress_store)
    token_manager = TokenManager()
    
    app = create_app(config, downloader, token_manager)
    client = app.test_client()
    
    token = "test-token-123"
    token_manager.save_token(token, "web-client")
    
    port = config.get('port')
    resp = client.get('/api/downloads/recent', headers={
        'Host': f'127.0.0.1:{port}',
        'Origin': 'https://akashbenniamin.github.io',
        'X-Requested-With': 'InstaGrab',
        'Authorization': f'Bearer {token}'
    })
    
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'downloads' in data
    assert isinstance(data['downloads'], list)
    if len(data['downloads']) > 0:
        item = data['downloads'][0]
        assert 'filename' in item
        assert 'sizeFormatted' in item
        assert 'timestamp' in item

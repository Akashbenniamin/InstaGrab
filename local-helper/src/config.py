import os
import json
import threading
from pathlib import Path

class Config:
    def __init__(self):
        self.lock = threading.RLock()
        
        appdata = os.environ.get('APPDATA', os.path.expanduser('~'))
        self.config_dir = os.path.join(appdata, 'InstaGrab')
        self.config_file = os.path.join(self.config_dir, 'config.json')
        
        self.settings = {
            'download_path': os.path.join(os.path.expanduser('~'), 'Downloads', 'InstaGrab'),
            'port': 18765,
            'allowed_origins': ["http://localhost:5173", "http://127.0.0.1:5173"],
            'max_file_size_mb': 0,
            'auto_start': False,
            'theme': 'sunset',
            'quick_mode': False
        }
        
    def cleanup_cookie_files(self):
        """Purge all stored cookie files completely from disk."""
        with self.lock:
            try:
                if os.path.isdir(self.config_dir):
                    for fname in os.listdir(self.config_dir):
                        if fname == 'cookies.txt' or fname.endswith('_cookies.txt'):
                            p = os.path.join(self.config_dir, fname)
                            try:
                                os.remove(p)
                                print(f"[InstaGrab Config] Removed cookie file: {p}")
                            except Exception:
                                pass
            except Exception:
                pass

    def load(self):
        with self.lock:
            try:
                if os.path.exists(self.config_file):
                    with open(self.config_file, 'r', encoding='utf-8') as f:
                        loaded = json.load(f)
                        # Remove legacy cookie settings if present
                        loaded.pop('use_browser_cookies', None)
                        loaded.pop('browser_for_cookies', None)
                        self.settings.update(loaded)
                    self.save()
                else:
                    self.save()
            except Exception as e:
                pass
        self.cleanup_cookie_files()

    def save(self):
        with self.lock:
            try:
                os.makedirs(self.config_dir, exist_ok=True)
                with open(self.config_file, 'w', encoding='utf-8') as f:
                    json.dump(self.settings, f, indent=4)
            except Exception as e:
                pass

    def get(self, key):
        with self.lock:
            return self.settings.get(key)

    def set(self, key, value):
        with self.lock:
            self.settings[key] = value
        self.save()

    def get_download_path(self):
        with self.lock:
            path = self.settings.get('download_path')
            try:
                os.makedirs(path, exist_ok=True)
            except Exception:
                pass
            return path

    def get_cookie_file_path(self, platform='instagram'):
        return None

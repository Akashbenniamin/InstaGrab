import os
import json
import threading
from pathlib import Path

class Config:
    def __init__(self):
        self.lock = threading.Lock()
        
        appdata = os.environ.get('APPDATA', os.path.expanduser('~'))
        self.config_dir = os.path.join(appdata, 'InstaGrab')
        self.config_file = os.path.join(self.config_dir, 'config.json')
        
        self.settings = {
            'download_path': os.path.join(os.path.expanduser('~'), 'Downloads', 'InstaGrab'),
            'port': 18765,
            'allowed_origins': ["http://localhost:5173", "http://127.0.0.1:5173"],
            'use_browser_cookies': False,
            'browser_for_cookies': "chrome",
            'max_file_size_mb': 0,
            'auto_start': False
        }
        
    def load(self):
        with self.lock:
            try:
                if os.path.exists(self.config_file):
                    with open(self.config_file, 'r', encoding='utf-8') as f:
                        loaded = json.load(f)
                        self.settings.update(loaded)
            except Exception as e:
                pass

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

    def get_cookie_file_path(self):
        with self.lock:
            # First check if user dropped a custom cookies.txt in their download path
            dl_path = self.settings.get('download_path')
            if dl_path:
                custom_path = os.path.join(dl_path, 'cookies.txt')
                if os.path.exists(custom_path) and os.path.getsize(custom_path) > 10:
                    return custom_path
            
            # Check appdata config dir
            appdata_cookies = os.path.join(self.config_dir, 'cookies.txt')
            if os.path.exists(appdata_cookies) and os.path.getsize(appdata_cookies) > 10:
                return appdata_cookies
            return None

    def save_netscape_cookies(self, cookies_list):
        if not cookies_list:
            return False
        import time
        lines = [
            "# Netscape HTTP Cookie File",
            "# Auto-synced by InstaGrab Extension for 18+ / authenticated reels",
            "# https://curl.haxx.se/rfc/cookie_spec.html",
            ""
        ]
        count = 0
        for c in cookies_list:
            domain = c.get('domain', '')
            if not domain:
                continue
            flag = 'TRUE' if domain.startswith('.') else 'FALSE'
            path = c.get('path', '/')
            secure = 'TRUE' if c.get('secure', False) else 'FALSE'
            exp = c.get('expirationDate')
            if exp is None or exp <= 0:
                exp = int(time.time()) + 86400 * 90  # 90 days default
            else:
                exp = int(exp)
            name = c.get('name', '')
            val = c.get('value', '')
            if name:
                lines.append(f"{domain}\t{flag}\t{path}\t{secure}\t{exp}\t{name}\t{val}")
                count += 1

        if count == 0:
            return False

        with self.lock:
            try:
                os.makedirs(self.config_dir, exist_ok=True)
                cookie_path = os.path.join(self.config_dir, 'cookies.txt')
                with open(cookie_path, 'w', encoding='utf-8') as f:
                    f.write('\n'.join(lines) + '\n')
                return True
            except Exception as e:
                print(f"[InstaGrab Config] Error saving cookies: {e}")
                return False

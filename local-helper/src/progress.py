import threading
import time

class ProgressStore:
    def __init__(self):
        self.lock = threading.Lock()
        self.store = {}

    def create(self, download_id: str) -> None:
        with self.lock:
            now = time.time()
            self.store[download_id] = {
                'state': 'starting',
                'progress': 0,
                'speed': '',
                'eta': '',
                'filename': '',
                'filepath': '',
                'error': None,
                'errorType': None,
                'created_at': now,
                'updated_at': now
            }

    def update(self, download_id: str, **kwargs) -> None:
        with self.lock:
            if download_id in self.store:
                self.store[download_id].update(kwargs)
                self.store[download_id]['updated_at'] = time.time()

    def get(self, download_id: str) -> dict | None:
        with self.lock:
            return self.store.get(download_id)

    def delete(self, download_id: str) -> None:
        with self.lock:
            if download_id in self.store:
                del self.store[download_id]

    def cleanup_old(self, max_age_seconds: int = 3600) -> None:
        with self.lock:
            now = time.time()
            to_delete = [
                did for did, data in self.store.items()
                if now - data.get('updated_at', now) > max_age_seconds and data.get('state') in ('complete', 'error')
            ]
            for did in to_delete:
                del self.store[did]

import pystray
from PIL import Image, ImageDraw
import threading
import os
import winreg
from .security import generate_pairing_code

def create_image():
    image = Image.new('RGB', (64, 64), color=(30, 30, 30))
    dc = ImageDraw.Draw(image)
    dc.ellipse([4, 4, 60, 60], fill=(225, 48, 108))
    # Draw simple arrow
    dc.polygon([(24, 16), (40, 16), (40, 36), (50, 36), (32, 54), (14, 36), (24, 36)], fill="white")
    return image

class TrayApp:
    def __init__(self, config, token_manager, downloader):
        self.config = config
        self.token_manager = token_manager
        self.downloader = downloader
        self.icon = None

    def create_menu(self):
        autostart = self.config.get('auto_start')
        pairing_code = self.token_manager.get_pairing_code()
        
        return pystray.Menu(
            pystray.MenuItem("InstaGrab Helper v1.0.0", None, enabled=False),
            pystray.MenuItem("Status: Active (Auto-Connected)", None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Open Downloads Folder", self.open_downloads),
            pystray.MenuItem("Update yt-dlp", self.update_ytdlp),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Start with Windows", self.toggle_autostart, checked=lambda item: self.config.get('auto_start')),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Exit", self.exit_app)
        )

    def run(self):
        self.icon = pystray.Icon("InstaGrab", create_image(), "InstaGrab Helper", self.create_menu())
        self.icon.run()

    def show_notification(self, title, message):
        if self.icon:
            try:
                self.icon.notify(message, title)
            except:
                pass

    def open_downloads(self):
        path = self.config.get_download_path()
        os.startfile(path)

    def update_ytdlp(self):
        self.show_notification("InstaGrab Update", "Updating yt-dlp in background...")
        success, msg = self.downloader.update_ytdlp()
        if success:
            self.show_notification("InstaGrab Update", "yt-dlp updated successfully.")
        else:
            self.show_notification("InstaGrab Update", f"Failed to update: {msg}")

    def toggle_autostart(self):
        current = self.config.get('auto_start')
        new_val = not current
        self.config.set('auto_start', new_val)
        
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_ALL_ACCESS)
        if new_val:
            import sys
            winreg.SetValueEx(key, "InstaGrabHelper", 0, winreg.REG_SZ, sys.executable)
        else:
            try:
                winreg.DeleteValue(key, "InstaGrabHelper")
            except:
                pass
        winreg.CloseKey(key)
        
        if self.icon:
            self.icon.menu = self.create_menu()
            self.icon.update_menu()

    def regenerate_code(self):
        new_code = generate_pairing_code()
        self.token_manager.set_pairing_code(new_code)
        if self.icon:
            self.icon.menu = self.create_menu()
            self.icon.update_menu()
        self.show_notification("New Pairing Code", f"Your new code is: {new_code}")

    def exit_app(self):
        if self.icon:
            self.icon.stop()
        os._exit(0)

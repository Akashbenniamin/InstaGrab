import sys
import os
import threading
import logging
import socket

# Ensure the parent directory is in the path so we can import src modules
if getattr(sys, 'frozen', False):
    # Running as PyInstaller bundle
    base_dir = os.path.dirname(sys.executable)
else:
    # Running from source
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.insert(0, base_dir)

from waitress import serve
from src.config import Config
from src.security import TokenManager, generate_pairing_code
from src.progress import ProgressStore
from src.downloader import Downloader
from src.server import create_app
from src.tray import TrayApp

def is_already_running(port: int) -> bool:
    """Check if an instance is already listening on the helper port."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.settimeout(0.5)
        s.connect(('127.0.0.1', port))
        s.close()
        return True
    except (socket.error, socket.timeout):
        return False

def register_protocol_handler():
    """Registers instagrab:// URL protocol in Windows Registry for 1-click launch from the website."""
    if sys.platform != 'win32':
        return
    try:
        import winreg
        if getattr(sys, 'frozen', False):
            exe_path = sys.executable
            cmd = f'"{exe_path}" "%1"'
        else:
            current_script = os.path.abspath(__file__)
            cmd = f'"{sys.executable}" "{current_script}" "%1"'

        key_path = r"Software\Classes\instagrab"
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path) as key:
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, "URL:InstaGrab Protocol")
            winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")
            
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path + r"\shell\open\command") as key:
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, cmd)
        logging.info("Registered instagrab:// custom protocol handler in Windows registry")
    except Exception as e:
        logging.warning(f"Could not register instagrab:// protocol handler: {e}")

def start_server(app, port):
    """Start the Flask server using waitress (production WSGI server)."""
    logging.info(f"Starting server on http://127.0.0.1:{port}")
    serve(app, host='127.0.0.1', port=port, _quiet=True)

def main():
    """Main entry point for the InstaGrab helper application."""
    # Load configuration first to get the port
    config = Config()
    config.load()
    port = config.get('port')

    # If already running (e.g. user clicked launch from website while already active), exit quietly
    if is_already_running(port):
        print(f"InstaGrab Helper is already running on port {port}.")
        sys.exit(0)

    # Setup logging
    log_dir = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'InstaGrab', 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        handlers=[
            logging.FileHandler(os.path.join(log_dir, 'helper.log'), encoding='utf-8'),
            logging.StreamHandler()
        ]
    )
    logger = logging.getLogger('InstaGrab')
    logger.info("InstaGrab Helper starting...")

    # Register custom protocol handler for 1-click web launch
    register_protocol_handler()

    # Initialize security
    token_manager = TokenManager()
    if not token_manager.get_pairing_code():
        code = generate_pairing_code()
        token_manager.set_pairing_code(code)
        logger.info(f"Generated pairing code: {code}")
    else:
        logger.info(f"Existing pairing code: {token_manager.get_pairing_code()}")
        
    # Initialize download components
    progress_store = ProgressStore()
    downloader = Downloader(config, progress_store)
    
    # Create Flask app
    app = create_app(config, downloader, token_manager)
    
    # Start server in background thread
    server_thread = threading.Thread(target=start_server, args=(app, port), daemon=True)
    server_thread.start()
    logger.info(f"Server thread started on port {port}")
    
    # Create and run system tray (blocking, runs on main thread)
    tray = TrayApp(config, token_manager, downloader)
    
    if '--minimized' not in sys.argv:
        def show_init_notif():
            tray.show_notification(
                "InstaGrab Helper Started",
                "Helper is active! Ready to download directly from your browser."
            )
        timer = threading.Timer(2.0, show_init_notif)
        timer.daemon = True
        timer.start()
    
    logger.info("Starting system tray...")
    tray.run()  # This blocks until exit
    logger.info("InstaGrab Helper shutting down.")

if __name__ == '__main__':
    main()

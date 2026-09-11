import sys
import os
import threading
import logging

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

def start_server(app, port):
    """Start the Flask server using waitress (production WSGI server)."""
    logging.info(f"Starting server on http://127.0.0.1:{port}")
    serve(app, host='127.0.0.1', port=port, _quiet=True)

def main():
    """Main entry point for the InstaGrab helper application."""
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
    
    # Load configuration
    config = Config()
    config.load()
    
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
    port = config.get('port')
    server_thread = threading.Thread(target=start_server, args=(app, port), daemon=True)
    server_thread.start()
    logger.info(f"Server thread started on port {port}")
    
    # Create and run system tray (blocking, runs on main thread)
    tray = TrayApp(config, token_manager, downloader)
    
    if '--minimized' not in sys.argv:
        # Show notification with pairing code after tray initializes
        def show_init_notif():
            tray.show_notification(
                "InstaGrab Helper Started",
                f"Pairing code: {token_manager.get_pairing_code()}\nRight-click the tray icon for options."
            )
        timer = threading.Timer(2.0, show_init_notif)
        timer.daemon = True
        timer.start()
    
    logger.info("Starting system tray...")
    tray.run()  # This blocks until exit
    logger.info("InstaGrab Helper shutting down.")

if __name__ == '__main__':
    main()

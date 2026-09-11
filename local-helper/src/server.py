import os
import subprocess
from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from functools import wraps
import time
from .security import TokenManager, generate_token

def create_app(config, downloader, token_manager):
    app = Flask(__name__)
    
    # Simple in-memory rate limiter
    rate_limits = {}

    def is_rate_limited(endpoint, limit=30):
        now = time.time()
        client_ip = request.remote_addr
        key = f"{client_ip}:{endpoint}"
        
        if key not in rate_limits:
            rate_limits[key] = []
            
        rate_limits[key] = [t for t in rate_limits[key] if now - t < 60]
        if len(rate_limits[key]) >= limit:
            return True
            
        rate_limits[key].append(now)
        return False

    @app.before_request
    def security_middleware():
        if request.method == 'OPTIONS':
            return

        host = request.headers.get('Host', '')
        port = config.get('port')
        allowed_hosts = [f'127.0.0.1:{port}', f'localhost:{port}']
        if host not in allowed_hosts:
             return jsonify({'error': 'Invalid host'}), 403

    def is_origin_allowed(origin):
        if not origin:
            return False
        allowed = config.get('allowed_origins') or []
        if origin in allowed:
            return True
        # Allow localhost / 127.0.0.1 on any dev port
        if origin.startswith('http://localhost:') or origin.startswith('http://127.0.0.1:'):
            return True
        # Allow free static hosting domains (GitHub Pages, Cloudflare Pages, Vercel)
        import re
        if re.match(r'^https://[a-zA-Z0-9_-]+\.github\.io$', origin):
            return True
        if re.match(r'^https://[a-zA-Z0-9_-]+\.pages\.dev$', origin):
            return True
        if re.match(r'^https://[a-zA-Z0-9_-]+\.vercel\.app$', origin):
            return True
        # Allow Pinterest domains (e.g. in.pinterest.com, www.pinterest.com, pinterest.com, pinterest.co.uk)
        if re.match(r'^https://([a-zA-Z0-9-]+\.)*pinterest\.[a-z.]+$', origin):
            return True
        # Allow browser extensions (Chrome, Edge, Brave, Firefox)
        if origin.startswith('chrome-extension://') or origin.startswith('moz-extension://') or origin.startswith('extension://'):
            return True
        return False

    @app.before_request
    def security_middleware():
        if request.method == 'OPTIONS':
            return make_response('', 204)

        host = request.headers.get('Host', '')
        port = config.get('port')
        allowed_hosts = [f'127.0.0.1:{port}', f'localhost:{port}']
        if host not in allowed_hosts:
             return jsonify({'error': 'Invalid host'}), 403

        origin = request.headers.get('Origin')
        if origin:
            if request.path != '/api/health':
                if not is_origin_allowed(origin):
                    return jsonify({'error': 'Origin not allowed'}), 403

        if request.path != '/api/health':
            if request.headers.get('X-Requested-With') != 'InstaGrab':
                return jsonify({'error': 'Missing custom header'}), 403

        # Token auth
        if not request.path.startswith('/api/health') and not request.path.startswith('/api/pair/'):
            auth_header = request.headers.get('Authorization', '')
            if not auth_header.startswith('Bearer '):
                return jsonify({'error': 'Missing token'}), 401
            token = auth_header.split(' ')[1]
            if not token_manager.verify_token(token):
                return jsonify({'error': 'Invalid token'}), 401

    @app.after_request
    def cors_middleware(response):
        origin = request.headers.get('Origin')
        if is_origin_allowed(origin) or (request.path == '/api/health' and origin):
            response.headers['Access-Control-Allow-Origin'] = origin
        
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
        response.headers['Access-Control-Allow-Private-Network'] = 'true'
        response.headers['Access-Control-Max-Age'] = '86400'
        return response

    @app.route('/api/health', methods=['GET', 'OPTIONS'])
    def health():
        if request.method == 'OPTIONS':
            return '', 204
        return jsonify({
            'status': 'ok',
            'version': '1.0.6',
            'downloadPath': config.get_download_path(),
            'ytdlpVersion': 'unknown',
            'paired': len(token_manager.tokens) > 0
        })

    @app.route('/api/pair/auto', methods=['GET', 'POST', 'OPTIONS'])
    def pair_auto():
        if request.method == 'OPTIONS':
            return '', 204
        origin = request.headers.get('Origin', 'web-client')
        new_token = generate_token()
        token_manager.save_token(new_token, origin)
        return jsonify({'token': new_token, 'status': 'paired'})

    @app.route('/api/pair/verify', methods=['POST', 'OPTIONS'])
    def pair_verify():
        if request.method == 'OPTIONS':
            return '', 204
        if is_rate_limited('pair_verify', 10):
            return jsonify({'error': 'Rate limit exceeded'}), 429
            
        data = request.json or {}
        code = data.get('code')
        # If code is provided, verify it; if empty/auto, authenticate automatically
        if not code or code == 'auto':
            origin = request.headers.get('Origin', 'web-client')
            new_token = generate_token()
            token_manager.save_token(new_token, origin)
            return jsonify({'token': new_token, 'status': 'paired'})

        valid, result = token_manager.verify_pairing_code(code)
        if valid:
            return jsonify({'token': result, 'status': 'paired'})
        return jsonify({'error': result}), 403

    @app.route('/api/download', methods=['POST', 'OPTIONS'])
    def download():
        if request.method == 'OPTIONS':
            return '', 204
        if is_rate_limited('download'):
            return jsonify({'error': 'Rate limit exceeded'}), 429
            
        data = request.json or {}
        url = data.get('url')
        if not url:
            return jsonify({'error': 'URL required'}), 400
            
        format_type = data.get('format_type', 'video')
        quality = data.get('quality', 'best')
        download_id = 'dl_' + generate_token(12)
        downloader.start_download(url, download_id, format_type=format_type, quality=quality)
        return jsonify({'downloadId': download_id}), 202

    @app.route('/api/download/<download_id>/status', methods=['GET', 'OPTIONS'])
    def download_status(download_id):
        if request.method == 'OPTIONS':
            return '', 204
        status = downloader.get_status(download_id)
        if not status:
            return jsonify({'error': 'Not found'}), 404
        return jsonify(status)

    @app.route('/api/download/<download_id>/cancel', methods=['POST', 'OPTIONS'])
    def download_cancel(download_id):
        if request.method == 'OPTIONS':
            return '', 204
        cancelled = downloader.cancel_download(download_id)
        return jsonify({'cancelled': cancelled})

    @app.route('/api/config', methods=['GET', 'POST', 'OPTIONS'])
    def manage_config():
        if request.method == 'OPTIONS':
            return '', 204
        
        if request.method == 'GET':
            settings = dict(config.settings)
            return jsonify(settings)
            
        if request.method == 'POST':
            data = request.json or {}
            for k in ['download_path', 'use_browser_cookies', 'browser_for_cookies']:
                if k in data:
                    config.set(k, data[k])
            return jsonify(config.settings)

    def reveal_in_explorer(target_path):
        import ctypes
        from ctypes import wintypes
        import time

        target_path = os.path.normpath(target_path)
        user32 = ctypes.windll.user32

        # Allow newly launched or existing explorer window to take foreground
        try:
            user32.AllowSetForegroundWindow(-1)
        except Exception:
            pass

        creationflags = getattr(subprocess, 'CREATE_NO_WINDOW', 0x08000000)

        if os.path.isfile(target_path):
            subprocess.Popen(f'explorer.exe /select,"{target_path}"', creationflags=creationflags)
        else:
            subprocess.Popen(f'explorer.exe "{target_path}"', creationflags=creationflags)

        # Bring the Explorer window to front
        time.sleep(0.35)
        def enum_handler(hwnd, extra):
            if user32.IsWindowVisible(hwnd):
                length = user32.GetWindowTextLengthW(hwnd)
                if length > 0:
                    class_buff = ctypes.create_unicode_buffer(256)
                    user32.GetClassNameW(hwnd, class_buff, 256)
                    if class_buff.value in ('CabinetWClass', 'ExploreWClass'):
                        buff = ctypes.create_unicode_buffer(length + 1)
                        user32.GetWindowTextW(hwnd, buff, length + 1)
                        title = buff.value
                        folder_name = os.path.basename(os.path.dirname(target_path) if os.path.isfile(target_path) else target_path)
                        if not folder_name or folder_name.lower() in title.lower():
                            user32.ShowWindow(hwnd, 9)  # SW_RESTORE
                            user32.SetForegroundWindow(hwnd)
                            return False
            return True

        try:
            WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
            user32.EnumWindows(WNDENUMPROC(enum_handler), 0)
        except Exception:
            pass

    @app.route('/api/open-file', methods=['POST', 'OPTIONS'])
    def open_file():
        if request.method == 'OPTIONS':
            return '', 204
        data = request.json or {}
        filepath = data.get('filepath')
        filename = data.get('filename')
        download_path = config.get_download_path()
        
        try:
            # 1. If exact filepath exists, highlight file in Windows File Explorer
            if filepath and os.path.exists(filepath):
                reveal_in_explorer(filepath)
                return jsonify({'status': 'ok', 'opened': 'file'})

            # 2. If filename provided, check if it exists in the download directory
            if filename:
                candidate = os.path.join(download_path, filename)
                if os.path.exists(candidate):
                    reveal_in_explorer(candidate)
                    return jsonify({'status': 'ok', 'opened': 'file'})

            # 3. Fuzzy search: match normalized title in download directory
            search_term = filename or (os.path.basename(filepath) if filepath else '')
            if search_term and os.path.isdir(download_path):
                import re
                clean_search = re.sub(r'[\W_]+', '', search_term.lower()[:30])
                if clean_search:
                    for f in os.listdir(download_path):
                        clean_candidate = re.sub(r'[\W_]+', '', f.lower()[:30])
                        if clean_candidate and (clean_search in clean_candidate or clean_candidate in clean_search):
                            match_file = os.path.join(download_path, f)
                            reveal_in_explorer(match_file)
                            return jsonify({'status': 'ok', 'opened': 'file', 'matched': f})

            # 4. Fallback: open the download directory directly in File Explorer
            if os.path.exists(download_path):
                reveal_in_explorer(download_path)
                return jsonify({'status': 'ok', 'opened': 'folder'})

            return jsonify({'error': 'Path not found'}), 404
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return app

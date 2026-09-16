import os
import subprocess
import ctypes
from ctypes import wintypes
import re
from flask import Flask, request, jsonify, make_response, send_file
from flask_cors import CORS
from functools import wraps
import time
from .security import TokenManager, generate_token, is_safe_path, validate_media_url

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
        # Allow YouTube & Instagram
        if re.match(r'^https://([a-zA-Z0-9-]+\.)*youtube\.com$', origin):
            return True
        if re.match(r'^https://([a-zA-Z0-9-]+\.)*instagram\.com$', origin):
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

        # Allow browser file streaming via token query param or auth header
        if request.path.startswith('/api/file/download/'):
            token = request.args.get('token')
            if not token:
                auth_header = request.headers.get('Authorization', '')
                if auth_header.startswith('Bearer '):
                    token = auth_header.split(' ')[1]
            if not token or not token_manager.verify_token(token):
                return jsonify({'error': 'Unauthorized file access'}), 401
            return

        origin = request.headers.get('Origin')
        if origin:
            if request.path != '/api/health' and request.path != '/api/open-file':
                if not is_origin_allowed(origin):
                    return jsonify({'error': 'Origin not allowed'}), 403

        if request.path != '/api/health' and request.path != '/api/open-file':
            if request.headers.get('X-Requested-With') != 'InstaGrab':
                return jsonify({'error': 'Missing custom header'}), 403

        # Token auth
        if not request.path.startswith('/api/health') and not request.path.startswith('/api/pair/') and not request.path.startswith('/api/open-file'):
            auth_header = request.headers.get('Authorization', '')
            if not auth_header.startswith('Bearer '):
                return jsonify({'error': 'Missing token'}), 401
            token = auth_header.split(' ')[1]
            if not token_manager.verify_token(token):
                return jsonify({'error': 'Invalid token'}), 401

    @app.after_request
    def cors_middleware(response):
        origin = request.headers.get('Origin')
        if is_origin_allowed(origin) or ((request.path in ('/api/health', '/api/open-file') or request.path.startswith('/api/file/download/')) and origin):
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
        cookie_path = config.get_cookie_file_path()
        return jsonify({
            'status': 'ok',
            'version': '1.1.0',
            'downloadPath': config.get_download_path(),
            'ytdlpVersion': 'unknown',
            'paired': len(token_manager.tokens) > 0,
            'hasCookies': bool(cookie_path and os.path.exists(cookie_path))
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

    @app.route('/api/cookies/sync', methods=['POST', 'OPTIONS'])
    def sync_cookies():
        if request.method == 'OPTIONS':
            return '', 204
        data = request.json or {}
        cookies_list = data.get('cookies') or []
        if not cookies_list:
            return jsonify({'error': 'No cookies provided'}), 400
        
        platform = data.get('platform', 'instagram')
        saved = config.save_netscape_cookies(cookies_list, platform=platform)
        if saved:
            return jsonify({'success': True, 'count': len(cookies_list)})
        return jsonify({'error': 'Failed to save cookies'}), 500

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

        is_valid, err_msg, platform = validate_media_url(url)
        if not is_valid:
            return jsonify({'error': err_msg}), 400

        # Auto-sync cookies if provided with download request (strictly Instagram only)
        if data.get('cookies') and platform == 'instagram':
            try:
                config.save_netscape_cookies(data.get('cookies'), platform='instagram')
            except Exception:
                pass

        # Canonical normalization for Instagram URLs
        if platform == 'instagram' and not ('/stories/' in url or '/s/' in url):
            match = re.search(r'/(?:p|reel|reels|tv|share/reel|share/p)/([A-Za-z0-9_-]+)', url)
            if match:
                shortcode = match.group(1)
                content_type = 'reel' if 'reel' in url else ('tv' if '/tv/' in url else 'p')
                url = f"https://www.instagram.com/{content_type}/{shortcode}/"
            
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

    @app.route('/api/info', methods=['POST', 'OPTIONS'])
    def media_info():
        if request.method == 'OPTIONS':
            return '', 204
        data = request.json or {}
        url = data.get('url')
        if not url:
            return jsonify({'error': 'URL required'}), 400
        info = downloader.extract_media_info(url)
        return jsonify(info)

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

    class STARTUPINFOW(ctypes.Structure):
        _fields_ = [
            ('cb', wintypes.DWORD),
            ('lpReserved', wintypes.LPWSTR),
            ('lpDesktop', wintypes.LPWSTR),
            ('lpTitle', wintypes.LPWSTR),
            ('dwX', wintypes.DWORD),
            ('dwY', wintypes.DWORD),
            ('dwXSize', wintypes.DWORD),
            ('dwYSize', wintypes.DWORD),
            ('dwXCountChars', wintypes.DWORD),
            ('dwYCountChars', wintypes.DWORD),
            ('dwFillAttribute', wintypes.DWORD),
            ('dwFlags', wintypes.DWORD),
            ('wShowWindow', wintypes.WORD),
            ('cbReserved2', wintypes.WORD),
            ('lpReserved2', ctypes.c_char_p),
            ('hStdInput', wintypes.HANDLE),
            ('hStdOutput', wintypes.HANDLE),
            ('hStdError', wintypes.HANDLE),
        ]

    class PROCESS_INFORMATION(ctypes.Structure):
        _fields_ = [
            ('hProcess', wintypes.HANDLE),
            ('hThread', wintypes.HANDLE),
            ('dwProcessId', wintypes.DWORD),
            ('dwThreadId', wintypes.DWORD)
        ]

    def reveal_in_explorer(target_path):
        target_path = os.path.abspath(os.path.normpath(target_path))
        is_file = os.path.isfile(target_path)
        folder_path = os.path.dirname(target_path) if is_file else target_path
        folder_name = os.path.basename(folder_path).lower()

        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32

        # 1. Attach calling thread to interactive window station and desktop
        hdesk = None
        try:
            hwinsta = user32.OpenWindowStationW("WinSta0", False, 0x037F)
            if hwinsta:
                user32.SetProcessWindowStation(hwinsta)
            hdesk = user32.OpenDesktopW("Default", 0, False, 0x01FF)
            if hdesk:
                user32.SetThreadDesktop(hdesk)
        except Exception:
            pass

        # 2. Close any existing explorer windows displaying this folder to avoid duplicate windows and clutter
        try:
            h_prog = user32.FindWindowW("Progman", "Program Manager")
            shell_pid = ctypes.c_ulong()
            if h_prog:
                user32.GetWindowThreadProcessId(h_prog, ctypes.byref(shell_pid))

            WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
            def close_existing_cb(hwnd, lparam):
                if user32.IsWindowVisible(hwnd):
                    cbuff = ctypes.create_unicode_buffer(256)
                    user32.GetClassNameW(hwnd, cbuff, 256)
                    if cbuff.value in ('CabinetWClass', 'ExploreWClass'):
                        length = user32.GetWindowTextLengthW(hwnd)
                        if length > 0:
                            tbuff = ctypes.create_unicode_buffer(length + 1)
                            user32.GetWindowTextW(hwnd, tbuff, length + 1)
                            title = tbuff.value.lower()
                            if folder_name in title or (folder_name == 'instagrab' and 'instagrab' in title):
                                wpid = ctypes.c_ulong()
                                user32.GetWindowThreadProcessId(hwnd, ctypes.byref(wpid))
                                user32.PostMessageW(hwnd, 0x0010, 0, 0)  # WM_CLOSE
                                if wpid.value and wpid.value != shell_pid.value:
                                    hp = kernel32.OpenProcess(0x0001, False, wpid.value)
                                    if hp:
                                        kernel32.TerminateProcess(hp, 0)
                                        kernel32.CloseHandle(hp)
                return True

            if hdesk:
                user32.EnumDesktopWindows(hdesk, WNDENUMPROC(close_existing_cb), 0)
            else:
                user32.EnumWindows(WNDENUMPROC(close_existing_cb), 0)
            time.sleep(0.08)
        except Exception:
            pass

        # 3. Launch Explorer via Win32 CreateProcessW targeting WinSta0\Default directly (ZERO console popup)
        try:
            if is_file:
                cmd = f'explorer.exe /select,"{target_path}"'
            else:
                cmd = f'explorer.exe "{target_path}"'

            si = STARTUPINFOW()
            si.cb = ctypes.sizeof(STARTUPINFOW)
            si.lpDesktop = 'WinSta0\\Default'
            si.dwFlags = 1  # STARTF_USESHOWWINDOW
            si.wShowWindow = 1  # SW_SHOWNORMAL

            pi = PROCESS_INFORMATION()
            ret = kernel32.CreateProcessW(None, cmd, None, None, False, 0, None, None, ctypes.byref(si), ctypes.byref(pi))
            if ret:
                kernel32.CloseHandle(pi.hProcess)
                kernel32.CloseHandle(pi.hThread)
        except Exception:
            try:
                os.startfile(folder_path)
            except Exception:
                pass

        # 4. Find the opened Explorer window and bring to foreground above browser
        try:
            target_hwnd = None
            WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
            for _ in range(12):
                time.sleep(0.15)
                candidates = []

                def find_cb(hwnd, lparam):
                    if user32.IsWindowVisible(hwnd):
                        cbuff = ctypes.create_unicode_buffer(256)
                        user32.GetClassNameW(hwnd, cbuff, 256)
                        if cbuff.value in ('CabinetWClass', 'ExploreWClass'):
                            length = user32.GetWindowTextLengthW(hwnd)
                            if length > 0:
                                tbuff = ctypes.create_unicode_buffer(length + 1)
                                user32.GetWindowTextW(hwnd, tbuff, length + 1)
                                candidates.append((hwnd, tbuff.value.lower()))
                    return True

                if hdesk:
                    user32.EnumDesktopWindows(hdesk, WNDENUMPROC(find_cb), 0)
                else:
                    user32.EnumWindows(WNDENUMPROC(find_cb), 0)

                for hwnd, title in candidates:
                    if folder_name in title or 'instagrab' in title or 'download' in title:
                        target_hwnd = hwnd
                        break
                if target_hwnd:
                    break

            if target_hwnd:
                hwnd = target_hwnd
                user32.ShowWindow(hwnd, 9)  # SW_RESTORE

                fg_hwnd = user32.GetForegroundWindow()
                fg_tid = user32.GetWindowThreadProcessId(fg_hwnd, None)
                target_tid = user32.GetWindowThreadProcessId(hwnd, None)
                cur_tid = kernel32.GetCurrentThreadId()

                if fg_tid and fg_tid != cur_tid:
                    user32.AttachThreadInput(cur_tid, fg_tid, True)
                if target_tid and target_tid != cur_tid and target_tid != fg_tid:
                    user32.AttachThreadInput(cur_tid, target_tid, True)

                user32.keybd_event(0x12, 0, 0, 0)
                user32.keybd_event(0x12, 0, 2, 0)

                user32.AllowSetForegroundWindow(0xFFFFFFFF)

                SWP_FLAGS = 0x0001 | 0x0002 | 0x0040
                user32.SetWindowPos(hwnd, -1, 0, 0, 0, 0, SWP_FLAGS)
                user32.SetWindowPos(hwnd, -2, 0, 0, 0, 0, SWP_FLAGS)

                user32.BringWindowToTop(hwnd)
                user32.SetForegroundWindow(hwnd)

                if target_tid and target_tid != cur_tid and target_tid != fg_tid:
                    user32.AttachThreadInput(cur_tid, target_tid, False)
                if fg_tid and fg_tid != cur_tid:
                    user32.AttachThreadInput(cur_tid, fg_tid, False)
        except Exception:
            pass

        return True

    @app.route('/api/open-file', methods=['POST', 'OPTIONS'])
    def open_file():
        if request.method == 'OPTIONS':
            return '', 204
        data = request.json or {}
        filepath = data.get('filepath')
        filename = data.get('filename')
        title = data.get('title')
        download_path = os.path.normpath(config.get_download_path())
        user_downloads = os.path.normpath(os.path.expanduser('~/Downloads'))
        
        search_dirs = [download_path, user_downloads]
        
        try:
            # 1. If exact filepath exists, highlight file in Windows File Explorer
            if filepath and os.path.isfile(filepath):
                reveal_in_explorer(filepath)
                return jsonify({'status': 'ok', 'opened': 'file'})

            # 2. Check filename or title in InstaGrab folder or user Downloads folder
            for sdir in search_dirs:
                if os.path.isdir(sdir):
                    for name in [filename, title]:
                        if name:
                            candidate = os.path.join(sdir, name)
                            if os.path.isfile(candidate):
                                reveal_in_explorer(candidate)
                                return jsonify({'status': 'ok', 'opened': 'file'})

            # 3. Fuzzy search: match normalized title in both download directories
            search_term = filename or title or (os.path.basename(filepath) if filepath else '')
            if search_term:
                clean_search = re.sub(r'[\W_]+', '', search_term.lower()[:20])
                if clean_search:
                    for sdir in search_dirs:
                        if os.path.isdir(sdir):
                            for f in os.listdir(sdir):
                                clean_candidate = re.sub(r'[\W_]+', '', f.lower()[:20])
                                if clean_candidate and (clean_search in clean_candidate or clean_candidate in clean_search):
                                    match_file = os.path.join(sdir, f)
                                    if os.path.isfile(match_file):
                                        reveal_in_explorer(match_file)
                                        return jsonify({'status': 'ok', 'opened': 'file', 'matched': f})

            # 4. Fallback: ensure download directory exists and open it directly in File Explorer
            os.makedirs(download_path, exist_ok=True)
            reveal_in_explorer(download_path)
            return jsonify({'status': 'ok', 'opened': 'folder'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/file/download/<path:filename>', methods=['GET', 'OPTIONS'])
    def file_download_stream(filename):
        if request.method == 'OPTIONS':
            return make_response('', 204)
        download_path = config.get_download_path()
        target_path = os.path.join(download_path, filename)
        if is_safe_path(download_path, target_path) and os.path.isfile(target_path):
            return send_file(target_path, as_attachment=True, download_name=os.path.basename(target_path))

        # Fuzzy matching if exact filename has URL encoding discrepancies
        import re
        clean_search = re.sub(r'[\W_]+', '', filename.lower()[:30])
        if clean_search and os.path.isdir(download_path):
            for f in os.listdir(download_path):
                clean_candidate = re.sub(r'[\W_]+', '', f.lower()[:30])
                if clean_candidate and (clean_search in clean_candidate or clean_candidate in clean_search):
                    match_file = os.path.join(download_path, f)
                    if os.path.isfile(match_file):
                        return send_file(match_file, as_attachment=True, download_name=f)

        return jsonify({'error': 'File not found'}), 404

    return app

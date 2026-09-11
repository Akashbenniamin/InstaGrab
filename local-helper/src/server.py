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
            'version': '1.0.0',
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

    return app

"""Photo Studio: the owner's private photo uploader for the Photos page.

Run it on your own PC:  python photos/studio.py
It serves the site at http://127.0.0.1:8766/ and opens the Studio, which saves
new photos straight into photos/img/ and photos/photos.json in this folder.
They go live the next time the site is committed and pushed.

Only this PC can upload: the server listens on 127.0.0.1 alone, and it refuses
requests that come from any other web page. The public site has no server
behind it, so visitors there can't upload anything.
"""
import base64
import functools
import http.server
import json
import os
import re
import sys
import threading
import webbrowser

PORT = int(os.environ.get('STUDIO_PORT', '8766'))
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS = os.path.join(SITE, 'photos')
MANIFEST = os.path.join(PHOTOS, 'photos.json')
IMG = os.path.join(PHOTOS, 'img')

ID_RE = re.compile(r'^[a-z0-9-]{4,40}$')
DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
COLOR_RE = re.compile(r'^#[0-9a-fA-F]{6}$')
FONTS = {'sans', 'rounded', 'serif', 'hand', 'poster', 'mono'}
STYLES = {'shadow', 'outline', 'box', 'plain'}
ALIGNS = {'left', 'center', 'right'}
MAX_IMAGE = 15 * 1024 * 1024
lock = threading.Lock()


def num(v, lo, hi, dflt):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return dflt
    if v != v:
        return dflt
    return round(max(lo, min(hi, v)), 2)


def clean_texts(texts):
    out = []
    for L in (texts or [])[:30]:
        if not isinstance(L, dict):
            continue
        t = str(L.get('t', ''))[:400]
        if not t.strip():
            continue
        out.append({
            't': t,
            'x': num(L.get('x'), 0, 100, 50),
            'y': num(L.get('y'), 0, 100, 50),
            'size': num(L.get('size'), 1, 30, 8),
            'font': L.get('font') if L.get('font') in FONTS else 'sans',
            'color': L.get('color') if COLOR_RE.match(str(L.get('color', ''))) else '#ffffff',
            'style': L.get('style') if L.get('style') in STYLES else 'shadow',
            'align': L.get('align') if L.get('align') in ALIGNS else 'center',
            'rot': num(L.get('rot'), -45, 45, 0),
        })
    return out


def clean_meta(body, entry):
    entry['caption'] = str(body.get('caption', ''))[:200]
    d = str(body.get('date', ''))
    entry['date'] = d if DATE_RE.match(d) else ''
    entry['texts'] = clean_texts(body.get('texts'))
    return entry


def jpeg(b64):
    data = base64.b64decode(b64 or '', validate=True)
    if not data.startswith(b'\xff\xd8') or len(data) > MAX_IMAGE:
        raise ValueError('not a JPEG')
    return data


def load_manifest():
    with open(MANIFEST, encoding='utf-8') as f:
        data = json.load(f)
    if not isinstance(data.get('photos'), list):
        raise ValueError('photos.json has no photo list')
    return data


def save_manifest(data, before):
    # Never lose a photo: every photo that was there must still be there.
    ids = {p.get('id') for p in data['photos']}
    missing = [p.get('id') for p in before['photos'] if p.get('id') not in ids]
    if missing:
        raise RuntimeError('refusing to drop photos: %s' % missing)
    tmp = MANIFEST + '.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write('\n')
    os.replace(tmp, MANIFEST)


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def local_request(self):
        # Blocks other web pages (and other machines' DNS tricks) from using the API.
        host = self.headers.get('Host', '')
        origin = self.headers.get('Origin')
        ok_hosts = ('127.0.0.1:%d' % PORT, 'localhost:%d' % PORT)
        return host in ok_hosts and (origin is None or origin in ['http://' + h for h in ok_hosts])

    def reply(self, code, obj):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split('?')[0] == '/api/studio':
            if not self.local_request():
                return self.reply(403, {'error': 'forbidden'})
            with lock:
                return self.reply(200, {'ok': True, 'photos': load_manifest()['photos']})
        return super().do_GET()

    def do_POST(self):
        if not self.local_request() or self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            return self.reply(403, {'error': 'forbidden'})
        try:
            n = int(self.headers.get('Content-Length', '0'))
            if n > 3 * MAX_IMAGE:
                return self.reply(413, {'error': 'too big'})
            body = json.loads(self.rfile.read(n).decode('utf-8'))
            with lock:
                if self.path == '/api/photos/add':
                    return self.reply(200, self.add(body))
                if self.path == '/api/photos/update':
                    return self.reply(200, self.update(body))
            return self.reply(404, {'error': 'not found'})
        except Exception as e:  # report, don't crash the studio
            return self.reply(400, {'error': str(e)})

    def add(self, body):
        pid = str(body.get('id', ''))
        if not ID_RE.match(pid):
            raise ValueError('bad id')
        w, h = int(body.get('w', 0)), int(body.get('h', 0))
        if not (0 < w <= 8000 and 0 < h <= 8000):
            raise ValueError('bad size')
        full, thumb = jpeg(body.get('full')), jpeg(body.get('thumb'))
        before = load_manifest()
        if any(p.get('id') == pid for p in before['photos']):
            raise ValueError('that photo id already exists')
        src, tsrc = 'img/%s.jpg' % pid, 'img/%s-t.jpg' % pid
        for rel, data in ((src, full), (tsrc, thumb)):
            path = os.path.join(PHOTOS, rel)
            if os.path.exists(path):
                raise ValueError('file already exists: ' + rel)
            with open(path, 'wb') as f:
                f.write(data)
        entry = clean_meta(body, {'id': pid, 'src': src, 'thumb': tsrc, 'w': w, 'h': h})
        data = json.loads(json.dumps(before))
        data['photos'].insert(0, entry)  # newest first, like the gallery
        save_manifest(data, before)
        return {'ok': True, 'photos': data['photos']}

    def update(self, body):
        pid = str(body.get('id', ''))
        before = load_manifest()
        data = json.loads(json.dumps(before))
        for p in data['photos']:
            if p.get('id') == pid:
                clean_meta(body, p)  # only caption, date and text change; the image stays
                save_manifest(data, before)
                return {'ok': True, 'photos': data['photos']}
        raise ValueError('no photo with that id')

    def log_message(self, fmt, *args):
        if '/api/' in (args[0] if args else ''):
            sys.stderr.write('%s\n' % (fmt % args))


def main():
    os.makedirs(IMG, exist_ok=True)
    handler = functools.partial(Handler, directory=SITE)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), handler)
    url = 'http://127.0.0.1:%d/photos/studio/' % PORT
    print('Photo Studio is running at ' + url)
    print('Leave this window open while you work. Press Ctrl+C to stop.')
    if '--no-browser' not in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
Nova for macOS — SINGLE-FILE build.
====================================

This one file is a complete copy of Nova for the Mac. It bundles everything that
used to be separate files:

  * the browser UI                  (was browser_mac.py)
  * the ARTGEOrge Search engine     (was search_engine.py)  <- the 9-dot apps menu
  * the Nova logo / window icon     (was nova.png, embedded below as base64)
  * the setup + run instructions    (were requirements_mac.txt / *.command)

Because the search engine (which produces the 9-dot apps menu) is *inlined* here,
the Mac can no longer end up running a stale or missing search_engine.py — the
menu titles are always exactly the ones in THIS file (see APPS below).

--------------------------------------------------------------------------------
SETUP (one time) — in Terminal:
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install "PyQt6>=6.6" "PyQt6-WebEngine>=6.6"

RUN:
    python3 Nova_mac.py
    (run it from Terminal the first time so you can see the [Nova] startup lines)
--------------------------------------------------------------------------------

Renders web content with PyQt6 QtWebEngine (cross-platform Chromium) instead of
the Windows build's Microsoft Edge WebView2.
"""

import os
import sys
import json
import re
import html
import base64
import threading
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Enable WebGPU before QtWebEngine starts. (Don't force a GPU backend here —
# QtWebEngine already picks Metal/ANGLE on macOS; passing Vulkan would break it.)
os.environ.setdefault("QTWEBENGINE_CHROMIUM_FLAGS", "--enable-unsafe-webgpu")

from PyQt6.QtCore import QUrl, Qt, pyqtSignal, QTimer  # noqa: E402
from PyQt6.QtGui import QAction, QIcon, QKeySequence, QPixmap  # noqa: E402
from PyQt6.QtWidgets import (  # noqa: E402
    QApplication, QMainWindow, QTabWidget, QToolBar, QLineEdit,
    QFileDialog, QMenu, QToolButton, QLabel, QDialog, QListWidget,
    QListWidgetItem, QVBoxLayout, QHBoxLayout, QPushButton, QWidget,
)
from PyQt6.QtWebEngineWidgets import QWebEngineView  # noqa: E402
from PyQt6.QtWebEngineCore import (  # noqa: E402
    QWebEnginePage, QWebEngineProfile, QWebEngineSettings,
)

APP_NAME = "Nova"

# ============================================================================
# Embedded Nova logo (was nova.png). Decoded to the window icon at runtime.
# ============================================================================
NOVA_PNG_B64 = "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"

_ICON = None


def app_icon():
    """The Nova window icon, decoded from the embedded PNG (no external file)."""
    global _ICON
    if _ICON is None:
        try:
            pix = QPixmap()
            pix.loadFromData(base64.b64decode(NOVA_PNG_B64))
            _ICON = QIcon(pix)
        except Exception:
            _ICON = QIcon()
    return _ICON


# ============================================================================
# ARTGEOrge Search — inlined (was search_engine.py).
# A loopback HTTP server renders Nova's branded home + results + news pages.
# The 9-dot apps menu lives in _apps_menu() / the APPS list below.
# ============================================================================
ENGINE_NAME = "ARTGEOrge Search"
ARTGEORGE_URL = "https://artgeorge.github.io"

NEWS_TOPICS = [
    ("top", "Top", None),
    ("politics", "Politics", "SEARCH:politics"),
    ("us", "U.S.", "NATION"),
    ("world", "World", "WORLD"),
    ("tech", "Tech", "TECHNOLOGY"),
    ("sports", "Sports", "SPORTS"),
]
_TOPIC_SPEC = {key: spec for key, _, spec in NEWS_TOPICS}
_TOPIC_LABEL = {key: label for key, label, _ in NEWS_TOPICS}
_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def _fetch_ddg(query):
    data = urllib.parse.urlencode({"q": query, "kl": "us-en"}).encode("utf-8")
    req = urllib.request.Request(
        "https://html.duckduckgo.com/html/",
        data=data,
        headers={
            "User-Agent": _UA,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "text/html",
        },
    )
    with urllib.request.urlopen(req, timeout=12) as r:
        return r.read().decode("utf-8", "replace")


def _strip_tags(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def _decode_link(href):
    href = href.strip()
    if href.startswith("//"):
        href = "https:" + href
    parsed = urllib.parse.urlparse(href)
    if "duckduckgo.com" in parsed.netloc and parsed.path.startswith("/l/"):
        uddg = urllib.parse.parse_qs(parsed.query).get("uddg")
        if uddg:
            return urllib.parse.unquote(uddg[0])
    return href


def _parse_results(text, limit=20):
    results = []
    blocks = re.split(r'<a[^>]*class="result__a"', text)
    for block in blocks[1:]:
        m = re.search(r'href="([^"]+)"[^>]*>(.*?)</a>', block, re.S)
        if not m:
            continue
        url = _decode_link(m.group(1))
        title = _strip_tags(m.group(2))
        if not title or not url.startswith("http"):
            continue
        netloc = urllib.parse.urlparse(url).netloc.lower()
        if netloc.endswith("duckduckgo.com") or "/y.js" in url or "ad_provider=" in url:
            continue
        sm = re.search(r'class="result__snippet"[^>]*>(.*?)</a>', block, re.S)
        snippet = _strip_tags(sm.group(1)) if sm else ""
        results.append({"title": title, "url": url, "snippet": snippet})
        if len(results) >= limit:
            break
    return results


def _news_url(query="", topic=""):
    common = "hl=en-US&gl=US&ceid=US:en"
    if query:
        return f"https://news.google.com/rss/search?q={urllib.parse.quote(query)}&{common}"
    spec = _TOPIC_SPEC.get(topic)
    if spec and spec.startswith("SEARCH:"):
        return f"https://news.google.com/rss/search?q={urllib.parse.quote(spec[7:])}&{common}"
    if spec:
        return f"https://news.google.com/rss/headlines/section/topic/{spec}?{common}"
    return f"https://news.google.com/rss?{common}"


def _fetch_news(query="", topic=""):
    req = urllib.request.Request(_news_url(query, topic), headers={"User-Agent": _UA})
    with urllib.request.urlopen(req, timeout=12) as r:
        return r.read()


def _relative_time(pubdate):
    try:
        dt = parsedate_to_datetime(pubdate)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        secs = (datetime.now(timezone.utc) - dt).total_seconds()
    except Exception:
        return ""
    if secs < 90:
        return "just now"
    for unit, n in (("d", 86400), ("h", 3600), ("m", 60)):
        if secs >= n:
            return f"{int(secs // n)}{unit} ago"
    return "just now"


def _parse_news(xml_bytes, limit=30):
    items = []
    try:
        root = ET.fromstring(xml_bytes)
    except Exception:
        return items
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub = item.findtext("pubDate") or ""
        src_el = item.find("source")
        source = (src_el.text or "").strip() if src_el is not None else ""
        if source and title.endswith(" - " + source):
            title = title[: -(len(source) + 3)].strip()
        if not title or not link:
            continue
        items.append({"title": title, "url": link, "source": source,
                      "time": _relative_time(pub)})
        if len(items) >= limit:
            break
    return items


_CSS = """
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
       background: #16131f; color: #e8eaed; }
a { color: inherit; text-decoration: none; }
.wrap { max-width: 720px; margin: 0 auto; padding: 0 20px; }
.logo { font-weight: 800; letter-spacing: -1px; }
.logo .a { background: linear-gradient(90deg,#a78bfa,#7c5cff); -webkit-background-clip: text;
           background-clip: text; color: transparent; }
.logo .s { color: #e8eaed; }
form.box { display: flex; gap: 8px; }
input[type=text] { flex: 1; background: #241d33; border: 1px solid #34294d; color: #fff;
                   border-radius: 24px; padding: 13px 20px; font-size: 16px; outline: none; }
input[type=text]:focus { border-color: #8b6cff; background: #2a2240; }
button { background: linear-gradient(90deg,#7c5cff,#a78bfa); color: #fff; border: none;
         border-radius: 24px; padding: 0 22px; font-size: 15px; font-weight: 600; cursor: pointer; }
button:hover { filter: brightness(1.08); }

.home { min-height: 100vh; display: flex; flex-direction: column;
        align-items: center; justify-content: center; }
.home .logo { font-size: 60px; margin-bottom: 26px; }
.home form.box { width: min(560px, 90vw); }
.home .tag { margin-top: 22px; color: #8b8595; font-size: 13px; }

.top { position: sticky; top: 0; background: #16131f; padding: 16px 0 12px;
       border-bottom: 1px solid #271f38; }
.top .row { display: flex; align-items: center; gap: 18px; }
.top .logo { font-size: 24px; white-space: nowrap; }
.res { padding: 22px 0 60px; }
.r { margin-bottom: 26px; }
.r .u { color: #9b8cff; font-size: 13px; }
.r .t { font-size: 19px; color: #cdbcff; margin: 3px 0; }
.r .t:hover { text-decoration: underline; }
.r .sn { color: #b9b4c4; font-size: 14px; line-height: 1.5; }
.empty { padding: 60px 0; color: #8b8595; text-align: center; }
.empty a { color: #9b8cff; text-decoration: underline; }

.apps { position: fixed; top: 14px; right: 18px; z-index: 90; }
.appsbtn { background: transparent; border: none; padding: 8px; border-radius: 50%;
           cursor: pointer; display: flex; }
.appsbtn:hover { background: #271f38; }
.appsbtn svg { width: 22px; height: 22px; fill: #cfc7e0; }
.appsmenu { position: absolute; top: 46px; right: 0; width: 264px; background: #1d1830;
            border: 1px solid #322a47; border-radius: 16px; padding: 14px;
            grid-template-columns: repeat(3, 1fr); gap: 4px; display: none;
            box-shadow: 0 14px 44px rgba(0,0,0,.55); }
.appsmenu.open { display: grid; }
.app { display: flex; flex-direction: column; align-items: center; gap: 7px;
       padding: 12px 4px; border-radius: 12px; text-align: center; }
.app:hover { background: #271f38; }
.app .ai { font-size: 27px; line-height: 1; }
.app .al { font-size: 12px; color: #cfc7e0; }

.scope { display: flex; gap: 8px; margin-top: 12px; }
.scope a { font-size: 13px; color: #b9b4c4; padding: 6px 14px; border-radius: 14px; }
.scope a.active { background: #2a2240; color: #cdbcff; }
.scope a:hover { background: #241d33; }

.topics { display: flex; gap: 4px; margin-top: 12px; overflow-x: auto;
          border-top: 1px solid #271f38; padding-top: 10px; }
.topics a { font-size: 14px; color: #b9b4c4; padding: 7px 14px; border-radius: 8px;
            white-space: nowrap; }
.topics a.active { color: #cdbcff; box-shadow: inset 0 -2px 0 #8b6cff; border-radius: 0; }
.topics a:hover { background: #241d33; }

.nart { padding: 16px 0; border-bottom: 1px solid #241d33; }
.nart .nsrc { color: #9b8cff; font-size: 12px; margin-bottom: 4px; }
.nart .nt { font-size: 18px; color: #e8eaed; line-height: 1.35; }
.nart .nt:hover { text-decoration: underline; }
"""


def _page(title, body):
    return (f"<!doctype html><html><head><meta charset='utf-8'>"
            f"<meta name='viewport' content='width=device-width,initial-scale=1'>"
            f"<title>{html.escape(title)}</title><style>{_CSS}</style></head>"
            f"<body>{body}</body></html>")


def _logo_html():
    return "<span class='logo'><span class='a'>ARTGEOrge</span> <span class='s'>Search</span></span>"


def _search_form(value="", action="/search", placeholder="Search the web"):
    v = html.escape(value, quote=True)
    return (f"<form class='box' action='{action}' method='get' autocomplete='off'>"
            f"<input type='text' name='q' value=\"{v}\" placeholder='{html.escape(placeholder)}' autofocus>"
            f"<button type='submit'>Search</button></form>")


def _grid_svg():
    dots = "".join(f"<circle cx='{4 + c * 7}' cy='{4 + r * 7}' r='2'/>"
                   for r in range(3) for c in range(3))
    return f"<svg viewBox='0 0 22 22'>{dots}</svg>"


# The 9-dot apps menu. Edit this list to change the tiles — it is the single
# source of truth (no separate file). Tiles to artgeorge.github.io are live and
# work on the Mac; 127.0.0.1 tiles are local apps and only work where they run.
def _apps_menu(query=""):
    q = urllib.parse.quote(query)
    if query:
        web = f"/search?q={q}"
        yt = f"https://www.youtube.com/results?search_query={q}"
        news = f"/news?q={q}"
    else:
        web, yt, news = "/", "https://www.youtube.com", "/news"
    a = ARTGEORGE_URL.rstrip("/")
    apps = [("🔎", "Search", web), ("▶️", "YouTube", yt), ("📰", "News", news),
            ("🎮", "Arcade", a + "/"),
            ("📊", "Sheets", a + "/sheets/"),
            ("📝", "Docs", a + "/docs/"),
            ("📽️", "Slides", a + "/slides/"),
            ("📖", "Encyclopedia", a + "/encyclopedia/"),
            ("🧊", "3D Shapes", a + "/3d-shapes/"),
            ("🧮", "Math Solver", a + "/math-solver/"),
            ("💻", "Playground", a + "/playground/"),
            ("🔐", "Cipher", a + "/cipher/"),
            ("⬆️", "ResUp", "http://127.0.0.1:5007/"),
            ("🎞️", "Aria Player", a + "/aria/"),
            ("🤖", "AI Chat", a + "/chat-bot-ai/")]
    items = "".join(
        f"<a class='app' href='{html.escape(u, quote=True)}'>"
        f"<span class='ai'>{i}</span><span class='al'>{html.escape(l)}</span></a>"
        for i, l, u in apps)
    return (
        f"<div class='apps'><button class='appsbtn' id='appsbtn' aria-label='Apps'>"
        f"{_grid_svg()}</button><div class='appsmenu' id='appsmenu'>{items}</div></div>"
        "<script>(function(){var b=document.getElementById('appsbtn'),"
        "m=document.getElementById('appsmenu');"
        "b.addEventListener('click',function(e){e.stopPropagation();m.classList.toggle('open');});"
        "document.addEventListener('click',function(){m.classList.remove('open');});})();</script>"
    )


def _scope(active, query=""):
    q = urllib.parse.quote(query)
    web = f"/search?q={q}" if query else "/"
    yt = (f"https://www.youtube.com/results?search_query={q}" if query
          else "https://www.youtube.com")
    news = f"/news?q={q}" if query else "/news"
    def a(name, label, href):
        cls = " active" if name == active else ""
        return f"<a class='{cls.strip()}' href='{html.escape(href, quote=True)}'>{label}</a>"
    return (f"<div class='scope'>{a('web', 'Web', web)}"
            f"{a('yt', 'YouTube', yt)}{a('news', 'News', news)}</div>")


def _news_topics(active="top", searching=False):
    out = []
    for key, label, _ in NEWS_TOPICS:
        href = "/news" if key == "top" else f"/news?topic={key}"
        cls = " active" if (not searching and key == active) else ""
        out.append(f"<a class='{cls.strip()}' href='{href}'>{html.escape(label)}</a>")
    return f"<div class='topics'>{''.join(out)}</div>"


def home_page():
    body = (f"{_apps_menu()}<div class='home'>{_logo_html()}{_search_form()}"
            f"<div class='tag'>Your browser's own search engine</div></div>")
    return _page(ENGINE_NAME, body)


def results_page(query):
    query = (query or "").strip()
    if not query:
        return home_page()
    top = (f"{_apps_menu(query)}<div class='top'><div class='wrap'><div class='row'>"
           f"<a href='/'>{_logo_html()}</a>{_search_form(query)}</div>"
           f"{_scope('web', query)}</div></div>")
    try:
        results = _parse_results(_fetch_ddg(query))
    except Exception:
        results = None

    if results is None:
        ddg = "https://duckduckgo.com/?q=" + urllib.parse.quote(query)
        inner = (f"<div class='empty'>Couldn't reach the web index right now.<br>"
                 f"<a href='{html.escape(ddg)}'>Try this search on DuckDuckGo</a></div>")
    elif not results:
        inner = f"<div class='empty'>No results for <b>{html.escape(query)}</b>.</div>"
    else:
        parts = []
        for r in results:
            disp = html.escape(r["url"])
            parts.append(
                f"<div class='r'>"
                f"<div class='u'>{disp}</div>"
                f"<a class='t' href='{html.escape(r['url'], quote=True)}'>{html.escape(r['title'])}</a>"
                f"<div class='sn'>{html.escape(r['snippet'])}</div>"
                f"</div>"
            )
        inner = "".join(parts)
    body = f"{top}<div class='wrap res'>{inner}</div>"
    return _page(f"{query} — {ENGINE_NAME}", body)


def news_page(query="", topic="top"):
    query = (query or "").strip()
    topic = topic if topic in _TOPIC_SPEC else "top"
    form = _search_form(query, action="/news", placeholder="Search news")
    top = (f"{_apps_menu(query)}<div class='top'><div class='wrap'><div class='row'>"
           f"<a href='/'>{_logo_html()}</a>{form}</div>"
           f"{_scope('news', query)}{_news_topics(topic, searching=bool(query))}</div></div>")
    try:
        articles = _parse_news(_fetch_news(query, topic))
    except Exception:
        articles = None

    if articles is None:
        inner = "<div class='empty'>Couldn't load the news right now. Try again shortly.</div>"
    elif not articles:
        inner = f"<div class='empty'>No news found for <b>{html.escape(query)}</b>.</div>"
    else:
        parts = []
        for a in articles:
            meta = " · ".join(x for x in (html.escape(a["source"]), html.escape(a["time"])) if x)
            parts.append(
                f"<div class='nart'><div class='nsrc'>{meta}</div>"
                f"<a class='nt' href='{html.escape(a['url'], quote=True)}'>{html.escape(a['title'])}</a>"
                f"</div>")
        inner = "".join(parts)
    if query:
        heading = f"{query} — News"
    elif topic != "top":
        heading = f"{_TOPIC_LABEL[topic]} — News"
    else:
        heading = "Top stories"
    body = f"{top}<div class='wrap res'>{inner}</div>"
    return _page(f"{heading} — {ENGINE_NAME}", body)


class _Handler(BaseHTTPRequestHandler):
    def _send(self, body, status=200, ctype="text/html; charset=utf-8"):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        try:
            self.wfile.write(data)
        except Exception:
            pass

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/":
            self._send(home_page())
        elif parsed.path == "/search":
            q = urllib.parse.parse_qs(parsed.query).get("q", [""])[0]
            self._send(results_page(q))
        elif parsed.path == "/news":
            qs = urllib.parse.parse_qs(parsed.query)
            q = qs.get("q", [""])[0]
            topic = qs.get("topic", ["top"])[0]
            self._send(news_page(q, topic))
        elif parsed.path == "/favicon.ico":
            self.send_response(204); self.end_headers()
        else:
            self._send("<h1>Not found</h1>", status=404)

    def log_message(self, *args):
        pass


def start():
    """Start the search server on a free loopback port; return its base URL."""
    server = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{port}"


# ============================================================================
# Start the inlined search engine; it's both the home page and the search bar.
# ============================================================================
_SEARCH_BASE = start()
HOME_URL = _SEARCH_BASE + "/"
SEARCH_URL = _SEARCH_BASE + "/search?q={}"


def _selftest_search_server():
    try:
        with urllib.request.urlopen(HOME_URL, timeout=4) as r:
            page = r.read().decode("utf-8", "replace")
        ok = ("appsbtn" in page) and ("ARTGEOrge" in page)
        print(f"[Nova] ARTGEOrge server: {HOME_URL}  reachable=True  "
              f"9-dot+logo={ok}", file=sys.stderr)
    except Exception as ex:
        print(f"[Nova] ARTGEOrge server: {HOME_URL}  reachable=False  ({ex})",
              file=sys.stderr)


_selftest_search_server()


# Profile (cookies, cache, bookmarks, history) lives next to this file.
APP_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(APP_DIR, "profile")
ENGINE_DATA = os.path.join(DATA_DIR, "wv2")
BOOKMARKS_FILE = os.path.join(DATA_DIR, "bookmarks.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")
os.makedirs(DATA_DIR, exist_ok=True)


def _load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def _save_json(path, data):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass


def make_url(text):
    """Turn what the user typed into a URL — or an ARTGEOrge search if it isn't one."""
    text = text.strip()
    if not text:
        return None
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.\-]*://", text) or text.startswith("about:"):
        return text
    if text == "localhost" or text.startswith("localhost:"):
        return "http://" + text
    if " " not in text and "." in text:
        return "https://" + text
    return SEARCH_URL.format(urllib.parse.quote(text))


# ============================================================================
# WebEngine profiles + downloads
# ============================================================================
def _wire_profile(profile):
    profile.downloadRequested.connect(_on_download_requested)
    s = profile.settings()
    for attr in (
        QWebEngineSettings.WebAttribute.PluginsEnabled,
        QWebEngineSettings.WebAttribute.FullScreenSupportEnabled,
        QWebEngineSettings.WebAttribute.ScreenCaptureEnabled,
        QWebEngineSettings.WebAttribute.JavascriptCanOpenWindows,
        QWebEngineSettings.WebAttribute.LocalStorageEnabled,
        QWebEngineSettings.WebAttribute.ScrollAnimatorEnabled,
        QWebEngineSettings.WebAttribute.PdfViewerEnabled,
    ):
        try:
            s.setAttribute(attr, True)
        except Exception:
            pass


def _normal_profile():
    app = QApplication.instance()
    p = getattr(app, "_normal_profile", None)
    if p is None:
        p = QWebEngineProfile("NovaProfile", app)
        p.setPersistentStoragePath(ENGINE_DATA)
        p.setCachePath(os.path.join(ENGINE_DATA, "cache"))
        p.setPersistentCookiesPolicy(
            QWebEngineProfile.PersistentCookiesPolicy.ForcePersistentCookies)
        _wire_profile(p)
        app._normal_profile = p
    return p


def _private_profile():
    app = QApplication.instance()
    p = getattr(app, "_private_profile", None)
    if p is None:
        p = QWebEngineProfile(app)   # no name => off-the-record
        _wire_profile(p)
        app._private_profile = p
    return p


def _on_download_requested(download):
    try:
        try:
            suggested = os.path.join(download.downloadDirectory(),
                                     download.downloadFileName())
        except Exception:
            suggested = download.downloadFileName()
        path, _ = QFileDialog.getSaveFileName(
            QApplication.activeWindow(), "Save file", suggested)
        if path:
            download.setDownloadDirectory(os.path.dirname(path))
            download.setDownloadFileName(os.path.basename(path))
            download.accept()
        else:
            download.cancel()
    except Exception:
        try:
            download.cancel()
        except Exception:
            pass


class WebPage(QWebEnginePage):
    def __init__(self, profile, parent=None):
        super().__init__(profile, parent)
        self.on_new_window = None
        self.on_fullscreen = None
        self.fullScreenRequested.connect(self._on_fullscreen)

    def createWindow(self, _type):
        if self.on_new_window:
            return self.on_new_window()
        return super().createWindow(_type)

    def _on_fullscreen(self, req):
        try:
            req.accept()
            if self.on_fullscreen:
                self.on_fullscreen(req.toggleOn())
        except Exception:
            pass


class WebTab(QWidget):
    urlChanged = pyqtSignal(str)
    titleChanged = pyqtSignal(str)
    loadingChanged = pyqtSignal(bool)
    historyChanged = pyqtSignal()
    newWindow = pyqtSignal(str)

    def __init__(self, url=None, private=False):
        super().__init__()
        self.private = private
        profile = _private_profile() if private else _normal_profile()

        self.view = QWebEngineView(self)
        self.page = WebPage(profile, self.view)
        self.view.setPage(self.page)

        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)
        lay.addWidget(self.view)

        self._title = ""
        self.view.urlChanged.connect(lambda u: (self.urlChanged.emit(u.toString()),
                                                 self.historyChanged.emit()))
        self.view.titleChanged.connect(self._on_title)
        self.view.loadStarted.connect(lambda: self.loadingChanged.emit(True))
        self.view.loadFinished.connect(self._on_load_finished)

        if url:
            self.navigate(url)

    def _on_title(self, t):
        self._title = t or ""
        self.titleChanged.emit(self._title)

    def _on_load_finished(self, ok):
        if not ok:
            print(f"[Nova] load FAILED: {self.current_url()!r}", file=sys.stderr)
        self.loadingChanged.emit(False)
        self.historyChanged.emit()

    def navigate(self, url):
        self.view.setUrl(QUrl(url))

    def back(self):
        self.view.history().back()

    def forward(self):
        self.view.history().forward()

    def reload(self):
        self.view.reload()

    def stop(self):
        self.view.stop()

    def current_url(self):
        return self.view.url().toString()

    def title(self):
        return self._title or self.view.title() or ""

    def can_go_back(self):
        return self.view.history().canGoBack()

    def can_go_forward(self):
        return self.view.history().canGoForward()

    def set_zoom(self, factor):
        self.view.setZoomFactor(max(0.25, min(5.0, factor)))

    def zoom(self):
        return self.view.zoomFactor()

    def teardown(self):
        try:
            self.view.setPage(None)
            self.page.deleteLater()
            self.view.deleteLater()
        except Exception:
            pass


# ============================================================================
# Themes
# ============================================================================
DARK_QSS = """
QMainWindow, QWidget#central { background: #202124; }
QToolBar { background: #2b2d31; border: 0; spacing: 4px; padding: 4px 6px; }
QToolBar#bm { background: #26282c; border-top: 1px solid #3c4043; padding: 2px 6px; }
QToolButton { color: #e8eaed; background: transparent; border: none; border-radius: 8px;
              padding: 4px 9px; font-size: 17px; }
QToolButton:hover { background: #3c4043; }
QToolButton:disabled { color: #5f6368; }
QLineEdit#urlbar { background: #3c4043; color: #e8eaed; border: 1px solid #3c4043;
                   border-radius: 16px; padding: 7px 14px; font-size: 14px; selection-background-color:#8ab4f8;}
QLineEdit#urlbar:focus { border-color: #8ab4f8; background: #303134; }
QTabWidget::pane { border: 0; }
QTabBar::tab { background: #2b2d31; color: #bdc1c6; padding: 7px 12px; margin-right: 2px;
               border-top-left-radius: 9px; border-top-right-radius: 9px; }
QTabBar::tab:selected { background: #3c4043; color: #ffffff; }
QTabBar::tab:hover { background: #353638; }
QMenu { background: #2b2d31; color: #e8eaed; border: 1px solid #5f6368; }
QMenu::item:selected { background: #3c4043; }
QLabel#pill { color: #c8a6ff; font-size: 12px; padding: 0 8px; }
"""

LIGHT_QSS = """
QMainWindow, QWidget#central { background: #f5f6f8; }
QToolBar { background: #ffffff; border: 0; spacing: 4px; padding: 4px 6px; }
QToolBar#bm { background: #f3f4f6; border-top: 1px solid #e2e5ea; padding: 2px 6px; }
QToolButton { color: #3c4043; background: transparent; border: none; border-radius: 8px;
              padding: 4px 9px; font-size: 17px; }
QToolButton:hover { background: #eceff3; }
QToolButton:disabled { color: #c0c4cc; }
QLineEdit#urlbar { background: #eef0f3; color: #202124; border: 1px solid #eef0f3;
                   border-radius: 16px; padding: 7px 14px; font-size: 14px; }
QLineEdit#urlbar:focus { border-color: #4f8cff; background: #ffffff; }
QTabWidget::pane { border: 0; }
QTabBar::tab { background: #e8eaed; color: #5f6368; padding: 7px 12px; margin-right: 2px;
               border-top-left-radius: 9px; border-top-right-radius: 9px; }
QTabBar::tab:selected { background: #ffffff; color: #202124; }
QLabel#pill { color: #7c5cff; font-size: 12px; padding: 0 8px; }
"""

PRIVATE_QSS = DARK_QSS + """
QMainWindow, QWidget#central { background: #1b1726; }
QToolBar { background: #241d33; }
QLineEdit#urlbar { background: #2e2542; border-color: #2e2542; }
QLineEdit#urlbar:focus { border-color: #b794ff; }
QTabBar::tab:selected { background: #3a2f55; }
"""


class UrlBar(QLineEdit):
    def mousePressEvent(self, e):
        had_focus = self.hasFocus()
        super().mousePressEvent(e)
        if not had_focus:
            QTimer.singleShot(0, self.selectAll)


class HistoryDialog(QDialog):
    def __init__(self, browser):
        super().__init__(browser)
        self.browser = browser
        self.setWindowTitle("History")
        self.resize(620, 480)
        lay = QVBoxLayout(self)

        self.search = QLineEdit()
        self.search.setPlaceholderText("Search history…")
        self.search.textChanged.connect(self._populate)
        lay.addWidget(self.search)

        self.list = QListWidget()
        self.list.itemActivated.connect(self._open)
        self.list.itemDoubleClicked.connect(self._open)
        lay.addWidget(self.list)

        row = QHBoxLayout()
        row.addStretch(1)
        clear = QPushButton("Clear history")
        clear.clicked.connect(self._clear)
        row.addWidget(clear)
        lay.addLayout(row)

        self._populate()

    def _entries(self):
        return QApplication.instance()._history

    def _populate(self):
        q = self.search.text().lower().strip()
        self.list.clear()
        for e in reversed(self._entries()):
            title, url = e.get("title", ""), e.get("url", "")
            if q and q not in title.lower() and q not in url.lower():
                continue
            it = QListWidgetItem(f"{title}\n{url}")
            it.setData(Qt.ItemDataRole.UserRole, url)
            self.list.addItem(it)

    def _open(self, item):
        url = item.data(Qt.ItemDataRole.UserRole)
        if url:
            self.browser.add_tab(url)
            self.close()

    def _clear(self):
        self._entries().clear()
        _save_json(HISTORY_FILE, [])
        self._populate()


class Browser(QMainWindow):
    def __init__(self, private=False):
        super().__init__()
        self.private = private
        self.setWindowIcon(app_icon())

        self.bookmarks = _load_json(BOOKMARKS_FILE, [])
        self.resize(1280, 820)
        self._update_title()

        central = QWidget()
        central.setObjectName("central")
        self.setCentralWidget(central)
        outer = QVBoxLayout(central)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        self.tabs = QTabWidget()
        self.tabs.setDocumentMode(True)
        self.tabs.setTabsClosable(True)
        self.tabs.setMovable(True)
        self.tabs.tabCloseRequested.connect(self.close_tab)
        self.tabs.currentChanged.connect(self._on_tab_changed)

        self._build_toolbar()
        self._build_bookmark_bar()
        outer.addWidget(self.tabs)

        self._install_shortcuts()
        self.apply_theme()
        self.add_tab(HOME_URL)

    def _act(self, glyph, tip, fn, shortcut=None):
        a = QAction(glyph, self)
        a.setToolTip(tip + (f"  ({shortcut})" if shortcut else ""))
        a.triggered.connect(fn)
        return a

    def _build_toolbar(self):
        nav = QToolBar("Navigation")
        nav.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextOnly)
        nav.setMovable(False)
        self.addToolBar(nav)

        self.act_back = self._act("←", "Back", lambda: self._cur_do("back"))
        self.act_fwd = self._act("→", "Forward", lambda: self._cur_do("forward"))
        self.act_reload = self._act("⟳", "Reload", self._reload_or_stop)
        self.act_home = self._act("⌂", "Home", lambda: self._cur_do("navigate", HOME_URL))
        for a in (self.act_back, self.act_fwd, self.act_reload, self.act_home):
            nav.addAction(a)

        self.urlbar = UrlBar()
        self.urlbar.setObjectName("urlbar")
        self.urlbar.setPlaceholderText("Search the web or type a URL")
        self.urlbar.setClearButtonEnabled(True)
        self.urlbar.returnPressed.connect(self._navigate_from_bar)
        nav.addWidget(self.urlbar)

        if self.private:
            pill = QLabel("🔒 Private")
            pill.setObjectName("pill")
            nav.addWidget(pill)

        self.act_star = self._act("☆", "Bookmark this page", self._bookmark_current, "⌘D")
        nav.addAction(self.act_star)
        nav.addAction(self._act("＋", "New tab", lambda: self.add_tab(HOME_URL), "⌘T"))

        menu_btn = QToolButton()
        menu_btn.setText("⋮")
        menu_btn.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        menu = QMenu(menu_btn)
        menu.addAction("New Tab\t⌘T", lambda: self.add_tab(HOME_URL))
        menu.addAction("New Window\t⌘N", self._new_window)
        menu.addAction("New Private Window\t⇧⌘N", self._new_private_window)
        menu.addSeparator()
        menu.addAction("History\t⌘Y", self.show_history)
        menu.addAction("Bookmark This Page\t⌘D", self._bookmark_current)
        menu.addSeparator()
        menu.addAction("Toggle Dark / Light Theme", self._toggle_theme)
        menu.addAction("Zoom In\t⌘+", lambda: self._zoom(0.1))
        menu.addAction("Zoom Out\t⌘-", lambda: self._zoom(-0.1))
        menu.addAction("Reset Zoom\t⌘0", lambda: self._set_zoom(1.0))
        menu.addSeparator()
        menu.addAction("Quit\t⌘Q", self.close)
        menu_btn.setMenu(menu)
        nav.addWidget(menu_btn)

    def _build_bookmark_bar(self):
        self.bm_bar = QToolBar("Bookmarks")
        self.bm_bar.setObjectName("bm")
        self.bm_bar.setMovable(False)
        self.addToolBarBreak()
        self.addToolBar(self.bm_bar)
        self._refresh_bookmark_bar()

    def _refresh_bookmark_bar(self):
        self.bm_bar.clear()
        if not self.bookmarks:
            lbl = QLabel("  Bookmark pages with the ☆ button — they'll appear here  ")
            lbl.setObjectName("pill")
            self.bm_bar.addWidget(lbl)
            return
        for bm in self.bookmarks:
            title = bm.get("title") or bm.get("url", "")
            a = QAction((title[:22] + "…") if len(title) > 23 else title, self)
            a.setToolTip(bm.get("url", ""))
            url = bm.get("url", "")
            a.triggered.connect(lambda _=False, u=url: self._cur_do("navigate", u))
            self.bm_bar.addAction(a)

    def apply_theme(self):
        app = QApplication.instance()
        if self.private:
            self.setStyleSheet(PRIVATE_QSS)
        else:
            theme = app._settings.get("theme", "dark")
            self.setStyleSheet(DARK_QSS if theme == "dark" else LIGHT_QSS)

    def _toggle_theme(self):
        app = QApplication.instance()
        app._settings["theme"] = "light" if app._settings.get("theme", "dark") == "dark" else "dark"
        _save_json(SETTINGS_FILE, app._settings)
        for w in app._windows:
            w.apply_theme()

    def add_tab(self, url=None, switch=True):
        tab = WebTab(url=url, private=self.private)
        tab.urlChanged.connect(lambda u, t=tab: self._on_url_changed(t, u))
        tab.titleChanged.connect(lambda s, t=tab: self._set_tab_title(t, s))
        tab.loadingChanged.connect(lambda loading, t=tab: self._on_loading(t, loading))
        tab.historyChanged.connect(lambda t=tab: self._on_history(t))
        tab.page.on_new_window = self._new_tab_page
        tab.page.on_fullscreen = self._on_page_fullscreen

        idx = self.tabs.addTab(tab, "New Tab")
        if switch:
            self.tabs.setCurrentIndex(idx)
        return tab

    def _new_tab_page(self):
        tab = self.add_tab(None, switch=True)
        return tab.page

    def _on_page_fullscreen(self, on):
        if on:
            self.showFullScreen()
        else:
            self.showNormal()

    def close_tab(self, index):
        w = self.tabs.widget(index)
        if self.tabs.count() <= 1:
            self.add_tab(HOME_URL)
        self.tabs.removeTab(index)
        if isinstance(w, WebTab):
            w.teardown()
            w.deleteLater()

    def current(self):
        return self.tabs.currentWidget()

    def _cur_do(self, method, *args):
        w = self.current()
        if isinstance(w, WebTab):
            getattr(w, method)(*args)

    def _set_tab_title(self, tab, title):
        i = self.tabs.indexOf(tab)
        if i >= 0:
            title = title or "New Tab"
            self.tabs.setTabText(i, (title[:20] + "…") if len(title) > 21 else title)
            self.tabs.setTabToolTip(i, title)
            if tab is self.current():
                self._update_title(title)
        if title and tab is self.current():
            self._record_history(tab)

    def _update_title(self, page_title=None):
        prefix = "Private — " if self.private else ""
        self.setWindowTitle(f"{prefix}{page_title} — {APP_NAME}" if page_title else f"{prefix}{APP_NAME}")

    def _on_tab_changed(self, _index):
        w = self.current()
        if isinstance(w, WebTab):
            self._sync_urlbar(w)
            self._update_title(w.title() or None)

    def focus_urlbar(self):
        self.activateWindow()
        self.raise_()
        self.urlbar.setFocus(Qt.FocusReason.ShortcutFocusReason)
        self.urlbar.selectAll()

    def _navigate_from_bar(self):
        url = make_url(self.urlbar.text())
        if url:
            self._cur_do("navigate", url)

    def _on_url_changed(self, tab, url):
        if tab is self.current():
            self._sync_urlbar(tab)

    def _sync_urlbar(self, tab):
        if tab is self.current():
            url = tab.current_url()
            if not self.urlbar.hasFocus():
                self.urlbar.setText("" if url in ("about:blank", "") else url)
                self.urlbar.setCursorPosition(0)
            self.act_back.setEnabled(tab.can_go_back())
            self.act_fwd.setEnabled(tab.can_go_forward())
            self.act_star.setText("★" if self._is_bookmarked(url) else "☆")

    def _on_loading(self, tab, loading):
        if tab is self.current():
            if loading:
                self.act_reload.setText("✕")
                self.act_reload.setToolTip("Stop")
            else:
                self.act_reload.setText("⟳")
                self.act_reload.setToolTip("Reload")
                self.act_back.setEnabled(tab.can_go_back())
                self.act_fwd.setEnabled(tab.can_go_forward())
        if not loading and not self.private:
            self._record_history(tab)

    def _on_history(self, tab):
        if tab is self.current():
            self.act_back.setEnabled(tab.can_go_back())
            self.act_fwd.setEnabled(tab.can_go_forward())

    def _reload_or_stop(self):
        if self.act_reload.text() == "✕":
            self._cur_do("stop")
        else:
            self._cur_do("reload")

    def _zoom(self, delta):
        w = self.current()
        if isinstance(w, WebTab):
            w.set_zoom(w.zoom() + delta)

    def _set_zoom(self, f):
        self._cur_do("set_zoom", f)

    def _new_window(self):
        app = QApplication.instance()
        win = Browser()
        win.show()
        app._windows.append(win)

    def _new_private_window(self):
        app = QApplication.instance()
        win = Browser(private=True)
        win.show()
        app._windows.append(win)

    def _record_history(self, tab):
        if self.private:
            return
        url = tab.current_url()
        if not url or url.startswith("about:"):
            return
        hist = QApplication.instance()._history
        title = tab.title() or url
        if hist and hist[-1].get("url") == url:
            hist[-1]["title"] = title
        else:
            hist.append({"url": url, "title": title})
            if len(hist) > 5000:
                del hist[: len(hist) - 5000]
        _save_json(HISTORY_FILE, hist)

    def show_history(self):
        HistoryDialog(self).show()

    def _is_bookmarked(self, url):
        return any(b.get("url") == url for b in self.bookmarks)

    def _bookmark_current(self):
        w = self.current()
        if not isinstance(w, WebTab):
            return
        url = w.current_url()
        if not url or url == "about:blank":
            return
        if self._is_bookmarked(url):
            self.bookmarks = [b for b in self.bookmarks if b.get("url") != url]
        else:
            self.bookmarks.append({"title": w.title() or url, "url": url})
        _save_json(BOOKMARKS_FILE, self.bookmarks)
        self._refresh_bookmark_bar()
        self._sync_urlbar(w)

    def _install_shortcuts(self):
        # On macOS Qt maps the "Ctrl" portion of these to the ⌘ (Command) key.
        def sc(seq, fn):
            a = QAction(self)
            a.setShortcut(QKeySequence(seq))
            a.triggered.connect(fn)
            self.addAction(a)

        sc("Ctrl+T", lambda: self.add_tab(HOME_URL))
        sc("Ctrl+W", lambda: self.close_tab(self.tabs.currentIndex()))
        sc("Ctrl+N", self._new_window)
        sc("Ctrl+Shift+N", self._new_private_window)
        sc("Ctrl+H", self.show_history)
        sc("Ctrl+Y", self.show_history)
        sc("Ctrl+L", self.focus_urlbar)
        sc("Ctrl+D", self._bookmark_current)
        sc("Ctrl+R", lambda: self._cur_do("reload"))
        sc("F5", lambda: self._cur_do("reload"))
        sc("Ctrl+Q", self.close)
        sc("Ctrl++", lambda: self._zoom(0.1))
        sc("Ctrl+=", lambda: self._zoom(0.1))
        sc("Ctrl+-", lambda: self._zoom(-0.1))
        sc("Ctrl+0", lambda: self._set_zoom(1.0))
        sc("Alt+Left", lambda: self._cur_do("back"))
        sc("Alt+Right", lambda: self._cur_do("forward"))
        sc("Ctrl+[", lambda: self._cur_do("back"))
        sc("Ctrl+]", lambda: self._cur_do("forward"))


SINGLE_INSTANCE_KEY = "NovaBrowser.SingleInstance.mac"


def main():
    from PyQt6.QtNetwork import QLocalServer, QLocalSocket

    QApplication.setApplicationName(APP_NAME)
    app = QApplication(sys.argv)

    urls = [u for u in (make_url(a) for a in sys.argv[1:]) if u]

    probe = QLocalSocket()
    probe.connectToServer(SINGLE_INSTANCE_KEY)
    if probe.waitForConnected(400):
        probe.write(("\n".join(urls)).encode("utf-8"))
        probe.flush()
        probe.waitForBytesWritten(1000)
        probe.disconnectFromServer()
        return

    app.setWindowIcon(app_icon())
    app._windows = []
    app._history = _load_json(HISTORY_FILE, [])
    app._settings = _load_json(SETTINGS_FILE, {"theme": "dark"})

    win = Browser()
    app._windows.append(win)
    for u in urls:
        win.add_tab(u)
    win.show()

    QLocalServer.removeServer(SINGLE_INSTANCE_KEY)
    server = QLocalServer()
    server.listen(SINGLE_INSTANCE_KEY)
    state = {"win": win}

    def on_conn():
        c = server.nextPendingConnection()
        if not c:
            return
        if c.waitForReadyRead(1000):
            data = bytes(c.readAll()).decode("utf-8", "ignore")
            try:
                w = state["win"]
                w.isVisible()
            except Exception:
                w = Browser(); app._windows.append(w); state["win"] = w
            for line in data.splitlines():
                u = make_url(line.strip())
                if u:
                    w.add_tab(u, switch=True)
            w.show(); w.raise_(); w.activateWindow()
        c.disconnectFromServer()

    server.newConnection.connect(on_conn)
    app._single_server = server

    sys.exit(app.exec())


if __name__ == "__main__":
    main()

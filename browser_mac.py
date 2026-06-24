"""
Nova (macOS) — a desktop web browser that runs on your laptop.

This is the **macOS** build of Nova. It has all the features of the Windows
version — tabs, the ARTGEOrge Search home page + address-bar search, navigation,
bookmarks, history, downloads, a private mode, a dark/light theme, persistent
logins, zoom, multiple windows, keyboard shortcuts and single-instance launching
— but it renders web content with **PyQt6 QtWebEngine** (the cross-platform
Chromium engine) instead of Microsoft Edge WebView2, which is Windows-only.

Because QtWebEngine is a first-class Qt widget, none of the Win32 focus / .NET
(pythonnet) plumbing from the Windows build is needed: focus, downloads, new
windows and keyboard shortcuts all go through Qt directly. On macOS, Qt also maps
every "Ctrl+…" shortcut below to the ⌘ (Command) key automatically, so the
shortcuts feel native.

Run:  python3 browser_mac.py
Setup: pip install PyQt6 PyQt6-WebEngine
"""

import os
import sys
import json
import re
import urllib.parse

# Enable modern Chromium features (incl. WebGPU) before QtWebEngine starts.
os.environ.setdefault(
    "QTWEBENGINE_CHROMIUM_FLAGS",
    "--enable-unsafe-webgpu --enable-features=Vulkan,Metal",
)

from PyQt6.QtCore import QUrl, Qt, pyqtSignal, QTimer  # noqa: E402
from PyQt6.QtGui import QAction, QIcon, QKeySequence  # noqa: E402
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

# Nova's own built-in search engine (ARTGEOrge Search), served on a local
# loopback port. It's both the home page and the address-bar search. The
# search_engine module is pure-stdlib and works unchanged on macOS.
import search_engine  # noqa: E402
_SEARCH_BASE = search_engine.start()
HOME_URL = _SEARCH_BASE + "/"
SEARCH_URL = _SEARCH_BASE + "/search?q={}"

# Profile (cookies, cache, bookmarks, history) lives next to this file, matching
# the Windows build's layout so the same folder works on both platforms.
APP_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(APP_DIR, "profile")
ENGINE_DATA = os.path.join(DATA_DIR, "wv2")   # Chromium cookies/cache/storage
BOOKMARKS_FILE = os.path.join(DATA_DIR, "bookmarks.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")
ICON_FILE = os.path.join(APP_DIR, "nova.png")   # .png works on macOS (.ico is Win)
os.makedirs(DATA_DIR, exist_ok=True)


# ---- small JSON helpers ---------------------------------------------------
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
    if " " not in text and "." in text:  # looks like a domain
        return "https://" + text
    return SEARCH_URL.format(urllib.parse.quote(text))


# ---- WebEngine profiles ---------------------------------------------------
# One shared persistent profile for normal windows (keeps you signed in between
# sessions) and one shared off-the-record profile for all private windows.
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
        p = QWebEngineProfile(app)   # no name => off-the-record (nothing persisted)
        _wire_profile(p)
        app._private_profile = p
    return p


def _on_download_requested(download):
    """Ask where to save, like the Windows build's download dialog."""
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


# ---- a web page that turns "open in new window" into a new tab ------------
class WebPage(QWebEnginePage):
    def __init__(self, profile, parent=None):
        super().__init__(profile, parent)
        self.on_new_window = None      # Browser sets this; returns a QWebEnginePage
        self.on_fullscreen = None      # Browser sets this; (bool)->None
        self.fullScreenRequested.connect(self._on_fullscreen)

    def createWindow(self, _type):
        # Chromium loads the target URL into the page we return, so hand back a
        # fresh tab's page instead of spawning a separate OS window.
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


# ---- a single web view (one tab), backed by QtWebEngine -------------------
class WebTab(QWidget):
    urlChanged = pyqtSignal(str)
    titleChanged = pyqtSignal(str)
    loadingChanged = pyqtSignal(bool)      # True = started, False = finished
    historyChanged = pyqtSignal()
    newWindow = pyqtSignal(str)            # kept for API parity (unused on macOS)

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

    def _on_load_finished(self, _ok):
        self.loadingChanged.emit(False)
        self.historyChanged.emit()

    # ---- public API used by Browser (mirrors the Windows WebTab) ----------
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


# ---- themes (same look as the Windows build) ------------------------------
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

# Private windows always use this dark+purple look regardless of theme.
PRIVATE_QSS = DARK_QSS + """
QMainWindow, QWidget#central { background: #1b1726; }
QToolBar { background: #241d33; }
QLineEdit#urlbar { background: #2e2542; border-color: #2e2542; }
QLineEdit#urlbar:focus { border-color: #b794ff; }
QTabBar::tab:selected { background: #3a2f55; }
"""


class UrlBar(QLineEdit):
    """Address bar that selects all on first click (like Chrome) so the next
    keystroke replaces the URL. On macOS Qt handles focus natively, so none of
    the Windows build's cross-thread Win32 focus juggling is required."""
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
        if ICON_FILE and os.path.exists(ICON_FILE):
            self.setWindowIcon(QIcon(ICON_FILE))

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

    # ---- toolbar ----------------------------------------------------------
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

    # ---- theme ------------------------------------------------------------
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

    # ---- tabs -------------------------------------------------------------
    def add_tab(self, url=None, switch=True):
        tab = WebTab(url=url, private=self.private)
        tab.urlChanged.connect(lambda u, t=tab: self._on_url_changed(t, u))
        tab.titleChanged.connect(lambda s, t=tab: self._set_tab_title(t, s))
        tab.loadingChanged.connect(lambda loading, t=tab: self._on_loading(t, loading))
        tab.historyChanged.connect(lambda t=tab: self._on_history(t))
        # "Open in new window/tab" from a page -> a real new tab in this window.
        tab.page.on_new_window = self._new_tab_page
        tab.page.on_fullscreen = self._on_page_fullscreen

        idx = self.tabs.addTab(tab, "New Tab")
        if switch:
            self.tabs.setCurrentIndex(idx)
        return tab

    def _new_tab_page(self):
        """createWindow() target: make a fresh tab and hand back its page."""
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

    # ---- navigation / state ----------------------------------------------
    def focus_urlbar(self):
        """⌘L: focus the address bar and select its contents so the next
        keystroke replaces the URL."""
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
            # Don't clobber the address bar while the user is editing it.
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

    # ---- history ----------------------------------------------------------
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

    # ---- bookmarks --------------------------------------------------------
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

    # ---- shortcuts --------------------------------------------------------
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
        sc("Ctrl+Y", self.show_history)           # ⌘Y — macOS-conventional History
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
        sc("Ctrl+[", lambda: self._cur_do("back"))     # ⌘[ — macOS Back
        sc("Ctrl+]", lambda: self._cur_do("forward"))  # ⌘] — macOS Forward


SINGLE_INSTANCE_KEY = "NovaBrowser.SingleInstance.mac"


def main():
    from PyQt6.QtNetwork import QLocalServer, QLocalSocket

    QApplication.setApplicationName(APP_NAME)
    app = QApplication(sys.argv)

    urls = [u for u in (make_url(a) for a in sys.argv[1:]) if u]

    # If another Nova is already running, hand our URLs to it (as new tabs) and
    # exit instead of opening a second window.
    probe = QLocalSocket()
    probe.connectToServer(SINGLE_INSTANCE_KEY)
    if probe.waitForConnected(400):
        probe.write(("\n".join(urls)).encode("utf-8"))
        probe.flush()
        probe.waitForBytesWritten(1000)
        probe.disconnectFromServer()
        return

    # We are the primary instance.
    if os.path.exists(ICON_FILE):
        app.setWindowIcon(QIcon(ICON_FILE))
    app._windows = []
    app._history = _load_json(HISTORY_FILE, [])
    app._settings = _load_json(SETTINGS_FILE, {"theme": "dark"})

    win = Browser()
    app._windows.append(win)
    for u in urls:
        win.add_tab(u)
    win.show()

    # Listen for future launches; open their URLs as tabs in this window.
    QLocalServer.removeServer(SINGLE_INSTANCE_KEY)   # clear any stale socket
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
    app._single_server = server   # keep a reference alive

    sys.exit(app.exec())


if __name__ == "__main__":
    main()

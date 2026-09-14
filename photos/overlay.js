/* Text-on-photo renderer shared by the public Photos page and Photo Studio.
 * A text layer is stored as data, not burned into the image, so it stays sharp
 * at any size. Positions are % of the photo; sizes are % of the photo's width
 * (container query units), so a layer looks the same on a thumbnail and full screen. */
(function () {
  'use strict';

  var FONTS = {
    sans:    { label: 'Sans',    css: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif", weight: 700 },
    rounded: { label: 'Rounded', css: "ui-rounded, 'SF Pro Rounded', 'Segoe UI Variable Display', 'Nunito', 'Varela Round', system-ui, sans-serif", weight: 800 },
    serif:   { label: 'Serif',   css: "'New York', 'Iowan Old Style', Georgia, 'Times New Roman', serif", weight: 600 },
    hand:    { label: 'Hand',    css: "'Segoe Print', 'Bradley Hand', 'Chalkboard SE', 'Comic Sans MS', cursive", weight: 700 },
    poster:  { label: 'Poster',  css: "Impact, 'Haettenschweiler', 'Arial Narrow Bold', 'Arial Black', sans-serif", weight: 400 },
    mono:    { label: 'Mono',    css: "ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace", weight: 700 }
  };
  var STYLES = ['shadow', 'outline', 'box', 'plain'];
  var ALIGNS = ['left', 'center', 'right'];

  function clamp(v, lo, hi, dflt) {
    v = Number(v);
    if (!isFinite(v)) return dflt;
    return Math.max(lo, Math.min(hi, v));
  }
  function safeColor(c) {
    return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#ffffff';
  }

  // Normalises a stored layer so bad or missing fields can never break the page.
  function normalize(layer) {
    layer = layer || {};
    return {
      t: String(layer.t == null ? '' : layer.t).slice(0, 400),
      x: clamp(layer.x, 0, 100, 50),
      y: clamp(layer.y, 0, 100, 50),
      size: clamp(layer.size, 1, 30, 8),
      font: FONTS[layer.font] ? layer.font : 'sans',
      color: safeColor(layer.color),
      style: STYLES.indexOf(layer.style) >= 0 ? layer.style : 'shadow',
      align: ALIGNS.indexOf(layer.align) >= 0 ? layer.align : 'center',
      rot: clamp(layer.rot, -45, 45, 0)
    };
  }

  // Dark or light partner colour for outlines and boxes.
  function partner(hex) {
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 150 ? '#111111' : '#ffffff';
  }

  function applyLayer(el, layer) {
    var L = normalize(layer), f = FONTS[L.font], p = partner(L.color), s = el.style;
    el.className = 'po-text po-' + L.style;
    el.textContent = L.t;
    s.left = L.x + '%';
    s.top = L.y + '%';
    s.fontFamily = f.css;
    s.fontWeight = f.weight;
    s.fontSize = L.size + 'cqw';
    s.textAlign = L.align;
    s.color = L.color;
    s.transform = 'translate(-50%, -50%) rotate(' + L.rot + 'deg)';
    s.textShadow = '';
    s.webkitTextStroke = '';
    s.background = '';
    if (L.style === 'shadow') {
      s.textShadow = '0 0.06em 0.25em rgba(0,0,0,0.55), 0 0 0.05em rgba(0,0,0,0.4)';
    } else if (L.style === 'outline') {
      s.webkitTextStroke = '0.09em ' + p;
      s.paintOrder = 'stroke fill';
    } else if (L.style === 'box') {
      // light text sits on a dark box, dark text on a light one
      s.background = p === '#111111' ? 'rgba(20,20,22,0.74)' : 'rgba(255,255,255,0.9)';
    }
    return el;
  }

  // Builds the overlay layers for one photo inside `host` (which must be the
  // positioned, container-typed box the image fills).
  function render(host, texts) {
    var old = host.querySelectorAll('.po-text');
    for (var i = 0; i < old.length; i++) old[i].remove();
    (texts || []).forEach(function (layer) {
      if (!layer || !String(layer.t || '').trim()) return;
      host.appendChild(applyLayer(document.createElement('div'), layer));
    });
  }

  // Styles every page using the renderer needs.
  var CSS =
    '.po-host{position:relative;container-type:inline-size;overflow:hidden}' +
    '.po-host>img{display:block;width:100%;height:auto}' +
    '.po-text{position:absolute;white-space:pre-wrap;line-height:1.08;letter-spacing:-0.01em;' +
    'max-width:92cqw;width:max-content;pointer-events:none;overflow-wrap:break-word}' +
    '.po-box{padding:0.18em 0.42em;border-radius:0.28em;-webkit-box-decoration-break:clone;box-decoration-break:clone}';
  if (!document.getElementById('po-css')) {
    var st = document.createElement('style');
    st.id = 'po-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  window.PhotoOverlay = { FONTS: FONTS, STYLES: STYLES, ALIGNS: ALIGNS, normalize: normalize, applyLayer: applyLayer, render: render };
})();

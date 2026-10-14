/* kart-gfx.js — shared graphics kit for the kart game set.
   High-detail vector sprites (cached to offscreen bitmaps), animated karts
   (spinning tyres, driver bob, exhaust, drift sparks, boost flames),
   particles, scenery props, sky layers, weather, HUD widgets, lighting and
   post-processing. Loaded by every game in this folder; keep the folder
   together. Everything is drawn in code: there are no image files. */
(function (root) {
'use strict';
var TAU = Math.PI * 2;
var HAS_DOM = typeof document !== 'undefined';
function now() { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

/* NaN-safe: a stray NaN reaching ctx.rotate/globalAlpha silently kills a whole frame */
function clamp(v, a, b) { return (v !== v) ? a : v < a ? a : v > b ? b : v; }
var _rgb = {};
function hex2rgb(h) {
  h = String(h);
  var m = _rgb[h];
  if (m) return m;
  if (h.charAt(0) !== '#') {
    var d = h.match(/-?\d+(\.\d+)?/g);
    m = d && d.length >= 3 ? [+d[0] | 0, +d[1] | 0, +d[2] | 0] : [255, 255, 255];
  } else {
    var s = h.slice(1);
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var n = parseInt(s, 16);
    m = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  _rgb[h] = m;
  return m;
}
function rgbs(r, g, b) { return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')'; }
function light(h, a) { var c = hex2rgb(h); return rgbs(c[0] + (255 - c[0]) * a, c[1] + (255 - c[1]) * a, c[2] + (255 - c[2]) * a); }
function dark(h, a) { var c = hex2rgb(h); return rgbs(c[0] * (1 - a), c[1] * (1 - a), c[2] * (1 - a)); }
function alpha(h, a) { var c = hex2rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function strHash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0) % 1000; }

function rr(c, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}
/* small mechanical details */
function bolt(c, x, y, r) {
  c.fillStyle = 'rgba(20,20,26,.55)';
  c.beginPath(); c.arc(x, y + r * 0.3, r, 0, TAU); c.fill();
  c.fillStyle = '#9aa0ae';
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,.5)';
  c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.42, 0, TAU); c.fill();
}
function grille(c, x, y, w, h, n, col) {
  c.fillStyle = col || '#15151c';
  rr(c, x, y, w, h, 1.6); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 0.6;
  for (var i = 1; i < n; i++) {
    var yy = y + h * i / n;
    c.beginPath(); c.moveTo(x + 0.7, yy); c.lineTo(x + w - 0.7, yy); c.stroke();
  }
}
function panelLine(c, x1, y1, x2, y2, a) {
  c.strokeStyle = 'rgba(0,0,0,' + (a || 0.28) + ')'; c.lineWidth = 0.7;
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}
function star(c, x, y, r1, r2, n, rot) {
  n = n || 5; rot = rot || -Math.PI / 2;
  c.beginPath();
  for (var i = 0; i < n * 2; i++) {
    var r = i & 1 ? r2 : r1, a = rot + i * Math.PI / n;
    if (i) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
}

/* ---------------------------------------------------- offscreen sprite cache */
var _cache = {};
function cached(key, w, h, ss, draw) {
  var e = _cache[key];
  if (e) return e;
  if (!HAS_DOM) return null;
  var cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w * ss));
  cv.height = Math.max(1, Math.ceil(h * ss));
  var g = cv.getContext('2d');
  g.translate(cv.width / 2, cv.height / 2);
  g.scale(ss, ss);
  draw(g);
  e = _cache[key] = { cv: cv, w: w, h: h };
  return e;
}
function blit(c, e, x, y, a, s) {
  if (!e) return;
  c.save(); c.translate(x, y); if (a) c.rotate(a); if (s !== 1) c.scale(s, s);
  c.drawImage(e.cv, -e.w / 2, -e.h / 2, e.w, e.h);
  c.restore();
}
/* soft round glow, one bitmap per colour; drawn with 'lighter' for light */
var _glow = {};
function glowSprite(col) {
  var e = _glow[col];
  if (e || !HAS_DOM) return e || null;
  var cv = document.createElement('canvas'); cv.width = cv.height = 64;
  var g = cv.getContext('2d'), c3 = hex2rgb(col).join(',');
  var rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(' + c3 + ',1)');
  rg.addColorStop(0.3, 'rgba(' + c3 + ',.6)');
  rg.addColorStop(0.65, 'rgba(' + c3 + ',.16)');
  rg.addColorStop(1, 'rgba(' + c3 + ',0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  _glow[col] = cv;
  return cv;
}
function glow(c, x, y, r, col, a) {
  var s = glowSprite(col); if (!s) return;
  var o = c.globalCompositeOperation, ga = c.globalAlpha;
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = clamp(a === undefined ? 1 : a, 0, 1) * ga;
  c.drawImage(s, x - r, y - r, r * 2, r * 2);
  c.globalCompositeOperation = o; c.globalAlpha = ga;
}

/* ---------------------------------------------------- particles */
function Particles(max) { this.max = max || 600; this.a = []; }
Particles.prototype.emit = function (o) {
  if (this.a.length >= this.max) this.a.shift();
  var arr = Array.isArray(o.col);
  this.a.push({
    x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0,
    life: o.life || 0.6, t: o.life || 0.6,
    r: o.r || 3, r2: o.r2 === undefined ? 0 : o.r2,
    col: arr ? o.col[0] : (o.col || '#fff'), cols: arr ? o.col : null,
    grav: o.grav || 0,
    drag: o.drag === undefined ? 1.6 : o.drag,
    shape: o.shape || 'circle', rot: o.rot || 0, vr: o.vr || 0,
    a0: o.a0 === undefined ? 1 : o.a0, add: !!o.add, lw: o.lw || 2
  });
};
Particles.prototype.burst = function (x, y, n, o) {
  o = o || {};
  for (var i = 0; i < n; i++) {
    var a = (o.dir === undefined ? Math.random() * TAU : o.dir + (Math.random() - 0.5) * (o.spread || TAU));
    var sp = (o.spd || 70) * (0.35 + Math.random() * 0.95);
    this.emit({
      x: x, y: y, vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp + (o.vy || 0),
      life: (o.life || 0.6) * (0.6 + Math.random() * 0.8), r: (o.r || 3) * (0.6 + Math.random() * 0.8),
      r2: o.r2, col: Array.isArray(o.col) && o.pick ? o.col[(Math.random() * o.col.length) | 0] : o.col,
      grav: o.grav, drag: o.drag, shape: o.shape,
      rot: Math.random() * TAU, vr: (Math.random() - 0.5) * (o.vr === undefined ? 12 : o.vr), a0: o.a0, add: o.add, lw: o.lw
    });
  }
};
Particles.prototype.update = function (dt) {
  for (var i = this.a.length - 1; i >= 0; i--) {
    var p = this.a[i];
    p.t -= dt;
    if (p.t <= 0) { this.a.splice(i, 1); continue; }
    p.vy += p.grav * dt;
    p.vx -= p.vx * p.drag * dt;
    p.vy -= p.vy * p.drag * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
  }
};
Particles.prototype.draw = function (c) {
  var add = false, A = this.a;
  if (!A.length) return;
  c.save();
  for (var i = 0; i < A.length; i++) {
    var p = A[i], k = p.t / p.life, r = p.r2 + (p.r - p.r2) * k;
    if (r <= 0.2) continue;
    if (p.add !== add) { c.globalCompositeOperation = p.add ? 'lighter' : 'source-over'; add = p.add; }
    var col = p.cols ? p.cols[Math.min(p.cols.length - 1, ((1 - k) * p.cols.length) | 0)] : p.col;
    c.globalAlpha = clamp(k * p.a0, 0, 1);
    switch (p.shape) {
      case 'glow': case 'flame': {
        var gs = glowSprite(col);
        if (gs) c.drawImage(gs, p.x - r * 2, p.y - r * 2, r * 4, r * 4);
        break;
      }
      case 'ring':
        c.strokeStyle = col; c.lineWidth = Math.max(0.5, p.lw * k);
        c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.stroke();
        break;
      case 'star':
        c.fillStyle = col;
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); star(c, 0, 0, r, r * 0.45, 5, 0); c.fill(); c.restore();
        break;
      case 'confetti':
        c.fillStyle = col;
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(1, Math.cos(p.rot * 2.3));
        c.fillRect(-r, -r * 0.55, r * 2, r * 1.1); c.restore();
        break;
      case 'line':
        c.strokeStyle = col; c.lineWidth = r; c.lineCap = 'round';
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045); c.stroke();
        break;
      case 'spark':
        c.fillStyle = col;
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.fillRect(-r * 2.2, -r * 0.32, r * 4.4, r * 0.64);
        c.restore();
        break;
      case 'square':
        c.fillStyle = col;
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.fillRect(-r, -r, r * 2, r * 2); c.restore();
        break;
      case 'smoke':
        c.fillStyle = col;
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.beginPath();
        c.arc(-r * 0.4, 0, r * 0.75, 0, TAU);
        c.arc(r * 0.45, -r * 0.15, r * 0.62, 0, TAU);
        c.arc(0, r * 0.4, r * 0.55, 0, TAU);
        c.fill(); c.restore();
        break;
      default:
        c.fillStyle = col;
        c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
    }
  }
  c.restore();
  c.globalAlpha = 1;
};
Particles.prototype.clear = function () { this.a.length = 0; };

/* ready-made effect bursts */
var FX = {
  /* item / shell impact: flash, shockwave ring, sparks, debris and smoke */
  hit: function (fx, x, y, col, s) {
    s = s || 1; col = col || '#ffd75e';
    fx.emit({ x: x, y: y, life: 0.22, r: 26 * s, r2: 10 * s, col: '#fff6d8', shape: 'glow', add: true, drag: 0 });
    fx.emit({ x: x, y: y, life: 0.42, r: 6 * s, r2: 44 * s, col: col, shape: 'ring', lw: 5 * s, drag: 0 });
    fx.burst(x, y, 16, { spd: 240 * s, life: 0.5, r: 4.5 * s, col: col, shape: 'spark', drag: 2.4, add: true });
    fx.burst(x, y, 8, { spd: 160 * s, life: 0.7, r: 3 * s, col: ['#ffffff', col, '#ff8a3a'], pick: true, shape: 'star', drag: 2, grav: 140 * s });
    fx.burst(x, y, 6, { spd: 70 * s, life: 0.8, r: 5 * s, r2: 14 * s, col: 'rgba(90,90,100,.45)', shape: 'smoke', drag: 1.6 });
  },
  /* coin / pickup: sparkle stars + ring */
  pickup: function (fx, x, y, col, s) {
    s = s || 1; col = col || '#ffd23f';
    fx.emit({ x: x, y: y, life: 0.35, r: 4 * s, r2: 26 * s, col: col, shape: 'ring', lw: 3 * s, drag: 0 });
    fx.burst(x, y, 10, { spd: 130 * s, life: 0.55, r: 3.2 * s, col: [col, '#ffffff'], pick: true, shape: 'star', drag: 2.6, add: true });
    fx.emit({ x: x, y: y, life: 0.25, r: 16 * s, r2: 4 * s, col: col, shape: 'glow', add: true, drag: 0 });
  },
  /* explosion: fireball, ring, embers and smoke */
  boom: function (fx, x, y, s) {
    s = s || 1;
    fx.emit({ x: x, y: y, life: 0.35, r: 40 * s, r2: 18 * s, col: '#ffdc8a', shape: 'glow', add: true, drag: 0 });
    fx.emit({ x: x, y: y, life: 0.5, r: 8 * s, r2: 70 * s, col: '#ffb060', shape: 'ring', lw: 7 * s, drag: 0 });
    fx.burst(x, y, 18, { spd: 200 * s, life: 0.55, r: 7 * s, r2: 1, col: ['#fff3c0', '#ffb347', '#ff5a2a', '#7a2a1a'], shape: 'flame', add: true, drag: 2.2 });
    fx.burst(x, y, 12, { spd: 260 * s, life: 0.7, r: 2.5 * s, col: '#ffd27a', shape: 'spark', drag: 1.8, grav: 160 * s, add: true });
    fx.burst(x, y, 10, { spd: 80 * s, life: 1.1, r: 8 * s, r2: 20 * s, col: 'rgba(70,64,70,.5)', shape: 'smoke', drag: 1.3, grav: -30 * s });
  },
  /* balloon / target pop: shards of the colour */
  pop: function (fx, x, y, col, s) {
    s = s || 1;
    fx.emit({ x: x, y: y, life: 0.3, r: 5 * s, r2: 36 * s, col: '#ffffff', shape: 'ring', lw: 4 * s, drag: 0 });
    fx.burst(x, y, 14, { spd: 200 * s, life: 0.6, r: 3.5 * s, col: col, shape: 'confetti', drag: 2.2, grav: 120 * s, vr: 18 });
    fx.burst(x, y, 10, { spd: 150 * s, life: 0.4, r: 3 * s, col: '#ffffff', shape: 'spark', drag: 2.6, add: true });
  },
  /* boost pad / mini-turbo whoosh */
  boost: function (fx, x, y, s) {
    s = s || 1;
    fx.emit({ x: x, y: y, life: 0.4, r: 6 * s, r2: 50 * s, col: '#9fe8ff', shape: 'ring', lw: 4 * s, drag: 0 });
    fx.burst(x, y, 14, { spd: 220 * s, life: 0.45, r: 2.6 * s, col: ['#ffffff', '#ffe38a', '#9fe8ff'], pick: true, shape: 'line', drag: 2.2, add: true });
  }
};

/* ---------------------------------------------------- per-kart animation state */
var _kst = {};
function kstate(key, x, y) {
  var s = _kst[key], t = now();
  if (!s) s = _kst[key] = { ph: 0, x: x, y: y, t: t, ex: 0, ds: 0, sm: 0, seed: strHash(key) };
  var dt = Math.min(0.1, Math.max(0, (t - s.t) / 1000));
  s.dt = dt; s.t = t;
  return s;
}

/* ---------------------------------------------------- kart art (logical coords) */
function wheelTopArt(g, x, y, rot, w, h, ph) {
  ph = ph || 0;
  g.save(); g.translate(x, y); g.rotate(rot || 0);
  g.fillStyle = 'rgba(0,0,0,.32)';
  rr(g, -w / 2, -h / 2 + 1.4, w, h, 2.6); g.fill();
  var t = g.createLinearGradient(0, -h / 2, 0, h / 2);
  t.addColorStop(0, '#2a2a34'); t.addColorStop(0.45, '#121219'); t.addColorStop(1, '#05050a');
  g.fillStyle = t; rr(g, -w / 2, -h / 2, w, h, 2.6); g.fill();
  /* tread blocks, scrolled by the spin phase */
  g.save(); rr(g, -w / 2, -h / 2, w, h, 2.6); g.clip();
  g.fillStyle = 'rgba(255,255,255,.10)';
  var step = w / 6;
  for (var i = -1; i < 7; i++) {
    var xx = -w / 2 + (i + ph) * step;
    g.fillRect(xx, -h / 2 + 0.5, step * 0.38, h * 0.36);
    g.fillRect(xx + step * 0.5, h / 2 - 0.5 - h * 0.36, step * 0.38, h * 0.36);
  }
  g.restore();
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-w / 2 + 1, -0.4, w - 2, 0.8);
  g.fillStyle = '#3d3d4a'; rr(g, -w / 2 + 1.8, -h / 2 + 1.7, w - 3.6, h - 3.4, 1.8); g.fill();  // rim
  g.fillStyle = '#6a6a78'; rr(g, -w / 2 + 2.8, -h / 2 + 2.3, w - 5.6, h - 4.6, 1.5); g.fill();
  g.fillStyle = 'rgba(255,255,255,.32)'; rr(g, -w / 2 + 2.4, -h / 2 + 1.8, w - 4.8, 1.1, 0.5); g.fill();
  g.fillStyle = '#b4bac6'; g.beginPath(); g.arc(0, 0, 1.15, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(-0.35, -0.35, 0.45, 0, TAU); g.fill();
  g.restore();
}
/* legacy name kept for games that call it directly */
function wheelTop(c, x, y, rot, w, h, ph) {
  var q = ((((ph || 0) % 1) + 1) % 1 * 4) | 0;
  var e = cached('wt|' + w + '|' + h + '|' + q, w + 3, h + 4, 4, function (g) { wheelTopArt(g, 0, 0, 0, w, h, q / 4); });
  if (e) {
    c.save(); c.translate(x, y); if (rot) c.rotate(rot);
    c.drawImage(e.cv, -e.w / 2, -e.h / 2, e.w, e.h); c.restore();
  } else wheelTopArt(c, x, y, rot, w, h, ph);
}

function kartTopBody(g, col, acc) {
  var body = function () {
    g.beginPath();
    g.moveTo(-19, -11.5); g.lineTo(4, -12.5);
    g.quadraticCurveTo(17, -9.5, 21, 0);
    g.quadraticCurveTo(17, 9.5, 4, 12.5);
    g.lineTo(-19, 11.5);
    g.quadraticCurveTo(-22, 0, -19, -11.5);
    g.closePath();
  };
  /* rear bumper bar + rear wing */
  g.fillStyle = '#2a2a33'; rr(g, -27.5, -9, 3, 18, 1.4); g.fill();
  g.fillStyle = dark(col, 0.58); rr(g, -25, -13.5, 4.6, 27, 1.8); g.fill();
  g.fillStyle = dark(col, 0.42); rr(g, -25, -13.5, 4.6, 3, 1.2); g.fill();
  g.fillStyle = light(acc, 0.1); rr(g, -24.4, -2, 3.4, 4, 1); g.fill();          // wing badge
  g.fillStyle = dark(col, 0.7); rr(g, -23.5, -14.6, 2.4, 3.2, 1); g.fill();
  rr(g, -23.5, 11.4, 2.4, 3.2, 1); g.fill();
  /* suspension arms + coil springs */
  g.strokeStyle = '#20202a'; g.lineWidth = 2.2; g.lineCap = 'round';
  [[-12, -9, -12, -14], [-12, 9, -12, 14], [11, -9, 11, -14], [11, 9, 11, 14]].forEach(function (a) {
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[2], a[3]); g.stroke();
  });
  g.strokeStyle = '#c9a23a'; g.lineWidth = 0.6;
  [[-12, -1], [-12, 1], [11, -1], [11, 1]].forEach(function (a) {
    for (var k = 0; k < 3; k++) {
      var yy = a[1] * (10 + k * 1.3);
      g.beginPath(); g.moveTo(a[0] - 1.3, yy); g.lineTo(a[0] + 1.3, yy + a[1] * 0.6); g.stroke();
    }
  });
  /* floor pan + contact shading */
  g.fillStyle = 'rgba(0,0,0,.30)';
  rr(g, -20, -13.5, 43, 27, 9); g.fill();
  g.fillStyle = '#23232c'; rr(g, -18, -12.6, 36, 25.2, 7); g.fill();
  /* chassis */
  var grd = g.createLinearGradient(0, -13, 0, 13);
  grd.addColorStop(0, light(col, 0.6));
  grd.addColorStop(0.25, light(col, 0.24));
  grd.addColorStop(0.58, col);
  grd.addColorStop(1, dark(col, 0.45));
  g.fillStyle = grd; body(); g.fill();
  /* livery: twin racing stripes in the accent colour */
  g.save(); body(); g.clip();
  g.fillStyle = alpha(acc, 0.85);
  g.fillRect(-22, -2.9, 46, 1.6); g.fillRect(-22, 1.3, 46, 1.6);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-22, 10, 46, 4);
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1.1; body(); g.stroke();
  /* rim light along the upper edge */
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 0.6;
  g.beginPath(); g.moveTo(-18, -10.9); g.lineTo(4, -11.9); g.quadraticCurveTo(16, -9, 20, -1); g.stroke();
  /* side pods with intakes */
  g.fillStyle = dark(col, 0.3);
  rr(g, -16, -12.6, 19, 4.2, 1.8); g.fill();
  rr(g, -16, 8.4, 19, 4.2, 1.8); g.fill();
  grille(g, -13, -12, 9, 3.2, 4);
  grille(g, -13, 8.8, 9, 3.2, 4);
  g.fillStyle = 'rgba(255,255,255,.18)'; rr(g, -15.5, -12.4, 18, 0.9, 0.4); g.fill();
  /* engine cover behind the driver, with an air scoop */
  g.fillStyle = dark(col, 0.2);
  rr(g, -18, -7, 9, 14, 3); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.6;
  for (var i = 0; i < 4; i++) {
    g.beginPath(); g.moveTo(-17, -5.5 + i * 3.6); g.lineTo(-10, -5.5 + i * 3.6); g.stroke();
  }
  g.fillStyle = '#2b2b35'; rr(g, -12.4, -3.2, 4.2, 6.4, 1.6); g.fill();
  g.fillStyle = '#0c0c12'; rr(g, -9.8, -2.2, 1.6, 4.4, 0.7); g.fill();
  /* exhaust tips */
  g.fillStyle = '#6a6a78';
  rr(g, -21.5, -4.6, 3.4, 3.2, 1.4); g.fill();
  rr(g, -21.5, 1.4, 3.4, 3.2, 1.4); g.fill();
  g.fillStyle = '#17171e';
  rr(g, -21, -4.1, 2, 2.2, 1); g.fill();
  rr(g, -21, 1.9, 2, 2.2, 1); g.fill();
  g.fillStyle = 'rgba(255,170,90,.35)'; rr(g, -20.5, -3.8, 1, 1.6, 0.5); g.fill(); rr(g, -20.5, 2.2, 1, 1.6, 0.5); g.fill();
  /* gloss highlight + panel lines */
  g.fillStyle = 'rgba(255,255,255,.28)';
  rr(g, -11, -8.6, 23, 3.4, 1.7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.10)';
  rr(g, -11, 5.4, 23, 2.4, 1.2); g.fill();
  panelLine(g, -8, -12, -8, 12);
  panelLine(g, 6, -11.5, 6, 11.5);
  /* nose splitter, front bumper and star roundel */
  g.fillStyle = dark(col, 0.55);
  g.beginPath(); g.moveTo(16, -8.5); g.quadraticCurveTo(23, -4, 23, 0);
  g.quadraticCurveTo(23, 4, 16, 8.5); g.lineTo(16, -8.5); g.closePath(); g.fill();
  g.fillStyle = '#26262f'; rr(g, 22.2, -7, 2.6, 14, 1.3); g.fill();
  g.fillStyle = 'rgba(255,255,255,.22)'; rr(g, 22.5, -6.4, 0.8, 12.8, 0.4); g.fill();
  g.fillStyle = '#f2f2f6'; g.beginPath(); g.arc(11.5, 0, 3.6, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 0.7; g.stroke();
  g.fillStyle = col; star(g, 11.5, 0, 2.5, 1.05, 5, 0); g.fill();
  /* cockpit well with ambient occlusion, seat and headrest */
  g.fillStyle = 'rgba(0,0,0,.45)';
  g.beginPath(); g.ellipse(-1.5, 0, 10.4, 9.1, 0, 0, TAU); g.fill();
  g.fillStyle = '#15151d';
  g.beginPath(); g.ellipse(-1.5, 0, 9.2, 8, 0, 0, TAU); g.fill();
  g.fillStyle = '#2c2c38'; rr(g, -9.6, -5, 3.4, 10, 1.6); g.fill();
  /* steering column + wheel */
  g.strokeStyle = '#2a2a33'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(4.2, 0); g.lineTo(9, 0); g.stroke();
  g.strokeStyle = '#20202a'; g.lineWidth = 1.5;
  g.beginPath(); g.ellipse(4.2, 0, 2.1, 3.6, 0, 0, TAU); g.stroke();
  g.fillStyle = '#e04a3c'; g.fillRect(3.8, -3.9, 0.9, 0.9);
  /* mirrors + headlights + bolts */
  g.fillStyle = dark(col, 0.5);
  rr(g, 6, -10.4, 3.4, 2.2, 1); g.fill();
  rr(g, 6, 8.2, 3.4, 2.2, 1); g.fill();
  g.fillStyle = 'rgba(190,225,255,.6)'; rr(g, 6.5, -10, 1.2, 1.4, 0.5); g.fill(); rr(g, 6.5, 8.6, 1.2, 1.4, 0.5); g.fill();
  g.fillStyle = 'rgba(255,250,215,.95)';
  g.beginPath(); g.ellipse(18, -5, 2.5, 2, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(18, 5, 2.5, 2, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.95)';
  g.beginPath(); g.arc(18.6, -5.4, 0.8, 0, TAU); g.fill(); g.beginPath(); g.arc(18.6, 4.6, 0.8, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.6;
  g.beginPath(); g.ellipse(18, -5, 2.5, 2, 0, 0, TAU); g.stroke();
  g.beginPath(); g.ellipse(18, 5, 2.5, 2, 0, 0, TAU); g.stroke();
  bolt(g, -17.5, -10.5, 0.85); bolt(g, -17.5, 10.5, 0.85);
  bolt(g, 13.5, -9.5, 0.85); bolt(g, 13.5, 9.5, 0.85);
}
function kartTopDriver(g, col, acc) {
  /* shoulders, gloved arms, helmet with visor and stripe */
  g.fillStyle = dark(acc, 0.35);
  rr(g, -7.5, -6.2, 8, 12.4, 3.4); g.fill();
  g.fillStyle = 'rgba(255,255,255,.14)'; rr(g, -7, -5.6, 3, 11.2, 1.4); g.fill();
  g.strokeStyle = dark(acc, 0.2); g.lineWidth = 2.2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-3, -4.4); g.lineTo(2.6, -3.2); g.stroke();
  g.beginPath(); g.moveTo(-3, 4.4); g.lineTo(2.6, 3.2); g.stroke();
  g.fillStyle = '#f4f4f8';
  g.beginPath(); g.arc(3.4, -3, 1.3, 0, TAU); g.fill();
  g.beginPath(); g.arc(3.4, 3, 1.3, 0, TAU); g.fill();
  var hg = g.createRadialGradient(-3.6, -2.2, 0.6, -1.5, 0, 6);
  hg.addColorStop(0, light(acc, 0.6)); hg.addColorStop(0.75, acc); hg.addColorStop(1, dark(acc, 0.32));
  g.fillStyle = hg; g.beginPath(); g.arc(-1.5, 0, 5.6, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 0.7; g.stroke();
  g.fillStyle = dark(col, 0.05);
  g.beginPath(); g.arc(-1.5, 0, 5.6, -0.55, 0.55); g.fill();
  g.fillStyle = col; g.fillRect(-6.8, -0.8, 6, 1.6);          // helmet stripe
  g.fillStyle = 'rgba(24,28,40,.92)';
  g.beginPath(); g.ellipse(2.1, 0, 2.2, 3.5, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(190,225,255,.55)';
  g.beginPath(); g.ellipse(2.4, -1.3, 1, 1.5, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.55)';
  g.beginPath(); g.ellipse(-3.4, -2.4, 1.6, 1.1, -0.6, 0, TAU); g.fill();
}

/* top-down flames from the twin exhausts */
function flameTop(c, x, y, a, s, amt) {
  var t = now() * 0.03;
  c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s);
  c.globalCompositeOperation = 'lighter';
  for (var i = 0; i < 2; i++) {
    var yy = i ? 3 : -3;
    var L = 12 + amt * 20 + Math.sin(t * 1.7 + i * 2.1) * 3 + Math.random() * 5;
    var gs = glowSprite('#ff7a2a');
    if (gs) { c.globalAlpha = clamp(0.45 + amt * 0.4, 0, 1); c.drawImage(gs, -21 - L * 0.95, yy - 5 - amt * 4, L * 1.15, 10 + amt * 8); }
    c.globalAlpha = 1;
    var gr = c.createLinearGradient(-20, 0, -20 - L, 0);
    gr.addColorStop(0, 'rgba(255,250,225,.95)');
    gr.addColorStop(0.3, 'rgba(255,175,60,.8)');
    gr.addColorStop(0.7, 'rgba(255,70,30,.45)');
    gr.addColorStop(1, 'rgba(160,30,90,0)');
    c.fillStyle = gr;
    var w0 = 2.4 + amt * 0.8;
    c.beginPath(); c.moveTo(-20, yy - w0); c.quadraticCurveTo(-20 - L * 0.4, yy - w0 * 1.3, -20 - L, yy + Math.sin(t * 3 + i) * 0.8);
    c.quadraticCurveTo(-20 - L * 0.4, yy + w0 * 1.3, -20, yy + w0); c.closePath(); c.fill();
    c.fillStyle = 'rgba(200,235,255,.85)';
    c.beginPath(); c.moveTo(-20, yy - 1.1); c.lineTo(-20 - L * 0.35, yy); c.lineTo(-20, yy + 1.1); c.closePath(); c.fill();
  }
  c.restore();
}

/* kartTop(ctx,{x,y,a,s,col,acc,steer,boost, v?, id?, fx?, drift?, driftLv?, shadow?})
   v: speed (world px/s) to spin the tyres; inferred from movement when omitted.
   fx: a GFX.Particles in the same space; enables exhaust, drift sparks, boost embers. */
function kartTop(c, o) {
  var col = o.col || '#e0392b', acc = o.acc || '#f4f4f8', s = o.s || 1, a = o.a || 0;
  var key = o.id || ('t' + col + acc);
  var st = kstate(key, o.x, o.y), dt = st.dt;
  var v = o.v;
  if (v === undefined) {
    v = dt > 0 ? Math.hypot(o.x - st.x, o.y - st.y) / dt : 0;
    if (v > 3000) v = 0;
  }
  st.x = o.x; st.y = o.y;
  st.ph = (st.ph + Math.abs(v) * dt / (4.2 * s)) % 1000;
  var steer = clamp(o.steer || 0, -0.7, 0.7);
  var body = cached('tb|' + col + '|' + acc, 60, 44, 3, function (g) { kartTopBody(g, col, acc); });
  var drv = cached('td|' + col + '|' + acc, 16, 16, 4, function (g) { g.translate(1.5, 0); kartTopDriver(g, col, acc); });
  if (o.shadow !== false) {
    c.save(); c.translate(o.x + 3 * s, o.y + 5 * s); c.rotate(a);
    c.fillStyle = 'rgba(0,0,0,.30)';
    c.beginPath(); c.ellipse(0, 0, 22 * s, 14 * s, 0, 0, TAU); c.fill();
    c.restore();
  }
  if (o.boost > 0) flameTop(c, o.x, o.y, a, s, o.boost);
  if (!body) {   // no DOM: draw straight
    c.save(); c.translate(o.x, o.y); c.rotate(a); c.scale(s, s); kartTopBody(c, col, acc); kartTopDriver(c, col, acc); c.restore();
    return;
  }
  c.save(); c.translate(o.x, o.y); c.rotate(a); c.scale(s, s);
  var ph = st.ph % 1;
  wheelTop(c, -12, -15, 0, 11.5, 7.2, ph);
  wheelTop(c, -12, 15, 0, 11.5, 7.2, ph);
  wheelTop(c, 11, -15, steer * 0.9, 10.4, 6.6, ph);
  wheelTop(c, 11, 15, steer * 0.9, 10.4, 6.6, ph);
  c.drawImage(body.cv, -body.w / 2, -body.h / 2, body.w, body.h);
  /* driver: bobs with the bumps and leans into the turn */
  var tn = st.t * 0.001, sp01 = clamp(Math.abs(v) / 220, 0, 1);
  var bob = Math.sin(tn * (7 + sp01 * 9) + st.seed) * (0.18 + sp01 * 0.32);
  c.drawImage(drv.cv, -1.5 - 8 + bob, -8 + steer * 1.6, 16, 16);
  if (o.drift) {   // glowing rear tyres while sliding
    var lv = o.driftLv || 0, dc = ['#ffffff', '#5fd0ff', '#ff9a2a', '#ff5ce0'][clamp(lv, 0, 3)];
    glow(c, -14, -16, 7, dc, 0.55); glow(c, -14, 16, 7, dc, 0.55);
  }
  c.restore();
  if (o.fx) emitTopFX(o.fx, o, st, v, a, s);
}
function emitTopFX(fx, o, st, v, a, s) {
  var dt = st.dt, ca = Math.cos(a), sa = Math.sin(a);
  var P = function (lx, ly) { return [o.x + (lx * ca - ly * sa) * s, o.y + (lx * sa + ly * ca) * s]; };
  var boosting = o.boost > 0;
  st.ex += dt * (boosting ? 34 : 7 + Math.min(10, Math.abs(v) / 25));
  while (st.ex > 1) {
    st.ex -= 1;
    var side = (st.sm = -st.sm || 1), p = P(-22, side * 3);
    if (boosting) fx.emit({ x: p[0], y: p[1], vx: -ca * 70 * s + (Math.random() - .5) * 30, vy: -sa * 70 * s + (Math.random() - .5) * 30,
      life: 0.28, r: 3.2 * s, r2: 0.5, col: ['#fff6d0', '#ffc35a', '#ff6a2a', '#a0306a'], shape: 'flame', add: true, drag: 2 });
    else fx.emit({ x: p[0], y: p[1], vx: -ca * 26 * s + (Math.random() - .5) * 14, vy: -sa * 26 * s + (Math.random() - .5) * 14,
      life: 0.55, r: 1.6 * s, r2: 5.5 * s, col: 'rgba(150,150,160,.26)', shape: 'smoke', drag: 1.8, vr: 2 });
  }
  if (o.drift) {
    var lv = clamp(o.driftLv || 0, 0, 3), dcol = ['#ffffff', '#6fd8ff', '#ffa040', '#ff6ae6'][lv];
    st.ds += dt * (26 + lv * 10);
    while (st.ds > 1) {
      st.ds -= 1;
      var sd = Math.random() < 0.5 ? -1 : 1, q = P(-14, sd * 17);
      var ang = a + Math.PI + (Math.random() - 0.5) * 1.4;
      var sp = 60 + Math.random() * 90;
      fx.emit({ x: q[0], y: q[1], vx: Math.cos(ang) * sp * s, vy: Math.sin(ang) * sp * s, life: 0.28, r: 1.5 * s, col: dcol, shape: 'line', add: true, drag: 3 });
      if (Math.random() < 0.35) fx.emit({ x: q[0], y: q[1], vx: Math.cos(ang) * 20, vy: Math.sin(ang) * 20, life: 0.7, r: 2.5 * s, r2: 8 * s, col: 'rgba(225,225,235,.28)', shape: 'smoke', drag: 1.4 });
    }
  }
}

/* ---- rear view (chase camera) */
function rearTyreArt(g, ph) {
  g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, -12, -12, 24, 34, 6); g.fill();
  var t = g.createLinearGradient(-12, 0, 12, 0);
  t.addColorStop(0, '#05050a'); t.addColorStop(0.4, '#22222c'); t.addColorStop(0.62, '#15151d'); t.addColorStop(1, '#08080e');
  g.fillStyle = t; rr(g, -12, -14, 24, 32, 6); g.fill();
  /* chevron tread scrolls down as the tyre rolls toward the camera */
  g.save(); rr(g, -12, -14, 24, 32, 6); g.clip();
  g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 1.6;
  for (var i = -1; i < 6; i++) {
    var y = -14 + (i + ph) * 6.4;
    g.beginPath(); g.moveTo(-11, y); g.lineTo(-4, y + 2.4); g.moveTo(11, y); g.lineTo(4, y + 2.4); g.stroke();
  }
  g.restore();
  g.fillStyle = '#33333f'; rr(g, -8.5, -9, 17, 22, 5); g.fill();
  g.fillStyle = '#62626f'; rr(g, -6.5, -7, 13, 18, 4); g.fill();
  /* five-spoke rim, rotated by the same phase */
  g.save(); g.translate(0, 2);
  g.strokeStyle = '#8b8b99'; g.lineWidth = 1.4;
  for (var k = 0; k < 5; k++) {
    var aa = (k / 5 + ph / 5) * TAU;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(aa) * 5.6, Math.sin(aa) * 7.4); g.stroke();
  }
  g.restore();
  g.fillStyle = 'rgba(255,255,255,.20)'; rr(g, -8.5, -9, 17, 5, 2.5); g.fill();
  g.fillStyle = '#b4bac6'; g.beginPath(); g.arc(0, 2, 2.2, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(-11.5, -10, 1.4, 22);
}
function kartRearArt(g, col, acc, part) {
  var full = part === 'full';
  if (full) [-1, 1].forEach(function (sd) { g.save(); g.translate(sd * 40, 8); rearTyreArt(g, 0); g.restore(); });
  if (part !== 'head') {
    /* suspension arms to the tyres */
    g.strokeStyle = '#1c1c24'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-30, 6); g.lineTo(-38, 4); g.moveTo(30, 6); g.lineTo(38, 4);
    g.moveTo(-30, 14); g.lineTo(-38, 14); g.moveTo(30, 14); g.lineTo(38, 14); g.stroke();
    /* diffuser */
    g.fillStyle = '#15151d';
    g.beginPath(); g.moveTo(-32, 20); g.lineTo(32, 20); g.lineTo(28, 27); g.lineTo(-28, 27); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1.2;
    for (var i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 11, 20); g.lineTo(i * 10, 27); g.stroke(); }
    /* body */
    var gg = g.createLinearGradient(0, -28, 0, 24);
    gg.addColorStop(0, light(col, 0.55));
    gg.addColorStop(0.3, light(col, 0.18));
    gg.addColorStop(0.62, col);
    gg.addColorStop(1, dark(col, 0.5));
    g.fillStyle = gg;
    g.beginPath();
    g.moveTo(-34, 20); g.lineTo(-30, -10);
    g.quadraticCurveTo(0, -21, 30, -10);
    g.lineTo(34, 20); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(-29, -10.5); g.quadraticCurveTo(0, -20.5, 29, -10.5); g.stroke();
    /* side pod intakes */
    g.fillStyle = dark(col, 0.45); rr(g, -32, -4, 7, 14, 2.5); g.fill(); rr(g, 25, -4, 7, 14, 2.5); g.fill();
    grille(g, -31, -2, 5, 10, 4); grille(g, 26, -2, 5, 10, 4);
    /* livery stripes */
    g.fillStyle = alpha(acc, 0.8); g.fillRect(-6, -17, 3, 37); g.fillRect(3, -17, 3, 37);
    panelLine(g, -20, -14, -22, 19, 0.3);
    panelLine(g, 20, -14, 22, 19, 0.3);
    g.fillStyle = 'rgba(255,255,255,.16)';
    rr(g, -22, -8, 44, 5, 2.5); g.fill();
    /* engine grille, number plate + exhausts */
    grille(g, -13, 0, 26, 11, 5);
    g.fillStyle = '#f2f2f6'; rr(g, -7, 12.5, 14, 6.5, 1.5); g.fill();
    g.fillStyle = col; star(g, 0, 15.8, 2.6, 1.1, 5); g.fill();
    g.fillStyle = '#5d5d6b';
    g.beginPath(); g.arc(-15, 15, 4.6, 0, TAU); g.fill();
    g.beginPath(); g.arc(15, 15, 4.6, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,180,110,.5)'; g.lineWidth = 0.9;
    g.beginPath(); g.arc(-15, 15, 3.7, 0, TAU); g.stroke(); g.beginPath(); g.arc(15, 15, 3.7, 0, TAU); g.stroke();
    g.fillStyle = '#0d0d14';
    g.beginPath(); g.arc(-15, 15, 3, 0, TAU); g.fill();
    g.beginPath(); g.arc(15, 15, 3, 0, TAU); g.fill();
    /* brake light bar */
    var bl = g.createLinearGradient(-26, 0, 26, 0);
    bl.addColorStop(0, 'rgba(255,60,50,.5)'); bl.addColorStop(0.5, 'rgba(255,90,80,.95)');
    bl.addColorStop(1, 'rgba(255,60,50,.5)');
    g.fillStyle = bl; rr(g, -26, -4, 52, 4, 2); g.fill();
    g.fillStyle = 'rgba(255,220,210,.7)'; rr(g, -24, -3.6, 48, 1, 0.5); g.fill();
    /* rear wing with endplates and struts */
    g.fillStyle = dark(col, 0.62); rr(g, -22, -20, 5, 12, 2); g.fill();
    rr(g, 17, -20, 5, 12, 2); g.fill();
    var wg = g.createLinearGradient(0, -30, 0, -22);
    wg.addColorStop(0, light(col, 0.35)); wg.addColorStop(1, dark(col, 0.35));
    g.fillStyle = wg; rr(g, -32, -30, 64, 8, 3); g.fill();
    g.fillStyle = alpha(acc, 0.85); rr(g, -12, -28.4, 24, 4.4, 1.6); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.42)'; g.lineWidth = 1; rr(g, -32, -30, 64, 8, 3); g.stroke();
    g.fillStyle = dark(col, 0.5); rr(g, -34, -32, 5, 12, 2); g.fill();
    rr(g, 29, -32, 5, 12, 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.3)'; rr(g, -33.4, -31.4, 1.2, 10, 0.6); g.fill(); rr(g, 29.6, -31.4, 1.2, 10, 0.6); g.fill();
    /* roll hoop + seat back + shoulders */
    g.fillStyle = '#2a2a36';
    g.beginPath(); g.arc(0, -18, 15, Math.PI, TAU); g.fill();
    g.fillStyle = '#20202a'; rr(g, -15, -15, 30, 17, 6); g.fill();
    g.fillStyle = dark(acc, 0.4); rr(g, -13, -13, 26, 12, 5); g.fill();
    g.fillStyle = 'rgba(255,255,255,.12)'; rr(g, -12, -12.4, 24, 2.4, 1.2); g.fill();
    /* elbows poking out to the wheel */
    g.fillStyle = dark(acc, 0.3);
    g.beginPath(); g.ellipse(-16, -8, 4, 3, -0.4, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(16, -8, 4, 3, 0.4, 0, TAU); g.fill();
    bolt(g, -28, 16, 1.1); bolt(g, 28, 16, 1.1);
  }
  if (part === 'head' || full) {
    var hg = g.createRadialGradient(-5, -27, 1, 0, -21, 15);
    hg.addColorStop(0, light(acc, 0.65)); hg.addColorStop(0.7, acc); hg.addColorStop(1, dark(acc, 0.38));
    g.fillStyle = hg; g.beginPath(); g.arc(0, -21, 13, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.38)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = dark(col, 0.05);
    g.beginPath(); g.arc(0, -21, 13, Math.PI * 1.12, Math.PI * 1.88); g.fill();
    g.fillStyle = col; g.fillRect(-2, -34, 4, 26);                       // helmet stripe
    g.fillStyle = 'rgba(255,255,255,.35)';
    g.beginPath(); g.ellipse(-5, -26, 4, 3, -0.5, 0, TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, -9, 8, 2.4, 0, 0, TAU); g.fill();
  }
}
/* kartRear(ctx,{x,y,s,col,acc,lean,boost, spd?, brake?, drift?, driftLv?, id?, fx?}) */
function kartRear(c, o) {
  var col = o.col || '#d8342a', acc = o.acc || '#f4f4f8', s = o.s || 1;
  var lite = s < 0.34;            // far away: one static bitmap
  if (lite) {
    var ef = cached('rf|' + col + '|' + acc, 96, 76, 1.6, function (g) { kartRearArt(g, col, acc, 'full'); });
    c.save(); c.translate(o.x, o.y); c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,.34)';
    c.beginPath(); c.ellipse(0, 30, 52, 12, 0, 0, TAU); c.fill();
    if (ef) c.drawImage(ef.cv, -ef.w / 2, -ef.h / 2 - 6, ef.w, ef.h); else kartRearArt(c, col, acc, 'full');
    c.restore();
    return;
  }
  var key = o.id || ('r' + col + acc);
  var st = kstate(key, o.x, o.y), dt = st.dt;
  var spd = clamp(o.spd === undefined ? (o.boost > 0 ? 1 : 0.5) : o.spd, 0, 2);
  st.ph = (st.ph + spd * dt * 9) % 1000;
  var e = cached('r|' + col + '|' + acc, 96, 76, 2.6, function (g) { kartRearArt(g, col, acc, 'body'); });
  var eh = cached('rh|' + col + '|' + acc, 30, 30, 3, function (g) { g.translate(0, 21); kartRearArt(g, col, acc, 'head'); });
  var q = ((st.ph % 1) * 4) | 0;
  var et = cached('rt|' + q, 26, 36, 3, function (g) { g.translate(0, -2); rearTyreArt(g, q / 4); });
  var lean = o.lean || 0, tn = st.t * 0.001;
  c.save(); c.translate(o.x, o.y); c.scale(s, s); c.rotate(lean * 0.06);
  c.fillStyle = 'rgba(0,0,0,.34)';
  c.beginPath(); c.ellipse(0, 30, 52, 12, 0, 0, TAU); c.fill();
  if (o.boost > 0) {
    c.globalCompositeOperation = 'lighter';
    for (var i = -1; i <= 1; i += 2) {
      var R = 20 + o.boost * 16 + Math.random() * 6;
      var g0 = c.createRadialGradient(i * 15, 17, 1, i * 15, 17, R);
      g0.addColorStop(0, 'rgba(255,252,225,.95)');
      g0.addColorStop(0.3, 'rgba(255,175,60,.7)');
      g0.addColorStop(0.7, 'rgba(255,80,30,.25)');
      g0.addColorStop(1, 'rgba(255,40,80,0)');
      c.fillStyle = g0;
      c.beginPath(); c.arc(i * 15, 17, R, 0, TAU); c.fill();
      /* licking flame tongues */
      c.fillStyle = 'rgba(255,200,110,.75)';
      for (var f = 0; f < 3; f++) {
        var fa = Math.PI * 0.5 + (f - 1) * 0.55 + Math.sin(tn * 30 + f + i) * 0.2, fl = 10 + o.boost * 14 + Math.random() * 8;
        c.beginPath(); c.moveTo(i * 15 - 3, 17); c.lineTo(i * 15 + Math.cos(fa) * fl, 17 + Math.sin(fa) * fl * 0.9); c.lineTo(i * 15 + 3, 17); c.closePath(); c.fill();
      }
    }
    c.globalCompositeOperation = 'source-over';
  }
  /* tyres squash a touch on the outside of a lean */
  var bounce = Math.sin(tn * (12 + spd * 10) + st.seed) * 0.6 * Math.min(1, spd);
  [-1, 1].forEach(function (sd) {
    if (et) c.drawImage(et.cv, sd * 40 - 13, 8 - 18 + 2 + (sd === Math.sign(lean) ? 1 : 0), 26, 36);
  });
  if (e) c.drawImage(e.cv, -e.w / 2, -e.h / 2 - 6 + bounce * 0.4, e.w, e.h); else kartRearArt(c, col, acc, 'full');
  if (eh) {
    var hb = Math.sin(tn * (8 + spd * 8) + st.seed * 2) * (0.5 + spd * 0.7);
    c.save(); c.translate(lean * 2.2, -21 + hb + bounce * 0.3); c.rotate(lean * 0.08);
    c.drawImage(eh.cv, -15, -15, 30, 30); c.restore();
  }
  if (o.brake) {
    glow(c, -18, -2, 16, '#ff3020', 0.8); glow(c, 18, -2, 16, '#ff3020', 0.8);
  }
  if (o.drift) {
    var dc = ['#ffffff', '#5fd0ff', '#ff9a2a', '#ff5ce0'][clamp(o.driftLv || 0, 0, 3)];
    glow(c, -40, 24, 16, dc, 0.7); glow(c, 40, 24, 16, dc, 0.7);
  }
  c.restore();
  if (o.fx) emitRearFX(o.fx, o, st, s, spd);
}
function emitRearFX(fx, o, st, s, spd) {
  var dt = st.dt, lean = o.lean || 0;
  var boosting = o.boost > 0;
  st.ex += dt * (boosting ? 30 : 5 + spd * 8);
  while (st.ex > 1) {
    st.ex -= 1;
    var sd = (st.sm = -st.sm || 1), x = o.x + (sd * 15 + lean * 0.9) * s, y = o.y + 11 * s;
    if (boosting) fx.emit({ x: x, y: y, vx: (Math.random() - .5) * 60 * s, vy: 40 * s + Math.random() * 40 * s,
      life: 0.3, r: 5 * s, r2: 1, col: ['#fff6d0', '#ffc35a', '#ff6a2a', '#a0306a'], shape: 'flame', add: true, drag: 2.2 });
    else fx.emit({ x: x, y: y, vx: (Math.random() - .5) * 26 * s, vy: 18 * s + Math.random() * 20 * s,
      life: 0.6, r: 2.5 * s, r2: 9 * s, col: 'rgba(170,170,180,.22)', shape: 'smoke', drag: 1.5, grav: -30 * s, vr: 2 });
  }
  if (o.drift) {
    var lv = clamp(o.driftLv || 0, 0, 3), dcol = ['#ffffff', '#6fd8ff', '#ffa040', '#ff6ae6'][lv];
    st.ds += dt * (40 + lv * 14);
    while (st.ds > 1) {
      st.ds -= 1;
      var side = Math.random() < 0.5 ? -1 : 1;
      var px = o.x + side * 44 * s, py = o.y + 26 * s;
      fx.emit({ x: px, y: py, vx: side * (60 + Math.random() * 120) * s, vy: (-80 - Math.random() * 120) * s, life: 0.35,
        r: 1.8 * s, col: dcol, shape: 'line', add: true, drag: 2.5, grav: 500 * s });
      if (Math.random() < 0.3) fx.emit({ x: px, y: py, vx: side * 30 * s, vy: -20 * s, life: 0.8, r: 6 * s, r2: 18 * s,
        col: 'rgba(225,225,235,.3)', shape: 'smoke', drag: 1.2, grav: -20 * s });
    }
  }
}

/* ---- side view (Trick Attack) */
function kartSideArt(g, col, acc) {
  g.fillStyle = 'rgba(0,0,0,.22)';
  g.beginPath(); g.ellipse(0, 9, 28, 5, 0, 0, TAU); g.fill();
  /* floor + suspension */
  g.fillStyle = '#23232c'; rr(g, -24, 0, 48, 4, 2); g.fill();
  g.strokeStyle = '#1c1c24'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-16, 2); g.lineTo(-10, -4); g.moveTo(16, 2); g.lineTo(10, -4); g.stroke();
  /* chassis */
  var gg = g.createLinearGradient(0, -20, 0, 6);
  gg.addColorStop(0, light(col, 0.55));
  gg.addColorStop(0.32, light(col, 0.18));
  gg.addColorStop(0.62, col);
  gg.addColorStop(1, dark(col, 0.45));
  g.fillStyle = gg;
  var shape = function () {
    g.beginPath();
    g.moveTo(-25, 3); g.lineTo(-23, -10);
    g.quadraticCurveTo(-7, -18, 8, -15);
    g.lineTo(22, -10); g.quadraticCurveTo(27, -6, 25, 3);
    g.closePath();
  };
  shape(); g.fill();
  g.save(); shape(); g.clip();
  g.fillStyle = alpha(acc, 0.85); g.fillRect(-30, -6.5, 60, 2); g.fillRect(-30, -3.4, 60, 0.9);
  g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(-30, -1, 60, 6);
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.2; shape(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.24)';
  g.beginPath(); g.moveTo(-20, -9); g.quadraticCurveTo(-6, -15.5, 7, -13); g.lineTo(7, -11);
  g.quadraticCurveTo(-6, -13.5, -20, -7); g.closePath(); g.fill();
  panelLine(g, -12, -13, -12, 3);
  panelLine(g, 6, -14, 6, 2);
  grille(g, -19, -6, 8, 7, 3);
  /* number roundel */
  g.fillStyle = '#f2f2f6'; g.beginPath(); g.arc(-3, -6, 3.6, 0, TAU); g.fill();
  g.fillStyle = col; star(g, -3, -6, 2.5, 1.05, 5); g.fill();
  /* wing, exhaust, splitter, headlight */
  g.fillStyle = dark(col, 0.58); rr(g, -29, -15, 5, 13, 2); g.fill();
  rr(g, -31, -16.5, 9, 3.4, 1.5); g.fill();
  g.fillStyle = alpha(acc, 0.9); rr(g, -30.4, -16, 7.8, 1.2, 0.6); g.fill();
  g.fillStyle = '#6a6a78'; rr(g, -28, -1, 7, 4, 2); g.fill();
  g.fillStyle = '#15151d'; rr(g, -27.5, -0.2, 3.4, 2.4, 1.2); g.fill();
  g.fillStyle = dark(col, 0.5);
  g.beginPath(); g.moveTo(22, -2); g.lineTo(29, 1); g.lineTo(29, 3); g.lineTo(22, 3); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,250,215,.95)'; g.beginPath(); g.ellipse(23.4, -6.4, 1.6, 1.9, 0, 0, TAU); g.fill();
  /* seat + steering wheel */
  g.fillStyle = '#15151d'; rr(g, -12, -16, 16, 9, 3); g.fill();
  g.fillStyle = '#2c2c38'; rr(g, -13, -24, 4, 12, 1.6); g.fill();
  g.strokeStyle = '#20202a'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(9, -13); g.lineTo(6, -18); g.stroke();
  g.beginPath(); g.ellipse(6, -18.5, 1.2, 3, 0.4, 0, TAU); g.stroke();
  bolt(g, -19, 1, 0.9); bolt(g, 17, 1, 0.9);
}
function kartSideDriver(g, col, acc) {
  g.fillStyle = dark(acc, 0.4); rr(g, -9, -20, 11, 10, 4); g.fill();
  g.fillStyle = 'rgba(255,255,255,.14)'; rr(g, -8, -19, 3, 8, 1.4); g.fill();
  g.strokeStyle = dark(acc, 0.2); g.lineWidth = 2.2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-2, -17); g.lineTo(5.5, -17.5); g.stroke();
  g.fillStyle = '#f4f4f8'; g.beginPath(); g.arc(6.2, -17.6, 1.4, 0, TAU); g.fill();
  var hg = g.createRadialGradient(-5, -24, 0.6, -2, -20, 6.4);
  hg.addColorStop(0, light(acc, 0.65)); hg.addColorStop(0.75, acc); hg.addColorStop(1, dark(acc, 0.32));
  g.fillStyle = hg; g.beginPath(); g.arc(-2, -20, 6, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.8; g.stroke();
  g.fillStyle = col; g.beginPath(); g.arc(-2, -20, 6, Math.PI * 1.05, Math.PI * 1.35); g.lineTo(-2, -20); g.fill();
  g.fillStyle = 'rgba(24,28,40,.92)';
  g.beginPath(); g.ellipse(1.4, -19.5, 2, 3, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(190,225,255,.55)';
  g.beginPath(); g.ellipse(1.7, -20.8, 0.9, 1.2, 0, 0, TAU); g.fill();
}
function wheelSideArt(g, spin) {
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(0, 1.4, 10.5, 0, TAU); g.fill();
  var t = g.createRadialGradient(-3, -3, 1, 0, 0, 11);
  t.addColorStop(0, '#2a2a33'); t.addColorStop(1, '#08080e');
  g.fillStyle = t; g.beginPath(); g.arc(0, 0, 10.5, 0, TAU); g.fill();
  g.save(); g.rotate(spin);
  g.fillStyle = 'rgba(255,255,255,.12)';
  for (var i = 0; i < 14; i++) {
    g.save(); g.rotate(i / 14 * TAU); g.fillRect(8.4, -1, 2.1, 2); g.restore();
  }
  g.restore();
  g.fillStyle = '#3a3a47'; g.beginPath(); g.arc(0, 0, 6.6, 0, TAU); g.fill();
  g.save(); g.rotate(spin);
  g.strokeStyle = '#7a7a8a'; g.lineWidth = 1.6;
  for (var k = 0; k < 5; k++) {
    var a2 = k / 5 * TAU;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a2) * 5.8, Math.sin(a2) * 5.8); g.stroke();
  }
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 0.8; g.beginPath(); g.arc(0, 0, 6.4, -2.6, -0.8); g.stroke();
  g.fillStyle = '#b4bac6'; g.beginPath(); g.arc(0, 0, 2, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(-0.7, -0.7, 0.9, 0, TAU); g.fill();
}
/* kartSide(ctx,{x,y,a,s,col,acc,spin,boost?,id?}) */
function kartSide(c, o) {
  var col = o.col || '#e0392b', acc = o.acc || '#f4f4f8', s = o.s || 1;
  var key = o.id || ('s' + col + acc), st = kstate(key, o.x, o.y), tn = st.t * 0.001;
  var e = cached('s|' + col + '|' + acc, 70, 52, 3, function (g) { kartSideArt(g, col, acc); });
  var ed = cached('sd|' + col + '|' + acc, 24, 24, 4, function (g) { g.translate(1, 18); kartSideDriver(g, col, acc); });
  c.save(); c.translate(o.x, o.y); c.rotate(o.a || 0); c.scale(s, s);
  /* scarf streaming behind the driver */
  var fl = Math.sin(tn * 14) * 2;
  c.strokeStyle = acc === '#f4f4f8' ? '#ffd23f' : acc; c.lineWidth = 2.2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-5, -12); c.quadraticCurveTo(-13, -12 + fl, -20, -10 - fl * 1.4); c.stroke();
  if (o.boost > 0) {
    c.globalCompositeOperation = 'lighter';
    var L = 10 + o.boost * 18 + Math.random() * 6;
    var gr = c.createLinearGradient(-28, 0, -28 - L, 0);
    gr.addColorStop(0, 'rgba(255,250,220,.95)'); gr.addColorStop(0.4, 'rgba(255,160,50,.7)'); gr.addColorStop(1, 'rgba(255,60,20,0)');
    c.fillStyle = gr;
    c.beginPath(); c.moveTo(-27, -1.5); c.lineTo(-27 - L, 1 + Math.sin(tn * 40)); c.lineTo(-27, 3.5); c.closePath(); c.fill();
    c.globalCompositeOperation = 'source-over';
  }
  if (e) c.drawImage(e.cv, -e.w / 2, -e.h / 2 + 4, e.w, e.h);
  else kartSideArt(c, col, acc);
  if (ed) { var bob = Math.sin(tn * 11) * 0.5; c.drawImage(ed.cv, -12 - 1, -18 - 12 + 4 + bob, 24, 24); }
  var sp = o.spin || 0;
  [-16, 16].forEach(function (wx) {
    c.save(); c.translate(wx, 0);
    var q = Math.round(sp / (TAU / 16)) % 16;
    var we = cached('w|' + q, 26, 26, 3, function (g) { wheelSideArt(g, q * TAU / 16); });
    if (we) c.drawImage(we.cv, -13, -13, 26, 26); else wheelSideArt(c, sp);
    c.restore();
  });
  c.restore();
}

/* ---------------------------------------------------- sky */
function skyGrad(c, w, h, stops) {
  var g = c.createLinearGradient(0, 0, 0, h);
  for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}
function sun(c, x, y, r, col) {
  var g = c.createRadialGradient(x, y, 0, x, y, r * 4.5);
  g.addColorStop(0, alpha(col, 0.95));
  g.addColorStop(0.16, alpha(col, 0.5));
  g.addColorStop(1, alpha(col, 0));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 4.5, 0, TAU); c.fill();
  /* slowly turning corona rays */
  var t = now() * 0.00008;
  c.save(); c.translate(x, y); c.rotate(t);
  c.fillStyle = alpha(col, 0.13);
  for (var i = 0; i < 12; i++) {
    c.rotate(TAU / 12);
    c.beginPath(); c.moveTo(r * 1.3, -r * 0.18); c.lineTo(r * (3 + (i % 3) * 0.8), 0); c.lineTo(r * 1.3, r * 0.18); c.closePath(); c.fill();
  }
  c.restore();
  c.fillStyle = light(col, 0.55); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(x, y, r * 0.7, 0, TAU); c.fill();
  c.strokeStyle = alpha(col, 0.35); c.lineWidth = 1.5;
  c.beginPath(); c.arc(x, y, r * 2.2, 0, TAU); c.stroke();
}
/* lens-flare ghosts along the line from the sun through the screen centre */
function lensFlare(c, w, h, sx, sy, amt) {
  if (!(amt > 0)) return;
  var cx = w / 2, cy = h / 2, dx = cx - sx, dy = cy - sy;
  var spots = [[0.35, 10, '#ffe9a8', 0.25], [0.7, 18, '#8fd8ff', 0.16], [1.1, 7, '#ffb0e0', 0.22], [1.45, 26, '#a8ffcf', 0.10], [1.8, 12, '#ffffff', 0.14]];
  for (var i = 0; i < spots.length; i++) {
    var sp = spots[i];
    glow(c, sx + dx * sp[0], sy + dy * sp[0], sp[1] * 1.6, sp[2], sp[3] * amt);
  }
}
/* one shaded cloud bitmap per variant: lit tops, blue-grey undersides */
function cloudSprite(v, tint) {
  return cached('cl|' + v + '|' + tint, 120, 60, 2, function (g) {
    var r = 16, rnd = function (i) { return hash(v * 31 + i); };
    var puffs = [];
    for (var i = 0; i < 7; i++) puffs.push([(rnd(i) - 0.5) * 70, (rnd(i + 9) - 0.6) * 18, r * (0.65 + rnd(i + 20) * 0.6)]);
    puffs.push([0, -10, r * 1.15]);
    var under = tint || '#c4d2e6';
    g.fillStyle = under;
    g.beginPath(); puffs.forEach(function (p) { g.moveTo(p[0] + p[2], p[1] + 4); g.arc(p[0], p[1] + 4, p[2], 0, TAU); }); g.fill();
    var gr = g.createLinearGradient(0, -30, 0, 22);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#f2f6fc'); gr.addColorStop(1, light(under, 0.4));
    g.fillStyle = gr;
    g.beginPath(); puffs.forEach(function (p) { g.moveTo(p[0] + p[2], p[1]); g.arc(p[0], p[1], p[2], 0, TAU); }); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)';
    puffs.forEach(function (p) { g.beginPath(); g.arc(p[0] - p[2] * 0.3, p[1] - p[2] * 0.35, p[2] * 0.45, 0, TAU); g.fill(); });
    g.fillStyle = 'rgba(120,140,170,.18)'; g.fillRect(-60, 14, 120, 8);
  });
}
function cloudBand(c, w, baseY, off, scale, col, tint) {
  var a = 1, m = String(col).match(/rgba\([^)]*,\s*([\d.]+)\)/);
  if (m) a = +m[1];
  var ga = c.globalAlpha;
  c.globalAlpha = ga * clamp(a * 1.25, 0, 1);
  for (var i = 0; i < 9; i++) {
    var x = ((((i * 197 + off) % (w + 320)) + (w + 320)) % (w + 320)) - 160;
    var y = baseY + (i % 3) * 17 * scale;
    var r = (16 + (i % 4) * 7) * scale;
    var e = cloudSprite(i % 4, tint);
    if (e) c.drawImage(e.cv, x - r * 2.6, y - r * 1.3, r * 5.2, r * 2.6);
  }
  c.globalAlpha = ga;
}
function hills(c, w, baseY, off, amp, freq, col, snow) {
  var pts = [];
  c.beginPath(); c.moveTo(0, baseY + 400); c.lineTo(0, baseY);
  for (var x = 0; x <= w + 6; x += 6) {
    var u = x + off;
    var y = baseY - amp * Math.sin(u * freq) - amp * 0.55 * Math.sin(u * freq * 2.7 + 1.3) - amp * 0.12 * Math.sin(u * freq * 9.1);
    pts.push([x, y]); c.lineTo(x, y);
  }
  c.lineTo(w, baseY + 400); c.closePath();
  var gr = c.createLinearGradient(0, baseY - amp * 1.6, 0, baseY + amp * 0.6);
  gr.addColorStop(0, light(col, 0.12)); gr.addColorStop(1, dark(col, 0.18));
  c.fillStyle = gr; c.fill();
  if (snow) {
    c.fillStyle = 'rgba(255,255,255,.55)';
    for (var i = 0; i < pts.length; i++) {
      if (pts[i][1] < baseY - amp * 0.85) c.fillRect(pts[i][0] - 3, pts[i][1], 7, 4 + (baseY - amp * 0.85 - pts[i][1]) * 0.5);
    }
  }
  /* sun-lit crest */
  c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 2;
  c.beginPath();
  for (var j = 0; j < pts.length; j++) j ? c.lineTo(pts[j][0], pts[j][1] + 1) : c.moveTo(pts[j][0], pts[j][1] + 1);
  c.stroke();
}
/* jagged mountain range with snow caps and a lit face */
function mountains(c, w, baseY, off, amp, col, o) {
  o = o || {};
  var step = 10, pts = [];
  for (var x = -step; x <= w + step; x += step) {
    var u = (x + off) * (o.freq || 0.004);
    var y = baseY - amp * (0.55 + 0.45 * Math.sin(u) * Math.sin(u * 0.37 + 2) + 0.25 * Math.abs(Math.sin(u * 3.1)) + 0.08 * Math.sin(u * 11.7));
    pts.push([x, y]);
  }
  c.beginPath(); c.moveTo(-step, baseY + 200);
  pts.forEach(function (p) { c.lineTo(p[0], p[1]); });
  c.lineTo(w + step, baseY + 200); c.closePath();
  var gr = c.createLinearGradient(0, baseY - amp, 0, baseY + 20);
  gr.addColorStop(0, light(col, 0.18)); gr.addColorStop(1, dark(col, 0.12));
  c.fillStyle = gr; c.fill();
  /* lit faces: short strokes down the slopes facing the light */
  c.fillStyle = 'rgba(255,255,255,.08)';
  c.beginPath();
  for (var i = 1; i < pts.length; i++) {
    if (pts[i][1] < pts[i - 1][1]) {
      c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.lineTo(pts[i][0] + 2, baseY); c.lineTo(pts[i - 1][0] + 6, baseY); c.closePath();
    }
  }
  c.fill();
  if (o.snow !== false) {
    var line = baseY - amp * (o.snowLine || 0.78);
    c.save();
    c.beginPath(); c.moveTo(-step, baseY);
    pts.forEach(function (p) { c.lineTo(p[0], p[1]); });
    c.lineTo(w + step, baseY); c.closePath(); c.clip();
    c.fillStyle = 'rgba(250,252,255,.85)';
    c.beginPath(); c.moveTo(-step, line);
    for (var k = 0; k < pts.length; k++) c.lineTo(pts[k][0], line + Math.sin(k * 1.9 + off * 0.01) * 4 + (k % 3) * 2);
    c.lineTo(w + step, -100); c.lineTo(-step, -100); c.closePath(); c.fill();
    c.restore();
  }
}
/* rolling silhouette of tree tops */
function treeline(c, w, baseY, off, col, s) {
  s = s || 1;
  c.fillStyle = col;
  c.beginPath(); c.moveTo(0, baseY + 60);
  var sp = 9 * s;
  var x0 = -((off % sp) + sp) % sp - sp;
  for (var x = x0; x <= w + sp; x += sp) {
    var i = Math.floor((x + off) / sp), hh = (6 + hash(i) * 9) * s;
    if (hash(i + 7) < 0.3) { c.lineTo(x, baseY - hh * 0.4); c.lineTo(x + sp * 0.5, baseY - hh * 1.4); c.lineTo(x + sp, baseY - hh * 0.4); }
    else c.quadraticCurveTo(x + sp * 0.5, baseY - hh * 1.5, x + sp, baseY - hh * 0.5);
  }
  c.lineTo(w, baseY + 60); c.closePath(); c.fill();
}
function birds(c, w, h, t, n, col) {
  c.save(); c.strokeStyle = col || 'rgba(30,40,60,.6)'; c.lineWidth = 1.3; c.lineCap = 'round';
  for (var i = 0; i < (n || 5); i++) {
    var x = ((i * 173 + t * (18 + i * 3)) % (w + 80)) - 40;
    var y = h * (0.12 + hash(i) * 0.22) + Math.sin(t * 0.7 + i) * 6;
    var f = Math.sin(t * 9 + i * 2) * 3, sz = 3 + (i % 3);
    c.beginPath(); c.moveTo(x - sz, y - f * 0.6); c.quadraticCurveTo(x - sz * 0.4, y - 1, x, y);
    c.quadraticCurveTo(x + sz * 0.4, y - 1, x + sz, y - f * 0.6); c.stroke();
  }
  c.restore();
}

/* ---------------------------------------------------- scenery props (cached) */
function treeArt(g, col1, col2, v) {
  /* base of trunk at (0,0) */
  g.fillStyle = 'rgba(0,0,0,.26)';
  g.beginPath(); g.ellipse(2, 2.5, 11, 3.8, 0, 0, TAU); g.fill();
  var tg = g.createLinearGradient(-2.4, 0, 2.4, 0);
  tg.addColorStop(0, '#3d2a18'); tg.addColorStop(0.45, '#7a5532'); tg.addColorStop(1, '#2f2012');
  g.fillStyle = tg;
  g.beginPath();
  g.moveTo(-3.2, 0.6); g.quadraticCurveTo(-1.6, -1, -1.5, -4); g.lineTo(-1.4, -10);
  g.lineTo(1.4, -10); g.lineTo(1.5, -4); g.quadraticCurveTo(1.6, -1, 3.4, 0.6); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 0.4;
  for (var b = 0; b < 4; b++) { g.beginPath(); g.moveTo(-0.8 + b * 0.5, -1.5 - b); g.lineTo(-0.6 + b * 0.5, -6 - b); g.stroke(); }
  g.strokeStyle = '#5a3d22'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, -8); g.lineTo(-4.5, -12.5); g.moveTo(0.3, -9); g.lineTo(4.4, -13); g.stroke();
  var blobs = v ? [[0, -15, 8.2], [-5.6, -11.6, 5.8], [5.4, -12, 6], [-2.6, -19.4, 6.2], [3.6, -18.4, 5.6], [0, -22.5, 4.4]]
                : [[0, -14, 8.6], [-5.2, -11, 6.2], [5.2, -11.6, 6], [-2.4, -18.4, 6.2], [3.4, -17.4, 5.4]];
  g.fillStyle = dark(col2 || '#2f6f34', 0.25);
  blobs.forEach(function (bb) { g.beginPath(); g.arc(bb[0] + 0.6, bb[1] + 1, bb[2], 0, TAU); g.fill(); });
  g.fillStyle = col2 || '#2f6f34';
  blobs.forEach(function (bb) { g.beginPath(); g.arc(bb[0], bb[1], bb[2], 0, TAU); g.fill(); });
  g.fillStyle = col1 || '#4a9a4e';
  blobs.forEach(function (bb) { g.beginPath(); g.arc(bb[0] - 1.1, bb[1] - 1.4, bb[2] * 0.8, 0, TAU); g.fill(); });
  g.fillStyle = light(col1 || '#4a9a4e', 0.25);
  blobs.forEach(function (bb) { g.beginPath(); g.arc(bb[0] - 2, bb[1] - 2.6, bb[2] * 0.45, 0, TAU); g.fill(); });
  /* leaf texture flecks */
  for (var i = 0; i < 40; i++) {
    var bl = blobs[i % blobs.length], an = hash(i * 3.1 + (v || 0)) * TAU, rd = hash(i * 7.7) * bl[2] * 0.9;
    g.fillStyle = i % 3 ? 'rgba(0,40,10,.18)' : 'rgba(255,255,230,.22)';
    g.beginPath(); g.arc(bl[0] + Math.cos(an) * rd, bl[1] + Math.sin(an) * rd, 0.75, 0, TAU); g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,.22)';
  g.beginPath(); g.arc(-3.4, -18.5, 2.4, 0, TAU); g.fill();
  if (v === 2) {   // a few blossoms / fruit
    g.fillStyle = '#ff8aa8';
    for (var f = 0; f < 7; f++) { g.beginPath(); g.arc((hash(f) - 0.5) * 14, -10 - hash(f + 5) * 12, 0.9, 0, TAU); g.fill(); }
  }
}
function tree(c, x, y, s, col1, col2, v) {
  v = v || 0;
  var e = cached('tr|' + col1 + '|' + col2 + '|' + v, 26, 36, 7, function (g) { g.translate(0, 11); treeArt(g, col1, col2, v); });
  if (!e) { c.save(); c.translate(x, y); c.scale(s, s); treeArt(c, col1, col2, v); c.restore(); return; }
  c.drawImage(e.cv, x - 13 * s, y - 29 * s, 26 * s, 36 * s);
}
function pineArt(g, col) {
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(2, 2, 8, 3, 0, 0, TAU); g.fill();
  g.fillStyle = '#5a3b20'; g.fillRect(-1.3, -6, 2.6, 6.5);
  for (var i = 0; i < 4; i++) {
    var y = -5 - i * 5.4, w = 9 - i * 1.8;
    g.fillStyle = dark(col, 0.25);
    g.beginPath(); g.moveTo(-w, y + 1); g.lineTo(0, y - 8); g.lineTo(w, y + 1); g.closePath(); g.fill();
    g.fillStyle = col;
    g.beginPath(); g.moveTo(-w, y); g.lineTo(0, y - 8); g.lineTo(w * 0.2, y); g.closePath(); g.fill();
    g.fillStyle = light(col, 0.22);
    g.beginPath(); g.moveTo(-w * 0.7, y - 0.6); g.lineTo(-1, y - 6.6); g.lineTo(-w * 0.15, y - 0.6); g.closePath(); g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.moveTo(0, -30); g.lineTo(-2, -27); g.lineTo(0, -26.4); g.fill();
}
function pine(c, x, y, s, col, snow) {
  col = col || '#2f7a46';
  var e = cached('pn|' + col + '|' + (snow ? 1 : 0), 22, 40, 7, function (g) {
    g.translate(0, 13); pineArt(g, col);
    if (snow) { g.fillStyle = 'rgba(255,255,255,.85)'; for (var i = 0; i < 4; i++) { var yy = -13 - i * 5.4; g.beginPath(); g.moveTo(-2, yy + 0.4); g.lineTo(0, yy - 1.6); g.lineTo(2, yy + 0.4); g.fill(); } }
  });
  if (e) c.drawImage(e.cv, x - 11 * s, y - 33 * s, 22 * s, 40 * s);
}
function palmArt(g) {
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(3, 2, 8, 2.6, 0, 0, TAU); g.fill();
  g.strokeStyle = '#8a6334'; g.lineWidth = 2.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-3, -12, 2, -24); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.5;
  for (var k = 0; k < 8; k++) { var t = k / 8, yy = -t * 24, xx = -3 * 2 * t * (1 - t) * 2 + 2 * t * t; g.beginPath(); g.moveTo(xx - 1.3, yy); g.lineTo(xx + 1.3, yy - 0.6); g.stroke(); }
  for (var i = 0; i < 7; i++) {
    var a = -Math.PI / 2 + (i - 3) * 0.55 + (i > 3 ? 0.2 : 0), L = 11 + (i % 2) * 2;
    g.fillStyle = i % 2 ? '#2f8a44' : '#3fa654';
    g.beginPath(); g.moveTo(2, -24);
    g.quadraticCurveTo(2 + Math.cos(a) * L * 0.6, -24 + Math.sin(a) * L * 0.6 - 4, 2 + Math.cos(a) * L, -24 + Math.sin(a) * L + 4);
    g.quadraticCurveTo(2 + Math.cos(a) * L * 0.5, -24 + Math.sin(a) * L * 0.5 + 1, 2, -23); g.fill();
  }
  g.fillStyle = '#6a4a20'; [[0.6, -23], [3, -22.5], [1.8, -21.4]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 1.1, 0, TAU); g.fill(); });
}
function palm(c, x, y, s) {
  var e = cached('palm', 34, 44, 6, function (g) { g.translate(0, 15); palmArt(g); });
  if (e) c.drawImage(e.cv, x - 17 * s, y - 37 * s, 34 * s, 44 * s);
}
function bush(c, x, y, s, col, flowers) {
  col = col || '#3f8f43';
  var e = cached('bu|' + col + '|' + (flowers || ''), 24, 18, 6, function (g) {
    g.translate(0, 3);
    g.fillStyle = 'rgba(0,0,0,.2)';
    g.beginPath(); g.ellipse(1.5, 1.5, 9, 3, 0, 0, TAU); g.fill();
    g.fillStyle = dark(col, 0.22);
    [[-5, 0, 5.4], [0, -2, 6.4], [5, 0, 5]].forEach(function (b) { g.beginPath(); g.arc(b[0], b[1], b[2], 0, TAU); g.fill(); });
    g.fillStyle = col;
    [[-5.2, -0.6, 4.6], [0, -2.6, 5.4], [4.6, -0.6, 4.2]].forEach(function (b) { g.beginPath(); g.arc(b[0], b[1], b[2], 0, TAU); g.fill(); });
    g.fillStyle = light(col, 0.25);
    [[-5.6, -1.6, 2.6], [-0.6, -4.4, 3]].forEach(function (b) { g.beginPath(); g.arc(b[0], b[1], b[2], 0, TAU); g.fill(); });
    if (flowers) {
      for (var i = 0; i < 9; i++) {
        var fx = (hash(i + 1) - 0.5) * 15, fy = -1 - hash(i + 4) * 6;
        g.fillStyle = flowers; g.beginPath(); g.arc(fx, fy, 0.9, 0, TAU); g.fill();
        g.fillStyle = '#fff4a0'; g.beginPath(); g.arc(fx, fy, 0.35, 0, TAU); g.fill();
      }
    }
  });
  if (e) c.drawImage(e.cv, x - 12 * s, y - 12 * s, 24 * s, 18 * s);
}
function rock(c, x, y, s) {
  var e = cached('rock', 26, 22, 6, function (g) {
    g.translate(0, 4);
    g.fillStyle = 'rgba(0,0,0,.24)';
    g.beginPath(); g.ellipse(1.5, 2, 11, 4, 0, 0, TAU); g.fill();
    g.fillStyle = '#6d7280';
    g.beginPath(); g.moveTo(-10, 1); g.lineTo(-6, -7); g.lineTo(2, -9); g.lineTo(9, -3); g.lineTo(8, 2); g.closePath(); g.fill();
    g.fillStyle = '#9399a8';
    g.beginPath(); g.moveTo(-6, -7); g.lineTo(2, -9); g.lineTo(1, -3); g.lineTo(-4, -2); g.closePath(); g.fill();
    g.fillStyle = '#565b68';
    g.beginPath(); g.moveTo(1, -3); g.lineTo(9, -3); g.lineTo(8, 2); g.lineTo(1, 1.5); g.closePath(); g.fill();
    g.fillStyle = 'rgba(80,140,70,.55)'; g.beginPath(); g.ellipse(-6, 0.5, 3, 1.2, 0.2, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-2, -6); g.lineTo(0, -3); g.lineTo(-1, 0); g.stroke();
  });
  if (e) c.drawImage(e.cv, x - 13 * s, y - 15 * s, 26 * s, 22 * s);
}
function flowers(c, x, y, s, col) {
  var e = cached('fl|' + col, 16, 10, 6, function (g) {
    g.translate(0, 3);
    for (var i = 0; i < 7; i++) {
      var fx = (hash(i * 2.3) - 0.5) * 13, fy = (hash(i * 5.1) - 0.5) * 5;
      g.strokeStyle = '#3f8a3a'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(fx, fy + 2.4); g.lineTo(fx, fy); g.stroke();
      g.fillStyle = i % 3 ? col : '#ffffff';
      for (var p = 0; p < 5; p++) { var a = p / 5 * TAU; g.beginPath(); g.arc(fx + Math.cos(a) * 0.8, fy + Math.sin(a) * 0.8, 0.6, 0, TAU); g.fill(); }
      g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(fx, fy, 0.45, 0, TAU); g.fill();
    }
  });
  if (e) c.drawImage(e.cv, x - 8 * s, y - 8 * s, 16 * s, 10 * s);
}
/* top-down props for the overhead games: canopies seen from above */
function treeTop(c, x, y, s, col1, col2, v) {
  col1 = col1 || '#57ad57'; col2 = col2 || '#2c6b32'; v = v || 0;
  var e = cached('tt|' + col1 + '|' + col2 + '|' + v, 34, 34, 4, function (g) {
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(4, 5, 12, 11, 0, 0, TAU); g.fill();
    var cl = [];
    for (var i = 0; i < 7; i++) { var a = i / 7 * TAU + v; cl.push([Math.cos(a) * 5.5, Math.sin(a) * 5.5, 5 + hash(i + v * 9) * 1.6]); }
    cl.push([0, 0, 6.5]);
    g.fillStyle = dark(col2, 0.2); cl.forEach(function (b) { g.beginPath(); g.arc(b[0] + 0.8, b[1] + 1, b[2], 0, TAU); g.fill(); });
    g.fillStyle = col2; cl.forEach(function (b) { g.beginPath(); g.arc(b[0], b[1], b[2], 0, TAU); g.fill(); });
    g.fillStyle = col1; cl.forEach(function (b) { g.beginPath(); g.arc(b[0] - 0.9, b[1] - 1, b[2] * 0.78, 0, TAU); g.fill(); });
    g.fillStyle = light(col1, 0.28); cl.forEach(function (b) { g.beginPath(); g.arc(b[0] - 1.8, b[1] - 1.9, b[2] * 0.38, 0, TAU); g.fill(); });
    for (var k = 0; k < 36; k++) {
      var aa = hash(k * 1.7 + v) * TAU, rr2 = hash(k * 3.3) * 10;
      g.fillStyle = k % 3 ? 'rgba(0,40,10,.2)' : 'rgba(255,255,230,.25)';
      g.beginPath(); g.arc(Math.cos(aa) * rr2, Math.sin(aa) * rr2, 0.7, 0, TAU); g.fill();
    }
  });
  if (e) c.drawImage(e.cv, x - 17 * s, y - 17 * s, 34 * s, 34 * s);
}
function bushTop(c, x, y, s, col, fl) {
  col = col || '#3f8f43';
  var e = cached('bt|' + col + '|' + (fl || ''), 20, 20, 4, function (g) {
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(2.5, 3, 7.5, 6.5, 0, 0, TAU); g.fill();
    [[-3, -1, 4], [2.5, -2, 4.2], [0, 2.6, 4], [3, 2.4, 3.2]].forEach(function (b) {
      g.fillStyle = col; g.beginPath(); g.arc(b[0], b[1], b[2], 0, TAU); g.fill();
      g.fillStyle = light(col, 0.25); g.beginPath(); g.arc(b[0] - 1, b[1] - 1, b[2] * 0.45, 0, TAU); g.fill();
    });
    if (fl) for (var i = 0; i < 7; i++) { g.fillStyle = fl; g.beginPath(); g.arc((hash(i) - 0.5) * 10, (hash(i + 3) - 0.5) * 9, 0.9, 0, TAU); g.fill(); }
  });
  if (e) c.drawImage(e.cv, x - 10 * s, y - 10 * s, 20 * s, 20 * s);
}
function cone(c, x, y, s) {
  var e = cached('cone', 10, 14, 7, function (g) {
    g.translate(0, 5);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(1, 1, 5, 1.6, 0, 0, TAU); g.fill();
    g.fillStyle = '#2a2a30'; g.fillRect(-4.5, -0.8, 9, 1.6);
    var gr = g.createLinearGradient(-3, 0, 3, 0); gr.addColorStop(0, '#d8501e'); gr.addColorStop(0.4, '#ff8a3a'); gr.addColorStop(1, '#b8401a');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-3.4, -0.6); g.lineTo(-0.8, -10); g.lineTo(0.8, -10); g.lineTo(3.4, -0.6); g.closePath(); g.fill();
    g.fillStyle = '#f4f4f8'; g.beginPath(); g.moveTo(-2.5, -3.6); g.lineTo(-1.6, -6.6); g.lineTo(1.6, -6.6); g.lineTo(2.5, -3.6); g.closePath(); g.fill();
  });
  if (e) c.drawImage(e.cv, x - 5 * s, y - 12 * s, 10 * s, 14 * s);
}
/* chevron corner sign on two legs */
function sign(c, x, y, s, dir, col) {
  col = col || '#ffd23f';
  var e = cached('sg|' + (dir < 0 ? 'l' : 'r') + '|' + col, 24, 20, 6, function (g) {
    g.translate(0, 9);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(1, 0.5, 9, 2, 0, 0, TAU); g.fill();
    g.fillStyle = '#9aa0ae'; g.fillRect(-7, -9, 1.3, 9); g.fillRect(5.7, -9, 1.3, 9);
    g.fillStyle = '#20202a'; rr(g, -10, -17, 20, 9, 1.5); g.fill();
    g.fillStyle = col; rr(g, -9.3, -16.3, 18.6, 7.6, 1.2); g.fill();
    g.fillStyle = '#20202a';
    for (var i = -1; i <= 1; i++) {
      var cx = i * 5.4, d = dir < 0 ? -1 : 1;
      g.beginPath(); g.moveTo(cx - 1.6 * d, -15.6); g.lineTo(cx + 1.6 * d, -12.5); g.lineTo(cx - 1.6 * d, -9.4); g.lineTo(cx - 0.2 * d, -9.4); g.lineTo(cx + 3 * d, -12.5); g.lineTo(cx - 0.2 * d, -15.6); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-9, -16, 18, 1);
  });
  if (e) c.drawImage(e.cv, x - 12 * s, y - 19 * s, 24 * s, 20 * s);
}
/* waving pennant on a pole (animated, not cached) */
function flag(c, x, y, s, col, t) {
  t = t === undefined ? now() * 0.001 : t;
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(x + 1 * s, y, 3 * s, 1 * s, 0, 0, TAU); c.fill();
  c.fillStyle = '#c9ccd8'; c.fillRect(x - 0.6 * s, y - 26 * s, 1.2 * s, 26 * s);
  c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(x, y - 26 * s, 1.2 * s, 0, TAU); c.fill();
  c.fillStyle = col || '#e0392b';
  c.beginPath(); c.moveTo(x + 0.6 * s, y - 25 * s);
  for (var i = 0; i <= 6; i++) { var u = i / 6; c.lineTo(x + (0.6 + u * 12) * s, y - (25 - u * 3) * s + Math.sin(t * 7 - u * 4) * 1.4 * s * u); }
  for (var j = 6; j >= 0; j--) { var v = j / 6; c.lineTo(x + (0.6 + v * 12) * s, y - (19 + v * 0.5) * s + Math.sin(t * 7 - v * 4) * 1.4 * s * v); }
  c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x + 0.6 * s, y - 25 * s, 4 * s, 1 * s);
}
function lamp(c, x, y, s, lit) {
  var e = cached('lamp', 14, 34, 6, function (g) {
    g.translate(0, 15);
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(1, 1, 4, 1.4, 0, 0, TAU); g.fill();
    g.fillStyle = '#3a3f4e'; g.fillRect(-0.8, -30, 1.6, 30); g.fillRect(-2, -1.5, 4, 1.5);
    g.fillRect(0, -30, 6, 1.2);
    g.fillStyle = '#2a2e3a'; rr(g, 3.6, -30, 4.4, 2.4, 1); g.fill();
    g.fillStyle = '#fff3c0'; g.fillRect(4.2, -28, 3.2, 0.9);
  });
  if (e) c.drawImage(e.cv, x - 7 * s, y - 32 * s, 14 * s, 34 * s);
  if (lit) glow(c, x + 5.8 * s, y - 31 * s, 9 * s, '#ffe7a0', 0.7);
}
/* side-on grandstand with a cheering crowd */
function grandstand(c, x, y, s, n, t) {
  n = n || 14; t = t === undefined ? now() * 0.001 : t;
  var w = n * 5 * s;
  c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x - w / 2 + 2 * s, y - 1 * s, w, 3 * s);
  c.fillStyle = '#3a4258'; c.fillRect(x - w / 2, y - 18 * s, w, 18 * s);
  c.fillStyle = '#c9333a'; c.fillRect(x - w / 2 - 1 * s, y - 22 * s, w + 2 * s, 4 * s);
  c.fillStyle = '#f0f0f4'; for (var k = 0; k < n; k += 2) c.fillRect(x - w / 2 + k * 5 * s, y - 22 * s, 5 * s, 4 * s);
  var cols = ['#e8544c', '#4fa3e0', '#f2c33c', '#7de08a', '#c98ae0', '#f0f0f4', '#f08a4a'];
  for (var r = 0; r < 3; r++) for (var i = 0; i < n; i++) {
    var px = x - w / 2 + (i + 0.5) * 5 * s, py = y - (15 - r * 5) * s;
    var jump = Math.max(0, Math.sin(t * 9 + i * 1.7 + r * 2)) * 1.2 * s;
    c.fillStyle = cols[(i * 3 + r * 5) % cols.length];
    c.fillRect(px - 1.6 * s, py - jump, 3.2 * s, 3 * s);
    c.fillStyle = '#f0c49a'; c.beginPath(); c.arc(px, py - 1.4 * s - jump, 1.3 * s, 0, TAU); c.fill();
  }
}
function fence(c, x1, y1, x2, y2, s) {
  var n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / (14 * s)));
  c.strokeStyle = '#d8d8e2'; c.lineWidth = 2 * s;
  [0.32, 0.68].forEach(function (t) {
    c.beginPath();
    c.moveTo(x1, y1 - 12 * s * t); c.lineTo(x2, y2 - 12 * s * t); c.stroke();
  });
  for (var i = 0; i <= n; i++) {
    var x = x1 + (x2 - x1) * i / n, y = y1 + (y2 - y1) * i / n;
    c.fillStyle = 'rgba(0,0,0,.2)';
    c.fillRect(x - 1.4 * s + 1.5, y - 12 * s + 2, 3 * s, 13 * s);
    c.fillStyle = i % 2 ? '#e8e8f0' : '#c9333a';
    c.fillRect(x - 1.4 * s, y - 12 * s, 3 * s, 13 * s);
  }
}
function tyreWall(c, x, y, n, s) {
  for (var i = 0; i < n; i++) {
    var tx = x + i * 11 * s;
    c.fillStyle = 'rgba(0,0,0,.28)';
    c.beginPath(); c.ellipse(tx + 1.5, y + 2, 6.4 * s, 3 * s, 0, 0, TAU); c.fill();
    var g = c.createRadialGradient(tx - 2 * s, y - 2 * s, 0.6, tx, y, 6.4 * s);
    g.addColorStop(0, '#3a3a46'); g.addColorStop(1, '#0e0e15');
    c.fillStyle = g; c.beginPath(); c.arc(tx, y, 6.4 * s, 0, TAU); c.fill();
    c.fillStyle = i % 3 === 0 ? '#e04a3c' : '#f0f0f4';
    c.beginPath(); c.arc(tx, y, 3.4 * s, 0, TAU); c.fill();
    c.fillStyle = '#1a1a22';
    c.beginPath(); c.arc(tx, y, 2.1 * s, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(tx - 2.6 * s, y - 2.6 * s, 1.4 * s, 0, TAU); c.fill();
  }
}
function crowdRow(c, x, y, n, s, seed) {
  var cols = ['#e8544c', '#4fa3e0', '#f2c33c', '#7de08a', '#c98ae0', '#f0f0f4', '#f08a4a'];
  for (var i = 0; i < n; i++) {
    var px = x + i * 7 * s, py = y + ((i * 37 + (seed || 0)) % 3) * 2 * s;
    c.fillStyle = '#2b3348';
    c.beginPath(); c.arc(px, py + 3 * s, 3.2 * s, Math.PI, TAU); c.fill();
    c.fillStyle = cols[(i * 5 + (seed || 0)) % cols.length];
    c.beginPath(); c.arc(px, py, 2.4 * s, 0, TAU); c.fill();
  }
}
function checkerStrip(c, x, y, ang, cols, rows, cell) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.fillRect(-cols * cell / 2 - 2, -rows * cell - 2, cols * cell + 4, rows * cell * 2 + 4);
  for (var i = -rows; i < rows; i++) for (var j = 0; j < cols; j++) {
    c.fillStyle = ((i + j) & 1) ? '#f4f4f8' : '#20202c';
    c.fillRect(j * cell - cols * cell / 2, i * cell, cell, cell);
  }
  c.fillStyle = 'rgba(255,255,255,.10)';
  c.fillRect(-cols * cell / 2, -rows * cell, cols * cell, 2);
  c.restore();
}
function cloudShadow(c, w, h, off, amt) {
  c.save(); c.globalAlpha = amt === undefined ? 0.10 : amt;
  c.fillStyle = '#0a1420';
  for (var i = 0; i < 5; i++) {
    var x = ((i * 313 + off) % (w + 500)) - 250;
    var y = h * (0.25 + (i % 3) * 0.22);
    c.beginPath();
    c.ellipse(x, y, 150 + (i % 3) * 60, 62 + (i % 2) * 26, 0.3, 0, TAU);
    c.ellipse(x + 90, y + 30, 90 + (i % 2) * 30, 50, 0.1, 0, TAU);
    c.fill();
  }
  c.restore();
}

/* ---------------------------------------------------- baked texture detail
   (called once while a game paints its static world canvas) */
/* grass blades, clover, flowers and mown stripes */
function paintGrass(g, w, h, o) {
  o = o || {};
  var n = o.blades === undefined ? Math.round(w * h / 90) : o.blades;
  var cols = o.cols || ['rgba(255,255,220,.10)', 'rgba(0,40,0,.12)', 'rgba(120,200,90,.14)'];
  if (o.stripes) {
    g.save(); g.translate(w / 2, h / 2); g.rotate(o.stripeAng || 0.5);
    var D = Math.hypot(w, h);
    for (var sx = -D; sx < D; sx += o.stripes * 2) { g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(sx, -D, o.stripes, D * 2); }
    g.restore();
  }
  g.lineWidth = 1; g.lineCap = 'round';
  for (var i = 0; i < n; i++) {
    var x = Math.random() * w, y = Math.random() * h;
    if (o.avoid && o.avoid(x, y)) continue;
    g.strokeStyle = cols[i % cols.length];
    var l = 2 + Math.random() * 3, a = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  var nf = o.flowers === undefined ? Math.round(w * h / 2400) : o.flowers;
  var fc = o.flowerCols || ['#ffffff', '#ffe066', '#ff9ec4', '#b9a0ff'];
  for (var f = 0; f < nf; f++) {
    var fx = Math.random() * w, fy = Math.random() * h;
    if (o.avoid && o.avoid(fx, fy)) continue;
    /* flowers grow in little clumps */
    var cn = 1 + (Math.random() * 4) | 0, col = fc[(Math.random() * fc.length) | 0];
    for (var k = 0; k < cn; k++) {
      var px = fx + (Math.random() - 0.5) * 9, py = fy + (Math.random() - 0.5) * 9;
      g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(px - 1, py, 3, 1.4);
      g.fillStyle = col; g.fillRect(px - 1, py - 1, 2.2, 2.2);
      g.fillStyle = '#ffd23f'; g.fillRect(px - 0.3, py - 0.3, 0.8, 0.8);
    }
  }
}
/* offset polyline helper for closed loops */
function offsetLoop(pts, d) {
  var n = pts.length, out = [];
  for (var i = 0; i < n; i++) {
    var a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    var dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    out.push({ x: pts[i].x - dy / L * d, y: pts[i].y + dx / L * d });
  }
  return out;
}
function strokeLoop(g, pts, w, col, dash) {
  g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
  for (var i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath(); g.lineWidth = w; g.strokeStyle = col; g.lineJoin = 'round';
  g.setLineDash(dash || []); g.stroke(); g.setLineDash([]);
}
/* asphalt wear, edge lines, kerb shading, skid marks and patches along a closed track */
function trackDetail(g, pts, roadW, o) {
  o = o || {};
  var n = pts.length, hw = roadW / 2, kerb = o.kerb === undefined ? 11 : o.kerb, run = o.runoff === undefined ? 44 : o.runoff;
  var curv = [];
  for (var i = 0; i < n; i++) {
    var a = pts[(i - 3 + n) % n], b = pts[i], c2 = pts[(i + 3) % n];
    var a1 = Math.atan2(b.y - a.y, b.x - a.x), a2 = Math.atan2(c2.y - b.y, c2.x - b.x), d = a2 - a1;
    while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    curv.push(d);
  }
  g.save(); g.lineCap = 'round';
  /* grass edge shadow beyond the run-off, and a darker sand lip */
  if (run > 0) [1, -1].forEach(function (sd) {
    strokeLoop(g, offsetLoop(pts, sd * (hw + kerb + run + 2)), 6, 'rgba(0,30,0,.16)');
    strokeLoop(g, offsetLoop(pts, sd * (hw + kerb + run - 2)), 3, 'rgba(120,90,40,.25)');
  });
  /* kerb relief: outer shadow, inner highlight */
  [1, -1].forEach(function (sd) {
    strokeLoop(g, offsetLoop(pts, sd * (hw + kerb)), 2.4, 'rgba(0,0,0,.35)');
    strokeLoop(g, offsetLoop(pts, sd * (hw + kerb - 2)), 1.2, 'rgba(255,255,255,.28)');
    strokeLoop(g, offsetLoop(pts, sd * (hw + 0.5)), 3, 'rgba(0,0,0,.28)');
    if (o.edgeLine !== false) strokeLoop(g, offsetLoop(pts, sd * (hw - 5)), 2.2, o.edgeCol || 'rgba(238,238,244,.78)');
  });
  /* patched asphalt */
  for (var p = 0; p < (o.patches === undefined ? n / 6 : o.patches); p++) {
    var k = (Math.random() * n) | 0, q = pts[k], r = pts[(k + 1) % n];
    var ang = Math.atan2(r.y - q.y, r.x - q.x), off = (Math.random() - 0.5) * roadW * 0.6;
    g.save(); g.translate(q.x - Math.sin(ang) * off, q.y + Math.cos(ang) * off); g.rotate(ang);
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.04)';
    g.fillRect(-8 - Math.random() * 14, -5 - Math.random() * 6, 18 + Math.random() * 26, 10 + Math.random() * 10);
    g.restore();
  }
  /* hairline cracks */
  g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 0.8;
  for (var cr = 0; cr < (o.cracks === undefined ? n / 3 : o.cracks); cr++) {
    var ci = (Math.random() * n) | 0, cp = pts[ci], co = (Math.random() - 0.5) * roadW * 0.85;
    var x = cp.x + (Math.random() - 0.5) * 8 + co * 0.3, y = cp.y + (Math.random() - 0.5) * 8 + co * 0.7;
    g.beginPath(); g.moveTo(x, y);
    for (var s2 = 0; s2 < 4; s2++) { x += (Math.random() - 0.5) * 9; y += (Math.random() - 0.5) * 9; g.lineTo(x, y); }
    g.stroke();
  }
  /* rubber skid marks through the corners */
  for (var j = 0; j < n; j++) {
    if (Math.abs(curv[j]) < (o.skidCurve || 0.07) || Math.random() < 0.5) continue;
    var lat = (curv[j] > 0 ? -1 : 1) * hw * (0.15 + Math.random() * 0.55);
    var len = 4 + (Math.random() * 6) | 0;
    [-4, 4].forEach(function (tw) {
      g.strokeStyle = 'rgba(15,15,20,' + (0.10 + Math.random() * 0.12) + ')'; g.lineWidth = 2.6;
      g.beginPath();
      for (var m = 0; m <= len; m++) {
        var idx = (j + m) % n, pa = pts[idx], pb = pts[(idx + 1) % n];
        var an = Math.atan2(pb.y - pa.y, pb.x - pa.x), dd = lat + tw + m * 0.6 * (curv[j] > 0 ? 1 : -1);
        var xx = pa.x - Math.sin(an) * dd, yy = pa.y + Math.cos(an) * dd;
        m ? g.lineTo(xx, yy) : g.moveTo(xx, yy);
      }
      g.stroke();
    });
  }
  /* tyre tracks in the run-off where karts ran wide */
  if (run > 0) for (var t2 = 0; t2 < n; t2++) {
    if (Math.abs(curv[t2]) < 0.09 || Math.random() < 0.7) continue;
    var side = curv[t2] > 0 ? 1 : -1, base = hw + kerb + 6 + Math.random() * run * 0.6;
    g.strokeStyle = 'rgba(90,60,25,.25)'; g.lineWidth = 2;
    for (var tw2 = -3; tw2 <= 3; tw2 += 6) {
      g.beginPath();
      for (var mm = 0; mm < 6; mm++) {
        var id2 = (t2 + mm) % n, qa = pts[id2], qb = pts[(id2 + 1) % n], an2 = Math.atan2(qb.y - qa.y, qb.x - qa.x);
        var d2 = side * (base + tw2 + Math.sin(mm) * 3);
        var x2 = qa.x - Math.sin(an2) * d2, y2 = qa.y + Math.cos(an2) * d2;
        mm ? g.lineTo(x2, y2) : g.moveTo(x2, y2);
      }
      g.stroke();
    }
  }
  g.restore();
}
/* soft drop shadow ring for anything painted onto the ground */
function groundAO(g, x, y, rx, ry, a) {
  var gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  gr.addColorStop(0, 'rgba(0,0,0,' + (a || 0.3) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, rx, 0, TAU); g.fill(); g.restore();
}

/* ---------------------------------------------------- ambient + weather */
function lightShafts(c, w, h, sx, sy, amt, col) {
  if (amt <= 0) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  var n = 9, sw = now() * 0.00005;
  for (var i = 0; i < n; i++) {
    var a = (i / n) * TAU + (i % 2 ? 0.13 : -0.09) + Math.sin(sw + i) * 0.03;
    var spread = 0.05 + (i % 3) * 0.022;
    var len = Math.max(w, h) * 1.25;
    var g = c.createLinearGradient(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
    g.addColorStop(0, alpha(col || '#ffe9a8', 0.14 * amt));
    g.addColorStop(0.45, alpha(col || '#ffe9a8', 0.05 * amt));
    g.addColorStop(1, alpha(col || '#ffe9a8', 0));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(sx, sy);
    c.lineTo(sx + Math.cos(a - spread) * len, sy + Math.sin(a - spread) * len);
    c.lineTo(sx + Math.cos(a + spread) * len, sy + Math.sin(a + spread) * len);
    c.closePath(); c.fill();
  }
  c.restore();
  c.globalCompositeOperation = 'source-over';
}
function motes(c, w, h, t, n, col) {
  c.save();
  for (var i = 0; i < (n || 34); i++) {
    var sx = ((i * 137.5 + t * (12 + (i % 5) * 7)) % (w + 60)) - 30;
    var sy = ((i * 83.3 + Math.sin(t * 0.6 + i) * 26 + t * 5) % (h + 60)) - 30;
    var r = 0.7 + (i % 4) * 0.55;
    c.globalAlpha = 0.10 + ((i * 7) % 5) * 0.045;
    c.fillStyle = col || '#ffffff';
    c.beginPath(); c.arc(sx, sy, r, 0, TAU); c.fill();
  }
  c.restore();
  c.globalAlpha = 1;
}
/* stateless weather layer: leaves, petals, snow, rain, dust, sparkle, fireflies, bubbles, embers.
   o.wind shifts drift, o.speed scrolls toward the camera (0..1) */
function weather(c, w, h, t, kind, n, o) {
  o = o || {}; n = n || 40;
  var wind = o.wind || 0, spd = o.speed || 0;
  c.save();
  for (var i = 0; i < n; i++) {
    var h1 = hash(i * 1.37), h2 = hash(i * 2.91 + 4), h3 = hash(i * 5.13 + 9);
    var x, y, a;
    switch (kind) {
      case 'rain':
        x = ((h1 * (w + 200) + t * (wind * 60 - 120 * h3)) % (w + 200) + w + 200) % (w + 200) - 100;
        y = ((h2 * h + t * (700 + h3 * 400)) % (h + 40)) - 20;
        c.strokeStyle = 'rgba(190,210,240,' + (0.18 + h3 * 0.25) + ')'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3 - wind * 4, y + 12 + h3 * 8); c.stroke();
        break;
      case 'snow':
        x = ((h1 * (w + 60) + Math.sin(t * (0.6 + h3) + i) * 22 + t * wind * 30) % (w + 60) + w + 60) % (w + 60) - 30;
        y = ((h2 * h + t * (24 + h3 * 40)) % (h + 20)) - 10;
        c.fillStyle = 'rgba(255,255,255,' + (0.5 + h3 * 0.4) + ')';
        c.beginPath(); c.arc(x, y, 1 + h3 * 2, 0, TAU); c.fill();
        break;
      case 'leaves': case 'petals':
        x = ((h1 * (w + 80) - t * (30 + h3 * 40) * (1 + spd * 3) + t * wind * 40) % (w + 80) + w + 80) % (w + 80) - 40;
        y = ((h2 * h + t * (20 + h3 * 30) + Math.sin(t * 2 + i) * 14) % (h + 30)) - 15;
        a = t * (2 + h3 * 3) + i;
        c.save(); c.translate(x, y); c.rotate(a); c.scale(1, Math.cos(a * 1.3));
        c.fillStyle = kind === 'petals' ? ['#ffb7d0', '#ffd6e4', '#ffffff'][i % 3] : ['#e0902a', '#c8641e', '#e8c24a', '#9ab83a'][i % 4];
        c.beginPath(); c.ellipse(0, 0, 3.2 + h3 * 2, 1.6 + h3, 0, 0, TAU); c.fill();
        c.restore();
        break;
      case 'dust':
        x = ((h1 * (w + 60) - t * (40 + h3 * 80) * (1 + spd * 4)) % (w + 60) + w + 60) % (w + 60) - 30;
        y = h * (0.35 + h2 * 0.65) + Math.sin(t + i) * 8;
        c.fillStyle = 'rgba(230,200,150,' + (0.08 + h3 * 0.14) + ')';
        c.beginPath(); c.arc(x, y, 1 + h3 * 3, 0, TAU); c.fill();
        break;
      case 'sparkle':
        x = h1 * w; y = h2 * h;
        a = Math.max(0, Math.sin(t * (2 + h3 * 3) + i * 1.7));
        if (a > 0.05) { c.globalAlpha = a; c.fillStyle = o.col || ['#ffffff', '#ffe38a', '#9fe8ff', '#ff9ef0'][i % 4]; star(c, x, y, 2.6 * a + 0.6, 0.7, 4, t + i); c.fill(); c.globalAlpha = 1; }
        break;
      case 'fireflies':
        x = h1 * w + Math.sin(t * 0.7 + i) * 30; y = h * (0.3 + h2 * 0.7) + Math.cos(t * 0.9 + i * 2) * 20;
        a = 0.4 + 0.6 * Math.max(0, Math.sin(t * 3 + i));
        glow(c, x, y, 6 + h3 * 4, o.col || '#d8ff7a', a * 0.8);
        break;
      case 'bubbles':
        x = h1 * w + Math.sin(t * 1.3 + i) * 10; y = ((h2 * (h + 40) - t * (30 + h3 * 40)) % (h + 40) + h + 40) % (h + 40) - 20;
        c.strokeStyle = 'rgba(200,240,255,.4)'; c.lineWidth = 1;
        c.beginPath(); c.arc(x, y, 2 + h3 * 4, 0, TAU); c.stroke();
        break;
      case 'embers':
        x = ((h1 * (w + 40) + Math.sin(t + i) * 20) % (w + 40)) - 20; y = ((h2 * (h + 40) - t * (40 + h3 * 60)) % (h + 40) + h + 40) % (h + 40) - 20;
        glow(c, x, y, 3 + h3 * 3, '#ff9a3a', 0.6);
        break;
    }
  }
  c.restore();
}

/* ---------------------------------------------------- post-processing */
var _bl = null, _blg = null;
function bloom(c, src, amt, blurPx) {
  if (!HAS_DOM || !src || !src.width) return;
  var w = src.width, h = src.height;
  var dw = Math.max(2, w >> 2), dh = Math.max(2, h >> 2);
  if (!_bl) { _bl = document.createElement('canvas'); _blg = _bl.getContext('2d'); }
  if (_bl.width !== dw || _bl.height !== dh) { _bl.width = dw; _bl.height = dh; }
  _blg.globalCompositeOperation = 'source-over';
  _blg.clearRect(0, 0, dw, dh);
  /* crude bright-pass + blur, both at quarter resolution (16x cheaper than
     blurring the full frame); bilinear upscaling softens it the rest of the way */
  _blg.filter = 'contrast(2.7) brightness(0.72) saturate(1.35) blur(' + ((blurPx || 7) / 3.2).toFixed(2) + 'px)';
  _blg.drawImage(src, 0, 0, dw, dh);
  _blg.filter = 'none';
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = amt === undefined ? 0.34 : amt;
  c.imageSmoothingEnabled = true;
  c.drawImage(_bl, 0, 0, w, h);
  c.restore();
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
}
var _grain = null;
function grain(c, w, h, amt) {
  if (!HAS_DOM) return;
  if (!_grain) {
    _grain = document.createElement('canvas'); _grain.width = 128; _grain.height = 128;
    var g = _grain.getContext('2d');
    var id = g.createImageData(128, 128), d = id.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = 110 + Math.random() * 70;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
  }
  c.save();
  c.globalAlpha = amt === undefined ? 0.05 : amt;
  c.globalCompositeOperation = 'overlay';
  var ox = (Math.random() * 128) | 0, oy = (Math.random() * 128) | 0;
  for (var x = -ox; x < w; x += 128) for (var y = -oy; y < h; y += 128) c.drawImage(_grain, x, y);
  c.restore();
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
}
function vignette(c, w, h, st) {
  var g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.74);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.72, 'rgba(0,0,0,' + (st === undefined ? 0.5 : st) * 0.42 + ')');
  g.addColorStop(1, 'rgba(0,0,0,' + (st === undefined ? 0.5 : st) + ')');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}
function scanlines(c, w, h, a) {
  c.fillStyle = 'rgba(0,0,0,' + (a || 0.06) + ')';
  for (var y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
}
/* radial streaks that fly outward over time */
function speedLines(c, w, h, amount, col) {
  if (!(amount > 0)) return;
  var t = now() * 0.001;
  c.save(); c.lineCap = 'round';
  var n = 14 + (amount * 26) | 0, R = Math.min(w, h), rgb = col ? hex2rgb(col).join(',') : '255,255,255';
  for (var i = 0; i < n; i++) {
    var a = hash(i * 3.3 + Math.floor(t * 3 + hash(i) * 3)) * TAU;
    var prog = (t * (1.6 + hash(i) * 1.4) + hash(i * 7)) % 1;
    var r0 = R * (0.32 + prog * 0.45), len = 30 + amount * 120 * (0.5 + hash(i * 9));
    var x0 = w / 2 + Math.cos(a) * r0, y0 = h / 2 + Math.sin(a) * r0;
    var x1 = w / 2 + Math.cos(a) * (r0 + len), y1 = h / 2 + Math.sin(a) * (r0 + len);
    var g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(' + rgb + ',0)');
    g.addColorStop(1, 'rgba(' + rgb + ',' + (0.06 + amount * 0.26) * Math.sin(prog * Math.PI) + ')');
    c.strokeStyle = g; c.lineWidth = 1 + amount * 2 * hash(i * 5);
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  }
  c.restore();
}
function flash(c, w, h, col, a) { if (!(a > 0)) return; c.fillStyle = alpha(col, Math.min(1, a)); c.fillRect(0, 0, w, h); }
function gloss(c, x, y, w, h, t, a) {
  var p = ((t * 0.00035) % 1.6) - 0.3;
  var gx = x + w * p;
  var g = c.createLinearGradient(gx - w * 0.22, y, gx + w * 0.22, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,' + (a === undefined ? 0.15 : a) + ')');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(x, y, w, h);
}
function ripple(c, x, y, w, h, t, col) {
  c.save();
  c.strokeStyle = col || 'rgba(255,255,255,.22)';
  for (var i = 0; i < 14; i++) {
    var yy = y + h * (i / 14);
    var amp = 2 + (i % 3);
    c.lineWidth = 1 + (i % 2);
    c.globalAlpha = 0.10 + (i % 4) * 0.045;
    c.beginPath();
    for (var xx = x; xx <= x + w; xx += 12) {
      var v = yy + Math.sin(xx * 0.02 + t * 0.002 + i) * amp;
      xx === x ? c.moveTo(xx, v) : c.lineTo(xx, v);
    }
    c.stroke();
  }
  c.restore();
  c.globalAlpha = 1;
}
/* keys held when the window loses focus never get a keyup — clear them */
function trackKeys(keys) {
  if (typeof root.addEventListener !== 'function') return;
  root.addEventListener('blur', function () {
    for (var k in keys) if (Object.prototype.hasOwnProperty.call(keys, k)) keys[k] = false;
  });
}

/* ---------------------------------------------------- HUD widgets */
function glowText(c, txt, x, y, o) {
  o = o || {};
  c.save();
  c.font = o.font || 'bold 26px Segoe UI';
  c.textAlign = o.align || 'center';
  c.textBaseline = o.baseline || 'alphabetic';
  if (o.glow !== false) { c.shadowColor = o.glowCol || o.fill || '#ffd75e'; c.shadowBlur = o.blur || 18; }
  if (o.stroke) { c.lineWidth = o.strokeW || 4; c.strokeStyle = o.stroke; c.lineJoin = 'round'; c.strokeText(txt, x, y); }
  c.fillStyle = o.fill || '#ffd75e';
  c.fillText(txt, x, y);
  c.restore();
}
/* hud text with a crisp drop shadow; returns its width */
function hudText(c, txt, x, y, font, col, align) {
  c.font = font; c.textAlign = align || 'left';
  c.fillStyle = 'rgba(0,0,0,.55)'; c.fillText(txt, x + 1, y + 1.5);
  c.fillStyle = col; c.fillText(txt, x, y);
  return c.measureText(txt).width;
}
function panel(c, x, y, w, h, o) {
  o = o || {};
  var r = o.r === undefined ? 12 : o.r;
  c.save();
  /* soft drop shadow */
  c.fillStyle = 'rgba(0,0,0,.28)'; rr(c, x + 1, y + 3, w, h, r); c.fill();
  var g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, o.top || 'rgba(30,33,48,.93)');
  g.addColorStop(1, o.bottom || 'rgba(11,12,19,.95)');
  c.fillStyle = g; rr(c, x, y, w, h, r); c.fill();
  /* glassy sheen on the upper half */
  c.save(); rr(c, x, y, w, h, r); c.clip();
  var sh = c.createLinearGradient(0, y, 0, y + h * 0.5);
  sh.addColorStop(0, 'rgba(255,255,255,.09)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = sh; c.fillRect(x, y, w, h * 0.5);
  if (o.accent) { c.fillStyle = o.accent; c.fillRect(x, y, 3, h); c.fillStyle = alpha(o.accent, 0.18); c.fillRect(x + 3, y, 6, h); }
  c.restore();
  c.strokeStyle = o.border || 'rgba(255,255,255,.14)'; c.lineWidth = 1.4; rr(c, x, y, w, h, r); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1;
  rr(c, x + 2, y + 2, w - 4, h - 4, Math.max(0, r - 2)); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x + r, y + 0.7, w - r * 2, 1);
  c.restore();
}
function statBar(c, x, y, w, h, v, col, label) {
  c.save();
  if (label) {
    c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '11px Segoe UI'; c.textAlign = 'left';
    c.fillText(label, x, y - 4);
  }
  c.fillStyle = 'rgba(0,0,0,.35)'; rr(c, x - 1, y - 1, w + 2, h + 2, h / 2 + 1); c.fill();
  c.fillStyle = 'rgba(255,255,255,.10)'; rr(c, x, y, w, h, h / 2); c.fill();
  var g = c.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, dark(col, 0.2)); g.addColorStop(1, light(col, 0.3));
  var vw = Math.max(h, w * clamp(v, 0, 1));
  c.fillStyle = g; rr(c, x, y, vw, h, h / 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,.25)';
  rr(c, x + 1.5, y + 1.5, vw - 3, h * 0.36, h * 0.18); c.fill();
  /* segment ticks */
  c.fillStyle = 'rgba(0,0,0,.25)';
  for (var i = 1; i < 10; i++) c.fillRect(x + w * i / 10, y + 1, 1, h - 2);
  c.restore();
}
/* analogue speedometer with ticks, coloured arc, needle and readout */
function speedo(c, x, y, R, frac, val, o) {
  o = o || {}; frac = clamp(frac, 0, 1);
  var a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, an = a0 + (a1 - a0) * frac;
  c.save();
  var bg = c.createRadialGradient(x, y - R * 0.3, R * 0.1, x, y, R * 1.25);
  bg.addColorStop(0, 'rgba(36,40,58,.92)'); bg.addColorStop(1, 'rgba(8,9,15,.94)');
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.arc(x + 1, y + 3, R + 9, 0, TAU); c.fill();
  c.fillStyle = bg; c.beginPath(); c.arc(x, y, R + 9, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 1.4; c.stroke();
  /* ticks */
  for (var i = 0; i <= 20; i++) {
    var ta = a0 + (a1 - a0) * i / 20, big = i % 5 === 0;
    c.strokeStyle = i / 20 <= frac ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.28)';
    c.lineWidth = big ? 2 : 1;
    c.beginPath(); c.moveTo(x + Math.cos(ta) * (R - (big ? 9 : 6)), y + Math.sin(ta) * (R - (big ? 9 : 6)));
    c.lineTo(x + Math.cos(ta) * (R - 2), y + Math.sin(ta) * (R - 2)); c.stroke();
  }
  c.lineCap = 'round';
  c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 7;
  c.beginPath(); c.arc(x, y, R + 4, a0, a1); c.stroke();
  var gg = c.createLinearGradient(x - R, 0, x + R, 0);
  var cs = o.cols || ['#4fd0e0', '#ffd75e', '#ff5a4a'];
  gg.addColorStop(0, cs[0]); gg.addColorStop(0.6, cs[1]); gg.addColorStop(1, cs[2]);
  c.strokeStyle = gg; c.lineWidth = 5;
  if (o.hot) { c.shadowColor = cs[1]; c.shadowBlur = 16; }
  if (frac > 0.002) { c.beginPath(); c.arc(x, y, R + 4, a0, an); c.stroke(); }
  c.shadowBlur = 0;
  /* needle */
  c.strokeStyle = o.needle || '#ff5a4a'; c.lineWidth = 2.4;
  c.beginPath(); c.moveTo(x - Math.cos(an) * 6, y - Math.sin(an) * 6); c.lineTo(x + Math.cos(an) * (R - 5), y + Math.sin(an) * (R - 5)); c.stroke();
  c.fillStyle = '#2a2e3e'; c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill();
  c.fillStyle = '#c9cdd8'; c.beginPath(); c.arc(x, y, 2.2, 0, TAU); c.fill();
  c.textAlign = 'center';
  c.fillStyle = '#fff'; c.font = 'bold ' + Math.round(R * 0.42) + 'px Segoe UI';
  c.fillText(val, x, y + R * 0.5);
  c.fillStyle = '#8d93a4'; c.font = Math.round(R * 0.2) + 'px Segoe UI'; c.fillText(o.unit || 'KM/H', x, y + R * 0.74);
  c.restore();
}
/* small vector icons for HUDs */
function icon(c, kind, x, y, s, col) {
  s = s || 1;
  c.save(); c.translate(x, y); c.scale(s, s);
  switch (kind) {
    case 'coin': {
      var g = c.createRadialGradient(-2, -2, 1, 0, 0, 8);
      g.addColorStop(0, '#fff2a8'); g.addColorStop(0.6, '#ffd23f'); g.addColorStop(1, '#c9901a');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill();
      c.strokeStyle = '#a8700f'; c.lineWidth = 1; c.stroke();
      c.fillStyle = '#c9901a'; rr(c, -1.2, -4, 2.4, 8, 1.2); c.fill();
      break;
    }
    case 'star':
      c.fillStyle = col || '#ffd23f'; star(c, 0, 0, 8, 3.6, 5); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(-2, -2.4, 1.6, 0, TAU); c.fill();
      break;
    case 'heart':
      c.fillStyle = col || '#ff5a7a';
      c.beginPath(); c.moveTo(0, 6); c.bezierCurveTo(-9, -1, -4, -9, 0, -3.5); c.bezierCurveTo(4, -9, 9, -1, 0, 6); c.fill();
      c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(-3, -3, 1.6, 1, -0.6, 0, TAU); c.fill();
      break;
    case 'flag':
      c.fillStyle = '#c9ccd8'; c.fillRect(-6, -8, 1.4, 16);
      for (var i = 0; i < 3; i++) for (var j = 0; j < 4; j++) { c.fillStyle = (i + j) & 1 ? '#20202c' : '#f4f4f8'; c.fillRect(-4.6 + j * 2.8, -8 + i * 2.8, 2.8, 2.8); }
      break;
    case 'clock':
      c.strokeStyle = col || '#ffd75e'; c.lineWidth = 1.8; c.beginPath(); c.arc(0, 0, 6.5, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -4); c.moveTo(0, 0); c.lineTo(3, 1.5); c.stroke();
      break;
    case 'trophy': {
      var tg = c.createLinearGradient(-6, 0, 6, 0); tg.addColorStop(0, '#c9901a'); tg.addColorStop(0.5, '#fff0a0'); tg.addColorStop(1, '#c9901a');
      c.fillStyle = tg; c.beginPath(); c.moveTo(-6, -7); c.lineTo(6, -7); c.quadraticCurveTo(6, 2, 0, 3); c.quadraticCurveTo(-6, 2, -6, -7); c.fill();
      c.strokeStyle = '#c9901a'; c.lineWidth = 1.4; c.beginPath(); c.arc(-6, -3.5, 2.6, Math.PI * 0.5, Math.PI * 1.5); c.stroke(); c.beginPath(); c.arc(6, -3.5, 2.6, -Math.PI * 0.5, Math.PI * 0.5); c.stroke();
      c.fillStyle = '#c9901a'; c.fillRect(-1, 3, 2, 3); c.fillRect(-4, 6, 8, 2);
      break;
    }
    case 'balloon':
      c.fillStyle = col || '#3ba7e8'; c.beginPath(); c.ellipse(0, -2, 6, 7.5, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(-2, -5, 1.6, 2.4, -0.4, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, 5.5); c.quadraticCurveTo(2, 8, 0, 10); c.stroke();
      break;
    case 'shield':
      c.fillStyle = col || '#4fd0e0'; c.beginPath(); c.moveTo(0, -7); c.lineTo(6, -4.5); c.quadraticCurveTo(6, 4, 0, 7.5); c.quadraticCurveTo(-6, 4, -6, -4.5); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(0, -5.5); c.lineTo(-4.5, -3.6); c.quadraticCurveTo(-4.4, 2.4, 0, 5.4); c.closePath(); c.fill();
      break;
  }
  c.restore();
}
/* big race position, e.g. "1st", with gold for first place */
function posBadge(c, x, y, pos, total, size) {
  size = size || 40;
  var suf = { 1: 'st', 2: 'nd', 3: 'rd' }[pos] || 'th';
  var cols = pos === 1 ? ['#fff3b0', '#ffd23f', '#c98a1a'] : pos === 2 ? ['#ffffff', '#cfd6e6', '#8a93a8'] : pos === 3 ? ['#ffd9b0', '#e09a5a', '#94542a'] : ['#ffffff', '#c9d2e6', '#6d7488'];
  c.save();
  c.font = 'italic 900 ' + size + 'px Segoe UI'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  var g = c.createLinearGradient(0, y - size, 0, y);
  g.addColorStop(0, cols[0]); g.addColorStop(0.55, cols[1]); g.addColorStop(1, cols[2]);
  c.lineJoin = 'round'; c.lineWidth = size * 0.16; c.strokeStyle = 'rgba(10,10,18,.85)';
  c.strokeText(pos, x, y); c.fillStyle = g; c.fillText(pos, x, y);
  var w = c.measureText(String(pos)).width;
  c.font = 'italic 800 ' + Math.round(size * 0.45) + 'px Segoe UI';
  c.lineWidth = size * 0.1; c.strokeText(suf, x + w + 1, y - size * 0.42); c.fillText(suf, x + w + 1, y - size * 0.42);
  if (total) { c.font = 'bold ' + Math.round(size * 0.3) + 'px Segoe UI'; c.fillStyle = 'rgba(220,226,240,.7)'; c.fillText('/' + total, x + w + 2, y); }
  c.restore();
}
/* F1-style start lights: lit = 0..3 red lamps, go = all green */
function startLights(c, x, y, lit, go, s) {
  s = s || 1;
  c.save(); c.translate(x, y); c.scale(s, s);
  panel(c, -78, -24, 156, 48, { r: 12 });
  for (var i = 0; i < 3; i++) {
    var lx = -44 + i * 44;
    c.fillStyle = '#0b0c12'; c.beginPath(); c.arc(lx, 0, 15, 0, TAU); c.fill();
    var on = go || i < lit, col = go ? '#4dff88' : '#ff3b30';
    if (on) {
      glow(c, lx, 0, 30, col, 0.9);
      var g = c.createRadialGradient(lx - 4, -4, 1, lx, 0, 13);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, dark(col, 0.45));
      c.fillStyle = g;
    } else c.fillStyle = '#2a1416';
    c.beginPath(); c.arc(lx, 0, 12, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.ellipse(lx - 3, -5, 4, 2.4, -0.4, 0, TAU); c.fill();
  }
  c.restore();
}

/* finish banner: springs in, checkered trim, gold title, and fireworks +
   confetti for a good result. Stateless for callers: call it every frame. */
var _ban = { title: null, t0: 0, last: 0, fx: null, fw: 0 };
function banner(c, w, h, title, sub, o) {
  o = o || {};
  var tn = now();
  if (!_ban.fx) _ban.fx = new Particles(700);
  if (_ban.title !== title || tn - _ban.last > 400) {
    _ban.title = title; _ban.t0 = tn; _ban.fx.clear(); _ban.fw = 0.3;
  }
  var dt = Math.min(0.05, Math.max(0, (tn - _ban.last) / 1000)); _ban.last = tn;
  var age = (tn - _ban.t0) / 1000;
  var good = o.good !== undefined ? o.good : !/WIPEOUT|GAME OVER|LOSE|TIME UP|RUN OVER|OVER\b/i.test(title);
  var fx = _ban.fx;
  if (good) {
    if (age < 2.6) for (var i = 0; i < 4; i++) fx.emit({
      x: Math.random() * w, y: -10, vx: (Math.random() - 0.5) * 80, vy: 60 + Math.random() * 120,
      life: 3.2, r: 2.4 + Math.random() * 2.4, col: ['#ffd23f', '#ff5a7a', '#4fd0e0', '#7dff9a', '#c98aff', '#ffffff'][(Math.random() * 6) | 0],
      shape: 'confetti', drag: 0.6, grav: 60, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 14 });
    _ban.fw -= dt;
    if (_ban.fw <= 0 && age < 9) {
      _ban.fw = 0.55 + Math.random() * 0.4;
      var fx0 = w * (0.15 + Math.random() * 0.7), fy0 = h * (0.12 + Math.random() * 0.3);
      var fc = ['#ffd23f', '#ff5a7a', '#4fd0e0', '#7dff9a', '#c98aff'][(Math.random() * 5) | 0];
      fx.emit({ x: fx0, y: fy0, life: 0.3, r: 30, r2: 6, col: fc, shape: 'glow', add: true, drag: 0 });
      fx.burst(fx0, fy0, 34, { spd: 190, life: 1.1, r: 2, col: [fc, '#ffffff'], pick: true, shape: 'line', drag: 1.4, grav: 90, add: true });
    }
  } else if (age < 0.05) {
    fx.burst(w / 2, h / 2, 26, { spd: 260, life: 0.9, r: 3, col: '#8a93a8', shape: 'square', drag: 1.6, grav: 300 });
  }
  fx.update(dt);
  var k = clamp(age / 0.5, 0, 1);
  c.save();
  c.fillStyle = 'rgba(4,5,10,' + (0.42 * Math.min(1, age * 3)) + ')'; c.fillRect(0, 0, w, h);
  fx.draw(c);
  var e = 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);   // ease-out-back
  var bw = Math.min(500, w - 24), bh = 112, bx = w / 2 - bw / 2, by = h / 2 - bh / 2;
  c.translate(w / 2, h / 2); c.scale(e, e); c.translate(-w / 2, -h / 2);
  c.globalAlpha = clamp(k * 2, 0, 1);
  if (good) glow(c, w / 2, h / 2, bw * 0.6, '#ffb84a', 0.18 + 0.06 * Math.sin(age * 4));
  panel(c, bx, by, bw, bh, { r: 18, border: good ? 'rgba(255,214,90,.65)' : 'rgba(255,110,100,.5)', top: 'rgba(34,36,54,.96)' });
  /* checkered trim top and bottom */
  c.save(); rr(c, bx, by, bw, bh, 18); c.clip();
  var cell = 7;
  for (var cx = 0; cx < bw; cx += cell) for (var r = 0; r < 2; r++) {
    c.fillStyle = ((cx / cell + r) & 1) ? 'rgba(244,244,248,.85)' : 'rgba(20,20,30,.85)';
    c.fillRect(bx + cx, by + r * cell, cell, cell);
    c.fillRect(bx + cx, by + bh - (r + 1) * cell, cell, cell);
  }
  gloss(c, bx, by, bw, bh, tn, 0.12);
  c.restore();
  if (good && bw > 300) { icon(c, 'trophy', bx + 40, h / 2 + 2, 2.2); icon(c, 'flag', bx + bw - 40, h / 2, 2.2); }
  var tg = c.createLinearGradient(0, h / 2 - 34, 0, h / 2);
  tg.addColorStop(0, good ? '#fff6c8' : '#ffd0c8'); tg.addColorStop(0.5, good ? '#ffd23f' : '#ff7a6a'); tg.addColorStop(1, good ? '#e08a1a' : '#c83a3a');
  var fs = Math.min(32, Math.floor((bw - (bw > 300 ? 130 : 30)) / Math.max(6, String(title).length) * 1.75));
  c.font = 'italic 900 ' + fs + 'px Segoe UI'; c.textAlign = 'center';
  c.lineJoin = 'round'; c.lineWidth = 6; c.strokeStyle = 'rgba(10,10,18,.85)';
  c.shadowColor = good ? 'rgba(255,200,80,.8)' : 'rgba(255,90,80,.6)'; c.shadowBlur = 20;
  var ty = h / 2 + (sub ? -4 : 11);
  c.strokeText(title, w / 2, ty); c.shadowBlur = 0;
  c.fillStyle = tg; c.fillText(title, w / 2, ty);
  if (sub) { c.font = '15px Segoe UI'; c.fillStyle = '#cfd4e2'; c.fillText(sub, w / 2, h / 2 + 28); }
  c.restore();
}

root.GFX = {
  TAU: TAU, clamp: clamp, rr: rr, light: light, dark: dark, alpha: alpha, hash: hash, now: now,
  bolt: bolt, grille: grille, panelLine: panelLine, star: star,
  cached: cached, blit: blit, glow: glow, glowSprite: glowSprite,
  Particles: Particles, FX: FX,
  kartTop: kartTop, kartRear: kartRear, kartSide: kartSide, wheelTop: wheelTop, flameTop: flameTop,
  skyGrad: skyGrad, sun: sun, lensFlare: lensFlare, cloudBand: cloudBand, hills: hills, mountains: mountains,
  treeline: treeline, birds: birds,
  tree: tree, pine: pine, palm: palm, bush: bush, rock: rock, flowers: flowers, cone: cone, sign: sign,
  treeTop: treeTop, bushTop: bushTop,
  flag: flag, lamp: lamp, grandstand: grandstand,
  fence: fence, tyreWall: tyreWall, crowdRow: crowdRow,
  checkerStrip: checkerStrip, cloudShadow: cloudShadow,
  paintGrass: paintGrass, trackDetail: trackDetail, offsetLoop: offsetLoop, strokeLoop: strokeLoop, groundAO: groundAO,
  bloom: bloom, grain: grain, vignette: vignette, scanlines: scanlines,
  speedLines: speedLines, flash: flash,
  lightShafts: lightShafts, motes: motes, weather: weather, gloss: gloss, ripple: ripple,
  trackKeys: trackKeys,
  glowText: glowText, hudText: hudText, panel: panel, statBar: statBar, speedo: speedo, icon: icon,
  posBadge: posBadge, startLights: startLights, banner: banner
};
})(typeof window !== 'undefined' ? window : globalThis);

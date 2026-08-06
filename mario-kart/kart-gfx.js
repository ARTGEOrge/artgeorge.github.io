/* kart-gfx.js — shared graphics kit for the kart game set.
   High-detail vector sprites (cached to offscreen bitmaps), particles,
   scenery props, lighting and post-processing.
   Loaded by every game in this folder; keep the folder together. */
(function (root) {
'use strict';
var TAU = Math.PI * 2;
var HAS_DOM = typeof document !== 'undefined';

/* NaN-safe: a stray NaN reaching ctx.rotate/globalAlpha silently kills a whole frame */
function clamp(v, a, b) { return (v !== v) ? a : v < a ? a : v > b ? b : v; }
function hex2rgb(h) {
  h = String(h).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbs(r, g, b) { return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')'; }
function light(h, a) { var c = hex2rgb(h); return rgbs(c[0] + (255 - c[0]) * a, c[1] + (255 - c[1]) * a, c[2] + (255 - c[2]) * a); }
function dark(h, a) { var c = hex2rgb(h); return rgbs(c[0] * (1 - a), c[1] * (1 - a), c[2] * (1 - a)); }
function alpha(h, a) { var c = hex2rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

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

/* ---------------------------------------------------- particles */
function Particles(max) { this.max = max || 600; this.a = []; }
Particles.prototype.emit = function (o) {
  if (this.a.length >= this.max) this.a.shift();
  this.a.push({
    x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0,
    life: o.life || 0.6, t: o.life || 0.6,
    r: o.r || 3, r2: o.r2 === undefined ? 0 : o.r2,
    col: o.col || '#fff', grav: o.grav || 0,
    drag: o.drag === undefined ? 1.6 : o.drag,
    shape: o.shape || 'circle', rot: o.rot || 0, vr: o.vr || 0,
    a0: o.a0 === undefined ? 1 : o.a0
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
      r2: o.r2, col: o.col, grav: o.grav, drag: o.drag, shape: o.shape,
      rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 12, a0: o.a0
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
  for (var i = 0; i < this.a.length; i++) {
    var p = this.a[i], k = p.t / p.life, r = p.r2 + (p.r - p.r2) * k;
    if (r <= 0.2) continue;
    c.globalAlpha = clamp(k * p.a0, 0, 1);
    c.fillStyle = p.col;
    if (p.shape === 'spark') {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      c.fillRect(-r * 2.2, -r * 0.32, r * 4.4, r * 0.64);
      c.restore();
    } else if (p.shape === 'square') {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      c.fillRect(-r, -r, r * 2, r * 2); c.restore();
    } else if (p.shape === 'smoke') {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      c.beginPath();
      c.arc(-r * 0.4, 0, r * 0.75, 0, TAU);
      c.arc(r * 0.45, -r * 0.15, r * 0.62, 0, TAU);
      c.arc(0, r * 0.4, r * 0.55, 0, TAU);
      c.fill(); c.restore();
    } else {
      c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
    }
  }
  c.globalAlpha = 1;
};
Particles.prototype.clear = function () { this.a.length = 0; };

/* ---------------------------------------------------- kart art (logical coords) */
function wheelTopArt(g, x, y, rot, w, h) {
  g.save(); g.translate(x, y); g.rotate(rot || 0);
  g.fillStyle = 'rgba(0,0,0,.32)';
  rr(g, -w / 2, -h / 2 + 1.4, w, h, 2.6); g.fill();
  var t = g.createLinearGradient(0, -h / 2, 0, h / 2);
  t.addColorStop(0, '#22222b'); t.addColorStop(0.45, '#101017'); t.addColorStop(1, '#05050a');
  g.fillStyle = t; rr(g, -w / 2, -h / 2, w, h, 2.6); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 0.55;      // tread
  for (var i = 1; i < 6; i++) {
    var xx = -w / 2 + w * i / 6;
    g.beginPath(); g.moveTo(xx, -h / 2 + 0.7); g.lineTo(xx, h / 2 - 0.7); g.stroke();
  }
  g.fillStyle = '#3d3d4a'; rr(g, -w / 2 + 1.5, -h / 2 + 1.4, w - 3, h - 2.8, 2); g.fill();  // rim
  g.fillStyle = '#63636f'; rr(g, -w / 2 + 2.6, -h / 2 + 2.1, w - 5.2, h - 4.2, 1.6); g.fill();
  g.fillStyle = 'rgba(255,255,255,.30)'; rr(g, -w / 2 + 2.2, -h / 2 + 1.6, w - 4.4, 1.2, 0.6); g.fill();
  g.fillStyle = '#9aa0ae'; g.beginPath(); g.arc(0, 0, 1.1, 0, TAU); g.fill();
  g.restore();
}
/* legacy name kept for games that call it directly */
function wheelTop(c, x, y, rot, w, h) { wheelTopArt(c, x, y, rot, w, h); }

function kartTopArt(g, col, acc, steer) {
  var body = function () {
    g.beginPath();
    g.moveTo(-19, -11.5); g.lineTo(4, -12.5);
    g.quadraticCurveTo(17, -9.5, 21, 0);
    g.quadraticCurveTo(17, 9.5, 4, 12.5);
    g.lineTo(-19, 11.5);
    g.quadraticCurveTo(-22, 0, -19, -11.5);
    g.closePath();
  };
  /* rear wing */
  g.fillStyle = dark(col, 0.58); rr(g, -25, -13.5, 4.6, 27, 1.8); g.fill();
  g.fillStyle = dark(col, 0.42); rr(g, -25, -13.5, 4.6, 3, 1.2); g.fill();
  g.fillStyle = dark(col, 0.7); rr(g, -23.5, -14.6, 2.4, 3.2, 1); g.fill();
  rr(g, -23.5, 11.4, 2.4, 3.2, 1); g.fill();
  /* suspension arms */
  g.strokeStyle = '#20202a'; g.lineWidth = 2.2; g.lineCap = 'round';
  [[-12, -9, -12, -14], [-12, 9, -12, 14], [11, -9, 11, -14], [11, 9, 11, 14]].forEach(function (a) {
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[2], a[3]); g.stroke();
  });
  /* wheels */
  wheelTopArt(g, -12, -15, 0, 11.5, 7.2);
  wheelTopArt(g, -12, 15, 0, 11.5, 7.2);
  wheelTopArt(g, 11, -15, steer, 10.4, 6.6);
  wheelTopArt(g, 11, 15, steer, 10.4, 6.6);
  /* contact shading under the floor */
  g.fillStyle = 'rgba(0,0,0,.30)';
  rr(g, -20, -13.5, 43, 27, 9); g.fill();
  /* chassis */
  var grd = g.createLinearGradient(0, -13, 0, 13);
  grd.addColorStop(0, light(col, 0.55));
  grd.addColorStop(0.28, light(col, 0.22));
  grd.addColorStop(0.58, col);
  grd.addColorStop(1, dark(col, 0.42));
  g.fillStyle = grd; body(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.1; body(); g.stroke();
  /* side pods with intakes */
  g.fillStyle = dark(col, 0.3);
  rr(g, -16, -12.6, 19, 4.2, 1.8); g.fill();
  rr(g, -16, 8.4, 19, 4.2, 1.8); g.fill();
  grille(g, -13, -12, 9, 3.2, 4);
  grille(g, -13, 8.8, 9, 3.2, 4);
  /* engine cover behind the driver */
  g.fillStyle = dark(col, 0.2);
  rr(g, -18, -7, 9, 14, 3); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.6;
  for (var i = 0; i < 4; i++) {
    g.beginPath(); g.moveTo(-17, -5.5 + i * 3.6); g.lineTo(-10, -5.5 + i * 3.6); g.stroke();
  }
  /* exhaust tips */
  g.fillStyle = '#5a5a66';
  rr(g, -21.5, -4.6, 3.4, 3.2, 1.4); g.fill();
  rr(g, -21.5, 1.4, 3.4, 3.2, 1.4); g.fill();
  g.fillStyle = '#17171e';
  rr(g, -21, -4.1, 2, 2.2, 1); g.fill();
  rr(g, -21, 1.9, 2, 2.2, 1); g.fill();
  /* gloss highlight + panel lines */
  g.fillStyle = 'rgba(255,255,255,.26)';
  rr(g, -11, -8.6, 23, 3.6, 1.8); g.fill();
  g.fillStyle = 'rgba(255,255,255,.10)';
  rr(g, -11, 5.4, 23, 2.4, 1.2); g.fill();
  panelLine(g, -8, -12, -8, 12);
  panelLine(g, 6, -11.5, 6, 11.5);
  /* nose splitter + number roundel */
  g.fillStyle = dark(col, 0.55);
  g.beginPath(); g.moveTo(16, -8.5); g.quadraticCurveTo(23, -4, 23, 0);
  g.quadraticCurveTo(23, 4, 16, 8.5); g.lineTo(16, -8.5); g.closePath(); g.fill();
  g.fillStyle = '#f2f2f6'; g.beginPath(); g.arc(11.5, 0, 3.6, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 0.7; g.stroke();
  /* cockpit well with ambient occlusion */
  g.fillStyle = 'rgba(0,0,0,.45)';
  g.beginPath(); g.ellipse(-1.5, 0, 10.4, 9.1, 0, 0, TAU); g.fill();
  g.fillStyle = '#15151d';
  g.beginPath(); g.ellipse(-1.5, 0, 9.2, 8, 0, 0, TAU); g.fill();
  /* driver: shoulders, arms, wheel, helmet */
  g.fillStyle = dark(acc, 0.35);
  rr(g, -7.5, -6.2, 8, 12.4, 3.4); g.fill();
  g.strokeStyle = '#e6c9a4'; g.lineWidth = 2.1; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-3, -4.4); g.lineTo(3.4, -3); g.stroke();
  g.beginPath(); g.moveTo(-3, 4.4); g.lineTo(3.4, 3); g.stroke();
  g.strokeStyle = '#20202a'; g.lineWidth = 1.5;
  g.beginPath(); g.ellipse(4.2, 0, 2.1, 3.6, 0, 0, TAU); g.stroke();
  var hg = g.createRadialGradient(-3.6, -2.2, 0.6, -1.5, 0, 6);
  hg.addColorStop(0, light(acc, 0.55)); hg.addColorStop(0.75, acc); hg.addColorStop(1, dark(acc, 0.3));
  g.fillStyle = hg; g.beginPath(); g.arc(-1.5, 0, 5.6, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.7; g.stroke();
  g.fillStyle = dark(col, 0.1);
  g.beginPath(); g.arc(-1.5, 0, 5.6, -0.55, 0.55); g.fill();
  g.fillStyle = 'rgba(24,28,40,.9)';
  g.beginPath(); g.ellipse(2.1, 0, 2.2, 3.5, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(190,225,255,.5)';
  g.beginPath(); g.ellipse(2.4, -1.3, 1, 1.5, 0, 0, TAU); g.fill();
  /* mirrors + headlights + bolts */
  g.fillStyle = dark(col, 0.5);
  rr(g, 6, -10.4, 3.4, 2.2, 1); g.fill();
  rr(g, 6, 8.2, 3.4, 2.2, 1); g.fill();
  g.fillStyle = 'rgba(255,250,215,.95)';
  g.beginPath(); g.ellipse(18, -5, 2.5, 2, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(18, 5, 2.5, 2, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.6;
  g.beginPath(); g.ellipse(18, -5, 2.5, 2, 0, 0, TAU); g.stroke();
  g.beginPath(); g.ellipse(18, 5, 2.5, 2, 0, 0, TAU); g.stroke();
  bolt(g, -17.5, -10.5, 0.85); bolt(g, -17.5, 10.5, 0.85);
  bolt(g, 13.5, -9.5, 0.85); bolt(g, 13.5, 9.5, 0.85);
}

function kartTop(c, o) {
  var col = o.col || '#e0392b', acc = o.acc || '#f4f4f8', s = o.s || 1;
  var st = o.steer ? clamp(Math.round(o.steer * 2), -1, 1) : 0;
  var e = cached('t|' + col + '|' + acc + '|' + st, 60, 44, 3,
    function (g) { kartTopArt(g, col, acc, st * 0.42); });
  if (o.shadow !== false) {
    c.save(); c.translate(o.x + 3 * s, o.y + 5 * s); c.rotate(o.a || 0);
    c.fillStyle = 'rgba(0,0,0,.30)';
    c.beginPath(); c.ellipse(0, 0, 21 * s, 13 * s, 0, 0, TAU); c.fill();
    c.restore();
  }
  if (o.boost > 0) {
    c.save(); c.translate(o.x, o.y); c.rotate(o.a || 0); c.scale(s, s);
    for (var i = 0; i < 2; i++) {
      var yy = i ? 3 : -3;
      var L = 13 + o.boost * 17 + Math.random() * 9;
      var gr = c.createLinearGradient(-20, 0, -20 - L, 0);
      gr.addColorStop(0, 'rgba(255,250,220,.95)');
      gr.addColorStop(0.35, 'rgba(255,160,50,.75)');
      gr.addColorStop(1, 'rgba(255,60,20,0)');
      c.fillStyle = gr;
      c.beginPath(); c.moveTo(-20, yy - 2.6); c.lineTo(-20, yy + 2.6);
      c.lineTo(-20 - L, yy); c.closePath(); c.fill();
    }
    c.restore();
  }
  if (e) blit(c, e, o.x, o.y, o.a || 0, s);
  else { c.save(); c.translate(o.x, o.y); c.rotate(o.a || 0); c.scale(s, s); kartTopArt(c, col, acc, st * 0.42); c.restore(); }
}

function kartRearArt(g, col, acc) {
  /* tyres */
  [-1, 1].forEach(function (sd) {
    g.save(); g.translate(sd * 40, 8);
    g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, -12, -12, 24, 34, 6); g.fill();
    var t = g.createLinearGradient(-12, 0, 12, 0);
    t.addColorStop(0, '#05050a'); t.addColorStop(0.45, '#1c1c25'); t.addColorStop(1, '#0a0a11');
    g.fillStyle = t; rr(g, -12, -14, 24, 32, 6); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 1;
    for (var i = 1; i < 5; i++) {
      g.beginPath(); g.moveTo(-11, -14 + i * 6.4); g.lineTo(11, -14 + i * 6.4); g.stroke();
    }
    g.fillStyle = '#33333f'; rr(g, -8.5, -9, 17, 22, 5); g.fill();
    g.fillStyle = '#5d5d6b'; rr(g, -6.5, -7, 13, 18, 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,.18)'; rr(g, -8.5, -9, 17, 5, 2.5); g.fill();
    g.fillStyle = '#9aa0ae'; g.beginPath(); g.arc(0, 2, 2.2, 0, TAU); g.fill();
    g.restore();
  });
  /* diffuser */
  g.fillStyle = '#15151d';
  g.beginPath(); g.moveTo(-32, 20); g.lineTo(32, 20); g.lineTo(28, 27); g.lineTo(-28, 27); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1.2;
  for (var i = -2; i <= 2; i++) {
    g.beginPath(); g.moveTo(i * 11, 20); g.lineTo(i * 10, 27); g.stroke();
  }
  /* body */
  var gg = g.createLinearGradient(0, -28, 0, 24);
  gg.addColorStop(0, light(col, 0.5));
  gg.addColorStop(0.3, light(col, 0.16));
  gg.addColorStop(0.62, col);
  gg.addColorStop(1, dark(col, 0.48));
  g.fillStyle = gg;
  g.beginPath();
  g.moveTo(-34, 20); g.lineTo(-30, -10);
  g.quadraticCurveTo(0, -21, 30, -10);
  g.lineTo(34, 20); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.5; g.stroke();
  panelLine(g, -20, -14, -22, 19, 0.3);
  panelLine(g, 20, -14, 22, 19, 0.3);
  g.fillStyle = 'rgba(255,255,255,.16)';
  rr(g, -22, -8, 44, 5, 2.5); g.fill();
  /* engine grille + exhausts */
  grille(g, -13, 0, 26, 11, 5);
  g.fillStyle = '#5d5d6b';
  g.beginPath(); g.arc(-15, 15, 4.6, 0, TAU); g.fill();
  g.beginPath(); g.arc(15, 15, 4.6, 0, TAU); g.fill();
  g.fillStyle = '#0d0d14';
  g.beginPath(); g.arc(-15, 15, 3, 0, TAU); g.fill();
  g.beginPath(); g.arc(15, 15, 3, 0, TAU); g.fill();
  /* brake light bar */
  var bl = g.createLinearGradient(-26, 0, 26, 0);
  bl.addColorStop(0, 'rgba(255,60,50,.5)'); bl.addColorStop(0.5, 'rgba(255,90,80,.95)');
  bl.addColorStop(1, 'rgba(255,60,50,.5)');
  g.fillStyle = bl; rr(g, -26, -4, 52, 4, 2); g.fill();
  /* rear wing with endplates and struts */
  g.fillStyle = dark(col, 0.62); rr(g, -22, -20, 5, 12, 2); g.fill();
  rr(g, 17, -20, 5, 12, 2); g.fill();
  var wg = g.createLinearGradient(0, -30, 0, -22);
  wg.addColorStop(0, light(col, 0.3)); wg.addColorStop(1, dark(col, 0.35));
  g.fillStyle = wg; rr(g, -32, -30, 64, 8, 3); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.42)'; g.lineWidth = 1; rr(g, -32, -30, 64, 8, 3); g.stroke();
  g.fillStyle = dark(col, 0.5); rr(g, -34, -32, 5, 12, 2); g.fill();
  rr(g, 29, -32, 5, 12, 2); g.fill();
  /* roll hoop + driver */
  g.fillStyle = '#2a2a36';
  g.beginPath(); g.arc(0, -18, 15, Math.PI, TAU); g.fill();
  g.fillStyle = '#20202a'; rr(g, -15, -15, 30, 17, 6); g.fill();
  g.fillStyle = dark(acc, 0.4); rr(g, -13, -13, 26, 12, 5); g.fill();
  var hg = g.createRadialGradient(-5, -27, 1, 0, -21, 15);
  hg.addColorStop(0, light(acc, 0.6)); hg.addColorStop(0.7, acc); hg.addColorStop(1, dark(acc, 0.35));
  g.fillStyle = hg; g.beginPath(); g.arc(0, -21, 13, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke();
  g.fillStyle = dark(col, 0.1);
  g.beginPath(); g.arc(0, -21, 13, Math.PI * 1.12, Math.PI * 1.88); g.fill();
  g.fillStyle = 'rgba(255,255,255,.3)';
  g.beginPath(); g.ellipse(-5, -26, 4, 3, -0.5, 0, TAU); g.fill();
  bolt(g, -28, 16, 1.1); bolt(g, 28, 16, 1.1);
}

function kartRear(c, o) {
  var col = o.col || '#d8342a', acc = o.acc || '#f4f4f8', s = o.s || 1;
  var e = cached('r|' + col + '|' + acc, 96, 76, 2.6, function (g) { kartRearArt(g, col, acc); });
  c.save(); c.translate(o.x, o.y); c.scale(s, s); c.rotate((o.lean || 0) * 0.06);
  c.fillStyle = 'rgba(0,0,0,.34)';
  c.beginPath(); c.ellipse(0, 30, 52, 12, 0, 0, TAU); c.fill();
  if (o.boost > 0) {
    for (var i = -1; i <= 1; i += 2) {
      var g0 = c.createRadialGradient(i * 15, 17, 1, i * 15, 17, 20 + o.boost * 16);
      g0.addColorStop(0, 'rgba(255,252,225,.95)');
      g0.addColorStop(0.35, 'rgba(255,165,55,.65)');
      g0.addColorStop(1, 'rgba(255,80,20,0)');
      c.fillStyle = g0;
      c.beginPath(); c.arc(i * 15, 17, 20 + o.boost * 16 + Math.random() * 6, 0, TAU); c.fill();
    }
  }
  if (e) c.drawImage(e.cv, -e.w / 2, -e.h / 2 - 6, e.w, e.h);
  else kartRearArt(c, col, acc);
  c.restore();
}

function kartSideArt(g, col, acc) {
  g.fillStyle = 'rgba(0,0,0,.22)';
  g.beginPath(); g.ellipse(0, 9, 28, 5, 0, 0, TAU); g.fill();
  /* chassis */
  var gg = g.createLinearGradient(0, -20, 0, 6);
  gg.addColorStop(0, light(col, 0.5));
  gg.addColorStop(0.32, light(col, 0.16));
  gg.addColorStop(0.62, col);
  gg.addColorStop(1, dark(col, 0.42));
  g.fillStyle = gg;
  g.beginPath();
  g.moveTo(-25, 3); g.lineTo(-23, -10);
  g.quadraticCurveTo(-7, -18, 8, -15);
  g.lineTo(22, -10); g.quadraticCurveTo(27, -6, 25, 3);
  g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.2; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.22)';
  g.beginPath(); g.moveTo(-20, -9); g.quadraticCurveTo(-6, -15.5, 7, -13); g.lineTo(7, -11);
  g.quadraticCurveTo(-6, -13.5, -20, -7); g.closePath(); g.fill();
  panelLine(g, -12, -13, -12, 3);
  panelLine(g, 6, -14, 6, 2);
  grille(g, -19, -6, 8, 7, 3);
  /* wing, exhaust, splitter */
  g.fillStyle = dark(col, 0.58); rr(g, -29, -15, 5, 13, 2); g.fill();
  rr(g, -31, -16.5, 9, 3.4, 1.5); g.fill();
  g.fillStyle = '#5a5a66'; rr(g, -28, -1, 7, 4, 2); g.fill();
  g.fillStyle = '#15151d'; rr(g, -27.5, -0.2, 3.4, 2.4, 1.2); g.fill();
  g.fillStyle = dark(col, 0.5);
  g.beginPath(); g.moveTo(22, -2); g.lineTo(29, 1); g.lineTo(29, 3); g.lineTo(22, 3); g.closePath(); g.fill();
  /* seat + driver */
  g.fillStyle = '#15151d'; rr(g, -12, -16, 16, 9, 3); g.fill();
  g.fillStyle = dark(acc, 0.4); rr(g, -9, -20, 11, 10, 4); g.fill();
  g.strokeStyle = '#e6c9a4'; g.lineWidth = 2.2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-2, -17); g.lineTo(7, -13); g.stroke();
  var hg = g.createRadialGradient(-5, -24, 0.6, -2, -20, 6.4);
  hg.addColorStop(0, light(acc, 0.6)); hg.addColorStop(0.75, acc); hg.addColorStop(1, dark(acc, 0.3));
  g.fillStyle = hg; g.beginPath(); g.arc(-2, -20, 6, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.8; g.stroke();
  g.fillStyle = 'rgba(24,28,40,.9)';
  g.beginPath(); g.ellipse(1.4, -19.5, 2, 3, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(190,225,255,.55)';
  g.beginPath(); g.ellipse(1.7, -20.8, 0.9, 1.2, 0, 0, TAU); g.fill();
  bolt(g, -19, 1, 0.9); bolt(g, 17, 1, 0.9);
}
function wheelSideArt(g, spin) {
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(0, 1.4, 10.5, 0, TAU); g.fill();
  var t = g.createRadialGradient(-3, -3, 1, 0, 0, 11);
  t.addColorStop(0, '#26262f'); t.addColorStop(1, '#08080e');
  g.fillStyle = t; g.beginPath(); g.arc(0, 0, 10.5, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 1;
  for (var i = 0; i < 12; i++) {
    var a = i / 12 * TAU;
    g.beginPath();
    g.moveTo(Math.cos(a) * 8.6, Math.sin(a) * 8.6);
    g.lineTo(Math.cos(a) * 10.4, Math.sin(a) * 10.4); g.stroke();
  }
  g.fillStyle = '#3a3a47'; g.beginPath(); g.arc(0, 0, 6.6, 0, TAU); g.fill();
  g.save(); g.rotate(spin);
  g.strokeStyle = '#6d6d7d'; g.lineWidth = 1.6;
  for (var k = 0; k < 5; k++) {
    var a2 = k / 5 * Math.PI;
    g.beginPath();
    g.moveTo(-Math.cos(a2) * 5.6, -Math.sin(a2) * 5.6);
    g.lineTo(Math.cos(a2) * 5.6, Math.sin(a2) * 5.6); g.stroke();
  }
  g.restore();
  g.fillStyle = '#9aa0ae'; g.beginPath(); g.arc(0, 0, 2, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(-0.7, -0.7, 0.9, 0, TAU); g.fill();
}
function kartSide(c, o) {
  var col = o.col || '#e0392b', acc = o.acc || '#f4f4f8', s = o.s || 1;
  var e = cached('s|' + col + '|' + acc, 70, 52, 3, function (g) { kartSideArt(g, col, acc); });
  c.save(); c.translate(o.x, o.y); c.rotate(o.a || 0); c.scale(s, s);
  if (e) c.drawImage(e.cv, -e.w / 2, -e.h / 2 + 4, e.w, e.h);
  else kartSideArt(c, col, acc);
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

/* ---------------------------------------------------- scenery */
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
  c.fillStyle = light(col, 0.55); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.strokeStyle = alpha(col, 0.35); c.lineWidth = 1.5;
  c.beginPath(); c.arc(x, y, r * 2.2, 0, TAU); c.stroke();
}
function cloudBand(c, w, baseY, off, scale, col) {
  c.fillStyle = col;
  for (var i = 0; i < 9; i++) {
    var x = ((i * 197 + off) % (w + 320)) - 160;
    var y = baseY + (i % 3) * 17 * scale;
    var r = (16 + (i % 4) * 7) * scale;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.arc(x + r * 0.85, y + r * 0.16, r * 0.78, 0, TAU);
    c.arc(x - r * 0.9, y + r * 0.2, r * 0.66, 0, TAU);
    c.arc(x + r * 0.1, y - r * 0.5, r * 0.7, 0, TAU);
    c.arc(x + r * 1.5, y + r * 0.3, r * 0.5, 0, TAU);
    c.fill();
  }
}
function hills(c, w, baseY, off, amp, freq, col, snow) {
  c.fillStyle = col; c.beginPath(); c.moveTo(0, baseY + 400);
  c.lineTo(0, baseY);
  var pts = [];
  for (var x = 0; x <= w; x += 6) {
    var u = x + off;
    var y = baseY - amp * Math.sin(u * freq) - amp * 0.55 * Math.sin(u * freq * 2.7 + 1.3);
    pts.push([x, y]); c.lineTo(x, y);
  }
  c.lineTo(w, baseY + 400); c.closePath(); c.fill();
  if (snow) {
    c.fillStyle = 'rgba(255,255,255,.5)';
    for (var i = 0; i < pts.length; i++) {
      if (pts[i][1] < baseY - amp * 0.85) c.fillRect(pts[i][0] - 3, pts[i][1], 7, 5);
    }
  }
  c.fillStyle = 'rgba(255,255,255,.07)';
  c.beginPath(); c.moveTo(0, baseY);
  for (var j = 0; j < pts.length; j++) c.lineTo(pts[j][0], pts[j][1]);
  c.lineTo(w, baseY); c.closePath(); c.fill();
}
function tree(c, x, y, s, col1, col2) {
  c.fillStyle = 'rgba(0,0,0,.24)';
  c.beginPath(); c.ellipse(x + 2 * s, y + 2.5 * s, 10 * s, 3.6 * s, 0, 0, TAU); c.fill();
  var tg = c.createLinearGradient(x - 2 * s, 0, x + 2 * s, 0);
  tg.addColorStop(0, '#4a331d'); tg.addColorStop(0.5, '#6a4a2a'); tg.addColorStop(1, '#3d2a18');
  c.fillStyle = tg;
  c.beginPath();
  c.moveTo(x - 2.4 * s, y); c.lineTo(x - 1.5 * s, y - 9 * s);
  c.lineTo(x + 1.5 * s, y - 9 * s); c.lineTo(x + 2.4 * s, y);
  c.closePath(); c.fill();
  var blobs = [[0, -14, 8.6], [-5.2, -11, 6.2], [5.2, -11.6, 6], [-2.4, -18.4, 6.2], [3.4, -17.4, 5.4]];
  c.fillStyle = col2 || '#2f6f34';
  blobs.forEach(function (b) {
    c.beginPath(); c.arc(x + b[0] * s, y + b[1] * s, b[2] * s, 0, TAU); c.fill();
  });
  c.fillStyle = col1 || '#4a9a4e';
  blobs.forEach(function (b) {
    c.beginPath(); c.arc(x + (b[0] - 1.1) * s, y + (b[1] - 1.4) * s, b[2] * 0.82 * s, 0, TAU); c.fill();
  });
  c.fillStyle = 'rgba(255,255,255,.20)';
  c.beginPath(); c.arc(x - 3.4 * s, y - 18 * s, 3.2 * s, 0, TAU); c.fill();
  c.beginPath(); c.arc(x - 6 * s, y - 13 * s, 2.1 * s, 0, TAU); c.fill();
}
function bush(c, x, y, s, col) {
  c.fillStyle = 'rgba(0,0,0,.2)';
  c.beginPath(); c.ellipse(x + 1.5 * s, y + 1.5 * s, 9 * s, 3 * s, 0, 0, TAU); c.fill();
  c.fillStyle = dark(col || '#3f8f43', 0.2);
  [[-5, 0, 5.4], [0, -2, 6.4], [5, 0, 5]].forEach(function (b) {
    c.beginPath(); c.arc(x + b[0] * s, y + b[1] * s, b[2] * s, 0, TAU); c.fill();
  });
  c.fillStyle = light(col || '#3f8f43', 0.2);
  [[-5.6, -1.4, 4], [-0.6, -3.6, 4.6]].forEach(function (b) {
    c.beginPath(); c.arc(x + b[0] * s, y + b[1] * s, b[2] * s, 0, TAU); c.fill();
  });
}
function rock(c, x, y, s) {
  c.fillStyle = 'rgba(0,0,0,.24)';
  c.beginPath(); c.ellipse(x + 1.5 * s, y + 2 * s, 11 * s, 4 * s, 0, 0, TAU); c.fill();
  c.fillStyle = '#6d7280';
  c.beginPath();
  c.moveTo(x - 10 * s, y + 1 * s); c.lineTo(x - 6 * s, y - 7 * s);
  c.lineTo(x + 2 * s, y - 9 * s); c.lineTo(x + 9 * s, y - 3 * s);
  c.lineTo(x + 8 * s, y + 2 * s); c.closePath(); c.fill();
  c.fillStyle = '#8f95a4';
  c.beginPath();
  c.moveTo(x - 6 * s, y - 7 * s); c.lineTo(x + 2 * s, y - 9 * s);
  c.lineTo(x + 1 * s, y - 3 * s); c.lineTo(x - 4 * s, y - 2 * s); c.closePath(); c.fill();
  c.fillStyle = '#565b68';
  c.beginPath();
  c.moveTo(x + 1 * s, y - 3 * s); c.lineTo(x + 9 * s, y - 3 * s);
  c.lineTo(x + 8 * s, y + 2 * s); c.lineTo(x + 1 * s, y + 1.5 * s); c.closePath(); c.fill();
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
    g.addColorStop(0, '#33333f'); g.addColorStop(1, '#0e0e15');
    c.fillStyle = g; c.beginPath(); c.arc(tx, y, 6.4 * s, 0, TAU); c.fill();
    c.fillStyle = i % 3 === 0 ? '#e04a3c' : '#f0f0f4';
    c.beginPath(); c.arc(tx, y, 3.4 * s, 0, TAU); c.fill();
    c.fillStyle = '#1a1a22';
    c.beginPath(); c.arc(tx, y, 2.1 * s, 0, TAU); c.fill();
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
    c.ellipse(x, y, 150 + (i % 3) * 60, 62 + (i % 2) * 26, 0.3, 0, TAU); c.fill();
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
  _blg.filter = 'contrast(2.7) brightness(0.72) saturate(1.35)';   // crude bright-pass
  _blg.drawImage(src, 0, 0, dw, dh);
  _blg.filter = 'none';
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = amt === undefined ? 0.34 : amt;
  c.filter = 'blur(' + (blurPx || 7) + 'px)';
  c.drawImage(_bl, 0, 0, w, h);
  c.filter = 'none';
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
function speedLines(c, w, h, amount) {
  if (amount <= 0) return;
  c.save(); c.lineCap = 'round';
  var n = 12 + (amount * 24) | 0;
  for (var i = 0; i < n; i++) {
    var a = (i / n) * TAU + (i % 3) * 0.4;
    var r0 = Math.min(w, h) * (0.34 + (i % 5) * 0.05);
    var r1 = r0 + 40 + amount * 130;
    var x0 = w / 2 + Math.cos(a) * r0, y0 = h / 2 + Math.sin(a) * r0;
    var x1 = w / 2 + Math.cos(a) * r1, y1 = h / 2 + Math.sin(a) * r1;
    var g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,' + (0.06 + amount * 0.26) + ')');
    c.strokeStyle = g; c.lineWidth = 1.4 + amount * 1.6;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  }
  c.restore();
}
function flash(c, w, h, col, a) { if (a <= 0) return; c.fillStyle = alpha(col, a); c.fillRect(0, 0, w, h); }

/* volumetric-ish sun shafts sweeping from a light source */
function lightShafts(c, w, h, sx, sy, amt, col) {
  if (amt <= 0) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  var n = 9;
  for (var i = 0; i < n; i++) {
    var a = (i / n) * TAU + (i % 2 ? 0.13 : -0.09);
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
/* drifting airborne dust / pollen */
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
/* animated specular sweep, for panels and previews */
function gloss(c, x, y, w, h, t, a) {
  var p = ((t * 0.00035) % 1.6) - 0.3;
  var gx = x + w * p;
  var g = c.createLinearGradient(gx - w * 0.22, y, gx + w * 0.22, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,' + (a === undefined ? 0.15 : a) + ')');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(x, y, w, h);
}
/* shimmering water band */
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

function glowText(c, txt, x, y, o) {
  o = o || {};
  c.save();
  c.font = o.font || 'bold 26px Segoe UI';
  c.textAlign = o.align || 'center';
  c.textBaseline = o.baseline || 'alphabetic';
  if (o.glow !== false) { c.shadowColor = o.glowCol || o.fill || '#ffd75e'; c.shadowBlur = o.blur || 18; }
  if (o.stroke) { c.lineWidth = o.strokeW || 4; c.strokeStyle = o.stroke; c.strokeText(txt, x, y); }
  c.fillStyle = o.fill || '#ffd75e';
  c.fillText(txt, x, y);
  c.restore();
}
function panel(c, x, y, w, h, o) {
  o = o || {};
  c.save();
  var g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, o.top || 'rgba(24,26,37,.93)');
  g.addColorStop(1, o.bottom || 'rgba(11,12,19,.95)');
  c.fillStyle = g; rr(c, x, y, w, h, o.r === undefined ? 12 : o.r); c.fill();
  c.strokeStyle = o.border || 'rgba(255,255,255,.13)'; c.lineWidth = 1.4; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1;
  rr(c, x + 2, y + 2, w - 4, h - 4, (o.r === undefined ? 12 : o.r) - 2); c.stroke();
  c.restore();
}
function statBar(c, x, y, w, h, v, col, label) {
  c.save();
  if (label) {
    c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '11px Segoe UI'; c.textAlign = 'left';
    c.fillText(label, x, y - 4);
  }
  c.fillStyle = 'rgba(255,255,255,.10)'; rr(c, x, y, w, h, h / 2); c.fill();
  var g = c.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, dark(col, 0.2)); g.addColorStop(1, light(col, 0.3));
  c.fillStyle = g; rr(c, x, y, Math.max(h, w * clamp(v, 0, 1)), h, h / 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,.22)';
  rr(c, x + 1.5, y + 1.5, Math.max(h, w * clamp(v, 0, 1)) - 3, h * 0.36, h * 0.18); c.fill();
  c.restore();
}
function banner(c, w, h, title, sub) {
  panel(c, w * 0.5 - 250, h / 2 - 52, 500, 104, { r: 16 });
  glowText(c, title, w / 2, h / 2 + (sub ? -6 : 10), { font: 'bold 30px Segoe UI', fill: '#ffd75e' });
  if (sub) glowText(c, sub, w / 2, h / 2 + 26, { font: '15px Segoe UI', fill: '#cfd4e2', glow: false });
}

root.GFX = {
  TAU: TAU, clamp: clamp, rr: rr, light: light, dark: dark, alpha: alpha,
  bolt: bolt, grille: grille, panelLine: panelLine,
  Particles: Particles,
  kartTop: kartTop, kartRear: kartRear, kartSide: kartSide, wheelTop: wheelTop,
  skyGrad: skyGrad, sun: sun, cloudBand: cloudBand, hills: hills,
  tree: tree, bush: bush, rock: rock, fence: fence, tyreWall: tyreWall, crowdRow: crowdRow,
  checkerStrip: checkerStrip, cloudShadow: cloudShadow,
  bloom: bloom, grain: grain, vignette: vignette, scanlines: scanlines,
  speedLines: speedLines, flash: flash,
  lightShafts: lightShafts, motes: motes, gloss: gloss, ripple: ripple,
  trackKeys: trackKeys,
  glowText: glowText, panel: panel, statBar: statBar, banner: banner
};
})(typeof window !== 'undefined' ? window : globalThis);

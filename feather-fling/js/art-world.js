/* Feather Fling — world art: sky, parallax scenery, ground, slingshot, blocks.
 *
 * Screen-space functions take (ctx, W, H, ...). World-space functions draw in
 * a local frame the renderer has already set up: origin at the object's
 * centre, y pointing DOWN, units in metres. */
(function () {
  'use strict';
  var ART = window.ART = window.ART || {};

  // Deterministic pseudo-random so scenery is identical every frame.
  function hash(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  ART.hash = hash;

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  ART.rr = rr;

  /* ---------------------------------------------------------------- themes */
  var THEMES = [
    { name: 'meadow',
      sky: ['#3fa9f5', '#8fd3ff', '#e6f8ff'], sun: '#fff6c9',
      far: '#8ec3e8', farCap: '#f4fbff', mid: '#5cc05a', midDark: '#3f9a45',
      near: '#46a83f', tree: '#2f8a3a', trunk: '#7a4a24',
      grass: '#6bd24a', grassDark: '#3f9a2f', dirt: '#b77a45', dirtDark: '#8a5530', cloud: '#ffffff' },
    { name: 'canyon',
      sky: ['#ff8a5c', '#ffc27a', '#ffe9b8'], sun: '#fff1b0',
      far: '#d98a6a', farCap: '#f5c49a', mid: '#e0a15a', midDark: '#b9743d',
      near: '#c98a3f', tree: '#6f9a3a', trunk: '#6a3d1f',
      grass: '#e6b35a', grassDark: '#b77f33', dirt: '#b3643a', dirtDark: '#83421f', cloud: '#fff3e0' },
    { name: 'peaks',
      sky: ['#5a7fe0', '#a8c6ff', '#eef4ff'], sun: '#ffffff',
      far: '#9fb4e6', farCap: '#ffffff', mid: '#dfe9f7', midDark: '#b6c8e6',
      near: '#c9d8ee', tree: '#2f6e5a', trunk: '#5a3a24',
      grass: '#f4f8ff', grassDark: '#c3d3ec', dirt: '#8a9ab8', dirtDark: '#66759a', cloud: '#ffffff' }
  ];
  ART.theme = function (i) { return THEMES[(i || 0) % THEMES.length]; };

  /* ------------------------------------------------------------------- sky */
  ART.drawSky = function (ctx, W, H, pal, groundY) {
    var g = ctx.createLinearGradient(0, 0, 0, Math.max(groundY, H * 0.5));
    g.addColorStop(0, pal.sky[0]);
    g.addColorStop(0.6, pal.sky[1]);
    g.addColorStop(1, pal.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    var sx = W * 0.78, sy = H * 0.18, sr = Math.min(W, H) * 0.07;
    var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3.2);
    sg.addColorStop(0, pal.sun);
    sg.addColorStop(0.3, 'rgba(255,255,230,0.55)');
    sg.addColorStop(1, 'rgba(255,255,230,0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(sx, sy, sr * 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.sun;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
  };

  function cloud(ctx, x, y, s, col) {
    ctx.fillStyle = col;
    var puffs = [[0, 0, 1], [0.9, -0.35, 0.8], [1.8, 0, 0.9], [0.9, 0.25, 0.9], [-0.8, 0.2, 0.65], [2.6, 0.25, 0.6]];
    ctx.beginPath();
    for (var i = 0; i < puffs.length; i++) {
      ctx.moveTo(x + puffs[i][0] * s + puffs[i][2] * s, y + puffs[i][1] * s);
      ctx.arc(x + puffs[i][0] * s, y + puffs[i][1] * s, puffs[i][2] * s, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = 'rgba(120,160,210,0.18)';
    ctx.beginPath();
    ctx.ellipse(x + s, y + s * 0.55, s * 2.2, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // One repeating silhouette layer. `f` is the parallax factor (0 = fixed, 1 = world).
  function ridge(ctx, W, baseY, camPx, f, period, amp, seed, fill) {
    var off = -((camPx * f) % period + period) % period;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, baseY + 400);
    for (var x = off - period; x <= W + period; x += period / 8) {
      var k = Math.floor((x - off) / (period / 8));
      var h = amp * (0.45 + 0.55 * hash(seed + ((k % 8) + 8) % 8));
      ctx.lineTo(x, baseY - h);
    }
    ctx.lineTo(W + period, baseY + 400);
    ctx.closePath();
    ctx.fill();
  }

  /* ------------------------------------------------------ parallax scenery */
  ART.drawParallax = function (ctx, W, H, pal, cam, groundY, t) {
    var camPx = cam.x * cam.zoom;
    var u = Math.max(0.6, Math.min(1.6, H / 720));

    // clouds drift slowly on their own
    for (var i = 0; i < 6; i++) {
      var span = W + 600;
      var cx = ((hash(i * 3.1) * span - camPx * 0.08 + t * (8 + i * 3)) % span + span) % span - 300;
      cloud(ctx, cx, H * (0.1 + hash(i * 7.7) * 0.28), (26 + hash(i) * 22) * u, pal.cloud);
    }

    // far mountains with snow caps
    var period = 900 * u, off = -((camPx * 0.15) % period + period) % period;
    for (var m = -1; m < Math.ceil(W / period) + 2; m++) {
      for (var p = 0; p < 3; p++) {
        var bx = off + m * period + p * period / 3 + hash(p) * 60;
        var ph = (170 + hash(p * 5 + 1) * 120) * u, pw = (230 + hash(p * 9) * 90) * u;
        var baseY = groundY - 40 * u;
        ctx.fillStyle = pal.far;
        ctx.beginPath();
        ctx.moveTo(bx - pw, baseY); ctx.lineTo(bx, baseY - ph); ctx.lineTo(bx + pw, baseY);
        ctx.fill();
        ctx.fillStyle = pal.farCap;
        ctx.beginPath();
        ctx.moveTo(bx, baseY - ph);
        ctx.lineTo(bx - pw * 0.22, baseY - ph * 0.78);
        ctx.lineTo(bx - pw * 0.08, baseY - ph * 0.82);
        ctx.lineTo(bx + pw * 0.05, baseY - ph * 0.74);
        ctx.lineTo(bx + pw * 0.22, baseY - ph * 0.79);
        ctx.closePath();
        ctx.fill();
      }
    }

    ridge(ctx, W, groundY - 18 * u, camPx, 0.35, 520 * u, 95 * u, 11, pal.midDark);
    ridge(ctx, W, groundY - 6 * u, camPx, 0.5, 430 * u, 70 * u, 23, pal.mid);

    // round cartoon trees on the near hills
    var tp = 150 * u, toff = -((camPx * 0.6) % tp + tp) % tp;
    for (var j = -1; j < W / tp + 2; j++) {
      var n = j + Math.floor(camPx * 0.6 / tp);
      if (hash(n * 1.37) < 0.35) continue;
      var tx = toff + j * tp + hash(n) * 60 * u, ts = (0.7 + hash(n * 2.3) * 0.6) * u;
      var ty = groundY - 4 * u;
      ctx.fillStyle = pal.trunk;
      ctx.fillRect(tx - 5 * ts, ty - 46 * ts, 10 * ts, 46 * ts);
      ctx.fillStyle = pal.tree;
      ctx.beginPath();
      ctx.arc(tx, ty - 62 * ts, 30 * ts, 0, Math.PI * 2);
      ctx.arc(tx - 22 * ts, ty - 46 * ts, 20 * ts, 0, Math.PI * 2);
      ctx.arc(tx + 22 * ts, ty - 46 * ts, 20 * ts, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.arc(tx - 9 * ts, ty - 72 * ts, 11 * ts, 0, Math.PI * 2); ctx.fill();
    }
    ridge(ctx, W, groundY + 2 * u, camPx, 0.75, 360 * u, 30 * u, 41, pal.near);
  };

  /* ---------------------------------------------------------------- ground */
  // World space with y DOWN: the surface is at y = 0 and the soil fills below.
  ART.drawGround = function (ctx, pal, x0, x1) {
    var depth = 30;
    var dg = ctx.createLinearGradient(0, 0, 0, 6);
    dg.addColorStop(0, pal.dirt);
    dg.addColorStop(1, pal.dirtDark);
    ctx.fillStyle = dg;
    ctx.fillRect(x0, 0, x1 - x0, depth);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (var s = Math.floor(x0); s < x1; s += 1) {
      if (hash(s * 3.3) < 0.5) continue;
      ctx.beginPath();
      ctx.ellipse(s + hash(s) , 1.2 + hash(s * 1.7) * 2.5, 0.18 + hash(s * 2) * 0.2, 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = pal.grassDark;
    ctx.fillRect(x0, 0, x1 - x0, 0.42);
    ctx.fillStyle = pal.grass;
    ctx.beginPath();
    ctx.moveTo(x0, 0.3);
    for (var x = Math.floor(x0); x <= x1; x += 0.5) {
      ctx.lineTo(x + 0.25, -0.12 - hash(x * 4.1) * 0.12);
      ctx.lineTo(x + 0.5, 0.05);
    }
    ctx.lineTo(x1, 0.3);
    ctx.closePath();
    ctx.fill();
  };

  /* -------------------------------------------------------------- slingshot */
  // Local frame: origin at the base of the post on the ground, y down.
  ART.SLING = { forkY: -3.1, left: -0.42, right: 0.42 };

  function woodStroke(ctx, pts, w) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#5a3217'; ctx.lineWidth = w + 0.12;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    ctx.strokeStyle = '#a8662e'; ctx.lineWidth = w;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,170,0.45)'; ctx.lineWidth = w * 0.28;
    ctx.stroke();
  }

  ART.drawSlingBack = function (ctx) {
    woodStroke(ctx, [[0.05, 0], [0.02, -1.9], [0.34, -2.5], [0.42, -3.15]], 0.3);
  };

  ART.drawSlingFront = function (ctx) {
    woodStroke(ctx, [[0, 0], [0, -1.9], [-0.34, -2.5], [-0.42, -3.15]], 0.34);
    ctx.fillStyle = '#6b3a1a';
    rr(ctx, -0.26, -2.05, 0.52, 0.34, 0.08); ctx.fill();
    ctx.fillStyle = '#8a4f24';
    rr(ctx, -0.26, -2.05, 0.52, 0.14, 0.06); ctx.fill();
  };

  // Rubber band from a fork tip to the pouch (both in the same local frame).
  ART.drawBand = function (ctx, fx, fy, px, py, front) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = front ? '#3a1f10' : '#2a150a';
    ctx.lineWidth = front ? 0.2 : 0.17;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(px, py); ctx.stroke();
  };

  ART.drawPouch = function (ctx, px, py, ang) {
    ctx.save();
    ctx.translate(px, py); ctx.rotate(ang);
    ctx.fillStyle = '#4a2a14';
    rr(ctx, -0.22, -0.34, 0.3, 0.68, 0.12); ctx.fill();
    ctx.restore();
  };

  /* ---------------------------------------------------------------- blocks */
  var MAT = {
    wood:  { base: '#e0a45c', light: '#f3c887', dark: '#a8652c', edge: '#7a441a' },
    stone: { base: '#a3adb8', light: '#cdd4dc', dark: '#6f7a86', edge: '#4f5864' },
    ice:   { base: 'rgba(170,225,255,0.78)', light: 'rgba(235,250,255,0.95)', dark: 'rgba(90,160,220,0.85)', edge: '#4f95c8' }
  };
  ART.MAT = MAT;

  function cracks(ctx, w, h, dmg, seed, col) {
    if (dmg < 0.3) return;
    var n = dmg < 0.6 ? 2 : 4;
    ctx.strokeStyle = col; ctx.lineWidth = 0.045; ctx.lineCap = 'round';
    for (var i = 0; i < n; i++) {
      var x = (hash(seed + i) - 0.5) * w * 0.8, y = (hash(seed + i * 2.2) - 0.5) * h * 0.8;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (var k = 0; k < 3; k++) {
        x += (hash(seed + i * 5 + k) - 0.5) * w * 0.35;
        y += (hash(seed + i * 7 + k) - 0.5) * h * 0.35;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // Rectangle block centred at the origin.
  ART.drawBlock = function (ctx, mat, w, h, dmg, seed) {
    var m = MAT[mat], r = Math.min(w, h) * 0.14, x = -w / 2, y = -h / 2;
    ctx.fillStyle = m.edge;
    rr(ctx, x, y, w, h, r); ctx.fill();
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, m.light); g.addColorStop(0.45, m.base); g.addColorStop(1, m.dark);
    ctx.fillStyle = g;
    var inset = Math.min(0.06, Math.min(w, h) * 0.12);
    rr(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, r * 0.8); ctx.fill();

    if (mat === 'wood') {
      ctx.strokeStyle = 'rgba(122,68,26,0.45)'; ctx.lineWidth = 0.035;
      var long = w >= h, lines = Math.max(2, Math.round((long ? h : w) / 0.14));
      for (var i = 1; i < lines; i++) {
        ctx.beginPath();
        if (long) {
          var yy = y + (h * i) / lines;
          ctx.moveTo(x + 0.12, yy); ctx.bezierCurveTo(x + w * 0.3, yy + 0.03, x + w * 0.6, yy - 0.03, x + w - 0.12, yy);
        } else {
          var xx = x + (w * i) / lines;
          ctx.moveTo(xx, y + 0.12); ctx.bezierCurveTo(xx + 0.03, y + h * 0.3, xx - 0.03, y + h * 0.6, xx, y + h - 0.12);
        }
        ctx.stroke();
      }
      ctx.fillStyle = '#7a441a';
      var nail = Math.min(0.05, Math.min(w, h) * 0.12);
      [[x + 0.16, y + 0.16], [x + w - 0.16, y + 0.16], [x + 0.16, y + h - 0.16], [x + w - 0.16, y + h - 0.16]].forEach(function (p) {
        if (w > 0.45 && h > 0.45) { ctx.beginPath(); ctx.arc(p[0], p[1], nail, 0, Math.PI * 2); ctx.fill(); }
      });
    } else if (mat === 'stone') {
      ctx.fillStyle = 'rgba(79,88,100,0.35)';
      for (var s = 0; s < w * h * 10; s++) {
        ctx.beginPath();
        ctx.arc(x + hash(seed + s) * w, y + hash(seed + s * 1.9) * h, 0.03 + hash(s) * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.06; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + w * 0.18, y + h * 0.22); ctx.lineTo(x + w * 0.42, y + h * 0.22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w * 0.18, y + h * 0.36); ctx.lineTo(x + w * 0.28, y + h * 0.36); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    rr(ctx, x + inset * 1.6, y + inset * 1.6, w - inset * 3.2, Math.min(0.1, h * 0.18), 0.04); ctx.fill();
    cracks(ctx, w, h, dmg, seed, mat === 'ice' ? 'rgba(40,100,160,0.8)' : 'rgba(40,20,5,0.55)');
  };

  // Round boulder or log end.
  ART.drawRound = function (ctx, mat, r, dmg, seed) {
    var m = MAT[mat];
    ctx.fillStyle = m.edge;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, m.light); g.addColorStop(0.55, m.base); g.addColorStop(1, m.dark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2); ctx.fill();
    if (mat === 'wood') {
      ctx.strokeStyle = 'rgba(122,68,26,0.5)'; ctx.lineWidth = 0.035;
      for (var k = 1; k < 4; k++) { ctx.beginPath(); ctx.arc(0, 0, (r * 0.9 * k) / 4, 0, Math.PI * 2); ctx.stroke(); }
    }
    cracks(ctx, r * 1.6, r * 1.6, dmg, seed, 'rgba(40,20,5,0.55)');
  };

  // Explosive crate.
  ART.drawTNT = function (ctx, w, h) {
    ART.drawBlock(ctx, 'wood', w, h, 0, 1);
    ctx.fillStyle = '#d8342a';
    rr(ctx, -w * 0.4, -h * 0.2, w * 0.8, h * 0.4, 0.06); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + (h * 0.3) + 'px "Lilita One", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TNT', 0, h * 0.02);
  };
})();

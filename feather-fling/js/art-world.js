/* Feather Fling — world art: themed skies, parallax scenery, ground and foreground.
 *
 * Screen-space functions take (ctx, W, H, ...). World-space functions draw in
 * a local frame the renderer has set up: y pointing DOWN, units in metres. */
(function () {
  'use strict';
  var ART = window.ART = window.ART || {};
  var TAU = Math.PI * 2;

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

  // Lighten (f > 0) or darken (f < 0) a #rrggbb colour.
  var tintCache = {};
  function tint(hex, f) {
    var key = hex + f;
    if (tintCache[key]) return tintCache[key];
    if (hex[0] !== '#' || hex.length !== 7) return hex;
    var c = [1, 3, 5].map(function (i) { return parseInt(hex.substr(i, 2), 16); });
    c = c.map(function (v) { return Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)); });
    return (tintCache[key] = 'rgb(' + c.join(',') + ')');
  }
  ART.tint = tint;

  /* ---------------------------------------------------------------- themes */
  var THEMES = [
    { name: 'Meadow', far: 'peaks', props: 'trees', deco: 'flowers',
      sky: ['#2f9cf0', '#8fd3ff', '#eafaff'], sun: '#fff6c9', night: false, rays: true,
      farCol: '#8ec3e8', farCap: '#f4fbff', mid: '#5cc05a', midDark: '#3f9a45', near: '#46a83f',
      tree: '#2f8a3a', treeLight: '#4fb04a', trunk: '#7a4a24', haze: 'rgba(230,248,255,0.55)',
      grass: '#6bd24a', grassLight: '#9be66f', grassDark: '#3f9a2f', dirt: '#b77a45', dirtDark: '#7a4a24', cloud: '#ffffff' },
    { name: 'Sunset Canyon', far: 'mesas', props: 'cacti', deco: 'rocks',
      sky: ['#ff7a54', '#ffb86b', '#ffe6b0'], sun: '#fff1b0', night: false, rays: true,
      farCol: '#d9826a', farCap: '#f0a47e', mid: '#e09a55', midDark: '#b9743d', near: '#c98a3f',
      tree: '#4f8a3a', treeLight: '#76b050', trunk: '#6a3d1f', haze: 'rgba(255,220,170,0.5)',
      grass: '#e6b35a', grassLight: '#f5d488', grassDark: '#b77f33', dirt: '#b3643a', dirtDark: '#7a3a18', cloud: '#fff1dc' },
    { name: 'Snowy Peaks', far: 'peaks', props: 'pines', deco: 'snow',
      sky: ['#4f74db', '#a8c6ff', '#f0f5ff'], sun: '#ffffff', night: false, rays: false,
      farCol: '#9fb4e6', farCap: '#ffffff', mid: '#dfe9f7', midDark: '#b6c8e6', near: '#c9d8ee',
      tree: '#2f6e5a', treeLight: '#4a8f74', trunk: '#5a3a24', haze: 'rgba(245,250,255,0.6)',
      grass: '#f4f8ff', grassLight: '#ffffff', grassDark: '#c3d3ec', dirt: '#8a9ab8', dirtDark: '#5f6d8e', cloud: '#ffffff' },
    { name: 'Tropical Beach', far: 'sea', props: 'palms', deco: 'shells',
      sky: ['#1fb4e8', '#7fdcf5', '#fff4d6'], sun: '#fffbe0', night: false, rays: true,
      farCol: '#1b9ad0', farCap: '#7fe0f0', mid: '#3fbf7a', midDark: '#2a9a5f', near: '#e9d29a',
      tree: '#2f9a4a', treeLight: '#5cc46a', trunk: '#9a6a3a', haze: 'rgba(255,250,230,0.55)',
      grass: '#f2dc9a', grassLight: '#fff0c0', grassDark: '#d4b46a', dirt: '#e0c080', dirtDark: '#b8904f', cloud: '#ffffff' },
    { name: 'Moonlit Castle', far: 'castle', props: 'spooky', deco: 'mushrooms',
      sky: ['#0d1440', '#2a2a6a', '#5a4a8a'], sun: '#fff8d8', night: true, rays: false,
      farCol: '#232653', farCap: '#3a3f7a', mid: '#2b3a5a', midDark: '#1f2a45', near: '#2e4a3a',
      tree: '#1d3a2e', treeLight: '#2c5242', trunk: '#2a1c14', haze: 'rgba(120,110,190,0.35)',
      grass: '#3f7a4a', grassLight: '#5fa066', grassDark: '#2a5234', dirt: '#4a3a30', dirtDark: '#2a2018', cloud: '#6a6aa0' },
    { name: 'Jungle Ruins', far: 'temple', props: 'jungle', deco: 'ferns', ambient: 'leaves', moss: true,
      sky: ['#2f9e8f', '#9fe0c0', '#f2ffe6'], sun: '#fffbd0', night: false, rays: true,
      farCol: '#5f9f86', farCap: '#7fbf9f', mid: '#3f9a5a', midDark: '#2c7a48', near: '#2f8a44',
      tree: '#236e3a', treeLight: '#3fa052', trunk: '#5a3a1e', haze: 'rgba(220,255,230,0.5)',
      grass: '#4fc04a', grassLight: '#8fe06a', grassDark: '#2f8a34', dirt: '#8a5a32', dirtDark: '#5a3418', cloud: '#ffffff' },
    { name: 'Volcano Isle', far: 'volcano', props: 'lavarocks', deco: 'embers', ambient: 'embers',
      sky: ['#2a0f1f', '#a8382a', '#ffb064'], sun: '#ffd9a0', night: false, rays: false,
      farCol: '#3a2226', farCap: '#ff7a2a', mid: '#4a2a2a', midDark: '#33191c', near: '#3a2424',
      tree: '#241516', treeLight: '#ff7a2a', trunk: '#241516', haze: 'rgba(255,140,80,0.35)',
      grass: '#5a4a44', grassLight: '#7a6660', grassDark: '#3a2c28', dirt: '#3a2622', dirtDark: '#1f1210', cloud: '#8a6a6a' }
  ];
  ART.THEMES = THEMES;
  ART.theme = function (i) { return THEMES[(i || 0) % THEMES.length]; };

  /* ------------------------------------------------------------------- sky */
  ART.drawSky = function (ctx, W, H, pal, groundY, t) {
    var g = ctx.createLinearGradient(0, 0, 0, Math.max(groundY, H * 0.5));
    g.addColorStop(0, pal.sky[0]);
    g.addColorStop(0.62, pal.sky[1]);
    g.addColorStop(1, pal.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    t = t || 0;
    var sx = W * 0.8, sy = H * 0.17, sr = Math.min(W, H) * 0.065;

    if (pal.night) {
      for (var i = 0; i < 90; i++) {
        var tw = 0.5 + 0.5 * Math.sin(t * (1 + hash(i) * 2) + i);
        ctx.fillStyle = 'rgba(255,255,240,' + (0.35 + tw * 0.6) + ')';
        var s = 0.6 + hash(i * 3.1) * 1.6;
        ctx.fillRect(hash(i * 1.7) * W, hash(i * 2.9) * groundY * 0.8, s, s);
      }
    }
    if (pal.rays) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(t * 0.03);
      for (var k = 0; k < 12; k++) {
        ctx.rotate(TAU / 12);
        ctx.fillStyle = 'rgba(255,255,235,' + (k % 2 ? 0.05 : 0.09) + ')';
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(-sr * 0.9, -Math.max(W, H)); ctx.lineTo(sr * 0.9, -Math.max(W, H)); ctx.fill();
      }
      ctx.restore();
    }
    var glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3.4);
    glow.addColorStop(0, pal.sun);
    glow.addColorStop(0.3, pal.night ? 'rgba(220,220,255,0.35)' : 'rgba(255,255,230,0.55)');
    glow.addColorStop(1, 'rgba(255,255,230,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(sx, sy, sr * 3.4, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.sun;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
    if (pal.night) {
      ctx.fillStyle = 'rgba(180,180,210,0.35)';
      [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [-0.05, 0.4, 0.12]].forEach(function (c) {
        ctx.beginPath(); ctx.arc(sx + c[0] * sr, sy + c[1] * sr, c[2] * sr, 0, TAU); ctx.fill();
      });
    }
  };

  function cloud(ctx, x, y, s, col, night) {
    var puffs = [[0, 0, 1], [0.95, -0.4, 0.85], [1.9, 0, 0.95], [0.95, 0.28, 0.9], [-0.85, 0.22, 0.68], [2.75, 0.25, 0.62]];
    ctx.fillStyle = night ? 'rgba(20,20,60,0.25)' : 'rgba(110,150,200,0.18)';
    ctx.beginPath();
    for (var i = 0; i < puffs.length; i++) {
      ctx.moveTo(x + puffs[i][0] * s + puffs[i][2] * s, y + puffs[i][1] * s + s * 0.28);
      ctx.arc(x + puffs[i][0] * s, y + puffs[i][1] * s + s * 0.28, puffs[i][2] * s, 0, TAU);
    }
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    for (i = 0; i < puffs.length; i++) {
      ctx.moveTo(x + puffs[i][0] * s + puffs[i][2] * s, y + puffs[i][1] * s);
      ctx.arc(x + puffs[i][0] * s, y + puffs[i][1] * s, puffs[i][2] * s, 0, TAU);
    }
    ctx.fill();
    // sunlit crown: a brighter inner layer on the upper puffs
    ctx.fillStyle = night ? 'rgba(200,200,255,0.12)' : 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    for (i = 0; i < 3; i++) {
      var q = puffs[i];
      ctx.moveTo(x + q[0] * s - s * 0.1 + q[2] * s * 0.7, y + q[1] * s - s * 0.12);
      ctx.arc(x + q[0] * s - s * 0.1, y + q[1] * s - s * 0.12, q[2] * s * 0.7, 0, TAU);
    }
    ctx.fill();
    if (col === '#ffffff') {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.arc(x + 0.7 * s, y - 0.55 * s, 0.35 * s, 0, TAU); ctx.fill();
    }
  }

  // A small flock drifting across the sky, wings flapping.
  function flock(ctx, W, H, camPx, t, u, night) {
    var span = W + 400;
    for (var f = 0; f < 2; f++) {
      var fx = ((hash(f * 9.3) * span + t * (14 + f * 6) - camPx * 0.04) % span + span) % span - 200;
      var fy = H * (0.12 + f * 0.13 + Math.sin(t * 0.3 + f) * 0.01);
      for (var b = 0; b < 5; b++) {
        var row = Math.ceil(b / 2), sd = b % 2 ? -1 : 1;
        var bx = fx - row * 18 * u, by = fy + (b ? sd * row * 9 * u : 0) + Math.sin(t * 2 + b) * 2 * u;
        var flap = Math.sin(t * 9 + b * 1.3 + f) * 4 * u, ws = (6 + f * 1.5) * u;
        ctx.strokeStyle = night ? 'rgba(20,20,40,0.6)' : 'rgba(40,50,70,0.55)';
        ctx.lineWidth = 1.6 * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(bx - ws, by - flap); ctx.quadraticCurveTo(bx - ws * 0.4, by - flap * 0.2 - 2 * u, bx, by);
        ctx.quadraticCurveTo(bx + ws * 0.4, by - flap * 0.2 - 2 * u, bx + ws, by - flap); ctx.stroke();
      }
    }
  }

  // Repeating silhouette layer; `f` is the parallax factor.
  function ridge(ctx, W, baseY, camPx, f, period, amp, seed, fill, round) {
    var off = -((camPx * f) % period + period) % period, step = period / 8;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(-period, baseY + 600);
    var px = off - period, py = baseY - amp * (0.45 + 0.55 * hash(seed + 7));
    ctx.lineTo(px, py);
    for (var x = off - period + step; x <= W + period; x += step) {
      var k = Math.round((x - off) / step);
      var h = amp * (0.45 + 0.55 * hash(seed + ((k % 8) + 8) % 8));
      if (round) ctx.quadraticCurveTo(px + step / 2, py - amp * 0.15, x, baseY - h);
      else ctx.lineTo(x, baseY - h);
      px = x; py = baseY - h;
    }
    ctx.lineTo(W + period, baseY + 600);
    ctx.closePath();
    ctx.fill();
  }

  function farLayer(ctx, W, H, pal, camPx, groundY, u, t) {
    var period = 900 * u, off = -((camPx * 0.12) % period + period) % period, baseY = groundY - 40 * u;
    for (var m = -1; m < Math.ceil(W / period) + 2; m++) {
      for (var p = 0; p < 3; p++) {
        var bx = off + m * period + p * period / 3 + hash(p) * 60 * u;
        var ph = (170 + hash(p * 5 + 1) * 120) * u, pw = (230 + hash(p * 9) * 90) * u;
        if (pal.far === 'peaks') {
          ctx.fillStyle = pal.farCol;
          ctx.beginPath(); ctx.moveTo(bx - pw, baseY); ctx.lineTo(bx, baseY - ph); ctx.lineTo(bx + pw, baseY); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,40,0.08)';
          ctx.beginPath(); ctx.moveTo(bx, baseY - ph); ctx.lineTo(bx + pw, baseY); ctx.lineTo(bx + pw * 0.2, baseY); ctx.fill();
          ctx.fillStyle = pal.farCap;
          ctx.beginPath();
          ctx.moveTo(bx, baseY - ph); ctx.lineTo(bx - pw * 0.22, baseY - ph * 0.78); ctx.lineTo(bx - pw * 0.08, baseY - ph * 0.83);
          ctx.lineTo(bx + pw * 0.05, baseY - ph * 0.74); ctx.lineTo(bx + pw * 0.22, baseY - ph * 0.79); ctx.closePath(); ctx.fill();
        } else if (pal.far === 'mesas') {
          var mh = ph * 0.6, mw = pw * 0.7;
          ctx.fillStyle = pal.farCol;
          ctx.beginPath(); ctx.moveTo(bx - mw, baseY); ctx.lineTo(bx - mw * 0.75, baseY - mh); ctx.lineTo(bx + mw * 0.7, baseY - mh);
          ctx.lineTo(bx + mw, baseY); ctx.fill();
          ctx.fillStyle = pal.farCap;
          ctx.fillRect(bx - mw * 0.74, baseY - mh, mw * 1.44, mh * 0.12);
          ctx.fillStyle = 'rgba(120,40,20,0.18)';
          for (var s = 1; s < 4; s++) ctx.fillRect(bx - mw * (0.74 + s * 0.06), baseY - mh + mh * s * 0.24, mw * (1.44 + s * 0.12), mh * 0.05);
        } else if (pal.far === 'castle' && p === 1) {
          var cx = bx, cw = 110 * u, ch = 120 * u;
          ctx.fillStyle = pal.farCol;
          ctx.fillRect(cx - cw, baseY - ch * 0.55, cw * 2, ch * 0.55);
          [-1, -0.35, 0.35, 1].forEach(function (k, i) {
            var tx = cx + k * cw, th = ch * (i === 1 || i === 2 ? 1.1 : 0.85);
            ctx.fillRect(tx - 16 * u, baseY - th, 32 * u, th);
            ctx.beginPath(); ctx.moveTo(tx - 20 * u, baseY - th); ctx.lineTo(tx, baseY - th - 34 * u); ctx.lineTo(tx + 20 * u, baseY - th); ctx.fill();
            ctx.fillStyle = 'rgba(255,210,120,' + (0.6 + 0.3 * Math.sin(t * 2 + i)) + ')';
            ctx.fillRect(tx - 4 * u, baseY - th + 20 * u, 8 * u, 12 * u);
            ctx.fillStyle = pal.farCol;
          });
        }
      }
    }
    if (pal.far === 'temple') {
      var tpd = 760 * u, toff2 = -((camPx * 0.12) % tpd + tpd) % tpd;
      for (var tq = -1; tq < Math.ceil(W / tpd) + 2; tq++) {
        var tbx = toff2 + tq * tpd + 200 * u, tby = groundY - 36 * u;
        for (var st = 0; st < 5; st++) {
          var sw = (150 - st * 26) * u, sh2 = 26 * u;
          ctx.fillStyle = st % 2 ? pal.farCol : pal.farCap;
          ctx.fillRect(tbx - sw, tby - (st + 1) * sh2, sw * 2, sh2 + 1);
        }
        ctx.fillStyle = pal.farCol;
        ctx.fillRect(tbx - 22 * u, tby - 150 * u, 44 * u, 22 * u);
        ctx.fillStyle = 'rgba(20,50,40,0.55)';
        ctx.fillRect(tbx - 12 * u, tby - 44 * u, 24 * u, 44 * u);
        ctx.strokeStyle = 'rgba(40,110,60,0.8)'; ctx.lineWidth = 3 * u;
        for (var vn = 0; vn < 5; vn++) {
          var vx = tbx - 120 * u + vn * 60 * u;
          ctx.beginPath(); ctx.moveTo(vx, tby - 110 * u + Math.abs(vn - 2) * 26 * u);
          ctx.quadraticCurveTo(vx + 10 * u, tby - 60 * u, vx - 4 * u, tby - 20 * u); ctx.stroke();
        }
      }
    }
    if (pal.far === 'volcano') {
      var vxc = ((W * 0.62 - camPx * 0.1) % (W + 900) + W + 900) % (W + 900) - 300, vb = groundY - 30 * u;
      var vw = 360 * u, vh = 240 * u;
      ctx.fillStyle = pal.farCol;
      ctx.beginPath(); ctx.moveTo(vxc - vw, vb); ctx.lineTo(vxc - 46 * u, vb - vh); ctx.lineTo(vxc + 46 * u, vb - vh); ctx.lineTo(vxc + vw, vb); ctx.fill();
      // lava rivers down the flanks
      ctx.strokeStyle = 'rgba(255,120,40,0.85)'; ctx.lineWidth = 5 * u; ctx.lineCap = 'round';
      [[-30, -1], [18, 1], [-6, 0.3]].forEach(function (lr) {
        ctx.beginPath(); ctx.moveTo(vxc + lr[0] * u, vb - vh + 6 * u);
        ctx.quadraticCurveTo(vxc + (lr[0] + lr[1] * 90) * u, vb - vh * 0.5, vxc + (lr[0] + lr[1] * 170) * u, vb);
        ctx.stroke();
      });
      var crater = ctx.createRadialGradient(vxc, vb - vh, 0, vxc, vb - vh, 90 * u);
      crater.addColorStop(0, 'rgba(255,220,120,0.95)'); crater.addColorStop(0.35, 'rgba(255,120,40,0.6)'); crater.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = crater;
      ctx.beginPath(); ctx.arc(vxc, vb - vh, 90 * u, 0, TAU); ctx.fill();
      // smoke plume rising and drifting
      for (var sm = 0; sm < 9; sm++) {
        var ph2 = ((t * 0.12 + sm / 9) % 1);
        var smx = vxc + Math.sin(ph2 * 3 + sm) * 30 * u + ph2 * 120 * u, smy = vb - vh - ph2 * 260 * u;
        ctx.fillStyle = 'rgba(70,50,55,' + (0.55 * (1 - ph2)) + ')';
        ctx.beginPath(); ctx.arc(smx, smy, (30 + ph2 * 70) * u, 0, TAU); ctx.fill();
      }
    }
    if (pal.far === 'sea') {
      var seaY = groundY - 70 * u;
      var sg = ctx.createLinearGradient(0, seaY, 0, groundY);
      sg.addColorStop(0, pal.farCap); sg.addColorStop(1, pal.farCol);
      ctx.fillStyle = sg;
      ctx.fillRect(0, seaY, W, groundY - seaY + 20);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2 * u; ctx.lineCap = 'round';
      for (var w = 0; w < 26; w++) {
        var wx = ((hash(w) * W * 1.5 - camPx * 0.2 + t * 12) % (W + 80) + W + 80) % (W + 80) - 40;
        var wy = seaY + 8 * u + hash(w * 3.3) * 50 * u;
        ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + 8 * u, wy - 4 * u, wx + 16 * u, wy); ctx.stroke();
      }
      // distant island
      ctx.fillStyle = pal.midDark;
      var ix = ((W * 0.3 - camPx * 0.08) % (W + 400) + W + 400) % (W + 400) - 200;
      ctx.beginPath(); ctx.ellipse(ix, seaY + 2, 120 * u, 26 * u, 0, Math.PI, TAU); ctx.fill();
    }
  }

  function prop(ctx, kind, pal, tx, ty, ts, n, t) {
    if (kind === 'trees') {
      ctx.fillStyle = pal.trunk; ctx.fillRect(tx - 5 * ts, ty - 46 * ts, 10 * ts, 46 * ts);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(tx + 1 * ts, ty - 46 * ts, 4 * ts, 46 * ts);
      ctx.strokeStyle = pal.trunk; ctx.lineWidth = 3 * ts; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty - 30 * ts); ctx.lineTo(tx + 14 * ts, ty - 44 * ts); ctx.moveTo(tx, ty - 36 * ts); ctx.lineTo(tx - 12 * ts, ty - 48 * ts); ctx.stroke();
      var sway2 = Math.sin(t * 0.9 + n) * 1.5 * ts;
      ctx.fillStyle = pal.tree;
      ctx.beginPath();
      ctx.moveTo(tx + sway2 + 30 * ts, ty - 62 * ts); ctx.arc(tx + sway2, ty - 62 * ts, 30 * ts, 0, TAU); ctx.moveTo(tx - 2 * ts, ty - 46 * ts); ctx.arc(tx - 22 * ts, ty - 46 * ts, 20 * ts, 0, TAU); ctx.moveTo(tx + 42 * ts, ty - 46 * ts); ctx.arc(tx + 22 * ts, ty - 46 * ts, 20 * ts, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,30,10,0.18)';
      ctx.beginPath(); ctx.ellipse(tx, ty - 36 * ts, 34 * ts, 9 * ts, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.treeLight;
      ctx.beginPath(); ctx.moveTo(tx - 8 * ts + sway2 + 15 * ts, ty - 70 * ts); ctx.arc(tx - 8 * ts + sway2, ty - 70 * ts, 15 * ts, 0, TAU); ctx.moveTo(tx - 24 * ts + 9 * ts, ty - 52 * ts); ctx.arc(tx - 24 * ts, ty - 52 * ts, 9 * ts, 0, TAU); ctx.moveTo(tx + 14 * ts + 7 * ts, ty - 54 * ts); ctx.arc(tx + 14 * ts, ty - 54 * ts, 7 * ts, 0, TAU); ctx.fill();
      ctx.fillStyle = tint(pal.treeLight, 0.3);
      ctx.beginPath(); ctx.moveTo(tx - 12 * ts + sway2 + 6 * ts, ty - 76 * ts); ctx.arc(tx - 12 * ts + sway2, ty - 76 * ts, 6 * ts, 0, TAU); ctx.moveTo(tx - 27 * ts + 3.5 * ts, ty - 56 * ts); ctx.arc(tx - 27 * ts, ty - 56 * ts, 3.5 * ts, 0, TAU); ctx.fill();
      if (hash(n * 4.4) > 0.6) {   // a few fruit
        ctx.fillStyle = '#e8453a';
        ctx.beginPath(); [[10, 50], [-14, 40], [2, 66]].forEach(function (fp) { ctx.moveTo(tx + fp[0] * ts + 2.6 * ts, ty - fp[1] * ts); ctx.moveTo(tx + fp[0] * ts + 2.6 * ts, ty - fp[1] * ts); ctx.arc(tx + fp[0] * ts, ty - fp[1] * ts, 2.6 * ts, 0, TAU); }); ctx.fill();
      }
    } else if (kind === 'pines') {
      ctx.fillStyle = pal.trunk; ctx.fillRect(tx - 4 * ts, ty - 16 * ts, 8 * ts, 16 * ts);
      for (var k = 0; k < 3; k++) {
        var w = (30 - k * 7) * ts, y0 = ty - 12 * ts - k * 20 * ts;
        ctx.fillStyle = pal.tree;
        ctx.beginPath(); ctx.moveTo(tx - w, y0); ctx.lineTo(tx, y0 - 34 * ts); ctx.lineTo(tx + w, y0); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(tx - w * 0.5, y0 - 17 * ts); ctx.lineTo(tx, y0 - 34 * ts); ctx.lineTo(tx + w * 0.5, y0 - 17 * ts);
        ctx.lineTo(tx + w * 0.2, y0 - 14 * ts); ctx.lineTo(tx, y0 - 19 * ts); ctx.lineTo(tx - w * 0.25, y0 - 14 * ts); ctx.fill();
      }
    } else if (kind === 'cacti') {
      ctx.fillStyle = pal.tree;
      rr(ctx, tx - 7 * ts, ty - 64 * ts, 14 * ts, 64 * ts, 7 * ts); ctx.fill();
      rr(ctx, tx - 26 * ts, ty - 44 * ts, 10 * ts, 26 * ts, 5 * ts); ctx.fill();
      rr(ctx, tx - 26 * ts, ty - 24 * ts, 22 * ts, 9 * ts, 4.5 * ts); ctx.fill();
      rr(ctx, tx + 16 * ts, ty - 54 * ts, 10 * ts, 24 * ts, 5 * ts); ctx.fill();
      rr(ctx, tx + 4 * ts, ty - 36 * ts, 22 * ts, 9 * ts, 4.5 * ts); ctx.fill();
      ctx.fillStyle = pal.treeLight;
      ctx.fillRect(tx - 3 * ts, ty - 60 * ts, 3 * ts, 54 * ts);
    } else if (kind === 'palms') {
      var sway = Math.sin(t * 1.2 + n) * 4 * ts;
      ctx.strokeStyle = pal.trunk; ctx.lineWidth = 8 * ts; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + 14 * ts, ty - 50 * ts, tx + 4 * ts + sway, ty - 92 * ts); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 2 * ts;
      for (var r = 1; r < 8; r++) { var yy = ty - r * 11 * ts; ctx.beginPath(); ctx.moveTo(tx + 1 * ts - 3 * ts, yy); ctx.lineTo(tx + 9 * ts, yy - 2 * ts); ctx.stroke(); }
      ctx.fillStyle = pal.tree;
      for (var l = 0; l < 6; l++) {
        var a = -Math.PI / 2 + (l - 2.5) * 0.55;
        ctx.save(); ctx.translate(tx + 4 * ts + sway, ty - 92 * ts); ctx.rotate(a);
        ctx.beginPath(); ctx.ellipse(28 * ts, 6 * ts, 30 * ts, 7 * ts, 0.35, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#6a4a24';
      ctx.beginPath(); ctx.arc(tx + 1 * ts + sway, ty - 86 * ts, 4 * ts, 0, TAU); ctx.arc(tx + 9 * ts + sway, ty - 87 * ts, 4 * ts, 0, TAU); ctx.fill();
    } else if (kind === 'jungle') {
      ctx.fillStyle = pal.trunk;
      ctx.beginPath(); ctx.moveTo(tx - 7 * ts, ty); ctx.quadraticCurveTo(tx - 2 * ts, ty - 60 * ts, tx - 4 * ts, ty - 104 * ts);
      ctx.lineTo(tx + 5 * ts, ty - 104 * ts); ctx.quadraticCurveTo(tx + 6 * ts, ty - 60 * ts, tx + 9 * ts, ty); ctx.fill();
      for (var lf = 0; lf < 7; lf++) {
        var la = -Math.PI / 2 + (lf - 3) * 0.5;
        ctx.save(); ctx.translate(tx, ty - 104 * ts); ctx.rotate(la);
        ctx.fillStyle = lf % 2 ? pal.tree : pal.treeLight;
        ctx.beginPath(); ctx.ellipse(32 * ts, 0, 36 * ts, 12 * ts, 0.25, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(0,40,10,0.35)'; ctx.lineWidth = 1.5 * ts;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(64 * ts, 8 * ts); ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = '#2f7a34'; ctx.lineWidth = 2.5 * ts; ctx.lineCap = 'round';
      [[-30, 60], [22, 46], [40, 70]].forEach(function (v2) {
        var sw2 = Math.sin(t * 1.3 + n + v2[0]) * 5 * ts;
        ctx.beginPath(); ctx.moveTo(tx + v2[0] * ts, ty - 100 * ts);
        ctx.quadraticCurveTo(tx + v2[0] * ts + sw2, ty - (100 - v2[1] / 2) * ts, tx + v2[0] * ts + sw2 * 1.6, ty - (100 - v2[1]) * ts); ctx.stroke();
      });
      ctx.fillStyle = pal.treeLight;
      for (var fn = -2; fn <= 2; fn++) {
        ctx.save(); ctx.translate(tx, ty); ctx.rotate(-Math.PI / 2 + fn * 0.45);
        ctx.beginPath(); ctx.ellipse(18 * ts, 0, 20 * ts, 5 * ts, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
    } else if (kind === 'lavarocks') {
      ctx.fillStyle = pal.tree;
      ctx.beginPath(); ctx.moveTo(tx - 22 * ts, ty); ctx.lineTo(tx - 10 * ts, ty - 70 * ts); ctx.lineTo(tx - 2 * ts, ty - 86 * ts);
      ctx.lineTo(tx + 8 * ts, ty - 58 * ts); ctx.lineTo(tx + 24 * ts, ty); ctx.fill();
      var gl = 0.6 + 0.4 * Math.sin(t * 2 + n);
      ctx.strokeStyle = 'rgba(255,' + Math.round(110 + gl * 60) + ',40,' + (0.55 + gl * 0.4) + ')'; ctx.lineWidth = 2.5 * ts; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(tx - 4 * ts, ty - 74 * ts); ctx.lineTo(tx - 8 * ts, ty - 44 * ts); ctx.lineTo(tx + 2 * ts, ty - 30 * ts); ctx.lineTo(tx - 3 * ts, ty); ctx.stroke();
    } else if (kind === 'spooky') {
      ctx.strokeStyle = pal.trunk; ctx.lineCap = 'round';
      ctx.lineWidth = 7 * ts;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - 2 * ts, ty - 60 * ts); ctx.stroke();
      ctx.lineWidth = 3.5 * ts;
      [[-2, -44, -22, -64], [-2, -54, 18, -74], [-10, -58, -16, -80], [10, -66, 22, -70]].forEach(function (b2) {
        ctx.beginPath(); ctx.moveTo(tx + b2[0] * ts, ty + b2[1] * ts); ctx.lineTo(tx + b2[2] * ts, ty + b2[3] * ts); ctx.stroke();
      });
      var flick = 0.6 + 0.4 * Math.sin(t * 5 + n * 3);
      ctx.fillStyle = 'rgba(200,255,140,' + (0.6 * flick) + ')';
      ctx.beginPath(); ctx.arc(tx + 30 * ts, ty - 40 * ts + Math.sin(t * 2 + n) * 6 * ts, 2.5 * ts, 0, TAU); ctx.fill();
    }
  }

  /* ------------------------------------------------------ parallax scenery */
  // pass: 'far' (clouds, distant scenery, haze, mid hills), 'near' (props, near
  // hills, ambient particles) or undefined for both.
  ART.drawParallax = function (ctx, W, H, pal, cam, groundY, t, pass) {
    var camPx = cam.x * cam.zoom;
    var u = Math.max(0.6, Math.min(1.6, H / 720));
    if (pass !== 'near') {

    for (var i = 0; i < 6; i++) {
      var span = W + 600;
      var cx = ((hash(i * 3.1) * span - camPx * 0.08 + t * (8 + i * 3)) % span + span) % span - 300;
      cloud(ctx, cx, H * (0.08 + hash(i * 7.7) * 0.28), (24 + hash(i) * 22) * u, pal.cloud, pal.night);
    }

    flock(ctx, W, H, camPx, t, u, pal.night);
    // the farthest hills, washed out by the air between
    ctx.save(); ctx.globalAlpha = 0.45;
    ridge(ctx, W, groundY - 70 * u, camPx, 0.05, 700 * u, 150 * u, 5, pal.farCol, true);
    ctx.restore();
    farLayer(ctx, W, H, pal, camPx, groundY, u, t);

    // haze band sits between far and mid layers for depth
    var hz = ctx.createLinearGradient(0, groundY - 160 * u, 0, groundY);
    hz.addColorStop(0, 'rgba(255,255,255,0)');
    hz.addColorStop(1, pal.haze);
    ctx.fillStyle = hz;
    ctx.fillRect(0, groundY - 160 * u, W, 160 * u);

    if (pal.far !== 'sea') ridge(ctx, W, groundY - 18 * u, camPx, 0.35, 520 * u, 95 * u, 11, pal.midDark, true);
    ridge(ctx, W, groundY - 6 * u, camPx, 0.5, 430 * u, pal.far === 'sea' ? 26 * u : 70 * u, 23, pal.mid, true);
    }
    if (pass === 'far') return;

    var tp = 150 * u, factor = 0.6, toff = -((camPx * factor) % tp + tp) % tp;
    for (var j = -1; j < W / tp + 2; j++) {
      var n = j + Math.floor(camPx * factor / tp);
      if (hash(n * 1.37) < 0.35) continue;
      var tx = toff + j * tp + hash(n) * 60 * u, ts = (0.7 + hash(n * 2.3) * 0.6) * u;
      prop(ctx, pal.props, pal, tx, groundY - 4 * u, ts, n, t);
    }
    ridge(ctx, W, groundY + 2 * u, camPx, 0.75, 360 * u, 26 * u, 41, pal.near, true);

    if (pal.ambient === 'leaves' || pal.ambient === 'embers') {
      for (var am = 0; am < 26; am++) {
        var life = ((t * (0.05 + hash(am) * 0.05)) + hash(am * 7.1)) % 1;
        var ax = ((hash(am * 3.7) * W - camPx * 0.3 + Math.sin(t + am) * 30) % W + W) % W;
        if (pal.ambient === 'leaves') {
          var ay = life * groundY;
          ctx.save(); ctx.translate(ax + Math.sin(life * 12 + am) * 40 * u, ay); ctx.rotate(life * 10 + am);
          ctx.fillStyle = am % 3 ? 'rgba(90,170,70,0.85)' : 'rgba(200,170,60,0.85)';
          ctx.beginPath(); ctx.ellipse(0, 0, 7 * u, 3 * u, 0, 0, TAU); ctx.fill();
          ctx.restore();
        } else {
          var ey = groundY - life * groundY * 0.9;
          ctx.fillStyle = 'rgba(255,' + Math.round(140 + hash(am) * 90) + ',60,' + (1 - life) + ')';
          ctx.beginPath(); ctx.arc(ax + Math.sin(life * 9 + am) * 20 * u, ey, (1.5 + hash(am * 2) * 2.5) * u, 0, TAU); ctx.fill();
        }
      }
    }
  };

  /* ---------------------------------------------------------------- ground */
  // World space with y DOWN: the surface is at y = 0 and the soil fills below.
  // The soil (strata, pebbles, stones, roots, turf overhang) is painted once per
  // world into a seamless tile 16 m wide and used as a pattern.
  var SOIL_W = 16, SOIL_D = 8, SOIL_PX = 48, soilCache = {};
  function soilTile(ctx, pal) {
    var e = soilCache[pal.name];
    if (!e) {
      var cv = document.createElement('canvas');
      cv.width = SOIL_W * SOIL_PX; cv.height = SOIL_D * SOIL_PX;
      var c = cv.getContext('2d');
      c.scale(SOIL_PX, SOIL_PX);
      var dg = c.createLinearGradient(0, 0, 0, 5);
      dg.addColorStop(0, pal.dirt); dg.addColorStop(1, pal.dirtDark);
      c.fillStyle = dg; c.fillRect(0, 0, SOIL_W, SOIL_D);
      c.fillStyle = 'rgba(0,0,0,0.08)';
      c.fillRect(0, 1.4, SOIL_W, 0.25); c.fillRect(0, 3.1, SOIL_W, 0.35);
      // wavy strata (whole periods across the tile so it wraps)
      c.strokeStyle = 'rgba(0,0,0,0.1)'; c.lineWidth = 0.05;
      [2.2, 4.0, 5.8].forEach(function (sy, si) {
        c.beginPath();
        for (var lx = 0; lx <= SOIL_W; lx += 0.25) {
          var ly = sy + Math.sin(lx / SOIL_W * TAU * 2 + si * 2) * 0.12 + Math.sin(lx / SOIL_W * TAU * 5) * 0.05;
          if (!lx) c.moveTo(lx, ly); else c.lineTo(lx, ly);
        }
        c.stroke();
      });
      function wrap(x, fn) { fn(x); if (x < 1.5) fn(x + SOIL_W); if (x > SOIL_W - 1.5) fn(x - SOIL_W); }
      // pebbles
      for (var s2 = 0; s2 < SOIL_W; s2 += 0.3) {
        if (hash(s2 * 3.3) < 0.45) continue;
        var py = 0.9 + hash(s2 * 1.7) * 6, pr = 0.08 + hash(s2 * 2) * 0.14;
        wrap(s2 + hash(s2) * 0.6, function (px) {
          c.fillStyle = 'rgba(0,0,0,0.16)';
          c.beginPath(); c.ellipse(px, py + 0.04, pr, pr * 0.62, 0, 0, TAU); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.12)';
          c.beginPath(); c.ellipse(px - pr * 0.25, py - pr * 0.2, pr * 0.45, pr * 0.25, 0, 0, TAU); c.fill();
        });
      }
      // roots
      c.strokeStyle = 'rgba(60,30,10,0.28)'; c.lineCap = 'round'; c.lineWidth = 0.05;
      for (var rt = 0; rt < SOIL_W; rt += 2.3) {
        if (hash(rt * 1.9 + 1) < 0.4) continue;
        wrap(rt, function (rx) {
          c.beginPath(); c.moveTo(rx, 0.4); c.quadraticCurveTo(rx + 0.3, 0.8, rx + 0.15, 1.3 + hash(rt) * 0.5);
          c.moveTo(rx + 0.12, 0.75); c.quadraticCurveTo(rx + 0.45, 0.9, rx + 0.6, 1.1); c.stroke();
        });
      }
      // larger buried stones with rims
      for (var bs = 0; bs < SOIL_W; bs += 1.7) {
        if (hash(bs * 2.7 + 3) < 0.45) continue;
        var by2 = 1.2 + hash(bs * 3.1) * 5, br2 = 0.22 + hash(bs * 7) * 0.2;
        wrap(bs + hash(bs * 5) * 1.2, function (bx2) {
          c.fillStyle = 'rgba(0,0,0,0.18)';
          c.beginPath(); c.ellipse(bx2 + 0.04, by2 + 0.05, br2, br2 * 0.65, 0.2, 0, TAU); c.fill();
          c.fillStyle = tint(pal.dirt, 0.18);
          c.beginPath(); c.ellipse(bx2, by2, br2, br2 * 0.65, 0.2, 0, TAU); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.18)';
          c.beginPath(); c.ellipse(bx2 - br2 * 0.3, by2 - br2 * 0.25, br2 * 0.45, br2 * 0.2, 0.2, 0, TAU); c.fill();
        });
      }
      // shadow under the turf, then the turf lip with scalloped overhang
      var ts2 = c.createLinearGradient(0, 0.3, 0, 1.1);
      ts2.addColorStop(0, 'rgba(0,0,0,0.25)'); ts2.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = ts2; c.fillRect(0, 0.3, SOIL_W, 0.8);
      c.fillStyle = pal.grassDark;
      c.fillRect(0, 0, SOIL_W, 0.5);
      c.beginPath();
      for (var sc = 0; sc < SOIL_W; sc += 0.5) {
        var sr = 0.05 + hash(sc * 3) * 0.12;
        c.moveTo(sc + 0.25 + sr, 0.45); c.arc(sc + 0.25, 0.45, sr, 0, Math.PI);
      }
      c.fill();
      e = soilCache[pal.name] = { canvas: cv, pattern: null };
    }
    if (!e.pattern) e.pattern = ctx.createPattern(e.canvas, 'repeat-x');
    if (e.pattern && e.pattern.setTransform && window.DOMMatrix) e.pattern.setTransform(new DOMMatrix().scale(1 / SOIL_PX));
    return e.pattern;
  }

  // World space with y DOWN: the surface is at y = 0 and the soil fills below.
  ART.drawGround = function (ctx, pal, x0, x1) {
    var depth = 30;
    ctx.fillStyle = pal.dirtDark;
    ctx.fillRect(x0, SOIL_D - 0.05, x1 - x0, depth);
    var pat = soilTile(ctx, pal);
    ctx.fillStyle = pat || pal.dirt;
    ctx.fillRect(x0, 0, x1 - x0, SOIL_D);
    ctx.fillStyle = pal.grass;
    ctx.beginPath();
    ctx.moveTo(x0, 0.36);
    for (var x = Math.floor(x0); x <= x1; x += 0.5) {
      ctx.lineTo(x + 0.25, -0.1 - hash(x * 4.1) * 0.12);
      ctx.lineTo(x + 0.5, 0.06);
    }
    ctx.lineTo(x1, 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.grassLight;
    ctx.fillRect(x0, -0.02, x1 - x0, 0.08);
  };

  // Small decorations along the ground, drawn in front of the scene.
  ART.drawForeground = function (ctx, pal, x0, x1, t) {
    for (var x = Math.floor(x0); x < x1; x += 0.9) {
      var h = hash(x * 5.1);
      if (h < 0.4) continue;
      var dx = x + hash(x * 2.2) * 0.5;
      if (dx > -1.2 && dx < 1.2) continue;   // keep the slingshot base clear
      var sway = Math.sin(t * 2 + x) * 0.03;
      if (pal.deco === 'flowers' && h > 0.75) {
        ctx.strokeStyle = pal.grassDark; ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.moveTo(dx, 0.05); ctx.lineTo(dx + sway, -0.32); ctx.stroke();
        ctx.fillStyle = ['#ff6fa0', '#ffd23f', '#ffffff', '#b58cff'][Math.floor(h * 40) % 4];
        for (var p = 0; p < 5; p++) { var a = p * TAU / 5; ctx.beginPath(); ctx.arc(dx + sway + Math.cos(a) * 0.07, -0.36 + Math.sin(a) * 0.07, 0.055, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#ffb21e'; ctx.beginPath(); ctx.arc(dx + sway, -0.36, 0.04, 0, TAU); ctx.fill();
      } else if (pal.deco === 'rocks' && h > 0.7) {
        ctx.fillStyle = '#8a5a3a'; ctx.beginPath(); ctx.ellipse(dx, 0.02, 0.22, 0.14, 0, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(dx - 0.06, -0.06, 0.08, 0.04, 0, 0, TAU); ctx.fill();
      } else if (pal.deco === 'snow' && h > 0.6) {
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(dx, 0.02, 0.3, 0.12, 0, Math.PI, TAU); ctx.fill();
      } else if (pal.deco === 'shells' && h > 0.78) {
        ctx.fillStyle = '#ffb3a0'; ctx.beginPath(); ctx.arc(dx, -0.05, 0.1, Math.PI, TAU); ctx.fill();
        ctx.strokeStyle = '#e07a66'; ctx.lineWidth = 0.02;
        for (var r2 = -1; r2 <= 1; r2++) { ctx.beginPath(); ctx.moveTo(dx, -0.05); ctx.lineTo(dx + r2 * 0.07, -0.13); ctx.stroke(); }
      } else if (pal.deco === 'ferns' && h > 0.55) {
        ctx.fillStyle = h > 0.8 ? pal.grassLight : pal.grassDark;
        for (var fr = -2; fr <= 2; fr++) {
          ctx.save(); ctx.translate(dx, 0.04); ctx.rotate(-Math.PI / 2 + fr * 0.4 + sway);
          ctx.beginPath(); ctx.ellipse(0.2, 0, 0.22, 0.05, 0, 0, TAU); ctx.fill();
          ctx.restore();
        }
      } else if (pal.deco === 'embers' && h > 0.6) {
        var eg = 0.5 + 0.5 * Math.sin(t * 4 + x * 3);
        ctx.fillStyle = '#2a1a18'; ctx.beginPath(); ctx.ellipse(dx, 0.02, 0.2, 0.12, 0, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,' + Math.round(100 + eg * 80) + ',30,' + (0.5 + eg * 0.5) + ')';
        ctx.beginPath(); ctx.ellipse(dx + 0.03, -0.04, 0.07, 0.03, 0, 0, TAU); ctx.fill();
      } else if (pal.deco === 'mushrooms' && h > 0.72) {
        var glow = 0.6 + 0.4 * Math.sin(t * 3 + x);
        ctx.fillStyle = '#e8e0d0'; ctx.fillRect(dx - 0.03, -0.18, 0.06, 0.2);
        ctx.fillStyle = 'rgba(120,230,255,' + glow + ')';
        ctx.beginPath(); ctx.arc(dx, -0.18, 0.12, Math.PI, TAU); ctx.fill();
      }
      // a second, lighter tuft beside the first
      if (pal.deco !== 'snow' && pal.deco !== 'shells' && pal.deco !== 'embers' && h > 0.55) {
        ctx.fillStyle = pal.grassLight;
        ctx.beginPath();
        ctx.moveTo(dx + 0.22, 0.06); ctx.lineTo(dx + 0.27 + sway, -0.15); ctx.lineTo(dx + 0.31, 0.04); ctx.lineTo(dx + 0.36 + sway, -0.2); ctx.lineTo(dx + 0.4, 0.06);
        ctx.fill();
      }
      // grass tufts everywhere except snow and sand
      if (pal.deco !== 'snow' && pal.deco !== 'shells' && pal.deco !== 'embers') {
        ctx.fillStyle = pal.grassDark;
        ctx.beginPath();
        ctx.moveTo(dx - 0.14, 0.06); ctx.lineTo(dx - 0.08 + sway, -0.2); ctx.lineTo(dx - 0.03, 0.04);
        ctx.lineTo(dx + sway, -0.26); ctx.lineTo(dx + 0.04, 0.04); ctx.lineTo(dx + 0.1 + sway, -0.18); ctx.lineTo(dx + 0.15, 0.06);
        ctx.fill();
      }
    }
  };

  // Soft darkening at the screen edges.
  ART.drawVignette = function (ctx, W, H, night) {
    var g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.45, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, night ? 'rgba(0,0,30,0.45)' : 'rgba(20,40,80,0.18)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
})();

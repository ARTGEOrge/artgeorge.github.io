/* Feather Fling — slingshot and building blocks.
 * Local frame: origin at the object's centre (slingshot: base of the post), y DOWN, metres. */
(function () {
  'use strict';
  var ART = window.ART, hash = ART.hash, rr = ART.rr, TAU = Math.PI * 2;

  /* -------------------------------------------------------------- slingshot */
  ART.SLING = { forkY: -3.1, left: -0.42, right: 0.42 };

  function woodLimb(ctx, pts, w) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = '#4a2810'; ctx.lineWidth = w + 0.14; ctx.stroke();
    ctx.strokeStyle = '#9a5a26'; ctx.lineWidth = w; ctx.stroke();
    ctx.strokeStyle = '#c47c3a'; ctx.lineWidth = w * 0.55; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,225,180,0.55)'; ctx.lineWidth = w * 0.16;
    ctx.save(); ctx.translate(-w * 0.18, 0); ctx.stroke(); ctx.restore();
  }

  ART.drawSlingBack = function (ctx) {
    woodLimb(ctx, [[0.05, 0], [0.03, -1.9], [0.34, -2.5], [0.42, -3.15]], 0.3);
  };

  ART.drawSlingFront = function (ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(0.1, 0.02, 0.55, 0.12, 0, 0, TAU); ctx.fill();
    woodLimb(ctx, [[0, 0], [0, -1.9], [-0.34, -2.5], [-0.42, -3.15]], 0.34);
    // leather grip wrap
    ctx.fillStyle = '#5a3217';
    rr(ctx, -0.25, -2.1, 0.5, 0.42, 0.08); ctx.fill();
    ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 0.035;
    for (var k = 0; k < 4; k++) {
      ctx.beginPath(); ctx.moveTo(-0.25, -2.04 + k * 0.1); ctx.lineTo(0.25, -1.98 + k * 0.1); ctx.stroke();
    }
  };

  // Rubber band from a fork tip to the pouch: dark core with a highlight.
  ART.drawBand = function (ctx, fx, fy, px, py, front) {
    ctx.lineCap = 'round';
    var len = Math.hypot(px - fx, py - fy), thick = Math.max(0.1, 0.24 - len * 0.03);
    ctx.strokeStyle = front ? '#3a1f10' : '#2a150a';
    ctx.lineWidth = thick;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(px, py); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,90,50,0.5)';
    ctx.lineWidth = thick * 0.3;
    ctx.beginPath(); ctx.moveTo(fx, fy - thick * 0.2); ctx.lineTo(px, py - thick * 0.2); ctx.stroke();
  };

  ART.drawPouch = function (ctx, px, py, ang) {
    ctx.save();
    ctx.translate(px, py); ctx.rotate(ang);
    ctx.fillStyle = '#3a200e';
    rr(ctx, -0.26, -0.38, 0.34, 0.76, 0.14); ctx.fill();
    ctx.fillStyle = '#6a3c1c';
    rr(ctx, -0.22, -0.32, 0.12, 0.64, 0.06); ctx.fill();
    ctx.restore();
  };

  /* -------------------------------------------------------------- materials */
  var MAT = {
    wood:  { top: '#f7d59c', base: '#e2a55e', low: '#b8743a', edge: '#6e3c16', bevelHi: 'rgba(255,240,210,0.7)', bevelLo: 'rgba(90,45,10,0.45)' },
    stone: { top: '#dde3ea', base: '#aab4bf', low: '#7c8793', edge: '#465059', bevelHi: 'rgba(255,255,255,0.65)', bevelLo: 'rgba(30,40,55,0.45)' },
    ice:   { top: 'rgba(240,252,255,0.95)', base: 'rgba(160,220,255,0.78)', low: 'rgba(80,150,215,0.85)', edge: '#3f86bf', bevelHi: 'rgba(255,255,255,0.9)', bevelLo: 'rgba(30,90,150,0.4)' }
  };
  ART.MAT = MAT;

  function cracks(ctx, w, h, dmg, seed, col) {
    if (dmg < 0.25) return;
    var n = dmg < 0.5 ? 1 : dmg < 0.75 ? 3 : 5;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (var pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? col : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = pass ? 0.045 : 0.07;
      for (var i = 0; i < n; i++) {
        var x = (hash(seed + i) - 0.5) * w * 0.7, y = (hash(seed + i * 2.2) - 0.5) * h * 0.7;
        ctx.beginPath(); ctx.moveTo(x + (pass ? 0 : 0.02), y + (pass ? 0 : 0.02));
        for (var k = 0; k < 4; k++) {
          x += (hash(seed + i * 5 + k) - 0.5) * w * 0.32;
          y += (hash(seed + i * 7 + k) - 0.5) * h * 0.32;
          ctx.lineTo(x + (pass ? 0 : 0.02), y + (pass ? 0 : 0.02));
        }
        ctx.stroke();
      }
    }
  }

  function faceGradient(ctx, m, y, h) {
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, m.top); g.addColorStop(0.35, m.base); g.addColorStop(1, m.low);
    return g;
  }

  // Rectangle block centred at the origin.
  ART.drawBlock = function (ctx, mat, w, h, dmg, seed, opts) {
    opts = opts || {};
    var m = MAT[mat], r = Math.min(w, h) * 0.16, x = -w / 2, y = -h / 2;
    var bev = Math.min(0.09, Math.min(w, h) * 0.18);
    ctx.fillStyle = m.edge;
    rr(ctx, x, y, w, h, r); ctx.fill();
    ctx.fillStyle = faceGradient(ctx, m, y, h);
    rr(ctx, x + 0.035, y + 0.035, w - 0.07, h - 0.07, r * 0.85); ctx.fill();

    ctx.save();
    rr(ctx, x + 0.035, y + 0.035, w - 0.07, h - 0.07, r * 0.85); ctx.clip();
    if (mat === 'wood') {
      var long = w >= h, span = long ? h : w, lines = Math.max(2, Math.round(span / 0.13));
      ctx.strokeStyle = 'rgba(120,62,20,0.35)'; ctx.lineWidth = 0.03;
      for (var i = 1; i < lines; i++) {
        ctx.beginPath();
        if (long) {
          var yy = y + (h * i) / lines, wob = (hash(seed + i) - 0.5) * 0.05;
          ctx.moveTo(x, yy); ctx.bezierCurveTo(x + w * 0.33, yy + wob, x + w * 0.66, yy - wob, x + w, yy);
        } else {
          var xx = x + (w * i) / lines, wb = (hash(seed + i) - 0.5) * 0.05;
          ctx.moveTo(xx, y); ctx.bezierCurveTo(xx + wb, y + h * 0.33, xx - wb, y + h * 0.66, xx, y + h);
        }
        ctx.stroke();
      }
      // end grain: growth rings on the short ends of long pieces
      if (Math.max(w, h) / Math.min(w, h) > 2.5) {
        ctx.strokeStyle = 'rgba(110,55,15,0.4)'; ctx.lineWidth = 0.022;
        var er = Math.min(w, h) * 0.32;
        [-1, 1].forEach(function (sd) {
          var ex = long ? sd * (w / 2 - er - 0.06) : 0, ey = long ? 0 : sd * (h / 2 - er - 0.06);
          for (var ring = 1; ring <= 3; ring++) { ctx.beginPath(); ctx.arc(ex, ey, er * ring / 3, 0, TAU); ctx.stroke(); }
        });
      }
      if (w * h > 0.3) {   // a knot
        var kx = x + w * (0.25 + hash(seed) * 0.5), ky = y + h * (0.3 + hash(seed * 2) * 0.4);
        ctx.strokeStyle = 'rgba(110,55,15,0.45)'; ctx.lineWidth = 0.03;
        ctx.beginPath(); ctx.ellipse(kx, ky, 0.08, 0.045, long ? 0 : Math.PI / 2, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(kx, ky, 0.035, 0.02, long ? 0 : Math.PI / 2, 0, TAU); ctx.stroke();
      }
    } else if (mat === 'stone') {
      // brick courses
      var course = 0.36, bw = 0.62;
      ctx.strokeStyle = 'rgba(55,65,78,0.45)'; ctx.lineWidth = 0.035;
      for (var row = 0; y + row * course < y + h; row++) {
        var ry = y + row * course;
        if (row) { ctx.beginPath(); ctx.moveTo(x, ry); ctx.lineTo(x + w, ry); ctx.stroke(); }
        for (var c = (row % 2) * bw / 2; c < w; c += bw) {
          if (c <= 0.05) continue;
          ctx.beginPath(); ctx.moveTo(x + c, ry); ctx.lineTo(x + c, Math.min(y + h, ry + course)); ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(60,70,82,0.18)';
      for (var sp = 0; sp < w * h * 14; sp++) {
        ctx.beginPath(); ctx.arc(x + hash(seed + sp) * w, y + hash(seed + sp * 1.9) * h, 0.02 + hash(sp) * 0.035, 0, TAU); ctx.fill();
      }
      if (opts.moss) {
        for (var ms = 0; ms < 3 + w * 2; ms++) {
          var mx = x + hash(seed + ms * 9.1) * w, my = y + hash(seed + ms * 4.7) * h * 0.5;
          ctx.fillStyle = ms % 2 ? 'rgba(80,160,60,0.75)' : 'rgba(60,130,50,0.7)';
          ctx.beginPath(); ctx.ellipse(mx, my, 0.12 + hash(ms) * 0.1, 0.06 + hash(ms * 2) * 0.05, 0, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = 'rgba(90,170,60,0.8)';
        for (var dr = 0; dr < w * 3; dr++) {
          var dx2 = x + hash(seed + dr * 2.3) * w;
          ctx.beginPath(); ctx.ellipse(dx2, y + 0.06, 0.08, 0.05 + hash(dr) * 0.06, 0, 0, TAU); ctx.fill();
        }
      }
    } else {
      // glossy diagonal reflections
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.1, y + h); ctx.lineTo(x + w * 0.1 + h * 0.5, y); ctx.lineTo(x + w * 0.1 + h * 0.5 + 0.18, y); ctx.lineTo(x + w * 0.1 + 0.18, y + h);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (var fb = 0; fb < Math.max(3, w * h * 10); fb++) {
        var fx = x + hash(seed + fb * 3.1) * w, fy = y + hash(seed + fb * 5.3) * h;
        if (fb % 3 === 0) {
          ctx.save(); ctx.translate(fx, fy);
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.015;
          for (var sp2 = 0; sp2 < 3; sp2++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-0.05, 0); ctx.lineTo(0.05, 0); ctx.stroke(); }
          ctx.restore();
        } else {
          ctx.beginPath(); ctx.arc(fx, fy, 0.015 + hash(fb) * 0.02, 0, TAU); ctx.fill();
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.1 + 0.3, y + h); ctx.lineTo(x + w * 0.1 + h * 0.5 + 0.3, y); ctx.lineTo(x + w * 0.1 + h * 0.5 + 0.38, y); ctx.lineTo(x + w * 0.1 + 0.38, y + h);
      ctx.fill();
    }
    ctx.restore();

    // bevel: light top-left, shade bottom-right
    ctx.lineWidth = bev * 0.6; ctx.lineCap = 'round';
    ctx.strokeStyle = m.bevelHi;
    ctx.beginPath(); ctx.moveTo(x + r, y + bev * 0.6); ctx.lineTo(x + w - r, y + bev * 0.6); ctx.moveTo(x + bev * 0.6, y + r); ctx.lineTo(x + bev * 0.6, y + h - r); ctx.stroke();
    ctx.strokeStyle = m.bevelLo;
    ctx.beginPath(); ctx.moveTo(x + r, y + h - bev * 0.6); ctx.lineTo(x + w - r, y + h - bev * 0.6); ctx.moveTo(x + w - bev * 0.6, y + r); ctx.lineTo(x + w - bev * 0.6, y + h - r); ctx.stroke();

    if (mat === 'wood' && w > 0.5 && h > 0.5) {
      [[x + 0.15, y + 0.15], [x + w - 0.15, y + 0.15], [x + 0.15, y + h - 0.15], [x + w - 0.15, y + h - 0.15]].forEach(function (p) {
        ctx.fillStyle = '#5a3a1e'; ctx.beginPath(); ctx.arc(p[0], p[1], 0.05, 0, TAU); ctx.fill();
        ctx.fillStyle = '#b9b0a4'; ctx.beginPath(); ctx.arc(p[0], p[1], 0.035, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(p[0] - 0.012, p[1] - 0.012, 0.012, 0, TAU); ctx.fill();
      });
    }
    if (dmg > 0.5) {
      // a chunk knocked out of one or two corners
      var chips = dmg > 0.75 ? 2 : 1, cs = Math.min(w, h) * 0.3;
      for (var ci = 0; ci < chips; ci++) {
        var cx2 = hash(seed + ci) < 0.5 ? -1 : 1, cy2 = hash(seed + ci * 3) < 0.5 ? -1 : 1;
        var px2 = cx2 * w / 2, py2 = cy2 * h / 2;
        ctx.fillStyle = m.edge;
        ctx.beginPath(); ctx.moveTo(px2, py2); ctx.lineTo(px2 - cx2 * cs, py2); ctx.lineTo(px2 - cx2 * cs * 0.4, py2 - cy2 * cs * 0.5); ctx.lineTo(px2, py2 - cy2 * cs); ctx.closePath(); ctx.fill();
        ctx.fillStyle = m.low;
        ctx.beginPath(); ctx.moveTo(px2 - cx2 * cs * 0.85, py2 - cy2 * 0.02); ctx.lineTo(px2 - cx2 * cs * 0.4, py2 - cy2 * cs * 0.45); ctx.lineTo(px2 - cx2 * 0.02, py2 - cy2 * cs * 0.85); ctx.closePath(); ctx.fill();
      }
    }
    cracks(ctx, w, h, dmg, seed, mat === 'ice' ? 'rgba(30,90,150,0.85)' : 'rgba(40,20,5,0.6)');
  };

  // Right-angled or isosceles triangle; `pts` in local coordinates (y down).
  ART.drawTri = function (ctx, mat, pts, dmg, seed) {
    var m = MAT[mat], minY = Math.min(pts[0][1], pts[1][1], pts[2][1]), maxY = Math.max(pts[0][1], pts[1][1], pts[2][1]);
    function path(inset) {
      var cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
      ctx.beginPath();
      pts.forEach(function (p, i) {
        var px = p[0] + (cx - p[0]) * inset, py = p[1] + (cy - p[1]) * inset;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      });
      ctx.closePath();
    }
    ctx.lineJoin = 'round';
    ctx.fillStyle = m.edge; path(0); ctx.fill();
    ctx.fillStyle = faceGradient(ctx, m, minY, maxY - minY); path(0.08); ctx.fill();
    ctx.strokeStyle = m.bevelHi; ctx.lineWidth = 0.05; path(0.16); ctx.stroke();
    cracks(ctx, 0.8, 0.8, dmg, seed, mat === 'ice' ? 'rgba(30,90,150,0.85)' : 'rgba(40,20,5,0.6)');
  };

  // Round boulder or log end.
  ART.drawRound = function (ctx, mat, r, dmg, seed) {
    var m = MAT[mat];
    ctx.fillStyle = m.edge;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.08, 0, 0, r);
    g.addColorStop(0, m.top); g.addColorStop(0.55, m.base); g.addColorStop(1, m.low);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.92, 0, TAU); ctx.fill();
    if (mat === 'wood') {
      ctx.strokeStyle = 'rgba(122,68,26,0.5)'; ctx.lineWidth = 0.03;
      for (var k = 1; k < 4; k++) { ctx.beginPath(); ctx.arc(0, 0, (r * 0.92 * k) / 4, 0, TAU); ctx.stroke(); }
    } else if (mat === 'stone') {
      ctx.fillStyle = 'rgba(60,70,82,0.2)';
      for (var s = 0; s < 8; s++) { ctx.beginPath(); ctx.arc((hash(seed + s) - 0.5) * r * 1.2, (hash(seed + s * 3) - 0.5) * r * 1.2, r * 0.08, 0, TAU); ctx.fill(); }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.22, r * 0.12, -0.6, 0, TAU); ctx.fill();
    cracks(ctx, r * 1.6, r * 1.6, dmg, seed, 'rgba(40,20,5,0.6)');
  };

  // Explosive crate.
  ART.drawTNT = function (ctx, w, h, t) {
    ART.drawBlock(ctx, 'wood', w, h, 0, 1);
    ctx.fillStyle = '#c9261d';
    rr(ctx, -w * 0.42, -h * 0.22, w * 0.84, h * 0.44, 0.06); ctx.fill();
    ctx.fillStyle = '#e8453a';
    rr(ctx, -w * 0.42, -h * 0.22, w * 0.84, h * 0.14, 0.05); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = (h * 0.3) + 'px "Lilita One", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TNT', 0, h * 0.03);
    // warning stripes on the corners
    ctx.fillStyle = '#ffd23f';
    [[-1, -1], [1, 1]].forEach(function (c) {
      ctx.beginPath();
      ctx.moveTo(c[0] * w * 0.46, c[1] * h * 0.46); ctx.lineTo(c[0] * w * 0.22, c[1] * h * 0.46); ctx.lineTo(c[0] * w * 0.46, c[1] * h * 0.22);
      ctx.fill();
    });
  };

  // Soft contact shadow on the ground under an object (world frame at ground level).
  ART.drawShadow = function (ctx, x, halfW, height, night) {
    var a = Math.max(0, 0.32 - height * 0.05) * (night ? 0.7 : 1);
    if (a <= 0.01) return;
    var g = ctx.createRadialGradient(x, 0, 0, x, 0, halfW * 1.3);
    g.addColorStop(0, 'rgba(0,0,0,' + a + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.save(); ctx.translate(x, 0.02); ctx.scale(1, 0.22); ctx.translate(-x, 0);
    ctx.beginPath(); ctx.arc(x, 0, halfW * 1.3, 0, TAU); ctx.fill();
    ctx.restore();
  };
})();

/* Feather Fling — slingshot and building blocks.
 * Local frame: origin at the object's centre (slingshot: base of the post), y DOWN, metres. */
(function () {
  'use strict';
  var ART = window.ART, hash = ART.hash, rr = ART.rr, TAU = Math.PI * 2;

  /* -------------------------------------------------------------- slingshot */
  ART.SLING = { forkY: -3.1, left: -0.42, right: 0.42 };

  function limbPath(ctx, pts) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  }
  function woodLimb(ctx, pts, w) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    limbPath(ctx, pts);
    ctx.strokeStyle = '#3e2009'; ctx.lineWidth = w + 0.14; ctx.stroke();
    ctx.strokeStyle = '#8a4e1f'; ctx.lineWidth = w; ctx.stroke();
    ctx.strokeStyle = '#b8732f'; ctx.lineWidth = w * 0.62; ctx.stroke();
    ctx.save(); ctx.translate(-w * 0.12, 0);
    ctx.strokeStyle = '#d08a44'; ctx.lineWidth = w * 0.3; limbPath(ctx, pts); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,225,180,0.55)'; ctx.lineWidth = w * 0.12;
    ctx.save(); ctx.translate(-w * 0.24, 0); limbPath(ctx, pts); ctx.stroke(); ctx.restore();
    // bark grain: thin dark lines that follow each segment
    ctx.strokeStyle = 'rgba(70,32,8,0.45)'; ctx.lineWidth = 0.018;
    for (var i = 1; i < pts.length; i++) {
      var ax = pts[i - 1][0], ay = pts[i - 1][1], bx = pts[i][0], by = pts[i][1];
      var len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len;
      for (var g = 0; g < 4; g++) {
        var o = (g - 1.5) * w * 0.2, s0 = 0.1 + hash(i * 7 + g) * 0.3, s1 = 0.6 + hash(i * 3 + g) * 0.35;
        ctx.beginPath();
        ctx.moveTo(ax + (bx - ax) * s0 + nx * o, ay + (by - ay) * s0 + ny * o);
        ctx.quadraticCurveTo(ax + (bx - ax) * (s0 + s1) / 2 + nx * (o + 0.03), ay + (by - ay) * (s0 + s1) / 2 + ny * (o + 0.03),
          ax + (bx - ax) * s1 + nx * o, ay + (by - ay) * s1 + ny * o);
        ctx.stroke();
      }
    }
    // a knot on the lower trunk
    var kx = pts[0][0] + (pts[1][0] - pts[0][0]) * 0.45, ky = pts[0][1] + (pts[1][1] - pts[0][1]) * 0.45;
    ctx.fillStyle = '#5a2e10'; ctx.beginPath(); ctx.ellipse(kx + w * 0.1, ky, w * 0.16, w * 0.24, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,150,0.4)'; ctx.lineWidth = 0.015;
    ctx.beginPath(); ctx.ellipse(kx + w * 0.1, ky, w * 0.24, w * 0.34, 0, 0, TAU); ctx.stroke();
  }

  ART.drawSlingBack = function (ctx) {
    woodLimb(ctx, [[0.05, 0], [0.03, -1.9], [0.34, -2.5], [0.42, -3.15]], 0.3);
    bandWrap(ctx, 0.42, -3.05);
  };

  // rubber lashed round a fork tip
  function bandWrap(ctx, x, y) {
    ctx.fillStyle = '#2a150a';
    rr(ctx, x - 0.2, y - 0.1, 0.4, 0.26, 0.07); ctx.fill();
    ctx.strokeStyle = 'rgba(150,80,40,0.7)'; ctx.lineWidth = 0.025;
    for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x - 0.18, y - 0.05 + k * 0.08); ctx.lineTo(x + 0.18, y - 0.08 + k * 0.08); ctx.stroke(); }
  }

  ART.drawSlingFront = function (ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(0.1, 0.02, 0.75, 0.14, 0, 0, TAU); ctx.fill();
    woodLimb(ctx, [[0, 0], [0, -1.9], [-0.34, -2.5], [-0.42, -3.15]], 0.34);
    bandWrap(ctx, -0.42, -3.05);
    // leather grip wrap with stitching
    ctx.fillStyle = '#5a3217';
    rr(ctx, -0.25, -2.1, 0.5, 0.42, 0.08); ctx.fill();
    ctx.fillStyle = '#7a4622'; ctx.fillRect(-0.22, -2.08, 0.12, 0.38);
    ctx.fillStyle = '#3a1f0c'; ctx.fillRect(0.12, -2.08, 0.1, 0.38);
    ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 0.035;
    for (var k = 0; k < 4; k++) {
      ctx.beginPath(); ctx.moveTo(-0.25, -2.04 + k * 0.1); ctx.lineTo(0.25, -1.98 + k * 0.1); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,230,190,0.7)'; ctx.lineWidth = 0.015;
    ctx.beginPath();
    for (var st2 = 0; st2 < 4; st2++) { var sy2 = -2.06 + st2 * 0.09; ctx.moveTo(-0.21, sy2); ctx.lineTo(-0.21, sy2 + 0.04); ctx.moveTo(0.21, sy2); ctx.lineTo(0.21, sy2 + 0.04); }
    ctx.stroke();
    // stones heaped round the base
    [[-0.38, -0.02, 0.2], [0.34, 0, 0.22], [-0.05, 0.02, 0.16], [0.6, 0.03, 0.12]].forEach(function (st, i) {
      ctx.fillStyle = '#6b7480';
      ctx.beginPath(); ctx.ellipse(st[0], st[1], st[2] * 1.2, st[2] * 0.8, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#a3acb6';
      ctx.beginPath(); ctx.ellipse(st[0] - st[2] * 0.15, st[1] - st[2] * 0.1, st[2] * 0.9, st[2] * 0.6, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#dfe4ea';
      ctx.beginPath(); ctx.ellipse(st[0] - st[2] * 0.4, st[1] - st[2] * 0.45, st[2] * 0.3, st[2] * 0.12, 0, 0, TAU); ctx.fill();
    });
  };

  // Rubber band from a fork tip to the pouch: two strands that thin and pale as they stretch.
  ART.drawBand = function (ctx, fx, fy, px, py, front) {
    ctx.lineCap = 'round';
    var len = Math.hypot(px - fx, py - fy), k = Math.min(1, len / 2.6), thick = Math.max(0.07, 0.2 - len * 0.035);
    var nx = -(py - fy) / (len || 1), ny = (px - fx) / (len || 1);
    var core = front ? [58 + k * 60, 31 + k * 20, 16 + k * 10] : [42 + k * 50, 21 + k * 18, 10 + k * 8];
    ctx.strokeStyle = 'rgb(' + core.map(Math.round).join(',') + ')';
    for (var sd = -1; sd <= 1; sd += 2) {
      var o = sd * thick * 0.42;
      ctx.lineWidth = thick * 0.75;
      ctx.beginPath(); ctx.moveTo(fx + nx * o, fy + ny * o); ctx.lineTo(px + nx * o * 0.6, py + ny * o * 0.6); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(200,130,80,' + (0.35 + k * 0.3) + ')';
    ctx.lineWidth = thick * 0.18;
    ctx.beginPath(); ctx.moveTo(fx + nx * thick * 0.55, fy + ny * thick * 0.55); ctx.lineTo(px + nx * thick * 0.3, py + ny * thick * 0.3); ctx.stroke();
  };

  ART.drawPouch = function (ctx, px, py, ang) {
    ctx.save();
    ctx.translate(px, py); ctx.rotate(ang);
    ctx.fillStyle = '#3a200e';
    rr(ctx, -0.26, -0.38, 0.34, 0.76, 0.14); ctx.fill();
    ctx.fillStyle = '#7a4a24';
    rr(ctx, -0.22, -0.32, 0.12, 0.64, 0.06); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,170,0.6)'; ctx.lineWidth = 0.014;
    ctx.beginPath();
    for (var st3 = 0; st3 < 7; st3++) { var sy3 = -0.28 + st3 * 0.085; ctx.moveTo(0.02, sy3); ctx.lineTo(0.02, sy3 + 0.04); }
    ctx.stroke();
    ctx.restore();
  };

  /* -------------------------------------------------------------- materials */
  var MAT = {
    wood:  { top: '#f7d59c', base: '#e2a55e', low: '#b8743a', edge: '#6e3c16', bevelHi: 'rgba(255,240,210,0.7)', bevelLo: 'rgba(90,45,10,0.45)' },
    stone: { top: '#dde3ea', base: '#aab4bf', low: '#7c8793', edge: '#465059', bevelHi: 'rgba(255,255,255,0.65)', bevelLo: 'rgba(30,40,55,0.45)' },
    ice:   { top: 'rgba(240,252,255,0.95)', base: 'rgba(160,220,255,0.78)', low: 'rgba(80,150,215,0.85)', edge: '#3f86bf', bevelHi: 'rgba(255,255,255,0.9)', bevelLo: 'rgba(30,90,150,0.4)' }
  };
  ART.MAT = MAT;

  // Damage marks per material: wood splits along the grain, stone fissures
  // branch and powder, ice/glass breaks in a spiderweb from one impact point.
  function cracks(ctx, w, h, dmg, seed, col, mat, grainV) {
    if (dmg < 0.2) return;
    if (mat === 'ice') return glassCracks(ctx, w, h, dmg, seed);
    if (mat === 'wood') return woodSplits(ctx, w, h, dmg, seed, grainV);
    var n = dmg < 0.5 ? 1 : dmg < 0.75 ? 3 : 5;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (var pass = 0; pass < 3; pass++) {
      ctx.strokeStyle = pass === 0 ? 'rgba(255,255,255,0.4)' : pass === 1 ? col : 'rgba(10,12,18,0.75)';
      ctx.lineWidth = pass === 0 ? 0.075 : pass === 1 ? 0.05 : 0.018;
      for (var i = 0; i < n; i++) {
        var x = (hash(seed + i) - 0.5) * w * 0.7, y = (hash(seed + i * 2.2) - 0.5) * h * 0.7;
        var o = pass === 0 ? 0.022 : 0;
        ctx.beginPath(); ctx.moveTo(x + o, y + o);
        for (var k = 0; k < 4; k++) {
          var nx = x + (hash(seed + i * 5 + k) - 0.5) * w * 0.32, ny = y + (hash(seed + i * 7 + k) - 0.5) * h * 0.32;
          ctx.lineTo(nx + o, ny + o);
          if (pass === 1 && k === 1) {   // a short side branch
            ctx.moveTo(nx, ny); ctx.lineTo(nx + (hash(seed + i + k * 13) - 0.5) * 0.3, ny + (hash(seed + i * 3 + k) - 0.5) * 0.3); ctx.moveTo(nx, ny);
          }
          x = nx; y = ny;
        }
        ctx.stroke();
      }
    }
    // powdered stone around the fissures
    if (dmg > 0.45) {
      ctx.fillStyle = 'rgba(240,240,235,0.35)';
      for (var d = 0; d < n * 6; d++) {
        ctx.beginPath(); ctx.arc((hash(seed + d * 1.9) - 0.5) * w * 0.8, (hash(seed + d * 2.7) - 0.5) * h * 0.8, 0.012 + hash(d) * 0.02, 0, TAU); ctx.fill();
      }
    }
  }

  function woodSplits(ctx, w, h, dmg, seed, grainV) {
    var along = grainV ? h : w, across = grainV ? w : h;
    var n = dmg < 0.45 ? 1 : dmg < 0.7 ? 2 : 4;
    ctx.save();
    if (grainV) ctx.rotate(Math.PI / 2);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (var i = 0; i < n; i++) {
      var y0 = (hash(seed + i * 3.3) - 0.5) * across * 0.7;
      var x0 = (hash(seed + i * 1.7) - 0.5) * along * 0.5, len = along * (0.25 + hash(seed + i) * 0.35 + dmg * 0.2);
      var pts = [[x0 - len / 2, y0]];
      for (var k = 1; k <= 5; k++) pts.push([x0 - len / 2 + len * k / 5, y0 + (hash(seed + i * 9 + k) - 0.5) * 0.08]);
      // the split opens wider in the middle: pale fresh wood, dark gap
      ctx.fillStyle = 'rgba(255,226,170,0.85)';
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      pts.forEach(function (p, j) { var o = Math.sin(j / 5 * Math.PI) * (0.03 + dmg * 0.03); ctx.lineTo(p[0], p[1] - o); });
      for (var j = pts.length - 1; j >= 0; j--) { var o2 = Math.sin(j / 5 * Math.PI) * (0.03 + dmg * 0.03); ctx.lineTo(pts[j][0], pts[j][1] + o2); }
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,28,8,0.85)'; ctx.lineWidth = 0.02 + dmg * 0.02;
      ctx.beginPath(); pts.forEach(function (p, j) { if (j) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke();
      // splinter whiskers at the ends
      ctx.strokeStyle = 'rgba(90,45,12,0.6)'; ctx.lineWidth = 0.012;
      for (var sp = 0; sp < 3; sp++) {
        var e = pts[sp % 2 ? 0 : 5], dir = sp % 2 ? -1 : 1;
        ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(e[0] + dir * (0.06 + hash(seed + sp) * 0.1), e[1] + (sp - 1) * 0.03); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Spiderweb fracture from an impact point: radial lines plus concentric rings.
  function glassCracks(ctx, w, h, dmg, seed) {
    var cx = (hash(seed * 1.3) - 0.5) * w * 0.5, cy = (hash(seed * 2.1) - 0.5) * h * 0.5;
    var spokes = dmg < 0.45 ? 4 : dmg < 0.7 ? 7 : 10, reach = Math.max(w, h) * (0.35 + dmg * 0.5);
    var ends = [];
    for (var i = 0; i < spokes; i++) {
      var a = i / spokes * TAU + hash(seed + i) * 0.6, len = reach * (0.55 + hash(seed + i * 4) * 0.45);
      ends.push([a, len]);
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // shattered panes catch light: a few facets tinted between spokes
    if (dmg > 0.55) {
      for (var f = 0; f < spokes; f += 2) {
        var a0 = ends[f][0], a1 = ends[(f + 1) % spokes][0], r0 = Math.min(ends[f][1], ends[(f + 1) % spokes][1]) * 0.55;
        ctx.fillStyle = f % 4 ? 'rgba(255,255,255,0.28)' : 'rgba(40,110,180,0.22)';
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0); ctx.lineTo(cx + Math.cos(a1) * r0, cy + Math.sin(a1) * r0); ctx.fill();
      }
    }
    for (var pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? 'rgba(25,80,140,0.8)' : 'rgba(255,255,255,0.9)';
      ctx.lineWidth = pass ? 0.016 : 0.04;
      ctx.beginPath();
      ends.forEach(function (e, k) {
        ctx.moveTo(cx, cy);
        var mx = cx + Math.cos(e[0] + 0.12) * e[1] * 0.5, my = cy + Math.sin(e[0] + 0.12) * e[1] * 0.5;
        ctx.lineTo(mx, my); ctx.lineTo(cx + Math.cos(e[0]) * e[1], cy + Math.sin(e[0]) * e[1]);
      });
      var rings = dmg < 0.5 ? 1 : 2;
      for (var r = 1; r <= rings; r++) {
        ends.forEach(function (e, k) {
          var nx = ends[(k + 1) % spokes], rad = reach * 0.22 * r * (0.85 + hash(seed + k + r) * 0.3);
          if (rad > e[1] || rad > nx[1]) return;
          ctx.moveTo(cx + Math.cos(e[0]) * rad, cy + Math.sin(e[0]) * rad);
          ctx.lineTo(cx + Math.cos(nx[0]) * rad * 0.92, cy + Math.sin(nx[0]) * rad * 0.92);
        });
      }
      ctx.stroke();
    }
    // bright impact star
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(cx, cy, 0.04 + dmg * 0.03, 0, TAU); ctx.fill();
  }

  // Textured face: the material pattern, then a light-from-above form shade on top.
  function texturedFace(ctx, mat, m, pathFn, y, h, rotate) {
    var pat = ART.texture ? ART.texture(ctx, mat, rotate) : null;
    ctx.fillStyle = pat || faceGradient(ctx, m, y, h);
    pathFn(); ctx.fill();
    var shade = ctx.createLinearGradient(0, y, 0, y + h);
    shade.addColorStop(0, 'rgba(255,255,255,0.32)');
    shade.addColorStop(0.3, 'rgba(255,255,255,0.04)');
    shade.addColorStop(0.75, 'rgba(0,0,0,0.06)');
    shade.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = shade;
    pathFn(); ctx.fill();
  }
  ART.texturedFace = texturedFace;

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
    texturedFace(ctx, mat, m, function () { rr(ctx, x + 0.035, y + 0.035, w - 0.07, h - 0.07, r * 0.85); }, y, h, mat === 'wood' && h > w);

    ctx.save();
    rr(ctx, x + 0.035, y + 0.035, w - 0.07, h - 0.07, r * 0.85); ctx.clip();
    if (mat === 'wood') {
      var long = w >= h;
      // end grain: growth rings on the short ends of long pieces
      if (Math.max(w, h) / Math.min(w, h) > 2.5) {
        ctx.strokeStyle = 'rgba(110,55,15,0.4)'; ctx.lineWidth = 0.022;
        var er = Math.min(w, h) * 0.32;
        [-1, 1].forEach(function (sd) {
          var ex = long ? sd * (w / 2 - er - 0.06) : 0, ey = long ? 0 : sd * (h / 2 - er - 0.06);
          for (var ring = 1; ring <= 3; ring++) { ctx.beginPath(); ctx.arc(ex, ey, er * ring / 3, 0, TAU); ctx.stroke(); }
        });
      }
      // board seams on wide pieces, so crates read as planks
      var thick = long ? h : w, boards = Math.round(thick / 0.34);
      if (thick > 0.55 && boards > 1) {
        for (var bd = 1; bd < boards; bd++) {
          var off = -thick / 2 + thick * bd / boards;
          ctx.strokeStyle = 'rgba(70,32,8,0.55)'; ctx.lineWidth = 0.03;
          ctx.beginPath(); if (long) { ctx.moveTo(x, off); ctx.lineTo(x + w, off); } else { ctx.moveTo(off, y); ctx.lineTo(off, y + h); } ctx.stroke();
          ctx.strokeStyle = 'rgba(255,230,180,0.35)'; ctx.lineWidth = 0.018;
          ctx.beginPath(); if (long) { ctx.moveTo(x, off + 0.025); ctx.lineTo(x + w, off + 0.025); } else { ctx.moveTo(off + 0.025, y); ctx.lineTo(off + 0.025, y + h); } ctx.stroke();
        }
      }
      // worn, slightly lighter edges and a few dents
      ctx.strokeStyle = 'rgba(255,236,200,0.22)'; ctx.lineWidth = 0.07;
      rr(ctx, x + 0.07, y + 0.07, w - 0.14, h - 0.14, r * 0.7); ctx.stroke();
      for (var dn = 0; dn < Math.max(2, w * h * 3); dn++) {
        var dx0 = x + 0.1 + hash(seed + dn * 3.7) * (w - 0.2), dy0 = y + 0.1 + hash(seed + dn * 6.1) * (h - 0.2);
        ctx.fillStyle = 'rgba(90,45,12,0.22)';
        ctx.beginPath(); ctx.ellipse(dx0, dy0, 0.05 + hash(dn) * 0.04, 0.018, long ? 0 : Math.PI / 2, 0, TAU); ctx.fill();
      }
    } else if (mat === 'stone') {
      // chiselled edges: little pale facets and dark pits along the rim
      for (var ce = 0; ce < (w + h) * 5; ce++) {
        var side = ce % 4, tt = hash(seed + ce * 2.3);
        var ex2 = side === 0 ? x + tt * w : side === 1 ? x + w - 0.06 : side === 2 ? x + tt * w : x + 0.06;
        var ey2 = side === 0 ? y + 0.06 : side === 1 ? y + tt * h : side === 2 ? y + h - 0.06 : y + tt * h;
        ctx.fillStyle = ce % 3 ? 'rgba(255,255,255,0.28)' : 'rgba(30,36,44,0.35)';
        ctx.beginPath(); ctx.moveTo(ex2 - 0.05, ey2); ctx.lineTo(ex2, ey2 - 0.04); ctx.lineTo(ex2 + 0.05, ey2 + 0.01); ctx.closePath(); ctx.fill();
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
      // thick glass: a darker refracting core and a bright fresnel rim
      var core = ctx.createLinearGradient(x, y, x + w, y + h);
      core.addColorStop(0, 'rgba(255,255,255,0.18)'); core.addColorStop(0.45, 'rgba(40,120,190,0.12)');
      core.addColorStop(0.55, 'rgba(20,90,160,0.2)'); core.addColorStop(1, 'rgba(255,255,255,0.12)');
      ctx.fillStyle = core; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.05;
      rr(ctx, x + 0.08, y + 0.08, w - 0.16, h - 0.16, r * 0.6); ctx.stroke();
      ctx.strokeStyle = 'rgba(30,100,170,0.25)'; ctx.lineWidth = 0.03;
      rr(ctx, x + 0.14, y + 0.14, w - 0.28, h - 0.28, r * 0.5); ctx.stroke();
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
    ctx.save();
    rr(ctx, x, y, w, h, r); ctx.clip();
    cracks(ctx, w, h, dmg, seed, 'rgba(40,46,55,0.7)', mat, h > w);
    ctx.restore();
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
    texturedFace(ctx, mat, m, function () { path(0.08); }, minY, maxY - minY, false);
    ctx.strokeStyle = m.bevelHi; ctx.lineWidth = 0.05; path(0.16); ctx.stroke();
    cracks(ctx, 0.8, 0.8, dmg, seed, 'rgba(40,46,55,0.7)', mat, false);
  };

  // Round boulder or log end.
  ART.drawRound = function (ctx, mat, r, dmg, seed) {
    var m = MAT[mat];
    ctx.fillStyle = m.edge;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    texturedFace(ctx, mat, m, function () { ctx.beginPath(); ctx.arc(0, 0, r * 0.92, 0, TAU); }, -r, r * 2, false);
    var rg2 = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.08, 0, 0, r);
    rg2.addColorStop(0, 'rgba(255,255,255,0.25)'); rg2.addColorStop(0.6, 'rgba(255,255,255,0)'); rg2.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = rg2;
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
    cracks(ctx, r * 1.6, r * 1.6, dmg, seed, 'rgba(40,46,55,0.7)', mat, false);
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
  var shadowSprite = null;
  ART.drawShadow = function (ctx, x, halfW, height, night) {
    var a = Math.max(0, 0.32 - height * 0.05) * (night ? 0.7 : 1);
    if (a <= 0.01) return;
    if (!shadowSprite) {
      shadowSprite = document.createElement('canvas');
      shadowSprite.width = shadowSprite.height = 64;
      var sc = shadowSprite.getContext('2d'), g = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      sc.fillStyle = g; sc.fillRect(0, 0, 64, 64);
    }
    var rw = halfW * 1.3;
    ctx.globalAlpha = a;
    ctx.drawImage(shadowSprite, x - rw, -rw * 0.22 + 0.02, rw * 2, rw * 0.44);
    ctx.globalAlpha = 1;
  };
})();

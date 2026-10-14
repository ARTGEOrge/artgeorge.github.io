/* Zombie Survivors: detail layer.
 * Loaded after the game script on index.html and playtest.html. It only replaces the
 * draw* functions (plus the level-up cards and banner) with richer versions; game rules,
 * stats, spawning, input and saves are untouched. Everything is procedural (no assets).
 * Extra per-object fields it writes are cosmetic and prefixed with "_" (e.g. z._t, z._php).
 */
(function () {
  "use strict";
  if (typeof ctx === "undefined" || typeof C === "undefined") return;

  var TAU = Math.PI * 2;
  var VW = C.vw, VH = C.vh;
  var PINNED = !!window.ZS_PIN_PLAYER;   // playtest page keeps the player pinned to screen centre

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function mk(w, h) { var c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rrect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function now() { return performance.now(); }

  // ============================================================ CSS polish
  var css = document.createElement("style");
  css.textContent = [
    "body{background:radial-gradient(ellipse at 50% 30%,#1d1430 0%,#0b0912 55%,#050508 100%)!important}",
    "h1{background:linear-gradient(180deg,#d7ccff 0%,#8f74ff 45%,#5a2fe0 100%);-webkit-background-clip:text;background-clip:text;color:transparent!important;",
    "  letter-spacing:2px;text-transform:uppercase;font-weight:900;filter:drop-shadow(0 2px 0 #1a0f3a) drop-shadow(0 0 18px rgba(109,74,255,.55))}",
    ".ui-bar{background:linear-gradient(180deg,rgba(30,24,52,.92),rgba(12,10,22,.92))!important;border:1px solid rgba(140,115,255,.55)!important;",
    "  box-shadow:0 6px 24px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.08);border-radius:12px!important;gap:8px!important;padding:6px 10px!important}",
    ".ui-bar span{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:3px 9px;color:#cfc8e8}",
    ".ui-bar b{color:#fff}",
    "canvas#cv{border:2px solid #4b3a8f!important;border-radius:12px!important;box-shadow:0 0 0 1px #000,0 0 40px rgba(109,74,255,.35),0 20px 50px rgba(0,0,0,.6)!important;background:#0c0d0c!important}",
    ".controls-info,.eqbar{background:linear-gradient(180deg,rgba(30,24,52,.9),rgba(10,9,18,.9))!important;border:1px solid rgba(140,115,255,.5)!important;border-radius:12px!important;box-shadow:0 8px 24px rgba(0,0,0,.45)}",
    ".slot{background:linear-gradient(180deg,#2f2a4f,#1f1b36)!important;border:1px solid rgba(160,140,255,.25);border-radius:6px!important}",
    "#mini{border-radius:12px;box-shadow:0 0 0 1px rgba(140,115,255,.6),0 0 24px rgba(109,74,255,.35)}",
    ".mute-btn{border-radius:10px!important;background:linear-gradient(180deg,#221c3a,#120f20)!important}",
    // level-up modal + cards
    ".wmodal{background:radial-gradient(ellipse at 50% 40%,rgba(40,22,80,.88),rgba(0,0,0,.94))!important;backdrop-filter:blur(3px)}",
    ".wmodal h2{font-weight:900!important;letter-spacing:3px;text-transform:uppercase;background:linear-gradient(180deg,#fff2a8,#ffb020 55%,#ff6a00);-webkit-background-clip:text;background-clip:text;color:transparent!important;",
    "  filter:drop-shadow(0 3px 0 #3a1700) drop-shadow(0 0 20px rgba(255,160,0,.45));animation:zsTitle .6s cubic-bezier(.2,1.6,.4,1)}",
    "@keyframes zsTitle{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}",
    "@keyframes zsCardIn{from{transform:translateY(40px) rotateX(35deg) scale(.85);opacity:0}to{transform:none;opacity:1}}",
    "@keyframes zsShine{0%{transform:translateX(-160%) skewX(-20deg)}60%,100%{transform:translateX(260%) skewX(-20deg)}}",
    "@keyframes zsPulse{0%,100%{box-shadow:0 0 18px var(--rc),inset 0 0 18px rgba(255,255,255,.04)}50%{box-shadow:0 0 34px var(--rc),inset 0 0 26px rgba(255,255,255,.08)}}",
    "#wopts{perspective:900px}",
    ".wcard{position:relative;overflow:hidden;width:232px!important;padding:0!important;margin:12px!important;vertical-align:top;text-align:center;",
    "  border:2px solid var(--rc)!important;border-radius:16px!important;background:linear-gradient(180deg,#221d38 0%,#141122 70%,#0d0b16 100%)!important;",
    "  box-shadow:0 0 18px color-mix(in srgb,var(--rc) 45%,transparent),0 14px 30px rgba(0,0,0,.55)!important;animation:zsCardIn .45s cubic-bezier(.2,1.3,.4,1) both;transition:transform .18s,box-shadow .18s!important}",
    ".wcard:hover{transform:translateY(-8px) scale(1.03)!important}",
    ".wcard.selected{background:linear-gradient(180deg,#1d3a26 0%,#10241a 70%,#0a160f 100%)!important;transform:translateY(-10px) scale(1.05)!important;animation:zsPulse 1.2s ease-in-out infinite!important;--rc:#3dff7a}",
    ".wcard::after{content:'';position:absolute;top:0;left:0;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent);animation:zsShine 3.2s ease-in-out infinite;pointer-events:none}",
    ".wc-head{height:8px;background:linear-gradient(90deg,transparent,var(--rc),transparent)}",
    ".wc-medal{width:84px;height:84px;margin:16px auto 8px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:44px;",
    "  background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.25),rgba(255,255,255,.02) 55%),radial-gradient(circle,color-mix(in srgb,var(--rc) 55%,#000) 0%,#0c0a14 75%);",
    "  border:2px solid var(--rc);box-shadow:0 0 22px color-mix(in srgb,var(--rc) 60%,transparent),inset 0 -6px 14px rgba(0,0,0,.5)}",
    ".wc-body{padding:0 16px 14px}",
    ".wcard .wname{font-size:20px!important;font-weight:900!important;letter-spacing:.5px;text-shadow:0 2px 0 #000;margin-bottom:6px!important}",
    ".wcard .wrar{font-weight:800;letter-spacing:1px;text-transform:uppercase;font-size:10px!important;color:#fff;box-shadow:0 0 10px color-mix(in srgb,var(--rc) 60%,transparent)}",
    ".wc-tag{display:inline-block;margin-left:6px;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:800;color:#111;background:#ffd84a;letter-spacing:1px}",
    ".wc-stats{margin-top:12px;text-align:left}",
    ".wc-row{display:flex;align-items:center;gap:8px;margin:5px 0;font:700 10px/1 Arial,sans-serif;color:#a9a3c4;letter-spacing:1px}",
    ".wc-row span:first-child{width:42px}",
    ".wc-bar{flex:1;height:7px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.6)}",
    ".wc-bar i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,color-mix(in srgb,var(--rc) 60%,#fff),var(--rc))}",
    ".wc-row b{width:38px;text-align:right;color:#fff;font-size:10px}",
    ".wcard .wdesc{color:#bdb6da!important;font-style:normal!important;font-size:12px!important;margin-top:10px!important}",
    ".wc-special{margin-top:8px;font:800 10px Arial;letter-spacing:1.5px;color:var(--rc);text-transform:uppercase}",
    ".action-btn{border-radius:12px!important;border-width:2px!important;box-shadow:0 6px 16px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.12);letter-spacing:1px;text-transform:uppercase}",
    ".action-btn:hover{transform:translateY(-2px)}",
    ".confirm-btn{background:linear-gradient(180deg,#36a868,#1f6e43)!important}",
    ".reroll-btn{background:linear-gradient(180deg,#2a2350,#17132c)!important}",
    ".skip-btn{background:linear-gradient(180deg,#5c2222,#341212)!important}",
    ".zs-banner{position:fixed;top:42%;left:50%;transform:translate(-50%,-50%);z-index:900;text-align:center;pointer-events:none;animation:zsBan 3s ease forwards}",
    ".zs-banner .big{font:900 54px/1 Impact,'Arial Black',sans-serif;letter-spacing:4px;color:#fff;-webkit-text-stroke:2px #1a0c3a;",
    "  text-shadow:0 4px 0 #1a0c3a,0 0 30px rgba(140,110,255,.9),0 0 60px rgba(109,74,255,.6)}",
    ".zs-banner .small{margin-top:10px;display:inline-block;font:800 16px Arial;letter-spacing:2px;color:#e6defe;padding:6px 18px;border-radius:20px;",
    "  background:linear-gradient(90deg,transparent,rgba(109,74,255,.65),transparent)}",
    ".zs-banner.boss .big{color:#ff4a6a;text-shadow:0 4px 0 #3a0010,0 0 30px rgba(255,40,80,.9),0 0 70px rgba(255,0,60,.6)}",
    ".zs-banner.boss .small{background:linear-gradient(90deg,transparent,rgba(200,0,50,.7),transparent)}",
    "@keyframes zsBan{0%{opacity:0;transform:translate(-50%,-50%) scale(2.2)}10%{opacity:1;transform:translate(-50%,-50%) scale(.95)}16%{transform:translate(-50%,-50%) scale(1)}",
    "  80%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-62%) scale(1.04)}}"
  ].join("\n");
  document.head.appendChild(css);

  // ============================================================ GROUND (baked tiles)
  var TILE = 512;
  var gr = mulberry(1337);
  function grr(a, b) { return a + gr() * (b - a); }

  // Tileable base texture (dirt / cracked tarmac mix)
  var BASE = 256, baseTex = mk(BASE, BASE);
  (function () {
    var c = baseTex.getContext("2d"), r = mulberry(99);
    c.fillStyle = "#262923"; c.fillRect(0, 0, BASE, BASE);
    function wrapBlob(x, y, rad, col) {
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
        var g = c.createRadialGradient(x + ox * BASE, y + oy * BASE, 0, x + ox * BASE, y + oy * BASE, rad);
        g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g; c.fillRect(x + ox * BASE - rad, y + oy * BASE - rad, rad * 2, rad * 2);
      }
    }
    var cols = ["rgba(70,62,44,0.35)", "rgba(40,52,34,0.35)", "rgba(20,22,20,0.4)", "rgba(80,74,60,0.2)", "rgba(48,40,30,0.35)"];
    for (var i = 0; i < 46; i++) wrapBlob(r() * BASE, r() * BASE, 18 + r() * 60, cols[(r() * cols.length) | 0]);
    for (i = 0; i < 2600; i++) {
      var v = r();
      c.fillStyle = v < 0.5 ? "rgba(0,0,0," + (0.1 + r() * 0.25) + ")" : "rgba(160,150,120," + (0.05 + r() * 0.12) + ")";
      c.fillRect(r() * BASE, r() * BASE, 1 + (r() < 0.2 ? 1 : 0), 1);
    }
    // pebbles
    for (i = 0; i < 70; i++) {
      var x = r() * BASE, y = r() * BASE, s = 1 + r() * 2.2;
      c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(x + 0.8, y + 0.8, s, s * 0.8, 0, 0, TAU); c.fill();
      c.fillStyle = "rgba(" + (110 + r() * 50 | 0) + "," + (100 + r() * 40 | 0) + "," + (80 + r() * 30 | 0) + ",0.8)";
      c.beginPath(); c.ellipse(x, y, s, s * 0.8, 0, 0, TAU); c.fill();
    }
  })();
  var basePat = null;

  // World features (seeded so the map is the same every run)
  var ROADS_H = [{ y: 860, w: 150 }, { y: 2160, w: 150 }];
  var ROADS_V = [{ x: 960, w: 150 }, { x: 2240, w: 150 }];
  var feats = [];   // {k,x,y,r,rot,s,...}
  var lights = [];  // streetlights for dynamic light pools
  function onRoad(x, y, pad) {
    pad = pad || 0;
    for (var i = 0; i < ROADS_H.length; i++) if (Math.abs(y - ROADS_H[i].y) < ROADS_H[i].w / 2 + pad) return true;
    for (i = 0; i < ROADS_V.length; i++) if (Math.abs(x - ROADS_V[i].x) < ROADS_V[i].w / 2 + pad) return true;
    return false;
  }
  function addF(o) { o.s = (gr() * 1e9) | 0; feats.push(o); return o; }
  (function genWorld() {
    var W = C.worldW, H = C.worldH, i, x, y;
    for (i = 0; i < 70; i++) addF({ k: "grass", L: 0, x: grr(0, W), y: grr(0, H), r: grr(40, 110) });
    for (i = 0; i < 40; i++) addF({ k: "dirt", L: 0, x: grr(0, W), y: grr(0, H), r: grr(40, 90) });
    for (i = 0; i < 26; i++) { x = grr(0, W); y = grr(0, H); addF({ k: "puddle", L: 2, x: x, y: y, r: grr(20, 46), rot: grr(0, 3) }); }
    for (i = 0; i < 90; i++) addF({ k: "crack", L: 2, x: grr(0, W), y: grr(0, H), r: grr(20, 60), rot: grr(0, TAU) });
    for (i = 0; i < 34; i++) addF({ k: "stain", L: 2, x: grr(0, W), y: grr(0, H), r: grr(12, 34) });
    for (i = 0; i < 160; i++) addF({ k: gr() < 0.5 ? "paper" : gr() < 0.5 ? "brick" : "bones", L: 3, x: grr(0, W), y: grr(0, H), r: 10, rot: grr(0, TAU) });
    // road furniture
    ROADS_H.forEach(function (rd) {
      for (x = 80; x < W; x += grr(280, 520)) addF({ k: "manhole", L: 2, x: x, y: rd.y + grr(-30, 30), r: 14 });
      for (x = 140; x < W; x += grr(380, 700)) {
        var side = gr() < 0.5 ? -1 : 1;
        addF({ k: "car", L: 4, x: x, y: rd.y + side * grr(20, 45), r: 60, rot: grr(-0.25, 0.25) + (gr() < 0.5 ? 0 : Math.PI), col: ["#7a2b26", "#2c4f73", "#5c6168", "#6b6a3a", "#33553f", "#8a8378"][(gr() * 6) | 0] });
      }
      for (x = 200; x < W; x += 420) { var l = addF({ k: "lamp", L: 5, x: x + grr(-30, 30), y: rd.y + (gr() < 0.5 ? -1 : 1) * (rd.w / 2 + 14), r: 30 }); lights.push(l); }
      for (x = 60; x < W; x += grr(160, 360)) addF({ k: "cone", L: 4, x: x, y: rd.y + grr(-60, 60), r: 9 });
    });
    ROADS_V.forEach(function (rd) {
      for (y = 80; y < H; y += grr(280, 520)) if (!onRoad(rd.x, y, 60) || true) addF({ k: "manhole", L: 2, x: rd.x + grr(-30, 30), y: y, r: 14 });
      for (y = 180; y < H; y += grr(400, 720)) {
        if (onRoad(-999, y, 90)) continue;
        addF({ k: "car", L: 4, x: rd.x + (gr() < 0.5 ? -1 : 1) * grr(20, 45), y: y, r: 60, rot: Math.PI / 2 + grr(-0.25, 0.25) + (gr() < 0.5 ? 0 : Math.PI), col: ["#7a2b26", "#2c4f73", "#5c6168", "#6b6a3a", "#33553f", "#8a8378"][(gr() * 6) | 0] });
      }
      for (y = 300; y < H; y += 420) { if (onRoad(-999, y, 100)) continue; var l2 = addF({ k: "lamp", L: 5, x: rd.x + (gr() < 0.5 ? -1 : 1) * (rd.w / 2 + 14), y: y, r: 30 }); lights.push(l2); }
    });
    // graveyard (north-east)
    var gx0 = 2420, gy0 = 260, gx1 = 2900, gy1 = 700;
    addF({ k: "fence", L: 4, x: (gx0 + gx1) / 2, y: (gy0 + gy1) / 2, r: 300, x0: gx0, y0: gy0, x1: gx1, y1: gy1 });
    for (x = gx0 + 50; x < gx1 - 30; x += 70) for (y = gy0 + 60; y < gy1 - 30; y += 80) if (gr() < 0.85) addF({ k: "grave", L: 4, x: x + grr(-8, 8), y: y + grr(-6, 6), r: 26, rot: grr(-0.15, 0.15) });
    // scatter props off-road
    var kinds = [["barrel", 46], ["crate", 30], ["tree", 34], ["sand", 14], ["tire", 20], ["toxic", 10]];
    kinds.forEach(function (kd) {
      for (var n = 0; n < kd[1]; n++) {
        for (var tries = 0; tries < 8; tries++) {
          x = grr(40, W - 40); y = grr(40, H - 40);
          if (!onRoad(x, y, 20) && Math.hypot(x - W / 2, y - H / 2) > 160) break;
        }
        addF({ k: kd[0], L: kd[0] === "tree" ? 6 : 4, x: x, y: y, r: kd[0] === "tree" ? 70 : kd[0] === "sand" ? 50 : 22, rot: grr(0, TAU) });
      }
    });
    feats.sort(function (a, b) { return a.L - b.L; });
  })();

  function drawRoads(c) {
    var W = C.worldW, H = C.worldH;
    function asphalt(x, y, w, h) {
      c.fillStyle = "#3d3c38"; c.fillRect(x - 16, y - 16, w + 32, h + 32);   // sidewalk
      c.fillStyle = "#2a2b2d"; c.fillRect(x, y, w, h);
      c.fillStyle = "#56544e"; // curbs
      if (w > h) { c.fillRect(x, y - 3, w, 3); c.fillRect(x, y + h, w, 3); }
      else { c.fillRect(x - 3, y, 3, h); c.fillRect(x + w, y, 3, h); }
    }
    ROADS_H.forEach(function (r) { asphalt(0, r.y - r.w / 2, W, r.w); });
    ROADS_V.forEach(function (r) { asphalt(r.x - r.w / 2, 0, r.w, H); });
    // sidewalk joints
    c.strokeStyle = "rgba(0,0,0,0.35)"; c.lineWidth = 1;
    ROADS_H.forEach(function (r) {
      for (var x = 0; x < W; x += 32) { c.beginPath(); c.moveTo(x, r.y - r.w / 2 - 16); c.lineTo(x, r.y - r.w / 2 - 3); c.moveTo(x + 16, r.y + r.w / 2 + 3); c.lineTo(x + 16, r.y + r.w / 2 + 16); c.stroke(); }
    });
    ROADS_V.forEach(function (r) {
      for (var y = 0; y < H; y += 32) { c.beginPath(); c.moveTo(r.x - r.w / 2 - 16, y); c.lineTo(r.x - r.w / 2 - 3, y); c.moveTo(r.x + r.w / 2 + 3, y + 16); c.lineTo(r.x + r.w / 2 + 16, y + 16); c.stroke(); }
    });
    // centre dashes (worn)
    var rr = mulberry(7);
    c.fillStyle = "rgba(214,178,52,0.75)";
    ROADS_H.forEach(function (r) { for (var x = 10; x < W; x += 60) if (!onRoadV(x)) { c.globalAlpha = 0.35 + rr() * 0.6; c.fillRect(x, r.y - 2, 32, 4); } });
    ROADS_V.forEach(function (r) { for (var y = 10; y < H; y += 60) if (!onRoadHy(y)) { c.globalAlpha = 0.35 + rr() * 0.6; c.fillRect(r.x - 2, y, 4, 32); } });
    c.globalAlpha = 1;
    // crosswalks at intersections
    c.fillStyle = "rgba(220,220,210,0.55)";
    ROADS_H.forEach(function (h) {
      ROADS_V.forEach(function (v) {
        for (var i = -60; i <= 60; i += 20) {
          c.fillRect(v.x + i - 5, h.y - h.w / 2 - 34, 10, 26); c.fillRect(v.x + i - 5, h.y + h.w / 2 + 8, 10, 26);
          c.fillRect(v.x - v.w / 2 - 34, h.y + i - 5, 26, 10); c.fillRect(v.x + v.w / 2 + 8, h.y + i - 5, 26, 10);
        }
      });
    });
  }
  function onRoadV(x) { for (var i = 0; i < ROADS_V.length; i++) if (Math.abs(x + 16 - ROADS_V[i].x) < ROADS_V[i].w / 2 + 24) return true; return false; }
  function onRoadHy(y) { for (var i = 0; i < ROADS_H.length; i++) if (Math.abs(y + 16 - ROADS_H[i].y) < ROADS_H[i].w / 2 + 24) return true; return false; }

  function drawFeat(c, f) {
    var r = mulberry(f.s), i, a;
    c.save(); c.translate(f.x, f.y);
    switch (f.k) {
      case "grass": {
        var g = c.createRadialGradient(0, 0, 0, 0, 0, f.r);
        g.addColorStop(0, "rgba(46,66,32,0.75)"); g.addColorStop(0.7, "rgba(40,58,30,0.45)"); g.addColorStop(1, "rgba(40,58,30,0)");
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, f.r, 0, TAU); c.fill();
        c.lineWidth = 1.2; c.lineCap = "round";
        for (i = 0; i < f.r * 1.4; i++) {
          a = r() * TAU; var d = Math.sqrt(r()) * f.r * 0.85, x = Math.cos(a) * d, y = Math.sin(a) * d;
          c.strokeStyle = r() < 0.5 ? "rgba(92,122,52,0.8)" : "rgba(62,90,40,0.85)";
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 5, y - 3 - r() * 5); c.stroke();
        }
        break;
      }
      case "dirt": {
        var g2 = c.createRadialGradient(0, 0, 0, 0, 0, f.r);
        g2.addColorStop(0, "rgba(88,70,46,0.6)"); g2.addColorStop(1, "rgba(88,70,46,0)");
        c.fillStyle = g2; c.beginPath(); c.arc(0, 0, f.r, 0, TAU); c.fill();
        for (i = 0; i < 20; i++) { c.fillStyle = "rgba(30,22,14,0.35)"; c.beginPath(); c.arc((r() - 0.5) * f.r, (r() - 0.5) * f.r, 1 + r() * 3, 0, TAU); c.fill(); }
        break;
      }
      case "puddle": {
        c.rotate(f.rot); c.scale(1, 0.6);
        c.fillStyle = "rgba(10,14,22,0.75)"; c.beginPath();
        for (i = 0; i <= 14; i++) { a = i / 14 * TAU; var rad = f.r * (0.75 + r() * 0.3); c[i ? "lineTo" : "moveTo"](Math.cos(a) * rad, Math.sin(a) * rad); }
        c.closePath(); c.fill();
        c.strokeStyle = "rgba(120,140,170,0.25)"; c.lineWidth = 2; c.stroke();
        c.fillStyle = "rgba(150,170,210,0.18)"; c.beginPath(); c.ellipse(-f.r * 0.25, -f.r * 0.2, f.r * 0.4, f.r * 0.12, -0.3, 0, TAU); c.fill();
        break;
      }
      case "crack": {
        c.rotate(f.rot); c.strokeStyle = "rgba(0,0,0,0.55)"; c.lineWidth = 1.4;
        var x0 = -f.r, y0 = 0; c.beginPath(); c.moveTo(x0, y0);
        for (i = 1; i <= 8; i++) { x0 = -f.r + i * f.r / 4; y0 += (r() - 0.5) * 10; c.lineTo(x0, y0); if (r() < 0.3) { c.moveTo(x0, y0); c.lineTo(x0 + 8, y0 + (r() - 0.5) * 18); c.moveTo(x0, y0); } }
        c.stroke(); c.strokeStyle = "rgba(255,255,255,0.05)"; c.translate(1, 1); c.stroke();
        break;
      }
      case "stain": {
        c.fillStyle = "rgba(60,8,8,0.35)";
        for (i = 0; i < 6; i++) { c.beginPath(); c.arc((r() - 0.5) * f.r, (r() - 0.5) * f.r, f.r * (0.2 + r() * 0.4), 0, TAU); c.fill(); }
        break;
      }
      case "paper": c.rotate(f.rot); c.fillStyle = "rgba(200,196,180,0.55)"; c.fillRect(-5, -4, 10, 8); c.fillStyle = "rgba(60,60,60,0.4)"; c.fillRect(-3, -2, 6, 1); c.fillRect(-3, 0, 5, 1); break;
      case "brick": c.rotate(f.rot); c.fillStyle = "rgba(0,0,0,0.4)"; c.fillRect(-5, -2, 12, 7); c.fillStyle = "#7a3a2a"; c.fillRect(-6, -3, 12, 6); c.fillStyle = "rgba(255,255,255,0.12)"; c.fillRect(-6, -3, 12, 1.5); break;
      case "bones": {
        c.rotate(f.rot); c.strokeStyle = "#cfc8b2"; c.lineCap = "round"; c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.stroke();
        c.fillStyle = "#cfc8b2"; [[-7, -1.6], [-7, 1.6], [7, -1.6], [7, 1.6]].forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], 1.8, 0, TAU); c.fill(); });
        if (r() < 0.35) { c.beginPath(); c.arc(10, 6, 5, 0, TAU); c.fill(); c.fillStyle = "#222"; c.beginPath(); c.arc(8.5, 5.5, 1.3, 0, TAU); c.arc(11.5, 5.5, 1.3, 0, TAU); c.fill(); }
        break;
      }
      case "manhole": {
        c.fillStyle = "rgba(0,0,0,0.5)"; c.beginPath(); c.arc(1, 1, 14, 0, TAU); c.fill();
        c.fillStyle = "#3b3a37"; c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fill();
        c.strokeStyle = "#24231f"; c.lineWidth = 1.5; c.stroke();
        c.save(); c.beginPath(); c.arc(0, 0, 11, 0, TAU); c.clip();
        c.strokeStyle = "rgba(0,0,0,0.45)"; c.lineWidth = 1;
        for (i = -12; i <= 12; i += 4) { c.beginPath(); c.moveTo(i, -12); c.lineTo(i, 12); c.moveTo(-12, i); c.lineTo(12, i); c.stroke(); }
        c.restore();
        break;
      }
      case "car": drawCar(c, f, r); break;
      case "lamp": {
        c.fillStyle = "rgba(0,0,0,0.45)"; c.beginPath(); c.ellipse(5, 6, 9, 7, 0, 0, TAU); c.fill();
        c.fillStyle = "#4a4d52"; c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill();
        c.fillStyle = "#6c7077"; c.beginPath(); c.arc(-1.5, -1.5, 4, 0, TAU); c.fill();
        break;
      }
      case "cone": {
        c.fillStyle = "rgba(0,0,0,0.4)"; c.fillRect(-6, -4, 15, 13);
        c.fillStyle = "#1e1e1e"; c.fillRect(-8, -8, 16, 16);
        c.fillStyle = "#ff7a1a"; c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill();
        c.strokeStyle = "#f2f2f2"; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 4.2, 0, TAU); c.stroke();
        c.fillStyle = "#ffb070"; c.beginPath(); c.arc(-1, -1, 1.6, 0, TAU); c.fill();
        break;
      }
      case "fence": {
        c.translate(-f.x, -f.y);
        c.fillStyle = "rgba(36,44,30,0.55)"; c.fillRect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
        c.strokeStyle = "rgba(0,0,0,0.5)"; c.lineWidth = 5; c.strokeRect(f.x0 + 3, f.y0 + 4, f.x1 - f.x0, f.y1 - f.y0);
        c.strokeStyle = "#2a2b30"; c.lineWidth = 3; c.strokeRect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
        c.fillStyle = "#3c3e46";
        for (var px = f.x0; px <= f.x1; px += 24) { c.fillRect(px - 2, f.y0 - 2, 4, 4); c.fillRect(px - 2, f.y1 - 2, 4, 4); }
        for (var py = f.y0; py <= f.y1; py += 24) { c.fillRect(f.x0 - 2, py - 2, 4, 4); c.fillRect(f.x1 - 2, py - 2, 4, 4); }
        // gate gap
        c.fillStyle = "#3a3a36"; c.fillRect((f.x0 + f.x1) / 2 - 22, f.y1 - 3, 44, 6);
        break;
      }
      case "grave": {
        c.rotate(f.rot);
        c.fillStyle = "rgba(60,45,30,0.7)"; c.beginPath(); c.ellipse(0, 18, 14, 22, 0, 0, TAU); c.fill();   // mound
        c.fillStyle = "rgba(0,0,0,0.5)"; rrect(c, -10, -11, 24, 18, 4); c.fill();
        var sg = c.createLinearGradient(-12, -16, 12, 4); sg.addColorStop(0, "#9a9a92"); sg.addColorStop(1, "#5a5b56");
        c.fillStyle = sg; c.beginPath(); c.moveTo(-12, 2); c.lineTo(-12, -8); c.arc(0, -8, 12, Math.PI, 0); c.lineTo(12, 2); c.closePath(); c.fill();
        c.strokeStyle = "#3a3b37"; c.lineWidth = 1; c.stroke();
        c.fillStyle = "#3e3f3a"; c.font = "bold 7px Arial"; c.textAlign = "center"; c.fillText("RIP", 0, -6);
        c.fillStyle = "rgba(70,110,50,0.6)"; c.beginPath(); c.arc(-8, 0, 3, 0, TAU); c.arc(9, -2, 2, 0, TAU); c.fill();
        break;
      }
      case "barrel": case "toxic": {
        var tox = f.k === "toxic";
        if (tox) { c.fillStyle = "rgba(90,255,60,0.18)"; c.beginPath(); c.ellipse(10, 12, 24, 14, 0.3, 0, TAU); c.fill(); }
        c.fillStyle = "rgba(0,0,0,0.45)"; c.beginPath(); c.arc(5, 6, 14, 0, TAU); c.fill();
        var bc = tox ? "#c7a417" : ["#7a2f22", "#2f5170", "#4a5a3a"][(r() * 3) | 0];
        var bgd = c.createRadialGradient(-4, -4, 2, 0, 0, 14); bgd.addColorStop(0, "#fff"); bgd.addColorStop(0.08, bc); bgd.addColorStop(1, "#111");
        c.fillStyle = bgd; c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fill();
        c.strokeStyle = "rgba(0,0,0,0.6)"; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.stroke();
        if (tox) {
          c.fillStyle = "#6dff3a"; c.beginPath(); c.arc(0, 0, 7.5, 0, TAU); c.fill();
          c.fillStyle = "rgba(255,255,255,0.6)"; c.beginPath(); c.arc(-2, -2, 2, 0, TAU); c.fill();
        } else { c.fillStyle = "#222"; c.beginPath(); c.arc(4, -3, 2, 0, TAU); c.fill(); }
        break;
      }
      case "crate": {
        c.rotate(f.rot);
        c.fillStyle = "rgba(0,0,0,0.45)"; c.fillRect(-11, -9, 30, 30);
        c.fillStyle = "#7a5a32"; c.fillRect(-15, -15, 30, 30);
        c.fillStyle = "#94703f"; for (i = -15; i < 15; i += 7.5) c.fillRect(-15, i + 1, 30, 5.5);
        c.strokeStyle = "#4a3418"; c.lineWidth = 3; c.strokeRect(-15, -15, 30, 30);
        c.beginPath(); c.moveTo(-14, -14); c.lineTo(14, 14); c.stroke();
        c.fillStyle = "#2b2b2b"; [[-13, -13], [13, -13], [-13, 13], [13, 13]].forEach(function (p) { c.fillRect(p[0] - 1, p[1] - 1, 2, 2); });
        break;
      }
      case "sand": {
        c.rotate(f.rot);
        for (i = -2; i <= 2; i++) {
          c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(i * 17 + 4, 5, 10, 8, 0, 0, TAU); c.fill();
          var sb = c.createLinearGradient(0, -8, 0, 8); sb.addColorStop(0, "#c9b583"); sb.addColorStop(1, "#7f6d45");
          c.fillStyle = sb; c.beginPath(); c.ellipse(i * 17, 0, 10, 8, 0, 0, TAU); c.fill();
          c.strokeStyle = "rgba(60,48,24,0.6)"; c.lineWidth = 1; c.stroke();
          c.beginPath(); c.moveTo(i * 17 - 6, 0); c.lineTo(i * 17 + 6, 0); c.stroke();
        }
        break;
      }
      case "tire": {
        c.fillStyle = "rgba(0,0,0,0.4)"; c.beginPath(); c.arc(3, 4, 12, 0, TAU); c.fill();
        c.strokeStyle = "#151515"; c.lineWidth = 7; c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.stroke();
        c.strokeStyle = "#2c2c2c"; c.lineWidth = 1; c.setLineDash([2, 2]); c.beginPath(); c.arc(0, 0, 11.5, 0, TAU); c.stroke(); c.setLineDash([]);
        break;
      }
      case "tree": {
        c.fillStyle = "rgba(0,0,0,0.38)"; c.beginPath(); c.ellipse(16, 20, 46, 34, 0.4, 0, TAU); c.fill();
        function branch(len, ang, w, depth) {
          var ex = Math.cos(ang) * len, ey = Math.sin(ang) * len;
          c.lineWidth = w; c.beginPath(); c.moveTo(0, 0); c.lineTo(ex, ey); c.stroke();
          if (depth <= 0) return;
          c.save(); c.translate(ex, ey);
          branch(len * 0.68, ang - 0.5 + r() * 0.3, w * 0.62, depth - 1);
          branch(len * 0.62, ang + 0.4 + r() * 0.3, w * 0.6, depth - 1);
          c.restore();
        }
        c.lineCap = "round"; c.strokeStyle = "#2e2219";
        var nb = 5 + ((r() * 3) | 0);
        for (i = 0; i < nb; i++) branch(22 + r() * 16, i / nb * TAU + r() * 0.5, 6, 3);
        c.strokeStyle = "rgba(120,96,70,0.4)";
        for (i = 0; i < nb; i++) { c.save(); c.translate(-1, -1); branch(14 + r() * 10, i / nb * TAU + 0.2, 2, 1); c.restore(); }
        var tg = c.createRadialGradient(-3, -3, 1, 0, 0, 11); tg.addColorStop(0, "#6a5038"); tg.addColorStop(1, "#2a1d12");
        c.fillStyle = tg; c.beginPath(); c.arc(0, 0, 10, 0, TAU); c.fill();
        break;
      }
    }
    c.restore();
  }

  function drawCar(c, f, r) {
    c.rotate(f.rot);
    var L = 92, Wd = 44;
    c.fillStyle = "rgba(0,0,0,0.5)"; rrect(c, -L / 2 + 6, -Wd / 2 + 8, L, Wd, 12); c.fill();
    c.fillStyle = "#111"; [[-30, -24], [22, -24], [-30, 18], [22, 18]].forEach(function (p) { c.fillRect(p[0], p[1], 14, 6); });
    var bg = c.createLinearGradient(0, -Wd / 2, 0, Wd / 2); bg.addColorStop(0, f.col); bg.addColorStop(0.5, f.col); bg.addColorStop(1, "#0d0d0d");
    c.fillStyle = bg; rrect(c, -L / 2, -Wd / 2, L, Wd, 11); c.fill();
    c.strokeStyle = "rgba(0,0,0,0.6)"; c.lineWidth = 1.5; c.stroke();
    // hood / trunk creases
    c.strokeStyle = "rgba(255,255,255,0.12)"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(L / 2 - 8, -Wd / 2 + 6); c.lineTo(L / 2 - 8, Wd / 2 - 6); c.moveTo(-L / 2 + 8, -Wd / 2 + 6); c.lineTo(-L / 2 + 8, Wd / 2 - 6); c.stroke();
    // cabin + glass
    c.fillStyle = "rgba(0,0,0,0.35)"; rrect(c, -22, -17, 46, 34, 7); c.fill();
    var gg = c.createLinearGradient(14, 0, 30, 0); gg.addColorStop(0, "#1c2a38"); gg.addColorStop(1, "#4d6a85");
    c.fillStyle = gg; rrect(c, 12, -16, 14, 32, 4); c.fill();                      // windscreen
    c.fillStyle = "#1a2632"; rrect(c, -24, -15, 9, 30, 3); c.fill();                 // rear window
    c.fillStyle = adjust(f.col, 18); rrect(c, -14, -15, 26, 30, 4); c.fill();          // roof
    c.fillStyle = "rgba(255,255,255,0.1)"; c.fillRect(-12, -13, 22, 4);
    // cracked glass
    c.strokeStyle = "rgba(220,235,255,0.55)"; c.lineWidth = 0.7; c.beginPath();
    var cx0 = 19, cy0 = (r() - 0.5) * 18;
    for (var i = 0; i < 6; i++) { var a = r() * TAU; c.moveTo(cx0, cy0); c.lineTo(cx0 + Math.cos(a) * 9, clamp(cy0 + Math.sin(a) * 12, -15, 15)); }
    c.stroke();
    // lights
    c.fillStyle = "#f2e9b8"; c.fillRect(L / 2 - 4, -Wd / 2 + 4, 3, 7); c.fillRect(L / 2 - 4, Wd / 2 - 11, 3, 7);
    c.fillStyle = "#8a1010"; c.fillRect(-L / 2 + 1, -Wd / 2 + 4, 3, 7); c.fillRect(-L / 2 + 1, Wd / 2 - 11, 3, 7);
    // rust + dents
    for (i = 0; i < 5; i++) { c.fillStyle = "rgba(110,60,20," + (0.3 + r() * 0.3) + ")"; c.beginPath(); c.arc((r() - 0.5) * L * 0.8, (r() - 0.5) * Wd * 0.8, 2 + r() * 4, 0, TAU); c.fill(); }
    // blood smear on a few
    if (r() < 0.4) { c.fillStyle = "rgba(110,10,10,0.6)"; c.beginPath(); c.ellipse(30, 4, 8, 3, 0.4, 0, TAU); c.fill(); }
  }
  function adjust(hex, d) {
    var n = parseInt(hex.slice(1), 16), R = clamp((n >> 16) + d, 0, 255), G = clamp((n >> 8 & 255) + d, 0, 255), B = clamp((n & 255) + d, 0, 255);
    return "rgb(" + R + "," + G + "," + B + ")";
  }

  var tileCache = new Map();
  function getTile(tx, ty) {
    var key = tx + "," + ty, t = tileCache.get(key);
    if (t) { tileCache.delete(key); tileCache.set(key, t); return t; }
    t = mk(TILE, TILE);
    var c = t.getContext("2d");
    c.translate(-tx * TILE, -ty * TILE);
    if (!basePat) basePat = c.createPattern(baseTex, "repeat");
    c.fillStyle = basePat; c.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    var x0 = tx * TILE, y0 = ty * TILE, x1 = x0 + TILE, y1 = y0 + TILE;
    var roadsDone = false;
    for (var i = 0; i < feats.length; i++) {
      var f = feats[i];
      if (!roadsDone && f.L >= 2) { c.save(); c.beginPath(); c.rect(x0, y0, TILE, TILE); c.clip(); drawRoads(c); c.restore(); roadsDone = true; }
      if (f.x + f.r < x0 || f.x - f.r > x1 || f.y + f.r < y0 || f.y - f.r > y1) continue;
      drawFeat(c, f);
    }
    if (!roadsDone) drawRoads(c);
    // outside-world darkness band (camera never shows it, but keep edges tidy)
    tileCache.set(key, t);
    if (tileCache.size > 18) tileCache.delete(tileCache.keys().next().value);
    return t;
  }

  // ============================================================ FX state
  var fx = [];        // world-space effects (explosions, rings, gibs, smoke, numbers...)
  var decals = [];    // dynamic ground decals (scorches, corpses, pools)
  var embers = [];
  for (var ei = 0; ei < 38; ei++) embers.push({ x: Math.random() * VW, y: Math.random() * VH, s: 0.6 + Math.random() * 1.6, v: 0.2 + Math.random() * 0.6, ph: Math.random() * TAU, c: Math.random() < 0.6 ? "255,140,60" : "200,200,210" });
  var lastT = now(), DT = 1 / 60, simDT = 0, T = 0, screenFlash = 0, flashCol = "255,255,255", hurtFlash = 0;
  var prevBlts = [], seenZ = new Set(), prevHp = p.hp, prevScore = 0, scorePop = 0, hpTrail = p.hp, lastFireSnap = {};
  var muzzle = 0, muzzleCol = "#fff", walkPh = 0, lastPx = p.x, lastPy = p.y, moving = false, bossBarTrail = 1, prevLevel = gs.level;

  function frozenGame() { return gs.paused || gs.over || gs.waiting; }
  function pushFx(o) { if (fx.length < 420) fx.push(o); }
  function pushDecal(o) { decals.push(o); if (decals.length > 140) decals.shift(); }

  // ============================================================ ZOMBIE SPRITES
  var ZT = {
    walker: { skin: "#7fa35c", skinD: "#4b6a36", shirt: "#55697a", shirtD: "#2f3c48", pants: "#3a3d4a", eye: "#ff3b2f", hair: "#2b2418", build: 1.0, lean: 0.15 },
    runner: { skin: "#a3b893", skinD: "#62755a", shirt: "#a3302a", shirtD: "#5f1a16", pants: "#2d3340", eye: "#ffd23f", hair: "#191512", build: 0.84, lean: 0.38, hood: true },
    bloater: { skin: "#8c9a52", skinD: "#56602f", shirt: null, pants: "#4a3b2e", eye: "#ff8a1f", hair: null, build: 1.35, lean: 0.05, pustules: true },
    cop: { skin: "#6e9a68", skinD: "#42603c", shirt: "#1f3460", shirtD: "#111d38", pants: "#1a2440", eye: "#ff3b2f", hair: "#111", cap: "#141c33", badge: true, build: 1.0, lean: 0.12 },
    hazmat: { skin: "#7a9a5a", skinD: "#4e6a3a", shirt: "#e0bb1a", shirtD: "#9a7a08", pants: "#d0ab16", eye: "#7dff4a", hair: null, mask: true, build: 1.05, lean: 0.1 },
    rotter: { skin: "#c9c3a8", skinD: "#7f7a63", shirt: "#4d4237", shirtD: "#2a231c", pants: "#3a3229", eye: "#4af0ff", hair: "#3a3a3a", ribs: true, build: 0.9, lean: 0.22 },
    boss: { skin: "#6e5a86", skinD: "#3b2c52", shirt: null, pants: "#2a2030", eye: "#ff2bd6", hair: null, build: 1.25, lean: 0.12, boss: true }
  };
  var ZKEYS = ["walker", "walker", "runner", "cop", "hazmat", "rotter", "bloater", "walker", "runner", "cop"];
  var sprCache = new Map();
  var FRAMES = 8;

  function limb(c, x0, y0, x1, y1, w, col, outline) {
    c.lineCap = "round";
    if (outline) { c.strokeStyle = "rgba(10,8,8,0.75)"; c.lineWidth = w + 2.2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  }
  function blob(c, x, y, rx, ry, fill, rot) {
    c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); c.fillStyle = fill; c.fill();
    c.strokeStyle = "rgba(10,8,8,0.75)"; c.lineWidth = 1.4; c.stroke();
  }

  // Draws a zombie facing +x with its body centre at (0,0); s = hitbox size.
  function paintZombie(c, type, s, fr) {
    var t = ZT[type], b = t.build, ph = fr / FRAMES * TAU, sw = Math.sin(ph), cw = Math.cos(ph);
    var u = s / 32;  // detail scale
    var hipY = s * 0.14, legL = s * 0.21;
    // ---- legs (back then front)
    function leg(sign, dark) {
      var a = sign * sw * 0.55, kx = Math.sin(a) * legL, ky = hipY + Math.cos(a) * legL;
      var knee2 = Math.max(0, sign * cw) * 0.6;
      var fx = kx + Math.sin(a - knee2) * legL * 0.95, fy = ky + Math.cos(a - knee2) * legL * 0.95;
      var pc = dark ? shade(t.pants, -25) : t.pants;
      limb(c, 0, hipY, kx, ky, s * 0.15 * b, pc, true);
      limb(c, kx, ky, fx, fy, s * 0.13 * b, pc, true);
      if (t.ribs && !dark) limb(c, kx, ky + 1, fx, fy, s * 0.06, t.skin, false);   // torn trouser leg
      blob(c, fx + s * 0.05, fy + s * 0.02, s * 0.1, s * 0.05, dark ? "#141414" : "#262220");
    }
    leg(-1, true);
    // ---- back arm
    var bob = Math.sin(ph * 2) * s * 0.03;
    var shX = s * 0.06, shY = -s * 0.2;
    var lean = t.lean;
    c.save(); c.rotate(lean);
    limb(c, shX - s * 0.05, shY, shX + s * 0.36, shY + s * 0.02 + bob, s * 0.11 * Math.min(b, 1.2), shade(t.skin, -30), true);
    c.restore();
    leg(1, false);
    // ---- torso
    c.save(); c.translate(0, hipY); c.rotate(lean); c.translate(0, -hipY);
    var tw = s * 0.25 * b, top = -s * 0.32, bot = s * 0.18;
    if (t.boss) {   // muscle hump behind the shoulders
      blob(c, -tw * 0.35, top + s * 0.06, tw * 0.95, s * 0.17, t.skinD, -0.3);
    }
    var tg = c.createLinearGradient(-tw, 0, tw, 0);
    var tc = t.shirt || t.skin, tcd = t.shirtD || t.skinD;
    tg.addColorStop(0, tcd); tg.addColorStop(0.55, tc); tg.addColorStop(1, shade(tc, 25));
    c.beginPath();
    c.moveTo(-tw, top + s * 0.05); c.quadraticCurveTo(-tw * 1.1, top - s * 0.02, 0, top - s * 0.03);
    c.quadraticCurveTo(tw * 1.15, top, tw, top + s * 0.08);
    c.lineTo(tw * 0.95, bot);
    // torn hem
    var n = 5; for (var i = 0; i <= n; i++) c.lineTo(tw * 0.95 - i * (tw * 1.9 / n), bot + ((i % 2) ? s * 0.07 : 0));
    c.closePath(); c.fillStyle = tg; c.fill(); c.strokeStyle = "rgba(10,8,8,0.8)"; c.lineWidth = 1.5; c.stroke();
    if (t.boss) {   // bone spikes along the back
      for (var k = 0; k < 4; k++) {
        var bx0 = -tw * 0.85 + k * tw * 0.42, by0 = top + s * 0.03 - k * s * 0.01;
        c.beginPath(); c.moveTo(bx0 - s * 0.05, by0 + s * 0.02); c.lineTo(bx0 - s * 0.09, by0 - s * (0.16 + (k % 2) * 0.05)); c.lineTo(bx0 + s * 0.05, by0 + s * 0.01); c.closePath();
        c.fillStyle = "#e8dcc8"; c.fill(); c.strokeStyle = "rgba(40,20,20,0.7)"; c.lineWidth = 1; c.stroke();
      }
    }
    if (t.pustules || t.boss) {
      // belly / muscles
      c.fillStyle = shade(t.skin, 15); c.beginPath(); c.ellipse(tw * 0.25, s * 0.02, tw * 0.75, s * 0.16, 0, 0, TAU); c.fill();
      c.strokeStyle = "rgba(0,0,0,0.3)"; c.lineWidth = 1; c.stroke();
      if (t.pustules) {
        [[0.3, -0.05, 0.05], [-0.1, 0.06, 0.04], [0.55, 0.05, 0.035], [0.1, -0.15, 0.03]].forEach(function (q) {
          c.fillStyle = "#c8d45a"; c.beginPath(); c.arc(tw * q[0], s * q[1], s * q[2], 0, TAU); c.fill();
          c.fillStyle = "rgba(255,255,220,0.7)"; c.beginPath(); c.arc(tw * q[0] - 1, s * q[1] - 1, s * q[2] * 0.35, 0, TAU); c.fill();
        });
      }
      if (t.boss) {
        c.strokeStyle = "rgba(255,60,220,0.75)"; c.lineWidth = 1.4 * u;
        c.beginPath(); c.moveTo(-tw * 0.6, -s * 0.2); c.quadraticCurveTo(-tw * 0.1, -s * 0.05, -tw * 0.3, s * 0.1);
        c.moveTo(tw * 0.5, -s * 0.22); c.quadraticCurveTo(tw * 0.1, -s * 0.1, tw * 0.4, s * 0.08); c.stroke();
      }
    } else {
      // shirt wear: tear showing skin, blood
      c.fillStyle = t.skin; c.beginPath(); c.moveTo(tw * 0.1, -s * 0.05); c.lineTo(tw * 0.45, s * 0.02); c.lineTo(tw * 0.2, s * 0.1); c.closePath(); c.fill();
      if (t.ribs) { c.strokeStyle = "#7f7a63"; c.lineWidth = 1; for (var rb = 0; rb < 3; rb++) { c.beginPath(); c.moveTo(tw * 0.15, -s * 0.02 + rb * s * 0.035); c.lineTo(tw * 0.4, s * 0.01 + rb * s * 0.03); c.stroke(); } }
      c.fillStyle = "rgba(120,10,10,0.6)"; c.beginPath(); c.arc(-tw * 0.3, -s * 0.12, s * 0.06, 0, TAU); c.arc(-tw * 0.2, -s * 0.05, s * 0.04, 0, TAU); c.fill();
      if (t.badge) { c.fillStyle = "#e8c84a"; c.beginPath(); c.arc(tw * 0.45, -s * 0.18, s * 0.035, 0, TAU); c.fill(); c.fillStyle = "#cfd6e6"; c.fillRect(-tw * 0.1, -s * 0.24, tw * 0.25, s * 0.03); }
      if (t.mask) { c.strokeStyle = "rgba(0,0,0,0.45)"; c.lineWidth = 1; c.beginPath(); c.moveTo(0, top); c.lineTo(0, bot); c.stroke(); c.fillStyle = "#1a1a1a"; c.fillRect(-tw, s * 0.04, tw * 2, s * 0.04); }
      if (t.hood) { c.fillStyle = shade(t.shirt, -20); c.beginPath(); c.ellipse(-tw * 0.4, top + s * 0.02, tw * 0.6, s * 0.08, -0.3, 0, TAU); c.fill(); }
    }
    // ---- head
    var hx = s * 0.12, hy = top - s * (t.boss ? 0.1 : 0.17), hr = s * 0.17;
    c.save(); c.translate(hx, hy); c.rotate(0.15 + Math.sin(ph) * 0.06);
    if (t.mask) {
      blob(c, 0, 0, hr * 1.05, hr * 1.1, t.shirt);
      blob(c, hr * 0.35, hr * 0.05, hr * 0.62, hr * 0.55, "#1d2a24");
      var vg = c.createRadialGradient(hr * 0.4, -hr * 0.05, 0, hr * 0.4, 0, hr * 0.6); vg.addColorStop(0, "rgba(160,255,120,0.95)"); vg.addColorStop(1, "rgba(40,120,30,0.6)");
      c.fillStyle = vg; c.beginPath(); c.ellipse(hr * 0.42, -hr * 0.05, hr * 0.42, hr * 0.32, 0, 0, TAU); c.fill();
      blob(c, hr * 0.55, hr * 0.62, hr * 0.28, hr * 0.24, "#333");   // filter canister
    } else {
      var hg = c.createRadialGradient(hr * 0.3, -hr * 0.35, hr * 0.1, 0, 0, hr * 1.1);
      hg.addColorStop(0, shade(t.skin, 30)); hg.addColorStop(0.6, t.skin); hg.addColorStop(1, t.skinD);
      blob(c, 0, 0, hr * (t.boss ? 1.1 : 1), hr * 1.05, hg);
      // hair / cap / hood
      if (t.hood) { c.fillStyle = t.shirt; c.beginPath(); c.arc(-hr * 0.15, -hr * 0.1, hr * 1.12, Math.PI * 0.55, Math.PI * 1.75); c.fill(); c.strokeStyle = "rgba(0,0,0,0.6)"; c.lineWidth = 1.2; c.stroke(); }
      else if (t.cap) { c.fillStyle = t.cap; c.beginPath(); c.arc(0, -hr * 0.15, hr * 1.02, Math.PI * 1.02, Math.PI * 1.98); c.fill(); c.fillRect(hr * 0.2, -hr * 0.35, hr * 1.0, hr * 0.18); c.fillStyle = "#e8c84a"; c.fillRect(-hr * 0.1, -hr * 0.85, hr * 0.25, hr * 0.2); }
      else if (t.hair) { c.fillStyle = t.hair; for (var hh = 0; hh < 5; hh++) { c.beginPath(); c.arc(-hr * 0.5 + hh * hr * 0.2, -hr * 0.82 + Math.abs(hh - 2) * hr * 0.1, hr * 0.28, 0, TAU); c.fill(); } }
      if (t.boss) {   // horns
        c.fillStyle = "#e8dcc8";
        c.beginPath(); c.moveTo(-hr * 0.4, -hr * 0.7); c.quadraticCurveTo(-hr * 1.2, -hr * 1.6, -hr * 0.2, -hr * 1.9); c.quadraticCurveTo(-hr * 0.6, -hr * 1.3, hr * 0.1, -hr * 0.85); c.fill();
        c.beginPath(); c.moveTo(hr * 0.3, -hr * 0.8); c.quadraticCurveTo(hr * 0.8, -hr * 1.7, hr * 1.4, -hr * 1.6); c.quadraticCurveTo(hr * 0.9, -hr * 1.3, hr * 0.8, -hr * 0.6); c.fill();
      }
      // brow + eye sockets
      c.fillStyle = "rgba(20,10,10,0.75)"; c.beginPath(); c.ellipse(hr * 0.45, -hr * 0.12, hr * 0.26, hr * 0.2, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(-hr * 0.05, -hr * 0.12, hr * 0.18, hr * 0.17, 0, 0, TAU); c.fill();
      // glowing eyes
      eye(c, hr * 0.47, -hr * 0.12, hr * 0.15, t.eye);
      eye(c, -hr * 0.03, -hr * 0.12, hr * 0.11, t.eye);
      if (t.boss) eye(c, hr * 0.22, -hr * 0.48, hr * 0.12, t.eye);
      // jaw + teeth
      var jo = (Math.sin(ph * 2) * 0.5 + 0.5) * hr * 0.15;
      c.fillStyle = "#2a0606"; c.beginPath(); c.ellipse(hr * 0.42, hr * 0.42 + jo * 0.5, hr * 0.36, hr * 0.16 + jo, 0.1, 0, TAU); c.fill();
      c.fillStyle = "#e9e2c6"; for (var tt = 0; tt < 4; tt++) c.fillRect(hr * 0.15 + tt * hr * 0.15, hr * 0.3 + jo * 0.1, hr * 0.09, hr * 0.12);
      // stitches / wound
      c.strokeStyle = "rgba(40,10,10,0.7)"; c.lineWidth = 1; c.beginPath(); c.moveTo(-hr * 0.55, hr * 0.1); c.lineTo(-hr * 0.2, hr * 0.5);
      for (var st = 0; st < 3; st++) { var qx = -hr * 0.5 + st * hr * 0.12, qy = hr * 0.17 + st * hr * 0.13; c.moveTo(qx - 2, qy + 1); c.lineTo(qx + 2, qy - 1); }
      c.stroke();
    }
    c.restore();
    c.restore(); // torso lean
    // ---- front arm with claws
    c.save(); c.rotate(lean);
    var ax0 = shX + s * 0.05, ay0 = shY + s * 0.03, ex = ax0 + s * 0.2, ey = ay0 + s * 0.05 - bob, hx2 = ax0 + s * 0.42, hy2 = ay0 - s * 0.01 - bob * 1.5;
    var armW = s * (t.boss ? 0.17 : 0.11) * Math.min(b, 1.2);
    if (t.shirt && !t.mask) limb(c, ax0, ay0, ex, ey, armW * 1.15, t.shirt, true); else limb(c, ax0, ay0, ex, ey, armW, t.mask ? t.shirt : t.skin, true);
    limb(c, ex, ey, hx2, hy2, armW * 0.9, t.mask ? "#2a2a2a" : t.skin, true);
    c.strokeStyle = t.mask ? "#2a2a2a" : t.skinD; c.lineWidth = Math.max(1, s * 0.03); c.lineCap = "round";
    for (var f = -1; f <= 1; f++) { c.beginPath(); c.moveTo(hx2, hy2); c.lineTo(hx2 + s * 0.08, hy2 + f * s * 0.05 + s * 0.02); c.stroke(); }
    if (t.boss) { // chain cuff
      c.fillStyle = "#6d717a"; c.fillRect(ex + s * 0.02, ey - armW * 0.55, s * 0.06, armW * 1.1);
      c.strokeStyle = "#a7acb6"; c.lineWidth = 0.6 * u;
      for (var ch = 0; ch < 4; ch++) { c.beginPath(); c.ellipse(ex + s * 0.03 - ch * 2.6 * u, ey + armW * 0.6 + ch * 2.8 * u, 1.6 * u, 1.1 * u, ch % 2 ? 0.8 : -0.4, 0, TAU); c.stroke(); }
    }
    c.restore();
  }
  function eye(c, x, y, r, col) {
    var g = c.createRadialGradient(x, y, 0, x, y, r * 2.4);
    g.addColorStop(0, col); g.addColorStop(0.4, col.length === 7 ? col + "88" : col); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.4, 0, TAU); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.fillStyle = "#fff"; c.beginPath(); c.arc(x - r * 0.25, y - r * 0.25, r * 0.4, 0, TAU); c.fill();
  }
  function shade(hex, d) { return adjust(hex, d); }

  function sprite(type, s, fr, tint) {
    var key = type + "|" + s + "|" + fr + "|" + (tint || "");
    var cv = sprCache.get(key);
    if (cv) return cv;
    var w = s * 2.2, h = s * 2.3;
    cv = mk(w, h); cv.ox = w * 0.45; cv.oy = h * 0.55;
    var c = cv.getContext("2d");
    if (tint) {
      c.drawImage(sprite(type, s, fr, null), 0, 0);
      c.globalCompositeOperation = "source-atop";
      c.fillStyle = tint; c.fillRect(0, 0, w, h);
    } else {
      c.translate(cv.ox, cv.oy); paintZombie(c, type, s, fr);
    }
    sprCache.set(key, cv);
    return cv;
  }

  // ============================================================ DRAW: BACKGROUND
  var light = mk(VW, VH), lctx = light.getContext("2d");
  var vignette = mk(VW, VH);
  (function () {
    var c = vignette.getContext("2d"), g = c.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.65);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.6)"); c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  })();
  var fogTex = mk(256, 256);
  (function () {
    var c = fogTex.getContext("2d"), r = mulberry(5);
    for (var i = 0; i < 40; i++) {
      var x = r() * 256, y = r() * 256, rad = 30 + r() * 70;
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
        var g = c.createRadialGradient(x + ox * 256, y + oy * 256, 0, x + ox * 256, y + oy * 256, rad);
        g.addColorStop(0, "rgba(150,165,200,0.10)"); g.addColorStop(1, "rgba(150,165,200,0)");
        c.fillStyle = g; c.fillRect(x + ox * 256 - rad, y + oy * 256 - rad, rad * 2, rad * 2);
      }
    }
  })();
  var fogPat = null;

  function playerScreen() {
    if (PINNED) return { x: VW / 2 - p.w / 2, y: VH / 2 - p.h / 2 };
    return { x: p.x - cam.x, y: p.y - cam.y };
  }

  window.drawBg = function () {
    // ---- timing / simulation step (runs once per frame, here because drawBg is drawn first)
    var t = now(); DT = clamp((t - lastT) / 1000, 0, 0.05); lastT = t;
    simDT = frozenGame() ? 0 : DT; T += simDT;
    stepFx(simDT);
    trackPlayer();
    trackBullets();

    // ---- ground tiles
    var cx = Math.floor(cam.x), cy = Math.floor(cam.y);
    var tx0 = Math.floor(cx / TILE), ty0 = Math.floor(cy / TILE), tx1 = Math.floor((cx + VW) / TILE), ty1 = Math.floor((cy + VH) / TILE);
    ctx.fillStyle = "#0c0d0c"; ctx.fillRect(0, 0, VW, VH);
    for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || ty < 0 || tx * TILE >= C.worldW || ty * TILE >= C.worldH) continue;
      ctx.drawImage(getTile(tx, ty), tx * TILE - cx, ty * TILE - cy);
    }
    // ---- dynamic decals: scorches, pools, corpses, old blood splats from the game
    for (var i = 0; i < decals.length; i++) drawDecal(decals[i], cx, cy);
    drawSplats(cx, cy);

    // ---- lighting: darken ground, carve out lights (entities drawn after stay fully readable)
    lctx.globalCompositeOperation = "source-over";
    lctx.clearRect(0, 0, VW, VH);
    lctx.fillStyle = "rgba(6,5,16,0.52)"; lctx.fillRect(0, 0, VW, VH);
    lctx.globalCompositeOperation = "destination-out";
    var ps = playerScreen(), pcx = ps.x + p.w / 2, pcy = ps.y + p.h / 2;
    hole(pcx, pcy, 210, 0.95);
    // flashlight cone towards the aim point
    var ang = Math.atan2(p.my - cam.y - pcy, p.mx - cam.x - pcx);
    var cg = lctx.createRadialGradient(pcx, pcy, 20, pcx, pcy, 420);
    cg.addColorStop(0, "rgba(0,0,0,0.9)"); cg.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = cg; lctx.beginPath(); lctx.moveTo(pcx, pcy); lctx.arc(pcx, pcy, 420, ang - 0.42, ang + 0.42); lctx.closePath(); lctx.fill();
    for (i = 0; i < lights.length; i++) {
      var L = lights[i], lx = L.x - cx, ly = L.y - cy;
      if (lx < -200 || ly < -200 || lx > VW + 200 || ly > VH + 200) continue;
      var fl = 0.85 + 0.15 * Math.sin(t * 0.013 + i * 7) * (Math.sin(t * 0.002 + i) > 0.92 ? 1 : 0.15);
      hole(lx, ly, 150, 0.85 * fl);
    }
    for (i = 0; i < fx.length; i++) { var e = fx[i]; if (e.light) hole(e.x - cx, e.y - cy, e.light * (1 - e.t / e.d), 1); }
    if (muzzle > 0) hole(pcx, pcy, 140 * muzzle + 60, 0.8);
    ctx.drawImage(light, 0, 0);
    // warm light tints
    ctx.globalCompositeOperation = "lighter";
    for (i = 0; i < lights.length; i++) {
      var L2 = lights[i], lx2 = L2.x - cx, ly2 = L2.y - cy;
      if (lx2 < -160 || ly2 < -160 || lx2 > VW + 160 || ly2 > VH + 160) continue;
      var wg = ctx.createRadialGradient(lx2, ly2, 0, lx2, ly2, 150);
      wg.addColorStop(0, "rgba(255,200,120,0.16)"); wg.addColorStop(1, "rgba(255,200,120,0)");
      ctx.fillStyle = wg; ctx.fillRect(lx2 - 150, ly2 - 150, 300, 300);
      ctx.fillStyle = "rgba(255,230,170,0.9)"; ctx.beginPath(); ctx.arc(lx2, ly2, 3, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  };
  function hole(x, y, r, a) {
    if (r <= 1) return;
    var g = lctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(0,0,0," + a + ")"); g.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = g; lctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function drawSplats(cx, cy) {
    for (var i = 0; i < splats.length; i++) {
      var sp = splats[i], sx = sp.x - cx, sy = sp.y - cy;
      if (sx < -60 || sy < -60 || sx > VW + 60 || sy > VH + 60) continue;
      if (!sp._pts) {
        var r = mulberry((sp.x * 13 + sp.y * 7) | 0), pts = [];
        for (var k = 0; k < 10; k++) pts.push(sp.size * (0.6 + r() * 0.45));
        var drops = []; for (k = 0; k < 5; k++) { var a = r() * TAU, d = sp.size * (1.1 + r() * 0.8); drops.push([Math.cos(a) * d, Math.sin(a) * d, 1 + r() * 3]); }
        sp._pts = pts; sp._drops = drops;
      }
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(sp.rot); ctx.globalAlpha = sp.alpha;
      ctx.fillStyle = "#5e0606"; ctx.beginPath();
      for (k = 0; k < 10; k++) { var aa = k / 10 * TAU; ctx[k ? "lineTo" : "moveTo"](Math.cos(aa) * sp._pts[k], Math.sin(aa) * sp._pts[k]); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#7d0b0b"; ctx.beginPath(); ctx.arc(-sp.size * 0.15, -sp.size * 0.15, sp.size * 0.45, 0, TAU); ctx.fill();
      ctx.fillStyle = "#5e0606";
      for (k = 0; k < sp._drops.length; k++) { var dd = sp._drops[k]; ctx.beginPath(); ctx.arc(dd[0], dd[1], dd[2], 0, TAU); ctx.fill(); }
      ctx.fillStyle = "rgba(255,180,180,0.12)"; ctx.beginPath(); ctx.arc(-sp.size * 0.3, -sp.size * 0.3, sp.size * 0.15, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawDecal(d, cx, cy) {
    var x = d.x - cx, y = d.y - cy;
    if (x < -150 || y < -150 || x > VW + 150 || y > VH + 150) return;
    var age = T - d.t0, a = d.life ? clamp(1 - (age - d.life * 0.7) / (d.life * 0.3), 0, 1) : 1;
    if (a <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
    if (d.k === "scorch") {
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, d.r);
      g.addColorStop(0, "rgba(10,8,6,0.85)"); g.addColorStop(0.6, "rgba(20,14,10,0.55)"); g.addColorStop(1, "rgba(20,14,10,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, d.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1.5; ctx.beginPath();
      for (var k = 0; k < 9; k++) { var aa = k / 9 * TAU + d.r; ctx.moveTo(Math.cos(aa) * d.r * 0.3, Math.sin(aa) * d.r * 0.3); ctx.lineTo(Math.cos(aa) * d.r * 0.85, Math.sin(aa) * d.r * 0.85); }
      ctx.stroke();
    } else if (d.k === "pool") {
      var rr = d.r * Math.min(1, age / 1.2);
      ctx.fillStyle = "#4a0404"; ctx.beginPath(); ctx.ellipse(0, 0, rr, rr * 0.6, d.rot, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,120,120,0.12)"; ctx.beginPath(); ctx.ellipse(-rr * 0.3, -rr * 0.2, rr * 0.3, rr * 0.12, d.rot, 0, TAU); ctx.fill();
    } else if (d.k === "corpse") {
      ctx.rotate(d.rot);
      var spr = sprite(d.type, d.s, 2, null);
      ctx.scale(d.flip, 1); ctx.rotate(Math.PI / 2 * 0.95);
      ctx.globalAlpha = a * 0.85;
      ctx.drawImage(spr, -spr.ox, -spr.oy);
      ctx.globalAlpha = a * 0.35;
      ctx.drawImage(sprite(d.type, d.s, 2, "#000"), -spr.ox, -spr.oy);
    } else if (d.k === "drop") {
      ctx.fillStyle = "#5a0505"; ctx.beginPath(); ctx.arc(0, 0, d.r, 0, TAU); ctx.fill();
    } else if (d.k === "goo") {
      ctx.fillStyle = "rgba(120,200,60,0.55)"; ctx.beginPath(); ctx.ellipse(0, 0, d.r, d.r * 0.6, d.rot, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ============================================================ FX simulation
  function stepFx(dt) {
    for (var i = fx.length - 1; i >= 0; i--) {
      var e = fx[i];
      e.t += dt;
      if (e.vx !== undefined) { e.x += e.vx * dt; e.y += e.vy * dt; var damp = Math.pow(e.drag || 0.2, dt); e.vx *= damp; e.vy *= damp; }
      if (e.h !== undefined) {   // gib arc
        e.vh -= 900 * dt; e.h += e.vh * dt; e.rot += e.vr * dt;
        if (e.h < 0) {
          e.h = 0;
          if (Math.abs(e.vh) > 120) { e.vh = -e.vh * 0.35; e.vx *= 0.6; e.vy *= 0.6; if (e.blood) pushDecal({ k: "drop", x: e.x, y: e.y, r: 1.5 + Math.random() * 2.5, t0: T, life: 14 }); }
          else { e.vh = 0; e.vx *= 0.8; e.vy *= 0.8; e.vr *= 0.8; }
        }
      }
      if (e.t >= e.d) fx.splice(i, 1);
    }
    for (i = decals.length - 1; i >= 0; i--) if (decals[i].life && T - decals[i].t0 > decals[i].life) decals.splice(i, 1);
    if (muzzle > 0) muzzle = Math.max(0, muzzle - DT * 14);
    if (screenFlash > 0) screenFlash = Math.max(0, screenFlash - DT * 2.5);
    if (hurtFlash > 0) hurtFlash = Math.max(0, hurtFlash - DT * 2);
    if (scorePop > 0) scorePop = Math.max(0, scorePop - DT * 3);
  }

  function trackPlayer() {
    // movement for the walk cycle
    var d = Math.hypot(p.x - lastPx, p.y - lastPy);
    moving = d > 0.3 && !frozenGame();
    if (moving) walkPh += d * 0.09;
    lastPx = p.x; lastPy = p.y;
    // muzzle flashes from fire timestamps
    var fired = null;
    for (var i = 0; i < gs.equipped.length; i++) {
      var w = gs.equipped[i], k = w._fk || w.id, v = p.lastFire[k];
      if (v && v !== lastFireSnap[k]) { fired = w; lastFireSnap[k] = v; }
    }
    if (fired && !frozenGame()) {
      muzzle = 1; muzzleCol = fired.color;
      var tip = gunTip();
      if (!/flame|laser|deathray|infinity|freezer|time|blackhole|galaxy/.test(fired.id)) {
        pushFx({ k: "shell", x: tip.px, y: tip.py, vx: -Math.cos(tip.a) * 60 + (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 50, drag: 0.05, h: 8, vh: 160 + Math.random() * 80, rot: 0, vr: 20, t: 0, d: 0.9 });
      }
    }
    // hurt detection
    if (p.hp < prevHp - 0.01 && !frozenGame()) { hurtFlash = 1; pushFx({ k: "ring", x: p.x + p.w / 2, y: p.y + p.h / 2, r0: 10, r1: 60, col: "255,60,60", t: 0, d: 0.35 }); }
    if (p.hp > prevHp + 5) pushFx({ k: "heal", x: p.x + p.w / 2, y: p.y + p.h / 2, t: 0, d: 0.8 });
    prevHp = p.hp;
    if (gs.score > prevScore) scorePop = 1;
    prevScore = gs.score;
    if (gs.level !== prevLevel) { prevLevel = gs.level; pushFx({ k: "ring", x: p.x + p.w / 2, y: p.y + p.h / 2, r0: 10, r1: 360, col: "160,120,255", t: 0, d: 0.9, w: 10 }); screenFlash = 0.5; flashCol = "170,140,255"; }
  }

  function gunTip() {
    var ps = playerScreen(), cx = ps.x + p.w / 2, cy = ps.y + p.h / 2;
    var a = Math.atan2(p.my - cam.y - cy, p.mx - cam.x - cx);
    var L = p.w * 0.85;
    return { x: cx + Math.cos(a) * L, y: cy - p.h * 0.05 + Math.sin(a) * L, a: a, px: cam.x + cx + Math.cos(a) * L, py: cam.y + cy + Math.sin(a) * L };
  }

  var EXPLO = { explosion: 1, nuke: 1, blackhole: 1, multi: 1, chaos: 1, random: 1 };
  var bltsRef = null;
  function trackBullets() {
    if (blts !== bltsRef) { bltsRef = blts; prevBlts = blts.slice(); return; }   // new game: no fx for the old list
    if (blts.length === 0 && prevBlts.length === 0) return;
    var cur = new Set(blts);
    for (var i = 0; i < prevBlts.length; i++) {
      var b = prevBlts[i];
      if (cur.has(b)) continue;
      if (b.age >= b.maxAge) continue;
      if (EXPLO[b.special]) explode(b);
      else if (b.special !== "burn") pushFx({ k: "impact", x: b.x, y: b.y, col: b.color, t: 0, d: 0.22, a: Math.atan2(b.vy, b.vx) });
      else pushFx({ k: "smoke", x: b.x, y: b.y, vx: b.vx * 3, vy: b.vy * 3 - 20, drag: 0.1, r: 6, t: 0, d: 0.5, col: "60,40,30" });
    }
    prevBlts = blts.slice();
  }

  function explode(b) {
    var R = b.expRad || 50, x = b.x, y = b.y, s = b.special;
    if (s === "nuke") {
      screenFlash = 1; flashCol = "255,255,220";
      pushFx({ k: "fireball", x: x, y: y, r: R * 0.9, t: 0, d: 1.4, light: R * 1.4, hot: true });
      pushFx({ k: "ring", x: x, y: y, r0: 20, r1: R * 1.3, col: "255,240,180", t: 0, d: 1.0, w: 16 });
      pushFx({ k: "ring", x: x, y: y, r0: 10, r1: R * 0.8, col: "255,120,40", t: 0, d: 0.7, w: 10 });
      for (var i = 0; i < 26; i++) smoke(x, y, R * 0.6, 50, 1.8);
      pushDecal({ k: "scorch", x: x, y: y, r: R * 0.55, t0: T, life: 40 });
    } else if (s === "blackhole") {
      pushFx({ k: "vortex", x: x, y: y, r: R, t: 0, d: 1.0 });
      pushFx({ k: "ring", x: x, y: y, r0: R * 1.2, r1: 10, col: "180,90,255", t: 0, d: 0.6, w: 6 });
    } else if (s === "chaos" || s === "random" || s === "multi") {
      var col = s === "multi" ? "255,80,255" : s === "chaos" ? "255,140,40" : "255,60,140";
      pushFx({ k: "fireball", x: x, y: y, r: R * 0.8, t: 0, d: 0.45, light: R * 1.5, tint: col });
      pushFx({ k: "ring", x: x, y: y, r0: 6, r1: R, col: col, t: 0, d: 0.35, w: 4 });
      for (i = 0; i < 4; i++) spark(x, y, col, 260);
    } else {
      pushFx({ k: "fireball", x: x, y: y, r: R * 0.6, t: 0, d: 0.6, light: R * 1.8, hot: true });
      pushFx({ k: "ring", x: x, y: y, r0: 8, r1: R, col: "255,200,120", t: 0, d: 0.35, w: 6 });
      for (i = 0; i < 8; i++) smoke(x, y, R * 0.3, 40, 1.2);
      for (i = 0; i < 10; i++) spark(x, y, "255,180,60", 380);
      pushDecal({ k: "scorch", x: x, y: y, r: R * 0.45, t0: T, life: 25 });
    }
  }
  function smoke(x, y, spread, sp, dur) {
    var a = Math.random() * TAU, d = Math.random() * spread;
    pushFx({ k: "smoke", x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 15, drag: 0.3, r: 10 + Math.random() * 14, t: 0, d: dur * (0.6 + Math.random() * 0.6), col: "50,46,44" });
  }
  function spark(x, y, col, sp) {
    var a = Math.random() * TAU, v = sp * (0.4 + Math.random() * 0.6);
    pushFx({ k: "spark", x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.05, t: 0, d: 0.3 + Math.random() * 0.3, col: col });
  }

  function zombieDied(z) {
    var t = z._t || "walker", s = z.boss ? Math.round(z.w) : Math.round(z.w), cx = z.x + z.w / 2, cy = z.y + z.h / 2;
    var tt = ZT[t], n = z.boss ? 26 : 8;
    pushDecal({ k: "pool", x: cx, y: cy + z.h * 0.3, r: z.w * (z.boss ? 0.8 : 0.6), rot: Math.random() * 3, t0: T, life: 30 });
    pushDecal({ k: "corpse", x: cx, y: cy, s: s, type: t, rot: (Math.random() - 0.5) * 0.6, flip: z._f || 1, t0: T, life: z.boss ? 10 : 5 });
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, v = 60 + Math.random() * (z.boss ? 260 : 160);
      var cols = [tt.skin, tt.skinD, tt.shirt || tt.skin, "#7a0a0a", "#5a0505"];
      pushFx({ k: "gib", x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, drag: 0.4, h: 4, vh: 160 + Math.random() * 260, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 20,
        t: 0, d: 1.6 + Math.random(), col: cols[(Math.random() * cols.length) | 0], sz: (z.boss ? 5 : 2.5) + Math.random() * 3, blood: true });
    }
    pushFx({ k: "puff", x: cx, y: cy, r: z.w * 0.9, t: 0, d: 0.45, col: t === "hazmat" || t === "bloater" ? "140,220,80" : "120,20,20" });
    if (t === "bloater" || t === "hazmat") pushDecal({ k: "goo", x: cx + 6, y: cy + 8, r: z.w * 0.7, rot: Math.random() * 3, t0: T, life: 12 });
    if (z.boss) {
      screenFlash = 0.8; flashCol = "255,80,220"; cam.shake = Math.min(cam.shake + 18, 30);
      pushFx({ k: "ring", x: cx, y: cy, r0: 20, r1: 320, col: "255,80,220", t: 0, d: 0.8, w: 14 });
      pushFx({ k: "fireball", x: cx, y: cy, r: 110, t: 0, d: 0.9, light: 300, tint: "255,60,200" });
      pushFx({ k: "text", x: cx, y: cy - 60, txt: "BOSS SLAIN!", col: "#ff6ae0", t: 0, d: 1.6, big: true });
    }
  }

  // ============================================================ DRAW: ZOMBIES
  window.drawZoms = function () {
    var cur = new Set();
    for (var i = 0; i < zoms.length; i++) cur.add(zoms[i]);
    seenZ.forEach(function (z) { if (!cur.has(z) && z.hp <= 0) zombieDied(z); });
    seenZ = cur;

    var px = p.x + p.w / 2;
    // sort by y so lower zombies overlap upper ones
    var list = zoms.slice().sort(function (a, b) { return (a.y + a.h) - (b.y + b.h); });
    for (i = 0; i < list.length; i++) {
      var z = list[i];
      if (z._t === undefined) { z._t = z.boss ? "boss" : ZKEYS[(Math.random() * ZKEYS.length) | 0]; z._php = z.hp; z._fl = 0; z._f = 1; z._st = Math.random() * 3; }
      if (z.hp < z._php - 0.9) {
        var dmg = z._php - z.hp; z._fl = 1;
        if (fx.length < 380 && T - (z._nt || -1) > 0.14 && (z._nt = T)) pushFx({ k: "num", x: z.x + z.w / 2 + (Math.random() - 0.5) * 14, y: z.y, vx: (Math.random() - 0.5) * 40, vy: -70, drag: 0.2, txt: String(Math.round(dmg)), t: 0, d: 0.75, crit: dmg >= 100 });
        if (fx.length < 380) for (var k = 0; k < 3; k++) pushFx({ k: "blood", x: z.x + z.w / 2, y: z.y + z.h / 2, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, drag: 0.1, t: 0, d: 0.4 });
      }
      z._php = z.hp;
      if (z._fl > 0) z._fl = Math.max(0, z._fl - DT * 7);
      if (!onScreen(z.x, z.y, z.w, z.h, 80)) continue;
      var zx = z.x - cam.x + z.w / 2, zy = z.y - cam.y + z.h / 2, s = Math.round(z.w);
      z._f = (px > z.x + z.w / 2) ? 1 : -1;
      var fr = (((z.walk / TAU) * FRAMES) | 0) % FRAMES; if (fr < 0) fr += FRAMES;
      var bob = Math.abs(Math.sin(z.walk)) * -2;
      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.beginPath(); ctx.ellipse(zx, zy + s * 0.58, s * 0.42 * (ZT[z._t].build), s * 0.14, 0, 0, TAU); ctx.fill();
      if (z.boss) drawBossTelegraph(z, zx, zy, s);
      var spr = sprite(z._t, s, fr, null);
      ctx.save(); ctx.translate(zx, zy + bob); ctx.scale(z._f, 1);
      ctx.drawImage(spr, -spr.ox, -spr.oy);
      if (z.frozen > 0) { ctx.globalAlpha = 0.5; ctx.drawImage(sprite(z._t, s, fr, "rgba(150,210,255,1)"), -spr.ox, -spr.oy); ctx.globalAlpha = 1; }
      if (z.burn > 0) { ctx.globalAlpha = 0.28 + 0.12 * Math.sin(T * 30); ctx.drawImage(sprite(z._t, s, fr, "rgba(255,110,30,1)"), -spr.ox, -spr.oy); ctx.globalAlpha = 1; }
      if (z._fl > 0) { ctx.globalAlpha = z._fl * (z.boss ? 0.35 : 0.75); ctx.drawImage(sprite(z._t, s, fr, "#ffffff"), -spr.ox, -spr.oy); ctx.globalAlpha = 1; }
      ctx.restore();
      if (z.frozen > 0) { // ice crystals
        ctx.strokeStyle = "rgba(220,245,255,0.85)"; ctx.lineWidth = 1.3;
        for (k = 0; k < 3; k++) { var ix = zx + Math.cos(k * 2.1 + z._st) * s * 0.35, iy = zy + Math.sin(k * 2.1 + z._st) * s * 0.3; ctx.beginPath(); ctx.moveTo(ix - 3, iy); ctx.lineTo(ix + 3, iy); ctx.moveTo(ix, iy - 3); ctx.lineTo(ix, iy + 3); ctx.stroke(); }
      }
      if (z.burn > 0 && !frozenGame() && Math.random() < 0.5) pushFx({ k: "flame", x: z.x + z.w / 2 + (Math.random() - 0.5) * s * 0.5, y: z.y + z.h * 0.3, vx: 0, vy: -50, drag: 0.5, t: 0, d: 0.45, r: 4 + Math.random() * 4 });
      // health bar
      if ((z.maxHp > 1 || z.boss) && !z.boss) {
        var hw = 30, hpz = Math.max(0, z.hp / z.maxHp), bx = zx - hw / 2, by = zy - s * 0.95;
        ctx.fillStyle = "rgba(0,0,0,0.7)"; rrect(ctx, bx - 1, by - 1, hw + 2, 5, 2); ctx.fill();
        ctx.fillStyle = hpz > 0.5 ? "#5ee05e" : hpz > 0.25 ? "#ffd23f" : "#ff4040"; rrect(ctx, bx, by, hw * hpz, 3, 1.5); ctx.fill();
      }
    }
  };

  function drawBossTelegraph(z, zx, zy, s) {
    var pcx = p.x + p.w / 2 - cam.x, pcy = p.y + p.h / 2 - cam.y;
    var a = Math.atan2(pcy - zy, pcx - zx), dist = Math.hypot(pcx - zx, pcy - zy);
    var cyc = (T * 0.7 + z._st) % 1;   // stomp cycle
    // charge lane: pulsing chevrons from boss toward the player
    ctx.save(); ctx.translate(zx, zy + s * 0.4); ctx.rotate(a);
    var len = Math.min(dist, 260);
    var lg = ctx.createLinearGradient(0, 0, len, 0);
    lg.addColorStop(0, "rgba(255,30,80,0.32)"); lg.addColorStop(1, "rgba(255,30,80,0)");
    ctx.fillStyle = lg; ctx.fillRect(0, -s * 0.32, len, s * 0.64);
    ctx.strokeStyle = "rgba(255,70,110,0.75)"; ctx.lineWidth = 3;
    for (var i = 0; i < 4; i++) {
      var cx = ((i * 0.25 + T * 0.9) % 1) * len;
      ctx.globalAlpha = 1 - cx / len;
      ctx.beginPath(); ctx.moveTo(cx - 8, -12); ctx.lineTo(cx + 4, 0); ctx.lineTo(cx - 8, 12); ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1;
    // contact zone + stomp shockwave telegraph
    ctx.save(); ctx.translate(zx, zy + s * 0.45); ctx.scale(1, 0.45);
    ctx.strokeStyle = "rgba(255,40,90," + (0.35 + 0.35 * cyc) + ")"; ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]); ctx.lineDashOffset = -T * 40; ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,40,90," + (0.08 + cyc * 0.2) + ")"; ctx.beginPath(); ctx.arc(0, 0, s * 0.85 * cyc, 0, TAU); ctx.fill();
    ctx.restore();
    if (cyc < z._lc && !frozenGame()) {  // stomp landed
      pushFx({ k: "ring", x: z.x + z.w / 2, y: z.y + z.h * 0.95, r0: s * 0.3, r1: s * 1.3, col: "255,70,120", t: 0, d: 0.4, w: 5, flat: true });
      for (i = 0; i < 6; i++) pushFx({ k: "smoke", x: z.x + z.w / 2 + (Math.random() - 0.5) * s, y: z.y + z.h * 0.95, vx: (Math.random() - 0.5) * 120, vy: -20, drag: 0.2, r: 8, t: 0, d: 0.6, col: "70,60,60" });
      cam.shake = Math.min(cam.shake + 3, 8);
    }
    z._lc = cyc;
    // aura
    ctx.globalCompositeOperation = "lighter";
    var ag = ctx.createRadialGradient(zx, zy, 0, zx, zy, s * 1.1);
    ag.addColorStop(0, "rgba(200,40,255,0.22)"); ag.addColorStop(1, "rgba(200,40,255,0)");
    ctx.fillStyle = ag; ctx.fillRect(zx - s * 1.1, zy - s * 1.1, s * 2.2, s * 2.2);
    ctx.globalCompositeOperation = "source-over";
  }

  // ============================================================ DRAW: PLAYER
  window.drawPlayer = function () {
    var ps = playerScreen(), px = ps.x, py = ps.y, s = p.w;
    var cx = px + s / 2, cy = py + s / 2;
    var ax = p.mx - cam.x, ay = p.my - cam.y;
    var ang = Math.atan2(ay - cy, ax - cx), f = Math.cos(ang) >= 0 ? 1 : -1;
    var la = Math.atan2(Math.sin(ang), Math.cos(ang) * f);  // local aim angle when mirrored
    var blink = p.invul && Math.floor(Date.now() / 60) % 2;
    var t = T, ph = walkPh, sw = moving ? Math.sin(ph) : 0, breathe = Math.sin(t * 3) * 0.6;
    // aim reticle + faint laser
    ctx.strokeStyle = "rgba(160,140,255,0.18)"; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ax, ay); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(t * 1.5);
    ctx.strokeStyle = "rgba(190,170,255,0.9)"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.stroke();
    for (var i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(17, 0); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = "#fff"; ctx.fillRect(ax - 1, ay - 1, 2, 2);
    // powerup auras
    var hasSpd = p.powerups.some(function (q) { return q.type === "speed"; }), hasDmg = p.powerups.some(function (q) { return q.type === "damage"; });
    ctx.globalCompositeOperation = "lighter";
    if (hasDmg) { var dg = ctx.createRadialGradient(cx, cy, 4, cx, cy, s * 1.4); dg.addColorStop(0, "rgba(255,40,40," + (0.25 + 0.1 * Math.sin(t * 10)) + ")"); dg.addColorStop(1, "rgba(255,40,40,0)"); ctx.fillStyle = dg; ctx.fillRect(cx - s * 1.4, cy - s * 1.4, s * 2.8, s * 2.8); }
    if (hasSpd && moving) { ctx.strokeStyle = "rgba(80,240,255,0.5)"; ctx.lineWidth = 2; for (i = 0; i < 4; i++) { var oy = -s * 0.4 + i * s * 0.27; ctx.beginPath(); ctx.moveTo(cx - f * s * 0.5, cy + oy); ctx.lineTo(cx - f * (s * 0.9 + (i % 2) * 8), cy + oy); ctx.stroke(); } }
    ctx.globalCompositeOperation = "source-over";
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.58, s * 0.42, s * 0.14, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(cx, cy); ctx.scale(f, 1);
    if (blink) ctx.globalAlpha = 0.45;
    var u = s / 35;
    // legs
    function leg(sg, dark) {
      var a = sg * sw * 0.6, hipY = s * 0.12, L = s * 0.22;
      var kx = Math.sin(a) * L, ky = hipY + Math.cos(a) * L, fx2 = kx + Math.sin(a - Math.max(0, sg * Math.cos(ph)) * 0.7) * L, fy2 = ky + L * 0.95;
      limb(ctx, 0, hipY, kx, ky, s * 0.16, dark ? "#3c4630" : "#56633f", true);
      limb(ctx, kx, ky, fx2, fy2, s * 0.14, dark ? "#3c4630" : "#56633f", true);
      blob(ctx, fx2 + s * 0.05, fy2 + s * 0.02, s * 0.11, s * 0.055, "#1d1712");
    }
    leg(-1, true);
    // backpack
    blob(ctx, -s * 0.25, -s * 0.08 + breathe * 0.3, s * 0.17, s * 0.24, "#6b4a2a");
    ctx.fillStyle = "#4e351d"; ctx.fillRect(-s * 0.36, -s * 0.02, s * 0.2, s * 0.05);
    blob(ctx, -s * 0.33, -s * 0.3, s * 0.1, s * 0.06, "#3d5a3a");   // bedroll
    leg(1, false);
    // torso: jacket + vest
    var tg = ctx.createLinearGradient(-s * 0.2, 0, s * 0.25, 0); tg.addColorStop(0, "#1f3a44"); tg.addColorStop(1, "#2f6273");
    ctx.fillStyle = tg; rrect(ctx, -s * 0.2, -s * 0.32 + breathe * 0.4, s * 0.42, s * 0.48, s * 0.1); ctx.fill();
    ctx.strokeStyle = "rgba(8,8,10,0.8)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "#3b3d34"; rrect(ctx, -s * 0.12, -s * 0.26 + breathe * 0.4, s * 0.3, s * 0.34, s * 0.06); ctx.fill();   // vest
    ctx.fillStyle = "#2c2e27"; ctx.fillRect(-s * 0.08, -s * 0.06, s * 0.1, s * 0.1); ctx.fillRect(s * 0.05, -s * 0.06, s * 0.1, s * 0.1);  // pouches
    ctx.fillStyle = "#6d4aff"; ctx.fillRect(-s * 0.12, s * 0.1, s * 0.34, s * 0.04);   // belt (theme colour)
    ctx.fillStyle = "#c9b45a"; ctx.fillRect(s * 0.02, s * 0.1, s * 0.05, s * 0.04);
    // head
    var hx = s * 0.04, hy = -s * 0.47 + breathe * 0.5;
    var hg = ctx.createRadialGradient(hx + s * 0.06, hy - s * 0.06, 1, hx, hy, s * 0.2); hg.addColorStop(0, "#f2c9a0"); hg.addColorStop(1, "#b9825a");
    blob(ctx, hx, hy, s * 0.17, s * 0.18, hg);
    ctx.fillStyle = "#5a3a22"; ctx.beginPath(); ctx.arc(hx - s * 0.03, hy - s * 0.02, s * 0.175, Math.PI * 0.75, Math.PI * 1.55); ctx.fill();   // hair back
    ctx.fillStyle = "#6d4aff"; ctx.beginPath(); ctx.arc(hx, hy - s * 0.04, s * 0.18, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();   // beanie
    ctx.fillStyle = "#5435d6"; ctx.fillRect(hx - s * 0.18, hy - s * 0.07, s * 0.36, s * 0.05);
    ctx.fillStyle = "#b9a8ff"; ctx.beginPath(); ctx.arc(hx - s * 0.02, hy - s * 0.23, s * 0.04, 0, TAU); ctx.fill();
    ctx.fillStyle = "#1a1010"; ctx.beginPath(); ctx.arc(hx + s * 0.09, hy + s * 0.01, s * 0.026, 0, TAU); ctx.fill();   // eye
    ctx.fillStyle = "#fff"; ctx.fillRect(hx + s * 0.085, hy - s * 0.005, 1, 1);
    ctx.strokeStyle = "#6b3f2a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx + s * 0.05, hy + s * 0.1); ctx.lineTo(hx + s * 0.12, hy + s * 0.09); ctx.stroke();
    ctx.fillStyle = "#8b2d2d"; ctx.fillRect(hx - s * 0.12, hy + s * 0.12, s * 0.26, s * 0.06);   // scarf
    // gun arm (rotates to aim)
    var w = gs.equipped.length ? gs.equipped[gs.equipped.length - 1] : null;
    ctx.save(); ctx.translate(s * 0.05, -s * 0.18 + breathe * 0.4); ctx.rotate(la);
    var recoil = muzzle * 3 * u;
    ctx.translate(-recoil, 0);
    limb(ctx, 0, 0, s * 0.3, s * 0.02, s * 0.12, "#2f6273", true);
    blob(ctx, s * 0.34, s * 0.03, s * 0.07, s * 0.065, "#e0b48c");
    drawGun(w, s);
    if (muzzle > 0.05 && w) {
      var gl = gunLen(w, s);
      ctx.globalCompositeOperation = "lighter";
      var mg = ctx.createRadialGradient(gl, 0, 0, gl, 0, 18 * muzzle + 6);
      mg.addColorStop(0, "rgba(255,255,230,0.95)"); mg.addColorStop(0.4, hexA(muzzleCol, 0.7)); mg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(gl, 0, 18 * muzzle + 6, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,240,180," + muzzle + ")"; ctx.beginPath(); ctx.moveTo(gl, -4 * muzzle); ctx.lineTo(gl + 22 * muzzle, 0); ctx.lineTo(gl, 4 * muzzle); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
    ctx.restore();
    ctx.globalAlpha = 1;
    // invulnerability shield
    if (p.invul) {
      ctx.globalCompositeOperation = "lighter";
      var sg = ctx.createRadialGradient(cx, cy - 2, s * 0.5, cx, cy - 2, s * 1.05);
      sg.addColorStop(0, "rgba(255,215,0,0)"); sg.addColorStop(0.85, "rgba(255,215,0,0.25)"); sg.addColorStop(1, "rgba(255,215,0,0)");
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy - 2, s * 1.05, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(255,230,120," + (0.4 + 0.3 * Math.sin(t * 12)) + ")"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy - 2, s * 0.95, t * 3, t * 3 + 4.5); ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    }
  };
  function gunLen(w, s) {
    if (!w) return s * 0.5;
    var id = w.id;
    if (/sniper|railgun|infinity|laser|deathray/.test(id)) return s * 0.95;
    if (/rifle|minigun|shotgun|crossbow|freezer|flame|galaxy|chaos|reality|godslayer|vampire|omega/.test(id)) return s * 0.8;
    if (/rocket|gl|nuclear|blackhole|time/.test(id)) return s * 0.85;
    return s * 0.58;
  }
  function drawGun(w, s) {
    var L = gunLen(w, s), col = w ? w.color : "#ccc", id = w ? w.id : "pistol";
    if (col === "#000000") col = "#2a1a3a";
    var x0 = s * 0.28;
    ctx.fillStyle = "#1c1c20";
    if (/rocket|gl|nuclear|blackhole|time/.test(id)) {
      var tg = ctx.createLinearGradient(0, -6, 0, 6); tg.addColorStop(0, shadeAny(col, 40)); tg.addColorStop(1, shadeAny(col, -40));
      ctx.fillStyle = tg; rrect(ctx, x0 - 8, -6, L - x0 + 8, 12, 4); ctx.fill(); ctx.strokeStyle = "#111"; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = "#111"; ctx.fillRect(L - 4, -7, 5, 14); ctx.fillRect(x0 + 4, 5, 5, 6);
    } else if (/minigun/.test(id)) {
      ctx.fillStyle = "#2a2a2e"; rrect(ctx, x0 - 4, -6, 14, 12, 3); ctx.fill();
      ctx.fillStyle = col; for (var b = -1; b <= 1; b++) ctx.fillRect(x0 + 8, b * 3.2 - 1.2, L - x0 - 6, 2.4);
      ctx.fillStyle = "#555"; ctx.fillRect(L - 6, -5, 3, 10);
    } else {
      ctx.fillStyle = "#1c1c20"; rrect(ctx, x0 - 2, -3.5, L - x0 + 2, 7, 2); ctx.fill();
      ctx.fillStyle = col; ctx.fillRect(x0 + 3, -3.5, (L - x0) * 0.6, 3);
      ctx.fillStyle = "#1c1c20"; ctx.fillRect(x0 + 2, 2, 4, 6);   // grip
      if (L > s * 0.7) { ctx.fillRect(x0 - 8, -2, 8, 5); ctx.fillStyle = "#333"; ctx.fillRect(x0 + (L - x0) * 0.35, -6, 6, 3); }   // stock + scope
      if (/laser|deathray|infinity|freezer|vampire|galaxy|godslayer/.test(id)) { ctx.fillStyle = hexA(col, 0.9); ctx.fillRect(L - 6, -2, 6, 4); }
    }
  }
  function hexA(hex, a) {
    if (!hex || hex[0] !== "#") return "rgba(255,255,255," + a + ")";
    var h = hex.slice(1); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16); return "rgba(" + (n >> 16) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
  }
  function shadeAny(hex, d) { var h = hex.slice(1); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; return adjust("#" + h, d); }

  // ============================================================ DRAW: BULLETS
  window.drawBlts = function () {
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < blts.length; i++) {
      var b = blts[i];
      if (!onScreen(b.x, b.y, 4, 4, 60)) continue;
      var x = b.x - cam.x, y = b.y - cam.y, sp = Math.hypot(b.vx, b.vy) || 1, nx = b.vx / sp, ny = b.vy / sp, col = b.color === "#000000" ? "#a060ff" : b.color, id = b.wid;
      if (b.special === "burn") {
        var age = b.age / 40, r = 5 + Math.min(1, age) * 12;
        var fg = ctx.createRadialGradient(x, y, 0, x, y, r);
        fg.addColorStop(0, "rgba(255,240,170," + (0.9 - age * 0.5) + ")"); fg.addColorStop(0.45, "rgba(255,120,20," + (0.6 - age * 0.3) + ")"); fg.addColorStop(1, "rgba(160,20,0,0)");
        ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        continue;
      }
      if (b.special === "freeze" || b.special === "timewarp") {
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(ny, nx));
        ctx.fillStyle = "rgba(160,230,255,0.35)"; ctx.fillRect(-26, -3, 26, 6);
        ctx.fillStyle = b.special === "timewarp" ? "#ff8cff" : "#dff8ff"; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(0, -4); ctx.lineTo(-6, 0); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
        ctx.restore();
        continue;
      }
      if (id === "crossbow") {
        ctx.globalCompositeOperation = "source-over";
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(ny, nx));
        ctx.strokeStyle = "#6b4a2a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.fillStyle = "#cfd3da"; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(5, -3); ctx.lineTo(5, 3); ctx.fill();
        ctx.fillStyle = "#c33"; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-18, -4); ctx.lineTo(-10, 0); ctx.lineTo(-18, 4); ctx.fill();
        ctx.restore(); ctx.globalCompositeOperation = "lighter";
        continue;
      }
      var beam = b.special === "pierce" || b.special === "instant";
      var len = beam ? Math.min(140, sp * 3.2) : Math.min(46, sp * 2.4);
      var wdt = beam ? (b.godly ? 6 : 4) : (b.godly ? 4 : 2.6);
      var tx = x - nx * len, ty = y - ny * len;
      var lg = ctx.createLinearGradient(tx, ty, x, y);
      lg.addColorStop(0, "rgba(0,0,0,0)"); lg.addColorStop(1, hexA(col, beam ? 0.55 : 0.45));
      ctx.strokeStyle = lg; ctx.lineCap = "round"; ctx.lineWidth = wdt * 2.6; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      var lg2 = ctx.createLinearGradient(tx, ty, x, y);
      lg2.addColorStop(0, "rgba(255,255,255,0)"); lg2.addColorStop(1, "rgba(255,255,255,0.95)");
      ctx.strokeStyle = lg2; ctx.lineWidth = wdt * 0.8; ctx.beginPath(); ctx.moveTo(x - nx * len * 0.6, y - ny * len * 0.6); ctx.lineTo(x, y); ctx.stroke();
      if (b.special === "lifesteal") { ctx.fillStyle = "rgba(255,30,60,0.8)"; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fill(); }
      else if (b.special === "storm") { star(x, y, 5, col); }
      else { ctx.fillStyle = hexA(col, 0.9); ctx.beginPath(); ctx.arc(x, y, wdt * 0.9, 0, TAU); ctx.fill(); }
    }
    ctx.globalCompositeOperation = "source-over";
  };
  function star(x, y, r, col) {
    ctx.fillStyle = hexA(col, 0.9); ctx.beginPath();
    for (var i = 0; i < 10; i++) { var a = i / 10 * TAU + T * 6, rr = i % 2 ? r * 0.4 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }

  // ============================================================ DRAW: PICKUPS
  var PU = {
    health: { c: "#3dff7a", g: "61,255,122" }, speed: { c: "#38e8ff", g: "56,232,255" }, damage: { c: "#ff4a4a", g: "255,74,74" },
    ammo: { c: "#ffd23f", g: "255,210,63" }, invincible: { c: "#ffffff", g: "255,240,200" }
  };
  window.drawPups = function () {
    var t = Date.now();
    for (var i = 0; i < pups.length; i++) {
      var pu = pups[i];
      if (!onScreen(pu.x, pu.y, pu.w, pu.h, 50)) continue;
      var x = pu.x - cam.x + pu.w / 2, y = pu.y - cam.y + pu.h / 2, el = t - pu.t0, left = pu.dur - el;
      if (left < 2000 && Math.floor(t / 120) % 2) continue;
      var st = PU[pu.type] || PU.ammo, bob = Math.sin(el * 0.005) * 4;
      // ground ring
      ctx.save(); ctx.translate(x, y + 12); ctx.scale(1, 0.4);
      ctx.strokeStyle = hexA(st.c, 0.6); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 18 + Math.sin(el * 0.008) * 3, 0, TAU); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.ellipse(x, y + 13, 11, 4, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      var g = ctx.createRadialGradient(x, y + bob, 0, x, y + bob, 30);
      g.addColorStop(0, "rgba(" + st.g + ",0.45)"); g.addColorStop(1, "rgba(" + st.g + ",0)");
      ctx.fillStyle = g; ctx.fillRect(x - 30, y + bob - 30, 60, 60);
      ctx.globalCompositeOperation = "source-over";
      ctx.save(); ctx.translate(x, y + bob);
      // light beam
      var bg = ctx.createLinearGradient(0, -60, 0, 0); bg.addColorStop(0, "rgba(" + st.g + ",0)"); bg.addColorStop(1, "rgba(" + st.g + ",0.25)");
      ctx.fillStyle = bg; ctx.fillRect(-6, -60, 12, 60);
      if (pu.type === "health") {
        rrect(ctx, -11, -9, 22, 18, 4); ctx.fillStyle = "#f4f4f4"; ctx.fill(); ctx.strokeStyle = "#555"; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = "#e02828"; ctx.fillRect(-2.5, -6, 5, 12); ctx.fillRect(-6, -2.5, 12, 5);
        ctx.fillStyle = "#999"; ctx.fillRect(-4, -12, 8, 3);
      } else if (pu.type === "speed") {
        ctx.fillStyle = "#0b3a48"; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill(); ctx.strokeStyle = st.c; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = st.c; ctx.beginPath(); ctx.moveTo(2, -8); ctx.lineTo(-5, 1); ctx.lineTo(0, 1); ctx.lineTo(-2, 8); ctx.lineTo(5, -1); ctx.lineTo(0, -1); ctx.closePath(); ctx.fill();
      } else if (pu.type === "damage") {
        ctx.fillStyle = "#3a0b0b"; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(10, -6); ctx.lineTo(8, 8); ctx.lineTo(0, 12); ctx.lineTo(-8, 8); ctx.lineTo(-10, -6); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = st.c; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#ffdede"; ctx.beginPath(); ctx.arc(0, -1, 5, 0, TAU); ctx.fill(); ctx.fillRect(-3, 3, 6, 3);
        ctx.fillStyle = "#3a0b0b"; ctx.beginPath(); ctx.arc(-2, -1, 1.4, 0, TAU); ctx.arc(2, -1, 1.4, 0, TAU); ctx.fill();
      } else if (pu.type === "ammo") {
        rrect(ctx, -11, -7, 22, 14, 2); ctx.fillStyle = "#4b5a2a"; ctx.fill(); ctx.strokeStyle = "#232a12"; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = "#e7c34a"; for (var k = -1; k <= 1; k++) { ctx.fillRect(k * 6 - 1.5, -12, 3, 7); ctx.beginPath(); ctx.arc(k * 6, -12, 1.5, 0, TAU); ctx.fill(); }
        ctx.fillStyle = "#ffd23f"; ctx.font = "bold 7px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("AMMO", 0, 1);
      } else {
        ctx.fillStyle = "#3a3320"; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(10, -8); ctx.quadraticCurveTo(10, 6, 0, 12); ctx.quadraticCurveTo(-10, 6, -10, -8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#ffe27a"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#ffe27a"; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, -4); ctx.quadraticCurveTo(5, 4, 0, 8); ctx.closePath(); ctx.fill();
      }
      // sparkle
      var sa = el * 0.004;
      ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(Math.cos(sa) * 14 - 1, Math.sin(sa) * 9 - 1, 2, 2);
      ctx.restore();
    }
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
  };

  // ============================================================ DRAW: PARTICLES + FX
  window.drawParts = function () {
    var cx = cam.x, cy = cam.y, i;
    // game particles (muzzle puffs, hit sparks) -> glowing sparks
    ctx.globalCompositeOperation = "lighter";
    for (i = 0; i < parts.length; i++) {
      var pr = parts[i];
      if (!onScreen(pr.x, pr.y, pr.size, pr.size, 10)) continue;
      var a = clamp(pr.life / 60, 0, 1);
      ctx.fillStyle = hexA(pr.color === "#000000" ? "#a060ff" : pr.color, a * 0.9);
      ctx.beginPath(); ctx.arc(pr.x - cx, pr.y - cy, Math.max(0.6, pr.size * 0.7), 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    for (i = 0; i < bloods.length; i++) {
      var b = bloods[i];
      if (!onScreen(b.x, b.y, b.size, b.size, 10)) continue;
      ctx.globalAlpha = b.alpha; ctx.fillStyle = "#7a0505";
      ctx.beginPath(); ctx.arc(b.x - cx, b.y - cy, b.size * 0.8, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,120,120,0.5)"; ctx.fillRect(b.x - cx - b.size * 0.3, b.y - cy - b.size * 0.4, 1, 1);
    }
    ctx.globalAlpha = 1;
    // own fx
    for (i = 0; i < fx.length; i++) drawFx(fx[i], cx, cy);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  };

  function drawFx(e, cx, cy) {
    var x = e.x - cx, y = e.y - cy, k = e.t / e.d;
    if (x < -400 || y < -400 || x > VW + 400 || y > VH + 400) return;
    switch (e.k) {
      case "fireball": {
        ctx.globalCompositeOperation = "lighter";
        var r = e.r * (0.4 + 0.6 * Math.sqrt(k)), a = 1 - k;
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        if (e.tint) { g.addColorStop(0, "rgba(255,255,255," + a + ")"); g.addColorStop(0.35, "rgba(" + e.tint + "," + a * 0.8 + ")"); g.addColorStop(1, "rgba(" + e.tint + ",0)"); }
        else { g.addColorStop(0, "rgba(255,250,220," + a + ")"); g.addColorStop(0.3, "rgba(255,190,60," + a * 0.9 + ")"); g.addColorStop(0.7, "rgba(230,70,10," + a * 0.5 + ")"); g.addColorStop(1, "rgba(120,20,0,0)"); }
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        break;
      }
      case "ring": {
        var rr = lerp(e.r0, e.r1, 1 - Math.pow(1 - k, 2));
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(" + e.col + "," + (1 - k) * 0.85 + ")"; ctx.lineWidth = (e.w || 3) * (1 - k) + 1;
        ctx.beginPath(); if (e.flat) ctx.ellipse(x, y, rr, rr * 0.45, 0, 0, TAU); else ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
        break;
      }
      case "smoke": {
        var sr = e.r * (1 + k * 1.8);
        ctx.fillStyle = "rgba(" + e.col + "," + (0.45 * (1 - k)) + ")";
        ctx.beginPath(); ctx.arc(x, y, sr, 0, TAU); ctx.fill();
        break;
      }
      case "spark": {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(" + e.col + "," + (1 - k) + ")"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - e.vx * 0.04, y - e.vy * 0.04); ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
        break;
      }
      case "impact": {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = hexA(e.col === "#000000" ? "#a060ff" : e.col, 1 - k); ctx.lineWidth = 1.5;
        for (var i = 0; i < 4; i++) {
          var aa = e.a + Math.PI + (i - 1.5) * 0.5, l = 4 + k * 12;
          ctx.beginPath(); ctx.moveTo(x + Math.cos(aa) * l * 0.4, y + Math.sin(aa) * l * 0.4); ctx.lineTo(x + Math.cos(aa) * l, y + Math.sin(aa) * l); ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
        break;
      }
      case "gib": {
        ctx.save(); ctx.translate(x, y - e.h); ctx.rotate(e.rot);
        ctx.globalAlpha = clamp((e.d - e.t) / 0.4, 0, 1);
        ctx.fillStyle = e.col; ctx.fillRect(-e.sz, -e.sz * 0.6, e.sz * 2, e.sz * 1.2);
        ctx.fillStyle = "rgba(90,0,0,0.8)"; ctx.fillRect(-e.sz, -e.sz * 0.6, e.sz * 0.6, e.sz * 1.2);
        ctx.restore(); ctx.globalAlpha = 1;
        if (e.h > 2) { ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(x, y, e.sz, e.sz * 0.4, 0, 0, TAU); ctx.fill(); }
        break;
      }
      case "shell": {
        ctx.save(); ctx.translate(x, y - e.h); ctx.rotate(e.rot);
        ctx.fillStyle = "#e1b84a"; ctx.fillRect(-2, -1, 4, 2);
        ctx.restore();
        break;
      }
      case "blood": {
        ctx.fillStyle = "rgba(150,10,10," + (1 - k) + ")"; ctx.beginPath(); ctx.arc(x, y, 2.2 * (1 - k) + 0.6, 0, TAU); ctx.fill();
        break;
      }
      case "flame": {
        ctx.globalCompositeOperation = "lighter";
        var fr = e.r * (1 - k * 0.6);
        var fg = ctx.createRadialGradient(x, y, 0, x, y, fr);
        fg.addColorStop(0, "rgba(255,230,140," + (1 - k) + ")"); fg.addColorStop(0.5, "rgba(255,110,20," + (0.7 - k * 0.6) + ")"); fg.addColorStop(1, "rgba(200,30,0,0)");
        ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, y, fr, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        break;
      }
      case "puff": {
        ctx.fillStyle = "rgba(" + e.col + "," + (0.5 * (1 - k)) + ")";
        for (var j = 0; j < 6; j++) { var pa = j / 6 * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(pa) * e.r * k * 0.7, y + Math.sin(pa) * e.r * k * 0.5, e.r * 0.35 * (1 - k * 0.5), 0, TAU); ctx.fill(); }
        break;
      }
      case "num": {
        var sc = k < 0.15 ? 0.6 + k / 0.15 * 0.7 : 1.3 - Math.min(0.3, (k - 0.15));
        ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
        ctx.globalAlpha = 1 - Math.max(0, (k - 0.6) / 0.4);
        ctx.font = "900 " + (e.crit ? 17 : 13) + "px Impact, 'Arial Black', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 3; ctx.strokeStyle = "#1a0505"; ctx.strokeText(e.txt, 0, 0);
        ctx.fillStyle = e.crit ? "#ffd23f" : "#fff"; ctx.fillText(e.txt, 0, 0);
        ctx.restore(); ctx.globalAlpha = 1;
        break;
      }
      case "text": {
        ctx.save(); ctx.translate(x, y - k * 40); var s2 = k < 0.1 ? k * 10 : 1; ctx.scale(s2, s2);
        ctx.globalAlpha = 1 - Math.max(0, (k - 0.7) / 0.3);
        ctx.font = "900 34px Impact, 'Arial Black', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 6; ctx.strokeStyle = "#1a0012"; ctx.strokeText(e.txt, 0, 0); ctx.fillStyle = e.col; ctx.fillText(e.txt, 0, 0);
        ctx.restore(); ctx.globalAlpha = 1;
        break;
      }
      case "vortex": {
        ctx.save(); ctx.translate(x, y);
        var vr = e.r * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) * 0.9);
        var vg = ctx.createRadialGradient(0, 0, 0, 0, 0, vr);
        vg.addColorStop(0, "rgba(0,0,0,0.95)"); vg.addColorStop(0.45, "rgba(30,0,60,0.8)"); vg.addColorStop(1, "rgba(80,20,160,0)");
        ctx.fillStyle = vg; ctx.beginPath(); ctx.arc(0, 0, vr, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "rgba(190,110,255,0.7)"; ctx.lineWidth = 2;
        for (var q = 0; q < 5; q++) { ctx.beginPath(); ctx.arc(0, 0, vr * (0.3 + q * 0.14), e.t * 9 + q, e.t * 9 + q + 1.6); ctx.stroke(); }
        ctx.restore(); ctx.globalCompositeOperation = "source-over";
        break;
      }
      case "heal": {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(80,255,140," + (1 - k) + ")";
        for (var hh = 0; hh < 6; hh++) { var hx = x + Math.cos(hh * 1.05) * 18, hy = y - k * 40 + Math.sin(hh * 2.1) * 10; ctx.fillRect(hx - 1, hy - 4, 2, 8); ctx.fillRect(hx - 4, hy - 1, 8, 2); }
        ctx.globalCompositeOperation = "source-over";
        break;
      }
    }
  }

  // ============================================================ DRAW: OVERLAY (ambience + HUD + panels)
  window.drawOverlay = function () {
    // drifting fog
    if (!fogPat) fogPat = ctx.createPattern(fogTex, "repeat");
    var fox = (cam.x * 0.6 + T * 14) % 256, foy = (cam.y * 0.6 + T * 5) % 256;
    ctx.save(); ctx.globalAlpha = 0.22;
    ctx.translate(-fox, -foy);
    ctx.fillStyle = fogPat; ctx.fillRect(fox, foy, VW, VH);
    ctx.restore();
    // embers
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < embers.length; i++) {
      var e = embers[i];
      if (simDT > 0) { e.y -= e.v; e.x += Math.sin(T * 1.3 + e.ph) * 0.3; if (e.y < -5) { e.y = VH + 5; e.x = Math.random() * VW; } }
      ctx.fillStyle = "rgba(" + e.c + "," + (0.25 + 0.25 * Math.sin(T * 3 + e.ph)) + ")";
      ctx.fillRect(e.x, e.y, e.s, e.s);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(vignette, 0, 0);
    // low-HP / hurt pulse
    var low = p.hp / p.maxHp < 0.3 ? (0.35 + 0.25 * Math.sin(T * 6)) : 0;
    var hv = Math.max(low, hurtFlash * 0.8);
    if (hv > 0.01) {
      var rg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.3, VW / 2, VH / 2, VW * 0.62);
      rg.addColorStop(0, "rgba(255,0,0,0)"); rg.addColorStop(1, "rgba(200,0,0," + hv * 0.6 + ")");
      ctx.fillStyle = rg; ctx.fillRect(0, 0, VW, VH);
    }
    if (screenFlash > 0) { ctx.fillStyle = "rgba(" + flashCol + "," + screenFlash * 0.55 + ")"; ctx.fillRect(0, 0, VW, VH); }
    drawBossIndicators();
    drawHUD();
    if (gs.over) drawPanel("GAME OVER", "#ff3b4a", [
      ["SCORE", gs.score], ["BEST", highScore], ["LEVEL", gs.level], ["KILLS", gs.totalKills]
    ], "Press R to Restart");
    if (gs.paused) drawPanel("PAUSED", "#a58bff", null, "Press ESC to Resume");
  };

  function drawPanel(title, col, rows, hint) {
    ctx.fillStyle = "rgba(4,3,10,0.72)"; ctx.fillRect(0, 0, VW, VH);
    var w = 420, h = rows ? 300 : 170, x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    var g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, "rgba(40,30,70,0.95)"); g.addColorStop(1, "rgba(14,10,26,0.95)");
    rrect(ctx, x, y, w, h, 18); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = col; ctx.fillRect(x + 30, y + 74, w - 60, 2);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "900 52px Impact, 'Arial Black', sans-serif";
    ctx.lineWidth = 6; ctx.strokeStyle = "#0a0614"; ctx.strokeText(title, VW / 2, y + 42); ctx.fillStyle = col; ctx.fillText(title, VW / 2, y + 42);
    if (rows) {
      for (var i = 0; i < rows.length; i++) {
        var rx = x + 40 + (i % 2) * (w / 2 - 20), ry = y + 104 + Math.floor(i / 2) * 70;
        rrect(ctx, rx, ry, w / 2 - 60, 56, 10); ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fill();
        ctx.fillStyle = "#9e95c4"; ctx.font = "800 11px Arial"; ctx.fillText(rows[i][0], rx + (w / 2 - 60) / 2, ry + 16);
        ctx.fillStyle = rows[i][0] === "BEST" ? "#ffd23f" : "#fff"; ctx.font = "900 22px Impact, 'Arial Black', sans-serif"; ctx.fillText(String(rows[i][1]), rx + (w / 2 - 60) / 2, ry + 38);
      }
    }
    ctx.fillStyle = "rgba(255,255,255," + (0.6 + 0.4 * Math.sin(Date.now() * 0.006)) + ")"; ctx.font = "800 16px Arial";
    ctx.fillText(hint, VW / 2, y + h - 26);
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
  }

  function drawBossIndicators() {
    var boss = null;
    for (var i = 0; i < zoms.length; i++) if (zoms[i].boss) { boss = zoms[i]; break; }
    if (!boss) { bossBarTrail = 1; return; }
    var bx = boss.x + boss.w / 2 - cam.x, by = boss.y + boss.h / 2 - cam.y;
    if (bx < -10 || by < -10 || bx > VW + 10 || by > VH + 10) {
      var a = Math.atan2(by - VH / 2, bx - VW / 2), m = 34;
      var ex = clamp(VW / 2 + Math.cos(a) * VW, m, VW - m), ey = clamp(VH / 2 + Math.sin(a) * VH, m, VH - m);
      var pulse = 0.6 + 0.4 * Math.sin(T * 8);
      ctx.save(); ctx.translate(ex, ey);
      ctx.fillStyle = "rgba(40,0,20,0.8)"; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(255,50,110," + pulse + ")"; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.rotate(a); ctx.fillStyle = "rgba(255,50,110," + pulse + ")"; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(20, -8); ctx.lineTo(20, 8); ctx.fill();
      ctx.rotate(-a); ctx.fillStyle = "#ffd6e6"; ctx.font = "16px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("☠", 0, -1);
      ctx.font = "800 9px Arial"; ctx.fillText(Math.round(Math.hypot(boss.x - p.x, boss.y - p.y) / 10) + "m", 0, 30);
      ctx.restore();
    }
    // boss health bar
    var hp = clamp(boss.hp / boss.maxHp, 0, 1);
    bossBarTrail = Math.max(hp, bossBarTrail - DT * 0.4);
    var w = 420, x = VW / 2 - w / 2, y = 74;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "900 14px Impact, 'Arial Black', sans-serif"; ctx.fillStyle = "#ff6ab0"; ctx.lineWidth = 3; ctx.strokeStyle = "#1a0010";
    ctx.strokeText("THE ABOMINATION", VW / 2, y - 10); ctx.fillText("THE ABOMINATION", VW / 2, y - 10);
    rrect(ctx, x - 3, y - 3, w + 6, 16, 6); ctx.fillStyle = "rgba(10,0,8,0.85)"; ctx.fill(); ctx.strokeStyle = "rgba(255,80,160,0.7)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.fillRect(x, y, w * bossBarTrail, 10);
    var bg = ctx.createLinearGradient(0, y, 0, y + 10); bg.addColorStop(0, "#ff5ad0"); bg.addColorStop(1, "#8a0a6a");
    ctx.fillStyle = bg; ctx.fillRect(x, y, w * hp, 10);
    ctx.fillStyle = "rgba(0,0,0,0.4)"; for (var s = 1; s < 10; s++) ctx.fillRect(x + w * s / 10, y, 1, 10);
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
  }

  function drawHUD() {
    if (gs.over) return;
    // --- HP panel (top-left)
    var hpR = clamp(p.hp / p.maxHp, 0, 1);
    hpTrail = hpTrail > p.hp ? Math.max(p.hp, hpTrail - DT * 60) : p.hp;
    var tr = clamp(hpTrail / p.maxHp, 0, 1);
    var x = 14, y = 14, w = 210, shake = hurtFlash > 0 ? (Math.random() - 0.5) * 6 * hurtFlash : 0;
    ctx.save(); ctx.translate(shake, 0);
    rrect(ctx, x, y, w + 46, 34, 10); ctx.fillStyle = "rgba(8,6,16,0.72)"; ctx.fill(); ctx.strokeStyle = "rgba(160,140,255,0.35)"; ctx.lineWidth = 1; ctx.stroke();
    heart(x + 20, y + 17, 8 + (hpR < 0.3 ? Math.sin(T * 10) * 1.2 : 0));
    var bx = x + 36, by = y + 10;
    rrect(ctx, bx, by, w, 14, 7); ctx.fillStyle = "#2a0e14"; ctx.fill();
    ctx.save(); rrect(ctx, bx, by, w, 14, 7); ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(bx, by, w * tr, 14);
    var hg = ctx.createLinearGradient(0, by, 0, by + 14);
    if (hpR > 0.5) { hg.addColorStop(0, "#7dff8a"); hg.addColorStop(1, "#1f9a3a"); } else if (hpR > 0.25) { hg.addColorStop(0, "#ffe27a"); hg.addColorStop(1, "#c08a10"); } else { hg.addColorStop(0, "#ff7a7a"); hg.addColorStop(1, "#a01020"); }
    ctx.fillStyle = hg; ctx.fillRect(bx, by, w * hpR, 14);
    ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(bx, by, w * hpR, 4);
    ctx.fillStyle = "rgba(0,0,0,0.25)"; for (var s = 1; s < 10; s++) ctx.fillRect(bx + w * s / 10, by, 1, 14);
    ctx.restore();
    ctx.font = "800 10px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff";
    ctx.fillText(Math.max(0, Math.floor(p.hp)) + " / " + p.maxHp, bx + w / 2, by + 7.5);
    ctx.restore();
    // powerup chips
    var nowMs = Date.now(), cx2 = x;
    for (var i = 0; i < p.powerups.length; i++) {
      var q = p.powerups[i], st = PU[q.type]; if (!st || !q.exp) continue;
      var left = clamp((q.exp - nowMs) / 5000, 0, 1);
      rrect(ctx, cx2, y + 40, 70, 18, 9); ctx.fillStyle = "rgba(8,6,16,0.72)"; ctx.fill(); ctx.strokeStyle = st.c; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = hexA(st.c, 0.35); rrect(ctx, cx2 + 2, y + 42, 66 * left, 14, 7); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "800 9px Arial"; ctx.fillText(q.type.toUpperCase(), cx2 + 35, y + 49.5);
      cx2 += 76;
    }
    // --- level / kills progress (top centre)
    var kw = 260, kx = VW / 2 - kw / 2, ky = 14;
    rrect(ctx, kx - 40, ky, kw + 52, 30, 10); ctx.fillStyle = "rgba(8,6,16,0.72)"; ctx.fill(); ctx.strokeStyle = "rgba(160,140,255,0.35)"; ctx.lineWidth = 1; ctx.stroke();
    // level badge
    ctx.save(); ctx.translate(kx - 22, ky + 15); ctx.rotate(Math.PI / 4);
    var lg = ctx.createLinearGradient(-12, -12, 12, 12); lg.addColorStop(0, "#b9a6ff"); lg.addColorStop(1, "#4b2bd0");
    ctx.fillStyle = lg; ctx.fillRect(-11, -11, 22, 22); ctx.strokeStyle = "#e6deff"; ctx.lineWidth = 1.5; ctx.strokeRect(-11, -11, 22, 22);
    ctx.restore();
    ctx.fillStyle = "#fff"; ctx.font = "900 13px Impact, 'Arial Black', sans-serif"; ctx.fillText(String(gs.level), kx - 22, ky + 16);
    var kr = clamp(gs.kills / gs.killsNeed, 0, 1);
    rrect(ctx, kx, ky + 9, kw, 12, 6); ctx.fillStyle = "#16112a"; ctx.fill();
    if (kr > 0) {
      ctx.save(); rrect(ctx, kx, ky + 9, kw, 12, 6); ctx.clip();
      var kg = ctx.createLinearGradient(kx, 0, kx + kw, 0); kg.addColorStop(0, "#5a3dff"); kg.addColorStop(1, "#c07bff");
      ctx.fillStyle = kg; ctx.fillRect(kx, ky + 9, kw * kr, 12);
      var shx = kx + ((T * 160) % (kw + 60)) - 30; ctx.fillStyle = "rgba(255,255,255,0.28)"; ctx.beginPath(); ctx.moveTo(shx, ky + 9); ctx.lineTo(shx + 14, ky + 9); ctx.lineTo(shx + 6, ky + 21); ctx.lineTo(shx - 8, ky + 21); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = "#fff"; ctx.font = "800 9px Arial"; ctx.fillText(gs.kills + " / " + gs.killsNeed + " KILLS", kx + kw / 2, ky + 15.5);
    // --- score (top right)
    var sc = 1 + scorePop * 0.25;
    ctx.save(); ctx.translate(VW - 16, 30); ctx.scale(sc, sc);
    ctx.textAlign = "right"; ctx.font = "900 22px Impact, 'Arial Black', sans-serif"; ctx.lineWidth = 4; ctx.strokeStyle = "#0a0614";
    var stxt = gs.score.toLocaleString(); ctx.strokeText(stxt, 0, 0); ctx.fillStyle = scorePop > 0.1 ? "#fff6b0" : "#fff"; ctx.fillText(stxt, 0, 0);
    ctx.restore();
    ctx.textAlign = "right"; ctx.font = "800 9px Arial"; ctx.fillStyle = "#ffd23f"; ctx.fillText("BEST " + highScore.toLocaleString(), VW - 16, 50);
    // --- weapon slots (bottom centre)
    var n = gs.equipped.length;
    if (n) {
      var sz = 40, gap = 6, tw = n * sz + (n - 1) * gap, sx = VW / 2 - tw / 2, sy = VH - sz - 12, RC = { common: "#9a9a9a", uncommon: "#4caf50", rare: "#2196f3", epic: "#b04ad0", legendary: "#ffb020", godly: "#00e5ff", universal: "#ff2a8a" };
      for (i = 0; i < n; i++) {
        var w2 = gs.equipped[i], ox = sx + i * (sz + gap), rc = RC[w2.rarity] || "#999";
        var last = p.lastFire[w2._fk || w2.id] || 0, cd = clamp((nowMs - last) / w2.fireRate, 0, 1);
        rrect(ctx, ox, sy, sz, sz, 8); ctx.fillStyle = "rgba(8,6,16,0.8)"; ctx.fill();
        ctx.strokeStyle = rc; ctx.lineWidth = 2; ctx.stroke();
        if (cd < 1) {
          ctx.save(); rrect(ctx, ox, sy, sz, sz, 8); ctx.clip();
          ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.beginPath(); ctx.moveTo(ox + sz / 2, sy + sz / 2); ctx.arc(ox + sz / 2, sy + sz / 2, sz, -Math.PI / 2 + cd * TAU, -Math.PI / 2 + TAU); ctx.closePath(); ctx.fill();
          ctx.restore();
        } else { ctx.fillStyle = hexA(rc.length === 7 ? rc : "#999999", 0.15); rrect(ctx, ox, sy, sz, sz, 8); ctx.fill(); }
        ctx.font = "20px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff";
        ctx.fillText(w2.icon, ox + sz / 2, sy + sz / 2 + 1);
      }
    }
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
  }
  function heart(x, y, r) {
    ctx.save(); ctx.translate(x, y);
    var g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, "#ff7a8a"); g.addColorStop(1, "#c0102a");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, r * 0.9);
    ctx.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.7, -r * 1.2, 0, -r * 0.4);
    ctx.bezierCurveTo(r * 0.7, -r * 1.2, r * 1.4, -r * 0.1, 0, r * 0.9); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.beginPath(); ctx.arc(-r * 0.4, -r * 0.35, r * 0.2, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ============================================================ MINIMAP
  window.drawMini = function () {
    var mw = mc.width, mh = mc.height, s = mw / C.worldW;
    var g = mctx.createRadialGradient(mw / 2, mh / 2, 10, mw / 2, mh / 2, mw * 0.7);
    g.addColorStop(0, "#14131f"); g.addColorStop(1, "#08070e");
    mctx.fillStyle = g; mctx.fillRect(0, 0, mw, mh);
    // local roads hint
    mctx.save(); mctx.translate(mw / 2 - p.x * s, mh / 2 - p.y * s);
    mctx.fillStyle = "rgba(120,120,130,0.25)";
    ROADS_H.forEach(function (r) { mctx.fillRect(0, (r.y - r.w / 2) * s, C.worldW * s, r.w * s); });
    ROADS_V.forEach(function (r) { mctx.fillRect((r.x - r.w / 2) * s, 0, r.w * s, C.worldH * s); });
    mctx.strokeStyle = "rgba(160,140,255,0.4)"; mctx.strokeRect(0, 0, C.worldW * s, C.worldH * s);
    mctx.restore();
    // radar sweep
    var sa = (Date.now() * 0.002) % TAU;
    var sg = mctx.createRadialGradient(mw / 2, mh / 2, 0, mw / 2, mh / 2, mw / 2);
    sg.addColorStop(0, "rgba(109,74,255,0.25)"); sg.addColorStop(1, "rgba(109,74,255,0)");
    mctx.fillStyle = sg; mctx.beginPath(); mctx.moveTo(mw / 2, mh / 2); mctx.arc(mw / 2, mh / 2, mw / 2, sa - 0.6, sa); mctx.closePath(); mctx.fill();
    mctx.strokeStyle = "rgba(109,74,255,0.25)"; mctx.lineWidth = 1;
    mctx.beginPath(); mctx.arc(mw / 2, mh / 2, mw * 0.2, 0, TAU); mctx.moveTo(mw / 2 + mw * 0.4, mh / 2); mctx.arc(mw / 2, mh / 2, mw * 0.4, 0, TAU); mctx.stroke();
    mctx.strokeStyle = "rgba(255,255,255,0.35)"; mctx.strokeRect(mw / 2 - C.vw * s / 2, mh / 2 - C.vh * s / 2, C.vw * s, C.vh * s);
    zoms.forEach(function (z) {
      var rx = (z.x - p.x) * s + mw / 2, ry = (z.y - p.y) * s + mh / 2;
      if (rx > 0 && rx < mw && ry > 0 && ry < mh) {
        if (z.boss) { mctx.fillStyle = "rgba(255,60,200," + (0.5 + 0.5 * Math.sin(Date.now() * 0.01)) + ")"; mctx.beginPath(); mctx.arc(rx, ry, 6, 0, TAU); mctx.fill(); }
        mctx.fillStyle = z.boss ? "#ff4ad0" : "#ff4a4a"; mctx.beginPath(); mctx.arc(rx, ry, z.boss ? 4 : 2.2, 0, TAU); mctx.fill();
      }
    });
    pups.forEach(function (pu) {
      var rx = (pu.x - p.x) * s + mw / 2, ry = (pu.y - p.y) * s + mh / 2;
      if (rx > 0 && rx < mw && ry > 0 && ry < mh) { mctx.fillStyle = (PU[pu.type] || PU.ammo).c; mctx.fillRect(rx - 2, ry - 2, 4, 4); }
    });
    var a = Math.atan2(p.my - p.y, p.mx - p.x);
    mctx.save(); mctx.translate(mw / 2, mh / 2); mctx.rotate(a);
    mctx.fillStyle = "#b9a6ff"; mctx.beginPath(); mctx.moveTo(7, 0); mctx.lineTo(-5, -5); mctx.lineTo(-2, 0); mctx.lineTo(-5, 5); mctx.closePath(); mctx.fill();
    mctx.restore();
  };

  // ============================================================ LEVEL-UP CARDS
  var RCOL = { common: "#a0a0a0", uncommon: "#4caf50", rare: "#2196f3", epic: "#b04ad0", legendary: "#ffb020", godly: "#00e5ff", universal: "#ff2a8a" };
  var SPEC = { explosion: "Area blast", burn: "Sets on fire", pierce: "Pierces", lifesteal: "Life steal", freeze: "Slows", nuke: "Nuclear blast", blackhole: "Gravity well", multi: "Multi blast", storm: "Star storm", instant: "Instant kill", chaos: "Chaos blast", timewarp: "Time freeze", random: "Random blast" };
  window.renderWeaponChoice = function () {
    var c = document.getElementById("wopts");
    c.innerHTML = "";
    var rl = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary", godly: "GODLY", universal: "UNIVERSAL" };
    var rc = { common: "rc", uncommon: "ru", rare: "rr", epic: "re", legendary: "rl", godly: "rg", universal: "ruv" };
    currentChoices.forEach(function (w, i) {
      var isSelected = (selectedWeapon === i) ? " selected" : "";
      var d = document.createElement("div");
      d.className = "wcard " + w.rarity + isSelected;
      d.style.setProperty("--rc", RCOL[w.rarity] || "#888");
      d.style.animationDelay = (i * 0.08) + "s";
      if (isSelected) d.style.animationDelay = "0s";
      d.onclick = function () { clickChoice(i); };
      var owned = gs.equipped.filter(function (e) { return e.id === w.id; }).length;
      var dmg = clamp(Math.log10(Math.max(1, w.damage * w.projCount)) / Math.log10(5000), 0.05, 1);
      var rate = clamp(1 - Math.log(w.fireRate / 50) / Math.log(100), 0.05, 1);
      var spd = clamp(w.vMult / 8, 0.05, 1);
      function row(lbl, v, txt) { return '<div class="wc-row"><span>' + lbl + '</span><div class="wc-bar"><i style="width:' + Math.round(v * 100) + '%"></i></div><b>' + txt + '</b></div>'; }
      d.innerHTML = '<div class="wc-head"></div><div class="wc-medal">' + w.icon + '</div><div class="wc-body">' +
        '<div class="wname">' + w.name + '</div>' +
        '<span class="wrar ' + rc[w.rarity] + '">' + rl[w.rarity] + '</span>' + (owned ? '<span class="wc-tag">OWNED x' + owned + '</span>' : '<span class="wc-tag" style="background:#7dff9a">NEW</span>') +
        '<div class="wc-stats">' + row("DMG", dmg, w.damage + (w.projCount > 1 ? "x" + w.projCount : "")) + row("RATE", rate, (1000 / w.fireRate).toFixed(1) + "/s") + row("SPEED", spd, "x" + w.vMult) + '</div>' +
        (w.special ? '<div class="wc-special">★ ' + (SPEC[w.special] || w.special) + '</div>' : '') +
        '<div class="wdesc">' + w.desc + ' (DMG: ' + w.damage + ' | SPD: ' + w.fireRate + 'ms)</div></div>';
      c.appendChild(d);
    });
    var counter = document.getElementById("selCounter");
    var confirmBtn = document.getElementById("confirmBtn");
    if (selectedWeapon !== null) {
      counter.innerHTML = "✅ Selected: " + currentChoices[selectedWeapon].name + " — Click Confirm to add it!";
      counter.style.color = "#5dff8a";
      confirmBtn.style.opacity = "1";
      confirmBtn.style.pointerEvents = "auto";
    } else {
      counter.innerHTML = "Click to select, or double-click to add instantly (arsenal: " + gs.equipped.length + "/" + MAX_WEAPONS + ")";
      counter.style.color = "#b9a6ff";
      confirmBtn.style.opacity = "0.5";
      confirmBtn.style.pointerEvents = "none";
    }
    var rerollBtn = document.querySelector(".reroll-btn");
    if (rerollsLeft > 0) {
      rerollBtn.textContent = "Reroll (" + rerollsLeft + " left)";
      rerollBtn.style.opacity = "1"; rerollBtn.style.pointerEvents = "auto";
    } else {
      rerollBtn.textContent = "No Rerolls Left";
      rerollBtn.style.opacity = "0.4"; rerollBtn.style.pointerEvents = "none";
    }
  };

  window.__zsSprite = sprite;
  window.showMsg = function (big, small) {
    var m = document.createElement("div");
    m.className = "zs-banner" + (/BOSS/.test(big) ? " boss" : "");
    var b = document.createElement("div"); b.className = "big"; b.textContent = big;
    m.appendChild(b);
    if (small) { var s = document.createElement("div"); s.className = "small"; s.textContent = small; m.appendChild(s); }
    document.body.appendChild(m);
    setTimeout(function () { m.remove(); }, 3000);
  };
})();

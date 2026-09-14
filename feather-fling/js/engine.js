/* Feather Fling — physics world, damage, explosions, particles, camera, rendering.
 * Physics runs in planck.js (a Box2D port) in metres with y up. */
(function () {
  'use strict';
  var pl = window.planck, ART = window.ART;

  var MATERIAL = {
    wood:  { density: 0.7, friction: 0.7, restitution: 0.08, hp: 9,  score: 500, chips: ['#e0a45c', '#a8652c', '#f3c887'], kind: 'chip' },
    stone: { density: 2.4, friction: 0.8, restitution: 0.02, hp: 24, score: 800, chips: ['#a3adb8', '#6f7a86', '#cdd4dc'], kind: 'chip' },
    ice:   { density: 0.9, friction: 0.25, restitution: 0.05, hp: 4, score: 300, chips: ['#bfe9ff', '#7cc6f0', '#ffffff'], kind: 'shard' }
  };
  var BANDIT_HP = { small: 3, mid: 5.5, helmet: 7, big: 10, boss: 45 };
  var BIRD_DENSITY = { rusty: 4, zip: 3.2, trio: 3.5, boomer: 4.5, tank: 5 };
  var GRACE = 1.2;          // seconds after load before impacts do damage
  var MIN_IMPULSE = 1.2;    // ignore resting contacts

  var E = window.FFEngine = {
    world: null, level: null, pal: null, t: 0,
    blocks: [], bandits: [], birds: [], particles: [],
    score: 0, cam: { x: 12, y: 5, zoom: 40, tx: 12, ty: 5, tz: 40 },
    extentX: 30, extentY: 8, onEvent: null
  };

  function emit(type, data) { if (E.onEvent) E.onEvent(type, data || {}); }
  function triArea(v) { return Math.abs((v[1][0] - v[0][0]) * (v[2][1] - v[0][1]) - (v[2][0] - v[0][0]) * (v[1][1] - v[0][1])) / 2; }

  /* ------------------------------------------------------------------ load */
  E.load = function (level) {
    E.level = level;
    E.pal = ART.theme(level.theme);
    E.t = 0; E.score = 0;
    E.blocks = []; E.bandits = []; E.birds = []; E.particles = [];
    E.pendingDestroy = [];
    var world = E.world = new pl.World({ gravity: pl.Vec2(0, -10) });

    var ground = world.createBody();
    ground.createFixture(pl.Edge(pl.Vec2(-60, 0), pl.Vec2(160, 0)), { friction: 0.9 });
    ground.setUserData({ kind: 'ground' });

    var maxX = 0, maxY = 0;
    level.pieces.forEach(function (p, i) {
      var ud, body;
      if (p.t === 'bandit') {
        var r = ART.BANDITS[p.k].r;
        body = world.createBody({ type: 'dynamic', position: pl.Vec2(p.x, p.y), angularDamping: 0.8 });
        body.createFixture(pl.Circle(r), { density: 0.8, friction: 0.6, restitution: 0.2 });
        ud = { kind: 'bandit', k: p.k, r: r, hp: BANDIT_HP[p.k], maxHp: BANDIT_HP[p.k], blinkAt: Math.random() * 3 };
        E.bandits.push(body);
        maxY = Math.max(maxY, p.y + r);
      } else {
        var m = MATERIAL[p.t === 'tnt' ? 'wood' : p.m];
        body = world.createBody({ type: 'dynamic', position: pl.Vec2(p.x, p.y), angle: p.a || 0 });
        var fd = { density: m.density, friction: m.friction, restitution: m.restitution };
        if (p.t === 'round') body.createFixture(pl.Circle(p.r), fd);
        else if (p.t === 'tri') body.createFixture(pl.Polygon(p.pts.map(function (v) { return pl.Vec2(v[0], v[1]); })), fd);
        else body.createFixture(pl.Box(p.w / 2, p.h / 2), fd);
        var area = p.t === 'round' ? Math.PI * p.r * p.r : p.t === 'tri' ? triArea(p.pts) : p.w * p.h;
        var hp = p.t === 'tnt' ? 2.5 : m.hp * Math.max(0.6, Math.min(2.2, area));
        ud = { kind: p.t === 'tnt' ? 'tnt' : 'block', shape: p.t, m: p.m || 'wood', w: p.w, h: p.h, r: p.r, pts: p.pts, hp: hp, maxHp: hp, seed: i * 7.3 };
        if (p.t === 'tri') { ud.w = 1; ud.h = 1; }
        E.blocks.push(body);
        maxY = Math.max(maxY, p.t === 'tri' ? p.y + 1 : p.y + (p.h || p.r * 2) / 2);
      }
      maxX = Math.max(maxX, p.x);
      body.setUserData(ud);
    });
    E.extentX = maxX + 4;
    E.extentY = Math.max(7, maxY + 2);

    world.on('post-solve', onPostSolve);
    E.flash = 0; E.dustBudget = 0;
    E.frameCam(true);
  };

  /* ---------------------------------------------------------------- damage */
  function onPostSolve(contact, impulse) {
    if (E.t < GRACE) return;
    var n = contact.getManifold().pointCount, imp = 0;
    for (var i = 0; i < n; i++) imp = Math.max(imp, impulse.normalImpulses[i]);
    if (imp < MIN_IMPULSE) return;
    var a = contact.getFixtureA().getBody(), b = contact.getFixtureB().getBody();
    if (imp > 5 && E.dustBudget > 0) {
      var wm = contact.getWorldManifold(null);
      if (wm && wm.points && wm.points[0]) {
        E.dustBudget--;
        var cp = wm.points[0];
        burst(cp.x, cp.y, 'dust', ['rgba(255,250,240,0.9)', 'rgba(220,205,180,0.9)'], 4, 0.18 + Math.min(0.3, imp * 0.01), 1.6);
      }
    }
    hurt(a, imp, b);
    hurt(b, imp, a);
  }

  function hurt(body, imp, other) {
    var ud = body.getUserData();
    if (!ud || ud.dead || ud.hp === undefined) return;
    var oud = other.getUserData() || {};
    var dmg = imp - MIN_IMPULSE;
    if (oud.kind === 'bird' && oud.type === 'zip' && ud.m === 'ice') dmg *= 1.8;
    if (oud.kind === 'bird' && oud.type === 'tank' && ud.m === 'stone') dmg *= 1.6;
    if (oud.kind === 'bird' && oud.type === 'trio' && ud.m === 'ice') dmg *= 1.5;
    ud.hp -= dmg;
    if (ud.kind === 'bandit' && dmg > 0.6) ud.ouch = 0.5;
    if (ud.hp <= 0) kill(body);
  }

  function kill(body) {
    var ud = body.getUserData();
    if (ud.dead) return;
    ud.dead = true;
    E.pendingDestroy.push(body);
  }

  function destroyPending() {
    var list = E.pendingDestroy; E.pendingDestroy = [];
    list.forEach(function (body) {
      var ud = body.getUserData(), p = body.getPosition();
      var x = p.x, y = p.y;
      if (ud.kind === 'bandit') {
        E.score += 5000;
        burst(x, y, 'puff', ['#ffffff', '#e6ecf2'], 9, ud.r * 0.9, 3);
        burst(x, y, 'spark', ['#ffd23f', '#ffffff'], 6, 0.18, 6);
        popup(x, y + ud.r, '5000', '#9dff7a', 0.9);
        E.bandits.splice(E.bandits.indexOf(body), 1);
        emit('bandit', { x: x, y: y });
      } else {
        var m = MATERIAL[ud.m] || MATERIAL.wood;
        var val = ud.kind === 'tnt' ? 1000 : m.score;
        E.score += val;
        var size = ud.shape === 'round' ? ud.r * 2 : Math.max(ud.w, ud.h);
        burst(x, y, m.kind, m.chips, Math.round(6 + size * 4), 0.12, 5);
        burst(x, y, 'puff', ['rgba(255,255,255,0.9)'], 3, 0.35, 1.5);
        popup(x, y, String(val), '#ffffff', 0.55);
        E.blocks.splice(E.blocks.indexOf(body), 1);
        emit('break', { m: ud.m });
        if (ud.kind === 'tnt') E.explode(x, y, 4.2, 55);
      }
      E.world.destroyBody(body);
    });
  }

  /* ------------------------------------------------------------- explosion */
  E.explode = function (x, y, radius, power) {
    burst(x, y, 'fire', ['#ffb13b'], 7, 1.1, 2.5);
    burst(x, y, 'puff', ['#ffb13b', '#ff6a1f', '#6f5f60', '#4a4040'], 20, 0.6, 6);
    burst(x, y, 'spark', ['#fff3a0', '#ffd23f'], 16, 0.22, 11);
    ring(x, y, radius, '#fff6d0', 0.55);
    ring(x, y, radius * 0.6, '#ffb13b', 0.4);
    E.shake = Math.max(E.shake || 0, 0.6);
    E.flash = Math.max(E.flash || 0, 0.35);
    emit('boom', { x: x, y: y });
    var all = E.blocks.concat(E.bandits);
    all.forEach(function (body) {
      var ud = body.getUserData();
      if (ud.dead) return;
      var c = body.getWorldCenter(), dx = c.x - x, dy = c.y - y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > radius) return;
      var f = 1 - d / radius, inv = 1 / Math.max(0.3, d);
      body.applyLinearImpulse(pl.Vec2(dx * inv * power * f * body.getMass() * 0.35, (dy * inv + 0.4) * power * f * body.getMass() * 0.35), c, true);
      ud.hp -= power * f * (ud.kind === 'bandit' ? 0.5 : 0.35);
      if (ud.hp <= 0) kill(body);
    });
  };

  /* ----------------------------------------------------------------- birds */
  E.addBird = function (type, x, y, r) {
    r = r || ART.BIRDS[type].r;
    var body = E.world.createBody({ type: 'dynamic', position: pl.Vec2(x, y), bullet: true, angularDamping: 1.2 });
    body.createFixture(pl.Circle(r), { density: BIRD_DENSITY[type], friction: 0.6, restitution: 0.3 });
    body.setUserData({ kind: 'bird', type: type, r: r, age: 0, still: 0, trail: [] });
    E.birds.push(body);
    return body;
  };

  E.removeBird = function (body) {
    var i = E.birds.indexOf(body);
    if (i < 0) return;
    var p = body.getPosition(), ud = body.getUserData();
    burst(p.x, p.y, 'feather', [ART.BIRDS[ud.type].base, ART.BIRDS[ud.type].belly], 8, 0.22, 3);
    burst(p.x, p.y, 'puff', ['#ffffff'], 4, 0.4, 1);
    E.birds.splice(i, 1);
    E.world.destroyBody(body);
  };

  /* ------------------------------------------------------------- particles */
  function burst(x, y, kind, cols, n, s, speed) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.9);
      var life = kind === 'puff' ? 0.6 + Math.random() * 0.5 : 0.9 + Math.random() * 0.8;
      E.particles.push({
        kind: kind, x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + (kind === 'puff' ? 0.5 : 2),
        a: Math.random() * 6, va: (Math.random() - 0.5) * 10, s: s * (0.6 + Math.random() * 0.8),
        col: cols[i % cols.length], life: life, max: life, grav: kind === 'puff' ? -0.6 : (kind === 'feather' ? 1.5 : 12)
      });
    }
  }
  function ring(x, y, r, col, life) {
    E.particles.push({ kind: 'ring', x: x, y: y, vx: 0, vy: 0, a: 0, va: 0, s: r, col: col, life: life, max: life, grav: 0 });
  }
  E.ring = ring;
  // Celebration confetti falling across the current view.
  E.confetti = function (n) {
    var tl = E.toWorld(0, 0), br = E.toWorld(W, H);
    var cols = ['#ff5a6e', '#ffd23f', '#3ec1ff', '#5fdc7a', '#c06bff', '#ffffff'];
    for (var i = 0; i < (n || 90); i++) {
      E.particles.push({ kind: 'confetti', x: tl.x + Math.random() * (br.x - tl.x), y: tl.y + Math.random() * 3,
        vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2, a: Math.random() * 6, va: (Math.random() - 0.5) * 12,
        s: 0.08 + Math.random() * 0.08, col: cols[i % cols.length], life: 3 + Math.random() * 2, max: 5, grav: 1.2 });
    }
  };
  function popup(x, y, text, col, size) {
    E.particles.push({ kind: 'text', text: text, x: x, y: y + 0.4, vx: 0, vy: 1.4, a: 0, va: 0, s: size, col: col, life: 1.2, max: 1.2, grav: 0 });
  }
  E.burst = burst;
  E.popup = popup;

  /* ------------------------------------------------------------------ step */
  E.step = function (dt) {
    E.t += dt;
    E.dustBudget = Math.min(6, E.dustBudget + 0.5);
    E.world.step(1 / 60, 10, 6);
    destroyPending();

    // anything that falls off the world or far away is gone
    E.blocks.concat(E.bandits).forEach(function (body) {
      var p = body.getPosition(), ud = body.getUserData();
      if (!ud.dead && (p.y < -5 || p.x > E.extentX + 40 || p.x < -30)) kill(body);
    });
    destroyPending();

    E.bandits.forEach(function (b) { var ud = b.getUserData(); if (ud.ouch > 0) ud.ouch -= dt; });

    for (var i = E.particles.length - 1; i >= 0; i--) {
      var p = E.particles[i];
      p.life -= dt;
      if (p.life <= 0) { E.particles.splice(i, 1); continue; }
      p.vy -= p.grav * dt;
      if (p.kind === 'feather' || p.kind === 'confetti') { p.vx *= 0.96; p.vy = Math.max(p.vy, p.kind === 'confetti' ? -2.2 : -1.2); p.vx += Math.sin(E.t * 3 + p.a) * 0.02; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
      if (p.y < 0.05 && p.grav > 0) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.7; }
    }
    if (E.shake) E.shake = Math.max(0, E.shake - dt);
    if (E.flash) E.flash = Math.max(0, E.flash - dt);
    if (E.introT > 0) E.introT = Math.max(0, E.introT - dt);
  };

  // Everything has come to rest (used to decide when a shot is over).
  E.settled = function () {
    var moving = 0;
    E.blocks.concat(E.bandits).forEach(function (b) {
      var v = b.getLinearVelocity();
      if (b.isAwake() && (v.x * v.x + v.y * v.y > 0.04 || Math.abs(b.getAngularVelocity()) > 0.2)) moving++;
    });
    return moving === 0 && E.pendingDestroy.length === 0;
  };

  /* ---------------------------------------------------------------- camera */
  var W = 1, H = 1;
  E.resize = function (w, h) { W = w; H = h; E.frameCam(true); };

  // Screen pixels kept below the ground line, so the bird cards never cover the scene.
  function groundMargin(z) { return Math.max(2.2 * z, 124); }

  // Frame the slingshot and the whole structure.
  E.frameCam = function (snap) {
    var x0 = -5.5, x1 = E.extentX + 2, y1 = E.extentY + 2;
    var z = Math.min(W / (x1 - x0), (H - 124) / (y1 + 1));
    E.cam.tz = Math.max(14, Math.min(60, z));
    E.cam.tx = (x0 + x1) / 2;
    E.cam.ty = (H / 2 - groundMargin(E.cam.tz)) / E.cam.tz;
    if (snap) { E.cam.x = E.cam.tx; E.cam.y = E.cam.ty; E.cam.zoom = E.cam.tz; }
  };

  E.followPoint = function (x, y) {
    var z = E.cam.tz;
    var minX = -5 + (W / 2) / z, maxX = E.extentX + 8 - (W / 2) / z;
    E.cam.tx = Math.max(minX, Math.min(Math.max(minX, maxX), x));
    E.cam.ty = Math.max((H / 2 - groundMargin(z)) / z, y - 1);
  };

  // Opening shot of a level: show the bandits' structure, then pan to the slingshot.
  E.startIntro = function () {
    E.frameCam(true);
    var z = Math.min(60, E.cam.tz * 1.35);
    E.cam.zoom = E.cam.tz = z;
    E.cam.x = E.cam.tx = E.extentX - 4 - (W / 2) / z * 0.35;
    E.cam.y = E.cam.ty = (H / 2 - groundMargin(z)) / z;
    E.introT = 2.2;
  };
  E.skipIntro = function () { if (E.introT > 0) { E.introT = 0; E.frameCam(false); } };

  E.updateCam = function (dt) {
    if (E.introT > 0 && E.introT < 1.3 && !E.introPanned) { E.introPanned = true; E.frameCam(false); }
    if (E.introT > 1.3) E.introPanned = false;
    var k = 1 - Math.pow(E.introT > 0 ? 0.12 : 0.02, dt);
    E.cam.x += (E.cam.tx - E.cam.x) * k;
    E.cam.y += (E.cam.ty - E.cam.y) * k;
    E.cam.zoom += (E.cam.tz - E.cam.zoom) * k;
  };

  // One shake offset per frame, so every piece moves together.
  var shakeX = 0, shakeY = 0;
  E.toScreen = function (x, y) {
    return { x: (x - E.cam.x) * E.cam.zoom + W / 2 + shakeX, y: (E.cam.y - y) * E.cam.zoom + H / 2 + shakeY };
  };
  E.toWorld = function (sx, sy) {
    return { x: (sx - W / 2) / E.cam.zoom + E.cam.x, y: E.cam.y - (sy - H / 2) / E.cam.zoom };
  };

  /* ---------------------------------------------------------------- render */
  function frameAt(ctx, x, y, angle) {
    var s = E.toScreen(x, y), z = E.cam.zoom;
    ctx.setTransform(z, 0, 0, z, s.x, s.y);
    if (angle) ctx.rotate(-angle);
  }
  E.frameAt = frameAt;

  // hooks: { behindSling(ctx), loaded(ctx), overlay(ctx) } supplied by the game.
  E.render = function (ctx, hooks) {
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    shakeX = E.shake ? (Math.random() - 0.5) * E.shake * 16 : 0;
    shakeY = E.shake ? (Math.random() - 0.5) * E.shake * 16 : 0;
    var g0 = E.toScreen(0, 0);
    ART.drawSky(ctx, W, H, E.pal, g0.y, E.t);
    ART.drawParallax(ctx, W, H, E.pal, E.cam, g0.y, E.t);

    function at(x, y, a, fn) {
      frameAt(ctx, x, y, a);
      var m = ctx.getTransform();
      ctx.setTransform(m.a * dpr, m.b * dpr, m.c * dpr, m.d * dpr, m.e * dpr, m.f * dpr);
      fn();
    }
    E.at = at;

    var left = E.toWorld(0, 0).x - 2, right = E.toWorld(W, 0).x + 2;
    at(0, 0, 0, function () {
      ART.drawGround(ctx, E.pal, left, right);
      // soft contact shadows for anything near the ground
      E.blocks.concat(E.bandits, E.birds).forEach(function (b) {
        var bp = b.getPosition(), u = b.getUserData();
        var half = u.kind === 'bandit' || u.kind === 'bird' ? u.r : u.shape === 'round' ? u.r : Math.max(u.w || 1, u.h || 1) / 2;
        var bottom = bp.y - (u.kind === 'bandit' || u.kind === 'bird' || u.shape === 'round' ? u.r : Math.min(u.w || 1, u.h || 1) / 2);
        if (bottom < 4) ART.drawShadow(ctx, bp.x, half, Math.max(0, bottom), E.pal.night);
      });
    });
    at(0, 0, 0, function () { ART.drawSlingBack(ctx); });
    if (hooks.behindSling) hooks.behindSling(at);

    E.blocks.forEach(function (b) {
      var p = b.getPosition(), ud = b.getUserData(), dmg = 1 - ud.hp / ud.maxHp;
      at(p.x, p.y, b.getAngle(), function () {
        if (ud.kind === 'tnt') ART.drawTNT(ctx, ud.w, ud.h, E.t);
        else if (ud.shape === 'round') ART.drawRound(ctx, ud.m, ud.r, dmg, ud.seed);
        else if (ud.shape === 'tri') ART.drawTri(ctx, ud.m, ud.pts.map(function (v) { return [v[0], -v[1]]; }), dmg, ud.seed);
        else ART.drawBlock(ctx, ud.m, ud.w, ud.h, dmg, ud.seed);
      });
    });

    E.bandits.forEach(function (b) {
      var p = b.getPosition(), ud = b.getUserData();
      var blink = ((E.t + ud.blinkAt) % 3.2) < 0.12;
      at(p.x, p.y, b.getAngle() * 0.35, function () {
        var bob = ud.ouch > 0 ? Math.sin(E.t * 50) * 0.05 : 0;
        ctx.translate(bob, 0);
        ART.drawBandit(ctx, ud.k, ud.r, { blink: blink, dmg: 1 - ud.hp / ud.maxHp, t: E.t + ud.blinkAt });
      });
    });

    E.birds.forEach(function (b) {
      var p = b.getPosition(), ud = b.getUserData(), v = b.getLinearVelocity();
      var ang = ud.launched ? Math.atan2(v.y, v.x) : 0;
      ud.trail.forEach(function (tp, i) {
        at(tp.x, tp.y, 0, function () {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(0, 0, i % 3 === 0 ? 0.11 : 0.07, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        });
      });
      at(p.x, p.y, ang, function () { ART.drawBird(ctx, ud.type, ud.r, { t: E.t, flap: ud.launched, blink: false }); });
    });

    if (hooks.loaded) hooks.loaded(at);
    at(0, 0, 0, function () { ART.drawSlingFront(ctx); });
    if (hooks.frontBand) hooks.frontBand(at);

    at(0, 0, 0, function () { ART.drawForeground(ctx, E.pal, left, right, E.t); });

    E.particles.forEach(function (p) {
      at(p.x, p.y, p.kind === 'text' || p.kind === 'ring' ? 0 : p.a, function () { ART.drawParticle(ctx, p); });
    });

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ART.drawVignette(ctx, W, H, E.pal.night);
    if (E.flash > 0) {
      ctx.fillStyle = 'rgba(255,248,225,' + Math.min(0.28, E.flash * 0.8) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    if (hooks.overlay) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); hooks.overlay(ctx); }
  };
})();

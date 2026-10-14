/**
 * Relic Road — the engine: loads a real city district, drops three relics at
 * real landmarks, and runs the walking, looking and finding.
 */
import * as THREE from 'three';
import { World, LIGHT_SCALE } from './world.js';
import { makeSky } from './sky.js';
import { Player } from './player.js';
import { Dust, Bursts, Ambient } from './fx.js';
import { makeRelic, makeMapTable } from './relics.js';
import { loadCity, buildCity, findPlace, openSpotNear, nearSolemn, isSolemn, walkableFrom } from './osmcity.js';
import { Roads } from './roads.js';
import { buildStreets } from './streets.js';
import { Life } from './life.js';
import { MiniMap } from './minimap.js';
import { facade } from './facade.js';
import { CITIES } from './cities.js';
import { clamp, damp, lerp } from './util.js';
import * as audio from './audio.js';

const SAVE = 'relicRoad.v1';
const REACH = 3.2;              // how close you must be to pick something up

/* What every city turns into after dark. The sky keeps a warm glow low on the
 * horizon, the way a lit city does, and the fog closes in. */
const NIGHT = {
  skyTop: 0x040816, skyHorizon: 0x1c2539, skyGround: 0x07090e, skyGlow: 0x6a4424,
  fog: 0x0e131e, fogFar: 1050, sun: 0x9fb2dc, sunIntensity: 0.55,
  ambient: 0x3a4666, ambientIntensity: 0.85, exposure: 1.32
};
/* Halfway between the two: the low gold light of evening. N steps through
 * day, evening and night; going from night back to day passes through it too. */
const DUSK = {
  skyTop: 0x2d4479, skyHorizon: 0xf2a46c, skyGround: 0x3b2d2a, skyGlow: 0xff9a5a,
  fog: 0xcf9f80, sun: 0xffa45c, sunIntensity: 3.4,
  ambient: 0x9a8496, ambientIntensity: 1.55, exposure: 1.2
};
const _cb = new THREE.Color(), _cc = new THREE.Color();
const smooth01 = t => t * t * (3 - 2 * t);
/** day -> dusk -> night as v goes 0 -> 0.5 -> 1 */
const mix = (a, b, t, out) => out.setHex(a).lerp(_cb.setHex(b), t);
const mix3 = (a, b, c, v, out) => v <= 0.5 ? out.setHex(a).lerp(_cb.setHex(b), smooth01(v * 2))
                                           : out.setHex(b).lerp(_cc.setHex(c), smooth01((v - 0.5) * 2));
const lerp3 = (a, b, c, v) => v <= 0.5 ? lerp(a, b, smooth01(v * 2)) : lerp(b, c, smooth01((v - 0.5) * 2));

/* Graphics quality. "auto" starts high and steps down while the frame rate
 * cannot keep up; G cycles through the fixed settings. Kept apart from the save. */
const QUALITY = {
  low:    { label: 'Low',    ratio: 1.0,  shadows: 0,    near: 70,  dust: 50 },
  medium: { label: 'Medium', ratio: 1.25, shadows: 1024, near: 120, dust: 110 },
  high:   { label: 'High',   ratio: 1.6,  shadows: 2048, near: 170, dust: 160 }
};
const QSAVE = 'relicRoad.quality';
const SHADOW_HALF = 75;            // metres of sun shadow either side of the player

export class Game {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.hud = hud;
    this.state = 'idle';        // idle | loading | ready | playing | paused | cleared
    this.cityIndex = 0;
    this.time = 0;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 2600);
    this.scene.add(this.camera);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.ambient = new THREE.HemisphereLight(0xffffff, 0x404040, 1);
    this.scene.add(this.sun, this.sun.target, this.ambient);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -SHADOW_HALF; sc.right = sc.top = SHADOW_HALF;
    sc.near = 20; sc.far = 1100;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.lightDir = new THREE.Vector3(0, 1, 0);
    this.moonDir = new THREE.Vector3(-0.35, 0.55, -0.75).normalize();

    // graphics quality: ?q=low|medium|high, else what was chosen last, else auto
    const qp = new URLSearchParams(location.search).get('q');
    let qs = 'auto';
    try { qs = localStorage.getItem(QSAVE) || 'auto'; } catch { /* private mode */ }
    this.qualityMode = QUALITY[qp] ? qp : (QUALITY[qs] ? qs : 'auto');
    this.quality = this.qualityMode === 'auto' ? 'high' : this.qualityMode;
    this.perf = { t: 0, n: 0, sum: 0 };

    this.player = new Player(this.camera, null);
    this.player.torchOn = false;
    this.player.torch.intensity = 0;

    this.input = { forward: 0, right: 0, jump: false, sprint: false, crouch: false };
    this.keys = new Set();
    this.relics = [];
    this.found = new Set();
    this.progress = this.load();

    // 0 = day, 1 = night; N eases between them
    this.night = 0;
    this.nightTarget = new URLSearchParams(location.search).has('night') ? 1 : 0;
    this.map = hud.mapCanvases ? new MiniMap(hud.mapCanvases.mini, hud.mapCanvases.big) : null;
    this.locT = 0;

    this.lockPending = false;
    this.lockChangedAt = 0;
    this.dragLook = false;
    this.bindInput();
    window.addEventListener('resize', () => this.resize());
  }

  /* ------------------------------------------------------------ progress */
  load() {
    try {
      return JSON.parse(localStorage.getItem(SAVE)) || { unlocked: 1, journal: {} };
    } catch {
      return { unlocked: 1, journal: {} };
    }
  }

  save() {
    try { localStorage.setItem(SAVE, JSON.stringify(this.progress)); } catch { /* private mode */ }
  }

  /* --------------------------------------------------------------- input */
  bindInput() {
    const setKey = (e, down) => {
      const k = e.code;
      if (down) this.keys.add(k); else this.keys.delete(k);
      if (down && k === 'KeyE') this.interact();
      if (down && k === 'KeyJ') this.hud.toggleJournal();
      if (down && k === 'KeyN' && this.state === 'playing' && !e.repeat) this.toggleNight();
      if (down && k === 'KeyM' && this.state === 'playing' && !e.repeat) this.map?.toggle();
      if (down && k === 'KeyG' && this.state === 'playing' && !e.repeat) this.cycleQuality();
      if (down && k === 'Escape' && this.state === 'playing') this.pause();
      const used = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                    'Space', 'ShiftLeft', 'ControlLeft', 'KeyE', 'KeyJ', 'KeyN', 'KeyM', 'KeyG'];
      if (used.includes(k)) e.preventDefault();
    };
    addEventListener('keydown', e => setKey(e, true));
    addEventListener('keyup', e => setKey(e, false));

    this.canvas.addEventListener('mousedown', e => {
      if (this.state !== 'playing') return;
      if (!this.locked) { this.lock(); this.dragLook = true; }
      if (e.button === 0) this.interact();
    });
    addEventListener('mouseup', () => { this.dragLook = false; });

    addEventListener('mousemove', e => {
      if (this.state !== 'playing') return;
      if (performance.now() - this.lockChangedAt < 120) return;       // ignore the jump after locking
      if (!this.locked && !this.dragLook) return;
      const dx = e.movementX || 0, dy = e.movementY || 0;
      if (Math.abs(dx) > 250 || Math.abs(dy) > 250) return;
      this.player.yaw -= dx * 0.0022;
      this.player.pitch = clamp(this.player.pitch - dy * 0.0022, -1.45, 1.45);
    });

    document.addEventListener('pointerlockchange', () => {
      this.lockPending = false;
      this.lockChangedAt = performance.now();
      this.hud.lockHint(this.state === 'playing' && !this.locked);
    });
    document.addEventListener('pointerlockerror', () => { this.lockPending = false; });
  }

  get locked() { return document.pointerLockElement === this.canvas; }

  lock() {
    if (this.locked || this.lockPending) return;
    this.lockPending = true;
    const p = this.canvas.requestPointerLock?.();
    if (p && p.catch) p.catch(() => { this.lockPending = false; });
  }

  readInput() {
    const k = this.keys;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    this.input.forward = f;
    this.input.right = r;
    this.input.jump = k.has('Space');
    this.input.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    this.input.crouch = k.has('ControlLeft') || k.has('KeyC');
  }

  /* -------------------------------------------------------------- levels */
  async start(index) {
    this.state = 'loading';
    this.cityIndex = index;
    const city = CITIES[index];
    this.hud.loading(0.05, `Reading the map of ${city.name}…`);

    this.clear();
    const data = await loadCity(city.id, p => this.hud.loading(p, `Reading the map of ${city.name}…`));
    this.data = data;

    const world = this.world = new World(this.scene, city.theme);
    this.hud.loading(0.55, `Building ${city.name}…`);
    await new Promise(r => setTimeout(r, 16));        // let the loading bar paint
    const roads = this.roads = new Roads(data);
    const { stats, detail } = buildCity(world, data, city.look, p => this.hud.loading(p, `Building ${city.name}…`), roads, city);
    this.cityDetail = detail;
    this.stats = stats;
    world.buildGrid();

    // lamps, trees, benches and road paint, placed against the buildings just
    // built; then the grid again, because lamp posts and trunks are solid too
    this.hud.loading(0.92, `Lighting the streets of ${city.name}…`);
    await new Promise(r => setTimeout(r, 16));
    this.streets = buildStreets(world, data, roads, city);
    world.buildGrid();
    stats.lamps = this.streets.lampCount;
    stats.trees = this.streets.treeCount;
    this.life = new Life(world, roads, city);
    this.map?.build(data);
    this.map?.toggle(false);

    // sky, light and fog for this city
    this.sky = makeSky(city.theme);
    this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog(city.theme.fog, city.theme.fogNear, city.theme.fogFar);
    this.scene.background = new THREE.Color(city.theme.fog);
    const [sx, sy, sz] = city.theme.sunDir;
    this.daySun = new THREE.Vector3(sx, sy, sz).normalize();
    this.sunOffset = this.daySun.clone().multiplyScalar(420);
    this.sun.color.setHex(city.theme.sun);
    this.sun.intensity = city.theme.sunIntensity;
    this.ambient.color.setHex(city.theme.ambient);
    this.ambient.groundColor.setHex(city.theme.fog);
    this.ambient.intensity = city.theme.ambientIntensity;
    this.renderer.toneMappingExposure = city.theme.exposure || 1;
    // arrive at whatever time of day you left the last city at
    this.night = this.nightTarget;
    this.applyNight(this.night);

    this.dust = new Dust(this.scene, 120, 26, 0xffe9c4, 0.035);
    this.bursts = new Bursts(this.scene);
    // what drifts through the air here: leaves, blown sand, birds overhead
    this.ambientFx = new Ambient(this.scene, city.ambient || {});
    this.applyQuality();

    // nothing is ever sited on a memorial or a burial ground
    const keepAway = (x, z) => nearSolemn(data, x, z, 80);

    // relics at real landmarks
    this.relics = [];
    this.found = new Set();
    city.relics.forEach((def, i) => {
      const place = findPlace(data, ...def.at);
      const base = place ? { x: place.x, z: place.z } : { x: (i - 1) * 120, z: 140 };
      const spot = openSpotNear(world, base.x, base.z, 70, keepAway);
      const model = makeRelic(i, 0xffd27a);
      model.position.set(spot.x, 0, spot.z);
      this.scene.add(model);
      this.relics.push({ def, model, pos: model.position, found: false, at: place ? place.n : city.name });
    });

    // the map table, hidden until all three are found
    const vp = findPlace(data, ...city.vault.at);
    const vBase = vp ? { x: vp.x + city.vault.offset[0], z: vp.z + city.vault.offset[1] }
                     : { x: city.vault.offset[0], z: city.vault.offset[1] };
    const vSpot = openSpotNear(world, vBase.x, vBase.z, 80, keepAway);
    this.table = makeMapTable();
    this.table.position.set(vSpot.x, 0, vSpot.z);
    this.table.visible = false;
    this.scene.add(this.table);

    // where the player starts
    const sp = findPlace(data, ...city.spawn.at);
    const sBase = sp ? { x: sp.x + city.spawn.offset[0], z: sp.z + city.spawn.offset[1] }
                     : { x: city.spawn.offset[0], z: city.spawn.offset[1] };
    const sSpot = openSpotNear(world, sBase.x, sBase.z, 90, keepAway);
    this.player.reset(new THREE.Vector3(sSpot.x, 0, sSpot.z), city.spawn.facing);

    // every relic, and the map table, must be somewhere you can walk to from
    // where you start: not inside a pyramid, not in a walled-off courtyard
    const walk = walkableFrom(world, data.half || 1000, sSpot.x, sSpot.z);
    this.walk = walk;
    if (walk.cells > 2000) {
      for (const obj of [...this.relics.map(r => r.model), this.table]) {
        const p = obj.position;
        if (walk.ok(p.x, p.z)) continue;
        const q = walk.nearest(p.x, p.z);
        if (q) p.set(q.x, 0, q.z);
      }
    }

    this.hud.loading(1, 'Ready');
    this.hud.city(city, index, stats, data.attribution);
    this.hud.journal(this.progress.journal[city.id] || []);
    this.hud.relicCount(0, 3);
    this.state = 'ready';
    this.resize();
    this.player.update(0.0001, { forward: 0, right: 0, jump: false, sprint: false, crouch: false }, this.world, 0);
    this.renderer.render(this.scene, this.camera);
    if (!this.running) this.loop();
  }

  play() {
    this.state = 'playing';
    this.lock();
    this.hud.lockHint(!this.locked);
    audio.unlock();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    document.exitPointerLock?.();
    this.map?.toggle(false);
    this.hud.pause(true);
  }

  /* ---------------------------------------------------------- day, night */
  toggleNight() {
    // day -> evening -> night -> morning
    const t = this.nightTarget;
    this.nightTarget = t < 0.25 ? 0.5 : t < 0.75 ? 1 : 0;
    const city = CITIES[this.cityIndex];
    this.hud.note(this.nightTarget === 0.5 ? `Evening in ${city.name}`
      : this.nightTarget ? `Night falls over ${city.name}` : `Morning in ${city.name}`);
  }

  /* ------------------------------------------------------------ quality */
  cycleQuality() {
    const order = ['auto', 'high', 'medium', 'low'];
    this.qualityMode = order[(order.indexOf(this.qualityMode) + 1) % order.length];
    this.quality = this.qualityMode === 'auto' ? 'high' : this.qualityMode;
    try { localStorage.setItem(QSAVE, this.qualityMode); } catch { /* private mode */ }
    this.applyQuality();
    this.hud.note(`Graphics · ${this.qualityMode === 'auto' ? 'Auto' : QUALITY[this.quality].label}`);
  }

  applyQuality() {
    const q = QUALITY[this.quality];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, q.ratio));
    this.resize();
    const shadows = q.shadows > 0;
    if (this.renderer.shadowMap.enabled !== shadows || this.sun.shadow.mapSize.x !== (q.shadows || 1024)) {
      this.renderer.shadowMap.enabled = shadows;
      this.sun.castShadow = shadows;
      this.sun.shadow.mapSize.set(q.shadows || 1024, q.shadows || 1024);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      // shadow maps change the shaders every lit material compiles to
      this.scene.traverse(o => {
        if (!o.material) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true;
      });
    }
    if (this.world) {
      for (const m of this.world.meshes) {
        if (m.userData.castsShadow) m.castShadow = shadows;
      }
    }
    if (this.streets) this.streets.sunShadows = shadows;
    if (this.world) this.applyNight(this.night);
    this.lodNear = q.near;
    this.dust?.setCount?.(q.dust);
    this.perf = { t: 0, n: 0, sum: 0 };
  }

  /** In auto mode, step down a level while frames keep running long. */
  watchPerf(dt) {
    if (this.qualityMode !== 'auto' || this.state !== 'playing') return;
    const p = this.perf;
    p.t += dt; p.n++; p.sum += dt;
    if (p.t < 4) return;
    const avg = p.sum / p.n;
    this.perf = { t: 0, n: 0, sum: 0 };
    if (avg > 1 / 42 && this.quality !== 'low') {
      this.quality = this.quality === 'high' ? 'medium' : 'low';
      this.applyQuality();
    }
  }

  /** Blend the whole city between its daylight and the shared night. */
  applyNight(v) {
    const th = CITIES[this.cityIndex].theme;
    const dusk = Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.15)), 1.3);
    const dark = smooth01(Math.max(0, Math.min(1, (v - 0.5) * 2)));

    // where the sun is: the city's own sun by day, sinking toward the horizon
    // in the evening; after dark the light comes from the moon instead
    const d = this.daySun || new THREE.Vector3(0.3, 0.9, 0.3).normalize();
    const az = Math.atan2(d.z, d.x), el0 = Math.asin(d.y);
    const el = v <= 0.5 ? lerp(el0, 0.11, smooth01(v * 2)) : lerp(0.11, -0.25, smooth01((v - 0.5) * 2));
    this.sunDir.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
    const toMoon = smooth01(Math.max(0, Math.min(1, (v - 0.58) / 0.22)));
    this.lightDir.copy(this.sunDir).lerp(this.moonDir, toMoon);
    if (this.lightDir.y < 0.08) this.lightDir.y = 0.08;
    this.lightDir.normalize();
    this.sunOffset = this.lightDir.clone().multiplyScalar(420);

    if (this.sky) {
      const u = this.sky.material.uniforms;
      mix3(th.skyTop, DUSK.skyTop, NIGHT.skyTop, v, u.top.value);
      mix3(th.skyHorizon, DUSK.skyHorizon, NIGHT.skyHorizon, v, u.horizon.value);
      mix3(th.skyGround, DUSK.skyGround, NIGHT.skyGround, v, u.ground.value);
      mix3(th.skyGlow || 0, DUSK.skyGlow, NIGHT.skyGlow, v, u.glow.value);
      mix3(th.sun, DUSK.sun, DUSK.sun, v, u.sunColor.value);
      u.sunDir.value.copy(this.sunDir);
      u.moonDir.value.copy(this.moonDir);
      u.night.value = dark;
      u.dusk.value = dusk;
      u.stars.value = Math.max(0, v - 0.55) * 2.6;
      // what the window glass reflects
      facade.skyTop.value.copy(u.top.value);
      facade.skyHorizon.value.copy(u.horizon.value);
    }
    mix3(th.sun, DUSK.sun, NIGHT.sun, v, this.sun.color);
    this.sun.intensity = lerp3(th.sunIntensity, DUSK.sunIntensity, NIGHT.sunIntensity, v);
    mix3(th.ambient, DUSK.ambient, NIGHT.ambient, v, this.ambient.color);
    mix3(th.fog, DUSK.fog, NIGHT.skyGround, v, this.ambient.groundColor);
    this.ambient.intensity = lerp3(th.ambientIntensity, DUSK.ambientIntensity, NIGHT.ambientIntensity, v);
    // with real sun shadows, the shaded side is lit only by the sky: give it a little more
    if (this.renderer.shadowMap.enabled) this.ambient.intensity *= 1.3;
    if (this.scene.fog) {
      mix3(th.fog, DUSK.fog, NIGHT.fog, v, this.scene.fog.color);
      this.scene.fog.far = lerp(th.fogFar, NIGHT.fogFar, v);
      this.scene.background = (this.scene.background || new THREE.Color()).copy(this.scene.fog.color);
    }
    this.renderer.toneMappingExposure = lerp3(th.exposure || 1, DUSK.exposure, NIGHT.exposure, v);
    facade.night.value = v;
    this.ambientFx?.setNight(v);
    this.streets?.setNight(v);
    this.life?.setNight(v);
  }

  /** The nearest named place, for the line under the corner map. */
  location() {
    const p = this.player.pos, city = CITIES[this.cityIndex];
    let best = null, bestD = 90;
    for (const pl of this.data.places) {
      const d = Math.hypot(pl.x - p.x, pl.z - p.z);
      if (d < bestD && !isSolemn(pl.n)) { bestD = d; best = pl; }
    }
    const where = (city.street && city.street.district) || city.where;
    return best ? [best.n, `${where} · ${city.name}`] : [city.name, where];
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.pause(false);
    this.lock();
  }

  clear() {
    if (this.world) { this.world.dispose(); this.world = null; }
    if (this.sky) { this.scene.remove(this.sky); this.sky.geometry.dispose(); this.sky.material.dispose(); this.sky = null; }
    if (this.dust) this.dust.dispose();
    if (this.ambientFx) { this.ambientFx.dispose(); this.ambientFx = null; }
    if (this.bursts) this.bursts.dispose();
    for (const r of this.relics) this.scene.remove(r.model);
    if (this.table) this.scene.remove(this.table);
    this.relics = [];
    if (this.life) { this.life.dispose(); this.life = null; }
    this.streets = null;
    this.roads = null;
    this.cityDetail = null;
  }

  /* ----------------------------------------------------------- gameplay */
  nearest() {
    let best = null, bestD = Infinity;
    const p = this.player.pos;
    for (const r of this.relics) {
      if (r.found) continue;
      const d = Math.hypot(r.pos.x - p.x, r.pos.z - p.z);
      if (d < bestD) { bestD = d; best = r; }
    }
    if (this.found.size === 3 && this.table) {
      const d = Math.hypot(this.table.position.x - p.x, this.table.position.z - p.z);
      if (d < bestD) return { target: { pos: this.table.position, table: true }, dist: d };
    }
    return best ? { target: best, dist: bestD } : null;
  }

  interact() {
    if (this.state !== 'playing') return;
    const near = this.nearest();
    if (!near || near.dist > REACH) return;
    if (near.target.table) return this.finishCity();
    this.collect(near.target);
  }

  collect(relic) {
    relic.found = true;
    relic.model.userData.collect();
    this.found.add(relic.def.name);
    this.bursts.burst(new THREE.Vector3(relic.pos.x, 1.2, relic.pos.z), 90, 0xffd98a);
    audio.at(() => audio.ping?.(880), 0);

    const city = CITIES[this.cityIndex];
    const journal = this.progress.journal[city.id] || (this.progress.journal[city.id] = []);
    if (!journal.some(j => j.name === relic.def.name)) {
      journal.push({ name: relic.def.name, clue: relic.def.clue, at: relic.at });
    }
    this.save();
    this.hud.journal(journal);
    this.hud.relicCount(this.found.size, 3);
    this.hud.found(relic.def.name, relic.def.clue, relic.at);

    if (this.found.size === 3) {
      this.table.visible = true;
      this.hud.tableReady(city.vault.label);
    }
  }

  finishCity() {
    const city = CITIES[this.cityIndex];
    this.state = 'cleared';
    document.exitPointerLock?.();
    this.progress.unlocked = Math.max(this.progress.unlocked, this.cityIndex + 2);
    this.save();
    this.hud.cleared(city, this.cityIndex, CITIES.length);
  }

  /* --------------------------------------------------------------- loop */
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  loop() {
    this.running = true;
    let last = performance.now();
    const frame = (now) => {
      requestAnimationFrame(frame);
      // the first frame's timestamp can be older than `last`: never step backwards
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      this.time += dt;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(frame);
  }

  update(dt) {
    if (!this.world) return;
    if (this.state === 'playing') {
      this.readInput();
      this.player.update(dt, this.input, this.world, this.time);
      this.life?.pushPlayer(this.player.pos);
    }
    // the street keeps moving behind the ready card, and stops when you pause
    if (this.state === 'playing' || this.state === 'ready') {
      this.life?.update(dt, this.player, this.camera, this.night);
    }
    if (Math.abs(this.night - this.nightTarget) > 0.0005) {
      const step = dt / 2.6;                       // about two and a half seconds of dusk
      this.night = this.night < this.nightTarget ? Math.min(this.nightTarget, this.night + step)
                                                 : Math.max(this.nightTarget, this.night - step);
      this.applyNight(this.night);
    }
    if (this.sky) this.sky.material.uniforms.time.value = this.time;
    const p = this.player.pos;
    // the sun follows the player so its light and shadows stay with the view,
    // keeping the direction this city was given
    // (snapped to whole shadow-map texels, so shadow edges do not crawl as you walk)
    const L = this.lightDir, texel = (SHADOW_HALF * 2) / (this.sun.shadow.mapSize.x || 1024);
    const rx = -L.z, rz = L.x, rl = Math.hypot(rx, rz) || 1;       // the light's sideways axis
    const a = (p.x * rx + p.z * rz) / rl, b = (p.x * L.x + p.z * L.z);
    const sa = Math.round(a / texel) * texel - a, sb = Math.round(b / (texel * 2)) * texel * 2 - b;
    const fx = p.x + (rx / rl) * sa + L.x * sb, fz = p.z + (rz / rl) * sa + L.z * sb;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + this.sunOffset.x, this.sunOffset.y, fz + this.sunOffset.z);
    if (this.sky) this.sky.position.set(p.x, 0, p.z);
    this.world.updateLights(this.camera.position, dt);
    this.dust?.update(dt, p);
    this.ambientFx?.update(dt, p, this.time);
    this.streets?.update?.(this.camera.position, this.lodNear || 150, this.time);
    this.cityDetail?.update(this.camera.position, this.lodNear || 150);
    this.watchPerf(dt);
    this.bursts?.update(dt);
    for (const r of this.relics) r.model.userData.update(this.time);
    if (this.table?.visible) this.table.userData.update(this.time);

    // the resonance meter: how close the nearest missing relic is
    const near = this.nearest();
    if (near) {
      const warm = clamp(1 - (near.dist - REACH) / 120, 0, 1);
      this.heat = damp(this.heat || 0, warm, 6, dt);
      this.hud.resonance(this.heat, near.dist, near.target.table);
      this.hud.prompt(near.dist <= REACH ? (near.target.table ? 'Read the map  [E]' : 'Take the relic  [E]') : '');
    } else {
      this.hud.resonance(0, 0, false);
      this.hud.prompt('');
    }
    this.hud.compass(this.player.yaw, near ? near.target.pos : null, p);
    this.hud.fps(1 / Math.max(dt, 0.0001));

    if (this.map && this.state === 'playing') {
      const marks = this.relics.filter(r => r.found).map(r => ({ x: r.pos.x, z: r.pos.z, kind: 'found' }));
      if (this.table?.visible) marks.push({ x: this.table.position.x, z: this.table.position.z, kind: 'table' });
      // where to go next: the nearest relic still to find (the table is already marked once it's out)
      if (near && !near.target.table) marks.push({ x: near.target.pos.x, z: near.target.pos.z, kind: 'target', dist: near.dist });
      this.map.draw(dt, p, this.player.yaw, marks);
      this.map.drawBig(p, this.player.yaw, marks);
      this.locT -= dt;
      if (this.locT <= 0) {
        this.locT = 0.35;
        this.hud.location(...this.location());
      }
    }
  }
}

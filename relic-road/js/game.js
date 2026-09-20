/**
 * Relic Road — the engine: loads a real city district, drops three relics at
 * real landmarks, and runs the walking, looking and finding.
 */
import * as THREE from 'three';
import { World, makeSky, LIGHT_SCALE } from './world.js';
import { Player } from './player.js';
import { Dust, Bursts } from './fx.js';
import { makeRelic, makeMapTable } from './relics.js';
import { loadCity, buildCity, findPlace, openSpotNear, nearSolemn } from './osmcity.js';
import { CITIES } from './cities.js';
import { clamp, damp } from './util.js';
import * as audio from './audio.js';

const SAVE = 'relicRoad.v1';
const REACH = 3.2;              // how close you must be to pick something up

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

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 2600);
    this.scene.add(this.camera);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.ambient = new THREE.HemisphereLight(0xffffff, 0x404040, 1);
    this.scene.add(this.sun, this.sun.target, this.ambient);

    this.player = new Player(this.camera, null);
    this.player.torchOn = false;
    this.player.torch.intensity = 0;

    this.input = { forward: 0, right: 0, jump: false, sprint: false, crouch: false };
    this.keys = new Set();
    this.relics = [];
    this.found = new Set();
    this.progress = this.load();

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
      if (down && k === 'Escape' && this.state === 'playing') this.pause();
      const used = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                    'Space', 'ShiftLeft', 'ControlLeft', 'KeyE', 'KeyJ'];
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
    const { stats } = buildCity(world, data, city.look, p => this.hud.loading(p, `Building ${city.name}…`));
    this.stats = stats;
    world.buildGrid();

    // sky, light and fog for this city
    this.sky = makeSky(city.theme);
    this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog(city.theme.fog, city.theme.fogNear, city.theme.fogFar);
    this.scene.background = new THREE.Color(city.theme.fog);
    const [sx, sy, sz] = city.theme.sunDir;
    this.sunOffset = new THREE.Vector3(sx, sy, sz).normalize().multiplyScalar(420);
    this.sun.color.setHex(city.theme.sun);
    this.sun.intensity = city.theme.sunIntensity;
    this.ambient.color.setHex(city.theme.ambient);
    this.ambient.groundColor.setHex(city.theme.fog);
    this.ambient.intensity = city.theme.ambientIntensity;
    this.renderer.toneMappingExposure = city.theme.exposure || 1;

    this.dust = new Dust(this.scene, 120, 26, 0xffe9c4, 0.035);
    this.bursts = new Bursts(this.scene);

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
    this.hud.pause(true);
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
    if (this.bursts) this.bursts.dispose();
    for (const r of this.relics) this.scene.remove(r.model);
    if (this.table) this.scene.remove(this.table);
    this.relics = [];
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
      const dt = Math.min(0.05, (now - last) / 1000);
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
    }
    const p = this.player.pos;
    // the sun follows the player so its light and shadows stay with the view,
    // keeping the direction this city was given
    this.sun.target.position.set(p.x, 0, p.z);
    this.sun.position.set(p.x + this.sunOffset.x, this.sunOffset.y, p.z + this.sunOffset.z);
    if (this.sky) this.sky.position.set(p.x, 0, p.z);
    this.world.updateLights(this.camera.position, dt);
    this.dust?.update(dt, p);
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
  }
}

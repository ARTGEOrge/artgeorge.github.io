/* Demon Fall — the game: renderer, level flow, objectives, HUD.
 *
 * One WebGL renderer is shared by the shooter scene and the Mars flight, so
 * switching between them costs nothing. Quality drops automatically if frames
 * get slow: bloom first, then shadows, then resolution. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { World, makeSky } from './world.js';
import { Fx, Shake, Ash } from './fx.js';
import { Player } from './player.js';
import { Enemies, TYPES } from './enemies.js';
import { Weapon, WEAPONS } from './weapons.js';
import { pickup as makePickup } from './levels-a.js';
import { LEVEL_1, LEVEL_2, LEVEL_3 } from './levels-a.js';
import { LEVEL_4, LEVEL_5, LEVEL_6 } from './levels-b.js';
import { MarsFlight } from './mars.js';
import { clamp, damp, makeRng, randRange, fmtTime, TAU, Rolling } from './util.js';
import * as audio from './audio.js';

export const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5, LEVEL_6];

/* Film grade: vignette, grain, a touch of chromatic aberration and the red
 * pulse when you are hurt. Cheap, and it does most of the "cinematic" work. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, hurt: { value: 0 },
    tint: { value: new THREE.Color(0.06, 0.02, 0.03) }, strength: { value: 1 }
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, hurt, strength; uniform vec3 tint;
    varying vec2 vUv;
    float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float r2 = dot(d, d);
      // chromatic aberration grows toward the edges, and with damage
      float ca = (0.0015 + hurt * 0.006) * strength;
      vec4 col;
      col.r = texture2D(tDiffuse, uv + d * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - d * ca).b;
      col.a = 1.0;
      // vignette
      col.rgb *= 1.0 - r2 * (0.9 + hurt * 0.8) * strength;
      // grade toward the level's tint in the shadows
      float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      col.rgb = mix(col.rgb, tint + col.rgb * 0.7, (1.0 - lum) * 0.35 * strength);
      // damage pulse
      col.rgb += vec3(0.5, 0.02, 0.05) * hurt * (0.4 + 0.3 * sin(time * 9.0)) * (0.3 + r2);
      // grain
      float g = rand(uv * vec2(1920.0, 1080.0) + time) - 0.5;
      col.rgb += g * 0.035 * strength;
      gl_FragColor = col;
    }`
};

export class Game {
  constructor(hud) {
    this.hud = hud;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.setSize(innerWidth, innerHeight, false);   // CSS sizes the canvas; this sets resolution
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.05, 900);
    this.scene.add(this.camera);
    // a soft fill that rides with the view, so the gun and gloves always read
    const fill = new THREE.PointLight(0xffe2c8, 3, 1.6, 2);
    fill.position.set(0.05, 0.15, 0.1);
    this.camera.add(fill);

    this.fx = new Fx(this.scene);
    this.shake = new Shake();
    this.player = new Player(this.camera, this.fx);
    this.world = null;
    this.enemies = null;

    this.weapons = {};
    this.owned = ['pistol'];
    this.current = 'pistol';

    this.state = 'idle';
    this.time = 0;
    this.levelIndex = 0;
    this.stageIndex = 0;
    this.stats = { kills: 0, headshots: 0, shots: 0, hits: 0, started: 0, score: 0 };
    this.frameTimes = new Rolling(90);
    this.quality = 3;          // 3 = everything on, 0 = bare
    this.slowFrames = 0;
    this.marsFlight = null;

    this.setupPost();
    this.setupInput();
    this.setupBeacon();

    addEventListener('resize', () => this.resize());
  }

  /* ------------------------------------------------------------ pipeline */
  setupPost() {
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.7, 0.92);
    this.grade = new ShaderPass(GradeShader);
    this.output = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(this.output);
  }

  setupBeacon() {
    // a column of light marking the current objective, visible through walls
    const geo = new THREE.CylinderGeometry(0.5, 0.9, 40, 12, 1, true);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, colour: { value: new THREE.Color(0xff8a3c) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time; uniform vec3 colour; varying vec2 vUv;
        void main(){
          float fade = pow(1.0 - vUv.y, 2.5);
          float pulse = 0.55 + 0.45 * sin(time * 2.4 - vUv.y * 9.0);
          gl_FragColor = vec4(colour, fade * pulse * 0.42);
        }`
    });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.renderOrder = 999;
    this.beacon.visible = false;
    this.scene.add(this.beacon);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    if (this.marsFlight) {
      this.marsFlight.camera.aspect = w / h;
      this.marsFlight.camera.updateProjectionMatrix();
    }
  }

  /* --------------------------------------------------------------- input */
  setupInput() {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false, right: false };
    this.sensitivity = 0.0022;

    addEventListener('keydown', e => {
      // arrows and space would otherwise scroll the page underneath the game
      if (/^Arrow|^Space$/.test(e.code) && this.state === 'playing') e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.state !== 'playing' && this.state !== 'mars') return;
      if (e.code === 'KeyR') this.weapon && this.weapon.reload();
      if (e.code === 'KeyF') this.player.toggleTorch();
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'Digit1') this.selectWeapon('pistol');
      if (e.code === 'Digit2') this.selectWeapon('shotgun');
      if (e.code === 'Digit3') this.selectWeapon('plasma');
      if (e.code === 'KeyQ') this.cycleWeapon();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    addEventListener('mousedown', e => {
      // menu clicks must not carry over into the level as a held trigger
      if (this.state !== 'playing' && this.state !== 'mars') return;
      // without mouse capture there is no aiming, so the first click captures
      // the mouse instead of firing
      if (!this.locked) {
        if (e.target === this.renderer.domElement || e.target.closest('#lockHint')) {
          this.lock();
          this.dragLook = true;      // until capture arrives, dragging still turns the view
        }
        return;
      }
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) this.mouse.right = true;
    });
    addEventListener('mouseup', e => {
      this.dragLook = false;
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.right = false;
    });
    addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => {
      if (!this.locked && !this.dragLook) return;
      // browsers often report one huge jump right after capture; drop it
      if (performance.now() - this.lockAt < 120) return;
      if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
      this.mouse.x += e.movementX;
      this.mouse.y += e.movementY;
    });
    addEventListener('wheel', e => {
      if (this.state !== 'playing') return;
      this.cycleWeapon(e.deltaY > 0 ? 1 : -1);
    }, { passive: true });

    document.addEventListener('pointerlockchange', () => {
      this.lockPending = false;
      this.lockAt = performance.now();
      this.mouse.x = this.mouse.y = 0;
      const locked = this.locked;
      this.hud.lockHint(false);
      if (!locked && this.state === 'playing') this.pause();
    });
    // the browser refused (e.g. the click was too long ago): ask for a click
    document.addEventListener('pointerlockerror', () => {
      this.lockPending = false;
      if (this.state === 'playing' || this.state === 'mars') this.hud.lockHint(true);
    });
  }

  get locked() { return document.pointerLockElement === this.renderer.domElement; }

  /** If capture didn't happen, say how to get it. */
  checkLock() {
    setTimeout(() => {
      if ((this.state === 'playing' || this.state === 'mars') && !this.locked) this.hud.lockHint(true);
    }, 400);
  }

  lock() {
    const el = this.renderer.domElement;
    // a second request while the first is still pending can cancel it
    if (this.locked || this.lockPending) return;
    this.lockPending = true;
    if (!el.requestPointerLock) return;
    // some embedded contexts refuse pointer lock; the game still plays, so
    // swallow the rejection rather than breaking the frame that asked for it
    try {
      const r = el.requestPointerLock();
      if (r && r.then) r.then(() => { this.lockPending = false; }, () => { this.lockPending = false; });
    } catch (e) { this.lockPending = false; }
    // older browsers return nothing; the change/error events clear the flag
    setTimeout(() => { this.lockPending = false; }, 1500);
  }

  /* -------------------------------------------------------------- levels */
  loadLevel(index, keepLoadout = false, preview = false) {
    this.levelIndex = index;
    const def = LEVELS[index];
    this.levelDef = def;

    if (this.world) this.world.dispose();
    if (this.enemies) this.enemies.clear();
    this.fx.clear();
    while (this.scene.children.length) {
      const c = this.scene.children[0];
      this.scene.remove(c);
    }
    this.scene.add(this.camera, this.fx.soft.points, this.fx.glow.points, this.beacon);
    this.fx.decals.forEach(d => this.scene.add(d));
    this.fx.gibs.forEach(d => this.scene.add(d));
    this.fx.tracers.forEach(d => this.scene.add(d));
    this.fx.lights.forEach(l => this.scene.add(l.light));

    const theme = def.theme;
    this.scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);
    this.scene.background = new THREE.Color(theme.fog);
    this.sky = makeSky(theme);
    this.scene.add(this.sky);
    // indoor stages get dust instead of falling ash
    this.ash = new Ash(this.scene, theme.dark || theme.rift === 0
      ? { count: 400, colour: 0x8a8478, embers: 0.02, size: 0.05 }
      : { count: 800, colour: 0xb8aca0, embers: 0.14, size: 0.09 });

    const hemi = new THREE.HemisphereLight(theme.hemi[0], theme.hemi[1], theme.hemi[2] * 2.4);
    // a little ambient so shadowed corners stay readable rather than pure black
    const ambient = new THREE.AmbientLight(theme.hemi[0], 0.6);
    this.scene.add(hemi, ambient);

    this.sun = new THREE.DirectionalLight(theme.sun.colour, theme.sun.intensity * 2.4);
    this.sun.position.set(...theme.sun.pos);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = 42;
    this.sun.shadow.camera.left = -s; this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s; this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 200;
    this.sun.shadow.bias = -0.0009;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.world = new World(this.scene, theme);
    const rng = makeRng(1000 + index * 7717);
    this.script = def.build(this.world, rng);
    this.world.finish();

    for (const [kind, x, y, z] of (this.script.pickups || [])) makePickup(this.world, kind, x, y, z);

    this.enemies = new Enemies(this.scene, this.world, this.fx);

    // loadout
    if (!keepLoadout) {
      this.owned = ['pistol'];
      if (index >= 1) this.owned.push('shotgun');
      if (index >= 3) this.owned.push('plasma');
    }
    for (const key of Object.keys(WEAPONS)) {
      if (this.weapons[key]) this.weapons[key].dispose();
    }
    this.weapons = {};
    for (const key of this.owned) {
      const w = new Weapon(key, this.camera, this.fx);
      // later levels start with fuller pouches
      w.reserve = Math.round(WEAPONS[key].reserve * (1 + index * 0.08));
      this.weapons[key] = w;
    }
    this.current = this.owned[this.owned.length - 1];
    this.weapon.show(true);

    this.player.reset(this.world.playerStart, this.world.playerFacing);
    this.player.torchOn = true;          // it is night in every stage
    this.fx.floorY = 0;

    this.grade.uniforms.tint.value.setHex(theme.fog);
    this.stageIndex = -1;
    this.stats = { kills: 0, headshots: 0, shots: 0, hits: 0, started: this.time, score: 0 };
    this.levelDone = false;
    this.marsFlight = null;

    if (preview) { this.stage = null; this.beacon.visible = false; return; }
    audio.startMusic(theme.music || 45);
    this.nextStage();
    this.bannerPending = true;         // shown when play actually starts
    this.hud.slots(this.owned, this.current);
    this.hud.hideBoss();
    this.hud.objProgress(null);
  }

  nextStage() {
    this.stageIndex++;
    const stages = this.script.stages;
    if (this.stageIndex >= stages.length) return this.completeLevel();

    const st = stages[this.stageIndex];
    this.stage = st;
    this.stageT = 0;
    this.waveAt = st.waveEvery || 0;
    this.stageKills = 0;
    this.interacted = 0;

    this.hud.objective(st.text);
    this.hud.objProgress(st.kind === 'reach' ? null : 0);
    audio.sfx.objective();
    if (st.onEnterText) this.hud.subtitle(st.onEnterText);

    // one-off spawns for this stage
    for (const sp of st.spawns || []) {
      const pos = new THREE.Vector3(sp.at[0], sp.at[1] || 0, sp.at[2]);
      this.enemies.spawn(sp.kind, pos);
    }
    if (st.boss) {
      const b = this.enemies.spawn(st.boss.kind, new THREE.Vector3(...st.boss.at));
      this.boss = b;
      this.hud.showBoss(TYPES[st.boss.kind].name);
    }

    // where to point the beacon
    if (st.zone) {
      const c = st.zone.getCenter(new THREE.Vector3());
      this.beacon.position.set(c.x, c.y, c.z);
      this.beacon.visible = true;
    } else if (st.kind === 'interact') {
      this.updateInteractBeacon();
    } else {
      this.beacon.visible = false;
    }
  }

  updateInteractBeacon() {
    const next = this.world.props.find(p => p.kind === 'terminal' && !p.used);
    if (next) {
      this.beacon.position.set(next.pos.x, next.pos.y, next.pos.z);
      this.beacon.visible = true;
    } else this.beacon.visible = false;
  }

  completeLevel() {
    if (this.levelDone) return;
    this.levelDone = true;
    this.beacon.visible = false;

    // the last stage of the campaign hands over to the flight to Mars
    if (this.levelIndex === LEVELS.length - 1) {
      this.startMars();
      return;
    }
    this.state = 'cleared';
    document.exitPointerLock();
    audio.stopMusic();
    audio.sfx.win();
    this.hud.levelCleared(this.levelSummary());
  }

  levelSummary() {
    const t = this.time - this.stats.started;
    const accuracy = this.stats.shots ? Math.round((this.stats.hits / this.stats.shots) * 100) : 0;
    const score = Math.round(this.stats.score + Math.max(0, 600 - t) * 10 + accuracy * 30);
    return {
      level: this.levelIndex, name: this.levelDef.name, time: t, timeText: fmtTime(t),
      kills: this.stats.kills, headshots: this.stats.headshots, accuracy, score
    };
  }

  startMars() {
    this.state = 'mars';
    audio.stopMusic();
    this.marsFlight = new MarsFlight({
      subtitle: t => this.hud.subtitle(t),
      damage: () => this.hud.damage()
    });
    this.marsFlight.camera.aspect = innerWidth / innerHeight;
    this.marsFlight.camera.updateProjectionMatrix();
    this.renderPass.scene = this.marsFlight.scene;
    this.renderPass.camera = this.marsFlight.camera;
    this.hud.marsMode(true);
    this.hud.objective('Fly to Mars');
    this.hud.subtitle('Lift-off. Hold on.');
  }

  /* ------------------------------------------------------------ weapons */
  get weapon() { return this.weapons[this.current]; }

  selectWeapon(key) {
    if (!this.weapons[key] || this.current === key) return;
    this.weapon.show(false);
    this.current = key;
    this.weapon.show(true);
    audio.sfx.ui();
    this.hud.slots(this.owned, this.current);
    this.hud.ammo(this.weapon);
  }

  cycleWeapon(dir = 1) {
    const i = this.owned.indexOf(this.current);
    const next = this.owned[(i + dir + this.owned.length) % this.owned.length];
    this.selectWeapon(next);
  }

  giveWeapon(key) {
    if (this.owned.includes(key)) {
      this.weapons[key].addAmmo(WEAPONS[key].mag * 2);
      return false;
    }
    this.owned.push(key);
    this.weapons[key] = new Weapon(key, this.camera, this.fx);
    this.selectWeapon(key);
    return true;
  }

  /* ---------------------------------------------------------- interaction */
  interact() {
    const eye = this.player.eyePos();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    for (const p of this.world.props) {
      if (p.kind !== 'terminal' || p.used) continue;
      const d = p.pos.distanceTo(this.player.pos);
      if (d > 3.2) continue;
      const to = p.pos.clone().sub(eye).normalize();
      if (to.dot(dir) < 0.45) continue;
      p.used = true;
      p.screen.material.color.setHex(0x37d06a);
      p.light.color.setHex(0x37d06a);
      audio.sfx.door();
      this.interacted++;
      this.hud.feed(p.label + ' ONLINE', 'pickup');
      this.updateInteractBeacon();
      return;
    }
  }

  /* -------------------------------------------------------------- damage */
  damageEnemiesInRadius(pos, radius, damage) {
    for (const e of this.enemies.list) {
      if (e.dead) continue;
      const d = e.pos.distanceTo(pos);
      if (d > radius) continue;
      const falloff = 1 - d / radius;
      const dir = e.pos.clone().sub(pos).normalize();
      e.hurt(damage * falloff, dir, false);
      if (e.dead) this.onKill(e, false);
    }
    const dp = this.player.pos.distanceTo(pos);
    if (dp < radius) this.player.hurt(damage * (1 - dp / radius) * 0.55, this.time);
  }

  explodeBarrel(prop) {
    if (prop.dead) return;
    prop.dead = true;
    const p = prop.pos.clone().setY(prop.pos.y + 0.6);
    this.fx.explosion(p, 1.4);
    audio.at(() => audio.sfx.explode(), this.player.pos.distanceTo(p), 90);
    this.shake.add(clamp(1.4 - this.player.pos.distanceTo(p) / 16, 0, 0.8));
    this.damageEnemiesInRadius(p, 7.5, 150);
    this.enemies.alertNear(p, 60);
    prop.obj.visible = false;
    // chain reaction
    for (const other of this.world.props) {
      if (other.kind === 'barrel' && !other.dead && other.pos.distanceTo(p) < 7) {
        setTimeout(() => this.explodeBarrel(other), 120 + Math.random() * 200);
      }
    }
  }

  onKill(enemy, head) {
    this.stats.kills++;
    this.stats.score += enemy.type.score * (head ? 1.5 : 1);
    if (head) this.stats.headshots++;
    this.stageKills++;
    this.hud.feed(enemy.type.name + (head ? ' — HEADSHOT' : ''), head ? 'pickup' : '');
    this.fx.blood(enemy.bodyPos(new THREE.Vector3()), new THREE.Vector3(0, 1, 0), 18);
    for (let i = 0; i < 4; i++) {
      this.fx.gib(enemy.bodyPos(new THREE.Vector3()),
        new THREE.Vector3(randRange(-3, 3), randRange(2, 5), randRange(-3, 3)), enemy.type.gib, enemy.type.scale);
    }
    audio.at(() => audio.sfx.gib(), this.player.pos.distanceTo(enemy.pos));
    if (enemy === this.boss) {
      this.hud.hideBoss();
      this.boss = null;
      this.fx.explosion(enemy.bodyPos(new THREE.Vector3()), 2.2);
      this.shake.add(0.9);
    }
  }

  /* ---------------------------------------------------------------- loop */
  /** The main menu sits over a slow fly-through of the first stage. */
  menuBackdrop() {
    if (!this.backdropBuilt || this.levelIndex !== 0 || this.stage) {
      this.loadLevel(0, false, true);
      this.enemies.spawn('walker', new THREE.Vector3(3, 0, 40)).state = 'idle';
      this.enemies.spawn('walker', new THREE.Vector3(-4, 0, 22)).state = 'idle';
      this.enemies.spawn('runner', new THREE.Vector3(5, 0, 8)).state = 'idle';
      this.backdropBuilt = true;
    }
    for (const w of Object.values(this.weapons)) w.show(false);
    this.player.torchOn = false;
    this.player.torch.intensity = 0;
    this.state = 'menu';
    this.menuT = 0;
    this.runLoop();
  }

  updateMenu(dt) {
    this.menuT += dt;
    const t = this.menuT * 0.035;
    const z = 70 - ((t * 60) % 150);
    const cam = this.camera;
    cam.position.set(Math.sin(t * 2.1) * 3 + 1, 2.3 + Math.sin(t * 3.3) * 0.25, z);
    cam.rotation.set(0, 0, 0);
    cam.rotateY(Math.sin(t * 1.3) * 0.35 + 0.15);
    cam.rotateX(-0.02 + Math.sin(t * 1.7) * 0.03);
    this.world.updateLights(cam.position, dt);
    this.ash.update(dt, cam.position, this.time);
    this.updateProps(dt);
    this.fx.update(dt);
    for (const e of this.enemies.list) e.animate(dt, 0.3, { fx: this.fx });
    this.sun.target.position.copy(cam.position);
    this.sun.position.copy(cam.position).add(new THREE.Vector3(...this.levelDef.theme.sun.pos).normalize().multiplyScalar(60));
  }

  /** Level built and waiting behind the "click to play" screen. */
  ready() {
    this.state = 'ready';
    this.resize();                     // in case the window changed while loading
    // put the camera at the start so the card sits over the real view
    this.player.update(0.0001, { forward: 0, right: 0, jump: false, sprint: false, crouch: false }, this.world, this.time);
    this.world.updateLights(this.player.pos, 1);
    this.runLoop();
  }

  runLoop() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    requestAnimationFrame(t => this.frame(t));
  }

  /** Call from inside the click that should capture the mouse. */
  start() {
    this.state = 'playing';
    if (this.bannerPending) {
      this.bannerPending = false;
      this.hud.banner(this.levelIndex + 1, this.levelDef.name, this.levelDef.brief);
    }
    this.mouse.down = this.mouse.right = false;
    this.firedThisClick = true;        // needs a fresh click before firing
    this.lock();
    this.checkLock();
    this.lastFrame = performance.now();
    this.runLoop();
  }

  pause() {
    if (this.state !== 'playing' && this.state !== 'mars') return;
    this.pausedFrom = this.state;
    this.state = 'paused';
    document.exitPointerLock();
    this.hud.pause(true, this.levelDef ? this.levelDef.name : '');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = this.pausedFrom || 'playing';
    this.hud.pause(false);
    this.lock();
    this.checkLock();
  }

  frame(now) {
    requestAnimationFrame(t => this.frame(t));
    const raw = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    const dt = Math.min(0.05, raw);
    this.time += dt;

    this.adaptQuality(raw);

    if (this.state === 'playing') this.updatePlaying(dt);
    else if (this.state === 'menu') this.updateMenu(dt);
    else if (this.state === 'mars') this.updateMars(dt);
    else if (this.state === 'paused' || this.state === 'dead' || this.state === 'cleared') {
      // keep the world rendering behind the menus, just frozen
      this.fx.update(dt * 0.15);
    }

    this.grade.uniforms.time.value = this.time;
    this.grade.uniforms.hurt.value = damp(this.grade.uniforms.hurt.value, this.player.hurtFlash * 0.8, 6, dt);
    if (this.sky) this.sky.material.uniforms.time.value = this.time;

    this.composer.render();
    this.hud.fps(1 / Math.max(0.001, raw));
  }

  adaptQuality(raw) {
    this.frameTimes.push(raw);
    if (this.frameTimes.buf.length < 60) return;
    const avg = this.frameTimes.avg;
    if (avg > 0.028 && this.quality > 0) {
      this.slowFrames++;
      if (this.slowFrames > 90) {
        this.slowFrames = 0;
        this.quality--;
        this.applyQuality();
      }
    } else if (avg < 0.019) {
      this.slowFrames = Math.max(0, this.slowFrames - 2);
    }
  }

  applyQuality() {
    const q = this.quality;
    this.bloom.enabled = q >= 3;
    this.grade.uniforms.strength.value = q >= 2 ? 1 : 0.5;
    this.renderer.shadowMap.enabled = q >= 2;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, q >= 1 ? 1.4 : 1));
    this.resize();
    this.scene.traverse(o => { if (o.isMesh) o.castShadow = o.castShadow && q >= 2; });
    this.hud.feed('Quality lowered for speed', 'pickup');
  }

  updatePlaying(dt) {
    const player = this.player;

    // ---- look
    const mx = this.mouse.x, my = this.mouse.y;
    this.mouse.x = 0; this.mouse.y = 0;
    player.look(mx, my, this.sensitivity * (this.mouse.right ? 0.55 : 1));

    // ---- move
    const k = this.keys;
    const input = {
      // WASD and the arrow keys both move
      forward: (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0),
      right: (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0),
      jump: this.keys.has('Space'),
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      crouch: this.keys.has('ControlLeft') || this.keys.has('KeyC')
    };
    const speed = player.update(dt, input, this.world, this.time);

    // ---- shooting
    const w = this.weapon;
    const wantFire = this.mouse.down && (w.spec.auto || !this.firedThisClick);
    if (this.mouse.down) {
      if (wantFire) {
        const fired = w.fire({
          world: this.world, enemies: this.enemies, time: this.time, shake: this.shake,
          moving: speed > 1.5, aiming: this.mouse.right,
          onRecoil: amount => player.addRecoil(amount),
          onHit: kill => { this.stats.hits++; this.hud.hitmark(kill); },
          onKill: (e, head) => this.onKill(e, head),
          onWallHit: hit => {
            if (hit.collider && hit.collider.tag === 'barrel') {
              const prop = this.world.props.find(p => p.kind === 'barrel' && !p.dead &&
                Math.abs(p.pos.x - hit.point.x) < 1 && Math.abs(p.pos.z - hit.point.z) < 1);
              if (prop) this.explodeBarrel(prop);
            }
          }
        });
        if (fired) {
          this.stats.shots++;
          this.firedThisClick = true;
          this.enemies.alertNear(player.pos, w.key === 'shotgun' ? 46 : 34);
        }
      }
    } else this.firedThisClick = false;

    // auto-reload when the magazine runs dry
    if (w.ammo === 0 && !w.isReloading && w.reserve > 0) w.reload();

    w.update(dt, {
      turnX: mx * this.sensitivity, turnY: my * this.sensitivity,
      speed, aiming: this.mouse.right, time: this.time
    });

    // ---- enemies
    this.enemies.update({
      dt, player, world: this.world, fx: this.fx, time: this.time,
      onAttack: (enemy, damage) => {
        player.hurt(damage, this.time);
        this.shake.add(0.25);
        this.hud.damage();
        this.hitFrom(enemy.pos);
      },
      onPlayerHit: (damage, from) => {
        player.hurt(damage, this.time);
        this.shake.add(0.3);
        this.hud.damage();
        if (from) this.hitFrom(from);
      }
    });

    // ---- world bits and pieces
    this.world.updateLights(player.pos, dt);
    this.ash.update(dt, player.pos, this.time);
    this.updateProps(dt);
    this.updatePickups(dt);
    this.fx.update(dt);
    this.shake.update(dt, this.camera);
    if (this.script.spin) {
      for (const s of this.script.spin) {
        s.obj.rotation.y += dt * s.speed;
        if (s.bobY != null) s.obj.position.y = s.bobY + Math.sin(this.time * 1.6) * 0.12;
      }
    }

    // sun shadow follows the player so the shadow map stays tight
    this.sun.target.position.copy(player.pos);
    this.sun.position.copy(player.pos).add(new THREE.Vector3(...this.levelDef.theme.sun.pos).normalize().multiplyScalar(60));

    // beacon spin
    this.beacon.material.uniforms.time.value = this.time;

    // ---- stage logic
    this.updateStage(dt);

    // ---- HUD
    this.spread = damp(this.spread || 0,
      (this.mouse.right ? 0 : 3) + speed * 1.6 + (player.grounded ? 0 : 8) + w.recoilPos * 90, 12, dt);
    this.hud.crosshair(this.spread);
    this.hud.vitals(player);
    this.hud.ammo(w);
    this.hud.compass(player.yaw, this.beacon.visible ? this.beacon.position : null, player.pos);
    if (this.boss) this.hud.bossHp(this.boss.hp / this.boss.maxHp);

    const danger = clamp(this.enemies.list.filter(e => !e.dead && e.pos.distanceTo(player.pos) < 24).length / 7, 0, 1);
    audio.setTension(danger, this.time);
    this.hud.threat(this.enemies.alive);

    if (player.dead && this.state === 'playing') this.die();
  }

  /** Show which way a hit came from, relative to where the player faces. */
  hitFrom(pos) {
    const p = this.player;
    const heading = -p.yaw * 180 / Math.PI;
    const bearing = Math.atan2(pos.x - p.pos.x, -(pos.z - p.pos.z)) * 180 / Math.PI;
    const rel = ((bearing - heading + 540) % 360) - 180;
    this.hud.damageFrom(rel);
  }

  updateProps(dt) {
    for (const p of this.world.props) {
      if (p.kind === 'fire') {
        const f = p.src;
        f.phase += dt * 6;
        f.light.intensity = (7 + Math.sin(f.phase) * 2 + Math.sin(f.phase * 2.3) * 1.4) * f.scale;
        if (Math.random() < dt * 22 * f.scale && this.player.pos.distanceTo(f.pos) < 40) {
          this.fx.fire(f.pos, 1, f.scale * 0.8);
          if (Math.random() < 0.4) this.fx.embers(f.pos, 1, 0.4 * f.scale);
        }
      }
    }
  }

  updatePickups(dt) {
    for (const p of this.world.pickups) {
      if (p.taken) continue;
      p.spin += dt * 1.6;
      p.obj.rotation.y = p.spin;
      p.obj.position.y = p.obj.position.y * 0.98 + (0.35 + Math.sin(p.spin * 1.4) * 0.08) * 0.02;
      const d = p.pos.distanceTo(this.player.pos);
      if (d > 1.5) continue;

      let took = false;
      if (p.kind === 'health' && this.player.hp < this.player.maxHp) {
        this.player.heal(35); took = true; audio.sfx.heal();
        this.hud.feed('+35 VITALS', 'pickup');
      } else if (p.kind === 'armour' && this.player.armour < this.player.maxArmour) {
        this.player.addArmour(50); took = true; audio.sfx.heal();
        this.hud.feed('+50 PLATING', 'pickup');
      } else if (p.kind === 'ammo') {
        const w = this.weapon;
        const got = w.addAmmo(Math.round(w.spec.mag * 2.5));
        if (got > 0) { took = true; audio.sfx.pickup(); this.hud.feed('+' + got + ' ' + w.spec.name.toUpperCase(), 'pickup'); }
      } else if (p.kind === 'shotgun' || p.kind === 'plasma') {
        const isNew = this.giveWeapon(p.kind);
        took = true; audio.sfx.pickup();
        this.hud.feed(isNew ? WEAPONS[p.kind].name.toUpperCase() + ' ACQUIRED' : '+AMMO', 'pickup');
        if (isNew) this.hud.subtitle(WEAPONS[p.kind].name + ' — press ' + WEAPONS[p.kind].slot);
      }
      if (took) {
        p.taken = true;
        p.obj.visible = false;
        this.fx.sparks(p.pos, new THREE.Vector3(0, 1, 0), 10, [0.4, 1, 0.6]);
      }
    }
  }

  updateStage(dt) {
    const st = this.stage;
    if (!st || this.levelDone) return;
    this.stageT += dt;

    // waves keep coming during defend and boss stages
    if (st.waveEvery && (st.kind === 'defend' || st.kind === 'boss')) {
      this.waveAt -= dt;
      if (this.waveAt <= 0 && this.enemies.alive < (st.maxAlive || 14)) {
        this.waveAt = st.waveEvery;
        const n = st.kind === 'boss' ? 2 : 3;
        for (let i = 0; i < n; i++) {
          const pt = st.wavePoints[Math.floor(Math.random() * st.wavePoints.length)];
          const kind = st.waveKinds[Math.floor(Math.random() * st.waveKinds.length)];
          this.enemies.spawn(kind, new THREE.Vector3(pt[0] + randRange(-3, 3), pt[1] || 0, pt[2] + randRange(-3, 3)));
        }
      }
    }

    let done = false;
    if (st.kind === 'reach') {
      const p = this.player.pos;
      done = st.zone.containsPoint(new THREE.Vector3(p.x, clamp(p.y, st.zone.min.y, st.zone.max.y), p.z));
    } else if (st.kind === 'kill') {
      done = this.stageKills >= st.count;
      this.hud.objective(st.text + '  ' + Math.min(this.stageKills, st.count) + '/' + st.count);
      this.hud.objProgress(this.stageKills / st.count);
    } else if (st.kind === 'interact') {
      done = this.interacted >= st.count;
      this.hud.objective(st.text + '  ' + this.interacted + '/' + st.count);
      this.hud.objProgress(this.interacted / st.count);
    } else if (st.kind === 'defend') {
      const left = Math.max(0, st.duration - this.stageT);
      this.hud.objective(st.text + '  ' + fmtTime(left));
      this.hud.objProgress(1 - left / st.duration);
      done = left <= 0;
    } else if (st.kind === 'boss') {
      done = !this.boss;
    }

    if (done) {
      if (st.kind === 'defend' || st.kind === 'boss') this.hud.subtitle('Clear!');
      this.nextStage();
    }
  }

  updateMars(dt) {
    const flight = this.marsFlight;
    const input = { mouseX: this.mouse.x, mouseY: this.mouse.y, firing: this.mouse.down };
    this.mouse.x = 0; this.mouse.y = 0;
    const finished = flight.update(dt, input);

    this.hud.marsHud(flight);
    if (flight.failed && !this.levelFailed) {
      this.levelFailed = true;
      this.state = 'dead';
      document.exitPointerLock();
      audio.sfx.lose();
      this.hud.died('The ship broke up in the debris field');
      return;
    }
    if (finished) {
      this.state = 'cleared';
      document.exitPointerLock();
      this.hud.marsMode(false);
      const summary = this.levelSummary();
      summary.mars = { score: flight.score, destroyed: flight.destroyed, hull: Math.round(flight.hull) };
      summary.final = true;
      this.hud.levelCleared(summary);
    }
  }

  die() {
    this.state = 'dead';
    document.exitPointerLock();
    audio.stopMusic();
    audio.sfx.lose();
    this.hud.died();
  }

  restart(noStart) {
    this.levelFailed = false;
    if (this.marsFlight) {
      this.renderPass.scene = this.scene;
      this.renderPass.camera = this.camera;
      this.marsFlight.dispose();
      this.marsFlight = null;
      this.hud.marsMode(false);
    }
    this.loadLevel(this.levelIndex);
    if (!noStart) this.start();
  }

  quitToMenu() {
    this.state = 'idle';
    document.exitPointerLock();
    audio.stopMusic();
    if (this.marsFlight) {
      this.renderPass.scene = this.scene;
      this.renderPass.camera = this.camera;
      this.marsFlight.dispose();
      this.marsFlight = null;
      this.hud.marsMode(false);
    }
  }
}

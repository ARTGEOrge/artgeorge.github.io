/* One race: the field of 12 cars, physics, AI, collisions, race control,
 * the camera and per-frame effects. Simulation runs in fixed 1/60 s steps
 * (step) and is decoupled from drawing (frame), so tests can fast-forward. */
import * as THREE from 'three';
import { Track, DS, START_S } from './track.js';
import { populate } from './scenery.js';
import { makeCar, wheelGeometry, WHEELS } from './car.js';
import { makeSky, Particles, Weather, SpeedLines } from './fx.js';
import { LIVERIES, fieldFor } from './levels.js';
import * as TX from './textures.js';
import * as audio from './audio.js';

export const STEP = 1 / 60;
const V_TOP = 92;               // 331 km/h flat out
const GEAR_TOP = [0, 22, 34, 45, 55, 65, 75, 85, 96].map(v => v); // m/s per gear
const CAR_LEN = 5.2, CAR_W = 2.05;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const accelCurve = (v, top) => 13 * Math.max(0.04, 1 - Math.pow(Math.max(0, v) / (top + 2), 2.2));

export class Race {
  constructor(L, renderer, opts) {
    this.L = L; this.renderer = renderer; this.opts = opts;
    this.quality = opts.quality ?? 0;
    const scene = this.scene = new THREE.Scene();
    scene.fog = new THREE.Fog(L.fog.col, L.fog.near, L.fog.far);
    scene.background = new THREE.Color(L.fog.col);
    this.camera = new THREE.PerspectiveCamera(64, 16 / 9, 0.12, 3200);
    scene.add(this.camera);
    // light
    const hemi = new THREE.HemisphereLight(L.light.sky, L.light.gnd, L.light.hemi); scene.add(hemi);
    const sun = this.sun = new THREE.DirectionalLight(L.light.sun, L.light.sunI);
    sun.position.set(...L.sky.sun).multiplyScalar(100); scene.add(sun);
    this.sky = makeSky(L); scene.add(this.sky);
    if (L.night) { // floodlight that travels with the player so cars read at night
      this.carLight = new THREE.PointLight('#fff2e0', 60, 70, 1.2); scene.add(this.carLight);
      hemi.intensity *= 1.35;
    }
    // environment reflections from the sky
    try {
      const pm = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene(); envScene.add(makeSky(L));
      this.env = pm.fromScene(envScene, 0, 1, 4000).texture; scene.environment = this.env; pm.dispose();
    } catch (e) { /* no env */ }
    // world
    this.track = new Track(L);
    this.track.build(scene, this.quality);
    this.scenery = populate(this.track, L, this.quality, scene);
    this.buildFurniture();
    // fx
    this.smoke = new Particles(500); scene.add(this.smoke.points);
    this.sparks = new Particles(260, { additive: true }); scene.add(this.sparks.points);
    if (L.weather !== 'clear') { this.weather = new Weather(L.weather, this.quality >= 2 ? 500 : 1100); scene.add(this.weather.obj); }
    this.lines = new SpeedLines(); this.camera.add(this.lines.obj);
    this.dustCol = new THREE.Color(L.ground.near);
    this.buildField(opts.livery ?? 0);
    this.time = 0; this.phase = 'grid'; this.lightsOn = 0; this.goAt = 0;
    this.camMode = opts.cam || 'chase';
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3(); this.camYaw = 0; this.shake = 0;
    this.events = [];
    this.resetCamera();
    this.drawDist = L.fog.far + 100;
  }

  /* ------------------------------------------------------------ field */
  buildField(liveryIdx) {
    const L = this.L, t = this.track, scene = this.scene;
    const rivals = fieldFor(liveryIdx);
    const N = 12, slot = clamp(L.grid, 1, N) - 1;
    const r = TX.rng(L.seed + 5);
    // rivals sorted fastest first fill the grid; the player takes `slot`
    const skills = rivals.map((rv, k) => L.ai + L.aiSpread * (1 - 2 * k / (rivals.length - 1)) * 0.5 + (r() - 0.5) * 0.01);
    this.cars = [];
    let ai = 0;
    for (let g = 0; g < N; g++) {
      const isP = g === slot;
      const liv = isP ? { ...LIVERIES[liveryIdx], driver: 'You' } : rivals[ai];
      const car = {
        id: g, isPlayer: isP, liv, grid: g + 1,
        s: START_S - 9 - g * 8, d: (g % 2 ? -1 : 1) * 2.3, v: 0, idx: 0, x: 0, y: 0, z: 0, yaw: 0, yawRate: 0, steer: 0, vl: 0,
        skill: isP ? 1 : skills[ai], bias: isP ? 0 : (r() - 0.5) * 1.6, react: 0.15 + r() * 0.35, spin: 0,
        finished: false, finishTime: 0, place: g + 1, cp: 0, drs: false, slip: 0, rpm: 0.3, throttle: 0, scrape: 0, offroad: false,
        visYaw: 0, roll: 0, pitch: 0, gear: 1, latD: 0
      };
      if (!isP) ai++;
      const p = t.at(car.s, car.d, {});
      car.x = p.x; car.z = p.z; car.y = p.y; car.yaw = p.th; car.idx = t.idx(car.s);
      car.mesh = makeCar(liv); scene.add(car.mesh);
      this.cars.push(car);
    }
    this.player = this.cars[slot];
    this.player.mesh.userData.helmet.visible = true;
    // instanced wheels and shadows for all cars
    const wm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.1 });
    this.wheelMesh = new THREE.InstancedMesh(wheelGeometry(), wm, N * 4);
    this.wheelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.wheelMesh.frustumCulled = false;
    scene.add(this.wheelMesh);
    const bg = new THREE.PlaneGeometry(1, 1); bg.rotateX(-Math.PI / 2);
    this.shadowMesh = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ map: TX.blob(), transparent: true, depthWrite: false, opacity: this.L.night ? 0.5 : 0.85 }), N);
    this.shadowMesh.frustumCulled = false; scene.add(this.shadowMesh);
    this.aiProf = t.profile(37 * L.grip, 30 * L.grip, V_TOP - 1);
    this.apProf = t.profile(38.5 * L.grip, 32 * L.grip, V_TOP);
  }

  /* ------------------------------------------------------------ furniture */
  buildFurniture() {
    const t = this.track, L = this.L, scene = this.scene, g = new THREE.Group();
    const tmp = {};
    const gantryMat = new THREE.MeshLambertMaterial({ color: '#2a2c32' });
    const arch = (s, text, bg, fg) => {
      t.at(s, 0, tmp);
      const w = tmp.w / 2 + t.runoff + 0.6, grp = new THREE.Group();
      for (const sd of [1, -1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7.5, 0.6), gantryMat); p.position.set(sd * w, 3.75, 0); grp.add(p); }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2 * w + 0.6, 1.6, 0.5), gantryMat); beam.position.y = 7.2; grp.add(beam);
      const ban = TX.banner(text, bg, fg, 1024, 64);
      for (const z of [0.27, -0.27]) {
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(2 * w, 1.3), new THREE.MeshBasicMaterial({ map: ban }));
        pl.position.set(0, 7.2, z); if (z < 0) pl.rotation.y = Math.PI; grp.add(pl);
      }
      grp.position.set(tmp.x, tmp.y, tmp.z); grp.rotation.y = tmp.th + Math.PI;
      g.add(grp); return grp;
    };
    const stripe = (s, tex, len = 1.2) => {
      t.at(s, 0, tmp);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tmp.w, len), new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, tmp.th, 0); m.position.set(tmp.x, tmp.y + 0.02, tmp.z);
      g.add(m);
    };
    const cheq = TX.chequer(); cheq.repeat.set(Math.round(L.width / 1.6) / 8, 1);
    stripe(START_S, cheq, 1.4); stripe(t.finishS, cheq, 2.4);
    // grid boxes
    const white = new THREE.MeshBasicMaterial({ color: '#f0f0f0' });
    for (let k = 0; k < 12; k++) {
      const s = START_S - 9 - k * 8 + 2.6, d = (k % 2 ? -1 : 1) * 2.3;
      t.at(s, d, tmp);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.25), white);
      m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, tmp.th, 0); m.position.set(tmp.x, tmp.y + 0.025, tmp.z); g.add(m);
    }
    // start gantry with five pairs of lights
    const sg = arch(START_S + 4, `${L.from.toUpperCase()}  ·  GRAND PRIX WORLD TOUR`, '#141418', '#ffffff');
    this.lightMats = [];
    for (let k = 0; k < 5; k++) {
      const m = new THREE.MeshBasicMaterial({ color: '#2a0808' }); this.lightMats.push(m);
      for (const y of [8.4, 9.0]) { const b = new THREE.Mesh(new THREE.CircleGeometry(0.24, 12), m); b.position.set((k - 2) * 0.7, y, -0.3); b.rotation.y = Math.PI; sg.add(b); }
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.3), gantryMat); box.position.set((k - 2) * 0.7, 8.7, -0.1); sg.add(box);
    }
    t.checkpoints.forEach((s, k) => arch(s, `CHECKPOINT ${k + 1} / ${t.checkpoints.length}`, '#f2f2f2', '#141418'));
    arch(t.finishS, `FINISH  ·  ${L.to.toUpperCase()}`, '#d42020', '#ffffff');
    // DRS boards
    for (const [a] of t.drs) {
      t.at(a, -(t.track ? 0 : 1) * 0 - (t.w[t.idx(a)] / 2 + t.runoff + 1.2), tmp);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), new THREE.MeshBasicMaterial({ map: TX.banner('DRS ZONE', '#12a050', '#ffffff', 256, 64) }));
      b.position.set(tmp.x, tmp.y + 2.4, tmp.z); b.rotation.y = tmp.th + Math.PI; g.add(b);
      t.at(a, 0, tmp);
      const line = new THREE.Mesh(new THREE.PlaneGeometry(tmp.w, 0.4), new THREE.MeshBasicMaterial({ color: '#f0f0f0' }));
      line.rotation.order = 'YXZ'; line.rotation.set(-Math.PI / 2, tmp.th, 0); line.position.set(tmp.x, tmp.y + 0.02, tmp.z); g.add(line);
    }
    // grandstands at the start and finish
    const crowdMat = new THREE.MeshLambertMaterial({ map: TX.crowd() });
    const standMat = new THREE.MeshLambertMaterial({ color: '#b8bcc4' });
    const stand = (s, side) => {
      const d = side * (t.w[t.idx(s)] / 2 + t.runoff + 6);
      t.at(s, d, tmp);
      const grp = new THREE.Group();
      const back = new THREE.Mesh(new THREE.BoxGeometry(40, 9, 1), standMat); back.position.set(0, 4.5, -6); grp.add(back);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(41, 0.4, 9), standMat); roof.position.set(0, 9.2, -2); grp.add(roof);
      const tex = TX.crowd().clone(); tex.needsUpdate = true; tex.repeat.set(5, 1.5);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(40, 10.5), new THREE.MeshLambertMaterial({ map: tex }));
      face.position.set(0, 4, -1.5); face.rotation.x = -0.93; grp.add(face);
      grp.position.set(tmp.x, tmp.y, tmp.z); grp.rotation.y = tmp.th + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      g.add(grp);
    };
    for (const s of [START_S - 50, START_S + 10]) for (const sd of [1, -1]) if (t.nearest(...this.sidePos(s, sd * 20)).dist > 10) stand(s, sd);
    for (const s of [t.finishS - 40, t.finishS + 15]) for (const sd of [1, -1]) stand(s, sd);
    scene.add(g); this.furniture = g;
  }
  sidePos(s, d) { const p = this.track.at(s, d, {}); return [p.x, p.z]; }

  resetCamera() {
    const p = this.player;
    this.camYaw = p.yaw;
    this.camPos.set(p.x - Math.sin(p.yaw) * 8, p.y + 3, p.z - Math.cos(p.yaw) * 8);
    this.camLook.set(p.x, p.y + 1, p.z);
  }

  /* ------------------------------------------------------------ control */
  start() { this.phase = 'lights'; this.time = 0; this.lightT = 0; this.lightsOn = 0; this.goDelay = 0.6 + Math.random() * 0.9; }

  step(input) {
    const dt = STEP;
    this.time += dt;
    if (this.phase === 'lights') {
      this.lightT += dt;
      const on = Math.min(5, Math.floor(this.lightT / 0.9));
      if (on > this.lightsOn) { this.lightsOn = on; this.events.push({ t: 'light', n: on }); }
      if (this.lightsOn === 5 && this.lightT > 4.5 + this.goDelay) { this.phase = 'race'; this.raceT = 0; this.lightsOn = 0; this.events.push({ t: 'go' }); }
    }
    const racing = this.phase === 'race' || this.phase === 'done';
    if (racing) this.raceT += dt;
    for (const c of this.cars) {
      if (c.isPlayer) this.stepPlayer(c, input, racing, dt);
      else this.stepAI(c, racing, dt);
    }
    this.collide(dt);
    this.raceControl();
  }

  /* -------- the player's car: arcade physics in world space */
  stepPlayer(c, inp, racing, dt) {
    const t = this.track, L = this.L;
    if (c.finished || inp.auto) inp = this.autopilot(c, c.finished ? 0.55 : inp.autoSkill ?? 0.985, c.finished);
    const thr = clamp(inp.throttle, 0, 1), brk = clamp(inp.brake, 0, 1);
    c.throttle = thr;
    if (!racing) { // revving on the grid
      c.rpm += ((0.25 + thr * 0.7) - c.rpm) * Math.min(1, dt * 6);
      c.v = 0; return;
    }
    const hw = c.w / 2, onKerb = Math.abs(c.d) < hw + 1.25;
    c.offroad = !onKerb;
    const surf = onKerb ? 1 : (L.city ? 0.78 : 0.6);
    const grip = surf * L.grip;
    // DRS + slipstream
    const inZone = !!t.drsFlag[t.idx(c.s)];
    if (inp.drs && inZone && !c.drs && brk < 0.1) { c.drs = true; this.events.push({ t: 'drs' }); }
    if (c.drs && (!inZone || brk > 0.1)) c.drs = false;
    let top = V_TOP + (c.drs ? 7 : 0) + c.slip * 5;
    if (!onKerb) top = L.city ? 60 : 38;
    // longitudinal
    let a = thr * accelCurve(c.v, top) * (onKerb ? 1 : 0.7);
    a -= (1 - thr) * (1.4 + c.v * 0.028);
    if (!onKerb) a -= 1.5 + c.v * 0.06;
    if (c.v > top) a -= (c.v - top) * 0.6;
    a -= brk * 38 * Math.max(0.55, grip) * (c.v > 1 ? 1 : 0);
    if (inp.handbrake) a -= 12;
    // reverse when stopped and braking
    if (c.v <= 0.5 && brk > 0.5 && thr < 0.1) a = -4;
    c.v += a * dt;
    if (c.v < 0 && !(brk > 0.5 && thr < 0.1)) c.v = Math.max(0, c.v);
    c.v = Math.max(-8, c.v);
    // steering: smoothed input mapped to a share of available grip
    const target = clamp(inp.steer, -1, 1);
    const rate = (Math.abs(target) > Math.abs(c.steer) && Math.sign(target) === Math.sign(c.steer || target)) ? 5 : 9;
    c.steer += clamp(target - c.steer, -rate * dt, rate * dt);
    const aLat = 40 * grip * (inp.handbrake ? 1.35 : 1);
    const v = Math.abs(c.v), rKin = v / 5.2, rGrip = aLat / Math.max(v, 4);
    let r = -c.steer * Math.min(rKin, rGrip) * Math.sign(c.v || 1);
    c.yawRate += (r - c.yawRate) * Math.min(1, dt * 11);
    c.yaw += c.yawRate * dt;
    // squeal: how close to the grip limit + braking
    const latUse = Math.abs(c.yawRate * v) / (40 * L.grip);
    c.squeal = clamp((latUse - 0.75) * 3, 0, 1) * (v > 12 ? 1 : 0) + (brk > 0.8 && v > 40 ? 0.5 : 0) + (inp.handbrake && v > 10 ? 0.8 : 0);
    c.visYaw += ((-c.steer * latUse * 0.12 * (inp.handbrake ? 3 : 1)) - c.visYaw) * Math.min(1, dt * 5);
    // move
    c.vl *= Math.max(0, 1 - dt * 6);
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    c.x += (fx * c.v + fz * c.vl) * dt; c.z += (fz * c.v - fx * c.vl) * dt;
    this.locate(c);
    // barrier
    const lim = c.w / 2 + t.runoff - CAR_W / 2 - 0.1;
    if (Math.abs(c.d) > lim) {
      const side = Math.sign(c.d), push = Math.abs(c.d) - lim;
      c.x -= Math.cos(c.th) * side * push; c.z += Math.sin(c.th) * side * push; c.d = side * lim;
      let rel = c.yaw - c.th; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const into = Math.sin(rel) * side; // >0 heading into the wall (+d is left = +rel)
      if (into > 0) {
        const hit = Math.abs(Math.sin(rel)) * v;
        c.v *= 1 - clamp(0.12 + Math.abs(Math.sin(rel)) * 0.8, 0, 0.75);
        c.yaw = c.th + rel * 0.25 - side * 0.02;
        c.yawRate = 0;
        if (hit > 3) { this.events.push({ t: 'bump', k: clamp(hit / 20, 0.3, 1) }); this.shake = Math.min(1, this.shake + hit / 25); }
      } else c.v *= 1 - 0.25 * dt;
      c.scrape = 0.25;
      this.sparkBurst(c, side, v);
    }
    c.scrape = Math.max(0, c.scrape - dt);
    // slipstream: car ahead, close, in line
    let slip = 0;
    for (const o of this.cars) if (o !== c) { const ds = o.s - c.s; if (ds > 5 && ds < 42 && Math.abs(o.d - c.d) < 1.7) slip = Math.max(slip, 1 - (ds - 5) / 40); }
    c.slip += (slip - c.slip) * Math.min(1, dt * 2);
    this.gearbox(c, thr);
    // wrong way
    let rel = c.yaw - c.th; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    c.wrong = Math.abs(rel) > 1.9 && v > 3 ? (c.wrong || 0) + dt : 0;
    if (inp.reset) this.resetToRoad(c);
  }

  gearbox(c, thr) {
    const v = Math.abs(c.v);
    let g = 1; while (g < 8 && v > GEAR_TOP[g]) g++;
    const lo = GEAR_TOP[g - 1], hi = GEAR_TOP[g];
    const target = 0.42 + 0.58 * clamp((v - lo) / (hi - lo), 0, 1);
    c.gear = g;
    c.rpm += ((g === 1 ? 0.25 + 0.75 * v / hi : target) * (0.92 + thr * 0.08) - c.rpm) * 0.35;
  }

  locate(c) {
    const t = this.track, o = this._p || (this._p = {});
    t.project(c.x, c.z, c.idx, o);
    c.s = o.s; c.d = o.d; c.idx = o.i; c.y = o.y; c.th = o.th; c.w = o.w;
    c.slope = (t.y[Math.min(t.n - 1, o.i + 1)] - t.y[o.i]) / DS;
  }

  resetToRoad(c) {
    const t = this.track, s = Math.max(0, c.s - 8), p = t.at(s, clamp(t.lerp(t.line, s), -2, 2), {});
    c.x = p.x; c.z = p.z; c.yaw = p.th; c.v = 0; c.vl = 0; c.yawRate = 0; c.steer = 0;
    this.locate(c); this.events.push({ t: 'reset' });
  }

  /* Autopilot: pure pursuit on the racing line, speed from the profile. Used
   * after the finish, for attract mode and by the automated tests. */
  autopilot(c, skill, cool) {
    const t = this.track, v = Math.max(0, c.v), look = 9 + v * 0.42;
    const want = this.laneTarget(c, t.lerp(t.line, c.s + look));
    const p = t.at(c.s + look, want, this._ap || (this._ap = {}));
    const dx = p.x - c.x, dz = p.z - c.z, fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const lz = dx * fx + dz * fz, lx = dx * fz - dz * fx; // lx > 0: target to the left
    const alpha = Math.atan2(lx, Math.max(0.1, lz));
    const rDes = 2 * Math.max(v, 3) * Math.sin(alpha) / look;
    const grip = 40 * this.L.grip, cap = Math.min(Math.max(v, 3) / 5.2, grip / Math.max(v, 4));
    const steer = clamp(-rDes / cap, -1, 1);
    let vt = Math.min(t.lerp(this.apProf, c.s), t.lerp(this.apProf, c.s + v * 0.35)) * skill;
    if (cool) vt = Math.min(vt, c.s > t.finishS + 160 ? 0 : 24);
    const brake = v > vt + 1.2 ? clamp((v - vt) / 5, 0, 1) : 0;
    const throttle = v < vt - 0.5 ? 1 : v < vt ? 0.4 : 0;
    const inZone = t.drsFlag[t.idx(c.s)];
    return { throttle, brake, steer, handbrake: false, drs: !!inZone && !cool, reset: false };
  }

  /* lateral target with traffic avoidance, shared by AI and autopilot */
  laneTarget(c, want) {
    const lim = c.w ? c.w / 2 - 1.2 : 4;
    let block = null, bestDs = 1e9;
    for (const o of this.cars) {
      if (o === c) continue;
      const ds = o.s - c.s, dd = o.d - c.d;
      const near = 8 + Math.max(0, c.v - o.v) * 2.2;
      if (ds > 0 && ds < near && Math.abs(dd) < 2.4 && ds < bestDs) { bestDs = ds; block = o; }
      if (Math.abs(ds) < 6 && Math.abs(dd) < 2.4) want += (dd > 0 ? -1 : 1) * 1.2;
    }
    if (block && c.v > block.v - 0.5) {
      const l = block.d + 2.7, r = block.d - 2.7;
      const okL = l < lim, okR = r > -lim;
      if (okL && okR) want = Math.abs(l - want) < Math.abs(r - want) ? l : r;
      else if (okL) want = l; else if (okR) want = r;
      else c.follow = block;
    } else c.follow = null;
    return clamp(want, -lim, lim);
  }

  /* -------- AI: drives in track space along the racing line */
  stepAI(c, racing, dt) {
    const t = this.track;
    c.w = t.w[t.idx(c.s)];
    if (!racing || this.raceT < c.react) { c.v = 0; c.throttle = this.phase === 'lights' ? 0.5 : 0; this.gearbox(c, 0.4); this.placeAI(c, 0, dt); return; }
    const look = c.s + Math.max(6, c.v * 0.4);
    let target = Math.min(t.lerp(this.aiProf, c.s), t.lerp(this.aiProf, look)) * c.skill;
    // subtle rubber band
    const p = this.player;
    if (!p.finished && !c.finished) {
      const gap = c.s - p.s;
      target *= 1 - clamp(gap / 500, -1, 1) * 0.022;
    }
    if (c.finished) target = Math.min(target, c.s > t.finishS + 180 ? 0 : 26);
    c.follow = null;
    const want = this.laneTarget(c, t.lerp(t.line, c.s + 14) * (0.8 + c.skill * 0.2) + c.bias * 0.6);
    if (c.follow) target = Math.min(target, c.follow.v + (c.follow.s - c.s - 7) * 0.4);
    // slipstream for the AI too
    if (c.follow && c.follow.s - c.s < 30) target += 1.2;
    const top = V_TOP - 1 + (t.drsFlag[t.idx(c.s)] ? 6 : 0);
    if (c.v < target) { c.v += accelCurve(c.v, top) * dt; c.v = Math.min(c.v, target); c.throttle = 1; }
    else { c.v = Math.max(target, c.v - 32 * this.L.grip * dt); c.throttle = 0; }
    c.v = Math.max(0, c.v);
    const latRate = 1.6 + c.v * 0.05;
    const dd = clamp(want - c.d, -latRate * dt, latRate * dt);
    c.d += dd;
    c.s += c.v * dt;
    c.drs = !!t.drsFlag[t.idx(c.s)] && !c.finished;
    this.gearbox(c, c.throttle);
    this.placeAI(c, dd / dt, dt);
  }
  placeAI(c, latV, dt) {
    const t = this.track, p = this._ai || (this._ai = {});
    const lim = t.w[t.idx(c.s)] / 2 + t.runoff - 1.2;
    c.d = clamp(c.d, -lim, lim);
    t.at(c.s, c.d, p);
    c.x = p.x; c.z = p.z; c.y = p.y; c.th = p.th; c.idx = t.idx(c.s); c.slope = p.slope;
    const yaw = p.th + Math.atan2(latV, Math.max(4, c.v));
    c.yawRate = (yaw - c.yaw) / Math.max(dt, 1e-3);
    c.yaw = yaw;
    c.steer += ((t.lerp(t.k, c.s + 6) * 6) - c.steer) * 0.2;
    c.squeal = clamp(t.lerp(t.kAbs, c.s) * c.v * c.v / 40 - 0.8, 0, 1);
  }

  /* -------- car-to-car contact, resolved in track space */
  collide(dt) {
    const cs = this.cars, t = this.track;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      const ds = b.s - a.s, dd = b.d - a.d;
      if (Math.abs(ds) > CAR_LEN || Math.abs(dd) > CAR_W) continue;
      const ps = CAR_LEN - Math.abs(ds), pd = CAR_W - Math.abs(dd);
      const rel = Math.abs(a.v - b.v);
      if (pd < ps * 0.55) { // side by side: push apart laterally
        const sg = Math.sign(dd) || 1, push = pd / 2 + 0.01;
        this.nudge(a, 0, -sg * push); this.nudge(b, 0, sg * push);
        if (a.isPlayer) a.vl -= sg * 3; if (b.isPlayer) b.vl += sg * 3;
        a.v *= 0.997; b.v *= 0.997;
        if ((a.isPlayer || b.isPlayer) && !this._sideBump) { this.events.push({ t: 'bump', k: 0.35 }); this.shake = Math.min(1, this.shake + 0.25); }
        this._sideBump = 0.3;
      } else { // nose to tail
        const back = ds > 0 ? a : b, front = ds > 0 ? b : a;
        const sep = ps / 2 + 0.01;
        this.nudge(back, -sep, 0); this.nudge(front, sep, 0);
        if (back.v > front.v) {
          const dv = back.v - front.v;
          back.v -= dv * 0.6; front.v += dv * 0.25;
          if ((a.isPlayer || b.isPlayer) && dv > 2) { this.events.push({ t: 'bump', k: clamp(dv / 15, 0.3, 1) }); this.shake = Math.min(1, this.shake + dv / 20); }
        }
      }
    }
    if (this._sideBump) this._sideBump = Math.max(0, this._sideBump - dt);
  }
  nudge(c, ds, dd) {
    if (c.isPlayer) {
      const th = c.th;
      c.x += Math.sin(th) * ds + Math.cos(th) * dd; c.z += Math.cos(th) * ds - Math.sin(th) * dd;
      c.s += ds; c.d += dd;
    } else { c.s += ds; c.d += dd; }
  }

  /* -------- positions, checkpoints, finish */
  raceControl() {
    const t = this.track;
    if (this.phase !== 'race' && this.phase !== 'done') return;
    for (const c of this.cars) {
      if (!c.finished && c.cp < t.checkpoints.length && c.s >= t.checkpoints[c.cp]) {
        if (c.isPlayer) this.events.push({ t: 'cp', n: c.cp + 1, time: this.raceT });
        c.cp++;
      }
      if (!c.finished && c.s >= t.finishS) {
        c.finished = true;
        // interpolate the exact crossing time
        c.finishTime = this.raceT - (c.s - t.finishS) / Math.max(1, c.v);
        if (c.isPlayer) { this.phase = 'done'; this.events.push({ t: 'finish' }); }
      }
    }
    const order = [...this.cars].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1; if (b.finished) return 1;
      return b.s - a.s;
    });
    order.forEach((c, i) => { c.place = i + 1; });
    // announce a gained place once it has been held for half a second
    const p = this.player;
    if (this.stablePlace == null) this.stablePlace = p.place;
    if (p.place !== this.candPlace) { this.candPlace = p.place; this.candT = 0; }
    this.candT += STEP;
    if (this.candT > 0.5 && p.place !== this.stablePlace) {
      if (p.place < this.stablePlace && this.phase === 'race') this.events.push({ t: 'overtake', place: p.place });
      this.stablePlace = p.place;
    }
  }

  /* Final classification. Cars still racing get a projected time. */
  results() {
    const t = this.track;
    const list = this.cars.map(c => {
      let time = c.finishTime, est = false;
      if (!c.finished) { time = this.raceT + (t.finishS - c.s) / Math.max(30, c.v * 0.92); est = true; }
      return { c, time, est };
    }).sort((a, b) => a.time - b.time);
    return list;
  }

  /* ------------------------------------------------------------ frame */
  frame(dt, aspect) {
    const t = this.track, cam = this.camera, p = this.player;
    cam.aspect = aspect; cam.updateProjectionMatrix();
    // car transforms
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
    let wi = 0;
    const wm = this.wheelMesh, sm = this.shadowMesh;
    const camX = this.camPos.x, camZ = this.camPos.z;
    for (const c of this.cars) {
      const g = c.mesh;
      const dx = c.x - camX, dz = c.z - camZ, far = dx * dx + dz * dz > this.drawDist * this.drawDist;
      g.visible = !far && (c.isPlayer || dx * dx + dz * dz > 10);
      const pitch = -Math.atan(c.slope || 0) + (c.isPlayer ? clamp(-(c.throttle - 0.3) * 0.006 + (c.lastV != null ? (c.lastV - c.v) / dt * 0.0012 : 0), -0.03, 0.03) : 0);
      c.lastV = c.v;
      const roll = clamp(c.yawRate * c.v * 0.0016, -0.05, 0.05);
      c.pitch += (pitch - c.pitch) * 0.2; c.roll += (roll - c.roll) * 0.2;
      g.position.set(c.x, c.y, c.z);
      g.rotation.set(c.pitch, c.yaw + (c.visYaw || 0), c.roll, 'YXZ');
      g.userData.flap.rotation.x = c.drs ? 1.15 : 0.55;
      g.updateMatrix();
      c.spin = (c.spin + c.v * dt / 0.36) % (Math.PI * 2);
      for (const w of WHEELS) {
        if (!g.visible) { M.makeScale(0, 0, 0); wm.setMatrixAt(wi++, M); continue; }
        E.set(c.spin, w.front ? c.steer * -0.38 : 0, 0, 'YXZ');
        Q.setFromEuler(E);
        M.compose(V.set(w.x, w.r, w.z), Q, S.set(w.w, w.r, w.r));
        M.premultiply(g.matrix); wm.setMatrixAt(wi++, M);
      }
      Q.setFromAxisAngle(V.set(0, 1, 0), c.yaw);
      M.compose(V.set(c.x, c.y + 0.04, c.z), Q, S.set(2.6, 1, 6.4)); sm.setMatrixAt(c.id, M);
      // effects: smoke from brakes/kerbs/grass, rain spray
      this.carFx(c, dt);
    }
    wm.instanceMatrix.needsUpdate = true; sm.instanceMatrix.needsUpdate = true;
    // camera
    this.updateCamera(dt);
    p.mesh.userData.helmet.visible = this.camMode !== 'cockpit';
    p.mesh.userData.dec.visible = this.camMode !== 'cockpit';
    this.sky.position.copy(cam.position);
    if (this.carLight) this.carLight.position.set(p.x + Math.sin(p.yaw) * 6, p.y + 9, p.z + Math.cos(p.yaw) * 6);
    this.sun.position.copy(cam.position).add(new THREE.Vector3(...this.L.sky.sun).multiplyScalar(200));
    this.sun.target.position.copy(cam.position); this.sun.target.updateMatrixWorld();
    t.cull(cam.position.x, cam.position.z, this.drawDist);
    this.scenery.cull(cam.position.x, cam.position.z, this.drawDist);
    this.smoke.update(dt); this.sparks.update(dt);
    if (this.weather) this.weather.update(dt, cam.position, { x: Math.sin(p.yaw) * p.v, z: Math.cos(p.yaw) * p.v });
    this.lines.update(dt, Math.abs(p.v), p.drs ? 1 : p.slip);
    // start lights
    this.lightMats.forEach((m, k) => m.color.set(k < this.lightsOn ? '#ff1a1a' : '#2a0808'));
  }

  carFx(c, dt) {
    const v = Math.abs(c.v);
    const near = (c.x - this.camPos.x) ** 2 + (c.z - this.camPos.z) ** 2 < 120 * 120;
    if (!near) return;
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const rx = c.x - fx * 1.8, rz = c.z - fz * 1.8;
    if (c.isPlayer && (c.squeal > 0.4 || (c.offroad && v > 8)) && Math.random() < 0.7) {
      const col = c.offroad ? this.dustCol : { r: 0.85, g: 0.85, b: 0.88 };
      for (const s of [1, -1]) this.smoke.spawn(rx + fz * 0.8 * s, c.y + 0.3, rz - fx * 0.8 * s, (Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2, 1.2, 0.9, 3, c.offroad ? 0.5 : 0.35, col.r, col.g, col.b, 1.2);
    }
    if (this.L.weather === 'rain' && v > 25 && Math.random() < 0.8) {
      this.smoke.spawn(rx - fx * 0.8, c.y + 0.5, rz - fz * 0.8, -fx * v * 0.25 + (Math.random() - 0.5) * 3, 1 + Math.random(), -fz * v * 0.25 + (Math.random() - 0.5) * 3, 0.7, 1.6, 2.5, 0.22, 0.8, 0.84, 0.88, 2);
    }
    if (this.L.weather === 'snow' && v > 25 && Math.random() < 0.5) {
      this.smoke.spawn(rx - fx * 0.8, c.y + 0.4, rz - fz * 0.8, -fx * v * 0.2, 0.6, -fz * v * 0.2, 0.6, 1.4, 2, 0.25, 0.95, 0.97, 1, 2);
    }
  }
  sparkBurst(c, side, v) {
    if (v < 6) return;
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), nx = Math.cos(c.th) * side, nz = -Math.sin(c.th) * side;
    for (let k = 0; k < 4; k++) {
      this.sparks.spawn(c.x + nx * 0.9 + fx * (Math.random() * 3 - 1.5), c.y + 0.25, c.z + nz * 0.9 + fz * (Math.random() * 3 - 1.5),
        fx * v * 0.5 + (Math.random() - 0.5) * 6, 2 + Math.random() * 4, fz * v * 0.5 + (Math.random() - 0.5) * 6, 0.35 + Math.random() * 0.3, 0.12, 0, 1, 1, 0.75, 0.3, 0.6, 9.8);
    }
  }

  updateCamera(dt) {
    const p = this.player, cam = this.camera, k = Math.min(1, dt * 60);
    const speed = Math.abs(p.v);
    if (this.camMode === 'cockpit') {
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      cam.position.set(p.x + fx * -0.05, p.y + 1.04, p.z + fz * -0.05);
      const pitch = p.pitch;
      cam.up.set(Math.cos(p.yaw) * p.roll * 0.6, 1, -Math.sin(p.yaw) * p.roll * 0.6);
      cam.lookAt(p.x + fx * 20, p.y + 1.04 + Math.tan(-pitch) * 20 - 0.6, p.z + fz * 20);
      cam.fov = 72 + speed * 0.1;
      this.camPos.copy(cam.position);
    } else {
      let d = p.yaw - this.camYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.camYaw += d * Math.min(1, dt * 5.5);
      const back = 6.6 + speed * 0.012, up = 2.15 + speed * 0.004;
      const tx = p.x - Math.sin(this.camYaw) * back, tz = p.z - Math.cos(this.camYaw) * back, ty = p.y + up;
      this.camPos.x += (tx - this.camPos.x) * Math.min(1, dt * 14);
      this.camPos.z += (tz - this.camPos.z) * Math.min(1, dt * 14);
      this.camPos.y += (ty - this.camPos.y) * Math.min(1, dt * 8);
      // never below the road
      this.camPos.y = Math.max(this.camPos.y, p.y + 1.1);
      this.camLook.set(p.x + Math.sin(this.camYaw) * 3, p.y + 1.05, p.z + Math.cos(this.camYaw) * 3);
      cam.position.copy(this.camPos);
      cam.up.set(0, 1, 0);
      cam.lookAt(this.camLook);
      cam.fov = 64 + clamp(speed - 30, 0, 70) * 0.26 + (p.drs ? 3 : 0);
    }
    if (this.shake > 0) {
      const s = this.shake * 0.12;
      cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    // high-speed buzz and kerb rumble
    if (p.offroad && speed > 10) { cam.position.y += (Math.random() - 0.5) * 0.05; }
    cam.updateProjectionMatrix();
  }

  /* Orbiting shot of the grid during the intro card. */
  introCamera(time) {
    const p = this.player, cam = this.camera;
    const a = time * 0.25 + 0.6, r = 11;
    cam.position.set(p.x + Math.sin(p.yaw + a) * r, p.y + 3.2, p.z + Math.cos(p.yaw + a) * r);
    cam.up.set(0, 1, 0); cam.lookAt(p.x, p.y + 0.6, p.z); cam.fov = 50; cam.updateProjectionMatrix();
    this.camPos.copy(cam.position);
  }

  dispose() {
    this.scene.traverse(o => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map && !m.map.userData?.cached) { /* textures are memoised; keep */ } m.dispose(); });
    });
    if (this.env) this.env.dispose();
  }
}

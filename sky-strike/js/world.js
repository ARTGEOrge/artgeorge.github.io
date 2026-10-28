/* A running mission: scene, lighting, terrain, the player's jet and its
 * flight model, weapons (cannon, bombs with CCIP, homing missiles, flares),
 * Iron Crown ground forces, SAMs, AA, ships and enemy fighters. Runs on a
 * fixed 60 Hz step so the test hook can fast-forward deterministically. */
import * as THREE from 'three';
import { Terrain } from './terrain.js';
import { Sky, skyMaterial } from './sky.js';
import { FX } from './fx.js';
import { buildJet, bombGeometry, missileGeometry } from './jet.js';
import { TYPES, MAT, bridgeSegment, pier, wall, windowTexture } from './models.js';
import * as audio from './audio.js';
import { clamp, lerp, damp, rng, pathAt, smoothPath } from './util.js';

export const STEP = 1 / 60;
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
const fwdOf = (q, out = new THREE.Vector3()) => out.set(0, 0, -1).applyQuaternion(q);
const upOf = (q, out = new THREE.Vector3()) => out.set(0, 1, 0).applyQuaternion(q);
const rightOf = (q, out = new THREE.Vector3()) => out.set(1, 0, 0).applyQuaternion(q);

/* steering towards a world point; returns stick inputs. Small errors fly a
 * coordinated banked turn; big ones roll the target into the lift plane and pull. */
const _s1 = new THREE.Vector3(), _s2 = new THREE.Vector3(), _s3 = new THREE.Vector3();
export function steerTo(pos, quat, target, out = {}, gain = 1) {
  const l = _v3.copy(target).sub(pos).applyQuaternion(_q2.copy(quat).invert());
  const dist = l.length() || 1, ang = Math.acos(clamp(-l.z / dist, -1, 1));
  const fw = fwdOf(quat, _s1), up = upOf(quat, _s2), r = rightOf(quat, _s3);
  const bank = Math.atan2(-r.y, up.y);
  const dx = target.x - pos.x, dy = target.y - pos.y, dz = target.z - pos.z, dh = Math.hypot(dx, dz) || 1;
  const hf = Math.hypot(fw.x, fw.z) || 1;
  const yawErr = Math.atan2(fw.x * dz - fw.z * dx, fw.x * dx + fw.z * dz); // + = target to the right
  const elevErr = Math.atan2(dy, dh) - Math.atan2(fw.y, hf);
  let roll, pitch;
  if (ang < 0.9 && up.y > 0.2) {
    const bankD = clamp(yawErr * 2.0 * gain, -1.2, 1.2);
    roll = clamp((bankD - bank) * 1.8, -1, 1);
    pitch = clamp(elevErr * 3 * Math.cos(bank) + Math.abs(Math.sin(bank)) * Math.min(1, Math.abs(yawErr) * 2.5) * 0.45, -0.5, 1);
  } else {
    const rollErr = Math.atan2(l.x, l.y);
    roll = clamp(rollErr * 2.2, -1, 1);
    pitch = Math.abs(rollErr) < 0.7 ? 1 : 0.25;
  }
  out.pitch = pitch; out.roll = roll; out.ang = ang; out.dist = dist;
  return out;
}

class Flyer {
  constructor(pos, yaw, speed) {
    this.pos = pos.clone(); this.quat = new THREE.Quaternion().setFromAxisAngle(AY, yaw); this.vel = fwdOf(this.quat).multiplyScalar(speed);
    this.speed = speed; this.rp = 0; this.rr = 0; this.ry = 0; this.g = 1; this.ab = 0; this.stall = false;
  }
  /* arcade flight model; inp: pitch, roll, yaw (-1..1), ab, brake */
  fly(inp, dt, o = {}) {
    const f = fwdOf(this.quat, _v1), up = upOf(this.quat, _v2), r = rightOf(this.quat, _v3);
    const eff = clamp((this.speed - 45) / 95, 0.22, 1);
    const bank = Math.atan2(-r.y, up.y), upY = up.y;
    let tp = inp.pitch * (inp.pitch > 0 ? (o.pull || 1.45) : 0.95) * eff;
    let tr = inp.roll * (o.rollRate || 3.0) * (0.45 + 0.55 * eff);
    const ty = (inp.yaw || 0) * 0.42 * eff;
    if (o.autoLevel !== false && Math.abs(inp.roll) < 0.06 && Math.abs(bank) < 1.25 && upY > 0) tr -= bank * 1.1;
    this.stall = this.speed < 72;
    this.rp = damp(this.rp, tp, 8, dt); this.rr = damp(this.rr, tr, 10, dt); this.ry = damp(this.ry, ty, 5, dt);
    _q1.setFromAxisAngle(AX, this.rp * dt); this.quat.multiply(_q1);
    _q1.setFromAxisAngle(AZ, -this.rr * dt); this.quat.multiply(_q1);
    _q1.setFromAxisAngle(AY, -this.ry * dt); this.quat.multiply(_q1);
    // bank-to-turn assist and gentle nose drop when stalling
    const turn = Math.sin(bank) * 0.36 * eff * Math.max(0, upY);
    _q1.setFromAxisAngle(AY, -turn * dt); this.quat.premultiply(_q1);
    if (this.stall) {
      const k = (72 - this.speed) / 72 * 1.1 * dt, fw = fwdOf(this.quat, _v1);
      const axis = _v2.crossVectors(fw, AY); if (axis.lengthSq() > 1e-4 && fw.y > -0.7) { axis.normalize(); _q1.setFromAxisAngle(axis, -k); this.quat.premultiply(_q1); }
    }
    this.quat.normalize();
    const fw = fwdOf(this.quat, _v1);
    const target = inp.brake ? 92 : inp.ab ? (o.abSpeed || 300) : (o.cruise || 175);
    const accel = (target - this.speed) * (inp.ab ? 0.32 : inp.brake ? 0.55 : 0.2) - 9.81 * fw.y * 0.78 - Math.max(0, this.g - 2) * 0.9;
    this.speed = clamp(this.speed + accel * dt, 40, 360);
    this.ab = damp(this.ab, inp.ab ? 1 : 0, 6, dt);
    _v2.copy(fw).multiplyScalar(this.speed);
    this.vel.lerp(_v2, 1 - Math.exp(-dt * 4.5));
    if (this.stall) this.vel.y -= (72 - this.speed) / 72 * 9.81 * dt * 0.6;
    this.pos.addScaledVector(this.vel, dt);
    this.g = clamp(1 + this.rp * this.speed / 9.81 * 0.85 * Math.max(0.2, upY * 0.5 + 0.5), -3, 9.5);
  }
}

export class World {
  constructor(M, renderer, opt = {}) {
    this.M = M; this.renderer = renderer; this.tier = opt.tier; this.R = rng(M.seed || M.id * 977);
    const T = this.tier, env = M.env;
    this.fogD = env.fogDensity / T.draw;
    const envX = { ...env, fogDensity: this.fogD };
    this.env = envX;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(env.fog, this.fogD);
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.6, 16000);
    // lights
    const sunDir = new THREE.Vector3(...env.sunDir).normalize(); this.sunDir = sunDir;
    this.hemi = new THREE.HemisphereLight(env.hemiSky, env.hemiGround, env.hemiInt ?? 1.1); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(env.sunColor || '#fff4e0', env.sunInt ?? 2.6); this.scene.add(this.sun); this.scene.add(this.sun.target);
    if (T.shadows) {
      this.sun.castShadow = true; this.sun.shadow.mapSize.set(T.shadows, T.shadows);
      const b = T.shadowBox / 2, c = this.sun.shadow.camera; c.left = -b; c.right = b; c.top = b; c.bottom = -b; c.near = 10; c.far = 3200;
      this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.6;
    }
    // environment map from the sky
    const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMaterial(env)));
    this.envRT = pm.fromScene(es, 0, 0.1, 1000); pm.dispose(); es.children[0].geometry.dispose(); es.children[0].material.dispose();
    this.scene.environment = this.envRT.texture;
    this.sky = new Sky(this.scene, envX, T);
    this.terrain = new Terrain(M.terrain, T);
    this.terrain.build(this.scene, { envMap: this.envRT.texture, avoid: M.avoid });
    this.fx = new FX(this.scene, T, envX, this.terrain);

    // player
    this.jet = buildJet({ enemy: false, hi: true });
    this.scene.add(this.jet.group);
    const S = M.start;
    this.player = new Flyer(new THREE.Vector3(S[0], S[1], S[2]), S[3] || 0, 180);
    const A = M.ammo || {};
    this.ammoMax = { gun: A.gun || 600, bombs: A.bombs || 12, msl: A.msl || 6, flares: A.flares || 30 };
    this.ammo = { ...this.ammoMax };
    Object.assign(this.player, { hp: 100, heat: 0, over: false, alive: true, gunAcc: 0, gunSide: 0, bombSide: 0, mslSide: 0, flareCd: 0, bombCd: 0, mslCd: 0, firing: false });
    this.camMode = opt.cam || 'chase';
    // Assists: auto pull-up, softer hits, quicker locks and bombs that home onto nearby targets.
    this.assist = opt.assist !== false; this.hitMark = 0; this.gcasT = 0;
    this.camQ = this.player.quat.clone(); this.camPos = new THREE.Vector3(); this.shake = 0; this.fov = 65;
    // collections
    this.targets = []; this.bullets = []; this.ebullets = []; this.bombs = []; this.missiles = []; this.emissiles = []; this.flares = []; this.shells = []; this.fighters = []; this.rings = []; this.pending = []; this.decor = [];
    this.bridges = []; this.searchlights = [];
    this.events = []; this.time = 0; this.phase = 'brief'; this.score = 0; this.kills = 0; this.shots = { fired: 0, hit: 0 };
    this.lock = { target: null, t: 0, locked: false };
    this.ccip = null; this.warn = 0; this.pullUp = false; this.outOfBounds = 0; this.doneT = 0; this.result = null;
    this.bombGeo = bombGeometry(); this.mslGeo = missileGeometry(false); this.emslGeo = missileGeometry(true);
    this.storeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3 });
    this.radarNet = 0;
    // populate
    this.color = M.color || '#6a6a50';
    M.populate(this, this.R);
    this.objectives = M.objectives.map(o => ({ ...o, total: 0, done: 0, complete: false }));
    this.countObjectives();
    this.objectives.forEach(o => o.total = o.count ?? o.total);
    this.waves = (M.fighters || []).map(w => ({ ...w, spawned: false }));
    this.beacon = makeBeacon(); this.scene.add(this.beacon);
    this.updateJetVisual(0);
    this.jet.setStores(this.ammo.bombs, this.ammoMax.bombs, this.ammo.msl, this.ammoMax.msl);
  }

  /* ------------------------------------------------------------ placement API (used by missions) */
  add(type, x, z, o = {}) {
    const def = TYPES[type], model = def.make(o.color || this.color), g = model.group;
    const y = o.y ?? (def.ship ? this.terrain.waterLevel : this.terrain.height(x, z)) + (o.dy || 0);
    g.position.set(x, y, z); g.rotation.y = o.yaw || 0; if (o.scale) g.scale.setScalar(o.scale);
    this.scene.add(g);
    const sc = o.scale || 1;
    const t = { id: this.targets.length, type, def, model, group: g, pos: g.position, hp: def.hp * (o.hp || 1), maxHp: def.hp * (o.hp || 1), alive: true, tag: o.tag || null, primary: !!o.tag && o.primary !== false, r: def.r * sc, cy: def.cy * sc, score: def.score, label: o.label || def.label, yaw: o.yaw || 0, vel: new THREE.Vector3() };
    if (def.aa) t.aa = { ...def.aa, ...(o.aa || {}), burst: 0, cd: this.R() * 2, losT: this.R() * 0.5, los: false };
    if (def.flak) t.flak = { ...def.flak, cd: this.R() * 2, losT: this.R() * 0.5, los: false };
    if (def.sam) t.sam = { ...def.sam, ...(o.sam || {}), state: 'search', t: 0, shots: o.shots ?? def.sam.shots, losT: this.R() * 0.5, los: false, lost: 0 };
    if (def.radar) this.radarNet++;
    if (o.path) { t.path = o.path; t.pathT = o.pathT || 0; t.speed = o.speed || 9; t.loop = !!o.loop; }
    if (o.circle) { t.circle = o.circle; }
    this.targets.push(t);
    return t;
  }
  /* static scenery on the ground (walls, docks, revetments, cranes...) */
  place(model, x, z, yaw = 0, dy = 0, y = null) {
    const g = model.group || model; g.position.set(x, y ?? this.terrain.height(x, z) + dy, z); g.rotation.y = yaw; this.scene.add(g); this.decor.push(g); return g;
  }
  wallRing(x, z, r, n = 16, gap = 1, c) {
    for (let i = 0; i < n; i++) {
      if (i < gap) continue;
      const a = (i + 0.5) / n * Math.PI * 2, len = 2 * Math.PI * r / n + 1;
      this.place(wall(len, c), x + Math.cos(a) * r, z + Math.sin(a) * r, -a, -0.5);
    }
  }
  /* a bridge between two points with the deck at height y; spans become one target */
  bridge(x1, z1, x2, z2, y, tag, o = {}) {
    const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz), n = o.spans || 5, sl = L / n;
    const group = new THREE.Group(); group.position.set(x1, y, z1); group.rotation.y = yaw; this.scene.add(group);
    const spans = [];
    for (let i = 0; i < n; i++) {
      const s = bridgeSegment(sl + 0.4, o.w || 14).group; s.position.set(0, 0, sl * (i + 0.5)); group.add(s); spans.push(s);
      if (i > 0) { const ph = Math.max(6, y - Math.min(this.terrain.height(x1 + dx * i / n, z1 + dz * i / n), y) + 8); const p = pier(ph).group; p.position.set(0, -1.6, sl * i); group.add(p); }
    }
    const mid = new THREE.Vector3(x1 + dx / 2, y, z1 + dz / 2);
    const t = { id: this.targets.length, type: 'bridge', def: TYPES.bridge, model: { group }, group, pos: mid, hp: TYPES.bridge.hp, maxHp: TYPES.bridge.hp, alive: true, tag, primary: !!tag, r: 16, cy: 0, score: TYPES.bridge.score, label: 'Bridge', yaw, vel: new THREE.Vector3(),
      cap: { a: new THREE.Vector3(x1 + dx * 0.15, y, z1 + dz * 0.15), b: new THREE.Vector3(x2 - dx * 0.15, y, z2 - dz * 0.15) }, spans, deck: y, ends: [x1, z1, x2, z2] };
    this.targets.push(t); this.bridges.push(t);
    return t;
  }
  convoy(road, types, o = {}) {
    const pts = road.pts || smoothPath(road, 5), len = pathAt(pts, 0).len;
    types.forEach((ty, i) => {
      const at = pathAt(pts, (o.t0 || 0.05) - i * (o.gap || 28) / len);
      this.add(ty, at.x, at.z, { tag: o.tag, path: pts, pathT: (o.t0 || 0.05) - i * (o.gap || 28) / len, speed: o.speed || 9, yaw: at.yaw + Math.PI, hp: o.hp });
    });
  }
  runway(x, z, yaw, len = 900, w = 45) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 1024; const g = c.getContext('2d');
    g.fillStyle = '#2c2e31'; g.fillRect(0, 0, 64, 1024);
    for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},.05)`; g.fillRect(Math.random() * 64, Math.random() * 1024, 1, 1); }
    g.fillStyle = '#e8e8e0'; for (let y = 60; y < 964; y += 40) g.fillRect(31, y, 2, 22);
    for (let i = 0; i < 8; i++) { g.fillRect(4 + i * 7, 8, 4, 40); g.fillRect(4 + i * 7, 976, 4, 40); }
    g.fillRect(1, 0, 2, 1024); g.fillRect(61, 0, 2, 1024);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const geo = new THREE.PlaneGeometry(w, len); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.receiveShadow = true; this.place(m, x, z, yaw, 0.2);
  }
  city(cx, cz, w, d, n, o = {}) {
    const R = this.R, night = !!this.M.env.night;
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 4);
    const win = windowTexture(night);
    const mat = new THREE.MeshStandardMaterial({ color: night ? '#3a3e48' : '#b8b4aa', map: night ? null : win, emissiveMap: night ? win : null, emissive: night ? new THREE.Color(3.2, 2.7, 2.1) : new THREE.Color(0, 0, 0), roughness: 0.8 });
    const im = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    let k = 0;
    for (let i = 0; i < n * 3 && k < n; i++) {
      const x = cx + (R() - 0.5) * w, z = cz + (R() - 0.5) * d;
      if (o.avoid && o.avoid(x, z)) continue;
      const bw = 14 + R() * 26, bd = 14 + R() * 26, distC = Math.hypot((x - cx) / w, (z - cz) / d), bh = (10 + R() * 30) * (1 + (1 - distC) * 2.2) * (R() < 0.08 ? 2.2 : 1);
      q.setFromAxisAngle(AY, o.grid ? 0 : (R() - 0.5) * 0.2 + (o.yaw || 0));
      m4.compose(_v1.set(x, this.terrain.height(x, z) - 1, z), q, _v2.set(bw, bh, bd)); im.setMatrixAt(k, m4);
      col.setHSL(0.08 + R() * 0.06, 0.08, 0.55 + R() * 0.3); im.setColorAt(k, col); k++;
    }
    im.count = k; im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); this.scene.add(im); this.decor.push(im);
    if (night) { // street lights
      const lg = new THREE.SphereGeometry(2.6, 6, 4), lm = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.6, 1.1), toneMapped: false }), L = new THREE.InstancedMesh(lg, lm, 500);
      let j = 0; for (let i = 0; i < 500; i++) { const x = cx + (R() - 0.5) * w * 1.1, z = cz + (R() - 0.5) * d * 1.1; if (o.avoid && o.avoid(x, z)) continue; m4.makeTranslation(x, this.terrain.height(x, z) + 9, z); L.setMatrixAt(j++, m4); }
      L.count = j; L.computeBoundingSphere(); this.scene.add(L); this.decor.push(L);
    }
  }
  searchlight(x, z) {
    const g = new THREE.ConeGeometry(18, 900, 20, 1, true); g.translate(0, -450, 0); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying float vL; void main(){ vL = -position.z / 900.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying float vL; void main(){ float a = pow(1.0 - vL, 1.5) * 0.3; gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a, a); }` }));
    const piv = new THREE.Group(); piv.position.set(x, this.terrain.height(x, z) + 3, z); piv.add(m); this.scene.add(piv);
    this.searchlights.push({ g: piv, a: this.R() * 6, s: 0.15 + this.R() * 0.2, e: 0.6 + this.R() * 0.4 });
    this.decor.push(piv);
  }
  rearm(x, y, z) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(26, 2.2, 10, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.2, 1.0), toneMapped: false, transparent: true, opacity: 0.85 }));
    m.position.set(x, y, z); this.scene.add(m); this.rings.push({ m, pos: m.position, used: false, cd: 0 });
  }

  /* ------------------------------------------------------------ objectives */
  countObjectives() {
    for (const o of this.objectives) {
      if (o.tag === 'jets') o.done = Math.min(this.jetKills || 0, o.count || 0);
      else { const list = this.targets.filter(t => t.tag === o.tag && t.primary); o.total = list.length; o.done = list.filter(t => !t.alive).length; }
      if (o.count != null) o.total = o.count;
      const was = o.complete; o.complete = o.done >= o.total && o.total > 0;
      if (o.complete && !was && this.phase === 'fly') { this.events.push({ t: 'obj', text: o.label + ' — complete' }); audio.sfx.objective(); }
    }
  }

  /* ------------------------------------------------------------ simulation */
  start() { this.phase = 'fly'; this.time = 0; this.events.push({ t: 'msg', text: this.M.callout || 'Weapons free', cls: 'green', dur: 2.4 }); }
  step(inp) {
    if (this.phase === 'brief') return;
    const dt = STEP;
    this.time += dt;
    const P = this.player;
    if (P.alive) this.stepPlayer(inp, dt);
    this.stepWeapons(inp, dt);
    this.stepTargets(dt);
    this.stepFighters(dt);
    this.stepProjectiles(dt);
    this.stepPending(dt);
    this.stepWaves(dt);
    if ((this.stepN = (this.stepN || 0) + 1) % 3 === 0) this.ccip = P.alive && this.ammo.bombs > 0 ? this.predictImpact() : null;
    if (this.phase === 'fly') {
      this.countObjectives();
      if (this.objectives.every(o => o.complete)) this.finish(true, 'All objectives complete');
      if (this.M.failCheck) { const why = this.M.failCheck(this); if (why) this.finish(false, why); }
    }
    if (this.phase === 'done') this.doneT += dt;
  }
  finish(ok, reason) {
    if (this.phase !== 'fly') return;
    this.phase = 'done'; this.doneT = 0;
    this.result = { ok, reason, time: this.time, hp: Math.max(0, Math.round(this.player.hp)) };
    this.events.push({ t: 'done', ok, reason });
    if (ok) audio.sfx.success(); else audio.sfx.fail();
  }
  stepPlayer(inp, dt) {
    const P = this.player, T = this.terrain;
    // afterburner heat
    let ab = inp.ab && !P.over;
    if (ab) { P.heat += dt * 0.1; if (P.heat >= 1) { P.heat = 1; P.over = true; ab = false; this.events.push({ t: 'msg', text: 'Afterburner overheated', cls: 'amber', dur: 1.6 }); } }
    else { P.heat = Math.max(0, P.heat - dt * (P.over ? 0.12 : 0.08)); if (P.over && P.heat < 0.35) P.over = false; }
    // soft boundary: steer back in
    const half = T.half - 350, ox = Math.max(0, Math.abs(P.pos.x) - half), oz = Math.max(0, Math.abs(P.pos.z) - half);
    const pin = { pitch: inp.pitch, roll: inp.roll, yaw: inp.yaw, ab, brake: inp.brake };
    this.outOfBounds = Math.max(ox, oz);
    if (this.outOfBounds > 0) {
      const s = steerTo(P.pos, P.quat, _v1.set(0, Math.max(P.pos.y, 500), 0), {});
      const k = clamp(this.outOfBounds / 250, 0, 1); pin.pitch = lerp(pin.pitch, s.pitch * 0.7, k); pin.roll = lerp(pin.roll, s.roll, k);
    }
    if (P.pos.y > 3600) pin.pitch = Math.min(pin.pitch, -0.3);
    // auto pull-up: if the ground is under 2 s away, roll level and climb out
    this.gcasT = Math.max(0, this.gcasT - dt);
    if (this.assist && !this.noCrash && P.vel.y < -3) {
      let near = false;
      for (const s of [0.5, 1, 1.5, 2]) { const x = P.pos.x + P.vel.x * s, z = P.pos.z + P.vel.z * s, y = P.pos.y + P.vel.y * s; if (y < T.ground(x, z) + 18) { near = true; break; } }
      if (near) {
        const f = fwdOf(P.quat, _v2), h = Math.hypot(f.x, f.z) || 1;
        const s = steerTo(P.pos, P.quat, _v1.set(P.pos.x + f.x / h * 900, P.pos.y + 420, P.pos.z + f.z / h * 900), {});
        pin.pitch = Math.max(pin.pitch, s.pitch); pin.roll = s.roll;
        if (this.gcasT === 0) this.events.push({ t: 'msg', text: 'Auto pull-up', cls: 'amber', dur: 1.2 });
        this.gcasT = 2;
      }
    }
    P.fly(pin, dt);
    // ground / water / building collision
    const gh = T.ground(P.pos.x, P.pos.z);
    if (P.pos.y < gh + 2.2) { if (this.noCrash) { P.pos.y = gh + 120; P.vel.y = Math.abs(P.vel.y); } else { this.killPlayer('crash', gh); return; } }
    for (const t of this.targets) {
      if (t.r < 8 || !t.group.visible) continue;
      const dx = P.pos.x - t.pos.x, dz = P.pos.z - t.pos.z;
      if (Math.abs(dx) > 60 || Math.abs(dz) > 60) continue;
      if (Math.hypot(dx, dz) < t.r * 0.8 && P.pos.y < t.pos.y + t.cy * 1.8 + 2 && !t.cap) { this.killPlayer('crash', P.pos.y); return; }
    }
    // pull up warning: predict 3s ahead
    let pull = false;
    if (P.vel.y < -5) {
      for (const s of [1, 2, 3]) { const x = P.pos.x + P.vel.x * s, z = P.pos.z + P.vel.z * s, y = P.pos.y + P.vel.y * s; if (y < T.ground(x, z) + 12) { pull = true; break; } }
    }
    this.pullUp = pull;
    P.agl = P.pos.y - gh;
    // rearm rings
    for (const r of this.rings) {
      r.cd = Math.max(0, r.cd - dt);
      if (r.cd === 0 && r.pos.distanceTo(P.pos) < 34) {
        r.cd = 45; this.ammo.bombs = this.ammoMax.bombs; this.ammo.msl = this.ammoMax.msl; this.ammo.flares = this.ammoMax.flares; this.ammo.gun = this.ammoMax.gun; P.hp = Math.min(100, P.hp + 35);
        this.events.push({ t: 'msg', text: 'Rearmed + repaired', cls: 'green', dur: 1.8 }); audio.sfx.rearm();
        this.jet.setStores(this.ammo.bombs, this.ammoMax.bombs, this.ammo.msl, this.ammoMax.msl);
      }
    }
    if (P.hp < 40 && this.R() < 0.5) this.fx.trail(P.pos.x - P.vel.x * 0.05, P.pos.y, P.pos.z - P.vel.z * 0.05, P.hp < 20 ? 'burn' : 'burn', 0.5);
  }
  killPlayer(how, gh) {
    const P = this.player; if (!P.alive) return;
    P.alive = false; P.hp = 0;
    this.fx.explode(P.pos.x, how === 'crash' ? Math.max(gh, P.pos.y) : P.pos.y, P.pos.z, 2.2, { air: how !== 'crash', water: how === 'crash' && this.terrain.height(P.pos.x, P.pos.z) < this.terrain.waterLevel, column: how === 'crash' ? 60 : 0 });
    audio.sfx.explode(2.4, 0);
    this.jet.group.visible = false; this.shake = 1.5;
    this.deathPos = P.pos.clone();
    this.finish(false, how === 'crash' ? 'You crashed' : 'Shot down');
  }
  damagePlayer(d, big) {
    const P = this.player; if (!P.alive || this.god || this.phase !== 'fly') return;
    if (this.assist) d *= 0.6;
    P.hp -= d; this.shake = Math.min(1.2, this.shake + d * 0.04); this.events.push({ t: 'hit', k: d });
    if (big) audio.sfx.bigHit(); else if (this.R() < 0.5) audio.sfx.hit();
    if (P.hp <= 0) this.killPlayer('shot');
  }

  /* ------------------------------------------------------------ player weapons */
  stepWeapons(inp, dt) {
    const P = this.player, A = this.ammo;
    P.flareCd -= dt; P.bombCd -= dt; P.mslCd -= dt;
    P.firing = false;
    if (!P.alive || this.phase === 'brief') return;
    const q = P.quat, f = fwdOf(q, new THREE.Vector3());
    if (inp.gun && A.gun > 0) {
      P.gunAcc += dt * 20; P.firing = true;
      while (P.gunAcc >= 1 && A.gun > 0) {
        P.gunAcc--; A.gun--; this.shots.fired++;
        const muzzle = new THREE.Vector3(-0.95, 0.55, -5.8).applyQuaternion(q).add(P.pos);
        const d = f.clone(); d.x += (this.R() - 0.5) * 0.007; d.y += (this.R() - 0.5) * 0.007; d.z += (this.R() - 0.5) * 0.007; d.normalize();
        this.bullets.push({ p: muzzle, v: d.multiplyScalar(1050).add(P.vel), life: 2.2, tr: (this.shots.fired % 2) === 0 });
      }
    } else P.gunAcc = Math.min(P.gunAcc, 0.9);
    if (inp.bomb && A.bombs > 0 && P.bombCd <= 0) {
      A.bombs--; P.bombCd = 0.28;
      const side = P.bombSide++ % 2 ? 1 : -1, lp = new THREE.Vector3(side * 2.5, -0.9, 1.2).applyQuaternion(q).add(P.pos);
      const m = new THREE.Mesh(this.bombGeo, this.storeMat); m.position.copy(lp); m.quaternion.copy(q); this.scene.add(m);
      this.bombs.push({ p: lp, v: P.vel.clone().add(upOf(q, new THREE.Vector3()).multiplyScalar(-3)), m, age: 0 });
      audio.sfx.bombRelease(); this.jet.setStores(A.bombs, this.ammoMax.bombs, A.msl, this.ammoMax.msl);
    }
    if (inp.missile && A.msl > 0 && P.mslCd <= 0) {
      A.msl--; P.mslCd = 0.45;
      const side = P.mslSide++ % 2 ? 1 : -1, lp = new THREE.Vector3(side * 4, -0.9, 2.4).applyQuaternion(q).add(P.pos);
      const m = new THREE.Mesh(this.mslGeo, this.storeMat); m.position.copy(lp); m.quaternion.copy(q); this.scene.add(m);
      const tgt = this.lock.locked ? this.lock.target : null;
      this.missiles.push({ p: lp, v: P.vel.clone().add(upOf(q, new THREE.Vector3()).multiplyScalar(-6)), speed: P.speed, m, age: 0, target: tgt, enemy: false });
      audio.sfx.missile(); this.jet.setStores(A.bombs, this.ammoMax.bombs, A.msl, this.ammoMax.msl);
      if (tgt) { this.lock.t = 0; this.lock.locked = false; this.lock.cool = 0.6; }
    }
    if (inp.flare && A.flares > 0 && P.flareCd <= 0) {
      A.flares -= 2; P.flareCd = 0.45; audio.sfx.flare();
      const r = rightOf(q, new THREE.Vector3()), up = upOf(q, new THREE.Vector3());
      for (const s of [-1, 1]) {
        const fl = { p: P.pos.clone().addScaledVector(up, -1), v: P.vel.clone().multiplyScalar(0.55).addScaledVector(r, s * 22).addScaledVector(up, -12), life: 3.6, isFlare: true, alive: true };
        fl.light = this.env.night ? this.fx.light(fl.p.x, fl.p.y, fl.p.z, 70, 3.6, '#ffd8a0', 900, fl.p) : null;
        this.flares.push(fl);
      }
      // decoy incoming missiles
      for (const m of this.emissiles) if (m.target === P && m.p.distanceTo(P.pos) < 3200 && this.R() < (m.ir ? 0.8 : 0.72)) m.target = this.flares[this.flares.length - 1 - (this.R() < 0.5 ? 1 : 0)];
    }
    this.updateLock(dt, f);
  }
  updateLock(dt, f) {
    const L = this.lock, P = this.player;
    L.cool = Math.max(0, (L.cool || 0) - dt);
    L.scanT = (L.scanT || 0) - dt;
    if (L.scanT <= 0) {
      L.scanT = 0.1;
      let best = null, bs = 1e9;
      const cand = this.targets.concat(this.fighters);
      for (const t of cand) {
        if (!t.alive || (t.air && t.falling)) continue;
        _v1.copy(t.pos); _v1.y += t.cy; _v1.sub(P.pos);
        const d = _v1.length(); if (d > 5200 || d < 120) continue;
        const ang = Math.acos(clamp(_v1.dot(f) / d, -1, 1)); if (ang > (this.assist ? 0.34 : 0.24)) continue;
        const s = ang * 3 + d / 5200 + (t.primary ? -0.25 : 0) + (t === L.target ? -0.45 : 0) + (t === this.apTarget ? -0.6 : 0);
        if (s < bs) { bs = s; best = t; }
      }
      if (best && !best.air && !this.terrain.los(P.pos.x, P.pos.y, P.pos.z, best.pos.x, best.pos.y + best.cy + 4, best.pos.z, 50, 30)) {
        if (best === L.target && (L.lost = (L.lost || 0) + 0.1) < 0.7) { /* brief terrain blip: keep the lock */ } else best = null;
      } else L.lost = 0;
      if (!best && L.target && L.target.alive && (L.hold = (L.hold || 0) + 0.1) < 0.4) best = L.target; else if (best) L.hold = 0;
      if (best !== L.target) { L.target = best; L.t = 0; L.locked = false; L.lost = 0; }
    }
    if (L.target && this.ammo.msl > 0 && L.cool <= 0) {
      L.t += dt;
      const need = (L.target.air ? 1.1 : 0.8) * (this.assist ? 0.6 : 1);
      if (!L.locked && L.t >= need) { L.locked = true; audio.sfx.lockOn(); }
    } else { L.t = 0; L.locked = false; }
  }

  /* ------------------------------------------------------------ projectiles */
  hitDist(t, p) {
    if (t.cap) { const a = t.cap.a, b = t.cap.b; _v1.subVectors(b, a); const k = clamp(_v2.subVectors(p, a).dot(_v1) / _v1.lengthSq(), 0, 1); return _v2.copy(a).addScaledVector(_v1, k).distanceTo(p); }
    _v1.copy(t.pos); _v1.y += t.cy; return _v1.distanceTo(p);
  }
  damage(t, d, src = 'gun') {
    if (!t.alive) return;
    if (t.def.armored && src === 'gun') d *= t.def.armored;
    t.hp -= d;
    if (t.hp <= 0) this.destroy(t);
  }
  blast(p, radius, dmg, src = 'bomb') {
    for (const t of this.targets.concat(this.fighters)) {
      if (!t.alive) continue;
      const d = Math.max(0, this.hitDist(t, p) - t.r * 0.6);
      if (d < radius) this.damage(t, dmg * Math.pow(1 - d / radius, 0.8), src);
    }
    const pd = this.player.pos.distanceTo(p);
    if (pd < radius * 1.3) this.damagePlayer(14 * (1 - pd / (radius * 1.3)), true);
  }
  stepProjectiles(dt) {
    const T = this.terrain, P = this.player;
    // player bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]; b.life -= dt;
      const ox = b.p.x, oy = b.p.y, oz = b.p.z;
      b.v.y -= 9.8 * dt * 0.5; b.p.addScaledVector(b.v, dt);
      let hit = false;
      for (const t of this.near(b.p, 40)) {
        if (this.segHit(t, ox, oy, oz, b.p, t.air ? 7 : 1.5)) { this.damage(t, 10, 'gun'); this.shots.hit++; this.hitMark = 1; this.fx.puff(b.p.x, b.p.y, b.p.z, 'spark', t.air ? 1 : 1.3); hit = true; break; }
      }
      if (!hit) { const g = T.ground(b.p.x, b.p.z); if (b.p.y < g) { this.fx.puff(b.p.x, g, b.p.z, g <= T.waterLevel + 0.01 && T.height(b.p.x, b.p.z) < T.waterLevel ? 'water' : 'dust', 1.2); hit = true; } }
      if (hit || b.life <= 0) this.bullets.splice(i, 1);
    }
    // enemy bullets
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const b = this.ebullets[i]; b.life -= dt;
      const ox = b.p.x, oy = b.p.y, oz = b.p.z; b.p.addScaledVector(b.v, dt);
      let hit = false;
      if (P.alive && Math.abs(b.p.x - P.pos.x) < 80 && Math.abs(b.p.z - P.pos.z) < 80) {
        _v1.set(ox, oy, oz); const ab = _v2.subVectors(b.p, _v1), k = clamp(_v3.subVectors(P.pos, _v1).dot(ab) / (ab.lengthSq() || 1), 0, 1);
        if (_v1.addScaledVector(ab, k).distanceTo(P.pos) < 6.5) { this.damagePlayer(b.dmg); hit = true; }
      }
      if (!hit && b.p.y < T.ground(b.p.x, b.p.z)) hit = true;
      if (hit || b.life <= 0) { if (!hit && b.airburst) this.fx.puff(b.p.x, b.p.y, b.p.z, 'spark', 0.6); this.ebullets.splice(i, 1); }
    }
    // flak shells
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i]; s.life -= dt; s.p.addScaledVector(s.v, dt);
      if (s.life <= 0) {
        this.fx.puff(s.p.x, s.p.y, s.p.z, 'flak'); const d = s.p.distanceTo(P.pos);
        if (d < 34 && P.alive) this.damagePlayer(s.dmg * (1 - d / 34), d < 15);
        if (d < 600) audio.sfx.boom(d);
        this.shells.splice(i, 1);
      }
    }
    // bombs
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i]; b.age += dt; b.v.y -= 9.81 * dt;
      if (this.assist && b.age > 0.3) this.guideBomb(b, dt);
      b.p.addScaledVector(b.v, dt);
      b.m.position.copy(b.p); b.m.quaternion.setFromUnitVectors(AZ, _v1.copy(b.v).normalize().negate());
      const gh = T.ground(b.p.x, b.p.z);
      let hit = b.p.y < gh;
      if (!hit) for (const t of this.near(b.p, 60)) if (!t.air && this.hitDist(t, b.p) < t.r * 0.9 + 1) { hit = true; break; }
      if (hit) {
        const water = T.height(b.p.x, b.p.z) < T.waterLevel && b.p.y <= T.waterLevel + 1;
        const y = Math.max(b.p.y, gh);
        this.fx.explode(b.p.x, y, b.p.z, 1.5, { water }); this.shake = Math.max(this.shake, clamp(1 - this.camera.position.distanceTo(b.p) / 900, 0, 0.6));
        audio.sfx.explode(1.4, this.camera.position.distanceTo(b.p));
        this.blast(_v3.set(b.p.x, y + 1, b.p.z).clone(), 34, 460, 'bomb');
        this.scene.remove(b.m); this.bombs.splice(i, 1);
      } else if (b.age > 40) { this.scene.remove(b.m); this.bombs.splice(i, 1); }
    }
    // player missiles
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i]; m.age += dt;
      m.speed = Math.min(560, m.speed + dt * (m.age > 0.35 ? 200 : 20));
      let dir = _v1.copy(m.v).normalize();
      if (m.age > 0.35) {
        if (m.target && m.target.alive) {
          const tp = _v2.copy(m.target.pos); tp.y += m.target.cy;
          const tgo = tp.distanceTo(m.p) / m.speed; tp.addScaledVector(m.target.vel || _v3.set(0, 0, 0), tgo * 0.9);
          const want = tp.sub(m.p).normalize(), ang = Math.acos(clamp(dir.dot(want), -1, 1)), maxT = 2.6 * dt;
          if (ang > 1e-4) dir.lerp(want, Math.min(1, maxT / ang)).normalize();
        }
      } else dir.y -= dt * 0.4;
      m.v.copy(dir).multiplyScalar(m.speed); m.p.addScaledVector(m.v, dt);
      m.m.position.copy(m.p); m.m.quaternion.setFromUnitVectors(AZ, _v3.copy(dir).negate());
      if (m.age > 0.3) this.fx.trail(m.p.x - dir.x * 1.5, m.p.y - dir.y * 1.5, m.p.z - dir.z * 1.5, 'missile');
      let hit = m.p.y < T.ground(m.p.x, m.p.z) || m.age > 14;
      if (!hit) for (const t of this.near(m.p, 90)) if (this.hitDist(t, m.p) < t.r * 0.8 + (t.air ? 9 : 3)) { hit = true; break; }
      if (hit) {
        const gh = T.ground(m.p.x, m.p.z), y = Math.max(gh, m.p.y), water = T.height(m.p.x, m.p.z) < T.waterLevel && m.p.y <= T.waterLevel + 1;
        this.fx.explode(m.p.x, y, m.p.z, 1.2, { water, air: m.p.y > gh + 8 }); audio.sfx.explode(1.1, this.camera.position.distanceTo(m.p));
        this.blast(_v3.set(m.p.x, y + 0.5, m.p.z).clone(), 20, 520, 'missile');
        this.scene.remove(m.m); this.missiles.splice(i, 1);
      }
    }
    // enemy missiles
    let warn = 0;
    for (let i = this.emissiles.length - 1; i >= 0; i--) {
      const m = this.emissiles[i]; m.age += dt;
      m.speed = Math.min(m.max, m.speed + dt * 120);
      const dir = _v1.copy(m.v).normalize(), tgt = m.target;
      if (tgt && (tgt === P ? P.alive : tgt.life > 0)) {
        const tp = _v2.copy(tgt === P ? P.pos : tgt.p), tv = tgt === P ? P.vel : tgt.v, tgo = tp.distanceTo(m.p) / m.speed;
        tp.addScaledVector(tv, tgo * 0.55);
        const want = tp.sub(m.p).normalize(), ang = Math.acos(clamp(dir.dot(want), -1, 1)), maxT = m.turn * dt;
        if (ang > 1e-4) dir.lerp(want, Math.min(1, maxT / ang)).normalize();
      }
      m.v.copy(dir).multiplyScalar(m.speed); m.p.addScaledVector(m.v, dt);
      m.m.position.copy(m.p); m.m.quaternion.setFromUnitVectors(AZ, _v3.copy(dir).negate());
      this.fx.trail(m.p.x - dir.x * 1.5, m.p.y - dir.y * 1.5, m.p.z - dir.z * 1.5, 'missile', 1.2);
      const dP = m.p.distanceTo(P.pos);
      if (tgt === P && P.alive) warn = 2;
      let boom = m.age > m.life || m.p.y < T.ground(m.p.x, m.p.z);
      if (P.alive && dP < 13) { boom = true; this.damagePlayer(m.dmg, true); }
      if (tgt && tgt.isFlare && m.p.distanceTo(tgt.p) < 10) boom = true;
      if (boom) {
        this.fx.explode(m.p.x, Math.max(m.p.y, T.ground(m.p.x, m.p.z)), m.p.z, 0.8, { air: true }); audio.sfx.explode(0.8, this.camera.position.distanceTo(m.p));
        this.scene.remove(m.m); this.emissiles.splice(i, 1);
      }
    }
    // flares
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i]; f.life -= dt; f.v.y -= 9.8 * dt * 0.5; f.v.multiplyScalar(Math.exp(-dt * 1.2)); f.p.addScaledVector(f.v, dt);
      this.fx.trail(f.p.x, f.p.y, f.p.z, 'flare');
      if (f.life <= 0 || f.p.y < T.ground(f.p.x, f.p.z)) { f.life = 0; f.alive = false; this.flares.splice(i, 1); }
    }
    if (!warn) for (const t of this.targets) if (t.alive && t.sam && t.sam.state === 'track') { warn = 1; break; }
    this.warn = P.alive && this.phase === 'fly' ? warn : 0;
  }
  segHit(t, ox, oy, oz, p, pad) {
    _v1.set(ox, oy, oz);
    const ab = _v2.subVectors(p, _v1), c = t.cap ? null : _v3.copy(t.pos);
    if (t.cap) { const o = _v1.clone(), d = ab.clone(); for (let k = 0; k <= 4; k++) { const pt = o.clone().addScaledVector(d, k / 4); if (this.hitDist(t, pt) < t.r * 0.6) return true; } return false; }
    c.y += t.cy;
    const k = clamp(_v3.sub(_v1).dot(ab) / (ab.lengthSq() || 1), 0, 1);
    const cx = t.pos.x, cy = t.pos.y + t.cy, cz = t.pos.z;
    const px = _v1.x + ab.x * k, py = _v1.y + ab.y * k, pz = _v1.z + ab.z * k;
    return Math.hypot(px - cx, py - cy, pz - cz) < t.r * 0.8 + pad;
  }
  /* assist: nudge a falling bomb's drift towards the closest ground target near where it will land */
  guideBomb(b, dt) {
    const fall = h => (b.v.y + Math.sqrt(Math.max(0, b.v.y * b.v.y + 2 * 9.81 * h))) / 9.81;
    let tgo = fall(b.p.y - this.terrain.ground(b.p.x, b.p.z)), lx = b.p.x + b.v.x * tgo, lz = b.p.z + b.v.z * tgo;
    if (!b.aim || !b.aim.alive) {
      tgo = fall(b.p.y - this.terrain.ground(lx, lz)); lx = b.p.x + b.v.x * tgo; lz = b.p.z + b.v.z * tgo;
      let best = null, bd = 60;
      // objective targets win over clutter; small stuff only pulls the bomb if it's already close
      for (const t of this.targets) { if (!t.alive || t.air) continue; const d = Math.hypot(t.pos.x - lx, t.pos.z - lz) - t.r * 0.5 - (t.primary ? 25 : 0); if (d < bd && (t.primary || d < 30)) { bd = d; best = t; } }
      b.aim = best;
    }
    if (!b.aim) return;
    // time to fall to the target's own height, so hills and valleys on the way don't throw it off
    tgo = fall(b.p.y - b.aim.pos.y); lx = b.p.x + b.v.x * tgo; lz = b.p.z + b.v.z * tgo;
    if (tgo < 0.05) return;
    const ex = (b.aim.pos.x - lx) / Math.max(tgo, 0.4), ez = (b.aim.pos.z - lz) / Math.max(tgo, 0.4), m = Math.hypot(ex, ez), cap = 40 * dt;
    const k = m > cap ? cap / m : 1;
    b.v.x += ex * k; b.v.z += ez * k;
  }
  near(p, r) {
    const out = [];
    for (const t of this.targets) if (t.alive && Math.abs(t.pos.x - p.x) < r + t.r + (t.cap ? 200 : 0) && Math.abs(t.pos.z - p.z) < r + t.r + (t.cap ? 200 : 0)) out.push(t);
    for (const t of this.fighters) if (t.alive && t.pos.distanceTo(p) < r + 20) out.push(t);
    return out;
  }

  /* ------------------------------------------------------------ enemies */
  destroy(t) {
    if (!t.alive) return;
    t.alive = false; t.hp = 0;
    const p = t.pos, def = t.def, T = this.terrain;
    const water = def.ship;
    this.score += t.score; this.kills++;
    this.events.push({ t: 'kill', label: t.label, score: t.score, primary: t.primary, x: p.x, y: p.y + t.cy, z: p.z });
    const dist = this.camera.position.distanceTo(p);
    audio.sfx.explode(def.boom, dist);
    if (dist < 1200) this.shake = Math.max(this.shake, (1 - dist / 1200) * 0.4 * def.boom);
    if (t.air) { t.falling = true; t.alive = false; this.jetKills = (this.jetKills || 0) + 1; this.fx.explode(p.x, p.y, p.z, 1.4, { air: true }); return; }
    if (t.type === 'bridge') { this.collapseBridge(t); return; }
    this.fx.explode(p.x, p.y + t.cy * 0.6, p.z, def.boom, { fuel: def.fuel, water: false, column: water ? 0 : (def.boom > 2 ? 90 : 55) });
    if (def.fuel) {
      // chain reaction to nearby targets
      for (const o of this.targets) if (o.alive && o !== t) { const d = o.pos.distanceTo(p); if (d < 85) this.pending.push({ t: 0.25 + d / 220 + this.R() * 0.2, fn: () => this.damage(o, 520 * (1 - d / 95), 'blast') }); }
      if (def.boom > 2.5) { this.pending.push({ t: 0.5, fn: () => this.fx.explode(p.x + 6, p.y + 8, p.z - 4, 2.2, { fuel: true, noCrater: true }) }); this.pending.push({ t: 1.1, fn: () => this.fx.explode(p.x - 5, p.y + 14, p.z + 3, 1.8, { fuel: true, noCrater: true }) }); }
    }
    // wreck look
    t.group.traverse(o => { if (o.isMesh && o.material !== MAT.glow) o.material = MAT.wreck; if (o.isMesh && o.material === MAT.glow) o.visible = false; });
    if (t.model.turret) { t.model.turret.rotation.z = (this.R() - 0.5) * 1.2; t.model.turret.position.y += 0.6; t.model.turret.rotation.x = (this.R() - 0.5) * 0.8; }
    if (water) { t.sink = 0; }
    else if (def.r < 9) { t.group.rotation.x += (this.R() - 0.5) * 0.25; t.group.rotation.z += (this.R() - 0.5) * 0.25; t.group.position.y -= 0.3; }
    else { t.group.scale.y *= 0.55; }
    if (t.model.group.userData.jet) t.model.group.userData.jet.group.rotation.z = 0.2;
    void T;
  }
  collapseBridge(t) {
    const p = t.pos;
    for (let k = 0; k < 5; k++) this.pending.push({ t: k * 0.18, fn: () => { const f = this.R(); const q = _v1.copy(t.cap.a).lerp(t.cap.b, 0.2 + f * 0.6); this.fx.explode(q.x, q.y, q.z, 1.8, { noCrater: true }); } });
    const n = t.spans.length;
    t.spans.forEach((s, i) => { if (i > 0 && i < n - 1) { s.userData.fall = { v: 0, rx: (this.R() - 0.5) * 0.6, rz: (this.R() - 0.5) * 0.4 }; } s.traverse(o => { if (o.isMesh) o.material = MAT.wreck; }); });
    this.fallingSpans = (this.fallingSpans || []).concat(t.spans.filter(s => s.userData.fall));
    this.fx.column(p.x, p.y, p.z, 60, 1.4);
  }
  stepPending(dt) {
    for (let i = this.pending.length - 1; i >= 0; i--) { const e = this.pending[i]; e.t -= dt; if (e.t <= 0) { this.pending.splice(i, 1); e.fn(); } }
    if (this.fallingSpans) for (const s of this.fallingSpans) { const f = s.userData.fall; if (s.position.y < -60) continue; f.v += 9.8 * dt; s.position.y -= f.v * dt; s.rotation.x += f.rx * dt; s.rotation.z += f.rz * dt; }
  }
  stepTargets(dt) {
    const P = this.player, T = this.terrain, alive = P.alive && this.phase !== 'brief';
    let radars = 0; for (const t of this.targets) if (t.alive && t.def.radar) radars++;
    this.radarNet = radars;
    for (const t of this.targets) {
      // ships sinking / bobbing
      if (t.def.ship) {
        if (t.sink != null) { t.sink += dt; t.group.position.y = T.waterLevel - t.sink * 0.9; t.group.rotation.z = Math.min(0.5, t.sink * 0.03); t.group.rotation.x = Math.min(0.25, t.sink * 0.012); if (t.sink < 14 && this.R() < 0.6) this.fx.trail(t.pos.x + (this.R() - 0.5) * t.r, T.waterLevel + 4, t.pos.z + (this.R() - 0.5) * t.r, 'burn', 1.6); if (t.sink > 40) t.group.visible = false; continue; }
        t.group.position.y = T.waterLevel + Math.sin(this.time * 0.8 + t.id) * 0.25;
        t.group.rotation.z = Math.sin(this.time * 0.6 + t.id) * 0.02;
      }
      if (!t.alive) continue;
      if (t.model.dish) t.model.dish.rotation.y += dt * 1.4;
      // movement
      if (t.path) {
        const len = t._len || (t._len = pathAt(t.path, 0).len);
        if (t.pathT < 1 || t.loop) {
          t.pathT += t.speed * dt / len; if (t.loop && t.pathT > 1) t.pathT -= 1;
          const at = pathAt(t.path, clamp(t.pathT, 0, 1)), ox = t.pos.x, oz = t.pos.z;
          let y = T.height(at.x, at.z), blocked = false;
          for (const b of this.bridges) {
            const [x1, z1, x2, z2] = b.ends, ddx = x2 - x1, ddz = z2 - z1, k = clamp(((at.x - x1) * ddx + (at.z - z1) * ddz) / (ddx * ddx + ddz * ddz), 0, 1);
            if (Math.hypot(x1 + ddx * k - at.x, z1 + ddz * k - at.z) < 10 && k > 0.02 && k < 0.98) { if (b.alive) y = Math.max(y, b.deck); else blocked = true; }
          }
          if (!blocked) for (const o of this.targets) if (o !== t && o.alive && o.path === t.path && o.pathT > t.pathT - t.speed * dt / len && o.pathT - t.pathT < 24 / len) { blocked = true; break; }
          if (blocked) { t.pathT -= t.speed * dt / len; t.vel.set(0, 0, 0); if (t.tag && !this.haltSaid && this.bridges.some(b => !b.alive)) { this.haltSaid = true; this.events.push({ t: 'msg', text: 'Bridge down — convoy halted', cls: 'green', dur: 2.2 }); } }
          else { t.pos.x = at.x; t.pos.z = at.z; if (!t.def.ship) t.pos.y = y; t.group.rotation.y = at.yaw + Math.PI; t.vel.set((at.x - ox) / dt, 0, (at.z - oz) / dt); }
        } else t.vel.set(0, 0, 0);
      } else if (t.circle) {
        const C = t.circle; C.a = (C.a || 0) + dt * C.speed / C.r; const ox = t.pos.x, oz = t.pos.z;
        t.pos.x = C.x + Math.cos(C.a) * C.r; t.pos.z = C.z + Math.sin(C.a) * C.r; t.vel.set((t.pos.x - ox) / dt, 0, (t.pos.z - oz) / dt);
        t.group.rotation.y = Math.atan2(-t.vel.x, -t.vel.z);
      }
      if (!alive) continue;
      const dx = P.pos.x - t.pos.x, dy = P.pos.y - (t.pos.y + t.cy), dz = P.pos.z - t.pos.z, dist = Math.hypot(dx, dy, dz);
      // AA guns
      const aaAim = t.aa || t.flak || t.sam;
      if (aaAim && t.model.turret && dist < 5000) {
        const yaw = Math.atan2(-dx, -dz) - t.group.rotation.y;
        t.model.turret.rotation.y = damp(t.model.turret.rotation.y, t.model.turret.rotation.y + wrap(yaw - t.model.turret.rotation.y), 3, dt);
        if (t.model.gun && !t.sam) t.model.gun.rotation.x = damp(t.model.gun.rotation.x, Math.atan2(dy, Math.hypot(dx, dz)), 3, dt);
      } else if (t.model.turret && t.type === 'tank' && dist < 2500) {
        const yaw = Math.atan2(-dx, -dz) - t.group.rotation.y; t.model.turret.rotation.y += wrap(yaw - t.model.turret.rotation.y) * Math.min(1, dt * 0.8);
      }
      if (t.aa && dist < t.aa.range) {
        const A = t.aa; A.losT -= dt;
        if (A.losT <= 0) { A.losT = 0.5; A.los = T.los(t.pos.x, t.pos.y + t.cy + 10, t.pos.z, P.pos.x, P.pos.y, P.pos.z, 45, 90); }
        A.cd -= dt;
        if (A.los) {
          if (A.cd <= 0 && A.burst <= 0) { A.burst = 1.2 + this.R() * 1.2; }
          if (A.burst > 0) {
            A.burst -= dt; if (A.burst <= 0) A.cd = 0.8 + this.R() * 1.4;
            A.acc = (A.acc || 0) + dt * A.rate;
            while (A.acc >= 1) {
              A.acc--;
              const sp = 720, origin = _v1.set(t.pos.x, t.pos.y + t.cy + 2.5, t.pos.z), tof = dist / sp;
              const aim = _v2.copy(P.pos).addScaledVector(P.vel, tof * (0.75 + this.R() * 0.4)).sub(origin).normalize();
              const s = A.spread * (this.M.aaMul || 1);
              aim.x += (this.R() - 0.5) * s * 2; aim.y += (this.R() - 0.5) * s * 2; aim.z += (this.R() - 0.5) * s * 2; aim.normalize();
              this.ebullets.push({ p: origin.clone(), v: aim.clone().multiplyScalar(sp), life: Math.min(4, A.range / sp + 0.6), dmg: A.dmg * (this.M.dmgMul || 1), c: this.M.env.night ? [3.2, 1.2, 0.3] : [2.6, 1.1, 0.3], airburst: true });
            }
          }
        } else A.burst = 0;
      }
      if (t.flak && dist < t.flak.range) {
        const F = t.flak; F.losT -= dt;
        if (F.losT <= 0) { F.losT = 0.6; F.los = T.los(t.pos.x, t.pos.y + t.cy + 10, t.pos.z, P.pos.x, P.pos.y, P.pos.z, 45, 90); }
        F.cd -= dt;
        if (F.los && F.cd <= 0) {
          F.cd = 1 / F.rate * (0.8 + this.R() * 0.5);
          const sp = 600, o = new THREE.Vector3(t.pos.x, t.pos.y + t.cy + 3, t.pos.z), tof = dist / sp;
          const aim = _v2.copy(P.pos).addScaledVector(P.vel, tof).add(_v3.set((this.R() - 0.5) * 60, (this.R() - 0.5) * 50, (this.R() - 0.5) * 60));
          const v = aim.clone().sub(o); const life = v.length() / sp; v.normalize().multiplyScalar(sp);
          this.shells.push({ p: o, v, life, dmg: F.dmg * (this.M.dmgMul || 1) });
          if (dist < 1500) audio.sfx.boom(dist * 2);
        }
      }
      if (t.sam) this.stepSam(t, dist, dt);
    }
    // searchlights sweep
    for (const s of this.searchlights) { s.a += dt * s.s; s.g.rotation.set(s.e + Math.sin(s.a * 1.3) * 0.25, s.a, 0, 'YXZ'); }
    // rings spin
    for (const r of this.rings) { r.m.rotation.y += dt * 0.6; r.m.material.opacity = r.cd > 0 ? 0.15 : 0.85; }
  }
  stepSam(t, dist, dt) {
    const S = t.sam, P = this.player, T = this.terrain;
    S.losT -= dt;
    const range = S.range * (this.radarNet ? 1.15 : 1);
    if (S.losT <= 0) { S.losT = 0.4; S.los = dist < range && P.agl > 35 && T.los(t.pos.x, t.pos.y + t.cy + 8, t.pos.z, P.pos.x, P.pos.y, P.pos.z, 45, 70); }
    if (S.state === 'search') { if (S.los && S.shots > 0 && this.time > 14) { S.state = 'track'; S.t = 0; S.lost = 0; } }
    else if (S.state === 'track') {
      S.t += dt * (this.radarNet ? 1.5 : 1);
      if (!S.los) { S.lost += dt; if (S.lost > 1.2) S.state = 'search'; } else S.lost = 0;
      if (S.t >= S.lock) {
        S.shots--; S.state = 'reload'; S.t = S.reload;
        const o = new THREE.Vector3(t.pos.x, t.pos.y + t.cy + 5, t.pos.z);
        const m = new THREE.Mesh(this.emslGeo, this.storeMat); m.scale.setScalar(1.5); this.scene.add(m);
        this.emissiles.push({ p: o, v: new THREE.Vector3(0, 1, 0).lerp(_v1.copy(P.pos).sub(o).normalize(), 0.5).normalize().multiplyScalar(80), speed: 80, max: 430 * (this.M.samMul || 1), turn: 1.05 * (this.M.samMul || 1), life: 13, m, age: 0, target: P, dmg: 42 });
        this.events.push({ t: 'msg', text: 'Missile launch!', cls: 'red', dur: 1.4 }); audio.sfx.launchWarn();
        this.fx.explode(o.x, o.y - 4, o.z, 0.35, { noCrater: true });
      }
    } else if (S.state === 'reload') { S.t -= dt; if (S.t <= 0) S.state = 'search'; }
  }
  stepWaves(dt) {
    if (this.phase !== 'fly') return;
    for (const w of this.waves) {
      if (w.spawned) continue;
      let go = w.at != null && this.time >= w.at;
      if (w.near && this.player.pos.distanceTo(_v1.set(w.near[0], this.player.pos.y, w.near[1])) < w.near[2]) go = true;
      if (w.when && w.when(this)) go = true;
      if (!go) continue;
      w.spawned = true;
      for (let i = 0; i < w.n; i++) this.spawnFighter(w.from[0] + i * 60, w.from[1] + i * 25, w.from[2] + i * 70, w);
      this.events.push({ t: 'msg', text: w.n > 1 ? `${w.n} enemy fighters inbound` : 'Enemy fighter inbound', cls: 'red', dur: 2.2 });
    }
  }
  spawnFighter(x, y, z, w = {}) {
    const P = this.player, j = buildJet({ enemy: true, hi: false });
    this.scene.add(j.group);
    const yaw = Math.atan2(-(P.pos.x - x), -(P.pos.z - z));
    const f = new Flyer(new THREE.Vector3(x, y, z), yaw, 200);
    Object.assign(f, { jet: j, air: true, alive: true, hp: TYPES.fighter.hp * (w.hp || 1), maxHp: TYPES.fighter.hp, r: TYPES.fighter.r, cy: 0, def: TYPES.fighter, label: 'Enemy fighter', score: TYPES.fighter.score, tag: 'jets', primary: true, type: 'fighter', group: j.group, model: { group: j.group }, gunCd: 0, mslCd: 4 + this.R() * 4, msls: w.msls ?? 2, skill: w.skill || 0.8, burst: 0, jink: 0, id: 1000 + this.fighters.length });
    this.fighters.push(f);
    return f;
  }
  stepFighters(dt) {
    const P = this.player, T = this.terrain;
    for (const f of this.fighters) {
      if (f.falling) {
        if (f.dead) continue;
        f.vel.y -= 9.8 * dt; f.pos.addScaledVector(f.vel, dt); _q1.setFromAxisAngle(AZ, dt * 2.4); f.quat.multiply(_q1);
        this.fx.trail(f.pos.x, f.pos.y, f.pos.z, 'burn', 1.2);
        if (f.pos.y < T.ground(f.pos.x, f.pos.z) + 2) { f.dead = true; f.jet.group.visible = false; this.fx.explode(f.pos.x, T.ground(f.pos.x, f.pos.z), f.pos.z, 1.8, { column: 40, water: T.height(f.pos.x, f.pos.z) < T.waterLevel }); audio.sfx.explode(1.6, this.camera.position.distanceTo(f.pos)); }
        f.jet.group.position.copy(f.pos); f.jet.group.quaternion.copy(f.quat);
        continue;
      }
      if (!f.alive) continue;
      // AI
      const inp = { pitch: 0, roll: 0, ab: false, brake: false };
      const toP = _v1.copy(P.pos).sub(f.pos), dist = toP.length();
      let aim;
      if (P.alive) {
        aim = _v2.copy(P.pos).addScaledVector(P.vel, Math.min(2.5, dist / 900) * f.skill);
        const fw = fwdOf(f.quat, _v3), behind = toP.dot(fwdOf(P.quat, new THREE.Vector3())) > 0; // fighter is behind the player
        f.jink -= dt;
        if (!behind && dist < 700 && fw.dot(toP) / dist < 0) { aim = _v2.copy(f.pos).addScaledVector(fw, 600).add(new THREE.Vector3(0, 250, 0)); }
      } else aim = _v2.set(0, 900, 0);
      const s = steerTo(f.pos, f.quat, aim, {}, 1);
      inp.pitch = s.pitch * f.skill; inp.roll = s.roll; inp.ab = dist > 2200;
      // terrain avoidance
      const agl = f.pos.y - T.ground(f.pos.x, f.pos.z);
      let danger = agl < 220;
      for (const k of [1.5, 3]) { const x = f.pos.x + f.vel.x * k, z = f.pos.z + f.vel.z * k, y = f.pos.y + f.vel.y * k; if (y < T.ground(x, z) + 120) danger = true; }
      if (danger) { const up = steerTo(f.pos, f.quat, _v3.copy(f.pos).addScaledVector(f.vel, 2).setY(f.pos.y + 600), {}); inp.pitch = up.pitch; inp.roll = up.roll; }
      if (Math.abs(f.pos.x) > T.half - 400 || Math.abs(f.pos.z) > T.half - 400) { const c = steerTo(f.pos, f.quat, _v3.set(0, 900, 0), {}); inp.pitch = c.pitch; inp.roll = c.roll; }
      f.fly(inp, dt, { cruise: 190, abSpeed: 290, pull: 1.2, rollRate: 2.4 });
      if (f.pos.y < T.ground(f.pos.x, f.pos.z) + 2) { f.hp = 0; f.alive = false; f.falling = true; this.jetKills = (this.jetKills || 0) + 1; this.events.push({ t: 'kill', label: 'Enemy fighter (crashed)', score: f.score, primary: true }); this.score += f.score; }
      // weapons
      if (P.alive && this.phase === 'fly') {
        const ang = s.ang;
        f.gunCd -= dt; f.mslCd -= dt;
        if (ang < 0.07 && dist < 950 && f.gunCd <= 0) { f.burst = 0.9; f.gunCd = 2.2; }
        if (f.burst > 0) {
          f.burst -= dt; f.acc = (f.acc || 0) + dt * 14;
          while (f.acc >= 1) { f.acc--; const o = f.pos.clone().addScaledVector(fwdOf(f.quat, _v3), 8); const d = _v3.copy(P.pos).addScaledVector(P.vel, dist / 900).sub(o).normalize(); d.x += (this.R() - 0.5) * 0.03; d.y += (this.R() - 0.5) * 0.03; d.z += (this.R() - 0.5) * 0.03; d.normalize(); this.ebullets.push({ p: o, v: d.clone().multiplyScalar(900).add(f.vel), life: 1.6, dmg: 2.4, c: [2.8, 1.8, 0.5] }); }
        }
        if (f.msls > 0 && f.mslCd <= 0 && this.time > 20 && ang < 0.3 && dist > 600 && dist < 3200) {
          f.msls--; f.mslCd = 12 + this.R() * 6;
          const m = new THREE.Mesh(this.emslGeo, this.storeMat); this.scene.add(m);
          this.emissiles.push({ p: f.pos.clone().addScaledVector(upOf(f.quat, _v3), -1.5), v: f.vel.clone(), speed: f.speed, max: 470, turn: 1.25, life: 10, m, age: 0, target: P, dmg: 38, ir: true });
          this.events.push({ t: 'msg', text: 'Missile launch — flares!', cls: 'red', dur: 1.4 }); audio.sfx.launchWarn();
        }
      }
      f.jet.group.position.copy(f.pos); f.jet.group.quaternion.copy(f.quat);
      f.jet.setEngine(f.speed / 300, f.ab, this.time + f.id);
    }
  }

  /* ------------------------------------------------------------ visuals */
  updateJetVisual(dt) {
    const P = this.player, j = this.jet;
    j.group.position.copy(P.pos); j.group.quaternion.copy(P.quat);
    j.setEngine(this.lastInp?.brake ? 0.15 : 0.55 + P.ab * 0.45, P.ab, this.time);
    j.setControls(P.rp / 1.45, P.rr / 3);
  }
  frame(dt, aspect, inp) {
    this.lastInp = inp;
    const P = this.player, cam = this.camera;
    if (P.alive) this.updateJetVisual(dt);
    // camera
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const cock = this.camMode === 'cockpit' && P.alive;
    this.jet.setCockpit(cock);
    let fov;
    if (this.camOverride) {
      const o = this.camOverride;
      if (o.local) { cam.position.set(...o.local).applyQuaternion(P.quat).add(P.pos); cam.up.copy(upOf(P.quat, _v2)); cam.lookAt(_v1.set(...(o.lookLocal || [0, 0, 0])).applyQuaternion(P.quat).add(P.pos)); }
      else { cam.position.copy(o.pos); cam.up.set(0, 1, 0); cam.lookAt(o.look); }
      fov = o.fov || 55;
    } else if (this.phase === 'brief') {
      const a = this.time * 0 + (this.introT || 0) * 0.25 + 2.4, r = 34;
      cam.position.copy(P.pos).add(_v1.set(Math.sin(a) * r, 6 + Math.sin(a * 0.7) * 3, Math.cos(a) * r).applyQuaternion(P.quat));
      cam.up.copy(upOf(P.quat, _v2)); cam.lookAt(P.pos); fov = 50;
    } else if (!P.alive) {
      const c = this.deathPos || P.pos, a = (this.doneT || 0) * 0.3;
      cam.position.set(c.x + Math.sin(a) * 180, Math.max(c.y, this.terrain.ground(c.x, c.z)) + 70, c.z + Math.cos(a) * 180);
      cam.up.set(0, 1, 0); cam.lookAt(c.x, Math.max(c.y, this.terrain.ground(c.x, c.z)) + 10, c.z); fov = 60;
    } else if (cock) {
      cam.position.copy(this.jet.eye).applyQuaternion(P.quat).add(P.pos);
      cam.quaternion.copy(P.quat); fov = 74 + P.ab * 4;
    } else {
      this.camQ.slerp(P.quat, 1 - Math.exp(-dt * 5.5));
      const off = _v1.set(0, 5.6, 25 + P.ab * 3).applyQuaternion(this.camQ);
      cam.position.copy(P.pos).add(off);
      const g = this.terrain.ground(cam.position.x, cam.position.z) + 3; if (cam.position.y < g) cam.position.y = g;
      cam.quaternion.copy(this.camQ); _q1.setFromAxisAngle(AX, -0.075); cam.quaternion.multiply(_q1);
      fov = 63 + clamp((P.speed - 170) / 130, 0, 1) * 8 + P.ab * 4;
    }
    if (this.shake > 0) { const s = this.shake * 0.6; cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.rotateZ((Math.random() - 0.5) * s * 0.02); }
    this.fov = damp(this.fov, fov, 4, dt);
    cam.fov = this.fov; cam.aspect = aspect; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    // sun follows
    const fpos = P.alive ? P.pos : (this.deathPos || P.pos);
    this.sun.target.position.copy(fpos); this.sun.position.copy(fpos).addScaledVector(this.sunDir, 1500);
    this.sky.update(cam);
    this.terrain.updateVisibility(cam.position);
    // vapour trails
    const R = this.fx.ribbons;
    if (P.alive && this.phase !== 'brief') {
      const vap = clamp((P.g - 4.2) / 2.5, 0, 1) + (this.time < 0 ? 0 : 0);
      for (let i = 0; i < 2; i++) R[i].push(_v1.copy(this.jet.wingtips[i]).applyQuaternion(P.quat).add(P.pos), vap);
      const con = clamp((P.pos.y - 1700) / 500, 0, 1);
      for (let i = 0; i < 2; i++) R[2 + i].push(_v1.copy(this.jet.nozzles[i]).applyQuaternion(P.quat).add(P.pos).addScaledVector(P.vel, -0.12), con * 0.8);
    }
    this.fx.update(dt, cam);
    // tracers
    const tr = this.tr || (this.tr = []); tr.length = 0;
    for (const b of this.bullets) if (b.tr) tr.push({ x: b.p.x, y: b.p.y, z: b.p.z, dx: b.v.x * 0.016, dy: b.v.y * 0.016, dz: b.v.z * 0.016, len: 16, c: [3, 2.6, 1.4], w: 0.25 });
    for (const b of this.ebullets) tr.push({ x: b.p.x, y: b.p.y, z: b.p.z, dx: b.v.x * 0.02, dy: b.v.y * 0.02, dz: b.v.z * 0.02, len: 13, c: b.c, w: 0.4 });
    for (const s of this.shells) tr.push({ x: s.p.x, y: s.p.y, z: s.p.z, dx: s.v.x * 0.02, dy: s.v.y * 0.02, dz: s.v.z * 0.02, len: 8, c: [2, 1.2, 0.5], w: 0.6 });
    this.fx.drawTracers(tr);
    // in-cloud fog
    this.cloudFog = this.sky.inCloud(cam.position);
    this.hitMark = Math.max(0, this.hitMark - dt * 6);
    // beacon over the nearest objective target: bright from afar, fades as you close in
    let bt = null, bd = 1e9;
    if (P.alive && this.phase === 'fly') {
      const open = new Set(this.objectives.filter(o => !o.complete).map(o => o.tag));
      for (const t of this.targets) if (t.alive && t.primary && open.has(t.tag)) { const d = t.pos.distanceTo(P.pos); if (d < bd) { bd = d; bt = t; } }
    }
    this.beaconTarget = bt;
    this.beacon.visible = !!bt;
    if (bt) {
      this.beacon.position.set(bt.pos.x, bt.pos.y, bt.pos.z);
      const s = clamp(bd / 1100, 1, 6); this.beacon.scale.set(s, 1, s);
      this.beacon.material.uniforms.op.value = clamp((bd - 500) / 1500, 0.12, 1);
      this.beacon.material.uniforms.time.value = this.time;
    }
  }
  predictImpact() {
    const P = this.player, T = this.terrain, p = _v1.copy(P.pos), v = _v2.copy(P.vel).add(upOf(P.quat, _v3).multiplyScalar(-3)), dt = 0.06;
    for (let i = 0; i < 600; i++) {
      v.y -= 9.81 * dt; p.addScaledVector(v, dt);
      if (p.y < T.ground(p.x, p.z)) { return { p: new THREE.Vector3(p.x, T.ground(p.x, p.z), p.z), t: i * dt }; }
    }
    return null;
  }
  /* test autopilot: hunts objective targets (air defences near them first) with
   * missiles, level CCIP bombing for structures and gun dives for small targets */
  autopilot() {
    const P = this.player, T = this.terrain, inp = { pitch: 0, roll: 0, yaw: 0, ab: false, brake: false, gun: false, bomb: false, missile: false, flare: false };
    if (!P.alive) return inp;
    const objTags = new Set(this.objectives.filter(o => !o.complete).map(o => o.tag));
    const keep = t => t && t.alive && !(t.air && t.falling) && (objTags.has(t.tag) || t.aa || t.flak || t.sam || t.air);
    let best = keep(this.apTarget) ? this.apTarget : null;
    if (!best) {
      let bd = 1e9;
      for (const t of this.targets.concat(this.fighters)) {
        if (!t.alive || !objTags.has(t.tag) || !t.primary || (t.air && t.falling)) continue;
        const d = Math.hypot(t.pos.x - P.pos.x, t.pos.z - P.pos.z) + (t.air ? -1500 : 0);
        if (d < bd) { bd = d; best = t; }
      }
      if (best && !best.air) {
        let th = null, td = 1500;
        for (const t of this.targets) if (t.alive && (t.aa || t.flak || t.sam) && t !== best) { const d = Math.hypot(t.pos.x - best.pos.x, t.pos.z - best.pos.z); if (d < td) { td = d; th = t; } }
        if (th) best = th;
      }
    }
    for (const f of this.fighters) if (f.alive && !f.falling && f.pos.distanceTo(P.pos) < 2200 && best && !best.air) best = f;
    if (best !== this.apTarget) { this.apTarget = best; this.apMode = 'approach'; this.apPasses = 0; }
    if (!best) { const s = steerTo(P.pos, P.quat, _v1.set(0, 900, 0), {}); inp.pitch = s.pitch; inp.roll = s.roll; return inp; }
    const tp = new THREE.Vector3(best.pos.x, best.pos.y + best.cy, best.pos.z);
    const lead = this.ccip ? this.ccip.t : 0, tpL = tp.clone().addScaledVector(best.vel || _v1.set(0, 0, 0), lead);
    const hd = Math.hypot(tp.x - P.pos.x, tp.z - P.pos.z);
    const f0 = fwdOf(P.quat, new THREE.Vector3()), toT = new THREE.Vector3(tp.x - P.pos.x, 0, tp.z - P.pos.z).normalize();
    const ahead = f0.x * toT.x + f0.z * toT.z;
    const small = best.r < 6.5 && !best.def.ship;
    const gunRun = (small && this.apPasses >= 2) || (this.ammo.bombs <= 0 && this.ammo.msl <= 0) || this.apPasses >= 4;
    let aim;
    const gmaxTo = (x, z) => { let g = 0; for (let k = 0; k <= 6; k++) g = Math.max(g, T.ground(lerp(P.pos.x, x, k / 6), lerp(P.pos.z, z, k / 6))); return g; };
    if (best.air) aim = tp.clone().addScaledVector(best.vel, Math.min(2, P.pos.distanceTo(tp) / 900));
    else if (this.apMode === 'egress') {
      aim = P.pos.clone().addScaledVector(new THREE.Vector3(f0.x, 0, f0.z).normalize(), 900); aim.y = T.ground(aim.x, aim.z) + 700;
      if (hd > 2200 && P.agl > 450) { this.apMode = 'approach'; this.apPasses++; }
    } else if (this.apMode === 'approach') {
      aim = new THREE.Vector3(tp.x, Math.max(tp.y + 950, gmaxTo(tp.x, tp.z) + 320), tp.z);
      if (hd < 1650 && ahead > 0.8 && P.pos.y > tp.y + 550) { this.apMode = 'dive'; this.apOff = null; }
      if (hd < 900 && ahead < 0.5) this.apMode = 'egress';
    } else { // dive
      aim = tpL.clone();
      if (!gunRun && this.ccip && this.ammo.bombs > 0) { const o = this.apOff || (this.apOff = new THREE.Vector3()); o.x = clamp(o.x + (tpL.x - this.ccip.p.x) * STEP * 1.6, -700, 700); o.z = clamp(o.z + (tpL.z - this.ccip.p.z) * STEP * 1.6, -700, 700); aim.x += o.x + (tpL.x - this.ccip.p.x) * 0.6; aim.z += o.z + (tpL.z - this.ccip.p.z) * 0.6; }
      else aim.addScaledVector(best.vel || _v1.set(0, 0, 0), P.pos.distanceTo(tp) / 1100);
      if (P.agl < 230 || ahead < 0.3 || hd < 150) this.apMode = 'egress';
    }
    const s = steerTo(P.pos, P.quat, aim, {}, 1.1);
    inp.pitch = s.pitch; inp.roll = s.roll; inp.ab = hd > 3000 && P.heat < 0.6;
    inp.brake = this.apMode === 'dive' && P.speed > 190;
    // terrain avoidance
    let danger = P.agl < 120;
    for (let k = 1; k <= (this.apMode === 'dive' ? 2 : 5); k++) { const x = P.pos.x + P.vel.x * k, z = P.pos.z + P.vel.z * k, y = P.pos.y + P.vel.y * k; if (y < T.ground(x, z) + 70) { danger = true; break; } }
    if (danger) { const up = steerTo(P.pos, P.quat, _v3.copy(P.pos).addScaledVector(P.vel, 2).setY(P.pos.y + 900), {}); inp.pitch = Math.max(up.pitch, 0.9); inp.roll = up.roll; inp.brake = false; if (!best.air && this.apMode === 'dive') this.apMode = 'egress'; }
    // weapons
    const f = fwdOf(P.quat, _v1), to = _v2.copy(tp).sub(P.pos), dist = to.length(), ang = Math.acos(clamp(f.dot(to) / dist, -1, 1));
    if (this.lock.locked && this.lock.target === best && this.ammo.msl > 0 && (!small || best.aa || best.sam || best.flak)) inp.missile = true;
    if (ang < 0.06 && dist < 1300) inp.gun = true;
    if (!best.air && !gunRun && this.apMode === 'dive' && this.ccip && this.ammo.bombs > 0 && Math.hypot(this.ccip.p.x - tpL.x, this.ccip.p.z - tpL.z) < Math.max(16, best.r * 0.9)) inp.bomb = true;
    if (this.warn === 2 && this.emissiles.some(m => m.target === P && m.p.distanceTo(P.pos) < 1400)) inp.flare = true;
    return inp;
  }
  dispose() {
    this.scene.traverse(o => {
      if (o.geometry && !o.geometry.userData.shared && o.geometry.dispose) o.geometry.dispose();
      if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (!Object.values(MAT).includes(m)) { if (m.map) m.map.dispose(); m.dispose(); } }
    });
    this.envRT.dispose();
    this.terrain.dispose && this.terrain.dispose();
  }
}
/* a tall glowing light pillar, brightest at the base, with bands rising up it */
function makeBeacon() {
  const g = new THREE.CylinderGeometry(9, 16, 1400, 24, 1, true); g.translate(0, 700, 0);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false,
    uniforms: { op: { value: 1 }, time: { value: 0 } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y / 1400.0; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    // normal blending (not additive) so the pillar still reads against bright sand and snow
    fragmentShader: `uniform float op, time; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.2);
        float bands = 0.75 + 0.25 * sin(vY * 60.0 - time * 6.0);
        float a = clamp(pow(1.0 - vY, 1.6) * (0.35 + 0.65 * edge) * bands * op, 0.0, 0.8);
        gl_FragColor = vec4(mix(vec3(1.0, 0.42, 0.05), vec3(1.0, 0.85, 0.4), edge), a); }`
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.visible = false;
  return mesh;
}
function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

/**
 * The people and things moving through a district: traffic on the real
 * carriageways, pedestrians on the real footways and pavements, and pigeons
 * on the squares that go up when you walk into them.
 *
 * Like NYC Walk, it is a fixed pool recycled around the player: a car or a
 * walker that falls far behind is picked up and put down again somewhere
 * ahead, preferably out of sight. Every body is an instance, so a street full
 * of people is a handful of draw calls however many are about.
 */
import * as THREE from 'three';
import { pointAt, SPEED } from './roads.js';
import { part, merge, vcMaterial } from './streets.js';
import { puffTexture } from './textures.js';
import { makeRng, clamp, damp, TAU, angleDelta } from './util.js';

const CAR_N = 46, PED_N = 150, FLOCKS = 3, PER_FLOCK = 11;
const CAR_FAR = 330, PED_FAR = 160;
export const CAR_HALF = [2.15, 0.9];
const CAR_TOP = 1.5;                 // roof height, for picking a car out with the crosshair
const PARK_FAR = 140;                // a car you left goes back into traffic past this, out of sight

const SKIN = [0xf2cdad, 0xe8b48c, 0xd49b71, 0xc98d63, 0xa8703f, 0x8d5a3a, 0x6b4128, 0xf0d2b8];
const HAIR = [0x1a130e, 0x241a12, 0x3a2517, 0x4a2f1c, 0x6b4a2a, 0x8a6a3a, 0xb8a58a, 0x9a9a9a, 0x2a2a2a];
const COAT = [0x2b3550, 0x53324a, 0x2f4a3a, 0x6b3f2a, 0x1f242c, 0x8a2f3a, 0x5d6b7a, 0xb8a58a,
              0x8a7a5a, 0x3d5a80, 0xd8d2c4, 0x9a4a2a, 0xc2a03a, 0x4a4a52, 0xe4ddd0];
const LEGS = [0x22262e, 0x3a3f4a, 0x4a4438, 0x2c3550, 0x5a5f68, 0x1a1d22, 0x6a5a48, 0x3a4a6a];

/* ------------------------------------------------------------------ models */
function carModel() {
  const body = merge([
    part(new THREE.BoxGeometry(4.3, 0.62, 1.8), 0xffffff, [0, 0.58, 0]),
    part(new THREE.BoxGeometry(1.2, 0.12, 1.74), 0xffffff, [1.45, 0.92, 0], [0, 0, -0.08]),
    part(new THREE.BoxGeometry(2.05, 0.56, 1.58), 0xffffff, [-0.28, 1.17, 0])
  ]);
  const trim = [
    // glass: a band slightly proud of the cabin all round, under its roof
    part(new THREE.BoxGeometry(2.12, 0.38, 1.62), 0x1a2432, [-0.28, 1.15, 0]),
    part(new THREE.BoxGeometry(0.1, 0.34, 1.82), 0x2a2d30, [2.16, 0.42, 0]),
    part(new THREE.BoxGeometry(0.1, 0.34, 1.82), 0x2a2d30, [-2.16, 0.42, 0])
  ];
  for (const x of [1.35, -1.35]) {
    for (const z of [0.8, -0.8]) {
      trim.push(part(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12), 0x141416, [x, 0.34, z], [Math.PI / 2, 0, 0]));
      trim.push(part(new THREE.CylinderGeometry(0.19, 0.19, 0.25, 10), 0x8a8d90, [x, 0.34, z], [Math.PI / 2, 0, 0]));
    }
  }
  const lights = merge([
    part(new THREE.BoxGeometry(0.06, 0.13, 0.36), 0xfff6e0, [2.17, 0.7, 0.6]),
    part(new THREE.BoxGeometry(0.06, 0.13, 0.36), 0xfff6e0, [2.17, 0.7, -0.6]),
    part(new THREE.BoxGeometry(0.06, 0.14, 0.4), 0xff2a1a, [-2.17, 0.74, 0.6]),
    part(new THREE.BoxGeometry(0.06, 0.14, 0.4), 0xff2a1a, [-2.17, 0.74, -0.6])
  ]);
  return { body, trim: merge(trim), lights };
}

/** A walker faces +x. Limbs hang from their pivot at y = 0. */
function pedModel() {
  const torso = merge([
    part(new THREE.BoxGeometry(0.25, 0.62, 0.42), 0xffffff, [0, 1.13, 0], [0, 0, 0], [1, 1, 1], 0.25),
    part(new THREE.BoxGeometry(0.23, 0.16, 0.37), 0xdddddd, [0, 0.83, 0]),
    part(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 6), 0xffffff, [0, 1.48, 0])
  ]);
  const head = merge([part(new THREE.SphereGeometry(0.115, 10, 8), 0xffffff, [0.01, 1.6, 0], [0, 0, 0], [1, 1.1, 0.95])]);
  const hair = merge([part(new THREE.SphereGeometry(0.122, 10, 6, 0, TAU, 0, Math.PI * 0.55), 0xffffff,
    [-0.012, 1.63, 0], [0, 0, 0.35], [1.04, 1, 1])]);
  const leg = merge([
    part(new THREE.BoxGeometry(0.13, 0.78, 0.14), 0xffffff, [0, -0.39, 0]),
    part(new THREE.BoxGeometry(0.24, 0.08, 0.13), 0x333333, [0.05, -0.8, 0])
  ]);
  const arm = merge([part(new THREE.BoxGeometry(0.1, 0.6, 0.1), 0xffffff, [0, -0.3, 0])]);
  return { torso, head, hair, leg, arm };
}

function pigeonModel() {
  const body = merge([
    part(new THREE.SphereGeometry(1, 8, 6), 0x8d9096, [0, 0.13, 0], [0, 0, 0.2], [0.17, 0.1, 0.09]),
    part(new THREE.SphereGeometry(0.055, 8, 6), 0x6a7a78, [0.13, 0.22, 0]),
    part(new THREE.BoxGeometry(0.03, 0.02, 0.02), 0xc98a3a, [0.185, 0.215, 0]),
    part(new THREE.BoxGeometry(0.14, 0.02, 0.09), 0x5a5d62, [-0.18, 0.12, 0], [0, 0, 0.25])
  ]);
  // one wing, hinged at the body on its inner edge, reaching out along +z
  const wing = merge([part(new THREE.BoxGeometry(0.16, 0.015, 0.24), 0x7a7d84, [0, 0, 0.12])]);
  return { body, wing };
}

/* ------------------------------------------------------------------- ways */
/** Offset a way sideways into a new polyline: a pavement beside a road. */
function sideWay(way, off) {
  const p = way.pts, n = way.n, pts = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const dx = p[b * 2] - p[a * 2], dz = p[b * 2 + 1] - p[a * 2 + 1];
    const L = Math.hypot(dx, dz) || 1;
    pts[i * 2] = p[i * 2] - (dz / L) * off;
    pts[i * 2 + 1] = p[i * 2 + 1] + (dx / L) * off;
  }
  const cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
  return { id: -1, cls: 'sidewalk', w: 1.8, pts, cum, n, len: cum[n - 1], foot: true, drive: false };
}

/**
 * Every segment of a set of ways, bucketed by where it is. Picking a random
 * way and hoping it passes near the player almost never works — the ring round
 * the player is under 1% of a district — so spawning picks a point in the ring
 * and asks this what runs through it.
 */
class WayGrid {
  constructor(ways, cell = 32) {
    this.cell = cell;
    this.ways = ways;
    this.map = new Map();
    ways.forEach((w, wi) => {
      for (let i = 0; i < w.n - 1; i++) {
        const len = w.cum[i + 1] - w.cum[i];
        // long segments go in every cell they cross
        const steps = Math.max(1, Math.ceil(len / (cell * 0.5)));
        let last = -1;
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          const x = w.pts[i * 2] + (w.pts[i * 2 + 2] - w.pts[i * 2]) * t;
          const z = w.pts[i * 2 + 1] + (w.pts[i * 2 + 3] - w.pts[i * 2 + 1]) * t;
          const key = (Math.floor(x / cell) + 4096) * 8192 + (Math.floor(z / cell) + 4096);
          if (key === last) continue;
          last = key;
          let l = this.map.get(key);
          if (!l) this.map.set(key, (l = []));
          l.push(wi, i);
        }
      }
    });
  }

  /** Something that runs through the cell at (x, z): { way, s }, or null. */
  sample(x, z, rng) {
    const l = this.map.get((Math.floor(x / this.cell) + 4096) * 8192 + (Math.floor(z / this.cell) + 4096));
    if (!l) return null;
    const k = Math.floor(rng() * (l.length / 2)) * 2;
    const way = this.ways[l[k]], i = l[k + 1];
    return { way, s: way.cum[i] + rng() * (way.cum[i + 1] - way.cum[i]) };
  }
}

/** Ends of ways, bucketed, so "what can I turn into here" is a lookup. */
class Junctions {
  constructor(ways, tol) {
    this.tol = tol;
    this.map = new Map();
    for (const w of ways) {
      this.add(w, 0, w.pts[0], w.pts[1]);
      this.add(w, 1, w.pts[w.n * 2 - 2], w.pts[w.n * 2 - 1]);
    }
  }
  key(ix, iz) { return (ix + 4096) * 8192 + (iz + 4096); }
  add(way, end, x, z) {
    const k = this.key(Math.floor(x / this.tol), Math.floor(z / this.tol));
    let l = this.map.get(k);
    if (!l) this.map.set(k, (l = []));
    l.push({ way, end, x, z });
  }
  /** Every way-end within tol of (x, z) other than `not`. */
  at(x, z, not) {
    const out = [];
    const ix = Math.floor(x / this.tol), iz = Math.floor(z / this.tol);
    for (let a = ix - 1; a <= ix + 1; a++) for (let b = iz - 1; b <= iz + 1; b++) {
      const l = this.map.get(this.key(a, b));
      if (!l) continue;
      for (const e of l) {
        if (e.way === not) continue;
        if (Math.hypot(e.x - x, e.z - z) <= this.tol) out.push(e);
      }
    }
    return out;
  }
}

const dummy = new THREE.Object3D();
const mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), mC = new THREE.Matrix4();
const qA = new THREE.Quaternion(), vA = new THREE.Vector3(), vS = new THREE.Vector3(1, 1, 1);
const Y = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const at = {};

function dynamic(geo, mat, n, colours = false) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;           // they move: a stale bounding sphere would cull them
  // nothing shows until it has been placed
  for (let i = 0; i < n; i++) m.setMatrixAt(i, ZERO);
  if (colours) m.setColorAt(0, new THREE.Color(1, 1, 1));
  return m;
}

/* ------------------------------------------------------------------- life */
export class Life {
  constructor(world, roads, city) {
    this.world = world;
    this.scene = world.scene;
    const st = city.street || {};
    this.left = st.drive === 'left';
    this.rng = makeRng(city.id.charCodeAt(1) * 7919 + 3);
    this.meshes = [];
    const keep = m => { this.scene.add(m); world.meshes.push(m); this.meshes.push(m); return m; };

    /* ---- traffic ---- */
    this.carWays = roads.driveWays.filter(w => w.w >= 5.5 && w.len > 12);
    this.carJ = new Junctions(this.carWays, 3);
    this.carGrid = new WayGrid(this.carWays);
    const nCars = this.carWays.length ? Math.round(CAR_N * (st.traffic ?? 1)) : 0;
    const cm = carModel();
    this.carBody = keep(dynamic(cm.body, vcMaterial({ roughness: 0.35, metalness: 0.45 }), Math.max(1, nCars), true));
    this.carTrim = keep(dynamic(cm.trim, vcMaterial({ roughness: 0.3, metalness: 0.3 }), Math.max(1, nCars)));
    this.carLightMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: 0x777777 });
    this.carLights = keep(dynamic(cm.lights, this.carLightMat, Math.max(1, nCars)));
    const palette = st.cars || [0xe9e9e6, 0x1c1f24, 0xc9ccd0];
    this.cars = [];
    for (let i = 0; i < nCars; i++) {
      // owned: you are driving it; parked: you left it, and it waits for you
      const c = { i, x: 0, z: 0, yaw: 0, v: 0, alive: false, hint: 0, wait: 0, owned: false, parked: false };
      this.carBody.setColorAt(i, new THREE.Color(palette[i % palette.length]));
      this.cars.push(c);
    }
    this.carBody.count = this.carTrim.count = this.carLights.count = nCars;
    if (this.carBody.instanceColor) this.carBody.instanceColor.needsUpdate = true;

    /* ---- pedestrians: the mapped footways, plus a pavement down each side of every real road ---- */
    this.pedWays = roads.footWays.filter(w => w.len > 6);
    for (const w of roads.driveWays) {
      if (w.w < 6 || w.len < 15) continue;
      this.pedWays.push(sideWay(w, w.w / 2 + 1.6), sideWay(w, -(w.w / 2 + 1.6)));
    }
    this.pedJ = new Junctions(this.pedWays, 4);
    this.pedGrid = new WayGrid(this.pedWays);
    const nPeds = this.pedWays.length ? Math.round(PED_N * (st.people ?? 1)) : 0;
    const pm = pedModel();
    const skinMat = vcMaterial({ roughness: 0.75 });
    this.pedTorso = keep(dynamic(pm.torso, vcMaterial({ roughness: 0.9 }), Math.max(1, nPeds), true));
    this.pedHead = keep(dynamic(pm.head, skinMat, Math.max(1, nPeds), true));
    this.pedHair = keep(dynamic(pm.hair, vcMaterial({ roughness: 0.95 }), Math.max(1, nPeds), true));
    this.pedLegs = keep(dynamic(pm.leg, vcMaterial({ roughness: 0.9 }), Math.max(1, nPeds * 2), true));
    this.pedArms = keep(dynamic(pm.arm, vcMaterial({ roughness: 0.9 }), Math.max(1, nPeds * 2), true));
    this.peds = [];
    const col = new THREE.Color();
    for (let i = 0; i < nPeds; i++) {
      const r = this.rng;
      const coat = r.pick(COAT), legs = r.pick(LEGS);
      this.pedTorso.setColorAt(i, col.setHex(coat));
      this.pedHead.setColorAt(i, col.setHex(r.pick(SKIN)));
      this.pedHair.setColorAt(i, col.setHex(r.pick(HAIR)));
      for (const k of [0, 1]) {
        this.pedLegs.setColorAt(i * 2 + k, col.setHex(legs));
        this.pedArms.setColorAt(i * 2 + k, col.setHex(coat));
      }
      this.peds.push({ i, x: 0, z: 0, yaw: 0, alive: false, hint: 0, phase: r() * TAU,
                       speed: 1.05 + r() * 0.55, s: 0, lat: 0, size: 0.93 + r() * 0.14 });
    }
    for (const m of [this.pedTorso, this.pedHead, this.pedHair]) { m.count = nPeds; m.instanceColor && (m.instanceColor.needsUpdate = true); }
    for (const m of [this.pedLegs, this.pedArms]) { m.count = nPeds * 2; m.instanceColor && (m.instanceColor.needsUpdate = true); }

    /* ---- pigeons, on the squares and the wide footways ---- */
    this.birdWays = roads.footWays.filter(w => (w.cls === 'pedestrian' || w.w >= 3) && w.len > 10);
    if (!this.birdWays.length) this.birdWays = this.pedWays.slice(0, 400);
    this.birdGrid = new WayGrid(this.birdWays);
    const bm = pigeonModel();
    const nBirds = this.birdWays.length ? FLOCKS * PER_FLOCK : 0;
    this.birdBody = keep(dynamic(bm.body, vcMaterial({ roughness: 0.8 }), Math.max(1, nBirds)));
    this.birdWing = keep(dynamic(bm.wing, vcMaterial({ roughness: 0.85, side: THREE.DoubleSide }), Math.max(1, nBirds * 2)));
    this.birdBody.count = nBirds; this.birdWing.count = nBirds * 2;
    this.flocks = [];
    for (let f = 0; f < (nBirds ? FLOCKS : 0); f++) {
      const birds = [];
      for (let k = 0; k < PER_FLOCK; k++) {
        birds.push({ i: f * PER_FLOCK + k, x: 0, y: 0, z: 0, yaw: 0, vx: 0, vy: 0, vz: 0,
                     peck: this.rng() * 5, flap: this.rng() * TAU, hop: 0 });
      }
      this.flocks.push({ birds, state: 'gone', t: 0, x: 0, z: 0 });
    }

    /* ---- contact shadows under cars and people ---- */
    const disc = new THREE.CircleGeometry(1, 16);
    disc.rotateX(-Math.PI / 2);
    this.shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32,
      depthWrite: false, map: puffTexture('rgba(0,0,0,1)', 'rgba(0,0,0,0)'), polygonOffset: true, polygonOffsetFactor: -4 });
    this.shadows = keep(dynamic(disc, this.shadowMat, Math.max(1, nCars + nPeds)));
    this.shadows.count = nCars + nPeds;

    this.started = false;
    this.threat = null;              // the car you drive, when you drive one: walkers get out of its way
    this.dodge = 1.4;                // how near the player a walker steps aside: wider round a car
  }

  /* ----------------------------------------------------------- placing */
  /** A random point on one of `grid`'s ways in a ring round the player, ideally out of view. */
  findSpot(grid, player, fwd, rMin, rMax, hidden, tries = 40) {
    const r = this.rng;
    let fallback = null;
    for (let k = 0; k < tries; k++) {
      // uniform over the ring's area, not bunched at its inner edge
      const a = r() * TAU, rad = Math.sqrt(rMin * rMin + r() * (rMax * rMax - rMin * rMin));
      const hit = grid.sample(player.x + Math.cos(a) * rad, player.z + Math.sin(a) * rad, r);
      if (!hit) continue;
      const { way, s } = hit;
      pointAt(way, s, at);
      const dx = at.x - player.x, dz = at.z - player.z, d = Math.hypot(dx, dz);
      if (d < rMin || d > rMax) continue;
      const spot = { way, s, x: at.x, z: at.z, seg: at.seg };
      if (!hidden) return spot;
      // behind you, or far enough that popping in is lost in the fog
      if ((dx * fwd.x + dz * fwd.z) / d < 0.15 || d > rMax * 0.7) return spot;
      fallback = fallback || spot;
    }
    return fallback;
  }

  spawnCar(c, player, fwd, first) {
    const spot = this.findSpot(this.carGrid, player, fwd, first ? 20 : 55, 260, !first);
    if (!spot) { c.alive = false; return; }
    c.way = spot.way; c.s = spot.s; c.hint = spot.seg;
    c.dir = this.rng() < 0.5 ? 1 : -1;
    c.vMax = (SPEED[c.way.cls] || 8) * (0.85 + this.rng() * 0.25);
    c.v = c.vMax * 0.6;
    c.alive = true; c.snap = true; c.wait = 0;
  }

  spawnPed(p, player, fwd, first) {
    const spot = this.findSpot(this.pedGrid, player, fwd, first ? 6 : 35, 140, !first);
    if (!spot) { p.alive = false; return; }
    p.way = spot.way; p.s = spot.s; p.hint = spot.seg;
    p.dir = this.rng() < 0.5 ? 1 : -1;
    p.lat = (this.rng() - 0.5) * Math.min(1.4, p.way.w * 0.6);
    p.alive = true; p.snap = true; p.pause = 0;
  }

  landFlock(f, player, fwd) {
    // squares first; failing that, any pavement (Giza has hardly a square in it)
    const spot = this.findSpot(this.birdGrid, player, fwd, 22, 90, true, 30) ||
                 this.findSpot(this.pedGrid, player, fwd, 22, 90, true, 30);
    if (!spot) { f.t = 0; return; }             // try again in a few seconds
    f.x = spot.x; f.z = spot.z; f.state = 'ground'; f.t = 0;
    for (const b of f.birds) {
      const a = this.rng() * TAU, d = Math.sqrt(this.rng()) * 2.6;
      b.x = f.x + Math.cos(a) * d; b.z = f.z + Math.sin(a) * d; b.y = 0.06;
      b.yaw = this.rng() * TAU; b.vx = b.vy = b.vz = 0;
    }
  }

  /** Which way a way carries on from its end: the next way, or back the way it came. */
  turn(o, junctions) {
    const end = o.dir > 0 ? 1 : 0, w = o.way;
    const ex = w.pts[end ? w.n * 2 - 2 : 0], ez = w.pts[end ? w.n * 2 - 1 : 1];
    const next = junctions.at(ex, ez, w);
    if (!next.length) { o.dir = -o.dir; o.s = end ? w.len : 0; return; }
    const e = next[Math.floor(this.rng() * next.length)];
    o.way = e.way;
    o.dir = e.end === 0 ? 1 : -1;
    o.s = e.end === 0 ? 0 : e.way.len;
    o.hint = e.end === 0 ? 0 : e.way.n - 2;
  }

  /* ------------------------------------------------------------ update */
  update(dt, player, camera, night) {
    const P = player.pos;
    const fwd = camera.getWorldDirection(vA);
    const f2 = { x: fwd.x, z: fwd.z };
    const fl = Math.hypot(f2.x, f2.z) || 1; f2.x /= fl; f2.z /= fl;

    if (!this.started) {
      this.started = true;
      for (const c of this.cars) this.spawnCar(c, P, f2, true);
      for (const p of this.peds) this.spawnPed(p, P, f2, true);
      for (const f of this.flocks) this.landFlock(f, P, f2);
    }
    this.updateCars(dt, P, f2, night);
    this.updatePeds(dt, P, f2);
    this.updateBirds(dt, P, f2, night);
  }

  updateCars(dt, P, f2, night) {
    const lane = this.left ? -1 : 1;
    let respawns = 0;
    for (const c of this.cars) {
      // yours: the driving code moves it, traffic leaves it alone
      if (c.owned) { this.placeCar(c); continue; }
      if (c.parked) {
        // where you left it, until it is far away and out of sight
        const dx = c.x - P.x, dz = c.z - P.z, d = Math.hypot(dx, dz);
        if (d < PARK_FAR || ((dx * f2.x + dz * f2.z) / d > 0.15 && d < CAR_FAR)) { this.placeCar(c); continue; }
        c.parked = false; c.alive = false;
      }
      if (!c.alive || Math.hypot(c.x - P.x, c.z - P.z) > CAR_FAR) {
        if (respawns++ < 2) this.spawnCar(c, P, f2, false);
        if (!c.alive) {
          for (const m of [this.carBody, this.carTrim, this.carLights, this.shadows]) m.setMatrixAt(c.i, ZERO);
          continue;
        }
      }
      // heading in the direction of travel
      const hx = Math.cos(c.yaw), hz = -Math.sin(c.yaw);
      let want = c.vMax;
      // brake for the player, and for whoever is in front
      const look = (ox, oz, lat, gap) => {
        const rx = ox - c.x, rz = oz - c.z;
        const along = rx * hx + rz * hz, side = Math.abs(rx * hz - rz * hx);
        if (along > 0 && along < 16 && side < lat) want = Math.min(want, Math.max(0, (along - gap) * 1.1));
      };
      look(P.x, P.z, 2.3, 4.5);
      for (const o of this.cars) {
        if (o === c || !o.alive) continue;
        if (Math.abs(o.x - c.x) > 16 || Math.abs(o.z - c.z) > 16) continue;
        // the car you drive or left parked is in the way whichever way it points
        if (o.owned || o.parked) {
          look(o.x, o.z, 2.6, 6.2);
          // and right up against it: stop dead rather than drive into it
          const rx = o.x - c.x, rz = o.z - c.z, along = rx * hx + rz * hz;
          if (along > 0 && along < 5.6 && Math.abs(rx * hz - rz * hx) < 2.8) { want = 0; c.v = 0; }
          continue;
        }
        if (Math.cos(o.yaw - c.yaw) < 0.4) continue;       // only cars going our way
        look(o.x, o.z, 1.7, 6.5);
      }
      c.v = c.v < want ? Math.min(want, c.v + 3.2 * dt) : Math.max(want, c.v - 8 * dt);
      // stuck behind something that will not move: give up and go back
      c.wait = c.v < 0.2 ? c.wait + dt : 0;
      if (c.wait > 9) { c.dir = -c.dir; c.wait = 0; }

      c.s += c.v * dt * c.dir;
      if (c.s > c.way.len || c.s < 0) this.turn(c, this.carJ);
      pointAt(c.way, c.s, at, c.hint);
      c.hint = at.seg;
      const tx = at.dx * c.dir, tz = at.dz * c.dir;
      const off = clamp(c.way.w / 4, 1.3, 1.9) * lane;
      const x = at.x - tz * off, z = at.z + tx * off;
      const yaw = Math.atan2(-tz, tx);
      if (c.snap) { c.x = x; c.z = z; c.yaw = yaw; c.snap = false; }
      else {
        c.x = damp(c.x, x, 10, dt); c.z = damp(c.z, z, 10, dt);
        c.yaw += angleDelta(c.yaw, yaw) * (1 - Math.exp(-7 * dt));
      }

      this.placeCar(c);
    }
    this.carBody.instanceMatrix.needsUpdate = this.carTrim.instanceMatrix.needsUpdate =
      this.carLights.instanceMatrix.needsUpdate = true;
    const glow = 0.4 + night * 0.9;
    this.carLightMat.color.setRGB(glow, glow, glow);
  }

  placeCar(c) {
    dummy.position.set(c.x, 0.02, c.z);
    dummy.rotation.set(0, c.yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    this.carBody.setMatrixAt(c.i, dummy.matrix);
    this.carTrim.setMatrixAt(c.i, dummy.matrix);
    this.carLights.setMatrixAt(c.i, dummy.matrix);
    dummy.position.y = 0.08;
    dummy.scale.set(2.7, 1, 1.35);
    dummy.updateMatrix();
    this.shadows.setMatrixAt(c.i, dummy.matrix);
  }

  /**
   * The car a ray hits, if any within `maxDist`: each car is a box turned to
   * its heading, so the ray goes into the car's own frame and meets the box
   * there. `pad` widens the box a little, so near the crosshair is enough.
   */
  pickCar(o, d, maxDist, pad = 0.25) {
    let best = null, bestT = maxDist;
    for (const c of this.cars) {
      if (!c.alive) continue;
      const rx = o.x - c.x, rz = o.z - c.z;
      if (rx * rx + rz * rz > (maxDist + 3) * (maxDist + 3)) continue;
      const hx = Math.cos(c.yaw), hz = -Math.sin(c.yaw);
      const ox = rx * hx + rz * hz, oz = -rx * hz + rz * hx, oy = o.y;
      const dx = d.x * hx + d.z * hz, dz = -d.x * hz + d.z * hx, dy = d.y;
      let t0 = 0, t1 = bestT;
      // x, y, z slabs in turn
      for (let a = 0; a < 3 && t0 <= t1; a++) {
        const org = a === 0 ? ox : a === 1 ? oy : oz, dir = a === 0 ? dx : a === 1 ? dy : dz;
        const lo = a === 0 ? -CAR_HALF[0] - pad : a === 1 ? 0 : -CAR_HALF[1] - pad;
        const hi = a === 0 ? CAR_HALF[0] + pad : a === 1 ? CAR_TOP : CAR_HALF[1] + pad;
        if (Math.abs(dir) < 1e-6) { if (org < lo || org > hi) t0 = Infinity; continue; }
        let tn = (lo - org) / dir, tf = (hi - org) / dir;
        if (tn > tf) { const k = tn; tn = tf; tf = k; }
        if (tn > t0) t0 = tn;
        if (tf < t1) t1 = tf;
      }
      if (t0 <= t1 && t0 < bestT) { bestT = t0; best = c; }
    }
    if (best) best.pickDist = bestT;
    return best;
  }

  /** Take a car out of traffic: it is yours now. */
  takeCar(c) { c.owned = true; c.parked = false; c.v = 0; c.wait = 0; }

  /** Leave it where it stands; traffic may have it back once you are well away. */
  parkCar(c) { c.owned = false; c.parked = true; c.v = 0; }

  updatePeds(dt, P, f2) {
    const nC = this.cars.length;
    let respawns = 0;
    for (const p of this.peds) {
      if (!p.alive || Math.hypot(p.x - P.x, p.z - P.z) > PED_FAR) {
        if (respawns++ < 3) this.spawnPed(p, P, f2, false);
        if (!p.alive) { this.hidePed(p); continue; }
      }
      // step aside for the player rather than walk through them
      const dP = Math.hypot(p.x - P.x, p.z - P.z);
      if (p.scare > 0) p.scare -= dt;
      const moving = p.pause <= 0 && !(p.scare > 0);  // nobody strolls on while a car bears down
      if (moving) {
        p.s += p.speed * dt * p.dir;
        if (p.s > p.way.len || p.s < 0) this.turn(p, this.pedJ);
        p.phase += dt * p.speed * 5.2;
      } else {
        p.pause -= dt;
        p.phase = damp(p.phase, Math.round(p.phase / Math.PI) * Math.PI, 8, dt);
      }
      // now and then somebody stops, as people do
      if (moving && this.rng() < dt * 0.012) p.pause = 2 + this.rng() * 5;

      pointAt(p.way, p.s, at, p.hint);
      p.hint = at.seg;
      const tx = at.dx * p.dir, tz = at.dz * p.dir;
      if (dP < this.dodge) {
        const side = ((P.x - at.x) * -tz + (P.z - at.z) * tx) > 0 ? -1 : 1;
        p.lat = clamp(p.lat + side * dt * 1.8, -Math.max(1, p.way.w), Math.max(1, p.way.w));
      }
      let yaw = Math.atan2(-tz, tx);
      if (this.threat) yaw = this.evade(p, dt, yaw);
      else if (p.ox || p.oz) {
        // the car has gone: drift back to the pavement
        p.ox = damp(p.ox, 0, 0.8, dt); p.oz = damp(p.oz, 0, 0.8, dt);
        if (Math.abs(p.ox) + Math.abs(p.oz) < 0.02) p.ox = p.oz = 0;
      }
      const x = at.x - tz * p.lat + (p.ox || 0), z = at.z + tx * p.lat + (p.oz || 0);
      if (p.snap) { p.x = x; p.z = z; p.yaw = yaw; p.snap = false; p.ox = p.oz = 0; p.scare = 0; }
      else {
        const k = p.scare > 0 ? 16 : 8;          // a fright moves you fast
        p.x = damp(p.x, x, k, dt); p.z = damp(p.z, z, k, dt);
        p.yaw += angleDelta(p.yaw, yaw) * (1 - Math.exp(-(p.scare > 0 ? 14 : 6) * dt));
      }
      // never stand inside the car you are driving
      if (this.threat) this.shove(p);
      this.placePed(p);
      dummy.position.set(p.x, 0.085, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0.42, 1, 0.42);
      dummy.updateMatrix();
      this.shadows.setMatrixAt(nC + p.i, dummy.matrix);
    }
    for (const m of [this.pedTorso, this.pedHead, this.pedHair, this.pedLegs, this.pedArms, this.shadows]) {
      m.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * The car you drive is coming: anyone in the strip ahead of it (longer the
   * faster you go) runs sideways out of its path, away from its centre line,
   * and turns to watch it go by. Returns the way they should face.
   */
  evade(p, dt, yaw) {
    const t = this.threat;
    const hx = Math.cos(t.yaw), hz = -Math.sin(t.yaw);
    const rx = p.x - t.x, rz = p.z - t.z;
    const u = rx * hx + rz * hz;                 // ahead of the nose (+) or behind (-)
    const s = -rx * hz + rz * hx;                // to the car's right (+) or left (-)
    const v = t.v, sp = Math.abs(v);
    const ahead = v >= 0 ? u : -u;               // reversing: behind is ahead
    const reach = CAR_HALF[0] + 2 + sp * 1.3;    // about a second and a bit of warning
    const clear = CAR_HALF[1] + 1.5;
    const inPath = sp > 0.8 && ahead > -CAR_HALF[0] && ahead < reach && Math.abs(s) < clear;
    const close = Math.hypot(rx, rz) < CAR_HALF[0] + 1.2;   // even creeping up on someone
    if (!inPath && !close) return p.scare > 0 ? this.watch(p, t, yaw) : yaw;
    // which side: whichever they are already on, and a coin toss dead centre
    let side = Math.sign(s) || (p.i & 1 ? 1 : -1);
    if (Math.abs(s) < 0.3 && p.side) side = p.side;
    p.side = side;
    const need = clear + 0.4 - Math.abs(s);
    if (need > 0) {
      const run = (sp > 6 ? 7 : 4.5) * dt;       // a sprint for a fast car, a hop for a slow one
      const m = Math.min(need, run);
      p.ox = (p.ox || 0) + (-hz * side) * m;
      p.oz = (p.oz || 0) + (hx * side) * m;
      p.phase += dt * 16;                        // legs going
    }
    p.scare = 1.4;
    return this.watch(p, t, yaw);
  }

  /** Face the car while it is near. */
  watch(p, t, yaw) {
    return Math.atan2(-(t.z - p.z), t.x - p.x);
  }

  /** Push a walker out of the car's box, sideways. */
  shove(p) {
    const t = this.threat;
    const hx = Math.cos(t.yaw), hz = -Math.sin(t.yaw);
    const rx = p.x - t.x, rz = p.z - t.z;
    const u = rx * hx + rz * hz, s = -rx * hz + rz * hx;
    const bx = CAR_HALF[0] + 0.35, bz = CAR_HALF[1] + 0.35;
    if (Math.abs(u) >= bx || Math.abs(s) >= bz) return;
    const side = Math.sign(s) || 1, d = bz - Math.abs(s);
    const px = -hz * side * d, pz = hx * side * d;
    p.x += px; p.z += pz;
    p.ox = (p.ox || 0) + px; p.oz = (p.oz || 0) + pz;
    this.placePed(p);
  }

  placePed(p) {
    const swing = Math.sin(p.phase);
    qA.setFromAxisAngle(Y, p.yaw);
    // a little rise and fall with each step
    vA.set(p.x, Math.abs(Math.cos(p.phase)) * 0.03, p.z);
    vS.setScalar(p.size);
    mA.compose(vA, qA, vS);
    this.pedTorso.setMatrixAt(p.i, mA);
    this.pedHead.setMatrixAt(p.i, mA);
    this.pedHair.setMatrixAt(p.i, mA);
    for (const k of [0, 1]) {
      const sgn = k ? 1 : -1;
      mB.makeRotationZ(swing * 0.5 * sgn).setPosition(0, 0.87, 0.1 * sgn);
      this.pedLegs.setMatrixAt(p.i * 2 + k, mC.multiplyMatrices(mA, mB));
      mB.makeRotationZ(-swing * 0.42 * sgn).setPosition(0, 1.4, 0.265 * sgn);
      this.pedArms.setMatrixAt(p.i * 2 + k, mC.multiplyMatrices(mA, mB));
    }
  }

  hidePed(p) {
    for (const m of [this.pedTorso, this.pedHead, this.pedHair]) m.setMatrixAt(p.i, ZERO);
    for (const k of [0, 1]) { this.pedLegs.setMatrixAt(p.i * 2 + k, ZERO); this.pedArms.setMatrixAt(p.i * 2 + k, ZERO); }
    this.shadows.setMatrixAt(this.cars.length + p.i, ZERO);
  }

  updateBirds(dt, P, f2, night) {
    for (const f of this.flocks) {
      f.t += dt;
      const dP = Math.hypot(f.x - P.x, f.z - P.z);
      if (f.state === 'ground') {
        // they roost after dark; and they will not wait for you to walk into them
        const spooked = dP < 5.5 || night > 0.6 ||
          this.cars.some(c => c.alive && c.v > 2 && Math.hypot(c.x - f.x, c.z - f.z) < 4);
        if (spooked) {
          f.state = 'fly'; f.t = 0;
          for (const b of f.birds) {
            let ax = b.x - P.x, az = b.z - P.z;
            const L = Math.hypot(ax, az) || 1;
            ax /= L; az /= L;
            const spread = (this.rng() - 0.5) * 1.4;
            b.vx = (ax * Math.cos(spread) - az * Math.sin(spread)) * (3 + this.rng() * 2);
            b.vz = (az * Math.cos(spread) + ax * Math.sin(spread)) * (3 + this.rng() * 2);
            b.vy = 3.5 + this.rng() * 2.5;
          }
        } else if (dP > 170) {
          f.state = 'gone';
        }
      } else if (f.state === 'fly') {
        if (f.t > 6) f.state = 'gone';
      } else if (f.state === 'gone') {
        if (night < 0.5 && f.t > 3) this.landFlock(f, P, f2);
      }

      for (const b of f.birds) {
        let flap = 0;
        if (f.state === 'ground') {
          // peck, shuffle a step, look round
          b.peck -= dt;
          if (b.peck < 0) {
            b.peck = 0.6 + this.rng() * 2.2;
            b.yaw += (this.rng() - 0.5) * 1.8;
            b.hop = 0.25;
          }
          if (b.hop > 0) {
            b.hop -= dt;
            b.x += Math.cos(b.yaw) * dt * 0.7;
            b.z -= Math.sin(b.yaw) * dt * 0.7;
          }
          b.y = 0.06 + (b.hop > 0 ? Math.sin(b.hop * 12.5) * 0.03 : 0);
        } else if (f.state === 'fly') {
          b.vy -= dt * 0.8;
          b.vx *= 1 + dt * 0.25; b.vz *= 1 + dt * 0.25;
          b.x += b.vx * dt; b.y += Math.max(0.6, b.vy) * dt; b.z += b.vz * dt;
          b.yaw = Math.atan2(-b.vz, b.vx);
          b.flap += dt * 26;
          flap = Math.sin(b.flap) * 0.9;
        }
        const show = f.state !== 'gone';
        const pitch = f.state === 'ground' && b.peck < 0.25 ? 0.5 : 0;
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, b.yaw, -pitch, 'YXZ');
        dummy.scale.setScalar(show ? 1 : 0);
        dummy.updateMatrix();
        this.birdBody.setMatrixAt(b.i, dummy.matrix);
        for (const k of [0, 1]) {
          // folded away on the ground; beating in the air. +z is the bird's
          // right, and the left wing is the right one mirrored
          if (f.state !== 'fly') { this.birdWing.setMatrixAt(b.i * 2 + k, ZERO); continue; }
          const sgn = k ? 1 : -1;
          mB.makeRotationX(-flap * sgn);
          if (!k) mB.multiply(mC.makeScale(1, 1, -1));
          mB.setPosition(-0.02, 0.19, 0.05 * sgn);
          this.birdWing.setMatrixAt(b.i * 2 + k, mA.multiplyMatrices(dummy.matrix, mB));
        }
      }
    }
    this.birdBody.instanceMatrix.needsUpdate = this.birdWing.instanceMatrix.needsUpdate = true;
  }

  /** Cars are solid: shove the player out of any they are standing in. */
  pushPlayer(pos) {
    const R = 0.38;
    for (const c of this.cars) {
      if (!c.alive || c.owned || pos.y > 1.5) continue;
      const rx = pos.x - c.x, rz = pos.z - c.z;
      if (rx * rx + rz * rz > 9) continue;
      const hx = Math.cos(c.yaw), hz = -Math.sin(c.yaw);
      const lx = rx * hx + rz * hz, lz = -rx * hz + rz * hx;
      const px = CAR_HALF[0] + R - Math.abs(lx), pz = CAR_HALF[1] + R - Math.abs(lz);
      if (px <= 0 || pz <= 0) continue;
      let nx = lx, nz = lz;
      if (px < pz) { nx = Math.sign(lx) * (CAR_HALF[0] + R); } else { nz = Math.sign(lz) * (CAR_HALF[1] + R); }
      pos.x = c.x + nx * hx - nz * hz;
      pos.z = c.z + nx * hz + nz * hx;
    }
  }

  setNight(v) {
    this.shadowMat.opacity = 0.32 * (1 - v * 0.6);
  }

  counts() {
    return { cars: this.cars.length, peds: this.peds.length, birds: this.flocks.length * PER_FLOCK };
  }

  dispose() {
    for (const m of this.meshes) {
      this.scene.remove(m);
      m.geometry.dispose();
      m.dispose?.();
    }
    this.meshes.length = 0;
  }
}

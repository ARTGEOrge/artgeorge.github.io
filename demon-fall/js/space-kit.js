/* Demon Fall — set pieces for the Mars and Moon campaigns.
 *
 * Same rules as props.js: everything is merged into the level's material
 * batches through world.box()/world.shape(), collision is a handful of boxes,
 * and every random choice comes from the level's own seeded stream. */
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { roomWalls } from './world.js';
import { material, puffTexture } from './textures.js';
import { TAU, makeRng, fbm } from './util.js';

/* ------------------------------------------------------------ spawning */
export const sp = (kind, x, z, y = 0) => ({ kind, at: [x, y, z] });

/** n spawns picked from `kinds` (repeat a kind to weight it) over a rectangle. */
export function horde(rng, n, kinds, x0, x1, z0, z1, y = 0) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(sp(rng.pick(kinds), rng.range(x0, x1), rng.range(z0, z1), y));
  return out;
}

/**
 * Difficulty for space stage n (1 = Mars 1 … 12 = Moon 6). Earth keeps its own
 * hand-tuned numbers; this picks up a notch above Earth 6 and climbs steadily.
 */
export function spaceDiff(n) {
  const t = (n - 1) / 11;
  return {
    hp: +(1.0 + 0.45 * t).toFixed(2),          // enemy health (on top of the tougher colony types)
    speed: +(1.0 + 0.1 * t).toFixed(2),        // movement
    damage: +(1.0 + 0.3 * t).toFixed(2),       // melee and spit
    fire: +(1 + 0.3 * t).toFixed(2),           // ranged rate
    maxAlive: Math.round(16 + 6 * t),           // how many a wave can stack up to
    waveEvery: +(5.4 - 1.6 * t).toFixed(1),    // seconds between waves
    waveSize: 3 + Math.round(1.4 * t),          // bodies per wave
    drop: +(0.14 - 0.06 * t).toFixed(3)         // chance a body killed during a wave stage drops ammo
  };
}

/** Wave-stage defaults for a difficulty. */
export const waves = (d, extra) => ({ waveEvery: d.waveEvery, waveSize: d.waveSize, maxAlive: d.maxAlive, ...extra });

/* -------------------------------------------------------------- rocks */
const ROCKS = [];
function rockGeo(i) {
  if (ROCKS[i]) return ROCKS[i];
  const r = makeRng(4242 + i * 31);
  let g = new THREE.IcosahedronGeometry(1, 1);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = BufferGeometryUtils.mergeVertices(g);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let k = 0; k < p.count; k++) {
    v.fromBufferAttribute(p, k);
    const n = 0.72 + fbm(v.x * 1.7 + i * 3, v.z * 1.7 + v.y * 1.3, 3, 50 + i) * 0.55 + r.range(-0.05, 0.05);
    v.multiplyScalar(n);
    if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.3;     // flat-ish underside so they sit on the ground
    p.setXYZ(k, v.x, v.y, v.z);
  }
  // planar-ish uvs so the strata texture wraps sensibly
  const uv = new Float32Array(p.count * 2);
  for (let k = 0; k < p.count; k++) { uv[k * 2] = p.getX(k) + p.getZ(k) * 0.6; uv[k * 2 + 1] = p.getY(k); }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  ROCKS[i] = g;
  return g;
}

/** A boulder. Big ones block movement and bullets. */
export function rock(world, x, z, r, rng, mat = 'redrock', opts = {}) {
  const sx = rng.range(0.8, 1.35), sy = rng.range(0.55, 1.0) * (opts.tall || 1), sz = rng.range(0.8, 1.3);
  const y = opts.y || 0;
  world.shape(rockGeo(rng.int(0, 5)), mat, {
    pos: [x, y + r * sy * 0.18, z], rot: [rng.range(-0.15, 0.15), rng() * TAU, rng.range(-0.15, 0.15)],
    scale: [r * sx, r * sy, r * sz], uv: opts.uv || 0.5, mat: opts.tint ? { color: opts.tint } : {}
  });
  if (r > 0.7 && opts.collide !== false) {
    const h = r * sy * 1.1;
    world.collider(x, y + h / 2, z, r * sx * 1.25, h, r * sz * 1.25, 0, 'rock');
  }
}

/** Loose stones that only decorate. */
export function scree(world, x, z, n, spread, rng, mat = 'redrock') {
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU, d = Math.sqrt(rng()) * spread;
    rock(world, x + Math.cos(a) * d, z + Math.sin(a) * d, rng.range(0.12, 0.45), rng, mat, { collide: false, uv: 1 });
  }
}

/**
 * A wall of piled boulders from (x0,z0) to (x1,z1): canyon sides, crater rims.
 * opts.out = [nx, nz] points away from the playable side; the boulders sit
 * outside the line and the collider's inner face lies on it.
 */
export function cliff(world, x0, z0, x1, z1, height, rng, mat = 'redrock', opts = {}) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
  const [ox, oz] = opts.out || [0, 0];
  const n = Math.max(2, Math.ceil(len / (height * 0.5)));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + dx * t, z = z0 + dz * t;
    const r = height * rng.range(0.42, 0.6);
    const push = r * 1.05;
    rock(world, x + ox * push + rng.range(-1, 1), z + oz * push + rng.range(-1, 1), r, rng, mat, { collide: false, tall: rng.range(1.3, 1.8), uv: 0.25, tint: opts.tint });
    if (rng.chance(0.5)) rock(world, x + ox * push * 1.2, z + oz * push * 1.2, r * 0.7, rng, mat, { collide: false, y: r * 0.5, uv: 0.3, tint: opts.tint });   // stacked on the one below
  }
  if (opts.collide !== false) {
    const th = opts.thick || 6;
    if (Math.abs(dx) < Math.abs(dz)) world.collider(x0 + ox * th / 2, height / 2, (z0 + z1) / 2, th, height, Math.abs(dz) + 2, 0, 'cliff');
    else world.collider((x0 + x1) / 2, height / 2, z0 + oz * th / 2, Math.abs(dx) + 2, height, th, 0, 'cliff');
  }
}

/** Flat-topped buttes far away on the horizon. */
export function mesas(world, radius, count, rng, mat = 'redrock', tint = 0x8a4a34) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + rng.range(-0.12, 0.12);
    const r = radius + rng.range(0, radius * 0.3);
    const w = rng.range(30, 80), h = rng.range(18, 55);
    world.shape(new THREE.CylinderGeometry(w * 0.7, w, h, 9), mat, {
      pos: [Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r], rot: [0, rng() * TAU, 0],
      scale: [1, 1, rng.range(0.5, 1)], uv: 0.06, collide: false, mat: { color: tint, fog: false }
    });
  }
}

/** Grey lunar highlands: rounded swells on the horizon. */
export function highlands(world, radius, count, rng, tint = 0x8a8a90) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + rng.range(-0.1, 0.1);
    const r = radius + rng.range(0, 60);
    const s = rng.range(30, 80);
    world.shape(new THREE.SphereGeometry(1, 14, 8), 'regolith', {
      pos: [Math.cos(a) * r, -s * 0.62, Math.sin(a) * r],
      scale: [s * 1.8, s, s * 1.3], rot: [0, rng() * TAU, 0], uv: 10, collide: false, mat: { color: tint, fog: false }
    });
  }
}

/** A lunar crater: dark floor, a raised lip of boulders. Visual only unless walled. */
export function lunarCrater(world, x, z, r, rng, opts = {}) {
  world.shape(new THREE.CircleGeometry(r, 28).rotateX(-Math.PI / 2), 'regolith', {
    pos: [x, 0.025, z], collide: false, shadow: false, uv: 0.4, mat: { color: 0x6a6a70 }
  });
  world.shape(new THREE.TorusGeometry(r, r * 0.12, 6, 28).rotateX(Math.PI / 2), 'regolith', {
    pos: [x, 0, z], scale: [1, 1, 0.35], collide: false, uv: 0.3, mat: { color: 0xa8a8ae }
  });
  const n = Math.round(r * (opts.boulders || 0.8));
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU, d = r * rng.range(0.92, 1.12);
    rock(world, x + Math.cos(a) * d, z + Math.sin(a) * d, rng.range(0.2, 0.7), rng, 'regolith', { collide: false, uv: 1 });
  }
}

/* ----------------------------------------------------------- the colony */
const PANEL = { uv: 0.5 };

/** A habitat dome: ring wall, panelled shell, lit windows and an airlock. */
export function dome(world, x, z, r, rng, opts = {}) {
  const shell = opts.glass ? null : { color: opts.tint || 0xe8e4dc };
  world.cylinder(x, 0.9, z, r, r + 0.2, 1.8, 'panel', { seg: 28, mat: { repeat: 4, color: 0xb8b4ac }, tag: 'dome' });
  if (shell) {
    world.shape(new THREE.SphereGeometry(r, 28, 12, 0, TAU, 0, Math.PI / 2), 'panel', {
      pos: [x, 1.8, z], uv: 3, mat: shell
    });
  } else {
    const glass = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 12, 0, TAU, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x9ad8c0, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.6, depthWrite: false }));
    glass.position.set(x, 1.8, z);
    world.add(glass);
  }
  // ribs over the top
  for (let i = 0; i < 6; i++) {
    world.shape(new THREE.TorusGeometry(r + 0.06, 0.1, 5, 32, Math.PI), 'rust', {
      pos: [x, 1.8, z], rot: [0, (i / 6) * Math.PI, 0], collide: false, mat: { color: 0x8a8e96, metalness: 0.6 }
    });
  }
  // a band of lit windows
  const wins = Math.round(r * 1.4);
  for (let i = 0; i < wins; i++) {
    const a = (i / wins) * TAU;
    if (rng.chance(0.3)) continue;
    world.quad(x + Math.cos(a) * (r * 0.93 + 0.05), 1.8 + r * 0.33, z + Math.sin(a) * (r * 0.93 + 0.05), 1.1, 0.5, -a + Math.PI / 2, 'dome-windows',
      () => new THREE.MeshStandardMaterial({ color: 0x1a1008, emissive: opts.windowColour || 0xffb060, emissiveIntensity: 1.5, side: THREE.DoubleSide }));
  }
  // airlock porch facing `door` (radians, 0 = +z)
  const da = opts.door == null ? 0 : opts.door;
  const ax = x + Math.sin(da) * (r + 1.2), az = z + Math.cos(da) * (r + 1.2);
  world.box(ax, 1.4, az, 3.2, 2.8, 3, 'panel', { uv: 0.6, rotY: da, mat: { color: 0xd8d4cc } });
  world.box(ax + Math.sin(da) * 1.52, 1.2, az + Math.cos(da) * 1.52, 1.4, 2.2, 0.06, 'rust', { uv: 1, rotY: da, collide: false, mat: { color: 0x3a4048, metalness: 0.6 } });
  world.light(opts.windowColour || 0xffb060, 3, ax + Math.sin(da) * 2.2, 3, az + Math.cos(da) * 2.2, 10);
  // collision: two stacked boxes hug the dome
  world.collider(x, r * 0.35, z, r * 1.9, r * 0.7 + 1.8, r * 1.9, 0, 'dome');
  world.collider(x, r * 0.75 + 1.8, z, r * 1.2, r * 0.5, r * 1.2, 0, 'dome');
}

/** A horizontal habitat module on skids, like a lander can. */
export function module(world, x, z, len, r, rotY, rng, opts = {}) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const body = opts.tint || 0xdcd8d0;
  const y = r + 0.5;
  world.shape(new THREE.CylinderGeometry(r, r, len, 20), 'panel', { pos: [x, y, z], rot: [0, rotY, Math.PI / 2], uv: 0.5, mat: { color: body } });
  for (const e of [-1, 1]) {
    world.shape(new THREE.SphereGeometry(r, 20, 8, 0, TAU, 0, Math.PI / 2), 'panel', {
      pos: [x + c * e * len / 2, y, z - s * e * len / 2], rot: [0, rotY, -e * Math.PI / 2], scale: [1, 0.35, 1], uv: 0.5, mat: { color: body }
    });
  }
  for (let i = 0; i <= Math.floor(len / 2.4); i++) {
    const t = -len / 2 + 0.3 + i * 2.4;
    world.shape(new THREE.TorusGeometry(r + 0.04, 0.07, 5, 24), 'rust', {
      pos: [x + c * t, y, z - s * t], rot: [0, rotY + Math.PI / 2, 0], collide: false, mat: { color: 0x6a6e76, metalness: 0.6 }
    });
    if (i % 2 === 0) for (const k of [-1, 1]) {   // skids
      world.box(x + c * t + s * k * r * 0.6, 0.25, z - s * t + c * k * r * 0.6, 0.18, 0.5, 0.18, 'rust', { uv: 1, collide: false, mat: { color: 0x4a4e56, metalness: 0.6 } });
    }
  }
  // portholes either side
  for (let i = 0; i < Math.floor(len / 3); i++) {
    const t = -len / 2 + 1.5 + i * 3;
    for (const k of [-1, 1]) {
      world.quad(x + c * t + s * k * (r + 0.02), y + 0.2, z - s * t + c * k * (r + 0.02), 0.6, 0.6, rotY + (k > 0 ? 0 : Math.PI),
        'module-ports', () => new THREE.MeshStandardMaterial({ color: 0x0a0e14, emissive: opts.lit === false ? 0x000000 : 0x6ab8ff, emissiveIntensity: 1.2 }));
    }
  }
  if (opts.label) world.sign(opts.label, x + s * (r + 0.05), y + r * 0.55, z + c * (r + 0.05), rotY, Math.min(4, len * 0.5), opts.labelColour || '#6ae0ff');
  world.collider(x, y, z, Math.abs(c) * len + Math.abs(s) * r * 2, r * 2 + 0.6, Math.abs(s) * len + Math.abs(c) * r * 2, 0, 'module');
}

/** Rows of tilted solar panels on posts. */
export function solarArray(world, x, z, rotY, n, rng, tilt = 0.5) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  for (let i = 0; i < n; i++) {
    const t = (i - (n - 1) / 2) * 3.4;
    const px = x + c * t, pz = z - s * t;
    world.box(px, 0.8, pz, 0.12, 1.6, 0.12, 'rust', { uv: 1, collide: false, mat: { color: 0x7a7e86, metalness: 0.6 } });
    const broken = rng.chance(0.2);
    world.shape(new THREE.BoxGeometry(3.2, 0.06, 1.9), 'grate', {
      pos: [px, 1.7, pz], rot: [broken ? tilt + 0.8 : tilt, rotY, broken ? 0.3 : 0], collide: false,
      mat: { color: 0x3a4a8a, metalness: 0.7, roughness: 0.3 }
    });
  }
  world.collider(x, 0.9, z, Math.abs(c) * n * 3.4 + 0.4, 1.8, Math.abs(s) * n * 3.4 + 0.4, 0, 'solar');
}

/** Comms mast with a dish and a slow red beacon. */
export function mast(world, x, z, h, rng) {
  world.shape(new THREE.CylinderGeometry(0.12, 0.2, h, 8), 'rust', { pos: [x, h / 2, z], collide: true, tag: 'mast', mat: { color: 0x9aa0a8, metalness: 0.6 } });
  for (let y = 2; y < h - 1; y += 2.5) {
    world.shape(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 4), 'rust', { pos: [x, y, z], rot: [0, rng() * TAU, Math.PI / 2], collide: false, shadow: false });
  }
  world.shape(new THREE.SphereGeometry(1.2, 14, 8, 0, TAU, 0, Math.PI / 2.6), 'hull', {
    pos: [x + 0.6, h * 0.75, z], rot: [-1.1, rng() * TAU, 0], collide: false, mat: { repeat: 1, metalness: 0.5 }
  });
  world.shape(new THREE.SphereGeometry(0.12, 8, 6), 'plaster', { pos: [x, h + 0.1, z], collide: false, shadow: false, mat: { color: 0xff3020, emissive: 0xff2010, emissiveIntensity: 2 } });
  world.light(0xff3020, 2.5, x, h, z, 12);
}

/** Six-wheeled pressurised rover. Blocks movement like a car. */
export function rover(world, x, z, rotY, rng, colour = 0xd8d4cc) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  let [px, pz] = at(0, 0);
  world.box(px, 1.0, pz, 5.2, 0.7, 2.4, 'hull', { rotY, uv: 0.5, mat: { color: colour, repeat: 1, metalness: 0.5 }, collide: false });
  [px, pz] = at(0.6, 0);
  world.box(px, 1.8, pz, 3.2, 1.1, 2.2, 'panel', { rotY, uv: 0.5, mat: { color: colour }, collide: false });
  [px, pz] = at(2.25, 0);
  world.box(px, 1.8, pz, 0.08, 0.8, 1.9, 'rust', { rotY, uv: 1, collide: false, mat: { color: 0x101820, metalness: 0.7, roughness: 0.15 } });
  for (const lx of [-1.9, 0, 1.9]) for (const lz of [-1.35, 1.35]) {
    [px, pz] = at(lx, lz);
    world.shape(new THREE.CylinderGeometry(0.55, 0.55, 0.42, 14), 'rust', { pos: [px, 0.55, pz], rot: [Math.PI / 2, rotY, 0], collide: false, mat: { color: 0x2a2a2e, roughness: 0.95 } });
  }
  [px, pz] = at(-1.2, 0);
  world.box(px, 2.5, pz, 1.6, 0.12, 1.8, 'grate', { rotY, uv: 1, collide: false, mat: { color: 0x6a6e76 } });   // roof rack
  if (rng.chance(0.6)) {   // a flat tyre, a dented panel: it went off the road in a hurry
    [px, pz] = at(-2.3, 0.6);
    world.box(px, 0.9, pz, 0.6, 0.5, 0.06, 'rust', { rotY: rotY + 0.4, uv: 1, collide: false });
  }
  world.collider(x, 1.2, z, Math.abs(c) * 5.4 + Math.abs(s) * 3, 2.4, Math.abs(s) * 5.4 + Math.abs(c) * 3, 0, 'rover');
}

/** A ribbed cargo container. */
export function container(world, x, z, rotY, colour, rng, stack = 1) {
  for (let k = 0; k < stack; k++) {
    const y = 1.3 + k * 2.6;
    const r = rotY + (k ? rng.range(-0.1, 0.1) : 0);
    world.box(x, y, z, 6, 2.6, 2.5, 'hull', { rotY: r, uv: 0.35, mat: { color: colour, repeat: 1, metalness: 0.45, roughness: 0.5 }, collide: k === 0 });
    const c = Math.cos(r), s = Math.sin(r);
    for (let i = -2; i <= 2; i++) {
      world.box(x + c * i * 1.2, y, z - s * i * 1.2, 0.08, 2.5, 2.6, 'rust', { rotY: r, uv: 1, collide: false, mat: { color: colour, metalness: 0.5 } });
    }
  }
  if (stack > 1) world.collider(x, stack * 1.3, z, Math.abs(Math.cos(rotY)) * 6 + Math.abs(Math.sin(rotY)) * 2.5, stack * 2.6, Math.abs(Math.sin(rotY)) * 6 + Math.abs(Math.cos(rotY)) * 2.5, 0, 'container');
}

/** Landing pad: grated disc, edge lights, a painted ring. */
export function landingPad(world, x, z, r, colour = 0xffb04a) {
  world.cylinder(x, 0.12, z, r, r + 0.4, 0.24, 'grate', { seg: 36, mat: { repeat: 6, color: 0x8a8e96 }, tag: 'pad' });
  world.shape(new THREE.TorusGeometry(r * 0.72, 0.18, 4, 40).rotateX(Math.PI / 2), 'plaster', {
    pos: [x, 0.26, z], scale: [1, 1, 0.2], collide: false, shadow: false, mat: { color: colour, emissive: colour, emissiveIntensity: 0.25 }
  });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    world.box(x + Math.cos(a) * (r - 0.4), 0.3, z + Math.sin(a) * (r - 0.4), 0.3, 0.12, 0.3, 'plaster', {
      uv: 1, collide: false, mat: { color: colour, emissive: colour, emissiveIntensity: 2 }
    });
  }
  world.light(colour, 4, x, 2, z, r * 1.6);
}

/** A launch vehicle on its pad. Returns the group (games can spin/lift it). */
export function rocket(world, x, z, scale = 1, stripe = 0xc8102e) {
  const ship = new THREE.Group();
  const hullMat = material('hull', { repeat: 2, metalness: 0.75, roughness: 0.35 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.3, 20, 28), hullMat);
  body.position.y = 10; body.castShadow = true;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.8, 7, 28), hullMat);
  nose.position.y = 23.5;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.9, 2, 28), hullMat);
  skirt.position.y = 1;
  ship.add(body, nose, skirt);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 3.4), hullMat);
    fin.position.set(Math.cos(a) * 3.5, 3, Math.sin(a) * 3.5);
    fin.rotation.y = -a; fin.castShadow = true;
    ship.add(fin);
  }
  const band = new THREE.Mesh(new THREE.CylinderGeometry(2.83, 2.9, 1.2, 28),
    new THREE.MeshStandardMaterial({ color: stripe, roughness: 0.5, metalness: 0.3 }));
  band.position.y = 6;
  const windows = new THREE.Mesh(new THREE.TorusGeometry(2.82, 0.16, 8, 28),
    new THREE.MeshStandardMaterial({ color: 0x6ae0ff, emissive: 0x2a9ac0, emissiveIntensity: 2 }));
  windows.rotation.x = Math.PI / 2; windows.position.y = 17;
  ship.add(band, windows);
  ship.scale.setScalar(scale);
  ship.position.set(x, 0.5, z);
  world.add(ship);
  world.collider(x, 10 * scale, z, 7 * scale, 20 * scale, 7 * scale, 0, 'ship');
  return ship;
}

/** Glowing ceiling strip with a real (pooled) light under it. */
export function lightStrip(world, x, y, z, len, alongX, colour = 0xdff0ff, intensity = 4) {
  world.box(x, y, z, alongX ? len : 0.3, 0.06, alongX ? 0.3 : len, 'plaster', {
    uv: 1, collide: false, mat: { color: colour, emissive: colour, emissiveIntensity: 1.6 }
  });
  world.light(colour, intensity, x, y - 0.4, z, Math.max(9, len * 1.4));
}

/** An indoor hall: deck floor, panel walls with doors, ceiling, strip lights. */
export function hall(world, x, z, w, d, h, opts = {}) {
  world.box(x, 0.1, z, w, 0.2, d, 'grate', { uv: 0.5, mat: { color: opts.floor || 0x9aa0a8 } });
  roomWalls(world, x, z, w, d, h, 'panel', { doors: opts.doors, mat: { uv: 0.4, mat: { color: opts.wall || 0xc4c8d0 } } });
  if (opts.ceiling !== false) world.box(x, h + 0.2, z, w + 0.6, 0.4, d + 0.6, 'panel', { uv: 0.3, mat: { color: 0x9a9ea6 } });
  // a skirting of hazard paint and conduits along the long walls
  const alongX = w > d;
  for (const sgn of [-1, 1]) {
    const px = alongX ? x : x + sgn * (w / 2 - 0.25), pz = alongX ? z + sgn * (d / 2 - 0.25) : z;
    world.box(px, h - 0.5, pz, alongX ? w - 0.6 : 0.16, 0.16, alongX ? 0.16 : d - 0.6, 'rust', { uv: 1, collide: false, mat: { color: 0x5a6068, metalness: 0.6 } });
  }
  if (opts.lights !== false) {
    const len = Math.max(w, d), n = Math.max(1, Math.round(len / 9));
    for (let i = 0; i < n; i++) {
      const t = -len / 2 + (i + 0.5) * (len / n);
      lightStrip(world, alongX ? x + t : x, h - 0.05, alongX ? z : z + t, 3, alongX, opts.light || 0xdff0ff, opts.lightPower || 4);
    }
  }
}

/** Pipes running along a wall or ceiling. */
export function pipes(world, x0, y, z0, x1, z1, rng, colour = 0x8a6a4a, n = 3) {
  const len = Math.hypot(x1 - x0, z1 - z0), rot = Math.atan2(x1 - x0, z1 - z0);
  for (let i = 0; i < n; i++) {
    const r = rng.range(0.06, 0.16), off = (i - (n - 1) / 2) * 0.38;
    world.shape(new THREE.CylinderGeometry(r, r, len, 8), 'rust', {
      pos: [(x0 + x1) / 2 + Math.cos(rot) * off, y + i * 0.05, (z0 + z1) / 2 - Math.sin(rot) * off], rot: [Math.PI / 2, rot, 0],
      collide: false, mat: { color: colour, metalness: 0.6 }
    });
  }
}

/** Hydroponic trough with plants and a purple grow lamp above it. */
export function planter(world, x, z, len, alongX, rng, lit = true) {
  world.box(x, 0.45, z, alongX ? len : 1.4, 0.9, alongX ? 1.4 : len, 'hull', { uv: 0.5, mat: { color: 0xd8dcd8, repeat: 1 }, tag: 'planter' });
  world.box(x, 0.92, z, alongX ? len - 0.2 : 1.2, 0.06, alongX ? 1.2 : len - 0.2, 'dirt', { uv: 1, collide: false });
  const n = Math.floor(len / 0.7);
  for (let i = 0; i < n; i++) {
    const t = -len / 2 + 0.35 + i * 0.7;
    if (rng.chance(0.15)) continue;           // torn out
    const dead = rng.chance(0.25);
    const r = rng.range(0.22, 0.42);
    world.shape(new THREE.SphereGeometry(r, 8, 6), 'foliage', {
      pos: [x + (alongX ? t : rng.range(-0.3, 0.3)), 0.95 + r * 0.6, z + (alongX ? rng.range(-0.3, 0.3) : t)],
      scale: [1, rng.range(0.9, 1.6), 1], uv: 2, collide: false,
      mat: { color: dead ? 0x6a5a30 : 0x6ac050, emissive: dead ? 0x000000 : 0x0a2a08 }
    });
  }
  if (lit) {
    world.box(x, 3.1, z, alongX ? len : 0.25, 0.08, alongX ? 0.25 : len, 'plaster', { uv: 1, collide: false, mat: { color: 0xe08aff, emissive: 0xc040ff, emissiveIntensity: 1.8 } });
    world.light(0xc860ff, 4, x, 2.8, z, Math.max(8, len));
  }
}

/** A mining drill tower over a bore hole. */
export function drillRig(world, x, z, h, rng, colour = 0xd8a830) {
  const m = { color: colour, metalness: 0.5, roughness: 0.6 };
  for (const [ox, oz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
    world.shape(new THREE.CylinderGeometry(0.16, 0.22, h, 6), 'rust', { pos: [x + ox * 0.6, h / 2, z + oz * 0.6], rot: [oz * 0.06, 0, -ox * 0.06], collide: false, mat: m });
  }
  for (let y = 2; y < h; y += 3) world.box(x, y, z, 3.4 - y / h * 1.6, 0.18, 3.4 - y / h * 1.6, 'rust', { uv: 1, collide: false, mat: m });
  world.box(x, h, z, 2.2, 1.2, 2.2, 'rust', { uv: 0.8, collide: false, mat: { color: 0x5a5e66, metalness: 0.6 } });
  world.shape(new THREE.CylinderGeometry(0.3, 0.3, h * 0.8, 8), 'rust', { pos: [x, h * 0.45, z], collide: false, mat: { color: 0x9aa0a8, metalness: 0.8, roughness: 0.3 } });
  world.shape(new THREE.ConeGeometry(0.6, 1.4, 8), 'rust', { pos: [x, 0.4, z], rot: [Math.PI, 0, 0], collide: false, mat: { color: 0x9aa0a8, metalness: 0.8 } });
  world.shape(new THREE.CylinderGeometry(2.6, 3, 0.4, 16), 'rust', { pos: [x, 0.2, z], collide: false, mat: { color: 0x3a3a3e } });
  world.collider(x, h / 2, z, 3.6, h, 3.6, 0, 'rig');
  world.light(0xffb040, 5, x, h + 1, z, 20);
}

/** Ore cart on a short run of rail. */
export function oreCart(world, x, z, rotY, rng, mat = 'redrock') {
  world.box(x, 0.9, z, 1.4, 1, 2.2, 'rust', { rotY, uv: 1, mat: { color: 0x6a5a4a, metalness: 0.5 }, tag: 'cart' });
  for (let i = 0; i < 4; i++) rock(world, x + rng.range(-0.4, 0.4), z + rng.range(-0.6, 0.6), rng.range(0.25, 0.4), rng, mat, { collide: false, y: 1.2, uv: 1 });
  for (const s of [-0.55, 0.55]) world.box(x + Math.cos(rotY) * s, 0.06, z - Math.sin(rotY) * s, 0.1, 0.12, 6, 'rust', { rotY, uv: 1, collide: false, mat: { color: 0x5a5a5e, metalness: 0.8 } });
}

/** Big glowing wall screen for command rooms. */
export function screen(world, x, y, z, w, h, rotY, colour = 0x3ac8ff) {
  world.box(x, y, z, w + 0.3, h + 0.3, 0.2, 'rust', { rotY, uv: 1, collide: false, mat: { color: 0x1a1e24, metalness: 0.6 } });
  world.quad(x + Math.sin(rotY) * 0.12, y, z + Math.cos(rotY) * 0.12, w, h, rotY, 'screen-' + colour,
    () => new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.85 }));
  world.light(colour, 3, x + Math.sin(rotY) * 1.5, y, z + Math.cos(rotY) * 1.5, 10);
}

/** A crashed hull section lying on its side. */
export function hullChunk(world, x, z, len, r, rotY, rng, roll = 0.3) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const skin = { repeat: 2, metalness: 0.7, roughness: 0.45, color: 0xc8ccd2 };
  material('hull', skin).side = THREE.DoubleSide;      // you can see inside the torn shell
  world.shape(new THREE.CylinderGeometry(r, r * 0.9, len, 22, 1, true, 0, TAU * 0.78), 'hull', {
    pos: [x, r * 0.8, z], rot: [roll, rotY, Math.PI / 2], uv: 0.5, mat: skin
  });
  for (let i = 0; i < 4; i++) {
    const t = -len / 2 + (i + 0.5) * len / 4;
    world.shape(new THREE.TorusGeometry(r + 0.05, 0.12, 5, 24, TAU * 0.78), 'rust', {
      pos: [x + c * t, r * 0.8, z - s * t], rot: [roll, rotY + Math.PI / 2, 0], collide: false, mat: { color: 0x5a5e66, metalness: 0.6 }
    });
  }
  world.collider(x, r * 0.8, z, Math.abs(c) * len + Math.abs(s) * r * 2, r * 1.6, Math.abs(s) * len + Math.abs(c) * r * 2, 0, 'wreck');
}

/* --------------------------------------------------------------- skies */
let earthTex = null;
function earthTexture() {
  if (earthTex) return earthTex;
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const ctx = cv.getContext('2d');
  for (let y = 0; y < 256; y += 2) for (let x = 0; x < 512; x += 2) {
    const land = fbm(x / 70, y / 50, 5, 909);
    const lat = Math.abs(y - 128) / 128;
    let col;
    if (lat > 0.84) col = [236, 240, 246];
    else if (land > 0.56) col = land > 0.66 ? [150, 128, 90] : [70, 120, 60];
    else col = [20 + land * 30, 60 + land * 60, 140 + land * 70];
    const cloud = fbm(x / 30 + 7, y / 18, 4, 77);
    if (cloud > 0.55) { const k = Math.min(1, (cloud - 0.55) * 4); col = col.map(v => v + (245 - v) * k); }
    ctx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
    ctx.fillRect(x, y, 2, 2);
  }
  earthTex = new THREE.CanvasTexture(cv);
  earthTex.colorSpace = THREE.SRGBColorSpace;
  return earthTex;
}

/**
 * Something big in the sky (Earth from the Moon, Phobos from Mars). It rides
 * with the camera through script.follow, so it never parallaxes.
 */
export function skyBody(world, kind, dir, dist, radius) {
  const g = new THREE.Group();
  let mat;
  if (kind === 'earth') {
    mat = new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 0.8, emissive: 0x0a1a3a, emissiveIntensity: 0.4, fog: false });
  } else {
    mat = material('regolith', { repeat: 1, color: kind === 'phobos' ? 0x8a6a5a : 0xb0b0b4, fog: false });
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 24), mat);
  ball.rotation.set(0.4, 2.2, 0.1);
  g.add(ball);
  if (kind === 'earth') {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color: 0x5aa0ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    halo.scale.setScalar(radius * 2.9);
    g.add(halo);
  }
  const offset = new THREE.Vector3(...dir).normalize().multiplyScalar(dist);
  g.position.copy(offset);
  g.renderOrder = -0.5;
  world.scene.add(g);
  world.meshes.push(ball);
  return { obj: g, offset };
}

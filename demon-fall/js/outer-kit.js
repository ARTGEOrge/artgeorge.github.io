/* Demon Fall — set pieces for the outer campaign: Venus, Jupiter, Neptune.
 *
 * Same rules as space-kit.js: scenery merges into the level's material batches,
 * collision is a handful of boxes, every random choice comes from the level's
 * seeded stream. The new thing here is the floating deck: stations hung over a
 * sea of cloud, walked at y = 0 like any floor, fenced by rails whose colliders
 * stop feet but let bullets and sightlines through (`pass`). */
import * as THREE from 'three';
import { ground } from './world.js';
import { pipes, rock, scree } from './space-kit.js';
import { puffTexture } from './textures.js';
import { TAU, fbm, makeRng } from './util.js';

/* ----------------------------------------------------------- difficulty
 * Stage n of the outer campaign (1 = Venus 19 … 18 = Neptune 36) carries on
 * from where the Moon finale (spaceDiff(12)) left off and keeps climbing, a
 * little more gently. Earth, Mars and the Moon keep their own numbers. */
export function outerDiff(n) {
  const s = n / 18;
  return {
    hp: +(1.45 + 0.55 * s).toFixed(2),          // 1.48 … 2.00
    speed: +(1.1 + 0.08 * s).toFixed(2),        // 1.10 … 1.18
    damage: +(1.3 + 0.25 * s).toFixed(2),       // 1.31 … 1.55
    fire: +(1.3 + 0.2 * s).toFixed(2),          // 1.31 … 1.50
    maxAlive: Math.round(22 + 4 * s),            // 22 … 26
    waveEvery: +(3.8 - 0.6 * s).toFixed(1),     // 3.8 … 3.2 s
    waveSize: 4 + Math.round(1 * s),             // 4 … 5
    drop: +(0.1 + 0.03 * s).toFixed(3)           // ammo drops during holds/bosses: tougher bodies, more help
  };
}
export const outerMods = n => { const d = outerDiff(n); return { hp: d.hp, speed: d.speed, damage: d.damage, fire: d.fire, drop: d.drop }; };

/* ------------------------------------------------------- planet textures */
const PLANET_TEX = new Map();
/** A painted equirectangular planet: 'venus' swirls, 'jupiter' bands + Red Spot, 'neptune' blue with a dark spot. */
export function planetTexture(kind) {
  if (PLANET_TEX.has(kind)) return PLANET_TEX.get(kind);
  const W = 512, H = 256;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const rng = makeRng(kind.length * 131 + 5);
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    const lat = (y / H) * 2 - 1;
    let r, g, b;
    if (kind === 'venus') {
      const n = fbm(x / 60 + lat * 3, y / 26, 5, 301), sw = Math.sin(lat * 7 + n * 6 + x / 90);
      const v = 0.75 + n * 0.25 + sw * 0.06;
      r = 236 * v; g = 206 * v; b = 132 * v;
    } else if (kind === 'jupiter') {
      const t = fbm(x / 80, y / 6, 4, 311) * 1.6;
      const band = Math.sin(lat * 22 + t * 2.2);
      const k = band * 0.5 + 0.5;
      r = 196 + k * 50 - Math.abs(lat) * 40; g = 150 + k * 60 - Math.abs(lat) * 30; b = 104 + k * 70 - Math.abs(lat) * 10;
      const swirl = fbm(x / 20, y / 10, 3, 312);
      r += (swirl - 0.5) * 30; g += (swirl - 0.5) * 24;
    } else {
      const n = fbm(x / 70, y / 10, 4, 321), band = Math.sin(lat * 9 + n * 3) * 0.5 + 0.5;
      r = 40 + band * 30 + n * 20; g = 90 + band * 40 + n * 30; b = 190 + band * 40 + n * 20;
      if (fbm(x / 14, y / 4, 3, 322) > 0.72 && Math.abs(lat) < 0.6) { r += 90; g += 90; b += 50; }   // high white streaks
    }
    ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, r)) | 0},${Math.max(0, Math.min(255, g)) | 0},${Math.max(0, Math.min(255, b)) | 0})`;
    ctx.fillRect(x, y, 2, 2);
  }
  if (kind === 'jupiter') {   // the Great Red Spot
    const g = ctx.createRadialGradient(330, 168, 4, 330, 168, 34);
    g.addColorStop(0, 'rgba(190,80,50,0.95)'); g.addColorStop(0.6, 'rgba(200,110,70,0.7)'); g.addColorStop(1, 'rgba(200,120,80,0)');
    ctx.save(); ctx.translate(330, 168); ctx.scale(1.8, 1); ctx.translate(-330, -168);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(330, 168, 34, 0, TAU); ctx.fill(); ctx.restore();
  }
  if (kind === 'neptune') {   // the Great Dark Spot
    ctx.fillStyle = 'rgba(10,30,90,0.7)';
    ctx.beginPath(); ctx.ellipse(180, 150, 30, 14, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(230,240,255,0.6)';
    ctx.beginPath(); ctx.ellipse(196, 138, 16, 4, 0.2, 0, TAU); ctx.fill();
  }
  void rng;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  PLANET_TEX.set(kind, t);
  return t;
}

/** A planet or moon pinned to the sky (rides with the camera through script.follow). */
export function skyPlanet(world, kind, dir, dist, radius, opts = {}) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    map: kind === 'rock' ? null : planetTexture(kind), color: opts.colour || 0xffffff, roughness: 0.9,
    emissive: opts.emissive || 0x000000, emissiveIntensity: opts.glow || 0.25, fog: false
  });
  if (opts.emissive && kind !== 'rock') mat.emissiveMap = planetTexture(kind);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 28), mat);
  ball.rotation.set(opts.tilt || 0.2, 1.4, 0.05);
  g.add(ball);
  if (opts.halo) {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color: opts.halo, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    halo.scale.setScalar(radius * 2.8);
    g.add(halo);
  }
  if (opts.ring) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 1.5, radius * 2.1, 64),
      new THREE.MeshBasicMaterial({ color: opts.ring, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    ring.rotation.set(Math.PI / 2 - 0.25, 0, 0.3);
    g.add(ring);
  }
  const offset = new THREE.Vector3(...dir).normalize().multiplyScalar(dist);
  g.position.copy(offset);
  g.renderOrder = -0.5;
  world.scene.add(g);
  world.meshes.push(ball);
  return { obj: g, offset };
}

/* ----------------------------------------------------------- the decks */
/** The floor still exists everywhere at y = 0 (enemies and dressing need it); over the clouds it is hidden. */
export function voidGround(world, size) {
  const m = ground(world, size, 'grate', { uv: 0.3 });
  m.visible = false;
  // dressing skips this floor: only the decks (which sit a hair above it) get litter
  world.colliders.find(c => c.tag === 'ground').void = true;
  return m;
}

/** The walkable top of a deck or bridge: a hair above the hidden floor so it wins the floor test. */
function deckTop(world, x, z, w, d) {
  world.collider(x, -0.3495, z, w, 0.701, d, 0, 'deck');
}

/** A sea of cloud far below the decks, banded and tinted per planet. */
export function cloudSea(world, colour, y = -46, opts = {}) {
  const geo = new THREE.PlaneGeometry(1700, 1700, 1, 1).rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 9, uv.getY(i) * 9);
  world.shape(geo, 'cloud', { pos: [0, y, 0], collide: false, shadow: false, uv: 1, mat: { color: colour, emissive: opts.glow || 0x000000, emissiveIntensity: 0.35, roughness: 1, repeat: 1 } });
  // a second, thinner layer drifting closer underneath, so the drop has depth
  const g2 = new THREE.PlaneGeometry(900, 900, 1, 1).rotateX(-Math.PI / 2);
  world.shape(g2, 'cloud', { pos: [60, y + 18, -40], collide: false, shadow: false, uv: 4, mat: { color: opts.upper || colour, roughness: 1, repeat: 1, emissive: opts.glow || 0x000000, emissiveIntensity: 0.2 } });
}

/** Billowing storm towers on the horizon: sprites, very cheap. */
export function stormTowers(world, count, rng, colour, opts = {}) {
  const g = new THREE.Group();
  const mat = new THREE.SpriteMaterial({ map: puffTexture(), color: colour, transparent: true, opacity: opts.opacity || 0.8, depthWrite: false, fog: false });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + rng.range(-0.2, 0.2), d = rng.range(420, 620);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    for (let k = 0; k < 6; k++) {
      const s = rng.range(90, 150) * (1 - k * 0.08);
      const p = new THREE.Sprite(mat);
      p.position.set(x + rng.range(-30, 30), (opts.base || -30) + k * s * 0.42, z + rng.range(-30, 30));
      p.scale.set(s * 1.4, s, 1);
      g.add(p);
    }
  }
  g.renderOrder = -1;
  world.add(g);
  return g;
}

const RAIL_MAT = { uv: 1, collide: false, mat: { color: 0x8a8e96, metalness: 0.6, roughness: 0.5 } };

/**
 * Railing along one straight run with gaps (gaps: list of [centre, width] along the run).
 * The collider is taller than the rail you see (you cannot jump it) and `pass`, so bullets fly over.
 */
export function railRun(world, x0, z0, x1, z1, gaps = [], opts = {}) {
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
  const fixed = alongX ? z0 : x0;
  const cuts = gaps.map(([c, w]) => [c - w / 2, c + w / 2]).sort((p, q) => p[0] - q[0]);
  const runs = [];
  let at = a0;
  for (const [lo, hi] of cuts) { if (lo > at + 0.05) runs.push([at, Math.min(lo, a1)]); at = Math.max(at, hi); }
  if (a1 > at + 0.05) runs.push([at, a1]);
  const m = opts.mat ? { ...RAIL_MAT, mat: opts.mat } : RAIL_MAT;
  const h = opts.h || 1.15;
  for (const [lo, hi] of runs) {
    const len = hi - lo, c = (lo + hi) / 2;
    const px = alongX ? c : fixed, pz = alongX ? fixed : c;
    world.box(px, h, pz, alongX ? len : 0.08, 0.08, alongX ? 0.08 : len, 'rust', m);
    world.box(px, h * 0.55, pz, alongX ? len : 0.05, 0.05, alongX ? 0.05 : len, 'rust', m);
    world.box(px, 0.08, pz, alongX ? len : 0.14, 0.16, alongX ? 0.14 : len, 'rust', m);   // kick plate
    for (let t = lo; t <= hi + 0.01; t += 2.5) world.box(alongX ? t : fixed, h / 2, alongX ? fixed : t, 0.07, h, 0.07, 'rust', m);
    world.collider(px, 1.15, pz, alongX ? len : 0.3, 2.3, alongX ? 0.3 : len, 0, 'rail');
    world.colliders[world.colliders.length - 1].pass = true;
  }
}

/**
 * A floating deck: a plated slab whose top sits at y = 0, trusses under it,
 * railings round the edge with openings ({ north: [[offset, width]], … } like
 * roomWalls doors but a list per side). Pass solidRim to wall a side instead.
 */
export function deck(world, x, z, w, d, opts = {}) {
  const gaps = opts.gaps || {};
  const mat = opts.mat || 'grate';
  world.box(x, -0.35, z, w, 0.7, d, mat, { uv: opts.uv || 0.4, collide: false, mat: { color: opts.colour || 0x8a8e96, ...(opts.matOpts || {}) } });
  deckTop(world, x, z, w, d);
  // edge trim and the underside: a box girder, cross trusses and a hanging pod
  world.box(x, -0.9, z, w * 0.82, 0.5, d * 0.82, 'rust', { uv: 0.4, collide: false, mat: { color: 0x4a4e56, metalness: 0.6 } });
  const n = Math.max(1, Math.round(Math.max(w, d) / 10));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    if (w > d) world.box(x + t * w, -1.6, z, 0.5, 1.6, d * 0.7, 'rust', { uv: 0.6, collide: false, mat: { color: 0x3a3e46, metalness: 0.6 } });
    else world.box(x, -1.6, z + t * d, w * 0.7, 1.6, 0.5, 'rust', { uv: 0.6, collide: false, mat: { color: 0x3a3e46, metalness: 0.6 } });
  }
  if (opts.pod !== false && w > 14 && d > 14) {
    world.shape(new THREE.CylinderGeometry(Math.min(w, d) * 0.18, 0.6, Math.min(w, d) * 0.5, 10), 'hull', {
      pos: [x, -2.4 - Math.min(w, d) * 0.25, z], collide: false, mat: { repeat: 1, color: 0x6a6e76, metalness: 0.6 }
    });
    world.light(opts.underLight || 0xff8a3c, 3, x, -4, z, 18);
  }
  if (opts.rails === false) return;
  const hw = w / 2 - 0.15, hd = d / 2 - 0.15;
  const off = list => (list || []).map(([o, wd]) => [o, wd]);
  railRun(world, x - hw, z - hd, x + hw, z - hd, off(gaps.north).map(([o, wd]) => [x + o, wd]), opts);
  railRun(world, x - hw, z + hd, x + hw, z + hd, off(gaps.south).map(([o, wd]) => [x + o, wd]), opts);
  railRun(world, x - hw, z - hd, x - hw, z + hd, off(gaps.west).map(([o, wd]) => [z + o, wd]), opts);
  railRun(world, x + hw, z - hd, x + hw, z + hd, off(gaps.east).map(([o, wd]) => [z + o, wd]), opts);
}

/** A railed bridge between two decks, along x or z. Leave a matching gap in each deck's rail. */
export function bridge(world, x0, z0, x1, z1, width = 4, opts = {}) {
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  world.box(cx, -0.2, cz, alongX ? len : width, 0.4, alongX ? width : len, 'grate', { uv: 0.5, collide: false, mat: { color: opts.colour || 0x7a7e86 } });
  deckTop(world, cx, cz, alongX ? len : width, alongX ? width : len);
  world.box(cx, -0.7, cz, alongX ? len : 0.6, 0.6, alongX ? 0.6 : len, 'rust', { uv: 0.5, collide: false, mat: { color: 0x3a3e46, metalness: 0.6 } });
  const hw = width / 2 - 0.1;
  if (alongX) {
    railRun(world, Math.min(x0, x1), cz - hw, Math.max(x0, x1), cz - hw, [], opts);
    railRun(world, Math.min(x0, x1), cz + hw, Math.max(x0, x1), cz + hw, [], opts);
  } else {
    railRun(world, cx - hw, Math.min(z0, z1), cx - hw, Math.max(z0, z1), [], opts);
    railRun(world, cx + hw, Math.min(z0, z1), cx + hw, Math.max(z0, z1), [], opts);
  }
  for (let t = 0; t <= len; t += 8) {
    const px = alongX ? Math.min(x0, x1) + t : cx, pz = alongX ? cz : Math.min(z0, z1) + t;
    world.light(opts.light || 0xffb060, 2.4, px, 1.4, pz, 9);
    world.box(px + (alongX ? 0 : hw), 1.25, pz + (alongX ? hw : 0), 0.18, 0.12, 0.18, 'plaster', { uv: 1, collide: false, mat: { color: opts.light || 0xffb060, emissive: opts.light || 0xffb060, emissiveIntensity: 2 } });
  }
}

/** A gas envelope (balloon) riding over a cloud-city deck, with cables down to it. */
export function envelope(world, x, y, z, len, r, rotY = 0, colour = 0xe8d8b0) {
  world.shape(new THREE.SphereGeometry(1, 24, 14), 'panel', { pos: [x, y, z], rot: [0, rotY, 0], scale: [r, r * 0.8, len / 2], uv: 2, collide: false, mat: { color: colour } });
  for (let i = -2; i <= 2; i++) {
    world.shape(new THREE.TorusGeometry(1, 0.012, 4, 30), 'rust', {
      pos: [x + Math.sin(rotY) * i * len * 0.18, y, z + Math.cos(rotY) * i * len * 0.18], rot: [0, rotY, 0],
      scale: [r * Math.sqrt(1 - (i * 0.36) ** 2), r * 0.8 * Math.sqrt(1 - (i * 0.36) ** 2), 1], collide: false, mat: { color: 0x6a6e76 }
    });
  }
  for (const s of [-1, 1]) for (const k of [-1, 1]) {
    const cx = x + Math.cos(rotY) * s * r * 0.5 + Math.sin(rotY) * k * len * 0.3, cz = z - Math.sin(rotY) * s * r * 0.5 + Math.cos(rotY) * k * len * 0.3;
    world.shape(new THREE.CylinderGeometry(0.04, 0.04, y - r * 0.6, 4), 'rust', { pos: [cx, (y - r * 0.6) / 2, cz], collide: false, shadow: false });
  }
}

/** A glowing pool of acid. Visual here; list it in script.hazards to make it burn. */
export function acidPool(world, x, z, r, rng, colour = 0xb8f02a) {
  world.shape(new THREE.CircleGeometry(r, 24).rotateX(-Math.PI / 2), 'plaster', {
    pos: [x, 0.03, z], scale: [1, 1, rng.range(0.7, 1)], collide: false, shadow: false,
    mat: { color: 0x3a4a08, emissive: colour, emissiveIntensity: 0.9, roughness: 0.1 }
  });
  world.shape(new THREE.TorusGeometry(r, 0.12, 5, 24).rotateX(Math.PI / 2), 'sulfur', { pos: [x, 0.04, z], scale: [1, 1, 0.4], collide: false, uv: 0.5, mat: { color: 0xd8c860 } });
  world.light(colour, 3.5, x, 1, z, r * 3 + 6);
  return { x, z, r };
}

/** A cluster of ice crystals growing out of the deck. Big ones block. */
export function iceSpire(world, x, z, h, rng, opts = {}) {
  const mat = { color: opts.colour || 0xbfe4f8, emissive: 0x1a4a7a, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.2 };
  const n = rng.int(3, 6);
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU, d = i ? rng.range(0.4, h * 0.25) : 0, hh = h * (i ? rng.range(0.35, 0.7) : 1);
    world.shape(new THREE.ConeGeometry(hh * 0.16, hh, 5), 'ice', {
      pos: [x + Math.cos(a) * d, hh * 0.45, z + Math.sin(a) * d], rot: [rng.range(-0.25, 0.25), rng() * TAU, rng.range(-0.25, 0.25)],
      collide: false, uv: 0.5, mat
    });
  }
  if (h > 3 && opts.collide !== false) world.collider(x, h * 0.4, z, h * 0.3, h * 0.8, h * 0.3, 0, 'ice');
}

/** Lightning rod / storm mast with a blue tip. */
export function stormMast(world, x, z, h, colour = 0x8ae0ff) {
  world.shape(new THREE.CylinderGeometry(0.14, 0.35, h, 8), 'rust', { pos: [x, h / 2, z], collide: true, tag: 'mast', mat: { color: 0x7a7e86, metalness: 0.7 } });
  for (let y = 3; y < h - 1; y += 3) world.shape(new THREE.TorusGeometry(0.5, 0.06, 5, 16), 'rust', { pos: [x, y, z], rot: [Math.PI / 2, 0, 0], collide: false, mat: { color: 0x5a5e66, metalness: 0.7 } });
  world.shape(new THREE.SphereGeometry(0.4, 10, 8), 'plaster', { pos: [x, h + 0.2, z], collide: false, shadow: false, mat: { color: colour, emissive: colour, emissiveIntensity: 2.4 } });
  world.light(colour, 4, x, h, z, 16);
}

/** A gas tank sphere on legs (refineries). */
export function tankSphere(world, x, z, r, colour = 0xd8d4cc) {
  world.shape(new THREE.SphereGeometry(r, 20, 14), 'hull', { pos: [x, r + 1.2, z], collide: false, uv: 1, mat: { repeat: 2, color: colour, metalness: 0.5 } });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    world.shape(new THREE.CylinderGeometry(0.16, 0.2, r + 1.2, 6), 'rust', { pos: [x + Math.cos(a) * r * 0.7, (r + 1.2) / 2, z + Math.sin(a) * r * 0.7], collide: false, mat: { color: 0x5a5e66, metalness: 0.6 } });
  }
  world.shape(new THREE.TorusGeometry(r * 1.01, 0.08, 5, 28), 'plaster', { pos: [x, r + 1.2, z], rot: [Math.PI / 2, 0, 0], collide: false, mat: { color: 0xffb040, emissive: 0xff8a20, emissiveIntensity: 1.2 } });
  world.collider(x, (r * 2 + 1.2) / 2, z, r * 1.7, r * 2 + 1.2, r * 1.7, 0, 'tank');
}

/** A drifting, slowly turning thing the game spins (radar dish, turbine rotor). Returns a spin entry. */
export function spinner(world, x, y, z, geo, matOpts, speed = 0.4) {
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.6, roughness: 0.4, ...matOpts }));
  m.position.set(x, y, z);
  m.castShadow = true;
  world.add(m);
  return { obj: m, speed };
}

/**
 * A walled, roofed corridor between two points on one axis, w wide: side walls,
 * ceiling, a floor runner, strip lights (some dead) and a run of pipes.
 * Leave doorways in the rooms at either end that match its width.
 */
export function corridor(world, x0, z0, x1, z1, h, rng, opts = {}) {
  const w = opts.w || 5, alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const wall = { uv: 0.4, mat: { color: opts.wall || 0xbcc0ca } };
  for (const s of [-1, 1]) {
    if (alongX) world.box(cx, h / 2, cz + s * (w / 2 + 0.2), len, h, 0.4, 'panel', wall);
    else world.box(cx + s * (w / 2 + 0.2), h / 2, cz, 0.4, h, len, 'panel', wall);
  }
  world.box(cx, h + 0.2, cz, alongX ? len : w + 0.8, 0.4, alongX ? w + 0.8 : len, 'panel', { uv: 0.3, mat: { color: 0x7a808a } });
  world.box(cx, 0.02, cz, alongX ? len : w, 0.04, alongX ? w : len, 'grate', { uv: 0.5, collide: false, mat: { color: opts.floor || 0x9aa0aa } });
  const col = opts.light || 0xcfe8ff;
  for (let t = 3; t < len; t += 8) {
    const px = alongX ? Math.min(x0, x1) + t : cx, pz = alongX ? cz : Math.min(z0, z1) + t;
    const dead = rng.chance(0.3);
    world.box(px, h - 0.04, pz, alongX ? 3 : 0.4, 0.06, alongX ? 0.4 : 3, 'plaster', { uv: 1, collide: false, mat: dead ? { color: 0x2a2a2e } : { color: col, emissive: col, emissiveIntensity: 1.4 } });
    world.light(dead ? (opts.deadLight || 0xff5030) : col, dead ? 1.3 : 3, px, h - 0.5, pz, 10);
  }
  if (alongX) pipes(world, x0, h - 0.5, cz - w / 2 + 0.4, x1, cz - w / 2 + 0.4, rng, opts.pipe || 0x6a6a7a, 2);
  else pipes(world, cx - w / 2 + 0.4, h - 0.5, z0, cx - w / 2 + 0.4, z1, rng, opts.pipe || 0x6a6a7a, 2);
}

/** Scatter boulders (with a little scree) over a rectangle, keeping a lane clear down x = 0 and off `avoid` circles [x, z, r]. */
export function boulders(world, rng, n, x0, x1, z0, z1, mat, tint, keepOut = 8, avoid = []) {
  for (let i = 0; i < n; i++) {
    const x = rng.range(x0, x1), z = rng.range(z0, z1);
    if (Math.abs(x) < keepOut || avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
    rock(world, x, z, rng.chance(0.25) ? rng.range(1.3, 2.8) : rng.range(0.4, 1), rng, mat, { tint });
    if (rng.chance(0.3)) scree(world, x, z, rng.int(3, 6), 2.5, rng, mat);
  }
}

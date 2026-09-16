/* Demon Fall — set dressing. Everything here is merged into the level's
 * material batches through world.shape()/world.box(), so a street full of trees,
 * fences and wreckage still costs only a handful of draw calls. */
import * as THREE from 'three';
import { splatTexture } from './textures.js';
import { TAU } from './util.js';

const CYL = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
const CONE = (r, h, seg = 8) => new THREE.ConeGeometry(r, h, seg);
const BALL = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);

/** A living (but sickly) tree or a burnt, bare one. */
export function tree(world, x, z, rng, dead = false) {
  const h = rng.range(4.5, 8.5);
  const lean = rng.range(-0.08, 0.08);
  world.shape(CYL(0.16, 0.3, h), 'bark', { pos: [x, h / 2, z], rot: [lean, 0, lean], uv: 2, collide: true, tag: 'tree' });
  if (dead) {
    // bare branches reaching out at odd angles
    const n = rng.int(3, 6);
    for (let i = 0; i < n; i++) {
      const y = h * rng.range(0.45, 0.95), len = rng.range(1.2, 2.6), a = rng() * TAU;
      world.shape(CYL(0.04, 0.09, len, 5), 'bark', {
        pos: [x + Math.cos(a) * len * 0.35, y + len * 0.25, z + Math.sin(a) * len * 0.35],
        rot: [Math.sin(a) * 0.9, -a, Math.cos(a) * 0.9], collide: false, shadow: true
      });
    }
    return;
  }
  const tiers = rng.int(2, 3);
  for (let i = 0; i < tiers; i++) {
    const r = rng.range(1.6, 2.4) * (1 - i * 0.22);
    const y = h * 0.55 + i * 1.3;
    world.shape(BALL(r, 9, 6), 'foliage', {
      pos: [x + rng.range(-0.3, 0.3), y, z + rng.range(-0.3, 0.3)],
      scale: [1, rng.range(0.7, 0.95), 1], uv: 2, collide: false
    });
  }
}

/** Picket/plank fence between two points, posts every 2 m. */
export function fence(world, x1, z1, x2, z2, rng, broken = 0.15) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
  const rot = Math.atan2(dx, dz);
  const posts = Math.max(1, Math.round(len / 2));
  for (let i = 0; i <= posts; i++) {
    const t = i / posts;
    world.box(x1 + dx * t, 0.6, z1 + dz * t, 0.12, 1.2, 0.12, 'wood', { uv: 1, collide: false });
  }
  for (let i = 0; i < posts; i++) {
    if (rng.chance(broken)) continue;
    const t = (i + 0.5) / posts, cx = x1 + dx * t, cz = z1 + dz * t, seg = len / posts;
    for (const y of [0.35, 0.85]) {
      world.shape(new THREE.BoxGeometry(0.05, 0.12, seg), 'wood', {
        pos: [cx, y, cz], rot: [0, rot, rng.range(-0.04, 0.04)], uv: 0.8, collide: false
      });
    }
  }
  // one collider along the whole run (thin, so it's only a knee-high obstacle)
  world.collider((x1 + x2) / 2, 0.5, (z1 + z2) / 2, Math.abs(dx) + 0.15, 1, Math.abs(dz) + 0.15, 0, 'fence');
}

/** Utility poles with sagging wires between them. */
export function powerLine(world, x, zStart, zEnd, spacing = 18, rng) {
  const poles = [];
  for (let z = zStart; z > zEnd; z -= spacing) {
    const tilt = rng.range(-0.05, 0.05);
    world.shape(CYL(0.12, 0.16, 9, 6), 'wood', { pos: [x, 4.5, z], rot: [tilt, 0, tilt * 0.6], uv: 1, collide: true, tag: 'pole' });
    world.box(x, 8.4, z, 2.4, 0.14, 0.16, 'wood', { uv: 1, collide: false });
    poles.push(z);
  }
  // wires: short straight segments approximating a catenary sag
  for (let i = 0; i < poles.length - 1; i++) {
    const z0 = poles[i], z1 = poles[i + 1];
    for (const wx of [-1, 0, 1]) {
      const segs = 6;
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs, t1 = (s + 1) / segs;
        const sag = t => Math.sin(t * Math.PI) * 0.8;
        const y0 = 8.5 - sag(t0), y1 = 8.5 - sag(t1);
        const za = z0 + (z1 - z0) * t0, zb = z0 + (z1 - z0) * t1;
        const len = Math.hypot(zb - za, y1 - y0);
        world.shape(CYL(0.012, 0.012, len, 3), 'rust', {
          pos: [x + wx * 1.0, (y0 + y1) / 2, (za + zb) / 2],
          rot: [Math.PI / 2 + Math.atan2(y1 - y0, zb - za) * -1, 0, 0], collide: false, shadow: false
        });
      }
    }
  }
}

export function dumpster(world, x, z, rotY, rng) {
  world.box(x, 0.75, z, 2, 1.3, 1.2, 'rust', { rotY, uv: 0.8, mat: { color: 0x5a7a52, metalness: 0.4, roughness: 0.6 }, tag: 'dumpster' });
  // lid, knocked half-open
  world.shape(new THREE.BoxGeometry(2, 0.06, 1.2), 'rust', {
    pos: [x, 1.55, z - 0.2], rot: [-0.5, rotY, 0], collide: false, mat: { color: 0x3a4a36, metalness: 0.4, roughness: 0.6 }
  });
  trash(world, x + rng.range(-1.5, 1.5), z + rng.range(1, 2), rng, 4);
}

/** Split bin bags and junk heaped against things. */
export function trash(world, x, z, rng, n = 6) {
  for (let i = 0; i < n; i++) {
    const r = rng.range(0.22, 0.42);
    world.shape(BALL(r, 7, 5), 'rust', {
      pos: [x + rng.range(-0.9, 0.9), r * 0.7, z + rng.range(-0.9, 0.9)],
      scale: [1, rng.range(0.6, 0.9), rng.range(0.8, 1.2)],
      rot: [0, rng() * TAU, 0], collide: false, mat: { color: 0x1a1c1e, roughness: 0.4, metalness: 0.1 }
    });
  }
}

export function crates(world, x, z, rng, count = 3) {
  for (let i = 0; i < count; i++) {
    const s = rng.range(0.8, 1.2);
    const stack = i > 0 && rng.chance(0.4);
    world.box(x + (stack ? 0 : i * 1.2 - 1), s / 2 + (stack ? s : 0), z + rng.range(-0.3, 0.3), s, s, s, 'wood',
      { uv: 1, rotY: rng.range(-0.3, 0.3), collide: true, tag: 'crate' });
  }
}

/** A curved line of sandbags: military cover. */
export function sandbags(world, x, z, radius, arc, rotY, rng) {
  const n = Math.max(3, Math.round(radius * arc / 0.7));
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < n; i++) {
      const a = rotY - arc / 2 + (i + (row % 2) * 0.5) / n * arc;
      const px = x + Math.sin(a) * radius, pz = z + Math.cos(a) * radius;
      world.shape(new THREE.CapsuleGeometry(0.16, 0.36, 3, 6), 'dirt', {
        pos: [px, 0.17 + row * 0.26, pz], rot: [0, a + Math.PI / 2, Math.PI / 2],
        scale: [1, 1, 0.75], uv: 1, collide: false, mat: { color: 0xa89878 }
      });
    }
  }
  world.collider(x + Math.sin(rotY) * radius, 0.45, z + Math.cos(rotY) * radius,
    Math.abs(Math.cos(rotY)) * radius * arc + 0.6, 0.9, Math.abs(Math.sin(rotY)) * radius * arc + 0.6, 0, 'sandbags');
}

export function roadSign(world, x, z, rotY, text, colour = '#e8e2d6') {
  world.shape(CYL(0.05, 0.05, 3, 6), 'rust', { pos: [x, 1.5, z], collide: true, tag: 'sign' });
  world.sign(text, x, 3.1, z, rotY, 2, colour);
}

export function billboard(world, x, z, rotY, text, colour = '#ff7a2f') {
  for (const s of [-1, 1]) {
    world.shape(CYL(0.18, 0.2, 7, 6), 'rust', {
      pos: [x + Math.cos(rotY) * s * 3, 3.5, z - Math.sin(rotY) * s * 3], collide: true, tag: 'billboard'
    });
  }
  world.box(x, 8, z, 8, 3, 0.3, 'rust', { rotY, uv: 0.5, collide: false });
  world.sign(text, x + Math.sin(rotY) * 0.17, 8, z + Math.cos(rotY) * 0.17, rotY, 7.4, colour);
}

export function hydrant(world, x, z) {
  world.shape(CYL(0.13, 0.16, 0.7, 8), 'rust', { pos: [x, 0.35, z], collide: true, tag: 'hydrant', mat: { color: 0xb02a20, metalness: 0.3 } });
  world.shape(BALL(0.14, 8, 5), 'rust', { pos: [x, 0.72, z], collide: false, mat: { color: 0xb02a20, metalness: 0.3 } });
}

export function bench(world, x, z, rotY) {
  world.box(x, 0.45, z, 1.8, 0.08, 0.5, 'wood', { rotY, uv: 1, collide: true, tag: 'bench' });
  world.box(x - Math.sin(rotY) * 0.22, 0.8, z - Math.cos(rotY) * 0.22, 1.8, 0.4, 0.06, 'wood', { rotY, uv: 1, collide: false });
}

export function trafficCones(world, x, z, rng, n = 4) {
  for (let i = 0; i < n; i++) {
    const knocked = rng.chance(0.3);
    world.shape(CONE(0.17, 0.6, 8), 'plaster', {
      pos: [x + rng.range(-2, 2), knocked ? 0.17 : 0.3, z + rng.range(-2, 2)],
      rot: [knocked ? Math.PI / 2 : 0, rng() * TAU, 0], collide: false, mat: { color: 0xff5a1a }
    });
  }
}

/** Blast crater: a scorched dish with a lip of broken ground. */
export function crater(world, x, z, r, rng) {
  world.shape(CYL(r, r * 0.6, 0.06, 18), 'dirt', { pos: [x, 0.02, z], collide: false, mat: { color: 0x2a221c } });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + rng.range(-0.2, 0.2), s = rng.range(0.3, 0.7);
    world.box(x + Math.cos(a) * r, s * 0.3, z + Math.sin(a) * r, s, s * 0.6, s * 1.4, 'asphalt',
      { rotY: a, uv: 1, collide: false });
  }
  scorch(world, x, z, r * 2.4);
}

/** Flat decals on the ground: scorch marks and old blood. */
const decalGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
export function scorch(world, x, z, size) {
  groundDecal(world, x, z, size, splatTexture('#0c0a09', 7), 0.85);
}
export function bloodPool(world, x, z, size, seed = 1) {
  groundDecal(world, x, z, size, splatTexture('#4a060c', seed + 10), 0.8);
}
function groundDecal(world, x, z, size, tex, opacity) {
  const m = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
  }));
  m.position.set(x, 0.03, z);
  m.rotation.y = Math.random() * TAU;
  m.scale.setScalar(size);
  m.renderOrder = 1;
  world.scene.add(m);
  world.meshes.push(m);
}

/** An abandoned emergency tent. */
export function tent(world, x, z, rotY, rng) {
  world.shape(new THREE.ConeGeometry(1.9, 2.2, 4, 1, true), 'plaster', {
    pos: [x, 1.1, z], rot: [0, rotY + Math.PI / 4, rng.range(-0.08, 0.08)],
    scale: [1.3, 1, 1], collide: false, mat: { color: 0x6b7a5a, roughness: 1 }
  });
  world.collider(x, 0.8, z, 2.6, 1.6, 2.6, 0, 'tent');
}

/**
 * The city on the horizon: a ring of dark towers with a few lit windows. No
 * collision, just depth — it's what makes a level feel like part of a world.
 */
export function skyline(world, radius, count, rng, opts = {}) {
  const hMin = opts.hMin || 20, hMax = opts.hMax || 70;
  const lit = () => new THREE.MeshBasicMaterial({ color: opts.windowColour || 0xffb05a, fog: false });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + rng.range(-0.05, 0.05);
    const r = radius + rng.range(0, radius * 0.25);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const w = rng.range(14, 30), d = rng.range(14, 30), h = rng.range(hMin, hMax);
    const broken = rng.chance(0.35);
    // rotY = -a turns the tower's local x axis to point at the level centre
    world.box(x, h / 2, z, w, h, d, 'concrete', {
      rotY: -a, uv: 0.12, collide: false, mat: { color: opts.tint || 0x2a2a30, fog: false }
    });
    if (broken) {   // a jagged, half-collapsed top
      world.box(x + rng.range(-3, 3), h + 2, z + rng.range(-3, 3), w * 0.4, 4, d * 0.5, 'concrete',
        { rotY: -a + 0.3, uv: 0.2, collide: false, mat: { color: opts.tint || 0x2a2a30, fog: false } });
    }
    // scattered lit windows on the side facing the level
    const nx = Math.cos(a), nz = Math.sin(a);
    for (let k = 0; k < 14; k++) {
      if (!rng.chance(0.45)) continue;
      const along = rng.range(-d * 0.4, d * 0.4), y = rng.range(3, h - 2);
      world.quad(
        x - nx * (w / 2 + 0.1) - nz * along, y, z - nz * (w / 2 + 0.1) + nx * along,
        1.4, 1.8, -a - Math.PI / 2, 'skyline-lit', lit
      );
    }
    if (opts.fires && rng.chance(0.2)) world.light(0xff6a2a, 30, x - nx * w, h * 0.6, z - nz * w, 60, 1.2);
  }
}

/** Low rolling hills beyond the edge (suburbs, spaceport). */
export function hills(world, radius, count, rng, matName = 'dirt', tint = 0x3a3028) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + rng.range(-0.1, 0.1);
    const r = radius + rng.range(0, 40);
    const s = rng.range(30, 70);
    world.shape(BALL(1, 12, 8), matName, {
      pos: [Math.cos(a) * r, -s * 0.55, Math.sin(a) * r],
      scale: [s * 1.6, s, s * 1.2], rot: [0, rng() * TAU, 0], uv: 12, collide: false,
      mat: { color: tint, fog: false }
    });
  }
}

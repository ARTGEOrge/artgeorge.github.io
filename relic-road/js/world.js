/* Demon Fall — the world builder.
 *
 * Levels are described as boxes, and this turns them into merged meshes (one
 * draw call per material) plus a flat list of axis-aligned colliders. Keeping
 * collision separate from the visuals means bullets, feet and enemies all test
 * against the same cheap boxes, however detailed the scenery gets. */
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { material, signTexture } from './textures.js';
import { clamp, randRange, TAU, fbm } from './util.js';

/* ------------------------------------------------------------------- sky */
const SKY_VERT = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;   // always at the far plane
  }`;

const SKY_FRAG = `
  varying vec3 vDir;
  uniform vec3 top, horizon, ground, glow;
  uniform vec3 glowDir;
  uniform float time, stars, rift;
  // cheap hash-noise for star field and cloud bands
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                  mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
    return n;
  }
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(horizon, top, pow(h, 0.75));
    col = mix(ground, col, smoothstep(0.42, 0.55, h));
    // light pollution / rift glow toward one direction
    float g = pow(max(0.0, dot(d, normalize(glowDir))), 8.0);
    col += glow * g;
    if (stars > 0.0) {
      vec3 sp = d * 520.0;
      vec3 cell = floor(sp);
      float s = pow(hash(cell), 340.0);
      // fade each star toward its cell edges so they read as points, not tiles
      vec3 f = fract(sp) - 0.5;
      s *= smoothstep(0.5, 0.05, length(f)) * 1.6;
      col += vec3(s) * stars * smoothstep(0.02, 0.35, d.y);
    }
    // slow torn cloud bands
    float c = noise(d * 3.0 + vec3(time * 0.01, 0.0, time * 0.006));
    c = smoothstep(0.52, 0.85, c) * smoothstep(0.0, 0.35, d.y);
    col = mix(col, col * 0.55 + vec3(0.06, 0.03, 0.03), c * 0.7);
    // the rift: a bruised tear near the horizon
    if (rift > 0.0) {
      vec3 rd = normalize(vec3(0.3, 0.42, -1.0));
      float c0 = dot(d, rd);
      float r = pow(max(0.0, c0), 60.0);
      float flick = 0.8 + 0.2 * sin(time * 2.3) * sin(time * 0.7 + 1.3);
      col += vec3(0.7, 0.1, 0.16) * r * rift * flick;
      // a ragged tear: the ring is broken up by noise so it reads as damage in the sky
      float tear = noise(d * 38.0 + vec3(time * 0.05)) * 0.8 + 0.2;
      float ring = smoothstep(0.9955, 0.998, c0) * (1.0 - smoothstep(0.998, 0.9993, c0));
      col += vec3(1.0, 0.5, 0.25) * ring * tear * rift * 0.9;
    }
    gl_FragColor = vec4(col, 1.0);
  }`;

export function makeSky(theme) {
  const geo = new THREE.SphereGeometry(1, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(theme.skyTop) },
      horizon: { value: new THREE.Color(theme.skyHorizon) },
      ground: { value: new THREE.Color(theme.skyGround) },
      glow: { value: new THREE.Color(theme.skyGlow || 0x000000) },
      glowDir: { value: new THREE.Vector3(...(theme.glowDir || [0.4, 0.2, -1])) },
      time: { value: 0 }, stars: { value: theme.stars || 0 }, rift: { value: theme.rift || 0 }
    },
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(900);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

/* --------------------------------------------------------------- builder */
const BOX = new THREE.BoxGeometry(1, 1, 1);

/* Lights in three.js r155+ are in physical units. Levels are written with
 * friendly numbers (a street lamp is "16"), and this is the conversion. */
export const LIGHT_SCALE = 9;

/* Every extra real light makes every pixel of every material more expensive,
 * and changing the count recompiles shaders. So levels place as many "virtual"
 * lights as they like, and only the nearest few are backed by real ones. */
const LIGHT_POOL = 10;

class VirtualLight {
  constructor(colour, intensity, x, y, z, distance, decay) {
    this.color = new THREE.Color(colour);
    this.intensity = intensity;          // friendly units; scaled on assignment
    this.position = new THREE.Vector3(x, y, z);
    this.distance = distance;
    this.decay = decay;
    this.userData = {};
  }
}

export class World {
  constructor(scene, theme) {
    this.scene = scene;
    this.theme = theme;
    this.batches = new Map();      // material key -> { mat, geos[] }
    this.colliders = [];           // { min:Vector3, max:Vector3, tag }
    this.meshes = [];
    this.props = [];               // things that animate or react (barrels, doors…)
    this.pickups = [];
    this.triggers = [];
    this.spawns = [];              // enemy spawn points
    this.playerStart = new THREE.Vector3(0, 1.7, 0);
    this.playerFacing = 0;
    this.lights = [];                // VirtualLight[]
    this.pool = [];
    for (let i = 0; i < LIGHT_POOL; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 1.6);
      scene.add(l);
      this.pool.push(l);
    }
    this.lightTimer = 0;
    this.bounds = new THREE.Box3(new THREE.Vector3(-200, -20, -200), new THREE.Vector3(200, 120, 200));
  }

  /* ---- geometry ---- */
  mat(name, opts) { return material(name, opts); }

  /**
   * One box of scenery. Position is the CENTRE. `uv` repeats the texture per
   * metre so a 20 m wall and a 2 m crate share the same brick size.
   */
  box(x, y, z, w, h, d, matName, opts = {}) {
    const key = matName + '|' + JSON.stringify(opts.mat || {});
    let batch = this.batches.get(key);
    if (!batch) {
      batch = { mat: material(matName, opts.mat || {}), geos: [] };
      this.batches.set(key, batch);
    }
    const g = BOX.clone();
    g.scale(w, h, d);
    // scale UVs by size so texture density stays constant across the level
    const uvScale = opts.uv == null ? 0.5 : opts.uv;
    const uv = g.attributes.uv;
    const pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(g.attributes.normal.getX(i)), ny = Math.abs(g.attributes.normal.getY(i));
      let su, sv;
      if (ny > 0.5) { su = w; sv = d; } else if (nx > 0.5) { su = d; sv = h; } else { su = w; sv = h; }
      uv.setXY(i, uv.getX(i) * su * uvScale, uv.getY(i) * sv * uvScale);
    }
    if (opts.rotY) g.rotateY(opts.rotY);
    g.translate(x, y, z);
    batch.geos.push(g);

    if (opts.collide !== false) this.collider(x, y, z, w, h, d, opts.rotY, opts.tag);
    return g;
  }

  /**
   * Any indexed geometry (cylinder, cone, sphere…) merged into a material
   * batch like box() does. Keeps detailed props down to a few draw calls.
   * opts: { pos:[x,y,z], rot:[x,y,z], scale:[x,y,z], uv, mat, collide, tag, shadow }
   */
  shape(geometry, matName, opts = {}) {
    const key = matName + '|' + JSON.stringify(opts.mat || {}) + (opts.shadow === false ? '|ns' : '');
    let batch = this.batches.get(key);
    if (!batch) {
      batch = { mat: material(matName, opts.mat || {}), geos: [], shadows: opts.shadow !== false };
      this.batches.set(key, batch);
    }
    const g = geometry.index ? geometry.clone() : BufferGeometryUtils.mergeVertices(geometry.clone());
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    const uv = g.attributes.uv, s = opts.uv == null ? 1 : opts.uv;
    if (s !== 1) for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(opts.pos || [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(opts.rot || [0, 0, 0]), 'YXZ')),
      new THREE.Vector3(...(opts.scale || [1, 1, 1]))
    );
    g.applyMatrix4(m);
    batch.geos.push(g);
    if (opts.collide) {
      g.computeBoundingBox();
      const b = g.boundingBox;
      this.colliders.push({ min: b.min.clone(), max: b.max.clone(), tag: opts.tag || '' });
    }
    return g;
  }

  /** Axis-aligned collider; a rotated box is wrapped by its bounding box. */
  collider(x, y, z, w, h, d, rotY = 0, tag = '') {
    let hw = w / 2, hd = d / 2;
    if (rotY) {
      const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
      const nw = w * c + d * s, nd = w * s + d * c;
      hw = nw / 2; hd = nd / 2;
    }
    this.colliders.push({
      min: new THREE.Vector3(x - hw, y - h / 2, z - hd),
      max: new THREE.Vector3(x + hw, y + h / 2, z + hd),
      tag
    });
  }

  /** A free-standing mesh (cylinder, sphere…) that is not part of a batch. */
  add(mesh, collideBox) {
    this.scene.add(mesh);
    this.meshes.push(mesh);
    if (collideBox) {
      const b = new THREE.Box3().setFromObject(mesh);
      this.colliders.push({ min: b.min.clone(), max: b.max.clone(), tag: collideBox === true ? '' : collideBox });
    }
    return mesh;
  }

  cylinder(x, y, z, rTop, rBot, h, matName, opts = {}) {
    const geo = new THREE.CylinderGeometry(rTop, rBot, h, opts.seg || 14, 1, false);
    const m = new THREE.Mesh(geo, material(matName, opts.mat || {}));
    m.position.set(x, y, z);
    m.castShadow = opts.shadow !== false;
    m.receiveShadow = true;
    if (opts.rotY) m.rotation.y = opts.rotY;
    this.add(m, opts.collide === false ? null : (opts.tag || true));
    return m;
  }

  light(colour, intensity, x, y, z, distance = 18, decay = 1.6) {
    const l = new VirtualLight(colour, intensity, x, y, z, distance, decay);
    this.lights.push(l);
    return l;
  }

  /** Back the nearest virtual lights with the real pool. Cheap enough per frame. */
  updateLights(viewPos, dt) {
    this.lightTimer -= dt;
    if (this.lightTimer <= 0 || !this.assigned) {
      this.lightTimer = 0.2;
      // rank by how close the edge of each light's reach is to the viewer
      const ranked = this.lights
        .filter(l => l.intensity > 0.01)
        .map(l => ({ l, s: l.position.distanceTo(viewPos) - l.distance * 0.6 }))
        .sort((a, b) => a.s - b.s);
      this.assigned = ranked.slice(0, LIGHT_POOL).map(r => r.l);
    }
    for (let i = 0; i < LIGHT_POOL; i++) {
      const real = this.pool[i], v = this.assigned[i];
      if (!v) { real.intensity = 0; continue; }
      real.color.copy(v.color);
      real.position.copy(v.position);
      real.distance = v.distance;
      real.decay = v.decay;
      real.intensity = v.intensity * LIGHT_SCALE;
    }
  }

  /**
   * A flat quad (windows, stained glass) merged into one mesh per material.
   * colour, when given, is baked into the vertices for vertex-coloured batches.
   */
  quad(x, y, z, w, h, rotY, key, makeMaterial, colour) {
    let batch = this.batches.get(key);
    if (!batch) {
      batch = { mat: makeMaterial(), geos: [], shadows: false };
      this.batches.set(key, batch);
    }
    const g = new THREE.PlaneGeometry(w, h);
    g.deleteAttribute('uv');
    if (colour) {
      const c = new THREE.Color(colour);
      const cols = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < cols.length; i += 3) { cols[i] = c.r; cols[i + 1] = c.g; cols[i + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    }
    g.rotateY(rotY);
    g.translate(x, y, z);
    batch.geos.push(g);
  }

  /** Glowing plane used for signs, screens and objective markers. */
  sign(text, x, y, z, rotY = 0, w = 3, colour = '#ff7a2f') {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshBasicMaterial({ map: signTexture(text, '#0d0d12', colour), transparent: true })
    );
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    this.scene.add(m);
    this.meshes.push(m);
    return m;
  }

  /** Called once the level is described: merge everything into few meshes. */
  finish() {
    for (const [, batch] of this.batches) {
      if (!batch.geos.length) continue;
      const merged = BufferGeometryUtils.mergeGeometries(batch.geos, false);
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, batch.mat);
      mesh.castShadow = batch.shadows !== false;
      mesh.receiveShadow = batch.shadows !== false;
      this.scene.add(mesh);
      this.meshes.push(mesh);
      batch.geos.forEach(g => g.dispose());
      batch.geos.length = 0;
    }
    this.batches.clear();
    this.buildGrid();
  }

  /** Uniform grid over the colliders so movement only tests what is nearby. */
  buildGrid() {
    this.cell = 6;
    this.grid = new Map();
    const key = (ix, iz) => ix + ',' + iz;
    for (const c of this.colliders) {
      const x0 = Math.floor(c.min.x / this.cell), x1 = Math.floor(c.max.x / this.cell);
      const z0 = Math.floor(c.min.z / this.cell), z1 = Math.floor(c.max.z / this.cell);
      for (let ix = x0; ix <= x1; ix++) {
        for (let iz = z0; iz <= z1; iz++) {
          const k = key(ix, iz);
          let list = this.grid.get(k);
          if (!list) this.grid.set(k, (list = []));
          list.push(c);
        }
      }
    }
  }

  near(x, z, radius = 1.2, out = []) {
    out.length = 0;
    if (!this.grid) return out;
    const x0 = Math.floor((x - radius) / this.cell), x1 = Math.floor((x + radius) / this.cell);
    const z0 = Math.floor((z - radius) / this.cell), z1 = Math.floor((z + radius) / this.cell);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const list = this.grid.get(ix + ',' + iz);
        if (!list) continue;
        for (const c of list) if (out.indexOf(c) === -1) out.push(c);
      }
    }
    return out;
  }

  /** Slab test against every collider; returns { dist, point, normal } or null. */
  raycast(origin, dir, maxDist = 100) {
    let best = null, bestT = maxDist;
    const inv = { x: 1 / dir.x, y: 1 / dir.y, z: 1 / dir.z };
    for (const c of this.colliders) {
      let t0 = 0, t1 = bestT, axis = -1, sign = 1;
      for (let a = 0; a < 3; a++) {
        const k = a === 0 ? 'x' : a === 1 ? 'y' : 'z';
        let tn = (c.min[k] - origin[k]) * inv[k];
        let tf = (c.max[k] - origin[k]) * inv[k];
        let s = -1;
        if (tn > tf) { const tmp = tn; tn = tf; tf = tmp; s = 1; }
        if (tn > t0) { t0 = tn; axis = a; sign = s; }
        if (tf < t1) t1 = tf;
        if (t0 > t1) { t0 = Infinity; break; }
      }
      if (t0 < bestT && t0 > 0.001 && t0 !== Infinity) {
        bestT = t0;
        best = best || { dist: 0, point: new THREE.Vector3(), normal: new THREE.Vector3(), collider: null };
        best.dist = t0;
        best.collider = c;
        best.point.copy(origin).addScaledVector(dir, t0);
        best.normal.set(0, 0, 0);
        best.normal[axis === 0 ? 'x' : axis === 1 ? 'y' : 'z'] = sign;
      }
    }
    return best;
  }

  /** True when nothing solid sits between two points (enemy line of sight). */
  clearLine(a, b) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    if (len < 0.001) return true;
    dir.divideScalar(len);
    const hit = this.raycast(a, dir, len);
    return !hit;
  }

  dispose() {
    for (const m of this.meshes) {
      this.scene.remove(m);
      if (m.geometry) m.geometry.dispose();
    }
    for (const l of this.pool) this.scene.remove(l);
    this.meshes.length = 0; this.lights.length = 0; this.pool.length = 0; this.colliders.length = 0;
    this.props.length = 0; this.pickups.length = 0; this.triggers.length = 0; this.spawns.length = 0;
  }
}

/* ------------------------------------------------------- scenery helpers */

/** Rubble scattered around a point: small tumbled blocks, no collision. */
export function rubble(world, x, z, count, rng, spread = 3, matName = 'concrete') {
  for (let i = 0; i < count; i++) {
    const a = rng() * TAU, d = rng() * spread;
    const s = rng.range(0.15, 0.5);
    world.box(x + Math.cos(a) * d, s / 2, z + Math.sin(a) * d, s, s * rng.range(0.4, 1), s * rng.range(0.6, 1.4),
      matName, { collide: false, rotY: rng() * TAU, uv: 1.2 });
  }
}

/** A wrecked car: body, cabin, wheels. Blocks movement. */
export function car(world, x, z, rotY, rng, colour = 0x3a4a5c) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.55, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.85, 1.9), bodyMat);
  body.position.y = 0.75; body.castShadow = body.receiveShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 1.75), new THREE.MeshStandardMaterial({
    color: 0x0f1418, roughness: 0.25, metalness: 0.2
  }));
  cabin.position.set(-0.2, 1.5, 0); cabin.castShadow = true;
  g.add(body, cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.95 });
  for (const [wx, wz] of [[1.45, 0.92], [1.45, -0.92], [-1.45, 0.92], [-1.45, -0.92]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
  }
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  if (rng.chance(0.4)) g.rotation.z = rng.range(-0.12, 0.12);
  world.add(g, 'car');
  return g;
}

/** Explosive barrel — a prop that other systems can blow up. */
export function barrel(world, x, z, rng) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.15, 14),
    material('rust', { repeat: 1, roughness: 0.6, metalness: 0.45 }));
  m.position.y = 0.58; m.castShadow = m.receiveShadow = true;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.1, 14),
    new THREE.MeshStandardMaterial({ color: 0xc9421f, roughness: 0.7, emissive: 0x220a04 }));
  band.position.y = 0.75;
  const band2 = band.clone(); band2.position.y = 0.35;
  g.add(m, band, band2);
  g.position.set(x, 0, z);
  g.rotation.y = rng ? rng() * TAU : 0;
  world.add(g, 'barrel');
  const prop = { kind: 'barrel', obj: g, pos: g.position, hp: 22, radius: 0.5, dead: false };
  world.props.push(prop);
  return prop;
}

/** Street lamp with a live light — expensive, so levels use only a few. */
export function lamp(world, x, z, colour = 0xffc27a, intensity = 14) {
  const pole = world.cylinder(x, 3, z, 0.09, 0.13, 6, 'rust', { seg: 8, mat: { metalness: 0.6, roughness: 0.6 }, tag: 'lamp' });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.7 }));
  head.position.set(x + 0.4, 5.9, z);
  world.add(head);
  const bulb = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.34),
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.9 }));
  bulb.rotation.x = Math.PI / 2;
  bulb.position.set(x + 0.4, 5.77, z);
  world.add(bulb);
  const l = world.light(colour, intensity, x + 0.4, 5.6, z, 26);
  if (intensity > 0) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 5.6, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.07, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    cone.position.set(x + 0.4, 2.9, z);
    world.add(cone);
  } else {
    bulb.material.color.setHex(0x222222);   // a dead lamp
  }
  return { pole, light: l, bulb };
}

/** Fire that lights its surroundings and throws embers (updated by the game). */
export function fireSource(world, x, y, z, scale = 1) {
  const l = world.light(0xff7a2f, 9 * scale, x, y + 0.6 * scale, z, 14 * scale);
  const src = { pos: new THREE.Vector3(x, y, z), light: l, scale, phase: Math.random() * TAU };
  world.props.push({ kind: 'fire', src, pos: src.pos });
  return src;
}

/** Ground plane with gentle height variation baked into the vertices. */
export function ground(world, size, matName, opts = {}) {
  const seg = opts.seg || 48;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  if (opts.bumpy) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, (fbm(x / 26, z / 26, 4, 3) - 0.5) * (opts.bumpy || 1));
    }
    geo.computeVertexNormals();
  }
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * size * (opts.uv || 0.35), uv.getY(i) * size * (opts.uv || 0.35));
  const mesh = new THREE.Mesh(geo, material(matName, opts.mat || {}));
  mesh.receiveShadow = true;
  mesh.position.y = opts.y || 0;
  world.scene.add(mesh);
  world.meshes.push(mesh);
  // one big collider under the floor so falling stops even off the built area
  const y0 = opts.y || 0;
  world.colliders.push({
    min: new THREE.Vector3(-size / 2, y0 - 4, -size / 2),
    max: new THREE.Vector3(size / 2, y0, size / 2),
    tag: 'ground'
  });
  // invisible walls at the edge of the ground, so nobody walks off the world
  const edge = size / 2, t = 2;
  for (const [x, z, w, d] of [[0, -edge, size, t], [0, edge, size, t], [-edge, 0, t, size], [edge, 0, t, size]]) {
    world.colliders.push({
      min: new THREE.Vector3(x - w / 2, y0, z - d / 2),
      max: new THREE.Vector3(x + w / 2, y0 + 60, z + d / 2),
      tag: 'edge'
    });
  }
  return mesh;
}

/** Four walls around a rectangular room, with an optional doorway per side. */
export function roomWalls(world, cx, cz, w, d, h, matName, opts = {}) {
  const t = opts.thickness || 0.4;
  const doors = opts.doors || {};   // { north:[offset,width], … }
  const sides = [
    ['north', cx, cz - d / 2, w, true],
    ['south', cx, cz + d / 2, w, true],
    ['west', cx - w / 2, cz, d, false],
    ['east', cx + w / 2, cz, d, false]
  ];
  for (const [name, x, z, len, horizontal] of sides) {
    const door = doors[name];
    if (!door) {
      if (horizontal) world.box(x, h / 2, z, len, h, t, matName, opts.mat);
      else world.box(x, h / 2, z, t, h, len, matName, opts.mat);
      continue;
    }
    const [off, dw, dh = h] = door;
    const a = len / 2 + off - dw / 2;     // wall piece before the doorway
    const b = len / 2 - off - dw / 2;     // and after it
    if (horizontal) {
      if (a > 0.05) world.box(x - len / 2 + a / 2, h / 2, z, a, h, t, matName, opts.mat);
      if (b > 0.05) world.box(x + len / 2 - b / 2, h / 2, z, b, h, t, matName, opts.mat);
      if (dh < h) world.box(x - len / 2 + off, dh + (h - dh) / 2, z, dw, h - dh, t, matName, opts.mat);
    } else {
      if (a > 0.05) world.box(x, h / 2, z - len / 2 + a / 2, t, h, a, matName, opts.mat);
      if (b > 0.05) world.box(x, h / 2, z + len / 2 - b / 2, t, h, b, matName, opts.mat);
      if (dh < h) world.box(x, dh + (h - dh) / 2, z - len / 2 + off, t, h - dh, dw, matName, opts.mat);
    }
  }
}

/** A building shell: walls, roof and dark windows. */
export function building(world, x, z, w, d, h, rng, opts = {}) {
  const wallMat = opts.wall || 'brick';
  roomWalls(world, x, z, w, d, h, wallMat, { mat: opts.mat, doors: opts.doors });
  const trim = { uv: 0.6, collide: false, mat: { color: 0xb8b0a4 } };

  // the four facades: outward normal, length, and how to place along them
  const faces = [
    { name: 'south', nx: 0, nz: 1, len: w, cx: x, cz: z + d / 2, alongX: true },
    { name: 'north', nx: 0, nz: -1, len: w, cx: x, cz: z - d / 2, alongX: true },
    { name: 'east', nx: 1, nz: 0, len: d, cx: x + w / 2, cz: z, alongX: false },
    { name: 'west', nx: -1, nz: 0, len: d, cx: x - w / 2, cz: z, alongX: false }
  ];
  const at = (f, along, out) => [f.cx + (f.alongX ? along : 0) + f.nx * out, f.cz + (f.alongX ? 0 : along) + f.nz * out];
  const faceRot = f => Math.atan2(f.nx, f.nz);        // a plane facing outward

  if (opts.roof !== false) {
    world.box(x, h, z, w + 0.6, 0.5, d + 0.6, 'concrete', { uv: 0.4 });
    // parapet round the roof edge
    for (const f of faces) {
      const [px, pz] = at(f, 0, 0.15);
      world.box(px, h + 0.6, pz, f.alongX ? w + 0.6 : 0.25, 0.7, f.alongX ? 0.25 : d + 0.6, 'concrete', { uv: 0.5, collide: false });
    }
    // rooftop clutter: water tank, vents, aerials
    if (h > 5 && rng.chance(0.55)) {
      const tx = x + rng.range(-w / 4, w / 4), tz = z + rng.range(-d / 4, d / 4);
      for (const [lx, lz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
        world.box(tx + lx, h + 1.2, tz + lz, 0.12, 1.9, 0.12, 'wood', { uv: 1, collide: false });
      }
      world.shape(new THREE.CylinderGeometry(1.2, 1.2, 2.2, 12), 'wood', { pos: [tx, h + 3.2, tz], uv: 1, collide: false });
      world.shape(new THREE.ConeGeometry(1.3, 0.8, 12), 'rust', { pos: [tx, h + 4.7, tz], collide: false });
    }
    for (let k = 0; k < 2; k++) {
      if (!rng.chance(0.5)) continue;
      world.box(x + rng.range(-w / 3, w / 3), h + 0.7, z + rng.range(-d / 3, d / 3), 1.2, 0.9, 0.9, 'rust',
        { uv: 1, collide: false, mat: { color: 0x9aa0a6, metalness: 0.5 } });
    }
    if (rng.chance(0.35)) {
      world.shape(new THREE.CylinderGeometry(0.04, 0.06, 5, 5), 'rust', { pos: [x + w / 3, h + 2.7, z - d / 3], collide: false, shadow: false });
    }
  }

  // ledges marking each floor
  const floors = Math.max(1, Math.floor(h / 3.2));
  for (let f = 1; f < floors; f++) {
    const y = f * 3.2;
    for (const face of faces) {
      const [px, pz] = at(face, 0, 0.12);
      world.box(px, y, pz, face.alongX ? w + 0.24 : 0.24, 0.16, face.alongX ? 0.24 : d + 0.24, 'concrete', trim);
    }
  }

  // windows with sills and lintels; the odd air-con unit
  const glassKey = opts.lit ? 'glass-lit' : 'glass-dark';
  const glass = () => new THREE.MeshStandardMaterial({
    color: 0x0b1016, roughness: 0.15, metalness: 0.5,
    emissive: opts.lit ? 0x4a2208 : 0x000000, emissiveIntensity: 1
  });
  for (let f = 0; f < floors; f++) {
    const y = 1.7 + f * 3.2;
    if (y > h - 1) break;
    for (const face of faces) {
      const count = Math.max(1, Math.floor(face.len / 3));
      const door = opts.doors && opts.doors[face.name];
      for (let i = 0; i < count; i++) {
        const along = ((i + 0.5) / count - 0.5) * face.len;
        if (f === 0 && door && Math.abs(along - door[0]) < door[1] / 2 + 0.9) continue;   // not over the doorway
        const boarded = rng.chance(0.18);
        const [gx, gz] = at(face, along, 0.05);
        if (boarded) {
          // planks nailed across
          for (let k = 0; k < 3; k++) {
            const [bx, bz] = at(face, along, 0.08);
            world.shape(new THREE.BoxGeometry(1.5, 0.18, 0.04), 'wood', {
              pos: [bx, y - 0.45 + k * 0.45, bz], rot: [0, faceRot(face), (k - 1) * 0.12], uv: 1, collide: false
            });
          }
        } else {
          world.quad(gx, y, gz, 1.3, 1.5, faceRot(face), glassKey, glass);
        }
        const [sx, sz] = at(face, along, 0.1);
        world.box(sx, y - 0.82, sz, face.alongX ? 1.6 : 0.2, 0.1, face.alongX ? 0.2 : 1.6, 'concrete', trim);
        world.box(sx, y + 0.82, sz, face.alongX ? 1.5 : 0.14, 0.12, face.alongX ? 0.14 : 1.5, 'concrete', trim);
        if (!boarded && f > 0 && rng.chance(0.12)) {
          const [ax, az] = at(face, along, 0.3);
          world.box(ax, y - 1.1, az, face.alongX ? 0.7 : 0.45, 0.42, face.alongX ? 0.45 : 0.7, 'rust',
            { uv: 1, collide: false, mat: { color: 0xc8ccd0, metalness: 0.4 } });
        }
      }
    }
  }

  // an awning over each doorway
  for (const face of faces) {
    const door = opts.doors && opts.doors[face.name];
    if (!door) continue;
    const [ax, az] = at(face, door[0], 0.6);
    world.box(ax, Math.min(door[2] || 2.6, h - 0.5) + 0.25, az, face.alongX ? door[1] + 1 : 1.2, 0.12, face.alongX ? 1.2 : door[1] + 1, 'rust',
      { uv: 0.8, collide: false, mat: { color: 0x5a2a24, roughness: 0.9 } });
  }

  // fire escape down one side of taller brick blocks
  if (wallMat === 'brick' && floors >= 3 && rng.chance(0.55)) {
    const face = faces[rng.int(0, 3)];
    const along = rng.range(-face.len / 4, face.len / 4);
    const iron = { uv: 1, collide: false, mat: { color: 0x2a2624, metalness: 0.6, roughness: 0.7 } };
    for (let f = 1; f < floors; f++) {
      const y = f * 3.2 + 0.05;
      const [px, pz] = at(face, along, 0.75);
      world.box(px, y, pz, face.alongX ? 3.2 : 1.3, 0.06, face.alongX ? 1.3 : 3.2, 'rust', iron);
      const [rx, rz] = at(face, along, 1.38);
      world.box(rx, y + 0.5, rz, face.alongX ? 3.2 : 0.04, 0.04, face.alongX ? 0.04 : 3.2, 'rust', iron);
      for (let k = -1; k <= 1; k++) {
        const [qx, qz] = at(face, along + k * 1.55, 1.38);
        world.box(qx, y + 0.25, qz, 0.04, 0.5, 0.04, 'rust', iron);
      }
      // the stair down to the landing below
      const [sx, sz] = at(face, along, 0.75);
      world.shape(new THREE.BoxGeometry(0.6, 0.05, 3.9), 'rust', {
        pos: [sx, y - 1.6, sz], rot: [0.95, face.alongX ? Math.PI / 2 : 0, 0], ...iron
      });
    }
  }
  return { x, z, w, d, h };
}

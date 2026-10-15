/* Scenery: low-poly props merged per type and drawn as InstancedMeshes,
 * bucketed into 400 m chunks so only nearby ones are drawn. Each of the ten
 * locations has its own mix, plus landmarks at the start and finish towns. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';
import { DS, START_S } from './track.js';

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
function P(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  e.set(rx, ry, rz); q.setFromEuler(e); m4.compose(v3.set(x, y, z), q, sc.set(sx, sy, sz));
  geo.applyMatrix4(m4);
  const keepUv = !!geo.userData.keepUv;
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!keepUv && g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const M = parts => { const g = mergeGeometries(parts); g.computeBoundingSphere(); return g; };
const cyl = (r0, r1, h, s = 6) => { const g = new THREE.CylinderGeometry(r1, r0, h, s); g.translate(0, h / 2, 0); return g; };
const cone = (r, h, s = 7) => { const g = new THREE.ConeGeometry(r, h, s); g.translate(0, h / 2, 0); return g; };
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const bx = (w, h, d) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return g; };

/* ------------------------------------------------------------- props */
const GEO = {
  palm() {
    const parts = [];
    for (let i = 0; i < 5; i++) parts.push(P(cyl(0.26 - i * 0.02, 0.24 - i * 0.02, 2.0, 6), '#8a6a44', { x: i * i * 0.05, y: i * 1.9, rz: -0.03 * i }));
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      const f = new THREE.ConeGeometry(0.5, 4.2, 3); f.translate(0, 2.1, 0);
      parts.push(P(f, k % 2 ? '#3f8a3a' : '#2f7232', { x: 0.8, y: 9.4, rx: Math.cos(a) * 1.9, rz: Math.sin(a) * 1.9, sz: 0.25 }));
    }
    return M(parts);
  },
  cypress() { return M([P(cyl(0.2, 0.15, 1.5), '#5a4030'), P(ico(1, 1), '#2b5426', { y: 6, sx: 1.4, sy: 5.6, sz: 1.4 })]); },
  tree() {
    return M([P(cyl(0.35, 0.25, 3.5), '#5c4430'), P(ico(2.6, 0), '#4a7a32', { y: 5.4 }), P(ico(2.1, 0), '#3e6e2c', { x: 1.6, y: 4.6, z: 0.6 }), P(ico(1.9, 0), '#558a38', { x: -1.3, y: 5.0, z: -0.8 })]);
  },
  jungle() {
    return M([P(cyl(0.5, 0.35, 7), '#4a3a2c'), P(ico(4.2, 0), '#21612a', { y: 9 }), P(ico(3.4, 0), '#2c7a30', { x: 2.6, y: 7.5, z: 1 }), P(ico(3.0, 0), '#1c5424', { x: -2.4, y: 8.2, z: -1.4 })]);
  },
  pine() { return M([P(cyl(0.3, 0.2, 2), '#4a3626'), P(cone(2.6, 4.2), '#24452e', { y: 1.6 }), P(cone(2.0, 3.6), '#2a5034', { y: 3.8 }), P(cone(1.3, 3), '#2e5838', { y: 5.8 })]); },
  snowpine() {
    return M([P(cyl(0.3, 0.2, 2), '#4a3626'), P(cone(2.6, 4.2), '#24452e', { y: 1.6 }), P(cone(2.0, 3.6), '#e9eff4', { y: 3.6, sx: 1.02, sz: 1.02 }),
      P(cone(2.0, 3.6), '#2a5034', { y: 3.4, sx: 0.98, sz: 0.98 }), P(cone(1.3, 3), '#f4f8fb', { y: 5.8 })]);
  },
  euca() { return M([P(cyl(0.3, 0.2, 6, 5), '#d8d2c4', { rz: 0.08 }), P(ico(2.2, 0), '#6f7d4a', { x: 0.8, y: 7, sy: 0.7 }), P(ico(1.7, 0), '#7c8a52', { x: -1.2, y: 6, z: 0.6, sy: 0.7 })]); },
  cactus() { return M([P(cyl(0.4, 0.36, 5, 7), '#4f7a3a'), P(cyl(0.25, 0.22, 1.8, 6), '#4f7a3a', { x: 0.7, y: 2.4 }), P(cyl(0.22, 0.2, 1.4, 6), '#4f7a3a', { x: -0.65, y: 2.9 }), P(bx(1.6, 0.4, 0.4), '#4f7a3a', { y: 2.2 })]); },
  rock() { return M([P(new THREE.DodecahedronGeometry(1.6, 0), '#8a7a68', { y: 0.6, sy: 0.7 }), P(new THREE.DodecahedronGeometry(1, 0), '#7a6a58', { x: 1.4, y: 0.3, sy: 0.6 })]); },
  house() {
    const roof = new THREE.CylinderGeometry(4.6, 4.6, 9, 3, 1); roof.rotateZ(Math.PI / 2); roof.rotateX(-Math.PI / 2);
    const g = M([P(bx(8, 6, 8), '#f3eee4'), P(roof, '#c0583a', { y: 7.1, sy: 0.55 }), P(bx(1.2, 2.2, 0.1), '#5a4030', { y: 0, z: 4.02 }),
      P(bx(1.2, 1.2, 0.1), '#3a5470', { x: 2.4, y: 3.4, z: 4.02 }), P(bx(1.2, 1.2, 0.1), '#3a5470', { x: -2.4, y: 3.4, z: 4.02 })]);
    return g;
  },
  chalet() {
    const roof = new THREE.CylinderGeometry(5.6, 5.6, 10, 3, 1); roof.rotateZ(Math.PI / 2); roof.rotateX(-Math.PI / 2);
    return M([P(bx(9, 2.4, 8), '#d8d0c4'), P(bx(9, 3.4, 8), '#7a4a2a', { y: 2.4 }), P(roof, '#f2f6fa', { y: 7.2, sy: 0.6 }),
      P(bx(8, 0.3, 1.4), '#5a3420', { y: 3.2, z: 4.6 }), P(bx(1.4, 1.4, 0.1), '#2a3440', { x: 2.4, y: 3.6, z: 4.02 }), P(bx(1.4, 1.4, 0.1), '#2a3440', { x: -2.4, y: 3.6, z: 4.02 })]);
  },
  cottage() {
    const roof = new THREE.CylinderGeometry(4, 4, 8, 3, 1); roof.rotateZ(Math.PI / 2); roof.rotateX(-Math.PI / 2);
    return M([P(bx(10, 4.5, 6), '#a89a84'), P(roof, '#4a4e58', { y: 5.5, sy: 0.6, sx: 1.3 }), P(bx(0.8, 2, 0.8), '#7a6a5a', { x: 3.5, y: 6 }),
      P(bx(1.1, 1.1, 0.1), '#2a3440', { x: 2.4, y: 2.4, z: 3.02 }), P(bx(1.1, 1.1, 0.1), '#2a3440', { x: -2.4, y: 2.4, z: 3.02 })]);
  },
  sheep() { return M([P(bx(1.3, 0.8, 0.8), '#f2efe6', { y: 0.45 }), P(bx(0.4, 0.4, 0.4), '#2a2a2a', { x: 0.75, y: 0.85 })]); },
  hedge() { return M([P(bx(10.4, 1.6, 1.4), '#3c6a2c')]); },
  vine() { return M([P(bx(26, 1.2, 0.9), '#5f7e34'), P(bx(26, 1.2, 0.9), '#5f7e34', { z: 3 }), P(bx(26, 1.2, 0.9), '#5f7e34', { z: 6 }), P(bx(26, 1.2, 0.9), '#5f7e34', { z: -3 })]); },
  yacht() {
    const hull = new THREE.BoxGeometry(14, 2.2, 4); const p = hull.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getX(i) > 0) p.setZ(i, p.getZ(i) * (p.getY(i) > 0 ? 0.6 : 0.2));
    hull.computeVertexNormals();
    return M([P(hull, '#f4f4f4', { y: 1 }), P(bx(6, 1.6, 3), '#e8ecf0', { x: -1, y: 2.1 }), P(bx(5.6, 0.6, 3.1), '#2a3440', { x: -1, y: 2.7 }), P(cyl(0.08, 0.08, 9, 4), '#cccccc', { x: 1, y: 2 })]);
  },
  mountain() {
    const g = new THREE.ConeGeometry(1, 1, 9, 4); g.translate(0, 0.5, 0);
    const p = g.attributes.position, r = TX.rng(4);
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.01 && y < 0.99) { p.setX(i, p.getX(i) * (0.85 + r() * 0.3)); p.setZ(i, p.getZ(i) * (0.85 + r() * 0.3)); } }
    const gg = g.toNonIndexed(); gg.computeVertexNormals();
    const col = new Float32Array(gg.attributes.position.count * 3), c1 = new THREE.Color('#8e97a3'), c2 = new THREE.Color('#f2f5f8');
    for (let i = 0; i < gg.attributes.position.count; i++) { const c = gg.attributes.position.getY(i) > 0.62 ? c2 : c1; col.set([c.r, c.g, c.b], i * 3); }
    gg.setAttribute('color', new THREE.BufferAttribute(col, 3)); gg.deleteAttribute('uv'); gg.computeBoundingSphere();
    return gg;
  },
  hill() {
    const g = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); return M([P(g, '#ffffff')]);
  },
  lamp() { return M([P(cyl(0.12, 0.09, 9, 5), '#4a4e56'), P(bx(2.4, 0.15, 0.15), '#4a4e56', { x: 1.1, y: 8.9 })]); },
  lampHead() { return M([P(bx(0.9, 0.18, 0.5), '#ffffff', { x: 2.1, y: 8.75 })]); },
  flood() { return M([P(cyl(0.25, 0.2, 18, 6), '#5a5e66'), P(bx(3, 1.6, 0.4), '#3a3e46', { y: 17.4, z: 0.3 })]); },
  floodHead() { return M([P(bx(2.7, 1.3, 0.1), '#ffffff', { y: 17.55, z: 0.52 })]); },
  pool() { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); g.userData.keepUv = true; return M([P(g, '#ffffff')]); },
  sign() { return M([P(bx(1, 1, 0.3), '#ffffff')]); },
  pole() { return M([P(cyl(0.18, 0.18, 1, 5), '#3a3c44')]); },
  supertree() {
    const parts = [P(cyl(1.2, 0.8, 22, 8), '#6a2a8a'), P(cone(1, 1, 10), '#c040c0', { y: 30, rx: Math.PI, sx: 9, sy: 9, sz: 9 })];
    return M(parts);
  },
  tower() { // generic lattice radio tower, red and white
    const parts = [];
    for (let i = 0; i < 6; i++) parts.push(P(cone(9 - i * 1.4, 16, 4), i % 2 ? '#f2f2f2' : '#e04020', { y: i * 15, ry: Math.PI / 4 }));
    parts.push(P(cyl(0.6, 0.3, 30, 5), '#e04020', { y: 90 }));
    return M(parts);
  },
  needle() { // a very tall stepped desert tower
    const parts = [];
    for (let i = 0; i < 9; i++) parts.push(P(cyl(14 - i * 1.5, 13 - i * 1.5, 34, 6), '#b8c6d4', { y: i * 34 }));
    parts.push(P(cyl(1.2, 0.3, 120, 5), '#c8d4e0', { y: 306 }));
    return M(parts);
  },
  pyramid() { return M([P(cone(60, 70, 4), '#1a1a20', { ry: Math.PI / 4 })]); },
  beam() { return M([P(cyl(3, 6, 900, 8), '#ffffff')]); },
  triple() { // three towers carrying a sky deck
    const parts = [];
    for (const x of [-38, 0, 38]) parts.push(P(bx(22, 150, 26), '#c8d4e0', { x }));
    const deck = new THREE.BoxGeometry(130, 8, 34); deck.translate(10, 154, 0);
    parts.push(P(deck, '#e8eef4'));
    return M(parts);
  },
  casino() { return M([P(bx(40, 30, 30), '#ffffff'), P(bx(30, 12, 22), '#ffffff', { y: 30 })]); }
};
GEO.wheel = () => {
  const parts = [P(new THREE.TorusGeometry(70, 1.6, 6, 40), '#e8eef4', { y: 82 })];
  for (let i = 0; i < 12; i++) { const g = new THREE.BoxGeometry(0.8, 140, 0.8); parts.push(P(g, '#c8d4e0', { y: 82, rz: i * Math.PI / 12 })); }
  parts.push(P(cone(12, 82, 4), '#9aa4ae', { sz: 0.4 }));
  return M(parts);
};

/* Building with windows: unit box, uv scaled so window size stays fixed. */
function buildingGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0);
  const uv = g.attributes.uv;
  // face order: +x, -x, +y, -y, +z, -z (4 verts each)
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    if (f === 2 || f === 3) { uv.setXY(i, 0.02, 0.01); continue; }
    const wid = (f < 2) ? d : w;
    uv.setXY(i, uv.getX(i) * wid / 28, uv.getY(i) * h / 56);
  }
  return g;
}

/* ------------------------------------------------------------- collector */
export class Scenery {
  constructor(track, L, quality) {
    this.t = track; this.L = L; this.q = quality;
    this.buckets = new Map();   // type -> chunk -> [{m, c}]
    this.mats = {};
    this.geos = {};
    this.group = new THREE.Group(); this.group.name = 'scenery';
    this.chunks = [];
    this.r = TX.rng(L.seed * 7 + 1);
    this.tmpM = new THREE.Matrix4();
  }

  material(type) {
    if (this.mats[type]) return this.mats[type];
    const L = this.L, night = !!L.night;
    let m;
    if (type === 'bld') m = night ? new THREE.MeshLambertMaterial({ vertexColors: true, color: '#30303c', emissive: '#ffffff', emissiveMap: TX.windows(true), emissiveIntensity: 0.9, map: TX.windows(false) })
      : new THREE.MeshLambertMaterial({ vertexColors: true, map: TX.windows(false) });
    else if (type === 'casino') m = new THREE.MeshLambertMaterial({ vertexColors: true, color: '#40384a', emissive: '#ffffff', emissiveMap: TX.windows(true), emissiveIntensity: 1.2, map: TX.windows(false) });
    else if (['lampHead', 'floodHead', 'sign', 'supertree', 'beam'].includes(type)) m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: type === 'beam', opacity: type === 'beam' ? 0.16 : 1, depthWrite: type !== 'beam', fog: type !== 'beam' });
    else if (type === 'pool') m = new THREE.MeshBasicMaterial({ map: TX.softDot(), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4 });
    else if (night && ['triple', 'tower', 'needle', 'pyramid'].includes(type)) m = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: type === 'pyramid' ? '#101018' : '#4a5a80', emissiveIntensity: 0.8 });
    else if (night && type === 'wheel') m = new THREE.MeshBasicMaterial({ vertexColors: true, color: '#9fe8ff' });
    else m = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.mats[type] = m; return m;
  }
  geo(type) {
    if (this.geos[type]) return this.geos[type];
    let g;
    if (type === 'bld' || type === 'casino') g = null; else g = GEO[type]();
    this.geos[type] = g; return g;
  }

  chunkOf(x, z) { const n = this.t.nearest(x, z, 3); return Math.max(0, Math.floor(n.i / 200)); }

  add(type, x, y, z, ry = 0, s = 1, color = null, sy = null, sz = null, chunk = null, variant = '') {
    const key = type + variant;
    let b = this.buckets.get(key); if (!b) this.buckets.set(key, b = { type, variant, chunks: new Map() });
    const ch = chunk ?? this.chunkOf(x, z);
    let arr = b.chunks.get(ch); if (!arr) b.chunks.set(ch, arr = []);
    e.set(0, ry, 0); q.setFromEuler(e);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, sy ?? s, sz ?? s));
    arr.push({ m, c: color });
  }

  /* is a spot clear of every part of the road (by `clear` metres past the barrier)? */
  free(x, z, clear) {
    const g = this.t.nearest(x, z, 3);
    return g.i < 0 || g.dist > this.t.w[g.i] / 2 + this.t.runoff + clear;
  }

  /* Scatter `type` along the route. */
  scatter(type, per100, lat0, lat1, opt = {}) {
    const t = this.t, r = this.r, density = per100 * (this.q >= 2 ? 0.55 : this.q === 1 ? 0.8 : 1);
    const s0 = opt.s0 ?? 0, s1 = opt.s1 ?? t.totalS;
    const count = Math.floor((s1 - s0) / 100 * density);
    const tmp = {};
    for (let k = 0; k < count; k++) {
      const s = s0 + r() * (s1 - s0);
      let side = r() < 0.5 ? 1 : -1;
      if (opt.side) side = opt.side;
      const lat = lat0 + Math.pow(r(), opt.pow ?? 1) * (lat1 - lat0);
      t.at(s, side * (t.w[t.idx(s)] / 2 + t.runoff + lat), tmp);
      if (!this.free(tmp.x, tmp.z, Math.min(lat0, 3) * 0.8 + 1)) continue;
      let y = opt.sea ? t.seaY : t.groundY(tmp.x, tmp.z);
      if (!opt.sea && t.L.sea && y < t.seaY + 0.8) continue;
      if (opt.sea && t.groundY(tmp.x, tmp.z) > t.seaY - 1) continue;
      const sc = (opt.scale ? opt.scale[0] + r() * (opt.scale[1] - opt.scale[0]) : 0.8 + r() * 0.45);
      const col = opt.colors ? new THREE.Color(opt.colors[(r() * opt.colors.length) | 0]) : null;
      const ry = opt.face ? tmp.th + (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (opt.face === 'road' ? Math.PI : 0) : r() * Math.PI * 2;
      if (opt.build) { opt.build(tmp.x, y, tmp.z, ry, sc, col, side, s); continue; }
      this.add(type, tmp.x, y + (opt.dy || 0), tmp.z, ry, sc, col, opt.sy ? sc * (opt.sy[0] + r() * (opt.sy[1] - opt.sy[0])) : null);
    }
  }

  /* Rows of something along the barrier (hedges, lamps): `every` metres. */
  along(type, every, lat, opt = {}) {
    const t = this.t, tmp = {};
    const s0 = opt.s0 ?? 0, s1 = opt.s1 ?? t.totalS;
    for (let s = s0; s < s1; s += every) {
      for (const side of opt.sides || [1, -1]) {
        const d = side * (t.w[t.idx(s)] / 2 + t.runoff + lat);
        t.at(s, d, tmp);
        if (!this.free(tmp.x, tmp.z, lat - 0.5)) continue;
        const y = opt.road ? tmp.y : t.groundY(tmp.x, tmp.z);
        const ry = tmp.th + (opt.facing ? (side > 0 ? Math.PI : 0) : Math.PI / 2);
        if (opt.build) opt.build(tmp, side, s, ry, y); else this.add(type, tmp.x, y, tmp.z, ry, opt.scale || 1, opt.color ? new THREE.Color(opt.color) : null);
      }
    }
  }

  far(type, n, d0, d1, opt = {}) {
    const t = this.t, r = this.r, tmp = {};
    for (let k = 0; k < n; k++) {
      const s = (opt.s0 ?? 0) + r() * ((opt.s1 ?? t.totalS) - (opt.s0 ?? 0));
      const side = opt.side || (r() < 0.5 ? 1 : -1);
      const sc = opt.scale[0] + r() * (opt.scale[1] - opt.scale[0]);
      const rad = type === 'mountain' || type === 'hill' ? sc : 40;
      t.at(s, side * Math.max(d0 + r() * (d1 - d0), rad * 1.15 + 140), tmp);
      if (!this.free(tmp.x, tmp.z, rad + 80)) continue;
      const y = opt.y != null ? opt.y : t.groundY(tmp.x, tmp.z) - (opt.sink || 0);
      this.add(type, tmp.x, y, tmp.z, r() * 6.28, sc, opt.colors ? new THREE.Color(opt.colors[(r() * opt.colors.length) | 0]) : null, sc * (opt.hy ? opt.hy[0] + r() * (opt.hy[1] - opt.hy[0]) : 1), null, -1);
    }
  }

  building(x, y, z, ry, w, h, d, col, chunk = null, kind = 'bld') {
    // three shape variants keep window sizes sane while scale varies
    this.add(kind, x, y - 0.5, z, ry, w, col, h, d, chunk, '');
  }

  /* ------------------------------------------------------------- finalize */
  finalize(scene) {
    for (const [key, b] of this.buckets) {
      let geo = this.geo(b.type);
      if (b.type === 'bld' || b.type === 'casino') geo = buildingGeo(1, 1, 1);
      const mat = this.material(b.type);
      for (const [ch, arr] of b.chunks) {
        if (b.type === 'bld' || b.type === 'casino') {
          // bake every building of the chunk into one mesh: one draw call, exact window scale
          const parts = [], p = new THREE.Vector3(), qq = new THREE.Quaternion(), sv = new THREE.Vector3();
          for (const it of arr) {
            it.m.decompose(p, qq, sv);
            const g = buildingGeo(sv.x, sv.y, sv.z); g.applyQuaternion(qq); g.translate(p.x, p.y, p.z);
            const c = it.c || new THREE.Color('#ffffff'), n = g.attributes.position.count, col = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
            g.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(g);
          }
          const mesh = new THREE.Mesh(mergeGeometries(parts), mat); mesh.geometry.computeBoundingSphere();
          this.place(mesh, ch);
          continue;
        }
        const im = new THREE.InstancedMesh(geo, mat, arr.length);
        arr.forEach((it, i) => { im.setMatrixAt(i, it.m); if (it.c) im.setColorAt(i, it.c); else if (im.instanceColor || arr.some(a => a.c)) im.setColorAt(i, new THREE.Color('#ffffff')); });
        this.place(im, ch);
      }
    }
    scene.add(this.group);
  }
  place(im, ch) {
    if (im.isInstancedMesh) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
    im.matrixAutoUpdate = false;
    if (ch < 0) { this.group.add(im); return; }
    let g = this.chunks[ch];
    if (!g) {
      g = this.chunks[ch] = new THREE.Group();
      const i = Math.min(this.t.n - 1, ch * 200 + 100); g.userData.cx = this.t.x[i]; g.userData.cz = this.t.z[i];
      this.group.add(g);
    }
    g.add(im);
  }
  cull(cx, cz, dist) {
    const r = dist + 260;
    for (const g of this.chunks) if (g) { const dx = g.userData.cx - cx, dz = g.userData.cz - cz; g.visible = dx * dx + dz * dz < r * r; }
  }
}

/* ------------------------------------------------------------- themes */
const PASTEL = ['#f6d7a8', '#f2b8a0', '#f8efd8', '#f4c6c0', '#e8d2a8', '#fff2c8', '#f0e0c0'];
const CITY_DAY = ['#c8ccd4', '#b8b0a4', '#d8d4cc', '#9aa4b0', '#e0dcd4'];
const NEON = ['#ff2fa8', '#2fe0ff', '#ffcf2a', '#8a5bff', '#40ff9a', '#ff5a3a'];

export function populate(track, L, quality, scene) {
  const S = new Scenery(track, L, quality), T = L.theme, end = track.finishS, len = L.length;
  const town = (s0, s1, colors, hmin, hmax, lat1 = 70, per = 7) => S.scatter('bld', per, 4, lat1, {
    s0, s1, colors, build: (x, y, z, ry, sc, col, side, s) => {
      const w = 10 + S.r() * 14, d = 10 + S.r() * 12, h = hmin + S.r() * (hmax - hmin);
      S.building(x, y, z, track.th[track.idx(s)] + (S.r() < 0.5 ? 0 : Math.PI / 2), w, h, d, col);
    }
  });
  const nightLamps = (every, flood = false, warm = '#ffd9a0') => {
    S.along(flood ? 'flood' : 'lamp', every, 0.8, {
      facing: true, build: (p, side, s, ry, y) => {
        S.add(flood ? 'flood' : 'lamp', p.x, y, p.z, ry, 1);
        S.add(flood ? 'floodHead' : 'lampHead', p.x, y, p.z, ry, 1, new THREE.Color(warm));
        // light pool on the road
        const tmp = {}; track.at(s, side * (track.w[track.idx(s)] / 2 - 1.5), tmp);
        S.add('pool', tmp.x, tmp.y + 0.06, tmp.z, 0, flood ? 30 : 20, new THREE.Color(warm).multiplyScalar(flood ? 0.5 : 0.62), 1, flood ? 30 : 20);
      }
    });
  };
  const signs = (per, s0, s1) => S.scatter('sign', per, 2, 14, {
    s0, s1, face: 'road', build: (x, y, z, ry, sc, col, side) => {
      const c = new THREE.Color(NEON[(S.r() * NEON.length) | 0]);
      const h = 4 + S.r() * 7, w = 2.5 + S.r() * 4, tall = 1.5 + S.r() * 3.5;
      S.add('sign', x, y + h, z, ry, w, c, tall, 0.4);
      S.add('pole', x, y, z, ry, 1, null, h, 1);
    }
  });

  if (T === 'monaco') {
    const land = L.coast === 'left' ? -1 : 1;
    S.along('palm', 26, 2.2, { sides: [-land], s0: 0, s1: track.totalS });
    S.scatter('palm', 2.5, 3, 20, { side: land });
    S.scatter('house', 4, 8, 90, { side: land, colors: PASTEL, face: 'road', scale: [0.9, 1.5] });
    S.scatter('tree', 1.5, 6, 70, { side: land });
    S.scatter('yacht', 2, 30, 260, { side: -land, sea: true, scale: [0.8, 1.6] });
    town(0, START_S + 260, PASTEL, 12, 30);
    town(end - 200, track.totalS, PASTEL, 10, 26);
    S.far('mountain', 30, 500, 1300, { side: land, scale: [180, 420], hy: [0.7, 1.1], colors: ['#7a8a70'], sink: 10 });
  } else if (T === 'italy') {
    S.scatter('cypress', 4, 3, 50, { scale: [0.8, 1.3] });
    S.scatter('tree', 2.5, 10, 140);
    S.scatter('vine', 1.2, 25, 160, { face: 'road' });
    S.scatter('house', 0.8, 30, 160, { colors: ['#f2d8b0', '#e8c8a0', '#f4e4c8'], face: 'road', scale: [1, 1.4] });
    town(end - 300, track.totalS, ['#e8c8a0', '#d8b890', '#f0dcc0', '#c89878'], 14, 40);
    S.along('cypress', 22, 3, { s0: 0, s1: START_S + 400 });
    S.far('mountain', 26, 900, 1500, { scale: [300, 600], hy: [0.6, 0.9], sink: 20 });
  } else if (T === 'britain') {
    S.scatter('tree', 5, 4, 120, { scale: [0.9, 1.5] });
    S.along('hedge', 10.2, 2.4, { scale: 1 });
    S.scatter('cottage', 1, 20, 120, { face: 'road', colors: ['#c8bca8', '#b0a290', '#d4c8b4'] });
    S.scatter('sheep', 3, 14, 130, { scale: [0.9, 1.1] });
    town(end - 260, track.totalS, ['#b49a84', '#9a8070', '#c8b49c'], 8, 20);
  } else if (T === 'alps') {
    S.scatter('snowpine', 10, 3, 120, { scale: [0.8, 1.6], pow: 1.6 });
    S.scatter('pine', 3, 6, 120, { scale: [0.8, 1.5] });
    S.scatter('chalet', 0.8, 14, 90, { face: 'road' });
    S.scatter('rock', 1.6, 4, 60, { colors: ['#9aa0a8', '#c8ccd2'] });
    town(0, START_S + 200, ['#e8e0d0', '#f2ece0'], 10, 18, 50, 3);
    S.far('mountain', 46, 300, 1000, { scale: [220, 520], hy: [0.9, 1.5], sink: 30 });
  } else if (T === 'desert') {
    S.scatter('palm', 0.8, 3, 30, { s0: 0, s1: START_S + 900 });
    S.along('lamp', 50, 0.8, { facing: true });
    S.scatter('rock', 1, 10, 120, { colors: ['#c89060', '#b07850'] });
    town(0, START_S + 500, ['#d8e4ee', '#b8c8d8', '#e8eef4', '#a8b8c8'], 40, 180, 160, 6);
    town(end - 400, track.totalS, ['#e8eef4', '#d8e0e8', '#f4ecdc'], 20, 90, 120, 5);
    const tmp = {}; track.at(START_S + 120, 160, tmp); S.add('needle', tmp.x, track.groundY(tmp.x, tmp.z), tmp.z, 0, 1, null, null, null, -1);
  } else if (T === 'tokyo') {
    town(0, track.totalS, CITY_DAY, 18, 110, 60, 14);
    signs(5, 0, track.totalS);
    nightLamps(34);
    const tmp = {}; track.at(START_S + 700, -140, tmp); S.add('tower', tmp.x, track.groundY(tmp.x, tmp.z), tmp.z, 0, 1, null, null, null, -1);
  } else if (T === 'brazil') {
    const sea = L.coast === 'left' ? 1 : -1;
    S.scatter('jungle', 9, 3, 110, { side: -sea, scale: [0.8, 1.5], pow: 1.4 });
    S.scatter('jungle', 3, 3, 30, { side: sea, s1: track.totalS * 0.55 });
    S.scatter('palm', 3, 2, 20, { side: sea, s0: track.totalS * 0.45 });
    S.scatter('house', 2, 20, 120, { side: -sea, s0: end - 1200, colors: ['#f28a6a', '#f2d24a', '#6ac8f2', '#8af26a', '#f26aa8', '#ffffff'], scale: [0.7, 1] });
    town(end - 300, track.totalS, ['#f4f0e8', '#e8e0d0', '#d8e4ee'], 20, 70);
    S.far('hill', 14, 300, 900, { side: sea, sea: true, y: track.seaY - 4, scale: [70, 150], hy: [1.5, 2.6], colors: ['#3a6a3a', '#4a7a3a'] });
  } else if (T === 'vegas') {
    const strip = START_S + len * 0.4;
    S.scatter('casino', 6, 6, 70, { s0: 0, s1: strip, build: (x, y, z, ry, sc, col, side, s) => S.building(x, y, z, track.th[track.idx(s)], 30 + S.r() * 30, 30 + S.r() * 90, 26 + S.r() * 20, new THREE.Color(NEON[(S.r() * 6) | 0]).lerp(new THREE.Color('#ffffff'), 0.6), null, 'casino') });
    signs(6, 0, strip);
    nightLamps(30, false, '#ffe0a8');
    S.scatter('cactus', 3, 4, 120, { s0: strip, s1: track.totalS });
    S.scatter('rock', 2, 6, 140, { s0: strip, colors: ['#a0583a', '#8a4a30'] });
    S.along('lamp', 60, 0.8, { s0: strip, facing: true });
    S.far('mountain', 30, 600, 1300, { scale: [220, 480], hy: [0.4, 0.7], colors: ['#7a3a2a', '#8a4a30'], sink: 10, s0: strip - 600 });
    const tmp = {}; track.at(START_S + 300, 130, tmp);
    const py = track.groundY(tmp.x, tmp.z);
    S.add('pyramid', tmp.x, py, tmp.z, 0.3, 1, null, null, null, -1);
    S.add('beam', tmp.x, py + 70, tmp.z, 0, 1, new THREE.Color('#e8f0ff'), null, null, -1);
  } else if (T === 'outback') {
    const sea = L.coast === 'left' ? 1 : -1;
    S.scatter('euca', 3, 3, 110, { side: -sea, scale: [0.8, 1.4] });
    S.scatter('euca', 1, 3, 14, { side: sea });
    S.scatter('rock', 2.5, 4, 120, { side: -sea, colors: ['#a04a24', '#b8602e', '#8a3a1c'], scale: [0.8, 2.2] });
    town(0, START_S + 300, ['#e8e4dc', '#c8d4e0', '#f2e8d8'], 12, 60, 80, 6);
    town(end - 200, track.totalS, ['#f4ece0', '#e0d8c8'], 6, 14, 60, 4);
    S.far('mountain', 20, 700, 1400, { side: -sea, scale: [200, 420], hy: [0.3, 0.5], colors: ['#a0583a'], sink: 6 });
  } else if (T === 'singapore') {
    town(0, track.totalS, ['#c8d4e0', '#a8b8c8', '#e8eef4', '#b0c0d0'], 24, 140, 70, 10);
    S.scatter('supertree', 1.4, 6, 40, { scale: [0.7, 1.2] });
    signs(2, 0, track.totalS);
    nightLamps(26, true, '#f2f6ff');
    const tmp = {}; track.at(START_S + 400, -180, tmp);
    S.add('triple', tmp.x, track.groundY(tmp.x, tmp.z), tmp.z, track.th[track.idx(START_S + 400)], 1, new THREE.Color('#ffffff'), null, null, -1);
    track.at(START_S + 900, -150, tmp);
    S.add('wheel', tmp.x, track.groundY(tmp.x, tmp.z), tmp.z, track.th[track.idx(START_S + 900)] + Math.PI / 2, 1, null, null, null, -1);
  }
  S.finalize(scene);
  return S;
}

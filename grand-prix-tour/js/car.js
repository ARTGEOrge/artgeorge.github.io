/* A modern open-wheel Formula car.
 * Bodywork is lofted from smooth superellipse cross-sections (nose, survival
 * cell, engine cover, airbox, coke-bottle sidepods with undercut and inlets),
 * wings are real cambered airfoil sections (four-element front wing with
 * spoon tips, rear wing with DRS flap, beam wing), endplates and bargeboards
 * are curved plates, the halo is a swept tube, and the driver sits in the
 * cockpit with helmet, visor and HANS. Wheels are lathed tyres with rounded
 * shoulders and a compound stripe, dished rims with spokes and aero covers,
 * and a brake disc that glows under braking.
 *
 * Two detail levels: 'hi' (separate paint/carbon/dark/metal materials with
 * clear-coat and a carbon weave, for High/Ultra and close cars) and 'lo'
 * (one merged vertex-coloured mesh, for Low/Medium and distant cars).
 * Origin: centre between the axles on the ground, +z forward, +x left. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';
import * as HD from './textures-hd.js';

export const WHEELS = [
  { x: 0.80, z: 1.78, r: 0.36, w: 0.36, front: true },
  { x: -0.80, z: 1.78, r: 0.36, w: 0.36, front: true },
  { x: 0.78, z: -1.80, r: 0.37, w: 0.44, front: false },
  { x: -0.78, z: -1.80, r: 0.37, w: 0.44, front: false }
];

const CARBON = '#17171b', DARK = '#0b0b0e';
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();

/* ------------------------------------------------------------- helpers */
function place(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  e.set(rx, ry, rz); q.setFromEuler(e); m4.compose(v3.set(x, y, z), q, sc.set(sx, sy, sz));
  geo.applyMatrix4(m4); return geo;
}
function paint(geo, color) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (g.attributes.uv1) g.deleteAttribute('uv1');
  if (!g.attributes.normal) g.computeVertexNormals();
  if (g.attributes.color) return g;
  const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };

/* Loft a smooth tube through superellipse stations {z, w, h, y, x, p, bot}.
 * Stations are interpolated with Catmull-Rom so the surface flows. */
function loft(st, { radial = 18, sub = 3, color = '#fff', capColor = null, capStart = true, capEnd = true } = {}) {
  const keys = ['z', 'w', 'h', 'y', 'x', 'p', 'bot'];
  const S = st.map(s => ({ x: 0, p: 2.6, bot: 1, ...s }));
  const rings = [];
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[Math.max(0, i - 1)], b = S[i], c = S[i + 1], d = S[Math.min(S.length - 1, i + 2)];
    for (let k = 0; k < sub; k++) { const t = k / sub, r = {}; for (const key of keys) r[key] = cr(a[key], b[key], c[key], d[key], t); rings.push(r); }
  }
  rings.push({ ...S[S.length - 1] });
  const pos = [], col = [], idx = [];
  const C = new THREE.Color(color), CC = new THREE.Color(capColor || color);
  const ringPt = (r, k) => {
    const a = k / radial * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), ex = 2 / r.p;
    const px = Math.sign(c) * Math.pow(Math.abs(c), ex) * r.w / 2;
    const py = Math.sign(s) * Math.pow(Math.abs(s), ex) * r.h / 2 * (s < 0 ? r.bot : 1);
    return [r.x + px, r.y + py, r.z];
  };
  rings.forEach(r => { for (let k = 0; k < radial; k++) { pos.push(...ringPt(r, k)); col.push(C.r, C.g, C.b); } });
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < radial; k++) {
    const a = i * radial + k, b = i * radial + (k + 1) % radial, c = a + radial, d = b + radial;
    idx.push(a, c, b, b, c, d);
  }
  const cap = (ri, dir) => {
    const base = pos.length / 3, r = rings[ri];
    pos.push(r.x, r.y, r.z); col.push(CC.r, CC.g, CC.b);
    for (let k = 0; k < radial; k++) { pos.push(...ringPt(r, k)); col.push(CC.r, CC.g, CC.b); }
    for (let k = 0; k < radial; k++) { const a = base + 1 + k, b = base + 1 + (k + 1) % radial; if (dir > 0) idx.push(base, a, b); else idx.push(base, b, a); }
  };
  const dz = rings[rings.length - 1].z - rings[0].z;
  if (capStart) cap(0, dz > 0 ? -1 : 1);
  if (capEnd) cap(rings.length - 1, dz > 0 ? 1 : -1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // winding: ring k=0 is +x; the quad there must face +x
  if (dz < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* Cambered airfoil spanning x, leading edge at z=0 pointing +z. */
function airfoil(span, chord, { thick = 0.09, camber = 0.05, pitch = 0, lift = 0, sweep = 0, segs = 8, n = 10, mirrorCurve = true } = {}) {
  const shape = new THREE.Shape(), up = [], lo = [];
  for (let i = 0; i <= n; i++) {
    const x = (1 - Math.cos(Math.PI * i / n)) / 2;
    const yt = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = camber * 4 * x * (1 - x);
    up.push([x * chord, (yc + yt) * chord]); lo.push([x * chord, (yc - yt) * chord]);
  }
  shape.moveTo(...up[0]); for (let i = 1; i <= n; i++) shape.lineTo(...up[i]); for (let i = n; i >= 0; i--) shape.lineTo(...lo[i]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: span, bevelEnabled: false, steps: segs, curveSegments: 1 });
  const p = g.attributes.position, cp = Math.cos(pitch), sp = Math.sin(pitch);
  for (let i = 0; i < p.count; i++) {
    const sx = p.getX(i), sy = p.getY(i), sz = p.getZ(i);
    let x = sz - span / 2, y = sy, z = -sx;
    // pitch about the leading edge (positive = trailing edge up)
    const y2 = y * cp - z * sp, z2 = y * sp + z * cp; y = y2; z = z2;
    const t = Math.abs(x) / (span / 2);
    y += lift * t * t; z += sweep * t * t;
    p.setXYZ(i, x, y, z);
  }
  g.deleteAttribute('uv'); g.computeVertexNormals();
  return g;
}

/* Flat plate from a 2D outline in (z, y), thickness along x. */
function plate(pts, thick = 0.014) {
  const s = new THREE.Shape(); s.moveTo(-pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(-pts[i][0], pts[i][1]);
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 2 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const sx = p.getX(i), sy = p.getY(i), sz = p.getZ(i); p.setXYZ(i, sz - thick / 2, sy, -sx); }
  g.deleteAttribute('uv'); g.computeVertexNormals();
  return g;
}
function rod(a, b, r, segs = 6) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, len, segs, 1); g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  g.translate(A.x, A.y, A.z); return g;
}
function wishbone(a, b, w = 0.05, t = 0.014) { // flat aerofoil-section suspension arm
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const g = new THREE.BoxGeometry(t, len, w); g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  g.translate(A.x, A.y, A.z); return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/* Planar UVs from position/normal so the carbon weave can be mapped. */
function planarUV(g, s = 6) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * s; uv[i * 2 + 1] = v * s;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/* ------------------------------------------------------------- body */
/* Returns { paint, carbon, dark, metal, light } part lists (vertex coloured). */
function bodyParts(liv, hi) {
  const A = liv.a, B = liv.b, Cc = liv.c;
  const R = hi ? 22 : 12, SUB = hi ? 3 : 1;
  const out = { paint: [], carbon: [], dark: [], metal: [], light: [] };
  const add = (k, g, col, o) => out[k].push(paint(o ? place(g, o) : g, col));

  // nose, survival cell and engine cover as one flowing loft
  add('paint', loft([
    { z: 2.7, w: 0.12, h: 0.08, y: 0.215, p: 2.2, bot: 0.8 },
    { z: 2.45, w: 0.19, h: 0.13, y: 0.25, p: 2.3, bot: 0.8 },
    { z: 2.05, w: 0.27, h: 0.19, y: 0.32, p: 2.4, bot: 0.8 },
    { z: 1.55, w: 0.35, h: 0.26, y: 0.41, p: 2.6, bot: 0.8 },
    { z: 1.05, w: 0.44, h: 0.33, y: 0.48, p: 2.8, bot: 0.85 },
    { z: 0.6, w: 0.6, h: 0.42, y: 0.5, p: 3.0, bot: 0.9 },
    { z: 0.15, w: 0.78, h: 0.5, y: 0.5, p: 3.4, bot: 0.9 },
    { z: -0.3, w: 0.8, h: 0.56, y: 0.53, p: 3.4, bot: 0.9 },
    { z: -0.6, w: 0.74, h: 0.66, y: 0.58, p: 3.0, bot: 0.9 },
    { z: -1.0, w: 0.6, h: 0.6, y: 0.58, p: 2.8, bot: 0.9 },
    { z: -1.5, w: 0.42, h: 0.48, y: 0.52, p: 2.6, bot: 0.9 },
    { z: -1.95, w: 0.27, h: 0.33, y: 0.45, p: 2.4, bot: 0.9 },
    { z: -2.28, w: 0.17, h: 0.21, y: 0.4, p: 2.2, bot: 0.9 }
  ], { radial: R, sub: SUB, color: A, capColor: CARBON }));
  // nose tip in accent and a stripe down the nose and cover
  add('paint', loft([{ z: 2.72, w: 0.125, h: 0.085, y: 0.215, p: 2.2 }, { z: 2.5, w: 0.18, h: 0.125, y: 0.245, p: 2.3 }], { radial: R, sub: 1, color: B }));
  add('paint', loft([{ z: 2.3, w: 0.06, h: 0.02, y: 0.335 }, { z: 1.6, w: 0.14, h: 0.02, y: 0.548 }, { z: 1.0, w: 0.2, h: 0.02, y: 0.652 }], { radial: 8, sub: SUB, color: B }));
  add('paint', loft([{ z: -0.75, w: 0.3, h: 0.02, y: 0.905 }, { z: -1.4, w: 0.2, h: 0.02, y: 0.77 }, { z: -2.0, w: 0.1, h: 0.02, y: 0.6 }], { radial: 8, sub: SUB, color: B }));
  // cockpit opening, rim and headrest
  add('dark', loft([{ z: 0.45, w: 0.3, h: 0.05, y: 0.75 }, { z: 0.0, w: 0.5, h: 0.05, y: 0.786 }, { z: -0.45, w: 0.48, h: 0.05, y: 0.82 }], { radial: R, sub: SUB, color: DARK }));
  add('carbon', loft([{ z: -0.32, w: 0.56, h: 0.12, y: 0.82, p: 3 }, { z: -0.6, w: 0.5, h: 0.14, y: 0.87, p: 3 }], { radial: R, sub: 1, color: CARBON }));
  // airbox above the driver with intake
  add('paint', loft([
    { z: -0.3, w: 0.36, h: 0.34, y: 0.99, p: 2.6, bot: 0.8 }, { z: -0.55, w: 0.34, h: 0.32, y: 0.98, p: 2.6 },
    { z: -0.95, w: 0.2, h: 0.2, y: 0.88, p: 2.4 }, { z: -1.3, w: 0.08, h: 0.08, y: 0.74 }
  ], { radial: R, sub: SUB, color: A, capColor: DARK }));
  add('paint', box(0.1, 0.06, 0.18), B, { y: 1.19, z: -0.45 }); // T-camera
  // roll-hoop blades either side of the intake
  add('carbon', box(0.03, 0.16, 0.24), CARBON, { x: 0.19, y: 1.0, z: -0.42 });
  add('carbon', box(0.03, 0.16, 0.24), CARBON, { x: -0.19, y: 1.0, z: -0.42 });
  // shark fin
  add('paint', plate([[-0.75, 0.98], [-2.1, 0.68], [-2.15, 0.82], [-1.2, 1.02], [-0.85, 1.07]], 0.012), A);

  for (const s of [1, -1]) {
    // sidepods: wide inlet, undercut, coke-bottle taper
    add('paint', loft([
      { z: 0.62, w: 0.42, h: 0.44, y: 0.46, x: s * 0.6, p: 3.6, bot: 0.6 },
      { z: 0.35, w: 0.5, h: 0.48, y: 0.45, x: s * 0.63, p: 3.4, bot: 0.55 },
      { z: -0.2, w: 0.48, h: 0.44, y: 0.42, x: s * 0.6, p: 3.0, bot: 0.5 },
      { z: -0.8, w: 0.38, h: 0.36, y: 0.37, x: s * 0.52, p: 2.8, bot: 0.55 },
      { z: -1.35, w: 0.24, h: 0.26, y: 0.31, x: s * 0.42, p: 2.6, bot: 0.6 },
      { z: -1.75, w: 0.14, h: 0.16, y: 0.27, x: s * 0.3, p: 2.4 }
    ], { radial: R, sub: SUB, color: A, capColor: DARK }));
    // inlet lip and accent sweep along the pod
    add('dark', loft([{ z: 0.63, w: 0.36, h: 0.32, y: 0.47, x: s * 0.6, p: 3.6 }, { z: 0.58, w: 0.36, h: 0.32, y: 0.47, x: s * 0.6, p: 3.6 }], { radial: R, sub: 1, color: DARK }));
    add('paint', loft([
      { z: 0.4, w: 0.44, h: 0.02, y: 0.69, x: s * 0.63 }, { z: -0.3, w: 0.4, h: 0.02, y: 0.645, x: s * 0.6 },
      { z: -1.0, w: 0.26, h: 0.02, y: 0.53, x: s * 0.5 }, { z: -1.6, w: 0.08, h: 0.02, y: 0.41, x: s * 0.36 }
    ], { radial: 8, sub: SUB, color: B }));
    // engine cooling louvres on the pod top
    if (hi) for (let k = 0; k < 5; k++) add('dark', box(0.2, 0.012, 0.03), DARK, { x: s * 0.55, y: 0.656 - k * 0.012, z: -0.45 - k * 0.09 });
    // mirrors: housing on two stalks
    add('paint', loft([{ z: 0.52, w: 0.17, h: 0.07, y: 0.82, x: s * 0.5, p: 3 }, { z: 0.44, w: 0.19, h: 0.08, y: 0.82, x: s * 0.5, p: 3 }, { z: 0.38, w: 0.16, h: 0.06, y: 0.82, x: s * 0.5, p: 3 }], { radial: 10, sub: 1, color: A, capColor: '#9aa4b0' }));
    add('carbon', rod([s * 0.36, 0.66, 0.46], [s * 0.47, 0.8, 0.45], 0.011), CARBON);
    add('carbon', rod([s * 0.4, 0.6, 0.38], [s * 0.52, 0.79, 0.42], 0.009), CARBON);
    // bargeboards / turning vanes ahead of the pods
    add('carbon', plate([[1.15, 0.1], [0.62, 0.1], [0.62, 0.32], [0.85, 0.36], [1.1, 0.24]], 0.012), CARBON, { x: s * 0.42, ry: s * 0.12 });
    add('carbon', plate([[1.0, 0.1], [0.7, 0.1], [0.72, 0.27], [0.95, 0.22]], 0.01), CARBON, { x: s * 0.5, ry: s * 0.18 });
    // floor edge wing
    add('carbon', airfoil(1.4, 0.1, { thick: 0.12, camber: 0.08, pitch: 0.3 }), CARBON, { x: s * 0.73, y: 0.1, z: -0.35, ry: Math.PI / 2 });
    // front wing endplates and their footplates
    add('paint', plate([[2.95, 0.05], [2.25, 0.05], [2.2, 0.24], [2.45, 0.33], [2.85, 0.28], [2.98, 0.16]], 0.016), A, { x: s * 0.955 });
    add('carbon', box(0.12, 0.012, 0.66), CARBON, { x: s * 0.92, y: 0.055, z: 2.6 });
    // rear wing endplates: rounded 2022-style tips sweeping into the floor
    add('paint', plate([[-2.12, 0.42], [-2.2, 0.92], [-2.38, 1.0], [-2.68, 0.98], [-2.78, 0.82], [-2.7, 0.62], [-2.5, 0.48], [-2.3, 0.4]], 0.018), A, { x: s * 0.5 });
    add('paint', plate([[-2.22, 0.88], [-2.68, 0.92], [-2.7, 0.86], [-2.24, 0.82]], 0.02), B, { x: s * 0.506 });
    // suspension: wishbones, push/pull rods, track rods
    add('carbon', wishbone([s * 0.2, 0.52, 1.98], [s * 0.66, 0.46, 1.8]), CARBON);
    add('carbon', wishbone([s * 0.2, 0.52, 1.48], [s * 0.66, 0.46, 1.8]), CARBON);
    add('carbon', wishbone([s * 0.17, 0.28, 2.0], [s * 0.67, 0.25, 1.8]), CARBON);
    add('carbon', wishbone([s * 0.17, 0.28, 1.42], [s * 0.67, 0.25, 1.8]), CARBON);
    add('carbon', rod([s * 0.22, 0.6, 1.6], [s * 0.64, 0.27, 1.78], 0.012), CARBON);
    add('carbon', wishbone([s * 0.18, 0.3, -1.55], [s * 0.6, 0.28, -1.8]), CARBON);
    add('carbon', wishbone([s * 0.18, 0.3, -2.0], [s * 0.6, 0.28, -1.8]), CARBON);
    add('carbon', wishbone([s * 0.16, 0.5, -1.75], [s * 0.6, 0.48, -1.82]), CARBON);
    add('carbon', rod([s * 0.2, 0.25, -1.6], [s * 0.6, 0.5, -1.8], 0.012), CARBON);
    // uprights and brake ducts
    add('carbon', loft([{ z: 1.92, w: 0.08, h: 0.26, y: 0.36, x: s * 0.66 }, { z: 1.64, w: 0.1, h: 0.3, y: 0.36, x: s * 0.66 }], { radial: 10, sub: 1, color: CARBON }));
    add('carbon', loft([{ z: -1.62, w: 0.12, h: 0.36, y: 0.38, x: s * 0.6 }, { z: -1.98, w: 0.12, h: 0.3, y: 0.38, x: s * 0.6 }], { radial: 10, sub: 1, color: CARBON }));
  }
  // floor: outline in plan view, extruded thin; flicks and plank
  const fl = new THREE.Shape();
  fl.moveTo(-0.42, 1.0); fl.lineTo(0.42, 1.0); fl.quadraticCurveTo(0.74, 0.62, 0.78, 0.2); fl.lineTo(0.78, -1.35);
  fl.quadraticCurveTo(0.72, -1.7, 0.52, -1.95); fl.lineTo(-0.52, -1.95); fl.quadraticCurveTo(-0.72, -1.7, -0.78, -1.35); fl.lineTo(-0.78, 0.2); fl.quadraticCurveTo(-0.74, 0.62, -0.42, 1.0);
  const flg = new THREE.ExtrudeGeometry(fl, { depth: 0.03, bevelEnabled: false, curveSegments: hi ? 8 : 3 });
  flg.rotateX(Math.PI / 2); flg.translate(0, 0.1, 0); flg.deleteAttribute('uv');
  add('carbon', flg, CARBON);
  add('dark', box(0.3, 0.02, 2.6), '#3a3020', { y: 0.065, z: -0.4 }); // plank
  // diffuser ramp with strakes
  add('carbon', plate([[-1.6, 0.08], [-2.35, 0.08], [-2.35, 0.36], [-1.95, 0.2]], 1.02), CARBON);
  for (let k = -2; k <= 2; k++) add('carbon', plate([[-1.75, 0.08], [-2.34, 0.08], [-2.34, 0.34]], 0.012), CARBON, { x: k * 0.2 });
  // front wing: four elements with spoon tips, mainplane dips at the centre
  add('carbon', airfoil(1.86, 0.34, { thick: 0.07, camber: 0.06, pitch: -0.06, lift: 0.05, sweep: -0.02, segs: hi ? 10 : 4 }), CARBON, { y: 0.075, z: 2.9 });
  add('paint', airfoil(1.82, 0.2, { thick: 0.08, camber: 0.08, pitch: 0.18, lift: 0.07, sweep: -0.06, segs: hi ? 10 : 4 }), B, { y: 0.12, z: 2.62 });
  add('paint', airfoil(1.78, 0.16, { thick: 0.08, camber: 0.09, pitch: 0.36, lift: 0.09, sweep: -0.1, segs: hi ? 10 : 4 }), A, { y: 0.175, z: 2.46 });
  add('paint', airfoil(1.72, 0.12, { thick: 0.09, camber: 0.1, pitch: 0.55, lift: 0.1, sweep: -0.13, segs: hi ? 10 : 4 }), B, { y: 0.23, z: 2.33 });
  add('carbon', box(0.03, 0.17, 0.24), CARBON, { x: 0.07, y: 0.17, z: 2.55 });
  add('carbon', box(0.03, 0.17, 0.24), CARBON, { x: -0.07, y: 0.17, z: 2.55 });
  // rear wing main plane, swan-neck pylon, beam wing
  add('paint', airfoil(1.0, 0.3, { thick: 0.1, camber: 0.1, pitch: 0.2, lift: 0.03, segs: hi ? 8 : 3 }), A, { y: 0.84, z: -2.3 });
  add('carbon', rod([0, 0.42, -2.28], [0, 0.78, -2.42], 0.022), CARBON);
  add('carbon', rod([0.04, 0.42, -2.28], [0.04, 0.78, -2.42], 0.015), CARBON);
  add('carbon', airfoil(0.95, 0.16, { thick: 0.1, camber: 0.08, pitch: 0.25, segs: 3 }), CARBON, { y: 0.4, z: -2.15 });
  add('carbon', airfoil(0.95, 0.12, { thick: 0.1, camber: 0.08, pitch: 0.45, segs: 3 }), CARBON, { y: 0.46, z: -2.3 });
  // crash structure and rain light
  add('carbon', loft([{ z: -2.2, w: 0.16, h: 0.16, y: 0.33 }, { z: -2.42, w: 0.1, h: 0.1, y: 0.32 }], { radial: 10, sub: 1, color: CARBON }));
  add('light', box(0.11, 0.07, 0.03), '#ff2020', { y: 0.32, z: -2.44 });
  add('light', box(0.04, 0.04, 0.02), '#ff2020', { x: 0.5, y: 0.5, z: -2.73 });
  add('light', box(0.04, 0.04, 0.02), '#ff2020', { x: -0.5, y: 0.5, z: -2.73 });
  // halo: swept tube with forward pillar
  const halo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.36, 0.76, -0.36), new THREE.Vector3(0.33, 0.9, -0.05), new THREE.Vector3(0.2, 0.96, 0.22),
    new THREE.Vector3(0, 0.975, 0.3), new THREE.Vector3(-0.2, 0.96, 0.22), new THREE.Vector3(-0.33, 0.9, -0.05), new THREE.Vector3(-0.36, 0.76, -0.36)]), hi ? 30 : 12, 0.032, hi ? 10 : 6);
  add('carbon', halo, Cc);
  add('carbon', loft([{ z: 0.3, w: 0.07, h: 0.05, y: 0.96, p: 2 }, { z: 0.45, w: 0.06, h: 0.05, y: 0.86, p: 2 }, { z: 0.6, w: 0.08, h: 0.05, y: 0.72, p: 2 }], { radial: 8, sub: 2, color: Cc }));
  // driver: helmet with accent stripe, dark visor, HANS and shoulders
  add('paint', new THREE.SphereGeometry(0.135, hi ? 20 : 10, hi ? 14 : 7), B, { y: 0.9, z: -0.16, sz: 1.14 });
  add('paint', new THREE.SphereGeometry(0.137, hi ? 20 : 10, hi ? 6 : 3, 0, Math.PI * 2, 0, 0.55), A, { y: 0.9, z: -0.16, sz: 1.14 });
  add('paint', new THREE.SphereGeometry(0.139, hi ? 16 : 8, 5, -0.95, 1.9, 1.15, 0.55), '#05070a', { y: 0.9, z: -0.16, sz: 1.14 });
  add('dark', loft([{ z: -0.05, w: 0.36, h: 0.1, y: 0.8 }, { z: -0.3, w: 0.4, h: 0.12, y: 0.8 }], { radial: 10, sub: 1, color: '#22242a' }));
  // steering wheel peeking above the cockpit rim
  add('dark', box(0.26, 0.1, 0.03), '#202228', { y: 0.82, z: 0.18, rx: -0.4 });
  return out;
}

/* ------------------------------------------------------------- materials */
let MATS = null;
export function materials() {
  if (MATS) return MATS;
  const carbonTex = HD.carbon();
  MATS = {
    paint: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.1, clearcoat: 0.55, clearcoatRoughness: 0.12, envMapIntensity: 0.55 }),
    carbon: new THREE.MeshStandardMaterial({ map: carbonTex, vertexColors: true, roughness: 0.32, metalness: 0.25, envMapIntensity: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 }),
    light: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    lo: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.2 }),
    tyre: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.0 }),
    rim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.85 }),
    wheelLo: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 })
  };
  return MATS;
}
export const bodyMaterial = null; // kept for older imports

const geoCache = new Map();
function carGeometries(liv, detail) {
  const key = detail + liv.a + liv.b + liv.c;
  if (geoCache.has(key)) return geoCache.get(key);
  const parts = bodyParts(liv, detail === 'hi');
  let res;
  if (detail === 'hi') {
    res = {};
    for (const k of ['paint', 'carbon', 'dark', 'light']) {
      const g = mergeGeometries(parts[k], false);
      if (k === 'carbon') planarUV(g, 7);
      g.computeBoundingSphere(); res[k] = g;
    }
  } else {
    const g = mergeGeometries([...parts.paint, ...parts.carbon, ...parts.dark, ...parts.light], false);
    g.computeBoundingSphere(); res = { lo: g };
  }
  geoCache.set(key, res);
  return res;
}

/* ------------------------------------------------------------- wheels */
/* Unit wheel (radius 1, width 1, axis x); scaled per instance. */
const wheelCache = {};
export function wheelParts(detail = 'hi', compound = '#e8202a') {
  const key = detail + compound;
  if (wheelCache[key]) return wheelCache[key];
  const hi = detail === 'hi', seg = hi ? 32 : 16;
  // tyre profile (radius, axial): inner bead -> sidewall -> rounded shoulder -> tread
  const prof = [], cols = [];
  const rub = new THREE.Color('#1a1a1d'), cmp = new THREE.Color(compound), side = new THREE.Color('#222226');
  const push = (r, a, c) => { prof.push(new THREE.Vector2(r, a)); cols.push(c); };
  push(0.64, -0.5, side); push(0.76, -0.5, side); push(0.76, -0.5, cmp); push(0.82, -0.5, cmp); push(0.82, -0.5, side);
  for (let k = 0; k <= (hi ? 6 : 3); k++) { const t = k / (hi ? 6 : 3) * Math.PI / 2; push(0.9 + Math.sin(t) * 0.1, -0.5 + (1 - Math.cos(t)) * 0.12, rub); }
  for (let k = 0; k <= (hi ? 6 : 3); k++) { const t = k / (hi ? 6 : 3) * Math.PI / 2; push(1.0 - (1 - Math.cos(t)) * 0.1, 0.38 + Math.sin(t) * 0.12, rub); }
  push(0.82, 0.5, side); push(0.82, 0.5, cmp); push(0.76, 0.5, cmp); push(0.76, 0.5, side); push(0.64, 0.5, side);
  const lathe = (pp, cc) => {
    const g = new THREE.LatheGeometry(pp, seg);
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    // lathe vertex order: for each segment, every profile point
    for (let i = 0; i < n; i++) { const c = cc[i % pp.length]; col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv'); g.rotateZ(Math.PI / 2); g.computeVertexNormals();
    return g.toNonIndexed();
  };
  const tyre = lathe(prof, cols);
  // rim: dished barrel, spokes, hub nut and an aero cover ring on the outside face
  const rimParts = [];
  const rp = [new THREE.Vector2(0.64, -0.46), new THREE.Vector2(0.62, -0.3), new THREE.Vector2(0.62, 0.3), new THREE.Vector2(0.64, 0.46)];
  rimParts.push(lathe(rp, rp.map(() => new THREE.Color('#2c2e34'))));
  for (const s of [0.42, -0.42]) {
    const disc = new THREE.RingGeometry(0.2, 0.64, seg, 1); disc.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2); disc.translate(s, 0, 0);
    rimParts.push(paint(disc, hi ? '#1c1d22' : '#303238'));
    const lip = new THREE.RingGeometry(0.6, 0.66, seg, 1); lip.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2); lip.translate(s * 1.02, 0, 0);
    rimParts.push(paint(lip, '#b8bcc4'));
    for (let k = 0; k < 5; k++) rimParts.push(paint(place(box(0.035, 1.22, 0.06), { x: s * 1.04, rx: k * Math.PI / 5 }), '#8a8e96'));
    rimParts.push(paint(place(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 10), { x: s * 1.05, rz: Math.PI / 2 }), '#d8a020'));
  }
  // the spokes were built around the hub; push them outward
  const rim = mergeGeometries(rimParts.map(g => g.index ? g.toNonIndexed() : g));
  rim.computeBoundingSphere();
  const res = { tyre, rim, merged: mergeGeometries([tyre, rim]) };
  wheelCache[key] = res; return res;
}
export function wheelGeometry() { return wheelParts('lo').merged; }

let flapGeoHi = null, flapGeoLo = null;
function flapGeometry(hi) {
  if (hi && flapGeoHi) return flapGeoHi; if (!hi && flapGeoLo) return flapGeoLo;
  const g = airfoil(0.98, 0.2, { thick: 0.09, camber: 0.1, pitch: 0, segs: hi ? 6 : 2 });
  if (hi) flapGeoHi = g; else flapGeoLo = g; return g;
}

/* Decal planes: race number on the cover sides and nose, team name on the endplates. */
function decalGeometry() {
  const parts = [];
  const mk = (w, h, u0, u1, o) => {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + (u1 - u0) * uv.getX(i));
    place(g, o); parts.push(g);
  };
  mk(0.38, 0.19, 0, 0.5, { x: 0.262, y: 0.7, z: -1.15, ry: Math.PI / 2 + 0.3 });
  mk(0.38, 0.19, 0, 0.5, { x: -0.262, y: 0.7, z: -1.15, ry: -Math.PI / 2 - 0.3 });
  mk(0.5, 0.13, 0.5, 1, { x: 0.511, y: 0.76, z: -2.45, ry: Math.PI / 2 });
  mk(0.5, 0.13, 0.5, 1, { x: -0.511, y: 0.76, z: -2.45, ry: -Math.PI / 2 });
  mk(0.24, 0.12, 0, 0.5, { x: 0, y: 0.6, z: 1.3, rx: -Math.PI / 2 + 0.16, rz: Math.PI });
  return mergeGeometries(parts);
}
let decalGeo = null;

/* Build a car. detail 'hi' also carries a merged 'lo' copy for distance LOD. */
export function makeCar(liv, { detail = 'hi', standalone = false, shadows = false } = {}) {
  const M = materials();
  const group = new THREE.Group();
  const lo = new THREE.Mesh(carGeometries(liv, 'lo').lo, M.lo);
  group.add(lo);
  let hiGroup = null;
  if (detail === 'hi') {
    const G = carGeometries(liv, 'hi');
    hiGroup = new THREE.Group();
    for (const k of ['paint', 'carbon', 'dark', 'light']) {
      const m = new THREE.Mesh(G[k], M[k]);
      m.castShadow = shadows && k !== 'light'; hiGroup.add(m);
    }
    group.add(hiGroup); lo.visible = false;
  }
  const flapMat = new THREE.MeshPhysicalMaterial({ color: liv.b, roughness: 0.3, metalness: 0.15, clearcoat: detail === 'hi' ? 1 : 0 });
  const flap = new THREE.Mesh(flapGeometry(detail === 'hi'), flapMat);
  flap.position.set(0, 0.99, -2.32); flap.rotation.x = 0.55; flap.castShadow = shadows; group.add(flap);
  if (!decalGeo) decalGeo = decalGeometry();
  const decTex = TX.decal({ ...liv, b: liv.b === '#ffffff' || liv.b === '#f5f5f5' ? '#ffffff' : liv.b });
  const dec = new THREE.Mesh(decalGeo, new THREE.MeshStandardMaterial({ map: decTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.35 }));
  group.add(dec);
  const wheels = [];
  if (standalone) {
    const W = wheelParts(detail);
    for (const w of WHEELS) {
      const wg = new THREE.Group();
      if (detail === 'hi') { wg.add(new THREE.Mesh(W.tyre, M.tyre)); wg.add(new THREE.Mesh(W.rim, M.rim)); }
      else wg.add(new THREE.Mesh(W.merged, M.wheelLo));
      wg.scale.set(w.w, w.r, w.r); wg.position.set(w.x, w.r, w.z);
      wg.children.forEach(c => c.castShadow = shadows);
      group.add(wg); wheels.push(wg);
    }
  }
  // the helmet is part of the body now; cockpit view hides the whole hi group's driver via a clipping flag
  group.userData = { lo, hi: hiGroup, flap, dec, wheels, liv, helmet: { visible: true } };
  return group;
}

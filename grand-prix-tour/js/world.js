/* Scenery kits for World Tour II and III (races 11-30): extra low-poly props
 * and one populate function per location. Landmarks are generic stand-ins
 * built from boxes, cones and domes — no real logos or brands. */
import * as THREE from 'three';
import { P, M, cyl, cone, ico, bx, dome } from './geo.js';
import { START_S } from './track.js';

/* A box from a to b (2D in the x/y plane at depth z), for cables and girders. */
function beam(x0, y0, x1, y1, z, t, color) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  const g = new THREE.BoxGeometry(len, t, t);
  return P(g, color, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z, rz: Math.atan2(dy, dx) });
}
const CABLE = [[-250, 40], [-150, 95], [-75, 58], [0, 46], [75, 58], [150, 95], [250, 40]];

export const GEO2 = {
  /* wrought-iron lattice tower (generic) */
  irontower() {
    const parts = [], c = '#5a4636', c2 = '#6a5442';
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      parts.push(P(bx(3.4, 64, 3.4), c, { x: sx * 22, z: sz * 22, rz: sx * 0.235, rx: -sz * 0.235 }));
      parts.push(P(bx(2.2, 62, 2.2), c2, { x: sx * 8, y: 58, z: sz * 8, rz: sx * 0.07, rx: -sz * 0.07 }));
    }
    for (const y of [20, 40]) { const w = 44 - y * 0.47; for (const s of [1, -1]) { parts.push(P(bx(w, 1.2, 1.2), c, { y, z: s * w / 2 })); parts.push(P(bx(1.2, 1.2, w), c, { y, x: s * w / 2 })); } }
    parts.push(P(bx(34, 3, 34), c2, { y: 57 }), P(bx(14, 2.5, 14), c2, { y: 118 }));
    parts.push(P(cyl(3.6, 1.2, 64, 4), c, { y: 120, ry: Math.PI / 4 }), P(bx(5, 4, 5), c2, { y: 182 }), P(cyl(0.5, 0.2, 22, 4), '#888', { y: 186 }));
    return M(parts);
  },
  /* long classical palace with wings */
  palace() {
    const parts = [P(bx(150, 18, 26), '#e6dcc4'), P(bx(150, 5, 22), '#5e6670', { y: 18 }), P(bx(40, 24, 32), '#ece2ca'), P(bx(41, 1.4, 33), '#d8b04a', { y: 24 }), P(bx(30, 6, 26), '#5e6670', { y: 25 })];
    for (const s of [1, -1]) parts.push(P(bx(24, 18, 70), '#e6dcc4', { x: s * 63, z: -22 }), P(bx(24, 4, 66), '#5e6670', { x: s * 63, y: 18, z: -22 }));
    for (let x = -70; x <= 70; x += 8) if (Math.abs(x) > 22) parts.push(P(bx(3, 7, 0.4), '#3a4450', { x, y: 5, z: 13.1 }));
    return M(parts);
  },
  /* cluster of sandstone spires (basilica stand-in) */
  spires() {
    const parts = [P(bx(56, 38, 34), '#c8b08a')], c = '#c8b08a', t = '#e8d8b0';
    [[-20, 70, 4], [-7, 92, 4.5], [7, 92, 4.5], [20, 70, 4], [0, 118, 6]].forEach(([x, h, r]) => {
      parts.push(P(cyl(r, r * 0.85, h, 8), c, { x, z: x === 0 ? -8 : 10 }), P(cone(r * 1.05, 26, 8), t, { x, y: h, z: x === 0 ? -8 : 10 }), P(ico(1.6, 0), '#e8c060', { x, y: h + 27, z: x === 0 ? -8 : 10 }));
    });
    return M(parts);
  },
  castle() {
    const parts = [], w = '#8a8680', roof = '#4a4e58';
    for (const s of [1, -1]) { parts.push(P(bx(40, 14, 3), w, { z: s * 20 }), P(bx(3, 14, 40), w, { x: s * 20 })); }
    for (const [x, z] of [[20, 20], [20, -20], [-20, 20], [-20, -20]]) parts.push(P(cyl(5, 5, 22, 10), w, { x, z }), P(cone(6, 9, 10), roof, { x, y: 22, z }));
    parts.push(P(bx(14, 30, 14), '#7a766e'), P(cone(9.5, 10, 4), roof, { y: 30, ry: Math.PI / 4 }));
    return M(parts);
  },
  ruin() {
    const parts = [], w = '#6e6a64';
    parts.push(P(bx(36, 12, 3), w, { z: 18 }), P(bx(3, 9, 30), w, { x: 18, z: 2 }), P(bx(18, 6, 3), w, { x: -9, z: -18 }));
    parts.push(P(cyl(6, 6, 24, 9), w, { x: 18, z: 18 }), P(cyl(5, 5, 11, 9), w, { x: -18, z: 18 }), P(bx(12, 18, 12), '#625e58', { x: -6, z: 4 }));
    return M(parts);
  },
  steam() { return M([P(cyl(3, 10, 46, 8), '#ffffff'), P(cyl(10, 14, 20, 8), '#ffffff', { y: 46 })]); },
  bush() { return M([P(ico(1.2, 0), '#ffffff', { y: 0.35, sy: 0.55 }), P(ico(0.9, 0), '#e8e8e8', { x: 1, y: 0.3, sy: 0.5 })]); },
  kasbah() {
    const parts = [P(bx(16, 11, 16), '#ffffff'), P(bx(19, 10, 19), '#e8e8e8', { y: -10 })]; // foundation for slopes
    for (const [x, z] of [[8, 8], [8, -8], [-8, 8], [-8, -8]]) {
      parts.push(P(cyl(2.9, 2.1, 16, 4), '#f2f2f2', { x, z, ry: Math.PI / 4 }));
      for (let k = 0; k < 4; k++) parts.push(P(bx(0.8, 1.1, 0.8), '#f2f2f2', { x: x + (k % 2 ? 1 : -1) * 1.2, y: 16, z: z + (k < 2 ? 1 : -1) * 1.2 }));
    }
    for (let i = -6; i <= 6; i += 2) parts.push(P(bx(0.9, 0.9, 0.9), '#f2f2f2', { x: i, y: 11, z: 8 }), P(bx(0.9, 0.9, 0.9), '#f2f2f2', { x: i, y: 11, z: -8 }));
    for (const x of [-4, 0, 4]) parts.push(P(bx(1, 1.6, 0.3), '#2a1a14', { x, y: 6, z: 8.05 }));
    return M(parts);
  },
  pyr2() { return M([P(cone(60, 72, 4), '#d8b47a', { ry: Math.PI / 4 }), P(cone(9, 10.8, 4), '#e8d4a8', { y: 61.2, ry: Math.PI / 4 })]); },
  mosque() {
    const s = '#e2dcd0', d = '#8a96a0', parts = [P(bx(30, 12, 30), s), P(cyl(11, 11, 4, 16), s, { y: 12 }), P(dome(11, 16), d, { y: 16 }), P(cyl(0.3, 0.2, 5, 4), '#d8b040', { y: 27 })];
    for (const [x, z] of [[15, 0], [-15, 0], [0, 15], [0, -15]]) parts.push(P(dome(6, 10), d, { x, y: 11.5, z }));
    for (const [x, z] of [[22, 22], [22, -22], [-22, 22], [-22, -22]]) parts.push(P(cyl(1.3, 1.0, 40, 8), '#ece6da', { x, z }), P(cyl(2, 2, 1.2, 8), s, { x, y: 30, z }), P(cone(1.5, 9, 8), d, { x, y: 40, z }));
    return M(parts);
  },
  bridge() {
    const parts = [], t = '#8a929c', c = '#c8ccd4';
    for (const x of [-150, 150]) {
      for (const z of [-12, 12]) parts.push(P(bx(5, 98, 5), t, { x, z }));
      for (const y of [62, 94]) parts.push(P(bx(5, 4, 29), t, { x, y }));
    }
    parts.push(P(bx(520, 3, 24), '#6a7078', { y: 37 }));
    for (const z of [-12, 12]) for (let i = 0; i < CABLE.length - 1; i++) parts.push(beam(CABLE[i][0], CABLE[i][1], CABLE[i + 1][0], CABLE[i + 1][1], z, 0.9, c));
    return M(parts);
  },
  bridgeGlow() {
    const parts = [];
    for (const z of [-12.6, 12.6]) for (let i = 0; i < CABLE.length - 1; i++) {
      const [x0, y0] = CABLE[i], [x1, y1] = CABLE[i + 1];
      for (let k = 0; k < 6; k++) { const f = k / 6; parts.push(P(bx(1.4, 1.4, 0.4), '#9fd8ff', { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, z })); }
    }
    for (let x = -250; x <= 250; x += 12) parts.push(P(bx(1.2, 0.8, 0.4), '#ffd9a0', { x, y: 40, z: 12.4 }), P(bx(1.2, 0.8, 0.4), '#ffd9a0', { x, y: 40, z: -12.4 }));
    return M(parts);
  },
  stupa() { return M([P(bx(11, 3, 11), '#f2efe6'), P(dome(5.2, 12), '#f6f4ee', { y: 3 }), P(bx(2.6, 2.2, 2.6), '#d8c8a0', { y: 8 }), P(cone(1.4, 7, 8), '#d8a830', { y: 10.2 })]); },
  flagline() {
    const parts = [P(cyl(0.09, 0.07, 6.5, 4), '#6a5a48', { x: -6 }), P(cyl(0.09, 0.07, 6.5, 4), '#6a5a48', { x: 6 })];
    const cols = ['#2a5ad8', '#f2f2f2', '#d82a2a', '#2aa84a', '#f2c82a'];
    for (let i = 0; i < 10; i++) { const x = -5.4 + i * 1.2, sag = 0.9 * (1 - Math.pow(x / 6, 2)); parts.push(P(bx(0.95, 0.8, 0.04), cols[i % 5], { x, y: 5.6 - sag })); }
    return M(parts);
  },
  pearl() {
    const parts = [P(cyl(5, 3.5, 250, 8), '#b8bcc8'), P(cyl(0.9, 0.3, 70, 5), '#c8ccd8', { y: 250 })];
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; parts.push(P(cyl(2.4, 2, 92, 6), '#a8acb8', { x: Math.cos(a) * 16, z: Math.sin(a) * 16, rz: Math.cos(a) * 0.17, rx: -Math.sin(a) * 0.17 })); }
    parts.push(P(cyl(13, 13, 3, 12), '#9aa0ac', { y: 150 }));
    return M(parts);
  },
  pearlGlow() { return M([P(ico(17, 2), '#ff5aa0', { y: 92 }), P(ico(10, 2), '#ff5aa0', { y: 238 }), P(ico(5, 1), '#ffd0e8', { y: 158 })]); },
  needle2() { return M([P(cyl(3.2, 2.2, 120, 8), '#c8ccd4'), P(cyl(0.6, 0.2, 40, 5), '#d8dce4', { y: 132 })]); },
  podGlow() { return M([P(cyl(9, 9, 11, 14), '#9fe8ff', { y: 98 }), P(cyl(6, 6, 3, 14), '#ffffff', { y: 109 })]); },
  junk() {
    const hull = new THREE.BoxGeometry(14, 2.2, 4.4); const p = hull.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getX(i) > 0) p.setZ(i, p.getZ(i) * (p.getY(i) > 0 ? 0.7 : 0.3));
    hull.computeVertexNormals();
    return M([P(hull, '#5a3a24', { y: 1 }), P(bx(4, 1.6, 3.6), '#6a4a30', { x: -4, y: 2.1 }), P(bx(0.2, 10, 6), '#c84a2a', { x: 2, y: 2.4 }), P(bx(0.2, 7, 4.6), '#c84a2a', { x: -3.4, y: 3.5 })]);
  },
  leafy() {
    return M([P(cyl(0.35, 0.25, 3.5), '#8a7060'), P(ico(2.6, 0), '#ffffff', { y: 5.4 }), P(ico(2.1, 0), '#e6e6e6', { x: 1.6, y: 4.6, z: 0.6 }), P(ico(1.9, 0), '#f4f4f4', { x: -1.3, y: 5.0, z: -0.8 })]);
  },
  pagoda() {
    const parts = [];
    for (let i = 0; i < 5; i++) { parts.push(P(bx(10 - 1.4 * i, 4, 10 - 1.4 * i), '#8a2a1e', { y: i * 5.2 })); parts.push(P(bx(15 - 1.7 * i, 0.9, 15 - 1.7 * i), '#2a2a30', { y: i * 5.2 + 4 })); }
    parts.push(P(cyl(0.45, 0.2, 9, 6), '#c8a040', { y: 26 }));
    return M(parts);
  },
  torii() {
    const r = '#d8401e';
    return M([P(cyl(0.45, 0.4, 7.2, 8), r, { x: 3.2 }), P(cyl(0.45, 0.4, 7.2, 8), r, { x: -3.2 }), P(bx(9.8, 0.7, 0.9), '#2a2020', { y: 7.1 }), P(bx(8.8, 0.5, 0.7), r, { y: 6.5 }), P(bx(7.6, 0.45, 0.5), r, { y: 5.2 }), P(bx(0.4, 1.3, 0.4), r, { y: 5.4 })]);
  },
  bamboo() {
    const parts = [];
    for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = 0.6 + (i % 3) * 0.7, x = Math.cos(a) * rr, z = Math.sin(a) * rr, h = 10 + (i % 4) * 1.8; parts.push(P(cyl(0.13, 0.1, h, 5), '#8ab04a', { x, z, rz: x * 0.03 }), P(ico(1.3, 0), '#5f9a3a', { x: x * 1.3, y: h, z: z * 1.3, sy: 1.6 })); }
    return M(parts);
  },
  mesa() { return M([P(cyl(1, 0.92, 0.45, 8), '#a0522d'), P(cyl(0.92, 0.84, 0.35, 8), '#c06a3e', { y: 0.45 }), P(cyl(0.84, 0.8, 0.2, 8), '#b85a34', { y: 0.8 })]); },
  telepole() { return M([P(cyl(0.16, 0.12, 9, 5), '#5a4030'), P(bx(2.6, 0.16, 0.16), '#5a4030', { y: 8.2 }), P(bx(0.15, 0.3, 0.15), '#9ab8c8', { x: 1.1, y: 8.35 }), P(bx(0.15, 0.3, 0.15), '#9ab8c8', { x: -1.1, y: 8.35 })]); },
  diner() { return M([P(bx(18, 5, 10), '#d8dce0'), P(bx(18.2, 1, 10.2), '#c82a2a', { y: 3 }), P(bx(16, 1.5, 0.2), '#4a6a8a', { y: 1.4, z: 5.05 }), P(cyl(0.2, 0.2, 12, 5), '#6a6e74', { x: 12 }), P(bx(6, 3, 0.4), '#f2c82a', { x: 12, y: 11 }), P(bx(5.4, 1, 0.45), '#c82a2a', { x: 12, y: 11.4 })]); },
  zig() {
    const s = '#a89478', parts = [];
    for (let i = 0; i < 5; i++) parts.push(P(bx(64 - i * 11, 7.5, 64 - i * 11), i % 2 ? '#9a8668' : s, { y: i * 7.5 }));
    parts.push(P(bx(10, 7, 10), '#8a7658', { y: 37.5 }));
    for (let i = 0; i < 5; i++) parts.push(P(bx(9, 7.5, 5), '#b8a488', { y: i * 7.5, z: 32 - i * 5.5 }));
    return M(parts);
  },
  agave() {
    const parts = [];
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; parts.push(P(cone(0.28, 2.4, 4), k % 2 ? '#6a9a8a' : '#5a8a7a', { x: Math.cos(a) * 0.5, y: 0, z: Math.sin(a) * 0.5, rz: -Math.cos(a) * 0.9, rx: Math.sin(a) * 0.9 })); }
    return M(parts);
  },
  canopy() { const g = new THREE.SphereGeometry(1, 26, 6, 0, Math.PI * 2, 0, Math.PI * 0.42); return M([P(g, '#ffffff', { sx: 120, sy: 30, sz: 46 })]); },
  hotel() { return M([P(bx(70, 26, 24), '#e8eef4', { x: -45 }), P(bx(70, 26, 24), '#e8eef4', { x: 45 }), P(bx(22, 8, 30), '#c8d4e0', { y: 0 })]); },
  boat() {
    const hull = new THREE.BoxGeometry(9, 1.4, 3); const p = hull.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getX(i) > 0) p.setZ(i, p.getZ(i) * (p.getY(i) > 0 ? 0.6 : 0.2));
    hull.computeVertexNormals();
    return M([P(hull, '#f2f2f2', { y: 0.6 }), P(bx(3.6, 1.4, 2.2), '#e04a2a', { x: -1, y: 1.3 })]);
  }
};
/* drawn unlit (always glowing) / translucent / floodlit at night / wireframe */
export const GLOW2 = new Set(['pearlGlow', 'podGlow', 'bridgeGlow']);
export const FADE2 = new Set(['steam']);
export const LIT2 = new Set(['irontower', 'palace', 'spires', 'castle', 'ruin', 'mosque', 'bridge', 'pearl', 'needle2', 'pagoda', 'zig', 'pyr2', 'stupa', 'kasbah', 'hotel', 'torii']);
export const WIRE2 = new Set(['canopy']);

/* ------------------------------------------------------------ helpers */
const C = a => new THREE.Color(a);
const pick = (r, a) => a[(r() * a.length) | 0];

/* Place a landmark near route position s, as close to `lat` as the road
 * allows (tries further out and the other side). Returns the spot or null. */
function landmark(ctx, type, s, lat, { clear = 30, ry = null, scale = 1, color = null, sea = false, sy = null, sz = null, land = true } = {}) {
  const { S, track: t, L } = ctx, tmp = {};
  for (const k of [1, 1.3, 1.7, 2.2, 3]) for (const sd of [1, -1]) {
    t.at(s, lat * k * sd, tmp);
    if (!S.free(tmp.x, tmp.z, clear)) continue;
    const gy = t.groundY(tmp.x, tmp.z);
    if (land && !sea && L.sea && gy < t.seaY + 1) continue;
    if (sea && gy > t.seaY - 1) continue;
    const y = sea ? t.seaY : gy;
    const rot = ry != null ? ry : t.th[t.idx(s)] + (sd > 0 ? Math.PI / 2 : -Math.PI / 2);
    S.add(type, tmp.x, y, tmp.z, rot, scale, color ? C(color) : null, sy, sz, -1);
    return { x: tmp.x, y, z: tmp.z, ry: rot, side: sd * Math.sign(lat) };
  }
  return null;
}
/* the side of the road the land is on for coastal routes (+1 = left of travel) */
const landSide = L => (L.coast === 'left' ? -1 : L.coast === 'right' ? 1 : 0);

const HAUSS = ['#e8dcc4', '#ddd0b4', '#efe6d2', '#d6c8ac'];
const SAND = ['#d8b884', '#c8a474', '#e2c898', '#bfa078'];

/* ------------------------------------------------------------ kits */
const KITS = {
  paris(c) {
    const { S, track: t, end } = c;
    c.town(0, t.totalS * 0.55, HAUSS, 18, 30, 50, 10);
    S.along('tree', 18, 1.6, { s0: 0, s1: t.totalS * 0.6 });
    S.along('lamp', 36, 0.8, { facing: true, s1: t.totalS * 0.6 });
    S.scatter('tree', 4, 6, 120, { s0: t.totalS * 0.5, scale: [0.9, 1.4] });
    S.scatter('house', 1.2, 14, 110, { s0: t.totalS * 0.5, colors: HAUSS, face: 'road' });
    S.along('hedge', 10.2, 2.4, { s0: end - 900, s1: t.totalS });
    c.town(end - 200, t.totalS, HAUSS, 12, 22, 60, 4);
    landmark(c, 'irontower', START_S + 420, 150, { clear: 60 });
    landmark(c, 'palace', end + 40, 120, { clear: 90, ry: t.th[t.idx(end + 40)] + Math.PI / 2 });
  },
  barcelona(c) {
    const { S, track: t, L, end } = c, land = landSide(L);
    S.along('palm', 24, 2.2, { sides: [-land] });
    S.scatter('pine', 4, 4, 80, { side: land, scale: [0.9, 1.4] });
    S.scatter('house', 3, 10, 90, { side: land, colors: ['#f2d8b0', '#f4e4c8', '#e8b890', '#fff2dc', '#f0c8a0'], face: 'road', scale: [0.9, 1.4] });
    S.scatter('rock', 1.5, 4, 40, { side: land, colors: ['#b89a72', '#a88a62'] });
    S.scatter('yacht', 2, 30, 260, { side: -land, sea: true, scale: [0.8, 1.5] });
    c.town(0, START_S + 500, ['#e8d8bc', '#d8c4a4', '#f0e2c8', '#c8b090'], 16, 36, 70, 8);
    c.town(end - 260, t.totalS, ['#f4ecdc', '#f8f0e0', '#e8d8c0'], 8, 18, 60, 5);
    landmark(c, 'spires', START_S + 260, 130 * land, { clear: 50 });
    S.far('mountain', 22, 500, 1300, { side: land, scale: [180, 380], hy: [0.5, 0.8], colors: ['#8a8a62'], sink: 10 });
  },
  nurburg(c) {
    const { S, track: t, end } = c;
    S.scatter('pine', 16, 3, 120, { scale: [0.9, 1.7], pow: 1.5 });
    S.scatter('tree', 3, 4, 60, { scale: [0.9, 1.4] });
    S.along('hedge', 10.2, 2.2, { s0: 0, s1: START_S + 500 });
    S.scatter('cottage', 0.5, 20, 90, { face: 'road', colors: ['#f2ece0', '#e8dcc8'] });
    c.town(0, START_S + 260, ['#f2ece0', '#e0d4c0', '#d8c8b0'], 8, 16, 50, 5);
    c.town(end - 200, t.totalS, ['#f2ece0', '#e0d4c0'], 8, 14, 50, 4);
    landmark(c, 'castle', START_S + 380, 110, { clear: 50 });
  },
  fjord(c) {
    const { S, track: t, L, end } = c, land = landSide(L);
    S.scatter('pine', 7, 3, 110, { side: land, scale: [0.8, 1.5], pow: 1.4 });
    S.scatter('pine', 1.2, 3, 12, { side: -land });
    S.scatter('rock', 2.5, 3, 60, { colors: ['#7a7e82', '#8a8e92', '#6a6e72'], scale: [0.8, 2.4] });
    S.scatter('house', 1.2, 12, 80, { side: land, s1: START_S + 1800, colors: ['#a8322a', '#f2f2f2', '#d8b04a', '#a8322a'], face: 'road', scale: [0.6, 0.9] });
    S.scatter('boat', 1, 30, 200, { side: -land, sea: true });
    c.town(0, START_S + 240, ['#a8322a', '#f2f2f2', '#e8c060'], 6, 12, 50, 4);
    S.far('mountain', 40, 260, 900, { side: land, scale: [240, 520], hy: [1.0, 1.6], colors: ['#7a8288'], sink: 30 });
    S.far('mountain', 16, 500, 1100, { side: -land, scale: [260, 520], hy: [1.1, 1.6], colors: ['#7a8288'], sink: 60 });
    c.town(end - 120, t.totalS, ['#a8322a', '#f2f2f2'], 6, 10, 40, 2);
  },
  iceland(c) {
    const { S, track: t, end } = c;
    S.scatter('rock', 5, 3, 120, { colors: ['#2a2826', '#3a3632', '#4a5236'], scale: [0.7, 2.2], pow: 1.3 });
    S.scatter('bush', 9, 3, 90, { colors: ['#6a8a3a', '#7a9a44', '#5a7a34'], scale: [0.8, 1.8] });
    S.scatter('steam', 0.35, 30, 220, { scale: [0.6, 1.4] });
    S.scatter('cottage', 0.4, 20, 100, { face: 'road', colors: ['#f2f2f2', '#ffffff'] });
    S.scatter('house', 0.3, 20, 100, { face: 'road', colors: ['#a8322a', '#ffffff'], scale: [0.6, 0.8] });
    c.town(0, START_S + 260, ['#f2f2f2', '#c8d4e0', '#e8e0d0', '#a8322a'], 8, 20, 60, 6);
    c.town(end - 160, t.totalS, ['#f2f2f2', '#a8322a'], 6, 10, 50, 3);
    S.far('mountain', 16, 700, 1400, { scale: [220, 420], hy: [0.4, 0.6], colors: ['#3a3836'], sink: 10 });
    const v = landmark(c, 'mountain', START_S + c.len * 0.75, 1000, { clear: 400, scale: 380, sy: 380 * 0.55, color: '#4a4440' });
    if (v) S.add('steam', v.x, v.y + 380 * 0.55 - 30, v.z, 0, 4, null, 5, 4, -1);
  },
  highlands(c) {
    const { S, track: t, L, end } = c, land = landSide(L);
    S.scatter('bush', 12, 3, 120, { colors: ['#7a4a7a', '#8a5a84', '#6a5040', '#7a6a4a'], scale: [0.8, 1.7] });
    S.scatter('rock', 3, 4, 120, { colors: ['#6a6864', '#7a7874', '#5a5854'], scale: [0.8, 2.6] });
    S.scatter('sheep', 2.5, 12, 110, { side: land, scale: [0.9, 1.1] });
    S.scatter('pine', 1.5, 6, 90, { side: land, scale: [0.8, 1.3] });
    S.scatter('cottage', 0.6, 18, 100, { side: land, face: 'road', colors: ['#9a948a', '#b0a898', '#e8e4dc'] });
    c.town(0, START_S + 280, ['#9a948a', '#b0a898', '#c8c0b0'], 8, 16, 60, 5);
    c.town(end - 160, t.totalS, ['#9a948a', '#e8e4dc'], 6, 10, 50, 3);
    landmark(c, 'ruin', START_S + c.len * 0.4, 60 * -land, { clear: 25, land: false });
    S.far('mountain', 34, 300, 1000, { side: land, scale: [220, 460], hy: [0.6, 1.0], colors: ['#5a6050', '#4e5448'], sink: 20 });
  },
  morocco(c) {
    const { S, track: t, end } = c;
    S.scatter('palm', 5, 3, 60, { s0: 0, s1: START_S + 1400 });
    S.scatter('kasbah', 1.4, 14, 120, { face: 'road', colors: ['#b8683e', '#a85a34', '#c87a4a', '#9a4e2e'], scale: [0.8, 1.5] });
    S.scatter('rock', 3, 4, 120, { colors: ['#9a5a3a', '#8a4a2e', '#b06a44'], scale: [0.8, 2.4] });
    S.scatter('bush', 3, 4, 80, { colors: ['#7a7a3a', '#6a6a34'], scale: [0.6, 1.2] });
    c.town(0, START_S + 380, ['#d8907a', '#c8806a', '#e0a088', '#b87060'], 8, 20, 70, 8);
    c.town(end - 220, t.totalS, ['#c8806a', '#b8683e'], 6, 14, 60, 4);
    landmark(c, 'kasbah', end - 300, 70, { clear: 30, scale: 2.6, color: '#b06038' });
    S.far('mountain', 30, 600, 1400, { scale: [260, 520], hy: [0.7, 1.1], colors: ['#9a6a4e'], sink: 20 });
  },
  cairo(c) {
    const { S, track: t, end, len } = c;
    c.town(0, START_S + len * 0.3, SAND, 10, 34, 70, 10);
    S.scatter('palm', 4, 3, 50, { s0: 0, s1: START_S + len * 0.45 });
    S.scatter('rock', 1.2, 10, 120, { s0: START_S + len * 0.3, colors: ['#c89a62', '#b08a54'] });
    S.along('lamp', 50, 0.8, { facing: true });
    landmark(c, 'mosque', START_S + 260, 90, { clear: 40 });
    landmark(c, 'mosque', START_S + len * 0.2, 110, { clear: 40, scale: 0.8 });
    for (const [ds, lat, sc] of [[-400, 380, 1.6], [-120, 520, 1.25], [180, 460, 0.8]]) landmark(c, 'pyr2', end + ds, lat, { clear: 140 * sc, scale: sc, ry: 0.4 });
    c.town(end - 200, t.totalS, SAND, 6, 14, 60, 3);
  },
  istanbul(c) {
    const { S, track: t, L, end, len } = c, land = landSide(L);
    c.town(0, t.totalS * 0.7, ['#d8c8b0', '#c8b49a', '#e8dcc8', '#b8a48a', '#d0b8a0'], 12, 40, 60, 10);
    c.nightLamps(30, false, '#ffd9a0', 0.8);
    S.scatter('boat', 1.6, 30, 260, { side: -land, sea: true, scale: [1, 2] });
    S.scatter('yacht', 0.6, 60, 300, { side: -land, sea: true, scale: [1.2, 1.8] });
    S.scatter('cypress', 2, 3, 30, { side: land });
    landmark(c, 'mosque', START_S + 240, 100 * land, { clear: 40, scale: 1.3 });
    landmark(c, 'mosque', START_S + len * 0.35, 120 * land, { clear: 40 });
    const tmp = {};
    for (const s of [START_S + len * 0.7, START_S + len * 0.6, START_S + len * 0.8, START_S + len * 0.5]) {
      t.at(s, -land * 420, tmp);
      if (S.free(tmp.x, tmp.z, 270) && t.groundY(tmp.x, tmp.z) < t.seaY - 1) {
        const ry = t.th[t.idx(s)] + Math.PI / 2;
        S.add('bridge', tmp.x, t.seaY, tmp.z, ry, 1, null, null, null, -1);
        S.add('bridgeGlow', tmp.x, t.seaY, tmp.z, ry, 1, null, null, null, -1);
        break;
      }
    }
    c.signs(1, 0, START_S + len * 0.4);
  },
  himalaya(c) {
    const { S, track: t, end } = c;
    S.scatter('snowpine', 6, 3, 110, { scale: [0.8, 1.5], pow: 1.6, s1: t.totalS * 0.6 });
    S.scatter('rock', 3, 3, 80, { colors: ['#8a8c96', '#a0a4ac', '#6a6c76'], scale: [0.8, 2.6] });
    S.along('flagline', 70, 1.8);
    S.scatter('stupa', 0.4, 12, 70, { scale: [0.8, 1.3] });
    c.town(0, START_S + 220, ['#e8dcc8', '#c8a888', '#d84a3a', '#3a6ad8'], 6, 14, 50, 5);
    landmark(c, 'stupa', end + 20, 40, { clear: 20, scale: 2.4 });
    S.far('mountain', 50, 300, 1100, { scale: [300, 700], hy: [1.0, 1.6], sink: 40 });
  },
  shanghai(c) {
    const { S, track: t, L, end, len } = c, land = landSide(L);
    c.town(0, t.totalS, ['#c8d4e0', '#a8b8c8', '#e8eef4', '#b0c0d0', '#d0c8c0'], 30, 200, 70, 11);
    c.signs(4, 0, t.totalS);
    c.nightLamps(28, true, '#f2f6ff', 0.6);
    S.scatter('boat', 1.4, 30, 220, { side: -land, sea: true, scale: [1, 1.8] });
    const p = landmark(c, 'pearl', START_S + len * 0.25, -land * 160, { clear: 50, land: false });
    if (p) S.add('pearlGlow', p.x, p.y, p.z, 0, 1, null, null, null, -1);
    landmark(c, 'triple', START_S + len * 0.55, 200 * land, { clear: 90 });
  },
  seoul(c) {
    const { S, track: t, end } = c;
    c.town(0, t.totalS, ['#c8ccd4', '#b8b0a4', '#d8d4cc', '#9aa4b0', '#e0dcd4'], 16, 120, 55, 14);
    c.signs(8, 0, t.totalS);
    c.nightLamps(30, false, '#e8f0ff', 0.4);
    const p = landmark(c, 'hill', end + 120, 260, { clear: 140, scale: 140, sy: 70, color: '#1e2a22' });
    if (p) { S.add('needle2', p.x, p.y + 60, p.z, 0, 1, null, null, null, -1); S.add('podGlow', p.x, p.y + 60, p.z, 0, 1, null, null, null, -1); }
  },
  hongkong(c) {
    const { S, track: t, L, end, len } = c, land = landSide(L);
    c.town(0, START_S + len * 0.6, ['#c8d4e0', '#a8b8c8', '#e8eef4', '#b0c0d0', '#d8d0c4'], 40, 220, 60, 14);
    c.signs(6, 0, START_S + len * 0.6);
    c.nightLamps(28, false, '#ffe0b0', 0.7);
    S.scatter('junk', 1.4, 30, 260, { side: -land, sea: true, scale: [1, 1.6] });
    S.scatter('boat', 1, 30, 200, { side: -land, sea: true });
    S.scatter('jungle', 7, 3, 100, { s0: START_S + len * 0.55, scale: [0.8, 1.4], pow: 1.4 });
    c.town(end - 160, t.totalS, ['#e8eef4', '#c8d4e0'], 10, 30, 50, 4);
  },
  kyoto(c) {
    const { S, track: t, end, len } = c;
    const MAPLE = ['#d83a22', '#e86a22', '#f0a030', '#c82a2a', '#e8c040'];
    S.scatter('leafy', 9, 3, 110, { colors: MAPLE, scale: [0.8, 1.4], pow: 1.3 });
    S.scatter('pine', 2, 6, 100, { scale: [0.8, 1.2] });
    S.scatter('bamboo', 10, 2, 40, { s0: START_S + len * 0.55, s1: START_S + len * 0.72, scale: [0.9, 1.3] });
    // a tunnel of shrine gates spanning the road (clear of the checkpoint arches)
    for (let s = START_S + len * 0.25; s < START_S + len * 0.25 + 300; s += 24) {
      if (t.checkpoints.some(cp => Math.abs(cp - s) < 30)) continue;
      const p = t.at(s, 0, {}), half = t.w[t.idx(s)] / 2 + t.runoff + 1.4;
      S.add('torii', p.x, p.y, p.z, p.th, half / 3.2, null, 1.55, 1.3);
    }
    S.scatter('cottage', 1.2, 10, 90, { face: 'road', colors: ['#5a4434', '#6a5040', '#4a3a2e'], scale: [0.7, 1] });
    c.town(0, START_S + 300, ['#5a4434', '#c8b8a0', '#8a7058'], 6, 14, 50, 6);
    landmark(c, 'pagoda', START_S + 380, 60, { clear: 20, scale: 1.4 });
    landmark(c, 'pagoda', end + 20, 70, { clear: 20, scale: 1.1 });
    S.far('mountain', 18, 500, 1200, { scale: [220, 380], hy: [0.35, 0.55], colors: ['#6a6a3a', '#7a5a3a', '#5a6a3a'], sink: 8 });
  },
  route66(c) {
    const { S, track: t, end } = c;
    S.scatter('cactus', 3, 4, 120, { scale: [0.8, 1.4] });
    S.scatter('rock', 2.5, 4, 140, { colors: ['#a0583a', '#8a4a30', '#b8683e'], scale: [0.8, 2.6] });
    S.scatter('bush', 4, 3, 80, { colors: ['#8a8a4a', '#7a7a44', '#9a8a54'], scale: [0.5, 1] });
    S.along('telepole', 44, 3.2, { sides: [1] });
    S.scatter('diner', 0.12, 14, 40, { face: 'road' });
    c.town(0, START_S + 260, ['#e8dcc8', '#d8c0a0', '#c8d4e0'], 5, 12, 50, 5);
    c.town(end - 220, t.totalS, ['#a88a6a', '#9a7a5a', '#c8a888'], 5, 10, 50, 5);
    S.far('mesa', 26, 500, 1400, { scale: [140, 300], hy: [0.25, 0.45], sink: 2 });
  },
  miami(c) {
    const { S, track: t, L, end, len } = c, land = landSide(L);
    const DECO = ['#ffc8d8', '#c8f0e8', '#fff0c0', '#d8c8ff', '#ffd8b0', '#f8f8f8'];
    c.town(0, START_S + len * 0.55, DECO, 10, 40, 60, 10);
    S.along('palm', 20, 2.2, { sides: [-land] });
    S.scatter('palm', 3, 3, 30, { side: land });
    c.signs(4, 0, START_S + len * 0.55);
    c.nightLamps(26, false, '#ffb8e8', 0.7);
    S.scatter('yacht', 1.4, 40, 260, { side: -land, sea: true, scale: [0.9, 1.6] });
    c.town(end - 300, t.totalS, DECO, 8, 24, 60, 6);
  },
  rockies(c) {
    const { S, track: t, L, end } = c, land = landSide(L);
    S.scatter('pine', 8, 3, 110, { side: land, scale: [0.9, 1.7], pow: 1.4 });
    S.scatter('leafy', 5, 3, 90, { colors: ['#f0c030', '#e8a820', '#f8d850', '#d89a20'], scale: [0.7, 1.2] });
    S.scatter('pine', 1.5, 3, 14, { side: -land });
    S.scatter('rock', 2, 4, 80, { colors: ['#7a7e86', '#8a8e96'], scale: [0.8, 2.2] });
    S.scatter('chalet', 0.5, 14, 90, { side: land, face: 'road', colors: ['#c89060', '#ffffff'] });
    c.town(0, START_S + 260, ['#c89060', '#e8dcc8', '#a87048'], 6, 14, 50, 5);
    landmark(c, 'chalet', end + 30, 70 * land, { clear: 30, scale: 4, color: '#e8dcc8' });
    S.far('mountain', 44, 280, 1000, { scale: [260, 560], hy: [1.0, 1.5], sink: 30 });
  },
  mexico(c) {
    const { S, track: t, end, len } = c;
    const PAINT = ['#f28a6a', '#f2d24a', '#6ac8f2', '#8af26a', '#f26aa8', '#ffffff', '#c86af2'];
    c.town(0, START_S + len * 0.3, PAINT, 6, 22, 60, 9);
    S.scatter('agave', 14, 4, 90, { s0: START_S + len * 0.3, scale: [0.9, 1.5] });
    S.scatter('cactus', 1.5, 4, 90, { scale: [0.8, 1.3] });
    S.scatter('tree', 2, 6, 90, { scale: [0.8, 1.2] });
    S.scatter('house', 1, 14, 90, { s0: START_S + len * 0.3, colors: PAINT, face: 'road', scale: [0.6, 0.9] });
    for (const [ds, lat, sc] of [[-260, 220, 1.6], [60, 260, 1.1]]) landmark(c, 'zig', end + ds, lat, { clear: 60 * sc, scale: sc });
    S.far('mountain', 10, 900, 1500, { scale: [400, 700], hy: [0.5, 0.7], colors: ['#6a6a72'], sink: 20 });
  },
  patagonia(c) {
    const { S, track: t, L, end } = c, land = landSide(L);
    S.scatter('bush', 14, 3, 120, { colors: ['#c8a85a', '#b8984e', '#a88a48', '#d8b868'], scale: [0.7, 1.4] });
    S.scatter('rock', 2, 4, 120, { colors: ['#7a7876', '#8a8886'], scale: [0.8, 2.4] });
    S.scatter('leafy', 0.8, 6, 60, { side: land, colors: ['#5a7a3a', '#4a6a34'], scale: [0.6, 1] });
    S.scatter('house', 0.3, 20, 100, { side: land, face: 'road', colors: ['#f2f2f2', '#c83a2a'], scale: [0.6, 0.8] });
    c.town(0, START_S + 220, ['#f2ece0', '#c83a2a', '#e8dcc8', '#4a6a8a'], 5, 12, 50, 5);
    S.far('mountain', 12, 500, 1100, { side: land, scale: [130, 220], hy: [2.4, 3.4], colors: ['#6a6a72'], sink: 10 });
    S.far('mountain', 22, 500, 1400, { scale: [240, 460], hy: [0.9, 1.3], colors: ['#7a7a80'], sink: 30 });
    c.town(end - 120, t.totalS, ['#f2ece0', '#c83a2a'], 5, 10, 40, 2);
  },
  abudhabi(c) {
    const { S, track: t, L, end, len } = c, land = landSide(L);
    c.town(0, t.totalS, ['#e8eef4', '#d8e0e8', '#c8d4e0', '#f4ecdc'], 20, 150, 70, 8);
    S.along('palm', 22, 2.2);
    c.nightLamps(32, true, '#f2f6ff', 0.45);
    c.signs(1.5, 0, t.totalS);
    S.scatter('yacht', 2, 30, 220, { side: -land, sea: true, scale: [1, 2.2] });
    const h = landmark(c, 'hotel', START_S + 300, 90 * land, { clear: 70 });
    if (h) S.add('canopy', h.x, h.y + 18, h.z, h.ry, 1, C('#7ad0ff'), null, null, -1);
    landmark(c, 'mosque', end - 500, 200 * land, { clear: 50, scale: 1.8 });
  }
};

export function populateWorld(theme, ctx) {
  const kit = KITS[theme];
  if (kit) kit(ctx);
}

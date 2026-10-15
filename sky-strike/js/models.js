/* Iron Crown ground forces, buildings and ships. Every model is a few merged,
 * vertex-coloured meshes (body + any moving turret/dish), so a whole base is
 * a handful of draw calls. All markings are the fictional Iron Crown faction. */
import * as THREE from 'three';
import { Builder, mat4, hot } from './util.js';
import { loft, buildJet } from './jet.js';

export const MAT = {
  body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.12 }),
  metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.55 }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  wreck: new THREE.MeshStandardMaterial({ vertexColors: true, color: '#2c2724', roughness: 1, metalness: 0 })
};
export const RED = '#b3141a';
const DARK = '#1e2024', TRACK = '#26282b', TYRE = '#1a1a1c';

function finish(group, B, mat = MAT.body, shadow = true) {
  if (B.empty) return null;
  const m = B.mesh(mat); m.castShadow = shadow; m.receiveShadow = true; group.add(m); return m;
}
function pivot(group, B, pos, mat = MAT.body) {
  const p = new THREE.Group(); p.position.set(...pos); group.add(p);
  if (B && !B.empty) { const m = B.mesh(mat); m.castShadow = true; p.add(m); }
  return p;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
const cylZ = (r, l, s = 10) => new THREE.CylinderGeometry(r, r, l, s).rotateX(Math.PI / 2);
const cylX = (r, l, s = 10) => new THREE.CylinderGeometry(r, r, l, s).rotateZ(Math.PI / 2);

/* ------------------------------------------------------------ vehicles (nose = -Z) */
function hull(B, c, len = 7, w = 3.3) {
  B.add(loft([{ z: -len / 2, w: w * 0.42, ht: 0.35, hb: 0.3, y: 0.9, n: 5 }, { z: -len / 2 + 1.0, w: w / 2, ht: 0.55, hb: 0.4, y: 1.1, n: 6 }, { z: len / 2 - 0.4, w: w / 2, ht: 0.55, hb: 0.4, y: 1.15, n: 6 }, { z: len / 2, w: w * 0.46, ht: 0.45, hb: 0.35, y: 1.1, n: 5 }], 16), c);
  for (const sx of [-1, 1]) {
    B.add(box(0.85, 1.05, len + 0.2), TRACK, [sx * (w / 2 + 0.25), 0.62, 0]);
    for (let i = 0; i < 6; i++) B.add(cylX(0.36, 0.2, 8), '#3a3c40', [sx * (w / 2 + 0.69), 0.5, -len / 2 + 0.8 + i * (len - 1.6) / 5]);
    B.add(box(0.95, 0.06, len + 0.3), c, [sx * (w / 2 + 0.25), 1.17, 0]);
  }
}
export function tank(c) {
  const g = new THREE.Group(), B = new Builder(), T = new Builder();
  hull(B, c); B.add(box(1.0, 0.5, 0.8), DARK, [0.9, 1.5, 3.0]);
  T.add(loft([{ z: -1.6, w: 0.9, ht: 0.3, hb: 0.25, n: 3 }, { z: -0.8, w: 1.4, ht: 0.48, hb: 0.3, n: 4 }, { z: 1.4, w: 1.45, ht: 0.5, hb: 0.3, n: 4 }, { z: 1.9, w: 1.2, ht: 0.4, hb: 0.3, n: 4 }], 14), c, [0, 0.3, 0]);
  T.add(cylZ(0.13, 5.2, 8), '#3a3d36', [0, 0.38, -4.0]); T.add(cylZ(0.2, 1.0, 8), '#3a3d36', [0, 0.38, -2.0]);
  T.add(cyl(0.35, 0.4, 0.35, 10), DARK, [0.55, 0.95, 0.4]); T.add(box(1.5, 0.08, 0.5), RED, [0, 0.82, 0.9]);
  finish(g, B); const tur = pivot(g, T, [0, 1.65, 0.3]);
  return { group: g, turret: tur };
}
export function aav(c) {
  const g = new THREE.Group(), B = new Builder(), T = new Builder(), G = new Builder();
  hull(B, c, 6.6, 3.1);
  T.add(box(2.4, 1.0, 2.6), c, [0, 0.5, 0]); T.add(box(2.42, 0.1, 0.4), RED, [0, 0.9, 1.0]);
  T.add(cyl(0.08, 0.08, 1.2, 6), DARK, [0, 1.4, 0.9]); T.add(box(1.6, 0.9, 0.12), '#4a4e52', [0, 2.0, 0.9]);
  for (const sx of [-1, 1]) for (const sy of [0, 0.32]) G.add(cylZ(0.07, 3.2, 6), '#2e3034', [sx * 1.4, sy, -1.4]);
  G.add(box(0.5, 0.6, 1.0), c, [1.4, 0.15, 0]); G.add(box(0.5, 0.6, 1.0), c, [-1.4, 0.15, 0]);
  finish(g, B); const tur = pivot(g, T, [0, 1.6, 0.2]); const gun = pivot(tur, G, [0, 0.55, -0.3]);
  return { group: g, turret: tur, gun };
}
export function truck(c, fuel = false) {
  const g = new THREE.Group(), B = new Builder();
  B.add(box(2.5, 2.1, 2.2), c, [0, 1.85, -3.0]); B.add(box(2.3, 0.8, 0.06), '#1c2a34', [0, 2.3, -4.12]);
  B.add(box(2.6, 0.5, 6.4), '#3a3a36', [0, 0.95, 0.4]);
  if (fuel) { B.add(cylZ(1.15, 5.2, 14), '#b8b4a8', [0, 2.3, 0.8]); B.add(box(2.4, 0.15, 0.5), RED, [0, 3.45, 0.8]); }
  else { B.add(box(2.5, 0.25, 5.6), c, [0, 1.3, 0.8]); const cv = new THREE.CylinderGeometry(1.25, 1.25, 5.4, 12, 1, false, 0, Math.PI); cv.rotateZ(Math.PI / 2); cv.rotateY(Math.PI / 2); B.add(cv, c, [0, 1.65, 0.8], [0, 0, 0], [1, 0.85, 1]); B.add(box(2.5, 1.2, 5.4), c, [0, 2.0, 0.8]); }
  for (const z of [-3, 1.0, 2.6]) for (const sx of [-1, 1]) B.add(cylX(0.55, 0.45, 12), TYRE, [sx * 1.15, 0.55, z]);
  finish(g, B);
  return { group: g };
}
export function samLauncher(c) {
  const g = new THREE.Group(), B = new Builder(), T = new Builder(), R = new Builder();
  B.add(box(3.0, 1.2, 8.0), c, [0, 1.2, 0]); B.add(box(2.8, 1.6, 2.0), c, [0, 2.4, -3.0]);
  for (const z of [-3, -1, 1.2, 3]) for (const sx of [-1, 1]) B.add(cylX(0.6, 0.45, 12), TYRE, [sx * 1.35, 0.6, z]);
  T.add(cyl(1.0, 1.2, 0.5, 12), '#3a3d40', [0, 0.25, 0]); T.add(box(0.5, 1.6, 0.8), c, [0, 1.0, 0.9]);
  for (const sx of [-0.55, 0.55]) for (const sy of [0, 0.75]) { R.add(cylZ(0.3, 5.0, 10), '#cfd2d0', [sx, sy, -1.6]); R.add(cylZ(0.31, 0.3, 10), RED, [sx, sy, -4.1]); }
  R.add(box(1.9, 1.6, 0.3), '#3a3d40', [0, 0.38, 0.9]);
  finish(g, B); const tur = pivot(g, T, [0, 1.8, 1.4]); const rack = pivot(tur, R, [0, 1.6, 0.9]);
  rack.rotation.x = 0.55;
  return { group: g, turret: tur, gun: rack };
}
export function aaGun(c, heavy = false) {
  const g = new THREE.Group(), B = new Builder(), T = new Builder(), G = new Builder();
  const sand = '#a99a74';
  if (heavy) { B.add(cyl(5.2, 5.6, 1.4, 16), '#8a8a84', [0, 0.7, 0]); B.add(cyl(4.4, 4.4, 1.45, 16), '#6a6a66', [0, 0.72, 0]); }
  else { const tor = new THREE.TorusGeometry(3.4, 0.7, 6, 16); tor.rotateX(Math.PI / 2); B.add(tor, sand, [0, 0.5, 0], [0, 0, 0], [1, 1, 0.8]); }
  B.add(cyl(0.9, 1.1, 0.8, 10), '#3a3d40', [0, 0.6, 0]);
  T.add(box(2.0, 0.9, 2.2), c, [0, 0.45, 0]); T.add(box(0.3, 1.4, 1.2), c, [0.9, 1.2, 0]); T.add(box(0.3, 1.4, 1.2), c, [-0.9, 1.2, 0]);
  if (heavy) { G.add(cylZ(0.22, 7, 10), '#2e3034', [0, 0, -3.2]); G.add(box(1.2, 1.2, 2.4), c, [0, 0, 0.4]); G.add(cylZ(0.3, 0.8, 10), '#2e3034', [0, 0, -6.6]); }
  else for (const sx of [-0.35, 0.35]) { G.add(cylZ(0.09, 3.6, 6), '#2e3034', [sx, 0, -1.9]); G.add(cylZ(0.15, 0.6, 6), '#2e3034', [sx, 0, -3.6]); }
  if (!heavy) G.add(box(1.0, 0.5, 1.2), c, [0, 0, 0.1]);
  T.add(box(2.02, 0.12, 0.4), RED, [0, 0.95, 0.9]);
  finish(g, B); const tur = pivot(g, T, [0, 1.1, 0]); const gun = pivot(tur, G, [0, 1.5, 0]);
  return { group: g, turret: tur, gun };
}
export function radar(c) {
  const g = new THREE.Group(), B = new Builder(), D = new Builder(), L = new Builder();
  const Hh = 22, leg = (x0, z0, x1, z1) => { const v = new THREE.Vector3(x1 - x0, Hh, z1 - z0), len = v.length(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()); B.addM(cyl(0.18, 0.25, len, 6), '#4a4e54', new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, Hh / 2, (z0 + z1) / 2), q, new THREE.Vector3(1, 1, 1))); };
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) leg(sx * 4, sz * 4, sx * 1.4, sz * 1.4);
  for (let i = 1; i < 5; i++) { const y = i * Hh / 5, w = 4 - (4 - 1.4) * i / 5; B.add(box(w * 2, 0.15, 0.15), '#4a4e54', [0, y, w]); B.add(box(w * 2, 0.15, 0.15), '#4a4e54', [0, y, -w]); B.add(box(0.15, 0.15, w * 2), '#4a4e54', [w, y, 0]); B.add(box(0.15, 0.15, w * 2), '#4a4e54', [-w, y, 0]); }
  B.add(box(4.2, 0.4, 4.2), '#5a5e64', [0, Hh, 0]); B.add(box(2.6, 2.2, 2.6), c, [0, Hh + 1.3, 0]); B.add(box(2.62, 0.3, 2.62), RED, [0, Hh + 2.2, 0]);
  B.add(box(5, 3, 7), c, [5, 1.5, 5]); B.add(box(5.02, 0.3, 7.02), RED, [5, 2.9, 5]);
  D.add(box(9, 3, 0.35), '#d0d4d8', [0, 1.6, 0], [-0.25, 0, 0]); D.add(box(9.2, 0.25, 0.6), '#7a7e84', [0, 0.1, 0]); D.add(cyl(0.3, 0.3, 1, 8), '#5a5e64', [0, -0.3, 0]);
  L.add(new THREE.SphereGeometry(0.3, 6, 4), hot('#ff2a1a', 4), [1.4, Hh + 2.5, 1.4]); L.add(new THREE.SphereGeometry(0.3, 6, 4), hot('#ff2a1a', 4), [-1.4, Hh + 2.5, -1.4]);
  finish(g, B); finish(g, L, MAT.glow, false); const dish = pivot(g, D, [0, Hh + 3.2, 0], MAT.metal);
  return { group: g, dish };
}
export function fuelTank(c) {
  const g = new THREE.Group(), B = new Builder();
  B.add(cyl(8, 8, 9, 22), '#c8c6be', [0, 4.5, 0]); B.add(new THREE.SphereGeometry(16, 22, 6, 0, Math.PI * 2, 0, 0.5236), '#b8b6ae', [0, 9 - 16 * Math.cos(0.5236), 0]);
  B.add(cyl(8.05, 8.05, 1.2, 22), RED, [0, 6.5, 0]);
  for (let i = 0; i < 12; i++) B.add(box(0.15, 9.5, 0.15), '#7a7a74', [Math.cos(i * 0.5) * 8.1, 4.75, Math.sin(i * 0.5) * 8.1]);
  B.add(cylX(0.5, 8, 8), '#6a6a64', [9, 0.6, 0]);
  B.add(cyl(9.5, 9.5, 0.4, 22), '#7a7870', [0, 0.2, 0]);
  finish(g, B);
  return { group: g };
}
export function barracks(c) {
  const g = new THREE.Group(), B = new Builder();
  B.add(box(10, 4, 24), c, [0, 2, 0]);
  const roof = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-5.6, 0), new THREE.Vector2(5.6, 0), new THREE.Vector2(0, 2.6)]), { depth: 24.6, bevelEnabled: false });
  roof.translate(0, 0, -12.3); B.add(roof, '#5a4a3e', [0, 4, 0]);
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) B.add(box(0.1, 1.0, 1.6), '#1a1e22', [sx * 5.02, 2.4, -9 + i * 4.5]);
  B.add(box(2, 2.8, 0.1), '#2a2420', [0, 1.4, 12.03]);
  B.add(new THREE.CircleGeometry(1.2, 16), RED, [0, 5.4, 12.32]);
  finish(g, B);
  return { group: g };
}
export function bunker(c) {
  const g = new THREE.Group(), B = new Builder();
  B.add(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#8e8c84', [0, 0, 0], [0, 0, 0], [7, 3.6, 7]);
  B.add(box(5, 0.7, 0.5), '#121416', [0, 1.6, -6.0], [0.4, 0, 0]);
  B.add(box(3.4, 2.6, 4), '#7a7870', [0, 1.3, 6.4]); B.add(box(2.2, 2.0, 0.1), '#1a1a1c', [0, 1.1, 8.42]);
  B.add(cyl(0.2, 0.2, 3, 6), '#3a3a3c', [2.4, 4, 1]);
  finish(g, B);
  return { group: g };
}
export function hangar(c) {
  const g = new THREE.Group(), B = new Builder();
  const arch = new THREE.CylinderGeometry(15, 15, 36, 24, 1, true, -Math.PI / 2, Math.PI); arch.rotateX(-Math.PI / 2);
  B.add(arch, c, [0, 0, 0], [0, 0, 0], [1, 0.8, 1]);
  const end = new THREE.CircleGeometry(15, 24, 0, Math.PI); B.add(end, '#6a6e72', [0, 0, 18], [0, 0, 0], [1, 0.8, 1]); B.add(end.clone().rotateY(Math.PI), '#6a6e72', [0, 0, -18], [0, 0, 0], [1, 0.8, 1]);
  B.add(box(22, 10, 0.3), '#2a2c2e', [0, 5, -18.1]);
  B.add(box(30, 0.4, 0.3), RED, [0, 10.4, -18.15]);
  B.add(new THREE.CircleGeometry(3, 18).rotateX(-Math.PI / 2 + 0.0), RED, [0, 12.05, 0], [0, 0, 0]);
  finish(g, B);
  return { group: g };
}
export function command(c) {
  const g = new THREE.Group(), B = new Builder(), L = new Builder(), D = new Builder();
  B.add(box(30, 12, 30), '#7a7a74', [0, 6, 0]); B.add(box(31, 1, 31), '#5a5a56', [0, 12.5, 0]);
  B.add(box(12, 10, 12), c, [0, 18, 0]); B.add(box(12.2, 1.2, 12.2), RED, [0, 22, 0]);
  B.add(cyl(0.3, 0.4, 16, 6), '#3a3c40', [4, 31, 4]); B.add(cyl(0.2, 0.3, 12, 6), '#3a3c40', [-4, 29, 3]);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) B.add(box(2.6, 1.2, 0.2), '#14181c', [-10 + i * 4, 7, s * 15.05]);
  L.add(new THREE.SphereGeometry(0.4, 6, 4), hot('#ff2a1a', 5), [4, 39, 4]); L.add(new THREE.SphereGeometry(0.4, 6, 4), hot('#ff2a1a', 5), [-4, 35, 3]);
  D.add(new THREE.SphereGeometry(3.4, 14, 8, 0, Math.PI * 2, 0, 1.2), '#d8dade', [0, 0, 0], [Math.PI / 2 + 0.6, 0, 0]); D.add(cyl(0.3, 0.3, 2, 6), '#5a5e64', [0, -1, 0]);
  finish(g, B); finish(g, L, MAT.glow, false); const dish = pivot(g, D, [-8, 15, -8], MAT.metal);
  return { group: g, dish };
}
export function tent(c) {
  const g = new THREE.Group(), B = new Builder();
  B.add(new THREE.ConeGeometry(4.2, 3.6, 4), c, [0, 1.8, 0], [0, Math.PI / 4, 0]);
  finish(g, B); return { group: g };
}
export function crates(c) {
  const g = new THREE.Group(), B = new Builder();
  [[0, 0, 0], [2.1, 0, 0.3], [1, 1.9, 0.1], [-0.3, 0, 2.2]].forEach(([x, y, z], i) => B.add(box(2, 1.8, 2), i % 2 ? '#6a5a3a' : '#5a6040', [x, y + 0.9, z], [0, i * 0.3, 0]));
  finish(g, B); return { group: g };
}
export function tower(c) {
  const g = new THREE.Group(), B = new Builder();
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.add(box(0.35, 10, 0.35), '#4a3a2e', [sx * 1.6, 5, sz * 1.6]);
  B.add(box(4.4, 0.4, 4.4), '#5a4a3a', [0, 10, 0]); B.add(box(4.4, 1.2, 4.4), c, [0, 10.8, 0]); B.add(new THREE.ConeGeometry(3.4, 1.6, 4), '#4a3a2e', [0, 12.4, 0], [0, Math.PI / 4, 0]);
  finish(g, B); return { group: g };
}
export function controlTower(c) {
  const g = new THREE.Group(), B = new Builder(), L = new Builder();
  B.add(box(9, 16, 9), '#a8a8a2', [0, 8, 0]); B.add(cyl(6.5, 5.5, 1, 8), '#6a6a66', [0, 16.5, 0]);
  B.add(cyl(6.2, 6.2, 3.4, 8), '#1c2a38', [0, 18.7, 0]); B.add(cyl(6.6, 6.6, 0.8, 8), '#6a6a66', [0, 20.8, 0]);
  L.add(new THREE.SphereGeometry(0.4, 6, 4), hot('#ff2a1a', 5), [0, 22, 0]);
  finish(g, B, MAT.body); finish(g, L, MAT.glow, false); return { group: g };
}
export function wall(len, c = '#8a8780') {
  const g = new THREE.Group(), B = new Builder();
  B.add(box(4, 9, len), c, [0, 4.5, 0]);
  for (let z = -len / 2 + 1.5; z < len / 2; z += 4) B.add(box(4.4, 1.6, 2), c, [0, 9.8, z]);
  finish(g, B); return { group: g };
}
export function revetment(c = '#9a8c6a') {
  const g = new THREE.Group(), B = new Builder();
  B.add(box(2.5, 4, 26), c, [-12, 2, 0]); B.add(box(2.5, 4, 26), c, [12, 2, 0]); B.add(box(26.5, 4, 2.5), c, [0, 2, 12]);
  finish(g, B, MAT.body, false); return { group: g };
}
export function flag() {
  const g = new THREE.Group(), B = new Builder();
  B.add(cyl(0.12, 0.15, 12, 6), '#9a9a9a', [0, 6, 0]); B.add(box(4.2, 2.6, 0.08), RED, [2.15, 10.5, 0]); B.add(box(1.2, 0.9, 0.1), '#e8c45a', [2.15, 10.5, 0]);
  finish(g, B); return { group: g };
}
export function bridgeSegment(len, w = 14, c = '#8a8780') {
  const g = new THREE.Group(), B = new Builder();
  B.add(box(w, 1.8, len), c, [0, -0.9, 0]); B.add(box(w * 0.7, 0.05, len), '#3a3c40', [0, 0.02, 0]);
  for (const sx of [-1, 1]) { B.add(box(0.4, 1.2, len), '#6a6864', [sx * (w / 2 - 0.2), 0.6, 0]); }
  for (let z = -len / 2 + 2; z < len / 2; z += 6) for (const sx of [-1, 1]) B.add(box(0.5, 4, 0.5), '#5a5854', [sx * (w / 2 - 0.2), 2.6, z]);
  for (const sx of [-1, 1]) B.add(box(0.4, 0.4, len), '#5a5854', [sx * (w / 2 - 0.2), 4.6, 0]);
  finish(g, B); return { group: g };
}
export function pier(h, c = '#7a7872') {
  const g = new THREE.Group(), B = new Builder();
  B.add(box(10, h, 5), c, [0, -h / 2, 0]); finish(g, B); return { group: g };
}

/* ------------------------------------------------------------ ships (bow = -Z) */
function shipHull(B, L, W, H, c) {
  B.add(loft([
    { z: -L / 2, w: 0.2, ht: H * 0.7, hb: H * 0.2, y: H * 0.4, n: 2 }, { z: -L * 0.38, w: W * 0.32, ht: H * 0.55, hb: H * 0.5, y: H * 0.35, n: 2.4 },
    { z: -L * 0.15, w: W / 2, ht: H * 0.5, hb: H * 0.6, y: H * 0.3, n: 3.4 }, { z: L * 0.35, w: W / 2, ht: H * 0.5, hb: H * 0.6, y: H * 0.3, n: 3.4 }, { z: L / 2, w: W * 0.4, ht: H * 0.45, hb: H * 0.4, y: H * 0.35, n: 3.2 }
  ], 18), (x, y, z, col) => col.set(y < H * 0.05 ? '#5a1a1a' : c));
  B.add(box(W * 0.9, 0.2, L * 0.82), '#5a5e62', [0, H * 0.8, L * 0.04]);
}
export function patrolBoat(c) {
  const g = new THREE.Group(), B = new Builder(), T = new Builder(), G = new Builder();
  shipHull(B, 26, 6, 3.2, c);
  B.add(box(4, 3, 7), c, [0, 4, 1.5]); B.add(box(4.02, 0.8, 0.1), '#1a2228', [0, 4.8, -2.02]); B.add(cyl(0.12, 0.15, 6, 6), '#3a3c40', [0, 7, 3]); B.add(box(4.1, 0.3, 1), RED, [0, 5.6, 1.5]);
  T.add(cyl(0.9, 1.0, 0.8, 10), c, [0, 0.4, 0]); G.add(cylZ(0.1, 3, 6), DARK, [0.25, 0, -1.5]); G.add(cylZ(0.1, 3, 6), DARK, [-0.25, 0, -1.5]);
  finish(g, B); const tur = pivot(g, T, [0, 2.9, -7]); const gun = pivot(tur, G, [0, 0.9, 0]);
  return { group: g, turret: tur, gun };
}
export function frigate(c) {
  const g = new THREE.Group(), B = new Builder(), T = new Builder(), G = new Builder(), D = new Builder();
  shipHull(B, 92, 13, 7, c);
  B.add(box(10, 6, 26), c, [0, 9.5, 6]); B.add(box(8, 5, 10), c, [0, 14.5, 2]); B.add(box(8.05, 1.2, 0.1), '#1a2228', [0, 15.5, -3.02]);
  B.add(cyl(0.4, 0.8, 14, 6), '#4a4e52', [0, 23, 4]); B.add(box(5, 0.3, 0.3), '#4a4e52', [0, 26, 4]);
  B.add(box(5, 4, 6), c, [0, 8.5, 28]); B.add(box(10.1, 0.6, 26.1), RED, [0, 12.6, 6]);
  B.add(box(6, 2.4, 8), '#5a5e62', [0, 7.4, -22]); for (let i = 0; i < 4; i++) B.add(box(1.2, 0.2, 1.2), '#2a2a2c', [-1.8 + i * 1.2, 8.7, -22]);
  T.add(cyl(2.0, 2.2, 1.6, 12), c, [0, 0.8, 0]); T.add(box(3, 1.8, 3.6), c, [0, 1.8, 0.4]); G.add(cylZ(0.25, 7, 8), DARK, [0, 0, -3.6]);
  D.add(box(4.4, 2.2, 0.3), '#c8ccd0', [0, 0, 0]);
  finish(g, B); const tur = pivot(g, T, [0, 6.4, -34]); const gun = pivot(tur, G, [0, 2.2, -0.6]);
  const dish = pivot(g, D, [0, 27.5, 4], MAT.metal);
  return { group: g, turret: tur, gun, dish };
}
export function cargoShip(c) {
  const g = new THREE.Group(), B = new Builder();
  shipHull(B, 110, 18, 9, '#3a4a5a');
  B.add(box(14, 10, 12), '#d8d8d0', [0, 14, 44]); B.add(box(14.1, 1.2, 0.1), '#1a2228', [0, 17, 37.95]); B.add(cyl(1.4, 1.6, 8, 10), '#2a2a2c', [0, 22, 46]); B.add(cyl(1.42, 1.42, 1.2, 10), RED, [0, 25, 46]);
  const cc = ['#a83a2a', '#2a6a8a', '#c8a03a', '#4a7a3a', '#6a6a6a', RED];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < (i + j) % 3 + 1; k++) B.add(box(5.2, 2.6, 11.5), cc[(i * 3 + j + k) % 6], [-5.6 + j * 5.6, 8.6 + k * 2.6, -36 + i * 12.4]);
  finish(g, B); return { group: g };
}
export function crane(c = '#c89a2a') {
  const g = new THREE.Group(), B = new Builder();
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.add(box(0.8, 26, 0.8), c, [sx * 4, 13, sz * 4]);
  B.add(box(9, 3, 9), c, [0, 27.5, 0]); B.add(box(2.4, 2.4, 50), c, [0, 30, -12]); B.add(box(1, 12, 1), c, [0, 35, 4]);
  B.add(box(4, 3, 4), '#3a3a3c', [0, 27.5, 9]);
  finish(g, B); return { group: g };
}
export function dock(len, w = 24) {
  const g = new THREE.Group(), B = new Builder();
  B.add(box(w, 6, len), '#8a8780', [0, -2, 0]); for (let z = -len / 2 + 5; z < len / 2; z += 10) B.add(cyl(0.6, 0.6, 1, 8), '#3a3a3c', [w / 2 - 1.5, 1.5, z]);
  finish(g, B, MAT.body); return { group: g };
}

/* ------------------------------------------------------------ city (instanced) */
export function windowTexture(night) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = night ? '#000' : '#9aa0a6'; g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 128; y += 10) for (let x = 4; x < 64; x += 10) {
    const on = Math.random() < (night ? 0.38 : 0.0);
    g.fillStyle = night ? (on ? (Math.random() < 0.7 ? '#ffd890' : '#bfe0ff') : '#000') : '#3a4450';
    g.fillRect(x, y, 6, 6);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

/* ------------------------------------------------------------ registry */
/* hp, hit radius, centre height, score, boom size, kind */
export const TYPES = {
  tank: { make: c => tank(c), hp: 260, r: 5, cy: 1.6, score: 150, boom: 1.2, label: 'Tank', moving: true },
  aav: { make: c => aav(c), hp: 200, r: 5, cy: 1.8, score: 220, boom: 1.2, label: 'Mobile AA', aa: { range: 1700, rate: 9, spread: 0.022, dmg: 3.2 } },
  truck: { make: c => truck(c), hp: 90, r: 4.5, cy: 1.6, score: 80, boom: 0.9, label: 'Truck', moving: true },
  fuelTruck: { make: c => truck(c, true), hp: 80, r: 4.5, cy: 1.8, score: 110, boom: 1.6, label: 'Fuel truck', fuel: true, moving: true },
  sam: { make: c => samLauncher(c), hp: 220, r: 6, cy: 2, score: 400, boom: 1.6, label: 'SAM launcher', sam: { range: 3600, lock: 2.6, reload: 9, shots: 4 } },
  aa: { make: c => aaGun(c), hp: 160, r: 5, cy: 1.5, score: 200, boom: 1.1, label: 'AA gun', aa: { range: 1600, rate: 8, spread: 0.026, dmg: 3 } },
  flak: { make: c => aaGun(c, true), hp: 300, r: 6.5, cy: 2, score: 300, boom: 1.4, label: 'Flak cannon', flak: { range: 2600, rate: 1.4, dmg: 9 } },
  radar: { make: c => radar(c), hp: 300, r: 9, cy: 12, score: 350, boom: 1.8, label: 'Radar tower', radar: true },
  fuel: { make: c => fuelTank(c), hp: 240, r: 10, cy: 5, score: 300, boom: 3.2, label: 'Fuel tank', fuel: true },
  barracks: { make: c => barracks(c), hp: 420, r: 12, cy: 3, score: 250, boom: 2.0, label: 'Barracks' },
  bunker: { make: c => bunker(c), hp: 420, r: 8, cy: 2, score: 300, boom: 1.8, label: 'Bunker', armored: 0.35 },
  hangar: { make: c => hangar(c), hp: 700, r: 17, cy: 6, score: 450, boom: 2.6, label: 'Hangar' },
  command: { make: c => command(c), hp: 2600, r: 20, cy: 10, score: 1500, boom: 4, label: 'Command centre', armored: 0.5 },
  tent: { make: c => tent(c), hp: 50, r: 4, cy: 1.5, score: 40, boom: 0.7, label: 'Tent' },
  crates: { make: c => crates(c), hp: 60, r: 3.5, cy: 1.5, score: 40, boom: 0.8, label: 'Supplies' },
  tower: { make: c => tower(c), hp: 100, r: 4, cy: 8, score: 60, boom: 0.9, label: 'Watchtower' },
  ctower: { make: c => controlTower(c), hp: 500, r: 8, cy: 10, score: 350, boom: 2.0, label: 'Control tower' },
  patrol: { make: c => patrolBoat(c), hp: 220, r: 11, cy: 3, score: 300, boom: 1.6, label: 'Patrol boat', ship: true, aa: { range: 1500, rate: 7, spread: 0.03, dmg: 2.2 } },
  frigate: { make: c => frigate(c), hp: 900, r: 34, cy: 8, score: 1200, boom: 3, label: 'Frigate', ship: true, sam: { range: 4000, lock: 2.3, reload: 8, shots: 6 }, aa: { range: 1700, rate: 9, spread: 0.022, dmg: 2.5 } },
  cargo: { make: c => cargoShip(c), hp: 700, r: 40, cy: 8, score: 800, boom: 2.6, label: 'Cargo ship', ship: true },
  parked: { make: c => parkedJet(), hp: 120, r: 9, cy: 2, score: 350, boom: 1.6, label: 'Parked fighter', fuel: true },
  bridge: { make: null, hp: 900, r: 14, cy: 0, score: 900, boom: 2.4, label: 'Bridge', armored: 0.3 },
  fighter: { make: null, hp: 140, r: 11, cy: 0, score: 600, boom: 1.6, label: 'Enemy fighter', air: true }
};
function parkedJet() {
  const j = buildJet({ enemy: true, hi: false }); j.group.position.y = 2.1; j.setEngine(0, 0, 0); j.flames.forEach(f => { f.outer.visible = false; f.core.visible = false; });
  const g = new THREE.Group(); g.add(j.group); g.userData.jet = j;
  // gear struts (parked jets have their gear down)
  const B = new Builder(); for (const [x, z] of [[0, -6.4], [-1.6, 1.4], [1.6, 1.4]]) { B.add(cyl(0.09, 0.09, 1.6, 6), '#9a9ea2', [x, 0.9, z]); B.add(cylX(0.36, 0.3, 10), TYRE, [x, 0.36, z]); }
  finish(g, B);
  return { group: g };
}

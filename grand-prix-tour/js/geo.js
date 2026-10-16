/* Shared low-poly geometry helpers for the scenery props. Every part is
 * baked with a vertex colour so a whole prop is one merged geometry. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
export function P(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
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
export const M = parts => { const g = mergeGeometries(parts); g.computeBoundingSphere(); return g; };
export const cyl = (r0, r1, h, s = 6) => { const g = new THREE.CylinderGeometry(r1, r0, h, s); g.translate(0, h / 2, 0); return g; };
export const cone = (r, h, s = 7) => { const g = new THREE.ConeGeometry(r, h, s); g.translate(0, h / 2, 0); return g; };
export const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
export const bx = (w, h, d) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return g; };
export const dome = (r, s = 12) => new THREE.SphereGeometry(r, s, Math.max(4, s >> 1), 0, Math.PI * 2, 0, Math.PI / 2);

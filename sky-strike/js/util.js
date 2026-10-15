/* Sky Strike — shared helpers: maths, seeded RNG, gradient noise and a small
 * geometry builder that bakes colours into vertices so whole vehicles merge
 * into one draw call. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const TAU = Math.PI * 2;
export const wrapPi = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

export function rng(seed) {
  let a = seed >>> 0;
  const r = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  return r;
}

/* 2D gradient (Perlin) noise in [-1, 1]. */
export function makeNoise(seed) {
  const R = rng(seed), p = new Uint8Array(512), gx = new Float32Array(256), gy = new Float32Array(256);
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  for (let i = 0; i < 256; i++) { const a = R() * TAU; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const a = p[p[X] + Y], b = p[p[X + 1] + Y], c = p[p[X] + Y + 1], d = p[p[X + 1] + Y + 1];
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const n00 = gx[a] * xf + gy[a] * yf, n10 = gx[b] * (xf - 1) + gy[b] * yf;
    const n01 = gx[c] * xf + gy[c] * (yf - 1), n11 = gx[d] * (xf - 1) + gy[d] * (yf - 1);
    const x1 = n00 + u * (n10 - n00), x2 = n01 + u * (n11 - n01);
    return (x1 + v * (x2 - x1)) * 1.42;
  };
}
export function fbm(n, x, y, oct = 5, lac = 2.03, gain = 0.5) {
  let s = 0, a = 1, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += n(x * f, y * f) * a; norm += a; a *= gain; f *= lac; }
  return s / norm;
}
export function ridged(n, x, y, oct = 5, lac = 2.0, gain = 0.5) {
  let s = 0, a = 1, f = 1, norm = 0, w = 1;
  for (let i = 0; i < oct; i++) { let v = 1 - Math.abs(n(x * f, y * f)); v *= v * w; w = clamp(v * 1.6, 0, 1); s += v * a; norm += a; a *= gain; f *= lac; }
  return s / norm;
}

/* distance from point to polyline [[x,z],...]; returns {d, t (0..1 along the whole line), x, z} */
export function polyDist(pts, x, z, out = {}) {
  let best = Infinity, bt = 0, bx = 0, bz = 0, acc = 0, total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], az = pts[i][1], dx = pts[i + 1][0] - ax, dz = pts[i + 1][1] - az, L2 = dx * dx + dz * dz, L = Math.sqrt(L2);
    let t = L2 ? ((x - ax) * dx + (z - az) * dz) / L2 : 0; t = clamp(t, 0, 1);
    const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; bt = (acc + t * L) / total; bx = px; bz = pz; }
    acc += L;
  }
  out.d = best; out.t = bt; out.x = bx; out.z = bz; out.len = total;
  return out;
}
/* Catmull-Rom smooth a polyline into `n` points per segment */
export function smoothPath(pts, n = 6) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
/* point + heading at fraction t along polyline */
export function pathAt(pts, t, out = {}) {
  let C = pts._cum;
  if (!C) { C = pts._cum = [0]; for (let i = 0; i < pts.length - 1; i++) C.push(C[i] + Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])); }
  const total = C[C.length - 1], d = clamp(t, 0, 1) * total;
  let lo = 0, hi = C.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (C[m] <= d) lo = m; else hi = m; }
  const a = pts[lo], b = pts[lo + 1] || a, L = C[lo + 1] - C[lo], f = L ? clamp((d - C[lo]) / L, 0, 1) : 0;
  out.x = a[0] + (b[0] - a[0]) * f; out.z = a[1] + (b[1] - a[1]) * f; out.yaw = Math.atan2(b[0] - a[0], b[1] - a[1]); out.len = total;
  return out;
}

/* ------------------------------------------------------------ geometry builder */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
export function mat4(pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  _e.set(rot[0], rot[1], rot[2], 'YXZ'); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_v.set(pos[0], pos[1], pos[2]), _q, _s.set(scl[0], scl[1], typeof scl[2] === 'number' ? scl[2] : scl[0]));
}
function prep(geo, color, m) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (m) {
    g.applyMatrix4(m);
    if (m.determinant() < 0) { // mirrored: flip winding so faces still point out
      const p = g.attributes.position.array, n = g.attributes.normal.array;
      for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; const u = n[i + 3 + k]; n[i + 3 + k] = n[i + 6 + k]; n[i + 6 + k] = u; }
    }
  }
  const pos = g.attributes.position, cnt = pos.count, arr = new Float32Array(cnt * 3);
  if (typeof color === 'function') {
    for (let i = 0; i < cnt; i++) { const c = color(pos.getX(i), pos.getY(i), pos.getZ(i), _c); arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  } else {
    const c = color instanceof THREE.Color ? color : _c.set(color);
    const mul = Array.isArray(color) ? 1 : 1;
    for (let i = 0; i < cnt; i++) { arr[i * 3] = c.r * mul; arr[i * 3 + 1] = c.g * mul; arr[i * 3 + 2] = c.b * mul; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
export class Builder {
  constructor() { this.parts = []; }
  /* geo: BufferGeometry; color: hex/Color/fn(x,y,z,outColor)->Color; pos/rot/scl or matrix */
  add(geo, color, pos, rot, scl) { this.parts.push(prep(geo, color, pos instanceof THREE.Matrix4 ? pos : mat4(pos, rot, scl))); return this; }
  addM(geo, color, m) { this.parts.push(prep(geo, color, m)); return this; }
  get empty() { return !this.parts.length; }
  geometry() { const g = mergeGeometries(this.parts, false); this.parts.forEach(p => p.dispose()); this.parts = []; g.computeBoundingSphere(); return g; }
  mesh(material) { const m = new THREE.Mesh(this.geometry(), material); return m; }
}
export const hot = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return c; };

/* soft radial / noisy puff textures made on a canvas */
export function puffTexture(size = 128, seed = 3, kind = 'smoke') {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), R = rng(seed);
  if (kind === 'soft') {
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
  } else if (kind === 'fire') {
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.8)'); gr.addColorStop(0.8, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 14; i++) { const a = R() * TAU, r = size * (0.3 + R() * 0.2), x = size / 2 + Math.cos(a) * r, y = size / 2 + Math.sin(a) * r, rad = size * (0.06 + R() * 0.1); const g2 = g.createRadialGradient(x, y, 0, x, y, rad); g2.addColorStop(0, 'rgba(0,0,0,.7)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = g2; g.fillRect(0, 0, size, size); }
    g.globalCompositeOperation = 'source-over';
  } else {
    for (let i = 0; i < 26; i++) {
      const a = R() * TAU, r = R() * size * 0.22, x = size / 2 + Math.cos(a) * r, y = size / 2 + Math.sin(a) * r, rad = size * (0.12 + R() * 0.2);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,.42)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, size, size);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
  return t;
}

/* precomputed distance-to-polyline field (bilinear), exact outside its range */
export function distField(pts, half = 4700, cell = 40) {
  const n = Math.ceil(half * 2 / cell) + 1, F = new Float32Array(n * n), o = {};
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) F[j * n + i] = polyDist(pts, -half + i * cell, -half + j * cell, o).d;
  return (x, z) => {
    const fx = (x + half) / cell, fz = (z + half) / cell;
    if (fx < 0 || fz < 0 || fx >= n - 1 || fz >= n - 1) return polyDist(pts, x, z, o).d;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * n + i;
    return (F[k] * (1 - u) + F[k + 1] * u) * (1 - v) + (F[k + n] * (1 - u) + F[k + n + 1] * u) * v;
  };
}

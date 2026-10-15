/* Point-to-point road generator.
 * A route is built as a curvature profile (straights, sweepers, hairpins,
 * chicanes), smoothed into clothoid-like transitions and integrated into a
 * centreline sampled every DS metres. Everything else — road ribbons, kerbs,
 * barriers, terrain, racing line, AI speed profile — is derived from it. */
import * as THREE from 'three';
import * as TX from './textures.js';

export const DS = 2;
export const START_S = 140;          // the start line; the grid sits behind it
const AFTER = 360;                   // road after the finish line to slow down
const CHUNK = 100;                   // samples per mesh chunk (200 m)

const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function boxFilter(src, r, passes = 1) {
  let a = Float32Array.from(src);
  const n = a.length, b = new Float32Array(n);
  for (let p = 0; p < passes; p++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += a[Math.min(n - 1, Math.max(0, i))];
    for (let i = 0; i < n; i++) {
      b[i] = acc / (2 * r + 1);
      acc += a[Math.min(n - 1, i + r + 1)] - a[Math.max(0, i - r)];
    }
    [a] = [Float32Array.from(b)];
  }
  return a;
}

// cheap value noise for terrain
function hash2(x, z, seed) { const h = Math.sin(x * 127.1 + z * 311.7 + seed * 17.13) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed), c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z, seed) { return vnoise(x, z, seed) * 0.55 + vnoise(x * 2.1, z * 2.1, seed + 3) * 0.3 + vnoise(x * 4.3, z * 4.3, seed + 7) * 0.15; }

export class Track {
  constructor(L) {
    this.L = L;
    let seed = L.seed;
    for (let tries = 0; tries < 30; tries++, seed += 101) {
      this.generate(seed);
      if (this.selfClear()) break;
    }
    this.derive();
  }

  /* ------------------------------------------------------------ centreline */
  generate(seed) {
    const L = this.L, r = TX.rng(seed);
    this.seed = seed;
    this.finishS = START_S + L.length;
    this.totalS = this.finishS + AFTER;
    const n = this.n = Math.ceil(this.totalS / DS) + 1;
    const k = new Float32Array(n);
    const maxDev = L.maxDev * Math.PI / 180;
    const w = L.mix, types = Object.keys(w), tot = types.reduce((a, t) => a + w[t], 0);
    const pick = () => { let x = r() * tot; for (const t of types) { x -= w[t]; if (x <= 0) return t; } return 'sweep'; };
    const R = (a, b) => a + r() * (b - a);
    let s = START_S + 180 + r() * 120, dev = 0;
    const arc = (sign, rad, ang) => {
      const len = rad * ang, i0 = Math.round(s / DS), i1 = Math.round((s + len) / DS);
      for (let i = i0; i < i1 && i < n; i++) k[i] = sign / rad;
      s += len; dev += sign * ang;
    };
    const straight = len => { s += len; };
    const chooseSign = ang => {
      const bias = 0.5 + Math.min(1, Math.abs(dev) / maxDev) * 0.45;
      let sign = r() < bias ? -Math.sign(dev || (r() - 0.5)) : Math.sign(dev || (r() - 0.5));
      if (Math.abs(dev + sign * ang) > maxDev) sign = -sign;
      return sign || 1;
    };
    const endS = this.finishS - 120;
    while (s < endS) {
      const t = pick();
      if (t === 'sweep') { const a = R(20, 55) * Math.PI / 180; arc(chooseSign(a), R(180, 420), a); }
      else if (t === 'medium') { const a = R(35, 90) * Math.PI / 180; arc(chooseSign(a), R(70, 140), a); }
      else if (t === 'tight') { const a = R(60, 100) * Math.PI / 180; arc(chooseSign(a), R(30, 52), a); }
      else if (t === 'hairpin') {
        const a = R(140, 170) * Math.PI / 180, rad = R(17, 24), sg = Math.abs(dev) > 0.2 ? -Math.sign(dev) : (r() < 0.5 ? 1 : -1);
        arc(sg, rad, a); straight(R(60, 110)); arc(-sg, rad * R(0.95, 1.15), a * R(0.9, 1.0));
      } else { // chicane
        const a = R(22, 38) * Math.PI / 180, rad = R(28, 42), sg = chooseSign(a);
        arc(sg, rad, a); straight(R(4, 14)); arc(-sg, rad, a * 2); straight(R(4, 14)); arc(sg, rad, a);
      }
      straight(R(L.straight[0], L.straight[1]));
    }
    this.kRaw = k;
    const ks = boxFilter(k, 6, 2);
    // integrate
    const x = new Float32Array(n), z = new Float32Array(n), th = new Float32Array(n), y = new Float32Array(n);
    const dir = r() * Math.PI * 2;
    let hx = 0, hz = 0, h = dir;
    const a1 = r() * 6, a2 = r() * 6;
    for (let i = 0; i < n; i++) {
      x[i] = hx; z[i] = hz; th[i] = h;
      const ss = i * DS;
      const ramp = smooth01(START_S + 60, START_S + 320, ss);
      y[i] = (L.elev * (Math.sin(ss / 310 + a1) * 0.6 + Math.sin(ss / 137 + a2) * 0.4) + L.climb * Math.max(0, ss - START_S - 60)) * ramp;
      h += ks[i] * DS;
      hx += Math.sin(th[i] + ks[i] * DS * 0.5) * DS; hz += Math.cos(th[i] + ks[i] * DS * 0.5) * DS;
    }
    Object.assign(this, { x, z, y, th, k: ks });
    // width with narrow sections
    const wd = new Float32Array(n).fill(L.width);
    for (let q = 0; q < L.narrow.count; q++) {
      const c = START_S + 400 + r() * (L.length - 700), half = R(140, 260);
      for (let i = 0; i < n; i++) {
        const ss = i * DS, t = 1 - smooth01(half, half + 50, Math.abs(ss - c));
        wd[i] = Math.min(wd[i], L.width + (L.narrow.w - L.width) * t);
      }
    }
    this.w = wd;
  }

  selfClear() {
    const { x, z, n } = this, bd = this.L.width / 2 + 9, minD = 2 * bd + 30;
    for (let i = 0; i < n; i += 6) for (let j = i + 200; j < n; j += 6) {
      const dx = x[i] - x[j], dz = z[i] - z[j];
      if (dx * dx + dz * dz < minD * minD) return false;
    }
    return true;
  }

  /* ---------------------------------------------- derived race data */
  derive() {
    const L = this.L, n = this.n, k = this.k;
    this.runoff = L.city ? 3.2 : 6.5;
    // racing line: Mexican-hat of curvature (outside, apex, outside)
    const kn = boxFilter(k, 10, 1), kw = boxFilter(k, 45, 1);
    const line = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const hat = kn[i] - 0.75 * kw[i], lim = this.w[i] / 2 - 1.7;
      line[i] = Math.max(-lim, Math.min(lim, hat * 520));
    }
    this.line = boxFilter(line, 8, 2);
    for (let i = 0; i < n; i++) { const lim = this.w[i] / 2 - 1.6; this.line[i] = Math.max(-lim, Math.min(lim, this.line[i])); }
    this.kAbs = boxFilter(k.map(Math.abs), 4, 1);
    // DRS zones on the longest straights
    const zones = [];
    let st = -1;
    for (let i = 0; i < n; i++) {
      const s = i * DS, straightish = this.kAbs[i] < 1 / 900 && s > START_S + 250 && s < this.finishS - 60;
      if (straightish && st < 0) st = s;
      if ((!straightish || i === n - 1) && st >= 0) { if (s - st > 320) zones.push([st + 40, s - 90]); st = -1; }
    }
    zones.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
    this.drs = zones.slice(0, 3).sort((a, b) => a[0] - b[0]);
    this.drsFlag = new Uint8Array(n);
    for (const [a, b] of this.drs) for (let i = Math.floor(a / DS); i <= b / DS; i++) this.drsFlag[i] = 1;
    this.checkpoints = [];
    for (let c = 1; c <= 5; c++) this.checkpoints.push(Math.round((START_S + L.length * c / 6) / 10) * 10);
    // spatial hash for lost-car / scenery queries
    this.cell = 48; this.grid = new Map();
    for (let i = 0; i < n; i += 2) {
      const key = Math.floor(this.x[i] / this.cell) + ',' + Math.floor(this.z[i] / this.cell);
      let a = this.grid.get(key); if (!a) this.grid.set(key, a = []); a.push(i);
    }
    let minY = Infinity; for (let i = 0; i < n; i++) minY = Math.min(minY, this.y[i]);
    this.seaY = minY - 4.5;
    this.speedCache = new Map();
  }

  /* Speed profile for a given grip: max corner speed, then braking backward
   * and traction forward. DRS zones get a little extra top speed. */
  profile(aLat, brake = 30, vTop = 91, accel = null) {
    const key = aLat + ':' + brake + ':' + vTop;
    if (this.speedCache.has(key)) return this.speedCache.get(key);
    const n = this.n, v = new Float32Array(n);
    for (let i = 0; i < n; i++) v[i] = Math.min(vTop + (this.drsFlag[i] ? 6 : 0), Math.sqrt(aLat * 1.12 / Math.max(this.kAbs[i], 1e-5)));
    for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * brake * DS));
    const acc = accel || (vv => 13 * Math.max(0.05, 1 - Math.pow(vv / (vTop + 2), 2.2)));
    v[0] = 0;
    for (let i = 0; i < n - 1; i++) v[i + 1] = Math.min(v[i + 1], Math.sqrt(v[i] * v[i] + 2 * acc(v[i]) * DS));
    this.speedCache.set(key, v);
    return v;
  }

  /* ---------------------------------------------- queries */
  idx(s) { return Math.max(0, Math.min(this.n - 2, Math.floor(s / DS))); }
  at(s, d, out) {
    const i = this.idx(s), f = Math.max(0, Math.min(1, s / DS - i));
    const th = this.th[i] + (this.th[i + 1] - this.th[i]) * f;
    const cx = this.x[i] + (this.x[i + 1] - this.x[i]) * f, cz = this.z[i] + (this.z[i + 1] - this.z[i]) * f;
    out.x = cx + Math.cos(th) * d; out.z = cz - Math.sin(th) * d;
    out.y = this.y[i] + (this.y[i + 1] - this.y[i]) * f;
    out.th = th; out.w = this.w[i] + (this.w[i + 1] - this.w[i]) * f;
    out.slope = (this.y[i + 1] - this.y[i]) / DS;
    return out;
  }
  lerp(arr, s) { const i = this.idx(s), f = Math.max(0, Math.min(1, s / DS - i)); return arr[i] + (arr[i + 1] - arr[i]) * f; }

  /* Nearest point on the centreline, searched around a hint index. */
  project(px, pz, hint, out) {
    const { x, z, n } = this;
    let best = -1, bd = Infinity;
    const lo = Math.max(0, hint - 40), hi = Math.min(n - 1, hint + 40);
    for (let i = lo; i <= hi; i++) { const dx = px - x[i], dz = pz - z[i], dd = dx * dx + dz * dz; if (dd < bd) { bd = dd; best = i; } }
    if (bd > 60 * 60) { const g = this.nearest(px, pz); if (g.i >= 0) best = g.i; }
    // refine on the segment best..best+1 or best-1..best
    let i = Math.min(best, n - 2);
    const fwd = (px - x[i]) * Math.sin(this.th[i]) + (pz - z[i]) * Math.cos(this.th[i]);
    if (fwd < 0 && i > 0) i--;
    const tx = Math.sin(this.th[i]), tz = Math.cos(this.th[i]);
    const f = Math.max(0, Math.min(1, ((px - x[i]) * tx + (pz - z[i]) * tz) / DS));
    out.i = i; out.s = (i + f) * DS;
    const th = this.th[i] + (this.th[i + 1] - this.th[i]) * f;
    const cx = x[i] + (x[i + 1] - x[i]) * f, cz = z[i] + (z[i + 1] - z[i]) * f;
    out.d = (px - cx) * Math.cos(th) - (pz - cz) * Math.sin(th);
    out.th = th; out.y = this.y[i] + (this.y[i + 1] - this.y[i]) * f;
    out.w = this.w[i];
    return out;
  }

  /* Global nearest sample via the spatial hash (falls back to coarse scan). */
  nearest(px, pz, maxRing = 3) {
    const c = this.cell, gx = Math.floor(px / c), gz = Math.floor(pz / c);
    let best = -1, bd = Infinity;
    for (let ring = 0; ring <= maxRing; ring++) {
      for (let ix = gx - ring; ix <= gx + ring; ix++) for (let iz = gz - ring; iz <= gz + ring; iz++) {
        if (ring && Math.abs(ix - gx) !== ring && Math.abs(iz - gz) !== ring) continue;
        const a = this.grid.get(ix + ',' + iz); if (!a) continue;
        for (const i of a) { const dx = px - this.x[i], dz = pz - this.z[i], dd = dx * dx + dz * dz; if (dd < bd) { bd = dd; best = i; } }
      }
      if (best >= 0 && ring >= 1) break;
    }
    if (best < 0) {
      for (let i = 0; i < this.n; i += 12) { const dx = px - this.x[i], dz = pz - this.z[i], dd = dx * dx + dz * dz; if (dd < bd) { bd = dd; best = i; } }
      const lo = Math.max(0, best - 12), hi = Math.min(this.n - 1, best + 12);
      for (let i = lo; i <= hi; i++) { const dx = px - this.x[i], dz = pz - this.z[i], dd = dx * dx + dz * dz; if (dd < bd) { bd = dd; best = i; } }
    }
    const d = best >= 0 ? (px - this.x[best]) * Math.cos(this.th[best]) - (pz - this.z[best]) * Math.sin(this.th[best]) : 0;
    return { i: best, dist: Math.sqrt(bd), d };
  }

  /* Terrain height: follows the road near it, rises into hills or falls
   * into the sea further out. Used for the terrain mesh and for props. */
  groundY(px, pz, near) {
    const L = this.L, g = near || this.nearest(px, pz, 4);
    const i = g.i, dist = g.dist, bd = this.w[i] / 2 + this.runoff;
    let h = this.y[i] - 0.45;
    const ex = dist - bd;
    if (ex > 8) {
      const hill = L.hill * smooth01(30, L.theme === 'alps' ? 260 : 420, ex);
      const nz = fbm(px / 260, pz / 260, L.seed % 97);
      h += hill * (L.theme === 'alps' ? 0.35 + nz * 1.1 : nz) + (L.theme === 'desert' ? Math.sin(px / 23 + Math.sin(pz / 41) * 2) * 2.2 * smooth01(20, 80, ex) : 0);
      if (L.coast && L.sea) {
        const side = L.coast === 'left' ? 1 : -1;
        if (Math.sign(g.d) === side) { const t = smooth01(14, 70, ex); h = h * (1 - t) + (this.seaY - 9) * t; }
      }
    }
    return h;
  }

  /* ---------------------------------------------- meshes */
  build(scene, quality) {
    const L = this.L, group = new THREE.Group(); group.name = 'track';
    this.group = group;
    this.chunks = [];
    const asphalt = TX.asphalt(L.road, L.line, !!L.wet);
    const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: L.wet ? 0.28 : 0.86, metalness: L.wet ? 0.25 : 0.02, color: L.night ? '#d8d8e0' : '#ffffff' });
    const kerbMat = new THREE.MeshLambertMaterial({ map: TX.kerb() });
    const neonCols = { tokyo: '#ff2fa8', vegas: '#ffcf2a', singapore: '#2fe0ff' };
    const barTex = TX.barrier(L.barrier, neonCols[L.theme] || '#ff2fa8');
    const barMat = L.barrier === 'neon' ? new THREE.MeshBasicMaterial({ map: barTex, side: THREE.DoubleSide })
      : new THREE.MeshLambertMaterial({ map: barTex, side: THREE.DoubleSide });
    const runMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: TX.detail() });
    TX.detail().repeat.set(1, 1);
    this.materials = [roadMat, kerbMat, barMat, runMat];
    const barH = L.barrier === 'armco' ? 0.95 : L.barrier === 'tecpro' ? 1.15 : 1.5;
    const nearCol = new THREE.Color(L.ground.near), sandCol = new THREE.Color(L.theme === 'alps' ? '#cfd6dd' : L.city ? '#5c5c66' : '#c8b48a');
    for (let c0 = 0; c0 < this.n - 1; c0 += CHUNK) {
      const c1 = Math.min(this.n - 1, c0 + CHUNK);
      const ch = new THREE.Group();
      ch.add(new THREE.Mesh(this.ribbon(c0, c1, i => [this.w[i] / 2, -this.w[i] / 2], 0, 'road'), roadMat));
      const kg = this.kerbGeo(c0, c1); if (kg) ch.add(new THREE.Mesh(kg, kerbMat));
      ch.add(new THREE.Mesh(this.runoffGeo(c0, c1, nearCol, sandCol), runMat));
      for (const side of [1, -1]) ch.add(new THREE.Mesh(this.wallGeo(c0, c1, side, barH), barMat));
      ch.userData.s0 = c0 * DS; ch.userData.s1 = c1 * DS;
      const mid = (c0 + c1) >> 1; ch.userData.cx = this.x[mid]; ch.userData.cz = this.z[mid];
      ch.children.forEach(m => { m.matrixAutoUpdate = false; m.updateMatrix(); });
      group.add(ch); this.chunks.push(ch);
    }
    this.buildTerrain(group, quality);
    if (L.sea) {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000), new THREE.MeshStandardMaterial({ color: L.sea, roughness: 0.18, metalness: 0.3 }));
      sea.rotation.x = -Math.PI / 2; sea.position.set(this.x[this.n >> 1], this.seaY, this.z[this.n >> 1]);
      group.add(sea); this.sea = sea;
    }
    scene.add(group);
    return group;
  }

  ribbon(c0, c1, edges, lift, uvMode) {
    const cnt = c1 - c0 + 1, pos = new Float32Array(cnt * 6), uv = new Float32Array(cnt * 4), nor = new Float32Array(cnt * 6);
    for (let j = 0; j < cnt; j++) {
      const i = c0 + j, [a, b] = edges(i), c = Math.cos(this.th[i]), s = Math.sin(this.th[i]);
      pos.set([this.x[i] + c * a, this.y[i] + lift, this.z[i] - s * a, this.x[i] + c * b, this.y[i] + lift, this.z[i] - s * b], j * 6);
      nor.set([0, 1, 0, 0, 1, 0], j * 6);
      uv.set([0, i * DS / 16, 1, i * DS / 16], j * 4);
    }
    const idx = [];
    for (let j = 0; j < cnt - 1; j++) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeBoundingSphere();
    return g;
  }

  kerbGeo(c0, c1) {
    const pos = [], uv = [], idx = [];
    for (const side of [1, -1]) {
      for (let i = c0; i < c1; i++) {
        if (this.kAbs[i] < 1 / 230 && this.kAbs[i + 1] < 1 / 230) continue;
        const base = pos.length / 3;
        for (const ii of [i, i + 1]) {
          const c = Math.cos(this.th[ii]), s = Math.sin(this.th[ii]), a = side * this.w[ii] / 2, b = side * (this.w[ii] / 2 + 1.25);
          pos.push(this.x[ii] + c * a, this.y[ii] + 0.035, this.z[ii] - s * a, this.x[ii] + c * b, this.y[ii] + 0.07, this.z[ii] - s * b);
          uv.push(0, ii * DS / 4, 1, ii * DS / 4);
        }
        if (side < 0) idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        else idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    }
    if (!idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }

  /* Runoff: grass/sand/pavement between road edge and barrier, plus a lip
   * outside the barrier that tucks under the terrain. */
  runoffGeo(c0, c1, nearCol, sandCol) {
    const offs = [0, 0.5, 1, 1.0, 1.35]; // fractions: road edge .. barrier .. outer
    const pos = [], col = [], uv = [], idx = [];
    const cnt = c1 - c0 + 1, per = offs.length;
    for (const side of [1, -1]) {
      const base0 = pos.length / 3;
      for (let j = 0; j < cnt; j++) {
        const i = c0 + j, c = Math.cos(this.th[i]), s = Math.sin(this.th[i]), hw = this.w[i] / 2;
        const outside = Math.sign(this.k[i]) === -side && this.kAbs[i] > 1 / 160; // outside of a corner: gravel
        for (let q = 0; q < per; q++) {
          const lat = q === 4 ? hw + this.runoff + 9 : hw + this.runoff * offs[q];
          const dy = q === 4 ? -0.9 : q === 3 ? 0 : -0.03;
          const d = side * lat;
          pos.push(this.x[i] + c * d, this.y[i] + dy, this.z[i] - s * d);
          const cc = (outside && q > 0 && q < 3) ? sandCol : nearCol;
          col.push(cc.r, cc.g, cc.b);
          uv.push(lat / 6, i * DS / 6);
        }
      }
      for (let j = 0; j < cnt - 1; j++) for (let q = 0; q < per - 1; q++) {
        const a = base0 + j * per + q, b = a + per;
        if (side > 0) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }

  wallGeo(c0, c1, side, h) {
    const cnt = c1 - c0 + 1, pos = new Float32Array(cnt * 6), uv = new Float32Array(cnt * 4);
    for (let j = 0; j < cnt; j++) {
      const i = c0 + j, c = Math.cos(this.th[i]), s = Math.sin(this.th[i]), d = side * (this.w[i] / 2 + this.runoff);
      const x = this.x[i] + c * d, z = this.z[i] - s * d;
      pos.set([x, this.y[i] - 0.1, z, x, this.y[i] + h, z], j * 6);
      uv.set([side * i * DS / 8, 0, side * i * DS / 8, 1], j * 4);
    }
    const idx = [];
    for (let j = 0; j < cnt - 1; j++) { const a = j * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }

  buildTerrain(group, quality) {
    const L = this.L;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < this.n; i += 4) { minX = Math.min(minX, this.x[i]); maxX = Math.max(maxX, this.x[i]); minZ = Math.min(minZ, this.z[i]); maxZ = Math.max(maxZ, this.z[i]); }
    const M = L.city ? 700 : 1300, cell = quality >= 2 ? 44 : 32;
    minX -= M; maxX += M; minZ -= M; maxZ += M;
    const nx = Math.ceil((maxX - minX) / cell) + 1, nz = Math.ceil((maxZ - minZ) / cell) + 1;
    const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2);
    const ca = new THREE.Color(L.ground.a), cb = new THREE.Color(L.ground.b), cn = new THREE.Color(L.ground.near), cf = new THREE.Color(L.ground.far);
    const beach = new THREE.Color('#d8c690'), rock = new THREE.Color(L.theme === 'alps' ? '#8a8f98' : L.theme === 'outback' ? '#8a4a2a' : '#6f6a5c');
    const tmp = new THREE.Color();
    // coarse nearest via every 6th sample, refined locally
    const xs = [], zs = [], is = [];
    for (let i = 0; i < this.n; i += 6) { xs.push(this.x[i]); zs.push(this.z[i]); is.push(i); }
    for (let jz = 0; jz < nz; jz++) for (let jx = 0; jx < nx; jx++) {
      const px = minX + jx * cell, pz = minZ + jz * cell;
      let g = this.nearest(px, pz, 2);
      if (g.dist > 150) {
        let b = Infinity, bi = 0;
        for (let q = 0; q < xs.length; q++) { const dx = px - xs[q], dz = pz - zs[q], dd = dx * dx + dz * dz; if (dd < b) { b = dd; bi = is[q]; } }
        const lo = Math.max(0, bi - 6), hi = Math.min(this.n - 1, bi + 6);
        for (let i = lo; i <= hi; i++) { const dx = px - this.x[i], dz = pz - this.z[i], dd = dx * dx + dz * dz; if (dd <= b) { b = dd; bi = i; } }
        g = { i: bi, dist: Math.sqrt(b), d: (px - this.x[bi]) * Math.cos(this.th[bi]) - (pz - this.z[bi]) * Math.sin(this.th[bi]) };
      }
      const h = this.groundY(px, pz, g);
      const v = jz * nx + jx;
      pos[v * 3] = px; pos[v * 3 + 1] = h; pos[v * 3 + 2] = pz;
      uv[v * 2] = px / 24; uv[v * 2 + 1] = pz / 24;
      const nz2 = fbm(px / 90, pz / 90, 11);
      tmp.copy(ca).lerp(cb, nz2);
      const ex = g.dist - (this.w[g.i] / 2 + this.runoff);
      if (ex < 30) tmp.lerp(cn, 1 - Math.max(0, ex) / 30);
      tmp.lerp(cf, smooth01(250, 1100, ex) * 0.85);
      if (L.sea && h < this.seaY + 3.5 && h > this.seaY - 3) tmp.lerp(beach, 0.85);
      if (L.theme === 'alps' && h - this.y[g.i] > 60 && nz2 > 0.55) tmp.lerp(rock, 0.5);
      if (L.theme === 'outback' && nz2 > 0.7) tmp.lerp(rock, 0.4);
      col[v * 3] = tmp.r; col[v * 3 + 1] = tmp.g; col[v * 3 + 2] = tmp.b;
    }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
    let p = 0;
    for (let jz = 0; jz < nz - 1; jz++) for (let jx = 0; jx < nx - 1; jx++) {
      const a = jz * nx + jx, b = a + 1, c = a + nx, d = c + 1;
      idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeVertexNormals(); geo.computeBoundingSphere();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: TX.detail() });
    const mesh = new THREE.Mesh(geo, mat); mesh.matrixAutoUpdate = false;
    group.add(mesh); this.terrain = mesh;
  }

  /* Only draw chunks near the camera (by distance, so switchbacks above
   * and below stay visible). */
  cull(cx, cz, dist) {
    const r = dist + 110;
    for (const ch of this.chunks) { const dx = ch.userData.cx - cx, dz = ch.userData.cz - cz; ch.visible = dx * dx + dz * dz < r * r; }
  }
}

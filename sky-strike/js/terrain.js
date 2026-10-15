/* Procedural terrain: an analytic height function per mission (noise + carved
 * rivers/canyons + flattened roads and base pads), baked into a grid of
 * chunk meshes with seamless normals and vertex colours, an outer backdrop
 * ring, water, and instanced trees/rocks split into culling regions. */
import * as THREE from 'three';
import { clamp, lerp, smooth, rng, makeNoise, fbm, ridged, smoothPath, Builder, mat4 } from './util.js';

/* polylines with a uniform grid so nearest-segment queries stay cheap */
class LineSet {
  constructor(lines, half, cell = 100) {
    this.half = half; this.cell = cell; this.n = Math.ceil(half * 2 / cell);
    this.grid = new Array(this.n * this.n); this.segs = [];
    for (const L of lines) {
      const p = L.pts;
      for (let i = 0; i < p.length - 1; i++) {
        const s = { ax: p[i][0], az: p[i][1], bx: p[i + 1][0], bz: p[i + 1][1], ha: L.hs ? L.hs[i] : 0, hb: L.hs ? L.hs[i + 1] : 0, L };
        s.dx = s.bx - s.ax; s.dz = s.bz - s.az; s.l2 = s.dx * s.dx + s.dz * s.dz || 1;
        this.segs.push(s);
        const r = L.reach, x0 = Math.min(s.ax, s.bx) - r, x1 = Math.max(s.ax, s.bx) + r, z0 = Math.min(s.az, s.bz) - r, z1 = Math.max(s.az, s.bz) + r;
        for (let gx = this.ci(x0); gx <= this.ci(x1); gx++) for (let gz = this.ci(z0); gz <= this.ci(z1); gz++) {
          const k = gz * this.n + gx; (this.grid[k] || (this.grid[k] = [])).push(s);
        }
      }
    }
    this.out = { d: Infinity, h: 0, L: null };
  }
  ci(v) { return clamp(Math.floor((v + this.half) / this.cell), 0, this.n - 1); }
  query(x, z) {
    const o = this.out; o.d = Infinity; o.L = null;
    const list = this.grid[this.ci(z) * this.n + this.ci(x)];
    if (!list) return o;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      let t = ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = s.ax + s.dx * t - x, pz = s.az + s.dz * t - z, d = Math.sqrt(px * px + pz * pz) - s.L.w * 0.5;
      if (d < o.d) { o.d = d; o.h = s.ha + (s.hb - s.ha) * t; o.L = s.L; }
    }
    return o;
  }
}

export class Terrain {
  constructor(spec, tier) {
    this.spec = spec; this.tier = tier;
    this.size = spec.size || 8000; this.half = this.size / 2;
    const s = spec.seed || 1;
    this.N = { a: makeNoise(s), b: makeNoise(s + 101), c: makeNoise(s + 202), fbm, ridged, smooth, clamp, lerp };
    this.waterLevel = spec.water ? spec.water.level : -1e9;
    const shape = spec.shape, N = this.N;
    this.raw = (x, z) => shape(x, z, N);
    if (spec.prepare) spec.prepare(this.raw, this.N, spec);
    // pads first (roads use their heights)
    this.pads = (spec.pads || []).map(p => ({ ...p, h: p.h ?? (this.raw(p.x, p.z) + (p.dh || 0)), r1: p.r * 1.7 + 40 }));
    if (this.pads.length) { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (const p of this.pads) { a = Math.min(a, p.x - p.r1); b = Math.max(b, p.x + p.r1); c = Math.min(c, p.z - p.r1); d = Math.max(d, p.z + p.r1); } this.padBox = [a, b, c, d]; }
    this.padH = (x, z, h) => {
      const B = this.padBox; if (!B || x < B[0] || x > B[1] || z < B[2] || z > B[3]) return h;
      for (const p of this.pads) {
        const dx = x - p.x, dz = z - p.z, r1 = p.r1;
        if (dx > r1 || dx < -r1 || dz > r1 || dz < -r1) continue;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < r1) h = lerp(p.h, h, smooth(p.r, r1, d));
      }
      return h;
    };
    // roads: smoothed centrelines with heights averaged along the way
    const roads = (spec.roads || []).map(r => {
      const pts = smoothPath(r.pts, r.smoothN || 5);
      let hs = pts.map(([x, z]) => Math.max(this.padH(x, z, this.raw(x, z)), this.waterLevel + 3));
      for (let k = 0; k < 4; k++) hs = hs.map((h, i) => (hs[Math.max(0, i - 2)] + hs[Math.max(0, i - 1)] + h + hs[Math.min(hs.length - 1, i + 1)] + hs[Math.min(hs.length - 1, i + 2)]) / 5);
      if (r.bridges) for (const [i0, i1] of r.bridges) { /* keep deck level across a gap */ }
      return { ...r, pts, hs, reach: r.w * 0.5 + (r.blend || 26) + 4, blend: r.blend || 26, kind: r.kind || 'asphalt' };
    });
    this.roads = roads;
    this.rivers = (spec.rivers || []).map(r => { const pts = smoothPath(r.pts, r.smoothN || 6); return { ...r, pts, reach: r.w * 1.1 + 20 }; });
    this.roadSet = roads.length ? new LineSet(roads, this.half + 3000) : null;
    this.riverSet = this.rivers.length ? new LineSet(this.rivers, this.half + 3000) : null;
  }

  /* analytic height used by everything (physics, placement, mesh) */
  height(x, z) {
    let h = this.raw(x, z);
    if (this.riverSet) {
      const q = this.riverSet.query(x, z);
      if (q.L) { const w = q.L.w, bed = this.waterLevel - q.L.depth; const k = smooth(-w * 0.15, w * 0.6 + 20, q.d); h = lerp(Math.min(bed, h), h, k); }
    }
    if (this.roadSet) {
      const q = this.roadSet.query(x, z);
      if (q.L && q.d < q.L.blend) { const k = smooth(0, q.L.blend, q.d); const inRiver = this.riverSet && this.riverSet.query(x, z).d < 6; if (!inRiver || q.L.overWater) h = lerp(q.h, h, k); }
    }
    if (this.pads.length) h = this.padH(x, z, h);
    return h;
  }
  /* surface used for collisions (water counts as ground) */
  ground(x, z) { return Math.max(this.height(x, z), this.waterLevel); }
  slope(x, z, e = 6) {
    const hx = this.height(x + e, z) - this.height(x - e, z), hz = this.height(x, z + e) - this.height(x, z - e);
    return Math.hypot(hx, hz) / (2 * e);
  }
  /* line of sight between two points (terrain only) */
  los(ax, ay, az, bx, by, bz, step = 45, skip = 0) {
    const d = Math.hypot(bx - ax, by - ay, bz - az), n = Math.ceil(d / step);
    for (let i = Math.max(1, Math.ceil(skip / step)); i < n; i++) { const t = i / n; if (this.height(ax + (bx - ax) * t, az + (bz - az) * t) > ay + (by - ay) * t + 2) return false; }
    return true;
  }

  colorAt(x, z, h, ny, out) {
    const P = this.spec.colors, N = this.N, C = this._C || (this._C = {});
    const col = k => C[k] || (C[k] = new THREE.Color(P[k] || '#ff00ff'));
    const v = N.c(x * 0.0021, z * 0.0021) * 0.5 + 0.5, v2 = N.b(x * 0.011, z * 0.011) * 0.5 + 0.5;
    out.copy(col('low')).lerp(col('mid'), smooth(0.3, 0.75, v));
    if (P.high) out.lerp(col('high'), smooth(P.highAt[0], P.highAt[1], h + (v2 - 0.5) * 60));
    out.multiplyScalar(0.88 + v2 * 0.22);
    const slope = 1 - ny;
    if (P.rock) out.lerp(col('rock'), smooth(P.rockSlope || 0.25, (P.rockSlope || 0.25) + 0.12, slope));
    if (P.strata) { const b = Math.sin(h * 0.09 + v * 3) * 0.5 + 0.5; out.lerp(col('strata'), b * 0.35 * smooth(0.12, 0.3, slope)); }
    if (this.spec.water) {
      const wl = this.waterLevel;
      if (P.sand) out.lerp(col('sand'), 1 - smooth(wl + 2, wl + 9 + v2 * 6, h));
      if (h < wl) out.lerp(col('bed'), smooth(wl, wl - 8, h));
    }
    if (P.snow) out.lerp(col('snow'), smooth(P.snowLine, P.snowLine + 120, h + (v2 - 0.5) * 140) * (1 - smooth(P.snowSlope || 0.45, (P.snowSlope || 0.45) + 0.22, slope) * 0.85));
    if (this.roadSet) {
      const q = this.roadSet.query(x, z);
      if (q.L) { const k = 1 - smooth(-1.5, 2.5, q.d); if (k > 0) out.lerp(col(q.L.kind === 'dirt' ? 'dirt' : 'road'), k * (q.L.kind === 'dirt' ? 0.75 : 0.95)); const sh = 1 - smooth(1.5, 9, q.d); if (sh > 0 && q.L.kind !== 'dirt') out.lerp(col('dirt'), sh * 0.25); }
    }
    for (const p of this.pads) {
      if (!p.kind || p.kind === 'none' || Math.abs(x - p.x) > p.r * 1.3 + 20 || Math.abs(z - p.z) > p.r * 1.3 + 20) continue;
      const d = Math.hypot(x - p.x, z - p.z);
      const k = 1 - smooth(p.r * 0.85, p.r * 1.15 + 6, d + (v2 - 0.5) * 18);
      if (k > 0) out.lerp(col(p.kind === 'concrete' ? 'concrete' : 'dirt'), k * (p.kind === 'concrete' ? 0.85 : 0.6));
    }
    return out;
  }

  build(scene, opt = {}) {
    const T = this.tier, half = this.half, CH = 500, nc = Math.round(this.size / CH), segs = T.segs, G = nc * segs + 1, cell = CH / segs;
    this.group = new THREE.Group(); scene.add(this.group);
    // height + colour grid for the whole map
    const H = new Float32Array(G * G);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) H[j * G + i] = this.height(-half + i * cell, -half + j * cell);
    const at = (i, j) => H[clamp(j, 0, G - 1) * G + clamp(i, 0, G - 1)];
    const detail = detailTexture(this.spec.seed || 1);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.96, metalness: 0 });
    mat.onBeforeCompile = sh => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
        vec4 dA = texture2D( map, vMapUv ); vec4 dB = texture2D( map, vMapUv * 0.137 + 0.31 );
        diffuseColor.rgb *= mix(dA.rgb, dB.rgb, 0.5) * 1.12;`);
    };
    this.material = mat;
    // shared index buffer
    const idx = [];
    for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) { const a = j * (segs + 1) + i, b = a + 1, c = a + segs + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const index = new THREE.BufferAttribute(new Uint32Array(idx), 1);
    const col = new THREE.Color();
    this.chunks = [];
    for (let cj = 0; cj < nc; cj++) for (let ci = 0; ci < nc; ci++) {
      const V = (segs + 1) * (segs + 1), pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), clr = new Float32Array(V * 3), uv = new Float32Array(V * 2);
      let k = 0;
      for (let j = 0; j <= segs; j++) for (let i = 0; i <= segs; i++, k++) {
        const gi = ci * segs + i, gj = cj * segs + j, x = -half + gi * cell, z = -half + gj * cell, h = at(gi, gj);
        let nx = at(gi - 1, gj) - at(gi + 1, gj), nz = at(gi, gj - 1) - at(gi, gj + 1), ny = 2 * cell;
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
        nor[k * 3] = nx; nor[k * 3 + 1] = ny; nor[k * 3 + 2] = nz;
        this.colorAt(x, z, h, ny, col);
        clr[k * 3] = col.r; clr[k * 3 + 1] = col.g; clr[k * 3 + 2] = col.b;
        uv[k * 2] = x / 38; uv[k * 2 + 1] = z / 38;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.BufferAttribute(clr, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(index); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.matrixAutoUpdate = false;
      this.group.add(m); this.chunks.push(m);
    }
    this.buildOuter(mat);
    if (this.spec.water) this.buildWater(opt.envMap);
    this.buildTrees(opt);
    this.buildMinimap();
  }

  buildOuter(mat) {
    const half = this.half, step = 250, R = half + 8000, n = Math.round(R * 2 / step), V = (n + 1) * (n + 1);
    const pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), clr = new Float32Array(V * 3), uv = new Float32Array(V * 2), col = new THREE.Color();
    const fade = this.spec.outer || ((x, z, h) => h);
    let k = 0;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++, k++) {
      const x = -R + i * step, z = -R + j * step, inside = Math.abs(x) < half - 1 && Math.abs(z) < half - 1;
      let h = fade(x, z, this.height(x, z));
      if (inside) h -= 80; else h -= 1.5;
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      this.colorAt(x, z, h, 0.95, col); clr[k * 3] = col.r; clr[k * 3 + 1] = col.g; clr[k * 3 + 2] = col.b;
      uv[k * 2] = x / 38; uv[k * 2 + 1] = z / 38;
    }
    const idx = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(clr, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; this.group.add(m);
  }

  buildWater(envMap) {
    const W = this.spec.water;
    const g = new THREE.PlaneGeometry(this.size + 16000, this.size + 16000, 1, 1); g.rotateX(-Math.PI / 2);
    const nm = waterNormals();
    nm.repeat.set(260, 260);
    const mat = new THREE.MeshStandardMaterial({ color: W.color, roughness: W.rough ?? 0.12, metalness: 0.05, normalMap: nm, normalScale: new THREE.Vector2(0.55, 0.55), envMap, envMapIntensity: 1.1, transparent: true, opacity: W.opacity ?? 0.9 });
    const m = new THREE.Mesh(g, mat); m.position.y = this.waterLevel; m.receiveShadow = true;
    this.group.add(m); this.water = m;
  }

  buildTrees(opt) {
    const T = this.tier, specs = this.spec.trees || [];
    this.treeRegions = [];
    if (!specs.length) return;
    const R = rng((this.spec.seed || 1) * 7 + 3), half = this.half - 60, RG = 4, rsz = this.size / RG;
    const instCol = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    this.treePts = [];
    for (const ts of specs) {
      const geo = treeGeometry(ts.kind);
      const mat = treeMat(ts.kind);
      const count = Math.round(ts.n * T.trees), buckets = Array.from({ length: RG * RG }, () => []);
      let tries = 0, placed = 0;
      while (placed < count && tries < count * 8) {
        tries++;
        const x = R.range(-half, half), z = R.range(-half, half), h = this.height(x, z);
        if (h < (ts.hmin ?? this.waterLevel + 4) || h > (ts.hmax ?? 1e9)) continue;
        if (ts.mask && !ts.mask(x, z, this.N)) continue;
        if (this.slope(x, z) > (ts.slope ?? 0.6)) continue;
        if (this.roadSet && this.roadSet.query(x, z).d < 7) continue;
        if (this.riverSet && this.riverSet.query(x, z).d < 6) continue;
        if (this.pads.some(pd => Math.hypot(x - pd.x, z - pd.z) < pd.r * 1.25 + 14)) continue;
        if (opt.avoid && opt.avoid(x, z)) continue;
        const sc = R.range(ts.smin || 0.8, ts.smax || 1.35);
        const b = clamp(Math.floor((x + this.half) / rsz), 0, RG - 1) + clamp(Math.floor((z + this.half) / rsz), 0, RG - 1) * RG;
        buckets[b].push([x, h - 0.5, z, sc, R() * 6.28, R()]);
        placed++;
        if (ts.kind !== 'rock' && ts.kind !== 'bush' && placed % 3 === 0) this.treePts.push([x, z]);
      }
      buckets.forEach((list, bi) => {
        if (!list.length) return;
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach(([x, y, z, sc, rot, v], i) => {
          e.set((v - 0.5) * 0.08, rot, (v - 0.5) * 0.08); q.setFromEuler(e);
          m4.compose(p.set(x, y, z), q, s.set(sc, sc * (0.85 + v * 0.3), sc)); im.setMatrixAt(i, m4);
          instCol.setRGB(0.82 + v * 0.3, 0.85 + v * 0.22, 0.8 + (1 - v) * 0.25); im.setColorAt(i, instCol);
        });
        im.castShadow = T.name === 'ultra' && ts.kind !== 'rock';
        im.receiveShadow = false;
        im.computeBoundingSphere();
        im.userData.center = new THREE.Vector3(-this.half + (bi % RG + 0.5) * rsz, 0, -this.half + (Math.floor(bi / RG) + 0.5) * rsz);
        this.group.add(im); this.treeRegions.push(im);
      });
    }
  }
  updateVisibility(cam) {
    const far = this.tier.treeDist + this.size / 8 * 1.42;
    for (const im of this.treeRegions) { const c = im.userData.center; im.visible = Math.hypot(cam.x - c.x, cam.z - c.z) < far; }
    if (this.water) { this.water.material.normalMap.offset.x += 0.00004; this.water.material.normalMap.offset.y += 0.00003; }
  }

  buildMinimap() {
    const S = 220, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), img = g.createImageData(S, S), col = new THREE.Color();
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = -this.half + (i + 0.5) / S * this.size, z = -this.half + (j + 0.5) / S * this.size, h = this.height(x, z);
      const hx = this.height(x + 30, z) - h, shade = clamp(0.85 - hx * 0.03, 0.45, 1.25);
      if (h < this.waterLevel) col.set(this.spec.water.color).multiplyScalar(0.9); else { this.colorAt(x, z, h, 0.95, col); col.multiplyScalar(shade); }
      const k = (j * S + i) * 4;
      img.data[k] = clamp(Math.pow(col.r, 1 / 2.2) * 255, 0, 255); img.data[k + 1] = clamp(Math.pow(col.g, 1 / 2.2) * 255, 0, 255); img.data[k + 2] = clamp(Math.pow(col.b, 1 / 2.2) * 255, 0, 255); img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.minimap = c;
  }
  dispose() {
    if (!this.group) return;
    this.group.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
    this.group.parent && this.group.parent.remove(this.group);
  }
}

/* ------------------------------------------------------------ textures */
function detailTexture(seed) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), n = makeNoise(seed + 9), n2 = makeNoise(seed + 19);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    // tileable by sampling noise on a torus-ish wrap (4 corners blended)
    const u = i / S, v = j / S;
    const f = (x, y) => fbm(n, x * 8, y * 8, 4) * 0.6 + n2(x * 40, y * 40) * 0.25;
    const a = f(u, v) * (1 - u) * (1 - v) + f(u - 1, v) * u * (1 - v) + f(u, v - 1) * (1 - u) * v + f(u - 1, v - 1) * u * v;
    const val = clamp(0.86 + a * 0.32, 0.55, 1.1) * 255;
    const k = (j * S + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = clamp(val, 0, 255); img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
  return t;
}
let _waterN = null;
function waterNormals() {
  if (_waterN) return _waterN.clone();
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), n = makeNoise(77);
  const hgt = (i, j) => { let s = 0; for (let o = 0; o < 4; o++) { const f = 4 << o; s += Math.sin((i / S) * 6.283 * f + n(i / S * f, j / S * f) * 2) * Math.cos((j / S) * 6.283 * (f - 1) + n(j / S * f + 5, i / S * f) * 2) / (o + 1); } return s; };
  const Hh = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) Hh[j * S + i] = hgt(i, j);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = Hh[j * S + (i + 1) % S] - Hh[j * S + (i + S - 1) % S], dy = Hh[((j + 1) % S) * S + i] - Hh[((j + S - 1) % S) * S + i];
    const l = Math.hypot(dx, dy, 1.4), k = (j * S + i) * 4;
    img.data[k] = (-dx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[k + 2] = (1.4 / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  _waterN = new THREE.CanvasTexture(c); _waterN.wrapS = _waterN.wrapT = THREE.RepeatWrapping; _waterN.colorSpace = THREE.NoColorSpace;
  return _waterN.clone();
}

/* ------------------------------------------------------------ vegetation */
const _treeGeo = {}, _treeMat = {};
function treeMat(kind) {
  const flat = kind === 'rock' || kind === 'pine' || kind === 'snowpine' || kind === 'cactus';
  const key = flat ? 'flat' : 'smooth';
  return _treeMat[key] || (_treeMat[key] = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: flat }));
}
export function treeGeometry(kind) {
  if (_treeGeo[kind]) return _treeGeo[kind];
  const B = new Builder();
  const trunk = '#5a4030';
  if (kind === 'pine' || kind === 'snowpine') {
    B.add(new THREE.CylinderGeometry(0.35, 0.55, 4, 5), trunk, [0, 2, 0]);
    const tiers = [[3.6, 5.5, 3.2], [2.9, 4.8, 6.2], [2.1, 4.2, 9], [1.3, 3.4, 11.6]];
    tiers.forEach(([r, h, y], i) => {
      B.add(new THREE.ConeGeometry(r, h, 7), kind === 'snowpine' && i > 0 ? '#2f4a3a' : i % 2 ? '#2b5a2c' : '#24502a', [0, y, 0], [0, i * 0.7, 0]);
      if (kind === 'snowpine') B.add(new THREE.ConeGeometry(r * 0.7, h * 0.42, 7), '#e8eef4', [0, y + h * 0.3, 0], [0, i * 0.7, 0]);
    });
  } else if (kind === 'broad') {
    B.add(new THREE.CylinderGeometry(0.4, 0.6, 5, 6), trunk, [0, 2.5, 0]);
    const cols = ['#3d6a2a', '#4a7a30', '#355e26'];
    [[0, 7.2, 0, 3.6], [1.8, 6.2, 0.8, 2.6], [-1.6, 6.4, -0.6, 2.7], [0.3, 8.8, -0.5, 2.4]].forEach(([x, y, z, r], i) => B.add(new THREE.IcosahedronGeometry(r, 1), cols[i % 3], [x, y, z]));
  } else if (kind === 'palm') {
    for (let i = 0; i < 6; i++) B.add(new THREE.CylinderGeometry(0.28, 0.34, 1.6, 6), i % 2 ? '#8a6a48' : '#7a5c3c', [i * 0.12, 0.8 + i * 1.5, 0], [0, 0, -0.06 * i]);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * 6.283, leaf = new THREE.BoxGeometry(0.9, 0.08, 4.4); leaf.translate(0, 0, 2.2);
      B.add(leaf, i % 2 ? '#3f7a30' : '#4f8a34', [0.8, 9.4, 0], [0.35, a, 0]);
    }
  } else if (kind === 'cactus') {
    B.add(new THREE.CylinderGeometry(0.5, 0.55, 6, 7), '#4f7a3a', [0, 3, 0]);
    B.add(new THREE.CylinderGeometry(0.35, 0.35, 2.4, 6), '#4a7236', [1.1, 3.6, 0]); B.add(new THREE.CylinderGeometry(0.3, 0.35, 1.4, 6), '#4a7236', [0.6, 2.6, 0], [0, 0, 1.4]);
    B.add(new THREE.CylinderGeometry(0.33, 0.33, 2, 6), '#4a7236', [-1, 4.2, 0]); B.add(new THREE.CylinderGeometry(0.3, 0.33, 1.2, 6), '#4a7236', [-0.55, 3.4, 0], [0, 0, -1.4]);
  } else if (kind === 'rock') {
    const g = new THREE.DodecahedronGeometry(3.2, 0); const p = g.attributes.position, R = rng(5);
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.8 + R() * 0.5), p.getY(i) * (0.5 + R() * 0.3), p.getZ(i) * (0.8 + R() * 0.5));
    B.add(g, '#8a7a6a', [0, 0.6, 0]);
  } else if (kind === 'bush') {
    [[0, 0.9, 0, 1.4], [1, 0.7, 0.3, 1], [-0.9, 0.7, -0.2, 1.1]].forEach(([x, y, z, r]) => B.add(new THREE.IcosahedronGeometry(r, 0), '#6a7a3a', [x, y, z]));
  } else if (kind === 'dead') {
    B.add(new THREE.CylinderGeometry(0.25, 0.45, 7, 5), '#4a3a30', [0, 3.5, 0]);
    B.add(new THREE.CylinderGeometry(0.12, 0.2, 3, 4), '#4a3a30', [0.9, 5.5, 0], [0, 0, -0.8]); B.add(new THREE.CylinderGeometry(0.1, 0.18, 2.5, 4), '#4a3a30', [-0.8, 4.8, 0.2], [0, 0, 0.9]);
  }
  const geo = B.geometry(); geo.userData.shared = true;
  return (_treeGeo[kind] = geo);
}

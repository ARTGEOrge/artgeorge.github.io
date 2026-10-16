/* Sky dome, particles (sparks, tyre smoke, spray), weather and speed lines. */
import * as THREE from 'three';
import * as TX from './textures.js';

export function makeSky(L, { clouds = true } = {}) {
  const sun = new THREE.Vector3(...L.sky.sun).normalize();
  const cover = !clouds ? 0 : L.weather === 'rain' ? 0.85 : L.weather === 'snow' ? 0.7 : L.cover != null ? L.cover : L.theme === 'desert' ? 0.12 : L.night ? 0.3 : 0.42;
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(L.sky.top) }, hor: { value: new THREE.Color(L.sky.hor) }, bot: { value: new THREE.Color(L.sky.bot) },
      sunDir: { value: sun }, sunCol: { value: new THREE.Color(L.sky.sunCol) }, sunSize: { value: L.sky.sunSize }, stars: { value: L.sky.stars },
      time: { value: 0 }, cover: { value: cover }, night: { value: L.night ? 1 : 0 }, fogCol: { value: new THREE.Color(L.fog.col) }
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 top, hor, bot, sunCol, sunDir, fogCol; uniform float sunSize, stars, time, cover, night; varying vec3 vDir;
      float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 c = h > 0.0 ? mix(hor, top, pow(clamp(h,0.0,1.0), 0.55)) : mix(hor, bot, pow(clamp(-h,0.0,1.0), 0.4));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        // warm glow around the sun bleeding into the haze
        c += sunCol * pow(sd, 6.0) * 0.12 * sunSize;
        if (sunSize > 0.0) c += sunCol * (pow(sd, 900.0 / sunSize) * 2.5 + pow(sd, 12.0) * 0.28 * sunSize);
        if (stars > 0.0 && h > 0.02) { vec3 q = floor(d * 380.0); float s = step(0.9975, h3(q)); c += vec3(s) * stars * smoothstep(0.02, 0.35, h) * (0.5 + 0.5 * h3(q + 1.0)) * (1.0 - cover * 0.8); }
        if (cover > 0.0 && h > 0.0) {
          vec2 uv = d.xz / (h + 0.12) * 0.9 + vec2(time * 0.004, time * 0.0015);
          float f = fbm(uv * 1.6);
          float cl = smoothstep(1.0 - cover - 0.05, 1.0 - cover + 0.35, f) * smoothstep(0.0, 0.16, h);
          float shade = fbm(uv * 1.6 + normalize(sunDir).xz * 0.06);
          vec3 lit = mix(vec3(1.0), sunCol, 0.35) * (night > 0.5 ? 0.22 : 1.0);
          vec3 dark = mix(hor, top, 0.4) * (night > 0.5 ? 0.6 : 0.82);
          vec3 cc = mix(lit, dark, clamp((f - shade) * 4.0 + 0.45, 0.0, 1.0));
          cc += sunCol * pow(sd, 8.0) * 0.4 * (1.0 - night);
          c = mix(c, cc, cl * 0.92);
        }
        // haze band at the horizon blends into the fog colour
        c = mix(c, fogCol, (1.0 - smoothstep(0.0, 0.14, abs(h))) * 0.55);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  return m;
}

/* Generic point-sprite particle pool. */
export class Particles {
  constructor(max, { additive = false, tex = TX.softDot() } = {}) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.age = new Float32Array(max);
    this.size = new Float32Array(max); this.grow = new Float32Array(max); this.alpha = new Float32Array(max);
    this.col = new Float32Array(max * 3); this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aSize', this.aSize); g.setAttribute('aAlpha', this.aAlpha); g.setAttribute('aCol', this.aCol);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: tex }, scale: { value: 600 } },
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aCol; varying float vA; varying vec3 vC; uniform float scale;
        void main(){ vA = aAlpha; vC = aCol; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * scale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying float vA; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); }`
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false;
  }
  spawn(x, y, z, vx, vy, vz, life, size, grow, alpha, r, g, b, drag = 1, grav = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = life; this.age[i] = 0; this.size[i] = size; this.grow[i] = grow; this.alpha[i] = alpha;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b; this.drag[i] = drag; this.grav[i] = grav;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) { this.kill(i); continue; }
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.v[i * 3] *= k; this.v[i * 3 + 1] = this.v[i * 3 + 1] * k - this.grav[i] * dt; this.v[i * 3 + 2] *= k;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      i++;
    }
    const P = this.aPos.array, S = this.aSize.array, A = this.aAlpha.array, C = this.aCol.array;
    for (let j = 0; j < this.n; j++) {
      const t = this.age[j] / this.life[j];
      P[j * 3] = this.p[j * 3]; P[j * 3 + 1] = this.p[j * 3 + 1]; P[j * 3 + 2] = this.p[j * 3 + 2];
      S[j] = this.size[j] * (1 + this.grow[j] * t); A[j] = this.alpha[j] * (1 - t) * Math.min(1, t * 8 + 0.2);
      C[j * 3] = this.col[j * 3]; C[j * 3 + 1] = this.col[j * 3 + 1]; C[j * 3 + 2] = this.col[j * 3 + 2];
    }
    this.points.geometry.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = this.aCol.needsUpdate = true;
  }
  kill(i) {
    const j = --this.n;
    if (i === j) return;
    for (const [a, w] of [[this.p, 3], [this.v, 3], [this.col, 3]]) for (let k = 0; k < w; k++) a[i * w + k] = a[j * w + k];
    for (const a of [this.life, this.age, this.size, this.grow, this.alpha, this.drag, this.grav]) a[i] = a[j];
  }
  clear() { this.n = 0; this.points.geometry.setDrawRange(0, 0); }
}

/* Rain streaks or snowflakes in a box that travels with the camera. */
export class Weather {
  constructor(kind, count) {
    this.kind = kind; this.count = count;
    this.box = new THREE.Vector3(60, 30, 60);
    this.pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { this.pos[i * 3] = (Math.random() - 0.5) * 60; this.pos[i * 3 + 1] = Math.random() * 30; this.pos[i * 3 + 2] = (Math.random() - 0.5) * 60; }
    if (kind === 'rain') {
      const g = new THREE.BufferGeometry();
      this.attr = new THREE.BufferAttribute(new Float32Array(count * 6), 3).setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('position', this.attr);
      this.obj = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#c8d4e0', transparent: true, opacity: 0.45, depthWrite: false }));
    } else {
      const g = new THREE.BufferGeometry();
      this.attr = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('position', this.attr);
      this.obj = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 0.16, map: TX.softDot(), transparent: true, depthWrite: false, opacity: 0.95 }));
    }
    this.obj.frustumCulled = false;
    this.t = 0;
  }
  update(dt, cam, vel) {
    this.t += dt;
    const P = this.pos, A = this.attr.array, bx = 60, by = 30, bz = 60;
    const fall = this.kind === 'rain' ? 26 : 2.6;
    for (let i = 0; i < this.count; i++) {
      P[i * 3 + 1] -= fall * dt;
      if (this.kind === 'snow') { P[i * 3] += Math.sin(this.t * 0.8 + i) * 0.6 * dt; P[i * 3 + 2] += Math.cos(this.t * 0.7 + i * 1.3) * 0.6 * dt; }
      // wrap relative to the camera
      let x = P[i * 3] - cam.x, y = P[i * 3 + 1] - cam.y + 8, z = P[i * 3 + 2] - cam.z;
      x = ((x % bx) + bx * 1.5) % bx - bx / 2; y = ((y % by) + by) % by; z = ((z % bz) + bz * 1.5) % bz - bz / 2;
      P[i * 3] = cam.x + x; P[i * 3 + 1] = cam.y - 8 + y; P[i * 3 + 2] = cam.z + z;
      if (this.kind === 'rain') {
        const k = 0.02;
        A[i * 6] = P[i * 3]; A[i * 6 + 1] = P[i * 3 + 1]; A[i * 6 + 2] = P[i * 3 + 2];
        A[i * 6 + 3] = P[i * 3] + vel.x * k; A[i * 6 + 4] = P[i * 3 + 1] + 0.9; A[i * 6 + 5] = P[i * 3 + 2] + vel.z * k;
      } else { A[i * 3] = P[i * 3]; A[i * 3 + 1] = P[i * 3 + 1]; A[i * 3 + 2] = P[i * 3 + 2]; }
    }
    this.attr.needsUpdate = true;
  }
}

/* Streaks rushing past the camera at high speed. Child of the camera. */
export class SpeedLines {
  constructor(n = 70) {
    this.n = n; this.z = new Float32Array(n); this.a = new Float32Array(n); this.r = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(new Float32Array(n * 6), 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.attr);
    for (let i = 0; i < n; i++) { this.z[i] = -Math.random() * 40; this.a[i] = Math.random() * Math.PI * 2; this.r[i] = 2.2 + Math.random() * 3.5; }
    this.mat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false });
    this.obj = new THREE.LineSegments(g, this.mat); this.obj.frustumCulled = false; this.obj.renderOrder = 10;
  }
  update(dt, speed, boost) {
    const k = Math.max(0, Math.min(1, (speed - 60) / 30)) * 0.16 + boost * 0.1;
    this.mat.opacity = k;
    this.obj.visible = k > 0.01;
    if (!this.obj.visible) return;
    const A = this.attr.array, len = 1 + speed * 0.03;
    for (let i = 0; i < this.n; i++) {
      this.z[i] += speed * 0.9 * dt;
      if (this.z[i] > -1) { this.z[i] = -40 - Math.random() * 10; this.a[i] = Math.random() * Math.PI * 2; this.r[i] = 2.2 + Math.random() * 3.5; }
      const x = Math.cos(this.a[i]) * this.r[i], y = Math.sin(this.a[i]) * this.r[i] * 0.7;
      A[i * 6] = x; A[i * 6 + 1] = y; A[i * 6 + 2] = this.z[i]; A[i * 6 + 3] = x; A[i * 6 + 4] = y; A[i * 6 + 5] = this.z[i] - len;
    }
    this.attr.needsUpdate = true;
  }
}

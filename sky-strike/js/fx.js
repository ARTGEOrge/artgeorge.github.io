/* Effects: billboard particle systems (additive fire/sparks, blended smoke),
 * tumbling debris, shockwave shells, flash lights, tracer streaks, wingtip
 * vapour ribbons, scorch craters and long-lived smoke/fire columns. */
import * as THREE from 'three';
import { rng, puffTexture, clamp, lerp } from './util.js';

const R = rng(1234);
const rand = (a, b) => a + (b - a) * R();

class Particles {
  constructor(scene, max, additive, tex, fog) {
    this.max = max; this.n = 0;
    const A = n => new Float32Array(max * n);
    Object.assign(this, { p: A(3), v: A(3), age: A(1), life: A(1), s0: A(1), s1: A(1), c0: A(4), c1: A(4), drag: A(1), buoy: A(1), rot: A(1), spin: A(1) });
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3); this.iPos.setUsage(THREE.DynamicDrawUsage);
    this.iCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.iCol.setUsage(THREE.DynamicDrawUsage);
    this.iSR = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2); this.iSR.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.iPos); g.setAttribute('iCol', this.iCol); g.setAttribute('iSR', this.iSR);
    g.instanceCount = 0; this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.CustomBlending : THREE.NormalBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation, toneMapped: !additive,
      uniforms: { map: { value: tex }, fogColor: { value: new THREE.Color(fog.color) }, fogDensity: { value: fog.density }, tint: { value: fog.tint || 1 } },
      vertexShader: `attribute vec3 iPos; attribute vec4 iCol; attribute vec2 iSR; uniform float fogDensity; varying vec2 vUv; varying vec4 vCol; varying float vFog;
        void main(){ vec4 mv = modelViewMatrix * vec4(iPos, 1.0); float c = cos(iSR.y), s = sin(iSR.y);
          mv.xy += vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iSR.x;
          gl_Position = projectionMatrix * mv; vUv = uv; vCol = iCol; float d = length(mv.xyz); vFog = 1.0 - exp(-fogDensity * fogDensity * d * d); }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 fogColor; uniform float tint; varying vec2 vUv; varying vec4 vCol; varying float vFog;
        void main(){ float a = texture2D(map, vUv).a * vCol.a; if (a < 0.004) discard;
          ${additive ? 'gl_FragColor = vec4(mix(vCol.rgb, fogColor * 0.6, vFog) * a, a * 0.8);' : 'gl_FragColor = vec4(mix(vCol.rgb * tint, fogColor, vFog), a);'}
          ${additive ? '' : '#include <tonemapping_fragment>\n#include <colorspace_fragment>'}
        }`
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 7 : 6;
    scene.add(this.mesh);
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, drag = 1, buoy = 0, spin = 0) {
    if (this.n >= this.max) return; // budget full
    const i = this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.age[i] = 0; this.life[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.drag[i] = drag; this.buoy[i] = buoy; this.rot[i] = R() * 6.28; this.spin[i] = spin * (R() - 0.5);
    for (let k = 0; k < 4; k++) { this.c0[i * 4 + k] = c0[k]; this.c1[i * 4 + k] = c1[k]; }
  }
  kill(i) {
    const j = --this.n; if (i === j) return;
    for (let k = 0; k < 3; k++) { this.p[i * 3 + k] = this.p[j * 3 + k]; this.v[i * 3 + k] = this.v[j * 3 + k]; }
    for (let k = 0; k < 4; k++) { this.c0[i * 4 + k] = this.c0[j * 4 + k]; this.c1[i * 4 + k] = this.c1[j * 4 + k]; }
    this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.s0[i] = this.s0[j]; this.s1[i] = this.s1[j]; this.drag[i] = this.drag[j]; this.buoy[i] = this.buoy[j]; this.rot[i] = this.rot[j]; this.spin[i] = this.spin[j];
  }
  update(dt, wind) {
    const P = this.iPos.array, C = this.iCol.array, S = this.iSR.array;
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) { this.kill(i); i--; continue; }
      const k = Math.exp(-this.drag[i] * dt);
      this.v[i * 3] = this.v[i * 3] * k + wind.x * dt * 0.3; this.v[i * 3 + 1] = this.v[i * 3 + 1] * k + this.buoy[i] * dt; this.v[i * 3 + 2] = this.v[i * 3 + 2] * k + wind.z * dt * 0.3;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      this.rot[i] += this.spin[i] * dt;
    }
    for (let i = 0; i < this.n; i++) {
      const t = this.age[i] / this.life[i], fadeIn = Math.min(1, t * 8), env = fadeIn * (1 - t) * (1 - t * 0.2);
      P[i * 3] = this.p[i * 3]; P[i * 3 + 1] = this.p[i * 3 + 1]; P[i * 3 + 2] = this.p[i * 3 + 2];
      const tc = Math.min(1, t * 1.6);
      for (let k = 0; k < 3; k++) C[i * 4 + k] = lerp(this.c0[i * 4 + k], this.c1[i * 4 + k], tc);
      C[i * 4 + 3] = lerp(this.c0[i * 4 + 3], this.c1[i * 4 + 3], t) * env;
      S[i * 2] = lerp(this.s0[i], this.s1[i], 1 - (1 - t) * (1 - t)); S[i * 2 + 1] = this.rot[i];
    }
    this.geo.instanceCount = this.n;
    if (this.n) { this.iPos.needsUpdate = this.iCol.needsUpdate = this.iSR.needsUpdate = true; for (const [a, k] of [[this.iPos, 3], [this.iCol, 4], [this.iSR, 2]]) { a.clearUpdateRanges(); a.addUpdateRange(0, this.n * k); } }
  }
  clear() { this.n = 0; this.geo.instanceCount = 0; }
}

/* camera-facing ribbon (wingtip vapour, contrails) */
class Ribbon {
  constructor(scene, n, width, color) {
    this.n = n; this.width = width; this.pts = []; this.head = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3); this.alpha = new Float32Array(n * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { color: { value: new THREE.Color(color) } },
      vertexShader: `attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 color; varying float vA; void main(){ gl_FragColor = vec4(color, vA);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 6; scene.add(this.mesh);
  }
  /* add a point with an intensity 0..1 (0 = gap) */
  push(p, k) { this.pts.unshift({ x: p.x, y: p.y, z: p.z, k, age: 0 }); if (this.pts.length > this.n) this.pts.pop(); }
  update(dt, cam, life = 1.6) {
    const P = this.pos, A = this.alpha, cp = cam.position;
    for (const p of this.pts) p.age += dt;
    while (this.pts.length && this.pts[this.pts.length - 1].age > life) this.pts.pop();
    const m = this.pts.length;
    for (let i = 0; i < this.n; i++) {
      if (i >= m) { for (let k = 0; k < 6; k++) P[i * 6 + k] = m ? P[(m - 1) * 6 + k] : 0; A[i * 2] = A[i * 2 + 1] = 0; continue; }
      const p = this.pts[i], q = this.pts[Math.min(m - 1, i + 1)], o = this.pts[Math.max(0, i - 1)];
      let dx = o.x - q.x, dy = o.y - q.y, dz = o.z - q.z;
      const vx = p.x - cp.x, vy = p.y - cp.y, vz = p.z - cp.z;
      let sx = dy * vz - dz * vy, sy = dz * vx - dx * vz, sz = dx * vy - dy * vx; const l = Math.hypot(sx, sy, sz) || 1;
      const w = this.width * (1 + p.age * 1.5) / l; sx *= w; sy *= w; sz *= w;
      P[i * 6] = p.x - sx; P[i * 6 + 1] = p.y - sy; P[i * 6 + 2] = p.z - sz; P[i * 6 + 3] = p.x + sx; P[i * 6 + 4] = p.y + sy; P[i * 6 + 5] = p.z + sz;
      const cd = Math.sqrt(vx * vx + vy * vy + vz * vz), near = Math.min(1, Math.max(0, (cd - 12) / 50)); const a = p.k * (1 - p.age / life) * (i === 0 ? 0 : 1) * 0.42 * near; A[i * 2] = A[i * 2 + 1] = a;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.alpha.needsUpdate = true;
  }
  clear() { this.pts.length = 0; }
}

export class FX {
  constructor(scene, tier, env, terrain) {
    this.scene = scene; this.tier = tier; this.terrain = terrain; this.env = env;
    const fog = { color: env.fog, density: env.fogDensity, tint: env.night ? 0.28 : 1 };
    const pf = tier.particles;
    this.fire = new Particles(scene, Math.round(2600 * pf), true, puffTexture(96, 4, 'fire'), fog);
    this.smoke = new Particles(scene, Math.round(3600 * pf), false, puffTexture(128, 7), fog);
    this.wind = new THREE.Vector3(...(env.wind || [3, 0, 1.5]));
    // debris
    const dg = new THREE.DodecahedronGeometry(0.6, 0); dg.scale(1, 0.55, 1.2);
    this.debris = new THREE.InstancedMesh(dg, new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.9 }), 260);
    this.debris.count = 0; this.debris.frustumCulled = false; this.debris.castShadow = false; scene.add(this.debris);
    this.deb = [];
    // shock shells + ground rings
    this.shellMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { a: { value: 1 }, col: { value: new THREE.Color(1.6, 1.2, 0.9) } },
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float a; uniform vec3 col; varying vec3 vN; varying vec3 vV; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); f = pow(f, 3.0); gl_FragColor = vec4(col * f * a, f * a); }`
    });
    this.shells = []; this.rings = [];
    const sg = new THREE.SphereGeometry(1, 24, 14), rg = new THREE.RingGeometry(0.9, 1, 64); rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(sg, this.shellMat.clone()); s.visible = false; s.renderOrder = 8; scene.add(s); this.shells.push({ m: s, t: 1, d: 1, r: 1 });
      const r = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: '#ffe6c0', transparent: true, depthWrite: false, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      r.visible = false; r.renderOrder = 8; scene.add(r); this.rings.push({ m: r, t: 1, d: 1, r: 1 });
    }
    // lights
    this.lights = [];
    for (let i = 0; i < tier.lights; i++) { const l = new THREE.PointLight('#ffb070', 0, 300, 1.6); l.position.set(0, -1000, 0); scene.add(l); this.lights.push({ l, t: 1, d: 1, i0: 0, follow: null }); }
    // tracers
    const tg = new THREE.BoxGeometry(1, 1, 1);
    this.tracers = new THREE.InstancedMesh(tg, new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), 900);
    this.tracers.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(900 * 3), 3);
    this.tracers.count = 0; this.tracers.frustumCulled = false; this.tracers.renderOrder = 7; scene.add(this.tracers);
    // vapour ribbons
    this.ribbons = [new Ribbon(scene, 60, 0.3, '#ffffff'), new Ribbon(scene, 60, 0.3, '#ffffff'), new Ribbon(scene, 90, 1.6, '#f4f6fa'), new Ribbon(scene, 90, 1.6, '#f4f6fa')];
    // craters
    this.craterTex = craterTexture();
    this.craters = [];
    this.emitters = [];
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._c = new THREE.Color();
    this.shake = 0;
  }

  /* ---------------------------------------------- big events */
  explode(x, y, z, size = 1, o = {}) {
    const pf = this.tier.particles, nF = Math.round((12 + 16 * size) * pf), nS = Math.round((8 + 10 * size) * pf);
    const water = o.water, air = o.air;
    this.light(x, y + 4 * size, z, size * 30 + 20, 0.5 + size * 0.25, o.color || '#ffa860', size * 70 + 80);
    // white-hot core flash
    this.fire.spawn(x, y + size, z, 0, 0, 0, 0.22, 16 * size, 44 * size, [5, 3.6, 2, 1], [3, 1.2, 0.3, 0], 0);
    for (let i = 0; i < nF; i++) {
      const a = R() * 6.28, e = air ? rand(-1, 1) : rand(0.1, 1), sp = rand(6, 26) * Math.sqrt(size), ce = Math.sqrt(1 - e * e);
      const vx = Math.cos(a) * ce * sp, vy = e * sp * (air ? 1 : 1.2) + (air ? 0 : 5 * size), vz = Math.sin(a) * ce * sp;
      const hotc = o.fuel ? [1.7, 0.55, 0.1, 1] : [1.9, 0.8, 0.22, 1];
      this.fire.spawn(x + vx * 0.08, y + vy * 0.08 + size, z + vz * 0.08, vx, vy, vz, rand(0.8, 1.6) * (0.8 + size * 0.15), rand(4, 8) * size, rand(13, 24) * size, hotc, [0.7, 0.12, 0.03, 0.55], 2.2, 3 + size * 2, 2);
    }
    for (let i = 0; i < Math.round((3 + size * 2) * pf); i++) {
      this.fire.spawn(x + rand(-2, 2) * size, y + size * 2, z + rand(-2, 2) * size, rand(-3, 3), rand(6, 14) * Math.sqrt(size), rand(-3, 3), rand(1.4, 2.2), 7 * size, 20 * size, [1.5, 0.5, 0.08, 1], [0.35, 0.06, 0.02, 0.8], 1.2, 4, 0.6);
    }
    if (water) {
      for (let i = 0; i < nS * 2; i++) { const a = R() * 6.28, sp = rand(2, 8) * size; this.smoke.spawn(x, y + 1, z, Math.cos(a) * sp, rand(18, 40) * Math.sqrt(size), Math.sin(a) * sp, rand(1.4, 2.6), 3 * size, 12 * size, [0.95, 0.97, 1, 0.9], [0.8, 0.85, 0.9, 0], 0.6, -14, 0.5); }
    }
    const smokeC = o.fuel ? [0.05, 0.045, 0.04, 0.85] : [0.13, 0.12, 0.11, 0.8];
    for (let i = 0; i < nS; i++) {
      const a = R() * 6.28, sp = rand(2, 12) * Math.sqrt(size);
      this.smoke.spawn(x + rand(-3, 3) * size, y + rand(1, 5) * size, z + rand(-3, 3) * size, Math.cos(a) * sp, rand(4, 14) * size, Math.sin(a) * sp, rand(3, 6) * (0.8 + size * 0.2), rand(5, 9) * size, rand(20, 34) * size, smokeC, [0.32, 0.3, 0.29, 0], 0.9, 2.5, 0.6);
    }
    // sparks
    for (let i = 0; i < Math.round(14 * size * pf); i++) { const a = R() * 6.28, e = rand(0.2, 1), sp = rand(25, 60); this.fire.spawn(x, y + 1, z, Math.cos(a) * sp * (1 - e * 0.5), e * sp, Math.sin(a) * sp * (1 - e * 0.5), rand(0.4, 1.0), 0.9, 0.3, [4, 2.8, 1.2, 1], [2, 0.6, 0.1, 0], 1.2, -22, 0); }
    // debris
    if (!water) for (let i = 0; i < Math.round(5 + 5 * size); i++) {
      const a = R() * 6.28, sp = rand(8, 26) * Math.sqrt(size);
      this.deb.push({ x, y: y + 2, z, vx: Math.cos(a) * sp, vy: rand(12, 34) * Math.sqrt(size), vz: Math.sin(a) * sp, rx: R() * 6, ry: R() * 6, w: rand(-8, 8), s: rand(0.6, 2.2) * Math.min(2.2, size), life: rand(2.5, 5), burn: R() < 0.45 });
      if (this.deb.length > 250) this.deb.shift();
    }
    this.shell(x, y + size * 2, z, size * (air ? 34 : 26), 0.5 + size * 0.1);
    if (!air && !water) this.ring(x, y + 0.6, z, size * 55, 0.8 + size * 0.15);
    if (!air && !water && size >= 0.9 && !o.noCrater) this.crater(x, z, Math.min(16, 4 + size * 4.5));
    if (o.column) this.column(x, y, z, o.column, size);
  }
  /* long-lived burning wreck smoke */
  column(x, y, z, dur = 40, size = 1, fire = true) {
    this.emitters.push({ x, y, z, t: 0, dur, size, fire, acc: 0, acc2: 0 });
    if (this.emitters.length > 50) this.emitters.shift();
  }
  puff(x, y, z, kind = 'dust', k = 1) {
    if (kind === 'dust') for (let i = 0; i < 2; i++) this.smoke.spawn(x, y + 0.5, z, rand(-2, 2), rand(3, 7), rand(-2, 2), rand(0.8, 1.6), 1.5 * k, 5 * k, [0.55, 0.48, 0.38, 0.7], [0.6, 0.55, 0.48, 0], 1.5, -2);
    else if (kind === 'water') this.smoke.spawn(x, y + 0.5, z, rand(-1, 1), rand(8, 14), rand(-1, 1), rand(0.6, 1.0), 1 * k, 4 * k, [0.9, 0.94, 1, 0.8], [0.9, 0.94, 1, 0], 1, -16);
    else if (kind === 'spark') { this.fire.spawn(x, y, z, rand(-8, 8), rand(2, 12), rand(-8, 8), rand(0.15, 0.35), 1.6 * k, 0.6, [4, 3, 1.5, 1], [2, 0.8, 0.2, 0], 2, -10); this.fire.spawn(x, y, z, 0, 2, 0, 0.12, 4 * k, 6 * k, [3, 2, 1, 1], [1, 0.4, 0.1, 0], 1); }
    else if (kind === 'flak') {
      this.fire.spawn(x, y, z, 0, 0, 0, 0.16, 6, 16, [5, 3.5, 2, 1], [2, 0.7, 0.2, 0], 1);
      for (let i = 0; i < 4; i++) this.smoke.spawn(x + rand(-2, 2), y + rand(-2, 2), z + rand(-2, 2), rand(-3, 3), rand(-1, 2), rand(-3, 3), rand(2.5, 4), 5, 16, [0.07, 0.07, 0.07, 0.85], [0.2, 0.2, 0.2, 0], 1.2, 0.3);
    }
  }
  /* exhaust / rocket trail puff */
  trail(x, y, z, kind, k = 1) {
    if (kind === 'missile') {
      this.fire.spawn(x, y, z, rand(-1, 1), rand(-1, 1), rand(-1, 1), 0.08, 1.6 * k, 0.8, [4, 3, 2, 1], [2, 0.8, 0.2, 0], 1);
      this.smoke.spawn(x, y, z, rand(-1, 1), rand(-0.5, 1.5), rand(-1, 1), rand(1.8, 3.2), 1.2 * k, 6 * k, [0.85, 0.85, 0.85, 0.55], [0.75, 0.75, 0.78, 0], 0.4, 0.6, 0.4);
    } else if (kind === 'burn') {
      this.fire.spawn(x, y, z, rand(-2, 2), rand(-2, 2), rand(-2, 2), rand(0.25, 0.5), 3 * k, 6 * k, [3, 1.6, 0.5, 1], [1.2, 0.2, 0.05, 0], 1.5);
      this.smoke.spawn(x, y, z, rand(-1, 1), rand(0, 2), rand(-1, 1), rand(2.5, 4), 3 * k, 12 * k, [0.1, 0.1, 0.1, 0.8], [0.3, 0.3, 0.3, 0], 0.6, 1);
    } else if (kind === 'flare') {
      this.fire.spawn(x, y, z, 0, 0, 0, 0.12, 5, 3, [6, 5, 3.5, 1], [3, 1.5, 0.6, 0], 1);
      this.smoke.spawn(x, y, z, rand(-0.5, 0.5), 0.5, rand(-0.5, 0.5), rand(1.5, 2.5), 1.2, 5, [0.85, 0.85, 0.85, 0.45], [0.7, 0.7, 0.72, 0], 0.5, 0.4);
    }
  }
  shell(x, y, z, r, d) { const s = this.shells.find(s => s.t >= 1) || this.shells[0]; s.t = 0; s.d = d; s.r = r; s.m.position.set(x, y, z); s.m.visible = true; }
  ring(x, y, z, r, d) { const s = this.rings.find(s => s.t >= 1) || this.rings[0]; s.t = 0; s.d = d; s.r = r; s.m.position.set(x, y, z); s.m.visible = true; }
  light(x, y, z, intensity, dur, color = '#ffa860', range = 200, follow = null) {
    if (!this.lights.length) return null;
    let L = this.lights.find(l => l.t >= 1); if (!L) L = this.lights.reduce((a, b) => a.i0 * (1 - a.t) < b.i0 * (1 - b.t) ? a : b);
    L.t = 0; L.d = dur; L.i0 = intensity * (this.env.night ? 40 : 6); L.l.color.set(color); L.l.distance = range * (this.env.night ? 1.6 : 1); L.l.position.set(x, y, z); L.follow = follow;
    return L;
  }
  crater(x, z, r) {
    const T = this.terrain, n = 8, g = new THREE.PlaneGeometry(r * 2, r * 2, n, n); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const vx = p.getX(i) + x, vz = p.getZ(i) + z; p.setY(i, T.height(vx, vz) + 0.25); p.setX(i, vx); p.setZ(i, vz); }
    if (T.height(x, z) < T.waterLevel) { g.dispose(); return; }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: this.craterTex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.rotation.y = 0; m.receiveShadow = true; m.renderOrder = 1;
    this.scene.add(m); this.craters.push(m);
    if (this.craters.length > this.tier.decals) { const o = this.craters.shift(); this.scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
  }

  /* ---------------------------------------------- per frame */
  update(dt, cam) {
    const pf = this.tier.particles;
    this.fire.update(dt, this.wind); this.smoke.update(dt, this.wind);
    // debris
    const T = this.terrain, m = this._m, q = this._q, v = this._v, s = this._s;
    for (let i = this.deb.length - 1; i >= 0; i--) {
      const d = this.deb[i]; d.life -= dt;
      if (d.life <= 0) { this.deb.splice(i, 1); continue; }
      d.vy -= 9.8 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.rx += d.w * dt; d.ry += d.w * 0.7 * dt;
      const gh = T.ground(d.x, d.z);
      if (d.y < gh + 0.3) { d.y = gh + 0.3; d.vy = Math.abs(d.vy) * 0.3; d.vx *= 0.5; d.vz *= 0.5; d.w *= 0.5; if (Math.abs(d.vy) < 1) d.burn = false; }
      if (d.burn && R() < 0.6 * pf) this.trail(d.x, d.y, d.z, 'burn', 0.4);
      else if (R() < 0.25 * pf && d.vy > -30) this.smoke.spawn(d.x, d.y, d.z, 0, 1, 0, 1.2, 0.8, 3, [0.15, 0.14, 0.13, 0.6], [0.3, 0.3, 0.3, 0], 1);
    }
    this.debris.count = this.deb.length;
    this.deb.forEach((d, i) => { q.setFromEuler(new THREE.Euler(d.rx, d.ry, 0)); m.compose(v.set(d.x, d.y, d.z), q, s.setScalar(d.s)); this.debris.setMatrixAt(i, m); });
    this.debris.instanceMatrix.needsUpdate = true;
    // shells and rings
    for (const S of this.shells) if (S.t < 1) { S.t = Math.min(1, S.t + dt / S.d); const e = 1 - Math.pow(1 - S.t, 3); S.m.scale.setScalar(2 + S.r * e); S.m.material.uniforms.a.value = (1 - S.t) * 0.9; if (S.t >= 1) S.m.visible = false; }
    for (const S of this.rings) if (S.t < 1) { S.t = Math.min(1, S.t + dt / S.d); const e = 1 - Math.pow(1 - S.t, 2.4); S.m.scale.setScalar(1 + S.r * e); S.m.material.opacity = (1 - S.t) * (1 - S.t) * 0.4; if (S.t >= 1) S.m.visible = false; }
    for (const L of this.lights) {
      if (L.t >= 1) { L.l.intensity = 0; continue; }
      L.t = Math.min(1, L.t + dt / L.d); L.l.intensity = L.i0 * (1 - L.t) * (1 - L.t);
      if (L.follow) L.l.position.copy(L.follow);
    }
    // smoke columns
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const E = this.emitters[i]; E.t += dt;
      if (E.t > E.dur) { this.emitters.splice(i, 1); continue; }
      const fade = 1 - E.t / E.dur, dist = Math.hypot(cam.position.x - E.x, cam.position.z - E.z), lod = dist > 3500 ? 0.3 : dist > 1800 ? 0.6 : 1;
      E.acc += dt * 7 * pf * lod * (0.4 + 0.6 * fade);
      while (E.acc > 1) {
        E.acc--;
        const sz = E.size;
        this.smoke.spawn(E.x + rand(-2, 2) * sz, E.y + 2 * sz, E.z + rand(-2, 2) * sz, rand(-1, 1), rand(5, 9) * Math.sqrt(sz), rand(-1, 1), rand(6, 10), 4 * sz, rand(24, 40) * sz, [0.07, 0.065, 0.06, 0.75], [0.3, 0.29, 0.28, 0], 0.15, 0.8, 0.25);
      }
      if (E.fire && fade > 0.25) {
        E.acc2 += dt * 14 * pf * lod;
        while (E.acc2 > 1) { E.acc2--; const sz = E.size; this.fire.spawn(E.x + rand(-2.5, 2.5) * sz, E.y + rand(0, 2) * sz, E.z + rand(-2.5, 2.5) * sz, rand(-1, 1), rand(4, 9) * Math.sqrt(sz), rand(-1, 1), rand(0.4, 0.9), 2.5 * sz, 5 * sz, [2.6, 1.3, 0.4, 1], [1.2, 0.25, 0.05, 0], 1.2, 2); }
      }
    }
    for (const r of this.ribbons) r.update(dt, cam, r.width > 1 ? 4 : 1.4);
  }
  /* list of {x,y,z,dx,dy,dz,len,c:[r,g,b]} */
  drawTracers(list) {
    const m = this._m, q = this._q, v = this._v, s = this._s, f = new THREE.Vector3(0, 0, 1), col = this._c;
    const n = Math.min(list.length, 900);
    for (let i = 0; i < n; i++) {
      const t = list[i]; v.set(t.dx, t.dy, t.dz).normalize(); q.setFromUnitVectors(f, v);
      m.compose(this._v.set(t.x - t.dx * 0.5, t.y - t.dy * 0.5, t.z - t.dz * 0.5), q, s.set(t.w || 0.22, t.w || 0.22, t.len));
      this.tracers.setMatrixAt(i, m); col.setRGB(t.c[0], t.c[1], t.c[2]); this.tracers.setColorAt(i, col);
    }
    this.tracers.count = n; this.tracers.instanceMatrix.needsUpdate = true; if (n) this.tracers.instanceColor.needsUpdate = true;
  }
  clear() {
    this.fire.clear(); this.smoke.clear(); this.deb.length = 0; this.emitters.length = 0; this.ribbons.forEach(r => r.clear());
  }
  dispose() {
    const objs = [this.fire.mesh, this.smoke.mesh, this.debris, this.tracers, ...this.shells.map(s => s.m), ...this.rings.map(s => s.m), ...this.craters, ...this.ribbons.map(r => r.mesh)];
    for (const o of objs) { this.scene.remove(o); o.material.dispose(); }
    for (const L of this.lights) this.scene.remove(L.l);
  }
}

function craterTexture() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), R2 = rng(8);
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(12,10,8,.95)'); gr.addColorStop(0.45, 'rgba(25,20,16,.85)'); gr.addColorStop(0.7, 'rgba(40,32,24,.45)'); gr.addColorStop(1, 'rgba(40,32,24,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) { const a = R2() * 6.28, r = S * (0.25 + R2() * 0.25); g.fillStyle = `rgba(20,16,12,${0.2 + R2() * 0.3})`; g.beginPath(); g.arc(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, 2 + R2() * 5, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

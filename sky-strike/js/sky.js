/* Sky dome (gradient + sun glow, stars at night) and billboard cloud banks
 * you can fly straight through. */
import * as THREE from 'three';
import { rng, puffTexture, clamp } from './util.js';

export function skyMaterial(env) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(env.top) }, horizon: { value: new THREE.Color(env.horizon) }, ground: { value: new THREE.Color(env.ground || env.horizon) },
      sunDir: { value: new THREE.Vector3(...env.sunDir).normalize() }, sunCol: { value: new THREE.Color(env.sunGlow || '#fff3d6') }, sunSize: { value: env.night ? 0.9994 : 0.99965 }, glow: { value: env.glow ?? 0.6 }
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 top, horizon, ground, sunDir, sunCol; uniform float sunSize, glow; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.45)) : mix(horizon, ground, clamp(-h * 6.0, 0.0, 1.0));
        float s = max(dot(d, sunDir), 0.0);
        c += sunCol * (pow(s, 8.0) * 0.35 * glow + pow(s, 64.0) * 0.5 * glow);
        c += sunCol * smoothstep(sunSize, sunSize + 0.00012, s) * 6.0;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
}

export class Sky {
  constructor(scene, env, tier) {
    this.env = env; this.scene = scene;
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(13000, 32, 16), skyMaterial(env));
    this.dome.renderOrder = -10; this.dome.frustumCulled = false;
    scene.add(this.dome);
    if (env.night) this.addStars();
    this.buildClouds(env.clouds || {}, tier);
  }
  addStars() {
    const R = rng(11), n = 1800, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = R() * 2 - 1, a = R() * 6.283, y = Math.abs(u) * 0.95 + 0.05, r = Math.sqrt(1 - y * y); p[i * 3] = Math.cos(a) * r * 12000; p[i * 3 + 1] = y * 12000; p[i * 3 + 2] = Math.sin(a) * r * 12000; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#dfe8ff', size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
    this.stars.frustumCulled = false; this.stars.renderOrder = -9;
    this.scene.add(this.stars);
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(64, 1, 'soft'), color: '#d8e4ff', fog: false, depthWrite: false }));
    const md = new THREE.Vector3(...(this.env.moonDir || [-0.4, 0.5, -0.6])).normalize().multiplyScalar(11000);
    moon.position.copy(md); moon.scale.setScalar(520); moon.renderOrder = -8; this.moon = moon; this.scene.add(moon);
  }
  buildClouds(C, tier) {
    const R = rng(C.seed || 5), clusters = Math.round((C.count ?? 34) * tier.clouds), per = C.puffs || 14;
    this.clusters = [];
    const total = clusters * per;
    if (!total) return;
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
    const ip = new Float32Array(total * 3), id = new Float32Array(total * 4);
    let k = 0;
    const span = C.span || 7000, alt = C.alt || [700, 1100];
    for (let c = 0; c < clusters; c++) {
      const cx = R.range(-span, span), cz = R.range(-span, span), cy = R.range(alt[0], alt[1]), sx = R.range(180, 420) * (C.scale || 1), sy = R.range(50, 110) * (C.scale || 1), sz = R.range(180, 420) * (C.scale || 1);
      this.clusters.push({ x: cx, y: cy, z: cz, sx, sy, sz });
      for (let i = 0; i < per; i++, k++) {
        const a = R() * 6.283, r = Math.sqrt(R()), py = (R() * 2 - 1);
        const ox = Math.cos(a) * r * sx, oz = Math.sin(a) * r * sz, oy = py * sy * (1 - r * 0.5);
        ip[k * 3] = cx + ox; ip[k * 3 + 1] = cy + oy; ip[k * 3 + 2] = cz + oz;
        id[k * 4] = R.range(150, 300) * (C.scale || 1); id[k * 4 + 1] = R() * 6.283; id[k * 4 + 2] = clamp(0.45 + py * 0.45 + R() * 0.15, 0, 1); id[k * 4 + 3] = R.range(0.5, 0.85) * (C.opacity || 1);
      }
    }
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(ip, 3)); g.setAttribute('iData', new THREE.InstancedBufferAttribute(id, 4));
    g.instanceCount = total;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { map: { value: puffTexture(128, 9) }, lit: { value: new THREE.Color(C.lit || '#ffffff') }, shade: { value: new THREE.Color(C.shade || '#9aa6b8') }, fogColor: { value: new THREE.Color(this.env.fog) }, fogDensity: { value: this.env.fogDensity * 0.7 } },
      vertexShader: `attribute vec3 iPos; attribute vec4 iData; uniform float fogDensity; varying vec2 vUv; varying float vShade, vFog, vAlpha;
        void main(){ vec4 mv = modelViewMatrix * vec4(iPos, 1.0); float c = cos(iData.y), s = sin(iData.y);
          mv.xy += vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iData.x;
          gl_Position = projectionMatrix * mv; vUv = uv; vShade = iData.z; float d = length(mv.xyz);
          vFog = 1.0 - exp(-fogDensity * fogDensity * d * d); vAlpha = iData.w * smoothstep(30.0, 220.0, d); }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 lit, shade, fogColor; varying vec2 vUv; varying float vShade, vFog, vAlpha;
        void main(){ float a = texture2D(map, vUv).a * vAlpha; if (a < 0.01) discard; vec3 c = mix(shade, lit, vShade); c = mix(c, fogColor, vFog);
          gl_FragColor = vec4(c, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    this.cloudMesh = new THREE.Mesh(g, mat); this.cloudMesh.frustumCulled = false; this.cloudMesh.renderOrder = 5;
    this.scene.add(this.cloudMesh);
  }
  /* 0..1 how deep inside a cloud a point is */
  inCloud(p) {
    let best = 0;
    for (const c of this.clusters) {
      const dx = (p.x - c.x) / (c.sx * 1.05), dy = (p.y - c.y) / (c.sy * 1.3), dz = (p.z - c.z) / (c.sz * 1.05), d = dx * dx + dy * dy + dz * dz;
      if (d < 1) best = Math.max(best, 1 - d);
    }
    return best;
  }
  update(cam) {
    this.dome.position.copy(cam.position);
    if (this.stars) this.stars.position.copy(cam.position);
    if (this.moon) this.moon.position.copy(cam.position).add(new THREE.Vector3(...(this.env.moonDir || [-0.4, 0.5, -0.6])).normalize().multiplyScalar(11000));
  }
  dispose() {
    for (const o of [this.dome, this.stars, this.moon, this.cloudMesh]) if (o) { this.scene.remove(o); o.geometry && o.geometry.dispose(); o.material.dispose(); }
  }
}

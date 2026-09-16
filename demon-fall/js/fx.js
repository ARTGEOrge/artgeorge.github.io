/* Demon Fall — particles, decals, tracers and gibs.
 *
 * Everything lives in fixed-size pools that are allocated once at level start:
 * mid-fight is the worst possible moment for the garbage collector to run. */
import * as THREE from 'three';
import { puffTexture, splatTexture } from './textures.js';
import { clamp, randRange, TAU } from './util.js';

const MAX_SOFT = 900;    // blood, smoke, dust — normal blending
const MAX_GLOW = 900;    // sparks, embers, fire — additive
const MAX_DECALS = 90;
const MAX_GIBS = 60;
const MAX_TRACERS = 24;

function makePoints(max, texture, blending, sizeScale) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
  geo.setAttribute('psize', new THREE.BufferAttribute(new Float32Array(max), 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(max), 1));
  geo.setDrawRange(0, 0);

  // A small custom shader keeps per-particle size and fade on the GPU.
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: texture }, scale: { value: sizeScale } },
    vertexShader: `
      attribute float psize;
      attribute float alpha;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float scale;
      void main() {
        vColor = color; vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = psize * scale / max(0.001, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 t = texture2D(map, gl_PointCoord);
        gl_FragColor = vec4(vColor, t.a * vAlpha);
        if (gl_FragColor.a < 0.01) discard;
      }`,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

class ParticleSet {
  constructor(max, texture, blending, sizeScale) {
    this.max = max;
    this.points = makePoints(max, texture, blending, sizeScale);
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.max_life = new Float32Array(max);
    this.size = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.col = new Float32Array(max * 3);
    this.fade = new Uint8Array(max);      // 0 = fade out, 1 = grow & fade (smoke)
    this.bounce = new Uint8Array(max);
  }

  spawn(x, y, z, vx, vy, vz, opts) {
    let i = this.n;
    if (i >= this.max) i = Math.floor(Math.random() * this.max); else this.n++;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.life[i] = this.max_life[i] = opts.life;
    this.size[i] = opts.size;
    this.grav[i] = opts.gravity == null ? 0 : opts.gravity;
    this.drag[i] = opts.drag == null ? 0.6 : opts.drag;
    this.col[i3] = opts.color[0]; this.col[i3 + 1] = opts.color[1]; this.col[i3 + 2] = opts.color[2];
    this.fade[i] = opts.grow ? 1 : 0;
    this.bounce[i] = opts.bounce ? 1 : 0;
  }

  update(dt, floorY) {
    const { pos, vel, life, max_life, size, grav, drag, col, fade } = this;
    const gp = this.points.geometry.attributes;
    const gpos = gp.position.array, gcol = gp.color.array, gsz = gp.psize.array, ga = gp.alpha.array;
    let out = 0;
    for (let i = 0; i < this.n; i++) {
      life[i] -= dt;
      if (life[i] <= 0) {
        // swap-remove: keeps the live range packed at the front
        const last = this.n - 1;
        if (i !== last) {
          for (let k = 0; k < 3; k++) {
            pos[i * 3 + k] = pos[last * 3 + k]; vel[i * 3 + k] = vel[last * 3 + k]; col[i * 3 + k] = col[last * 3 + k];
          }
          life[i] = life[last]; max_life[i] = max_life[last]; size[i] = size[last];
          grav[i] = grav[last]; drag[i] = drag[last]; fade[i] = fade[last]; this.bounce[i] = this.bounce[last];
        }
        this.n--; i--;
        continue;
      }
      const i3 = i * 3;
      vel[i3 + 1] -= grav[i] * dt;
      const d = Math.exp(-drag[i] * dt);
      vel[i3] *= d; vel[i3 + 1] *= d; vel[i3 + 2] *= d;
      pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
      if (this.bounce[i] && pos[i3 + 1] < floorY + 0.03) {
        pos[i3 + 1] = floorY + 0.03;
        vel[i3 + 1] = Math.abs(vel[i3 + 1]) * 0.28;
        vel[i3] *= 0.6; vel[i3 + 2] *= 0.6;
      }
      const t = life[i] / max_life[i];
      const o3 = out * 3;
      gpos[o3] = pos[i3]; gpos[o3 + 1] = pos[i3 + 1]; gpos[o3 + 2] = pos[i3 + 2];
      gcol[o3] = col[i3]; gcol[o3 + 1] = col[i3 + 1]; gcol[o3 + 2] = col[i3 + 2];
      gsz[out] = fade[i] ? size[i] * (2 - t) : size[i] * (0.4 + t * 0.6);
      ga[out] = fade[i] ? t * t : Math.min(1, t * 2.2);
      out++;
    }
    gp.position.needsUpdate = gp.color.needsUpdate = gp.psize.needsUpdate = gp.alpha.needsUpdate = true;
    this.points.geometry.setDrawRange(0, out);
  }

  clear() { this.n = 0; this.points.geometry.setDrawRange(0, 0); }
}

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.floorY = 0;

    this.soft = new ParticleSet(MAX_SOFT, puffTexture('rgba(255,255,255,1)'), THREE.NormalBlending, 260);
    this.glow = new ParticleSet(MAX_GLOW, puffTexture('rgba(255,255,255,1)'), THREE.AdditiveBlending, 260);
    scene.add(this.soft.points, this.glow.points);

    // decals: reused planes that fade with age
    this.decals = [];
    this.decalAt = 0;
    const splats = [splatTexture('#7a0f18', 1), splatTexture('#63111a', 2), splatTexture('#8d1220', 3)];
    for (let i = 0; i < MAX_DECALS; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: splats[i % 3], transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })
      );
      m.visible = false;
      m.userData.life = 0;
      scene.add(m);
      this.decals.push(m);
    }

    // gibs: little chunks that tumble and settle
    this.gibs = [];
    this.gibAt = 0;
    const gibGeo = new THREE.IcosahedronGeometry(0.11, 0);
    const gibMat = new THREE.MeshStandardMaterial({ color: 0x8c2230, roughness: 0.75 });
    for (let i = 0; i < MAX_GIBS; i++) {
      const m = new THREE.Mesh(gibGeo, gibMat);
      m.visible = false; m.castShadow = false;
      m.userData = { vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0 };
      scene.add(m);
      this.gibs.push(m);
    }

    // tracers: stretched glowing quads along the bullet path
    this.tracers = [];
    this.tracerAt = 0;
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < MAX_TRACERS; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.004, 1, 5, 1, true), tracerMat.clone());
      m.visible = false;
      scene.add(m);
      this.tracers.push(m);
    }

    // a handful of shared lights for muzzle flashes and explosions
    this.lights = [];
    for (let i = 0; i < 5; i++) {
      const l = new THREE.PointLight(0xffb066, 0, 22, 2);
      scene.add(l);
      this.lights.push({ light: l, life: 0, power: 0 });
    }
    this.lightAt = 0;
  }

  /* --------------------------------------------------------------- spawners */
  blood(p, dir, amount = 14) {
    for (let i = 0; i < amount; i++) {
      const s = 2 + Math.random() * 5;
      this.soft.spawn(p.x, p.y, p.z,
        dir.x * s + randRange(-2, 2), dir.y * s + randRange(0.5, 3.5), dir.z * s + randRange(-2, 2),
        { life: randRange(0.5, 1.2), size: randRange(2.5, 6), gravity: 9.5, drag: 0.7, color: [0.45 + Math.random() * 0.2, 0.02, 0.05], bounce: true });
    }
    for (let i = 0; i < 3; i++) {
      this.soft.spawn(p.x, p.y, p.z, randRange(-0.4, 0.4), randRange(0.2, 0.9), randRange(-0.4, 0.4),
        { life: randRange(0.6, 1.1), size: randRange(7, 13), gravity: -0.4, drag: 1.4, grow: true, color: [0.22, 0.03, 0.05] });
    }
  }

  sparks(p, normal, count = 10, colour = [1, 0.72, 0.3]) {
    for (let i = 0; i < count; i++) {
      this.glow.spawn(p.x, p.y, p.z,
        normal.x * randRange(1, 6) + randRange(-3, 3),
        normal.y * randRange(1, 6) + randRange(-1, 4),
        normal.z * randRange(1, 6) + randRange(-3, 3),
        { life: randRange(0.15, 0.5), size: randRange(1.4, 3.4), gravity: 13, drag: 0.9, color: colour });
    }
  }

  dust(p, normal, count = 8) {
    for (let i = 0; i < count; i++) {
      this.soft.spawn(p.x, p.y, p.z,
        normal.x * randRange(0.4, 2) + randRange(-1, 1), normal.y * randRange(0.4, 2) + randRange(-0.3, 1.4), normal.z * randRange(0.4, 2) + randRange(-1, 1),
        { life: randRange(0.4, 1), size: randRange(5, 12), gravity: 0.6, drag: 1.8, grow: true, color: [0.44, 0.42, 0.38] });
    }
  }

  smoke(p, count = 6, colour = [0.16, 0.16, 0.18], up = 1.2) {
    for (let i = 0; i < count; i++) {
      this.soft.spawn(p.x + randRange(-0.2, 0.2), p.y, p.z + randRange(-0.2, 0.2),
        randRange(-0.4, 0.4), randRange(up * 0.4, up), randRange(-0.4, 0.4),
        { life: randRange(1.2, 2.6), size: randRange(10, 22), gravity: -0.5, drag: 0.7, grow: true, color: colour });
    }
  }

  embers(p, count = 4, radius = 0.4) {
    for (let i = 0; i < count; i++) {
      this.glow.spawn(p.x + randRange(-radius, radius), p.y + randRange(0, radius), p.z + randRange(-radius, radius),
        randRange(-0.3, 0.3), randRange(0.6, 2), randRange(-0.3, 0.3),
        { life: randRange(0.8, 2.2), size: randRange(1, 2.6), gravity: -0.8, drag: 0.5, color: [1, 0.45 + Math.random() * 0.3, 0.12] });
    }
  }

  fire(p, count = 6, scale = 1) {
    for (let i = 0; i < count; i++) {
      this.glow.spawn(p.x + randRange(-0.3, 0.3) * scale, p.y + randRange(-0.2, 0.4) * scale, p.z + randRange(-0.3, 0.3) * scale,
        randRange(-1, 1) * scale, randRange(1.5, 4) * scale, randRange(-1, 1) * scale,
        { life: randRange(0.25, 0.6), size: randRange(6, 14) * scale, gravity: -3, drag: 1.2, grow: true, color: [1, 0.38 + Math.random() * 0.3, 0.1] });
    }
  }

  plasmaBurst(p, colour = [0.35, 0.8, 1]) {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * TAU, b = Math.random() * Math.PI, s = randRange(2, 9);
      this.glow.spawn(p.x, p.y, p.z, Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s,
        { life: randRange(0.2, 0.55), size: randRange(2, 6), gravity: 0, drag: 2.4, color: colour });
    }
  }

  explosion(p, scale = 1) {
    this.fire(p, 26 * scale, 1.4 * scale);
    this.smoke(p, 14, [0.1, 0.09, 0.1], 3);
    this.sparks(p, new THREE.Vector3(0, 1, 0), 30, [1, 0.6, 0.2]);
    this.light(p, 0xff8a3c, 6 * scale, 0.45, 30 * scale);
  }

  decal(p, normal, size = 1, colourIndex = null) {
    const m = this.decals[this.decalAt++ % MAX_DECALS];
    m.visible = true;
    m.material.opacity = 0.92;
    m.userData.life = 26;
    m.scale.set(size, size, size);
    m.position.copy(p).addScaledVector(normal, 0.015);
    // face along the surface normal, with a random spin so repeats don't show
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    m.quaternion.copy(q);
    m.rotateZ(Math.random() * TAU);
    if (colourIndex != null) m.material.color.setHex(colourIndex);
    return m;
  }

  gib(p, vel, colour = 0x8c2230, scale = 1) {
    const m = this.gibs[this.gibAt++ % MAX_GIBS];
    m.visible = true;
    m.position.copy(p);
    m.scale.setScalar(scale * randRange(0.7, 1.5));
    m.material = m.material;   // shared material, colour set per group below
    m.userData.vel.copy(vel);
    m.userData.spin.set(randRange(-9, 9), randRange(-9, 9), randRange(-9, 9));
    m.userData.life = 6;
    m.userData.colour = colour;
    return m;
  }

  tracer(from, to) {
    const m = this.tracers[this.tracerAt++ % MAX_TRACERS];
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 0.05) return;
    m.visible = true;
    m.material.opacity = 0.85;
    m.position.copy(from).addScaledVector(dir, 0.5);
    m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.userData.life = 0.06;
  }

  light(p, colour, intensity, life, distance = 20) {
    intensity *= 9;                    // physical units, as in world.js
    const slot = this.lights[this.lightAt++ % this.lights.length];
    slot.light.color.setHex(colour);
    slot.light.position.copy(p);
    slot.light.distance = distance;
    slot.power = intensity;
    slot.light.intensity = intensity;
    slot.life = life;
    return slot.light;
  }

  /* ---------------------------------------------------------------- update */
  update(dt) {
    this.soft.update(dt, this.floorY);
    this.glow.update(dt, this.floorY);

    for (const m of this.decals) {
      if (!m.visible) continue;
      m.userData.life -= dt;
      if (m.userData.life < 3) m.material.opacity = Math.max(0, m.userData.life / 3) * 0.92;
      if (m.userData.life <= 0) m.visible = false;
    }

    for (const m of this.gibs) {
      if (!m.visible) continue;
      const u = m.userData;
      u.life -= dt;
      u.vel.y -= 16 * dt;
      m.position.addScaledVector(u.vel, dt);
      m.rotation.x += u.spin.x * dt; m.rotation.y += u.spin.y * dt; m.rotation.z += u.spin.z * dt;
      if (m.position.y < this.floorY + 0.08) {
        m.position.y = this.floorY + 0.08;
        u.vel.y = Math.abs(u.vel.y) * 0.3;
        u.vel.x *= 0.6; u.vel.z *= 0.6;
        u.spin.multiplyScalar(0.5);
      }
      if (u.life <= 0) m.visible = false;
    }

    for (const m of this.tracers) {
      if (!m.visible) continue;
      m.userData.life -= dt;
      m.material.opacity = Math.max(0, m.userData.life / 0.06) * 0.85;
      if (m.userData.life <= 0) m.visible = false;
    }

    for (const s of this.lights) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.light.intensity = Math.max(0, s.life) * s.power * 4;
      if (s.life <= 0) s.light.intensity = 0;
    }
  }

  clear() {
    this.soft.clear(); this.glow.clear();
    this.decals.forEach(m => { m.visible = false; });
    this.gibs.forEach(m => { m.visible = false; });
    this.tracers.forEach(m => { m.visible = false; });
    this.lights.forEach(s => { s.light.intensity = 0; s.life = 0; });
  }
}

/** Camera shake: several decaying sine waves so kicks never look repetitive. */
export class Shake {
  constructor() { this.trauma = 0; this.t = 0; }
  add(amount) { this.trauma = clamp(this.trauma + amount, 0, 1); }
  update(dt, camera, baseQuat) {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    const s = this.trauma * this.trauma;
    if (s < 0.0005) return;
    const t = this.t * 34;
    camera.rotateZ(Math.sin(t * 0.9) * 0.035 * s);
    camera.rotateX(Math.sin(t * 1.3 + 1.7) * 0.05 * s);
    camera.rotateY(Math.sin(t * 1.1 + 4.2) * 0.05 * s);
  }
}

/**
 * Ash and embers drifting through the air around the camera. The particles
 * live in a box that follows the viewer and wrap round its edges, so the air
 * always looks full without simulating the whole level.
 */
export class Ash {
  constructor(scene, { count = 700, colour = 0xb8aca0, size = 0.09, embers = 0.12, box = 36 } = {}) {
    this.box = box;
    this.count = count;
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    const base = new THREE.Color(colour), hot = new THREE.Color(0xff7a2f);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = randRange(-box, box);
      pos[i * 3 + 1] = randRange(0, box * 0.6);
      pos[i * 3 + 2] = randRange(-box, box);
      this.vel[i * 3] = randRange(-0.3, 0.6);
      this.vel[i * 3 + 1] = randRange(-0.5, -0.15);
      this.vel[i * 3 + 2] = randRange(-0.3, 0.3);
      const c = Math.random() < embers ? hot : base;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      if (c === hot) this.vel[i * 3 + 1] = randRange(0.1, 0.5);   // embers rise
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size, map: puffTexture('rgba(255,255,255,1)'), vertexColors: true, transparent: true,
      opacity: 0.75, depthWrite: false, sizeAttenuation: true
    }));
    this.points.frustumCulled = false;
    this.origin = new THREE.Vector3();
    scene.add(this.points);
  }

  update(dt, centre, time) {
    const p = this.points.geometry.attributes.position.array, v = this.vel, b = this.box;
    const sway = Math.sin(time * 0.4) * 0.3;
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      p[i3] += (v[i3] + sway) * dt;
      p[i3 + 1] += v[i3 + 1] * dt;
      p[i3 + 2] += v[i3 + 2] * dt;
      // wrap within a box centred on the viewer
      const rx = p[i3] - centre.x, ry = p[i3 + 1] - centre.y, rz = p[i3 + 2] - centre.z;
      if (rx > b) p[i3] -= 2 * b; else if (rx < -b) p[i3] += 2 * b;
      if (rz > b) p[i3 + 2] -= 2 * b; else if (rz < -b) p[i3 + 2] += 2 * b;
      if (ry < -4) p[i3 + 1] += b * 0.6 + 4; else if (ry > b * 0.6) p[i3 + 1] -= b * 0.6 + 4;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

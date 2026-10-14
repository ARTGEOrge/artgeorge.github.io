/**
 * Small visual effects: floating dust in the air, the glitter around a relic
 * that has not been picked up yet, and the burst when one is collected.
 */
import * as THREE from 'three';
import { randRange, TAU } from './util.js';

/** Dust motes that drift near the player and wrap around as they move. */
export class Dust {
  constructor(scene, count = 420, radius = 26, colour = 0xffe9c4, size = 0.055) {
    const pos = new Float32Array(count * 3);
    this.speed = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = randRange(-radius, radius);
      pos[i * 3 + 1] = randRange(0.2, 9);
      pos[i * 3 + 2] = randRange(-radius, radius);
      this.speed[i * 3] = randRange(-0.25, 0.25);
      this.speed[i * 3 + 1] = randRange(-0.05, 0.18);
      this.speed[i * 3 + 2] = randRange(-0.25, 0.25);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      color: colour, size, transparent: true, opacity: 0.22, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.radius = radius;
  }

  update(dt, viewer) {
    const p = this.points.geometry.attributes.position;
    const a = p.array, r = this.radius;
    for (let i = 0; i < a.length; i += 3) {
      a[i] += this.speed[i] * dt;
      a[i + 1] += this.speed[i + 1] * dt;
      a[i + 2] += this.speed[i + 2] * dt;
      // keep the cloud centred on the viewer by wrapping motes around it
      if (a[i] - viewer.x > r) a[i] -= r * 2; else if (a[i] - viewer.x < -r) a[i] += r * 2;
      if (a[i + 2] - viewer.z > r) a[i + 2] -= r * 2; else if (a[i + 2] - viewer.z < -r) a[i + 2] += r * 2;
      if (a[i + 1] > 11) a[i + 1] = 0.2; else if (a[i + 1] < 0.1) a[i + 1] = 9;
    }
    p.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.points.parent?.remove(this.points);
  }
}

/** The shimmer that hangs over an uncollected relic. */
export function makeGlimmer(colour = 0xffd27a, count = 26, radius = 0.55) {
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    phase[i] = Math.random() * TAU;
    pos[i * 3 + 1] = randRange(0, 1.1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color: colour, size: 0.07, transparent: true, opacity: 0.9, depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  points.userData.update = (t) => {
    const a = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const s = t * 0.7 + phase[i];
      const rr = radius * (0.35 + 0.65 * Math.abs(Math.sin(s * 0.5)));
      a[i * 3] = Math.cos(s) * rr;
      a[i * 3 + 2] = Math.sin(s) * rr;
      a[i * 3 + 1] = 0.15 + ((s * 0.22) % 1.3);
    }
    geo.attributes.position.needsUpdate = true;
  };
  return points;
}

/** Short-lived sparks, used when a relic is picked up. */
export class Bursts {
  constructor(scene, max = 300) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({
      color: 0xffd98a, size: 0.12, transparent: true, opacity: 0.95,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -999;
  }

  burst(at, count = 70, colour = 0xffd98a) {
    this.mat.color.setHex(colour);
    for (let i = 0; i < count; i++) {
      const k = this.next = (this.next + 1) % this.max;
      this.pos[k * 3] = at.x; this.pos[k * 3 + 1] = at.y; this.pos[k * 3 + 2] = at.z;
      const a = Math.random() * TAU, up = randRange(0.4, 2.6), sp = randRange(0.6, 3.2);
      this.vel[k * 3] = Math.cos(a) * sp;
      this.vel[k * 3 + 1] = up;
      this.vel[k * 3 + 2] = Math.sin(a) * sp;
      this.life[k] = randRange(0.5, 1.2);
    }
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 4.2 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.life[i] <= 0) this.pos[i * 3 + 1] = -999;
    }
    if (any) this.points.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.mat.dispose();
    this.points.parent?.remove(this.points);
  }
}

/**
 * What drifts through a city's air, recycled round the player like the dust:
 *   leaves   falling, fluttering leaves in the given colours (Kyoto's maples)
 *   sand     grit blowing low along the ground (Giza)
 *   birds    a few birds wheeling high overhead: 'gull' white and big,
 *            'swift' small and dark and quick, 'kite' gliding on broad wings
 *   fireflies  little lights over the grass after dark
 * config: { leaves: [hex…], leafCount, sand: true, birds: 'gull', birdCount, fireflies: true }
 */
export class Ambient {
  constructor(scene, cfg = {}) {
    this.scene = scene;
    this.cfg = cfg;
    this.objs = [];
    this.night = 0;
    const dummy = new THREE.Object3D();
    this.dummy = dummy;

    if (cfg.leaves && cfg.leaves.length) {
      const n = cfg.leafCount || 120;
      const g = new THREE.BufferGeometry();
      // a little pointed leaf: a diamond, bent along its midrib
      g.setAttribute('position', new THREE.Float32BufferAttribute([
        0, 0, -0.07, 0.05, 0.012, 0, 0, 0, 0.08,   0, 0, -0.07, 0, 0, 0.08, -0.05, 0.012, 0], 3));
      g.computeVertexNormals();
      const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 }), n);
      m.frustumCulled = false;
      const c = new THREE.Color();
      this.leaves = [];
      for (let i = 0; i < n; i++) {
        m.setColorAt(i, c.setHex(cfg.leaves[i % cfg.leaves.length]).multiplyScalar(0.85 + Math.random() * 0.3));
        this.leaves.push({ x: randRange(-30, 30), y: randRange(0, 14), z: randRange(-30, 30),
                           ph: Math.random() * TAU, sp: randRange(0.5, 1.1), spin: randRange(1.5, 4) });
      }
      m.instanceColor.needsUpdate = true;
      this.leafMesh = m;
      scene.add(m); this.objs.push(m);
    }

    if (cfg.sand) {
      const n = 260;
      const pos = new Float32Array(n * 3);
      this.sand = [];
      for (let i = 0; i < n; i++) this.sand.push({ x: randRange(-25, 25), y: randRange(0.05, 1.6), z: randRange(-25, 25), v: randRange(4, 9) });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.sandPts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe8d4a4, size: 0.05, transparent: true,
        opacity: 0.55, depthWrite: false }));
      this.sandPts.frustumCulled = false;
      this.wind = new THREE.Vector2(0.86, 0.5);
      scene.add(this.sandPts); this.objs.push(this.sandPts);
    }

    if (cfg.birds) {
      const kind = cfg.birds;
      const n = cfg.birdCount || (kind === 'swift' ? 14 : kind === 'kite' ? 5 : 9);
      const span = kind === 'gull' ? 0.75 : kind === 'kite' ? 0.9 : 0.4;
      const colour = kind === 'gull' ? 0xf2f2ee : kind === 'kite' ? 0x4a3a2c : 0x26262a;
      // one wing reaching along +z from the body; the other is mirrored
      const wing = new THREE.BufferGeometry();
      wing.setAttribute('position', new THREE.Float32BufferAttribute([
        0.12, 0, 0, -0.14, 0, 0, 0.0, 0, span,   -0.14, 0, 0, -0.16, 0, span * 0.8, 0.0, 0, span], 3));
      wing.computeVertexNormals();
      const body = new THREE.ConeGeometry(0.06, 0.42, 5).rotateZ(-Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({ color: colour, side: THREE.DoubleSide, roughness: 0.9 });
      this.birdWings = new THREE.InstancedMesh(wing, mat, n * 2);
      this.birdBody = new THREE.InstancedMesh(body, mat, n);
      this.birdWings.frustumCulled = this.birdBody.frustumCulled = false;
      this.birds = [];
      for (let i = 0; i < n; i++) {
        this.birds.push({ r: randRange(18, 60), h: randRange(22, 55), a: Math.random() * TAU,
                          w: randRange(0.12, 0.3) * (Math.random() < 0.5 ? -1 : 1) * (kind === 'swift' ? 2.2 : 1),
                          ph: Math.random() * TAU, cx: randRange(-30, 30), cz: randRange(-30, 30) });
      }
      this.birdKind = kind;
      scene.add(this.birdWings, this.birdBody); this.objs.push(this.birdWings, this.birdBody);
    }

    if (cfg.fireflies) {
      const n = 70;
      this.flies = [];
      for (let i = 0; i < n; i++) this.flies.push({ x: randRange(-22, 22), y: randRange(0.4, 2.4), z: randRange(-22, 22), ph: Math.random() * TAU });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      this.flyPts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd8ff7a, size: 0.13, transparent: true,
        opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.flyPts.frustumCulled = false;
      scene.add(this.flyPts); this.objs.push(this.flyPts);
    }
  }

  setNight(v) {
    this.night = v;
    if (this.flyPts) this.flyPts.material.opacity = Math.max(0, (v - 0.55) / 0.45) * 0.95;
    if (this.sandPts) this.sandPts.material.opacity = 0.55 * (1 - v * 0.7);
  }

  update(dt, p, t) {
    const d = this.dummy;
    const wrap = (o, r) => {
      if (o.x - p.x > r) o.x -= r * 2; else if (o.x - p.x < -r) o.x += r * 2;
      if (o.z - p.z > r) o.z -= r * 2; else if (o.z - p.z < -r) o.z += r * 2;
    };
    if (this.leaves) {
      const m = this.leafMesh;
      this.leaves.forEach((l, i) => {
        l.y -= l.sp * dt;
        l.x += Math.sin(t * 0.7 + l.ph) * dt * 0.8 + dt * 0.4;
        l.z += Math.cos(t * 0.5 + l.ph * 1.3) * dt * 0.6;
        if (l.y < 0.02) { l.y = randRange(9, 16); }
        wrap(l, 30);
        d.position.set(l.x, l.y, l.z);
        d.rotation.set(Math.sin(t * l.spin + l.ph) * 1.2, t * l.spin * 0.5 + l.ph, Math.cos(t * l.spin * 0.8 + l.ph) * 0.9);
        d.scale.setScalar(1.6);
        d.updateMatrix();
        m.setMatrixAt(i, d.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
    if (this.sand) {
      const a = this.sandPts.geometry.attributes.position.array;
      const gust = 0.6 + 0.4 * Math.sin(t * 0.5) * Math.sin(t * 0.17 + 1);
      this.sand.forEach((s, i) => {
        s.x += this.wind.x * s.v * gust * dt;
        s.z += this.wind.y * s.v * gust * dt;
        s.y += Math.sin(t * 3 + i) * dt * 0.3;
        if (s.y < 0.03 || s.y > 2) s.y = randRange(0.05, 1.2);
        wrap(s, 25);
        a[i * 3] = s.x; a[i * 3 + 1] = s.y; a[i * 3 + 2] = s.z;
      });
      this.sandPts.geometry.attributes.position.needsUpdate = true;
    }
    if (this.birds) {
      const show = this.night < 0.6;
      const glide = this.birdKind === 'kite';
      const flapRate = this.birdKind === 'swift' ? 18 : this.birdKind === 'gull' ? 7 : 5;
      const mB = this._mB || (this._mB = new THREE.Matrix4()), mC = this._mC || (this._mC = new THREE.Matrix4());
      const mM = this._mM || (this._mM = new THREE.Matrix4().makeScale(1, 1, -1));
      this.birds.forEach((b, i) => {
        // each circles its own point, which drifts along after the player
        b.cx += (p.x - b.cx) * Math.min(1, dt * 0.05); b.cz += (p.z - b.cz) * Math.min(1, dt * 0.05);
        b.a += b.w * dt;
        const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r;
        const y = b.h + Math.sin(t * 0.4 + b.ph) * 2;
        // heading along the circle
        const yaw = Math.atan2(-Math.cos(b.a) * Math.sign(b.w), -Math.sin(b.a) * Math.sign(b.w));
        d.position.set(x, y, z);
        d.rotation.set(0, yaw, -Math.sign(b.w) * 0.25, 'YXZ');
        d.scale.setScalar(show ? 1 : 0);
        d.updateMatrix();
        this.birdBody.setMatrixAt(i, d.matrix);
        const beat = glide ? Math.sin(t * 0.8 + b.ph) * 0.08 + 0.06
                           : (Math.sin(t * flapRate + b.ph) > -0.2 || this.birdKind === 'swift' ? Math.sin(t * flapRate + b.ph) * 0.7 : 0.1);
        for (let k = 0; k < 2; k++) {
          mB.makeRotationX(-beat);
          if (!k) mB.premultiply(mM);
          this.birdWings.setMatrixAt(i * 2 + k, mC.multiplyMatrices(d.matrix, mB));
        }
      });
      this.birdBody.instanceMatrix.needsUpdate = this.birdWings.instanceMatrix.needsUpdate = true;
    }
    if (this.flies && this.night > 0.5) {
      const a = this.flyPts.geometry.attributes.position.array;
      this.flies.forEach((f, i) => {
        f.x += Math.sin(t * 0.6 + f.ph) * dt * 0.5;
        f.z += Math.cos(t * 0.45 + f.ph * 2) * dt * 0.5;
        wrap(f, 22);
        // they blink: hide below the ground between flashes
        const on = Math.sin(t * 1.7 + f.ph * 5) > 0.2;
        a[i * 3] = f.x; a[i * 3 + 1] = on ? f.y + Math.sin(t + f.ph) * 0.3 : -50; a[i * 3 + 2] = f.z;
      });
      this.flyPts.geometry.attributes.position.needsUpdate = true;
    }
  }

  dispose() {
    for (const o of this.objs) {
      this.scene.remove(o);
      o.geometry.dispose();
      o.material.dispose();
    }
    this.objs.length = 0;
  }
}

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

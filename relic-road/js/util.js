/* Demon Fall — small shared helpers: seeded randomness, maths, timers, pools. */
import * as THREE from 'three';

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);
// frame-rate independent approach: how far to move toward a target in dt seconds
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const randRange = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(randRange(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const chance = p => Math.random() < p;

/** Deterministic RNG so a level always builds the same way (mulberry32). */
export function makeRng(seed) {
  let a = seed >>> 0;
  const rng = function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (lo, hi) => lo + rng() * (hi - lo);
  rng.int = (lo, hi) => Math.floor(rng.range(lo, hi + 1));
  rng.pick = arr => arr[Math.floor(rng() * arr.length)];
  rng.chance = p => rng() < p;
  rng.sign = () => (rng() < 0.5 ? -1 : 1);
  return rng;
}

/** Smooth value noise, used for terrain, rust patterns and camera drift. */
export function noise2(x, y, seed = 1337) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const h = (a, b) => {
    let n = (a * 374761393 + b * 668265263 + seed * 144665) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const u = smooth(xf), v = smooth(yf);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}

export function fbm(x, y, octaves = 4, seed = 7) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq, seed + i * 91);
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

/** Angle difference wrapped to [-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Reusable scratch vectors — allocating inside the game loop causes GC hitches. */
export const tmpV1 = new THREE.Vector3();
export const tmpV2 = new THREE.Vector3();
export const tmpV3 = new THREE.Vector3();
export const tmpQ = new THREE.Quaternion();
export const tmpM = new THREE.Matrix4();

/** A simple object pool: grow on demand, never allocate mid-frame twice. */
export class Pool {
  constructor(make, reset, size = 0) {
    this.make = make; this.reset = reset; this.free = [];
    for (let i = 0; i < size; i++) this.free.push(make());
  }
  take() { return this.free.length ? this.free.pop() : this.make(); }
  give(obj) { this.reset && this.reset(obj); this.free.push(obj); }
}

/** Rolling average, for the adaptive quality system. */
export class Rolling {
  constructor(n = 60) { this.n = n; this.buf = []; this.sum = 0; }
  push(v) {
    this.buf.push(v); this.sum += v;
    if (this.buf.length > this.n) this.sum -= this.buf.shift();
    return this.sum / this.buf.length;
  }
  get avg() { return this.buf.length ? this.sum / this.buf.length : 0; }
  clear() { this.buf.length = 0; this.sum = 0; }
}

export const fmtTime = s => {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
};

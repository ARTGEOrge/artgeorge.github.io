/**
 * Driving: take a car out of traffic and drive it round the district.
 *
 * Arcade, not simulation. The car keeps a world velocity; each frame the part
 * of it along the car's nose is pushed by the throttle and the brakes, and the
 * part sideways is bled off by the tyres' grip (much less of it with the
 * handbrake on, which is what lets the back step out). Steering turns the car
 * in proportion to its speed, through less lock the faster it goes.
 *
 * It bumps into the same box colliders the player walks into: the car is a
 * box turned to its heading, pushed out of any box it ends up in, and whatever
 * speed was going into the wall is taken away, so it slides along.
 */
import * as THREE from 'three';
import { clamp, damp, angleDelta } from './util.js';
import { CAR_HALF } from './life.js';
import * as audio from './audio.js';

const VMAX = 20.5;            // m/s: about 74 km/h
const VREV = 6.5;
const ACCEL = 8.5, BRAKE = 17, COAST = 2.2, HANDBRAKE = 9;
const GRIP = 9, SLIDE_GRIP = 1.6;
const WHEELBASE = 2.6, LOCK = 0.62;
const BODY = [CAR_HALF[0] + 0.05, CAR_HALF[1] + 0.05];     // what bumps into things: the body, and a little more
const BOOM = 6.6, BOOM_UP = 2.1;              // the chase camera: behind, and above the car but under the trees
const _f = new THREE.Vector3();
const EXIT_SPOTS = [[0, 2.4], [0, -2.4], [-3.6, 0], [3.6, 0], [-2, 2.6], [-2, -2.6], [2, 2.6], [2, -2.6]];

export class Drive {
  constructor() {
    this.car = null;
    this.vx = 0; this.vz = 0;
    this.speed = 0;               // signed, along the nose
    this.steer = 0;
    this.camYaw = 0; this.camPitch = 0;
    this.camA = 0;                // the camera's own heading, which trails the car's
    this.boom = BOOM;
    this.probe = [];
    this.lamp = null; this.lampWorld = null;
    this.bumpAt = 0;
    this.nx = 0; this.nz = 0; this.depth = 0;     // the way out of the last thing overlapped
  }

  get active() { return !!this.car; }

  enter(car, life, camera) {
    life.takeCar(car);
    this.car = car;
    this.vx = this.vz = 0;
    this.speed = 0;
    this.steer = 0;
    this.camYaw = 0; this.camPitch = 0;
    // start the camera from where you were looking, and let it swing round behind
    const f = camera.getWorldDirection(_f);
    this.camA = Math.atan2(-f.z, f.x);
    this.boom = BOOM;
    life.dodge = 3;
    audio.sfx.land();
  }

  /** Park the car and step out beside it. Returns where to stand, or null. */
  exit(life, world, walk, openSpot) {
    const c = this.car;
    if (!c) return null;
    const hx = Math.cos(c.yaw), hz = -Math.sin(c.yaw);
    let spot = null;
    for (const pass of [0, 1]) {
      for (const [a, s] of EXIT_SPOTS) {
        // a: along the nose, s: out to the side; and twice as far on the second try
        const k = pass ? 1.8 : 1;
        const x = c.x + (hx * a - hz * s) * k, z = c.z + (hz * a + hx * s) * k;
        if (!this.free(x, z, world, life)) continue;
        if (walk && walk.cells > 2000 && !walk.ok(x, z)) continue;
        spot = { x, z }; break;
      }
      if (spot) break;
    }
    if (!spot) {
      const o = openSpot(world, c.x, c.z, 30);
      spot = { x: o.x, z: o.z };
    }
    life.parkCar(c);
    life.dodge = 1.4;
    this.car = null;
    this.speed = 0;
    if (this.lamp) this.lamp.intensity = 0;
    audio.sfx.land();
    return spot;
  }

  /** Nothing solid within a walker's reach of (x, z): no wall, no post, no car. */
  free(x, z, world, life) {
    const list = world.near(x, z, 1.2, this.probe);
    for (const col of list) {
      if (col.tag === 'ground' || col.tag === 'edge' || col.max.y <= 0.6 || col.min.y > 1.7) continue;
      if (x > col.min.x - 0.6 && x < col.max.x + 0.6 && z > col.min.z - 0.6 && z < col.max.z + 0.6) return false;
    }
    for (const o of life.cars) {
      if (!o.alive) continue;
      const rx = x - o.x, rz = z - o.z;
      if (rx * rx + rz * rz > 16) continue;
      const hx = Math.cos(o.yaw), hz = -Math.sin(o.yaw);
      if (Math.abs(rx * hx + rz * hz) < CAR_HALF[0] + 0.5 && Math.abs(-rx * hz + rz * hx) < CAR_HALF[1] + 0.5) return false;
    }
    return true;
  }

  /** Back to nobody driving, without parking anything (the city is going). */
  reset() {
    this.car = null;
    this.speed = 0;
    this.vx = this.vz = 0;
    this.lamp = null; this.lampWorld = null;
  }

  look(dx, dy) {
    this.camYaw = clamp(this.camYaw - dx * 0.0022, -1.4, 1.4);
    this.camPitch = clamp(this.camPitch - dy * 0.0022, -0.3, 0.55);
  }

  /** keys: the held key set. half: how far the district reaches from its centre. */
  update(dt, keys, world, life, half, camera, night) {
    const c = this.car;
    const k = keys;
    const thr = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const turn = (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) - (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0);
    const hand = k.has('Space');

    let hx = Math.cos(c.yaw), hz = -Math.sin(c.yaw);
    // the car's right is (-hz, hx)
    let f = this.vx * hx + this.vz * hz;
    let l = this.vx * -hz + this.vz * hx;

    if (thr > 0) {
      if (f < -0.4) f = Math.min(0, f + BRAKE * dt);
      else f = Math.min(VMAX, f + ACCEL * (1 - 0.55 * (f / VMAX) * (f / VMAX)) * dt);
    } else if (thr < 0) {
      if (f > 0.4) f = Math.max(0, f - BRAKE * dt);
      else f = Math.max(-VREV, f - ACCEL * 0.6 * dt);
    } else {
      f = f > 0 ? Math.max(0, f - COAST * dt) : Math.min(0, f + COAST * dt);
    }
    if (hand) f = f > 0 ? Math.max(0, f - HANDBRAKE * dt) : Math.min(0, f + HANDBRAKE * dt);
    l *= Math.exp(-(hand ? SLIDE_GRIP : GRIP) * dt);

    // less lock at speed, and the turn rate grows with how fast you are going
    this.steer = damp(this.steer, turn, 9, dt);
    const lock = LOCK / (1 + Math.abs(f) / 11);
    const rate = (f / WHEELBASE) * Math.tan(this.steer * lock) * (hand ? 1.45 : 1);
    c.yaw += rate * dt;

    this.vx = hx * f - hz * l;
    this.vz = hz * f + hx * l;

    // move in short steps, so nothing thin is ever jumped over
    const stepLen = Math.hypot(this.vx, this.vz) * dt;
    const n = Math.max(1, Math.ceil(stepLen / 0.4));
    let bump = 0;
    for (let s = 0; s < n; s++) {
      c.x += (this.vx * dt) / n;
      c.z += (this.vz * dt) / n;
      bump = Math.max(bump, this.collide(c, world, life));
    }
    // the edge of the mapped district
    const lim = (half || 1000) + 260;
    if (Math.abs(c.x) > lim) { c.x = clamp(c.x, -lim, lim); this.vx = 0; }
    if (Math.abs(c.z) > lim) { c.z = clamp(c.z, -lim, lim); this.vz = 0; }
    if (bump > 3 && performance.now() - this.bumpAt > 350) {
      this.bumpAt = performance.now();
      audio.sfx.hitWall();
    }

    hx = Math.cos(c.yaw); hz = -Math.sin(c.yaw);
    this.speed = this.vx * hx + this.vz * hz;
    c.v = Math.abs(this.speed);           // so pigeons still take off as you come

    this.headlight(world, night, hx, hz);
    this.chase(dt, camera, world);
  }

  /**
   * Push the car out of whatever it overlaps, by the shortest way. The car is a
   * box turned to its heading; walls are boxes on the axes, other cars are boxes
   * turned to theirs. Two boxes overlap unless one of the four edge directions
   * separates them, and the direction they overlap least along is the way out.
   * Returns how hard the hardest hit was (the speed taken off).
   */
  collide(c, world, life) {
    let hit = 0;
    const list = world.near(c.x, c.z, CAR_HALF[0] + 0.5, this.probe);
    for (const col of list) {
      // kerbs and low things are driven over; overhangs are driven under
      if (col.tag === 'ground' || col.max.y <= 0.45 || col.min.y > 1.4) continue;
      const bx = (col.min.x + col.max.x) / 2, bz = (col.min.z + col.max.z) / 2;
      if (this.overlap(c, bx, bz, 1, 0, (col.max.x - col.min.x) / 2, (col.max.z - col.min.z) / 2)) {
        hit = Math.max(hit, this.resolve(c));
      }
    }
    for (const o of life.cars) {
      if (o === c || !o.alive) continue;
      if (Math.abs(o.x - c.x) > 5 || Math.abs(o.z - c.z) > 5) continue;
      if (this.overlap(c, o.x, o.z, Math.cos(o.yaw), -Math.sin(o.yaw), CAR_HALF[0], CAR_HALF[1])) {
        hit = Math.max(hit, this.resolve(c));
      }
    }
    return hit;
  }

  /**
   * Does the car overlap the box at (bx, bz) whose long axis is (ux, uz) with
   * half-sizes (b0, b1)? If so, leaves the way out in this.nx, this.nz, this.depth.
   */
  overlap(c, bx, bz, ux, uz, b0, b1) {
    const hx = Math.cos(c.yaw), hz = -Math.sin(c.yaw);
    const a0 = BODY[0], a1 = BODY[1];
    const dx = c.x - bx, dz = c.z - bz;
    let best = Infinity, nx = 0, nz = 0;
    for (let k = 0; k < 4; k++) {
      // the car's two edge directions, then the box's
      const ax = k === 0 ? hx : k === 1 ? -hz : k === 2 ? ux : -uz;
      const az = k === 0 ? hz : k === 1 ? hx : k === 2 ? uz : ux;
      const rA = a0 * Math.abs(hx * ax + hz * az) + a1 * Math.abs(-hz * ax + hx * az);
      const rB = b0 * Math.abs(ux * ax + uz * az) + b1 * Math.abs(-uz * ax + ux * az);
      const d = dx * ax + dz * az;
      const o = rA + rB - Math.abs(d);
      if (o <= 0) return false;
      if (o < best) { best = o; const s = d < 0 ? -1 : 1; nx = ax * s; nz = az * s; }
    }
    this.nx = nx; this.nz = nz; this.depth = best;
    return true;
  }

  resolve(c) {
    c.x += this.nx * this.depth;
    c.z += this.nz * this.depth;
    return this.absorb(this.nx, this.nz);
  }

  /** Take away the velocity going into a surface (with a little bounce), keep the rest. */
  absorb(nx, nz) {
    const vn = this.vx * nx + this.vz * nz;
    if (vn >= 0) return 0;
    this.vx -= nx * vn * 1.2;
    this.vz -= nz * vn * 1.2;
    // scraping along a wall costs a little speed too
    this.vx *= 0.985; this.vz *= 0.985;
    return -vn;
  }

  /** A pool of light thrown down the road ahead, after dark. */
  headlight(world, night, hx, hz) {
    if (this.lampWorld !== world) {
      this.lamp = world.light(0xfff0d2, 0, 0, 1.2, 0, 26, 1.2);
      this.lampWorld = world;
    }
    const c = this.car;
    this.lamp.position.set(c.x + hx * 7.5, 1.2, c.z + hz * 7.5);
    this.lamp.intensity = clamp((night - 0.35) / 0.4, 0, 1) * 15;
  }

  /** The camera, behind and above, swinging round after the car. */
  chase(dt, camera, world) {
    const c = this.car;
    // the mouse can look away a while; with the car moving, the view drifts back behind it
    if (Math.abs(this.speed) > 3) {
      this.camYaw = damp(this.camYaw, 0, 0.9, dt);
      this.camPitch = damp(this.camPitch, 0, 0.9, dt);
    }
    // when reversing, still look the way the car points
    const want = c.yaw + this.camYaw;
    this.camA += angleDelta(this.camA, want) * (1 - Math.exp(-4.5 * dt));
    const ax = Math.cos(this.camA), az = -Math.sin(this.camA);
    const reach = BOOM + Math.abs(this.speed) * 0.05;
    // looking up brings the camera down behind the car, looking down lifts it
    const up = Math.max(0.9, BOOM_UP - this.camPitch * 2.5);

    // keep the camera out of buildings: walk the boom out and stop short of the first wall
    let fit = reach;
    for (let i = 1; i <= 4; i++) {
      const t = (reach * i) / 4;
      const x = c.x - ax * t, z = c.z - az * t, y = 1.6 + ((up - 1.6) * i) / 4;
      if (this.solid(x, y, z, world)) { fit = Math.max(1.6, (reach * (i - 1)) / 4); break; }
    }
    this.boom = fit < this.boom ? fit : damp(this.boom, fit, 2.5, dt);
    const b = this.boom / reach;
    camera.position.set(c.x - ax * this.boom, 1.6 + (up - 1.6) * b, c.z - az * this.boom);
    camera.lookAt(c.x + ax * 2.5, 1.25 + this.camPitch * 5, c.z + az * 2.5);
  }

  solid(x, y, z, world) {
    const list = world.near(x, z, 0.4, this.probe);
    for (const col of list) {
      if (col.tag === 'ground') continue;
      if (y < col.min.y || y > col.max.y + 0.3) continue;
      if (x > col.min.x - 0.35 && x < col.max.x + 0.35 && z > col.min.z - 0.35 && z < col.max.z + 0.35) return true;
    }
    return false;
  }

  /** The way the camera looks, as the player's yaw: for the compass and the corner map. */
  viewYaw() { return this.camA - Math.PI / 2; }
}

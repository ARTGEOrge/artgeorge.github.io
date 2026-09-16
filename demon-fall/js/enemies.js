/* Demon Fall — the things that hunt you.
 *
 * Every enemy is built from primitives and animated with code (no model files),
 * and thinks with a small state machine: wander → notice → chase → strike.
 * Steering is direct with wall-sliding and crowd separation, which is enough
 * for an open ruined city and costs almost nothing per frame. */
import * as THREE from 'three';
import { material } from './textures.js';
import { clamp, damp, randRange, TAU, angleDelta, tmpV1, tmpV2 } from './util.js';
import * as audio from './audio.js';

export const TYPES = {
  walker: {
    name: 'Walker', hp: 46, speed: 1.55, run: 2.0, damage: 9, reach: 1.45, attackTime: 1.15, windup: 0.45,
    scale: 1, colour: 0x7f8c6a, eyes: 0xffd34d, score: 100, sight: 46, gib: 0x7a2028
  },
  runner: {
    name: 'Runner', hp: 30, speed: 4.4, run: 5.6, damage: 8, reach: 1.4, attackTime: 0.78, windup: 0.3,
    scale: 0.92, colour: 0x96795e, eyes: 0xff5a2a, score: 150, sight: 52, gib: 0x8a1c26, lunges: true
  },
  brute: {
    name: 'Brute', hp: 190, speed: 1.8, run: 2.5, damage: 24, reach: 2.1, attackTime: 1.7, windup: 0.8,
    scale: 1.7, colour: 0x6d5a4a, eyes: 0xff3010, score: 400, sight: 44, gib: 0x6d1420, heavy: true
  },
  imp: {
    name: 'Imp', hp: 54, speed: 2.9, run: 3.6, damage: 14, reach: 1.4, attackTime: 0.9, windup: 0.35,
    scale: 0.85, colour: 0xa03018, eyes: 0xffd05a, score: 220, sight: 56, gib: 0x2a0a0a, demon: true,
    ranged: { range: 26, cooldown: 2.6, speed: 17, damage: 16 }
  },
  hound: {
    name: 'Hellhound', hp: 70, speed: 5.2, run: 6.6, damage: 16, reach: 1.6, attackTime: 0.7, windup: 0.22,
    scale: 1.05, colour: 0x3a1418, eyes: 0xff6a1e, score: 260, sight: 60, gib: 0x3a0a10, demon: true, quad: true, lunges: true
  },
  warden: {
    name: 'Vault Warden', hp: 1800, speed: 2.1, run: 3.0, damage: 34, reach: 3.2, attackTime: 1.7, windup: 0.75,
    scale: 3.1, colour: 0x4a1218, eyes: 0xff9a2a, score: 3000, sight: 90, gib: 0x5a0e16, demon: true, boss: true,
    ranged: { range: 34, cooldown: 2.1, speed: 20, damage: 22, volley: 3 }
  },
  marsSpawn: {
    name: 'Rift Spawn', hp: 60, speed: 3.4, run: 4.4, damage: 13, reach: 1.5, attackTime: 0.8, windup: 0.3,
    scale: 0.95, colour: 0x6a2a6a, eyes: 0x9af0ff, score: 200, sight: 60, gib: 0x3a1a4a, demon: true
  }
};

/* ------------------------------------------------------------------ models */
function limb(mat, w, h, d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  return m;
}

function humanoid(type) {
  const skin = type.demon
    ? material('demonHide', { repeat: 2, roughness: 0.75, emissive: 0x2a0600, emissiveIntensity: 0.6 })
    : material('flesh', { repeat: 2, roughness: 0.9 });
  const cloth = new THREE.MeshStandardMaterial({ color: type.colour, roughness: 0.95 });
  const g = new THREE.Group();

  const hips = new THREE.Group();
  hips.position.y = 0.95;
  g.add(hips);

  const torso = limb(cloth, 0.62, 0.78, 0.36);
  torso.position.y = 0.36;
  hips.add(torso);

  const chest = limb(skin, 0.5, 0.22, 0.3);
  chest.position.y = 0.72;
  hips.add(chest);

  const head = limb(skin, 0.34, 0.38, 0.34);
  head.position.y = 1.0;
  hips.add(head);

  // eyes: unlit planes so they glow even in pitch darkness
  const eyeMat = new THREE.MeshBasicMaterial({ color: type.eyes });
  const eyeL = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.045), eyeMat);
  eyeL.position.set(-0.08, 1.04, 0.176);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.08;
  hips.add(eyeL, eyeR);

  if (type.demon) {   // horns
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x1a0d0c, roughness: 0.6 });
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.34, 6), hornMat);
      horn.position.set(s * 0.13, 1.24, -0.02);
      horn.rotation.z = s * -0.5;
      horn.rotation.x = -0.35;
      horn.castShadow = true;
      hips.add(horn);
    }
  }

  const armL = limb(skin, 0.16, 0.64, 0.17);
  armL.geometry.translate(0, -0.32, 0);     // pivot at the shoulder
  armL.position.set(-0.38, 0.72, 0);
  const armR = armL.clone(); armR.position.x = 0.38;
  hips.add(armL, armR);

  const legL = limb(cloth, 0.2, 0.78, 0.22);
  legL.geometry.translate(0, -0.39, 0);
  legL.position.set(-0.16, 0, 0);
  const legR = legL.clone(); legR.position.x = 0.16;
  hips.add(legL, legR);

  return { group: g, hips, torso, head, armL, armR, legL, legR, eyes: [eyeL, eyeR] };
}

function quadruped(type) {
  const skin = material('demonHide', { repeat: 2, roughness: 0.7, emissive: 0x2a0600, emissiveIntensity: 0.7 });
  const g = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.62;
  g.add(hips);

  const body = limb(skin, 0.52, 0.46, 1.25);
  hips.add(body);
  const head = limb(skin, 0.34, 0.32, 0.46);
  head.position.set(0, 0.16, 0.78);     // +z is forward, like the humanoids
  hips.add(head);
  const jaw = limb(skin, 0.26, 0.12, 0.34);
  jaw.position.set(0, -0.02, 0.92);
  hips.add(jaw);

  const eyeMat = new THREE.MeshBasicMaterial({ color: type.eyes });
  const eyeL = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.05), eyeMat);
  eyeL.position.set(-0.11, 0.24, 1.012);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.11;
  hips.add(eyeL, eyeR);

  const legs = [];
  for (const [lx, lz] of [[-0.24, -0.45], [0.24, -0.45], [-0.24, 0.45], [0.24, 0.45]]) {
    const l = limb(skin, 0.14, 0.62, 0.15);
    l.geometry.translate(0, -0.31, 0);
    l.position.set(lx, -0.12, lz);
    hips.add(l);
    legs.push(l);
  }
  return { group: g, hips, torso: body, head, armL: legs[0], armR: legs[1], legL: legs[2], legR: legs[3], eyes: [eyeL, eyeR] };
}

/* ------------------------------------------------------------------ enemy */
let nextId = 1;

export class Enemy {
  constructor(kind, pos) {
    const type = TYPES[kind];
    this.id = nextId++;
    this.kind = kind;
    this.type = type;
    this.parts = type.quad ? quadruped(type) : humanoid(type);
    this.obj = this.parts.group;
    this.obj.scale.setScalar(type.scale);
    this.obj.position.copy(pos);
    this.obj.userData.enemy = this;

    this.hp = type.hp;
    this.maxHp = type.hp;
    this.state = 'idle';
    this.vel = new THREE.Vector3();
    this.phase = Math.random() * TAU;
    this.timer = 0;
    this.attackAt = 0;
    this.rangedAt = randRange(0, 2);
    this.facing = Math.random() * TAU;
    this.dead = false;
    this.deathT = 0;
    this.flinch = 0;
    this.stagger = 0;
    this.growlAt = randRange(2, 9);
    this.height = 1.85 * type.scale;
    this.radius = 0.42 * type.scale;
    this.headY = (type.quad ? 0.9 : 1.72) * type.scale;
    this.wanderTarget = null;
    this.lunge = 0;
    this.hitFlash = 0;
  }

  get pos() { return this.obj.position; }

  headPos(out = tmpV1) { return out.copy(this.obj.position).setY(this.obj.position.y + this.headY); }
  bodyPos(out = tmpV1) { return out.copy(this.obj.position).setY(this.obj.position.y + this.height * 0.52); }

  /** Bullet test: a capsule for the body plus a sphere for the head. */
  rayHit(origin, dir, maxDist) {
    const p = this.obj.position;
    // quick reject with a bounding sphere
    tmpV2.copy(p).setY(p.y + this.height * 0.5).sub(origin);
    const along = tmpV2.dot(dir);
    if (along < -1 || along > maxDist + 2) return null;
    const perp2 = tmpV2.lengthSq() - along * along;
    const rr = (this.height * 0.55 + this.radius);
    if (perp2 > rr * rr) return null;

    // head sphere first (bigger reward)
    const hr = 0.24 * this.type.scale;
    tmpV2.copy(p).setY(p.y + this.headY).sub(origin);
    const a = tmpV2.dot(dir);
    if (a > 0) {
      const d2 = tmpV2.lengthSq() - a * a;
      if (d2 < hr * hr) return { dist: a - Math.sqrt(Math.max(0, hr * hr - d2)), head: true, enemy: this };
    }
    // body: vertical capsule, tested as a cylinder in XZ with a Y range
    const ox = origin.x - p.x, oz = origin.z - p.z;
    const dx = dir.x, dz = dir.z;
    const A = dx * dx + dz * dz;
    if (A > 1e-6) {
      const B = 2 * (ox * dx + oz * dz);
      const C = ox * ox + oz * oz - this.radius * this.radius;
      const disc = B * B - 4 * A * C;
      if (disc >= 0) {
        const t = (-B - Math.sqrt(disc)) / (2 * A);
        const tt = t > 0.05 ? t : (-B + Math.sqrt(disc)) / (2 * A);
        if (tt > 0.05 && tt < maxDist) {
          const y = origin.y + dir.y * tt;
          if (y > p.y + 0.1 && y < p.y + this.height) return { dist: tt, head: false, enemy: this };
        }
      }
    }
    return null;
  }

  hurt(amount, dir, head) {
    if (this.dead) return 0;
    const dmg = head ? amount * 2.3 : amount;
    this.hp -= dmg;
    this.hitFlash = 0.12;
    this.flinch = Math.min(0.35, this.flinch + (this.type.heavy ? 0.08 : 0.2));
    if (!this.type.heavy && !this.type.boss) this.stagger = Math.min(0.4, this.stagger + dmg * 0.006);
    if (this.state === 'idle' || this.state === 'wander') this.alert();
    if (dir) this.vel.addScaledVector(dir, this.type.heavy ? 0.35 : 1.4);
    if (this.hp <= 0) { this.kill(head); return dmg; }
    return dmg;
  }

  alert() {
    if (this.state === 'idle' || this.state === 'wander') {
      this.state = 'chase';
      this.timer = 0;
      audio.at(() => (this.type.demon ? audio.sfx.screech() : audio.sfx.growl(1 / this.type.scale)), 12);
    }
  }

  kill(head) {
    this.dead = true;
    this.state = 'dead';
    this.deathT = 0;
    this.headshotKill = !!head;
  }

  /** ctx: { dt, player, world, fx, enemies, time, onAttack, onFire } */
  update(ctx) {
    const { dt, player, world, fx } = ctx;
    const p = this.obj.position;

    if (this.dead) {
      this.deathT += dt;
      const t = Math.min(1, this.deathT / 0.65);
      this.obj.rotation.x = -t * Math.PI * 0.5;
      this.obj.position.y = Math.max(0, this.obj.position.y - dt * 1.2 * t);
      const parts = this.parts;
      parts.armL.rotation.x = damp(parts.armL.rotation.x, -1.2, 6, dt);
      parts.armR.rotation.x = damp(parts.armR.rotation.x, -1.4, 6, dt);
      if (this.deathT > 6) {
        this.obj.position.y -= dt * 0.4;        // sink away once forgotten
        this.obj.traverse(o => { if (o.material && o.material.opacity != null) o.material.opacity -= dt; });
      }
      return;
    }

    const toPlayer = tmpV1.copy(player.pos).sub(p);
    const dist = toPlayer.length();
    // Up close they simply sense you; further out they need to actually see you.
    // Without this, street cars block every sightline and the horde stands still.
    const seeing = dist < this.type.sight &&
      (dist < 20 || world.clearLine(this.headPos(tmpV2), player.eyePos(new THREE.Vector3())));

    this.flinch = Math.max(0, this.flinch - dt * 2.2);
    this.stagger = Math.max(0, this.stagger - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    // ---- think
    if (this.state === 'idle' || this.state === 'wander') {
      if (seeing && dist < this.type.sight) this.alert();
      else if (this.state === 'idle' && Math.random() < dt * 0.25) {
        this.state = 'wander';
        const a = Math.random() * TAU;
        this.wanderTarget = new THREE.Vector3(p.x + Math.cos(a) * randRange(4, 14), p.y, p.z + Math.sin(a) * randRange(4, 14));
      }
    } else if (this.state === 'chase') {
      if (dist < this.type.reach * 0.92) {
        this.state = 'attack';
        this.timer = 0;
        this.didHit = false;
      }
    } else if (this.state === 'attack') {
      this.timer += dt;
      if (!this.didHit && this.timer >= this.type.windup) {
        this.didHit = true;
        if (dist < this.type.reach * 1.35) {
          ctx.onAttack(this, this.type.damage);
          audio.at(() => audio.sfx.hit(), dist);
        }
      }
      if (this.timer > this.type.attackTime) {
        this.state = 'chase';
        this.attackAt = ctx.time + (this.type.heavy ? 0.9 : 0.35);
      }
    }

    // ---- ranged attacks
    const R = this.type.ranged;
    if (R && !this.dead && this.state !== 'idle' && seeing && dist < R.range && ctx.time > this.rangedAt) {
      this.rangedAt = ctx.time + R.cooldown * randRange(0.75, 1.3);
      const volley = R.volley || 1;
      for (let i = 0; i < volley; i++) {
        const spread = volley > 1 ? (i - (volley - 1) / 2) * 0.12 : 0;
        ctx.onFire(this, spread, i * 0.12);
      }
    }

    // ---- move
    let speed = 0;
    if (this.state === 'chase') speed = (dist > 9 ? this.type.run : this.type.speed) * (1 - this.stagger);
    else if (this.state === 'wander' && this.wanderTarget) speed = this.type.speed * 0.45;
    if (this.state === 'attack') speed = this.type.lunges && this.timer < this.type.windup ? this.type.speed * 0.5 : 0;

    const target = this.state === 'wander' && this.wanderTarget ? this.wanderTarget : player.pos;
    const dir = tmpV2.copy(target).sub(p);
    dir.y = 0;
    const flat = dir.length();
    if (flat > 0.001) dir.divideScalar(flat);

    if (this.state === 'wander' && flat < 1.2) { this.state = 'idle'; this.wanderTarget = null; }

    // crowd separation so a horde spreads out instead of stacking
    if (ctx.enemies.length > 1) {
      for (const other of ctx.enemies) {
        if (other === this || other.dead) continue;
        const dx = p.x - other.pos.x, dz = p.z - other.pos.z;
        const d2 = dx * dx + dz * dz;
        const want = (this.radius + other.radius) * 1.15;
        if (d2 < want * want && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          dir.x += (dx / d) * (1 - d / want) * 1.5;
          dir.z += (dz / d) * (1 - d / want) * 1.5;
        }
      }
      const l = Math.hypot(dir.x, dir.z);
      if (l > 0.001) { dir.x /= l; dir.z /= l; }
    }

    if (speed > 0) {
      // wall avoidance: if the way ahead is blocked, pick a way round and stick
      // with it for a moment — re-deciding every frame makes them jitter in
      // place against a parked car
      let moveX = dir.x, moveZ = dir.z;
      this.detourT = Math.max(0, (this.detourT || 0) - dt);
      if (this.detourT > 0 && this.freeAhead(world, p, this.detourX, this.detourZ, 0.9)) {
        moveX = this.detourX; moveZ = this.detourZ;
      } else if (!this.freeAhead(world, p, moveX, moveZ, 1.1)) {
        const a = Math.atan2(moveZ, moveX);
        const side = this.detourSide || (Math.random() < 0.5 ? 1 : -1);
        let found = false;
        for (const off of [0.7, 1.2, 1.6, 2.1, 2.6]) {
          for (const s of [side, -side]) {
            const nx = Math.cos(a + off * s), nz = Math.sin(a + off * s);
            if (this.freeAhead(world, p, nx, nz, 1.1)) {
              moveX = nx; moveZ = nz; found = true;
              this.detourX = nx; this.detourZ = nz;
              this.detourT = 0.7;
              this.detourSide = s;
              break;
            }
          }
          if (found) break;
        }
        if (!found) { moveX = -dir.x * 0.5; moveZ = -dir.z * 0.5; this.detourSide = -side; }
      } else {
        this.detourSide = 0;
      }
      this.vel.x = damp(this.vel.x, moveX * speed, 8, dt);
      this.vel.z = damp(this.vel.z, moveZ * speed, 8, dt);
    } else {
      this.vel.x = damp(this.vel.x, 0, 10, dt);
      this.vel.z = damp(this.vel.z, 0, 10, dt);
    }

    // gravity + ground
    this.vel.y -= 22 * dt;
    p.addScaledVector(this.vel, dt);
    this.resolve(world, p);

    // face the way it moves (or the player when close)
    const wantFacing = (this.state === 'chase' || this.state === 'attack')
      ? Math.atan2(player.pos.x - p.x, player.pos.z - p.z)
      : Math.atan2(this.vel.x, this.vel.z);
    if (Math.abs(this.vel.x) + Math.abs(this.vel.z) > 0.05 || this.state === 'attack' || this.state === 'chase') {
      this.facing += angleDelta(this.facing, wantFacing) * Math.min(1, dt * 7);
    }
    this.obj.rotation.y = this.facing;

    // ---- animate
    this.animate(dt, Math.hypot(this.vel.x, this.vel.z), ctx);

    // ---- ambience
    this.growlAt -= dt;
    if (this.growlAt <= 0) {
      this.growlAt = randRange(4, 13);
      if (dist < 28) audio.at(() => (this.type.demon ? audio.sfx.screech() : audio.sfx.growl(1 / this.type.scale)), dist, 30);
    }
  }

  freeAhead(world, p, dx, dz, dist) {
    const x = p.x + dx * dist, z = p.z + dz * dist;
    const list = world.near(x, z, this.radius + 0.2);
    for (const c of list) {
      if (c.tag === 'ground') continue;
      if (c.max.y < p.y + 0.45) continue;     // low enough to step over
      if (x + this.radius > c.min.x && x - this.radius < c.max.x &&
          z + this.radius > c.min.z && z - this.radius < c.max.z &&
          p.y + this.height > c.min.y && p.y < c.max.y) return false;
    }
    return true;
  }

  resolve(world, p) {
    const list = world.near(p.x, p.z, this.radius + 0.4);
    for (const c of list) {
      if (p.x + this.radius <= c.min.x || p.x - this.radius >= c.max.x) continue;
      if (p.z + this.radius <= c.min.z || p.z - this.radius >= c.max.z) continue;
      if (p.y >= c.max.y - 0.001 || p.y + this.height <= c.min.y) continue;
      // standing on top?
      if (this.vel.y <= 0 && p.y > c.max.y - 0.45) {
        p.y = c.max.y; this.vel.y = 0; this.grounded = true;
        continue;
      }
      // push out along the shallowest axis
      const px = Math.min(c.max.x - (p.x - this.radius), (p.x + this.radius) - c.min.x);
      const pz = Math.min(c.max.z - (p.z - this.radius), (p.z + this.radius) - c.min.z);
      if (px < pz) p.x += (p.x < (c.min.x + c.max.x) / 2 ? -px : px);
      else p.z += (p.z < (c.min.z + c.max.z) / 2 ? -pz : pz);
    }
    if (p.y < 0) { p.y = 0; this.vel.y = 0; }
  }

  animate(dt, speed, ctx) {
    const P = this.parts;
    this.phase += dt * (2.2 + speed * 2.4);
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    const amp = clamp(speed * 0.35, 0.08, 0.95);

    if (this.type.quad) {
      P.armL.rotation.x = s * amp;
      P.armR.rotation.x = -s * amp;
      P.legL.rotation.x = -s * amp;
      P.legR.rotation.x = s * amp;
      P.hips.position.y = 0.62 + Math.abs(s) * 0.05 * amp;
      P.head.rotation.x = -0.1 + s * 0.05;
    } else {
      P.legL.rotation.x = s * amp;
      P.legR.rotation.x = -s * amp;
      // the shambling, arms-out walk
      const reach = this.state === 'chase' || this.state === 'attack' ? -1.25 : -0.5;
      P.armL.rotation.x = damp(P.armL.rotation.x, reach + (-s * amp * 0.5), 6, dt);
      P.armR.rotation.x = damp(P.armR.rotation.x, reach + (s * amp * 0.5), 6, dt);
      P.armL.rotation.z = damp(P.armL.rotation.z, 0.25, 4, dt);
      P.armR.rotation.z = damp(P.armR.rotation.z, -0.25, 4, dt);
      P.hips.position.y = 0.95 * 1 + Math.abs(c) * 0.06 * amp - this.stagger * 0.1;
      P.torso.rotation.z = s * 0.06 * amp;
      P.head.rotation.z = -s * 0.05 * amp;
      P.head.rotation.x = this.state === 'chase' ? -0.12 : 0.08;
    }

    // attack swing
    if (this.state === 'attack') {
      const t = clamp(this.timer / this.type.attackTime, 0, 1);
      const swing = t < 0.4 ? -1.9 - t : -2.2 + (t - 0.4) * 5.2;
      P.armL.rotation.x = swing;
      P.armR.rotation.x = swing - 0.2;
      if (this.type.quad) P.head.rotation.x = -0.6 + t * 1.2;
    }

    // hit flinch and flash
    if (this.flinch > 0) {
      P.torso.rotation.x = -this.flinch * 0.5;
      P.head.rotation.x += this.flinch * 0.3;
    } else P.torso.rotation.x = damp(P.torso.rotation.x, 0, 8, dt);

    const glow = this.hitFlash > 0 ? 1 : 0;
    P.eyes.forEach(e => { e.material.color.setHex(glow ? 0xffffff : this.type.eyes); });

    // demons smoulder
    if (this.type.demon && ctx.fx && Math.random() < dt * 6) {
      ctx.fx.embers(this.bodyPos(new THREE.Vector3()), 1, 0.3 * this.type.scale);
    }
  }
}

/* ---------------------------------------------------------------- manager */
export class Enemies {
  constructor(scene, world, fx) {
    this.scene = scene;
    this.world = world;
    this.fx = fx;
    this.list = [];
    this.projectiles = [];
    this.killCount = 0;
    this.projGeo = new THREE.SphereGeometry(0.16, 10, 8);
  }

  spawn(kind, pos) {
    const e = new Enemy(kind, pos);
    this.scene.add(e.obj);
    this.list.push(e);
    return e;
  }

  get alive() { return this.list.filter(e => !e.dead).length; }

  /** Noise (a shot, an explosion) wakes everything within earshot. */
  alertNear(pos, radius) {
    for (const e of this.list) {
      if (e.dead || e.state === 'chase' || e.state === 'attack') continue;
      if (e.pos.distanceTo(pos) < radius) e.alert();
    }
  }

  /** Closest enemy hit by a ray, or null. */
  raycast(origin, dir, maxDist) {
    let best = null;
    for (const e of this.list) {
      if (e.dead) continue;
      const hit = e.rayHit(origin, dir, maxDist);
      if (hit && hit.dist > 0 && (!best || hit.dist < best.dist)) best = hit;
    }
    return best;
  }

  fireProjectile(from, dir, opts) {
    const mesh = new THREE.Mesh(this.projGeo, new THREE.MeshBasicMaterial({ color: opts.colour || 0xff7a2f }));
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh, dir: dir.clone().normalize(), speed: opts.speed || 16, damage: opts.damage || 14,
      life: 4, colour: opts.colour || 0xff7a2f
    });
    audio.at(() => audio.sfx.fireball(), 10);
  }

  update(ctx) {
    const { dt, player, world, fx } = ctx;
    const shared = {
      dt, player, world, fx, time: ctx.time, enemies: this.list,
      onAttack: ctx.onAttack,
      onFire: (enemy, spread, delay) => {
        const from = enemy.bodyPos(new THREE.Vector3()).setY(enemy.pos.y + enemy.headY * 0.86);
        const dir = player.eyePos(new THREE.Vector3()).sub(from).normalize();
        if (spread) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
        const R = enemy.type.ranged;
        if (delay) setTimeout(() => this.fireProjectile(from, dir, { speed: R.speed, damage: R.damage, colour: enemy.type.eyes }), delay * 1000);
        else this.fireProjectile(from, dir, { speed: R.speed, damage: R.damage, colour: enemy.type.eyes });
      }
    };

    for (const e of this.list) e.update(shared);

    // clean up long-dead bodies
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.dead && e.deathT > 12) {
        this.scene.remove(e.obj);
        this.list.splice(i, 1);
      }
    }

    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      const step = p.speed * dt;
      const hitWorld = world.raycast(p.mesh.position, p.dir, step + 0.2);
      p.mesh.position.addScaledVector(p.dir, step);
      this.fx.embers(p.mesh.position, 1, 0.12);

      const toPlayer = tmpV1.copy(player.pos).setY(player.pos.y + 0.9).sub(p.mesh.position);
      const hitPlayer = toPlayer.length() < 0.7;

      if (hitPlayer || hitWorld || p.life <= 0) {
        this.fx.plasmaBurst(p.mesh.position, [1, 0.45, 0.15]);
        this.fx.light(p.mesh.position, p.colour, 3, 0.2, 14);
        audio.at(() => audio.sfx.hit(), player.pos.distanceTo(p.mesh.position));
        if (hitPlayer) ctx.onPlayerHit(p.damage);
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  clear() {
    for (const e of this.list) this.scene.remove(e.obj);
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.list.length = 0;
    this.projectiles.length = 0;
    this.killCount = 0;
  }
}

/* Demon Fall — the things that hunt you.
 *
 * Every enemy is built from primitives and animated with code (no model files),
 * and thinks with a small state machine: wander → notice → chase → strike.
 * Steering is direct with wall-sliding and crowd separation, which is enough
 * for an open ruined city and costs almost nothing per frame. */
import * as THREE from 'three';
import { bodyFor, prewarm } from './models.js';
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
  },

  /* ---- Mars: the colonists who got out, and brought it with them ----
   * bodyMult < 1 means armour (EVA suits, hard hats): body shots do less, the head does not. */
  colonist: {
    name: 'Infected Colonist', hp: 52, speed: 1.7, run: 2.3, damage: 10, reach: 1.45, attackTime: 1.1, windup: 0.42,
    scale: 1, eyes: 0x9af06a, score: 120, sight: 50, gib: 0x6a1a20,
    outfit: 'jumpsuit', cloth: [0xc0602a, 0x2a6a7a, 0x8a8a90, 0xa8402a], accent: 0xe8e0d0, skin: 0xc8bcb0
  },
  sprinter: {
    name: 'Lab Runner', hp: 34, speed: 4.6, run: 5.9, damage: 9, reach: 1.4, attackTime: 0.75, windup: 0.28,
    scale: 0.94, eyes: 0x9af06a, score: 170, sight: 56, gib: 0x7a1a24, lunges: true,
    outfit: 'labcoat', accent: 0x3a8ac8, skin: 0xd0c4b8
  },
  suit: {
    name: 'Suit Walker', hp: 92, speed: 1.6, run: 2.2, damage: 14, reach: 1.5, attackTime: 1.2, windup: 0.45,
    scale: 1, eyes: 0x9af06a, score: 230, sight: 50, gib: 0x6a1a20, bodyMult: 0.7,
    outfit: 'suit', cloth: [0xb0aca2, 0xa49e92], accent: 0xd8701a, skin: 0xb8b0a8
  },
  crawler: {
    name: 'Crawler', hp: 40, speed: 5.4, run: 6.9, damage: 11, reach: 1.5, attackTime: 0.65, windup: 0.22,
    scale: 0.82, eyes: 0x9af06a, score: 200, sight: 58, gib: 0x6a1a20, quad: true, flesh: true, lunges: true,
    cloth: [0xc0602a, 0x2a6a7a], skin: 0xd8ccc0
  },
  spitter: {
    name: 'Spitter', hp: 58, speed: 2.2, run: 2.9, damage: 10, reach: 1.4, attackTime: 1.0, windup: 0.4,
    scale: 0.96, eyes: 0xb4ff3a, score: 250, sight: 58, gib: 0x5a2a10,
    outfit: 'labcoat', accent: 0x4ac86a, skin: 0xa8b490,
    ranged: { range: 30, cooldown: 2.9, speed: 14, damage: 12 }
  },
  hulk: {
    name: 'Mine Hulk', hp: 300, speed: 1.9, run: 2.7, damage: 24, reach: 2.2, attackTime: 1.6, windup: 0.75,
    scale: 1.8, eyes: 0x9af06a, score: 520, sight: 48, gib: 0x6d1420, heavy: true, bodyMult: 0.85,
    outfit: 'miner', cloth: [0xd86a1a, 0xc85a14], accent: 0xd8e04a, skin: 0xb0a090
  },
  overseer: {
    name: 'Colony Overseer', hp: 2000, speed: 2.2, run: 3.1, damage: 30, reach: 3.0, attackTime: 1.6, windup: 0.7,
    scale: 2.9, eyes: 0xb4ff3a, score: 4000, sight: 90, gib: 0x5a1a10, boss: true,
    outfit: 'suit', cloth: [0xa8a294], accent: 0xc8102e, skin: 0x9aa088,
    ranged: { range: 36, cooldown: 2.6, speed: 16, damage: 13, volley: 3 }
  },

  /* ---- the Moon: base crews, a long way from help ---- */
  crew: {
    name: 'Infected Crew', hp: 60, speed: 1.8, run: 2.5, damage: 12, reach: 1.45, attackTime: 1.05, windup: 0.4,
    scale: 1, eyes: 0x7ae8ff, score: 150, sight: 52, gib: 0x6a1a20,
    outfit: 'jumpsuit', cloth: [0x3a4a6a, 0x5a5e68, 0x2a3a4a, 0x6a4a7a], accent: 0x4ac8ff, skin: 0xbcc0c8
  },
  leaper: {
    name: 'Leaper', hp: 50, speed: 3.2, run: 4.2, damage: 11, reach: 1.5, attackTime: 0.8, windup: 0.3,
    scale: 0.95, eyes: 0x7ae8ff, score: 240, sight: 60, gib: 0x6a1a20, leaps: true, lunges: true,
    outfit: 'labcoat', accent: 0x4ac8ff, skin: 0xc4c8d0
  },
  voidSuit: {
    name: 'Void Suit', hp: 120, speed: 1.7, run: 2.4, damage: 16, reach: 1.5, attackTime: 1.15, windup: 0.42,
    scale: 1.02, eyes: 0x7ae8ff, score: 280, sight: 52, gib: 0x6a1a20, bodyMult: 0.65,
    outfit: 'suit', cloth: [0xb4b4b0, 0xa4a8b0], accent: 0x2a6ac8, skin: 0xb0b4c0, visor: 0xffd27a
  },
  lunarCrawler: {
    name: 'Crawler', hp: 48, speed: 5.8, run: 7.4, damage: 13, reach: 1.5, attackTime: 0.62, windup: 0.2,
    scale: 0.84, eyes: 0x7ae8ff, score: 230, sight: 60, gib: 0x6a1a20, quad: true, flesh: true, lunges: true,
    cloth: [0x3a4a6a, 0x5a5e68], skin: 0xc8ccd4
  },
  lunarSpitter: {
    name: 'Spitter', hp: 66, speed: 2.3, run: 3.0, damage: 12, reach: 1.4, attackTime: 1.0, windup: 0.4,
    scale: 0.96, eyes: 0x5af0ff, score: 280, sight: 60, gib: 0x2a4a5a,
    outfit: 'jumpsuit', cloth: [0x5a5e68, 0x3a4a6a], accent: 0x5af0ff, skin: 0x98a8b4,
    ranged: { range: 32, cooldown: 2.8, speed: 15, damage: 13 }
  },
  titan: {
    name: 'Regolith Titan', hp: 340, speed: 1.9, run: 2.7, damage: 24, reach: 2.3, attackTime: 1.5, windup: 0.7,
    scale: 1.9, eyes: 0x7ae8ff, score: 650, sight: 50, gib: 0x6d1420, heavy: true, bodyMult: 0.8,
    outfit: 'miner', cloth: [0x4a5a7a, 0x5a5e68], accent: 0xd8e04a, skin: 0xa8acb4
  },
  matriarch: {
    name: 'The Matriarch', hp: 2700, speed: 2.4, run: 3.4, damage: 40, reach: 3.3, attackTime: 1.5, windup: 0.65,
    scale: 3.4, eyes: 0x7ae8ff, score: 8000, sight: 100, gib: 0x3a1a4a, boss: true, leaps: true,
    outfit: 'labcoat', accent: 0x5af0ff, skin: 0x8a90a0,
    ranged: { range: 40, cooldown: 2.3, speed: 17, damage: 14, volley: 4 }
  },

  /* ---- Venus: the cloud cities and the heat-shielded domes. The acid got into them.
   * `mutation` adds the planet's growths to the body (models.js). */
  scorched: {
    name: 'Scorched Colonist', hp: 70, speed: 1.9, run: 2.6, damage: 13, reach: 1.45, attackTime: 1.05, windup: 0.4,
    scale: 1, eyes: 0xe8ff3a, score: 170, sight: 50, gib: 0x6a3a10, mutation: 'acid',
    outfit: 'jumpsuit', cloth: [0xc89a2a, 0x8a6a3a, 0xb8782a, 0x6a5a40], accent: 0xffd23a, skin: 0xc8b890
  },
  acidCrawler: {
    name: 'Acid Crawler', hp: 54, speed: 5.9, run: 7.3, damage: 13, reach: 1.5, attackTime: 0.62, windup: 0.22,
    scale: 0.86, eyes: 0xe8ff3a, score: 240, sight: 58, gib: 0x6a5a10, quad: true, flesh: true, lunges: true, mutation: 'acid',
    cloth: [0xc89a2a, 0x8a6a3a], skin: 0xd8c890
  },
  acidSpitter: {
    name: 'Acid Spitter', hp: 72, speed: 2.3, run: 3.0, damage: 12, reach: 1.4, attackTime: 1.0, windup: 0.4,
    scale: 0.98, eyes: 0xc8ff2a, score: 290, sight: 60, gib: 0x5a6a10, mutation: 'acid',
    outfit: 'labcoat', accent: 0xc8ff2a, skin: 0xb8b878,
    ranged: { range: 32, cooldown: 2.7, speed: 15, damage: 14 }
  },
  heatSuit: {
    name: 'Heat Suit', hp: 130, speed: 1.75, run: 2.4, damage: 17, reach: 1.5, attackTime: 1.15, windup: 0.42,
    scale: 1.04, eyes: 0xe8ff3a, score: 300, sight: 52, gib: 0x6a3a10, bodyMult: 0.65, mutation: 'acid',
    outfit: 'suit', cloth: [0xd8c8a0, 0xc8b890], accent: 0xd8a020, skin: 0xb8b090, visor: 0xffb020, ownVisor: true
  },
  tyrant: {
    name: 'The Sulfur Tyrant', hp: 2400, speed: 2.2, run: 3.1, damage: 38, reach: 3.2, attackTime: 1.55, windup: 0.7,
    scale: 3.3, eyes: 0xe8ff3a, score: 9000, sight: 100, gib: 0x6a5a10, boss: true, mutation: 'acid',
    outfit: 'suit', cloth: [0xc8a860], accent: 0xffd23a, skin: 0xa8a070, visor: 0xffb020, ownVisor: true,
    ranged: { range: 40, cooldown: 2.4, speed: 16, damage: 14, volley: 5 }
  },

  /* ---- Jupiter: the cloud-skimmer refinery. The storms got into these ones:
   * `discharge` winds up (a ring on the floor shows its reach) and then arcs. */
  rigger: {
    name: 'Charged Rigger', hp: 84, speed: 1.9, run: 2.6, damage: 15, reach: 1.5, attackTime: 1.1, windup: 0.42,
    scale: 1.02, eyes: 0x8ae0ff, score: 210, sight: 52, gib: 0x5a2a3a, mutation: 'storm',
    outfit: 'miner', cloth: [0xd88a2a, 0x8a5a2a, 0x5a6a7a], accent: 0x8ae0ff, skin: 0xb8a898
  },
  stormLeaper: {
    name: 'Storm Leaper', hp: 64, speed: 3.3, run: 4.3, damage: 12, reach: 1.5, attackTime: 0.8, windup: 0.3,
    scale: 0.96, eyes: 0x9ae8ff, score: 300, sight: 60, gib: 0x5a2a3a, leaps: true, lunges: true, mutation: 'storm',
    outfit: 'jumpsuit', cloth: [0x8a5a2a, 0x6a4a3a, 0xa86a2a], accent: 0x8ae0ff, skin: 0xc0b0a8,
    discharge: { radius: 4.2, damage: 15, windup: 0.8, cooldown: 5.5, colour: 0x8ae0ff }
  },
  arcCaster: {
    name: 'Arc Caster', hp: 78, speed: 2.2, run: 2.9, damage: 12, reach: 1.4, attackTime: 1.0, windup: 0.4,
    scale: 0.98, eyes: 0x6ad8ff, score: 300, sight: 62, gib: 0x5a2a3a, mutation: 'storm',
    outfit: 'labcoat', accent: 0x6ad8ff, skin: 0xb0a8a8,
    ranged: { range: 34, cooldown: 2.5, speed: 22, damage: 13 }
  },
  stormHulk: {
    name: 'Ballast Hulk', hp: 380, speed: 1.85, run: 2.6, damage: 26, reach: 2.3, attackTime: 1.55, windup: 0.72,
    scale: 1.9, eyes: 0x8ae0ff, score: 700, sight: 50, gib: 0x6d1420, heavy: true, bodyMult: 0.8, mutation: 'storm',
    outfit: 'miner', cloth: [0xd88a2a, 0x6a4a3a], accent: 0x8ae0ff, skin: 0xa89888,
    discharge: { radius: 5, damage: 18, windup: 1.0, cooldown: 7, colour: 0x8ae0ff }
  },
  tempest: {
    name: 'The Tempest', hp: 2600, speed: 2.3, run: 3.3, damage: 38, reach: 3.3, attackTime: 1.5, windup: 0.65,
    scale: 3.4, eyes: 0x9ae8ff, score: 10000, sight: 110, gib: 0x3a2a5a, boss: true, leaps: true, mutation: 'storm',
    outfit: 'miner', cloth: [0x8a5a2a], accent: 0x8ae0ff, skin: 0x9a9098,
    ranged: { range: 40, cooldown: 2.6, speed: 22, damage: 14, volley: 3 },
    discharge: { radius: 7, damage: 26, windup: 1.0, cooldown: 6.5, colour: 0x9ae8ff }
  },

  /* ---- Neptune: the deep stations, frozen over. Slow heavy brutes, fast pale wraiths. */
  frozenCrew: {
    name: 'Frozen Researcher', hp: 80, speed: 1.85, run: 2.6, damage: 15, reach: 1.45, attackTime: 1.05, windup: 0.4,
    scale: 1, eyes: 0xbff8ff, score: 200, sight: 52, gib: 0x3a3a6a, mutation: 'ice',
    outfit: 'labcoat', accent: 0x5ab8ff, skin: 0xb0c4d8
  },
  iceWraith: {
    name: 'Ice Wraith', hp: 72, speed: 4.9, run: 6.2, damage: 13, reach: 1.5, attackTime: 0.72, windup: 0.26,
    scale: 1.06, eyes: 0xdffcff, score: 330, sight: 64, gib: 0x2a4a6a, lunges: true, mutation: 'ice',
    outfit: 'jumpsuit', cloth: [0x2a3a5a, 0x3a4a6a], accent: 0xbff8ff, skin: 0xd8eaf8,
    ranged: { range: 26, cooldown: 3.4, speed: 20, damage: 12 }
  },
  frostCrawler: {
    name: 'Frost Crawler', hp: 60, speed: 6.0, run: 7.6, damage: 14, reach: 1.5, attackTime: 0.6, windup: 0.2,
    scale: 0.86, eyes: 0xbff8ff, score: 260, sight: 60, gib: 0x2a3a6a, quad: true, flesh: true, lunges: true, mutation: 'ice',
    cloth: [0x2a3a5a, 0x3a4a6a], skin: 0xc8d8e8
  },
  frostBrute: {
    name: 'Frozen Brute', hp: 440, speed: 1.7, run: 2.45, damage: 28, reach: 2.3, attackTime: 1.6, windup: 0.75,
    scale: 1.95, eyes: 0xbff8ff, score: 800, sight: 50, gib: 0x2a3a6a, heavy: true, bodyMult: 0.7, mutation: 'ice',
    outfit: 'suit', cloth: [0x8a9ab0, 0x9aa8b8], accent: 0x3a8ae8, skin: 0x9ab0c8, visor: 0x8ad8ff, ownVisor: true
  },
  progenitor: {
    name: 'The Progenitor', hp: 3000, speed: 2.4, run: 3.4, damage: 42, reach: 3.5, attackTime: 1.5, windup: 0.65,
    scale: 3.8, eyes: 0xdffcff, score: 15000, sight: 120, gib: 0x2a1a4a, boss: true, leaps: true, mutation: 'ice', demon: true,
    ranged: { range: 44, cooldown: 2.4, speed: 19, damage: 15, volley: 5 },
    discharge: { radius: 7.5, damage: 28, windup: 1.1, cooldown: 7, colour: 0xbff8ff }
  }
};

/** A copy of a type with the level's difficulty applied (cached per level). */
function scaledType(base, mods) {
  if (!mods) return base;
  const t = { ...base };
  t.hp = Math.round(base.hp * (mods.hp || 1));
  t.speed = base.speed * (mods.speed || 1);
  t.run = base.run * (mods.speed || 1);
  t.damage = Math.round(base.damage * (mods.damage || 1));
  if (base.ranged) t.ranged = { ...base.ranged, damage: Math.round(base.ranged.damage * (mods.damage || 1)), cooldown: base.ranged.cooldown / (mods.fire || 1) };
  if (base.discharge) t.discharge = { ...base.discharge, damage: Math.round(base.discharge.damage * (mods.damage || 1)) };
  return t;
}

/* ------------------------------------------------------------------ enemy */
let nextId = 1;
// the floor ring a charging body shows: unit radius, scaled to its reach
const RING_GEO = new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2);

export class Enemy {
  constructor(kind, pos, type = TYPES[kind]) {
    this.id = nextId++;
    this.kind = kind;
    this.type = type;
    this.parts = bodyFor(kind, type);
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

  /** Bodies share their geometry with a template; only the eye materials are this one's own. */
  dispose() {
    if (this.parts.eyes[0]) this.parts.eyes[0].material.dispose();
    if (this.parts.halo) this.parts.halo.material.dispose();
    if (this.ring) this.ring.material.dispose();
  }

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
    const dmg = head ? amount * 2.3 : amount * (this.type.bodyMult || 1);
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
    if (this.parts.halo) this.parts.halo.visible = false;   // the light goes out of its eyes
    if (this.ring) this.ring.visible = false;
    this.charge = 0;
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

    // ---- storm-charged bodies wind up, show their reach on the floor, then arc
    if (this.type.discharge) this.updateDischarge(ctx, this.type.discharge, dist);

    // ---- leapers bound at you; in low gravity they hang in the air
    this.leaping = Math.max(0, (this.leaping || 0) - dt);
    if (this.type.leaps && this.state === 'chase' && seeing && dist > 4 && dist < 15 &&
        ctx.time > (this.leapAt || 0) && Math.abs(this.vel.y) < 0.01 && this.stagger < 0.1) {
      this.leapAt = ctx.time + randRange(3.5, 5.5);
      const g = ctx.gravity || 22, flight = clamp(dist / 9, 0.6, 1.3);
      this.vel.y = g * flight * 0.5;
      // land a couple of metres short: you get a beat to react
      this.vel.x = (toPlayer.x / dist) * (dist - 2.6) / flight;
      this.vel.z = (toPlayer.z / dist) * (dist - 2.6) / flight;
      this.leaping = flight;
      audio.at(() => audio.sfx.screech(), dist);
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

    if (this.leaping > 0) {
      // committed to the jump: no steering until it lands
    } else if (speed > 0) {
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
    this.vel.y -= (ctx.gravity || 22) * dt;
    p.addScaledVector(this.vel, dt);
    this.resolve(world, p);
    if (this.leaping > 0 && this.vel.y === 0) this.leaping = 0;

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

  updateDischarge(ctx, Z, dist) {
    const fx = ctx.fx;
    if (this.charge > 0) {
      this.charge -= ctx.dt;
      const k = 1 - this.charge / Z.windup;
      if (this.ring) {
        this.ring.visible = true;
        this.ring.scale.setScalar((Z.radius / this.type.scale) * (0.35 + 0.65 * k));
        this.ring.material.opacity = 0.35 + 0.5 * k * (0.6 + 0.4 * Math.sin(this.charge * 40));
      }
      if (fx && Math.random() < ctx.dt * 30) fx.sparks(this.bodyPos(new THREE.Vector3()), new THREE.Vector3(0, 1, 0), 2, [0.55, 0.85, 1]);
      if (this.charge <= 0) {
        this.charge = 0;
        this.dischargeAt = ctx.time + Z.cooldown * randRange(0.8, 1.2);
        if (this.ring) this.ring.visible = false;
        const c = this.bodyPos(new THREE.Vector3());
        if (fx) {
          fx.light(c, Z.colour || 0x8ae0ff, 9, 0.3, Z.radius * 3.5);
          fx.sparks(c, new THREE.Vector3(0, 1, 0), 28, [0.6, 0.9, 1]);
          fx.plasmaBurst(c, [0.5, 0.85, 1]);
        }
        audio.at(() => audio.sfx.zap(), dist, 60);
        if (dist < Z.radius && ctx.onDischarge) ctx.onDischarge(this, Z.damage);
      }
    } else if ((this.state === 'chase' || this.state === 'attack') && dist < Z.radius * 0.8 &&
               ctx.time > (this.dischargeAt || 0) && !(this.leaping > 0)) {
      this.charge = Z.windup;
      if (!this.ring) {
        this.ring = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({
          color: Z.colour || 0x8ae0ff, transparent: true, opacity: 0.4, depthWrite: false,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide
        }));
        this.ring.position.y = 0.06 / this.type.scale;
        this.ring.renderOrder = 3;
        this.obj.add(this.ring);
      }
      audio.at(() => audio.sfx.charge(), dist, 40);
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
      P.hips.position.y = 0.64 + Math.abs(s) * 0.05 * amp;
      P.head.rotation.x = -0.1 + s * 0.05;
      // lower legs trail the upper ones
      P.elbowL.rotation.x = Math.max(0, -s) * amp * 0.9;
      P.elbowR.rotation.x = Math.max(0, s) * amp * 0.9;
      P.kneeL.rotation.x = -Math.max(0, s) * amp * 0.9;
      P.kneeR.rotation.x = -Math.max(0, -s) * amp * 0.9;
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
      // knees bend as each leg swings through; elbows stay crooked, reaching
      P.kneeL.rotation.x = 0.08 + Math.max(0, s) * amp * 1.1;
      P.kneeR.rotation.x = 0.08 + Math.max(0, -s) * amp * 1.1;
      const crook = this.state === 'chase' || this.state === 'attack' ? -0.55 : -0.25;
      P.elbowL.rotation.x = damp(P.elbowL.rotation.x, crook + c * 0.1, 6, dt);
      P.elbowR.rotation.x = damp(P.elbowR.rotation.x, crook - c * 0.1, 6, dt);
    }
    // the jaw works constantly, and gapes on the swing
    this.jawT = (this.jawT || Math.random() * 10) + dt;
    const gape = this.state === 'attack' ? 0.55 : 0.12 + Math.max(0, Math.sin(this.jawT * 5)) * 0.18;
    P.jaw.rotation.x = damp(P.jaw.rotation.x, gape, 14, dt);

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

    const glow = this.hitFlash > 0 || (this.charge > 0 && Math.sin(this.charge * 50) > 0) ? 1 : 0;
    P.eyes.forEach(e => { e.material.color.setHex(glow ? 0xffffff : this.type.eyes); });

    // breathing, and a head that hunts for the player (idle ones look about)
    this.breathT = (this.breathT || Math.random() * 10) + dt;
    const breath = Math.sin(this.breathT * (this.state === 'chase' ? 4.2 : 1.8));
    if (!this.type.quad) P.torso.scale.set(1 + breath * 0.012, 1, 1 + breath * 0.02);
    if (ctx.player) {
      const pp = ctx.player.pos, me = this.obj.position;
      const alert = this.state === 'chase' || this.state === 'attack';
      const look = alert ? clamp(angleDelta(this.facing, Math.atan2(pp.x - me.x, pp.z - me.z)), -0.7, 0.7)
        : Math.sin(this.breathT * 0.45) * 0.5;
      P.head.rotation.y = damp(P.head.rotation.y, look, alert ? 8 : 2, dt);
    }
    if (P.halo) {
      P.halo.material.opacity = glow ? 1 : 0.4 + 0.18 * (breath * 0.5 + 0.5) + (this.state === 'attack' ? 0.25 : 0);
      P.halo.material.color.setHex(glow ? 0xffffff : this.type.eyes);
    }

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

  /** Build the body templates for every kind a level uses, so the first wave doesn't stutter. */
  prewarm(kinds) { prewarm(kinds, TYPES); }

  /** Level difficulty: { hp, speed, damage, fire } multipliers applied to every spawn. */
  setMods(mods) { this.mods = mods || null; this.typeCache = new Map(); }

  spawn(kind, pos) {
    let type = TYPES[kind];
    if (this.mods) {
      if (!this.typeCache.has(kind)) this.typeCache.set(kind, scaledType(type, this.mods));
      type = this.typeCache.get(kind);
    }
    const e = new Enemy(kind, pos, type);
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
      dt, player, world, fx, time: ctx.time, enemies: this.list, gravity: ctx.gravity,
      onAttack: ctx.onAttack,
      onDischarge: (enemy, damage) => ctx.onPlayerHit(damage, enemy.pos.clone()),
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
        e.dispose();
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
      let hitPlayer = toPlayer.length() < 0.7;
      if (this.mods) {
        // Mars and Moon: test the whole body (a shot aimed at your eyes used to pass just over the chest point).
        // Earth keeps its original check so its difficulty is untouched.
        const m = p.mesh.position, dy = m.y - player.pos.y;
        hitPlayer = dy > 0.1 && dy < 1.85 && Math.hypot(m.x - player.pos.x, m.z - player.pos.z) < 0.55;
      }

      if (hitPlayer || hitWorld || p.life <= 0) {
        this.fx.plasmaBurst(p.mesh.position, [1, 0.45, 0.15]);
        this.fx.light(p.mesh.position, p.colour, 3, 0.2, 14);
        audio.at(() => audio.sfx.hit(), player.pos.distanceTo(p.mesh.position));
        if (hitPlayer) ctx.onPlayerHit(p.damage, p.mesh.position.clone());
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  clear() {
    for (const e of this.list) { this.scene.remove(e.obj); e.dispose(); }
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.list.length = 0;
    this.projectiles.length = 0;
    this.killCount = 0;
  }
}

/* Demon Fall — the Moon campaign, stages 13 to 18.
 *
 * The bases on the Moon were the last clean place. They are not clean now.
 * Grey dust, a black sky with every star in it, Earth hanging over the horizon,
 * and crews in blue overalls who move far too fast in one-sixth gravity.
 *
 * These are the hardest stages in the game: tougher bodies, more of them at
 * once, fewer crates, and the finale ends the war. */
import * as THREE from 'three';
import { ground, roomWalls, barrel } from './world.js';
import { crates, scorch, bloodPool, trash } from './props.js';
import { zone, terminal } from './levels-a.js';
import {
  sp, horde, spaceDiff, waves, rock, scree, cliff, highlands, lunarCrater, module, solarArray, mast, rover,
  container, landingPad, rocket, lightStrip, pipes, drillRig, screen, skyBody, hullChunk
} from './space-kit.js';
import { material } from './textures.js';
import { TAU } from './util.js';

const LUNAR = {
  skyTop: 0x000003, skyHorizon: 0x04050a, skyGround: 0x020203, skyGlow: 0x0c1222,
  glowDir: [0.6, 0.15, 0.5], stars: 1.2, rift: 0, clouds: 0,
  fog: 0x05060a, fogDensity: 0.0042, fogMix: 0,
  hemi: [0x7a8098, 0x141418, 0.32], ambient: 1.0,      // no air to scatter light: hard sun, black shadows
  sun: { colour: 0xfff6ec, intensity: 1.3, pos: [70, 34, 40] },
  space: 'moon', gravity: 9, jump: 6.8,
  particles: { count: 140, colour: 0xc8c8d0, embers: 0, size: 0.03 }
};
const INSIDE = {
  skyTop: 0x040508, skyHorizon: 0x080a10, skyGround: 0x040508, skyGlow: 0x000000, stars: 0, rift: 0, clouds: 0,
  fog: 0x080a0e, fogDensity: 0.034, fogMix: 0.2,
  hemi: [0x34404e, 0x08080a, 0.42],
  sun: { colour: 0x5a6a7a, intensity: 0.15, pos: [0, 40, 0] },
  dark: true, space: 'moon', gravity: 9, jump: 6.8,
  particles: { count: 300, colour: 0x9aa0aa, embers: 0, size: 0.04 }
};

const moonDiff = n => { const d = spaceDiff(n); return { hp: d.hp, speed: d.speed, damage: d.damage, fire: d.fire, drop: d.drop }; };
const earth = world => skyBody(world, 'earth', [-0.45, 0.32, -1], 600, 46);

function scatterBoulders(world, rng, n, x0, x1, z0, z1, keepOut = 8) {
  for (let i = 0; i < n; i++) {
    const x = rng.range(x0, x1), z = rng.range(z0, z1);
    if (Math.abs(x) < keepOut) continue;
    rock(world, x, z, rng.chance(0.25) ? rng.range(1.3, 2.8) : rng.range(0.4, 1), rng, 'regolith');
    if (rng.chance(0.35)) scree(world, x, z, rng.int(3, 6), 2.5, rng, 'regolith');
  }
}
function scatterCraters(world, rng, n, x0, x1, z0, z1, keepOut = 0) {
  for (let i = 0; i < n; i++) {
    const x = rng.range(x0, x1), z = rng.range(z0, z1);
    if (Math.abs(x) < keepOut) continue;
    lunarCrater(world, x, z, rng.range(3, 12), rng);
  }
}

/** Interior wall along z (constant x) with gaps. */
function wallZ(world, x, zTop, zBot, gaps, h, gapW = 3.2) {
  const cuts = gaps.map(z => [z - gapW / 2, z + gapW / 2]).sort((a, b) => b[0] - a[0]);
  let top = zTop;
  for (const [lo, hi] of cuts) {
    if (top - hi > 0.1) world.box(x, h / 2, (top + hi) / 2, 0.4, h, top - hi, 'panel', { uv: 0.4, mat: { color: 0xbcc0ca } });
    world.box(x, h - 0.4, (lo + hi) / 2, 0.4, 0.8, hi - lo, 'panel', { uv: 0.4, mat: { color: 0xbcc0ca } });
    top = lo;
  }
  if (top - zBot > 0.1) world.box(x, h / 2, (top + zBot) / 2, 0.4, h, top - zBot, 'panel', { uv: 0.4, mat: { color: 0xbcc0ca } });
}
/** A corridor along x between x0 and x1, centred on z, 7 m wide, with a ceiling and lights. */
function corridorX(world, x0, x1, z, h, rng) {
  const cx = (x0 + x1) / 2, len = Math.abs(x1 - x0);
  for (const s of [-1, 1]) world.box(cx, h / 2, z + s * 3.5, len, h, 0.4, 'panel', { uv: 0.4, mat: { color: 0xbcc0ca } });
  world.box(cx, h + 0.2, z, len, 0.4, 7.4, 'panel', { uv: 0.3, mat: { color: 0x8a909a } });
  world.box(cx, 0.02, z, len, 0.04, 7, 'grate', { uv: 0.5, collide: false, mat: { color: 0x9aa0aa } });
  for (let x = Math.min(x0, x1) + 4; x < Math.max(x0, x1); x += 9) {
    const dead = rng.chance(0.3);
    world.box(x, h - 0.04, z, 3, 0.06, 0.4, 'plaster', { uv: 1, collide: false, mat: dead ? { color: 0x2a2a2e } : { color: 0xcfe8ff, emissive: 0xcfe8ff, emissiveIntensity: 1.4 } });
    world.light(dead ? 0x3ac8ff : 0xcfe8ff, dead ? 1.4 : 3, x, h - 0.5, z, 10);
  }
  pipes(world, x0, h - 0.5, z - 3.1, x1, z - 3.1, rng, 0x4a6a8a, 2);
}

/* ================================================================ 13 */
export const MOON_1 = {
  id: 13, world: 'moon',
  name: 'Sea of Silence',
  subtitle: 'Mare Tranquillitatis, lunar day',
  brief: 'Earth hangs over the horizon. The outpost crews are infected, and up here they can jump. Cross the mare and get inside Artemis.',
  diff: moonDiff(7),
  theme: { ...LUNAR, music: 40 },
  build(world, rng) {
    const d = spaceDiff(7);
    ground(world, 460, 'regolith', { uv: 0.2, bumpy: 0.6, seg: 70, mat: { color: 0x8a8a90 } });

    landingPad(world, -16, 116, 9, 0x6ae0ff);
    rocket(world, -16, 116, 0.75, 0x2a6ac8);
    scorch(world, -16, 116, 20);
    // footprints and wheel tracks pressed into the dust
    for (let z = 104; z > -110; z -= 1.4) {
      world.box(-2.2, 0.015, z, 0.4, 0.02, 0.9, 'regolith', { uv: 1, collide: false, mat: { color: 0x6a6a70 } });
      world.box(2.2, 0.015, z + 0.7, 0.4, 0.02, 0.9, 'regolith', { uv: 1, collide: false, mat: { color: 0x6a6a70 } });
    }
    for (let z = 100; z > -100; z -= 40) for (const s of [-1, 1]) world.light(0xbfe0ff, 5, s * 7, 3, z, 16);
    for (let z = 100; z > -110; z -= 14) for (const s of [-1, 1]) {
      world.box(s * 7, 0.7, z, 0.18, 1.4, 0.18, 'rust', { uv: 1, collide: false, mat: { color: 0xe8e8ec } });
      world.box(s * 7, 1.45, z, 0.22, 0.12, 0.22, 'plaster', { uv: 1, collide: false, mat: { color: 0x6ae0ff, emissive: 0x3ac8ff, emissiveIntensity: 2 } });
    }

    scatterCraters(world, rng, 26, -100, 100, 110, -200, 12);
    lunarCrater(world, 30, 40, 16, rng, { boulders: 1.2 });
    lunarCrater(world, -36, -40, 20, rng, { boulders: 1.2 });
    scatterBoulders(world, rng, 70, -100, 100, 120, -200, 9);
    rover(world, 10, 74, 0.6, rng);
    rover(world, -12, 20, 2.4, rng, 0xd8d8dc);
    rover(world, 18, -64, -0.8, rng);
    container(world, 22, 88, 0.2, 0x2a5ac8, rng, 2);
    container(world, -24, 64, -0.4, 0x8a8e96, rng);
    for (let i = 0; i < 4; i++) solarArray(world, -52, 50 - i * 10, 0, 6, rng, 0.9);
    for (let i = 0; i < 4; i++) solarArray(world, 52, 0 - i * 10, 0, 6, rng, 0.9);

    // the two beacon relays
    mast(world, -40, -22, 18, rng);
    module(world, -46, -14, 8, 1.6, Math.PI / 2, rng, { label: 'RELAY W' });
    terminal(world, -37, 0, -18, Math.PI / 2, 'RELAY WEST');
    mast(world, 42, -32, 18, rng);
    module(world, 48, -24, 8, 1.6, Math.PI / 2, rng, { label: 'RELAY E' });
    terminal(world, 39, 0, -28, -Math.PI / 2, 'RELAY EAST');

    // Artemis Outpost: modules round a hub with the airlock facing you
    module(world, 0, -140, 16, 3.2, 0, rng, { label: 'ARTEMIS', labelColour: '#6ae0ff' });
    module(world, -24, -150, 14, 2.6, Math.PI / 2, rng, { label: 'HAB 2' });
    module(world, 24, -150, 14, 2.6, Math.PI / 2, rng, { label: 'LAB' });
    module(world, 0, -170, 20, 2.6, 0, rng, { label: 'STORES' });
    module(world, -40, -120, 10, 2, 0.5, rng, {});
    module(world, 42, -118, 10, 2, -0.5, rng, {});
    world.box(0, 1.6, -135.2, 4, 3.2, 3.4, 'panel', { uv: 0.6, mat: { color: 0xd8d8dc } });   // airlock porch
    world.box(0, 1.4, -133.4, 1.6, 2.4, 0.06, 'rust', { uv: 1, collide: false, mat: { color: 0x2a3a4a, metalness: 0.6 } });
    world.light(0x6ae0ff, 4, 0, 3, -132, 12);
    for (let i = 0; i < 6; i++) bloodPool(world, rng.range(-10, 10), rng.range(-130, -70), rng.range(1, 2.4), i + 700);

    cliff(world, -100, 130, -100, -210, 14, rng, 'regolith', { out: [-1, 0], tint: 0xb8b8bc });
    cliff(world, 100, 130, 100, -210, 14, rng, 'regolith', { out: [1, 0], tint: 0xb8b8bc });
    highlands(world, 250, 20, rng);
    const home = earth(world);

    world.playerStart.set(0, 0, 104);
    world.playerFacing = 0;

    return {
      follow: [home],
      stages: [
        {
          text: 'Cross the mare toward Artemis Outpost', kind: 'reach', zone: zone(0, 4, 30, 10, 0, 8),
          onEnterText: 'Low gravity. They can jump. Watch the sky.',
          spawns: [...horde(rng, 15, ['crew', 'crew', 'crew', 'leaper'], -26, 26, 90, 10), sp('leaper', -10, 30), sp('leaper', 10, 24)]
        },
        {
          text: 'Restart the beacon relays', kind: 'interact', count: 2,
          spawns: [...horde(rng, 7, ['crew', 'leaper'], -54, -28, -6, -40), ...horde(rng, 7, ['crew', 'leaper'], 28, 56, -14, -46)]
        },
        {
          text: 'Hold out while the outpost door unseals', kind: 'defend', duration: 45,
          ...waves(d, { waveKinds: ['crew', 'crew', 'leaper'] }),
          wavePoints: [[-60, 0, -10], [60, 0, -20], [-40, 0, -100], [40, 0, -100], [0, 0, 40]],
          onEnterText: 'AIRLOCK UNSEALING — 45 SECONDS'
        },
        {
          text: 'Into the Artemis airlock', kind: 'reach', zone: zone(0, -131, 6, 4, 0, 6),
          spawns: [...horde(rng, 12, ['crew', 'crew', 'leaper'], -30, 30, -60, -122), sp('leaper', -6, -126), sp('leaper', 6, -126)]
        }
      ],
      pickups: [
        ['ammo', 3, 0, 88], ['health', -4, 0, 56], ['ammo', 4, 0, 24], ['armour', -30, 0, -14],
        ['ammo', 30, 0, -24], ['health', 0, 0, -30], ['ammo', -8, 0, -80], ['health', 8, 0, -106], ['ammo', 0, 0, -120]
      ]
    };
  }
};

/* ================================================================ 14 */
export const MOON_2 = {
  id: 14, world: 'moon',
  name: 'Artemis Base',
  subtitle: 'Main base, reactor offline',
  brief: 'Three reactors, three wings, one way out. Bring the base online and hold the rover bay until the crawler charges.',
  diff: moonDiff(8),
  theme: { ...INSIDE, music: 39 },
  build(world, rng) {
    const d = spaceDiff(8);
    ground(world, 420, 'grate', { uv: 0.4, mat: { color: 0x6a707a } });
    const H = 3.8;
    // corridor A: start to the atrium
    const az = -106, AW = 32, AH = 9;
    const zTop = 22, zBot = az + AW / 2;
    const rooms = [[-1, 4], [1, -16], [-1, -40], [1, -64]];
    wallZ(world, -3.5, zTop, zBot, rooms.filter(r => r[0] < 0).map(r => r[1]), H);
    wallZ(world, 3.5, zTop, zBot, rooms.filter(r => r[0] > 0).map(r => r[1]), H);
    world.box(0, H / 2, zTop, 7.4, H, 0.4, 'panel', { uv: 0.4 });
    world.box(0, H + 0.2, (zTop + zBot) / 2, 7.8, 0.4, zTop - zBot, 'panel', { uv: 0.3, mat: { color: 0x8a909a } });
    world.box(0, 0.02, (zTop + zBot) / 2, 7, 0.04, zTop - zBot, 'grate', { uv: 0.5, collide: false, mat: { color: 0x9aa0aa } });
    for (let z = zTop - 5; z > zBot; z -= 9) {
      const dead = rng.chance(0.35);
      world.box(0, H - 0.04, z, 0.4, 0.06, 3, 'plaster', { uv: 1, collide: false, mat: dead ? { color: 0x2a2a2e } : { color: 0xcfe8ff, emissive: 0xcfe8ff, emissiveIntensity: 1.4 } });
      world.light(dead ? 0x3a8aff : 0xcfe8ff, dead ? 1.3 : 3, 0, H - 0.5, z, 10);
    }
    pipes(world, 3.1, H - 0.45, zTop, 3.1, zBot, rng, 0x4a6a8a, 2);
    for (const [s, z] of rooms) {
      const x = s * 10;
      roomWalls(world, x, z, 13, 11, H, 'panel', { doors: s < 0 ? { east: [0, 11] } : { west: [0, 11] }, mat: { uv: 0.4, mat: { color: 0xd0d4dc } } });
      world.box(x, H + 0.2, z, 13.4, 0.4, 11.4, 'panel', { uv: 0.3, mat: { color: 0x8a909a } });
      lightStrip(world, x, H - 0.05, z, 4, true, rng.chance(0.5) ? 0xcfe8ff : 0x8ab8ff, 2.6);
      for (let k = -1; k <= 1; k++) {
        world.box(x + s * 5, 0.5, z + k * 3.4, 2, 1, 2.8, 'hull', { uv: 0.6, mat: { color: 0xb8c0cc, repeat: 1 } });
        world.box(x + s * 5, 1.05, z + k * 3.4, 1.8, 0.12, 2.4, 'plaster', { uv: 1, collide: false, mat: { color: rng.pick([0x2a4a8a, 0x4a4a5a, 0x6a3a6a]) } });
      }
      crates(world, x - s * 1, z + rng.range(-3, 3), rng, 2);
      bloodPool(world, x, z, rng.range(1, 2.4), (z | 0) + 800);
    }

    // the atrium: a tall crossroads with the third reactor in its floor
    roomWalls(world, 0, az, AW, AW, AH, 'panel', {
      doors: { south: [0, 7, H], west: [0, 7, H], east: [0, 7, H], north: [0, 6, 4.4] }, mat: { uv: 0.35, mat: { color: 0xd0d4dc } }
    });
    world.box(0, AH + 0.3, az, AW + 1, 0.6, AW + 1, 'panel', { uv: 0.25, mat: { color: 0x7a808a } });
    world.box(0, 0.02, az, AW, 0.04, AW, 'grate', { uv: 0.5, collide: false, mat: { color: 0x8a909a } });
    world.cylinder(0, 0.5, az, 4, 4.2, 1, 'hull', { seg: 24, mat: { repeat: 2, color: 0xb8c0cc, metalness: 0.6 }, tag: 'reactor' });
    world.shape(new THREE.CylinderGeometry(1.4, 1.4, AH - 1, 16, 1, true), 'plaster', { pos: [0, AH / 2 + 0.5, az], collide: false, mat: { color: 0x6ae0ff, emissive: 0x3ac8ff, emissiveIntensity: 1.6 } });
    world.collider(0, AH / 2, az, 3, AH, 3, 0, 'reactor');
    world.light(0x6ae0ff, 8, 0, 4, az, 24);
    terminal(world, 0, 1, az + 4.4, 0, 'CORE REACTOR');
    for (const s of [-1, 1]) for (const k of [-1, 1]) {
      world.box(s * 11, 0.6, az + k * 9, 3, 1.2, 1.4, 'hull', { uv: 0.6, mat: { color: 0x3a3e46, repeat: 1, metalness: 0.6 } });
      screen(world, s * (AW / 2 - 0.3), 4, az + k * 9, 4, 2, -s * Math.PI / 2, 0x3ac8ff);
    }
    for (let z = az + 12; z > az - 14; z -= 8) for (const s of [-1, 1]) lightStrip(world, s * 9, AH - 0.1, z, 4, false, 0xcfe8ff, 4);

    // west wing: the lab; east wing: the power plant
    corridorX(world, -AW / 2, -60, az, H, rng);
    corridorX(world, AW / 2, 60, az, H, rng);
    for (const s of [-1, 1]) {
      const rx = s * 72;
      roomWalls(world, rx, az, 24, 22, 5, 'panel', { doors: s < 0 ? { east: [0, 7, H] } : { west: [0, 7, H] }, mat: { uv: 0.35, mat: { color: 0xd0d4dc } } });
      world.box(rx, 5.3, az, 24.4, 0.6, 22.4, 'panel', { uv: 0.3, mat: { color: 0x7a808a } });
      world.box(rx, 0.02, az, 24, 0.04, 22, 'grate', { uv: 0.5, collide: false });
      lightStrip(world, rx, 4.9, az - 5, 6, true, 0xcfe8ff, 4);
      lightStrip(world, rx, 4.9, az + 5, 6, true, s < 0 ? 0x7aff9a : 0xffb040, 4);
      terminal(world, rx + s * 10, 0, az - 9.6, 0, s < 0 ? 'LAB REACTOR' : 'PLANT REACTOR');
      if (s < 0) {   // lab benches and specimen tanks
        for (let k = -1; k <= 1; k++) world.box(rx + k * 6, 0.5, az + 4, 4, 1, 1.4, 'hull', { uv: 0.6, mat: { color: 0xd8dce4, repeat: 1 } });
        for (let k = 0; k < 3; k++) {
          world.cylinder(rx - 8 + k * 3, 1.3, az - 6, 0.8, 0.8, 2.6, 'hull', { seg: 14, mat: { repeat: 1, color: 0x9ad8c0, metalness: 0.2 } });
          world.light(0x7aff9a, 2, rx - 8 + k * 3, 2, az - 4.8, 6);
        }
      } else {       // turbines
        for (let k = -1; k <= 1; k++) {
          world.shape(new THREE.CylinderGeometry(1.4, 1.4, 6, 18), 'hull', { pos: [rx + k * 6, 1.6, az + 4], rot: [Math.PI / 2, 0, 0], collide: true, tag: 'turbine', mat: { repeat: 1, color: 0x8a909a, metalness: 0.7 } });
        }
      }
    }

    // north: the rover bay
    const bz = az - AW / 2 - 20.2, BW = 40;
    roomWalls(world, 0, bz, BW, 40, 10, 'panel', { doors: { south: [0, 6, 4.4] }, mat: { uv: 0.3, mat: { color: 0xc8ccd4 } } });
    world.box(0, 10.3, bz, BW + 1, 0.6, 41, 'panel', { uv: 0.25, mat: { color: 0x6a707a } });
    world.box(0, 0.02, bz, BW, 0.04, 40, 'grate', { uv: 0.4, collide: false, mat: { color: 0xd8b040 } });
    rover(world, -10, bz - 6, Math.PI / 2, rng, 0xe8e8ec);
    rover(world, 10, bz - 12, Math.PI / 2 + 0.2, rng, 0xe8e8ec);
    world.box(0, 4, bz - 19.6, 16, 8, 0.4, 'rust', { uv: 0.5, collide: false, mat: { color: 0x3a4048, metalness: 0.6 } });   // the big door
    world.sign('ROVER BAY — SHACKLETON ROUTE', 0, 8.6, bz - 19.4, 0, 12, '#6ae0ff');
    for (const s of [-1, 1]) container(world, s * 15, bz + 8, Math.PI / 2, 0x2a5ac8, rng, 2);
    for (let z = bz + 14; z > bz - 18; z -= 10) for (const s of [-1, 1]) lightStrip(world, s * 10, 9.9, z, 5, false, 0xcfe8ff, 5);
    crates(world, -4, bz + 4, rng, 3);
    crates(world, 6, bz - 2, rng, 3);

    world.playerStart.set(0, 0, 16);
    world.playerFacing = 0;

    return {
      stages: [
        {
          text: 'Get through the quarters to the atrium', kind: 'reach', zone: zone(0, az + 12, 10, 6, 0, 6),
          spawns: [
            ...horde(rng, 8, ['crew', 'crew', 'leaper'], -2.5, 2.5, 6, -84), sp('voidSuit', -10, 4), sp('crew', 10, -16),
            sp('voidSuit', -10, -40), sp('leaper', 10, -64), sp('crew', 0, -70), sp('voidSuit', 0, -80)
          ]
        },
        {
          text: 'Bring the reactors online: core, lab and plant', kind: 'interact', count: 3,
          onEnterText: 'Void suits: aim for the broken visors.',
          spawns: [
            ...horde(rng, 6, ['crew', 'voidSuit', 'leaper'], -12, 12, az + 12, az - 12),
            ...horde(rng, 5, ['crew', 'leaper', 'voidSuit'], -80, -60, az + 8, az - 8),
            ...horde(rng, 5, ['crew', 'leaper', 'voidSuit'], 60, 80, az + 8, az - 8)
          ]
        },
        {
          text: 'Get to the rover bay', kind: 'reach', zone: zone(0, bz + 14, 12, 6, 0, 6),
          spawns: [sp('voidSuit', -6, bz + 6), sp('voidSuit', 6, bz), sp('leaper', 0, bz - 10)]
        },
        {
          text: 'Hold the rover bay while the crawler charges', kind: 'defend', duration: 50,
          ...waves(d, { waveKinds: ['crew', 'crew', 'leaper', 'voidSuit'] }),
          wavePoints: [[0, 0, az], [-50, 0, az], [50, 0, az], [-17, 0, bz - 16], [17, 0, bz - 16]],
          onEnterText: 'CHARGING — 50 SECONDS'
        },
        { text: 'Board the crawler', kind: 'reach', zone: zone(-10, bz - 2, 6, 4, 0, 5) }
      ],
      pickups: [
        ['ammo', 1.5, 0, 0], ['health', 10, 0, -16], ['ammo', -10, 0, -40], ['armour', 10, 0, -64],
        ['ammo', -8, 0, az - 12], ['health', -66, 0, az + 6], ['ammo', 66, 0, az - 6], ['health', 0, 0, bz + 10], ['ammo', 12, 0, bz + 2]
      ]
    };
  }
};

/* ================================================================ 15 */
export const MOON_3 = {
  id: 15, world: 'moon',
  name: 'Shackleton Rigs',
  subtitle: 'South pole crater, eternal dusk',
  brief: 'The ice mines sit in a crater the sun never climbs into. Clear the rig field, vent the processors and reach the cargo lander.',
  diff: moonDiff(9),
  theme: { ...LUNAR, sun: { colour: 0xfff0e0, intensity: 1.5, pos: [90, 12, 30] }, hemi: [0x5a6078, 0x0c0c10, 0.3], glowDir: [0.9, 0.08, 0.3], skyGlow: 0x1a2030, music: 44 },
  build(world, rng) {
    const d = spaceDiff(9);
    ground(world, 420, 'regolith', { uv: 0.2, bumpy: 0.5, seg: 60, mat: { color: 0x7a7a82 } });
    // the crater wall: a ring of ridges boxing in the rig field
    const R = 70;
    const C = (a, b, c, e, h, out) => cliff(world, a, b, c, e, h, rng, 'regolith', { out, tint: 0xa8a8b0 });
    C(-R, 120, -R, -150, 22, [-1, 0]);
    C(R, 120, R, -150, 22, [1, 0]);
    C(-R, -152, R, -152, 24, [0, -1]);
    C(-R, 122, -12, 122, 18, [0, 1]);
    C(12, 122, R, 122, 18, [0, 1]);
    // the ramp road down from the rim
    world.box(0, 0.03, 70, 12, 0.06, 110, 'grate', { uv: 0.3, collide: false, mat: { color: 0x6a6a72 } });
    for (let z = 116; z > 20; z -= 16) for (const s of [-1, 1]) {
      world.box(s * 7, 2.5, z, 0.3, 5, 0.3, 'hull', { uv: 1, collide: false, mat: { color: 0x9aa0a8, repeat: 1 } });
      world.light(0xfff0d0, 6, s * 7, 5, z, 18);
    }
    scatterCraters(world, rng, 14, -60, 60, 110, -140, 10);
    scatterBoulders(world, rng, 40, -64, 64, 116, -146, 8);

    // ice rigs, processing towers and pipework
    const rigs = [[-36, -10, 18], [34, -30, 20], [-30, -90, 16], [36, -110, 22]];
    for (const [x, z, h] of rigs) drillRig(world, x, z, h, rng, 0x6a90c8);
    for (const [x, z] of [[-14, -60], [16, -70], [0, -112]]) {
      world.cylinder(x, 4, z, 3.2, 3.4, 8, 'hull', { seg: 20, mat: { repeat: 2, color: 0xd8dce4, metalness: 0.5 }, tag: 'tank' });
      world.shape(new THREE.SphereGeometry(3.2, 20, 8, 0, TAU, 0, Math.PI / 2), 'hull', { pos: [x, 8, z], mat: { repeat: 2, color: 0xd8dce4, metalness: 0.5 } });
      world.shape(new THREE.TorusGeometry(3.3, 0.12, 6, 28), 'plaster', { pos: [x, 6, z], rot: [Math.PI / 2, 0, 0], collide: false, mat: { color: 0x6ae0ff, emissive: 0x3ac8ff, emissiveIntensity: 1.5 } });
      world.light(0x6ae0ff, 4, x, 3, z + 4, 14);
    }
    terminal(world, -14, 0, -55.6, 0, 'PROCESSOR 1');
    terminal(world, 16, 0, -65.6, 0, 'PROCESSOR 2');
    terminal(world, 0, 0, -107.6, 0, 'PROCESSOR 3');
    pipes(world, -36, 0.5, -10, -14, -60, rng, 0x6a90c8, 2);
    pipes(world, 34, 0.5, -30, 16, -70, rng, 0x6a90c8, 2);
    pipes(world, -14, 0.8, -60, 16, -70, rng, 0x8a8e96, 3);
    for (let i = 0; i < 5; i++) container(world, rng.sign() * rng.range(16, 50), rng.range(-130, 40), rng.range(-0.4, 0.4), rng.pick([0x2a5ac8, 0x8a8e96, 0xd8a830]), rng, rng.int(1, 2));
    for (let i = 0; i < 3; i++) rover(world, rng.range(-40, 40), rng.range(-120, 40), rng() * TAU, rng);
    module(world, -46, 40, 12, 2.4, Math.PI / 2, rng, { label: 'ICE CTRL' });
    module(world, 48, 20, 10, 2, Math.PI / 2, rng, { label: 'CREW' });
    for (let i = 0; i < 8; i++) bloodPool(world, rng.range(-40, 40), rng.range(-130, 40), rng.range(1, 3), i + 900);
    for (let i = 0; i < 6; i++) barrel(world, rng.range(-40, 40), rng.range(-130, 30), rng);

    // the cargo lander on its pad at the back of the crater
    const lz = -134;
    landingPad(world, 0, lz, 10, 0x6ae0ff);
    rocket(world, 0, lz - 2, 0.6, 0xd8a830);

    highlands(world, 240, 18, rng);
    const home = earth(world);

    world.playerStart.set(0, 0, 112);
    world.playerFacing = 0;

    return {
      follow: [home],
      stages: [
        {
          text: 'Down the ramp road into the crater', kind: 'reach', zone: zone(0, 18, 30, 8, 0, 8),
          spawns: [...horde(rng, 16, ['crew', 'leaper', 'voidSuit', 'lunarCrawler'], -12, 12, 100, 24), sp('lunarSpitter', -8, 30), sp('lunarSpitter', 8, 24)]
        },
        {
          text: 'Clear the rig field', kind: 'kill', count: 30,
          onEnterText: 'Spitters: break line of sight.',
          spawns: [...horde(rng, 28, ['crew', 'leaper', 'voidSuit', 'lunarCrawler', 'lunarSpitter'], -60, 60, 10, -130), sp('lunarSpitter', -50, -40), sp('lunarSpitter', 50, -60), sp('voidSuit', 0, -90)]
        },
        {
          text: 'Vent the three ice processors', kind: 'interact', count: 3,
          spawns: [...horde(rng, 14, ['crew', 'leaper', 'lunarCrawler', 'lunarSpitter'], -50, 50, -40, -130)]
        },
        {
          text: 'Hold while the cargo lander warms up', kind: 'defend', duration: 55,
          ...waves(d, { waveKinds: ['crew', 'leaper', 'voidSuit', 'lunarCrawler', 'lunarSpitter'] }),
          wavePoints: [[-60, 0, -20], [60, 0, -20], [-60, 0, -130], [60, 0, -130], [0, 0, 40]],
          onEnterText: 'LANDER WARM-UP — 55 SECONDS'
        },
        { text: 'Board the cargo lander', kind: 'reach', zone: zone(0, lz + 9, 8, 5, 0, 6), spawns: [sp('voidSuit', -8, lz + 14), sp('voidSuit', 8, lz + 14)] }
      ],
      pickups: [
        ['ammo', 3, 0, 90], ['health', -4, 0, 50], ['ammo', 0, 0, 12], ['armour', -20, 0, -30],
        ['ammo', 22, 0, -50], ['health', 0, 0, -84], ['ammo', -22, 0, -110], ['health', 24, 0, -120], ['ammo', 0, 0, lz + 16]
      ]
    };
  }
};

/* ================================================================ 16 */
export const MOON_4 = {
  id: 16, world: 'moon',
  name: 'Wreck of the Selene',
  subtitle: 'Crash site, Mare Imbrium',
  brief: 'The evac liner Selene came down full. Follow the debris to the hull, pull the flight recorder and the nav core, and hold until the data is out.',
  diff: moonDiff(10),
  theme: { ...LUNAR, sun: { colour: 0xfff4ea, intensity: 1.5, pos: [-60, 26, 50] }, glowDir: [-0.6, 0.12, 0.5], music: 46 },
  build(world, rng) {
    const d = spaceDiff(10);
    ground(world, 460, 'regolith', { uv: 0.2, bumpy: 0.6, seg: 70, mat: { color: 0x8a8a90 } });
    // the scar the ship ploughed: a long dark trench of churned dust
    world.box(0, 0.02, -20, 26, 0.04, 260, 'regolith', { uv: 0.3, collide: false, mat: { color: 0x5a5a60 } });
    scatterCraters(world, rng, 18, -100, 100, 110, -200, 18);
    scatterBoulders(world, rng, 50, -100, 100, 120, -200, 14);
    // debris along the trail: hull plates, containers spilt open, seats
    for (let i = 0; i < 26; i++) {
      const x = rng.range(-22, 22), z = rng.range(-120, 100);
      const pick = rng();
      if (pick < 0.4) world.box(x, 0.3, z, rng.range(1.5, 4), 0.12, rng.range(1, 3), 'hull', { uv: 0.5, rotY: rng() * TAU, collide: false, mat: { repeat: 1, color: 0xc8ccd2, metalness: 0.6 } });
      else if (pick < 0.6) container(world, x, z, rng() * TAU, rng.pick([0x2a5ac8, 0xd8d8dc, 0xc8302a]), rng);
      else if (pick < 0.8) for (let k = 0; k < 3; k++) world.box(x + k * 0.7, 0.5, z, 0.6, 1, 0.6, 'hull', { uv: 1, collide: false, rotY: rng.range(-0.5, 0.5), mat: { color: 0x2a3a6a } });
      else rock(world, x, z, rng.range(1, 2), rng, 'regolith');
    }
    hullChunk(world, -16, 60, 14, 3, 0.4, rng, 0.6);
    hullChunk(world, 18, 20, 18, 3.4, -0.3, rng, -0.4);
    hullChunk(world, -20, -30, 12, 3, 1.2, rng, 1.1);
    // sparking breaks instead of fire: no air to burn
    for (const [x, z] of [[-16, 60], [18, 20], [-20, -30], [10, -70], [-8, 0]]) world.light(0x9ad8ff, 5, x, 2, z, 14);

    // the main hull: a long broken section you can walk into
    const hz = -120, HL = 50, HW = 16, HH = 9;
    roomWalls(world, 0, hz, HW, HL, HH, 'hull', { doors: { south: [0, 8, 6] }, mat: { uv: 0.3, mat: { repeat: 1, color: 0xc8ccd2, metalness: 0.6 } } });
    world.box(0, HH + 0.3, hz, HW + 1, 0.6, HL + 1, 'hull', { uv: 0.3, mat: { repeat: 1, color: 0xa8acb4, metalness: 0.6 } });
    world.shape(new THREE.CylinderGeometry(HW * 0.62, HW * 0.62, HL, 24, 1, true, Math.PI * 1.5, Math.PI), 'hull', {
      pos: [0, HH * 0.6, hz], rot: [Math.PI / 2, 0, 0], collide: false, mat: { repeat: 2, color: 0xd8dce2, metalness: 0.6 }
    });
    world.box(0, 0.02, hz, HW, 0.04, HL, 'grate', { uv: 0.4, collide: false, mat: { color: 0x8a909a } });
    world.sign('SELENE — ARES LINES', 0, HH + 2.6, hz + HL / 2 + 0.6, 0, 12, '#ffd24a');
    world.box(0, HH + 2.6, hz + HL / 2 + 0.3, 13, 2.4, 0.4, 'hull', { uv: 0.4, collide: false, mat: { repeat: 1, color: 0x2a3a6a } });
    for (let r = 0; r < 6; r++) for (const s of [-1, 1]) {   // rows of passenger seats, some torn out
      if (rng.chance(0.25)) continue;
      world.box(s * 4.5, 0.55, hz + 18 - r * 5, 4, 1.1, 0.8, 'hull', { uv: 1, mat: { color: 0x2a3a6a } });
    }
    for (let z = hz + 20; z > hz - 24; z -= 8) lightStrip(world, 0, HH - 0.1, z, 3, true, rng.chance(0.4) ? 0xff5040 : 0xcfe8ff, 3);
    terminal(world, -5, 0, hz - 22, 0, 'FLIGHT RECORDER');
    terminal(world, 5, 0, hz - 22, 0, 'NAV CORE');
    screen(world, 0, 4, hz - HL / 2 + 0.4, 8, 3, 0, 0xff5040);
    for (let i = 0; i < 8; i++) bloodPool(world, rng.range(-6, 6), rng.range(hz - 20, hz + 20), rng.range(1, 2.6), i + 1000);
    trash(world, -4, hz + 10, rng, 6);
    trash(world, 5, hz - 8, rng, 6);
    // the torn-off tail behind
    hullChunk(world, 30, -150, 16, 4, Math.PI / 2 + 0.2, rng, 0.3);
    hullChunk(world, -34, -146, 10, 3.6, 0.3, rng, 1.6);   // an engine pod, nose down

    cliff(world, -100, 130, -100, -210, 14, rng, 'regolith', { out: [-1, 0], tint: 0xb8b8bc });
    cliff(world, 100, 130, 100, -210, 14, rng, 'regolith', { out: [1, 0], tint: 0xb8b8bc });
    highlands(world, 250, 20, rng);
    const home = earth(world);

    world.playerStart.set(0, 0, 108);
    world.playerFacing = 0;

    return {
      follow: [home],
      stages: [
        {
          text: 'Follow the debris trail to the Selene', kind: 'reach', zone: zone(0, -86, 20, 8, 0, 8),
          onEnterText: 'She was carrying four thousand people.',
          spawns: [...horde(rng, 20, ['crew', 'crew', 'leaper', 'voidSuit', 'lunarCrawler', 'lunarSpitter'], -22, 22, 96, -78), sp('titan', 0, -40)]
        },
        {
          text: 'Clear the crash site', kind: 'kill', count: 30,
          spawns: [...horde(rng, 26, ['crew', 'leaper', 'voidSuit', 'lunarCrawler', 'lunarSpitter'], -30, 30, -60, -150), sp('titan', -24, -100), sp('titan', 24, -110), sp('lunarSpitter', 0, -130), sp('voidSuit', 0, -110)]
        },
        {
          text: 'Pull the flight recorder and the nav core', kind: 'interact', count: 2,
          spawns: [...horde(rng, 12, ['crew', 'voidSuit', 'leaper', 'lunarCrawler'], -6, 6, hz + 20, hz - 20)]
        },
        {
          text: 'Hold the hull while the data uploads', kind: 'defend', duration: 60,
          ...waves(d, { waveKinds: ['crew', 'crew', 'leaper', 'voidSuit', 'lunarCrawler', 'lunarSpitter'] }),
          wavePoints: [[0, 0, hz + 34], [-20, 0, hz + 30], [20, 0, hz + 30], [0, 0, hz + 50], [-30, 0, hz]],
          onEnterText: 'UPLOADING TO FAR SIDE — 60 SECONDS'
        },
        {
          text: 'Out to the observatory road', kind: 'reach', zone: zone(0, -64, 16, 8, 0, 8),
          spawns: [sp('titan', 0, -80), ...horde(rng, 6, ['leaper', 'lunarCrawler', 'lunarSpitter'], -20, 20, -70, -100)]
        }
      ],
      pickups: [
        ['ammo', 3, 0, 90], ['health', -4, 0, 40], ['ammo', 4, 0, -10], ['armour', -8, 0, -60],
        ['ammo', 0, 0, -96], ['health', 0, 0, hz + 4], ['ammo', -5, 0, hz - 14], ['health', 5, 0, hz - 14]
      ]
    };
  }
};

/* ================================================================ 17 */
export const MOON_5 = {
  id: 17, world: 'moon',
  name: 'Far Side Array',
  subtitle: 'Daedalus radio observatory',
  brief: 'The array can reach Earth. Align three dishes, clear the observatory and hold while the warning goes home.',
  diff: moonDiff(11),
  theme: { ...LUNAR, sun: { colour: 0xe8ecff, intensity: 1.2, pos: [40, 44, -60] }, hemi: [0x6a7090, 0x101014, 0.3], music: 45 },
  build(world, rng) {
    const d = spaceDiff(11);
    ground(world, 460, 'regolith', { uv: 0.2, bumpy: 0.6, seg: 70, mat: { color: 0x84848c } });
    scatterCraters(world, rng, 20, -110, 110, 110, -200, 12);
    scatterBoulders(world, rng, 50, -110, 110, 120, -200, 10);

    // the dishes: big bowls on mounts, each with its own control hut
    const dishes = [[-46, 20], [48, -10], [-40, -70], [46, -96], [0, 50]];
    const DISH = { repeat: 3, color: 0xe8ecf0, metalness: 0.4 };
    material('hull', DISH).side = THREE.DoubleSide;        // a bowl: you see the inside from below
    dishes.forEach(([x, z], i) => {
      world.cylinder(x, 3, z, 1.6, 2.4, 6, 'panel', { seg: 12, mat: { color: 0xd8dce4 }, tag: 'mount' });
      world.shape(new THREE.SphereGeometry(10, 28, 10, 0, TAU, 0, Math.PI / 3.4), 'hull', {
        pos: [x, 9, z], rot: [-0.7 - i * 0.05, rng() * TAU, 0], collide: false, mat: DISH
      });
      world.shape(new THREE.CylinderGeometry(0.15, 0.15, 7, 6), 'rust', { pos: [x, 12, z], rot: [0.5, 0, 0], collide: false });
      world.light(0xff3020, 2, x, 6.5, z, 10);
    });
    const huts = [[-46, 20, Math.PI / 2], [48, -10, -Math.PI / 2], [-40, -70, Math.PI / 2]];
    huts.forEach(([x, z, r], i) => {
      const hx = x + Math.sin(r) * 7;
      module(world, hx, z + 5, 6, 1.6, r, rng, { label: 'DISH ' + (i + 1) });
      terminal(world, hx, 0, z, r, 'ALIGN DISH ' + (i + 1));
    });
    pipes(world, -46, 0.3, 20, 0, -40, rng, 0x8a909a, 2);
    pipes(world, 48, 0.3, -10, 0, -40, rng, 0x8a909a, 2);

    // the observatory: a walled court with the main telescope under an open slit
    const oz = -60, OW = 40, OD = 44, OH = 10;
    roomWalls(world, 0, oz, OW, OD, OH, 'panel', { doors: { south: [0, 8, 6], north: [0, 6, 4.4] }, mat: { uv: 0.3, mat: { color: 0xd8dce4 } } });
    for (const s of [-1, 1]) world.box(s * (OW / 4 + 2), OH + 0.3, oz, OW / 2 - 4, 0.6, OD + 1, 'panel', { uv: 0.25, mat: { color: 0x7a808a } });   // roof with an open slit
    world.box(0, 0.02, oz, OW, 0.04, OD, 'grate', { uv: 0.4, collide: false, mat: { color: 0x8a909a } });
    world.cylinder(0, 1.5, oz, 4, 4.4, 3, 'hull', { seg: 24, mat: { repeat: 2, color: 0x9aa0aa, metalness: 0.6 }, tag: 'scope' });
    world.shape(new THREE.CylinderGeometry(2.2, 2.6, 14, 24), 'hull', { pos: [0, 8, oz - 2], rot: [0.55, 0, 0], collide: false, mat: { repeat: 2, color: 0xe8ecf0, metalness: 0.5 } });
    world.shape(new THREE.TorusGeometry(2.3, 0.18, 8, 28), 'plaster', { pos: [0, 13.6, oz - 5.6], rot: [0.55 + Math.PI / 2, 0, 0], collide: false, mat: { color: 0x6ae0ff, emissive: 0x3ac8ff, emissiveIntensity: 1.8 } });
    for (const s of [-1, 1]) {
      for (let k = -1; k <= 1; k++) world.box(s * 14, 0.6, oz + k * 10, 3, 1.2, 1.6, 'hull', { uv: 0.6, mat: { color: 0x3a3e46, repeat: 1, metalness: 0.6 } });
      screen(world, s * (OW / 2 - 0.3), 4.5, oz, 10, 4, -s * Math.PI / 2, s < 0 ? 0x3ac8ff : 0x7aff9a);
    }
    for (let z = oz + 18; z > oz - 20; z -= 9) for (const s of [-1, 1]) lightStrip(world, s * 12, OH - 0.1, z, 4, false, 0xcfe8ff, 4.5);
    for (let i = 0; i < 6; i++) bloodPool(world, rng.range(-14, 14), rng.range(oz - 18, oz + 18), rng.range(1, 2.6), i + 1100);
    crates(world, -10, oz + 16, rng, 3);
    crates(world, 12, oz - 16, rng, 3);

    // the transport pad north of the observatory
    const tz = oz - OD / 2 - 26;
    landingPad(world, 0, tz, 10, 0x6ae0ff);
    rocket(world, 0, tz - 3, 0.55, 0x6ae0ff);
    rover(world, 14, tz + 10, 1, rng);
    solarArray(world, -30, tz + 4, Math.PI / 2, 5, rng, 0.9);

    cliff(world, -110, 130, -110, -210, 14, rng, 'regolith', { out: [-1, 0], tint: 0xb0b0b8 });
    cliff(world, 110, 130, 110, -210, 14, rng, 'regolith', { out: [1, 0], tint: 0xb0b0b8 });
    highlands(world, 250, 20, rng);
    const home = earth(world);

    world.playerStart.set(0, 0, 108);
    world.playerFacing = 0;

    return {
      follow: [home],
      stages: [
        {
          text: 'Reach the array', kind: 'reach', zone: zone(0, 30, 30, 10, 0, 8),
          spawns: [...horde(rng, 20, ['crew', 'leaper', 'voidSuit', 'lunarCrawler', 'lunarSpitter'], -24, 24, 96, 34), sp('titan', -12, 40), sp('titan', 12, 36)]
        },
        {
          text: 'Align three dishes', kind: 'interact', count: 3,
          spawns: [...horde(rng, 6, ['crew', 'leaper', 'lunarSpitter'], -60, -30, 30, 0), ...horde(rng, 6, ['crew', 'leaper', 'lunarSpitter'], 34, 62, 0, -24), ...horde(rng, 6, ['crew', 'voidSuit', 'lunarCrawler'], -56, -24, -56, -84)]
        },
        {
          text: 'Clear the observatory', kind: 'kill', count: 32,
          spawns: [...horde(rng, 28, ['crew', 'leaper', 'voidSuit', 'lunarCrawler', 'lunarSpitter'], -17, 17, oz + 18, oz - 18), sp('titan', -10, oz - 14), sp('titan', 10, oz - 14), sp('voidSuit', 0, oz + 20), sp('lunarSpitter', 0, oz - 20)]
        },
        {
          text: 'Hold the observatory while the warning goes home', kind: 'defend', duration: 60,
          ...waves(d, { waveKinds: ['crew', 'leaper', 'voidSuit', 'lunarCrawler', 'lunarSpitter', 'titan'] }),
          wavePoints: [[0, 0, oz + OD / 2 + 8], [0, 0, oz - OD / 2 - 8], [-30, 0, oz + 30], [30, 0, oz + 30], [-30, 0, oz - 30]],
          onEnterText: 'TRANSMITTING TO EARTH — 60 SECONDS'
        },
        {
          text: 'To the transport', kind: 'reach', zone: zone(0, tz + 8, 8, 5, 0, 6),
          spawns: [sp('titan', -8, tz + 12), sp('titan', 8, tz + 12), ...horde(rng, 6, ['leaper', 'lunarCrawler'], -16, 16, tz + 20, tz)]
        }
      ],
      pickups: [
        ['ammo', 3, 0, 90], ['health', -4, 0, 54], ['ammo', -30, 0, 32], ['armour', 40, 0, -14],
        ['ammo', 0, 0, oz + 26], ['health', -14, 0, oz + 4], ['ammo', 14, 0, oz - 4], ['health', 0, 0, tz + 16]
      ]
    };
  }
};

/* ================================================================ 18 */
export const MOON_6 = {
  id: 18, world: 'moon', flight: 'venus', interlude: true,   // not the end: the signal leads on to Venus
  name: 'The Hive',
  subtitle: 'Tycho crater — where it started',
  brief: 'Every signal leads to Tycho. The infection has grown a nest in the crater. Burn out the brood, kill the Matriarch, and get home.',
  diff: moonDiff(12),
  theme: { ...LUNAR, sun: { colour: 0xd8e4ff, intensity: 1.2, pos: [-40, 22, -70] }, hemi: [0x5a6a8a, 0x0a0c14, 0.3], skyGlow: 0x0a2a3a, glowDir: [0, 0.2, -1], music: 47 },
  build(world, rng) {
    const d = spaceDiff(12);
    ground(world, 420, 'regolith', { uv: 0.2, bumpy: 0.7, seg: 70, mat: { color: 0x707078 } });
    // the crater walls box in a big arena; the way in is the gully from the south
    const R = 64;
    const C = (a, b, c, e, h, out) => cliff(world, a, b, c, e, h, rng, 'regolith', { out, tint: 0x9a9aa4 });
    C(-R, 40, -R, -140, 24, [-1, 0]);
    C(R, 40, R, -140, 24, [1, 0]);
    C(-R, -142, R, -142, 26, [0, -1]);
    C(-R, 42, -10, 42, 22, [0, 1]);
    C(10, 42, R, 42, 22, [0, 1]);
    C(-10, 44, -10, 120, 16, [-1, 0]);
    C(10, 44, 10, 120, 16, [1, 0]);
    C(-10, 122, 10, 122, 14, [0, 1]);
    scatterBoulders(world, rng, 30, -58, 58, 36, -136, 6);

    // the nest: fleshy growths swollen over the old excavation, pods that glow
    const growth = { color: 0x5a6a8a, emissive: 0x08202a, roughness: 0.5 };
    const pod = { color: 0x7af0ff, emissive: 0x3ad8ff, emissiveIntensity: 1.6 };
    for (let i = 0; i < 46; i++) {
      const a = rng() * TAU, r = rng.range(6, 56);
      const x = Math.cos(a) * r, z = -60 + Math.sin(a) * r * 1.2;
      if (Math.abs(x) < 5 && z > -40) continue;
      const s = rng.range(0.8, 3.2);
      world.shape(new THREE.SphereGeometry(1, 12, 8), 'flesh', { pos: [x, s * 0.2, z], scale: [s * rng.range(1, 1.8), s * rng.range(0.5, 1), s * rng.range(1, 1.6)], rot: [0, rng() * TAU, 0], uv: 2, collide: false, mat: growth });
      if (s > 2.2) world.collider(x, s * 0.4, z, s * 1.6, s * 0.8, s * 1.6, 0, 'growth');
      for (let k = 0; k < 3; k++) {
        if (!rng.chance(0.6)) continue;
        world.shape(new THREE.SphereGeometry(0.3, 8, 6), 'plaster', { pos: [x + rng.range(-s, s), s * 0.6 + rng.range(0, 0.4), z + rng.range(-s, s)], scale: [1, 1.4, 1], collide: false, shadow: false, mat: pod });
      }
      if (i % 5 === 0) world.light(0x5ae8ff, 5, x, 2, z, 16);
    }
    // veins of it running up the crater walls
    for (let i = 0; i < 24; i++) {
      const side = rng.pick([[-R + 2, rng.range(-130, 30)], [R - 2, rng.range(-130, 30)], [rng.range(-60, 60), -140]]);
      world.shape(new THREE.CylinderGeometry(0.4, 0.8, rng.range(8, 18), 7), 'flesh', { pos: [side[0], 4, side[1]], rot: [rng.range(-0.3, 0.3), 0, rng.range(-0.4, 0.4)], collide: false, mat: growth });
    }
    // the old dig site under it: a broken drill rig and the excavation ring
    drillRig(world, -30, -100, 20, rng, 0x6a7a8a);
    world.shape(new THREE.TorusGeometry(14, 0.6, 6, 40), 'rust', { pos: [0, 0.3, -60], rot: [Math.PI / 2, 0, 0], collide: false, mat: { color: 0x4a4e56, metalness: 0.6 } });
    world.shape(new THREE.CircleGeometry(13.4, 40).rotateX(-Math.PI / 2), 'plaster', { pos: [0, 0.04, -60], collide: false, shadow: false, mat: { color: 0x0a2a3a, emissive: 0x1a8ab0, emissiveIntensity: 0.8 } });
    world.light(0x5ae8ff, 12, 0, 6, -60, 40);
    for (let i = 0; i < 4; i++) module(world, rng.sign() * rng.range(30, 50), rng.range(-130, -20), rng.range(8, 12), 2.2, rng() * TAU, rng, { lit: false });
    for (let i = 0; i < 10; i++) bloodPool(world, rng.range(-40, 40), rng.range(-130, 20), rng.range(1.5, 3.5), i + 1200);

    // the evac lander waiting at the back of the crater
    const ez = -126;
    landingPad(world, 0, ez, 10, 0x7aff9a);
    const lander = rocket(world, 0, ez - 3, 0.6, 0x2a8a4a);
    world.sign('EVAC — EARTH', 0, 4.5, ez + 1.2, 0, 4, '#7aff9a');

    highlands(world, 240, 18, rng, 0x7a7a84);
    const home = earth(world);

    world.playerStart.set(0, 0, 112);
    world.playerFacing = 0;

    return {
      ship: lander, follow: [home],
      stages: [
        {
          text: 'Down the gully into the Hive', kind: 'reach', zone: zone(0, 30, 24, 8, 0, 8),
          onEnterText: 'Everything here is awake.',
          spawns: [...horde(rng, 16, ['crew', 'leaper', 'lunarCrawler', 'voidSuit'], -7, 7, 104, 36), sp('lunarSpitter', -4, 60), sp('lunarSpitter', 4, 70)]
        },
        {
          text: 'Burn out the brood', kind: 'kill', count: 36,
          spawns: [...horde(rng, 32, ['crew', 'leaper', 'voidSuit', 'lunarCrawler', 'lunarSpitter'], -56, 56, 30, -130), sp('titan', -20, -40), sp('titan', 20, -50), sp('titan', 0, -90), sp('lunarSpitter', 0, -110)]
        },
        {
          text: 'Kill the Matriarch', kind: 'boss', boss: { kind: 'matriarch', at: [0, 0, -66] },
          onEnterText: 'SHE CAME UP OUT OF THE DIG',
          waveEvery: d.waveEvery + 2, waveSize: 3, maxAlive: 14,
          waveKinds: ['crew', 'leaper', 'lunarCrawler', 'lunarSpitter', 'voidSuit'],
          wavePoints: [[-56, 0, -20], [56, 0, -20], [-56, 0, -120], [56, 0, -120], [0, 0, 30]]
        },
        {
          text: 'Hold the lander while it spins up', kind: 'defend', duration: 45,
          ...waves(d, { waveKinds: ['crew', 'leaper', 'voidSuit', 'lunarCrawler', 'lunarSpitter', 'titan'] }),
          wavePoints: [[-56, 0, -20], [56, 0, -20], [-56, 0, -120], [56, 0, -120], [0, 0, 30]],
          onEnterText: 'ENGINES SPINNING UP — 45 SECONDS'
        },
        { text: 'Board the lander — go home', kind: 'reach', zone: zone(0, ez + 9, 8, 5, 0, 6) }
      ],
      pickups: [
        ['ammo', 2, 0, 96], ['health', -2, 0, 60], ['ammo', 0, 0, 34], ['armour', -30, 0, -10],
        ['ammo', 30, 0, -30], ['health', 0, 0, -30], ['ammo', -20, 0, -110], ['health', 20, 0, -116]
      ]
    };
  }
};

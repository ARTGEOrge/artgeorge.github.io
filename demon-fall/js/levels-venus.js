/* Demon Fall — the Venus campaign, stages 19 to 24.
 *
 * The Matriarch was answering something. The signal went sunward, to Venus:
 * heat-shielded domes on a surface hot enough to melt lead, and a floating
 * city riding the clouds fifty kilometres up. Yellow haze, acid rain, and the
 * people who lived there, blistered green and glowing.
 *
 * Difficulty picks up from the Moon finale (outerDiff) and climbs from here. */
import * as THREE from 'three';
import { ground, barrel } from './world.js';
import { crates, scorch, bloodPool, trash } from './props.js';
import { zone, terminal } from './levels-a.js';
import {
  sp, horde, waves, cliff, dome, module, container, landingPad, rocket, lightStrip, hall, pipes,
  drillRig, screen, mast, rover, planter, hullChunk
} from './space-kit.js';
import {
  outerDiff, outerMods, voidGround, cloudSea, deck, bridge, envelope, acidPool, tankSphere, corridor, boulders, stormTowers
} from './outer-kit.js';
import { TAU } from './util.js';

/* The surface: a crushing yellow haze, the sun a smear overhead, acid rain slanting down. */
const HAZE = {
  skyTop: 0x3a2408, skyHorizon: 0x9a6a28, skyGround: 0x2a1a08, skyGlow: 0xd8b060,
  glowDir: [0.3, 0.6, -0.7], stars: 0, rift: 0, clouds: 1,
  fog: 0x7a5420, fogDensity: 0.0145, fogMix: 0.04,
  hemi: [0xffc070, 0x3a2410, 0.55], ambient: 1.2,
  sun: { colour: 0xffd8a0, intensity: 0.75, pos: [30, 70, -40] },
  space: 'venus', gravity: 20, jump: 6.7, tempo: 1.15,
  particles: { count: 1300, colour: 0xd8f070, embers: 0, size: 0.03, fall: [-13, -9], wind: 1.6 }
};
/* Fifty kilometres up: brighter, thinner haze, the cloud deck below. */
const HIGH = {
  ...HAZE,
  skyTop: 0x6a4a1a, skyHorizon: 0xc8a058, skyGround: 0x8a6a30, skyGlow: 0xffe8b0,
  fog: 0xa88848, fogDensity: 0.0055, fogMix: 0.02,
  hemi: [0xffe0a0, 0x5a4020, 0.6], ambient: 1.4,
  sun: { colour: 0xfff0c8, intensity: 1.0, pos: [40, 70, -30] },
  particles: { count: 900, colour: 0xe0f078, embers: 0, size: 0.028, fall: [-10, -7], wind: 2.4 }
};
/* Inside the heat-shielded habitats: amber emergency light, sulfur dust. */
const INSIDE = {
  skyTop: 0x0a0804, skyHorizon: 0x141008, skyGround: 0x0a0804, skyGlow: 0x000000, stars: 0, rift: 0, clouds: 0,
  fog: 0x1a140a, fogDensity: 0.03, fogMix: 0.2,
  hemi: [0x5a4a30, 0x0a0806, 0.45],
  sun: { colour: 0x7a6a4a, intensity: 0.15, pos: [0, 40, 0] },
  dark: true, space: 'venus', gravity: 20, jump: 6.7, tempo: 1.15,
  particles: { count: 320, colour: 0xc8b070, embers: 0, size: 0.04 }
};

const ACID = ['scorched', 'scorched', 'acidCrawler', 'acidSpitter'];
const ALL = ['scorched', 'scorched', 'acidCrawler', 'acidSpitter', 'heatSuit'];
const pools = (world, rng, list, dps = 16) => list.map(([x, z, r]) => ({ ...acidPool(world, x, z, r, rng), dps }));

/* ================================================================ 19 */
export const VENUS_1 = {
  id: 19, world: 'venus',
  name: 'Ishtar Landing',
  subtitle: 'Ishtar Terra, surface, 460 °C',
  brief: 'The Hive was calling Venus. Cross the sulfur flats under the acid rain, restart the coolant pumps and get inside the Ishtar domes before the heat does it for them.',
  diff: outerMods(1),
  theme: { ...HAZE, music: 50 },
  build(world, rng) {
    const d = outerDiff(1);
    ground(world, 460, 'sulfur', { uv: 0.18, bumpy: 0.7, seg: 70, mat: { color: 0x9a8458 } });
    landingPad(world, -16, 116, 9, 0xffd27a);
    rocket(world, -16, 116, 0.75, 0xd8a020);
    scorch(world, -16, 116, 20);
    // marker posts down the safe lane, amber lamps glowing through the haze
    for (let z = 100; z > -112; z -= 14) for (const s of [-1, 1]) {
      world.box(s * 7, 0.8, z, 0.2, 1.6, 0.2, 'rust', { uv: 1, collide: false, mat: { color: 0x3a3226, metalness: 0.5 } });
      world.box(s * 7, 1.65, z, 0.26, 0.14, 0.26, 'plaster', { uv: 1, collide: false, mat: { color: 0xffc040, emissive: 0xffa020, emissiveIntensity: 2 } });
    }
    for (let z = 96; z > -100; z -= 40) for (const s of [-1, 1]) world.light(0xffc060, 5, s * 7, 3, z, 18);
    boulders(world, rng, 70, -86, 86, 120, -200, 'redrock', 0x5a4a32, 9, [[-40, -30, 12], [40, -50, 12], [0, -150, 34], [-16, 116, 14], [12, 70, 6], [-14, 18, 6], [40, 10, 10]]);
    cliff(world, -90, 130, -90, -210, 16, rng, 'redrock', { out: [-1, 0], tint: 0x6a5a3a });
    cliff(world, 90, 130, 90, -210, 16, rng, 'redrock', { out: [1, 0], tint: 0x6a5a3a });
    const hazards = pools(world, rng, [[-22, 60, 4], [26, 34, 5], [-30, 6, 4.5], [20, -20, 3.5], [-18, -64, 5], [30, -92, 4]]);

    // the coolant pumps: a pressure sphere each, pipes running back to the domes
    tankSphere(world, -46, -30, 4, 0xd8ccb0);
    terminal(world, -38, 0, -30, Math.PI / 2, 'PUMP WEST');
    tankSphere(world, 46, -50, 4, 0xd8ccb0);
    terminal(world, 38, 0, -50, -Math.PI / 2, 'PUMP EAST');
    pipes(world, -46, 0.4, -36, -12, -128, rng, 0xb8a070, 2);
    pipes(world, 46, 0.4, -56, 14, -130, rng, 0xb8a070, 2);
    rover(world, 12, 70, 0.6, rng, 0xd8ccb0);
    rover(world, -14, 18, 2.4, rng, 0xc8bca0);
    container(world, 24, 88, 0.2, 0xb88a2a, rng, 2);
    container(world, -26, 62, -0.4, 0x8a7a5a, rng);
    hullChunk(world, 40, 10, 12, 2.6, 0.7, rng, 0.8);       // a lander that didn't make it down
    for (let i = 0; i < 4; i++) barrel(world, rng.range(-30, 30), rng.range(-110, 40), rng);

    // the Ishtar domes, heat-shielded, the airlock facing you
    dome(world, 0, -142, 14, rng, { tint: 0xe0d0a8, door: 0, windowColour: 0xffc860 });
    dome(world, -36, -158, 10, rng, { tint: 0xd8c8a0, door: Math.PI / 4, windowColour: 0xffc860 });
    dome(world, 36, -160, 11, rng, { tint: 0xd8c8a0, door: -Math.PI / 4, windowColour: 0xffc860 });
    module(world, 0, -178, 18, 2.6, 0, rng, { label: 'ISHTAR', labelColour: '#ffd27a' });
    for (let i = 0; i < 6; i++) bloodPool(world, rng.range(-10, 10), rng.range(-120, -70), rng.range(1, 2.4), i + 1900);

    world.playerStart.set(0, 0, 104);
    world.playerFacing = 0;

    return {
      hazards,
      stages: [
        {
          text: 'Cross the sulfur flats toward the Ishtar domes', kind: 'reach', zone: zone(0, 0, 30, 10, 0, 8),
          onEnterText: 'Stay out of the green pools. The acid burns.',
          spawns: [...horde(rng, 14, ['scorched', 'scorched', 'acidCrawler'], -26, 26, 88, 10), sp('acidSpitter', -10, 24), sp('acidSpitter', 12, 16)]
        },
        {
          text: 'Restart the coolant pumps', kind: 'interact', count: 2,
          spawns: [...horde(rng, 7, ACID, -56, -28, -16, -44), ...horde(rng, 7, ACID, 28, 56, -36, -64)]
        },
        {
          text: 'Clear the dome yards', kind: 'kill', count: 26,
          onEnterText: 'Heat suits: the visors are already cracked. Aim there.',
          spawns: [...horde(rng, 24, ALL, -40, 40, -62, -118), sp('heatSuit', -12, -100), sp('heatSuit', 12, -104)]
        },
        {
          text: 'Into the Ishtar airlock', kind: 'reach', zone: zone(0, -122.5, 6, 3, 0, 6),
          spawns: [...horde(rng, 8, ACID, -24, 24, -70, -116), sp('heatSuit', -6, -118), sp('heatSuit', 6, -118)]
        }
      ],
      pickups: [
        ['ammo', 3, 0, 88], ['health', -4, 0, 56], ['ammo', 4, 0, 24], ['armour', -30, 0, -16],
        ['ammo', 30, 0, -40], ['health', 0, 0, -40], ['ammo', -8, 0, -90], ['health', 8, 0, -112]
      ]
    };
  }
};

/* ================================================================ 20 */
export const VENUS_2 = {
  id: 20, world: 'venus',
  name: 'Aphrodite Habitat',
  subtitle: 'Under the Ishtar domes',
  brief: 'The habitat under the domes is cooking. Get through arrivals to the atrium, restore the three heat shields, and hold the control room until the lift to the cloud city is safe.',
  diff: outerMods(2),
  theme: { ...INSIDE, music: 49 },
  build(world, rng) {
    const d = outerDiff(2);
    ground(world, 420, 'grate', { uv: 0.4, mat: { color: 0x6a645a } });
    const warm = 0xffd8a0, wall = 0xc8bca0;
    // arrivals
    hall(world, 0, 72, 14, 28, 4.2, { doors: { north: [0, 3.6, 3] }, wall, light: warm, floor: 0x8a8478 });
    for (let k = -1; k <= 1; k++) world.box(5, 0.5, 72 + k * 6, 2, 1, 3, 'hull', { uv: 0.6, mat: { color: 0x9a8a6a, repeat: 1 } });   // baggage benches
    crates(world, -4, 66, rng, 3);
    corridor(world, 0, 58, 0, 48, 4.2, rng, { w: 4, wall, light: warm });
    // the atrium: a sunken garden under a glowing heat exchanger
    hall(world, 0, 28, 34, 40, 9, { doors: { south: [0, 3.6, 3], north: [0, 3.6, 3], west: [0, 3.6, 3], east: [0, 3.6, 3] }, wall, light: warm, lightPower: 5 });
    world.cylinder(0, 0.6, 28, 3, 3.2, 1.2, 'hull', { seg: 20, mat: { repeat: 1, color: 0x8a7a5a, metalness: 0.6 }, tag: 'exchanger' });
    world.shape(new THREE.CylinderGeometry(1.2, 1.2, 7.4, 16, 1, true), 'plaster', { pos: [0, 4.9, 28], collide: false, mat: { color: 0xffc860, emissive: 0xffa030, emissiveIntensity: 1.6 } });
    world.collider(0, 4.5, 28, 2.6, 9, 2.6, 0, 'exchanger');
    world.light(0xffb040, 8, 0, 4, 28, 24);
    planter(world, -11, 28, 16, false, rng);
    planter(world, 11, 28, 16, false, rng);
    for (const s of [-1, 1]) screen(world, s * 16.7, 4, 16, 5, 2.4, -s * Math.PI / 2, 0xffc040);
    for (let i = 0; i < 6; i++) bloodPool(world, rng.range(-8, 8), rng.range(12, 44), rng.range(1, 2.4), i + 2000);
    // west: heat exchange; east: the cooling plant
    corridor(world, -17, 28, -37, 28, 4.2, rng, { w: 4, wall, light: warm });
    corridor(world, 17, 28, 37, 28, 4.2, rng, { w: 4, wall, light: warm });
    for (const s of [-1, 1]) {
      const rx = s * 50;
      hall(world, rx, 28, 26, 24, 5, { doors: s < 0 ? { east: [0, 3.6, 3] } : { west: [0, 3.6, 3] }, wall, light: s < 0 ? 0xff9a40 : 0xa8d8ff, lightPower: 4 });
      terminal(world, rx + s * 9, 0, 28, -s * Math.PI / 2, s < 0 ? 'SHIELD WEST' : 'SHIELD EAST');
      for (let k = -1; k <= 1; k += 2) {
        world.cylinder(rx + k * 6, 2, 28 - 8.5, 1.4, 1.4, 4, 'hull', { seg: 14, mat: { repeat: 1, color: 0xb8a888, metalness: 0.5 }, tag: 'tank' });
        world.cylinder(rx + k * 6, 2, 28 + 8.5, 1.4, 1.4, 4, 'hull', { seg: 14, mat: { repeat: 1, color: 0xb8a888, metalness: 0.5 }, tag: 'tank' });
      }
      pipes(world, rx - 12, 4.2, 28 - 10.5, rx + 12, 28 - 10.5, rng, 0xb8a070, 3);
      crates(world, rx - s * 6, 28 + rng.range(-3, 3), rng, 2);
    }
    // north: the control room
    corridor(world, 0, 8, 0, -4, 4.2, rng, { w: 4, wall, light: warm });
    hall(world, 0, -22, 30, 36, 7, { doors: { south: [0, 3.6, 3], north: [0, 4, 3.2] }, wall, light: 0xfff0d0, lightPower: 4.5 });
    terminal(world, 0, 0, -30, 0, 'SHIELD CORE');
    for (const s of [-1, 1]) {
      for (let k = -1; k <= 1; k++) world.box(s * 9, 0.6, -22 + k * 8, 3, 1.2, 1.5, 'hull', { uv: 0.6, mat: { color: 0x3a362e, repeat: 1, metalness: 0.6 } });
      screen(world, s * 14.7, 3.8, -22, 8, 3, -s * Math.PI / 2, s < 0 ? 0xffc040 : 0xff7040);
    }
    crates(world, -10, -36, rng, 3);
    crates(world, 10, -8, rng, 2);
    // the lift up to the cloud city
    corridor(world, 0, -40, 0, -52, 4.2, rng, { w: 4.4, wall, light: warm });
    hall(world, 0, -66, 20, 28, 8, { doors: { south: [0, 4, 3.2] }, wall, light: 0xfff0d0 });
    world.cylinder(0, 0.15, -70, 3.2, 3.2, 0.3, 'grate', { seg: 24, mat: { color: 0xd8b040 }, tag: 'lift' });
    world.shape(new THREE.TorusGeometry(3.3, 0.12, 6, 30).rotateX(Math.PI / 2), 'plaster', { pos: [0, 0.32, -70], collide: false, mat: { color: 0xffd27a, emissive: 0xffb040, emissiveIntensity: 2 } });
    for (const s of [-1, 1]) world.box(s * 3.6, 4, -70, 0.3, 8, 0.3, 'rust', { uv: 1, mat: { color: 0x8a8e96, metalness: 0.6 } });
    world.light(0xffd27a, 6, 0, 3, -70, 14);
    world.sign('LIFT — CYTHEREA', 0, 6, -79.6, 0, 6, '#ffd27a');

    world.playerStart.set(0, 0, 80);
    world.playerFacing = 0;

    return {
      stages: [
        {
          text: 'Through arrivals to the atrium', kind: 'reach', zone: zone(0, 40, 12, 6, 0, 6),
          spawns: [...horde(rng, 4, ['scorched', 'acidCrawler'], -5, 5, 62, 59), ...horde(rng, 10, ACID, -14, 14, 44, 12), sp('acidSpitter', -12, 20), sp('heatSuit', 10, 14)]
        },
        {
          text: 'Restore the heat shields: west, east and core', kind: 'interact', count: 3,
          spawns: [...horde(rng, 6, ALL, -60, -40, 20, 36), ...horde(rng, 6, ALL, 40, 60, 20, 36), ...horde(rng, 6, ALL, -12, 12, -36, -8)]
        },
        {
          text: 'Hold the control room while the shields cycle', kind: 'defend', duration: 50,
          ...waves(d, { waveKinds: ALL }),
          wavePoints: [[0, 0, 28], [-50, 0, 28], [50, 0, 28], [0, 0, -66]],
          onEnterText: 'SHIELDS CYCLING — 50 SECONDS'
        },
        {
          text: 'Ride the lift up to the cloud city', kind: 'reach', zone: zone(0, -70, 6, 6, 0, 6),
          spawns: [sp('heatSuit', -6, -62), sp('heatSuit', 6, -62), sp('acidCrawler', 0, -58)]
        }
      ],
      pickups: [
        ['ammo', 1.5, 0, 66], ['health', -12, 0, 40], ['ammo', 12, 0, 16], ['armour', -56, 0, 22],
        ['ammo', 56, 0, 34], ['health', 0, 0, -12], ['ammo', 8, 0, -36], ['health', -6, 0, -58]
      ]
    };
  }
};

/* ================================================================ 21 */
export const VENUS_3 = {
  id: 21, world: 'venus',
  name: 'Cytherea',
  subtitle: 'The cloud city, 54 km up',
  brief: 'A city of decks hung from gas envelopes over the clouds. Clear the market, trim the ballast before the city sinks, and hold the spire deck while it climbs.',
  diff: outerMods(3),
  theme: { ...HIGH, music: 52 },
  build(world, rng) {
    const d = outerDiff(3);
    voidGround(world, 460);
    cloudSea(world, 0xe8d090, -46, { upper: 0xf4e4b8, glow: 0x3a2a08 });
    stormTowers(world, 9, rng, 0xf0dca0, { base: -60, opacity: 0.6 });
    const DECK = { colour: 0x9a9284, underLight: 0xffc060 };
    // the landing deck
    deck(world, 0, 90, 40, 36, { ...DECK, gaps: { north: [[0, 5]] } });
    landingPad(world, -9, 96, 7, 0xffd27a);
    rocket(world, -9, 96, 0.5, 0xd8a020);
    container(world, 12, 98, 0.1, 0xb88a2a, rng);
    crates(world, 13, 82, rng, 3);
    bridge(world, 0, 72, 0, 52, 5, { light: 0xffd27a });
    // the market deck: stalls under striped awnings, a planter garden, the big envelope overhead
    deck(world, 0, 30, 50, 44, { ...DECK, gaps: { south: [[0, 5]], north: [[0, 5]], west: [[0, 5]], east: [[0, 5]] } });
    envelope(world, 0, 34, 30, 44, 13, 0, 0xe8d8b0);
    const stall = (x, z, rot, col) => {
      world.box(x, 0.55, z, 3.2, 1.1, 1.4, 'hull', { rotY: rot, uv: 0.6, mat: { color: 0x8a7a5a, repeat: 1 } });
      world.box(x, 2.5, z, 3.6, 0.1, 2.4, 'plaster', { rotY: rot, uv: 1, collide: false, mat: { color: col } });
      for (const s of [-1, 1]) world.box(x + Math.cos(rot) * s * 1.6, 1.25, z - Math.sin(rot) * s * 1.6, 0.08, 2.5, 0.08, 'rust', { uv: 1, collide: false });
    };
    for (let i = 0; i < 4; i++) {
      stall(-14, 46 - i * 9, 0, [0xc8402a, 0x2a6aa8, 0xd8a020, 0x6a3a8a][i]);
      stall(14, 46 - i * 9, 0, [0x2a8a5a, 0xc8402a, 0xd8a020, 0x2a6aa8][i]);
    }
    planter(world, -8, 30, 8, true, rng);
    planter(world, 8, 30, 8, true, rng);
    for (let i = 0; i < 5; i++) bloodPool(world, rng.range(-18, 18), rng.range(12, 48), rng.range(1, 2.2), i + 2100);
    trash(world, -6, 18, rng, 6);
    // ballast decks either side
    bridge(world, -25, 30, -45, 30, 5, { light: 0xffd27a });
    bridge(world, 25, 30, 45, 30, 5, { light: 0xffd27a });
    for (const s of [-1, 1]) {
      const bx = s * 65;
      deck(world, bx, 30, 40, 30, { ...DECK, gaps: s < 0 ? { east: [[0, 5]] } : { west: [[0, 5]] } });
      tankSphere(world, bx + s * 9, 20, 4, 0xd8ccb0);
      tankSphere(world, bx + s * 9, 40, 4, 0xd8ccb0);
      terminal(world, bx + s * 9, 0, 30, -s * Math.PI / 2, s < 0 ? 'BALLAST WEST' : 'BALLAST EAST');
      envelope(world, bx, 26, 30, 30, 9, Math.PI / 2, 0xe0d0a8);
      pipes(world, bx - 12, 0.4, 24, bx + 12, 24, rng, 0xb8a070, 2);
      crates(world, bx - s * 6, 22, rng, 2);
    }
    // the spire deck: the city's mast, crates for cover, the biggest envelope of all
    bridge(world, 0, 8, 0, -14, 5, { light: 0xffd27a });
    deck(world, 0, -40, 56, 52, { ...DECK, gaps: { south: [[0, 5]], north: [[0, 5]] } });
    world.cylinder(0, 12, -44, 1.2, 2.4, 24, 'hull', { seg: 16, mat: { repeat: 2, color: 0xd8d0b8, metalness: 0.5 }, tag: 'spire' });
    for (let y = 4; y < 24; y += 5) world.shape(new THREE.TorusGeometry(2, 0.1, 6, 24), 'plaster', { pos: [0, y, -44], rot: [Math.PI / 2, 0, 0], collide: false, mat: { color: 0xffd27a, emissive: 0xffb040, emissiveIntensity: 1.5 } });
    world.light(0xffc060, 7, 0, 4, -44, 26);
    envelope(world, 0, 42, -40, 56, 17, 0, 0xf0e0b8);
    for (const [x, z] of [[-16, -24], [16, -26], [-18, -54], [18, -56], [-8, -34], [9, -52]]) crates(world, x, z, rng, 3);
    module(world, -20, -40, 10, 2, Math.PI / 2, rng, { label: 'HELM' });
    module(world, 20, -40, 10, 2, Math.PI / 2, rng, { label: 'GAS' });
    for (let i = 0; i < 4; i++) barrel(world, rng.range(-22, 22), rng.range(-60, -20), rng);
    // the shuttle deck
    bridge(world, 0, -66, 0, -86, 5, { light: 0xffd27a });
    deck(world, 0, -104, 36, 36, { ...DECK, gaps: { south: [[0, 5]] } });
    landingPad(world, 0, -108, 9, 0xffd27a);
    rocket(world, 0, -110, 0.6, 0xd8a020);

    world.playerStart.set(0, 0, 100);
    world.playerFacing = 0;

    return {
      stages: [
        {
          text: 'Cross the bridge to the market deck', kind: 'reach', zone: zone(0, 44, 20, 6, 0, 6),
          onEnterText: 'The rails hold. The drop does not end.',
          spawns: [...horde(rng, 3, ['acidCrawler'], -14, 14, 84, 78), ...horde(rng, 13, ACID, -20, 20, 48, 12), sp('acidSpitter', -16, 14), sp('acidSpitter', 16, 16)]
        },
        {
          text: 'Clear the market deck', kind: 'kill', count: 30,
          spawns: [...horde(rng, 22, ALL, -20, 20, 48, 12), ...horde(rng, 8, ACID, -22, 22, -22, -60), sp('heatSuit', -10, 14), sp('heatSuit', 10, 14)]
        },
        {
          text: 'Trim the ballast, west and east, before the city sinks', kind: 'interact', count: 2,
          onEnterText: 'CYTHEREA IS LOSING ALTITUDE',
          spawns: [...horde(rng, 7, ALL, -80, -50, 18, 42), ...horde(rng, 7, ALL, 50, 80, 18, 42)]
        },
        {
          text: 'Hold the spire deck while the city climbs', kind: 'defend', duration: 55,
          ...waves(d, { waveKinds: ALL }),
          wavePoints: [[-22, 0, -20], [22, 0, -20], [-22, 0, -62], [22, 0, -62], [0, 0, -104], [0, 0, 30]],
          onEnterText: 'BLOWING BALLAST — 55 SECONDS'
        },
        {
          text: 'To the shuttle deck', kind: 'reach', zone: zone(0, -92, 8, 4, 0, 6),
          spawns: [sp('heatSuit', -8, -98), sp('heatSuit', 8, -98), ...horde(rng, 4, ['acidCrawler', 'acidSpitter'], -12, 12, -96, -116)]
        }
      ],
      pickups: [
        ['ammo', 4, 0, 84], ['health', -4, 0, 48], ['ammo', 4, 0, 10], ['armour', -72, 0, 30],
        ['ammo', 72, 0, 30], ['health', -10, 0, -30], ['ammo', 10, 0, -60], ['health', 6, 0, -96]
      ]
    };
  }
};

/* ================================================================ 22 */
export const VENUS_4 = {
  id: 22, world: 'venus',
  name: 'Sulfur Works',
  subtitle: 'Refinery valley, Aphrodite Terra',
  brief: 'The refinery that feeds the cloud city is choking on its own acid. Run the tank farm, open three relief valves before it blows, and clear the smelter yard.',
  diff: outerMods(4),
  theme: { ...HAZE, skyGlow: 0xd89a50, fog: 0x704a1c, sun: { colour: 0xffd090, intensity: 0.75, pos: [-40, 60, -30] }, music: 48 },
  build(world, rng) {
    const d = outerDiff(4);
    ground(world, 460, 'sulfur', { uv: 0.18, bumpy: 0.5, seg: 70, mat: { color: 0x8a7850 } });
    cliff(world, -70, 130, -70, -172, 18, rng, 'redrock', { out: [-1, 0], tint: 0x5a4a30 });
    cliff(world, 70, 130, 70, -172, 18, rng, 'redrock', { out: [1, 0], tint: 0x5a4a30 });
    cliff(world, -72, -174, 72, -174, 20, rng, 'redrock', { out: [0, -1], tint: 0x5a4a30 });
    world.box(0, 0.03, -20, 10, 0.06, 250, 'asphalt', { uv: 0.3, collide: false, mat: { color: 0x4a4030 } });
    boulders(world, rng, 30, -64, 64, 120, -160, 'redrock', 0x5a4a30, 12, [[-38, 4, 12], [38, -84, 12], [0, -40, 26], [0, -150, 10]]);
    const hazards = pools(world, rng, [[-18, 70, 4], [22, 50, 5], [-24, 20, 4], [20, -8, 3.5], [-26, -80, 5], [24, -110, 4.5], [-14, -124, 3]], 18);
    // the tank farm
    for (const [x, z, r] of [[-42, 4, 5], [-40, 56, 4], [40, 76, 5], [44, 24, 4], [42, -84, 5], [-44, -110, 4]]) tankSphere(world, x, z, r, 0xd8c8a0);
    for (const [x, z, h] of [[-30, 90, 16], [32, 100, 18], [-36, -140, 20], [36, -132, 16]]) drillRig(world, x, z, h, rng, 0xd8a830);
    pipes(world, -42, 0.5, 4, 0, -26, rng, 0xb8a070, 3);
    pipes(world, 42, 0.5, -84, 0, -54, rng, 0xb8a070, 3);
    pipes(world, -40, 4.5, 56, 40, 76, rng, 0x8a7a5a, 2);
    terminal(world, -34, 0, 4, Math.PI / 2, 'VALVE A');
    terminal(world, 34, 0, -84, -Math.PI / 2, 'VALVE C');
    // the smelter hall straddles the road
    hall(world, 0, -40, 36, 28, 8, { doors: { south: [0, 6, 5], north: [0, 6, 5] }, wall: 0x8a7a5a, light: 0xffb060, lightPower: 5 });
    for (const s of [-1, 1]) {
      world.cylinder(s * 12, 2.5, -34, 2.4, 2.8, 5, 'hull', { seg: 16, mat: { repeat: 1, color: 0x5a4a3a, metalness: 0.6 }, tag: 'furnace' });
      world.shape(new THREE.CylinderGeometry(2.45, 2.45, 0.6, 16, 1, true), 'plaster', { pos: [s * 12, 3.2, -34], collide: false, mat: { color: 0xff8a20, emissive: 0xff6010, emissiveIntensity: 2 } });
      world.light(0xff7a20, 6, s * 12, 3, -34, 16);
      world.box(s * 6, 0.6, -46, 3, 1.2, 8, 'rust', { uv: 0.5, mat: { color: 0x4a4038, metalness: 0.6 } });   // conveyors
    }
    terminal(world, 13, 0, -48, -Math.PI / 2, 'VALVE B');
    crates(world, -12, -48, rng, 3);
    for (let i = 0; i < 6; i++) bloodPool(world, rng.range(-14, 14), rng.range(-52, -28), rng.range(1, 2.2), i + 2200);
    // the yard beyond: containers, ore carts, a crawler on its side
    for (let i = 0; i < 7; i++) container(world, rng.sign() * rng.range(14, 50), rng.range(-150, -64), rng.range(-0.5, 0.5), rng.pick([0xb88a2a, 0x8a7a5a, 0x6a5a3a]), rng, rng.int(1, 2));
    hullChunk(world, -20, -96, 14, 3, 1.4, rng, 1.2);
    for (let i = 0; i < 6; i++) barrel(world, rng.range(-40, 40), rng.range(-150, 60), rng);
    world.sign('SPIRE ROAD', 0, 4, -150, 0, 6, '#ffd27a');
    world.box(0, 2, -150.4, 7, 4, 0.4, 'rust', { uv: 0.5, mat: { color: 0x3a3226 } });

    world.playerStart.set(0, 0, 108);
    world.playerFacing = 0;

    return {
      hazards,
      stages: [
        {
          text: 'Through the tank farm to the smelter', kind: 'reach', zone: zone(0, -18, 20, 8, 0, 8),
          spawns: [...horde(rng, 16, ACID, -30, 30, 90, -10), sp('heatSuit', -8, 6), sp('heatSuit', 8, -4), sp('acidSpitter', 0, 40)]
        },
        {
          text: 'Open the three relief valves', kind: 'interact', count: 3,
          onEnterText: 'PRESSURE CRITICAL',
          spawns: [...horde(rng, 6, ALL, -50, -24, 16, -8), ...horde(rng, 6, ALL, -14, 14, -30, -50), ...horde(rng, 6, ALL, 24, 54, -70, -96)]
        },
        {
          text: 'Clear the smelter yard', kind: 'kill', count: 32,
          spawns: [...horde(rng, 30, ALL, -40, 40, -62, -140), sp('heatSuit', -10, -120), sp('heatSuit', 10, -124), sp('heatSuit', 0, -80)]
        },
        {
          text: 'Up the spire road', kind: 'reach', zone: zone(0, -140, 16, 8, 0, 8),
          spawns: [...horde(rng, 8, ALL, -30, 30, -110, -146)]
        }
      ],
      pickups: [
        ['ammo', 3, 0, 90], ['health', -4, 0, 40], ['ammo', 4, 0, 0], ['armour', -10, 0, -30],
        ['ammo', 8, 0, -52], ['health', -30, 0, -70], ['ammo', 30, 0, -100], ['health', 0, 0, -132]
      ]
    };
  }
};

/* ================================================================ 23 */
export const VENUS_5 = {
  id: 23, world: 'venus',
  name: 'Maxwell Spire',
  subtitle: 'Maxwell Montes, eleven kilometres up',
  brief: 'The tallest mountain on Venus carries the deep-space relay. Align its three masts, then hold the control room while it traces where the Hive signal really comes from.',
  diff: outerMods(5),
  theme: { ...HAZE, skyTop: 0x2a1806, skyHorizon: 0x8a5a22, fog: 0x664418, fogDensity: 0.013, hemi: [0xffcc80, 0x3a2410, 0.55], music: 51, tempo: 1.2 },
  build(world, rng) {
    const d = outerDiff(5);
    ground(world, 460, 'sulfur', { uv: 0.18, bumpy: 1.1, seg: 70, mat: { color: 0x7a6848 } });
    // a pass that widens into the summit plateau
    cliff(world, -40, 130, -40, 50, 18, rng, 'redrock', { out: [-1, 0], tint: 0x4a3a28 });
    cliff(world, 40, 130, 40, 50, 18, rng, 'redrock', { out: [1, 0], tint: 0x4a3a28 });
    cliff(world, -40, 48, -80, 48, 18, rng, 'redrock', { out: [0, 1], tint: 0x4a3a28 });
    cliff(world, 40, 48, 80, 48, 18, rng, 'redrock', { out: [0, 1], tint: 0x4a3a28 });
    cliff(world, -80, 46, -80, -150, 22, rng, 'redrock', { out: [-1, 0], tint: 0x4a3a28 });
    cliff(world, 80, 46, 80, -150, 22, rng, 'redrock', { out: [1, 0], tint: 0x4a3a28 });
    cliff(world, -82, -152, 82, -152, 24, rng, 'redrock', { out: [0, -1], tint: 0x4a3a28 });
    boulders(world, rng, 40, -74, 74, 120, -146, 'redrock', 0x4a3a28, 10, [[-46, 20, 12], [50, -6, 12], [-48, -72, 12], [0, -60, 26], [0, -100, 10], [-24, -116, 10], [24, -118, 8]]);
    const hazards = pools(world, rng, [[-20, 90, 3.5], [22, 70, 4], [-50, -20, 4.5], [56, -90, 4], [-58, -120, 4]], 18);
    // the three relay masts, each with its hut
    const relays = [[-50, 20, Math.PI / 2], [54, -6, -Math.PI / 2], [-52, -72, Math.PI / 2]];
    relays.forEach(([x, z, r], i) => {
      mast(world, x, z, 20, rng);
      const hx = x + Math.sin(r) * 7;
      module(world, hx, z + 6, 6, 1.6, r, rng, { label: 'RELAY ' + (i + 1), labelColour: '#ffd27a' });
      terminal(world, hx, 0, z, r, 'RELAY ' + (i + 1));
    });
    // spire control, and the spire itself behind it
    hall(world, 0, -60, 36, 28, 7, { doors: { south: [0, 6, 4.4], north: [0, 4, 3.2] }, wall: 0xc8bca0, light: 0xfff0d0, lightPower: 4.5 });
    for (const s of [-1, 1]) {
      for (let k = -1; k <= 1; k++) world.box(s * 11, 0.6, -60 + k * 7, 3, 1.2, 1.5, 'hull', { uv: 0.6, mat: { color: 0x3a362e, repeat: 1, metalness: 0.6 } });
      screen(world, s * 17.7, 3.8, -60, 9, 3, -s * Math.PI / 2, 0xffc040);
    }
    crates(world, -6, -68, rng, 3);
    crates(world, 8, -52, rng, 2);
    world.cylinder(0, 30, -100, 1.6, 4, 60, 'hull', { seg: 16, mat: { repeat: 3, color: 0xd8d0b8, metalness: 0.5 }, tag: 'spire' });
    for (let y = 10; y < 60; y += 10) {
      world.shape(new THREE.TorusGeometry(4 - y / 20, 0.15, 6, 24), 'plaster', { pos: [0, y, -100], rot: [Math.PI / 2, 0, 0], collide: false, mat: { color: 0xff3020, emissive: 0xff2010, emissiveIntensity: 1.8 } });
    }
    world.shape(new THREE.SphereGeometry(5, 20, 10, 0, TAU, 0, Math.PI / 2.6), 'hull', { pos: [1.5, 44, -100], rot: [-1.0, 0.4, 0], collide: false, mat: { repeat: 1, metalness: 0.5 } });
    world.light(0xff3020, 6, 0, 58, -100, 40);
    world.light(0xffc060, 6, 0, 4, -94, 20);
    rover(world, -24, -120, Math.PI / 2, rng, 0xd8ccb0);
    container(world, 24, -118, 0.3, 0xb88a2a, rng, 2);
    for (let i = 0; i < 5; i++) barrel(world, rng.range(-40, 40), rng.range(-130, 30), rng);
    for (let i = 0; i < 6; i++) bloodPool(world, rng.range(-30, 30), rng.range(-120, 40), rng.range(1, 2.6), i + 2300);

    world.playerStart.set(0, 0, 112);
    world.playerFacing = 0;

    return {
      hazards,
      stages: [
        {
          text: 'Climb the pass to the summit', kind: 'reach', zone: zone(0, 30, 30, 8, 0, 8),
          spawns: [...horde(rng, 16, ACID, -24, 24, 96, 40), sp('heatSuit', -10, 44), sp('heatSuit', 10, 40)]
        },
        {
          text: 'Align the three relay masts', kind: 'interact', count: 3,
          spawns: [...horde(rng, 6, ALL, -70, -36, 34, 6), ...horde(rng, 6, ALL, 36, 72, 8, -20), ...horde(rng, 6, ALL, -70, -36, -58, -86)]
        },
        {
          text: 'Into spire control', kind: 'reach', zone: zone(0, -52, 10, 6, 0, 6),
          spawns: [...horde(rng, 8, ALL, -14, 14, -48, -70), sp('heatSuit', -12, -40), sp('heatSuit', 12, -40)]
        },
        {
          text: 'Hold control while the relay traces the signal', kind: 'defend', duration: 60,
          ...waves(d, { waveKinds: ALL }),
          wavePoints: [[0, 0, -20], [-40, 0, -60], [40, 0, -60], [-30, 0, -110], [30, 0, -100]],
          onEnterText: 'TRACING THE SIGNAL — 60 SECONDS'
        },
        {
          text: 'Out the back to the rover', kind: 'reach', zone: zone(-24, -112, 8, 4, 0, 6),
          onEnterText: 'The trace points out past the asteroid belt. Jupiter.',
          spawns: [sp('heatSuit', -16, -96), sp('heatSuit', 16, -96), ...horde(rng, 5, ['acidCrawler', 'acidSpitter'], -30, 30, -90, -130)]
        }
      ],
      pickups: [
        ['ammo', 3, 0, 96], ['health', -4, 0, 60], ['ammo', 0, 0, 20], ['armour', -40, 0, 0],
        ['ammo', 40, 0, -30], ['health', -10, 0, -62], ['ammo', 10, 0, -66], ['health', -14, 0, -110]
      ]
    };
  }
};

/* ================================================================ 24 */
export const VENUS_6 = {
  id: 24, world: 'venus', flight: 'jupiter',
  name: 'The Furnace',
  subtitle: 'Sapas caldera — the Venus nest',
  brief: 'The signal is relayed through a nest in a live caldera. Burn out the brood, kill the Sulfur Tyrant, and hold the shuttle until it can lift for Jupiter.',
  diff: outerMods(6),
  theme: {
    ...HAZE, skyTop: 0x3a1a08, skyHorizon: 0xa8582a, skyGround: 0x2a1008, skyGlow: 0xff8a30, glowDir: [0, 0.2, -1],
    fog: 0x5a2c12, fogDensity: 0.0125, hemi: [0xffb070, 0x2a1206, 0.6], sun: { colour: 0xffc080, intensity: 0.75, pos: [-30, 60, -60] }, music: 47, tempo: 1.25
  },
  build(world, rng) {
    const d = outerDiff(6);
    ground(world, 420, 'sulfur', { uv: 0.2, bumpy: 0.8, seg: 70, mat: { color: 0x6a5434 } });
    // the caldera walls box in an arena; the way in is the gully from the south
    const R = 64;
    const C = (a, b, c, e, h, out) => cliff(world, a, b, c, e, h, rng, 'redrock', { out, tint: 0x4a3020 });
    C(-R, 40, -R, -140, 24, [-1, 0]);
    C(R, 40, R, -140, 24, [1, 0]);
    C(-R, -142, R, -142, 26, [0, -1]);
    C(-R, 42, -10, 42, 22, [0, 1]);
    C(10, 42, R, 42, 22, [0, 1]);
    C(-10, 44, -10, 120, 16, [-1, 0]);
    C(10, 44, 10, 120, 16, [1, 0]);
    C(-10, 122, 10, 122, 14, [0, 1]);
    boulders(world, rng, 26, -58, 58, 36, -136, 'redrock', 0x4a3020, 6, [[0, -126, 16], [0, -62, 16]]);
    // vents of acid and the nest grown over them: blistered growths, pods that glow green
    const hazards = pools(world, rng, [[-30, 0, 5], [32, -10, 4.5], [-40, -90, 5], [40, -100, 5], [-18, -40, 3.5], [22, -128, 3.5]], 20);
    const growth = { color: 0x8a7a3a, emissive: 0x1a2a00, roughness: 0.5 };
    const pod = { color: 0xd8ff5a, emissive: 0xb8f02a, emissiveIntensity: 1.6 };
    for (let i = 0; i < 44; i++) {
      const a = rng() * TAU, r = rng.range(8, 56);
      const x = Math.cos(a) * r, z = -60 + Math.sin(a) * r * 1.2;
      if (Math.abs(x) < 6 && z > -40) continue;
      if (Math.abs(x) < 12 && z < -112) continue;      // keep the shuttle pad clear
      const s = rng.range(0.8, 3.2);
      world.shape(new THREE.SphereGeometry(1, 12, 8), 'flesh', { pos: [x, s * 0.2, z], scale: [s * rng.range(1, 1.8), s * rng.range(0.5, 1), s * rng.range(1, 1.6)], rot: [0, rng() * TAU, 0], uv: 2, collide: false, mat: growth });
      if (s > 2.2) world.collider(x, s * 0.4, z, s * 1.6, s * 0.8, s * 1.6, 0, 'growth');
      for (let k = 0; k < 3; k++) {
        if (!rng.chance(0.6)) continue;
        world.shape(new THREE.SphereGeometry(0.3, 8, 6), 'plaster', { pos: [x + rng.range(-s, s), s * 0.6 + rng.range(0, 0.4), z + rng.range(-s, s)], scale: [1, 1.4, 1], collide: false, shadow: false, mat: pod });
      }
      if (i % 5 === 0) world.light(0xc8ff3a, 5, x, 2, z, 16);
    }
    for (let i = 0; i < 22; i++) {
      const side = rng.pick([[-R + 2, rng.range(-130, 30)], [R - 2, rng.range(-130, 30)], [rng.range(-60, 60), -140]]);
      world.shape(new THREE.CylinderGeometry(0.4, 0.8, rng.range(8, 18), 7), 'flesh', { pos: [side[0], 4, side[1]], rot: [rng.range(-0.3, 0.3), 0, rng.range(-0.4, 0.4)], collide: false, mat: growth });
    }
    // the heart of it: a magma pit glowing under the nest
    world.shape(new THREE.TorusGeometry(14, 0.8, 6, 40), 'redrock', { pos: [0, 0.3, -60], rot: [Math.PI / 2, 0, 0], collide: false, mat: { color: 0x3a2a1a } });
    world.shape(new THREE.CircleGeometry(13.4, 40).rotateX(-Math.PI / 2), 'plaster', { pos: [0, 0.04, -60], collide: false, shadow: false, mat: { color: 0x3a1a04, emissive: 0xff6a10, emissiveIntensity: 0.9 } });
    world.light(0xff7a20, 12, 0, 6, -60, 40);
    for (let i = 0; i < 3; i++) module(world, rng.sign() * rng.range(30, 50), rng.range(-130, -20), rng.range(8, 12), 2.2, rng() * TAU, rng, { lit: false });
    for (let i = 0; i < 10; i++) bloodPool(world, rng.range(-40, 40), rng.range(-130, 20), rng.range(1.5, 3.5), i + 2400);
    // the shuttle waiting at the back of the caldera
    const ez = -126;
    landingPad(world, 0, ez, 10, 0xffd27a);
    const ship = rocket(world, 0, ez - 3, 0.6, 0xd8a020);
    world.sign('SHUTTLE — JUPITER', 0, 4.5, ez + 1.2, 0, 4, '#ffd27a');

    world.playerStart.set(0, 0, 112);
    world.playerFacing = 0;

    return {
      ship, hazards,
      stages: [
        {
          text: 'Down the gully into the Furnace', kind: 'reach', zone: zone(0, 30, 24, 8, 0, 8),
          onEnterText: 'It is hotter than it should be, even here.',
          spawns: [...horde(rng, 16, ACID, -7, 7, 104, 36), sp('acidSpitter', -4, 60), sp('acidSpitter', 4, 70)]
        },
        {
          text: 'Burn out the nest', kind: 'kill', count: 34,
          spawns: [...horde(rng, 32, ALL, -56, 56, 30, -130), sp('heatSuit', -20, -40), sp('heatSuit', 20, -50), sp('heatSuit', 0, -96)]
        },
        {
          text: 'Kill the Sulfur Tyrant', kind: 'boss', boss: { kind: 'tyrant', at: [0, 0, -66] },
          onEnterText: 'IT CLIMBS OUT OF THE MAGMA',
          waveEvery: d.waveEvery + 2, waveSize: 3, maxAlive: 14,
          waveKinds: ACID,
          wavePoints: [[-56, 0, -20], [56, 0, -20], [-56, 0, -120], [56, 0, -120], [0, 0, 30]]
        },
        {
          text: 'Hold the shuttle while it burns the acid off its hull', kind: 'defend', duration: 45,
          ...waves(d, { waveKinds: ALL }),
          wavePoints: [[-56, 0, -20], [56, 0, -20], [-56, 0, -120], [56, 0, -120], [0, 0, 30]],
          onEnterText: 'ENGINES BURNING CLEAN — 45 SECONDS'
        },
        { text: 'Board the shuttle — on to Jupiter', kind: 'reach', zone: zone(0, ez + 9, 8, 5, 0, 6) }
      ],
      pickups: [
        ['ammo', 2, 0, 96], ['health', -2, 0, 60], ['ammo', 0, 0, 34], ['armour', -30, 0, -20],
        ['ammo', 30, 0, -40], ['health', 0, 0, -30], ['ammo', -20, 0, -112], ['health', 20, 0, -116]
      ]
    };
  }
};

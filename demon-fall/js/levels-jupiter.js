/* Demon Fall — the Jupiter campaign, stages 25 to 30.
 *
 * The trace led out past the belt to the Galileo refinery: a cloud-skimmer
 * station of decks and gas spheres hung over Jupiter's cloud tops, the storm
 * under it big enough to swallow Earth. Two and a half gravities (you will not
 * jump far), lightning every few seconds, and crews the storms got into: they
 * crackle, and when one winds up you will see its reach drawn on the deck.
 *
 * Every outdoor stage stands on railed decks over the drop. The hidden floor
 * under them only exists so nothing falls out of the world. */
import * as THREE from 'three';
import { ground, roomWalls, barrel } from './world.js';
import { crates, bloodPool, trash } from './props.js';
import { zone, terminal } from './levels-a.js';
import { sp, horde, waves, dome, module, container, landingPad, rocket, lightStrip, hall, pipes, screen } from './space-kit.js';
import {
  outerDiff, outerMods, voidGround, cloudSea, stormTowers, deck, bridge, tankSphere, stormMast, skyPlanet
} from './outer-kit.js';
import { TAU } from './util.js';

const STORM = {
  skyTop: 0x0e0806, skyHorizon: 0x8a5a34, skyGround: 0x6a4428, skyGlow: 0xffa860,
  glowDir: [-0.5, 0.08, -1], stars: 0.25, rift: 0, clouds: 0.7,
  fog: 0x6a4a30, fogDensity: 0.0052, fogMix: 0.04,
  hemi: [0xffc890, 0x3a2418, 0.7], ambient: 1.8,
  sun: { colour: 0xfff0d8, intensity: 1.0, pos: [-60, 30, -50] },
  space: 'jupiter', gravity: 30, jump: 7.3, tempo: 1.3,
  lightning: { every: [3, 8], colour: 0xd8e4ff, power: 3 },
  particles: { count: 900, colour: 0xd8b088, embers: 0, size: 0.018, fall: [-3, -1.5], wind: 7 }
};
const INSIDE = {
  skyTop: 0x080504, skyHorizon: 0x100a06, skyGround: 0x080504, skyGlow: 0x000000, stars: 0, rift: 0, clouds: 0,
  fog: 0x140c08, fogDensity: 0.03, fogMix: 0.2,
  hemi: [0x5a4434, 0x0a0806, 0.45],
  sun: { colour: 0x6a5a4a, intensity: 0.15, pos: [0, 40, 0] },
  dark: true, space: 'jupiter', gravity: 30, jump: 7.3, tempo: 1.3,
  lightning: { every: [6, 12], colour: 0xc8d8ff, power: 0.7 },     // the storm flickers through the portholes
  particles: { count: 300, colour: 0xa89070, embers: 0, size: 0.04 }
};

const JUP = ['rigger', 'rigger', 'stormLeaper', 'arcCaster'];
const ALL = ['rigger', 'rigger', 'stormLeaper', 'arcCaster', 'stormHulk'];
const DECK = { colour: 0x8a8278, underLight: 0xff8a3c };

/** Sky, cloud sea and the moons for the outdoor stages. */
function jovianSky(world, rng, spot = true) {
  voidGround(world, 460);
  cloudSea(world, 0xc89060, -46, { upper: 0xe0b080, glow: 0x2a1408 });
  stormTowers(world, 11, rng, 0xb8885a, { base: -60, opacity: 0.75 });
  if (spot) {
    // the Great Red Spot turning slowly out on the cloud deck
    world.shape(new THREE.CircleGeometry(120, 48).rotateX(-Math.PI / 2), 'cloud', {
      pos: [-90, -45.4, -300], scale: [1.7, 1, 1], collide: false, shadow: false, uv: 3, mat: { color: 0xb8502a, emissive: 0x3a0a04, emissiveIntensity: 0.4, roughness: 1, repeat: 1 }
    });
  }
  return [
    skyPlanet(world, 'rock', [0.5, 0.42, -1], 640, 22, { colour: 0xe8d070, emissive: 0x2a2004, glow: 0.4 }),     // Io
    skyPlanet(world, 'rock', [-0.7, 0.3, -0.6], 650, 16, { colour: 0xe8e4d8, emissive: 0x1a1a1a, glow: 0.4 })    // Europa
  ];
}

/* ================================================================ 25 */
export const JUPITER_1 = {
  id: 25, world: 'jupiter',
  name: 'Skimmer Dock',
  subtitle: 'Galileo refinery, upper cloud deck',
  brief: 'The Galileo refinery skims hydrogen off Jupiter’s cloud tops. Clear the cargo deck, lock the mooring clamps before the dock tears loose, and reach the refinery gate.',
  diff: outerMods(7),
  theme: { ...STORM, music: 34 },
  build(world, rng) {
    const d = outerDiff(7);
    const follow = jovianSky(world, rng);
    // the dock, with your ship on it
    deck(world, 0, 90, 44, 40, { ...DECK, gaps: { north: [[0, 6]] } });
    landingPad(world, -10, 98, 8, 0xffa050);
    rocket(world, -10, 98, 0.55, 0xd8a020);
    crates(world, 12, 100, rng, 3);
    container(world, 13, 84, Math.PI / 2, 0x8a5a2a, rng);
    bridge(world, 0, 70, 0, 54, 6, { light: 0xffa050 });
    // the cargo deck: stacked containers, a gantry crane over it
    deck(world, 0, 26, 64, 56, { ...DECK, gaps: { south: [[0, 6]], north: [[0, 6]], west: [[4, 5]], east: [[-12, 5]] } });
    for (const [x, z, r, n, c] of [[-20, 46, 0, 2, 0x8a5a2a], [20, 46, 0, 1, 0x3a5a7a], [-22, 6, 0, 1, 0x6a6a72], [22, 4, 0.1, 2, 0x8a5a2a],
      [14, 38, Math.PI / 2, 1, 0xa8702a], [-14, 20, Math.PI / 2, 1, 0x3a5a7a], [26, 26, Math.PI / 2, 1, 0x6a6a72]]) container(world, x, z, r, c, rng, n);
    for (const s of [-1, 1]) world.box(s * 29, 6, 26, 1, 12, 1, 'rust', { uv: 1, mat: { color: 0xd8a830, metalness: 0.5 } });
    world.box(0, 12.4, 26, 60, 1, 1.6, 'rust', { uv: 0.5, collide: false, mat: { color: 0xd8a830, metalness: 0.5 } });
    world.box(6, 11.2, 26, 3, 1.6, 2.6, 'rust', { uv: 1, collide: false, mat: { color: 0x4a4e56, metalness: 0.6 } });
    world.shape(new THREE.CylinderGeometry(0.04, 0.04, 8, 4), 'rust', { pos: [6, 6.4, 26], collide: false, shadow: false });
    world.light(0xffa050, 5, 0, 10, 26, 30);
    for (let i = 0; i < 5; i++) bloodPool(world, rng.range(-24, 24), rng.range(4, 50), rng.range(1, 2.4), i + 2500);
    for (let i = 0; i < 4; i++) barrel(world, rng.range(-26, 26), rng.range(0, 50), rng);
    // mooring decks either side: the clamps hold the dock to the refinery
    bridge(world, -32, 30, -58, 30, 5, { light: 0xffa050 });
    bridge(world, 32, 14, 58, 14, 5, { light: 0xffa050 });
    for (const [x, z, s] of [[-74, 30, -1], [74, 14, 1]]) {
      deck(world, x, z, 32, 30, { ...DECK, gaps: s < 0 ? { east: [[0, 5]] } : { west: [[0, 5]] } });
      // the clamp: a huge jaw on the outer edge
      world.box(x + s * 12, 2.5, z, 3, 5, 10, 'rust', { uv: 0.5, mat: { color: 0xd8a830, metalness: 0.5 } });
      for (const k of [-1, 1]) world.box(x + s * 13.5, 4.5, z + k * 4.5, 4, 1.6, 1.2, 'rust', { uv: 0.5, collide: false, mat: { color: 0xd8a830, metalness: 0.5 } });
      world.shape(new THREE.CylinderGeometry(0.5, 0.5, 60, 8), 'rust', { pos: [x + s * 30, -2, z], rot: [0, 0, s * 1.2], collide: false, mat: { color: 0x4a4e56, metalness: 0.6 } });
      terminal(world, x + s * 7, 0, z, -s * Math.PI / 2, s < 0 ? 'CLAMP WEST' : 'CLAMP EAST');
      stormMast(world, x - s * 10, z + 10, 10);
      crates(world, x - s * 8, z - 8, rng, 2);
    }
    // the refinery gate
    bridge(world, 0, -2, 0, -24, 6, { light: 0xffa050 });
    deck(world, 0, -46, 48, 44, { ...DECK, gaps: { south: [[0, 6]] } });
    for (const s of [-1, 1]) {
      world.box(s * 9, 6, -66, 12, 12, 2, 'panel', { uv: 0.3, mat: { color: 0x8a8278 } });
      tankSphere(world, s * 16, -48, 4.5, 0xc8c0b0);
    }
    world.box(0, 10, -66, 6, 4, 2, 'panel', { uv: 0.3, mat: { color: 0x8a8278 } });
    world.box(0, 4, -66.6, 6, 8, 0.3, 'rust', { uv: 0.5, collide: false, mat: { color: 0x3a3e46, metalness: 0.6 } });
    world.sign('GALILEO REFINERY', 0, 13, -64.9, 0, 10, '#ffa050');
    world.light(0xffa050, 6, 0, 6, -60, 16);
    for (const [x, z] of [[-10, -36], [10, -32], [-6, -52], [8, -54]]) crates(world, x, z, rng, 2);

    world.playerStart.set(0, 0, 100);
    world.playerFacing = 0;

    return {
      follow,
      stages: [
        {
          text: 'Off the dock and onto the cargo deck', kind: 'reach', zone: zone(0, 46, 20, 6, 0, 6),
          onEnterText: 'Two and a half gravities. You will not jump far.',
          spawns: [...horde(rng, 14, JUP, -26, 26, 50, 2), sp('arcCaster', -20, 10), sp('arcCaster', 20, 12)]
        },
        {
          text: 'Clear the cargo deck', kind: 'kill', count: 28,
          onEnterText: 'Charged ones: get out of the ring before it snaps.',
          spawns: [...horde(rng, 24, ALL, -26, 26, 50, 2), ...horde(rng, 6, JUP, -18, 18, -30, -60)]
        },
        {
          text: 'Lock the mooring clamps, west and east', kind: 'interact', count: 2,
          onEnterText: 'THE DOCK IS TEARING LOOSE',
          spawns: [...horde(rng, 7, ALL, -86, -62, 18, 42), ...horde(rng, 7, ALL, 62, 86, 2, 26)]
        },
        {
          text: 'To the refinery gate', kind: 'reach', zone: zone(0, -58, 10, 6, 0, 6),
          spawns: [...horde(rng, 8, ALL, -20, 20, -28, -60), sp('stormHulk', 0, -40)]
        }
      ],
      pickups: [
        ['ammo', 4, 0, 84], ['health', -4, 0, 30], ['ammo', 4, 0, 10], ['armour', -76, 0, 30],
        ['ammo', 76, 0, 14], ['health', -6, 0, -40], ['ammo', 6, 0, -46]
      ]
    };
  }
};

/* ================================================================ 26 */
export const JUPITER_2 = {
  id: 26, world: 'jupiter',
  name: 'Refinery Decks',
  subtitle: 'Hydrogen line, deck four',
  brief: 'The refinery is venting its own fuel. Open three hydrogen valves across the decks, then hold the pump hall until the line pressurises.',
  diff: outerMods(8),
  theme: { ...STORM, sun: { colour: 0xffe8d0, intensity: 1.0, pos: [50, 34, -40] }, glowDir: [0.6, 0.1, -1], music: 35 },
  build(world, rng) {
    const d = outerDiff(8);
    const follow = jovianSky(world, rng);
    deck(world, 0, 92, 40, 32, { ...DECK, gaps: { north: [[0, 6]] } });
    crates(world, -12, 98, rng, 3);
    crates(world, 13, 86, rng, 2);
    bridge(world, 0, 76, 0, 60, 6, { light: 0xffa050 });
    // the tank deck
    deck(world, 0, 30, 64, 60, { ...DECK, gaps: { south: [[0, 6]], north: [[0, 6]], east: [[0, 5]] } });
    tankSphere(world, -20, 44, 5, 0xd8d0c0);
    tankSphere(world, -20, 16, 5, 0xd8d0c0);
    tankSphere(world, 20, 48, 4, 0xd8d0c0);
    tankSphere(world, 22, 10, 4, 0xd8d0c0);
    terminal(world, -20, 0, 30, Math.PI / 2, 'VALVE 1');
    pipes(world, -20, 0.5, 44, 30, 30, rng, 0xd8a830, 3);
    pipes(world, -20, 3.2, 16, 22, 10, rng, 0x8a8e96, 2);
    for (const [x, z] of [[6, 52], [-4, 8], [26, 36], [-28, 56]]) barrel(world, x, z, rng);
    for (const [x, z] of [[8, 40], [-8, 20], [12, 22], [-6, 52]]) crates(world, x, z, rng, 2);
    // the valve deck east
    bridge(world, 32, 30, 52, 30, 5, { light: 0xffa050 });
    deck(world, 68, 30, 32, 28, { ...DECK, gaps: { west: [[0, 5]] } });
    tankSphere(world, 76, 22, 3.5, 0xd8d0c0);
    tankSphere(world, 76, 38, 3.5, 0xd8d0c0);
    terminal(world, 76, 0, 30, -Math.PI / 2, 'VALVE 2');
    stormMast(world, 60, 40, 12);
    // the pump deck, with the pump hall built on it
    bridge(world, 0, 0, 0, -18, 6, { light: 0xffa050 });
    deck(world, 0, -48, 56, 60, { ...DECK, gaps: { south: [[0, 6]], north: [[0, 6]] } });
    hall(world, 0, -48, 36, 36, 7, { doors: { south: [0, 6, 5], north: [0, 6, 5] }, wall: 0x9a9084, light: 0xffd8b0, lightPower: 4.5, floor: 0x7a7468 });
    for (const s of [-1, 1]) for (const k of [-1, 1]) {
      world.cylinder(s * 10, 2.2, -48 + k * 9, 2, 2.2, 4.4, 'hull', { seg: 18, mat: { repeat: 1, color: 0x8a8278, metalness: 0.6 }, tag: 'pump' });
      world.shape(new THREE.TorusGeometry(2.25, 0.1, 6, 24), 'plaster', { pos: [s * 10, 3.6, -48 + k * 9], rot: [Math.PI / 2, 0, 0], collide: false, mat: { color: 0x8ae0ff, emissive: 0x4ab8ff, emissiveIntensity: 1.6 } });
    }
    terminal(world, 0, 0, -56, 0, 'VALVE 3');
    for (const s of [-1, 1]) screen(world, s * 17.7, 4, -48, 8, 3, -s * Math.PI / 2, 0xffa040);
    crates(world, -4, -38, rng, 2);
    for (let i = 0; i < 6; i++) bloodPool(world, rng.range(-14, 14), rng.range(-62, -34), rng.range(1, 2.2), i + 2600);
    // the spine lift
    bridge(world, 0, -78, 0, -96, 6, { light: 0xffa050 });
    deck(world, 0, -114, 36, 36, { ...DECK, gaps: { south: [[0, 6]] } });
    world.cylinder(0, 0.15, -120, 3, 3, 0.3, 'grate', { seg: 24, mat: { color: 0xd8a830 }, tag: 'lift' });
    world.shape(new THREE.TorusGeometry(3.1, 0.12, 6, 30).rotateX(Math.PI / 2), 'plaster', { pos: [0, 0.32, -120], collide: false, mat: { color: 0xffa050, emissive: 0xff8a30, emissiveIntensity: 2 } });
    world.light(0xffa050, 6, 0, 3, -120, 14);
    world.sign('SPINE ACCESS', 0, 4, -131, 0, 6, '#ffa050');
    world.box(0, 2, -131.4, 8, 4, 0.4, 'rust', { uv: 0.5, mat: { color: 0x3a3e46 } });

    world.playerStart.set(0, 0, 100);
    world.playerFacing = 0;

    return {
      follow,
      stages: [
        {
          text: 'Onto the tank deck', kind: 'reach', zone: zone(0, 40, 20, 6, 0, 6),
          spawns: [...horde(rng, 14, JUP, -26, 26, 56, 4), sp('stormHulk', 0, 10)]
        },
        {
          text: 'Open the three hydrogen valves', kind: 'interact', count: 3,
          spawns: [...horde(rng, 6, ALL, -26, 0, 54, 6), ...horde(rng, 6, ALL, 56, 80, 20, 40), ...horde(rng, 7, ALL, -14, 14, -36, -62)]
        },
        {
          text: 'Hold the pump hall while the line pressurises', kind: 'defend', duration: 55,
          ...waves(d, { waveKinds: ALL }),
          wavePoints: [[0, 0, 30], [68, 0, 30], [0, 0, -114], [-22, 0, -72], [22, 0, -24]],
          onEnterText: 'PRESSURISING — 55 SECONDS'
        },
        {
          text: 'To the spine lift', kind: 'reach', zone: zone(0, -118, 8, 6, 0, 6),
          spawns: [sp('stormHulk', 0, -106), ...horde(rng, 5, JUP, -12, 12, -100, -126)]
        }
      ],
      pickups: [
        ['ammo', 4, 0, 86], ['health', 2, 0, 30], ['ammo', 70, 0, 30], ['armour', -10, 0, 8],
        ['ammo', -6, 0, -44], ['health', 6, 0, -40], ['ammo', 4, 0, -108]
      ]
    };
  }
};

/* ================================================================ 27 */
export const JUPITER_3 = {
  id: 27, world: 'jupiter',
  name: 'Storm Wall',
  subtitle: 'The spine walkway, in the storm',
  brief: 'A narrow spine runs out over the storm to the capacitor deck. Clear the junction, earth the lightning rods, and hold the capacitors while they drink the storm.',
  diff: outerMods(9),
  theme: { ...STORM, lightning: { every: [2, 5], colour: 0xd8e4ff, power: 3.5 }, fogDensity: 0.006, particles: { ...STORM.particles, count: 1200, wind: 10 }, music: 33 },
  build(world, rng) {
    const d = outerDiff(9);
    const follow = jovianSky(world, rng, false);
    deck(world, 0, 112, 30, 24, { ...DECK, gaps: { north: [[0, 8]] } });
    crates(world, -9, 116, rng, 2);
    // the spine out to the junction, rods along it on outriggers
    bridge(world, 0, 100, 0, 40, 8, { light: 0x8ae0ff });
    for (let z = 92; z > 44; z -= 16) for (const s of [-1, 1]) {
      world.box(s * 6, -0.3, z, 4, 0.4, 1.2, 'rust', { uv: 1, collide: false, mat: { color: 0x4a4e56, metalness: 0.6 } });
      stormMast(world, s * 7.4, z, 9);
    }
    deck(world, 0, 20, 44, 40, { ...DECK, gaps: { south: [[0, 8]], north: [[0, 8]], west: [[0, 5]], east: [[0, 5]] } });
    for (const [x, z] of [[-12, 26], [12, 32], [-14, 8], [13, 10], [6, 20]]) crates(world, x, z, rng, 3);
    module(world, -10, 36, 8, 1.8, 0, rng, { label: 'JUNCTION' });
    for (const s of [-1, 1]) {
      bridge(world, s * 22, 20, s * 44, 20, 5, { light: 0x8ae0ff });
      deck(world, s * 58, 20, 28, 28, { ...DECK, gaps: s < 0 ? { east: [[0, 5]] } : { west: [[0, 5]] } });
      stormMast(world, s * 66, 20, 22);
      terminal(world, s * 60, 0, 20, -s * Math.PI / 2, s < 0 ? 'ROD WEST' : 'ROD EAST');
      crates(world, s * 52, 10, rng, 2);
      crates(world, s * 52, 30, rng, 2);
    }
    // the second spine to the capacitor deck
    bridge(world, 0, 0, 0, -60, 8, { light: 0x8ae0ff });
    for (let z = -12; z > -56; z -= 16) for (const s of [-1, 1]) {
      world.box(s * 6, -0.3, z, 4, 0.4, 1.2, 'rust', { uv: 1, collide: false, mat: { color: 0x4a4e56, metalness: 0.6 } });
      stormMast(world, s * 7.4, z, 9);
    }
    deck(world, 0, -84, 50, 48, { ...DECK, gaps: { south: [[0, 8]], north: [[0, 6]] } });
    // capacitor banks: cover that hums
    for (const [x, z] of [[-14, -70], [14, -70], [-14, -98], [14, -98], [0, -84]]) {
      world.box(x, 1.2, z, 5, 2.4, 2.4, 'rust', { uv: 0.5, mat: { color: 0x3a3e46, metalness: 0.6 } });
      for (let k = -1; k <= 1; k++) world.shape(new THREE.CylinderGeometry(0.4, 0.4, 1.4, 10), 'plaster', { pos: [x + k * 1.6, 3.1, z], collide: false, mat: { color: 0x8ae0ff, emissive: 0x4ab8ff, emissiveIntensity: 1.8 } });
      world.light(0x8ae0ff, 4, x, 3.5, z, 12);
    }
    for (const s of [-1, 1]) stormMast(world, s * 21, -84, 18);
    for (let i = 0; i < 6; i++) bloodPool(world, rng.range(-20, 20), rng.range(-104, -64), rng.range(1, 2.4), i + 2700);
    bridge(world, 0, -108, 0, -126, 6, { light: 0xffa050 });
    deck(world, 0, -140, 30, 28, { ...DECK, gaps: { south: [[0, 6]] } });
    world.box(0, 3, -152, 10, 6, 1, 'panel', { uv: 0.3, mat: { color: 0x8a8278 } });
    world.sign('HABITAT RING', 0, 6.8, -151.4, 0, 8, '#ffa050');
    world.light(0xffa050, 5, 0, 4, -146, 14);

    world.playerStart.set(0, 0, 116);
    world.playerFacing = 0;

    return {
      follow,
      stages: [
        {
          text: 'Run the spine to the junction', kind: 'reach', zone: zone(0, 32, 16, 6, 0, 6),
          onEnterText: 'Nowhere to hide out here. Keep moving.',
          spawns: [...horde(rng, 8, JUP, -2.5, 2.5, 90, 46), ...horde(rng, 6, JUP, -18, 18, 36, 4)]
        },
        {
          text: 'Clear the junction', kind: 'kill', count: 34,
          spawns: [...horde(rng, 16, ALL, -18, 18, 36, 4), ...horde(rng, 8, ALL, -70, -46, 8, 32), ...horde(rng, 8, ALL, 46, 70, 8, 32), ...horde(rng, 4, JUP, -2.5, 2.5, -4, -50)]
        },
        {
          text: 'Earth the lightning rods, west and east', kind: 'interact', count: 2,
          spawns: [...horde(rng, 6, JUP, -70, -46, 8, 32), ...horde(rng, 6, JUP, 46, 70, 8, 32)]
        },
        {
          text: 'Hold the capacitor deck while it drinks the storm', kind: 'defend', duration: 55,
          ...waves(d, { waveKinds: ALL }),
          wavePoints: [[-18, 0, -66], [18, 0, -66], [-18, 0, -102], [18, 0, -102], [0, 0, -140], [0, 0, 26]],
          onEnterText: 'CHARGING — 55 SECONDS'
        },
        {
          text: 'Into the habitat ring', kind: 'reach', zone: zone(0, -136, 8, 5, 0, 6),
          spawns: [sp('stormHulk', 0, -132), ...horde(rng, 4, ['stormLeaper'], -10, 10, -130, -148)]
        }
      ],
      pickups: [
        ['ammo', 4, 0, 108], ['health', 0, 0, 60], ['ammo', -6, 0, 26], ['armour', -60, 0, 28],
        ['ammo', 60, 0, 12], ['health', -8, 0, -78], ['ammo', 8, 0, -90]
      ]
    };
  }
};

/* ================================================================ 28 */
/** A wall along x or z with one doorway (lintel over it). */
function partition(world, x0, z0, x1, z1, at, h, gapW = 4, gapH = 3.2, col = 0xc0b8a8) {
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
  const m = { uv: 0.4, mat: { color: col } };
  const seg = (lo, hi, y, hh) => {
    if (hi - lo < 0.05) return;
    const c = (lo + hi) / 2, len = hi - lo;
    if (alongX) world.box(c, y, z0, len, hh, 0.4, 'panel', m);
    else world.box(x0, y, c, 0.4, hh, len, 'panel', m);
  };
  seg(a0, at - gapW / 2, h / 2, h);
  seg(at + gapW / 2, a1, h / 2, h);
  seg(at - gapW / 2, at + gapW / 2, gapH + (h - gapH) / 2, h - gapH);
}

export const JUPITER_4 = {
  id: 28, world: 'jupiter',
  name: 'Habitat Ring',
  subtitle: 'Crew quarters, deep inside Galileo',
  brief: 'The crew lived in a ring round the reactor core. Get to the west habitat, restart life support in both habs and the core, and purge the ring.',
  diff: outerMods(10),
  theme: { ...INSIDE, music: 36 },
  build(world, rng) {
    const H = 5;
    ground(world, 420, 'grate', { uv: 0.4, mat: { color: 0x6a645c } });
    const wall = 0xc0b8a8;
    roomWalls(world, 0, 0, 96, 96, H, 'panel', { mat: { uv: 0.35, mat: { color: wall } } });
    world.box(0, H + 0.2, 0, 96.6, 0.4, 96.6, 'panel', { uv: 0.3, mat: { color: 0x7a746a } });
    roomWalls(world, 0, 0, 44, 44, H, 'panel', { doors: { north: [0, 4, 3.2], south: [0, 4, 3.2], west: [0, 4, 3.2], east: [0, 4, 3.2] }, mat: { uv: 0.35, mat: { color: wall } } });
    // the ring is cut into sections; each has its own doorways
    for (const s of [-1, 1]) {
      partition(world, s * 22, 22, s * 22, 48, 35, H);
      partition(world, s * 22, -22, s * 22, -48, -35, H);
      partition(world, s * 22, 22, s * 48, 22, s * 35, H);
      partition(world, s * 22, -22, s * 48, -22, s * 35, H);
    }
    // lights in every section
    const strips = [[0, 35, true], [0, -35, true], [-35, 0, false], [35, 0, false], [-35, 35, true], [35, 35, true], [-35, -35, true], [35, -35, true]];
    for (const [x, z, ax] of strips) {
      lightStrip(world, x, H - 0.05, z, 6, ax, rng.chance(0.3) ? 0xff6040 : 0xffe0c0, 3.2);
      if (ax) { lightStrip(world, x - 12, H - 0.05, z, 4, true, 0xffe0c0, 2.4); lightStrip(world, x + 12, H - 0.05, z, 4, true, 0xffe0c0, 2.4); }
    }
    // south: quarters (bunks) where you start
    for (let k = -2; k <= 2; k++) if (k) for (const z of [26, 44]) world.box(k * 7, 0.5, z, 4.2, 1, 2, 'hull', { uv: 0.6, mat: { color: 0x8a7a6a, repeat: 1 } });
    // west hab: bunks and lockers; east hab: the mess hall
    for (let k = -2; k <= 2; k++) world.box(-45, 1.2, k * 7, 1.4, 2.4, 3, 'hull', { uv: 0.6, mat: { color: 0x6a6a72, repeat: 1 } });
    for (let k = -1; k <= 1; k++) for (const x of [-32, -26]) world.box(x, 0.5, k * 10, 2, 1, 4.2, 'hull', { uv: 0.6, mat: { color: 0x8a7a6a, repeat: 1 } });
    for (let k = -1; k <= 1; k++) for (const x of [30, 40]) world.box(x, 0.45, k * 11, 3.6, 0.9, 1.6, 'hull', { uv: 0.6, mat: { color: 0xa89a7a, repeat: 1 } });
    terminal(world, -46, 0, -19, Math.PI / 2, 'HAB A');
    terminal(world, 46, 0, 14, -Math.PI / 2, 'HAB B');
    // the core: the reactor column and its controls
    world.cylinder(0, 0.5, 0, 4, 4.2, 1, 'hull', { seg: 24, mat: { repeat: 2, color: 0x8a8278, metalness: 0.6 }, tag: 'reactor' });
    world.shape(new THREE.CylinderGeometry(1.4, 1.4, H - 1, 16, 1, true), 'plaster', { pos: [0, H / 2 + 0.5, 0], collide: false, mat: { color: 0xffa050, emissive: 0xff7a20, emissiveIntensity: 1.6 } });
    world.collider(0, H / 2, 0, 3, H, 3, 0, 'reactor');
    world.light(0xffa050, 8, 0, 3, 0, 22);
    terminal(world, 0, 0, 6.2, 0, 'CORE');
    for (const s of [-1, 1]) {
      screen(world, s * 21.7, 3, 0, 6, 2.4, -s * Math.PI / 2, 0xffa040);
      for (const k of [-1, 1]) world.box(s * 12, 0.6, k * 12, 3, 1.2, 1.5, 'hull', { uv: 0.6, mat: { color: 0x3a3632, repeat: 1, metalness: 0.6 } });
    }
    // corners: stores
    for (const [x, z] of [[-35, 35], [35, 35], [-35, -35], [35, -35]]) { crates(world, x - 4, z + 4, rng, 3); crates(world, x + 5, z - 5, rng, 3); }
    // north: the observatory lift
    world.cylinder(0, 0.15, -40, 3, 3, 0.3, 'grate', { seg: 24, mat: { color: 0xd8a830 }, tag: 'lift' });
    world.shape(new THREE.TorusGeometry(3.1, 0.12, 6, 30).rotateX(Math.PI / 2), 'plaster', { pos: [0, 0.32, -40], collide: false, mat: { color: 0xffa050, emissive: 0xff8a30, emissiveIntensity: 2 } });
    world.light(0xffa050, 5, 0, 3, -40, 12);
    world.sign('OBSERVATORY LIFT', 0, 3.6, -47.6, 0, 6, '#ffa050');
    for (let i = 0; i < 10; i++) bloodPool(world, rng.range(-44, 44), rng.range(-44, 44), rng.range(1, 2.4), i + 2800);
    trash(world, -8, 30, rng, 6);
    trash(world, 30, -4, rng, 6);
    for (const [x, z] of [[-30, 40], [30, -40], [-40, -30]]) barrel(world, x, z, rng);

    world.playerStart.set(0, 0, 40);
    world.playerFacing = 0;
    const d = outerDiff(10);
    void d;

    return {
      stages: [
        {
          text: 'Get to the west habitat', kind: 'reach', zone: zone(-38, 0, 8, 8, 0, 5),
          spawns: [...horde(rng, 5, JUP, -18, 18, 30, 24), ...horde(rng, 8, JUP, -44, -26, 18, -18), ...horde(rng, 4, JUP, -44, -26, 44, 26)]
        },
        {
          text: 'Restart life support: hab A, hab B and the core', kind: 'interact', count: 3,
          spawns: [...horde(rng, 7, ALL, 26, 44, 18, -18), ...horde(rng, 6, ALL, -18, 18, 18, -18), ...horde(rng, 4, JUP, 26, 44, 26, 44)]
        },
        {
          text: 'Purge the ring', kind: 'kill', count: 34,
          onEnterText: 'They came up out of the lower decks.',
          spawns: [
            ...horde(rng, 10, ALL, -18, 18, -26, -44), ...horde(rng, 8, ALL, 26, 44, -26, -44), ...horde(rng, 8, ALL, -44, -26, -26, -44),
            ...horde(rng, 6, JUP, -44, -26, 18, -18), ...horde(rng, 6, JUP, 26, 44, 18, -18)
          ]
        },
        {
          text: 'To the observatory lift', kind: 'reach', zone: zone(0, -40, 8, 6, 0, 5),
          spawns: [sp('stormHulk', -10, -36), sp('stormHulk', 10, -36)]
        }
      ],
      pickups: [
        ['ammo', 3, 0, 34], ['health', -35, 0, 40], ['ammo', -38, 0, 6], ['armour', 0, 0, -12],
        ['ammo', 38, 0, -6], ['health', 35, 0, -30], ['ammo', -6, 0, -32]
      ]
    };
  }
};

/* ================================================================ 29 */
export const JUPITER_5 = {
  id: 29, world: 'jupiter',
  name: 'Red Spot Observatory',
  subtitle: 'Over the Great Red Spot',
  brief: 'The observatory deck looks straight down into the Great Red Spot. Calibrate the storm sensors and hold the deck while they read where the signal is really going.',
  diff: outerMods(11),
  theme: { ...STORM, skyGlow: 0xff8050, glowDir: [-0.3, 0.05, -1], sun: { colour: 0xffe0c8, intensity: 1.0, pos: [-40, 26, -70] }, music: 35, tempo: 1.35 },
  build(world, rng) {
    const d = outerDiff(11);
    const follow = jovianSky(world, rng);
    deck(world, 0, 100, 36, 28, { ...DECK, gaps: { north: [[0, 6]] } });
    crates(world, 10, 104, rng, 3);
    bridge(world, 0, 86, 0, 52, 6, { light: 0xffa050 });
    // the observatory deck and its glass dome
    deck(world, 0, 20, 64, 64, { ...DECK, gaps: { south: [[0, 6]], north: [[0, 6]], west: [[-20, 5]], east: [[-20, 5]] } });
    dome(world, 0, 24, 9, rng, { glass: true, door: 0, windowColour: 0xffa050 });
    world.shape(new THREE.CylinderGeometry(2, 2.6, 6, 16), 'hull', { pos: [0, 4.6, 24], rot: [0.6, 0, 0], collide: false, mat: { repeat: 1, color: 0xd8d0c0, metalness: 0.5 } });
    for (const [x, z] of [[-20, 40], [20, 42], [-22, 4], [22, 6], [-12, -4], [12, -6]]) crates(world, x, z, rng, 3);
    for (const s of [-1, 1]) module(world, s * 24, 24, 10, 2, 0, rng, { label: s < 0 ? 'SPECTRO' : 'RADAR' });
    for (let i = 0; i < 6; i++) bloodPool(world, rng.range(-26, 26), rng.range(-6, 46), rng.range(1, 2.4), i + 2900);
    // three sensor decks
    for (const s of [-1, 1]) {
      bridge(world, s * 32, 0, s * 50, 0, 5, { light: 0xffa050 });
      deck(world, s * 64, 0, 28, 28, { ...DECK, gaps: s < 0 ? { east: [[0, 5]] } : { west: [[0, 5]] } });
      stormMast(world, s * 70, 6, 16, 0xff8050);
      terminal(world, s * 66, 0, -4, -s * Math.PI / 2, s < 0 ? 'SENSOR WEST' : 'SENSOR EAST');
      crates(world, s * 58, 8, rng, 2);
    }
    bridge(world, 0, -12, 0, -34, 6, { light: 0xffa050 });
    deck(world, 0, -52, 40, 36, { ...DECK, gaps: { south: [[0, 6]], north: [[0, 6]] } });
    stormMast(world, -12, -60, 20, 0xff8050);
    stormMast(world, 12, -60, 20, 0xff8050);
    terminal(world, 0, 0, -62, 0, 'SENSOR NORTH');
    crates(world, -10, -44, rng, 2);
    crates(world, 10, -46, rng, 2);
    // the shuttle deck
    bridge(world, 0, -70, 0, -90, 6, { light: 0xffa050 });
    deck(world, 0, -108, 32, 36, { ...DECK, gaps: { south: [[0, 6]] } });
    landingPad(world, 0, -112, 9, 0xffa050);
    rocket(world, 0, -114, 0.55, 0x3a6ad8);

    world.playerStart.set(0, 0, 104);
    world.playerFacing = 0;

    return {
      follow,
      stages: [
        {
          text: 'Across to the observatory', kind: 'reach', zone: zone(0, 44, 20, 6, 0, 6),
          spawns: [...horde(rng, 14, ALL, -26, 26, 48, -6), sp('arcCaster', -24, 0), sp('arcCaster', 24, 2)]
        },
        {
          text: 'Calibrate the three storm sensors', kind: 'interact', count: 3,
          spawns: [...horde(rng, 6, ALL, -74, -54, 10, -10), ...horde(rng, 6, ALL, 54, 74, 10, -10), ...horde(rng, 6, ALL, -16, 16, -40, -66)]
        },
        {
          text: 'Hold the observatory while the sensors read the storm', kind: 'defend', duration: 60,
          ...waves(d, { waveKinds: ALL }),
          wavePoints: [[-26, 0, 46], [26, 0, 46], [-26, 0, -6], [26, 0, -6], [-64, 0, 0], [64, 0, 0], [0, 0, -52]],
          onEnterText: 'READING THE STORM — 60 SECONDS'
        },
        {
          text: 'To the shuttle', kind: 'reach', zone: zone(0, -96, 8, 4, 0, 6),
          onEnterText: 'The signal goes out past Saturn and Uranus. Neptune.',
          spawns: [sp('stormHulk', -8, -100), sp('stormHulk', 8, -100), ...horde(rng, 4, JUP, -12, 12, -96, -120)]
        }
      ],
      pickups: [
        ['ammo', 4, 0, 96], ['health', -4, 0, 46], ['ammo', 16, 0, 30], ['armour', -66, 0, 6],
        ['ammo', 66, 0, 6], ['health', 0, 0, -44], ['ammo', 6, 0, -100]
      ]
    };
  }
};

/* ================================================================ 30 */
export const JUPITER_6 = {
  id: 30, world: 'jupiter', flight: 'neptune',
  name: 'Eye of the Storm',
  subtitle: 'The arena deck, under the lightning',
  brief: 'Something has made a nest of the refinery’s storm arena, and it is drinking the lightning. Clear the arena, kill the Tempest, and hold until the shuttle can run for Neptune.',
  diff: outerMods(12),
  theme: { ...STORM, lightning: { every: [1.5, 4], colour: 0xe0e8ff, power: 4 }, skyGlow: 0x9ab8ff, glowDir: [0, 0.3, -1], music: 32, tempo: 1.45 },
  build(world, rng) {
    const d = outerDiff(12);
    const follow = jovianSky(world, rng);
    deck(world, 0, 100, 32, 28, { ...DECK, gaps: { north: [[0, 8]] } });
    bridge(world, 0, 86, 0, 46, 8, { light: 0x8ae0ff });
    for (let z = 78; z > 50; z -= 14) for (const s of [-1, 1]) stormMast(world, s * 5.6, z, 8);
    // the arena: masts in a ring for cover, the eye glowing in the middle
    deck(world, 0, 0, 92, 92, { ...DECK, colour: 0x7a746c, gaps: { south: [[0, 8]], north: [[0, 6]] } });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2;
      stormMast(world, Math.cos(a) * 26, Math.sin(a) * 26, 16);
      world.box(Math.cos(a) * 26, 0.7, Math.sin(a) * 26, 3, 1.4, 3, 'rust', { uv: 0.6, mat: { color: 0x3a3e46, metalness: 0.6 } });
    }
    for (const [x, z] of [[-36, 30], [36, 30], [-36, -30], [36, -30]]) {
      world.box(x, 1.2, z, 6, 2.4, 2.4, 'rust', { uv: 0.5, mat: { color: 0x3a3e46, metalness: 0.6 } });
      world.light(0x8ae0ff, 4, x, 3, z, 12);
    }
    world.shape(new THREE.TorusGeometry(12, 0.5, 6, 48), 'plaster', { pos: [0, 0.12, -10], rot: [Math.PI / 2, 0, 0], collide: false, mat: { color: 0x8ae0ff, emissive: 0x4ab8ff, emissiveIntensity: 1.6 } });
    world.shape(new THREE.CircleGeometry(11.5, 40).rotateX(-Math.PI / 2), 'plaster', { pos: [0, 0.03, -10], collide: false, shadow: false, mat: { color: 0x0a1a2a, emissive: 0x2a6ab0, emissiveIntensity: 0.7 } });
    world.light(0x8ae0ff, 10, 0, 6, -10, 40);
    // the nest it built: charred growth around the masts, arcing pods
    const growth = { color: 0x3a3440, emissive: 0x0a1a2a, roughness: 0.5 };
    const pod = { color: 0xbfeaff, emissive: 0x6ad0ff, emissiveIntensity: 1.6 };
    for (let i = 0; i < 26; i++) {
      const a = rng() * TAU, r = rng.range(16, 42);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < 6 && z > 20) continue;
      const s = rng.range(0.6, 2.2);
      world.shape(new THREE.SphereGeometry(1, 10, 8), 'flesh', { pos: [x, s * 0.2, z], scale: [s * 1.4, s * 0.6, s * 1.3], rot: [0, rng() * TAU, 0], uv: 2, collide: false, mat: growth });
      if (rng.chance(0.6)) world.shape(new THREE.SphereGeometry(0.28, 8, 6), 'plaster', { pos: [x, s * 0.55, z], scale: [1, 1.4, 1], collide: false, shadow: false, mat: pod });
    }
    for (let i = 0; i < 8; i++) bloodPool(world, rng.range(-40, 40), rng.range(-40, 40), rng.range(1.5, 3), i + 3000);
    // the shuttle deck
    bridge(world, 0, -46, 0, -70, 6, { light: 0xffa050 });
    deck(world, 0, -88, 32, 36, { ...DECK, gaps: { south: [[0, 6]] } });
    landingPad(world, 0, -92, 9, 0x8ae0ff);
    const ship = rocket(world, 0, -94, 0.6, 0x3a6ad8);
    world.sign('SHUTTLE — NEPTUNE', 0, 4.5, -84.8, 0, 4, '#8ae0ff');

    world.playerStart.set(0, 0, 104);
    world.playerFacing = 0;

    return {
      ship, follow,
      stages: [
        {
          text: 'Across to the eye', kind: 'reach', zone: zone(0, 36, 20, 6, 0, 6),
          onEnterText: 'The lightning is not hitting the masts. It is feeding something.',
          spawns: [...horde(rng, 8, JUP, -3, 3, 80, 50), ...horde(rng, 8, JUP, -36, 36, 40, 20)]
        },
        {
          text: 'Clear the arena', kind: 'kill', count: 36,
          spawns: [...horde(rng, 34, ALL, -40, 40, 40, -40), sp('stormHulk', -20, -30), sp('stormHulk', 20, -30), sp('stormHulk', 0, 10)]
        },
        {
          text: 'Kill the Tempest', kind: 'boss', boss: { kind: 'tempest', at: [0, 0, -12] },
          onEnterText: 'IT FALLS OUT OF THE STORM',
          waveEvery: d.waveEvery + 2, waveSize: 3, maxAlive: 14,
          waveKinds: JUP,
          wavePoints: [[-40, 0, 40], [40, 0, 40], [-40, 0, -40], [40, 0, -40]]
        },
        {
          text: 'Hold the arena while the shuttle spins up', kind: 'defend', duration: 45,
          ...waves(d, { waveKinds: ALL }),
          wavePoints: [[-40, 0, 40], [40, 0, 40], [-40, 0, -40], [40, 0, -40], [0, 0, -88]],
          onEnterText: 'ENGINES SPINNING UP — 45 SECONDS'
        },
        { text: 'Board the shuttle — on to Neptune', kind: 'reach', zone: zone(0, -76, 8, 4, 0, 6) }
      ],
      pickups: [
        ['ammo', 2, 0, 96], ['health', 0, 0, 40], ['ammo', -30, 0, 10], ['armour', 30, 0, 10],
        ['ammo', 0, 0, -36], ['health', -20, 0, -20], ['ammo', 4, 0, -80]
      ]
    };
  }
};

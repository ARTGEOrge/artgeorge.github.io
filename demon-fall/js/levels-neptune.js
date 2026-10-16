/* Demon Fall — the Neptune campaign, stages 31 to 36: the end of it.
 *
 * The signal ends at Neptune: research stations moored on a raft of methane
 * ice in the deep blue, storms of frozen methane howling sideways, labs that
 * froze with everyone still in them. Under it all, down the bore the miners
 * cut, is where the rift was born. Kill the Progenitor and the war is over.
 *
 * The hardest stages in the game. Bodies take twice the punishment they did
 * on Earth's last stage; the drops during holds and the boss keep you fed. */
import * as THREE from 'three';
import { ground, barrel } from './world.js';
import { crates, scorch, bloodPool, trash } from './props.js';
import { zone, terminal } from './levels-a.js';
import { sp, horde, waves, cliff, module, container, landingPad, rocket, hall, pipes, drillRig, screen, mast, rover, hullChunk, solarArray } from './space-kit.js';
import { outerDiff, outerMods, iceSpire, stormMast, corridor, boulders, skyPlanet, tankSphere } from './outer-kit.js';
import { TAU } from './util.js';

const DEEP = {
  skyTop: 0x020616, skyHorizon: 0x1a3a8a, skyGround: 0x0a1a3a, skyGlow: 0x3a6ad8,
  glowDir: [0.2, 0.15, -1], stars: 0.35, rift: 0, clouds: 0.8,
  fog: 0x16306a, fogDensity: 0.012, fogMix: 0.04,
  hemi: [0x6a9ae8, 0x0a1430, 0.6], ambient: 1.7,
  sun: { colour: 0xc8d8ff, intensity: 0.55, pos: [50, 40, 30] },
  space: 'neptune', gravity: 24, jump: 6.5, tempo: 0.85,
  particles: { count: 1400, colour: 0xe0f0ff, embers: 0, size: 0.03, fall: [-7, -4], wind: 6 }
};
const INSIDE = {
  skyTop: 0x02040a, skyHorizon: 0x060a14, skyGround: 0x02040a, skyGlow: 0x000000, stars: 0, rift: 0, clouds: 0,
  fog: 0x0a1424, fogDensity: 0.032, fogMix: 0.2,
  hemi: [0x3a5a8a, 0x04060a, 0.45],
  sun: { colour: 0x4a6a9a, intensity: 0.15, pos: [0, 40, 0] },
  dark: true, space: 'neptune', gravity: 24, jump: 6.5, tempo: 0.85,
  particles: { count: 320, colour: 0xc8dcff, embers: 0, size: 0.04 }
};

const NEP = ['frozenCrew', 'frozenCrew', 'iceWraith', 'frostCrawler'];
const ALL = ['frozenCrew', 'frozenCrew', 'iceWraith', 'frostCrawler', 'frostBrute'];
// the last stages bring back a little of everything the signal touched
const EVERY = ['frozenCrew', 'iceWraith', 'frostCrawler', 'frostBrute', 'stormLeaper', 'acidSpitter', 'lunarCrawler'];
const ICE = 'ice', ICE_TINT = 0xa8c4e8;

const triton = world => skyPlanet(world, 'rock', [-0.5, 0.38, -1], 640, 24, { colour: 0xd8c8d0, emissive: 0x1a1a2a, glow: 0.5 });
function iceField(world, rng, n, x0, x1, z0, z1, keepOut = 9, clear = null) {
  for (let i = 0; i < n; i++) {
    const x = rng.range(x0, x1), z = rng.range(z0, z1);
    if (Math.abs(x) < keepOut || (clear && !clear(x, z))) continue;
    iceSpire(world, x, z, rng.chance(0.3) ? rng.range(4, 9) : rng.range(1.2, 3), rng);
  }
}

/* ================================================================ 31 */
export const NEPTUNE_1 = {
  id: 31, world: 'neptune',
  name: 'Abyssal Mooring',
  subtitle: 'Proteus Station, on the methane ice',
  brief: 'Proteus Station is moored to a raft of frozen methane in the deep. Cross the ice, clear the mooring yard, thaw the airlock heaters and get inside.',
  diff: outerMods(13),
  theme: { ...DEEP, music: 33 },
  build(world, rng) {
    const d = outerDiff(13);
    ground(world, 460, ICE, { uv: 0.14, bumpy: 0.5, seg: 70, mat: { color: 0xb8d0f0, roughness: 0.35 } });
    landingPad(world, -16, 116, 9, 0x8ad8ff);
    rocket(world, -16, 116, 0.6, 0x3a6ad8);
    scorch(world, -16, 116, 16);
    for (let z = 100; z > -110; z -= 14) for (const s of [-1, 1]) {
      world.box(s * 7, 0.8, z, 0.2, 1.6, 0.2, 'rust', { uv: 1, collide: false, mat: { color: 0x2a3a4a, metalness: 0.6 } });
      world.box(s * 7, 1.65, z, 0.26, 0.14, 0.26, 'plaster', { uv: 1, collide: false, mat: { color: 0x8ad8ff, emissive: 0x4ab8ff, emissiveIntensity: 2 } });
    }
    for (let z = 96; z > -100; z -= 40) for (const s of [-1, 1]) world.light(0x8ad8ff, 5, s * 7, 3, z, 18);
    cliff(world, -90, 130, -90, -200, 16, rng, ICE, { out: [-1, 0], tint: ICE_TINT });
    cliff(world, 90, 130, 90, -200, 16, rng, ICE, { out: [1, 0], tint: ICE_TINT });
    cliff(world, -92, -202, 92, -202, 18, rng, ICE, { out: [0, -1], tint: ICE_TINT });
    const keep31 = [[-42, -78, 10], [42, -98, 10], [0, -134, 28], [-16, 116, 14], [-40, 60, 6], [44, 30, 6], [-48, -40, 6], [50, -70, 6], [58, -14, 10]];
    const open31 = (x, z) => keep31.every(([ax, az, ar]) => Math.hypot(x - ax, z - az) > ar);
    iceField(world, rng, 60, -84, 84, 120, -190, 9, open31);
    boulders(world, rng, 20, -84, 84, 110, -180, ICE, 0x9ab8e0, 10, keep31);
    // the mooring tethers: cables climbing out of the ice into the dark
    for (const [x, z] of [[-40, 60], [44, 30], [-48, -40], [50, -70]]) {
      world.cylinder(x, 2, z, 1.6, 2.2, 4, 'hull', { seg: 12, mat: { repeat: 1, color: 0x5a6a7a, metalness: 0.6 }, tag: 'anchor' });
      world.shape(new THREE.CylinderGeometry(0.35, 0.35, 220, 8), 'rust', { pos: [x, 112, z], collide: false, mat: { color: 0x4a5a6a, metalness: 0.7 } });
      world.light(0x8ad8ff, 4, x, 5, z, 14);
    }
    // the mooring yard: containers, rovers, a crashed supply drone
    for (const [x, z, r, c, n] of [[-22, 30, 0.2, 0x3a5a8a, 2], [24, 8, -0.3, 0x6a7a8a, 1], [-28, -20, 0.5, 0x3a5a8a, 1], [26, -40, 0, 0x8a9aaa, 2], [-20, -76, -0.2, 0x3a5a8a, 1]]) container(world, x, z, r, c, rng, n);
    rover(world, 14, 66, 0.6, rng, 0xc8d4e0);
    rover(world, -14, -50, 2.2, rng, 0xc8d4e0);
    hullChunk(world, 58, -14, 12, 2.6, 0.9, rng, 0.9);
    // the heater huts either side of the airlock road
    module(world, -44, -72, 8, 1.8, Math.PI / 2, rng, { label: 'HEAT W', labelColour: '#8ad8ff' });
    terminal(world, -40, 0, -82, Math.PI / 2, 'HEATER WEST');
    module(world, 44, -92, 8, 1.8, Math.PI / 2, rng, { label: 'HEAT E', labelColour: '#8ad8ff' });
    terminal(world, 40, 0, -102, -Math.PI / 2, 'HEATER EAST');
    // Proteus Station
    hall(world, 0, -134, 40, 30, 8, { doors: { south: [0, 6, 4.4] }, wall: 0xb8c4d4, light: 0xcfe8ff, lightPower: 4.5 });
    world.sign('PROTEUS STATION', 0, 9.2, -118.8, 0, 12, '#8ad8ff');
    world.box(0, 9.2, -119.1, 13, 2.4, 0.4, 'hull', { uv: 0.4, collide: false, mat: { repeat: 1, color: 0x1a2a4a } });
    for (const s of [-1, 1]) {
      screen(world, s * 19.7, 4, -134, 8, 3, -s * Math.PI / 2, 0x8ad8ff);
      crates(world, s * 12, -140, rng, 3);
    }
    for (let i = 0; i < 6; i++) bloodPool(world, rng.range(-10, 10), rng.range(-110, -60), rng.range(1, 2.4), i + 3100);
    for (let i = 0; i < 4; i++) barrel(world, rng.range(-30, 30), rng.range(-110, 40), rng);
    const moon = triton(world);

    world.playerStart.set(0, 0, 104);
    world.playerFacing = 0;

    return {
      follow: [moon],
      stages: [
        {
          text: 'Across the ice to the mooring yard', kind: 'reach', zone: zone(0, 0, 30, 10, 0, 8),
          onEnterText: 'Wraiths are fast. Crawlers are faster.',
          spawns: [...horde(rng, 14, NEP, -26, 26, 88, 10), sp('iceWraith', -10, 30), sp('iceWraith', 10, 24)]
        },
        {
          text: 'Clear the mooring yard', kind: 'kill', count: 30,
          spawns: [...horde(rng, 28, ALL, -40, 40, -10, -100), sp('frostBrute', -16, -60), sp('frostBrute', 16, -70), sp('iceWraith', 0, -90)]
        },
        {
          text: 'Thaw the airlock heaters', kind: 'interact', count: 2,
          onEnterText: 'Frozen brutes: the ice on them turns bullets. Go for the head.',
          spawns: [...horde(rng, 7, ALL, -56, -28, -66, -96), ...horde(rng, 7, ALL, 28, 56, -86, -116)]
        },
        {
          text: 'Into Proteus Station', kind: 'reach', zone: zone(0, -124, 8, 4, 0, 6),
          spawns: [...horde(rng, 8, ALL, -16, 16, -126, -144), sp('frostBrute', 0, -110)]
        }
      ],
      pickups: [
        ['ammo', 3, 0, 88], ['health', -4, 0, 50], ['ammo', 4, 0, 14], ['armour', -30, 0, -4],
        ['ammo', 30, 0, -30], ['health', 0, 0, -60], ['ammo', 0, 0, -100]
      ]
    };
  }
};

/* ================================================================ 32 */
export const NEPTUNE_2 = {
  id: 32, world: 'neptune',
  name: 'Cryo Labs',
  subtitle: 'Proteus Station, research wing',
  brief: 'The research wing froze with the staff still in it. Get into the main lab, open the three cryo vaults and hold the specimen deck while the samples thaw.',
  diff: outerMods(14),
  theme: { ...INSIDE, music: 32 },
  build(world, rng) {
    const d = outerDiff(14);
    ground(world, 420, 'grate', { uv: 0.4, mat: { color: 0x5a6470 } });
    const wall = 0xb8c4d4, cold = 0xcfe8ff;
    const frost = (x, z, n = 3) => { for (let i = 0; i < n; i++) iceSpire(world, x + rng.range(-1.5, 1.5), z + rng.range(-1.5, 1.5), rng.range(0.6, 1.6), rng, { collide: false }); };
    // the entry lock
    hall(world, 0, 70, 16, 24, 4.2, { doors: { north: [0, 3.6, 3] }, wall, light: cold, floor: 0x7a8490 });
    crates(world, -5, 64, rng, 3);
    frost(6, 76); frost(-6, 62);
    corridor(world, 0, 58, 0, 46, 4.2, rng, { w: 4, wall, light: cold, deadLight: 0x3a8aff });
    // the main lab: rows of cryo tanks down both sides
    hall(world, 0, 20, 40, 52, 6, { doors: { south: [0, 3.6, 3], north: [0, 3.6, 3], west: [0, 3.6, 3], east: [0, 3.6, 3] }, wall, light: cold, lightPower: 4 });
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) {
      const x = s * 12, z = 38 - k * 9;
      if (Math.abs(z - 20) < 3) continue;           // the aisle to the side doors
      world.cylinder(x, 1.4, z, 1.1, 1.1, 2.8, 'hull', { seg: 14, mat: { repeat: 1, color: 0x9ad8f0, metalness: 0.2 }, tag: 'tank' });
      world.light(0x6ac8ff, 2.2, x - s * 1.4, 2, z, 7);
      if (rng.chance(0.5)) frost(x - s * 2, z, 2);
    }
    for (let k = -1; k <= 1; k++) world.box(0, 0.5, 20 + k * 12, 4, 1, 1.6, 'hull', { uv: 0.6, mat: { color: 0xd0d8e0, repeat: 1 } });
    for (let i = 0; i < 6; i++) bloodPool(world, rng.range(-8, 8), rng.range(0, 42), rng.range(1, 2.2), i + 3200);
    // the vaults either side
    corridor(world, -20, 20, -36, 20, 4.2, rng, { w: 4, wall, light: cold });
    corridor(world, 20, 20, 36, 20, 4.2, rng, { w: 4, wall, light: cold });
    for (const s of [-1, 1]) {
      const rx = s * 50;
      hall(world, rx, 20, 28, 24, 5, { doors: s < 0 ? { east: [0, 3.6, 3] } : { west: [0, 3.6, 3] }, wall, light: 0x8ad8ff, lightPower: 3.5 });
      world.box(rx + s * 13.4, 2.4, 20, 0.6, 4.8, 10, 'rust', { uv: 0.5, collide: false, mat: { color: 0x5a6a7a, metalness: 0.7 } });   // the vault door
      world.shape(new THREE.TorusGeometry(3, 0.25, 8, 30), 'rust', { pos: [rx + s * 13, 2.4, 20], rot: [0, Math.PI / 2, 0], collide: false, mat: { color: 0x8a9aaa, metalness: 0.7 } });
      terminal(world, rx + s * 9, 0, 14, -s * Math.PI / 2, s < 0 ? 'CRYO VAULT 1' : 'CRYO VAULT 2');
      for (let k = -1; k <= 1; k++) world.box(rx - s * 4, 1.1, 20 + k * 7, 1.4, 2.2, 3, 'hull', { uv: 0.6, mat: { color: 0x6a7a8a, repeat: 1 } });
      frost(rx, 28, 4); frost(rx + s * 6, 12, 3);
    }
    // the specimen deck
    corridor(world, 0, -6, 0, -18, 4.2, rng, { w: 4, wall, light: cold });
    hall(world, 0, -40, 34, 44, 8, { doors: { south: [0, 3.6, 3], north: [0, 3.6, 3] }, wall, light: cold, lightPower: 4.5 });
    world.cylinder(0, 3, -44, 3, 3, 6, 'hull', { seg: 20, mat: { repeat: 1, color: 0x9ad8f0, metalness: 0.2 }, tag: 'specimen' });
    world.shape(new THREE.SphereGeometry(1.6, 14, 10), 'flesh', { pos: [0, 3, -44], scale: [1, 1.5, 1], collide: false, mat: { color: 0x6a5a8a, emissive: 0x1a2a4a } });
    world.shape(new THREE.TorusGeometry(3.05, 0.12, 6, 30), 'plaster', { pos: [0, 5.8, -44], rot: [Math.PI / 2, 0, 0], collide: false, mat: { color: 0xbff8ff, emissive: 0x6ad0ff, emissiveIntensity: 2 } });
    world.light(0x8ad8ff, 7, 0, 5, -40, 24);
    terminal(world, 0, 0, -36.4, 0, 'CRYO VAULT 3');
    for (const s of [-1, 1]) {
      screen(world, s * 16.7, 4, -40, 10, 3, -s * Math.PI / 2, 0x8ad8ff);
      for (const k of [-1, 1]) world.box(s * 10, 0.6, -40 + k * 12, 3, 1.2, 1.5, 'hull', { uv: 0.6, mat: { color: 0x2a3440, repeat: 1, metalness: 0.6 } });
    }
    crates(world, -12, -24, rng, 2);
    crates(world, 12, -56, rng, 2);
    // the hatch out to the drill road
    corridor(world, 0, -62, 0, -74, 4.2, rng, { w: 4, wall, light: cold });
    hall(world, 0, -88, 20, 28, 6, { doors: { south: [0, 3.6, 3] }, wall, light: cold });
    world.box(0, 2.4, -101.6, 6, 4.8, 0.3, 'rust', { uv: 0.5, collide: false, mat: { color: 0x3a4a5a, metalness: 0.7 } });
    world.sign('HATCH — DRILL ROAD', 0, 5.2, -101.4, 0, 6, '#8ad8ff');
    world.light(0x8ad8ff, 5, 0, 3, -96, 12);

    world.playerStart.set(0, 0, 78);
    world.playerFacing = 0;

    return {
      stages: [
        {
          text: 'Into the main lab', kind: 'reach', zone: zone(0, 36, 12, 6, 0, 6),
          spawns: [...horde(rng, 3, ['frostCrawler'], -5, 5, 62, 59), ...horde(rng, 12, NEP, -8, 8, 42, 2), sp('iceWraith', -16, 4), sp('frostBrute', 0, 0)]
        },
        {
          text: 'Open the three cryo vaults', kind: 'interact', count: 3,
          spawns: [...horde(rng, 6, ALL, -60, -40, 12, 28), ...horde(rng, 6, ALL, 40, 60, 12, 28), ...horde(rng, 6, ALL, -14, 14, -24, -60)]
        },
        {
          text: 'Hold the specimen deck while the samples thaw', kind: 'defend', duration: 55,
          ...waves(d, { waveKinds: ALL }),
          wavePoints: [[0, 0, 20], [-50, 0, 20], [50, 0, 20], [0, 0, -88]],
          onEnterText: 'THAWING — 55 SECONDS'
        },
        {
          text: 'Out through the hatch to the drill road', kind: 'reach', zone: zone(0, -94, 6, 6, 0, 6),
          onEnterText: 'The samples are from below the ice. Something is down there.',
          spawns: [sp('frostBrute', -5, -84), sp('frostBrute', 5, -84), sp('iceWraith', 0, -80)]
        }
      ],
      pickups: [
        ['ammo', 1.5, 0, 66], ['health', -6, 0, 30], ['ammo', 6, 0, 8], ['armour', -56, 0, 24],
        ['ammo', 56, 0, 24], ['health', -8, 0, -48], ['ammo', 8, 0, -30]
      ]
    };
  }
};

/* ================================================================ 33 */
export const NEPTUNE_3 = {
  id: 33, world: 'neptune',
  name: 'Methane Gale',
  subtitle: 'The anchor field, in a 2,000 km/h storm',
  brief: 'The fastest winds in the solar system are tearing the station off its anchors. Cross the field in the gale, clear it, lock three storm anchors and hold the last one.',
  diff: outerMods(15),
  theme: {
    ...DEEP, fogDensity: 0.0175, skyHorizon: 0x2a4a8a, hemi: [0x7aa0e0, 0x0a1430, 0.6],
    lightning: { every: [5, 11], colour: 0xb8d0ff, power: 2.2 },
    particles: { count: 1900, colour: 0xe8f4ff, embers: 0, size: 0.032, fall: [-9, -5], wind: 12 }, music: 31, tempo: 0.9
  },
  build(world, rng) {
    const d = outerDiff(15);
    ground(world, 460, ICE, { uv: 0.14, bumpy: 0.9, seg: 70, mat: { color: 0xa8c4e8, roughness: 0.4 } });
    cliff(world, -80, 130, -80, -180, 18, rng, ICE, { out: [-1, 0], tint: ICE_TINT });
    cliff(world, 80, 130, 80, -180, 18, rng, ICE, { out: [1, 0], tint: ICE_TINT });
    cliff(world, -82, -182, 82, -182, 20, rng, ICE, { out: [0, -1], tint: ICE_TINT });
    iceField(world, rng, 50, -74, 74, 120, -170, 10, (x, z) => Math.hypot(x + 46, z - 10) > 12 && Math.hypot(x - 48, z + 44) > 12 && Math.hypot(x + 42, z + 104) > 12);
    // windbreaks: slabs of ice and wrecked panels to duck behind
    const anchors = [[-46, 10, Math.PI / 2], [48, -44, -Math.PI / 2], [-42, -104, Math.PI / 2]];
    for (let i = 0; i < 18; i++) {
      const x = rng.sign() * rng.range(10, 60), z = rng.range(-160, 100);
      if (anchors.some(([ax, az]) => Math.hypot(x - ax, z - az) < 12)) continue;    // keep the anchors reachable
      world.box(x, 1.2, z, rng.range(3, 6), 2.4, 0.6, rng.chance(0.5) ? ICE : 'hull', { rotY: rng.range(-0.4, 0.4), uv: 0.5, mat: { color: 0xc8dcf0, repeat: 1 } });
    }
    // the three storm anchors, each with a tether up into the storm
    anchors.forEach(([x, z, r], i) => {
      world.cylinder(x, 2.5, z, 2.4, 3.2, 5, 'hull', { seg: 14, mat: { repeat: 1, color: 0x5a6a7a, metalness: 0.6 }, tag: 'anchor' });
      world.shape(new THREE.CylinderGeometry(0.4, 0.4, 200, 8), 'rust', { pos: [x - Math.sin(r) * 30, 100, z], rot: [0, 0, Math.sin(r) * 0.3], collide: false, mat: { color: 0x4a5a6a, metalness: 0.7 } });
      stormMast(world, x + Math.sin(r) * 2, z + 6, 12, 0x8ad8ff);
      terminal(world, x + Math.sin(r) * 5, 0, z, r, 'ANCHOR ' + (i + 1));
    });
    module(world, 0, -60, 12, 2.4, 0, rng, { label: 'SHELTER', labelColour: '#8ad8ff' });
    module(world, -24, 50, 8, 2, 0.4, rng, {});
    module(world, 26, -120, 10, 2, -0.3, rng, {});
    for (let i = 0; i < 4; i++) rover(world, rng.sign() * rng.range(14, 50), rng.range(-150, 80), rng() * TAU, rng, 0xc8d4e0);
    for (let i = 0; i < 6; i++) bloodPool(world, rng.range(-30, 30), rng.range(-150, 60), rng.range(1, 2.6), i + 3300);
    for (let i = 0; i < 4; i++) barrel(world, rng.range(-40, 40), rng.range(-150, 60), rng);
    // the drill road out at the far end
    world.box(0, 0.03, -150, 10, 0.06, 40, 'asphalt', { uv: 0.3, collide: false, mat: { color: 0x2a3440 } });
    world.sign('DRILL ROAD', 0, 4, -168, 0, 6, '#8ad8ff');
    world.box(0, 2, -168.4, 8, 4, 0.4, 'rust', { uv: 0.5, mat: { color: 0x2a3440 } });
    const moon = triton(world);

    world.playerStart.set(0, 0, 112);
    world.playerFacing = 0;

    return {
      follow: [moon],
      stages: [
        {
          text: 'Into the gale', kind: 'reach', zone: zone(0, 30, 30, 8, 0, 8),
          onEnterText: 'You cannot see far. Neither can they.',
          spawns: [...horde(rng, 16, NEP, -26, 26, 96, 36), sp('frostBrute', 0, 40)]
        },
        {
          text: 'Clear the anchor field', kind: 'kill', count: 36,
          spawns: [...horde(rng, 34, ALL, -56, 56, 30, -130), sp('frostBrute', -20, -30), sp('frostBrute', 20, -50), sp('frostBrute', 0, -100)]
        },
        {
          text: 'Lock the three storm anchors', kind: 'interact', count: 3,
          spawns: [...horde(rng, 6, ALL, -66, -30, 24, -4), ...horde(rng, 6, ALL, 30, 66, -30, -58), ...horde(rng, 6, ALL, -66, -30, -90, -118)]
        },
        {
          text: 'Hold the shelter while the station rides out the gust', kind: 'defend', duration: 60,
          ...waves(d, { waveKinds: ALL }),
          wavePoints: [[-50, 0, -20], [50, 0, -20], [-50, 0, -110], [50, 0, -100], [0, 0, 20], [0, 0, -140]],
          onEnterText: 'GUST FRONT — 60 SECONDS'
        },
        {
          text: 'To the drill road', kind: 'reach', zone: zone(0, -150, 16, 8, 0, 8),
          spawns: [sp('frostBrute', -10, -140), sp('frostBrute', 10, -144), ...horde(rng, 6, NEP, -30, 30, -110, -160)]
        }
      ],
      pickups: [
        ['ammo', 3, 0, 96], ['health', -4, 0, 50], ['ammo', 0, 0, 10], ['armour', -40, 0, -10],
        ['ammo', 40, 0, -60], ['health', 8, 0, -64], ['ammo', -30, 0, -110]
      ]
    };
  }
};

/* ================================================================ 34 */
export const NEPTUNE_4 = {
  id: 34, world: 'neptune',
  name: 'Deep Core Drill',
  subtitle: 'The bore, eleven kilometres into the ice',
  brief: 'The miners drilled down through the ice and found what was waiting. Reach the drill hall, set all three drill controls to lower the bore cage, clear the hall and ride it down.',
  diff: outerMods(16),
  theme: { ...DEEP, fogDensity: 0.0135, skyGlow: 0x6a8ae8, music: 30 },
  build(world, rng) {
    const d = outerDiff(16);
    ground(world, 460, ICE, { uv: 0.14, bumpy: 0.6, seg: 70, mat: { color: 0xa8c0e0, roughness: 0.4 } });
    cliff(world, -76, 130, -76, -170, 18, rng, ICE, { out: [-1, 0], tint: ICE_TINT });
    cliff(world, 76, 130, 76, -170, 18, rng, ICE, { out: [1, 0], tint: ICE_TINT });
    cliff(world, -78, -172, 78, -172, 20, rng, ICE, { out: [0, -1], tint: ICE_TINT });
    iceField(world, rng, 36, -70, 70, 120, -160, 10, (x, z) => Math.hypot(x + 32, z - 4) > 10 && Math.hypot(x - 36, z + 100) > 10 && !(Math.abs(x) < 30 && z < -34 && z > -132) && Math.hypot(x + 30, z - 34) > 8 && Math.hypot(x - 30, z - 20) > 8);
    world.box(0, 0.03, 30, 10, 0.06, 140, 'asphalt', { uv: 0.3, collide: false, mat: { color: 0x2a3440 } });
    for (const [x, z, h] of [[-34, 70, 18], [36, 50, 20], [-40, 10, 16], [42, -110, 22], [-44, -130, 18]]) drillRig(world, x, z, h, rng, 0x6a90c8);
    pipes(world, -34, 0.5, 70, -6, -40, rng, 0x6a90c8, 2);
    pipes(world, 36, 0.5, 50, 6, -40, rng, 0x6a90c8, 2);
    tankSphere(world, -30, 34, 4, 0xc8d4e0);
    tankSphere(world, 30, 20, 4, 0xc8d4e0);
    terminal(world, -32, 0, 4, Math.PI / 2, 'DRILL CONTROL 1');
    terminal(world, 36, 0, -100, -Math.PI / 2, 'DRILL CONTROL 3');
    // the drill hall: the bore in the floor, the drill string hanging over it
    hall(world, 0, -60, 44, 40, 10, { doors: { south: [0, 8, 6], north: [0, 6, 4.4] }, wall: 0xa8b4c4, light: 0xcfe8ff, lightPower: 5 });
    world.shape(new THREE.TorusGeometry(7, 0.6, 6, 40), 'rust', { pos: [0, 0.3, -62], rot: [Math.PI / 2, 0, 0], collide: false, mat: { color: 0x4a5a6a, metalness: 0.7 } });
    world.shape(new THREE.CircleGeometry(6.6, 40).rotateX(-Math.PI / 2), 'plaster', { pos: [0, 0.22, -62], collide: false, shadow: false, mat: { color: 0x02040a, emissive: 0x1a4a9a, emissiveIntensity: 0.9 } });
    world.collider(0, 2, -62, 12, 4, 12, 0, 'bore');                  // the bore itself: you go round it
    for (const s of [-1, 1]) world.box(s * 6.4, 0.6, -62, 0.3, 1.2, 12.6, 'rust', { uv: 1, collide: false, mat: { color: 0xd8b040 } });
    for (const s of [-1, 1]) world.box(0, 0.6, -62 + s * 6.4, 12.6, 1.2, 0.3, 'rust', { uv: 1, collide: false, mat: { color: 0xd8b040 } });
    world.shape(new THREE.CylinderGeometry(0.7, 0.7, 8.6, 12), 'rust', { pos: [0, 5.6, -62], collide: false, mat: { color: 0x9aa0a8, metalness: 0.8 } });
    world.light(0x6aa8ff, 9, 0, 2, -62, 26);
    terminal(world, 16, 0, -66, -Math.PI / 2, 'DRILL CONTROL 2');
    for (const s of [-1, 1]) {
      screen(world, s * 21.7, 5, -60, 10, 3, -s * Math.PI / 2, 0x8ad8ff);
      crates(world, s * 15, -46, rng, 3);
      world.box(s * 15, 1, -74, 4, 2, 4, 'rust', { uv: 0.5, mat: { color: 0x3a4a5a, metalness: 0.6 } });
    }
    for (let i = 0; i < 8; i++) bloodPool(world, rng.range(-18, 18), rng.range(-78, -42), rng.range(1, 2.6), i + 3400);
    trash(world, -10, -50, rng, 6);
    // the bore cage: out the back of the hall, a lift on a gantry over a second shaft
    world.cylinder(0, 0.15, -120, 3.4, 3.4, 0.3, 'grate', { seg: 24, mat: { color: 0xd8b040 }, tag: 'cage' });
    world.shape(new THREE.TorusGeometry(3.5, 0.12, 6, 30).rotateX(Math.PI / 2), 'plaster', { pos: [0, 0.32, -120], collide: false, mat: { color: 0x8ad8ff, emissive: 0x4ab8ff, emissiveIntensity: 2 } });
    for (const [x, z] of [[-3.6, -116.4], [3.6, -116.4], [-3.6, -123.6], [3.6, -123.6]]) world.box(x, 5, z, 0.3, 10, 0.3, 'rust', { uv: 1, mat: { color: 0x8a8e96, metalness: 0.6 } });
    world.box(0, 10.2, -120, 7.6, 0.4, 7.6, 'rust', { uv: 0.6, collide: false, mat: { color: 0x5a5e66, metalness: 0.6 } });
    world.light(0x8ad8ff, 6, 0, 4, -120, 14);
    for (let i = 0; i < 4; i++) barrel(world, rng.range(-30, 30), rng.range(-140, 80), rng);
    const moon = triton(world);

    world.playerStart.set(0, 0, 110);
    world.playerFacing = 0;

    return {
      follow: [moon],
      stages: [
        {
          text: 'Up the drill road to the hall', kind: 'reach', zone: zone(0, -32, 16, 6, 0, 6),
          spawns: [...horde(rng, 18, ALL, -30, 30, 96, -24), sp('iceWraith', -10, 0), sp('iceWraith', 10, -10)]
        },
        {
          text: 'Set the three drill controls', kind: 'interact', count: 3,
          spawns: [...horde(rng, 6, ALL, -52, -20, 18, -10), ...horde(rng, 7, ALL, -18, 18, -46, -78), ...horde(rng, 6, ALL, 22, 56, -86, -116)]
        },
        {
          text: 'Clear the drill hall', kind: 'kill', count: 36,
          onEnterText: 'THE BORE CAGE IS COMING UP — AND SO ARE THEY',
          spawns: [...horde(rng, 30, ALL, -18, 18, -44, -78), ...horde(rng, 6, NEP, -20, 20, -84, -110), sp('frostBrute', -12, -50), sp('frostBrute', 12, -72)]
        },
        {
          text: 'Ride the bore cage down', kind: 'reach', zone: zone(0, -120, 6, 6, 0, 6),
          spawns: [sp('frostBrute', -8, -108), sp('frostBrute', 8, -110), ...horde(rng, 4, ['iceWraith', 'frostCrawler'], -14, 14, -96, -130)]
        }
      ],
      pickups: [
        ['ammo', 3, 0, 90], ['health', -4, 0, 40], ['ammo', 4, 0, -12], ['armour', -10, 0, -48],
        ['ammo', 10, 0, -76], ['health', -16, 0, -96], ['ammo', 6, 0, -106]
      ]
    };
  }
};

/* ================================================================ 35 */
export const NEPTUNE_5 = {
  id: 35, world: 'neptune',
  name: 'The Frozen Choir',
  subtitle: 'The cavern under the ice',
  brief: 'Under the ice the Hive grew a forest of crystal that sings the signal outward. Get through it, jam the three Hive relays, and hold the relay station while the jam spreads.',
  diff: outerMods(17),
  theme: {
    ...DEEP, skyTop: 0x01020a, skyHorizon: 0x0a1a4a, skyGround: 0x02061a, skyGlow: 0x5a8aff, glowDir: [0, 0.4, -1], stars: 0, clouds: 0,
    fog: 0x0a1a44, fogDensity: 0.014, hemi: [0x5a8ae8, 0x02061a, 0.55], sun: { colour: 0x9ab8ff, intensity: 0.4, pos: [0, 60, -20] },
    particles: { count: 700, colour: 0xbff8ff, embers: 0, size: 0.05 }, music: 29, tempo: 0.8
  },
  build(world, rng) {
    const d = outerDiff(17);
    ground(world, 460, ICE, { uv: 0.14, bumpy: 0.7, seg: 70, mat: { color: 0x8aa8d8, roughness: 0.3 } });
    cliff(world, -70, 130, -70, -170, 22, rng, ICE, { out: [-1, 0], tint: 0x7a98c8 });
    cliff(world, 70, 130, 70, -170, 22, rng, ICE, { out: [1, 0], tint: 0x7a98c8 });
    cliff(world, -72, -172, 72, -172, 24, rng, ICE, { out: [0, -1], tint: 0x7a98c8 });
    cliff(world, -72, 132, 72, 132, 20, rng, ICE, { out: [0, 1], tint: 0x7a98c8 });
    // the choir: a forest of glowing spires, the big ones humming (kept off the relays and the station)
    const relays = [[-40, 40], [44, -20], [-38, -96]];
    const open = (x, z) => relays.every(([rx, rz]) => Math.hypot(x - rx, z - rz) > 13) && !(Math.abs(x) < 20 && z < -42 && z > -78);
    iceField(world, rng, 90, -64, 64, 124, -164, 6, open);
    for (let i = 0; i < 14; i++) {
      const x = rng.sign() * rng.range(14, 60), z = rng.range(-160, 110);
      if (!open(x, z)) continue;
      iceSpire(world, x, z, rng.range(10, 18), rng, { colour: 0xbff0ff });
      if (i % 2 === 0) world.light(0x8ae8ff, 5, x, 3, z, 18);
    }
    // the three Hive relays: nests of flesh fused round a crystal
    const growth = { color: 0x5a6a9a, emissive: 0x0a1a3a, roughness: 0.5 };
    relays.forEach(([x, z], i) => {
      iceSpire(world, x, z, 14, rng, { colour: 0xdffcff });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU, s = rng.range(1, 2.2);
        world.shape(new THREE.SphereGeometry(1, 10, 8), 'flesh', { pos: [x + Math.cos(a) * 4, s * 0.2, z + Math.sin(a) * 4], scale: [s * 1.4, s * 0.6, s * 1.3], collide: false, mat: growth });
      }
      world.light(0xbff8ff, 7, x, 4, z, 20);
      const tx = x + (x < 0 ? 7 : -7);
      terminal(world, tx, 0, z, x < 0 ? Math.PI / 2 : -Math.PI / 2, 'JAMMER ' + (i + 1));
      crates(world, tx + (x < 0 ? 1.5 : -1.5), z + 4, rng, 2);
    });
    // the relay station the miners built down here
    hall(world, 0, -60, 30, 26, 7, { doors: { south: [0, 5, 4], north: [0, 5, 4], west: [0, 4, 3.2], east: [0, 4, 3.2] }, wall: 0xa8b4c4, light: 0xcfe8ff, lightPower: 4 });
    for (const s of [-1, 1]) {
      screen(world, s * 14.7, 3.8, -54, 6, 2.4, -s * Math.PI / 2, 0x8ad8ff);
      world.box(s * 8, 0.6, -60, 3, 1.2, 1.5, 'hull', { uv: 0.6, mat: { color: 0x2a3440, repeat: 1, metalness: 0.6 } });
      crates(world, s * 8, -68, rng, 2);
    }
    mast(world, 0, -78, 16, rng);
    for (let i = 0; i < 8; i++) bloodPool(world, rng.range(-30, 30), rng.range(-150, 100), rng.range(1, 2.6), i + 3500);
    // the way down: a glowing fissure at the back of the cavern
    world.shape(new THREE.PlaneGeometry(12, 30).rotateX(-Math.PI / 2), 'plaster', { pos: [0, 0.04, -146], collide: false, shadow: false, mat: { color: 0x02040a, emissive: 0x3a7aff, emissiveIntensity: 0.9 } });
    world.light(0x6aa8ff, 9, 0, 3, -146, 30);

    world.playerStart.set(0, 0, 112);
    world.playerFacing = 0;

    return {
      stages: [
        {
          text: 'Through the singing spires', kind: 'reach', zone: zone(0, 20, 30, 8, 0, 8),
          onEnterText: 'Listen. It is the signal. It is coming from below.',
          spawns: [...horde(rng, 18, ALL, -24, 24, 96, 26), sp('iceWraith', -12, 30), sp('iceWraith', 12, 34)]
        },
        {
          text: 'Jam the three Hive relays', kind: 'interact', count: 3,
          spawns: [...horde(rng, 7, EVERY, -58, -24, 54, 26), ...horde(rng, 7, EVERY, 28, 60, -6, -34), ...horde(rng, 7, EVERY, -58, -24, -82, -110)]
        },
        {
          text: 'Hold the relay station while the jam spreads', kind: 'defend', duration: 65,
          ...waves(d, { waveKinds: EVERY }),
          wavePoints: [[-40, 0, -30], [40, 0, -30], [-40, 0, -100], [40, 0, -100], [0, 0, 0], [0, 0, -130]],
          onEnterText: 'JAMMING — 65 SECONDS'
        },
        {
          text: 'Down into the fissure', kind: 'reach', zone: zone(0, -140, 10, 8, 0, 6),
          onEnterText: 'The Choir is silent. Something below has noticed.',
          spawns: [sp('frostBrute', -10, -120), sp('frostBrute', 10, -124), ...horde(rng, 6, NEP, -20, 20, -100, -150)]
        }
      ],
      pickups: [
        ['ammo', 3, 0, 96], ['health', -4, 0, 46], ['ammo', 0, 0, 10], ['armour', -30, 0, 40],
        ['ammo', 30, 0, -20], ['health', -6, 0, -60], ['ammo', 6, 0, -100]
      ]
    };
  }
};

/* ================================================================ 36 */
export const NEPTUNE_6 = {
  id: 36, world: 'neptune',
  name: 'The Progenitor',
  subtitle: 'The bottom of the deep — where the rift was born',
  brief: 'This is where the rift began: a nest the size of a city, frozen into the bottom of the deep. Break the brood, kill the Progenitor, and hold the escape ship. Then go home.',
  diff: outerMods(18),
  theme: {
    ...DEEP, skyTop: 0x02010a, skyHorizon: 0x1a0a3a, skyGround: 0x04020a, skyGlow: 0xaa3aff, glowDir: [0, 0.25, -1], stars: 0, clouds: 0.5,
    fog: 0x120a30, fogDensity: 0.0125, hemi: [0x7a6ae8, 0x04020a, 0.6], sun: { colour: 0xc8b8ff, intensity: 0.5, pos: [-30, 50, -60] },
    particles: { count: 900, colour: 0xd8c8ff, embers: 0, size: 0.05 }, music: 27, tempo: 1.1
  },
  build(world, rng) {
    const d = outerDiff(18);
    ground(world, 440, ICE, { uv: 0.14, bumpy: 0.8, seg: 70, mat: { color: 0x7a88c0, roughness: 0.3 } });
    // the arena: the nest crater, entered down an ice gully from the south
    const R = 66;
    const C = (a, b, c, e, h, out) => cliff(world, a, b, c, e, h, rng, ICE, { out, tint: 0x6a78b0 });
    C(-R, 40, -R, -144, 26, [-1, 0]);
    C(R, 40, R, -144, 26, [1, 0]);
    C(-R, -146, R, -146, 28, [0, -1]);
    C(-R, 42, -10, 42, 24, [0, 1]);
    C(10, 42, R, 42, 24, [0, 1]);
    C(-10, 44, -10, 124, 18, [-1, 0]);
    C(10, 44, 10, 124, 18, [1, 0]);
    C(-10, 126, 10, 126, 16, [0, 1]);
    iceField(world, rng, 20, -8, 8, 120, 50, 3.5);
    // the brood: flesh and crystal fused together, glowing violet
    const growth = { color: 0x4a3a7a, emissive: 0x14082a, roughness: 0.45 };
    const pod = { color: 0xe0c8ff, emissive: 0xaa6aff, emissiveIntensity: 1.7 };
    for (let i = 0; i < 52; i++) {
      const a = rng() * TAU, r = rng.range(8, 58);
      const x = Math.cos(a) * r, z = -62 + Math.sin(a) * r * 1.2;
      if (Math.abs(x) < 6 && z > -40) continue;
      if (Math.abs(x) < 13 && z < -114) continue;      // keep the ship's pad clear
      const s = rng.range(0.8, 3.4);
      world.shape(new THREE.SphereGeometry(1, 12, 8), 'flesh', { pos: [x, s * 0.2, z], scale: [s * rng.range(1, 1.8), s * rng.range(0.5, 1), s * rng.range(1, 1.6)], rot: [0, rng() * TAU, 0], uv: 2, collide: false, mat: growth });
      if (s > 2.3) world.collider(x, s * 0.4, z, s * 1.6, s * 0.8, s * 1.6, 0, 'growth');
      if (rng.chance(0.5)) iceSpire(world, x + rng.range(-s, s), z + rng.range(-s, s), rng.range(1.5, 4), rng, { colour: 0xd8c8ff, collide: false });
      for (let k = 0; k < 3; k++) {
        if (!rng.chance(0.6)) continue;
        world.shape(new THREE.SphereGeometry(0.32, 8, 6), 'plaster', { pos: [x + rng.range(-s, s), s * 0.6 + rng.range(0, 0.4), z + rng.range(-s, s)], scale: [1, 1.4, 1], collide: false, shadow: false, mat: pod });
      }
      if (i % 5 === 0) world.light(0xaa6aff, 5, x, 2, z, 16);
    }
    for (let i = 0; i < 26; i++) {
      const side = rng.pick([[-R + 2, rng.range(-134, 30)], [R - 2, rng.range(-134, 30)], [rng.range(-60, 60), -144]]);
      world.shape(new THREE.CylinderGeometry(0.4, 0.9, rng.range(10, 22), 7), 'flesh', { pos: [side[0], 5, side[1]], rot: [rng.range(-0.3, 0.3), 0, rng.range(-0.4, 0.4)], collide: false, mat: growth });
    }
    // the birth-pit it climbs out of
    world.shape(new THREE.TorusGeometry(15, 0.9, 6, 44), ICE, { pos: [0, 0.35, -62], rot: [Math.PI / 2, 0, 0], collide: false, mat: { color: 0x9a8ad8 } });
    world.shape(new THREE.CircleGeometry(14.4, 44).rotateX(-Math.PI / 2), 'plaster', { pos: [0, 0.04, -62], collide: false, shadow: false, mat: { color: 0x0a0418, emissive: 0x7a2aff, emissiveIntensity: 0.9 } });
    world.light(0xaa6aff, 14, 0, 6, -62, 44);
    // the miners' last camp, and the escape ship they never reached
    for (let i = 0; i < 3; i++) module(world, rng.sign() * rng.range(32, 52), rng.range(-130, -20), rng.range(8, 12), 2.2, rng() * TAU, rng, { lit: false });
    for (let i = 0; i < 10; i++) bloodPool(world, rng.range(-40, 40), rng.range(-130, 20), rng.range(1.5, 3.5), i + 3600);
    const ez = -128;
    landingPad(world, 0, ez, 10, 0x7aff9a);
    const ship = rocket(world, 0, ez - 3, 0.62, 0x2a8a4a);
    world.sign('EVAC — HOME', 0, 4.5, ez + 1.2, 0, 4, '#7aff9a');

    world.playerStart.set(0, 0, 114);
    world.playerFacing = 0;

    return {
      ship,
      stages: [
        {
          text: 'Down the gully to the bottom of the deep', kind: 'reach', zone: zone(0, 30, 24, 8, 0, 8),
          onEnterText: 'Everything that ever came through the rift came from here.',
          spawns: [...horde(rng, 16, NEP, -7, 7, 106, 36), sp('iceWraith', -4, 60), sp('iceWraith', 4, 72)]
        },
        {
          text: 'Break the brood', kind: 'kill', count: 40,
          spawns: [...horde(rng, 36, EVERY, -56, 56, 30, -132), sp('frostBrute', -20, -40), sp('frostBrute', 20, -50), sp('frostBrute', 0, -96), sp('stormHulk', -30, -100), sp('titan', 30, -100)]
        },
        {
          text: 'Kill the Progenitor', kind: 'boss', boss: { kind: 'progenitor', at: [0, 0, -66] },
          onEnterText: 'THE PROGENITOR RISES',
          waveEvery: d.waveEvery + 2, waveSize: 3, maxAlive: 15,
          waveKinds: ['frozenCrew', 'iceWraith', 'frostCrawler', 'stormLeaper', 'acidCrawler'],
          wavePoints: [[-58, 0, -20], [58, 0, -20], [-58, 0, -124], [58, 0, -124], [0, 0, 30]]
        },
        {
          text: 'Hold the escape ship while it spins up — last stand', kind: 'defend', duration: 50,
          ...waves(d, { waveKinds: EVERY }),
          wavePoints: [[-58, 0, -20], [58, 0, -20], [-58, 0, -124], [58, 0, -124], [0, 0, 30]],
          onEnterText: 'ENGINES SPINNING UP — 50 SECONDS'
        },
        { text: 'Board the ship — go home', kind: 'reach', zone: zone(0, ez + 9, 8, 5, 0, 6) }
      ],
      pickups: [
        ['ammo', 2, 0, 98], ['health', -2, 0, 62], ['ammo', 0, 0, 34], ['armour', -30, 0, -14],
        ['ammo', 30, 0, -34], ['health', 0, 0, -30], ['ammo', -22, 0, -114], ['health', 22, 0, -118]
      ]
    };
  }
};

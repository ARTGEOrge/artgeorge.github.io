/* Demon Fall — the Mars campaign, stages 7 to 12.
 *
 * Thousands got off Earth. They brought the infection with them. The colony at
 * Tharsis went quiet three weeks before you landed; now it is full of the
 * people who ran here, in their uniforms, with green light in their eyes.
 *
 * Same format as the Earth stages: build() lays out the world and returns the
 * stage script. `diff` scales every enemy that spawns in the level. */
import * as THREE from 'three';
import { ground, roomWalls, barrel, fireSource } from './world.js';
import { crates, scorch, bloodPool, trash } from './props.js';
import { zone, terminal } from './levels-a.js';
import {
  sp, horde, spaceDiff, waves, rock, scree, cliff, mesas, dome, module, solarArray, mast, rover,
  container, landingPad, rocket, lightStrip, hall, pipes, planter, drillRig, oreCart, screen, skyBody
} from './space-kit.js';
import { TAU } from './util.js';

/* Mars at dusk: a butterscotch haze, the sun going down blue. */
const DUSK = {
  skyTop: 0x2a1620, skyHorizon: 0xb8674a, skyGround: 0x3a1a12, skyGlow: 0x3a4a70,
  glowDir: [-0.6, 0.12, -1], stars: 0.35, rift: 0,
  fog: 0x8a4a34, fogDensity: 0.0115, fogMix: 0.08,
  hemi: [0xd8987a, 0x4a2216, 0.75],
  sun: { colour: 0xffd2b0, intensity: 1.15, pos: [-50, 38, -60] },
  space: 'mars', gravity: 14.5, jump: 7.0,
  particles: { count: 650, colour: 0xa8705a, embers: 0, size: 0.045 }
};
/* Inside the habitats: emergency power, dust in the air. */
const INSIDE = {
  skyTop: 0x05050a, skyHorizon: 0x0a0a12, skyGround: 0x05050a, skyGlow: 0x000000, stars: 0, rift: 0,
  fog: 0x0c0a0c, fogDensity: 0.036, fogMix: 0.2,
  hemi: [0x3a3440, 0x0a0808, 0.4],
  sun: { colour: 0x6a5a58, intensity: 0.15, pos: [0, 40, 0] },
  dark: true, space: 'mars', gravity: 14.5, jump: 7.0,
  particles: { count: 380, colour: 0xa08070, embers: 0, size: 0.045 }
};

const marsDiff = n => { const d = spaceDiff(n); return { hp: d.hp, speed: d.speed, damage: d.damage, fire: d.fire, drop: d.drop }; };

/** Boulders scattered over an area, kept off a corridor down the middle. */
function scatterRocks(world, rng, n, x0, x1, z0, z1, keepOut = 8, mat = 'redrock') {
  for (let i = 0; i < n; i++) {
    const x = rng.range(x0, x1), z = rng.range(z0, z1);
    if (Math.abs(x) < keepOut) continue;
    const big = rng.chance(0.25);
    rock(world, x, z, big ? rng.range(1.4, 3.2) : rng.range(0.4, 1.1), rng, mat);
    if (rng.chance(0.4)) scree(world, x, z, rng.int(3, 7), 3, rng, mat);
  }
}

/** Wall along z (constant x) with doorway gaps. */
function wallZ(world, x, zTop, zBot, gaps, h, gapW = 3.2, mat = 'panel', tint = 0xc4c8d0) {
  const cuts = gaps.map(z => [z - gapW / 2, z + gapW / 2]).sort((a, b) => b[0] - a[0]);
  let top = zTop;
  for (const [lo, hi] of cuts) {
    if (top - hi > 0.1) world.box(x, h / 2, (top + hi) / 2, 0.4, h, top - hi, mat, { uv: 0.4, mat: { color: tint } });
    world.box(x, h - 0.4, (lo + hi) / 2, 0.4, 0.8, hi - lo, mat, { uv: 0.4, mat: { color: tint } });
    top = lo;
  }
  if (top - zBot > 0.1) world.box(x, h / 2, (top + zBot) / 2, 0.4, h, top - zBot, mat, { uv: 0.4, mat: { color: tint } });
}

/** Low colony perimeter wall along x with a gate gap in the middle. */
function perimeter(world, z, x0, x1, gate, rng) {
  for (const [a, b] of [[x0, -gate / 2], [gate / 2, x1]]) {
    world.box((a + b) / 2, 1.6, z, b - a, 3.2, 0.8, 'panel', { uv: 0.4, mat: { color: 0xc8beb0 } });
    for (let x = a + 4; x < b; x += 8) world.box(x, 1.8, z, 0.5, 3.6, 1.1, 'rust', { uv: 1, collide: false, mat: { color: 0x6a6e76, metalness: 0.6 } });
  }
  for (const s of [-1, 1]) {
    world.box(s * (gate / 2 + 0.6), 3.5, z, 1.2, 7, 1.6, 'panel', { uv: 0.5, mat: { color: 0xb8b0a4 } });
    world.box(s * (gate / 2 + 2.8), 2.2, z - 1.4, 3.4, 4.4, 0.4, 'rust', { uv: 0.8, mat: { color: 0x8a6a3a, metalness: 0.5 } });   // gate leaves, slid open
    world.light(0xffa040, 4, s * (gate / 2 + 0.6), 6.4, z + 1, 14);
  }
  world.box(0, 7.2, z, gate + 2.4, 0.6, 1.6, 'panel', { uv: 0.5, collide: false, mat: { color: 0xb8b0a4 } });
}

/* ================================================================= 7 */
export const MARS_1 = {
  id: 7, world: 'mars',
  name: 'Red Arrival',
  subtitle: 'Tharsis landing field, dusk',
  brief: 'The colony went quiet. The people who fled here are still here — infected. Get through the field and into the Hab Ring.',
  diff: marsDiff(1),
  theme: { ...DUSK, music: 43 },
  build(world, rng) {
    const d = spaceDiff(1);
    ground(world, 460, 'sand', { uv: 0.22, bumpy: 0.5, seg: 70, mat: { color: 0xe0a080 } });

    // the ship you came in on, still ticking as it cools
    landingPad(world, -16, 116, 9);
    rocket(world, -16, 116, 0.75, 0xc8102e);
    scorch(world, -16, 116, 18);
    landingPad(world, 18, 84, 8, 0x6ae0ff);
    landingPad(world, -22, 56, 8);
    container(world, 22, 72, 0.3, 0x3a6a8a, rng, 2);
    container(world, 28, 92, -0.2, 0xa84a2a, rng);
    rover(world, 9, 64, 0.5, rng);
    rover(world, -9, 38, 2.6, rng, 0xc8b8a0);

    // the road in: marker posts with amber lamps
    for (let z = 100; z > -126; z -= 12) {
      for (const s of [-1, 1]) {
        world.box(s * 7.5, 0.6, z, 0.25, 1.2, 0.25, 'rust', { uv: 1, collide: false, mat: { color: 0xd8d4cc } });
        world.box(s * 7.5, 1.25, z, 0.3, 0.12, 0.3, 'plaster', { uv: 1, collide: false, mat: { color: 0xffa040, emissive: 0xff8020, emissiveIntensity: 2 } });
      }
    }
    world.box(0, 0.03, -10, 12, 0.06, 230, 'grate', { uv: 0.3, collide: false, mat: { color: 0x7a5a4a } });

    // solar farms either side
    for (let i = 0; i < 5; i++) {
      solarArray(world, -48, 70 - i * 9, 0, 6, rng, 0.6);
      solarArray(world, 50, 64 - i * 9, 0, 5, rng, 0.6);
    }

    // the cargo yard: stacked containers make lanes
    const yard = [[-14, 22, 0, 0xa84a2a, 2], [14, 18, 0.1, 0x3a6a8a, 1], [-24, 4, Math.PI / 2, 0x6a7a3a, 2], [24, 0, Math.PI / 2, 0xc8a030, 2],
      [-10, -6, 0.2, 0x8a8a90, 1], [12, -16, -0.15, 0xa84a2a, 2], [-30, -22, 0, 0x3a6a8a, 1], [30, -12, 0, 0x6a7a3a, 1], [0, 8, Math.PI / 2, 0x8a3a3a, 1]];
    for (const [x, z, r, c, n] of yard) container(world, x, z, r, c, rng, n);
    crates(world, -4, 26, rng, 4);
    crates(world, 6, -2, rng, 3);
    for (let i = 0; i < 6; i++) barrel(world, rng.range(-26, 26), rng.range(-24, 26), rng);

    // pump station and comms mast: the gate's two power feeds
    module(world, -38, -18, 12, 2.2, 0, rng, { label: 'PUMP STATION', labelColour: '#ffb040' });
    terminal(world, -34, 0, -13.6, 0, 'PUMP FEED');
    pipes(world, -32, 0.4, -18, -8, -38, rng, 0x8a6a4a, 2);
    mast(world, 36, -28, 16, rng);
    module(world, 42, -22, 8, 1.8, Math.PI / 2, rng, { lit: true });
    terminal(world, 33, 0, -24, -Math.PI / 4, 'MAST FEED');

    perimeter(world, -46, -96, 96, 12, rng);
    world.sign('THARSIS COLONY — HAB RING', 0, 8.6, -45.1, 0, 10, '#ffb040');

    // beyond the gate: the Hab Ring domes
    dome(world, 0, -150, 18, rng, { door: 0 });
    dome(world, -42, -128, 11, rng, { door: Math.PI / 2 });
    dome(world, 44, -140, 13, rng, { door: -Math.PI / 2 });
    dome(world, -30, -184, 9, rng, {});
    module(world, -22, -112, 10, 2, 0.4, rng, { label: 'MED' });
    module(world, 26, -108, 12, 2.2, -0.3, rng, { label: 'STORES' });
    rover(world, -12, -92, 1.2, rng);
    rover(world, 14, -78, -0.4, rng, 0xb8a890);
    for (let i = 0; i < 6; i++) bloodPool(world, rng.range(-12, 12), rng.range(-120, -60), rng.range(1, 2.4), i + 70);
    fireSource(world, 14, 0.3, -78, 1.2);          // the rover is still burning

    scatterRocks(world, rng, 90, -110, 110, 120, -200, 9);
    cliff(world, -96, 130, -96, -210, 16, rng, 'redrock', { out: [-1, 0] });
    cliff(world, 96, 130, 96, -210, 16, rng, 'redrock', { out: [1, 0] });
    mesas(world, 250, 22, rng);
    const phobos = skyBody(world, 'phobos', [0.5, 0.35, -1], 600, 26);

    world.playerStart.set(0, 0, 104);
    world.playerFacing = 0;

    return {
      follow: [phobos],
      stages: [
        {
          text: 'Cross the landing field to the cargo yard',
          kind: 'reach', zone: zone(0, 28, 40, 10, 0, 8),
          onEnterText: 'Colony channel: nothing but breathing.',
          spawns: horde(rng, 12, ['colonist', 'colonist', 'colonist', 'sprinter'], -22, 22, 92, 32)
        },
        {
          text: 'Clear the cargo yard', kind: 'kill', count: 16,
          spawns: [
            ...horde(rng, 15, ['colonist', 'colonist', 'sprinter'], -30, 30, 20, -30),
            sp('colonist', -44, 6), sp('colonist', 44, -4), sp('sprinter', 0, -36)
          ]
        },
        {
          text: 'Power the gate: pump feed and mast feed', kind: 'interact', count: 2,
          spawns: [...horde(rng, 5, ['colonist', 'sprinter'], -48, -26, -8, -32), ...horde(rng, 5, ['colonist', 'sprinter'], 26, 48, -12, -36)]
        },
        {
          text: 'Hold the gate while it cycles', kind: 'defend', duration: 40,
          ...waves(d, { waveKinds: ['colonist', 'colonist', 'sprinter'] }),
          wavePoints: [[-56, 0, -24], [56, 0, -24], [0, 0, 36], [-34, 0, -70], [34, 0, -70]],
          onEnterText: 'GATE CYCLING — 40 SECONDS'
        },
        {
          text: 'Reach the Hab Ring airlock', kind: 'reach', zone: zone(0, -128.5, 8, 5, 0, 8),
          spawns: [...horde(rng, 11, ['colonist', 'colonist', 'sprinter'], -26, 26, -60, -118), sp('hulk', 0, -112)]
        }
      ],
      pickups: [
        ['ammo', 3, 0, 90], ['health', -5, 0, 66], ['ammo', 4, 0, 40], ['armour', -18, 0, 14],
        ['ammo', 18, 0, -4], ['health', -6, 0, -18], ['ammo', -34, 0, -28], ['ammo', 34, 0, -34],
        ['health', 0, 0, -40], ['armour', 20, 0, -60], ['ammo', -8, 0, -76], ['health', 6, 0, -100], ['ammo', -4, 0, -116]
      ]
    };
  }
};

/* ================================================================= 8 */
export const MARS_2 = {
  id: 8, world: 'mars',
  name: 'Hab Ring',
  subtitle: 'Residential ring, emergency power',
  brief: 'Life support is down and the crew quarters are full. Bring three relays back, then fight through the hub to the greenhouse lock.',
  diff: marsDiff(2),
  theme: { ...INSIDE, music: 40 },
  build(world, rng) {
    const d = spaceDiff(2);
    ground(world, 480, 'grate', { uv: 0.4, mat: { color: 0x7a7e86 } });
    const H = 4.2, zTop = 24, zBot = -172;
    const west = [4, -46, -96, -140], east = [-22, -70, -118];
    const relays = new Map([[-22, 'RELAY A'], [-96, 'RELAY B'], [-140, 'RELAY C']]);

    // the spine corridor
    wallZ(world, -4, zTop, zBot, west, H);
    wallZ(world, 4, zTop, zBot, east, H);
    world.box(0, H / 2, zTop, 8.4, H, 0.4, 'panel', { uv: 0.4, mat: { color: 0xc4c8d0 } });
    world.box(0, H + 0.2, (zTop + zBot) / 2, 8.8, 0.4, zTop - zBot, 'panel', { uv: 0.3, mat: { color: 0x9a9ea6 } });
    world.box(0, 0.02, (zTop + zBot) / 2, 8, 0.04, zTop - zBot, 'grate', { uv: 0.6, collide: false, mat: { color: 0xa0a4ac } });
    for (let z = zTop - 6; z > zBot; z -= 10) {
      const dead = rng.chance(0.3);
      world.box(0, H - 0.04, z, 0.4, 0.06, 3, 'plaster', { uv: 1, collide: false, mat: dead ? { color: 0x2a2a2e } : { color: 0xdff0ff, emissive: 0xdff0ff, emissiveIntensity: 1.4 } });
      if (!dead) world.light(0xcfe4ff, 3.2, 0, H - 0.5, z, 11);
      else world.light(0xff3020, 1.6, 0, H - 0.5, z, 8);
    }
    pipes(world, -3.6, H - 0.5, zTop, -3.6, zBot, rng, 0x7a6a5a, 2);
    pipes(world, 3.6, H - 0.6, zTop, 3.6, zBot, rng, 0x4a6a8a, 2);
    for (let z = zTop - 14; z > zBot; z -= 28) {
      world.sign('HAB RING — SECTOR ' + (1 + ((zTop - z) / 28 | 0)), -3.75, 2.8, z, Math.PI / 2, 3, '#6ae0ff');
      world.sign('HUB ▲', 3.75, 2.8, z - 8, -Math.PI / 2, 2, '#ffb040');
    }
    // barricades the crew threw up and lost
    for (const z of [-34, -84, -128, -158]) {
      crates(world, rng.sign() * 2, z, rng, 3);
      trash(world, rng.range(-2, 2), z - 3, rng, 4);
    }

    // rooms off the spine: quarters, med bay, labs
    const room = (x, z, side) => {
      const w = 14, dd = 12;
      roomWalls(world, x, z, w, dd, H, 'panel', { doors: side < 0 ? { east: [0, dd] } : { west: [0, dd] }, mat: { uv: 0.4, mat: { color: 0xb8bcc4 } } });
      world.box(x, H + 0.2, z, w + 0.4, 0.4, dd + 0.4, 'panel', { uv: 0.3, mat: { color: 0x9a9ea6 } });
      lightStrip(world, x, H - 0.05, z, 4, true, rng.chance(0.5) ? 0xdff0ff : 0xffc890, 3);
      // bunks or lab benches along the back wall
      const back = x + side * (w / 2 - 1.2);
      for (let k = -1; k <= 1; k++) {
        world.box(back, 0.5, z + k * 3.6, 2, 1, 3, 'hull', { uv: 0.6, mat: { color: 0xc8ccd2, repeat: 1 } });
        world.box(back, 1.9, z + k * 3.6, 2, 0.12, 3, 'hull', { uv: 0.6, collide: false, mat: { color: 0xc8ccd2, repeat: 1 } });
        world.box(back, 1.05, z + k * 3.6, 1.8, 0.12, 2.6, 'plaster', { uv: 1, collide: false, mat: { color: rng.pick([0x3a6a8a, 0x8a3a3a, 0x6a6a3a]) } });
      }
      if (relays.has(z)) terminal(world, x - side * 1, 0, z - dd / 2 + 0.6, 0, relays.get(z));
      else crates(world, x, z + rng.range(-3, 3), rng, rng.int(2, 3));
      bloodPool(world, x + rng.range(-2, 2), z + rng.range(-3, 3), rng.range(1, 2.4), (z | 0) + 200);
    };
    west.forEach(z => room(-11, z, -1));
    east.forEach(z => room(11, z, 1));

    // the hub: a tall round-ish chamber with the reactor in the middle
    const hz = -190, HH = 8;
    roomWalls(world, 0, hz, 36, 36, HH, 'panel', { doors: { south: [0, 8, H], north: [0, 4, 3.4] }, mat: { uv: 0.35, mat: { color: 0xd0d0d6 } } });
    world.box(0, HH + 0.3, hz, 37, 0.6, 37, 'panel', { uv: 0.25, mat: { color: 0x8a8e96 } });
    world.box(0, 0.02, hz, 36, 0.04, 36, 'grate', { uv: 0.5, collide: false, mat: { color: 0x8a8e96 } });
    world.cylinder(0, HH / 2, hz, 2.4, 2.6, HH, 'hull', { seg: 20, mat: { repeat: 2, metalness: 0.7, color: 0xb8bcc4 }, tag: 'reactor' });
    for (let i = 0; i < 4; i++) {
      world.shape(new THREE.TorusGeometry(2.7, 0.14, 6, 28), 'plaster', { pos: [0, 1.5 + i * 1.6, hz], rot: [Math.PI / 2, 0, 0], collide: false, mat: { color: 0x6ae0ff, emissive: 0x3ac8ff, emissiveIntensity: 2 } });
    }
    world.light(0x6ae0ff, 9, 0, 4, hz, 26);
    for (const [cx, cz] of [[-12, hz + 8], [12, hz + 8], [-12, hz - 8], [12, hz - 8]]) {
      world.box(cx, 0.6, cz, 3, 1.2, 1.4, 'hull', { uv: 0.6, mat: { color: 0x4a4e56, repeat: 1, metalness: 0.6 } });
      screen(world, cx, 2.6, cz, 2.6, 1.2, cx < 0 ? Math.PI / 2 : -Math.PI / 2, 0x3ac8ff);
    }
    for (const [vx, vz] of [[-17.6, hz - 12], [17.6, hz - 12], [-17.6, hz + 12], [17.6, hz + 12]]) {
      world.box(vx, 1.2, vz, 0.1, 1.6, 2.2, 'grate', { uv: 1, collide: false, mat: { color: 0x2a2a2e } });   // vents they crawl out of
    }
    for (let z = hz + 14; z > hz - 16; z -= 9) for (const s of [-1, 1]) lightStrip(world, s * 10, HH - 0.1, z, 4, false, 0xdff0ff, 4);
    crates(world, -8, hz + 13, rng, 3);
    crates(world, 9, hz - 13, rng, 3);

    // the greenhouse lock beyond the hub
    roomWalls(world, 0, hz - 24.2, 10, 12, H, 'panel', { doors: { south: [0, 4, 3.4], north: [0, 4, 3.4] }, mat: { uv: 0.4, mat: { color: 0xd8d8dc } } });
    world.box(0, H + 0.2, hz - 24.2, 10.4, 0.4, 12.4, 'panel', { uv: 0.3 });
    world.box(0, 1.7, hz - 30.4, 4, 3.4, 0.3, 'rust', { uv: 0.8, mat: { color: 0x3a6a4a, metalness: 0.5 } });   // the green door, sealed
    world.sign('GREENHOUSE 9', 0, 3.7, hz - 30.2, 0, 4, '#7aff9a');
    world.light(0x7aff9a, 5, 0, 3, hz - 26, 12);

    world.playerStart.set(0, 0, 18);
    world.playerFacing = 0;

    return {
      stages: [
        {
          text: 'Restore life support — three relays', kind: 'interact', count: 3,
          spawns: [
            ...horde(rng, 8, ['colonist', 'colonist', 'sprinter'], -2.5, 2.5, 0, -150),
            sp('suit', -11, -46), sp('colonist', 11, -22), sp('sprinter', 11, -70), sp('suit', -11, -96),
            sp('colonist', 11, -118), sp('colonist', -11, -140), sp('sprinter', -11, 4), sp('suit', 0, -110)
          ]
        },
        {
          text: 'Get to the central hub', kind: 'reach', zone: zone(0, -178, 14, 8, 0, 6),
          onEnterText: 'Air is moving again. So are they.',
          spawns: [...horde(rng, 6, ['colonist', 'sprinter', 'suit'], -2.5, 2.5, -150, -168), sp('suit', -10, hz + 6), sp('colonist', 10, hz - 6)]
        },
        {
          text: 'Hold the hub until the lock cycles', kind: 'defend', duration: 50,
          ...waves(d, { waveKinds: ['colonist', 'colonist', 'sprinter', 'suit'] }),
          wavePoints: [[0, 0, -150], [-11, 0, -140], [11, 0, -118], [0, 0, hz - 25], [0, 0, -132]],
          onEnterText: 'LOCK CYCLING — VENTS OPEN'
        },
        {
          text: 'Reach the greenhouse lock', kind: 'reach', zone: zone(0, hz - 25, 8, 6, 0, 5),
          spawns: [sp('suit', -6, hz - 10), sp('suit', 6, hz - 10), sp('sprinter', 0, hz - 24)]
        }
      ],
      pickups: [
        ['ammo', 2, 0, 6], ['health', -11, 0, 4], ['ammo', 11, 0, -26], ['armour', -11, 0, -50],
        ['ammo', 0, 0, -80], ['health', 11, 0, -66], ['ammo', -11, 0, -100], ['ammo', 11, 0, -114],
        ['health', -11, 0, -136], ['armour', -6, 0, hz + 14], ['ammo', 6, 0, hz - 14], ['health', 14, 0, hz]
      ]
    };
  }
};

/* ================================================================= 9 */
export const MARS_3 = {
  id: 9, world: 'mars',
  name: 'Greenhouse Nine',
  subtitle: 'Hydroponics bay, under glass',
  brief: 'The food bay is overgrown and the vents are crawling. Restart the pumps, then hold the service lift down to the mine.',
  diff: marsDiff(3),
  theme: { ...DUSK, sun: { colour: 0xffc8b0, intensity: 0.9, pos: [40, 44, -40] }, fog: 0x5a3a3a, fogDensity: 0.014, hemi: [0xb8907a, 0x2a2014, 0.65], music: 42,
    particles: { count: 500, colour: 0xc8e0a0, embers: 0, size: 0.04 } },
  build(world, rng) {
    const d = spaceDiff(3);
    ground(world, 360, 'sand', { uv: 0.22, bumpy: 0.3, mat: { color: 0xd89a7a } });
    const W = 60, z0 = 42, z1 = -132, H = 9, zc = (z0 + z1) / 2, L = z0 - z1;
    world.box(0, 0.03, zc, W, 0.06, L, 'tile', { uv: 0.4, collide: false, mat: { color: 0xb8c0b0 } });
    roomWalls(world, 0, zc, W, L, H, 'panel', { doors: { south: [0, 4, 3.4], north: [0, 6, 4.4] }, mat: { uv: 0.3, mat: { color: 0xd8dcd8 } } });
    // the glass roof: a lattice of beams with panes between
    for (let z = z0; z >= z1; z -= 8) world.box(0, H + 1.6, z, W, 0.3, 0.3, 'rust', { uv: 1, collide: false, mat: { color: 0xc8ccd2, metalness: 0.6 } });
    for (let x = -W / 2; x <= W / 2; x += 10) world.box(x, H + 1.6, zc, 0.3, 0.3, L, 'rust', { uv: 1, collide: false, mat: { color: 0xc8ccd2, metalness: 0.6 } });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, L).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x9adcc8, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    glass.position.set(0, H + 1.7, zc);
    world.add(glass);
    for (let x = -W / 2; x <= W / 2; x += 10) world.box(x, H / 2 + 1, zc, 0.5, H + 2, 0.5, 'rust', { uv: 1, collide: false, mat: { color: 0xc8ccd2 } });
    for (const s of [-1, 1]) world.box(s * W / 2, H + 0.9, zc, 0.4, 1.8, L, 'panel', { uv: 0.4, collide: false });

    // planting rows, with cross aisles
    const cross = [16, -22, -62, -100];
    for (const x of [-24, -17, -10, 10, 17, 24]) {
      let top = z0 - 6;
      for (const cz of [...cross, z1 + 8]) {
        const len = top - (cz + 4);
        const byTanks = Math.abs(x) > 12 && cz === -62;      // leave room round the pumps
        if (len > 3 && !byTanks) planter(world, x, top - len / 2, len, false, rng, Math.abs(x) === 17);
        top = cz - 4;
      }
    }
    // irrigation hub in the middle: a ring of tanks round a fountain-like pool
    const hz = -42;
    world.cylinder(0, 0.4, hz, 4.4, 4.6, 0.8, 'hull', { seg: 28, mat: { repeat: 2, color: 0xc8ccd2 } });
    world.shape(new THREE.CircleGeometry(4.1, 28).rotateX(-Math.PI / 2), 'asphalt', { pos: [0, 0.81, hz], collide: false, shadow: false, mat: { color: 0x1a3a3a, roughness: 0.05, metalness: 0.3 } });
    world.light(0x7affc8, 5, 0, 2, hz, 16);
    for (const s of [-1, 1]) {
      world.cylinder(s * 22, 3.2, hz - 8, 3, 3, 6.4, 'hull', { seg: 20, mat: { repeat: 2, color: 0xb8c8d0, metalness: 0.6 }, tag: 'tank' });
      world.shape(new THREE.SphereGeometry(3, 20, 8, 0, TAU, 0, Math.PI / 2), 'hull', { pos: [s * 22, 6.4, hz - 8], mat: { repeat: 2, color: 0xb8c8d0, metalness: 0.6 } });
      pipes(world, s * 19, 1.2, hz - 8, s * 4.5, hz, rng, 0x4a8a6a, 2);
      terminal(world, s * 18.6, 0, hz - 3.4, s < 0 ? 0.6 : -0.6, s < 0 ? 'PUMP A' : 'PUMP B');
    }
    // the service lift at the north end
    const lz = z1 - 7.2;
    roomWalls(world, 0, lz, 14, 14, 6, 'rust', { doors: { south: [0, 6, 4.4] }, mat: { uv: 0.4, mat: { metalness: 0.5, color: 0x8a8e96 } } });
    world.box(0, 6.2, lz, 14.4, 0.4, 14.4, 'rust', { uv: 0.4 });
    world.box(0, 0.12, lz - 1, 8, 0.24, 8, 'grate', { uv: 0.6, tag: 'lift', mat: { color: 0xd8a830 } });
    world.sign('SERVICE LIFT — THARSIS DEEP', 0, 5, z1 - 0.9, 0, 7, '#ffb040');
    world.light(0xffb040, 5, 0, 4.5, lz, 14);

    // the south airlock you come in by
    roomWalls(world, 0, z0 + 6.2, 10, 12, 4.2, 'panel', { doors: { north: [0, 4, 3.4] }, mat: { uv: 0.4, mat: { color: 0xb8bcc4 } } });
    world.box(0, 0.02, z0 + 6.2, 10, 0.04, 12, 'grate', { uv: 0.6, collide: false, mat: { color: 0x9aa0a8 } });
    world.box(0, 4.4, z0 + 6.2, 10.4, 0.4, 12.4, 'panel', { uv: 0.3 });
    lightStrip(world, 0, 4.1, z0 + 6.2, 4, false, 0xdff0ff, 4);

    // grow lamps along the aisles and spilt soil
    for (let z = z0 - 10; z > z1; z -= 14) lightStrip(world, 0, H - 0.2, z, 4, true, 0xe090ff, 5);
    for (let i = 0; i < 10; i++) world.box(rng.range(-26, 26), 0.05, rng.range(z1 + 6, z0 - 6), rng.range(1, 2.5), 0.1, rng.range(1, 2.5), 'dirt', { uv: 1, collide: false, rotY: rng() * TAU });
    for (let i = 0; i < 8; i++) bloodPool(world, rng.range(-6, 6), rng.range(z1 + 10, z0 - 10), rng.range(1, 2.6), i + 300);
    for (const [vx, vz] of [[-29.6, 0], [29.6, -30], [-29.6, -80], [29.6, -110]]) world.box(vx, 0.8, vz, 0.1, 1.2, 2, 'grate', { uv: 1, collide: false, mat: { color: 0x1a1a1e } });

    // outside: dunes, domes beyond the glass
    dome(world, -70, -20, 14, rng, {});
    dome(world, 72, -70, 16, rng, {});
    scatterRocks(world, rng, 30, -150, 150, 120, -200, 40);
    mesas(world, 220, 18, rng);

    world.playerStart.set(0, 0, z0 + 4);
    world.playerFacing = 0;

    return {
      stages: [
        {
          text: 'Walk the centre aisle to the irrigation hub', kind: 'reach', zone: zone(0, hz + 7, 12, 4, 0, 6),
          spawns: [...horde(rng, 12, ['colonist', 'colonist', 'sprinter', 'suit'], -3, 3, 24, -30), sp('colonist', -14, 16), sp('colonist', 14, 16)]
        },
        {
          text: 'Purge the bay', kind: 'kill', count: 22,
          onEnterText: 'Something is moving in the vents.',
          spawns: [
            ...horde(rng, 8, ['crawler'], -27, 27, -60, -110), ...horde(rng, 10, ['colonist', 'sprinter', 'suit'], -6, 6, -50, -120),
            sp('crawler', -28, 0), sp('crawler', 28, -30), sp('suit', -14, -62), sp('suit', 14, -62), sp('colonist', 0, -22), sp('sprinter', 0, -100)
          ]
        },
        {
          text: 'Restart pumps A and B', kind: 'interact', count: 2,
          spawns: [...horde(rng, 10, ['crawler', 'colonist', 'sprinter'], -27, 27, -20, -70)]
        },
        {
          text: 'Hold out while the service lift comes up', kind: 'defend', duration: 45,
          ...waves(d, { waveKinds: ['colonist', 'crawler', 'sprinter', 'suit'] }),
          wavePoints: [[-27, 0, 0], [27, 0, -30], [-27, 0, -80], [27, 0, -110], [0, 0, 30]],
          onEnterText: 'LIFT CALLED — 45 SECONDS'
        },
        {
          text: 'Take the service lift down to the mine', kind: 'reach', zone: zone(0, lz - 1, 6, 6, 0, 5),
          spawns: [sp('suit', -6, z1 + 12), sp('suit', 6, z1 + 12), sp('crawler', 0, z1 + 20)]
        }
      ],
      pickups: [
        ['ammo', 0, 0, 30], ['health', -6, 0, 16], ['ammo', 6, 0, -6], ['armour', 0, 0, -22],
        ['ammo', -14, 0, -42], ['health', 14, 0, -50], ['ammo', 0, 0, -62], ['ammo', -8, 0, -100],
        ['health', 8, 0, -100], ['ammo', 0, 0, -120], ['armour', -20, 0, 16], ['health', 20, 0, -22]
      ]
    };
  }
};

/* ================================================================ 10 */
export const MARS_4 = {
  id: 10, world: 'mars',
  name: 'Tharsis Deep',
  subtitle: 'Open-cut mine, canyon floor',
  brief: 'The miners never stopped working. Down the haul road, clear the quarry, restart the hoist and get into the shaft.',
  diff: marsDiff(4),
  theme: { ...DUSK, skyHorizon: 0xa85a40, skyGlow: 0xffa070, glowDir: [0.4, 0.2, -1], fog: 0x7a3a2a, fogDensity: 0.013,
    sun: { colour: 0xffc0a0, intensity: 1.05, pos: [30, 50, -30] }, music: 44 },
  build(world, rng) {
    const d = spaceDiff(4);
    ground(world, 420, 'sand', { uv: 0.2, bumpy: 0.6, seg: 70, mat: { color: 0xc88a6a } });
    // canyon: narrow haul road opening into the quarry pit
    const C = (a, b, c, e, h, out) => cliff(world, a, b, c, e, h, rng, 'redrock', { out });
    C(-21, 124, -21, -60, 20, [-1, 0]);
    C(21, 124, 21, -60, 20, [1, 0]);
    C(-21, -62, -54, -62, 18, [0, 1]);
    C(21, -62, 54, -62, 18, [0, 1]);
    C(-54, -62, -54, -190, 22, [-1, 0]);
    C(54, -62, 54, -190, 22, [1, 0]);
    C(-54, -190, -6, -190, 22, [0, -1]);
    C(6, -190, 54, -190, 22, [0, -1]);
    C(-21, 126, 21, 126, 16, [0, 1]);

    // the haul road: graded dirt, rails, conveyors
    world.box(0, 0.03, 30, 14, 0.06, 180, 'sand', { uv: 0.3, collide: false, mat: { color: 0xa86a50 } });
    for (const s of [-0.75, 0.75]) world.box(-9 + s, 0.08, 20, 0.12, 0.14, 180, 'rust', { uv: 1, collide: false, mat: { color: 0x5a5a5e, metalness: 0.8 } });
    for (let z = 110; z > -60; z -= 1.6) world.box(-9, 0.04, z, 2.2, 0.08, 0.3, 'wood', { uv: 1, collide: false, mat: { color: 0x4a3a2a } });
    world.box(15, 2.6, 30, 1.6, 0.4, 170, 'rust', { uv: 0.6, collide: false, mat: { color: 0x3a3a3e, metalness: 0.5 } });   // conveyor
    for (let z = 112; z > -55; z -= 6) world.box(15, 1.2, z, 1.8, 2.4, 0.3, 'rust', { uv: 1, collide: false, mat: { color: 0xd8a830, metalness: 0.5 } });
    world.collider(15, 1.4, 30, 2, 2.8, 170, 0, 'conveyor');
    for (let z = 100; z > -40; z -= 26) oreCart(world, -9, z + rng.range(-5, 5), 0, rng);
    for (let i = 0; i < 6; i++) world.light(0xffb040, 6, rng.sign() * 17, 6, 100 - i * 28, 18);
    rover(world, 5, 80, 0.2, rng, 0xd8a830);
    rover(world, -4, 20, 2.9, rng, 0xd8a830);
    container(world, 6, 50, 0.1, 0xd8a830, rng);
    container(world, -14, -20, Math.PI / 2, 0x3a6a8a, rng);

    // the quarry: rigs, ore piles, site huts
    drillRig(world, -32, -100, 18, rng);
    drillRig(world, 34, -150, 20, rng);
    drillRig(world, 30, -90, 15, rng, 0xc85a1a);
    for (let i = 0; i < 9; i++) {
      const x = rng.range(-46, 46), z = rng.range(-70, -180);
      if (Math.abs(x) < 6) continue;
      rock(world, x, z, rng.range(2, 4), rng, 'redrock', { tall: 0.6 });
      scree(world, x, z, 8, 4, rng);
    }
    module(world, -38, -150, 10, 2, Math.PI / 2, rng, { label: 'SITE OFFICE', labelColour: '#ffb040' });
    module(world, 0, -128, 8, 1.8, 0, rng, { label: 'HOIST CTRL', labelColour: '#ffb040' });
    container(world, 18, -118, 0.4, 0x8a3a3a, rng, 2);
    container(world, -20, -76, -0.3, 0xd8a830, rng);
    terminal(world, -27, 0, -96, -Math.PI / 2, 'HOIST MOTOR 1');
    terminal(world, 0, 0, -124.6, 0, 'HOIST MOTOR 2');
    terminal(world, 29, 0, -146, Math.PI / 2, 'HOIST MOTOR 3');
    for (let i = 0; i < 8; i++) barrel(world, rng.range(-40, 40), rng.range(-70, -170), rng);
    for (let i = 0; i < 8; i++) bloodPool(world, rng.range(-30, 30), rng.range(-70, -170), rng.range(1, 3), i + 400);

    // the shaft head: a headframe over a door cut into the cliff
    const sz = -184;
    world.box(0, 4, sz - 2, 12, 8, 4, 'redrock', { uv: 0.3 });
    world.box(0, 0.1, sz + 2, 8, 0.2, 6, 'grate', { uv: 0.6, mat: { color: 0xd8a830 } });
    for (const s of [-1, 1]) world.box(s * 4.5, 9, sz + 1, 0.5, 18, 0.5, 'rust', { uv: 1, collide: false, mat: { color: 0xd8a830, metalness: 0.5 } });
    world.box(0, 18, sz + 1, 10, 0.6, 0.6, 'rust', { uv: 1, collide: false, mat: { color: 0xd8a830, metalness: 0.5 } });
    world.shape(new THREE.TorusGeometry(1.6, 0.25, 8, 20), 'rust', { pos: [0, 16.6, sz + 1], collide: false, mat: { color: 0x3a3a3e, metalness: 0.7 } });
    world.box(0, 2.2, sz - 0.05, 5, 4.4, 0.2, 'rust', { uv: 1, collide: false, mat: { color: 0x101014 } });
    world.sign('SHAFT 2 — 800 M', 0, 5.2, sz + 0.2, 0, 6, '#ffb040');
    world.light(0xffb040, 8, 0, 6, sz + 6, 22);

    mesas(world, 230, 16, rng);
    const phobos = skyBody(world, 'phobos', [-0.3, 0.55, -1], 600, 22);

    world.playerStart.set(0, 0, 116);
    world.playerFacing = 0;

    return {
      follow: [phobos],
      stages: [
        {
          text: 'Down the haul road to the quarry', kind: 'reach', zone: zone(0, -66, 30, 8, 0, 8),
          onEnterText: 'Hard hats. Green eyes. Still on shift.',
          spawns: [...horde(rng, 14, ['colonist', 'colonist', 'suit', 'sprinter', 'crawler'], -12, 12, 100, -50), sp('spitter', -6, 10), sp('spitter', 8, -30)]
        },
        {
          text: 'Clear the quarry floor', kind: 'kill', count: 26,
          spawns: [...horde(rng, 22, ['colonist', 'suit', 'sprinter', 'crawler', 'spitter'], -46, 46, -72, -176), sp('hulk', 0, -150), sp('spitter', -40, -120), sp('spitter', 40, -120), sp('crawler', 0, -80)]
        },
        {
          text: 'Restart the three hoist motors', kind: 'interact', count: 3,
          spawns: [...horde(rng, 12, ['colonist', 'suit', 'crawler', 'spitter'], -46, 46, -80, -176)]
        },
        {
          text: 'Hold the quarry while the hoist cage climbs', kind: 'defend', duration: 50,
          ...waves(d, { waveKinds: ['colonist', 'suit', 'crawler', 'spitter', 'sprinter', 'hulk'] }),
          wavePoints: [[-46, 0, -80], [46, 0, -80], [-46, 0, -176], [46, 0, -176], [0, 0, -40]],
          onEnterText: 'CAGE ASCENDING — 50 SECONDS'
        },
        {
          text: 'Into the shaft', kind: 'reach', zone: zone(0, sz + 2.5, 6, 4, 0, 5),
          spawns: [sp('hulk', -8, -168), sp('suit', 8, -170), sp('spitter', 0, -176)]
        }
      ],
      pickups: [
        ['ammo', 3, 0, 96], ['health', -4, 0, 60], ['ammo', 4, 0, 20], ['armour', -6, 0, -20],
        ['ammo', 0, 0, -56], ['health', -24, 0, -110], ['ammo', 24, 0, -100], ['ammo', 0, 0, -140],
        ['health', 20, 0, -164], ['armour', -30, 0, -170], ['ammo', -10, 0, -176]
      ]
    };
  }
};

/* ================================================================ 11 */
export const MARS_5 = {
  id: 11, world: 'mars',
  name: 'Olympus Command',
  subtitle: 'Colony command centre',
  brief: 'The launch override is in Command. Cross the founders\' plaza, upload the codes from three consoles and hold the deck until they go through.',
  diff: marsDiff(5),
  theme: { ...DUSK, skyTop: 0x1a1020, skyHorizon: 0x9a5040, skyGlow: 0x6a8ac0, stars: 0.6, fog: 0x6a3a30, fogDensity: 0.012,
    sun: { colour: 0xffc8a8, intensity: 0.85, pos: [-40, 30, -70] }, music: 45 },
  build(world, rng) {
    const d = spaceDiff(5);
    ground(world, 420, 'sand', { uv: 0.22, bumpy: 0.4, seg: 60, mat: { color: 0xd8987a } });
    // founders' plaza: paving, a statue, flags, domes round the edge
    world.box(0, 0.04, 56, 64, 0.08, 100, 'concrete', { uv: 0.3, collide: false, mat: { color: 0xc8a890 } });
    world.box(0, 0.6, 50, 4, 1.2, 4, 'marble', { uv: 0.6 });
    world.shape(new THREE.CylinderGeometry(0.4, 0.5, 2.4, 10), 'hull', { pos: [0, 2.4, 50], collide: false, mat: { repeat: 1, color: 0xc8ccd2, metalness: 0.6 } });
    world.shape(new THREE.SphereGeometry(0.42, 12, 10), 'hull', { pos: [0, 3.9, 50], collide: false, mat: { repeat: 1, color: 0xc8ccd2, metalness: 0.6 } });
    world.sign('FIRST TO MARS', 0, 0.8, 52.05, 0, 3, '#ffd8a0');
    for (let i = 0; i < 6; i++) {
      const fx = (i % 2 ? -1 : 1) * 14, fz = 96 - (i >> 1) * 28;
      world.shape(new THREE.CylinderGeometry(0.08, 0.1, 9, 6), 'rust', { pos: [fx, 4.5, fz], collide: true, tag: 'flag', mat: { color: 0xc8ccd2, metalness: 0.6 } });
      world.box(fx + (fx < 0 ? 1.2 : -1.2), 7.6, fz, 2.4, 1.4, 0.04, 'plaster', { uv: 1, collide: false, mat: { color: rng.pick([0xc8302a, 0x2a5ac8, 0xe8e0d0]) } });
    }
    dome(world, -44, 70, 13, rng, { door: Math.PI / 2 });
    dome(world, 46, 84, 15, rng, { door: -Math.PI / 2 });
    dome(world, -48, 20, 11, rng, { door: Math.PI / 2 });
    dome(world, 50, 30, 12, rng, { door: -Math.PI / 2 });
    module(world, -24, 92, 12, 2.2, 0.2, rng, { label: 'ADMIN' });
    module(world, 26, 56, 10, 2, -0.3, rng, { label: 'MESS' });
    rover(world, 10, 76, 0.4, rng);
    rover(world, -14, 34, 2.4, rng, 0xc85a3a);
    for (let i = 0; i < 5; i++) barrel(world, rng.range(-24, 24), rng.range(14, 100), rng);
    for (let i = 0; i < 8; i++) bloodPool(world, rng.range(-20, 20), rng.range(10, 100), rng.range(1, 3), i + 500);
    for (const [cx, cz] of [[-8, 70], [10, 40], [-12, 14]]) crates(world, cx, cz, rng, 3);

    // Command: a big two-tier hall
    const cz = -48, W = 60, D = 76, H = 11;
    roomWalls(world, 0, cz, W, D, H, 'panel', { doors: { south: [0, 8, 5], north: [0, 6, 4.4] }, mat: { uv: 0.3, mat: { color: 0xd0d0d6 } } });
    world.box(0, H + 0.3, cz, W + 1, 0.6, D + 1, 'panel', { uv: 0.25, mat: { color: 0x8a8e96 } });
    world.box(0, 0.02, cz, W, 0.04, D, 'grate', { uv: 0.4, collide: false, mat: { color: 0x7a7e86 } });
    // the facade: a huge window band and the colony crest
    world.box(0, H + 2.5, cz + D / 2, 24, 4, 1, 'panel', { uv: 0.4, collide: false, mat: { color: 0xb8b4ac } });
    world.sign('OLYMPUS COMMAND', 0, H + 2.5, cz + D / 2 + 0.55, 0, 18, '#ffb040');
    for (let i = 0; i < 9; i++) world.quad(-24 + i * 6, 7, cz + D / 2 + 0.22, 4.4, 3, 0, 'cmd-windows',
      () => new THREE.MeshStandardMaterial({ color: 0x0a0e14, emissive: 0x3a7ac8, emissiveIntensity: 0.9 }));
    // the raised command deck at the back
    const deckZ = cz - 20;
    world.box(0, 0.75, deckZ - 6, W - 2, 1.5, 30, 'grate', { uv: 0.4, mat: { color: 0x8a8e96 } });
    for (let i = 0; i < 3; i++) world.box(0, 0.25 + i * 0.5, deckZ + 9 + (2 - i) * 1.0 + 0.5, W - 2, 0.5, 1, 'grate', { uv: 0.8, mat: { color: 0x9aa0a8 } });
    screen(world, 0, 6.5, cz - D / 2 + 0.4, 26, 7, 0, 0x3ac8ff);
    screen(world, -22, 5.5, cz - D / 2 + 0.4, 10, 5, 0, 0xff5a3a);
    screen(world, 22, 5.5, cz - D / 2 + 0.4, 10, 5, 0, 0x7aff9a);
    for (let i = -2; i <= 2; i++) {
      world.box(i * 9, 2, deckZ - 2, 6, 1, 1.6, 'hull', { uv: 0.6, mat: { color: 0x3a3e46, repeat: 1, metalness: 0.6 } });
      world.quad(i * 9, 2.6, deckZ - 1.2, 5.4, 0.7, 0, 'screen-console', () => new THREE.MeshBasicMaterial({ color: 0x3ac8ff }));
    }
    terminal(world, -18, 1.5, deckZ - 8, 0, 'UPLINK 1');
    terminal(world, 0, 1.5, deckZ - 14, 0, 'UPLINK 2');
    terminal(world, 18, 1.5, deckZ - 8, 0, 'UPLINK 3');
    // the main floor: desks in rows, pillars
    for (let r = 0; r < 3; r++) for (let c = -2; c <= 2; c++) {
      if (c === 0) continue;
      world.box(c * 9, 0.5, cz + 22 - r * 9, 5, 1, 1.4, 'hull', { uv: 0.6, mat: { color: 0x6a6e76, repeat: 1 } });
    }
    for (const x of [-20, 20]) for (const z of [cz + 26, cz + 6]) world.cylinder(x, H / 2, z, 0.8, 0.9, H, 'panel', { seg: 12, mat: { color: 0xd8d8dc } });
    for (let z = cz + D / 2 - 8; z > cz - D / 2; z -= 12) for (const s of [-1, 1]) lightStrip(world, s * 14, H - 0.1, z, 5, false, 0xdff0ff, 4.5);
    for (let i = 0; i < 6; i++) bloodPool(world, rng.range(-24, 24), rng.range(cz - 30, cz + 30), rng.range(1, 2.6), i + 520);

    // out the back: the tram platform to the launch site
    const tz = cz - D / 2 - 14;
    world.box(0, 0.5, tz, 30, 1, 10, 'concrete', { uv: 0.4, mat: { color: 0xa89888 } });
    for (let i = 0; i < 3; i++) world.box(0, 0.17 + i * 0.33, tz + 5.4 + (2 - i) * 0.6, 8, 0.34, 0.6, 'concrete', { uv: 0.8 });
    world.box(0, 1.8, tz - 7, 40, 1.6, 4, 'hull', { uv: 0.5, mat: { color: 0xc8ccd2, repeat: 1 } });   // the tram
    world.sign('LAUNCH TRAM ▸', 0, 4, tz + 4.5, 0, 6, '#6ae0ff');
    world.light(0x6ae0ff, 6, 0, 4, tz, 18);

    scatterRocks(world, rng, 40, -140, 140, 140, -160, 34);
    mesas(world, 240, 20, rng);

    world.playerStart.set(0, 0, 104);
    world.playerFacing = 0;

    return {
      stages: [
        {
          text: 'Cross the founders\' plaza to Command', kind: 'reach', zone: zone(0, cz + D / 2 + 4, 14, 6, 0, 8),
          spawns: [...horde(rng, 16, ['colonist', 'colonist', 'suit', 'sprinter', 'spitter', 'crawler'], -26, 26, 90, 4), sp('hulk', -10, 6), sp('hulk', 10, 2)]
        },
        {
          text: 'Upload the launch override from three consoles', kind: 'interact', count: 3,
          onEnterText: 'The command crew are still at their stations.',
          spawns: [...horde(rng, 16, ['colonist', 'suit', 'sprinter', 'spitter', 'crawler'], -26, 26, cz + 30, cz - 30), sp('suit', -18, deckZ - 8, 1.5), sp('suit', 18, deckZ - 8, 1.5)]
        },
        {
          text: 'Hold the command deck while the codes upload', kind: 'defend', duration: 60,
          ...waves(d, { waveKinds: ['colonist', 'suit', 'sprinter', 'spitter', 'crawler', 'hulk'] }),
          wavePoints: [[0, 0, cz + D / 2 + 6], [-26, 0, cz + 30], [26, 0, cz + 30], [-26, 0, cz - 4], [26, 0, cz - 4]],
          onEnterText: 'UPLOADING — 60 SECONDS'
        },
        {
          text: 'Out to the launch tram', kind: 'reach', zone: zone(0, tz, 12, 6, 0, 6),
          spawns: [sp('hulk', 0, tz + 4), sp('spitter', -12, tz), sp('spitter', 12, tz), sp('crawler', -6, cz - 30), sp('crawler', 6, cz - 30)]
        }
      ],
      pickups: [
        ['ammo', 4, 0, 90], ['health', -6, 0, 62], ['ammo', 6, 0, 34], ['armour', 0, 0, 10],
        ['ammo', -14, 0, cz + 20], ['health', 14, 0, cz + 10], ['ammo', 0, 1.5, deckZ - 4], ['armour', -24, 0, cz - 2],
        ['health', 24, 1.5, deckZ - 14], ['ammo', 0, 1, tz]
      ]
    };
  }
};

/* ================================================================ 12 */
export const MARS_6 = {
  id: 12, world: 'mars', flight: 'moon',
  name: 'Ascent Pad',
  subtitle: 'Tharsis launch complex',
  brief: 'One ship left on the pad and the Overseer between you and it. Kill it, hold while she fuels, and get aboard for the Moon.',
  diff: marsDiff(6),
  theme: { ...DUSK, skyTop: 0x120c18, skyHorizon: 0x7a3a34, skyGlow: 0x5a7ab0, stars: 0.8, glowDir: [0.3, 0.1, -1], fog: 0x5a2a24, fogDensity: 0.011,
    hemi: [0xc0806a, 0x3a1a12, 0.65], sun: { colour: 0xd8b8b8, intensity: 0.75, pos: [50, 30, -60] }, music: 46 },
  build(world, rng) {
    const d = spaceDiff(6);
    ground(world, 520, 'sand', { uv: 0.2, bumpy: 0.4, seg: 70, mat: { color: 0xc8907a } });
    world.box(0, 0.03, -20, 20, 0.06, 260, 'concrete', { uv: 0.3, collide: false, mat: { color: 0xa89080 } });
    for (let z = 110; z > -130; z -= 10) {
      world.box(0, 0.07, z, 0.8, 0.04, 5, 'concrete', { uv: 1, collide: false, mat: { color: 0xffe08a } });
      for (const s of [-1, 1]) world.box(s * 10, 0.15, z, 0.3, 0.3, 0.3, 'plaster', { uv: 1, collide: false, mat: { color: 0x4ac8ff, emissive: 0x2a8acc, emissiveIntensity: 2 } });
    }
    // fuel farm: spheres and tanks
    for (const [x, z, r] of [[-34, 40, 6], [-34, 20, 6], [-48, 30, 7], [36, -10, 6], [48, 2, 5]]) {
      world.cylinder(x, 1.2, z, r * 0.6, r * 0.7, 2.4, 'rust', { seg: 14, mat: { color: 0x6a6e76 } });
      world.shape(new THREE.SphereGeometry(r, 20, 14), 'hull', { pos: [x, r + 1.6, z], collide: true, tag: 'tank', mat: { repeat: 2, color: 0xe8e4dc, metalness: 0.5 } });
    }
    pipes(world, -28, 0.5, 30, -8, 30, rng, 0xc8a030, 3);
    pipes(world, 30, 0.5, -4, 8, -4, rng, 0xc8a030, 3);
    for (let i = 0; i < 4; i++) container(world, rng.sign() * rng.range(16, 26), 90 - i * 22, rng.range(-0.3, 0.3), rng.pick([0x3a6a8a, 0xa84a2a, 0xc8a030]), rng, rng.int(1, 2));
    for (let i = 0; i < 4; i++) rover(world, rng.range(-14, 14), rng.range(-40, 80), rng() * TAU, rng);
    for (let i = 0; i < 10; i++) barrel(world, rng.range(-24, 24), rng.range(-100, 100), rng);
    for (let i = 0; i < 6; i++) fireSource(world, rng.range(-24, 24), 0.3, rng.range(-100, 90), rng.range(0.8, 1.6));
    for (let i = 0; i < 10; i++) bloodPool(world, rng.range(-20, 20), rng.range(-120, 90), rng.range(1, 3), i + 600);
    mast(world, 40, 60, 20, rng);
    mast(world, -40, -60, 18, rng);
    module(world, 30, 80, 14, 2.4, Math.PI / 2, rng, { label: 'LAUNCH CTRL', labelColour: '#ffb040' });
    module(world, -30, -30, 12, 2.2, Math.PI / 2, rng, { label: 'CREW PREP' });

    // the arena the Overseer holds: blast walls in a broken ring
    const az = -58;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + 0.3;
      if (i === 2 || i === 7) continue;   // the gaps the road runs through
      const tangentX = Math.abs(Math.sin(a)) > 0.7;      // keep walls axis-aligned so collision matches
      world.box(Math.cos(a) * 30, 1.6, az + Math.sin(a) * 30, tangentX ? 8 : 1.2, 3.2, tangentX ? 1.2 : 8, 'concrete', { uv: 0.6, mat: { color: 0xa89888 } });
    }

    // the pad and the ship
    const padZ = -160;
    world.cylinder(0, 0.25, padZ, 24, 25, 0.5, 'concrete', { seg: 44, mat: { color: 0x9a8a80 }, tag: 'pad' });
    world.shape(new THREE.TorusGeometry(19, 0.25, 6, 48), 'plaster', { pos: [0, 0.52, padZ], rot: [Math.PI / 2, 0, 0], collide: false, mat: { color: 0xffd24a, emissive: 0x6a4a00 } });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      world.cylinder(Math.cos(a) * 21, 5, padZ + Math.sin(a) * 21, 0.4, 0.5, 10, 'rust', { seg: 8 });
      world.light(0x4ac8ff, 5, Math.cos(a) * 21, 10, padZ + Math.sin(a) * 21, 18);
    }
    for (const [gx, gz] of [[-8, padZ - 2], [-8, padZ + 2], [-12, padZ - 2], [-12, padZ + 2]]) {
      world.box(gx, 14, gz, 0.4, 28, 0.4, 'rust', { uv: 1, mat: { color: 0xa83a2a, metalness: 0.6 }, collide: false });
    }
    world.collider(-10, 14, padZ, 4.4, 28, 4.4, 0, 'gantry');
    for (let y = 3; y < 28; y += 4) world.box(-10, y, padZ, 4.4, 0.25, 4.4, 'rust', { uv: 1, collide: false, mat: { color: 0xa83a2a, metalness: 0.6 } });
    const ship = rocket(world, 0, padZ, 1, 0x2a6ac8);
    world.light(0x6ae0ff, 12, 0, 16, padZ + 5, 30);
    scorch(world, 0, padZ, 30);
    for (let i = 0; i < 4; i++) {
      const top = 0.9 + i * 0.4;
      world.box(0, top / 2, padZ + 17 - i * 3, 4, top, 3, 'rust', { uv: 0.7, tag: 'ramp', mat: { metalness: 0.6 } });
    }
    world.box(0, 2.9, padZ + 5.4, 3.4, 2.6, 0.3, 'rust', { uv: 0.8, mat: { metalness: 0.7 } });
    world.sign('BOARD — LUNA', 0, 5.2, padZ + 5.2, 0, 4, '#6ae0ff');

    scatterRocks(world, rng, 60, -160, 160, 140, -230, 30);
    cliff(world, -110, 140, -110, -230, 18, rng, 'redrock', { out: [-1, 0] });
    cliff(world, 110, 140, 110, -230, 18, rng, 'redrock', { out: [1, 0] });
    mesas(world, 270, 22, rng);
    const phobos = skyBody(world, 'phobos', [0.2, 0.42, -1], 600, 30);

    world.playerStart.set(0, 0, 108);
    world.playerFacing = 0;

    return {
      ship, follow: [phobos],
      stages: [
        {
          text: 'Fight through the fuel farm', kind: 'reach', zone: zone(0, -14, 30, 8, 0, 8),
          spawns: [...horde(rng, 18, ['colonist', 'suit', 'sprinter', 'spitter', 'crawler'], -24, 24, 96, -6), sp('hulk', -14, 30), sp('hulk', 14, 0)]
        },
        {
          text: 'Kill the Colony Overseer', kind: 'boss', boss: { kind: 'overseer', at: [0, 0, az - 6] },
          onEnterText: 'IT WAS IN CHARGE HERE. IT STILL IS.',
          waveEvery: d.waveEvery + 3, waveSize: 2, maxAlive: 10,
          waveKinds: ['colonist', 'sprinter', 'crawler', 'spitter'],
          wavePoints: [[-34, 0, az + 20], [34, 0, az + 20], [-34, 0, az - 30], [34, 0, az - 30]]
        },
        {
          text: 'Hold the pad while the ship fuels', kind: 'defend', duration: 55,
          ...waves(d, { waveKinds: ['colonist', 'suit', 'sprinter', 'spitter', 'crawler', 'hulk'] }),
          wavePoints: [[-36, 0, padZ + 30], [36, 0, padZ + 30], [-38, 0, padZ - 20], [38, 0, padZ - 20], [0, 0, padZ + 80]],
          onEnterText: 'FUELLING — HOLD THE PAD'
        },
        { text: 'Board the ship to the Moon', kind: 'reach', zone: zone(0, padZ + 7, 6, 6, 0, 8) }
      ],
      pickups: [
        ['ammo', 4, 0, 94], ['health', -6, 0, 66], ['ammo', 6, 0, 30], ['armour', 0, 0, 6],
        ['ammo', -12, 0, az + 14], ['health', 12, 0, az - 14], ['ammo', -16, 0, padZ + 40], ['health', 16, 0, padZ + 40],
        ['ammo', 0, 0, padZ + 60], ['armour', -18, 0, padZ + 20]
      ]
    };
  }
};

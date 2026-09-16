/* Demon Fall — stages 1 to 3: the suburb, the ruined downtown, the metro.
 *
 * A level builds its scenery into the World and hands back a script: an ordered
 * list of stages the game walks through (reach here, kill these, switch that),
 * plus the spawn plan for the horde. */
import * as THREE from 'three';
import { ground, building, roomWalls, car, barrel, lamp, rubble, fireSource } from './world.js';
import {
  tree, fence, powerLine, dumpster, trash, crates, sandbags, roadSign, billboard,
  hydrant, bench, trafficCones, crater, scorch, bloodPool, tent, skyline, hills
} from './props.js';
import { TAU } from './util.js';

export const zone = (x, z, w, d, y = 0, h = 6) =>
  new THREE.Box3(new THREE.Vector3(x - w / 2, y, z - d / 2), new THREE.Vector3(x + w / 2, y + h, z + d / 2));

/** Ammo / health / armour crate that the player walks over. */
export function pickup(world, kind, x, y, z) {
  const colours = { health: 0x37d06a, armour: 0x3aa7ff, ammo: 0xffc24a, shotgun: 0xff8a3c, plasma: 0x7ad9ff };
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.3, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.6, metalness: 0.4 })
  );
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.08, 0.32),
    new THREE.MeshBasicMaterial({ color: colours[kind] || 0xffffff })
  );
  glow.position.y = 0.12;
  g.add(body, glow);
  g.position.set(x, y + 0.25, z);
  world.scene.add(g);
  world.meshes.push(g);
  const p = { kind, obj: g, pos: g.position, taken: false, spin: Math.random() * TAU };
  world.pickups.push(p);
  return p;
}

/** Something the player switches on with E (breakers, vault controls). */
export function terminal(world, x, y, z, rotY, label = 'POWER') {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.55, metalness: 0.6 }));
  box.position.y = 1.1;
  box.castShadow = true;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.34),
    new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  screen.position.set(0, 1.25, 0.15);
  g.add(box, screen);
  const light = world.light(0xff3b30, 1.6, x + Math.sin(rotY) * 0.5, y + 1.3, z + Math.cos(rotY) * 0.5, 6);
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  world.scene.add(g);
  world.meshes.push(g);
  world.collider(x, y + 1.1, z, 0.8, 1.2, 0.5, rotY, 'terminal');
  const t = { kind: 'terminal', obj: g, pos: g.position, used: false, screen, light, label };
  world.props.push(t);
  return t;
}

/** A petrol station forecourt: canopy, pumps, a kiosk. */
function gasStation(world, x, z, rng) {
  for (const [px, pz] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) {
    world.box(x + px, 3, z + pz, 0.5, 6, 0.5, 'concrete', { uv: 1 });
  }
  world.box(x, 6.2, z, 16, 0.5, 11, 'rust', { uv: 0.4, collide: false, mat: { color: 0xb8b8b0 } });
  world.box(x, 6.55, z, 16.2, 0.4, 11.2, 'plaster', { uv: 0.4, collide: false, mat: { color: 0xc23a22 } });
  for (const px of [-3, 3]) {
    world.box(x + px, 0.12, z, 1.6, 0.24, 6, 'concrete', { uv: 1 });
    for (const pz of [-1.6, 1.6]) world.box(x + px, 0.95, z + pz, 0.6, 1.5, 0.45, 'rust', { uv: 1, mat: { color: 0xd8d4c8 } });
  }
  roomWalls(world, x, z - 14, 12, 8, 3.6, 'plaster', { doors: { south: [2, 2, 2.6] } });
  world.box(x, 3.7, z - 14, 12.6, 0.3, 8.6, 'concrete', { uv: 0.5 });
  world.sign('FUEL 24H', x, 7.4, z + 5.7, 0, 5, '#ffd24a');
  crates(world, x - 3, z - 14, rng, 3);
  fireSource(world, x + 3, 0.3, z + 1, 1.8);
  scorch(world, x + 3, z + 1, 8);
}

/* ------------------------------------------------------------------- 1 */
export const LEVEL_1 = {
  id: 1,
  name: 'Ash Street',
  subtitle: 'Suburb, 03:40',
  brief: 'Your street is gone. Cut through the neighbourhood to the chapel gate.',
  theme: {
    skyTop: 0x0b0d1c, skyHorizon: 0x2a1220, skyGround: 0x120a0c, skyGlow: 0x5a1010,
    glowDir: [0.35, 0.22, -1], stars: 0.8, rift: 0.75,
    fog: 0x160c12, fogDensity: 0.016,
    hemi: [0x33405e, 0x160f0c, 0.55],
    sun: { colour: 0x8fa5ff, intensity: 0.9, pos: [-40, 55, -30] },
    music: 48
  },
  build(world, rng) {
    ground(world, 440, 'asphalt', { uv: 0.22, bumpy: 0.25, seg: 60 });
    const Z0 = 96, Z1 = -214;               // the main street's length
    const crossZ = -40;                     // a cross street

    // lawns and back gardens either side of the road
    for (const s of [-1, 1]) {
      world.box(s * 40, 0.04, (Z0 + Z1) / 2, 50, 0.08, Z0 - Z1, 'dirt', { uv: 0.2, collide: false });
    }

    // pavements, centre line
    for (let z = Z0; z > Z1; z -= 8) {
      if (Math.abs(z - crossZ) < 9) continue;
      world.box(-7.4, 0.08, z, 3.2, 0.16, 8, 'concrete', { uv: 0.5, collide: false });
      world.box(7.4, 0.08, z, 3.2, 0.16, 8, 'concrete', { uv: 0.5, collide: false });
      if (rng.chance(0.55)) world.box(0, 0.02, z, 0.24, 0.04, 4.4, 'concrete', { uv: 1, collide: false, mat: { color: 0xd8c86a } });
    }
    world.collider(-7.4, 0.08, (Z0 + Z1) / 2, 3.2, 0.16, Z0 - Z1, 0, 'kerb');
    world.collider(7.4, 0.08, (Z0 + Z1) / 2, 3.2, 0.16, Z0 - Z1, 0, 'kerb');

    // the cross street, running east–west
    world.box(0, 0.06, crossZ, 240, 0.08, 14, 'asphalt', { uv: 0.25, collide: false });

    // houses along both sides, each with a fenced back garden
    const houseColours = ['brick', 'plaster', 'brick', 'plaster'];
    for (let i = 0; i < 24; i++) {
      const z = Z0 - 6 - i * 13;
      if (Math.abs(z - crossZ) < 12) continue;
      if (z < Z1 + 34) break;
      for (const side of [-1, 1]) {
        if (rng.chance(0.1)) {                         // burnt-out lot
          crater(world, side * 20, z, rng.range(2, 3.5), rng);
          tree(world, side * 22, z + 3, rng, true);
          continue;
        }
        const x = side * (18 + rng.range(0, 3));
        const w = rng.range(9, 12), d = rng.range(8, 11), h = rng.range(4.5, 7.5);
        const doors = side < 0 ? { east: [0, 2.2, 2.6] } : { west: [0, 2.2, 2.6] };
        building(world, x, z, w, d, h, rng, { wall: rng.pick(houseColours), doors, lit: rng.chance(0.25) });
        // pitched roof
        world.shape(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 2.6, 4), 'rust', {
          pos: [x, h + 1.5, z], rot: [0, Math.PI / 4, 0], scale: [w / Math.max(w, d), 1, d / Math.max(w, d)],
          collide: false, mat: { color: 0x5a3a30, roughness: 0.9 }
        });
        world.box(x - side * (w / 2 + 1.2), 1.6, z, 0.3, 3.2, d * 0.8, 'plaster', { uv: 0.6, collide: false });
        if (rng.chance(0.55)) rubble(world, x - side * (w / 2 + 2.4), z + rng.range(-3, 3), rng.int(4, 9), rng, 2.4);
        // back garden: fence line and a tree or two
        if (Math.abs(z - crossZ) > 26) {             // the cross-street houses sit here otherwise
          const gx = side * 34;
          if (rng.chance(0.8)) fence(world, gx, z - 6, gx, z + 6, rng, 0.25);
          tree(world, side * rng.range(27, 32), z + rng.range(-4, 4), rng, rng.chance(0.35));
        }
        if (rng.chance(0.3)) trash(world, x - side * (w / 2 + 1.5), z + rng.range(-3, 3), rng, 4);
        if (rng.chance(0.25)) bloodPool(world, x - side * (w / 2 + 3), z + rng.range(-3, 3), rng.range(1, 2.4), i);
      }
    }

    // houses and a petrol station on the cross street
    for (let i = 0; i < 6; i++) {
      for (const sx of [-1, 1]) {
        const x = sx * (30 + i * 16);
        if (sx > 0 && i === 1) continue;               // room for the petrol station
        for (const sz of [-1, 1]) {
          building(world, x, crossZ + sz * 16, rng.range(10, 13), rng.range(8, 10), rng.range(5, 8), rng,
            { wall: rng.pick(houseColours), lit: rng.chance(0.2) });
        }
        if (rng.chance(0.6)) car(world, x + rng.range(-4, 4), crossZ + rng.range(-4, 4), rng() * TAU, rng, 0x3a3f48);
      }
    }
    gasStation(world, 46, crossZ + 1, rng);
    roadSign(world, -9.5, crossZ + 8, Math.PI / 2, 'ASH ST');
    roadSign(world, 9.5, crossZ - 8, -Math.PI / 2, 'ELM AVE');

    // wrecked traffic, barrels, fires, street furniture down the street
    for (let i = 0; i < 28; i++) {
      const z = Z0 - 8 - i * 10 + rng.range(-3, 3);
      if (z < Z1 + 30) break;
      if (Math.abs(z - crossZ) < 6 || Math.abs(z + 74) < 7) continue;
      const x = rng.range(-5.5, 5.5);
      car(world, x, z, rng.range(-0.5, 0.5) + (rng.chance(0.3) ? 1.6 : 0), rng,
        rng.pick([0x39424f, 0x5a2630, 0x24303a, 0x6a6357, 0x2a3a2a]));
      if (rng.chance(0.35)) barrel(world, x + rng.range(-3, 3), z + rng.range(-3, 3), rng);
      if (rng.chance(0.25)) hydrant(world, rng.sign() * 8.2, z + rng.range(-3, 3));
      if (rng.chance(0.2)) dumpster(world, rng.sign() * 11.5, z, rng.range(-0.3, 0.3), rng);
      if (rng.chance(0.3)) trafficCones(world, x, z + 4, rng, 3);
    }
    for (let i = 0; i < 9; i++) {
      const z = Z0 - 20 - i * 30;
      fireSource(world, rng.range(-6, 6), 0.3, z + rng.range(-6, 6), rng.range(0.8, 1.6));
    }
    for (let i = 0; i < 12; i++) lamp(world, (i % 2 ? -8.4 : 8.4), Z0 - 10 - i * 26, 0xffc27a, i % 3 === 0 ? 0 : 16);
    powerLine(world, -10.5, Z0, Z1 + 30, 20, rng);
    billboard(world, 16, 50, -Math.PI / 2, 'THE END IS NOT NEAR', '#ff4a3c');
    billboard(world, -16, -128, Math.PI / 2, 'EVACUATE — LINE 4', '#ffd24a');

    // an overturned bus makes a choke point; a military barricade beyond it
    const busZ = -74;
    const bus = new THREE.Group();
    const busBody = new THREE.Mesh(new THREE.BoxGeometry(11, 3, 2.7),
      new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.7, metalness: 0.3 }));
    busBody.castShadow = busBody.receiveShadow = true;
    bus.add(busBody);
    bus.rotation.order = 'YXZ';
    bus.rotation.set(Math.PI / 2 * 0.96, 0.25, 0);
    bus.position.set(0, 1.4, busZ);
    world.add(bus, 'bus');
    rubble(world, 0, busZ, 20, rng, 6);
    sandbags(world, 0, busZ - 18, 7, 1.4, Math.PI, rng);
    tent(world, -12, busZ - 26, 0.3, rng);
    tent(world, 13, busZ - 30, -0.5, rng);
    crates(world, 10, busZ - 22, rng, 4);

    // a small park with an abandoned relief camp
    const px = -48, pz = -110;
    world.box(px, 0.05, pz, 34, 0.1, 40, 'dirt', { uv: 0.3, collide: false, mat: { color: 0x3a4a2a } });
    for (let i = 0; i < 14; i++) tree(world, px + rng.range(-16, 16), pz + rng.range(-19, 19), rng, rng.chance(0.3));
    for (let i = 0; i < 5; i++) tent(world, px + rng.range(-10, 10), pz + rng.range(-12, 12), rng() * TAU, rng);
    bench(world, px + 12, pz - 4, Math.PI / 2);
    bench(world, px + 12, pz + 6, Math.PI / 2);
    fireSource(world, px, 0.3, pz, 1.2);
    crater(world, px - 8, pz + 14, 3.5, rng);

    // chapel at the end of the street: the way out
    const cz = Z1 + 20;
    building(world, 0, cz, 22, 18, 12, rng, { wall: 'concrete', doors: { south: [0, 4.5, 5] } });
    world.shape(new THREE.ConeGeometry(2.4, 9, 4), 'rust', { pos: [0, 16.5, cz - 4], rot: [0, Math.PI / 4, 0], collide: false, mat: { color: 0x2a2a30 } });
    const gate = new THREE.Mesh(new THREE.BoxGeometry(4.4, 4.6, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.8, emissive: 0x1a0d04 }));
    gate.position.set(0, 2.3, cz + 9);
    world.add(gate);
    world.sign('CHAPEL', 0, 6.4, cz + 9.3, 0, 6);
    for (const s of [-1, 1]) lamp(world, s * 6, cz + 12, 0xffb266, 18);
    for (let i = 0; i < 10; i++) {   // the churchyard
      const gxs = rng.sign() * rng.range(14, 24), gzs = cz + rng.range(-8, 14);
      world.box(gxs, 0.5, gzs, 0.7, 1, 0.18, 'concrete', { uv: 1, rotY: rng.range(-0.2, 0.2), collide: false, mat: { color: 0x8a8a8a } });
    }

    // the world past the fences
    skyline(world, 250, 26, rng, { hMin: 18, hMax: 60, fires: true });
    hills(world, 205, 18, rng);

    world.playerStart.set(0, 0, Z0 - 6);
    world.playerFacing = 0;

    return {
      stages: [
        {
          text: 'Push north to the crossroads',
          kind: 'reach',
          zone: zone(0, crossZ, 40, 12, 0, 8),
          spawns: [
            { kind: 'walker', at: [-4, 0, 66] }, { kind: 'walker', at: [5, 0, 58] },
            { kind: 'walker', at: [-6, 0, 44] }, { kind: 'walker', at: [3, 0, 30] },
            { kind: 'runner', at: [-2, 0, 18] }, { kind: 'walker', at: [6, 0, 6] },
            { kind: 'walker', at: [-5, 0, -8] }, { kind: 'runner', at: [7, 0, -18] },
            { kind: 'walker', at: [30, 0, -36] }, { kind: 'walker', at: [-28, 0, -44] }
          ]
        },
        {
          text: 'Break through the bus barricade',
          kind: 'kill',
          count: 10,
          spawns: [
            { kind: 'walker', at: [-6, 0, -58] }, { kind: 'walker', at: [6, 0, -62] },
            { kind: 'walker', at: [0, 0, -84] }, { kind: 'runner', at: [-8, 0, -88] },
            { kind: 'walker', at: [8, 0, -92] }, { kind: 'walker', at: [-3, 0, -98] },
            { kind: 'walker', at: [4, 0, -104] }, { kind: 'runner', at: [0, 0, -110] },
            { kind: 'walker', at: [40, 0, -44] }, { kind: 'brute', at: [0, 0, -120] }
          ]
        },
        {
          text: 'Reach the chapel gate',
          kind: 'reach',
          zone: zone(0, cz + 12, 12, 8, 0, 8),
          spawns: [
            { kind: 'walker', at: [-9, 0, -138] }, { kind: 'walker', at: [9, 0, -146] },
            { kind: 'runner', at: [0, 0, -156] }, { kind: 'walker', at: [-40, 0, -110] },
            { kind: 'walker', at: [-52, 0, -104] }, { kind: 'runner', at: [-6, 0, -168] },
            { kind: 'walker', at: [7, 0, -174] }, { kind: 'runner', at: [-3, 0, -182] }
          ]
        }
      ],
      pickups: [
        ['ammo', 2, 0, 62], ['health', -5, 0, 36], ['ammo', 6, 0, 12], ['armour', 46, 0, -52],
        ['ammo', -4, 0, -30], ['health', 10, 0, -96], ['ammo', 0, 0, -118], ['ammo', -48, 0, -110],
        ['health', 5, 0, -150], ['ammo', -4, 0, -170]
      ]
    };
  }
};

/* ------------------------------------------------------------------- 2 */
function crashedHeli(world, x, z) {
  const heli = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x2c3a2c, roughness: 0.6, metalness: 0.5 });
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 3.4, 6, 12), hullMat);
  hull.rotation.z = Math.PI / 2;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 0.5), hullMat);
  tail.position.set(4, 0.3, 0);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.14, 0.5), new THREE.MeshStandardMaterial({ color: 0x16181a }));
  rotor.position.set(-0.5, 1.7, 0);
  rotor.rotation.z = 0.2;
  heli.add(hull, tail, rotor);
  heli.traverse(o => { o.castShadow = true; });
  heli.position.set(x, 1.4, z);
  heli.rotation.set(0.1, 0.9, 0.16);
  world.add(heli, 'heli');
  fireSource(world, x, 0.6, z, 2.2);
}

/** A burnt-out tank: hull, turret and barrel. */
function tank(world, x, z, rotY) {
  const mat = { color: 0x4a5236, metalness: 0.5, roughness: 0.7 };
  world.box(x, 1.1, z, 3.4, 1.2, 6.8, 'rust', { rotY, uv: 0.5, mat, tag: 'tank' });
  world.box(x, 0.5, z, 3.8, 0.9, 6.4, 'rust', { rotY, uv: 0.5, mat: { color: 0x22241c } , collide: false });
  world.shape(new THREE.CylinderGeometry(1.3, 1.5, 0.9, 10), 'rust', { pos: [x, 2.1, z], rot: [0, rotY, 0], mat, collide: false });
  world.shape(new THREE.CylinderGeometry(0.14, 0.14, 4.4, 8), 'rust', {
    pos: [x + Math.sin(rotY + 0.3) * 2.5, 2.2, z + Math.cos(rotY + 0.3) * 2.5],
    rot: [Math.PI / 2 - 0.1, rotY + 0.3, 0], mat, collide: false
  });
}

export const LEVEL_2 = {
  id: 2,
  name: 'Downtown Burning',
  subtitle: 'Financial district',
  brief: 'The rift sits over the towers. Cross the plaza and find the metro entrance.',
  theme: {
    skyTop: 0x16060c, skyHorizon: 0x5a1408, skyGround: 0x1a0a08, skyGlow: 0xa03010,
    glowDir: [0.1, 0.25, -1], stars: 0.2, rift: 1.0,
    fog: 0x2a0f0a, fogDensity: 0.019,
    hemi: [0x5a2418, 0x1a0c08, 0.7],
    sun: { colour: 0xff7a3c, intensity: 1.1, pos: [30, 48, -60] },
    music: 44
  },
  build(world, rng) {
    ground(world, 480, 'asphalt', { uv: 0.2, bumpy: 0.2, seg: 60 });

    // city blocks: tower grid with streets between them
    for (let gx = -3; gx <= 3; gx++) {
      for (let gz = -5; gz <= 1; gz++) {
        if (gx === 0) continue;                              // the boulevard
        if (Math.abs(gx) === 1 && gz >= -2 && gz <= 0) continue;   // the plaza
        const x = gx * 42 + rng.range(-3, 3), z = gz * 44 + rng.range(-3, 3);
        const w = rng.range(18, 28), d = rng.range(18, 26), h = rng.range(16, 52);
        building(world, x, z, w, d, h, rng, { wall: rng.pick(['concrete', 'brick', 'concrete']), lit: rng.chance(0.45) });
        // a jagged, collapsed crown on some towers
        if (rng.chance(0.4)) {
          world.box(x + rng.range(-5, 5), h + 3, z + rng.range(-5, 5), w * 0.5, 6, d * 0.4, 'concrete',
            { uv: 0.3, rotY: rng.range(-0.4, 0.4), collide: false });
        }
        if (rng.chance(0.5)) rubble(world, x + rng.range(-14, 14), z + rng.range(-14, 14), rng.int(8, 20), rng, 5);
        // pavement furniture around each block
        for (let k = 0; k < 3; k++) {
          const sx = x + rng.sign() * (w / 2 + 2), sz = z + rng.range(-d / 2, d / 2);
          const pick = rng();
          if (pick < 0.3) dumpster(world, sx, sz, rng.range(-0.3, 0.3), rng);
          else if (pick < 0.55) trash(world, sx, sz, rng, 5);
          else if (pick < 0.75) hydrant(world, sx, sz);
          else bench(world, sx, sz, Math.PI / 2);
        }
      }
    }

    // plaza: paving, fountain, statue, burning wrecks
    world.box(0, 0.12, -44, 70, 0.24, 110, 'concrete', { uv: 0.35, collide: false });
    world.cylinder(0, 0.6, -40, 5.2, 5.6, 1.2, 'concrete', { seg: 24, tag: 'fountain' });
    world.cylinder(0, 1.7, -40, 0.9, 1.3, 2.4, 'concrete', { seg: 12, tag: 'fountain' });
    world.shape(new THREE.SphereGeometry(0.9, 12, 10), 'rust', { pos: [0, 3.9, -40], mat: { color: 0x6a7a6a, metalness: 0.7 }, collide: false });
    for (let i = 0; i < 16; i++) {
      const a = rng() * TAU, r = rng.range(10, 30);
      car(world, Math.cos(a) * r, -40 + Math.sin(a) * r * 1.4, rng() * TAU, rng, rng.pick([0x2e3944, 0x6a2020, 0x3c4a3c, 0x5a5a5a]));
    }
    for (let i = 0; i < 20; i++) barrel(world, rng.range(-30, 30), rng.range(-100, 20), rng);
    for (let i = 0; i < 14; i++) fireSource(world, rng.range(-34, 34), 0.3, rng.range(-120, 30), rng.range(1, 2));
    for (let i = 0; i < 8; i++) crater(world, rng.range(-28, 28), rng.range(-110, 20), rng.range(2, 4), rng);
    for (let i = 0; i < 12; i++) bloodPool(world, rng.range(-26, 26), rng.range(-100, 20), rng.range(1, 3), i);
    for (let i = 0; i < 10; i++) {
      const lx = (i % 2 ? -1 : 1) * 17, lz = 30 - i * 16;
      lamp(world, lx, lz, 0xffb066, i % 3 === 1 ? 0 : 16);
    }

    crashedHeli(world, -18, -62);
    tank(world, 16, -18, 0.6);
    tank(world, -14, -96, -0.3);
    billboard(world, 28, -8, -Math.PI / 2, 'STAY INDOORS', '#ff4a3c');
    billboard(world, -28, -84, Math.PI / 2, 'METRO LINE 4 ▲', '#4ac8ff');

    // military checkpoint funnels the fight before the metro
    const cpZ = -112;
    for (let i = -4; i <= 4; i++) {
      if (i === 0) continue;
      world.box(i * 5.5, 0.6, cpZ, 4, 1.2, 1, 'concrete', { uv: 0.7, rotY: rng.range(-0.2, 0.2) });
    }
    sandbags(world, -12, cpZ - 6, 5, 1.6, Math.PI, rng);
    sandbags(world, 12, cpZ - 6, 5, 1.6, Math.PI, rng);
    tent(world, -22, cpZ - 12, 0.4, rng);
    crates(world, 20, cpZ - 12, rng, 5);
    trafficCones(world, 0, cpZ + 4, rng, 6);

    // metro entrance at the far end, with a stair going down into the dark
    const mx = 0, mz = -150;
    roomWalls(world, mx, mz, 14, 10, 6, 'concrete', { doors: { south: [0, 5, 4.2] }, mat: { repeat: 1 } });
    world.box(mx, 6.2, mz, 15, 0.5, 11, 'concrete', { uv: 0.4 });
    world.sign('METRO — LINE 4', mx, 4.2, mz + 5.2, 0, 8, '#4ac8ff');
    world.box(mx, 0.03, mz - 1, 8, 0.06, 7, 'concrete', { uv: 0.8, collide: false, mat: { color: 0x050507 } });
    for (let i = 0; i < 3; i++) {
      world.box(mx, 0.08, mz + 2.2 - i * 0.9, 8, 0.12, 0.3, 'concrete', { uv: 1, collide: false, mat: { color: 0x9a9a9a } });
    }
    world.light(0x4ac8ff, 12, mx, 4, mz + 4, 22);

    skyline(world, 300, 34, rng, { hMin: 50, hMax: 130, fires: true, tint: 0x241a1a });

    world.playerStart.set(0, 0, 60);
    world.playerFacing = 0;

    return {
      stages: [
        {
          text: 'Fight down the boulevard to the plaza',
          kind: 'reach',
          zone: zone(0, -40, 40, 26, 0, 10),
          spawns: [
            { kind: 'walker', at: [-8, 0, 40] }, { kind: 'walker', at: [9, 0, 34] },
            { kind: 'runner', at: [0, 0, 22] }, { kind: 'walker', at: [-12, 0, 10] },
            { kind: 'runner', at: [12, 0, 4] }, { kind: 'walker', at: [3, 0, -6] },
            { kind: 'imp', at: [-16, 0, -14] }, { kind: 'walker', at: [20, 0, -22] },
            { kind: 'imp', at: [-22, 0, -30] }
          ]
        },
        {
          text: 'Hold the plaza — clear the horde',
          kind: 'defend',
          duration: 58,
          waveEvery: 6.5,
          waveKinds: ['walker', 'walker', 'runner', 'imp'],
          wavePoints: [[-30, 0, -70], [30, 0, -70], [-32, 0, -10], [32, 0, -14], [0, 0, -86], [0, 0, 12]],
          maxAlive: 16
        },
        {
          text: 'Break the checkpoint and descend into the metro',
          kind: 'reach',
          zone: zone(0, -156, 10, 8, -3, 8),
          spawns: [
            { kind: 'imp', at: [-10, 0, -100] }, { kind: 'runner', at: [8, 0, -104] },
            { kind: 'walker', at: [0, 0, -120] }, { kind: 'brute', at: [4, 0, -126] },
            { kind: 'walker', at: [-14, 0, -130] }, { kind: 'imp', at: [14, 0, -134] },
            { kind: 'runner', at: [-4, 0, -140] }
          ]
        }
      ],
      pickups: [
        ['shotgun', 0, 0, 48], ['ammo', -6, 0, 26], ['health', 8, 0, 8], ['ammo', 0, 0, -20],
        ['armour', -14, 0, -52], ['ammo', 14, 0, -58], ['health', 0, 0, -70], ['ammo', -4, 0, -92],
        ['ammo', 5, 0, -108], ['health', 20, 0, -118], ['armour', -20, 0, -120]
      ]
    };
  }
};

/* ------------------------------------------------------------------- 3 */
export const LEVEL_3 = {
  id: 3,
  name: 'Undercity Line',
  subtitle: 'Metro, 40 m down',
  brief: 'The tunnels run under the treasury. Restore the power, then take the freight lift.',
  theme: {
    skyTop: 0x05050a, skyHorizon: 0x0a0a12, skyGround: 0x05050a, skyGlow: 0x000000,
    stars: 0, rift: 0,
    fog: 0x07070c, fogDensity: 0.045,
    hemi: [0x1a2028, 0x060608, 0.25],
    sun: { colour: 0x334455, intensity: 0.12, pos: [0, 40, 0] },
    music: 41, dark: true
  },
  build(world, rng) {
    const T = 'tile';
    ground(world, 440, 'concrete', { uv: 0.4, mat: { color: 0x9a9a9a } });

    // main hall: z from +24 down to -176
    const hallW = 22, zTop = 24, zBot = -176, hallLen = zTop - zBot, hallZ = (zTop + zBot) / 2;
    const P = 1.1;                                   // platform height
    world.box(0, 4.6, hallZ, hallW + 1, 0.6, hallLen, 'concrete', { uv: 0.35 });   // ceiling

    // side walls, with gaps where the maintenance rooms open off them
    const westRooms = [8, -40, -96, -140];
    const eastRooms = [-18, -70, -122];
    const wallWithGaps = (x, gaps) => {
      const cuts = gaps.map(z => [z - 1.6, z + 1.6]).sort((a, b) => b[0] - a[0]);
      let top = zTop;
      for (const [lo, hi] of cuts) {
        if (top - hi > 0.1) world.box(x, 2.4, (top + hi) / 2, 0.6, 5, top - hi, T, { uv: 0.6 });
        world.box(x, 4.45, (lo + hi) / 2, 0.6, 0.9, hi - lo, T, { uv: 0.6 });   // lintel, high above the raised floor
        top = lo;
      }
      if (top - zBot > 0.1) world.box(x, 2.4, (top + zBot) / 2, 0.6, 5, top - zBot, T, { uv: 0.6 });
    };
    wallWithGaps(-hallW / 2, westRooms);
    wallWithGaps(hallW / 2, eastRooms);
    world.box(0, 2.4, zTop, hallW, 5, 0.6, T, { uv: 0.6 });   // the end wall behind the start

    // platforms either side of a track pit
    world.box(-7, P / 2, hallZ, 7, P, hallLen, T, { uv: 0.5 });
    world.box(7, P / 2, hallZ, 7, P, hallLen, T, { uv: 0.5 });
    // yellow safety edge
    for (const s of [-1, 1]) world.box(s * 3.65, P + 0.01, hallZ, 0.3, 0.02, hallLen, 'plaster', { uv: 1, collide: false, mat: { color: 0xd8b83a } });
    for (let z = zTop - 4; z > zBot + 2; z -= 3) {
      world.box(0, 0.08, z, 6, 0.16, 1, 'rust', { uv: 1.2, collide: false });
    }
    for (const rail of [-1.2, 1.2]) world.box(rail, 0.22, hallZ, 0.14, 0.2, hallLen, 'rust', { uv: 2, collide: false });
    // two-step stairs out of the pit, so a fall onto the tracks is never a trap
    for (let z = 10; z > zBot + 10; z -= 22) {
      for (const s of [-1, 1]) {
        world.box(s * 2.5, 0.19, z, 0.7, 0.38, 1.6, 'rust', { uv: 1 });
        world.box(s * 3.2, 0.375, z, 0.7, 0.75, 1.6, 'rust', { uv: 1 });
      }
    }

    // pillars, benches, bins, posters along the platforms
    for (let z = zTop - 8; z > zBot + 6; z -= 9) {
      for (const s of [-1, 1]) {
        world.box(s * 4.4, 2.5, z, 0.7, 5, 0.7, 'concrete', { uv: 0.8 });
        if (rng.chance(0.3)) bench(world, s * 8.5, z + 3, s > 0 ? -Math.PI / 2 : Math.PI / 2);
        else if (rng.chance(0.3)) trash(world, s * 9, z + 3, rng, 4);
      }
    }
    for (let z = zTop - 14; z > zBot; z -= 28) {
      world.sign('LINE 4 — TREASURY', -hallW / 2 + 0.35, 2.6, z, Math.PI / 2, 4, '#4ac8ff');
      world.sign('MIND THE GAP', hallW / 2 - 0.35, 2.6, z - 10, -Math.PI / 2, 4, '#ffd24a');
    }
    // vending machines glowing on the platforms
    for (const [vx, vz] of [[-10.2, 0], [10.2, -44], [-10.2, -116], [10.2, -150]]) {
      world.box(vx, P + 1, vz, 0.8, 2, 1.2, 'rust', { uv: 1, mat: { color: 0x2a3a5a, emissive: 0x0a2a4a, emissiveIntensity: 1.2 } });
    }

    // a derailed train sitting in the pit
    for (let i = 0; i < 4; i++) {
      const z = -50 - i * 14;
      const carBody = new THREE.Mesh(new THREE.BoxGeometry(3.1, 3.2, 12.6),
        new THREE.MeshStandardMaterial({ color: 0x8b1f2a, roughness: 0.6, metalness: 0.4 }));
      const tilt = i === 1 || i === 2;
      carBody.position.set(tilt ? 1.2 : 0, 1.9, z);
      carBody.rotation.z = tilt ? 0.2 : 0;
      carBody.rotation.y = tilt ? 0.08 * (i === 1 ? 1 : -1) : 0;
      carBody.castShadow = carBody.receiveShadow = true;
      world.add(carBody, 'train');
      for (const s of [-1, 1]) {
        for (let k = -2; k <= 2; k++) {
          world.quad((tilt ? 1.2 : 0) + s * 1.56, 2.4, z + k * 2.4, 1.6, 1, s * Math.PI / 2, 'train-windows',
            () => new THREE.MeshStandardMaterial({ color: 0x0a0e12, roughness: 0.2, metalness: 0.5, emissive: 0x06121a }));
        }
      }
    }

    // maintenance rooms: three hold the breakers, the rest hold supplies
    const breakerRooms = new Set([8, -96, -140]);
    const room = (x, z, side) => {
      roomWalls(world, x, z, 12, 12, 4.4, T, { doors: side < 0 ? { east: [0, 3.2, 4.2] } : { west: [0, 3.2, 4.2] } });
      world.box(x, 4.6, z, 12.6, 0.5, 12.6, 'concrete', { uv: 0.4 });
      // rooms sit at platform height, so the doorway is level
      world.box(x, P / 2, z, 11.6, P, 11.6, 'concrete', { uv: 0.5 });
      world.box(side * (hallW / 2 + 0.1), P / 2, z, 2.2, P, 3.4, 'concrete', { uv: 0.8 });
      if (breakerRooms.has(z)) {
        const n = [...breakerRooms].indexOf(z) + 1;
        terminal(world, x + side * 3, P, z - 4, 0, 'BREAKER ' + n);
      }
      crates(world, x + side * 2, z + 3, rng, rng.int(2, 4));
      if (rng.chance(0.6)) rubble(world, x + rng.range(-4, 4), z + rng.range(-4, 4), rng.int(4, 10), rng, 2);
      if (rng.chance(0.5)) bloodPool(world, x, z, rng.range(1, 2.5), z | 0);
      world.light(0xffe0a0, 2.2, x, 3.8, z, 10);
    };
    westRooms.forEach(z => room(-hallW / 2 - 6.2, z, -1));
    eastRooms.forEach(z => room(hallW / 2 + 6.2, z, 1));

    // collapsed sections and fires
    for (let i = 0; i < 8; i++) rubble(world, rng.sign() * rng.range(6, 9), -10 - i * 20, rng.int(6, 14), rng, 3.2);
    fireSource(world, 8, P + 0.4, -60, 1.3);
    fireSource(world, -9, P + 0.4, -20, 1.1);
    fireSource(world, 7, P + 0.4, -128, 1.2);

    // the freight lift beyond the end of the hall
    const lz = zBot - 12;
    for (const s of [-1, 1]) world.box(s * 6.6, 2.4, zBot, 9.8, 5, 0.6, T, { uv: 0.6 });
    // as wide as the hall, so its front wall seals the tunnel end
    roomWalls(world, 0, lz, hallW + 1.2, 20, 6, 'rust', { doors: { south: [0, 3.4, 5] }, mat: { metalness: 0.5, roughness: 0.6 } });
    world.box(0, 6.2, lz, hallW + 2.2, 0.6, 21, 'rust', { uv: 0.4 });
    for (const s of [-1, 1]) world.box(s * (hallW / 2 + 0.3), 2.4, zBot - 1, 0.6, 5, 2.4, T, { uv: 0.6 });
    world.box(0, 0.25, lz - 3, 10, 0.5, 8, 'rust', { uv: 0.6, tag: 'lift' });
    world.sign('FREIGHT LIFT — TREASURY', 0, 4.4, lz + 9.6, 0, 9, '#ffd24a');
    world.light(0xff3b30, 6, 0, 4.6, lz, 16);
    crates(world, -6, lz + 4, rng, 4);
    crates(world, 6, lz + 5, rng, 3);

    // emergency lighting: dim, red, sparse — the flashlight is the real light
    for (let z = zTop - 10; z > zBot; z -= 16) {
      for (const s of [-1, 1]) world.light(0xff4a3c, 3.4, s * 9.5, 3.9, z, 13);
    }

    world.playerStart.set(-6, P, 18);
    world.playerFacing = 0;

    return {
      stages: [
        {
          text: 'Find the three breakers',
          kind: 'interact',
          count: 3,
          spawns: [
            { kind: 'runner', at: [-17, P, 6] }, { kind: 'hound', at: [6, P, -8] },
            { kind: 'walker', at: [-6, P, -24] }, { kind: 'hound', at: [17, P, -18] },
            { kind: 'runner', at: [8, P, -46] }, { kind: 'walker', at: [-6, P, -76] },
            { kind: 'hound', at: [-17, P, -96] }, { kind: 'runner', at: [10, P, -84] },
            { kind: 'walker', at: [17, P, -122] }, { kind: 'hound', at: [-8, P, -130] },
            { kind: 'runner', at: [-17, P, -140] }
          ]
        },
        {
          text: 'Power restored — reach the freight lift',
          kind: 'reach',
          zone: zone(0, lz - 3, 10, 8, 0, 8),
          onEnterText: 'Something heard that.',
          spawns: [
            { kind: 'brute', at: [0, 0, -160] }, { kind: 'hound', at: [-8, P, -164] },
            { kind: 'hound', at: [8, P, -164] }, { kind: 'runner', at: [-4, P, -150] },
            { kind: 'runner', at: [5, P, -152] }, { kind: 'imp', at: [0, 0, lz + 2] },
            { kind: 'imp', at: [-5, 0, lz - 4] }
          ]
        }
      ],
      pickups: [
        ['ammo', 6, P, 8], ['health', -8, P, -12], ['ammo', 8, P, -30], ['armour', -8, P, -56],
        ['ammo', 7, P, -80], ['health', -7, P, -106], ['ammo', 8, P, -118], ['armour', 17, P, -70],
        ['ammo', -17, P, -40], ['health', 7, P, -160], ['ammo', 0, 0, lz + 6]
      ]
    };
  }
};

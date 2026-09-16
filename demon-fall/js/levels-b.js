/* Demon Fall — stages 4 to 6: the cathedral vault, the Master Treasury and the
 * launch pad where the last ship waits. */
import * as THREE from 'three';
import { ground, building, roomWalls, car, barrel, lamp, rubble, fireSource } from './world.js';
import {
  tree, fence, crates, sandbags, roadSign, billboard, trafficCones, crater,
  scorch, bloodPool, tent, skyline, hills, trash, bench
} from './props.js';
import { material } from './textures.js';
import { TAU } from './util.js';
import { zone, pickup, terminal } from './levels-a.js';

/** Tall stained-glass window: coloured panes that glow in the dark. */
function stainedGlass(world, x, y, z, w, h, rotY, rng) {
  const panes = 5, cols = 3;
  for (let i = 0; i < panes; i++) {
    for (let c = 0; c < cols; c++) {
      const colour = new THREE.Color().setHSL(rng.range(0, 1), 0.75, 0.42);
      world.quad(
        x + Math.cos(rotY) * ((c - 1) * (w / cols)),
        y + (i - panes / 2 + 0.5) * (h / panes),
        z + Math.sin(rotY) * ((c - 1) * (w / cols)),
        w / cols - 0.08, h / panes - 0.08, -rotY, 'stained-glass',
        () => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
        colour
      );
    }
  }
  // the pointed arch at the top of each window
  world.shape(new THREE.ConeGeometry(w * 0.5, w * 0.7, 3), 'marble', {
    pos: [x, y + h / 2 + w * 0.3, z], rot: [0, -rotY + Math.PI / 2, 0], scale: [1, 1, 0.12], collide: false
  });
  world.light(0x8a7aff, 6, x, y, z, 22);
}

/** A kneeling stone figure for the cathedral courtyard. */
function statue(world, x, z, rotY) {
  world.box(x, 0.6, z, 1.6, 1.2, 1.6, 'marble', { uv: 0.8 });
  const m = { color: 0x8a8a86, roughness: 0.8 };
  world.shape(new THREE.CylinderGeometry(0.35, 0.55, 1.8, 8), 'marble', { pos: [x, 2.1, z], mat: m, collide: false });
  world.shape(new THREE.SphereGeometry(0.3, 10, 8), 'marble', { pos: [x, 3.2, z], mat: m, collide: false });
  for (const s of [-1, 1]) {   // wings, folded
    world.shape(new THREE.BoxGeometry(0.1, 1.8, 1), 'marble', {
      pos: [x + Math.cos(rotY) * s * 0.4, 2.5, z - Math.sin(rotY) * s * 0.4], rot: [0.3, rotY, s * 0.25], mat: m, collide: false
    });
  }
}

/* ------------------------------------------------------------------- 4 */
export const LEVEL_4 = {
  id: 4,
  name: 'Cathedral of Coin',
  subtitle: 'The old exchange',
  brief: 'The vault key hangs on the Warden. Cross the graveyard, clear the nave, kill it.',
  theme: {
    skyTop: 0x0a0812, skyHorizon: 0x2a0e18, skyGround: 0x120810, skyGlow: 0x5a1430,
    glowDir: [-0.4, 0.3, -1], stars: 0.5, rift: 0.5,
    fog: 0x120a12, fogDensity: 0.022,
    hemi: [0x3a2c54, 0x120a10, 0.5],
    sun: { colour: 0xa090ff, intensity: 0.5, pos: [-30, 60, 20] },
    music: 39
  },
  build(world, rng) {
    ground(world, 320, 'dirt', { uv: 0.2, bumpy: 0.3, mat: { color: 0x8a8090 } });

    const W = 60, D = 124, H = 26, CZ = -34;          // the nave: z from +28 to -96
    const front = CZ + D / 2, back = CZ - D / 2;
    world.box(0, 0.05, CZ, W, 0.1, D, 'marble', { uv: 0.18, collide: false, mat: { roughness: 0.35 } });
    roomWalls(world, 0, CZ, W, D, H, 'concrete', { doors: { south: [0, 9, 11] }, mat: { repeat: 1 } });
    world.box(0, H, CZ, W + 2, 1, D + 2, 'concrete', { uv: 0.3 });
    // buttresses along the outside walls
    for (let z = front - 8; z > back; z -= 14) {
      for (const s of [-1, 1]) world.box(s * (W / 2 + 1.4), H * 0.4, z, 2.6, H * 0.8, 2.4, 'concrete', { uv: 0.4 });
    }
    // bell tower over the entrance
    world.box(0, H + 8, front - 4, 12, 16, 8, 'concrete', { uv: 0.3 });
    world.shape(new THREE.ConeGeometry(7, 14, 4), 'rust', { pos: [0, H + 23, front - 4], rot: [0, Math.PI / 4, 0], collide: false, mat: { color: 0x2a2630 } });

    // colonnade and arches
    for (let i = 0; i < 13; i++) {
      const z = front - 10 - i * 9;
      for (const s of [-1, 1]) {
        world.cylinder(s * 16, 8, z, 1.2, 1.4, 16, 'marble', { seg: 16, mat: { roughness: 0.4 } });
        world.box(s * 16, 16.4, z, 3.2, 0.8, 3.2, 'marble', { uv: 0.6 });
        world.box(s * 16, 17.4, z - 4.5, 2.4, 1, 6, 'marble', { uv: 0.5, collide: false });
      }
    }

    // raised altar with the vault door behind it
    const az = back + 18;
    world.box(0, 0.5, az, 26, 1, 20, 'marble', { uv: 0.4 });
    for (let i = 0; i < 3; i++) world.box(0, 0.17 + i * 0.33, az + 10.6 + (2 - i) * 0.7, 18, 0.34, 0.7, 'marble', { uv: 0.8 });
    world.box(0, 1.4, az + 4, 14, 0.8, 3, 'marble', { uv: 0.6 });
    const vault = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 1.8, 40),
      material('gold', { repeat: 2, roughness: 0.3, metalness: 0.95 }));
    vault.rotation.x = Math.PI / 2;
    vault.position.set(0, 7, back + 1.6);
    vault.castShadow = true;
    world.add(vault, 'vault');
    world.box(0, 7, back + 0.6, 18, 14, 1.2, 'rust', { uv: 0.5, mat: { metalness: 0.7, roughness: 0.4 } });
    world.sign('MASTER TREASURY', 0, 15.2, back + 1.4, 0, 14, '#ffd24a');
    // candles on the altar steps
    for (let i = 0; i < 16; i++) {
      const cx = rng.range(-11, 11), cz = az + rng.range(-8, 8);
      world.shape(new THREE.CylinderGeometry(0.05, 0.05, rng.range(0.2, 0.5), 6), 'plaster', {
        pos: [cx, 1.2, cz], collide: false, mat: { color: 0xfff0d0, emissive: 0x6a4a1a }
      });
    }

    // braziers
    for (const [bx, bz] of [[-10, az + 12], [10, az + 12], [-10, front - 16], [10, front - 16], [-16, CZ], [16, CZ], [-16, CZ - 30], [16, CZ - 30]]) {
      world.cylinder(bx, 0.6, bz, 0.7, 0.45, 1.2, 'rust', { seg: 10, mat: { metalness: 0.6 } });
      fireSource(world, bx, 1.2, bz, 1.2);
    }

    // stained glass high on both walls
    for (let i = 0; i < 7; i++) {
      const z = front - 12 - i * 16;
      stainedGlass(world, -W / 2 + 0.6, 15, z, 5, 10, Math.PI / 2, rng);
      stainedGlass(world, W / 2 - 0.6, 15, z, 5, 10, -Math.PI / 2, rng);
    }
    // a rose window over the vault
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      world.quad(Math.cos(a) * 3.2, 20 + Math.sin(a) * 3.2, back + 0.8, 1.6, 1.6, 0, 'stained-glass',
        () => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
        new THREE.Color().setHSL(i / 12, 0.8, 0.45));
    }

    // pews (some toppled), side chapels, rubble
    for (let i = 0; i < 34; i++) {
      const z = front - 14 - i * 2.4, s = i % 2 ? 1 : -1;
      if (z < az + 14) break;
      const toppled = rng.chance(0.3);
      world.box(s * rng.range(5, 11), toppled ? 0.35 : 0.45, z, 6.4, toppled ? 0.7 : 0.9, 0.7, 'wood',
        { uv: 0.8, rotY: toppled ? rng.range(-0.6, 0.6) : rng.range(-0.05, 0.05) });
    }
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const cz = CZ + 30 - k * 30;
        crates(world, s * 25, cz, rng, 3);
        bloodPool(world, s * 24, cz + 4, rng.range(1.5, 3), k * 7 + (s > 0 ? 3 : 0));
      }
    }
    for (let i = 0; i < 14; i++) rubble(world, rng.range(-24, 24), rng.range(back + 30, front - 10), rng.int(6, 14), rng, 3, 'marble');

    // the graveyard in front of the cathedral
    const gz0 = front + 6, gz1 = front + 70;
    fence(world, -40, gz0, -40, gz1, rng, 0.2);
    fence(world, 40, gz0, 40, gz1, rng, 0.2);
    fence(world, -40, gz1, -8, gz1, rng, 0.2);
    fence(world, 8, gz1, 40, gz1, rng, 0.2);
    world.box(0, 0.06, (gz0 + gz1) / 2, 7, 0.1, gz1 - gz0, 'concrete', { uv: 0.4, collide: false });   // the path
    for (let i = 0; i < 70; i++) {
      const x = rng.sign() * rng.range(7, 36), z = rng.range(gz0 + 4, gz1 - 4);
      const kind = rng();
      if (kind < 0.6) {
        world.box(x, 0.55, z, 0.8, 1.1, 0.2, 'concrete', { uv: 1, rotY: rng.range(-0.25, 0.25), collide: false, mat: { color: 0x9a9a98 } });
      } else if (kind < 0.85) {
        world.box(x, 0.8, z, 0.18, 1.6, 0.18, 'concrete', { uv: 1, collide: false, mat: { color: 0x9a9a98 } });
        world.box(x, 1.2, z, 0.9, 0.16, 0.18, 'concrete', { uv: 1, collide: false, mat: { color: 0x9a9a98 } });
      } else {
        world.box(x, 0.4, z, 1.2, 0.8, 2.2, 'marble', { uv: 0.8, rotY: rng.range(-0.2, 0.2) });   // tomb
      }
      if (rng.chance(0.25)) world.box(x, 0.15, z + 1, 0.9, 0.3, 1.8, 'dirt', { uv: 1, collide: false });   // disturbed earth
    }
    for (let i = 0; i < 16; i++) tree(world, rng.sign() * rng.range(10, 38), rng.range(gz0, gz1), rng, true);
    statue(world, -6, front + 18, 0);
    statue(world, 6, front + 18, 0);
    for (let i = 0; i < 4; i++) lamp(world, (i % 2 ? -5 : 5), gz1 - 8 - i * 16, 0xbfa0ff, 12);
    fireSource(world, -22, 0.3, front + 40, 1.4);

    skyline(world, 220, 28, rng, { hMin: 30, hMax: 90, fires: true, tint: 0x1c1422 });

    world.playerStart.set(0, 0, gz1 - 4);
    world.playerFacing = 0;

    return {
      stages: [
        {
          text: 'Cross the graveyard',
          kind: 'reach',
          zone: zone(0, front - 6, 24, 10, 0, 8),
          spawns: [
            { kind: 'walker', at: [-14, 0, gz1 - 20] }, { kind: 'walker', at: [16, 0, gz1 - 28] },
            { kind: 'runner', at: [-4, 0, gz1 - 36] }, { kind: 'hound', at: [20, 0, gz0 + 20] },
            { kind: 'walker', at: [-24, 0, gz0 + 12] }, { kind: 'imp', at: [8, 0, gz0 + 8] }
          ]
        },
        {
          text: 'Cut through the nave',
          kind: 'kill',
          count: 12,
          spawns: [
            { kind: 'imp', at: [-8, 0, front - 20] }, { kind: 'imp', at: [8, 0, front - 24] },
            { kind: 'walker', at: [-12, 0, front - 32] }, { kind: 'walker', at: [12, 0, front - 36] },
            { kind: 'hound', at: [0, 0, front - 44] }, { kind: 'runner', at: [-6, 0, front - 52] },
            { kind: 'runner', at: [6, 0, front - 56] }, { kind: 'brute', at: [0, 0, front - 66] },
            { kind: 'imp', at: [-13, 0, front - 72] }, { kind: 'imp', at: [13, 0, front - 76] },
            { kind: 'walker', at: [-24, 0, CZ] }, { kind: 'hound', at: [24, 0, CZ - 10] }
          ]
        },
        {
          text: 'Kill the Vault Warden',
          kind: 'boss',
          boss: { kind: 'warden', at: [0, 1, az] },
          onEnterText: 'THE WARDEN WAKES',
          waveEvery: 11,
          waveKinds: ['imp', 'hound', 'runner'],
          wavePoints: [[-22, 0, CZ + 10], [22, 0, CZ + 10], [0, 0, front - 10], [-22, 0, back + 30], [22, 0, back + 30]],
          maxAlive: 9
        },
        {
          text: 'Take the vault key',
          kind: 'reach',
          zone: zone(0, az, 12, 10, 0, 8)
        }
      ],
      pickups: [
        ['ammo', -4, 0, gz1 - 14], ['health', 4, 0, gz0 + 30], ['plasma', 0, 0, front - 12],
        ['ammo', -2.5, 0, front - 28], ['health', 2.5, 0, front - 42], ['armour', -2.5, 0, front - 56],
        ['ammo', 2.5, 0, front - 66], ['health', -24, 0, CZ - 30], ['ammo', 24, 0, CZ + 30],
        ['armour', 24, 0, CZ - 30], ['health', -8, 0, az + 14], ['ammo', 8, 0, az + 14]
      ]
    };
  }
};

/* ------------------------------------------------------------------- 5 */
export const LEVEL_5 = {
  id: 5,
  name: 'Master Treasury',
  subtitle: 'Sub-level nine',
  brief: 'Get through security, hold the vault while the door cycles, then take the Mars key.',
  theme: {
    skyTop: 0x0a0806, skyHorizon: 0x1a1008, skyGround: 0x0a0806, skyGlow: 0x3a2000,
    stars: 0, rift: 0,
    fog: 0x120c06, fogDensity: 0.032,
    hemi: [0x4a3a1c, 0x120c06, 0.55],
    sun: { colour: 0xffcf7a, intensity: 0.4, pos: [0, 50, 0] },
    music: 37
  },
  build(world, rng) {
    ground(world, 240, 'marble', { uv: 0.2, mat: { color: 0xd8cfb4, roughness: 0.3 } });

    // the vault hall: z from +36 to -36
    const W = 72, D = 72, H = 16;
    roomWalls(world, 0, 0, W, D, H, 'gold', { mat: { repeat: 3, metalness: 0.9, roughness: 0.35 }, doors: { south: [0, 8, 7] } });
    world.box(0, H, 0, W + 2, 1, D + 2, 'concrete', { uv: 0.35 });
    // coffered ceiling beams and pilasters
    for (let i = -3; i <= 3; i++) {
      world.box(i * 10, H - 0.6, 0, 0.8, 1.2, D, 'marble', { uv: 0.4, collide: false });
      for (const s of [-1, 1]) world.box(s * (W / 2 - 0.6), H / 2, i * 10, 1, H, 1.6, 'marble', { uv: 0.4 });
    }

    // bullion stacks and money carts: cover to fight around
    for (let i = 0; i < 40; i++) {
      const x = rng.range(-30, 30), z = rng.range(-28, 28);
      if (Math.hypot(x, z + 26) < 9 || Math.abs(x) < 4) continue;
      const rows = rng.int(2, 5);
      for (let r = 0; r < rows; r++) {
        world.box(x, 0.16 + r * 0.32, z, 1.5, 0.3, 0.9, 'gold',
          { uv: 1.2, rotY: rng.range(-0.3, 0.3), mat: { repeat: 1, metalness: 0.95, roughness: 0.3 }, collide: r === 0 });
      }
    }
    for (let i = 0; i < 8; i++) {
      const x = rng.sign() * rng.range(8, 30), z = rng.range(-20, 26);
      world.box(x, 0.8, z, 1.4, 0.9, 2.2, 'rust', { uv: 0.8, rotY: rng.range(-0.5, 0.5), mat: { color: 0x6a6a70, metalness: 0.8 } });
      world.box(x, 1.4, z, 1.2, 0.3, 2, 'gold', { uv: 1, rotY: rng.range(-0.5, 0.5), collide: false, mat: { repeat: 1, metalness: 0.95, roughness: 0.3 } });
    }
    // scattered coins
    for (let i = 0; i < 120; i++) {
      world.shape(new THREE.CylinderGeometry(0.06, 0.06, 0.015, 8), 'gold', {
        pos: [rng.range(-32, 32), 0.01, rng.range(-32, 32)], rot: [0, rng() * TAU, 0], collide: false,
        mat: { repeat: 1, metalness: 0.95, roughness: 0.3 }
      });
    }
    // display cases with light inside
    for (const [cx, cz] of [[-22, -20], [22, -20], [-22, 10], [22, 10], [-22, 26], [22, 26]]) {
      world.box(cx, 0.6, cz, 3, 1.2, 3, 'marble', { uv: 0.7 });
      const glass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 2.6),
        new THREE.MeshPhysicalMaterial({ color: 0xbfe4ff, transmission: 0.9, roughness: 0.08, thickness: 0.4, transparent: true, opacity: 0.35 }));
      glass.position.set(cx, 2, cz);
      world.add(glass);
      world.shape(new THREE.OctahedronGeometry(0.35, 0), 'gold', { pos: [cx, 1.65, cz], collide: false, mat: { repeat: 1, metalness: 1, roughness: 0.2 } });
      world.light(0xffe6a8, 4, cx, 2.4, cz, 10);
    }

    // the vault door at the north end
    const door = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 2, 48),
      material('rust', { repeat: 2, metalness: 0.9, roughness: 0.35 }));
    door.rotation.x = Math.PI / 2;
    door.position.set(0, 7.6, -D / 2 + 0.4);
    world.add(door);
    const spokes = new THREE.Mesh(new THREE.TorusGeometry(4, 0.4, 8, 28),
      new THREE.MeshStandardMaterial({ color: 0xffd24a, metalness: 0.9, roughness: 0.25, emissive: 0x3a2200 }));
    spokes.position.copy(door.position).setZ(door.position.z + 1.2);
    world.add(spokes);
    for (let i = 0; i < 12; i++) {   // locking bolts round the rim
      const a = (i / 12) * TAU;
      world.shape(new THREE.CylinderGeometry(0.3, 0.3, 1.4, 10), 'rust', {
        pos: [Math.cos(a) * 6.4, 7.6 + Math.sin(a) * 6.4, -D / 2 + 1.3], rot: [Math.PI / 2, 0, 0], collide: false,
        mat: { metalness: 0.9, roughness: 0.3 }
      });
    }

    // the Mars key on a pedestal
    const kz = -24;
    world.box(0, 0.6, kz, 2.4, 1.2, 2.4, 'marble', { uv: 0.8 });
    world.box(0, 0.1, kz, 7, 0.2, 7, 'marble', { uv: 0.6, collide: false, mat: { color: 0x2a2620 } });
    const key = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x6ae0ff, emissive: 0x1c7a9a, emissiveIntensity: 2.2, metalness: 0.8, roughness: 0.2 }));
    key.position.set(0, 1.9, kz);
    world.add(key);
    world.light(0x6ae0ff, 6, 0, 2.2, kz, 14);
    terminal(world, 5, 0, kz - 2, -0.4, 'VAULT CYCLE');

    for (const [bx, bz] of [[-30, -30], [30, -30], [-30, 30], [30, 30]]) fireSource(world, bx, 0.4, bz, 1);

    // security antechamber south of the hall: desks, scanners, lockers
    const az = D / 2 + 18;
    roomWalls(world, 0, az, 26, 36, 6, 'marble', { doors: { north: [0, 8, 5.5] } });
    world.box(0, 6.2, az, 27, 0.5, 37, 'concrete', { uv: 0.4 });
    for (const s of [-1, 1]) {
      // scanner arches
      world.box(s * 3, 1.3, az - 6, 0.4, 2.6, 0.6, 'rust', { uv: 1, mat: { color: 0x9aa0a8, metalness: 0.7 } });
      world.box(s * 1, 2.7, az - 6, 2.4, 0.3, 0.6, 'rust', { uv: 1, collide: false, mat: { color: 0x9aa0a8, metalness: 0.7 } });
      // desks
      world.box(s * 8, 0.55, az + 4, 5, 1.1, 1.4, 'wood', { uv: 0.8 });
      // lockers along the walls
      for (let k = 0; k < 8; k++) {
        world.box(s * 12.2, 1.1, az - 14 + k * 1.1, 0.8, 2.2, 1, 'rust', { uv: 1, mat: { color: 0x4a5a6a, metalness: 0.6 } });
      }
    }
    world.sign('AUTHORISED PERSONNEL ONLY', 0, 4.6, az + 17.6, 0, 9, '#ff3b30');
    world.light(0xfff0d0, 5, 0, 5, az, 20);
    for (let i = 0; i < 4; i++) bloodPool(world, rng.range(-8, 8), az + rng.range(-12, 12), rng.range(1, 2.5), i + 30);
    crates(world, -8, az - 12, rng, 3);

    world.playerStart.set(0, 0, az + 14);
    world.playerFacing = 0;

    return {
      spin: [{ obj: key, speed: 1.2, bobY: 1.9 }, { obj: spokes, speed: 0.4 }],
      stages: [
        {
          text: 'Get through security',
          kind: 'reach',
          zone: zone(0, D / 2 - 4, 14, 8, 0, 8),
          spawns: [
            { kind: 'walker', at: [-6, 0, az + 2] }, { kind: 'walker', at: [7, 0, az - 4] },
            { kind: 'runner', at: [0, 0, az - 12] }, { kind: 'imp', at: [-8, 0, D / 2 - 8] }
          ]
        },
        {
          text: 'Start the vault cycle',
          kind: 'interact',
          count: 1,
          spawns: [
            { kind: 'runner', at: [-24, 0, 16] }, { kind: 'runner', at: [24, 0, 16] },
            { kind: 'imp', at: [0, 0, -8] }, { kind: 'walker', at: [-16, 0, 0] },
            { kind: 'hound', at: [18, 0, -10] }
          ]
        },
        {
          text: 'Hold out while the door cycles',
          kind: 'defend',
          duration: 80,
          waveEvery: 5.5,
          waveKinds: ['walker', 'runner', 'imp', 'hound', 'brute'],
          wavePoints: [[-32, 0, 32], [32, 0, 32], [-32, 0, -6], [32, 0, -6], [0, 0, 32], [-20, 0, -32], [20, 0, -32]],
          maxAlive: 18,
          onEnterText: 'They know what is in here.'
        },
        {
          text: 'Take the Mars key',
          kind: 'reach',
          zone: zone(0, kz, 5, 5, 0, 6)
        }
      ],
      pickups: [
        ['ammo', -4, 0, az + 6], ['health', 6, 0, az - 10], ['ammo', -8, 0, 26], ['ammo', 8, 0, 26],
        ['health', -26, 0, 4], ['armour', 26, 0, 4], ['ammo', 0, 0, 10], ['health', 0, 0, -6],
        ['ammo', -18, 0, -16], ['ammo', 18, 0, -16], ['health', 28, 0, 28], ['armour', -28, 0, 28],
        ['ammo', -30, 0, -20], ['ammo', 30, 0, -20]
      ]
    };
  }
};

/* ------------------------------------------------------------------- 6 */
function fuelTank(world, x, z, r, h) {
  world.shape(new THREE.CylinderGeometry(r, r, h, 20), 'hull', { pos: [x, h / 2, z], collide: true, tag: 'tank', mat: { repeat: 2, metalness: 0.6, roughness: 0.4 } });
  world.shape(new THREE.SphereGeometry(r, 20, 10, 0, TAU, 0, Math.PI / 2), 'hull', { pos: [x, h, z], collide: false, mat: { repeat: 2, metalness: 0.6, roughness: 0.4 } });
  for (let i = 0; i < 4; i++) {   // hoops
    world.shape(new THREE.TorusGeometry(r + 0.05, 0.08, 6, 24), 'rust', { pos: [x, (i + 0.5) * h / 4, z], rot: [Math.PI / 2, 0, 0], collide: false });
  }
}

function radarDish(world, x, z, rotY) {
  world.box(x, 2, z, 2, 4, 2, 'concrete', { uv: 0.6 });
  world.shape(new THREE.CylinderGeometry(0.3, 0.3, 3, 8), 'rust', { pos: [x, 5.5, z], collide: false });
  world.shape(new THREE.SphereGeometry(4.5, 24, 12, 0, TAU, 0, Math.PI / 3.2), 'hull', {
    pos: [x, 8.5, z], rot: [-0.8, rotY, 0], collide: false, mat: { repeat: 1, metalness: 0.5, roughness: 0.5 }
  });
}

function controlTower(world, x, z, rng) {
  world.cylinder(x, 12, z, 2.4, 3, 24, 'concrete', { seg: 14, tag: 'tower' });
  world.cylinder(x, 25.5, z, 5.5, 4.5, 3, 'rust', { seg: 16, mat: { color: 0x3a4a5a, metalness: 0.6 }, tag: 'tower' });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    world.quad(x + Math.cos(a) * 5.05, 25.5, z + Math.sin(a) * 5.05, 1.8, 1.6, -a + Math.PI / 2, 'tower-glass',
      () => new THREE.MeshBasicMaterial({ color: 0x8ad8ff }));
  }
  world.light(0x8ad8ff, 20, x, 25.5, z, 40);
}

function crane(world, x, z, rotY) {
  const m = { color: 0xd8a830, metalness: 0.5, roughness: 0.6 };
  for (const [ox, oz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
    world.box(x + ox, 14, z + oz, 0.3, 28, 0.3, 'rust', { uv: 1, mat: m, collide: false });
  }
  world.collider(x, 14, z, 2.8, 28, 2.8, 0, 'crane');
  for (let y = 2; y < 28; y += 3) world.box(x, y, z, 2.7, 0.2, 2.7, 'rust', { uv: 1, mat: m, collide: false });
  world.shape(new THREE.BoxGeometry(30, 1.2, 1.2), 'rust', { pos: [x + Math.cos(rotY) * 9, 28.6, z - Math.sin(rotY) * 9], rot: [0, rotY, 0], mat: m, collide: false });
  world.shape(new THREE.CylinderGeometry(0.04, 0.04, 16, 3), 'rust', { pos: [x + Math.cos(rotY) * 20, 20.5, z - Math.sin(rotY) * 20], collide: false });
  world.box(x + Math.cos(rotY) * 20, 12, z - Math.sin(rotY) * 20, 3, 1.8, 3, 'rust', { uv: 0.8, mat: { color: 0x3a5a7a, metalness: 0.6 }, collide: false });
}

export const LEVEL_6 = {
  id: 6,
  name: 'Last Launch',
  subtitle: 'Orbital pad 7',
  brief: 'The last ship burns for Mars in minutes. Fight across the spaceport and get aboard.',
  theme: {
    skyTop: 0x080a18, skyHorizon: 0x3a1420, skyGround: 0x0c0a10, skyGlow: 0x7a2018,
    glowDir: [0.5, 0.2, -1], stars: 0.9, rift: 0.9,
    fog: 0x140c14, fogDensity: 0.013,
    hemi: [0x2a3a5a, 0x120c10, 0.6],
    sun: { colour: 0x9ab4ff, intensity: 0.8, pos: [40, 60, 30] },
    music: 46
  },
  build(world, rng) {
    ground(world, 560, 'concrete', { uv: 0.2, mat: { color: 0x8c8c90 } });

    const padZ = -168;
    // taxiway markings and edge lights leading north to the pad
    for (let z = 110; z > padZ + 30; z -= 10) {
      world.box(0, 0.03, z, 1.2, 0.06, 6, 'concrete', { uv: 1, collide: false, mat: { color: 0xffe08a } });
      for (const s of [-1, 1]) {
        world.box(s * 12, 0.15, z, 0.3, 0.3, 0.3, 'plaster', { uv: 1, collide: false, mat: { color: 0x4ac8ff, emissive: 0x2a8acc, emissiveIntensity: 2 } });
      }
    }
    for (const s of [-1, 1]) world.box(s * 12.8, 0.03, -20, 0.3, 0.06, 260, 'concrete', { uv: 1, collide: false, mat: { color: 0xeeeeee } });

    // hangars and service buildings either side
    for (let i = 0; i < 7; i++) {
      const z = 90 - i * 32;
      for (const s of [-1, 1]) {
        const x = s * rng.range(34, 44);
        const w = rng.range(18, 26), d = rng.range(16, 22), h = rng.range(9, 14);
        building(world, x, z, w, d, h, rng, {
          wall: 'rust', mat: { metalness: 0.5, roughness: 0.6 }, lit: rng.chance(0.6),
          doors: s < 0 ? { east: [0, 8, 7] } : { west: [0, 8, 7] }
        });
        // curved hangar roof
        world.shape(new THREE.CylinderGeometry(d / 2, d / 2, w, 16, 1, false, 0, Math.PI), 'rust', {
          pos: [x, h, z], rot: [0, 0, Math.PI / 2], collide: false, mat: { color: 0x6a7078, metalness: 0.6 }
        });
        world.sign('HANGAR ' + (i * 2 + (s > 0 ? 2 : 1)), x - s * (w / 2 + 0.1), h - 1.5, z, s < 0 ? Math.PI / 2 : -Math.PI / 2, 5, '#ffd24a');
        crates(world, x - s * (w / 2 + 3), z + rng.range(-6, 6), rng, rng.int(2, 4));
      }
    }
    for (let i = 0; i < 16; i++) barrel(world, rng.range(-26, 26), rng.range(-130, 100), rng);
    for (let i = 0; i < 10; i++) car(world, rng.range(-24, 24), rng.range(-120, 100), rng() * TAU, rng, 0x39424f);
    for (let i = 0; i < 14; i++) lamp(world, (i % 2 ? -16 : 16), 100 - i * 18, 0xbfe0ff, 16);
    for (let i = 0; i < 12; i++) fireSource(world, rng.range(-30, 30), 0.3, rng.range(-130, 100), rng.range(0.8, 1.8));
    for (let i = 0; i < 10; i++) crater(world, rng.range(-28, 28), rng.range(-130, 90), rng.range(2.5, 4.5), rng);
    for (let i = 0; i < 12; i++) bloodPool(world, rng.range(-24, 24), rng.range(-130, 90), rng.range(1, 3), i + 50);
    for (let i = 0; i < 6; i++) trafficCones(world, rng.range(-20, 20), rng.range(-120, 90), rng, 4);

    // big set pieces
    fuelTank(world, -70, -40, 9, 18);
    fuelTank(world, -70, -64, 9, 18);
    fuelTank(world, -92, -52, 7, 14);
    radarDish(world, 72, -20, -0.6);
    radarDish(world, 80, -70, -1.1);
    controlTower(world, 70, 40, rng);
    crane(world, -36, padZ + 4, 0.2);
    billboard(world, 24, 72, -Math.PI / 2, 'ARES PROGRAM', '#6ae0ff');
    billboard(world, -24, -60, Math.PI / 2, 'LAST SHIP — PAD 7', '#ff7a2f');

    // evacuation camp along the approach
    for (let i = 0; i < 8; i++) tent(world, rng.sign() * rng.range(18, 26), rng.range(40, 80), rng() * TAU, rng);
    sandbags(world, 0, 20, 8, 1.4, 0, rng);
    sandbags(world, -14, -40, 6, 1.6, Math.PI / 2, rng);
    sandbags(world, 14, -40, 6, 1.6, -Math.PI / 2, rng);

    // blast walls near the pad
    for (let i = -5; i <= 5; i++) {
      if (Math.abs(i) < 2) continue;
      world.box(i * 7, 2, padZ + 58, 6, 4, 1.2, 'concrete', { uv: 0.6 });
    }
    for (let i = 0; i < 6; i++) roadSign(world, rng.sign() * 11, padZ + 62 + i * 30, 0, 'PAD 7 ▲', '#6ae0ff');

    // the pad: a raised ring with the ship on top
    // kept to a single step's height so you can walk straight onto it
    world.cylinder(0, 0.25, padZ, 24, 25, 0.5, 'concrete', { seg: 44, mat: { color: 0x9a9a9e }, tag: 'pad' });
    world.shape(new THREE.TorusGeometry(19, 0.25, 6, 48), 'plaster', {
      pos: [0, 0.52, padZ], rot: [Math.PI / 2, 0, 0], collide: false, mat: { color: 0xffd24a, emissive: 0x6a4a00 }
    });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      world.cylinder(Math.cos(a) * 21, 5, padZ + Math.sin(a) * 21, 0.4, 0.5, 10, 'rust', { seg: 8 });
      world.light(0x4ac8ff, 5, Math.cos(a) * 21, 10, padZ + Math.sin(a) * 21, 18);
    }
    // launch gantry beside the ship
    for (const [gx, gz] of [[-8, padZ - 2], [-8, padZ + 2], [-12, padZ - 2], [-12, padZ + 2]]) {
      world.box(gx, 14, gz, 0.4, 28, 0.4, 'rust', { uv: 1, mat: { color: 0xa83a2a, metalness: 0.6 }, collide: false });
    }
    world.collider(-10, 14, padZ, 4.4, 28, 4.4, 0, 'gantry');
    for (let y = 3; y < 28; y += 4) world.box(-10, y, padZ, 4.4, 0.25, 4.4, 'rust', { uv: 1, collide: false, mat: { color: 0xa83a2a, metalness: 0.6 } });
    for (const y of [10, 18]) world.box(-6, y, padZ, 3.6, 0.4, 1.2, 'rust', { uv: 1, collide: false, mat: { color: 0xa83a2a, metalness: 0.6 } });

    // the ship: nose cone, body, fins, engines
    const ship = new THREE.Group();
    const hullMat = material('hull', { repeat: 2, metalness: 0.75, roughness: 0.35 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.3, 20, 28), hullMat);
    body.position.y = 10; body.castShadow = true;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(2.8, 7, 28), hullMat);
    nose.position.y = 23.5;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.9, 2, 28), hullMat);
    skirt.position.y = 1;
    ship.add(body, nose, skirt);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 3.4), hullMat);
      fin.position.set(Math.cos(a) * 3.5, 3, Math.sin(a) * 3.5);
      fin.rotation.y = -a;
      fin.castShadow = true;
      ship.add(fin);
      const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.05, 1.8, 14), hullMat);
      engine.position.set(Math.cos(a + 0.78) * 1.8, -0.5, Math.sin(a + 0.78) * 1.8);
      ship.add(engine);
    }
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.83, 2.9, 1.2, 28),
      new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.5, metalness: 0.3 }));
    stripe.position.y = 6;
    const windows = new THREE.Mesh(new THREE.TorusGeometry(2.82, 0.16, 8, 28),
      new THREE.MeshStandardMaterial({ color: 0x6ae0ff, emissive: 0x2a9ac0, emissiveIntensity: 2 }));
    windows.rotation.x = Math.PI / 2;
    windows.position.y = 17;
    ship.add(stripe, windows);
    ship.position.set(0, 0.5, padZ);
    world.add(ship);
    world.collider(0, 10, padZ, 7, 20, 7, 0, 'ship');
    world.light(0x6ae0ff, 12, 0, 16, padZ + 5, 30);
    scorch(world, 0, padZ, 30);

    // boarding stairs up to the hatch, each rise small enough to step
    for (let i = 0; i < 4; i++) {
      const top = 0.9 + i * 0.4;
      world.box(0, top / 2, padZ + 17 - i * 3, 4, top, 3, 'rust', { uv: 0.7, tag: 'ramp', mat: { metalness: 0.6 } });
    }
    world.box(0, 2.9, padZ + 5.4, 3.4, 2.6, 0.3, 'rust', { uv: 0.8, mat: { metalness: 0.7 } });
    world.sign('BOARD', 0, 5.2, padZ + 5.2, 0, 4, '#6ae0ff');

    skyline(world, 320, 30, rng, { hMin: 20, hMax: 70, fires: true, tint: 0x1a1a24 });
    hills(world, 290, 20, rng, 'dirt', 0x2a2230);

    world.playerStart.set(0, 0, 104);
    world.playerFacing = 0;

    return {
      ship,
      stages: [
        {
          text: 'Fight through the evacuation camp',
          kind: 'reach',
          zone: zone(0, 10, 30, 12, 0, 8),
          spawns: [
            { kind: 'runner', at: [-10, 0, 86] }, { kind: 'runner', at: [10, 0, 80] },
            { kind: 'walker', at: [-18, 0, 66] }, { kind: 'walker', at: [18, 0, 60] },
            { kind: 'imp', at: [-8, 0, 50] }, { kind: 'walker', at: [6, 0, 40] },
            { kind: 'hound', at: [-14, 0, 30] }
          ]
        },
        {
          text: 'Fight to the launch pad',
          kind: 'reach',
          zone: zone(0, padZ + 60, 30, 12, 0, 8),
          spawns: [
            { kind: 'imp', at: [-18, 0, -6] }, { kind: 'imp', at: [18, 0, -12] },
            { kind: 'walker', at: [0, 0, -24] }, { kind: 'hound', at: [-12, 0, -40] },
            { kind: 'hound', at: [12, 0, -48] }, { kind: 'brute', at: [0, 0, -66] },
            { kind: 'walker', at: [-8, 0, -80] }, { kind: 'walker', at: [8, 0, -86] },
            { kind: 'runner', at: [-20, 0, -94] }, { kind: 'imp', at: [20, 0, -100] }
          ]
        },
        {
          text: 'Hold the pad while the engines spin up',
          kind: 'defend',
          duration: 64,
          waveEvery: 5,
          waveKinds: ['runner', 'imp', 'hound', 'brute', 'walker'],
          wavePoints: [[-34, 0, padZ + 30], [34, 0, padZ + 30], [-36, 0, padZ - 20], [36, 0, padZ - 20], [0, 0, padZ + 76]],
          maxAlive: 20,
          onEnterText: 'ENGINE PRE-BURN — HOLD THE PAD'
        },
        {
          text: 'Board the ship',
          kind: 'reach',
          zone: zone(0, padZ + 7, 6, 6, 0, 8)
        }
      ],
      pickups: [
        ['ammo', -6, 0, 92], ['ammo', 6, 0, 92], ['health', 0, 0, 70], ['armour', -12, 0, 50],
        ['ammo', 12, 0, 30], ['health', -10, 0, 0], ['ammo', 10, 0, -20], ['ammo', 0, 0, -50],
        ['health', -14, 0, -80], ['ammo', 14, 0, -90], ['armour', 0, 0, padZ + 70],
        ['health', -16, 0, padZ + 40], ['ammo', 16, 0, padZ + 40], ['ammo', -18, 0, padZ + 20], ['ammo', 18, 0, padZ + 20]
      ]
    };
  }
};

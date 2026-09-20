/**
 * The things you actually pick up: a relic on its little plinth, and the map
 * table that appears once a city's three relics are found.
 *
 * Each relic is a small hand-built model so the three in a city look different
 * from each other. They sit on a plinth, turn slowly, and glimmer.
 */
import * as THREE from 'three';
import { makeGlimmer } from './fx.js';
import { TAU } from './util.js';

const GOLD = () => new THREE.MeshStandardMaterial({ color: 0xd8a94a, roughness: 0.28, metalness: 0.85 });
const BRASS = () => new THREE.MeshStandardMaterial({ color: 0xc08b3e, roughness: 0.35, metalness: 0.7 });
const STONE = () => new THREE.MeshStandardMaterial({ color: 0xb9b3a4, roughness: 0.9, metalness: 0.02 });
const DARK = () => new THREE.MeshStandardMaterial({ color: 0x3a3a3f, roughness: 0.6, metalness: 0.3 });
const GLASS = () => new THREE.MeshStandardMaterial({ color: 0x8fd6e8, roughness: 0.1, metalness: 0.1,
  transparent: true, opacity: 0.8, emissive: 0x2a7a94, emissiveIntensity: 0.7 });

function part(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** Six different small treasures, picked by index within the city. */
const SHAPES = [
  // 0: a pin / badge with a disc and a bar
  g => {
    part(g, new THREE.CylinderGeometry(0.17, 0.17, 0.035, 24), GOLD(), 0, 0, 0, Math.PI / 2);
    part(g, new THREE.TorusGeometry(0.17, 0.02, 8, 26), BRASS(), 0, 0, 0, Math.PI / 2);
    part(g, new THREE.BoxGeometry(0.28, 0.03, 0.03), BRASS(), 0, -0.02, 0.03, 0, 0, 0.3);
  },
  // 1: a token on a short chain post
  g => {
    part(g, new THREE.CylinderGeometry(0.15, 0.15, 0.03, 20), BRASS(), 0, 0.02, 0, Math.PI / 2);
    part(g, new THREE.TorusGeometry(0.05, 0.015, 8, 18), GOLD(), 0, 0.2, 0);
    part(g, new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), GOLD(), 0, 0.12, 0);
  },
  // 2: a compass rose: flat plate with four points
  g => {
    part(g, new THREE.CylinderGeometry(0.19, 0.19, 0.025, 28), DARK(), 0, 0, 0);
    for (let i = 0; i < 4; i++) {
      part(g, new THREE.ConeGeometry(0.05, 0.19, 4), GOLD(), 0, 0.02, 0, Math.PI / 2, 0, 0)
        .rotateOnAxis(new THREE.Vector3(0, 1, 0), 0);
    }
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4;
      part(g, new THREE.ConeGeometry(0.045, 0.2, 4), i ? BRASS() : GOLD(),
           Math.cos(a) * 0.1, 0.03, Math.sin(a) * 0.1, Math.PI / 2, 0, -a);
    }
  },
  // 3: a lamp / small vessel
  g => {
    part(g, new THREE.SphereGeometry(0.15, 18, 12), STONE(), 0, 0.05, 0).scale.set(1, 0.7, 1);
    part(g, new THREE.ConeGeometry(0.07, 0.16, 12), STONE(), 0.17, 0.06, 0, 0, 0, -Math.PI / 2);
    part(g, new THREE.TorusGeometry(0.06, 0.018, 8, 16), STONE(), -0.16, 0.07, 0, 0, Math.PI / 2, 0);
    part(g, new THREE.SphereGeometry(0.035, 10, 8), GLASS(), 0.24, 0.07, 0);
  },
  // 4: a key with a decorated bow
  g => {
    part(g, new THREE.CylinderGeometry(0.018, 0.018, 0.42, 10), BRASS(), 0, 0.02, 0, 0, 0, Math.PI / 2);
    part(g, new THREE.TorusGeometry(0.075, 0.022, 8, 20), GOLD(), -0.24, 0.02, 0, 0, Math.PI / 2, 0);
    part(g, new THREE.BoxGeometry(0.03, 0.09, 0.02), BRASS(), 0.17, -0.03, 0);
    part(g, new THREE.BoxGeometry(0.03, 0.06, 0.02), BRASS(), 0.22, -0.02, 0);
  },
  // 5: a small carved tablet
  g => {
    part(g, new THREE.BoxGeometry(0.24, 0.32, 0.04), STONE(), 0, 0.02, 0, 0.1);
    for (let i = 0; i < 3; i++) part(g, new THREE.BoxGeometry(0.16, 0.012, 0.012), DARK(), 0, 0.08 - i * 0.07, 0.025, 0.1);
    part(g, new THREE.TorusGeometry(0.05, 0.012, 8, 18), GOLD(), 0, 0.19, 0.01, 0.1);
  }
];

/**
 * A relic ready to drop into the world: plinth, floating treasure, glimmer and
 * a soft light so it reads from a distance.
 * @returns {THREE.Group} with userData.update(t) and userData.collect()
 */
export function makeRelic(index, colour = 0xffd27a) {
  const group = new THREE.Group();

  const plinth = new THREE.Group();
  part(plinth, new THREE.CylinderGeometry(0.42, 0.5, 0.18, 16), STONE(), 0, 0.09, 0);
  part(plinth, new THREE.CylinderGeometry(0.3, 0.36, 0.55, 16), STONE(), 0, 0.46, 0);
  part(plinth, new THREE.CylinderGeometry(0.38, 0.3, 0.1, 16), STONE(), 0, 0.78, 0);
  group.add(plinth);

  const spin = new THREE.Group();
  spin.position.y = 1.18;
  group.add(spin);
  const item = new THREE.Group();
  SHAPES[index % SHAPES.length](item);
  spin.add(item);

  const glimmer = makeGlimmer(colour, 24, 0.5);
  glimmer.position.y = 0.85;
  group.add(glimmer);

  const light = new THREE.PointLight(colour, 6, 9, 1.8);
  light.position.y = 1.2;
  group.add(light);

  group.userData.update = (t) => {
    spin.rotation.y = t * 0.8;
    spin.position.y = 1.18 + Math.sin(t * 1.6) * 0.06;
    glimmer.userData.update(t);
    light.intensity = 5 + Math.sin(t * 2.4) * 1.4;
  };
  group.userData.collect = () => {
    spin.visible = false;
    glimmer.visible = false;
    light.intensity = 0;
  };
  return group;
}

/** The map table that shows up once all three relics in a city are found. */
export function makeMapTable(colour = 0xffcf8a) {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.7 });
  const top = new THREE.MeshStandardMaterial({ color: 0xe6dcc0, roughness: 0.85 });

  part(group, new THREE.BoxGeometry(1.6, 0.08, 1.1), top, 0, 0.92, 0);
  part(group, new THREE.BoxGeometry(1.7, 0.06, 1.2), wood, 0, 0.86, 0);
  for (const [x, z] of [[-0.7, -0.45], [0.7, -0.45], [-0.7, 0.45], [0.7, 0.45]]) {
    part(group, new THREE.CylinderGeometry(0.05, 0.06, 0.86, 8), wood, x, 0.43, z);
  }
  // a rolled chart and a lamp on the table
  part(group, new THREE.CylinderGeometry(0.06, 0.06, 0.8, 12), top, 0.3, 1.02, 0.2, 0, 0, Math.PI / 2);
  part(group, new THREE.ConeGeometry(0.12, 0.2, 12), BRASS(), -0.45, 1.06, -0.2);
  const beacon = new THREE.PointLight(colour, 10, 12, 1.7);
  beacon.position.set(0, 1.5, 0);
  group.add(beacon);

  const glimmer = makeGlimmer(colour, 30, 0.8);
  glimmer.position.y = 1.0;
  group.add(glimmer);

  group.userData.update = (t) => {
    glimmer.userData.update(t);
    beacon.intensity = 8 + Math.sin(t * 1.8) * 2.5;
  };
  return group;
}

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

/* A soft vertical gradient: bright at the foot, gone at the top. Used for the
 * shaft of light over a relic and the glow on the ground under it. */
let beamTex = null, glowTex = null;
function beamTexture() {
  if (beamTex) return beamTex;
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 128;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,1)');
  c.fillStyle = g; c.fillRect(0, 0, 4, 128);
  beamTex = new THREE.CanvasTexture(cv);
  return beamTex;
}
function glowTexture() {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  g.addColorStop(0.62, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  // a ring of marks round the edge, like a compass rose cut in the stone
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2.5;
  c.beginPath(); c.arc(64, 64, 46, 0, TAU); c.stroke();
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU, r0 = k % 4 ? 49 : 44, r1 = k % 4 ? 55 : 60;
    c.beginPath(); c.moveTo(64 + Math.cos(a) * r0, 64 + Math.sin(a) * r0); c.lineTo(64 + Math.cos(a) * r1, 64 + Math.sin(a) * r1); c.stroke();
  }
  glowTex = new THREE.CanvasTexture(cv);
  return glowTex;
}
const additive = (map, colour, opacity) => new THREE.MeshBasicMaterial({ map, color: colour, transparent: true, opacity,
  depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false });

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
  // two worn steps, a fluted column, a capital banded in gold
  part(plinth, new THREE.CylinderGeometry(0.62, 0.66, 0.1, 8), STONE(), 0, 0.05, 0);
  part(plinth, new THREE.CylinderGeometry(0.42, 0.5, 0.18, 16), STONE(), 0, 0.19, 0);
  part(plinth, new THREE.CylinderGeometry(0.3, 0.36, 0.5, 16), STONE(), 0, 0.53, 0);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    part(plinth, new THREE.BoxGeometry(0.04, 0.46, 0.05), DARK(), Math.cos(a) * 0.315, 0.53, Math.sin(a) * 0.315, 0, -a, 0);
  }
  part(plinth, new THREE.TorusGeometry(0.33, 0.025, 6, 24), GOLD(), 0, 0.29, 0, Math.PI / 2);
  part(plinth, new THREE.CylinderGeometry(0.38, 0.3, 0.1, 16), STONE(), 0, 0.83, 0);
  part(plinth, new THREE.TorusGeometry(0.37, 0.02, 6, 24), GOLD(), 0, 0.88, 0, Math.PI / 2);
  group.add(plinth);

  // the treasure hangs in its own light: a glowing core, a slowly turning
  // ring of gold, a pool of light on the ground and a faint shaft rising
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1),
    new THREE.MeshBasicMaterial({ color: colour, toneMapped: false }));
  core.position.y = 1.18;
  group.add(core);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: colour, transparent: true,
    opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
  halo.scale.setScalar(1.3);
  halo.position.y = 1.18;
  group.add(halo);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 6, 48),
    new THREE.MeshStandardMaterial({ color: 0xd8a94a, emissive: colour, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.3 }));
  ring.position.y = 1.18;
  group.add(ring);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2).rotateX(-Math.PI / 2), additive(glowTexture(), colour, 0.45));
  pool.position.y = 0.04;
  group.add(pool);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 7, 20, 1, true), additive(beamTexture(), colour, 0.28));
  beam.position.y = 3.6;
  group.add(beam);

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

  let gone = -1;
  group.userData.update = (t) => {
    spin.rotation.y = t * 0.8;
    spin.position.y = 1.18 + Math.sin(t * 1.6) * 0.06;
    glimmer.userData.update(t);
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    if (gone < 0) {
      light.intensity = 5 + pulse * 2.8 - 1.4;
      core.position.y = halo.position.y = ring.position.y = spin.position.y;
      ring.rotation.set(Math.PI / 2 + Math.sin(t * 0.7) * 0.5, t * 0.9, Math.cos(t * 0.5) * 0.4);
      halo.material.opacity = 0.35 + pulse * 0.25;
      pool.material.opacity = 0.32 + pulse * 0.18;
      pool.rotation.y = t * 0.15;
      beam.material.opacity = 0.18 + pulse * 0.1;
      core.scale.setScalar(0.9 + pulse * 0.3);
    } else {
      // after it is taken: the light flares, then everything fades away
      if (gone === 0) gone = t;
      const k = Math.max(0, 1 - (t - gone) / 1.4);
      light.intensity = 14 * k;
      pool.material.opacity = 0.6 * k; beam.material.opacity = 0.5 * k;
      beam.scale.set(1 + (1 - k) * 2, 1 + (1 - k), 1 + (1 - k) * 2);
      pool.scale.setScalar(1 + (1 - k) * 2.5);
      halo.visible = core.visible = ring.visible = false;
      if (k <= 0) { pool.visible = beam.visible = false; light.intensity = 0; }
    }
  };
  group.userData.collect = () => {
    spin.visible = false;
    glimmer.visible = false;
    gone = 0;
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

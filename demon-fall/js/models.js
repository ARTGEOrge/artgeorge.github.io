/* Demon Fall — enemy models, built from primitives.
 *
 * Every creature is a small rig of joints (hips, spine, head, shoulders,
 * elbows, hips, knees). Each joint's pieces are merged per material, so a
 * detailed zombie is still only a couple of dozen draw calls. */
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { material } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Collects geometry per joint and merges it at the end. Plain "paints"
 * ({ c: colour }) are baked into vertex colours on the creature's one base
 * material, so a joint is normally a single draw call; real materials (glowing
 * or metal parts) get their own mesh.
 */
class Rig {
  constructor(base) { this.base = base; this.parts = new Map(); }

  add(joint, geo, paint, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
    const g = geo.index ? geo : BufferGeometryUtils.mergeVertices(geo);
    const m = new THREE.Matrix4().compose(
      V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...scale));
    const clone = g.clone().applyMatrix4(m);
    const baked = !paint.isMaterial;
    const mat = baked ? this.base : paint;
    if (baked) {
      const col = new THREE.Color(paint.c).multiplyScalar(paint.k || 1);
      const arr = new Float32Array(clone.attributes.position.count * 3);
      for (let i = 0; i < arr.length; i += 3) { arr[i] = col.r; arr[i + 1] = col.g; arr[i + 2] = col.b; }
      clone.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    const key = joint.uuid + '|' + mat.uuid;
    if (!this.parts.has(key)) this.parts.set(key, { joint, mat, geos: [] });
    this.parts.get(key).geos.push(clone);
  }

  finish() {
    for (const { joint, mat, geos } of this.parts.values()) {
      const merged = BufferGeometryUtils.mergeGeometries(geos, false);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      joint.add(mesh);
    }
  }
}

const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
const ball = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cone = (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg);
const tube = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, true);      // open-ended
const dome = (r, w = 10, h = 6) => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI / 2);

function joint(parent, x, y, z) {
  const j = new THREE.Group();
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

// shared materials (cloth tints are per enemy so a horde isn't uniform)
let SHARED = null;
function shared() {
  if (SHARED) return SHARED;
  SHARED = {
    // base materials: the texture gives grime, vertex colours give the part
    fleshBase: vertexed(material('flesh', { repeat: 2, roughness: 0.85 })),
    hideBase: vertexed(material('demonHide', { repeat: 2, roughness: 0.7, emissive: 0x3a0800, emissiveIntensity: 0.7 })),
    // paints (baked) — light colours are boosted because the texture darkens them
    flesh: { c: 0xffffff },
    fleshDark: { c: 0xb8b8a8 },
    hide: { c: 0xffffff },
    bone: { c: 0xd8cfb8, k: 1.7 },
    teeth: { c: 0xe8e0c8, k: 1.8 },
    socket: { c: 0x120a0a },
    horn: { c: 0x2a1a14 },
    shoe: { c: 0x2a2622 },
    belt: { c: 0x5a3a24 },
    gore: { c: 0x9a1020, k: 1.3 },
    // real materials, kept separate
    metal: material('rust', { repeat: 1, roughness: 0.55, metalness: 0.6 }),
    lava: new THREE.MeshBasicMaterial({ color: 0xff6a1e })
  };
  return SHARED;
}

function vertexed(mat) {
  const m = mat.clone();
  m.vertexColors = true;
  return m;
}

const SHIRTS = [0x6a7a5a, 0x5a4a3a, 0x4a5a6a, 0x7a3a3a, 0x8a8a7a, 0x3a3a4a, 0x6a5a2a];
const PANTS = [0x2a3040, 0x3a342a, 0x24262a, 0x4a4030, 0x30303a];

/**
 * A human (or humanoid demon). Returns joints the animation code drives:
 * { group, hips, torso, head, armL, armR, elbowL, elbowR, legL, legR, kneeL, kneeR, eyes, jaw }
 */
export function humanoid(type) {
  const S = shared();
  const demon = !!type.demon, heavy = !!type.heavy, boss = !!type.boss;
  const rig = new Rig(demon ? S.hideBase : S.fleshBase);
  const rnd = Math.random;
  const skin = demon ? S.hide : (rnd() < 0.5 ? S.flesh : S.fleshDark);
  const shirt = { c: SHIRTS[(rnd() * SHIRTS.length) | 0], k: 1.5 };
  const pants = { c: PANTS[(rnd() * PANTS.length) | 0], k: 1.5 };
  const bulk = heavy ? 1.35 : boss ? 1.25 : 1;

  const g = new THREE.Group();
  const hips = joint(g, 0, 0.95, 0);
  const torso = joint(hips, 0, 0.06, 0);        // the spine: leans and twists
  const neck = joint(torso, 0, 0.64, 0.02);
  const head = joint(neck, 0, 0.08, 0.02);

  // pelvis and belt
  rig.add(hips, cyl(0.17 * bulk, 0.15 * bulk, 0.2, 10), demon ? skin : pants, { pos: [0, 0, 0], scale: [1, 1, 0.7] });
  if (!demon) rig.add(hips, cyl(0.175 * bulk, 0.175 * bulk, 0.05, 10), S.belt, { pos: [0, 0.08, 0], scale: [1, 1, 0.72] });

  // abdomen and chest
  rig.add(torso, cyl(0.2 * bulk, 0.16 * bulk, 0.3, 10), skin, { pos: [0, 0.16, 0], scale: [1, 1, 0.66] });
  rig.add(torso, cyl(0.25 * bulk, 0.2 * bulk, 0.34, 10), skin, { pos: [0, 0.46, 0], scale: [1, 1, 0.62] });
  rig.add(torso, ball(0.17 * bulk, 10, 6), skin, { pos: [0, 0.6, 0], scale: [1.5, 0.6, 0.9] });   // trapezius
  rig.add(neck, cyl(0.06, 0.075, 0.14, 8), skin, { pos: [0, 0.02, 0] });

  if (!demon) {
    // a torn shirt over the chest: open down one side, ribs showing through
    rig.add(torso, tube(0.262 * bulk, 0.212 * bulk, 0.62), shirt, { pos: [0, 0.32, 0], scale: [1, 1, 0.64] });
    for (let i = 0; i < 4; i++) {
      rig.add(torso, box(0.13, 0.018, 0.02), S.bone, { pos: [0.1, 0.36 + i * 0.05, 0.165], rot: [0, 0, -0.25] });
    }
    rig.add(torso, box(0.09, 0.14, 0.02), S.gore, { pos: [0.1, 0.42, 0.158] });
  } else {
    // demon: glowing cracks and a ridge of spines
    rig.add(torso, box(0.03, 0.26, 0.01), S.lava, { pos: [-0.05, 0.42, 0.16], rot: [0, 0, 0.3] });
    rig.add(torso, box(0.02, 0.18, 0.01), S.lava, { pos: [0.08, 0.3, 0.14], rot: [0, 0, -0.5] });
    for (let i = 0; i < 5; i++) {
      rig.add(torso, cone(0.035 + i * 0.004, 0.14 + i * 0.02), S.horn, { pos: [0, 0.14 + i * 0.12, -0.14], rot: [-1.1, 0, 0] });
    }
    // a tail
    // a tail: one smooth curve (thick root, thin tip) ending in a barb
    const tail = joint(hips, 0, -0.02, -0.12);
    const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, -0.12, -0.3), V(0.05, -0.34, -0.55), V(0.12, -0.62, -0.72), V(0.2, -0.86, -0.78)]);
    const pts = curve.getPoints(12);
    rig.add(tail, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(0, 7)), 8, 0.045, 7), skin);
    rig.add(tail, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(6)), 8, 0.026, 6), skin);
    rig.add(tail, cone(0.045, 0.14), S.horn, { pos: [0.21, -0.9, -0.79], rot: [Math.PI, 0, 0.3] });
  }
  if (heavy || boss) {
    // armour plates bolted on
    rig.add(torso, box(0.46 * bulk, 0.26, 0.05), S.metal, { pos: [0, 0.46, 0.17], rot: [-0.1, 0, 0] });
    // pauldrons: flattened shells sitting right on the shoulders
    for (const s of [-1, 1]) rig.add(torso, ball(0.12 * bulk, 12, 8), S.metal, { pos: [s * 0.27 * bulk, 0.6, 0], scale: [1.25, 0.6, 1.1], rot: [0, 0, s * -0.35] });
  }
  if (boss) {
    // the Warden's burning core
    rig.add(torso, ball(0.08, 12, 8), S.lava, { pos: [0, 0.44, 0.19] });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      rig.add(torso, box(0.015, 0.1, 0.01), S.lava, { pos: [Math.cos(a) * 0.12, 0.44 + Math.sin(a) * 0.12, 0.18], rot: [0, 0, a + Math.PI / 2] });
    }
  }

  // head: skull, brow, jaw, teeth, ears, sunken sockets
  rig.add(head, ball(0.125, 12, 10), skin, { pos: [0, 0.13, 0], scale: [0.95, 1.15, 1.05] });
  rig.add(head, box(0.2, 0.035, 0.05), skin, { pos: [0, 0.16, 0.1] });          // brow ridge
  rig.add(head, ball(0.035, 6, 5), skin, { pos: [0, 0.09, 0.13], scale: [0.8, 1.2, 1] });   // nose
  for (const s of [-1, 1]) {
    rig.add(head, ball(0.028, 8, 6), S.socket, { pos: [s * 0.045, 0.13, 0.105] });
    if (!demon) rig.add(head, ball(0.03, 6, 5), skin, { pos: [s * 0.12, 0.12, 0], scale: [0.4, 1, 0.8] });   // ears
  }
  const jaw = joint(head, 0, 0.05, 0.02);
  rig.add(jaw, box(0.15, 0.05, 0.12), skin, { pos: [0, -0.02, 0.04] });
  rig.add(jaw, box(0.11, 0.015, 0.02), S.teeth, { pos: [0, 0.01, 0.1] });
  rig.add(head, box(0.11, 0.015, 0.02), S.teeth, { pos: [0, 0.06, 0.115] });
  if (!demon && rnd() < 0.5) {   // matted hair
    rig.add(head, dome(0.13), S.shoe, { pos: [0, 0.16, -0.01], scale: [1, 0.8, 1.05] });
  }
  if (demon) {
    // curved horns built from shrinking segments
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const t = i / 4;
        rig.add(head, cyl(0.03 * (1 - t) + 0.008, 0.035 * (1 - t) + 0.012, 0.08), S.horn, {
          pos: [s * (0.08 + t * 0.09), 0.23 + t * 0.07 - t * t * 0.1, -0.02 - t * 0.05], rot: [-0.4 - t * 0.5, 0, s * (-0.6 - t * 0.6)]
        });
      }
    }
    if (boss) {   // a crown of spikes
      for (let i = 0; i < 7; i++) {
        const a = -0.9 + i * 0.3;
        rig.add(head, cone(0.02, 0.14), S.horn, { pos: [Math.sin(a) * 0.1, 0.27, Math.cos(a) * 0.02 - 0.02], rot: [-0.2, 0, -a * 0.5] });
      }
    }
  }
  // glowing eyes (separate so they can flash when hit)
  const eyeMat = new THREE.MeshBasicMaterial({ color: type.eyes });
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(ball(0.016, 6, 5), eyeMat);
    e.position.set(s * 0.045, 0.13, 0.122);
    head.add(e);
    eyes.push(e);
  }

  // arms: shoulder -> elbow -> hand
  const arm = side => {
    const sh = joint(torso, side * 0.27 * bulk, 0.56, 0);
    const armBulk = heavy ? 1.6 : boss ? 1.3 : 1;
    rig.add(sh, ball(0.07 * armBulk, 8, 6), skin, {});
    rig.add(sh, cyl(0.055 * armBulk, 0.05 * armBulk, 0.3), skin, { pos: [0, -0.15, 0] });
    if (!demon && !heavy) rig.add(sh, tube(0.07, 0.068, 0.16, 8), shirt, { pos: [0, -0.07, 0] });   // sleeve
    const el = joint(sh, 0, -0.3, 0);
    rig.add(el, ball(0.045 * armBulk, 8, 6), skin, {});
    rig.add(el, cyl(0.048 * armBulk, 0.036 * armBulk, 0.28), skin, { pos: [0, -0.14, 0] });
    const hand = joint(el, 0, -0.29, 0);
    rig.add(hand, box(0.07 * armBulk, 0.08, 0.03), skin, { pos: [0, -0.03, 0] });
    const claw = demon ? 0.09 : 0.05;
    for (let f = 0; f < 4; f++) {
      rig.add(hand, cone(0.008, claw), demon ? S.horn : skin, { pos: [(f - 1.5) * 0.017 * armBulk, -0.09 - claw * 0.3, 0.01], rot: [Math.PI + 0.3, 0, 0] });
    }
    return { sh, el };
  };
  const L = arm(-1), R = arm(1);

  // legs: hip -> knee -> foot (demons stand on the balls of their feet)
  const leg = side => {
    const hip = joint(hips, side * 0.1 * bulk, -0.04, 0);
    const legBulk = heavy ? 1.4 : 1;
    rig.add(hip, cyl(0.075 * legBulk, 0.058 * legBulk, 0.44), demon ? skin : pants, { pos: [0, -0.22, 0] });
    const kn = joint(hip, 0, -0.44, 0);
    rig.add(kn, ball(0.05 * legBulk, 8, 6), demon ? skin : pants, {});
    rig.add(kn, cyl(0.055 * legBulk, 0.04 * legBulk, 0.42), demon ? skin : pants, { pos: [0, -0.21, 0] });
    if (!demon && rnd() < 0.4) rig.add(kn, box(0.07, 0.1, 0.01), S.gore, { pos: [0.02, -0.16, 0.05] });   // torn knee
    if (demon) {
      rig.add(kn, box(0.08, 0.04, 0.16), skin, { pos: [0, -0.43, 0.05] });
      for (let f = -1; f <= 1; f++) rig.add(kn, cone(0.012, 0.07), S.horn, { pos: [f * 0.03, -0.44, 0.15], rot: [Math.PI / 2, 0, 0] });
    } else {
      rig.add(kn, box(0.1, 0.07, 0.24), S.shoe, { pos: [0, -0.44, 0.05] });
    }
    return { hip, kn };
  };
  const LL = leg(-1), LR = leg(1);

  rig.finish();
  return {
    group: g, hips, torso, head, jaw, eyes,
    armL: L.sh, armR: R.sh, elbowL: L.el, elbowR: R.el,
    legL: LL.hip, legR: LR.hip, kneeL: LL.kn, kneeR: LR.kn
  };
}

/** The hellhound. Same joint names so the shared animation code can drive it. */
export function quadruped(type) {
  const S = shared();
  const rig = new Rig(S.hideBase);
  const skin = S.hide;
  const g = new THREE.Group();
  const hips = joint(g, 0, 0.64, 0);
  const torso = joint(hips, 0, 0, 0);

  // lean body with a visible ribcage and spine plates
  rig.add(torso, cyl(0.2, 0.26, 1.05, 12), skin, { pos: [0, 0.02, 0.05], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.9] });
  for (let i = 0; i < 6; i++) {
    const z = 0.32 - i * 0.1;
    for (const s of [-1, 1]) rig.add(torso, box(0.02, 0.2, 0.03), S.bone, { pos: [s * 0.22, -0.02, z], rot: [0, 0, s * 0.25] });
    rig.add(torso, cone(0.03, 0.16), S.horn, { pos: [0, 0.3, z - 0.05], rot: [-0.5, 0, 0] });
  }
  rig.add(torso, box(0.03, 0.4, 0.01), S.lava, { pos: [0.12, 0.02, 0.2], rot: [1.4, 0.3, 0] });

  // neck and head with an open, toothed jaw
  const head = joint(torso, 0, 0.14, 0.62);
  rig.add(head, cyl(0.1, 0.14, 0.3, 10), skin, { pos: [0, -0.02, -0.12], rot: [Math.PI / 2 - 0.4, 0, 0] });
  rig.add(head, ball(0.14, 12, 8), skin, { pos: [0, 0.05, 0.08], scale: [1, 0.85, 1.1] });
  rig.add(head, box(0.14, 0.09, 0.24), skin, { pos: [0, 0.01, 0.28] });              // snout
  rig.add(head, box(0.12, 0.012, 0.2), S.teeth, { pos: [0, -0.035, 0.29] });
  for (const s of [-1, 1]) {
    rig.add(head, cone(0.04, 0.16, 5), skin, { pos: [s * 0.09, 0.2, 0.02], rot: [-0.4, 0, s * -0.4] });   // ears
    rig.add(head, cyl(0.02, 0.03, 0.16), S.horn, { pos: [s * 0.08, 0.17, -0.02], rot: [-1, 0, s * -0.5] });
    rig.add(head, ball(0.025, 8, 6), S.socket, { pos: [s * 0.07, 0.07, 0.19] });
  }
  const jaw = joint(head, 0, -0.05, 0.14);
  rig.add(jaw, box(0.12, 0.05, 0.22), skin, { pos: [0, -0.02, 0.1] });
  rig.add(jaw, box(0.1, 0.012, 0.18), S.teeth, { pos: [0, 0.01, 0.12] });
  const eyeMat = new THREE.MeshBasicMaterial({ color: type.eyes });
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(ball(0.02, 6, 5), eyeMat);
    e.position.set(s * 0.07, 0.07, 0.205);
    head.add(e);
    eyes.push(e);
  }

  // four two-part legs with clawed paws
  const leg = (x, z, back) => {
    const hip = joint(torso, x, -0.08, z);
    rig.add(hip, cyl(0.07, 0.05, 0.34), skin, { pos: [0, -0.17, 0] });
    const kn = joint(hip, 0, -0.34, 0);
    rig.add(kn, cyl(0.045, 0.035, 0.3), skin, { pos: [0, -0.14, back ? -0.02 : 0.02], rot: [back ? 0.35 : -0.2, 0, 0] });
    rig.add(kn, box(0.08, 0.04, 0.12), skin, { pos: [0, -0.29, 0.04] });
    for (let f = -1; f <= 1; f++) rig.add(kn, cone(0.01, 0.06), S.horn, { pos: [f * 0.025, -0.3, 0.12], rot: [Math.PI / 2, 0, 0] });
    return { hip, kn };
  };
  const FL = leg(-0.18, 0.4, false), FR = leg(0.18, 0.4, false);
  const BL = leg(-0.18, -0.38, true), BR = leg(0.18, -0.38, true);

  // whip tail
  const tail = joint(torso, 0, 0.1, -0.5);
  for (let i = 0; i < 6; i++) {
    rig.add(tail, cyl(0.035 - i * 0.004, 0.04 - i * 0.004, 0.16), skin, { pos: [0, 0.05 * i, -0.08 - 0.14 * i], rot: [-1.2 + i * 0.1, 0, 0] });
  }

  rig.finish();
  return {
    group: g, hips, torso, head, jaw, eyes,
    armL: FL.hip, armR: FR.hip, legL: BL.hip, legR: BR.hip,
    kneeL: BL.kn, kneeR: BR.kn, elbowL: FL.kn, elbowR: FR.kn
  };
}

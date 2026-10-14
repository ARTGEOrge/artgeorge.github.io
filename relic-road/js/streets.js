/**
 * Everything on a street that is not a building: lamps, street trees, park
 * trees, benches, bins, kerbs, lane lines and zebra crossings.
 *
 * All of it is placed from the real map. Lamps and trees stand along the real
 * carriageways at their real widths, crossings go where a real footway meets a
 * real road, parks are planted inside their real outlines. Each kind of thing
 * is one InstancedMesh (or one merged mesh), so a district with thousands of
 * lamps and trees still draws in a few dozen calls.
 *
 * Each city's `street` block in cities.js picks the lamp style, the trees, the
 * colour of the lines and which side of the road the traffic keeps to.
 */
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { walkLine, crossPoint } from './roads.js';
import { puffTexture } from './textures.js';
import { makeRng, TAU } from './util.js';

const CAPS = { lamps: 5200, trees: 9000, benches: 900, bins: 900, bushes: 6000, signals: 700, shelters: 160, bollards: 4000 };

/* ------------------------------------------------------------ geometry kit */
/** A primitive, coloured and moved into place, ready to merge. */
export function part(geo, hex, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], shade = 0) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  g.scale(...scale);
  g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]);
  g.translate(...pos);
  const c = new THREE.Color(hex);
  const p = g.attributes.position, cols = new Float32Array(p.count * 3);
  g.computeBoundingBox();
  const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
  for (let i = 0; i < p.count; i++) {
    // `shade` darkens toward the bottom: cheap ambient occlusion
    const k = shade ? 1 - shade * (1 - (p.getY(i) - y0) / (y1 - y0 || 1)) : 1;
    cols[i * 3] = c.r * k; cols[i * 3 + 1] = c.g * k; cols[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

export function merge(parts) {
  const g = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach(p => p.dispose());
  g.computeBoundingSphere();
  return g;
}

export const vcMaterial = (opts = {}) => new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.85, metalness: 0.05, ...opts
});

/** Lumpy blob for a tree crown: an icosahedron pushed about a little. */
function crown(r, seed) {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const p = g.attributes.position;
  const rng = makeRng(seed);
  const moved = new Map();
  for (let i = 0; i < p.count; i++) {
    // shared corners must move together or the crown tears open
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let f = moved.get(k);
    if (f == null) { f = 0.82 + rng() * 0.36; moved.set(k, f); }
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
  }
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ models */
const TRUNK = 0x5b4633;

/** Light the crown from above in its vertex colours: darker and cooler in the
 *  middle and underneath, sunlit on top, with a little leaf-to-leaf jitter. */
function dapple(g, seed) {
  const p = g.attributes.position, c = g.attributes.color, rng = makeRng(seed);
  g.computeBoundingBox();
  const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
  const cx = (g.boundingBox.min.x + g.boundingBox.max.x) / 2, cz = (g.boundingBox.min.z + g.boundingBox.max.z) / 2;
  const R = Math.max(g.boundingBox.max.x - cx, g.boundingBox.max.z - cz) || 1;
  for (let i = 0; i < p.count; i++) {
    const up = (p.getY(i) - y0) / (y1 - y0 || 1);
    const out = Math.min(1, Math.hypot(p.getX(i) - cx, p.getZ(i) - cz) / R);
    const k = (0.62 + up * 0.42 + out * 0.16) * (0.9 + rng() * 0.2);
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k * (1.0 + (rng() - 0.5) * 0.06), c.getZ(i) * k * 0.97);
  }
  return g;
}

/** One palm frond: an arching ribbon folded down its midrib, tapering to a point. */
function frond(len, width, droop, seg = 6) {
  const pos = [];
  const pt = t => [len * t, len * (0.42 * t - droop * t * t)];
  const w = t => width * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95));
  for (let i = 0; i < seg; i++) {
    const t0 = i / seg, t1 = (i + 1) / seg;
    const [x0, y0] = pt(t0), [x1, y1] = pt(t1);
    const w0 = w(t0), w1 = w(t1), f0 = w0 * 0.35, f1 = w1 * 0.35;
    // two strips, each side of the midrib, folded down like a V
    for (const s of [-1, 1]) {
      pos.push(x0, y0, 0, x1, y1, 0, x1, y1 - f1, s * w1);
      pos.push(x0, y0, 0, x1, y1 - f1, s * w1, x0, y0 - f0, s * w0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Trunk and crown kept apart, so the crown alone takes the city's colours.
 * Each kind comes as a close-up model and a far one: the city swaps between
 * them tile by tile as you walk (see `Tiles` below).
 */
function treeModel(kind) {
  if (kind === 'palm') {
    const trunk = [];
    for (let k = 0; k < 8; k++) {    // the ringed trunk, fattest at the foot, leaning a touch
      const r0 = 0.25 - k * 0.012, r1 = r0 - 0.012;
      trunk.push(part(new THREE.CylinderGeometry(r1, r0 + 0.02, 1.05, 8), k % 2 ? 0x7a6448 : 0x6a563c,
        [k * 0.035, 0.52 + k * 1.03, 0]));
    }
    // the old frond bases, a shaggy collar under the crown
    trunk.push(part(new THREE.CylinderGeometry(0.34, 0.2, 0.7, 8), 0x6e5a3a, [0.28, 8.0, 0]));
    const fronds = [];
    for (let k = 0; k < 13; k++) {
      const a = (k / 13) * TAU + (k % 3) * 0.17;
      const up = k % 3 === 0 ? 0.25 : k % 3 === 1 ? -0.05 : -0.3;
      fronds.push(part(frond(3.6 + (k % 4) * 0.3, 0.42, 0.95 + (k % 3) * 0.2).rotateZ(up), 0xffffff,
        [0.28, 8.35, 0], [0, a, 0]));
    }
    // two dead fronds hanging down, the way real palms carry them
    for (let k = 0; k < 2; k++) {
      fronds.push(part(frond(2.6, 0.3, 1.9).rotateZ(-0.9), 0xb59a62, [0.28, 8.1, 0], [0, k * 2.6 + 0.8, 0]));
    }
    fronds.push(part(new THREE.SphereGeometry(0.34, 8, 6), 0xc8a24a, [0.42, 8.05, 0.12], [0, 0, 0], [1, 1.3, 1]));
    fronds.push(part(new THREE.SphereGeometry(0.3, 8, 6), 0xb08a3a, [0.12, 8.0, -0.2], [0, 0, 0], [1, 1.3, 1]));
    const crown = dapple(merge(fronds), 11);
    const trunkLo = merge([part(new THREE.CylinderGeometry(0.15, 0.25, 8.4, 5, 1, true), 0x705a40, [0.14, 4.2, 0])]);
    const lo = [];
    for (let k = 0; k < 6; k++) {
      const f = new THREE.BoxGeometry(3.4, 0.05, 0.7);
      f.translate(1.7, 0, 0).rotateZ(-0.45);
      lo.push(part(f, 0xffffff, [0.28, 8.3, 0], [0, (k / 6) * TAU, 0]));
    }
    return { trunk: merge(trunk), crown, trunkLo, crownLo: dapple(merge(lo), 12), shadow: 2.4 };
  }
  if (kind === 'pine') {
    // a stone pine: a bare leaning trunk that forks, and a flat parasol of foliage
    const trunk = [
      part(new THREE.CylinderGeometry(0.17, 0.27, 5.0, 8), TRUNK, [0, 2.5, 0], [0, 0, 0.06], [1, 1, 1], 0.3),
      part(new THREE.CylinderGeometry(0.1, 0.16, 2.6, 6), TRUNK, [0.55, 5.9, 0.2], [0.15, 0, -0.45]),
      part(new THREE.CylinderGeometry(0.09, 0.15, 2.4, 6), TRUNK, [-0.45, 5.8, -0.25], [-0.2, 0, 0.5]),
      part(new THREE.CylinderGeometry(0.07, 0.11, 2.0, 6), TRUNK, [0.1, 6.0, -0.6], [-0.5, 0, 0])
    ];
    const blobs = [
      [0.2, 7.1, 0, 3.5, 0.95, 3.3], [1.6, 6.8, 0.6, 2.2, 0.8, 2.0], [-1.5, 6.9, -0.7, 2.3, 0.85, 2.1],
      [0.4, 7.0, -1.7, 2.0, 0.7, 1.8], [-0.3, 7.5, 1.2, 1.9, 0.7, 1.8]
    ];
    const crowns = blobs.map(([x, y, z, sx, sy, sz], k) =>
      part(crown(1, 71 + k), 0xffffff, [x, y, z], [0, 0, 0], [sx, sy, sz], 0.45));
    const trunkLo = merge([part(new THREE.CylinderGeometry(0.15, 0.25, 6.4, 5, 1, true), TRUNK, [0, 3.2, 0])]);
    const crownLo = merge([part(new THREE.IcosahedronGeometry(1, 0), 0xffffff, [0.2, 7.0, 0], [0, 0, 0], [3.8, 1.1, 3.6], 0.45)]);
    return { trunk: merge(trunk), crown: dapple(merge(crowns), 21), trunkLo, crownLo: dapple(crownLo, 22), shadow: 3.4 };
  }
  // broadleaf: lindens, planes, maples; a forked trunk under a cluster of lobes
  const trunk = [
    part(new THREE.CylinderGeometry(0.15, 0.27, 3.4, 8), TRUNK, [0, 1.7, 0], [0, 0, 0], [1, 1, 1], 0.3),
    part(new THREE.CylinderGeometry(0.06, 0.12, 2.2, 6), TRUNK, [0.55, 3.9, 0.1], [0.1, 0, -0.55]),
    part(new THREE.CylinderGeometry(0.06, 0.11, 2.0, 6), TRUNK, [-0.45, 3.9, -0.3], [-0.3, 0, 0.45]),
    part(new THREE.CylinderGeometry(0.05, 0.1, 1.8, 6), TRUNK, [0.05, 4.2, 0.5], [0.5, 0, 0])
  ];
  const lobes = [
    [0, 4.9, 0, 2.5, 2.3, 2.5], [1.1, 5.7, 0.5, 1.7, 1.6, 1.7], [-1.0, 5.4, -0.6, 1.7, 1.5, 1.6],
    [0.3, 6.4, -0.4, 1.6, 1.4, 1.5], [-0.5, 5.1, 1.2, 1.5, 1.4, 1.4], [1.2, 4.6, -1.0, 1.4, 1.2, 1.3]
  ];
  const crowns = lobes.map(([x, y, z, sx, sy, sz], k) =>
    part(crown(1, 61 + k), 0xffffff, [x, y, z], [0, 0, 0], [sx, sy, sz], 0.4));
  const trunkLo = merge([part(new THREE.CylinderGeometry(0.15, 0.25, 3.8, 5, 1, true), TRUNK, [0, 1.9, 0])]);
  const crownLo = merge([part(new THREE.IcosahedronGeometry(1, 0), 0xffffff, [0, 5.2, 0], [0, 0.4, 0], [2.9, 2.5, 2.9], 0.4)]);
  return { trunk: merge(trunk), crown: dapple(merge(crowns), 31), trunkLo, crownLo: dapple(crownLo, 32), shadow: 2.9 };
}

/** A low shrub for parks and verges: a few lumps, no trunk. */
function bushModel() {
  const g = [
    part(crown(1, 81), 0xffffff, [0, 0.55, 0], [0, 0, 0], [1.1, 0.75, 1.0], 0.5),
    part(crown(1, 82), 0xffffff, [0.7, 0.45, 0.3], [0, 0, 0], [0.8, 0.6, 0.75], 0.5),
    part(crown(1, 83), 0xffffff, [-0.6, 0.42, -0.35], [0, 0, 0], [0.75, 0.55, 0.7], 0.5)
  ];
  const lo = part(new THREE.IcosahedronGeometry(1, 0), 0xffffff, [0, 0.5, 0], [0, 0, 0], [1.4, 0.7, 1.2], 0.5);
  return { hi: dapple(merge(g), 41), lo: dapple(merge([lo]), 42) };
}

/**
 * A lamp is the post (lit by the scene) and the glass (which glows). The model
 * faces +x, toward the carriageway, so a mast's arm reaches over the road.
 * `bulb` is where the light sits.
 */
function lampModel(style) {
  if (style === 'mast') {
    const post = merge([
      part(new THREE.CylinderGeometry(0.08, 0.14, 8.2, 8), 0x70757a, [0, 4.1, 0]),
      part(new THREE.CylinderGeometry(0.2, 0.22, 0.6, 8), 0x5f6468, [0, 0.3, 0]),
      part(new THREE.BoxGeometry(1.9, 0.09, 0.09), 0x70757a, [0.95, 8.05, 0], [0, 0, 0.06]),
      part(new THREE.BoxGeometry(0.75, 0.15, 0.32), 0x4a4e52, [1.95, 8.1, 0])
    ]);
    const glass = merge([part(new THREE.BoxGeometry(0.62, 0.05, 0.24), 0xffffff, [1.95, 8.0, 0])]);
    return { post, glass, bulb: [1.95, 7.8, 0], reach: 26, glowSize: 2.6 };
  }
  if (style === 'lantern') {
    // a low post with a boxed paper lantern: the whole head glows
    const post = merge([
      part(new THREE.BoxGeometry(0.2, 2.6, 0.2), 0x8a857a, [0, 1.3, 0]),
      part(new THREE.BoxGeometry(0.46, 0.08, 0.46), 0x3a3632, [0, 2.6, 0]),
      part(new THREE.ConeGeometry(0.4, 0.26, 4), 0x2e2b28, [0, 3.29, 0], [0, Math.PI / 4, 0]),
      part(new THREE.BoxGeometry(0.46, 0.06, 0.46), 0x3a3632, [0, 3.14, 0])
    ]);
    const glass = merge([part(new THREE.BoxGeometry(0.38, 0.46, 0.38), 0xffffff, [0, 2.87, 0])]);
    return { post, glass, bulb: [0, 2.87, 0], reach: 16, glowSize: 1.9 };
  }
  // 'post': a cast-iron column with a four-sided lantern on top
  const post = merge([
    part(new THREE.CylinderGeometry(0.2, 0.26, 0.55, 8), 0x23282a, [0, 0.27, 0]),
    part(new THREE.CylinderGeometry(0.06, 0.1, 4.3, 8), 0x23282a, [0, 2.7, 0]),
    part(new THREE.CylinderGeometry(0.13, 0.08, 0.2, 8), 0x23282a, [0, 4.85, 0]),
    part(new THREE.ConeGeometry(0.34, 0.3, 4), 0x1c2022, [0, 5.62, 0], [0, Math.PI / 4, 0]),
    part(new THREE.CylinderGeometry(0.06, 0.06, 0.18, 6), 0x1c2022, [0, 5.84, 0])
  ]);
  const glass = merge([part(new THREE.CylinderGeometry(0.26, 0.17, 0.55, 4), 0xffffff, [0, 5.2, 0], [0, Math.PI / 4, 0])]);
  return { post, glass, bulb: [0, 5.2, 0], reach: 22, glowSize: 2.2 };
}

function benchModel() {
  const wood = 0x8a6a46, iron = 0x2a2d30;
  const g = [];
  for (let k = 0; k < 3; k++) g.push(part(new THREE.BoxGeometry(0.13, 0.05, 1.8), wood, [-0.05 + k * 0.15, 0.45, 0]));
  for (let k = 0; k < 2; k++) g.push(part(new THREE.BoxGeometry(0.05, 0.13, 1.8), wood, [-0.2, 0.62 + k * 0.17, 0], [0, 0, -0.18]));
  for (const z of [-0.75, 0.75]) {
    g.push(part(new THREE.BoxGeometry(0.46, 0.06, 0.06), iron, [0.05, 0.42, z]));
    g.push(part(new THREE.BoxGeometry(0.06, 0.44, 0.06), iron, [0.22, 0.21, z]));
    g.push(part(new THREE.BoxGeometry(0.06, 0.9, 0.06), iron, [-0.18, 0.45, z], [0, 0, -0.12]));
  }
  return merge(g);
}

function binModel() {
  return merge([
    part(new THREE.CylinderGeometry(0.25, 0.22, 0.8, 10, 1, true), 0x3d4a3f, [0, 0.5, 0]),
    part(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 10), 0x2a302b, [0, 0.93, 0]),
    part(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), 0x2a302b, [0, 0.25, 0])
  ]);
}

/** A traffic signal: a post with a three-lens head facing +x. */
function signalModel() {
  const iron = 0x2c3034, head = 0x1d2023;
  return {
    post: merge([
      part(new THREE.CylinderGeometry(0.07, 0.09, 3.6, 8), iron, [0, 1.8, 0]),
      part(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 8), iron, [0, 0.1, 0]),
      part(new THREE.BoxGeometry(0.3, 0.98, 0.34), head, [0.08, 3.04, 0]),
      // hoods over each lens, the lenses themselves, and the backboard
      ...[3.32, 3.04, 2.76].map(y => part(new THREE.BoxGeometry(0.16, 0.04, 0.26), head, [0.31, y + 0.13, 0])),
      ...[3.32, 3.04, 2.76].map(y => part(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 10), 0x3a3d40, [0.235, y, 0], [0, 0, Math.PI / 2])),
      part(new THREE.BoxGeometry(0.03, 1.2, 0.56), 0x111315, [-0.08, 3.04, 0]),
      // a push-button box for pedestrians
      part(new THREE.BoxGeometry(0.14, 0.24, 0.12), 0xd8c23a, [0.08, 1.1, 0])
    ])
  };
}

/** A bus shelter, open toward +x: frame, back glass, roof, a bench and an advert panel. */
function shelterModel() {
  const steel = 0x5a6066, dark = 0x2a2e33;
  const frame = merge([
    part(new THREE.BoxGeometry(1.7, 0.1, 3.6), dark, [-0.05, 2.45, 0]),
    part(new THREE.BoxGeometry(1.75, 0.04, 3.65), 0x9aa3aa, [-0.05, 2.52, 0]),
    ...[-1.7, 1.7].flatMap(z => [part(new THREE.BoxGeometry(0.08, 2.4, 0.08), steel, [-0.75, 1.2, z]),
                                 part(new THREE.BoxGeometry(0.08, 2.4, 0.08), steel, [0.65, 1.2, z])]),
    part(new THREE.BoxGeometry(0.08, 0.08, 3.4), steel, [-0.75, 2.3, 0]),
    part(new THREE.BoxGeometry(0.08, 0.08, 3.4), steel, [-0.75, 0.25, 0]),
    // bench along the back
    part(new THREE.BoxGeometry(0.4, 0.06, 2.2), 0x8a6a46, [-0.45, 0.48, 0]),
    part(new THREE.BoxGeometry(0.06, 0.46, 0.06), steel, [-0.45, 0.24, -0.9]),
    part(new THREE.BoxGeometry(0.06, 0.46, 0.06), steel, [-0.45, 0.24, 0.9]),
    // the advert case at one end, and the route sign on top of a post
    part(new THREE.BoxGeometry(1.25, 1.9, 0.14), dark, [-0.05, 1.25, 1.72]),
    part(new THREE.CylinderGeometry(0.04, 0.04, 2.9, 6), steel, [0.75, 1.45, -1.9]),
    part(new THREE.BoxGeometry(0.06, 0.5, 0.5), 0x2a6a3a, [0.75, 2.75, -1.9])
  ]);
  const glass = merge([
    part(new THREE.BoxGeometry(0.03, 2.0, 3.3), 0xffffff, [-0.75, 1.3, 0]),
    part(new THREE.BoxGeometry(1.3, 2.0, 0.03), 0xffffff, [-0.08, 1.3, -1.7])
  ]);
  // the poster faces into the shelter and out of the end: one quad each side
  const ad = new THREE.PlaneGeometry(1.1, 1.7);
  const a1 = ad.clone().translate(0, 0, 0.075).translate(-0.05, 1.25, 1.72);
  const a2 = ad.clone().rotateY(Math.PI).translate(0, 0, -0.075).translate(-0.05, 1.25, 1.72);
  const adGeo = BufferGeometryUtils.mergeGeometries([a1, a2], false);
  return { frame, glass, ad: adGeo };
}

function bollardModel(hex) {
  return merge([
    part(new THREE.CylinderGeometry(0.09, 0.11, 0.85, 10), hex, [0, 0.425, 0], [0, 0, 0], [1, 1, 1], 0.25),
    part(new THREE.SphereGeometry(0.09, 10, 6, 0, TAU, 0, Math.PI / 2), hex, [0, 0.85, 0]),
    part(new THREE.CylinderGeometry(0.112, 0.112, 0.06, 10), 0xd8d4c8, [0, 0.7, 0])
  ]);
}

/** Round iron cover, rimmed, with a cast grid pattern. */
function coverModel() {
  const g = [part(new THREE.CircleGeometry(0.42, 16).rotateX(-Math.PI / 2), 0x2a2a2a, [0, 0, 0]),
             part(new THREE.RingGeometry(0.42, 0.5, 16).rotateX(-Math.PI / 2), 0x55524e, [0, 0, 0])];
  for (let k = -2; k <= 2; k++) {
    g.push(part(new THREE.PlaneGeometry(0.62, 0.03).rotateX(-Math.PI / 2), 0x46443f, [0, 0.002, k * 0.12]));
    g.push(part(new THREE.PlaneGeometry(0.03, 0.62).rotateX(-Math.PI / 2), 0x46443f, [k * 0.12, 0.002, 0]));
  }
  return merge(g);
}

/** A square iron grate round a street tree's foot. */
function grateModel() {
  const g = [part(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), 0x2b2925, [0, 0, 0])];
  for (let k = 0; k < 4; k++) {
    const r = 0.25 + k * 0.15;
    g.push(part(new THREE.RingGeometry(r, r + 0.035, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2), 0x4a463e, [0, 0.002, 0]));
  }
  return merge(g);
}

/** A made-up advert: a colour field, a big shape and a strap line of blocks. */
let poster = null;
function posterTexture() {
  if (poster) return poster;
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 192;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 192);
  g.addColorStop(0, '#f2b33d'); g.addColorStop(1, '#d2542e');
  c.fillStyle = g; c.fillRect(0, 0, 128, 192);
  c.fillStyle = 'rgba(255,255,255,.9)';
  c.beginPath(); c.arc(64, 78, 38, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#2a1d3a';
  c.beginPath(); c.arc(64, 78, 24, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff';
  c.fillRect(18, 136, 92, 10); c.fillRect(30, 154, 68, 6); c.fillRect(38, 166, 52, 6);
  poster = new THREE.CanvasTexture(cv);
  poster.colorSpace = THREE.SRGBColorSpace;
  return poster;
}

/* --------------------------------------------------------------- placement */
/** Keeps things from being planted on top of each other. */
class Spacer {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  ok(x, z, min) {
    const c = this.cell, ix = Math.floor(x / c), iz = Math.floor(z / c);
    for (let a = ix - 1; a <= ix + 1; a++) for (let b = iz - 1; b <= iz + 1; b++) {
      const list = this.map.get(a * 8192 + b);
      if (!list) continue;
      for (let k = 0; k < list.length; k += 2) {
        if (Math.hypot(list[k] - x, list[k + 1] - z) < min) return false;
      }
    }
    return true;
  }
  add(x, z) {
    const k = Math.floor(x / this.cell) * 8192 + Math.floor(z / this.cell);
    let list = this.map.get(k);
    if (!list) this.map.set(k, (list = []));
    list.push(x, z);
  }
}

/**
 * The real building outlines, for placing things. Building collision uses each
 * footprint's bounding box, which for a building set at an angle covers much of
 * the pavement beside it; lamps and trees go by the outline itself.
 */
class Footprints {
  constructor(data) {
    this.cell = 32;
    this.map = new Map();
    this.polys = [];
    for (const rec of data.buildings) {
      const flat = rec[2];
      const p = new Float32Array(flat.length);
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < flat.length; i += 2) {
        p[i] = flat[i] / 10; p[i + 1] = flat[i + 1] / 10;
        x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); z0 = Math.min(z0, p[i + 1]); z1 = Math.max(z1, p[i + 1]);
      }
      const poly = { p, x0, x1, z0, z1 };
      this.polys.push(poly);
      for (let a = Math.floor(x0 / this.cell); a <= Math.floor(x1 / this.cell); a++) {
        for (let b = Math.floor(z0 / this.cell); b <= Math.floor(z1 / this.cell); b++) {
          const k = a * 8192 + b;
          let l = this.map.get(k);
          if (!l) this.map.set(k, (l = []));
          l.push(poly);
        }
      }
    }
  }

  /** True when (x, z) is inside a building, or within r of its wall. */
  hit(x, z, r) {
    const l = this.map.get(Math.floor(x / this.cell) * 8192 + Math.floor(z / this.cell));
    if (!l) return false;
    for (const q of l) {
      if (x < q.x0 - r || x > q.x1 + r || z < q.z0 - r || z > q.z1 + r) continue;
      if (inPolygon(x, z, q.p)) return true;
      const p = q.p, n = p.length / 2;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = p[i * 2], az = p[i * 2 + 1], dx = p[j * 2] - ax, dz = p[j * 2 + 1] - az;
        const L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
        if (Math.hypot(x - ax - dx * t, z - az - dz * t) < r) return true;
      }
    }
    return false;
  }
}

/** True when a building, or something already placed (a lamp, a tree), is at (x, z). */
function blocked(world, feet, x, z, r) {
  if (feet.hit(x, z, r)) return true;
  const list = world.near(x, z, r + 0.5);
  for (const c of list) {
    if (c.tag === 'ground' || c.tag === 'building' || c.max.y < 0.4) continue;
    if (x > c.min.x - r && x < c.max.x + r && z > c.min.z - r && z < c.max.z + r) return true;
  }
  return false;
}

function inPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], zi = poly[i + 1], xj = poly[j], zj = poly[j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

const dummy = new THREE.Object3D();

function instanced(geo, mat, items, colours = null) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  mesh.count = items.length;
  const c = new THREE.Color();
  items.forEach((it, i) => {
    dummy.position.set(it.x, it.y || 0, it.z);
    dummy.rotation.set(it.tilt || 0, it.yaw || 0, 0, 'YXZ');
    dummy.scale.setScalar(it.s || 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (colours) mesh.setColorAt(i, c.setHex(it.colour));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/**
 * Level of detail for things there are thousands of (trees, shrubs). Every
 * item has a close-up model and a far one. The district is cut into cells;
 * items in the cells round the viewer are drawn with the close-up model, the
 * rest with the far one. Each model is a single InstancedMesh whose instance
 * list is refilled only when the viewer moves into a different cell, so the
 * whole forest stays a handful of draw calls.
 *
 * parts: [{ hi, lo, mat, colours, shadow }] drawn for every item (trunk, crown…)
 */
export class LodSet {
  constructor(items, parts, keep, cell = 60) {
    this.cell = cell;
    this.items = items;
    this.n = items.length;
    this.mats = new Float32Array(this.n * 16);
    this.cols = new Float32Array(this.n * 3);
    const c = new THREE.Color();
    items.forEach((it, i) => {
      dummy.position.set(it.x, it.y || 0, it.z);
      dummy.rotation.set(it.tilt || 0, it.yaw || 0, 0, 'YXZ');
      dummy.scale.setScalar(it.s || 1);
      dummy.updateMatrix();
      dummy.matrix.toArray(this.mats, i * 16);
      c.setHex(it.colour == null ? 0xffffff : it.colour);
      this.cols[i * 3] = c.r; this.cols[i * 3 + 1] = c.g; this.cols[i * 3 + 2] = c.b;
    });
    this.byCell = new Map();
    items.forEach((it, i) => {
      const k = this.key(Math.floor(it.x / cell), Math.floor(it.z / cell));
      let l = this.byCell.get(k);
      if (!l) this.byCell.set(k, (l = []));
      l.push(i);
    });
    this.parts = parts.map(p => {
      const mk = geo => {
        const m = new THREE.InstancedMesh(geo, p.mat, Math.max(1, this.n));
        m.count = 0;
        if (p.colours) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, this.n) * 3), 3);
        m.userData.castsShadow = !!p.shadow;
        return keep(m);
      };
      return { hi: mk(p.hi), lo: mk(p.lo || p.hi), colours: p.colours };
    });
    this.sig = '';
    this.isNear = new Uint8Array(this.n);
  }

  key(ix, iz) { return (ix + 4096) * 8192 + (iz + 4096); }

  /** Re-sort items between the close-up and far meshes when the viewer changes cell. */
  update(x, z, near) {
    const c = this.cell, r = Math.ceil(near / c);
    const ix = Math.floor(x / c), iz = Math.floor(z / c);
    const sig = ix + ',' + iz + ',' + r;
    if (sig === this.sig) return false;
    this.sig = sig;
    this.isNear.fill(0);
    for (let a = -r; a <= r; a++) {
      for (let b = -r; b <= r; b++) {
        if ((a * a + b * b) * c * c > (near + c) * (near + c)) continue;
        const l = this.byCell.get(this.key(ix + a, iz + b));
        if (l) for (const i of l) this.isNear[i] = 1;
      }
    }
    for (const p of this.parts) {
      let h = 0, f = 0;
      const H = p.hi.instanceMatrix.array, L = p.lo.instanceMatrix.array;
      const HC = p.hi.instanceColor?.array, LC = p.lo.instanceColor?.array;
      for (let i = 0; i < this.n; i++) {
        const m = this.mats.subarray(i * 16, i * 16 + 16), col = this.cols.subarray(i * 3, i * 3 + 3);
        if (this.isNear[i]) { H.set(m, h * 16); if (HC) HC.set(col, h * 3); h++; }
        else { L.set(m, f * 16); if (LC) LC.set(col, f * 3); f++; }
      }
      p.hi.count = h; p.lo.count = f;
      p.hi.instanceMatrix.needsUpdate = p.lo.instanceMatrix.needsUpdate = true;
      if (HC) p.hi.instanceColor.needsUpdate = true;
      if (LC) p.lo.instanceColor.needsUpdate = true;
      p.hi.computeBoundingSphere(); p.lo.computeBoundingSphere();
      p.hi.visible = h > 0; p.lo.visible = f > 0;
    }
    return true;
  }
}

/* ------------------------------------------------------------- the builder */
export function buildStreets(world, data, roads, city) {
  const st = city.street || {};
  const look = city.look || {};
  const rng = makeRng(city.id.length * 1297 + city.id.charCodeAt(0) * 31);
  const scene = world.scene;
  const out = { meshes: [], lights: [], night: 0 };
  const keep = m => { scene.add(m); world.meshes.push(m); out.meshes.push(m); return m; };

  const drivable = roads.driveWays.filter(w => w.w >= 5.5);
  const feet = new Footprints(data);
  // inside some other carriageway? (big roads are mapped as two, side by side,
  // so a lamp's own road does not count against it)
  const onCarriageway = (x, z, margin, self = null) =>
    roads.edgeDist(x, z, 12, w => w.drive && w !== self) < margin;

  /* ---- lamps: along both kerbs of every real carriageway, staggered ---- */
  const lampSpace = new Spacer(12);
  const lamps = [];
  const every = st.lamp === 'mast' ? 34 : st.lamp === 'lantern' ? 22 : 27;
  for (const way of drivable) {
    if (lamps.length >= CAPS.lamps) break;
    const off = way.w / 2 + 0.55;
    walkLine(way, every, 6 + (way.id % 5) * 2, (x, z, dx, dz, s) => {
      // alternate the side each time, so the two kerbs are lit in turn
      const side = (Math.round(s / every) % 2) ? 1 : -1;
      const nx = -dz * side, nz = dx * side;
      const px = x + nx * off, pz = z + nz * off;
      if (!lampSpace.ok(px, pz, every * 0.55)) return;
      if (blocked(world, feet, px, pz, 0.4) || onCarriageway(px, pz, 0, way)) return;
      lampSpace.add(px, pz);
      // the model's +x faces the road
      lamps.push({ x: px, z: pz, yaw: Math.atan2(nz, -nx) });
    });
  }
  const lm = lampModel(st.lamp || 'post');
  const lampColour = new THREE.Color(st.lampColour || 0xffcf96);
  out.lampMesh = keep(instanced(lm.post, vcMaterial({ roughness: 0.6, metalness: 0.4 }), lamps));
  out.glassMat = new THREE.MeshBasicMaterial({ color: 0x3a3a3a, toneMapped: false });
  out.glassMesh = keep(instanced(lm.glass, out.glassMat, lamps));
  out.lampColour = lampColour;

  // at night each lamp throws a soft halo; a Points cloud faces the camera for free
  const haloPos = new Float32Array(lamps.length * 3);
  lamps.forEach((l, i) => {
    const c = Math.cos(l.yaw), s = Math.sin(l.yaw);
    const [bx, by, bz] = lm.bulb;
    const wx = l.x + bx * c + bz * s, wz = l.z - bx * s + bz * c;
    haloPos[i * 3] = wx; haloPos[i * 3 + 1] = by; haloPos[i * 3 + 2] = wz;
    world.collider(l.x, 2, l.z, 0.3, 4, 0.3, 0, 'lamp');
    // a virtual light each; the world backs only the nearest few with real ones
    out.lights.push(world.light(lampColour.getHex(), 0, wx, by - 0.4, wz, lm.reach, 1.4));
  });
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
  out.haloMat = new THREE.PointsMaterial({
    map: puffTexture('rgba(255,230,190,1)', 'rgba(255,200,120,0)'), color: lampColour,
    size: lm.glowSize, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true
  });
  keep(new THREE.Points(haloGeo, out.haloMat));
  out.lampCount = lamps.length;

  /* ---- street trees: between the kerb and the pavement, not over a lamp ---- */
  const treeSpace = new Spacer(10);
  const pickKind = () => {
    let r = rng(), acc = 0;
    for (const [k, p] of st.trees || [['broad', 1]]) { acc += p; if (r <= acc) return k; }
    return (st.trees || [['broad']])[0][0];
  };
  // one palette for every tree, or one per kind (Kyoto's maples turn; its pines do not)
  const canopy = st.canopy || [0x5f8a3c];
  const crownOf = kind => Array.isArray(canopy) ? canopy : (canopy[kind] || canopy.broad || [0x5f8a3c]);
  const trees = { broad: [], pine: [], palm: [] };
  const grates = [];
  let treeTotal = 0;
  const plant = (x, z, min, street = false) => {
    if (treeTotal >= CAPS.trees) return false;
    if (!treeSpace.ok(x, z, min) || !lampSpace.ok(x, z, 3)) return false;
    if (blocked(world, feet, x, z, 1.0)) return false;
    const kind = pickKind();
    if (street) grates.push({ x, z, y: 0.062, yaw: rng() < 0.5 ? 0 : Math.PI / 4 });
    trees[kind].push({ x, z, yaw: rng() * TAU, s: 0.8 + rng() * 0.45, colour: rng.pick(crownOf(kind)),
                       tilt: kind === 'palm' ? (rng() - 0.5) * 0.12 : 0 });
    treeSpace.add(x, z);
    treeTotal++;
    return true;
  };
  const leafy = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street']);
  for (const way of drivable) {
    if (!leafy.has(way.cls)) continue;
    const off = way.w / 2 + 1.5;
    const gap = way.cls === 'residential' ? 13 : 15;
    walkLine(way, gap, 4, (x, z, dx, dz) => {
      for (const side of [-1, 1]) {
        if (rng() > 0.72) continue;
        const px = x - dz * side * off, pz = z + dx * side * off;
        if (onCarriageway(px, pz, 0.3, way)) continue;
        plant(px, pz, 7, true);
      }
    });
  }

  /* ---- park trees: inside each park's real outline, clear of its paths ---- */
  for (const flat of data.green) {
    if (treeTotal >= CAPS.trees) break;
    const poly = new Float32Array(flat.length);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < flat.length; i += 2) {
      poly[i] = flat[i] / 10; poly[i + 1] = flat[i + 1] / 10;
      x0 = Math.min(x0, poly[i]); x1 = Math.max(x1, poly[i]);
      z0 = Math.min(z0, poly[i + 1]); z1 = Math.max(z1, poly[i + 1]);
    }
    const area = (x1 - x0) * (z1 - z0);
    if (area < 150) continue;
    const want = Math.min(420, Math.floor(area / 240));
    for (let k = 0, tries = 0; k < want && tries < want * 4; tries++) {
      const x = x0 + rng() * (x1 - x0), z = z0 + rng() * (z1 - z0);
      if (!inPolygon(x, z, poly)) continue;
      if (roads.edgeDist(x, z, 8) < 1.6) continue;       // keep the paths walkable
      if (plant(x, z, 6)) k++;
    }
  }

  /* ---- shrubs: in clumps through the parks, and the odd one by a park path ---- */
  const bushes = [];
  const bushSpace = new Spacer(6);
  for (const flat of data.green) {
    if (bushes.length >= CAPS.bushes) break;
    const poly = new Float32Array(flat.length);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < flat.length; i += 2) {
      poly[i] = flat[i] / 10; poly[i + 1] = flat[i + 1] / 10;
      x0 = Math.min(x0, poly[i]); x1 = Math.max(x1, poly[i]);
      z0 = Math.min(z0, poly[i + 1]); z1 = Math.max(z1, poly[i + 1]);
    }
    const area = (x1 - x0) * (z1 - z0);
    if (area < 80) continue;
    const want = Math.min(260, Math.floor(area / 160));
    for (let k = 0, tries = 0; k < want && tries < want * 4; tries++) {
      const x = x0 + rng() * (x1 - x0), z = z0 + rng() * (z1 - z0);
      if (!inPolygon(x, z, poly) || roads.edgeDist(x, z, 6) < 1.2) continue;
      if (!bushSpace.ok(x, z, 2.2) || !treeSpace.ok(x, z, 2.4) || feet.hit(x, z, 1)) continue;
      bushSpace.add(x, z);
      const kind = pickKind();
      const pal = crownOf(kind === 'palm' ? 'broad' : kind);
      bushes.push({ x, z, yaw: rng() * TAU, s: 0.7 + rng() * 0.7, colour: rng.pick(pal) });
      k++;
    }
  }

  const shadowItems = [];
  out.lods = [];
  out.casters = [];
  for (const kind of ['broad', 'pine', 'palm']) {
    const list = trees[kind];
    if (!list.length) continue;
    const model = treeModel(kind);
    out.lods.push(new LodSet(list, [
      { hi: model.trunk, lo: model.trunkLo, mat: vcMaterial({ roughness: 0.95 }), shadow: true },
      { hi: model.crown, lo: model.crownLo, mat: vcMaterial({ roughness: 0.9, side: THREE.DoubleSide }), colours: true, shadow: true }
    ], keep));
    for (const t of list) {
      shadowItems.push({ x: t.x, y: 0.075, z: t.z, s: model.shadow * t.s });
      world.collider(t.x, 1.5, t.z, 0.5, 3, 0.5, 0, 'tree');
    }
  }
  if (bushes.length) {
    const bm = bushModel();
    out.lods.push(new LodSet(bushes, [
      { hi: bm.hi, lo: bm.lo, mat: vcMaterial({ roughness: 0.92 }), colours: true, shadow: true }
    ], keep));
  }
  out.bushCount = bushes.length;
  // soft contact shadows under every crown (there is no shadow map here)
  const disc = new THREE.CircleGeometry(1, 20);
  disc.rotateX(-Math.PI / 2);
  out.shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false,
    map: puffTexture('rgba(0,0,0,1)', 'rgba(0,0,0,0)'), polygonOffset: true, polygonOffsetFactor: -3
  });
  if (shadowItems.length) keep(instanced(disc, out.shadowMat, shadowItems));
  out.treeCount = treeTotal;

  /* ---- benches and bins: on the squares, and along the park paths ---- */
  const benches = [], bins = [];
  const seatSpace = new Spacer(8);
  for (const way of roads.footWays) {
    if (benches.length >= CAPS.benches) break;
    const square = way.cls === 'pedestrian' && way.w >= 4;
    if (!square && way.cls !== 'footway' && way.cls !== 'path') continue;
    const gap = square ? 16 : 38;
    walkLine(way, gap, gap / 2, (x, z, dx, dz, s) => {
      const side = (Math.round(s / gap) % 2) ? 1 : -1;
      const off = square ? way.w / 2 - 0.7 : way.w / 2 + 0.9;
      const nx = -dz * side, nz = dx * side;
      const px = x + nx * off, pz = z + nz * off;
      if (!seatSpace.ok(px, pz, 6) || blocked(world, feet, px, pz, 0.9)) return;
      if (onCarriageway(px, pz, 1.2)) return;
      seatSpace.add(px, pz);
      // the seat faces the path: its +x points back toward the centreline
      const yaw = Math.atan2(nz, -nx);
      if (rng() < 0.7) {
        benches.push({ x: px, z: pz, yaw });
        world.collider(px, 0.45, pz, 0.6, 0.9, 1.8, yaw, 'bench');
      } else {
        bins.push({ x: px, z: pz, yaw });
        world.collider(px, 0.45, pz, 0.5, 0.9, 0.5, 0, 'bin');
      }
    });
  }
  // and a bin beside every few lamps
  lamps.forEach((l, i) => {
    if (i % 5 || bins.length >= CAPS.bins) return;
    const c = Math.cos(l.yaw), s = Math.sin(l.yaw);
    const px = l.x - s * 0.9, pz = l.z - c * 0.9;
    if (blocked(world, feet, px, pz, 0.35)) return;
    bins.push({ x: px, z: pz, yaw: l.yaw });
  });
  if (benches.length) keep(instanced(benchModel(), vcMaterial({ roughness: 0.8 }), benches));
  if (bins.length) keep(instanced(binModel(), vcMaterial({ roughness: 0.7, metalness: 0.3 }), bins));
  out.benchCount = benches.length;

  /* ---- kerbs and road paint ---- */
  const kerb = new Strips(), paint = new Strips();
  const line = st.line || 0xe9e4d6;
  const stone = new THREE.Color(look.pathTint || 0xb0a99c).multiplyScalar(1.12).getHex();
  for (const way of drivable) {
    // a raised kerb along both edges
    for (const side of [-1, 1]) {
      kerb.along(way, side * (way.w / 2 + 0.14), 0.28, 0.13, stone);
      kerb.face(way, side * way.w / 2, 0.03, 0.13, stone, side);
    }
    if (way.cls.endsWith('_link') || way.w < 7) continue;
    // centre line: dashed, and solid edge lines on the big roads
    walkLine(way, 9, 4, (x, z, dx, dz) => paint.quad(x, z, dx, dz, 3, 0.15, 0.047, line));
    if (way.w >= 10) {
      for (const side of [-1, 1]) paint.along(way, side * (way.w / 2 - 0.4), 0.13, 0.046, 0xe9e4d6);
    }
  }

  // zebra crossings, wherever a mapped footway crosses a mapped road
  const zebraSpace = new Spacer(8);
  const zebraList = [];
  let zebras = 0;
  for (const foot of roads.footWays) {
    if (foot.cls === 'corridor' || foot.cls === 'steps') continue;
    const p = foot.pts;
    for (let i = 0; i < foot.n - 1; i++) {
      const ax = p[i * 2], az = p[i * 2 + 1], bx = p[i * 2 + 2], bz = p[i * 2 + 3];
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, r = Math.hypot(bx - ax, bz - az) / 2 + 2;
      const hits = [];
      roads.near(mx, mz, r, (road, j) => {
        if (!road.drive || road.w < 6) return;
        const q = road.pts;
        const hit = crossPoint(ax, az, bx, bz, q[j * 2], q[j * 2 + 1], q[j * 2 + 2], q[j * 2 + 3]);
        if (!hit) return;
        const len = Math.hypot(q[j * 2 + 2] - q[j * 2], q[j * 2 + 3] - q[j * 2 + 1]) || 1;
        hits.push({ ...hit, dx: (q[j * 2 + 2] - q[j * 2]) / len, dz: (q[j * 2 + 3] - q[j * 2 + 1]) / len, w: road.w });
      });
      for (const h of hits) {
        if (!zebraSpace.ok(h.x, h.z, 7)) continue;
        zebraSpace.add(h.x, h.z);
        zebras++;
        zebraList.push(h);
        // a stop line across the carriageway a couple of metres back, both ways
        for (const sgn of [-1, 1]) {
          paint.quad(h.x + h.dx * sgn * 2.6, h.z + h.dz * sgn * 2.6, h.dx, h.dz, 0.4, h.w - 1.0, 0.064, 0xf1ede2);
        }
        // stripes run with the traffic and step across the road
        const nx = -h.dz, nz = h.dx, n = Math.floor((h.w - 0.8) / 1.0);
        for (let k = 0; k < n; k++) {
          const o = -((n - 1) / 2) + k;
          paint.quad(h.x + nx * o, h.z + nz * o, h.dx, h.dz, 3.0, 0.5, 0.063, 0xf1ede2);
        }
      }
    }
  }
  const markMat = vcMaterial({ roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  if (paint.count) keep(paint.mesh(markMat));
  if (kerb.count) keep(kerb.mesh(vcMaterial({ roughness: 0.9 })));
  out.zebras = zebras;

  /* ---- traffic signals at the bigger crossings, cycling green, amber, red ---- */
  const signals = [];
  const sigSpace = new Spacer(10);
  for (const h of zebraList) {
    if (h.w < 8 || signals.length >= CAPS.signals) continue;
    if (!sigSpace.ok(h.x, h.z, 18)) continue;
    sigSpace.add(h.x, h.z);
    const phase = rng() * 20;
    // one post on each kerb, just before the crossing for the traffic on that side
    for (const side of [-1, 1]) {
      const nx = -h.dz * side, nz = h.dx * side;
      const lane = st.drive === 'left' ? -side : side;
      const px = h.x + nx * (h.w / 2 + 0.55) - h.dx * lane * 3.4, pz = h.z + nz * (h.w / 2 + 0.55) - h.dz * lane * 3.4;
      if (blocked(world, feet, px, pz, 0.3)) continue;
      // the head looks back down the road at the cars that will stop for it
      const yaw = Math.atan2(h.dz * lane, -h.dx * lane);
      signals.push({ x: px, z: pz, yaw, phase });
      world.collider(px, 1.6, pz, 0.25, 3.2, 0.25, 0, 'signal');
    }
  }
  if (signals.length) {
    const sm = signalModel();
    keep(instanced(sm.post, vcMaterial({ roughness: 0.55, metalness: 0.45 }), signals)).userData.castsShadow = true;
    const lit = new THREE.InstancedMesh(new THREE.CircleGeometry(0.1, 10).rotateY(Math.PI / 2).translate(0.25, 0, 0),
      new THREE.MeshBasicMaterial({ toneMapped: false }), signals.length);
    lit.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(signals.length * 3), 3);
    keep(lit);
    const base = signals.map(s => {
      dummy.position.set(s.x, 0, s.z); dummy.rotation.set(0, s.yaw, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
      return dummy.matrix.clone();
    });
    const off = new THREE.Matrix4(), m = new THREE.Matrix4(), col = new THREE.Color();
    const LENS = [[3.32, 0xff2a1a], [3.04, 0xffa21a], [2.76, 0x3aff7a]];
    out.signalState = [];
    out.updateSignals = t => {
      for (let i = 0; i < signals.length; i++) {
        const c = (t + signals[i].phase) % 20;
        const state = c < 9 ? 2 : c < 11 ? 1 : 0;
        if (out.signalState[i] === state) continue;
        out.signalState[i] = state;
        off.makeTranslation(0, LENS[state][0], 0);
        lit.setMatrixAt(i, m.multiplyMatrices(base[i], off));
        lit.setColorAt(i, col.setHex(LENS[state][1]).multiplyScalar(1.4));
        lit.instanceMatrix.needsUpdate = true; lit.instanceColor.needsUpdate = true;
      }
    };
    out.updateSignals(0);
    lit.computeBoundingSphere();
  }
  out.signalCount = signals.length;

  /* ---- bus shelters along the main roads, their adverts lit at night ---- */
  const shelters = [];
  const shelterSpace = new Spacer(40);
  for (const way of drivable) {
    if (shelters.length >= CAPS.shelters) break;
    if (!['primary', 'secondary', 'tertiary', 'trunk'].includes(way.cls) || way.len < 120) continue;
    walkLine(way, 190, 60 + (way.id % 7) * 11, (x, z, dx, dz, s) => {
      const side = (way.id + Math.round(s)) % 2 ? 1 : -1;
      const nx = -dz * side, nz = dx * side, off = way.w / 2 + 1.7;
      const px = x + nx * off, pz = z + nz * off;
      if (!shelterSpace.ok(px, pz, 150) || blocked(world, feet, px, pz, 2.2)) return;
      if (onCarriageway(px, pz, 0.8, way) || !lampSpace.ok(px, pz, 3)) return;
      shelterSpace.add(px, pz);
      // the open side faces the road (+x in the model)
      const yaw = Math.atan2(nz, -nx);
      shelters.push({ x: px, z: pz, yaw });
      world.collider(px, 1.2, pz, 1.2, 2.4, 3.4, yaw, 'shelter');
    });
  }
  if (shelters.length) {
    const bm = shelterModel();
    keep(instanced(bm.frame, vcMaterial({ roughness: 0.5, metalness: 0.4 }), shelters)).userData.castsShadow = true;
    keep(instanced(bm.glass, new THREE.MeshStandardMaterial({ color: 0x9fc4d6, roughness: 0.08, metalness: 0.2,
      transparent: true, opacity: 0.32, depthWrite: false }), shelters));
    out.adMat = new THREE.MeshStandardMaterial({ map: posterTexture(), roughness: 0.4, emissive: 0xffffff,
      emissiveMap: posterTexture(), emissiveIntensity: 0.05 });
    keep(instanced(bm.ad, out.adMat, shelters));
  }
  out.shelterCount = shelters.length;

  /* ---- bollards where a pedestrian street or square opens onto traffic ---- */
  const bollards = [];
  for (const way of roads.footWays) {
    if (bollards.length >= CAPS.bollards) break;
    if (way.cls !== 'pedestrian' && !(way.cls === 'footway' && way.w >= 3)) continue;
    for (const end of [0, 1]) {
      const i = end ? way.n - 1 : 0, j = end ? way.n - 2 : 1;
      const ex = way.pts[i * 2], ez = way.pts[i * 2 + 1];
      if (roads.edgeDist(ex, ez, 8, w => w.drive) > 3.5) continue;
      let dx = ex - way.pts[j * 2], dz = ez - way.pts[j * 2 + 1];
      const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const w = Math.max(3, Math.min(way.w, 12));
      const n = Math.max(2, Math.round(w / 1.5));
      for (let k = 0; k < n; k++) {
        const o = (k / (n - 1) - 0.5) * (w - 0.6);
        const bx = ex - dx * 1.2 - dz * o, bz = ez - dz * 1.2 + dx * o;
        if (blocked(world, feet, bx, bz, 0.25) || onCarriageway(bx, bz, 0.2)) continue;
        bollards.push({ x: bx, z: bz, yaw: 0 });
      }
    }
  }
  if (bollards.length) {
    keep(instanced(bollardModel(st.bollard || 0x2b2f33), vcMaterial({ roughness: 0.5, metalness: 0.5 }), bollards));
    for (const b of bollards) world.collider(b.x, 0.45, b.z, 0.22, 0.9, 0.22, 0, 'bollard');
  }

  /* ---- manhole covers down the carriageways, and grates round street trees ---- */
  const covers = [];
  for (const way of drivable) {
    if (covers.length > 6000) break;
    walkLine(way, 47, 13 + (way.id % 9) * 3, (x, z, dx, dz, s) => {
      const lat = ((s * 0.37) % 1 - 0.5) * way.w * 0.5;
      covers.push({ x: x - dz * lat, y: 0.061, z: z + dx * lat, yaw: rng() * TAU });
    });
  }
  const decalMat = vcMaterial({ roughness: 0.6, metalness: 0.5, polygonOffset: true,
    polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  if (covers.length) keep(instanced(coverModel(), decalMat, covers));
  if (grates.length) keep(instanced(grateModel(), decalMat, grates));

  /** 0 = broad day, 1 = full night. Called every frame while it changes. */
  out.setNight = v => {
    out.night = v;
    const lit = Math.max(0, (v - 0.35) / 0.65);          // lamps come on at dusk
    out.glassMat.color.setRGB(0.23, 0.23, 0.23).lerp(new THREE.Color(lampColour).multiplyScalar(1.6), lit);
    out.haloMat.opacity = lit * 0.75;
    for (const l of out.lights) l.intensity = lit * 16;
    out.shadowMat.opacity = 0.26 * (1 - v * 0.65) * (out.sunShadows ? 0.55 : 1);
    if (out.adMat) out.adMat.emissiveIntensity = 0.08 + lit * 0.9;
  };
  out.setNight(0);

  /** Called every frame: swaps close-up and far trees as you move, runs the signals. */
  out.update = (camPos, near, t) => {
    for (const l of out.lods) l.update(camPos.x, camPos.z, near);
    out.updateSignals?.(t);
  };
  return out;
}

/* ---------------------------------------------------------------- strips */
/** Flat quads and ribbons with baked colours, gathered into one mesh. */
class Strips {
  constructor() { this.pos = []; this.nrm = []; this.col = []; this.count = 0; }

  tri(a, b, c, n, colour) {
    const cc = new THREE.Color(colour);
    for (const v of [a, b, c]) { this.pos.push(...v); this.nrm.push(...n); this.col.push(cc.r, cc.g, cc.b); }
    this.count++;
  }

  quadPts(a, b, c, d, n, colour) { this.tri(a, b, c, n, colour); this.tri(a, c, d, n, colour); }

  /** A flat quad centred on (x, z), `len` along (dx, dz), `wid` across. */
  quad(x, z, dx, dz, len, wid, y, colour) {
    const hx = dx * len / 2, hz = dz * len / 2, wx = -dz * wid / 2, wz = dx * wid / 2;
    this.quadPts([x - hx - wx, y, z - hz - wz], [x - hx + wx, y, z - hz + wz],
                 [x + hx + wx, y, z + hz + wz], [x + hx - wx, y, z + hz - wz], [0, 1, 0], colour);
  }

  /** Perpendicular at each vertex, averaged so bends join without gaps. */
  normals(way) {
    const p = way.pts, n = way.n, out = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let dx = p[b * 2] - p[a * 2], dz = p[b * 2 + 1] - p[a * 2 + 1];
      const L = Math.hypot(dx, dz) || 1;
      out[i * 2] = -dz / L; out[i * 2 + 1] = dx / L;
    }
    return out;
  }

  /** A flat ribbon running `off` metres to one side of the centreline. */
  along(way, off, wid, y, colour) {
    const p = way.pts, nr = this.normals(way);
    for (let i = 0; i < way.n - 1; i++) {
      const at = (k, o) => [p[k * 2] + nr[k * 2] * o, y, p[k * 2 + 1] + nr[k * 2 + 1] * o];
      const lo = off - wid / 2, hi = off + wid / 2;
      this.quadPts(at(i, lo), at(i, hi), at(i + 1, hi), at(i + 1, lo), [0, 1, 0], colour);
    }
  }

  /** The upright face of a kerb, looking in toward the carriageway. */
  face(way, off, y0, y1, colour, side) {
    const p = way.pts, nr = this.normals(way);
    for (let i = 0; i < way.n - 1; i++) {
      const bx = (k, y) => [p[k * 2] + nr[k * 2] * off, y, p[k * 2 + 1] + nr[k * 2 + 1] * off];
      const n = [-nr[i * 2] * side, 0, -nr[i * 2 + 1] * side];
      const c = new THREE.Color(colour).multiplyScalar(0.82).getHex();
      // wind it so the front face is the one looking at the road
      if (side < 0) this.quadPts(bx(i, y0), bx(i + 1, y0), bx(i + 1, y1), bx(i, y1), n, c);
      else this.quadPts(bx(i, y0), bx(i, y1), bx(i + 1, y1), bx(i + 1, y0), n, c);
    }
  }

  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    return m;
  }
}

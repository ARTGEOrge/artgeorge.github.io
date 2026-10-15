/* A modern open-wheel Formula car built from primitives: long drooping nose,
 * two-element front wing with endplates, survival cell, halo, airbox, sidepods
 * that taper into a coke-bottle rear, engine-cover fin, beam wing, DRS rear
 * wing, floor and diffuser, exposed suspension and slick tyres.
 * Everything except the DRS flap, decals and wheels is merged into one
 * vertex-coloured mesh, so a car costs very few draw calls.
 * Origin: centre between the axles on the ground, +z forward, +x left. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';

export const WHEELS = [
  { x: 0.80, z: 1.78, r: 0.36, w: 0.36, front: true },
  { x: -0.80, z: 1.78, r: 0.36, w: 0.36, front: true },
  { x: 0.78, z: -1.80, r: 0.37, w: 0.44, front: false },
  { x: -0.78, z: -1.80, r: 0.37, w: 0.44, front: false }
];

const CARBON = '#141418';
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();

function finish(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  e.set(rx, ry, rz); q.setFromEuler(e); m4.compose(v3.set(x, y, z), q, sc.set(sx, sy, sz));
  geo.applyMatrix4(m4);
  let g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  if (!g.attributes.normal) g.computeVertexNormals();
  const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/* A rounded box running along z from zr (rear) to zf (front) whose width,
 * height and centre height interpolate between the two ends. */
function pod(zr, zf, rear, front, round = 0.3, segs = 2) {
  const len = zf - zr;
  const g = new RoundedBoxGeometry(1, 1, len, segs, Math.min(0.49, round));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), t = (z + len / 2) / len;
    const w = rear.w + (front.w - rear.w) * t, h = rear.h + (front.h - rear.h) * t;
    const y = rear.y + (front.y - rear.y) * t, x = (rear.x || 0) + ((front.x || 0) - (rear.x || 0)) * t;
    p.setX(i, p.getX(i) * w + x); p.setY(i, p.getY(i) * h + y); p.setZ(i, z + zr + len / 2);
  }
  g.computeVertexNormals();
  return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function rod(a, b, r, color) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, len, 5, 1);
  g.translate(0, len / 2, 0);
  const dir = B.clone().sub(A).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  g.translate(A.x, A.y, A.z);
  return finish(g, color);
}

const bodyCache = new Map();
export function bodyGeometry(liv) {
  const key = liv.a + liv.b + liv.c;
  if (bodyCache.has(key)) return bodyCache.get(key);
  const A = liv.a, B = liv.b, C = liv.c, parts = [];
  const P = (g, col, o) => parts.push(finish(g, col, o));
  // floor, plank and bargeboard edges
  P(pod(-2.05, 0.95, { w: 1.34, h: 0.05, y: 0.07 }, { w: 1.5, h: 0.05, y: 0.08 }, 0.1, 1), CARBON);
  P(box(0.06, 0.12, 1.1), CARBON, { x: 0.74, y: 0.12, z: 0.35 });
  P(box(0.06, 0.12, 1.1), CARBON, { x: -0.74, y: 0.12, z: 0.35 });
  // diffuser
  P(pod(-2.35, -1.95, { w: 1.0, h: 0.3, y: 0.2 }, { w: 1.1, h: 0.1, y: 0.1 }, 0.1, 1), CARBON);
  // nose: survival-cell front sloping down to the front wing
  P(pod(0.85, 2.62, { w: 0.44, h: 0.38, y: 0.52 }, { w: 0.17, h: 0.12, y: 0.24 }, 0.45, 3), A);
  P(pod(1.6, 2.64, { w: 0.2, h: 0.03, y: 0.36 }, { w: 0.09, h: 0.03, y: 0.31 }, 0.4, 1), B); // nose stripe
  // survival cell / cockpit
  P(pod(-0.55, 0.95, { w: 0.82, h: 0.56, y: 0.5 }, { w: 0.5, h: 0.42, y: 0.52 }, 0.35, 3), A);
  P(pod(-0.55, 0.35, { w: 0.52, h: 0.06, y: 0.78 }, { w: 0.42, h: 0.06, y: 0.74 }, 0.45, 2), '#0a0a0c'); // cockpit opening
  // engine cover sweeping down to the gearbox
  P(pod(-2.2, -0.45, { w: 0.24, h: 0.26, y: 0.42 }, { w: 0.78, h: 0.66, y: 0.6 }, 0.45, 3), A);
  // airbox above the driver's head with intake and roll hoop
  P(pod(-1.05, -0.35, { w: 0.2, h: 0.18, y: 0.86 }, { w: 0.36, h: 0.34, y: 0.98 }, 0.45, 2), A);
  P(box(0.22, 0.17, 0.04), '#060608', { y: 0.99, z: -0.34 });
  P(box(0.08, 0.06, 0.2), B, { y: 1.18, z: -0.42 }); // camera pod
  // shark fin
  P(pod(-2.15, -0.9, { w: 0.02, h: 0.2, y: 0.68 }, { w: 0.02, h: 0.26, y: 0.93 }, 0.1, 1), B);
  // sidepods (coke-bottle taper) with dark inlets and an accent stripe
  for (const s of [1, -1]) {
    P(pod(-1.65, 0.48, { w: 0.24, h: 0.26, y: 0.3, x: s * 0.4 }, { w: 0.5, h: 0.48, y: 0.43, x: s * 0.6 }, 0.4, 3), A);
    P(box(0.4, 0.32, 0.04), '#060608', { x: s * 0.61, y: 0.46, z: 0.49 });
    P(pod(-1.4, 0.45, { w: 0.18, h: 0.03, y: 0.44, x: s * 0.44 }, { w: 0.4, h: 0.03, y: 0.68, x: s * 0.6 }, 0.3, 1), B);
    // mirrors
    P(box(0.16, 0.08, 0.05), C, { x: s * 0.5, y: 0.78, z: 0.42 });
    parts.push(rod([s * 0.32, 0.64, 0.42], [s * 0.46, 0.76, 0.42], 0.012, C));
    // front wing endplates + rear wing endplates
    P(box(0.02, 0.24, 0.56), A, { x: s * 0.94, y: 0.17, z: 2.45 });
    P(box(0.025, 0.62, 0.62), A, { x: s * 0.5, y: 0.66, z: -2.42 });
    P(box(0.03, 0.5, 0.06), B, { x: s * 0.5, y: 0.7, z: -2.13 });
    // suspension: front wishbones and push-rods, rear wishbones
    parts.push(rod([s * 0.2, 0.5, 1.95], [s * 0.66, 0.44, 1.78], 0.016, CARBON));
    parts.push(rod([s * 0.2, 0.5, 1.5], [s * 0.66, 0.44, 1.78], 0.016, CARBON));
    parts.push(rod([s * 0.18, 0.3, 1.95], [s * 0.66, 0.26, 1.78], 0.016, CARBON));
    parts.push(rod([s * 0.18, 0.3, 1.45], [s * 0.66, 0.26, 1.78], 0.016, CARBON));
    parts.push(rod([s * 0.2, 0.28, -1.65], [s * 0.62, 0.28, -1.8], 0.018, CARBON));
    parts.push(rod([s * 0.2, 0.5, -1.95], [s * 0.62, 0.46, -1.8], 0.018, CARBON));
    // brake ducts / hubs
    P(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 8), CARBON, { x: s * 0.6, y: 0.36, z: 1.78, rz: Math.PI / 2 });
    P(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 8), CARBON, { x: s * 0.55, y: 0.37, z: -1.8, rz: Math.PI / 2 });
  }
  // front wing: main plane, two flaps, pylons
  P(box(1.88, 0.025, 0.42), B, { y: 0.09, z: 2.5 });
  P(box(1.8, 0.02, 0.22), A, { y: 0.15, z: 2.36, rx: -0.28 });
  P(box(1.7, 0.018, 0.16), B, { y: 0.21, z: 2.24, rx: -0.5 });
  P(box(0.04, 0.16, 0.18), CARBON, { x: 0.08, y: 0.17, z: 2.48 });
  P(box(0.04, 0.16, 0.18), CARBON, { x: -0.08, y: 0.17, z: 2.48 });
  // rear wing: main plane, beam wing, centre pylon
  P(box(1.0, 0.035, 0.34), A, { y: 0.84, z: -2.44, rx: 0.15 });
  P(box(0.92, 0.02, 0.2), CARBON, { y: 0.38, z: -2.3, rx: 0.2 });
  P(box(0.05, 0.42, 0.14), CARBON, { y: 0.6, z: -2.3 });
  // rain light
  P(box(0.12, 0.06, 0.03), '#ff2020', { y: 0.3, z: -2.36 });
  // halo with its centre pillar
  const halo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.36, 0.76, -0.38), new THREE.Vector3(0.3, 0.9, 0.05), new THREE.Vector3(0, 0.94, 0.33),
    new THREE.Vector3(-0.3, 0.9, 0.05), new THREE.Vector3(-0.36, 0.76, -0.38)]), 18, 0.034, 6);
  P(halo, C);
  P(new THREE.CylinderGeometry(0.03, 0.04, 0.32, 6), C, { y: 0.8, z: 0.48, rx: 0.65 });
  const geo = mergeGeometries(parts, false);
  geo.computeBoundingSphere();
  bodyCache.set(key, geo);
  return geo;
}

let helmetGeo = null;
function helmetGeometry() {
  if (helmetGeo) return helmetGeo;
  const parts = [];
  parts.push(finish(new THREE.SphereGeometry(0.14, 14, 10), '#ffffff', { y: 0.88, z: -0.18, sz: 1.12 }));
  parts.push(finish(new THREE.SphereGeometry(0.142, 12, 6, -0.9, 1.8, 1.1, 0.5), '#101820', { y: 0.88, z: -0.18, sz: 1.12 }));
  helmetGeo = mergeGeometries(parts); return helmetGeo;
}

let wheelGeo = null;
export function wheelGeometry(compound = '#e8202a') {
  if (wheelGeo) return wheelGeo;
  const parts = [];
  // unit wheel (radius 1, width 1) scaled per instance; axis along x
  parts.push(finish(new THREE.CylinderGeometry(1, 1, 1, 22, 1, true), '#1a1a1c', { rz: Math.PI / 2 }));
  for (const s of [0.5, -0.5]) {
    parts.push(finish(new THREE.RingGeometry(0.62, 1, 22), '#202024', { x: s, ry: s > 0 ? Math.PI / 2 : -Math.PI / 2 }));
    parts.push(finish(new THREE.RingGeometry(0.8, 0.86, 22), compound, { x: s * 1.01, ry: s > 0 ? Math.PI / 2 : -Math.PI / 2 }));
    parts.push(finish(new THREE.CircleGeometry(0.62, 16), '#3a3c42', { x: s * 0.9, ry: s > 0 ? Math.PI / 2 : -Math.PI / 2 }));
    for (let k = 0; k < 5; k++) parts.push(finish(box(0.06, 1.1, 0.12), '#8a8e96', { x: s * 0.94, rx: k * Math.PI / 5 }));
    parts.push(finish(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 8), '#c8ccd2', { x: s * 0.96, rz: Math.PI / 2 }));
  }
  wheelGeo = mergeGeometries(parts); return wheelGeo;
}

let flapGeo = null;
function flapGeometry() {
  if (!flapGeo) { flapGeo = new THREE.BoxGeometry(0.98, 0.025, 0.2); flapGeo.translate(0, 0, -0.1); }
  return flapGeo;
}

export const bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.35 });
const helmetMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.2 });

/* Decal planes: race number on the engine cover sides, team name on the
 * rear wing (seen from the chase camera) and the nose. */
function decalGeometry() {
  const parts = [];
  const mk = (w, h, u0, u1, o) => {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + (u1 - u0) * uv.getX(i));
    e.set(o.rx || 0, o.ry || 0, o.rz || 0); q.setFromEuler(e); m4.compose(v3.set(o.x || 0, o.y || 0, o.z || 0), q, sc.set(1, 1, 1));
    g.applyMatrix4(m4); parts.push(g);
  };
  mk(0.4, 0.2, 0, 0.5, { x: 0.235, y: 0.66, z: -1.2, ry: Math.PI / 2 + 0.3 });
  mk(0.4, 0.2, 0, 0.5, { x: -0.235, y: 0.66, z: -1.2, ry: -Math.PI / 2 - 0.3 });
  mk(0.58, 0.15, 0.5, 1, { x: 0.515, y: 0.66, z: -2.42, ry: Math.PI / 2 });
  mk(0.58, 0.15, 0.5, 1, { x: -0.515, y: 0.66, z: -2.42, ry: -Math.PI / 2 });
  mk(0.26, 0.13, 0, 0.5, { x: 0, y: 0.628, z: 1.22, rx: -Math.PI / 2 + 0.14, rz: Math.PI });
  return mergeGeometries(parts);
}
let decalGeo = null;

export function makeCar(liv, { standalone = false } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(bodyGeometry(liv), bodyMaterial);
  group.add(body);
  const helmet = new THREE.Mesh(helmetGeometry(), helmetMat); group.add(helmet);
  const flapMat = new THREE.MeshStandardMaterial({ color: liv.b, roughness: 0.4, metalness: 0.2 });
  const flap = new THREE.Mesh(flapGeometry(), flapMat);
  flap.position.set(0, 0.97, -2.3); flap.rotation.x = 0.55; group.add(flap);
  if (!decalGeo) decalGeo = decalGeometry();
  // decal background stripe colour = livery accent; text drawn in accent on a clear canvas
  const decTex = TX.decal({ ...liv, b: liv.b === '#ffffff' || liv.b === '#f5f5f5' ? '#ffffff' : liv.b });
  const dec = new THREE.Mesh(decalGeo, new THREE.MeshLambertMaterial({ map: decTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  group.add(dec);
  const wheels = [];
  if (standalone) {
    const wm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.1 });
    for (const w of WHEELS) {
      const m = new THREE.Mesh(wheelGeometry(), wm);
      m.scale.set(w.w, w.r, w.r); m.position.set(w.x, w.r, w.z);
      group.add(m); wheels.push(m);
    }
  }
  group.userData = { body, helmet, flap, dec, wheels, liv };
  return group;
}

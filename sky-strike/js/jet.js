/* The player's fighter (and the Iron Crown variant flown by enemy pilots).
 * Fuselage, intakes and spine are lofted from superellipse cross-sections;
 * wings and tails are bevelled planforms. Nose points down -Z. */
import * as THREE from 'three';
import { Builder, mat4, makeNoise, clamp } from './util.js';

/* loft superellipse sections: {z, w, ht, hb, y, n} */
export function loft(S, seg = 28, capEnds = true) {
  const pos = [], idx = [];
  for (const s of S) {
    const n = s.n || 2, e = 2 / n;
    for (let j = 0; j < seg; j++) {
      const a = j / seg * Math.PI * 2, c = Math.cos(a), si = Math.sin(a);
      const x = s.w * Math.sign(c) * Math.pow(Math.abs(c), e);
      const y = (s.y || 0) + (si >= 0 ? s.ht : s.hb ?? s.ht) * Math.sign(si) * Math.pow(Math.abs(si), e);
      pos.push(x, y, s.z);
    }
  }
  for (let i = 0; i < S.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * seg + j, b = i * seg + (j + 1) % seg, c = a + seg, d = b + seg;
    idx.push(a, b, c, b, d, c);
  }
  if (capEnds) {
    const f = pos.length / 3; pos.push(0, S[0].y || 0, S[0].z);
    const l = f + 1, L = S.length - 1; pos.push(0, S[L].y || 0, S[L].z);
    for (let j = 0; j < seg; j++) { idx.push(f, (j + 1) % seg, j); idx.push(l, L * seg + j, L * seg + (j + 1) % seg); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/* flat planform in (x,z) with bevelled edges, centred on y=0 */
export function planform(pts, depth = 0.1, bevel = 0.08) {
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 1.3, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(Math.PI / 2); g.translate(0, depth / 2, 0);
  return g;
}
/* vertical planform (z,y) extruded across x, centred on x=0 */
export function finform(pts, depth = 0.08, bevel = 0.06) {
  const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 1.2, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -depth / 2); g.rotateY(-Math.PI / 2);
  return g;
}

/* ------------------------------------------------------------ markings atlas */
let _atlas = null;
export function markingsAtlas() {
  if (_atlas) return _atlas;
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  // 0: Nexus Air Wing roundel — teal disc, white ring, white arrowhead
  let cx = 64, cy = 64;
  g.fillStyle = '#f4f6f8'; g.beginPath(); g.arc(cx, cy, 60, 0, 7); g.fill();
  g.fillStyle = '#1aa898'; g.beginPath(); g.arc(cx, cy, 50, 0, 7); g.fill();
  g.fillStyle = '#f4f6f8'; g.beginPath(); g.moveTo(cx, cy - 36); g.lineTo(cx + 30, cy + 26); g.lineTo(cx, cy + 12); g.lineTo(cx - 30, cy + 26); g.closePath(); g.fill();
  g.fillStyle = '#ffcb3a'; g.beginPath(); g.arc(cx, cy - 2, 7, 0, 7); g.fill();
  // 1: Nexus tail flash — teal bolt + number
  cx = 192;
  g.fillStyle = '#1aa898'; g.beginPath(); g.moveTo(cx - 30, 14); g.lineTo(cx + 18, 14); g.lineTo(cx - 2, 52); g.lineTo(cx + 26, 52); g.lineTo(cx - 34, 118); g.lineTo(cx - 12, 66); g.lineTo(cx - 40, 66); g.closePath(); g.fill();
  g.fillStyle = '#e8ecf0'; g.font = 'bold 34px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.fillText('07', cx + 34, 112);
  // 2: Iron Crown roundel — red disc, black ring, gold crown
  cx = 320;
  g.fillStyle = '#16181c'; g.beginPath(); g.arc(cx, cy, 60, 0, 7); g.fill();
  g.fillStyle = '#c4161c'; g.beginPath(); g.arc(cx, cy, 50, 0, 7); g.fill();
  g.fillStyle = '#e8c45a'; g.beginPath(); g.moveTo(cx - 30, cy + 22); g.lineTo(cx - 34, cy - 20); g.lineTo(cx - 16, cy - 2); g.lineTo(cx, cy - 30); g.lineTo(cx + 16, cy - 2); g.lineTo(cx + 34, cy - 20); g.lineTo(cx + 30, cy + 22); g.closePath(); g.fill();
  // 3: Iron Crown tail — red band + crown
  cx = 448;
  g.fillStyle = '#c4161c'; g.fillRect(cx - 60, 10, 120, 30);
  g.fillStyle = '#e8c45a'; g.beginPath(); g.moveTo(cx - 22, 100); g.lineTo(cx - 26, 64); g.lineTo(cx - 12, 80); g.lineTo(cx, 54); g.lineTo(cx + 12, 80); g.lineTo(cx + 26, 64); g.lineTo(cx + 22, 100); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  _atlas = t; return t;
}
function decal(w, h, region, m) {
  const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (region + uv.getX(i)) / 4);
  g.applyMatrix4(m); return g;
}

/* ------------------------------------------------------------ the jet */
const _n = makeNoise(42);
const paintFn = enemy => (x, y, z, c) => {
  const v = _n(x * 0.33 + y * 0.21, z * 0.3) + _n(x * 0.9, z * 0.8 + y) * 0.3;
  if (!enemy) {
    if (z < -8.15) return c.set('#666d75');
    if (z > -7.3 && z < -5.7 && y > 0.5 && Math.abs(x) < 0.5) return c.set('#3a4046');
    c.set(y < -0.25 ? '#b9c1c9' : v > 0.18 ? '#7b8592' : '#a1aab5');
    return c;
  }
  if (z < -8.15) return c.set('#2a2d32');
  if (z > -8.15 && z < -7.4) return c.set('#a8141a');
  c.set(y < -0.25 ? '#5d636b' : v > 0.15 ? '#353a40' : '#4a5058');
  return c;
};

export function buildJet({ enemy = false, hi = true } = {}) {
  const group = new THREE.Group(); group.name = enemy ? 'enemyJet' : 'jet';
  const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.35, envMapIntensity: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.5 });
  const seg = hi ? 32 : 18, P = paintFn(enemy);
  const B = new Builder(), D = new Builder();
  // fuselage
  B.add(loft([
    { z: -9.2, w: 0.03, ht: 0.03, hb: 0.03, y: 0.05 }, { z: -8.7, w: 0.2, ht: 0.18, hb: 0.17, y: 0.05 }, { z: -7.8, w: 0.42, ht: 0.38, hb: 0.34, y: 0.08 },
    { z: -6.4, w: 0.64, ht: 0.58, hb: 0.5, y: 0.12, n: 2.2 }, { z: -4.9, w: 0.8, ht: 0.7, hb: 0.58, y: 0.14, n: 2.4 }, { z: -3.4, w: 0.94, ht: 0.72, hb: 0.62, y: 0.12, n: 2.8 },
    { z: -2.2, w: 1.28, ht: 0.7, hb: 0.66, y: 0.06, n: 3.2 }, { z: -0.8, w: 1.52, ht: 0.68, hb: 0.68, y: 0.02, n: 3.4 }, { z: 1.0, w: 1.6, ht: 0.64, hb: 0.66, y: 0, n: 3.4 },
    { z: 3.0, w: 1.5, ht: 0.6, hb: 0.6, y: 0, n: 3.2 }, { z: 4.8, w: 1.3, ht: 0.55, hb: 0.52, y: 0, n: 3 }, { z: 6.0, w: 1.12, ht: 0.5, hb: 0.48, y: 0, n: 2.8 }, { z: 6.7, w: 1.04, ht: 0.48, hb: 0.46, y: 0, n: 2.6 }
  ], seg), P);
  // dorsal spine
  B.add(loft([{ z: -3.6, w: 0.2, ht: 0.12, hb: 0.1, y: 0.62 }, { z: -2.6, w: 0.48, ht: 0.3, hb: 0.2, y: 0.6 }, { z: 1.5, w: 0.62, ht: 0.32, hb: 0.2, y: 0.55 }, { z: 4.8, w: 0.5, ht: 0.22, hb: 0.2, y: 0.5 }, { z: 6.4, w: 0.22, ht: 0.08, hb: 0.1, y: 0.46 }], hi ? 18 : 10), P);
  // intakes
  for (const sx of [-1, 1]) {
    B.add(loft([{ z: -3.0, w: 0.44, ht: 0.46, hb: 0.46, y: -0.2, n: 4 }, { z: -2.0, w: 0.46, ht: 0.48, hb: 0.48, y: -0.2, n: 4 }, { z: 0.4, w: 0.44, ht: 0.45, hb: 0.46, y: -0.18, n: 3.6 }, { z: 2.0, w: 0.3, ht: 0.3, hb: 0.3, y: -0.1, n: 3 }], hi ? 20 : 12, true), P, [sx * 1.28, 0, 0]);
    D.add(new THREE.PlaneGeometry(0.7, 0.76).rotateY(Math.PI), '#2a2e34', [sx * 1.28, -0.2, -3.012]);
    D.add(new THREE.PlaneGeometry(0.56, 0.62).rotateY(Math.PI), '#0a0b0d', [sx * 1.28, -0.2, -3.016]);
    D.add(new THREE.BoxGeometry(0.05, 0.9, 0.7), '#4a5058', [sx * 0.86, -0.2, -2.7]);
  }
  // wings (bevelled planform), slight anhedral
  const wingPts = [[1.05, -3.9], [1.6, -1.6], [5.9, 3.0], [5.95, 4.35], [1.4, 4.6]];
  for (const sx of [-1, 1]) {
    const wm = mat4([0, 0.05, 0], [0, 0, sx * -0.045]);
    B.addM(planform(wingPts.map(([x, z]) => [x * sx, z]), 0.1, 0.07), P, wm);
    // wingtip rail + cosmetic AAM
    D.add(new THREE.BoxGeometry(0.1, 0.12, 2.6), '#4a5058', new THREE.Matrix4().multiplyMatrices(wm, mat4([sx * 6.02, 0, 3.4])));
    B.add(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 8).rotateX(Math.PI / 2), '#d8dce0', new THREE.Matrix4().multiplyMatrices(wm, mat4([sx * 6.02, -0.14, 3.0])));
    for (const fz of [2.0, 4.0]) D.add(new THREE.BoxGeometry(0.42, 0.03, 0.3), '#8a9096', new THREE.Matrix4().multiplyMatrices(wm, mat4([sx * 6.02, -0.14, fz])));
  }
  // twin canted tails
  const tailPts = [[3.3, 0], [6.7, 0], [7.3, 3.1], [6.0, 3.1]];
  for (const sx of [-1, 1]) {
    B.addM(finform(tailPts, 0.08, 0.06), P, mat4([sx * 1.02, 0.42, 0], [0, 0, sx * -0.33]));
    D.addM(new THREE.BoxGeometry(0.05, 0.25, 0.6), '#c8cdd2', mat4([sx * (1.02 + 0.98), 0.42 + 2.95, 6.9], [0, 0, sx * -0.33])); // tip light fairing
  }
  // ventral fins
  for (const sx of [-1, 1]) B.addM(finform([[3.6, 0], [5.6, 0], [5.9, -0.7], [4.9, -0.7]], 0.05, 0.03), P, mat4([sx * 0.95, -0.45, 0], [0, 0, sx * 0.25]));
  // nozzles
  for (const sx of [-1, 1]) {
    B.add(new THREE.CylinderGeometry(0.46, 0.55, 1.4, hi ? 22 : 12, 1, true).rotateX(Math.PI / 2), '#5a5f66', [sx * 0.58, 0.02, 7.25]);
    D.add(new THREE.CylinderGeometry(0.42, 0.42, 1.3, hi ? 22 : 12, 1, true).rotateX(Math.PI / 2), '#1a1c20', [sx * 0.58, 0.02, 7.2]);
    D.add(new THREE.TorusGeometry(0.46, 0.045, 6, hi ? 22 : 12), '#3a3d42', [sx * 0.58, 0.02, 7.95]);
    D.add(new THREE.CircleGeometry(0.42, hi ? 20 : 10).rotateY(Math.PI), '#222428', [sx * 0.58, 0.02, 6.7]);
  }
  // canopy frame + pilot (frame is opaque)
  D.addM(new THREE.TorusGeometry(1, 0.05, 6, 20, Math.PI), '#2a2e33', mat4([0, 0.62, -5.55], [0, 0, 0], [0.55, 0.6, 1]));
  D.addM(new THREE.TorusGeometry(1, 0.035, 6, 20, Math.PI), '#2a2e33', mat4([0, 0.62, -3.9], [0, 0, 0], [0.5, 0.56, 1]));
  // pylons
  const pyl = { bomb: [], msl: [] };
  for (const sx of [-1, 1]) {
    D.add(new THREE.BoxGeometry(0.14, 0.32, 1.9), '#5a6068', [sx * 2.5, -0.27, 1.2]);
    D.add(new THREE.BoxGeometry(0.9, 0.08, 0.5), '#5a6068', [sx * 2.5, -0.42, 1.2]);
    D.add(new THREE.BoxGeometry(0.14, 0.3, 1.6), '#5a6068', [sx * 4.0, -0.26 - (enemy ? 0 : 0.05), 2.4]);
    D.add(new THREE.BoxGeometry(0.8, 0.06, 0.4), '#5a6068', [sx * 4.0, -0.42, 2.4]);
    pyl.bomb.push(new THREE.Vector3(sx * 2.5 - 0.3, -0.72, 1.2), new THREE.Vector3(sx * 2.5 + 0.3, -0.72, 1.2));
    pyl.msl.push(new THREE.Vector3(sx * 4.0 - 0.28, -0.6, 2.4), new THREE.Vector3(sx * 4.0 + 0.28, -0.6, 2.4));
  }
  const body = B.mesh(paint); body.castShadow = true; body.receiveShadow = true; group.add(body);
  const darkM = D.mesh(dark); darkM.castShadow = true; group.add(darkM);

  // canopy glass
  const glassMat = new THREE.MeshStandardMaterial({ color: enemy ? '#3a2a14' : '#4a3a14', roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.55, envMapIntensity: 2.2 });
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, hi ? 32 : 16, hi ? 16 : 8, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
  canopy.scale.set(0.56, 0.6, 2.05); canopy.position.set(0, 0.62, -4.85); canopy.rotation.x = 0.03; canopy.renderOrder = 2;
  group.add(canopy);
  // pilot
  const pilot = new THREE.Group();
  const PB = new Builder();
  PB.add(new THREE.BoxGeometry(0.5, 0.5, 0.34), '#4a5a3a', [0, 0.72, -4.5]);
  PB.add(new THREE.SphereGeometry(0.18, 14, 10), '#e4e6ea', [0, 1.06, -4.58]);
  PB.add(new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.35), '#c8a040', [0, 1.05, -4.62], [-1.2, 0, 0]);
  PB.add(new THREE.BoxGeometry(0.44, 0.62, 0.14), '#2a2d30', [0, 0.92, -4.22]);
  PB.add(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 6), '#20242a', [0, 0.95, -4.78], [1.2, 0, 0]);
  pilot.add(PB.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 })));
  group.add(pilot);

  // cockpit interior (only drawn in cockpit view)
  const cockpit = new THREE.Group(); cockpit.visible = false;
  const CB = new Builder();
  CB.add(new THREE.BoxGeometry(1.2, 0.4, 0.5), '#1c1f23', [0, 0.72, -5.55]);
  CB.add(new THREE.BoxGeometry(1.1, 0.06, 0.6), '#25292e', [0, 0.93, -5.5], [0.2, 0, 0]);
  CB.add(new THREE.BoxGeometry(0.06, 0.5, 2.0), '#25292e', [-0.55, 0.75, -4.6]); CB.add(new THREE.BoxGeometry(0.06, 0.5, 2.0), '#25292e', [0.55, 0.75, -4.6]);
  CB.add(new THREE.BoxGeometry(0.34, 0.28, 0.02), '#0c0e10', [-0.3, 0.76, -5.3], [-0.3, 0, 0]); CB.add(new THREE.BoxGeometry(0.34, 0.28, 0.02), '#0c0e10', [0.3, 0.76, -5.3], [-0.3, 0, 0]);
  cockpit.add(CB.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })));
  const mfd = mfdTexture();
  const mfdMat = new THREE.MeshBasicMaterial({ map: mfd, toneMapped: false, color: new THREE.Color(0.75, 0.75, 0.75) });
  for (const [x, u] of [[-0.3, 0], [0.3, 0.5]]) {
    const g = new THREE.PlaneGeometry(0.3, 0.24), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, u + uv.getX(i) * 0.5);
    const m = new THREE.Mesh(g, mfdMat); m.position.set(x, 0.76, -5.285); m.rotation.x = -0.3; cockpit.add(m);
  }
  const combiner = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), new THREE.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.035, depthWrite: false }));
  combiner.position.set(0, 1.08, -5.45); combiner.rotation.x = -0.25; cockpit.add(combiner);
  group.add(cockpit);

  // stabilators (separate so they deflect)
  const stabs = [];
  for (const sx of [-1, 1]) {
    const sg = planform([[0.1, -1.0], [2.7, 0.9], [2.7, 1.6], [0.1, 1.4]].map(([x, z]) => [x * sx, z]), 0.07, 0.05);
    const SBd = new Builder(); SBd.add(sg, P, [0, 0, 0]);
    const st = SBd.mesh(paint); st.position.set(sx * 1.0, 0.0, 6.0); st.rotation.z = sx * 0.04; st.castShadow = true;
    group.add(st); stabs.push(st);
  }
  // markings
  const decMat = new THREE.MeshStandardMaterial({ map: markingsAtlas(), transparent: true, roughness: 0.55, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
  const DG = [], R0 = enemy ? 2 : 0;
  for (const sx of [-1, 1]) {
    const wm = mat4([0, 0.05, 0], [0, 0, sx * -0.045]);
    DG.push(decal(1.5, 1.5, R0, new THREE.Matrix4().multiplyMatrices(wm, mat4([sx * 3.9, 0.125, 2.6], [-Math.PI / 2, 0, 0]))));
    const tm = mat4([sx * 1.02, 0.42, 0], [0, 0, sx * -0.33]);
    DG.push(decal(1.4, 1.4, R0 + 1, new THREE.Matrix4().multiplyMatrices(tm, mat4([sx * 0.1, 1.6, 6.15], [0, sx * Math.PI / 2, 0]))));
    DG.push(decal(0.8, 0.8, R0, mat4([sx * 1.73, -0.15, -1.2], [0, sx * Math.PI / 2, 0])));
  }
  group.add(new THREE.Mesh(mergeDecals(DG), decMat));

  // stores: bombs + air-to-ground missiles
  const storeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3 });
  const bombGeo = bombGeometry(), mslGeo = missileGeometry(enemy);
  const bombs = pyl.bomb.map(p => { const m = new THREE.Mesh(bombGeo, storeMat); m.position.copy(p); m.castShadow = true; group.add(m); return m; });
  const missiles = pyl.msl.map(p => { const m = new THREE.Mesh(mslGeo, storeMat); m.position.copy(p); m.castShadow = true; group.add(m); return m; });

  // engine glow + afterburner flames
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.6, 0.2), toneMapped: false });
  const flames = [], flameMat = flameMaterial(false), coreMat = flameMaterial(true);
  for (const sx of [-1, 1]) {
    const gl = new THREE.Mesh(new THREE.CircleGeometry(0.4, 18), glowMat); gl.position.set(sx * 0.58, 0.02, 6.95); group.add(gl);
    const outer = new THREE.Mesh(flameGeometry(0.42), flameMat); outer.position.set(sx * 0.58, 0.02, 7.85); group.add(outer);
    const core = new THREE.Mesh(flameGeometry(0.26), coreMat); core.position.set(sx * 0.58, 0.02, 7.85); group.add(core);
    flames.push({ outer, core });
  }
  const api = {
    group, body, canopy, pilot, cockpit, bombs, missiles, flames, stabs, glowMat, flameMat, coreMat,
    wingtips: [new THREE.Vector3(-6.05, -0.15, 4.3), new THREE.Vector3(6.05, -0.15, 4.3)],
    nozzles: [new THREE.Vector3(-0.58, 0.02, 8.2), new THREE.Vector3(0.58, 0.02, 8.2)],
    pylons: pyl, eye: new THREE.Vector3(0, 1.2, -4.5),
    setStores(b, bMax, m, mMax) {
      const vb = b <= 0 ? 0 : Math.ceil(4 * b / bMax), vm = m <= 0 ? 0 : Math.ceil(4 * m / mMax);
      const ob = [0, 3, 1, 2], om = [0, 3, 1, 2]; // outer first, alternating sides
      bombs.forEach((s, i) => s.visible = ob.indexOf(i) >= 4 - vb);
      missiles.forEach((s, i) => s.visible = om.indexOf(i) >= 4 - vm);
    },
    /* throttle 0..1, ab 0..1 */
    setEngine(thr, ab, t) {
      const f = 0.85 + Math.sin(t * 53) * 0.08 + Math.sin(t * 31.7) * 0.07;
      glowMat.color.setRGB(1.2 + ab * 2.4 + thr * 0.6, 0.45 + ab * 0.9 + thr * 0.2, 0.15 + ab * 0.3);
      for (const fl of flames) {
        const L = (0.6 + thr * 1.4) * (1 - ab) + ab * (5.2 * f);
        fl.outer.scale.set(0.75 + ab * 0.3, 0.75 + ab * 0.3, L); fl.core.scale.set(0.9, 0.9, L * 0.62 + 0.3);
        fl.outer.visible = ab > 0.03 || thr > 0.2;
      }
      flameMat.uniforms.ab.value = ab; coreMat.uniforms.ab.value = ab; flameMat.uniforms.time.value = t; coreMat.uniforms.time.value = t;
    },
    setControls(pitch, roll) { stabs[0].rotation.x = clamp(-pitch * 0.35 + roll * 0.25, -0.4, 0.4); stabs[1].rotation.x = clamp(-pitch * 0.35 - roll * 0.25, -0.4, 0.4); },
    setCockpit(on) { cockpit.visible = on; pilot.visible = !on; },
    dispose() { group.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); [paint, dark, glassMat, decMat, glowMat, flameMat, coreMat, storeMat].forEach(m => m.dispose()); }
  };
  api.setStores(1, 1, 1, 1); api.setEngine(0.5, 0, 0);
  return api;
}
function mfdTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 200; const g = c.getContext('2d');
  g.fillStyle = '#03100a'; g.fillRect(0, 0, 256, 200); g.fillStyle = '#030a14'; g.fillRect(256, 0, 256, 200);
  g.strokeStyle = 'rgba(80,255,140,.85)'; g.lineWidth = 2;
  g.beginPath(); g.arc(128, 190, 170, Math.PI * 1.25, Math.PI * 1.75); g.stroke(); g.beginPath(); g.arc(128, 190, 110, Math.PI * 1.25, Math.PI * 1.75); g.stroke(); g.beginPath(); g.arc(128, 190, 55, Math.PI * 1.25, Math.PI * 1.75); g.stroke();
  g.beginPath(); g.moveTo(128, 190); g.lineTo(128 - 120, 70); g.moveTo(128, 190); g.lineTo(128 + 120, 70); g.stroke();
  g.fillStyle = 'rgba(255,80,60,.9)'; [[90, 80], [150, 60], [170, 110]].forEach(([x, y]) => g.fillRect(x - 4, y - 4, 8, 8));
  g.fillStyle = 'rgba(80,255,140,.9)'; g.font = 'bold 16px sans-serif'; g.fillText('RDR  A/G', 10, 22); g.fillText('20', 220, 22);
  g.strokeStyle = 'rgba(90,170,255,.8)'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(256, 30 + i * 30); g.bezierCurveTo(330, 10 + i * 34, 420, 60 + i * 22, 512, 30 + i * 30); g.stroke(); }
  g.fillStyle = 'rgba(255,200,80,.9)'; g.beginPath(); g.moveTo(384, 90); g.lineTo(374, 112); g.lineTo(394, 112); g.closePath(); g.fill();
  g.fillStyle = 'rgba(120,200,255,.9)'; g.fillText('TSD', 266, 22); g.fillText('WPT 2', 440, 190);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function mergeDecals(list) {
  let n = 0; for (const g of list) n += g.index ? g.index.count : g.attributes.position.count;
  const pos = [], uv = [], nor = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array); uv.push(...g.attributes.uv.array); nor.push(...g.attributes.normal.array);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
let _bombG = null, _mslG = {};
export function bombGeometry() {
  if (_bombG) return _bombG;
  const B = new Builder();
  B.add(loft([{ z: -1.15, w: 0.02, ht: 0.02 }, { z: -1.0, w: 0.13, ht: 0.13 }, { z: -0.7, w: 0.2, ht: 0.2 }, { z: 0.4, w: 0.21, ht: 0.21 }, { z: 0.9, w: 0.12, ht: 0.12 }, { z: 1.05, w: 0.08, ht: 0.08 }], 12), '#5b6152');
  B.add(new THREE.CylinderGeometry(0.205, 0.205, 0.06, 12).rotateX(Math.PI / 2), '#c8a83a', [0, 0, -0.6]);
  for (let i = 0; i < 4; i++) B.add(new THREE.BoxGeometry(0.02, 0.5, 0.42), '#4a5044', new THREE.Matrix4().multiplyMatrices(mat4([0, 0, 0], [0, 0, i * Math.PI / 2 + Math.PI / 4]), mat4([0, 0.2, 0.85])));
  _bombG = B.geometry(); _bombG.userData.shared = true; return _bombG;
}
export function missileGeometry(enemy) {
  const k = enemy ? 'e' : 'p'; if (_mslG[k]) return _mslG[k];
  const B = new Builder();
  B.add(loft([{ z: -1.5, w: 0.02, ht: 0.02 }, { z: -1.32, w: 0.1, ht: 0.1 }, { z: -1.1, w: 0.13, ht: 0.13 }, { z: 1.3, w: 0.13, ht: 0.13 }, { z: 1.4, w: 0.1, ht: 0.1 }], 10), enemy ? '#b8bcc0' : '#e2e5e8');
  B.add(new THREE.SphereGeometry(0.1, 8, 6), '#2a2a30', [0, 0, -1.33]);
  B.add(new THREE.CylinderGeometry(0.132, 0.132, 0.08, 10).rotateX(Math.PI / 2), '#c8a83a', [0, 0, -0.8]);
  for (let i = 0; i < 4; i++) {
    B.add(new THREE.BoxGeometry(0.02, 0.34, 0.5), '#9aa0a6', new THREE.Matrix4().multiplyMatrices(mat4([0, 0, 0], [0, 0, i * Math.PI / 2 + Math.PI / 4]), mat4([0, 0.2, 1.1])));
    B.add(new THREE.BoxGeometry(0.02, 0.2, 0.3), '#9aa0a6', new THREE.Matrix4().multiplyMatrices(mat4([0, 0, 0], [0, 0, i * Math.PI / 2 + Math.PI / 4]), mat4([0, 0.15, -0.6])));
  }
  const g = B.geometry(); g.userData.shared = true; return (_mslG[k] = g);
}
function flameGeometry(r) {
  const g = new THREE.ConeGeometry(r, 1, 18, 6, true); g.translate(0, 0.5, 0); g.rotateX(Math.PI / 2); // base at z=0, apex towards +z
  return g;
}
function flameMaterial(core) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { ab: { value: 0 }, time: { value: 0 } },
    vertexShader: `varying float vL; varying vec3 vN; varying vec3 vV; void main(){ vL = clamp(position.z, 0.0, 1.0); vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float ab, time; varying float vL; varying vec3 vN; varying vec3 vV;
      void main(){ float rim = pow(abs(dot(normalize(vN), normalize(vV))), ${core ? '1.2' : '2.0'});
        float diamonds = 0.75 + 0.25 * sin(vL * 34.0 - time * 8.0);
        vec3 hot = ${core ? 'vec3(1.6, 1.4, 1.9)' : 'vec3(2.4, 0.9, 0.25)'};
        vec3 idle = vec3(0.25, 0.35, 0.9);
        vec3 c = mix(idle, hot, ab) * (1.0 - vL) * rim * diamonds;
        float a = (1.0 - vL) * (0.35 + ab * 0.65);
        gl_FragColor = vec4(c * a * 1.6, a); }`
  });
}

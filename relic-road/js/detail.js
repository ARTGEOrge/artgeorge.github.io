/**
 * Architecture on top of the map's plain prisms: the parts of a building that
 * give a skyline its shape and a street its depth.
 *
 *   - cornices along every roofline, and a ledge over the shopfronts
 *   - pitched roofs where the footprint is a simple box: hipped tile roofs in
 *     Rome, Istanbul and Rio, zinc mansards in Berlin, deep-eaved temple roofs
 *     in Kyoto
 *   - rooftop clutter on the flat roofs: water tanks, dishes, vents, chimneys,
 *     aerials, Cairo's unfinished columns with their rebar
 *   - striped awnings over the shop windows (lined up with the shopfront bays
 *     the facade shader paints)
 *   - the landmarks: the pyramids as pyramids, domes and minarets on the
 *     mosques, domes on the churches and baths, spires on the Kirchen
 *
 * Everything is merged per map tile (through the city's Batcher) or instanced
 * with a level of detail, so it adds geometry without adding many draw calls.
 */
import * as THREE from 'three';
import { part, merge, vcMaterial, LodSet } from './streets.js';
import { makeRng, TAU } from './util.js';
import { STOREY } from './facade.js';

/** What kind of landmark a named building is, if any. */
export function landmarkKind(name, kind, cityId) {
  // Giza's plateau is covered in unnamed mastaba tombs
  if (!name) return kind === 'monument' && cityId === 'cairo' ? 'mastaba' : null;
  if (kind === 'monument' && /هرم|pyramid/i.test(name)) return 'pyramid';
  if (kind === 'monument' && /mastaba|مصطبة|مصاطب/i.test(name)) return 'mastaba';
  if (/colosse|anfiteatro flavio/i.test(name)) return 'arcade';
  if (/cami|mosque|moschee|ayasofya|hagia sophia|mescid/i.test(name)) return 'mosque';
  if (/hamam|medrese|türbe|turbe/i.test(name)) return 'domed';
  if (/basilica|chiesa|santa |san |sant'|santi |pantheon|cathedral|kathedrale|\bdom\b|dom$/i.test(name)) return 'church';
  if (/kirche/i.test(name)) return 'spire';
  if (cityId === 'kyoto' && /寺|堂|殿|神宮|閣|院|門/.test(name)) return 'temple';
  return null;
}

/** Paint a whole geometry one colour through a vertex colour attribute. */
export function colourise(g, hex) {
  const c = new THREE.Color(hex == null ? 0x8a8d90 : hex), n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

/* ---------------------------------------------------------------- shapes */
function signedArea(m) {
  let a = 0;
  const n = m.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += m[i * 2] * m[j * 2 + 1] - m[j * 2] * m[i * 2 + 1];
  }
  return a / 2;
}

/** The footprint without a repeated closing point. */
function openRing(m) {
  const n = m.length / 2;
  if (n > 3 && Math.hypot(m[0] - m[n * 2 - 2], m[1] - m[n * 2 - 1]) < 0.05) return m.slice(0, n * 2 - 2);
  return m;
}

/** The smallest rectangle round a footprint, trying each edge's direction. */
export function orientedRect(m) {
  const n = m.length / 2;
  let best = null;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    let ux = m[j * 2] - m[i * 2], uz = m[j * 2 + 1] - m[i * 2 + 1];
    const L = Math.hypot(ux, uz);
    if (L < 0.5) continue;
    ux /= L; uz /= L;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (let k = 0; k < n; k++) {
      const x = m[k * 2], z = m[k * 2 + 1];
      const a = x * ux + z * uz, b = -x * uz + z * ux;
      a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b);
    }
    const area = (a1 - a0) * (b1 - b0);
    if (!best || area < best.area) best = { area, ux, uz, a0, a1, b0, b1 };
  }
  if (!best) return null;
  let { ux, uz, a0, a1, b0, b1 } = best;
  const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
  let hl = (a1 - a0) / 2, hw = (b1 - b0) / 2;
  // keep u along the long side
  if (hw > hl) { [hl, hw] = [hw, hl]; [ux, uz] = [-uz, ux]; }
  const cx = ca * best.ux - cb * best.uz, cz = ca * best.uz + cb * best.ux;
  return { cx, cz, ux, uz, hl, hw, area: best.area, fill: Math.abs(signedArea(m)) / best.area };
}

/** Convex hull (monotone chain) of a flat [x,z,…] list. */
function hull(m) {
  const pts = [];
  for (let i = 0; i < m.length; i += 2) pts.push([m[i], m[i + 1]]);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/** Triangles in, a geometry with flat normals and planar UVs (metres / 4) out. */
function triGeo(pos, uvScale = 0.25) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const p = g.attributes.position, nrm = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = nrm.getX(i), nz = nrm.getZ(i);
    const h = Math.hypot(nx, nz);
    // u runs along the slope's contour, v up it
    const tx = h > 0.01 ? -nz / h : 1, tz = h > 0.01 ? nx / h : 0;
    uv[i * 2] = (p.getX(i) * tx + p.getZ(i) * tz) * uvScale;
    uv[i * 2 + 1] = (h > 0.01 ? p.getY(i) / Math.max(0.2, h) : p.getZ(i)) * uvScale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** A Giza pyramid: the footprint's hull drawn up to an apex over its middle. */
export function pyramidGeo(m, height) {
  const h = hull(m);
  if (h.length < 3) return null;
  let cx = 0, cz = 0;
  for (const [x, z] of h) { cx += x; cz += z; }
  cx /= h.length; cz /= h.length;
  const pos = [];
  // the hull comes out anticlockwise in x/z; wind each face to look outward
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    pos.push(a[0], 0, a[1], cx, height, cz, b[0], 0, b[1]);
  }
  return triGeo(pos, 0.25);
}

/** A mastaba: the hull's walls leaning inward as they rise, and a flat top. */
export function mastabaGeo(m, height) {
  const h = hull(m);
  if (h.length < 3) return null;
  let cx = 0, cz = 0;
  for (const [x, z] of h) { cx += x; cz += z; }
  cx /= h.length; cz /= h.length;
  const k = 0.82;              // how far the top has drawn in
  const top = h.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k]);
  const pos = [];
  for (let i = 0; i < h.length; i++) {
    const j = (i + 1) % h.length;
    const a = h[i], b = h[j], ta = top[i], tb = top[j];
    pos.push(a[0], 0, a[1], ta[0], height, ta[1], b[0], 0, b[1]);
    pos.push(b[0], 0, b[1], ta[0], height, ta[1], tb[0], height, tb[1]);
    pos.push(cx, height, cz, tb[0], height, tb[1], ta[0], height, ta[1]);
  }
  return triGeo(pos, 0.25);
}

/**
 * A pitched roof over an oriented rectangle, `eave` metres of overhang.
 * rise: ridge height above the wall top. inset > 0 makes a mansard: steep
 * sides up to `rise`, then a flat top inset that far.
 */
function hipRoof(r, y, eave, rise, inset = 0) {
  const { cx, cz, ux, uz } = r;
  const hl = r.hl + eave, hw = r.hw + eave;
  const P = (a, b, yy) => [cx + ux * a - uz * b, yy, cz + uz * a + ux * b];
  const c = [P(-hl, -hw, y), P(hl, -hw, y), P(hl, hw, y), P(-hl, hw, y)];
  const pos = [];
  const tri = (a, b, d) => pos.push(...a, ...b, ...d);
  const quad = (a, b, d, e) => { tri(a, b, d); tri(a, d, e); };
  const top = y + rise;
  if (inset > 0) {
    const il = Math.max(0.5, hl - inset), iw = Math.max(0.5, hw - inset);
    const t = [P(-il, -iw, top), P(il, -iw, top), P(il, iw, top), P(-il, iw, top)];
    for (let i = 0; i < 4; i++) quad(c[i], t[i], t[(i + 1) % 4], c[(i + 1) % 4]);
    quad(t[0], t[3], t[2], t[1]);
  } else {
    const run = Math.max(0, hl - hw);
    const r0 = P(-run, 0, top), r1 = P(run, 0, top);
    quad(c[0], r0, r1, c[1]);          // the long sides
    quad(c[2], r1, r0, c[3]);
    tri(c[1], r1, c[2]);               // the hipped ends
    tri(c[3], r0, c[0]);
  }
  // the underside of the eaves, so the overhang is not paper-thin from below
  const u = [P(-hl, -hw, y - 0.14), P(hl, -hw, y - 0.14), P(hl, hw, y - 0.14), P(-hl, hw, y - 0.14)];
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4], d = u[(i + 1) % 4], e = u[i];
    pos.push(...a, ...d, ...e, ...a, ...b, ...d);   // fascia board round the edge
  }
  return triGeo(pos, 0.3);
}

/**
 * A band round the footprint between y0 and y1, standing `out` metres proud
 * of the wall: a cornice, a ledge. Coloured by vertex, merged per tile.
 */
function ringGeo(m, y0, y1, out, hex) {
  const n = m.length / 2;
  if (n < 3) return null;
  const s = signedArea(m) > 0 ? 1 : -1;
  const nrm = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    let dx = m[j * 2] - m[i * 2], dz = m[j * 2 + 1] - m[i * 2 + 1];
    const L = Math.hypot(dx, dz) || 1;
    dx /= L; dz /= L;
    nrm.push(s * dz, -s * dx);
  }
  // mitred outer corners, capped so a sharp corner does not spike
  const off = [];
  for (let i = 0; i < n; i++) {
    const p = (i + n - 1) % n;
    let ax = nrm[p * 2] + nrm[i * 2], az = nrm[p * 2 + 1] + nrm[i * 2 + 1];
    const L = Math.hypot(ax, az) || 1;
    ax /= L; az /= L;
    const k = Math.min(2.2, 1 / Math.max(0.3, ax * nrm[i * 2] + az * nrm[i * 2 + 1]));
    off.push(m[i * 2] + ax * out * k, m[i * 2 + 1] + az * out * k);
  }
  const pos = [], shade = [];
  const quad = (a, b, c, d, k) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); for (let q = 0; q < 6; q++) shade.push(k); };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ia = [m[i * 2], m[i * 2 + 1]], ib = [m[j * 2], m[j * 2 + 1]];
    const oa = [off[i * 2], off[i * 2 + 1]], ob = [off[j * 2], off[j * 2 + 1]];
    quad([oa[0], y0, oa[1]], [ob[0], y0, ob[1]], [ob[0], y1, ob[1]], [oa[0], y1, oa[1]], 1);      // face
    quad([ia[0], y1, ia[1]], [oa[0], y1, oa[1]], [ob[0], y1, ob[1]], [ib[0], y1, ib[1]], 1.08);   // top
    quad([ia[0], y0, ia[1]], [ib[0], y0, ib[1]], [ob[0], y0, ob[1]], [oa[0], y0, oa[1]], 0.5);    // underside
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const c = new THREE.Color(hex), cols = new Float32Array(pos.length);
  for (let i = 0; i < pos.length / 3; i++) {
    // undersides read darker: the ledge shades itself
    const k = shade[i];
    cols[i * 3] = c.r * k; cols[i * 3 + 1] = c.g * k; cols[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

/* ------------------------------------------------------------ props */
const EMPTY = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([], 3)); return g; })();

function propModel(kind) {
  switch (kind) {
    case 'tank': return merge([      // a water tank up on a little steel frame
      part(new THREE.CylinderGeometry(0.62, 0.62, 1.25, 12), 0xffffff, [0, 1.35, 0]),
      part(new THREE.CylinderGeometry(0.64, 0.64, 0.08, 12), 0xffffff, [0, 2.0, 0]),
      ...[[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]].map(([x, z]) =>
        part(new THREE.BoxGeometry(0.07, 0.75, 0.07), 0x5a5d60, [x, 0.37, z]))
    ]);
    case 'dish': return merge([
      part(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), 0x8a8d90, [0, 0.45, 0]),
      part(new THREE.SphereGeometry(0.45, 12, 6, 0, TAU, 0, 0.9), 0xf0f0ec, [0.08, 1.0, 0], [0, 0, Math.PI / 2 + 0.6], [1, 0.45, 1]),
      part(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 4), 0x6a6d70, [0.3, 1.1, 0], [0, 0, -0.9])
    ]);
    case 'vent': return merge([      // an air-conditioning unit with its fan grille
      part(new THREE.BoxGeometry(1.2, 0.85, 0.8), 0xc9ccd0, [0, 0.43, 0], [0, 0, 0], [1, 1, 1], 0.25),
      part(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12), 0x3a3d40, [0.2, 0.87, 0]),
      part(new THREE.BoxGeometry(0.1, 0.3, 0.1), 0x8a8d90, [-0.45, 1.0, 0.2])
    ]);
    case 'chimney': return merge([   // a brick stack with two clay pots
      part(new THREE.BoxGeometry(0.7, 1.5, 0.95), 0x9a5a44, [0, 0.75, 0], [0, 0, 0], [1, 1, 1], 0.2),
      part(new THREE.BoxGeometry(0.82, 0.1, 1.07), 0xb8b0a4, [0, 1.5, 0]),
      part(new THREE.CylinderGeometry(0.12, 0.14, 0.4, 8), 0xa8603a, [0, 1.75, -0.22]),
      part(new THREE.CylinderGeometry(0.12, 0.14, 0.32, 8), 0xa8603a, [0, 1.71, 0.22])
    ]);
    case 'aerial': return merge([
      part(new THREE.CylinderGeometry(0.025, 0.035, 3.2, 5), 0x7a7d80, [0, 1.6, 0]),
      ...[2.4, 2.75, 3.05].map((y, k) => part(new THREE.BoxGeometry(1.1 - k * 0.25, 0.025, 0.025), 0x8a8d90, [0, y, 0])),
      part(new THREE.BoxGeometry(0.025, 0.025, 0.7), 0x8a8d90, [0, 2.6, 0])
    ]);
    case 'rebar': return merge([     // the column stubs of the next storey, never built
      ...[[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]].flatMap(([x, z]) => [
        part(new THREE.BoxGeometry(0.4, 0.9, 0.4), 0xb8b0a0, [x, 0.45, z], [0, 0, 0], [1, 1, 1], 0.2),
        ...[[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]].map(([a, b]) =>
          part(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 4), 0x6a3a28, [x + a, 1.45, z + b], [a * 0.8, 0, b * 0.8]))
      ])
    ]);
    case 'terrace': return merge([   // a roof garden: planters and a pergola
      part(new THREE.BoxGeometry(2.6, 0.45, 0.6), 0xa8603a, [0, 0.22, -1.2]),
      part(new THREE.IcosahedronGeometry(0.55, 1), 0x4f7a35, [-0.7, 0.75, -1.2], [0, 0, 0], [1, 0.8, 0.7]),
      part(new THREE.IcosahedronGeometry(0.5, 1), 0x5f8a3c, [0.6, 0.7, -1.2], [0, 0, 0], [1, 0.9, 0.7]),
      ...[[-1.3, 0.2], [1.3, 0.2], [-1.3, 1.6], [1.3, 1.6]].map(([x, z]) =>
        part(new THREE.BoxGeometry(0.08, 2.2, 0.08), 0xe8e2d4, [x, 1.1, z])),
      ...[0.2, 0.9, 1.6].map(z => part(new THREE.BoxGeometry(2.8, 0.06, 0.08), 0xe8e2d4, [0, 2.2, z]))
    ]);
    case 'stair': return merge([     // the box over the stairwell on a flat roof
      part(new THREE.BoxGeometry(2.6, 2.5, 2.4), 0xffffff, [0, 1.25, 0], [0, 0, 0], [1, 1, 1], 0.3),
      part(new THREE.BoxGeometry(2.8, 0.15, 2.6), 0xd0ccc4, [0, 2.55, 0]),
      part(new THREE.BoxGeometry(0.05, 1.9, 0.9), 0x4a4038, [1.31, 0.95, 0.4])
    ]);
  }
  return null;
}

/** An awning over one shop bay: +x points away from the wall, centred on z = 0. */
function awningModel() {
  const parts = [];
  const N = 7, W = 2.6, D = 1.35;
  for (let k = 0; k < N; k++) {
    const z0 = -W / 2 + (k / N) * W, z1 = -W / 2 + ((k + 1) / N) * W;
    const shade = k % 2 ? 0.62 : 1.0;
    const pos = [0, 3.05, z0, D, 2.6, z0, D, 2.6, z1, 0, 3.05, z0, D, 2.6, z1, 0, 3.05, z1,
                 // the scalloped valance hanging off the front
                 D, 2.6, z0, D, 2.32, (z0 + z1) / 2, D, 2.6, z1];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    parts.push(part(g, new THREE.Color(1, 1, 1).multiplyScalar(shade).getHex()));
  }
  // side cheeks and the two iron arms
  for (const z of [-W / 2, W / 2]) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 3.05, z, D, 2.6, z, 0, 2.6, z], 3));
    g.computeVertexNormals();
    parts.push(part(g, 0xdddddd));
    parts.push(part(new THREE.CylinderGeometry(0.015, 0.015, 1.45, 4), 0x2a2a2a, [D / 2, 2.65, z * 0.95], [0, 0, 1.25]));
  }
  return merge(parts);
}

/* -------------------------------------------------------------- landmarks */
function domeParts(out, cx, cz, y, r, hex, rng, finial = 0xd8b04a, drum = true) {
  const dh = drum ? r * 0.38 : 0;
  if (drum) {
    out.push(part(new THREE.CylinderGeometry(r * 1.02, r * 1.06, dh, 28, 1, true), 0xd8d0c0, [cx, y + dh / 2, cz]));
    // the ring of little windows round the drum
    const n = Math.max(8, Math.round(r * 1.6));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      out.push(part(new THREE.BoxGeometry(0.12, dh * 0.5, Math.min(1.4, r * 0.18)), 0x2a2622,
        [cx + Math.cos(a) * r * 1.03, y + dh * 0.5, cz - Math.sin(a) * r * 1.03], [0, a, 0]));
    }
    out.push(part(new THREE.CylinderGeometry(r * 1.1, r * 1.1, r * 0.06, 28), 0xc8c0b0, [cx, y + dh, cz]));
  }
  out.push(part(new THREE.SphereGeometry(r, 28, 12, 0, TAU, 0, Math.PI / 2), hex, [cx, y + dh, cz], [0, 0, 0], [1, 0.92, 1], 0.25));
  // ribs down the dome
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    out.push(part(new THREE.TorusGeometry(r * 1.003, Math.max(0.04, r * 0.012), 3, 14, Math.PI / 2), hex,
      [cx, y + dh, cz], [0, a, 0], [1, 0.92, 1]));
  }
  out.push(part(new THREE.CylinderGeometry(r * 0.08, r * 0.1, r * 0.25, 10), 0xd8d0c0, [cx, y + dh + r * 0.92 + r * 0.1, cz]));
  out.push(part(new THREE.ConeGeometry(r * 0.05, r * 0.4, 8), finial, [cx, y + dh + r * 0.92 + r * 0.42, cz]));
  void rng;
}

function minaret(out, x, z, base, height, lead) {
  const r = 1.25;
  out.push(part(new THREE.CylinderGeometry(r * 1.25, r * 1.35, base + 4, 10), 0xd8d0c0, [x, (base + 4) / 2, z]));
  out.push(part(new THREE.CylinderGeometry(r * 0.92, r, height - base - 4, 12), 0xe6dfd2, [x, base + 4 + (height - base - 4) / 2, z]));
  // the balconies the call to prayer was sung from
  for (const f of [0.62, 0.8]) {
    const y = base + (height - base) * f;
    out.push(part(new THREE.CylinderGeometry(r * 1.55, r * 1.05, 0.7, 12), 0xd8d0c0, [x, y, z]));
    out.push(part(new THREE.CylinderGeometry(r * 1.6, r * 1.6, 0.9, 12, 1, true), 0xcfc7b6, [x, y + 0.75, z]));
  }
  out.push(part(new THREE.ConeGeometry(r * 1.05, 9, 12), lead, [x, height + 4.5, z]));
  out.push(part(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 5), 0xd8b04a, [x, height + 9.6, z]));
}

/* ------------------------------------------------------------------ build */
export class Detail {
  constructor(city, add, roofMaterial) {
    this.city = city;
    this.det = city.detail || {};
    this.add = add;                       // (geo, key, mat, cx, cz) -> batch
    this.roofMaterial = roofMaterial;     // colour -> material
    this.vc = vcMaterial({ roughness: 0.82, side: THREE.DoubleSide });
    this.landVc = vcMaterial({ roughness: 0.55, metalness: 0.25 });
    this.rng = makeRng(city.id.length * 7 + 19);
    this.props = {};
    this.awnings = [];
    this.stats = { cornices: 0, roofs: 0, props: 0, awnings: 0, landmarks: 0 };
  }

  /**
   * One building. Returns true when its roof has been dealt with here (a
   * pitched roof, a pyramid), so the caller should not lay the flat roof slab.
   */
  building(b) {
    const { m: raw, height, kind, name, cx, cz, shade, special, roofColour } = b;
    const m = openRing(raw);
    const det = this.det, rng = this.rng;
    if (special === 'pyramid' || special === 'mastaba') return true;
    const wall = new THREE.Color(shade);
    let roofDone = false;

    // cornice at the roofline, and a ledge between a shopfront and the floors above
    const curtain = kind === 'civic' && height > 38;
    if ((kind === 'block' || kind === 'civic' || kind === 'house') && height >= 5 && height < 90 && !curtain && special !== 'arcade') {
      const stone = wall.clone().multiplyScalar(1.12).lerp(new THREE.Color(0xe8e2d4), 0.25).getHex();
      const g = ringGeo(m, height - 0.55, height + 0.05, 0.38, stone);
      if (g) { this.add(g, 'cornice', this.vc, cx, cz); this.stats.cornices++; }
      // a second, slimmer moulding under it, where the footprint is simple enough to afford it
      if (m.length <= 24) {
        const g2 = ringGeo(m, height - 0.85, height - 0.7, 0.16, stone);
        if (g2) this.add(g2, 'cornice', this.vc, cx, cz);
      }
      if (b.shop) {
        const g3 = ringGeo(m, STOREY - 0.08, STOREY + 0.14, 0.22, stone);
        if (g3) this.add(g3, 'cornice', this.vc, cx, cz);
      }
    }

    const r = orientedRect(m);
    // landmarks: domes, minarets, spires
    if (r && (special === 'mosque' || special === 'domed' || special === 'church' || special === 'spire')) {
      const parts = [];
      const lead = det.domes || 0x8c9399;
      if (special === 'spire') {
        const tx = r.cx + r.ux * (r.hl - 4), tz = r.cz + r.uz * (r.hl - 4);
        const th = height + 14;
        parts.push(part(new THREE.BoxGeometry(7, th, 7), wall.getHex(), [tx, th / 2, tz], [0, Math.atan2(-r.uz, r.ux), 0], [1, 1, 1], 0.2));
        parts.push(part(new THREE.ConeGeometry(5.2, 20, 4), lead, [tx, th + 10, tz], [0, Math.atan2(-r.uz, r.ux) + Math.PI / 4, 0]));
        parts.push(part(new THREE.CylinderGeometry(0.08, 0.08, 3, 5), 0xd8b04a, [tx, th + 21, tz]));
      } else {
        const big = Math.min(16, Math.max(3, r.hw * 0.62));
        domeParts(parts, r.cx, r.cz, height, big, lead, rng, special === 'mosque' ? 0xd8b04a : 0xc8c0a8);
        if (special === 'mosque' || special === 'domed') {
          // half-domes and little domes stepping down round the big one
          for (const s of [-1, 1]) {
            const d = Math.min(r.hl - big * 0.4, big * 1.15);
            if (d > big * 0.6) {
              domeParts(parts, r.cx + r.ux * s * d, r.cz + r.uz * s * d, height, big * 0.45, lead, rng, 0xd8b04a, false);
            }
          }
        }
        if (special === 'mosque') {
          const many = /ayasofya|hagia|süleymaniye|suleymaniye/i.test(name) ? 4 : /sultan ?ahmet/i.test(name) ? 6 : 2;
          const corners = [[1, 1], [-1, -1], [1, -1], [-1, 1], [0, 1], [0, -1]];
          const mh = height + Math.max(26, big * 3.2);
          for (let k = 0; k < many; k++) {
            const [a, bb] = corners[k];
            const x = r.cx + r.ux * a * (r.hl + 2.5) - r.uz * bb * (r.hw + 2.5);
            const z = r.cz + r.uz * a * (r.hl + 2.5) + r.ux * bb * (r.hw + 2.5);
            minaret(parts, x, z, Math.min(height, 12), mh, lead);
          }
        }
      }
      this.add(merge(parts), 'landmark', this.landVc, cx, cz);
      this.stats.landmarks++;
    }

    // a pitched roof where the footprint is a plain box
    const style = special === 'temple' ? 'temple' : det.roofs || 'flat';
    if (r && style !== 'flat' && !curtain && special !== 'arcade' && special !== 'mosque' && special !== 'domed' &&
        special !== 'church' && (kind === 'house' || kind === 'block' || special === 'temple') &&
        r.fill > 0.8 && r.hw <= (style === 'mansard' ? 15 : 12) && height <= (style === 'mansard' ? 32 : 26) && height >= 3) {
      let geo;
      if (style === 'mansard') geo = hipRoof(r, height, 0.15, 3.0, 1.9);
      else if (style === 'temple') {
        const grand = special === 'temple';
        geo = hipRoof(r, height, grand ? 2.4 : 0.9, (r.hw + (grand ? 2.4 : 0.9)) * (grand ? 0.72 : 0.6));
      } else geo = hipRoof(r, height, 0.45, (r.hw + 0.45) * 0.5);
      this.add(colourise(geo, roofColour), 'roof', this.roofMaterial(roofColour), cx, cz);
      this.stats.roofs++;
      roofDone = true;
    }

    // things on a flat roof
    if (!roofDone && r && height >= 6 && height < 70 && !special && det.rooftop && r.hw > 2.5) {
      const kinds = det.rooftop.slice();
      if (kind === 'block' || kind === 'civic') kinds.push('stair', 'vent');
      const n = Math.min(4, 1 + Math.floor(r.area / 260)) + (rng() < 0.5 ? 0 : -1);
      for (let k = 0; k < n; k++) {
        const kd = rng.pick(kinds);
        const a = (rng() - 0.5) * 2 * Math.max(0, r.hl - 2.2), bq = (rng() - 0.5) * 2 * Math.max(0, r.hw - 2.2);
        const x = r.cx + r.ux * a - r.uz * bq, z = r.cz + r.uz * a + r.ux * bq;
        if (!inside(m, x, z)) continue;
        const list = this.props[kd] || (this.props[kd] = []);
        const col = kd === 'tank' ? rng.pick([0xe8e8e4, 0x2a2c30, 0x3a6a9a, 0xd8d0c0])
                  : kd === 'stair' ? wall.getHex() : 0xffffff;
        list.push({ x, z, y: height, yaw: Math.atan2(-r.uz, r.ux) + (kd === 'dish' ? rng() * TAU : 0), colour: col });
        this.stats.props++;
      }
    }

    // awnings over a shopfront, bay by bay along the walls that face a street
    if (b.shop && b.roads && det.awnings && rng() < 0.62) {
      const n = m.length / 2, s = signedArea(m) > 0 ? 1 : -1;
      const colour = rng.pick(det.awnings);
      const bay = 3.0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = m[i * 2], az = m[i * 2 + 1], bx = m[j * 2], bz = m[j * 2 + 1];
        const L = Math.hypot(bx - ax, bz - az);
        if (L < 3.4) continue;
        const dx = (bx - ax) / L, dz = (bz - az) / L;
        const nx = s * dz, nz = -s * dx;
        const mx = (ax + bx) / 2 + nx * 3, mz = (az + bz) / 2 + nz * 3;
        if (b.roads.edgeDist(mx, mz, 10, w => w.drive || w.cls === 'pedestrian' || w.cls === 'living_street') > 5) continue;
        // the facade shader numbers bays by distance along the wall's tangent
        const tx = -nz, tz = nx;
        const sa = ax * tx + az * tz, sb = bx * tx + bz * tz;
        const lo = Math.min(sa, sb) + 0.3, hi = Math.max(sa, sb) - 0.3;
        for (let k = Math.ceil(lo / bay); (k + 1) * bay <= hi; k++) {
          const c = (k + 0.5) * bay, t = (c - sa) / (sb - sa);
          this.awnings.push({ x: ax + (bx - ax) * t + nx * 0.02, z: az + (bz - az) * t + nz * 0.02,
                              yaw: Math.atan2(-nz, nx), colour });
          this.stats.awnings++;
        }
      }
    }
    return roofDone;
  }

  /** Once every building is in: the instanced props and awnings. */
  finish(scene, meshes) {
    const keep = m => { scene.add(m); meshes.push(m); return m; };
    this.lods = [];
    for (const [kd, list] of Object.entries(this.props)) {
      const geo = propModel(kd);
      if (!geo || !list.length) continue;
      this.lods.push(new LodSet(list, [{ hi: geo, lo: EMPTY, mat: vcMaterial({ roughness: 0.7, metalness: 0.15 }), colours: true, shadow: true }], keep, 80));
    }
    if (this.awnings.length) {
      const hi = awningModel();
      const lo = merge([part(new THREE.PlaneGeometry(1.4, 2.6).rotateY(Math.PI / 2).rotateZ(-0.32).translate(0.68, 2.83, 0), 0xdddddd)]);
      this.lods.push(new LodSet(this.awnings, [{ hi, lo, mat: vcMaterial({ roughness: 0.85, side: THREE.DoubleSide }), colours: true, shadow: true }], keep, 60));
    }
  }

  update(camPos, near) {
    for (const l of this.lods || []) l.update(camPos.x, camPos.z, near * 1.5);
  }
}

function inside(m, x, z) {
  let c = false;
  for (let i = 0, j = m.length - 2; i < m.length; j = i, i += 2) {
    const xi = m[i], zi = m[i + 1], xj = m[j], zj = m[j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

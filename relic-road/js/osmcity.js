/**
 * Builds a walkable 3D district out of real map data.
 *
 * data/<city>.json holds the district's streets, building footprints and
 * heights, water and parks, straight from OpenStreetMap (see tools/fetch_city.py).
 * Everything here turns that into geometry: footprints are extruded to their
 * real heights, streets are laid as ribbons along their real centrelines, and
 * the lot is merged into a handful of meshes per 250 m tile so a whole city
 * district draws quickly.
 *
 * Coordinates in the file are decimetres, x east and z south of the centre.
 */
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { material } from './textures.js';
import { patchFacade, facadeAttributes } from './facade.js';
import { Detail, landmarkKind, pyramidGeo, mastabaGeo, colourise } from './detail.js';

const TILE = 250;               // metres per culling tile
const ROAD_Y = 0.03;            // street surface sits just above the ground plane
const PATH_Y = 0.05;
const WATER_Y = -0.35;
const GREEN_Y = 0.02;

/** Default heights (metres) when the map has no height for a building. */
const DEFAULT_H = { house: 9, block: 19, civic: 24, industrial: 11, monument: 26 };

export async function loadCity(id, onProgress) {
  const res = await fetch(`./data/${id}.json`);
  if (!res.ok) throw new Error(`no map data for ${id}`);
  onProgress?.(0.35);
  const data = await res.json();
  onProgress?.(0.5);
  return sanitise(data);
}

/* The map is edited by people, and now and then somebody draws a "building"
 * over half a park (Berlin's data has a six-point one covering 0.5 km² of the
 * Tiergarten). Nothing real in these districts is anywhere near 60,000 m². */
const MAX_FOOTPRINT = 60000;
function sanitise(data) {
  const bogus = new Set();
  data.buildings = data.buildings.filter(rec => {
    const f = rec[2], n = f.length / 2;
    let a = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      a += f[i * 2] * f[j * 2 + 1] - f[j * 2] * f[i * 2 + 1];
    }
    const ok = Math.abs(a) / 2 / 100 <= MAX_FOOTPRINT;       // decimetres squared -> m²
    if (!ok && rec[3]) bogus.add(rec[3]);
    return ok;
  });
  if (bogus.size) data.places = data.places.filter(p => !(bogus.has(p.n) && p.k === 'building'));
  return data;
}

/* ------------------------------------------------------------------ helpers */
function toMetres(flat) {
  const out = new Array(flat.length);
  for (let i = 0; i < flat.length; i++) out[i] = flat[i] / 10;
  return out;
}

function centroid(flat) {
  let x = 0, z = 0;
  const n = flat.length / 2;
  for (let i = 0; i < n; i++) { x += flat[i * 2]; z += flat[i * 2 + 1]; }
  return [x / n, z / n];
}

function tileKey(x, z) {
  return `${Math.floor(x / TILE)},${Math.floor(z / TILE)}`;
}

/** Collects geometry per (tile, material) so each tile can be culled on its own. */
class Batcher {
  constructor(scene) {
    this.scene = scene;
    this.groups = new Map();
    this.meshes = [];
  }

  add(geo, matKey, mat, x, z) {
    const key = `${tileKey(x, z)}|${matKey}`;
    let g = this.groups.get(key);
    if (!g) { g = { mat, geos: [] }; this.groups.set(key, g); }
    g.geos.push(geo);
  }

  finish(shadows = true) {
    for (const [, g] of this.groups) {
      if (!g.geos.length) continue;
      const merged = BufferGeometryUtils.mergeGeometries(g.geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, g.mat);
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.meshes.push(mesh);
      g.geos.forEach(x => x.dispose());
    }
    this.groups.clear();
    return this.meshes;
  }
}

/** A stable number in [0,1) from a position: same building, same colour, every run. */
function hash01(x, z) {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/** Pick from a palette by position, with a little lightness variation.
 *  The shade steps are quantised: neighbours differ, but the whole district
 *  still shares a handful of materials. */
const SHADES = [0.93, 1.0, 1.07];
function pickColour(palette, x, z) {
  const base = palette[Math.floor(hash01(x, z) * palette.length) % palette.length];
  const c = new THREE.Color(base);
  c.multiplyScalar(SHADES[Math.floor(hash01(z, x) * SHADES.length) % SHADES.length]);
  return c.getHex();
}

/* Painting a texture is slow, so each texture is made once per material name
 * and every colour is a cheap clone that shares those maps. */
const tintCache = new Map();
function tinted(name, colour, opts = {}) {
  const key = `${name}|${colour}|${opts.repeat || 1}`;
  let m = tintCache.get(key);
  if (!m) {
    m = material(name, opts).clone();         // clone shares the texture maps
    m.color.setHex(colour);
    tintCache.set(key, m);
  }
  return m;
}

/* Building walls get their own materials (never shared with a roof or a path
 * that happens to have the same texture and colour) because they carry the
 * facade shader. Each building's colour rides in its vertices, so a tile needs
 * one wall material per texture, not one per paint colour: far fewer draw calls. */
const wallCache = new Map();
function wallMaterial(name, style = {}) {
  const key = `${name}|${JSON.stringify(style)}`;
  let m = wallCache.get(key);
  if (!m) {
    m = patchFacade(material(name, { repeat: 1, roughness: 0.93 }).clone(), style);
    m.vertexColors = true;
    wallCache.set(key, m);
  }
  return m;
}

/** Point order decides which way a face points, and map data mixes the two.
 *  Anticlockwise is what Shape wants, so flip the clockwise ones. */
function ccw(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  if (a < 0) pts.reverse();
  return pts;
}

/** A flat polygon (park, water, plaza) as a horizontal mesh at height y. */
function polygonGeo(flat, y) {
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) pts.push(new THREE.Vector2(flat[i], flat[i + 1]));
  if (pts.length < 3) return null;
  ccw(pts);
  const shape = new THREE.Shape(pts);
  let geo;
  try {
    geo = new THREE.ShapeGeometry(shape);
  } catch {
    return null;
  }
  geo.rotateX(Math.PI / 2);          // the shape lies in XY; lay it flat so y -> z
  geo.translate(0, y, 0);
  return geo;
}

/** A street as a flat ribbon along its centreline. */
function ribbonGeo(flat, width, y) {
  const n = flat.length / 2;
  if (n < 2) return null;
  const pos = [], uv = [], idx = [];
  const half = width / 2;
  let run = 0;
  for (let i = 0; i < n; i++) {
    const x = flat[i * 2], z = flat[i * 2 + 1];
    // direction from the neighbouring points, so corners join without gaps
    const px = flat[Math.max(0, i - 1) * 2], pz = flat[Math.max(0, i - 1) * 2 + 1];
    const nx = flat[Math.min(n - 1, i + 1) * 2], nz = flat[Math.min(n - 1, i + 1) * 2 + 1];
    let dx = nx - px, dz = nz - pz;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    if (i > 0) run += Math.hypot(x - flat[(i - 1) * 2], z - flat[(i - 1) * 2 + 1]);
    pos.push(x - dz * half, y, z + dx * half);
    pos.push(x + dz * half, y, z - dx * half);
    uv.push(0, run / width, 1, run / width);
    if (i < n - 1) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** One building: its footprint pushed up to its height, with a flat roof. */
function buildingGeo(flat, height) {
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) pts.push(new THREE.Vector2(flat[i], -flat[i + 1]));
  if (pts.length < 3) return null;
  ccw(pts);
  let geo;
  try {
    geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: height, bevelEnabled: false, curveSegments: 1 });
  } catch {
    return null;
  }
  geo.rotateX(-Math.PI / 2);         // extruded upward in Y, footprint back in x/z
  // walls get a texture scale in metres; the roof keeps the small default
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * 0.25, uv.getY(i) * 0.25);
    void pos;
  }
  geo.computeVertexNormals();
  return geo;
}

/* -------------------------------------------------------------------- build */
/**
 * @param {World} world   collision + light host (from world.js)
 * @param {object} data   the parsed city json
 * @param {object} look   per-city palette: { wall:{kind:matName}, tint:{kind:0xrrggbb},
 *                        road, path, water, green, ground }
 * @param {Roads} roads   the street index (roads.js), used to decide which
 *                        buildings are on a street and get shopfronts
 */
export function buildCity(world, data, look, onProgress, roads = null, city = null) {
  const scene = world.scene;
  const batch = new Batcher(scene);
  // cornices, pitched roofs, rooftop clutter, awnings and the landmarks' domes
  // and minarets (detail.js); the pitched roofs show their undersides at the eaves
  // one roof material for the whole city: each roof's colour is in its vertices
  const roofVC = material(look.roofMat || 'tile', { repeat: 1, roughness: 0.85 }).clone();
  roofVC.vertexColors = true;
  roofVC.side = THREE.DoubleSide;
  const roofMat = () => roofVC;
  const detail = city ? new Detail(city, (g, key, mat, x, z) => batch.add(g, key, mat, x, z), roofMat) : null;
  const style = (city && city.detail) || {};
  const stats = { buildings: 0, roads: 0, tallest: 0, tallestName: '' };

  // ---- ground: one big plane under everything
  const size = data.half * 2 + 600;
  const groundGeo = new THREE.PlaneGeometry(size, size, 1, 1);
  groundGeo.rotateX(-Math.PI / 2);
  const gu = groundGeo.attributes.uv;
  for (let i = 0; i < gu.count; i++) gu.setXY(i, gu.getX(i) * size * 0.08, gu.getY(i) * size * 0.08);
  const groundMesh = new THREE.Mesh(groundGeo, tinted(look.ground || 'dirt', look.groundTint || 0xa8a296, {}));
  groundMesh.receiveShadow = true;
  groundMesh.position.y = -0.02;
  scene.add(groundMesh);
  batch.meshes.push(groundMesh);
  world.collider(0, -1.0, 0, size, 2, size, 0, 'ground');      // the street surface to stand on

  // ---- parks and water
  for (const flat of data.green) {
    const m = toMetres(flat);
    const geo = polygonGeo(m, GREEN_Y);
    if (!geo) continue;
    const [cx, cz] = centroid(m);
    batch.add(geo, 'green', tinted(look.green || 'foliage', look.greenTint || 0x8fbf6a,
              { repeat: 8, roughness: 1 }), cx, cz);
  }
  for (const flat of data.water) {
    const m = toMetres(flat);
    const geo = polygonGeo(m, WATER_Y);
    if (!geo) continue;
    const [cx, cz] = centroid(m);
    batch.add(geo, 'water', waterMaterial(look), cx, cz);
  }
  onProgress?.(0.6);

  // ---- streets, pavements and rails
  for (const [cls, width, flat] of data.roads) {
    const m = toMetres(flat);
    const foot = cls === 'footway' || cls === 'path' || cls === 'steps' || cls === 'pedestrian' || cls === 'cycleway';
    const geo = ribbonGeo(m, width, foot ? PATH_Y : ROAD_Y);
    if (!geo) continue;
    const [cx, cz] = centroid(m);
    batch.add(geo, foot ? 'path' : 'road',
              tinted(foot ? (look.path || 'tile') : (look.road || 'asphalt'),
                     foot ? (look.pathTint || 0xb9b2a4) : (look.roadTint || 0x6d6f73),
                     { repeat: 1, roughness: 0.95}),
              cx, cz);
    stats.roads++;
  }
  for (const [, flat] of data.rail) {
    const m = toMetres(flat);
    const geo = ribbonGeo(m, 3.2, ROAD_Y + 0.01);
    if (!geo) continue;
    const [cx, cz] = centroid(m);
    batch.add(geo, 'rail', material('rust', { repeat: 2, roughness: 0.8 }), cx, cz);
  }
  onProgress?.(0.72);

  // ---- buildings
  for (const rec of data.buildings) {
    const [kind, h, flat, name] = rec;
    const m = toMetres(flat);
    const special = landmarkKind(name, kind, city && city.id);
    // a monument with no name and no height is a ruin or an old tomb, not a
    // 26 m block: Giza's mastabas stand five or six metres
    let height = h || DEFAULT_H[kind] || 14;
    if (!h && kind === 'monument' && (!name || special === 'mastaba')) height = 4.5 + hash01(m[1], m[0]) * 2.5;
    // the pyramids are pyramids, not prisms; mastabas lean in as they rise
    const geo = special === 'pyramid' ? pyramidGeo(m, height)
              : special === 'mastaba' ? mastabaGeo(m, height) : buildingGeo(m, height);
    if (!geo) continue;
    const [cx, cz] = centroid(m);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < m.length; i += 2) {
      minX = Math.min(minX, m[i]); maxX = Math.max(maxX, m[i]);
      minZ = Math.min(minZ, m[i + 1]); maxZ = Math.max(maxZ, m[i + 1]);
    }

    // a building with a street at its door gets a shop on the ground floor
    let onStreet = false;
    if (roads && (kind === 'block' || kind === 'civic')) {
      const rad = Math.hypot(maxX - minX, maxZ - minZ) / 2;
      const d = roads.edgeDist(cx, cz, rad + 14,
        w => w.drive || w.cls === 'pedestrian' || w.cls === 'living_street');
      onStreet = d - rad < 7;
    }
    const shop = facadeAttributes(geo, kind, height, hash01(cx * 1.7, cz * 2.3), onStreet,
                                  special === 'pyramid' || special === 'arcade' || special === 'mastaba'
                                    ? (special === 'mastaba' ? 'pyramid' : special) : null);

    const matName = (look.wall && look.wall[kind]) || 'concrete';
    const palette = (look.palette && look.palette[kind]) || [(look.tint && look.tint[kind]) || 0xc9c4b8];
    const shade = pickColour(palette, cx, cz);
    batch.add(colourise(geo, shade), `wall|${matName}`, wallMaterial(matName, style), cx, cz);

    // a thin roof slab on top, in the city's roof colours (tiles, zinc, concrete),
    // unless detail.js has given it a pitched roof (or it is a pyramid)
    const roofPal = (look.roof && (look.roof[kind] || look.roof.all)) || null;
    const roofDone = detail ? detail.building({ m, height, kind, name, cx, cz, shade, special, shop, roads,
      roofColour: roofPal ? pickColour(roofPal, cz, cx) : null }) : false;
    if (roofPal && !roofDone) {
      const roof = buildingGeo(m, 0.55);
      if (roof) {
        roof.translate(0, height, 0);
        const rc = pickColour(roofPal, cz, cx);
        batch.add(colourise(roof, rc), 'roof', roofVC, cx, cz);
      }
    }

    // collision: the footprint's bounding box is enough to keep the player out
    world.collider((minX + maxX) / 2, height / 2, (minZ + maxZ) / 2,
                   maxX - minX, height, maxZ - minZ, 0, 'building');
    stats.buildings++;
    if (height > stats.tallest) { stats.tallest = height; stats.tallestName = name || ''; }
  }
  onProgress?.(0.9);

  if (detail) detail.finish(scene, batch.meshes);
  const meshes = batch.finish();
  // the world owns these, so they go when the city does
  for (const mesh of meshes) if (!world.meshes.includes(mesh)) world.meshes.push(mesh);
  if (detail) Object.assign(stats, detail.stats);
  return { meshes, stats, detail };
}

function waterMaterial(look) {
  return new THREE.MeshStandardMaterial({
    color: look.water || 0x2b6f9e, roughness: 0.12, metalness: 0.35,
    transparent: true, opacity: 0.92
  });
}

/* Places a treasure hunt has no business using. Memorials, graves and places
 * of mourning are skipped when siting relics, tables and spawn points. */
const SOLEMN = /(memorial|denkmal|mahnmal|gedenk|holocaust|cemetery|friedhof|grave|grab|tomb|mausoleum|cenotaph|war dead|ossuary|crematori)/i;

export function isSolemn(name = '') { return SOLEMN.test(name); }

/** Find a named landmark from the map data (case-insensitive, first match wins). */
export function findPlace(data, ...names) {
  for (const want of names) {
    const w = want.toLowerCase();
    const hit = data.places.find(p => p.n.toLowerCase() === w && !isSolemn(p.n)) ||
                data.places.find(p => p.n.toLowerCase().includes(w) && !isSolemn(p.n));
    if (hit) return hit;
  }
  return null;
}

/** True when (x, z) is within `clear` metres of a memorial or burial ground. */
export function nearSolemn(data, x, z, clear = 70) {
  return data.places.some(p => isSolemn(p.n) && Math.hypot(p.x - x, p.z - z) < clear);
}

/**
 * A spot on open ground near (x, z): steps outward until it is clear of buildings.
 *
 * `radius` is how far to look first. Some landmarks are bigger than that: the
 * Great Pyramid's base is 230 m across, so a relic sited on its map point and
 * searched for within 70 m ends up inside the pyramid, where nobody can reach
 * it. So when the near search finds nothing, it keeps widening (with finer
 * steps round the bigger rings) until it reaches open ground; only a district
 * with no open ground at all falls back to the landmark point itself.
 */
export function openSpotNear(world, x, z, radius = 60, avoid = null) {
  const probe = [];
  const clear = (px, pz) => {
    probe.length = 0;
    world.near(px, pz, 1.4, probe);
    return !probe.some(c => c.max.y > 0.6 && c.tag !== 'ground' &&
                            px > c.min.x - 0.9 && px < c.max.x + 0.9 &&
                            pz > c.min.z - 0.9 && pz < c.max.z + 0.9);
  };
  for (let r = 0; r <= radius; r += 4) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (clear(px, pz) && !(avoid && avoid(px, pz))) return { x: px, z: pz };
      if (r === 0) break;
    }
  }
  // wider: the nearest clear point on each ring, rings 3 m apart
  const far = Math.max(radius * 8, 600);
  for (let r = radius + 3; r <= far; r += 3) {
    const n = Math.max(16, Math.ceil((Math.PI * 2 * r) / 2.5));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (clear(px, pz) && !(avoid && avoid(px, pz))) return { x: px, z: pz };
    }
  }
  return { x, z };
}

/**
 * Which ground can be walked to from (sx, sz)? A flood fill over a coarse grid
 * of the district, with every solid collider (inflated by the walker's radius)
 * marked as wall. A cell counts as blocked if anything at all overlaps it, so
 * "reachable" here errs on the side of caution.
 *
 * Returns { ok(x, z), nearest(x, z) }: whether a point is reachable, and the
 * closest reachable point to it (null if the fill never got anywhere).
 */
export function walkableFrom(world, half, sx, sz, cell = 2) {
  const ext = half + 300;
  const n = Math.ceil((ext * 2) / cell);
  const idx = (x, z) => {
    const ix = Math.floor((x + ext) / cell), iz = Math.floor((z + ext) / cell);
    return ix < 0 || iz < 0 || ix >= n || iz >= n ? -1 : iz * n + ix;
  };
  const wall = new Uint8Array(n * n);
  const R = 0.45;
  for (const c of world.colliders) {
    if (c.tag === 'ground' || c.tag === 'edge' || c.max.y <= 0.6 || c.min.y > 1.7) continue;
    const x0 = Math.max(0, Math.floor((c.min.x - R + ext) / cell)), x1 = Math.min(n - 1, Math.floor((c.max.x + R + ext) / cell));
    const z0 = Math.max(0, Math.floor((c.min.z - R + ext) / cell)), z1 = Math.min(n - 1, Math.floor((c.max.z + R + ext) / cell));
    for (let iz = z0; iz <= z1; iz++) wall.fill(1, iz * n + x0, iz * n + x1 + 1);
  }
  const seen = new Uint8Array(n * n);
  const queue = new Int32Array(n * n);
  let head = 0, tail = 0, count = 0;
  const start = idx(sx, sz);
  if (start >= 0) {
    // the start cell itself may touch a lamp post; let the fill begin anyway
    seen[start] = 1; queue[tail++] = start;
    while (head < tail) {
      const c = queue[head++]; count++;
      const cx = c % n, cz = (c / n) | 0;
      if (cx > 0 && !seen[c - 1] && !wall[c - 1]) { seen[c - 1] = 1; queue[tail++] = c - 1; }
      if (cx < n - 1 && !seen[c + 1] && !wall[c + 1]) { seen[c + 1] = 1; queue[tail++] = c + 1; }
      if (cz > 0 && !seen[c - n] && !wall[c - n]) { seen[c - n] = 1; queue[tail++] = c - n; }
      if (cz < n - 1 && !seen[c + n] && !wall[c + n]) { seen[c + n] = 1; queue[tail++] = c + n; }
    }
  }
  const ok = (x, z) => { const i = idx(x, z); return i >= 0 && seen[i] === 1; };
  const nearest = (x, z) => {
    if (ok(x, z)) return { x, z };
    const cx = Math.floor((x + ext) / cell), cz = Math.floor((z + ext) / cell);
    for (let r = 1; r < n; r++) {
      let best = null, bestD = Infinity;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;       // the ring only
          const ix = cx + dx, iz = cz + dz;
          if (ix < 0 || iz < 0 || ix >= n || iz >= n) continue;
          const i = iz * n + ix;
          if (!seen[i] || i === start) continue;
          // a cell whose neighbours are all open, so the spot is not wedged in a corner
          if (wall[i - 1] || wall[i + 1] || wall[i - n] || wall[i + n]) continue;
          const d = dx * dx + dz * dz;
          if (d < bestD) { bestD = d; best = { x: (ix + 0.5) * cell - ext, z: (iz + 0.5) * cell - ext }; }
        }
      }
      if (best) return best;
      if (r > 400) break;
    }
    return null;
  };
  return { ok, nearest, cells: count };
}

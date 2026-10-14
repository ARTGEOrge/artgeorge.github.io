/**
 * The district's streets as polylines in metres, with a spatial grid over
 * their segments so "what road is near here" is cheap. Street furniture,
 * traffic, pedestrians and the shopfront test all ask it.
 */

/** Classes cars drive on. Service roads are yards and alleys, so not those. */
export const DRIVE = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential',
  'unclassified', 'living_street', 'motorway_link', 'trunk_link', 'primary_link',
  'secondary_link', 'tertiary_link']);

/** Classes people walk along. */
export const FOOT = new Set(['footway', 'path', 'pedestrian', 'steps', 'cycleway', 'track',
  'living_street', 'corridor']);

/** How fast traffic moves on each class, metres a second. */
export const SPEED = { motorway: 16, trunk: 14, primary: 12, secondary: 11, tertiary: 10,
  residential: 7.5, unclassified: 7, living_street: 4, motorway_link: 10, trunk_link: 9,
  primary_link: 9, secondary_link: 8, tertiary_link: 8 };

const CELL = 24;
const key = (ix, iz) => (ix + 2048) * 4096 + (iz + 2048);

export class Roads {
  constructor(data) {
    this.ways = [];
    for (const [cls, w, flat] of data.roads) {
      if (cls === 'elevator') continue;
      const n = flat.length / 2;
      if (n < 2) continue;
      const pts = new Float32Array(flat.length);
      for (let i = 0; i < flat.length; i++) pts[i] = flat[i] / 10;
      const cum = new Float32Array(n);
      for (let i = 1; i < n; i++) {
        cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
      }
      if (cum[n - 1] < 1) continue;
      this.ways.push({
        id: this.ways.length, cls, w, pts, cum, n, len: cum[n - 1],
        drive: DRIVE.has(cls), foot: FOOT.has(cls)
      });
    }

    // every segment goes in each cell its (widened) bounding box touches
    this.grid = new Map();
    for (const way of this.ways) {
      const p = way.pts, pad = way.w / 2 + 1;
      for (let i = 0; i < way.n - 1; i++) {
        const x0 = Math.min(p[i * 2], p[i * 2 + 2]) - pad, x1 = Math.max(p[i * 2], p[i * 2 + 2]) + pad;
        const z0 = Math.min(p[i * 2 + 1], p[i * 2 + 3]) - pad, z1 = Math.max(p[i * 2 + 1], p[i * 2 + 3]) + pad;
        for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++) {
          for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
            const k = key(ix, iz);
            let list = this.grid.get(k);
            if (!list) this.grid.set(k, (list = []));
            list.push(way.id, i);
          }
        }
      }
    }
    this.driveWays = this.ways.filter(w => w.drive);
    this.footWays = this.ways.filter(w => w.foot);
    this._seen = new Set();
  }

  /** Calls cb(way, segIndex) for every segment near (x, z), each once. */
  near(x, z, r, cb) {
    const seen = this._seen;
    seen.clear();
    for (let ix = Math.floor((x - r) / CELL); ix <= Math.floor((x + r) / CELL); ix++) {
      for (let iz = Math.floor((z - r) / CELL); iz <= Math.floor((z + r) / CELL); iz++) {
        const list = this.grid.get(key(ix, iz));
        if (!list) continue;
        for (let k = 0; k < list.length; k += 2) {
          const id = list[k], seg = list[k + 1];
          const tag = id * 65536 + seg;
          if (seen.has(tag)) continue;
          seen.add(tag);
          cb(this.ways[id], seg);
        }
      }
    }
  }

  /**
   * Distance from (x, z) to the nearest edge of a road that passes `filter`
   * (negative when you are standing on it). Infinity if none within r.
   */
  edgeDist(x, z, r, filter = null) {
    let best = Infinity;
    this.near(x, z, r, (way, i) => {
      if (filter && !filter(way)) return;
      const d = segDist(x, z, way.pts, i) - way.w / 2;
      if (d < best) best = d;
    });
    return best;
  }

  /** The nearest way passing `filter`, with where along it you are. */
  closest(x, z, r, filter = null) {
    let best = null, bestD = Infinity, bestS = 0;
    this.near(x, z, r, (way, i) => {
      if (filter && !filter(way)) return;
      const p = way.pts;
      const ax = p[i * 2], az = p[i * 2 + 1], bx = p[i * 2 + 2], bz = p[i * 2 + 3];
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
      if (d < bestD) { bestD = d; best = way; bestS = way.cum[i] + t * Math.sqrt(L2); }
    });
    return best ? { way: best, s: bestS, d: bestD } : null;
  }
}

/** Distance from a point to segment i of a flat [x,z,...] polyline. */
export function segDist(x, z, p, i) {
  const ax = p[i * 2], az = p[i * 2 + 1], bx = p[i * 2 + 2], bz = p[i * 2 + 3];
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

/**
 * Where you are s metres along a way: writes x, z and the unit direction of
 * travel (dx, dz) into out. Walks from `hint` (last segment) so a car or a
 * walker moving along the same way does not search from the start each frame.
 */
export function pointAt(way, s, out, hint = 0) {
  const { pts, cum, n } = way;
  s = Math.max(0, Math.min(way.len, s));
  let i = Math.max(0, Math.min(n - 2, hint));
  while (i < n - 2 && cum[i + 1] < s) i++;
  while (i > 0 && cum[i] > s) i--;
  const seg = cum[i + 1] - cum[i] || 1;
  const t = (s - cum[i]) / seg;
  const ax = pts[i * 2], az = pts[i * 2 + 1], bx = pts[i * 2 + 2], bz = pts[i * 2 + 3];
  out.x = ax + (bx - ax) * t;
  out.z = az + (bz - az) * t;
  out.dx = (bx - ax) / seg;
  out.dz = (bz - az) / seg;
  out.seg = i;
  return out;
}

/**
 * Steps along a polyline every `step` metres (starting `start` in) and calls
 * cb(x, z, dx, dz, s) with the point and the unit direction there.
 */
export function walkLine(way, step, start, cb) {
  const out = {};
  let hint = 0;
  for (let s = start; s <= way.len; s += step) {
    pointAt(way, s, out, hint);
    hint = out.seg;
    cb(out.x, out.z, out.dx, out.dz, s);
  }
}

/** Where two segments cross, or null. */
export function crossPoint(ax, az, bx, bz, cx, cz, dx, dz) {
  const rX = bx - ax, rZ = bz - az, sX = dx - cx, sZ = dz - cz;
  const den = rX * sZ - rZ * sX;
  if (Math.abs(den) < 1e-6) return null;
  const t = ((cx - ax) * sZ - (cz - az) * sX) / den;
  const u = ((cx - ax) * rZ - (cz - az) * rX) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: ax + rX * t, z: az + rZ * t };
}

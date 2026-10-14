/**
 * The corner map and the full district map (M).
 *
 * The district is painted once per city onto an offscreen canvas from the same
 * map data the 3D city is built from: parks, water, streets, footprints. The
 * corner map then only has to crop and turn that picture each frame, heading
 * up, with you in the middle. Relics are never drawn — finding them is the
 * game — but the ones you have found and, once all three are in, the map
 * table are.
 */
import { isSolemn } from './osmcity.js';

const PX = 0.62;                    // base picture: pixels per metre
const MINI_R = 170;                 // corner map radius, metres

const COL = {
  ground: '#1b1d23', green: '#2b4630', water: '#1c3a52', foot: '#4a463f',
  road: '#77716a', major: '#948b7c', block: '#3b3e48', civic: '#454a57', monument: '#6a5a3c'
};

/** Named places worth a label on the big map: landmarks first, never a grave. */
function labels(data) {
  const rank = { attraction: 5, monument: 5, castle: 5, museum: 4, archaeological_site: 4,
                 viewpoint: 3, artwork: 1, building: 2 };
  const picked = [];
  const cand = data.places
    .filter(p => !isSolemn(p.n) && rank[p.k] && p.n.length < 34)
    .sort((a, b) => (rank[b.k] || 0) - (rank[a.k] || 0));
  for (const p of cand) {
    // keep labels from piling on top of one another
    if (picked.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 170)) continue;
    picked.push(p);
    if (picked.length >= 26) break;
  }
  return picked;
}

export class MiniMap {
  constructor(mini, big) {
    this.mini = mini; this.mc = mini.getContext('2d');
    this.big = big; this.bc = big.getContext('2d');
    this.base = document.createElement('canvas');
    this.open = false;
    this.acc = 0;
  }

  build(data) {
    const ext = data.half * 1.25;                    // metres from the centre to each edge
    this.ext = ext;
    const size = Math.round(ext * 2 * PX);
    const cv = this.base;
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    const to = v => (v / 10 + ext) * PX;             // decimetres -> pixels
    const poly = (flat) => {
      g.beginPath();
      for (let i = 0; i < flat.length; i += 2) {
        const x = to(flat[i]), y = to(flat[i + 1]);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
    };

    g.fillStyle = COL.ground; g.fillRect(0, 0, size, size);
    g.fillStyle = COL.green;
    for (const f of data.green) { poly(f); g.fill(); }
    g.fillStyle = COL.water;
    for (const f of data.water) { poly(f); g.fill(); }

    g.lineCap = g.lineJoin = 'round';
    const major = new Set(['motorway', 'trunk', 'primary', 'secondary']);
    // footways under the streets, the big roads on top
    for (const pass of ['foot', 'road', 'major']) {
      for (const [cls, w, flat] of data.roads) {
        const foot = /footway|path|steps|cycleway|track|corridor|pedestrian/.test(cls);
        const kind = foot ? 'foot' : major.has(cls) ? 'major' : 'road';
        if (kind !== pass) continue;
        g.strokeStyle = COL[kind];
        g.lineWidth = Math.max(foot ? 0.8 : 1.4, w * PX);
        g.beginPath();
        for (let i = 0; i < flat.length; i += 2) {
          const x = to(flat[i]), y = to(flat[i + 1]);
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
      }
    }
    for (const [kind, , flat] of data.buildings) {
      g.fillStyle = COL[kind] || COL.block;
      poly(flat); g.fill();
    }
    this.labels = labels(data);
    this.name = data.name;
  }

  /** Metres -> pixel on the base picture. */
  px(x) { return (x + this.ext) * PX; }

  /** marks: [{ x, z, kind: 'found' | 'table' }] */
  draw(dt, pos, yaw, marks) {
    this.acc += dt;
    if (this.acc < 1 / 24) return;               // the corner map does not need 60 fps
    this.acc = 0;
    const c = this.mc, W = this.mini.width, H = this.mini.height;
    const s = (W / 2) / MINI_R;                   // screen pixels per metre
    c.clearRect(0, 0, W, H);
    c.save();
    c.beginPath(); c.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2); c.clip();
    c.fillStyle = COL.ground; c.fillRect(0, 0, W, H);
    c.translate(W / 2, H / 2);
    c.rotate(yaw);                                // heading up
    c.scale(s / PX, s / PX);
    c.drawImage(this.base, -this.px(pos.x), -this.px(pos.z));
    c.setTransform(1, 0, 0, 1, 0, 0);

    // marks, turned with the map
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    for (const m of marks) {
      const dx = (m.x - pos.x) * s, dz = (m.z - pos.z) * s;
      let x = dx * cy - dz * sy, y = dx * sy + dz * cy;
      const r = Math.hypot(x, y), edge = W / 2 - 8;
      if (r > edge) { x *= edge / r; y *= edge / r; }    // off the map: pin it to the rim
      mark(c, W / 2 + x, H / 2 + y, m.kind, 1);
    }
    c.restore();

    // you, always pointing up
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(W / 2, H / 2 - 8); c.lineTo(W / 2 + 5.5, H / 2 + 6);
    c.lineTo(W / 2, H / 2 + 3); c.lineTo(W / 2 - 5.5, H / 2 + 6); c.closePath(); c.fill();
    // north tick on the rim, turned with the map
    const nx = W / 2 + Math.sin(yaw) * (W / 2 - 9), ny = H / 2 - Math.cos(yaw) * (W / 2 - 9);
    c.fillStyle = '#e8b45c'; c.font = '600 10px "Chakra Petch", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('N', nx, ny);
  }

  toggle(force) {
    this.open = force == null ? !this.open : force;
    (this.big.closest('#bigmap') || this.big.parentElement).hidden = !this.open;
    return this.open;
  }

  drawBig(pos, yaw, marks) {
    if (!this.open) return;
    const cv = this.big;
    const k = devicePixelRatio > 1 ? 2 : 1;
    if (cv.width !== cv.clientWidth * k || cv.height !== cv.clientHeight * k) {
      cv.width = cv.clientWidth * k; cv.height = cv.clientHeight * k;
    }
    const W = cv.width, H = cv.height;
    const c = this.bc;
    const view = this.ext * 2 * 0.84;             // the middle of the picture, where the level is
    const s = Math.min(W, H) / view;
    const ox = W / 2, oy = H / 2;
    c.fillStyle = '#101216'; c.fillRect(0, 0, W, H);
    c.save();
    c.translate(ox, oy);
    c.scale(s / PX, s / PX);
    c.drawImage(this.base, -this.px(0), -this.px(0));
    c.restore();
    const toS = (x, z) => [ox + x * s, oy + z * s];

    c.font = `600 ${Math.round(11 * (W / 900) + 6)}px "Chakra Petch", sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    for (const p of this.labels) {
      const [x, y] = toS(p.x, p.z);
      c.fillStyle = 'rgba(232,180,92,.9)';
      c.beginPath(); c.arc(x, y, 2.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(0,0,0,.65)'; c.fillText(p.n, x + 1, y - 4);
      c.fillStyle = '#efe7d6'; c.fillText(p.n, x, y - 5);
    }
    for (const m of marks) { const [x, y] = toS(m.x, m.z); mark(c, x, y, m.kind, 1.5); }

    const [px, py] = toS(pos.x, pos.z);
    c.save(); c.translate(px, py); c.rotate(-yaw);
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -12); c.lineTo(8, 9); c.lineTo(0, 4); c.lineTo(-8, 9); c.closePath();
    c.stroke(); c.fill();
    c.restore();
  }
}

function mark(c, x, y, kind, k) {
  c.save(); c.translate(x, y);
  if (kind === 'table') {
    c.rotate(Math.PI / 4);
    c.fillStyle = '#ffd98a'; c.strokeStyle = '#1a1408'; c.lineWidth = 1.5;
    c.fillRect(-5 * k, -5 * k, 10 * k, 10 * k); c.strokeRect(-5 * k, -5 * k, 10 * k, 10 * k);
  } else {
    c.fillStyle = '#e8b45c'; c.strokeStyle = '#1a1408'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(0, 0, 4.5 * k, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  c.restore();
}

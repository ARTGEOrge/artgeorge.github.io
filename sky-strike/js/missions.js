/* The eight Sky Strike missions against the (fictional) Iron Crown. Each has
 * its own terrain recipe, lighting, layout of forces and objectives. */
import { polyDist, smoothPath, pathAt, clamp, smooth, lerp, distField } from './util.js';
import { revetment, crane, dock, flag, wall } from './models.js';

const TAU = Math.PI * 2;
const yawTo = (sx, sz, tx, tz) => Math.atan2(-(tx - sx), -(tz - sz));
function slots(R, x, z, r, n, minD = 26, out = []) {
  const res = []; let tries = 0;
  while (res.length < n && tries++ < n * 80) {
    const a = R() * TAU, d = Math.sqrt(R()) * r, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    if (res.concat(out).every(([qx, qz]) => Math.hypot(qx - px, qz - pz) > minD)) res.push([px, pz]);
  }
  out.push(...res); return res;
}
function offsetPath(pts, off) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    return [p[0] - dz / l * off, p[1] + dx / l * off];
  });
}
/* a generic Iron Crown outpost; recipe: {type: count}; primary types listed in `prim` */
function base(W, R, s, tag, recipe, prim, opt = {}) {
  const used = [];
  const order = Object.entries(recipe).sort((a, b) => (TYPES_R[b[0]] || 10) - (TYPES_R[a[0]] || 10));
  for (const [type, n] of order) {
    const r = TYPES_R[type] || 10;
    for (const [x, z] of slots(R, s.x, s.z, s.r * (opt.spread || 0.92), n, r * 1.6 + 10, used)) W.add(type, x, z, { tag: prim.includes(type) ? tag : (opt.secTag || null), yaw: opt.yaw ?? R() * TAU, primary: prim.includes(type) });
  }
  if (opt.flag !== false) W.place(flag(), s.x + s.r * 0.3, s.z - s.r * 0.25, R() * TAU);
}
const TYPES_R = { hangar: 26, barracks: 16, fuel: 13, command: 26, radar: 11, bunker: 10, sam: 8, flak: 7, aa: 6, tank: 5, aav: 5, truck: 5, fuelTruck: 5, tent: 5, crates: 4, tower: 5, ctower: 9 };

/* ------------------------------------------------------------ 1 desert */
const M1 = {
  id: 1, name: 'Dust Devil', dmgMul: 0.5, place: 'Kharun Desert', time: 'Midday', color: '#a89068',
  blurb: 'Three Iron Crown outposts are staging raids from the Kharun dunes. Level them. Light air defences only — a good place to learn the bomb pipper.',
  threats: 'AA guns', par: 300,
  env: { top: '#3274c4', horizon: '#e9d2a8', fog: '#dccdb0', fogDensity: 0.00013, sunDir: [0.5, 0.62, -0.35], sunColor: '#fff0d4', sunInt: 3.0, hemiSky: '#d6e4ff', hemiGround: '#b8915c', hemiInt: 1.05, glow: 0.7, clouds: { count: 12, alt: [1500, 1900], opacity: 0.8 }, wind: [4, 0, 1] },
  sites: [{ x: -950, z: 1050, r: 120 }, { x: 1000, z: 250, r: 120 }, { x: -250, z: -1250, r: 130 }],
  terrain: {
    seed: 11, colors: { low: '#dcb57a', mid: '#c99c5e', high: '#b5774a', highAt: [130, 210], rock: '#9a6440', rockSlope: 0.32, dirt: '#a68a62', road: '#6e604e', concrete: '#aaa496', strata: '#8a4e30' },
    shape: (x, z, N) => {
      const dunes = N.ridged(N.a, x * 0.0016 + 0.4 * N.a(x * 0.0003, z * 0.0003), z * 0.0044, 3) * 24;
      const base = N.fbm(N.b, x * 0.00035, z * 0.00035, 4) * 60;
      const m = N.fbm(N.c, x * 0.0008, z * 0.0008, 3);
      return 40 + base + dunes + N.smooth(0.2, 0.27, m) * 130 + N.smooth(0.36, 0.4, m) * 55;
    },
    roads: [{ pts: [[-950, 1050], [-300, 500], [1000, 250]], w: 10, kind: 'dirt' }, { pts: [[-300, 500], [-200, -400], [-250, -1250], [200, -3800]], w: 10, kind: 'dirt' }],
    trees: [{ kind: 'cactus', n: 450, slope: 0.3 }, { kind: 'rock', n: 900, smin: 0.6, smax: 2.4 }, { kind: 'bush', n: 700, smin: 0.6, smax: 1.1 }]
  },
  start: [0, 650, 3500, 0.1], ammo: { gun: 700, bombs: 16, msl: 6, flares: 30 },
  objectives: [{ label: 'Outpost Alpha', tag: 'A' }, { label: 'Outpost Bravo', tag: 'B' }, { label: 'Outpost Charlie', tag: 'C' }],
  populate(W, R) {
    const [a, b, c] = this.sites;
    base(W, R, a, 'A', { barracks: 2, fuel: 2, aa: 1, tent: 4, truck: 3, crates: 2, tower: 2 }, ['barracks', 'fuel', 'aa']);
    base(W, R, b, 'B', { barracks: 2, fuel: 2, aa: 1, tent: 4, truck: 2, crates: 3, tower: 2 }, ['barracks', 'fuel', 'aa']);
    base(W, R, c, 'C', { barracks: 2, fuel: 3, radar: 1, aa: 1, tent: 3, truck: 3, crates: 2, tower: 2 }, ['barracks', 'fuel', 'aa', 'radar']);
    W.add('aa', 300, 600, {}); W.add('aa', -500, -300, {});
    for (const [x, z] of [[-200, 200], [600, 360], [-180, -700]]) W.add('truck', x, z, { yaw: R() * TAU });
    W.rearm(0, 420, 1900);
  }
};

/* ------------------------------------------------------------ 2 forest convoy */
const V2 = [[-3700, 2900], [-2500, 2100], [-1300, 2300], [-200, 1300], [400, 0], [1500, -900], [2700, -1100], [3700, -2300]];
let D2 = null;
const R2a = offsetPath(V2, 120), R2b = offsetPath(V2, -120);
const X2 = V2[3], n2 = (() => { const a = V2[2], b = V2[4], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return [-dz / l, dx / l]; })();
const B2a = [X2[0] + n2[0] * 120, X2[1] + n2[1] * 120], B2b = [X2[0] - n2[0] * 120, X2[1] - n2[1] * 120];
const ROAD2 = [...R2a.slice(0, 3), [B2a[0] + (R2a[2][0] - B2a[0]) * 0.35, B2a[1] + (R2a[2][1] - B2a[1]) * 0.35], B2a, B2b, [B2b[0] + (R2b[4][0] - B2b[0]) * 0.35, B2b[1] + (R2b[4][1] - B2b[1]) * 0.35], ...R2b.slice(4)];
const M2 = {
  id: 2, name: 'Greenline', dmgMul: 0.65, place: 'Varro Valley', time: 'Morning', color: '#5a6644',
  blurb: 'An armoured convoy is running fuel down the Varro valley road to an Iron Crown depot. Stop every vehicle before it gets there. Dropping the river bridge halts the convoy.',
  threats: 'Mobile AA, AA guns, 1 SAM', par: 330,
  env: { top: '#4785c6', horizon: '#cfdce6', fog: '#bccbd6', fogDensity: 0.00025, sunDir: [-0.45, 0.55, -0.5], sunColor: '#fff4e2', sunInt: 2.7, hemiSky: '#cfe0ff', hemiGround: '#4a5a34', hemiInt: 1.05, clouds: { count: 42, alt: [850, 1250] }, wind: [2, 0, -3] },
  terrain: {
    seed: 22, water: { level: 18, color: '#2e5a5a' },
    colors: { low: '#4f7a34', mid: '#3e6a2c', high: '#6a7a4a', highAt: [230, 330], rock: '#6e6a5e', rockSlope: 0.42, dirt: '#7a6a4a', road: '#4a4a48', sand: '#8a8060', bed: '#4a4a3a', concrete: '#8a8a82' },
    shape: (x, z, N) => {
      const d = (D2 || (D2 = distField(V2)))(x, z);
      return 26 + 320 * smooth(110, 1300, d) * (0.55 + 0.45 * N.fbm(N.a, x * 0.0007, z * 0.0007, 4)) + 26 * N.fbm(N.b, x * 0.003, z * 0.003, 3) + N.ridged(N.c, x * 0.0006, z * 0.0006, 3) * 120 * smooth(600, 2000, d);
    },
    rivers: [{ pts: V2, w: 48, depth: 7 }],
    roads: [{ pts: ROAD2, w: 11, kind: 'asphalt', smoothN: 4 }],
    pads: [{ x: 3300, z: -1750, r: 140, kind: 'dirt' }, { x: 900, z: 500, r: 60, kind: 'dirt' }],
    trees: [{ kind: 'broad', n: 5200, slope: 0.45, hmin: 24 }, { kind: 'pine', n: 4200, slope: 0.55, hmin: 60 }, { kind: 'rock', n: 300 }]
  },
  start: [-2600, 700, 3700, yawTo(-2600, 3700, -1300, 2300)], ammo: { gun: 750, bombs: 14, msl: 6, flares: 30 },
  objectives: [{ label: 'Convoy', tag: 'convoy' }],
  failCheck: W => W.targets.some(t => t.tag === 'convoy' && t.alive && t.pathT >= 0.985) ? 'The convoy reached the depot' : null,
  populate(W, R) {
    const road = W.terrain.roads[0].pts;
    const deck = Math.max(W.terrain.height(B2a[0], B2a[1]), W.terrain.height(B2b[0], B2b[1])) + 1.2;
    W.bridge(B2a[0], B2a[1], B2b[0], B2b[1], deck, null, { spans: 5 });
    W.convoy({ pts: road }, ['aav', 'tank', 'truck', 'fuelTruck', 'truck', 'tank', 'fuelTruck', 'truck', 'aav', 'truck'], { tag: 'convoy', t0: 0.3, speed: 8.5, gap: 30 });
    base(W, R, { x: 3300, z: -1750, r: 130 }, null, { fuel: 3, barracks: 2, aa: 2, tent: 3, crates: 3 }, []);
    W.add('sam', 900, 500, {}); W.add('aa', 940, 440, {});
    W.add('aa', -1700, 1800, {}); W.add('aa', 900, -150, {}); W.add('aa', 2100, -700, {});
    W.rearm(-1600, 520, 3100);
  }
};

/* ------------------------------------------------------------ 3 snowy radar */
const M3 = {
  id: 3, name: 'Whiteout', dmgMul: 0.75, place: 'Skarn Mountains', time: 'Afternoon', color: '#c8ccd0',
  blurb: 'Iron Crown radars on three summits feed a SAM network. While a radar lives its SAMs lock faster and reach further — kill the radars first, then the launchers. Low cloud hides the valleys.',
  threats: '3 SAM sites (radar-networked), AA', par: 360,
  env: { top: '#2f66b0', horizon: '#d4e2ee', fog: '#c8d6e4', fogDensity: 0.00015, sunDir: [0.35, 0.42, 0.6], sunColor: '#fff6ea', sunInt: 2.9, hemiSky: '#c8dcff', hemiGround: '#6a7480', hemiInt: 0.95, clouds: { count: 55, alt: [520, 900], shade: '#a8b4c4' }, wind: [5, 0, 2] },
  terrain: {
    seed: 33,
    colors: { low: '#aeb8c0', mid: '#d8e0e6', rock: '#4a4e58', rockSlope: 0.3, snow: '#f2f6fa', snowLine: 260, snowSlope: 0.32, dirt: '#8a8a88', road: '#5a5a5c', concrete: '#9a9c9e' },
    shape: (x, z, N) => 60 + Math.pow(N.ridged(N.a, x * 0.00042, z * 0.00042, 5), 1.7) * 1250 + N.fbm(N.b, x * 0.002, z * 0.002, 3) * 50,
    prepare(raw, N, spec) {
      // pick three summits for the radars, three lower shoulders for SAMs and a valley for the main base
      const pts = [];
      for (let x = -3200; x <= 3200; x += 160) for (let z = -3200; z <= 3200; z += 160) pts.push([x, z, raw(x, z)]);
      const pick = (list, n, sep, f) => { const out = []; for (const p of [...list].sort(f)) { if (out.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) > sep)) out.push(p); if (out.length >= n) break; } return out; };
      const summits = pick(pts.filter(p => Math.abs(p[0]) < 2800 && Math.abs(p[1]) < 2400), 3, 2000, (a, b) => b[2] - a[2]);
      const mid = pick(pts.filter(p => p[2] > 260 && p[2] < 520 && Math.abs(p[0]) < 2800 && Math.abs(p[1]) < 2800 && summits.every(s => Math.hypot(s[0] - p[0], s[1] - p[1]) > 700)), 3, 1700, (a, b) => Math.abs(a[2] - 380) - Math.abs(b[2] - 380));
      const low = pick(pts.filter(p => Math.abs(p[0]) < 1800 && Math.abs(p[1]) < 1800), 1, 0, (a, b) => a[2] - b[2]);
      spec.sitesR = summits.map(p => ({ x: p[0], z: p[1], r: 40 }));
      spec.sitesS = mid.map(p => ({ x: p[0], z: p[1], r: 45 }));
      spec.siteB = { x: low[0][0], z: low[0][1], r: 150 };
      spec.pads = [...spec.sitesR.map(s => ({ ...s, dh: -6, kind: 'concrete' })), ...spec.sitesS.map(s => ({ ...s, kind: 'concrete' })), { ...spec.siteB, kind: 'concrete' }];
    },
    trees: [{ kind: 'snowpine', n: 4200, slope: 0.5, hmax: 650 }, { kind: 'pine', n: 900, slope: 0.4, hmax: 260 }, { kind: 'rock', n: 400 }]
  },
  start: [0, 1550, 3700, 0], ammo: { gun: 700, bombs: 14, msl: 8, flares: 36 },
  objectives: [{ label: 'Radar towers', tag: 'radar' }, { label: 'SAM sites', tag: 'sam' }],
  populate(W, R) {
    const T = this.terrain;
    for (const s of T.sitesR) { W.add('radar', s.x, s.z, { tag: 'radar' }); W.add('bunker', s.x + 22, s.z - 14, { yaw: R() * TAU }); W.add('aa', s.x - 20, s.z + 18, {}); }
    for (const s of T.sitesS) { W.add('sam', s.x, s.z, { tag: 'sam', yaw: R() * TAU }); W.add('truck', s.x + 18, s.z + 10, { yaw: R() * TAU }); W.add('aa', s.x - 22, s.z - 12, {}); }
    base(W, R, T.siteB, null, { bunker: 4, barracks: 2, fuel: 2, aa: 2, truck: 3, tent: 2 }, []);
    W.rearm(T.siteB.x + 600, W.terrain.height(T.siteB.x + 600, T.siteB.z) + 380, T.siteB.z + 900);
  }
};

/* ------------------------------------------------------------ 4 coastal harbour */
const coast4 = (x, N) => 380 + 330 * Math.sin(x * 0.0011 + 0.6) + 140 * N.fbm(N.c, x * 0.0009, 3.7, 3);
const M4 = {
  id: 4, name: 'Riptide', dmgMul: 0.8, place: 'Port Selva', time: 'Late morning', color: '#6a7078',
  blurb: 'Port Selva is fuelling the Iron Crown fleet. Sink the frigate, the patrol boats and the freighters in the harbour, and burn the fuel depot on the quay.',
  threats: 'Frigate SAM + guns, patrol boats, shore AA, 1 SAM', par: 360,
  env: { top: '#2e76c6', horizon: '#d2e4ef', fog: '#c6dae8', fogDensity: 0.0002, sunDir: [-0.5, 0.52, 0.45], sunColor: '#fff4e0', sunInt: 2.9, hemiSky: '#cfe2ff', hemiGround: '#6a7a5a', hemiInt: 1.1, clouds: { count: 30, alt: [1000, 1400] }, wind: [6, 0, 2] },
  terrain: {
    seed: 44, water: { level: 0, color: '#1d5878', opacity: 0.88 },
    colors: { low: '#5a7a3a', mid: '#6a8444', high: '#7a7a5a', highAt: [180, 280], rock: '#7a746a', rockSlope: 0.4, sand: '#d8c896', bed: '#6a7a6a', dirt: '#8a7a5a', road: '#454547', concrete: '#9a9890' },
    shape: (x, z, N) => {
      const d = coast4(x, N) - z; // + = land (north)
      let h = -38 + smooth(-500, 120, d) * 42 + smooth(150, 2600, d) * (90 + 260 * N.fbm(N.a, x * 0.0006, z * 0.0006, 4)) + N.fbm(N.b, x * 0.003, z * 0.003, 3) * 8 * smooth(0, 200, d);
      // harbour basin cut into the coast
      const bx = Math.abs(x - 0), inBasin = smooth(330, 280, bx) * smooth(-120, -60, z) * smooth(coast4(x, N) + 300, coast4(x, N) + 100, z);
      h = lerp(h, -14, inBasin);
      return h;
    },
    pads: [{ x: -470, z: -160, r: 130, h: 3, kind: 'concrete' }, { x: 470, z: -160, r: 130, h: 3, kind: 'concrete' }, { x: 0, z: -330, r: 150, h: 3, kind: 'concrete' }, { x: 900, z: -150, r: 170, h: 4, kind: 'concrete' }, { x: -1500, z: -100, r: 60, kind: 'dirt' }],
    roads: [{ pts: [[-2600, -900], [-1200, -500], [0, -420], [900, -380], [2400, -900]], w: 12, kind: 'asphalt' }, { pts: [[0, -420], [0, -1600], [200, -3800]], w: 12 }],
    trees: [{ kind: 'broad', n: 2600, slope: 0.4, hmin: 8 }, { kind: 'palm', n: 600, hmin: 1.5, hmax: 12 }, { kind: 'rock', n: 200 }]
  },
  avoid: (x, z) => x > -1600 && x < 1400 && z < 0 && z > -1400,
  start: [-500, 600, 3600, yawTo(-500, 3600, 0, 0)], ammo: { gun: 800, bombs: 16, msl: 8, flares: 36 },
  objectives: [{ label: 'Ships', tag: 'ships' }, { label: 'Fuel depot', tag: 'depot' }],
  populate(W, R) {
    W.place(dock(300, 30).group, -290, -110, 0, 0, 1); W.place(dock(300, 30).group, 290, -110, 0, 0, 1);
    W.add('cargo', -200, 40, { tag: 'ships', yaw: Math.PI }); W.add('cargo', 200, 60, { tag: 'ships', yaw: 0 });
    for (const [x, z] of [[-300, -190], [-300, -40], [300, -190], [300, -20]]) W.place(crane().group, x, z, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0, 3);
    W.add('frigate', 900, 1700, { tag: 'ships', circle: { x: 300, z: 1800, r: 700, speed: 7, a: 0.3 } });
    W.add('patrol', -600, 900, { tag: 'ships', circle: { x: -500, z: 1000, r: 380, speed: 15, a: 1 } });
    W.add('patrol', 600, 800, { tag: 'ships', circle: { x: 700, z: 900, r: 420, speed: 14, a: 2.5 } });
    W.add('patrol', 0, 1300, { tag: 'ships', circle: { x: -100, z: 1400, r: 500, speed: 13, a: 4 } });
    for (let i = 0; i < 6; i++) W.add('fuel', 820 + (i % 3) * 40, -210 + Math.floor(i / 3) * 60, { tag: 'depot', y: 4 });
    for (const [x, z] of [[-480, -220], [-480, -120], [470, -260], [0, -340]]) W.add('barracks', x, z, { yaw: Math.PI / 2, y: 3 });
    for (const [x, z] of [[-620, -60], [620, -40], [1060, -60], [-1500, -100], [1300, -350]]) W.add('aa', x, z, {});
    W.add('sam', -1500, -60, { yaw: 1 });
    W.add('fuelTruck', 760, -300, { yaw: 0.4, y: 4 }); W.add('truck', 120, -360, { yaw: 1.4, y: 3 });
    W.city(-300, -900, 1600, 600, 160, { avoid: (x, z) => Math.abs(x) < 30 || (z > -480 && z < -360) });
    W.rearm(-1800, 450, 1600);
  }
};

/* ------------------------------------------------------------ 5 canyon run */
const C5 = [[-400, 3900], [200, 2700], [-500, 1700], [300, 700], [900, -200], [200, -1200], [-600, -2000], [0, -2900], [600, -3900]];
const C5s = smoothPath(C5, 6);
let D5 = null;
const canyonW = (x, z, N) => 240 + 70 * N.fbm(N.c, x * 0.001, z * 0.001, 2);
const M5 = {
  id: 5, name: 'Red Canyon', dmgMul: 0.85, place: 'Ashfall Canyon', time: 'Golden hour', color: '#8a6a4a',
  blurb: 'Bunkers dug into the Ashfall canyon floor guard a supply bridge. SAMs ring the plateau above — stay below the rim and their radars can\'t see you. Drop the bridge and the five bunkers.',
  threats: '4 plateau SAMs, rim AA', par: 330,
  env: { top: '#3a6cb0', horizon: '#f2c9a0', fog: '#e6bc94', fogDensity: 0.00023, sunDir: [0.65, 0.42, 0.25], sunColor: '#ffe2bc', sunInt: 3.0, hemiSky: '#d8dcff', hemiGround: '#a0603a', hemiInt: 1.0, clouds: { count: 14, alt: [1300, 1700], lit: '#fff2e2' }, wind: [3, 0, 3] },
  terrain: {
    seed: 55,
    colors: { low: '#b8693a', mid: '#c87a42', high: '#d08a50', highAt: [300, 360], rock: '#9a4a2a', rockSlope: 0.3, strata: '#e0a064', dirt: '#a0784a', road: '#8a6a48', concrete: '#a89a88' },
    shape: (x, z, N) => {
      const plateau = 330 + 26 * N.fbm(N.a, x * 0.0012, z * 0.0012, 3) + N.smooth(0.25, 0.32, N.fbm(N.b, x * 0.0007, z * 0.0007, 3)) * 90;
      const d = (D5 || (D5 = distField(C5s)))(x, z), w = canyonW(x, z, N);
      const t = smooth(w * 0.38, w * 1.15, d);
      let h = lerp(40 + 6 * N.a(x * 0.01, z * 0.01), plateau, t);
      const tt = h / 46, terr = (Math.floor(tt) + smooth(0.72, 1, tt - Math.floor(tt))) * 46;
      return lerp(h, terr, 0.65 * smooth(0.02, 0.2, t) * (1 - smooth(0.92, 1, t)));
    },
    roads: [{ pts: C5, w: 12, kind: 'dirt', smoothN: 6, blend: 14 }],
    trees: [{ kind: 'dead', n: 500, slope: 0.3 }, { kind: 'rock', n: 1400, smin: 0.7, smax: 2.6, slope: 0.7 }, { kind: 'bush', n: 500 }]
  },
  start: [-200, 520, 3700, yawTo(-200, 3700, 200, 2700)], ammo: { gun: 700, bombs: 16, msl: 8, flares: 36 },
  objectives: [{ label: 'Canyon bridge', tag: 'bridge' }, { label: 'Bunkers', tag: 'bunker' }],
  populate(W, R) {
    const T = W.terrain, N = T.N;
    // bunkers along the floor
    [0.2, 0.33, 0.47, 0.62, 0.78].forEach((f, i) => { const p = pathAt(C5s, f), off = (i % 2 ? 1 : -1) * 28; W.add('bunker', p.x + Math.cos(p.yaw) * off, p.z - Math.sin(p.yaw) * off, { tag: 'bunker', yaw: p.yaw + Math.PI }); });
    // bridge over the canyon
    const bp = pathAt(C5s, 0.55), nx = Math.cos(bp.yaw), nz = -Math.sin(bp.yaw), w = canyonW(bp.x, bp.z, N) * 1.2;
    const ax = bp.x + nx * w, az = bp.z + nz * w, bx = bp.x - nx * w, bz = bp.z - nz * w;
    W.bridge(ax, az, bx, bz, Math.max(T.height(ax, az), T.height(bx, bz)) + 1, 'bridge', { spans: 7, w: 16 });
    // rim AA and plateau SAMs
    [0.12, 0.28, 0.41, 0.58, 0.7, 0.86].forEach((f, i) => { const p = pathAt(C5s, f), s = i % 2 ? 1 : -1, ww = canyonW(p.x, p.z, N) * 1.2 + 30; W.add(i === 2 || i === 5 ? 'flak' : 'aa', p.x + Math.cos(p.yaw) * ww * s, p.z - Math.sin(p.yaw) * ww * s, {}); });
    [0.18, 0.4, 0.62, 0.84].forEach((f, i) => { const p = pathAt(C5s, f), s = i % 2 ? -1 : 1, ww = 900; W.add('sam', p.x + Math.cos(p.yaw) * ww * s, p.z - Math.sin(p.yaw) * ww * s, { yaw: R() * TAU }); });
    const e = pathAt(C5s, 0.93);
    for (let i = 0; i < 3; i++) W.add('fuel', e.x + (i - 1) * 32, e.z + 30, { scale: 0.7 });
    W.add('truck', e.x + 10, e.z - 30, { yaw: R() }); W.add('tank', e.x - 30, e.z - 20, { yaw: R() });
    const r0 = pathAt(C5s, 0.37); W.rearm(r0.x, T.height(r0.x, r0.z) + 120, r0.z);
  }
};

/* ------------------------------------------------------------ 6 island airbase */
const ISL = [{ x: 0, z: 0, rx: 1900, rz: 1000, h: 1 }, { x: -2300, z: 1900, rx: 520, rz: 420, h: 0.8 }, { x: 2400, z: 1500, rx: 600, rz: 480, h: 0.9 }, { x: 1600, z: -2300, rx: 520, rz: 600, h: 1.2 }];
const RWY6 = { x: -100, z: 280, yaw: Math.PI / 2, len: 1500 };
const M6 = {
  id: 6, name: 'Atoll', dmgMul: 0.9, place: 'Corvo Islands', time: 'Afternoon', color: '#6a6e5a',
  blurb: 'The Iron Crown\'s island airbase launches fighters against our shipping. Destroy the hangars, the fighters parked in their revetments and the SAM sites on the outer islands. Expect jets to scramble.',
  threats: '3 SAMs, AA, flak, enemy fighters', par: 420,
  env: { top: '#2876ce', horizon: '#c4e2f2', fog: '#b8d8ec', fogDensity: 0.00018, sunDir: [0.3, 0.6, -0.5], sunColor: '#fff6e6', sunInt: 3.0, hemiSky: '#cfe6ff', hemiGround: '#4a7a6a', hemiInt: 1.15, clouds: { count: 48, alt: [700, 1000], scale: 1.1 }, wind: [5, 0, -2] },
  terrain: {
    seed: 66, water: { level: 0, color: '#137a96', opacity: 0.86 },
    colors: { low: '#5a8a3a', mid: '#4a7a30', high: '#6a6a4a', highAt: [90, 160], rock: '#6a6458', rockSlope: 0.45, sand: '#eadbaa', bed: '#c8c8a0', dirt: '#8a7a5a', road: '#3e3f42', concrete: '#a4a39c' },
    shape: (x, z, N) => {
      let h = -45;
      for (const I of ISL) {
        const e0 = Math.hypot((x - I.x) / I.rx, (z - I.z) / I.rz); if (e0 > 1.5) continue;
        const e = e0 * (1 + 0.18 * N.a(x * 0.002, z * 0.002));
        const land = smooth(1.1, 0.6, e);
        h = Math.max(h, -45 + land * (52 + 26 * N.fbm(N.b, x * 0.002, z * 0.002, 3)) + Math.pow(smooth(0.75, 0.05, e), 1.5) * 170 * I.h * (0.6 + 0.4 * N.fbm(N.c, x * 0.0015, z * 0.0015, 3)));
      }
      return h;
    },
    pads: (() => { const p = []; for (let i = -6; i <= 6; i++) p.push({ x: RWY6.x + i * 125, z: RWY6.z, r: 85, h: 7, kind: 'concrete' }); for (let i = -4; i <= 4; i++) p.push({ x: RWY6.x + i * 140, z: RWY6.z - 230, r: 95, h: 7, kind: 'concrete' }); p.push({ x: -2300, z: 1900, r: 60, kind: 'dirt' }, { x: 2400, z: 1500, r: 60, kind: 'dirt' }, { x: 1600, z: -2300, r: 60, kind: 'dirt' }); return p; })(),
    trees: [{ kind: 'palm', n: 3000, hmin: 3, slope: 0.4 }, { kind: 'broad', n: 1200, hmin: 30, slope: 0.4 }, { kind: 'rock', n: 200, hmin: 2 }]
  },
  avoid: (x, z) => Math.abs(z - 200) < 360 && Math.abs(x + 100) < 1000,
  start: [0, 700, 3800, 0], ammo: { gun: 800, bombs: 16, msl: 8, flares: 40 },
  objectives: [{ label: 'Hangars', tag: 'hangar' }, { label: 'Parked fighters', tag: 'parked' }, { label: 'SAM sites', tag: 'sam' }],
  fighters: [{ near: [0, 0, 4200], n: 2, from: [-600, 260, 280], skill: 0.75 }, { at: 120, n: 2, from: [-3200, 900, -3000], skill: 0.8 }],
  populate(W, R) {
    W.runway(RWY6.x, RWY6.z, RWY6.yaw, RWY6.len, 46);
    for (let i = 0; i < 4; i++) W.add('hangar', -650 + i * 240, -10, { tag: 'hangar', yaw: Math.PI, y: 7 });
    for (let i = 0; i < 6; i++) { const x = -560 + i * 140, z = 120; W.place(revetment().group, x, z - 4, Math.PI, 0, 7); W.add('parked', x, z, { tag: 'parked', yaw: Math.PI, y: 7 }); }
    W.add('ctower', 620, -40, { y: 7 }); W.add('fuel', 820, -60, { y: 7, scale: 0.8 }); W.add('fuel', 870, -10, { y: 7, scale: 0.8 }); W.add('barracks', 700, -160, { y: 7, yaw: 1.57 });
    W.add('sam', -2300, 1900, { tag: 'sam' }); W.add('sam', 2400, 1500, { tag: 'sam' }); W.add('sam', 1600, -2300, { tag: 'sam' });
    for (const [x, z] of [[-900, 120], [900, 160], [-300, -120], [400, 420], [-700, 460]]) W.add('aa', x, z, { y: 7 });
    W.add('flak', 200, -160, { y: 7 }); W.add('flak', -1000, 300, {});
    W.add('aa', -2260, 1950, {}); W.add('aa', 2440, 1460, {}); W.add('aa', 1640, -2260, {});
    for (let i = 0; i < 3; i++) W.add('fuelTruck', 760 + i * 20, 60, { yaw: 0.2, y: 7 });
    W.rearm(-1800, 380, 3000); W.rearm(2600, 420, -800);
  }
};

/* ------------------------------------------------------------ 7 night depot */
const RIV7 = [[-4200, -3200], [-2600, -1800], [-1100, -900], [-700, 400], [-1400, 1700], [-800, 3000], [-300, 4200]];
const M7 = {
  id: 7, name: 'Nightfall', dmgMul: 0.95, place: 'Kessra outskirts', time: 'Night', color: '#5a5a52',
  blurb: 'A fuel depot on the edge of Kessra keeps the Iron Crown armour moving. Strike it at night: ten fuel tanks, two SAM sites. AA tracers will light up the sky — your flares light up the ground. Leave the city itself alone.',
  threats: '2 SAMs, heavy AA, flak, searchlights', par: 360,
  env: { night: true, top: '#040816', horizon: '#18203a', ground: '#06080e', fog: '#0c1220', fogDensity: 0.00025, sunDir: [-0.35, 0.55, -0.5], moonDir: [-0.35, 0.55, -0.5], sunColor: '#9ab4f0', sunInt: 0.9, sunGlow: '#6070a0', glow: 0.25, hemiSky: '#3a4c80', hemiGround: '#141420', hemiInt: 0.8, clouds: { count: 24, alt: [1100, 1500], lit: '#2a3248', shade: '#0e121e', opacity: 0.8 }, wind: [3, 0, 2], exposure: 1.15 },
  terrain: {
    seed: 77, water: { level: 10, color: '#0a1620', rough: 0.2 },
    colors: { low: '#3a4430', mid: '#46503a', high: '#5a5a4a', highAt: [120, 220], rock: '#4a4a46', rockSlope: 0.4, sand: '#4a4638', bed: '#2a2a26', dirt: '#5a5040', road: '#2a2a2c', concrete: '#6a6a66' },
    shape: (x, z, N) => 22 + N.fbm(N.a, x * 0.0006, z * 0.0006, 4) * 40 + smooth(2200, 4200, Math.abs(x - 600)) * 260 * (0.5 + 0.5 * N.fbm(N.b, x * 0.0009, z * 0.0009, 3)) + smooth(2600, 4200, Math.abs(z)) * 200,
    rivers: [{ pts: RIV7, w: 70, depth: 8 }],
    pads: [{ x: 700, z: -300, r: 330, h: 24, kind: 'concrete' }, { x: 1700, z: 900, r: 60, kind: 'dirt' }, { x: 1500, z: -1500, r: 60, kind: 'dirt' }, { x: -2300, z: 0, r: 900, h: 26, kind: 'none' }],
    roads: [{ pts: [[-3800, 200], [-1200, 150], [700, -300], [3800, -900]], w: 13 }, { pts: [[700, -300], [900, 1400], [1200, 3800]], w: 11 }],
    trees: [{ kind: 'broad', n: 2400, slope: 0.4, hmin: 14 }, { kind: 'pine', n: 1400, hmin: 60 }]
  },
  avoid: (x, z) => (x < -1300 && x > -3300 && Math.abs(z) < 1100) || Math.hypot(x - 700, z + 300) < 420,
  start: [3200, 650, 3200, yawTo(3200, 3200, 700, -300)], ammo: { gun: 800, bombs: 18, msl: 8, flares: 44 },
  objectives: [{ label: 'Fuel tanks', tag: 'depot' }, { label: 'SAM sites', tag: 'sam' }],
  aaMul: 0.95,
  populate(W, R) {
    W.city(-2300, 0, 1800, 1900, 520, { avoid: (x, z) => Math.abs(z - 150) < 22 || polyDist(RIV7, x, z).d < 70 });
    for (let i = 0; i < 10; i++) W.add('fuel', 560 + (i % 5) * 52, -400 + Math.floor(i / 5) * 70, { tag: 'depot', y: 24, scale: 0.9 });
    for (const [x, z] of [[600, -150], [760, -150], [920, -260]]) W.add('barracks', x, z, { y: 24, yaw: 1.57 });
    for (let i = 0; i < 5; i++) W.add('fuelTruck', 860 + i * 16, -460 + i * 4, { y: 24, yaw: 0.1 });
    W.add('sam', 1700, 900, { tag: 'sam' }); W.add('sam', 1500, -1500, { tag: 'sam' });
    for (const [x, z] of [[420, -560], [1000, -560], [420, -60], [1000, -40], [1650, 860], [1450, -1450], [-1100, -300], [-1100, 600]]) W.add('aa', x, z, { y: x > 0 && Math.hypot(x - 700, z + 300) < 400 ? 24 : undefined });
    W.add('flak', 700, -620, { y: 24 }); W.add('flak', 1100, -300, { y: 24 }); W.add('flak', 300, -300, { y: 24 });
    for (const [x, z] of [[450, -500], [950, -520], [460, -100], [960, -80], [1600, 820], [1430, -1400], [-1200, -200], [-1200, 500]]) W.searchlight(x, z);
    W.rearm(2600, 420, 1400);
  }
};

/* ------------------------------------------------------------ 8 fortress */
const M8 = {
  id: 8, name: 'Iron Crown', dmgMul: 1.0, place: 'Mount Vael fortress', time: 'Dusk', color: '#4a4a46',
  blurb: 'The Iron Crown command fortress on Mount Vael. Six SAM sites, two radars, wall-to-wall flak and three waves of fighters stand between you and the command centre. Everything you have learned, all at once.',
  threats: '6 SAMs, radars, heavy flak, 8 enemy fighters', par: 540,
  env: { top: '#26376a', horizon: '#e69c68', fog: '#a6806c', fogDensity: 0.00023, sunDir: [0.82, 0.16, -0.2], sunColor: '#ffb27a', sunInt: 2.6, sunGlow: '#ffb070', glow: 0.9, hemiSky: '#8a90c0', hemiGround: '#4a3830', hemiInt: 0.9, clouds: { count: 42, alt: [950, 1350], lit: '#ffd2b0', shade: '#6a5064' }, wind: [4, 0, -3], exposure: 1.05 },
  terrain: {
    seed: 88,
    colors: { low: '#5a5a48', mid: '#6a6450', high: '#7a7064', highAt: [500, 700], rock: '#4e4a46', rockSlope: 0.38, snow: '#e6e2e0', snowLine: 900, dirt: '#6a5e4a', road: '#3a3a3a', concrete: '#7a7874' },
    shape: (x, z, N) => {
      const m = 80 + Math.pow(N.ridged(N.a, x * 0.0005, z * 0.0005, 5), 1.6) * 1050 + N.fbm(N.b, x * 0.002, z * 0.002, 3) * 40;
      const d = Math.hypot(x, z);
      return lerp(430 + 8 * N.a(x * 0.005, z * 0.005), m, smooth(720, 1250, d));
    },
    pads: [{ x: 0, z: 0, r: 640, h: 432, kind: 'concrete' }],
    roads: [{ pts: [[0, 0], [600, 900], [1600, 2000], [2600, 3800]], w: 12, kind: 'asphalt' }],
    trees: [{ kind: 'pine', n: 3000, hmax: 800, slope: 0.5 }, { kind: 'rock', n: 600 }]
  },
  start: [-2900, 1150, 3600, yawTo(-2900, 3600, 0, 0)], ammo: { gun: 900, bombs: 20, msl: 10, flares: 50 },
  objectives: [{ label: 'SAM sites', tag: 'sam' }, { label: 'Radars', tag: 'radar' }, { label: 'Command centre', tag: 'core' }, { label: 'Enemy fighters', tag: 'jets', count: 8 }],
  aaMul: 0.85, samMul: 1.06,
  fighters: [{ at: 15, n: 3, from: [1500, 1300, -2500], skill: 0.85 }, { at: 120, n: 3, from: [-2800, 1400, -2200], skill: 0.9 }, { when: W => { const c = W.targets.find(t => t.tag === 'core'); return c && c.hp < c.maxHp * 0.6; }, n: 2, from: [2800, 1200, 2400], skill: 0.95 }],
  populate(W, R) {
    W.wallRing(0, 0, 560, 44, 2);
    W.add('command', 0, 0, { tag: 'core' });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3, r = i % 2 ? 380 : 470; W.add('sam', Math.cos(a) * r, Math.sin(a) * r, { tag: 'sam', yaw: a }); }
    W.add('radar', 200, -260, { tag: 'radar' }); W.add('radar', -260, 210, { tag: 'radar' });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, r = 250; W.add('flak', Math.cos(a) * r, Math.sin(a) * r, {}); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2, r = 530; W.add('aa', Math.cos(a) * r, Math.sin(a) * r, { y: W.terrain.height(Math.cos(a) * r, Math.sin(a) * r) + 9.5 }); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.8, r = 150; W.add('bunker', Math.cos(a) * r, Math.sin(a) * r, { yaw: a }); }
    W.add('hangar', 380, 120, { yaw: 1.2 }); W.add('hangar', -360, -200, { yaw: -1.9 });
    for (let i = 0; i < 4; i++) W.add('tank', -100 + i * 40, 320, { yaw: 0.3 });
    W.rearm(-2200, 900, 2200); W.rearm(2400, 1000, -2000);
  }
};

export const MISSIONS = [M1, M2, M3, M4, M5, M6, M7, M8];
void slots; void wall; void clamp;

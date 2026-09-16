/* Demon Fall — every surface is painted here with canvas 2D, then handed to
 * three.js as a texture. No image files ship with the game, so the whole world
 * loads instantly and still gets grime, cracks, rust and tilework.
 *
 * Each material also gets a normal map derived from the same drawing, which is
 * what makes flat boxes catch the flashlight like real brick and concrete. */
import * as THREE from 'three';
import { fbm, noise2, makeRng, clamp } from './util.js';

const SIZE = 512;
const cache = new Map();

function canvas(size = SIZE) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

/** Grain speckle laid over the whole tile; the backbone of every dirty surface. */
function grain(ctx, size, amount, dark = true) {
  const img = ctx.getImageData(0, 0, size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount * 255;
    d[i] = clamp(d[i] + n, 0, 255);
    d[i + 1] = clamp(d[i + 1] + n, 0, 255);
    d[i + 2] = clamp(d[i + 2] + n, 0, 255);
  }
  ctx.putImageData(img, 0, 0);
  if (dark) {
    // soft blotches of dirt, wrapped so the tile still repeats seamlessly
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * size, y = Math.random() * size, r = 20 + Math.random() * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,0.8)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
        ctx.save(); ctx.translate(dx, dy); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
}

/** A jagged crack, drawn as a walk with decreasing width. */
function crack(ctx, x, y, len, angle, width, colour, rng) {
  ctx.strokeStyle = colour;
  ctx.lineCap = 'round';
  let cx = x, cy = y, a = angle, w = width;
  ctx.beginPath(); ctx.moveTo(cx, cy);
  for (let i = 0; i < len; i++) {
    a += (rng() - 0.5) * 0.7;
    cx += Math.cos(a) * 6; cy += Math.sin(a) * 6;
    ctx.lineWidth = Math.max(0.4, w);
    ctx.lineTo(cx, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy);
    w *= 0.96;
    if (rng() < 0.08 && w > 0.9) crack(ctx, cx, cy, len * 0.4, a + (rng() < 0.5 ? 1 : -1), w * 0.6, colour, rng);
  }
}

/** Sobel the luminance of a drawing into a tangent-space normal map. */
function normalFrom(srcCanvas, strength = 2.2) {
  const size = srcCanvas.width;
  const src = srcCanvas.getContext('2d').getImageData(0, 0, size, size).data;
  const out = canvas(size), octx = out.getContext('2d');
  const img = octx.createImageData(size, size), d = img.data;
  const lum = (x, y) => {
    const xi = (x + size) % size, yi = (y + size) % size;
    const i = (yi * size + xi) * 4;
    return (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (lum(x - 1, y) - lum(x + 1, y)) * strength;
      const dy = (lum(x, y - 1) - lum(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      d[i] = ((dx / len) * 0.5 + 0.5) * 255;
      d[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      d[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

function texFrom(cv, repeat) {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (repeat) t.repeat.set(repeat, repeat);
  return t;
}

/* ------------------------------------------------------------------ painters
 * Each returns a function that fills one seamless tile. */
const PAINT = {
  asphalt(ctx, size, rng) {
    ctx.fillStyle = '#3c3c44'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 2600; i++) {
      const x = rng() * size, y = rng() * size, r = rng() * 2.4 + 0.4;
      const v = 48 + rng() * 60;
      ctx.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + rng() * 0.5})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 4; i++) crack(ctx, rng() * size, rng() * size, 40, rng() * 6.28, 2.4, 'rgba(8,8,10,0.9)', rng);
    grain(ctx, size, 0.12);
  },
  concrete(ctx, size, rng) {
    ctx.fillStyle = '#6b6963'; ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        const n = fbm(x / 46, y / 46, 4, 21);
        const v = 96 + n * 52;
        ctx.fillStyle = `rgb(${v},${v - 2},${v - 8})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
    // pour lines and pitting
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 120; i++) {
      const x = rng() * size, y = rng() * size, r = rng() * 3 + 0.6;
      ctx.fillStyle = rng() < 0.5 ? '#3d3b37' : '#8d8a82';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) crack(ctx, rng() * size, rng() * size, 46, rng() * 6.28, 1.8, 'rgba(40,38,35,0.85)', rng);
    grain(ctx, size, 0.1);
  },
  brick(ctx, size, rng) {
    const bh = size / 10, bw = size / 5;
    ctx.fillStyle = '#3a322e'; ctx.fillRect(0, 0, size, size);   // mortar
    for (let row = 0; row < 10; row++) {
      const off = (row % 2) * bw * 0.5;
      for (let col = -1; col < 6; col++) {
        const x = col * bw + off + 2, y = row * bh + 2, w = bw - 4, h = bh - 4;
        const shade = 0.72 + rng() * 0.5;
        const r = Math.floor(126 * shade), g = Math.floor(62 * shade), b = Math.floor(48 * shade);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, w, h);
        // top light / bottom shade gives each brick a bevel
        ctx.fillStyle = 'rgba(255,220,200,0.09)'; ctx.fillRect(x, y, w, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x, y + h - 2, w, 2);
        if (rng() < 0.18) {   // a broken or sooted brick
          ctx.fillStyle = `rgba(20,16,14,${0.3 + rng() * 0.4})`;
          ctx.fillRect(x + rng() * w * 0.5, y, w * (0.3 + rng() * 0.5), h);
        }
      }
    }
    grain(ctx, size, 0.14);
  },
  plaster(ctx, size, rng) {
    ctx.fillStyle = '#a89d8c'; ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) {
      const v = 150 + fbm(x / 60, y / 60, 3, 5) * 60;
      ctx.fillStyle = `rgb(${v},${v - 8},${v - 22})`;
      ctx.fillRect(x, y, 2, 2);
    }
    // patches where the plaster has fallen away to brick
    for (let i = 0; i < 3; i++) {
      const x = rng() * size, y = rng() * size, r = 12 + rng() * 30;
      ctx.save(); ctx.beginPath();
      for (let a = 0; a < 7; a++) {
        const ang = (a / 7) * Math.PI * 2, rr = r * (0.6 + rng() * 0.6);
        ctx[a ? 'lineTo' : 'moveTo'](x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
      }
      ctx.closePath(); ctx.clip();
      ctx.fillStyle = '#6a5446'; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let k = 0; k < 8; k++) ctx.fillRect(x - r, y - r + k * 10, r * 2, 2);
      ctx.restore();
    }
    for (let i = 0; i < 4; i++) crack(ctx, rng() * size, rng() * size, 50, rng() * 6.28, 1.6, 'rgba(60,50,42,0.8)', rng);
    grain(ctx, size, 0.09);
  },
  rust(ctx, size, rng) {
    ctx.fillStyle = '#5d5f63'; ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) {
      const n = fbm(x / 30, y / 30, 4, 77);
      if (n > 0.52) {
        const t = (n - 0.52) / 0.48;
        ctx.fillStyle = `rgba(${130 + t * 60},${60 + t * 30},${26 + t * 12},${0.35 + t})`;
      } else {
        const v = 78 + n * 60;
        ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
      }
      ctx.fillRect(x, y, 2, 2);
    }
    // rivets round the edges
    ctx.fillStyle = 'rgba(200,200,205,0.35)';
    for (let i = 0; i < 12; i++) {
      const x = 14 + (i % 6) * (size / 6), y = i < 6 ? 14 : size - 14;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    grain(ctx, size, 0.13);
  },
  tile(ctx, size, rng) {
    const n = 8, s = size / n;
    ctx.fillStyle = '#2c2f33'; ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dirty = rng();
      const base = dirty < 0.12 ? 120 : 196 - dirty * 40;
      ctx.fillStyle = `rgb(${base},${base + 4},${base - 6})`;
      ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillRect(x * s + 2, y * s + s - 6, s - 4, 4);
      if (rng() < 0.15) {   // cracked tile
        ctx.save(); ctx.beginPath(); ctx.rect(x * s + 2, y * s + 2, s - 4, s - 4); ctx.clip();
        crack(ctx, x * s + s / 2, y * s + s / 2, 10, rng() * 6.28, 1.2, 'rgba(40,40,45,0.9)', rng);
        ctx.restore();
      }
    }
    // stains creeping out of the grout
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 16; i++) {
      const x = rng() * size, y = rng() * size, r = 10 + rng() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(40,52,30,0.9)'); g.addColorStop(1, 'rgba(40,52,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    grain(ctx, size, 0.07);
  },
  marble(ctx, size, rng) {
    ctx.fillStyle = '#efe9dc'; ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) {
      const v = 226 + fbm(x / 80, y / 80, 3, 11) * 26;
      ctx.fillStyle = `rgb(${v},${v - 4},${v - 12})`;
      ctx.fillRect(x, y, 2, 2);
    }
    // veins
    for (let i = 0; i < 9; i++) {
      ctx.globalAlpha = 0.16 + rng() * 0.2;
      crack(ctx, rng() * size, rng() * size, 70, rng() * 6.28, 3 + rng() * 3, '#8d8375', rng);
    }
    ctx.globalAlpha = 1;
    // inlaid squares at the tile edges so big floors read as slabs
    ctx.strokeStyle = 'rgba(120,108,88,0.5)'; ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
    grain(ctx, size, 0.04, false);
  },
  gold(ctx, size, rng) {
    ctx.fillStyle = '#b8860b'; ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) {
      const n = fbm(x / 22, y / 22, 3, 33);
      const v = 150 + n * 105;
      ctx.fillStyle = `rgb(${v},${v * 0.76 | 0},${v * 0.28 | 0})`;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 60; i++) {
      const x = rng() * size, y = rng() * size;
      ctx.fillStyle = 'rgba(255,240,180,0.8)';
      ctx.fillRect(x, y, 2 + rng() * 6, 1 + rng() * 2);
    }
    ctx.globalAlpha = 1;
  },
  sand(ctx, size, rng) {
    ctx.fillStyle = '#9c4a2c'; ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) {
      const n = fbm(x / 40, y / 40, 4, 55) * 0.7 + noise2(x / 6, y / 6, 3) * 0.3;
      const v = 120 + n * 90;
      ctx.fillStyle = `rgb(${v},${v * 0.52 | 0},${v * 0.34 | 0})`;
      ctx.fillRect(x, y, 2, 2);
    }
    for (let i = 0; i < 700; i++) {   // pebbles
      const x = rng() * size, y = rng() * size, r = rng() * 2.6 + 0.5;
      const v = 80 + rng() * 90;
      ctx.fillStyle = `rgba(${v},${v * 0.5 | 0},${v * 0.36 | 0},0.85)`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    grain(ctx, size, 0.1, false);
  },
  hull(ctx, size, rng) {
    ctx.fillStyle = '#b9bec6'; ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) {
      const v = 170 + fbm(x / 70, y / 70, 3, 9) * 45;
      ctx.fillStyle = `rgb(${v},${v + 3},${v + 10})`;
      ctx.fillRect(x, y, 2, 2);
    }
    // panel seams
    ctx.strokeStyle = 'rgba(60,68,80,0.55)'; ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(0, (i * size) / 4); ctx.lineTo(size, (i * size) / 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo((i * size) / 4, 0); ctx.lineTo((i * size) / 4, size); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(70,80,95,0.5)';
    for (let i = 0; i < 40; i++) {
      const x = rng() * size, y = rng() * size;
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    grain(ctx, size, 0.05, false);
  },
  flesh(ctx, size, rng) {
    ctx.fillStyle = '#6d7a5e'; ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) {
      const n = fbm(x / 26, y / 26, 4, 61);
      const v = 90 + n * 70;
      ctx.fillStyle = `rgb(${v * 0.85 | 0},${v | 0},${v * 0.7 | 0})`;
      ctx.fillRect(x, y, 2, 2);
    }
    for (let i = 0; i < 40; i++) {   // wounds and bruises
      const x = rng() * size, y = rng() * size, r = 4 + rng() * 22;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${90 + rng() * 60},20,26,0.75)`);
      g.addColorStop(1, 'rgba(60,20,26,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    grain(ctx, size, 0.12, false);
  },
  bark(ctx, size, rng) {
    ctx.fillStyle = '#3a2c22'; ctx.fillRect(0, 0, size, size);
    // vertical ridges, broken up so the trunk doesn't look striped
    for (let x = 0; x < size; x += 3) {
      const v = 40 + rng() * 40;
      ctx.fillStyle = `rgba(${v + 18},${v + 6},${v - 4},0.9)`;
      let y = 0;
      while (y < size) {
        const len = 20 + rng() * 90;
        ctx.fillRect(x + Math.sin(y * 0.05) * 2, y, 2 + rng() * 2, len);
        y += len + rng() * 14;
      }
    }
    ctx.fillStyle = 'rgba(10,8,6,0.55)';
    for (let i = 0; i < 90; i++) ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 6 + rng() * 30);
    grain(ctx, size, 0.1);
  },
  foliage(ctx, size, rng) {
    ctx.fillStyle = '#1f2a18'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 2200; i++) {   // overlapping leaf clumps, sickly and dry
      const x = rng() * size, y = rng() * size, r = 2 + rng() * 7;
      const g = 50 + rng() * 60;
      const dead = rng() < 0.3;
      ctx.fillStyle = dead ? `rgba(${g + 50},${g + 20},${g - 20},0.8)` : `rgba(${g * 0.55 | 0},${g},${g * 0.4 | 0},0.8)`;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, rng() * 3, 0, Math.PI * 2); ctx.fill();
    }
    grain(ctx, size, 0.08, false);
  },
  wood(ctx, size, rng) {
    const planks = 6, ph = size / planks;
    for (let p = 0; p < planks; p++) {
      const base = 70 + rng() * 40;
      ctx.fillStyle = `rgb(${base + 30},${base + 8},${base - 20})`;
      ctx.fillRect(0, p * ph, size, ph);
      ctx.strokeStyle = 'rgba(30,18,10,0.35)';
      for (let k = 0; k < 7; k++) {   // grain lines
        ctx.lineWidth = 1 + rng();
        ctx.beginPath();
        const y0 = p * ph + rng() * ph;
        ctx.moveTo(0, y0);
        for (let x = 0; x <= size; x += 32) ctx.lineTo(x, y0 + Math.sin(x * 0.02 + k) * 3);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, p * ph, size, 3);              // gap between planks
      ctx.fillStyle = 'rgba(40,40,44,0.8)';          // nails
      ctx.fillRect(18, p * ph + ph / 2, 4, 4); ctx.fillRect(size - 22, p * ph + ph / 2, 4, 4);
    }
    grain(ctx, size, 0.1);
  },
  dirt(ctx, size, rng) {
    ctx.fillStyle = '#3d3226'; ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) {
      const v = 44 + fbm(x / 34, y / 34, 4, 17) * 50;
      ctx.fillStyle = `rgb(${v + 10},${v},${v * 0.72 | 0})`;
      ctx.fillRect(x, y, 2, 2);
    }
    for (let i = 0; i < 500; i++) {   // stones and dead grass
      const x = rng() * size, y = rng() * size;
      if (rng() < 0.5) {
        const v = 70 + rng() * 60;
        ctx.fillStyle = `rgba(${v},${v - 6},${v - 14},0.9)`;
        ctx.beginPath(); ctx.arc(x, y, 1 + rng() * 3, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = `rgba(${110 + rng() * 40},${96 + rng() * 30},50,0.7)`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rng() * 6 - 3, y - 4 - rng() * 8); ctx.stroke();
      }
    }
    grain(ctx, size, 0.1);
  },
  demonHide(ctx, size, rng) {
    ctx.fillStyle = '#2a1014'; ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) {
      const n = fbm(x / 18, y / 18, 4, 101);
      const v = 30 + n * 70;
      ctx.fillStyle = `rgb(${v * 1.6 | 0},${v * 0.5 | 0},${v * 0.45 | 0})`;
      ctx.fillRect(x, y, 2, 2);
    }
    // glowing cracks in the hide
    for (let i = 0; i < 7; i++) {
      ctx.globalAlpha = 0.85;
      crack(ctx, rng() * size, rng() * size, 40, rng() * 6.28, 2.4, '#ff6a1e', rng);
    }
    ctx.globalAlpha = 1;
    grain(ctx, size, 0.1, false);
  }
};

/**
 * A cached three.js material for one of the painters above.
 * opts: { repeat, roughness, metalness, normalScale, color, emissive }
 */
export function material(name, opts = {}) {
  const key = name + JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);
  const rng = makeRng(name.length * 7919 + 13);
  const cv = canvas(opts.size || SIZE);
  const ctx = cv.getContext('2d');
  (PAINT[name] || PAINT.concrete)(ctx, cv.width, rng);

  const map = texFrom(cv, opts.repeat || 1);
  const normalMap = texFrom(normalFrom(cv, opts.bump == null ? 2.2 : opts.bump), opts.repeat || 1);
  if (opts.srgb !== false) map.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshStandardMaterial({
    map, normalMap,
    normalScale: new THREE.Vector2(opts.normalScale || 1, opts.normalScale || 1),
    roughness: opts.roughness == null ? 0.92 : opts.roughness,
    metalness: opts.metalness == null ? 0.02 : opts.metalness,
    color: opts.color == null ? 0xffffff : opts.color,
    emissive: opts.emissive == null ? 0x000000 : opts.emissive,
    emissiveIntensity: opts.emissiveIntensity == null ? 1 : opts.emissiveIntensity
  });
  // far scenery opts out of fog so it reads as a silhouette on the horizon
  if (opts.fog === false) mat.fog = false;
  cache.set(key, mat);
  return mat;
}

/** Small round splat used for blood decals and scorch marks. */
export function splatTexture(colour = '#6d0d16', seed = 4) {
  const key = 'splat' + colour + seed;
  if (cache.has(key)) return cache.get(key);
  const rng = makeRng(seed * 977 + 31);
  const cv = canvas(128), ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = colour;
  const blobs = 10 + rng.int(0, 10);
  for (let i = 0; i < blobs; i++) {
    const a = rng() * Math.PI * 2, d = rng() * 34;
    const x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, r = 6 + rng() * 22 * (1 - d / 50);
    ctx.globalAlpha = 0.5 + rng() * 0.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 24; i++) {   // flung droplets
    const a = rng() * Math.PI * 2, d = 28 + rng() * 34;
    ctx.globalAlpha = 0.4 + rng() * 0.5;
    ctx.beginPath(); ctx.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 1 + rng() * 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // fade the rim so the decal never shows a hard square edge
  const g = ctx.createRadialGradient(64, 64, 30, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  ctx.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** Soft round sprite for smoke, embers and muzzle flashes. */
export function puffTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const key = 'puff' + inner + outer;
  if (cache.has(key)) return cache.get(key);
  const cv = canvas(128), ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(0.45, inner.replace(/[\d.]+\)$/, '0.55)')); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** A glowing sign/poster texture, used for objective markers and signage. */
export function signTexture(text, bg = '#0d0d12', fg = '#ff7a2f') {
  const key = 'sign' + text + bg + fg;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = fg; ctx.lineWidth = 6; ctx.strokeRect(8, 8, 496, 112);
  ctx.fillStyle = fg;
  ctx.font = 'bold 56px Bahnschrift, "DIN Alternate", "Segoe UI", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

export function disposeAll() {
  cache.forEach(v => { if (v.dispose) v.dispose(); });
  cache.clear();
}

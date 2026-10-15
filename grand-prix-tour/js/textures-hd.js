/* High-detail procedural textures for the graphics upgrade. */
import * as THREE from 'three';
import { rng } from './textures.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}
const cache = new Map();
function memo(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }

/* 2x2 twill carbon weave (grey, multiplied by the part colour). */
export function carbon() {
  return memo('carbon', () => {
    const [c, g] = canvas(128, 128);
    const t = 8;
    for (let y = 0; y < 128; y += t) for (let x = 0; x < 128; x += t) {
      const k = ((x / t) + (y / t)) % 4 < 2;
      const grd = k ? g.createLinearGradient(x, y, x + t, y) : g.createLinearGradient(x, y, x, y + t);
      grd.addColorStop(0, '#5c5c62'); grd.addColorStop(0.5, '#c4c4cc'); grd.addColorStop(1, '#5c5c62');
      g.fillStyle = grd; g.fillRect(x, y, t, t);
    }
    return tex(c);
  });
}

/* Asphalt: aggregate, rubbered racing line, skid marks, patch repairs,
 * sealed cracks, lines. Returns { map, rough }. */
export function asphaltHD(base = '#55575c', line = '#f4f4f4', wet = false) {
  return memo('asphHD' + base + line + wet, () => {
    const W = 512, H = 1024, r = rng(91);
    const [c, g] = canvas(W, H), [rc, rg] = canvas(W, H);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * 22 + (r() < 0.02 ? 22 : 0) - (r() < 0.02 ? 16 : 0);
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    rg.fillStyle = wet ? '#3a3a3a' : '#d8d8d8'; rg.fillRect(0, 0, W, H);
    for (let k = 0; k < 7; k++) {
      const x = r() * W, y = r() * H, w = 40 + r() * 140, h = 60 + r() * 240;
      g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)'; g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
    }
    g.strokeStyle = 'rgba(10,10,12,0.25)'; g.lineWidth = 2;
    for (let k = 0; k < 14; k++) { let x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 8; j++) { x += (r() - 0.5) * 40; y += r() * 30; g.lineTo(x, y); } g.stroke(); }
    const grd = g.createLinearGradient(0, 0, W, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.28, 'rgba(0,0,0,0.2)'); grd.addColorStop(0.42, 'rgba(0,0,0,0.08)');
    grd.addColorStop(0.58, 'rgba(0,0,0,0.08)'); grd.addColorStop(0.72, 'rgba(0,0,0,0.2)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 7; k++) {
      const x0 = W * (0.2 + r() * 0.6), y0 = r() * H, len = 120 + r() * 400, bend = (r() - 0.5) * 60;
      g.strokeStyle = `rgba(8,8,10,${0.06 + r() * 0.1})`; g.lineWidth = 5 + r() * 5;
      for (const off of [0, 26]) { g.beginPath(); g.moveTo(x0 + off, y0); g.quadraticCurveTo(x0 + off + bend, y0 + len / 2, x0 + off + bend * 0.3, y0 + len); g.stroke(); }
    }
    if (wet) for (let k = 0; k < 22; k++) {
      const x = r() * W, y = r() * H, rx = 20 + r() * 70, ry = 40 + r() * 140;
      g.fillStyle = 'rgba(20,24,30,0.35)'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill();
      rg.fillStyle = '#080808'; rg.beginPath(); rg.ellipse(x, y, rx, ry, 0, 0, 7); rg.fill();
    }
    g.fillStyle = line; g.fillRect(12, 0, 13, H); g.fillRect(W - 25, 0, 13, H); g.fillRect(250, 0, 12, 440);
    rg.fillStyle = wet ? '#606060' : '#a8a8a8'; rg.fillRect(12, 0, 13, H); rg.fillRect(W - 25, 0, 13, H); rg.fillRect(250, 0, 12, 440);
    return { map: tex(c), rough: tex(rc, { srgb: false }) };
  });
}

/* Painted kerb with grime and stripe seams. */
export function kerbHD() {
  return memo('kerbHD', () => {
    const [c, g] = canvas(128, 256), r = rng(3);
    g.fillStyle = '#d42020'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#f2f2f2'; g.fillRect(0, 128, 128, 128);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.fillRect(r() * 128, r() * 256, 2, 2); }
    for (let y = 0; y < 256; y += 16) { g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(0, y, 128, 2); }
    return tex(c);
  });
}

/* Ground detail per theme, multiplied over the terrain's vertex colours. */
export function groundTex(kind) {
  return memo('ground' + kind, () => {
    const S = 512, [c, g] = canvas(S, S), r = rng(kind.length * 13 + 7);
    g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, S, S);
    const img = g.getImageData(0, 0, S, S), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = (r() - 0.5) * 46; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
    g.putImageData(img, 0, 0);
    if (kind === 'grass') {
      for (let i = 0; i < 9000; i++) {
        const x = r() * S, y = r() * S, l = 3 + r() * 6;
        g.strokeStyle = r() < 0.5 ? `rgba(70,90,40,${0.25 + r() * 0.3})` : `rgba(240,245,210,${0.15 + r() * 0.2})`;
        g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - l); g.stroke();
      }
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,70,40,${r() * 0.14})`; g.beginPath(); g.arc(r() * S, r() * S, 6 + r() * 26, 0, 7); g.fill(); }
    } else if (kind === 'sand') {
      g.strokeStyle = 'rgba(120,90,60,0.16)'; g.lineWidth = 3;
      for (let y = 0; y < S; y += 9) { g.beginPath(); for (let x = 0; x <= S; x += 8) g.lineTo(x, y + Math.sin(x / 23 + y * 0.7) * 4); g.stroke(); }
      for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,250,235' : '90,70,50'},${r() * 0.3})`; g.fillRect(r() * S, r() * S, 1.5, 1.5); }
    } else if (kind === 'snow') {
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(150,170,200,${r() * 0.12})`; g.beginPath(); g.ellipse(r() * S, r() * S, 20 + r() * 60, 8 + r() * 20, r() * 3, 0, 7); g.fill(); }
      for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`; g.fillRect(r() * S, r() * S, 1, 1); }
    } else if (kind === 'dirt') {
      for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '70,40,25' : '250,215,185'},${r() * 0.22})`; g.beginPath(); g.arc(r() * S, r() * S, 0.5 + r() * 2.5, 0, 7); g.fill(); }
      for (let i = 0; i < 300; i++) { const x = r() * S, y = r() * S; g.strokeStyle = 'rgba(90,95,60,0.3)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y - 5); g.stroke(); }
    } else if (kind === 'pavement') {
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2;
      for (let k = 0; k <= S; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, S); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(S, k); g.stroke(); }
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.1})`; g.fillRect(Math.floor(r() * 8) * 64, Math.floor(r() * 8) * 64, 64, 64); }
    }
    return tex(c, { srgb: false });
  });
}

/* Billboard atlas: 8 fictional brands in 4 x 2 cells of 256 x 64. */
export const BRANDS = [
  ['NOVA FUEL', '#ff5a1f', '#ffffff'], ['KESTREL TYRES', '#ffd400', '#111111'], ['ORBIT TELECOM', '#1f4fd8', '#ffffff'],
  ['AQUILA WATCHES', '#0b2030', '#e8c46a'], ['VELOX ENERGY', '#16c060', '#0b1a10'], ['NEXUS PLAY', '#e10600', '#ffffff'],
  ['MERIDIAN AIR', '#ffffff', '#1f4fd8'], ['SOLACE COLA', '#c0103a', '#ffffff']
];
export function billboards() {
  return memo('billboards', () => {
    const [c, g] = canvas(1024, 128);
    BRANDS.forEach(([name, bg, fg], i) => {
      const x = (i % 4) * 256, y = Math.floor(i / 4) * 64;
      g.fillStyle = bg; g.fillRect(x, y, 256, 64);
      g.fillStyle = fg; g.font = 'bold 30px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(name, x + 128, y + 32);
      g.fillRect(x + 24, y + 52, 208, 3);
    });
    return tex(c, { repeat: false });
  });
}

/* Water normal map from layered tiling sine waves. */
export function waterNormals() {
  return memo('waterN', () => {
    const S = 256, [c, g] = canvas(S, S), img = g.createImageData(S, S), d = img.data, r = rng(17);
    const waves = Array.from({ length: 10 }, () => [1 + Math.floor(r() * 6), Math.floor(r() * 6) - 2, r() * 6.28, 0.5 + r()]);
    const h = (x, y) => waves.reduce((a, [fx, fy, ph, amp]) => a + amp * Math.sin((x * fx + y * fy) * Math.PI * 2 / S + ph), 0);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1);
      const n = new THREE.Vector3(-dx * 0.3, -dy * 0.3, 1).normalize(), i = (y * S + x) * 4;
      d[i] = (n.x * 0.5 + 0.5) * 255; d[i + 1] = (n.y * 0.5 + 0.5) * 255; d[i + 2] = (n.z * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return tex(c, { srgb: false });
  });
}

/* Stripes of flag colours; each flag instance samples one by UV in a baked mesh. */
export function flagTex() {
  return memo('flags', () => {
    const [c, g] = canvas(256, 32);
    ['#e10600', '#ffd400', '#1f4fd8', '#16c060', '#ffffff', '#ff7a1a', '#b14cff', '#111111'].forEach((col, i) => { g.fillStyle = col; g.fillRect(i * 32, 0, 32, 32); });
    return tex(c, { repeat: false });
  });
}

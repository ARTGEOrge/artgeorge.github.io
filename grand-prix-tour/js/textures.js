/* Procedural canvas textures — nothing is loaded from disk. */
import * as THREE from 'three';

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { repeat = true, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}
const cache = new Map();
function memo(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }

/* Asphalt: grain, darker racing groove in the middle of each lane, white edge
 * lines and a dashed centre line. u runs across the road, v along it. */
export function asphalt(base = '#55575c', line = '#f4f4f4', wet = false) {
  return memo('asph' + base + line + wet, () => {
    const [c, g] = canvas(256, 512);
    g.fillStyle = base; g.fillRect(0, 0, 256, 512);
    const r = rng(77);
    const img = g.getImageData(0, 0, 256, 512), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * 18 + (r() < 0.03 ? 16 : 0);
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    // rubbered-in racing line
    const grd = g.createLinearGradient(0, 0, 256, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.3, 'rgba(0,0,0,0.16)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0.05)'); grd.addColorStop(0.7, 'rgba(0,0,0,0.16)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 512);
    if (wet) { // puddle sheen patches
      for (let i = 0; i < 18; i++) {
        g.fillStyle = `rgba(150,170,190,${0.05 + r() * 0.08})`;
        g.beginPath(); g.ellipse(r() * 256, r() * 512, 10 + r() * 30, 20 + r() * 60, 0, 0, 7); g.fill();
      }
    }
    g.fillStyle = line;
    g.fillRect(6, 0, 7, 512); g.fillRect(243, 0, 7, 512);
    g.fillRect(125, 0, 6, 220);
    return tex(c);
  });
}

export function kerb() {
  return memo('kerb', () => {
    const [c, g] = canvas(64, 128);
    g.fillStyle = '#d42020'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 64, 64, 64);
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 0, 6, 128);
    return tex(c);
  });
}

/* Barriers: u across the length (repeats), v up the height. */
export function barrier(style, accent = '#ff3aa8') {
  return memo('bar' + style + accent, () => {
    const [c, g] = canvas(256, 64);
    if (style === 'armco') {
      g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, 256, 64);
      for (let y = 8; y < 56; y += 16) { g.fillStyle = '#c8ced4'; g.fillRect(0, y, 256, 6); g.fillStyle = '#6c7278'; g.fillRect(0, y + 8, 256, 3); }
      g.fillStyle = '#4a4e52'; for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 6, 64);
    } else if (style === 'tecpro') {
      for (let x = 0; x < 256; x += 32) { g.fillStyle = (x / 32) % 2 ? '#f2f2f2' : '#d42a2a'; g.fillRect(x, 0, 32, 64); }
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 2, 64);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 6, 256, 4);
    } else if (style === 'wall') {
      g.fillStyle = '#d8d2c6'; g.fillRect(0, 0, 256, 64);
      g.fillStyle = '#2a4a8a'; g.fillRect(0, 10, 256, 26);
      g.fillStyle = '#f2f2f2'; g.font = 'bold 18px sans-serif'; g.fillText('WORLD TOUR', 18, 30); g.fillText('GRAND PRIX', 150, 30);
      g.fillStyle = 'rgba(0,0,0,0.2)'; for (let x = 0; x < 256; x += 128) g.fillRect(x, 0, 3, 64);
    } else if (style === 'stone') { // dry-stone / masonry wall
      g.fillStyle = '#8a857c'; g.fillRect(0, 0, 256, 64);
      const r = rng(31);
      for (let y = 0; y < 64; y += 12) for (let x = -(y % 24); x < 256; x += 22 + r() * 10) {
        const v = 110 + r() * 60 | 0; g.fillStyle = `rgb(${v},${v - 4},${v - 12})`; g.fillRect(x + 1, y + 1, 20 + r() * 8, 10);
      }
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 60, 256, 4);
    } else { // neon city wall: dark concrete with a glowing strip
      g.fillStyle = '#2a2a33'; g.fillRect(0, 0, 256, 64);
      g.fillStyle = '#3c3c48'; for (let x = 0; x < 256; x += 64) g.fillRect(x + 2, 4, 58, 40);
      g.fillStyle = accent; g.fillRect(0, 50, 256, 6);
      g.fillStyle = '#ffffff'; g.fillRect(0, 52, 256, 2);
    }
    return tex(c);
  });
}

/* Ground detail: greyscale noise multiplied over vertex colours. */
export function detail() {
  return memo('detail', () => {
    const [c, g] = canvas(256, 256);
    const img = g.createImageData(256, 256), d = img.data, r = rng(5);
    for (let i = 0; i < d.length; i += 4) { const v = 200 + (r() - 0.5) * 90; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.12})`; g.beginPath(); g.arc(r() * 256, r() * 256, 2 + r() * 14, 0, 7); g.fill(); }
    return tex(c, { srgb: false });
  });
}

/* Building facades: a grid of windows. Night versions are lit, used as emissive. */
export function windows(night) {
  return memo('win' + night, () => {
    const [c, g] = canvas(128, 256), r = rng(night ? 9 : 4);
    g.fillStyle = night ? '#000' : '#ffffff'; g.fillRect(0, 0, 128, 256);
    for (let y = 6; y < 256; y += 16) for (let x = 6; x < 128; x += 16) {
      if (night) {
        const on = r() < 0.55;
        g.fillStyle = on ? (r() < 0.75 ? '#ffd9a0' : '#bfe4ff') : '#08080c';
        g.globalAlpha = on ? 0.6 + r() * 0.4 : 1;
      } else { g.fillStyle = r() < 0.5 ? '#6c7f96' : '#8ea0b4'; g.globalAlpha = 1; }
      g.fillRect(x, y, 9, 10);
    }
    g.globalAlpha = 1;
    return tex(c);
  });
}

export function crowd() {
  return memo('crowd', () => {
    const [c, g] = canvas(256, 64), r = rng(12);
    g.fillStyle = '#2a2a30'; g.fillRect(0, 0, 256, 64);
    const cols = ['#e33', '#fd3', '#fff', '#39f', '#3c6', '#f80', '#c3f', '#222', '#f9c'];
    for (let row = 0; row < 4; row++) for (let x = 2; x < 256; x += 5) {
      g.fillStyle = cols[(r() * cols.length) | 0]; g.fillRect(x, row * 16 + 6 + r() * 3, 3, 6);
      g.fillStyle = '#e8c4a0'; g.fillRect(x + 0.5, row * 16 + 3 + r() * 2, 2, 3);
    }
    return tex(c);
  });
}

export function chequer() {
  return memo('cheq', () => {
    const [c, g] = canvas(128, 32);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 16, y * 16, 16, 16); }
    return tex(c);
  });
}

export function banner(text, bg = '#d42020', fg = '#ffffff', w = 512, h = 64) {
  return memo('ban' + text + bg + fg, () => {
    const [c, g] = canvas(w, h);
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = `bold ${h * 0.56}px "Chakra Petch", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
    return tex(c, { repeat: false });
  });
}

export function softDot() {
  return memo('dot', () => {
    const [c, g] = canvas(64, 64);
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return tex(c, { repeat: false, srgb: false });
  });
}

export function blob() {
  return memo('blob', () => {
    const [c, g] = canvas(64, 128);
    const grd = g.createRadialGradient(32, 64, 4, 32, 64, 32);
    grd.addColorStop(0, 'rgba(0,0,0,0.75)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.setTransform(1, 0, 0, 2, 0, -64); g.fillStyle = grd; g.fillRect(0, 0, 64, 128);
    return tex(c, { repeat: false, srgb: false });
  });
}

/* Car side decal: team name and race number. */
export function decal(liv) {
  const [c, g] = canvas(256, 128);
  g.clearRect(0, 0, 256, 128);
  g.fillStyle = liv.b; g.font = 'bold 74px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(liv.num), 70, 64);
  g.font = 'bold 22px "Chakra Petch", sans-serif'; g.fillStyle = liv.b;
  const words = liv.team.toUpperCase().split(' ');
  g.textAlign = 'left'; g.fillText(words[0], 128, 50); if (words[1]) g.fillText(words[1], 128, 78);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

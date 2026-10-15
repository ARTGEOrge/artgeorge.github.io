/* Fighter HUD drawn on a 2D canvas: pitch ladder, heading tape, speed and
 * altitude boxes, G, weapons, target boxes, lock diamond, CCIP bomb pipper,
 * warnings — plus the heading-up radar minimap. */
import * as THREE from 'three';
import { clamp } from './util.js';

const G = '#5dff9a', GD = 'rgba(93,255,154,.55)', RED = '#ff4a3a', AMB = '#ffcb3a';
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3();

export class HUD {
  constructor(canvas, mini) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.mini = mini; this.mg = mini.getContext('2d'); this.t = 0; this.scale = 1;
  }
  resize() {
    const pr = Math.min(devicePixelRatio || 1, 2);
    this.c.width = Math.round(innerWidth * pr); this.c.height = Math.round(innerHeight * pr); this.pr = pr;
    this.scale = clamp(Math.min(innerWidth, innerHeight * 1.5) / 1100, 0.62, 1.25);
  }
  proj(cam, p, out = {}) {
    _v.copy(p).project(cam);
    out.x = (_v.x * 0.5 + 0.5) * innerWidth; out.y = (-_v.y * 0.5 + 0.5) * innerHeight; out.in = _v.z < 1 && _v.z > -1; out.z = _v.z;
    return out;
  }
  draw(W, dt, opt = {}) {
    this.t += dt;
    const g = this.g, cam = W.camera, P = W.player, w = innerWidth, h = innerHeight, S = this.scale, cock = W.camMode === 'cockpit';
    g.setTransform(this.pr, 0, 0, this.pr, 0, 0); g.clearRect(0, 0, w, h);
    if (!P.alive || W.phase === 'brief') { this.drawMini(W); return; }
    g.lineWidth = 1.6 * S; g.strokeStyle = G; g.fillStyle = G; g.shadowColor = 'rgba(40,255,120,.6)'; g.shadowBlur = 6 * S;
    g.font = `600 ${Math.round(14 * S)}px "Chakra Petch", "Bahnschrift", sans-serif`; g.textBaseline = 'middle';
    _f.set(0, 0, -1).applyQuaternion(P.quat); _u.set(0, 1, 0).applyQuaternion(P.quat); _r.set(1, 0, 0).applyQuaternion(P.quat);
    const pitch = Math.asin(clamp(_f.y, -1, 1)), heading = (Math.atan2(_f.x, -_f.z) * 180 / Math.PI + 360) % 360;
    // boresight (gun cross)
    const bs = this.proj(cam, _w.copy(P.pos).addScaledVector(_f, 900));
    const cx = bs.x, cy = bs.y;
    g.beginPath(); g.moveTo(cx - 14 * S, cy); g.lineTo(cx - 5 * S, cy); g.moveTo(cx + 5 * S, cy); g.lineTo(cx + 14 * S, cy); g.moveTo(cx, cy - 14 * S); g.lineTo(cx, cy - 5 * S); g.moveTo(cx, cy + 5 * S); g.lineTo(cx, cy + 14 * S); g.stroke();
    // mouse-stick deflection (only while flying with the mouse)
    if (opt.mouse && document.pointerLockElement) {
      const m = opt.mouse; g.save(); g.globalAlpha = 0.55; g.beginPath(); g.arc(cx, cy, 46 * S, 0, 7); g.setLineDash([3 * S, 5 * S]); g.stroke(); g.setLineDash([]);
      g.globalAlpha = 0.9; g.beginPath(); g.arc(cx + m.x * 46 * S, cy + m.y * 46 * S, 4 * S, 0, 7); g.fill(); g.restore();
    }
    // flight path marker
    const vdir = _w.copy(P.vel).normalize();
    const fp = this.proj(cam, _v.copy(P.pos).addScaledVector(vdir, 900).clone());
    if (fp.in) { g.beginPath(); g.arc(fp.x, fp.y, 7 * S, 0, 7); g.moveTo(fp.x - 7 * S, fp.y); g.lineTo(fp.x - 20 * S, fp.y); g.moveTo(fp.x + 7 * S, fp.y); g.lineTo(fp.x + 20 * S, fp.y); g.moveTo(fp.x, fp.y - 7 * S); g.lineTo(fp.x, fp.y - 15 * S); g.stroke(); }
    // pitch ladder (projected so it is correct in both cameras)
    const hx = _f.x, hz = _f.z, hl = Math.hypot(hx, hz) || 1, hdx = hx / hl, hdz = hz / hl;
    const lad = cock ? 0.27 : 0.2;
    g.save(); g.beginPath(); g.rect(cx - w * 0.32, cy - h * lad, w * 0.64, h * lad * 2); g.clip();
    for (let p = -85; p <= 85; p += cock ? 5 : 10) {
      if (!cock && Math.abs(p) > 30) continue;
      const a = p * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      const c1 = this.proj(cam, _v.set(cam.position.x + hdx * ca * 1000, cam.position.y + sa * 1000, cam.position.z + hdz * ca * 1000));
      if (!c1.in) continue;
      const side = this.proj(cam, _v.set(cam.position.x + (hdx * ca * 1000) - hdz * 40, cam.position.y + sa * 1000, cam.position.z + (hdz * ca * 1000) + hdx * 40));
      let dx = side.x - c1.x, dy = side.y - c1.y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const L = (p === 0 ? (cock ? 150 : 110) : cock ? 62 : 40) * S, gap = (p === 0 ? 40 : 30) * S;
      g.beginPath();
      if (p < 0) g.setLineDash([7 * S, 5 * S]); else g.setLineDash([]);
      g.moveTo(c1.x - dx * (gap + L), c1.y - dy * (gap + L)); g.lineTo(c1.x - dx * gap, c1.y - dy * gap);
      g.moveTo(c1.x + dx * gap, c1.y + dy * gap); g.lineTo(c1.x + dx * (gap + L), c1.y + dy * (gap + L));
      if (p !== 0) { const tk = (p > 0 ? 8 : -8) * S; g.moveTo(c1.x - dx * (gap + L), c1.y - dy * (gap + L)); g.lineTo(c1.x - dx * (gap + L) - dy * tk * -1, c1.y - dy * (gap + L) + dx * tk); g.moveTo(c1.x + dx * (gap + L), c1.y + dy * (gap + L)); g.lineTo(c1.x + dx * (gap + L) + dy * tk, c1.y + dy * (gap + L) - dx * tk); }
      g.stroke(); g.setLineDash([]);
      if (p !== 0 && p % 10 === 0) { g.textAlign = 'center'; g.fillText(Math.abs(p), c1.x - dx * (gap + L + 16 * S), c1.y - dy * (gap + L + 16 * S)); g.fillText(Math.abs(p), c1.x + dx * (gap + L + 16 * S), c1.y + dy * (gap + L + 16 * S)); }
    }
    g.restore();
    // heading tape
    const ty = cock ? h * 0.16 : 58 * S + 10, tw = 300 * S;
    g.textAlign = 'center';
    g.save(); g.beginPath(); g.rect(w / 2 - tw / 2, ty - 26 * S, tw, 50 * S); g.clip();
    for (let d = Math.floor(heading / 5) * 5 - 40; d <= heading + 40; d += 5) {
      const x = w / 2 + (d - heading) * (tw / 80), dd = (d + 360) % 360;
      g.beginPath(); g.moveTo(x, ty); g.lineTo(x, ty - (dd % 10 === 0 ? 10 : 5) * S); g.stroke();
      if (dd % 10 === 0) g.fillText(dd === 0 ? 'N' : dd === 90 ? 'E' : dd === 180 ? 'S' : dd === 270 ? 'W' : String(dd / 10).padStart(2, '0'), x, ty - 19 * S);
    }
    g.restore();
    g.beginPath(); g.moveTo(w / 2, ty + 3 * S); g.lineTo(w / 2 - 6 * S, ty + 11 * S); g.lineTo(w / 2 + 6 * S, ty + 11 * S); g.closePath(); g.fill();
    g.fillText(String(Math.round(heading)).padStart(3, '0'), w / 2, ty + 24 * S);
    // speed / altitude boxes
    const bxL = Math.max(cx - 250 * S, 70 * S), bxR = Math.min(cx + 250 * S, w - 70 * S), by = cy;
    const kts = Math.round(P.speed * 1.944), ft = Math.round(P.pos.y * 3.281), mach = P.speed / 330;
    this.box(bxL, by, 74 * S, 28 * S, kts, 'right');
    this.box(bxR, by, 84 * S, 28 * S, ft, 'left');
    g.font = `500 ${Math.round(12 * S)}px "Chakra Petch", sans-serif`;
    g.textAlign = 'center';
    g.fillText('KTS', bxL, by - 26 * S); g.fillText('ALT', bxR, by - 26 * S);
    g.fillText(`M ${mach.toFixed(2)}`, bxL, by + 28 * S);
    g.fillStyle = P.g > 7 ? AMB : G; g.fillText(`G ${P.g.toFixed(1)}`, bxL, by + 44 * S); g.fillStyle = G;
    if (P.agl < 600) g.fillText(`R ${Math.round(P.agl * 3.281)}`, bxR, by + 28 * S);
    const vs = Math.round(P.vel.y * 196.85 / 100) * 100; g.fillText(`VS ${vs}`, bxR, by + 44 * S);
    // speed/alt tape ticks
    for (let i = -4; i <= 4; i++) {
      const sp = Math.round(kts / 20) * 20 + i * 20, yy = by - (sp - kts) * 1.6 * S; if (Math.abs(yy - by) < 16 * S) continue; g.globalAlpha = 1 - Math.abs(yy - by) / (110 * S);
      g.beginPath(); g.moveTo(bxL + 40 * S, yy); g.lineTo(bxL + 48 * S, yy); g.stroke();
      const al = Math.round(ft / 200) * 200 + i * 200, ya = by - (al - ft) * 0.18 * S; if (Math.abs(ya - by) >= 16 * S) { g.beginPath(); g.moveTo(bxR - 46 * S, ya); g.lineTo(bxR - 54 * S, ya); g.stroke(); }
    }
    g.globalAlpha = 1;
    // weapons + systems block
    g.textAlign = 'left'; g.font = `600 ${Math.round(13 * S)}px "Chakra Petch", sans-serif`;
    const wx = cock ? w * 0.33 : bxL - 30 * S, wy = cock ? h * 0.72 : cy + 110 * S;
    const A = W.ammo, M = W.ammoMax;
    const rows = [['GUN', A.gun], ['BMB', A.bombs], ['MSL', A.msl], ['FLR', A.flares]];
    rows.forEach(([k, v], i) => { g.fillStyle = v <= 0 ? RED : G; g.fillText(`${k} ${String(v).padStart(k === 'GUN' ? 3 : 2, ' ')}`, wx, wy + i * 17 * S); });
    g.fillStyle = G;
    // AB heat + airframe
    const bx2 = cock ? w * 0.6 : bxR - 40 * S, by2 = wy;
    g.fillText(P.over ? 'AB HOT' : P.ab > 0.5 ? 'AB' : 'MIL', bx2, by2);
    g.strokeRect(bx2, by2 + 9 * S, 90 * S, 7 * S); g.fillStyle = P.over ? RED : P.heat > 0.7 ? AMB : G; g.fillRect(bx2, by2 + 9 * S, 90 * S * P.heat, 7 * S);
    g.fillStyle = G; g.fillText('DMG', bx2, by2 + 30 * S);
    g.strokeRect(bx2, by2 + 39 * S, 90 * S, 7 * S); g.fillStyle = P.hp < 35 ? RED : P.hp < 65 ? AMB : G; g.fillRect(bx2, by2 + 39 * S, 90 * S * clamp(P.hp / 100, 0, 1), 7 * S);
    g.fillStyle = G;
    // target boxes
    const L = W.lock;
    const all = W.targets.concat(W.fighters);
    g.font = `600 ${Math.round(11 * S)}px "Chakra Petch", sans-serif`; g.textAlign = 'center';
    let nearestObj = null, nd = 1e9;
    for (const t of all) {
      if (!t.alive) continue;
      const d = t.pos.distanceTo(P.pos);
      if (t.primary && d < nd) { nd = d; nearestObj = t; }
      if (d > 7000 || t === L.target) continue;
      const s = this.proj(cam, _v.set(t.pos.x, t.pos.y + t.cy, t.pos.z));
      if (!s.in || s.x < 0 || s.x > w || s.y < 0 || s.y > h) continue;
      const r = clamp(t.r * 600 / d, 5, 26) * S;
      g.strokeStyle = t.primary ? RED : 'rgba(255,90,70,.6)'; g.lineWidth = 1.4 * S;
      if (t.primary) { g.beginPath(); g.moveTo(s.x, s.y - r - 3); g.lineTo(s.x + r + 3, s.y); g.lineTo(s.x, s.y + r + 3); g.lineTo(s.x - r - 3, s.y); g.closePath(); g.stroke(); }
      else { g.strokeRect(s.x - r, s.y - r, r * 2, r * 2); }
      if (d < 2500 && (t.primary || t.air)) { g.fillStyle = 'rgba(255,120,100,.85)'; g.fillText((d / 1000).toFixed(1), s.x, s.y + r + 12 * S); }
    }
    g.strokeStyle = G; g.fillStyle = G;
    // lock box
    if (L.target && L.target.alive) {
      const t = L.target, s = this.proj(cam, _v.set(t.pos.x, t.pos.y + t.cy, t.pos.z)), d = t.pos.distanceTo(P.pos);
      if (s.in) {
        const need = t.air ? 1.1 : 0.8, k = L.locked ? 0 : 1 - clamp(L.t / need, 0, 1), r = (18 + k * 30) * S;
        g.strokeStyle = L.locked ? RED : G; g.lineWidth = 2 * S;
        if (!L.locked) g.setLineDash([6 * S, 5 * S]);
        g.strokeRect(s.x - r, s.y - r, r * 2, r * 2); g.setLineDash([]);
        if (L.locked) { g.beginPath(); g.moveTo(s.x, s.y - r - 8 * S); g.lineTo(s.x + r + 8 * S, s.y); g.lineTo(s.x, s.y + r + 8 * S); g.lineTo(s.x - r - 8 * S, s.y); g.closePath(); g.stroke(); }
        g.fillStyle = L.locked ? RED : G; g.font = `700 ${Math.round(12 * S)}px "Chakra Petch", sans-serif`;
        g.fillText(L.locked ? 'LOCK' : 'SEEK', s.x, s.y - r - 18 * S); g.fillText(`${t.label.toUpperCase()} ${(d / 1000).toFixed(1)}`, s.x, s.y + r + 16 * S);
        g.strokeStyle = G; g.fillStyle = G; g.lineWidth = 1.6 * S;
      }
    }
    // off-screen arrow to nearest objective
    if (nearestObj) {
      const s = this.proj(cam, _v.set(nearestObj.pos.x, nearestObj.pos.y + nearestObj.cy, nearestObj.pos.z));
      const onScreen = s.in && s.x > 0 && s.x < w && s.y > 0 && s.y < h;
      if (!onScreen) {
        const l = _w.copy(nearestObj.pos).sub(cam.position).applyQuaternion(cam.quaternion.clone().invert());
        const a = Math.atan2(l.x, l.y), R = Math.min(w, h) * 0.36;
        const ax = w / 2 + Math.sin(a) * R, ay = h / 2 - Math.cos(a) * R;
        g.save(); g.translate(ax, ay); g.rotate(a); g.fillStyle = RED; g.beginPath(); g.moveTo(0, -14 * S); g.lineTo(10 * S, 6 * S); g.lineTo(-10 * S, 6 * S); g.closePath(); g.fill(); g.restore();
        g.fillStyle = RED; g.textAlign = 'center'; g.fillText((nd / 1000).toFixed(1) + ' KM', ax, ay + 22 * S); g.fillStyle = G;
      }
    }
    // CCIP pipper + bomb fall line
    if (W.ccip && W.ccip.t < 30) {
      const ip = this.proj(cam, W.ccip.p);
      if (ip.in) {
        const onT = all.some(t => t.alive && !t.air && Math.hypot(t.pos.x - W.ccip.p.x, t.pos.z - W.ccip.p.z) < t.r + 6);
        g.strokeStyle = onT ? RED : G; g.lineWidth = 2 * S;
        if (fp.in) { g.beginPath(); g.setLineDash([4 * S, 6 * S]); g.moveTo(fp.x, fp.y + 20 * S); g.lineTo(ip.x, ip.y - 12 * S); g.stroke(); g.setLineDash([]); }
        g.beginPath(); g.arc(ip.x, ip.y, 12 * S, 0, 7); g.stroke(); g.beginPath(); g.arc(ip.x, ip.y, 2 * S, 0, 7); g.fillStyle = onT ? RED : G; g.fill();
        g.font = `600 ${Math.round(11 * S)}px "Chakra Petch", sans-serif`; g.fillText(`${W.ccip.t.toFixed(1)}s`, ip.x, ip.y + 24 * S);
        g.strokeStyle = G; g.fillStyle = G; g.lineWidth = 1.6 * S;
      }
    }
    // warnings
    g.textAlign = 'center'; g.font = `700 ${Math.round(22 * S)}px "Chakra Petch", sans-serif`;
    const blink = (this.t * 4) % 1 < 0.6;
    let wy2 = cy + (cock ? 70 : 90) * S;
    if (W.warn === 2 && blink) { g.fillStyle = RED; g.shadowColor = 'rgba(255,40,30,.7)'; g.fillText('▲ MISSILE ▲', w / 2, cy - 120 * S); this.missileArrows(W, g, S); }
    else if (W.warn === 2) this.missileArrows(W, g, S);
    else if (W.warn === 1) { g.fillStyle = AMB; g.font = `700 ${Math.round(15 * S)}px "Chakra Petch", sans-serif`; g.fillText('SAM RADAR LOCK', w / 2, cy - 120 * S); }
    g.font = `700 ${Math.round(22 * S)}px "Chakra Petch", sans-serif`;
    if (W.pullUp && blink) { g.fillStyle = RED; g.fillText('PULL UP', w / 2, wy2); wy2 += 28 * S; }
    if (P.stall && blink) { g.fillStyle = AMB; g.fillText('STALL', w / 2, wy2); wy2 += 28 * S; }
    if (W.outOfBounds > 0) { g.fillStyle = AMB; g.fillText('RETURN TO AREA', w / 2, wy2); }
    g.shadowBlur = 0;
    this.drawMini(W);
  }
  missileArrows(W, g, S) {
    const cam = W.camera, P = W.player;
    for (const m of W.emissiles) {
      if (m.target !== P) continue;
      const l = _w.copy(m.p).sub(cam.position).applyQuaternion(cam.quaternion.clone().invert());
      const a = Math.atan2(l.x, l.y), R = Math.min(innerWidth, innerHeight) * 0.26, d = m.p.distanceTo(P.pos);
      const ax = innerWidth / 2 + Math.sin(a) * R, ay = innerHeight / 2 - Math.cos(a) * R;
      g.save(); g.translate(ax, ay); g.rotate(a); g.strokeStyle = RED; g.lineWidth = 3 * S; g.beginPath(); g.moveTo(-12 * S, 8 * S); g.lineTo(0, -10 * S); g.lineTo(12 * S, 8 * S); g.stroke(); g.restore();
      g.fillStyle = RED; g.font = `700 ${Math.round(12 * S)}px "Chakra Petch", sans-serif`; g.fillText((d / 1000).toFixed(1), ax, ay + 20 * S);
    }
  }
  box(x, y, bw, bh, val, side) {
    const g = this.g;
    g.beginPath();
    if (side === 'right') { g.moveTo(x - bw / 2, y - bh / 2); g.lineTo(x + bw / 2, y - bh / 2); g.lineTo(x + bw / 2 + 8, y); g.lineTo(x + bw / 2, y + bh / 2); g.lineTo(x - bw / 2, y + bh / 2); }
    else { g.moveTo(x + bw / 2, y - bh / 2); g.lineTo(x - bw / 2, y - bh / 2); g.lineTo(x - bw / 2 - 8, y); g.lineTo(x - bw / 2, y + bh / 2); g.lineTo(x + bw / 2, y + bh / 2); }
    g.closePath(); g.stroke();
    g.textAlign = 'center'; g.font = `700 ${Math.round(17 * this.scale)}px "Chakra Petch", sans-serif`; g.fillText(String(val), x, y + 1);
    g.font = `600 ${Math.round(14 * this.scale)}px "Chakra Petch", sans-serif`;
  }
  drawMini(W) {
    const g = this.mg, S = this.mini.width, P = W.player, T = W.terrain, half = S / 2;
    const range = 7000, k = S / range;
    const f = _f.set(0, 0, -1).applyQuaternion(P.quat), hdg = Math.atan2(f.x, -f.z);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S);
    g.save(); g.beginPath(); g.arc(half, half, half - 2, 0, 7); g.clip();
    g.fillStyle = '#16221c'; g.fillRect(0, 0, S, S);
    g.translate(half, half); g.rotate(-hdg);
    // terrain image: world (-half..half) -> map
    const ms = T.size * k;
    g.globalAlpha = 0.75; g.drawImage(T.minimap, -half + 0 - (P.pos.x + T.half) * k + half, -half - (P.pos.z + T.half) * k + half, ms, ms); g.globalAlpha = 1;
    const toM = (x, z) => [(x - P.pos.x) * k, (z - P.pos.z) * k];
    // boundary
    g.strokeStyle = 'rgba(255,200,60,.5)'; g.lineWidth = 1.5; const [bx, bz] = toM(-T.half + 350, -T.half + 350); g.strokeRect(bx, bz, (T.size - 700) * k, (T.size - 700) * k);
    // SAM rings
    for (const t of W.targets) if (t.alive && t.sam) { const [x, z] = toM(t.pos.x, t.pos.z); g.strokeStyle = t.sam.state === 'track' ? 'rgba(255,70,50,.9)' : 'rgba(255,70,50,.35)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, z, t.sam.range * k, 0, 7); g.stroke(); }
    for (const r of W.rings) { const [x, z] = toM(r.pos.x, r.pos.z); g.strokeStyle = r.cd > 0 ? 'rgba(80,255,150,.3)' : '#5dff9a'; g.lineWidth = 2; g.beginPath(); g.arc(x, z, 5, 0, 7); g.stroke(); }
    for (const t of W.targets) {
      if (!t.alive) continue;
      const [x, z] = toM(t.pos.x, t.pos.z);
      if (Math.abs(x) > half * 1.5 || Math.abs(z) > half * 1.5) continue;
      g.fillStyle = t.primary ? '#ff4a3a' : 'rgba(255,110,90,.55)';
      const s = t.primary ? 4 : 2.4; g.fillRect(x - s / 2, z - s / 2, s, s);
    }
    for (const f2 of W.fighters) if (f2.alive) { const [x, z] = toM(f2.pos.x, f2.pos.z); const ff = _v.set(0, 0, -1).applyQuaternion(f2.quat); g.save(); g.translate(x, z); g.rotate(Math.atan2(ff.x, -ff.z)); g.fillStyle = '#ff4a3a'; g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 4); g.lineTo(-4, 4); g.closePath(); g.fill(); g.restore(); }
    for (const m of W.emissiles) { const [x, z] = toM(m.p.x, m.p.z); g.fillStyle = '#fff'; g.fillRect(x - 1.5, z - 1.5, 3, 3); }
    g.restore();
    // player
    g.fillStyle = '#5dff9a'; g.beginPath(); g.moveTo(half, half - 8); g.lineTo(half + 6, half + 6); g.lineTo(half, half + 3); g.lineTo(half - 6, half + 6); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(93,255,154,.45)'; g.lineWidth = 1.5; g.beginPath(); g.arc(half, half, half - 2, 0, 7); g.stroke();
    g.beginPath(); g.arc(half, half, half / 2, 0, 7); g.strokeStyle = 'rgba(93,255,154,.15)'; g.stroke();
    g.fillStyle = 'rgba(93,255,154,.8)'; g.font = '600 11px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.fillText('N', half - Math.sin(hdg) * (half - 12), half - Math.cos(hdg) * (half - 12));
  }
}

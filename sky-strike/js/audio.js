/* Sky Strike — every sound is synthesised with WebAudio: twin-engine roar and
 * turbine whine, afterburner rumble, wind, the cannon's buzz, bomb whistles,
 * distance-delayed explosions, lock tones and the missile warning. */
let ctx = null, master = null, sfxG = null, noiseBuf = null, brown = null, muted = false;
let eng = null, gunNode = null, tones = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  sfxG = ctx.createGain(); sfxG.connect(master);
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate); const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  brown = ctx.createBuffer(1, len, ctx.sampleRate); const b = brown.getChannelData(0); let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
  return ctx;
}
export function unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; }
const now = () => ctx.currentTime;
function src(buf = noiseBuf) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = Math.random(); return s; }

function noise(dur, { gain = 0.5, type = 'lowpass', from = 4000, to = 200, q = 0.8, delay = 0, buf } = {}) {
  if (!ensure()) return;
  const t = now() + delay, s = src(buf), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxG); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function tone(freq, dur, { gain = 0.2, type = 'sine', to = null, delay = 0, attack = 0.01 } = {}) {
  if (!ensure()) return;
  const t = now() + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxG); o.start(t); o.stop(t + dur + 0.05);
}

function startEngine() {
  if (eng || !ensure()) return;
  const out = ctx.createGain(); out.gain.value = 0;
  const muff = ctx.createBiquadFilter(); muff.type = 'lowpass'; muff.frequency.value = 9000; muff.connect(out); out.connect(master);
  const roarS = src(), roarF = ctx.createBiquadFilter(), roarG = ctx.createGain(); roarF.type = 'bandpass'; roarF.Q.value = 0.7; roarS.connect(roarF); roarF.connect(roarG); roarG.connect(muff);
  const rumbleS = src(brown), rumbleF = ctx.createBiquadFilter(), rumbleG = ctx.createGain(); rumbleF.type = 'lowpass'; rumbleF.frequency.value = 220; rumbleS.connect(rumbleF); rumbleF.connect(rumbleG); rumbleG.connect(muff);
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), oF = ctx.createBiquadFilter(), oG = ctx.createGain(); o1.type = o2.type = 'sawtooth'; o2.detune.value = 18; oF.type = 'lowpass'; oF.frequency.value = 300; o1.connect(oF); o2.connect(oF); oF.connect(oG); oG.connect(muff);
  const wh = ctx.createOscillator(), whG = ctx.createGain(); wh.type = 'sine'; wh.connect(whG); whG.connect(muff);
  const windS = src(), windF = ctx.createBiquadFilter(), windG = ctx.createGain(); windF.type = 'bandpass'; windF.Q.value = 0.4; windF.frequency.value = 1200; windS.connect(windF); windF.connect(windG); windG.connect(out);
  [roarS, rumbleS, o1, o2, wh, windS].forEach(s => s.start());
  eng = { out, muff, roarF, roarG, rumbleG, o1, o2, oG, wh, whG, windG, windF, all: [roarS, rumbleS, o1, o2, wh, windS] };
  // cannon: pulse train of filtered noise, gated
  const L = Math.floor(ctx.sampleRate * 0.5), buf = ctx.createBuffer(1, L, ctx.sampleRate), d = buf.getChannelData(0), per = ctx.sampleRate / 55;
  for (let i = 0; i < L; i++) { const ph = (i % per) / per; d[i] = (Math.random() * 2 - 1) * Math.exp(-ph * 9) * 0.9 + Math.sin(i / per * 6.283) * 0.25 * Math.exp(-ph * 4); }
  const gs = ctx.createBufferSource(); gs.buffer = buf; gs.loop = true; const gf = ctx.createBiquadFilter(); gf.type = 'lowpass'; gf.frequency.value = 2400; const gg = ctx.createGain(); gg.gain.value = 0;
  gs.connect(gf); gf.connect(gg); gg.connect(sfxG); gs.start();
  gunNode = { gg, gs };
  // warning / lock tones
  const mk = (type, f) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; g.gain.value = 0; o.connect(g); g.connect(sfxG); o.start(); return { o, g }; };
  tones = { lock: mk('square', 1250), seek: mk('square', 900), warn: mk('square', 1000), radar: mk('triangle', 640), pull: mk('square', 520) };
  for (const k in tones) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600; tones[k].g.disconnect(); tones[k].g.connect(f); f.connect(sfxG); }
}
export function stopEngine() {
  if (!eng) return;
  eng.all.forEach(s => { try { s.stop(); } catch (e) { } }); eng.out.disconnect(); eng = null;
  if (gunNode) { try { gunNode.gs.stop(); } catch (e) { } gunNode.gg.disconnect(); gunNode = null; }
  if (tones) { for (const k in tones) { try { tones[k].o.stop(); } catch (e) { } } tones = null; }
}
let t0 = 0;
/* s: {thr, ab, speed, cockpit, gun, lock 0/1/2, warn 0/1/2, pull, paused, dead} */
export function update(s) {
  if (!ctx || muted) return;
  if (!eng) startEngine();
  const t = now(), k = 0.08;
  const live = !(s.paused || s.dead);
  eng.out.gain.setTargetAtTime(live ? 1 : 0, t, 0.1);
  const thr = s.thr, ab = s.ab;
  eng.roarF.frequency.setTargetAtTime(300 + thr * 700 + ab * 500, t, k);
  eng.roarG.gain.setTargetAtTime(0.16 + thr * 0.22 + ab * 0.25, t, k);
  eng.rumbleG.gain.setTargetAtTime(0.25 + ab * 1.1, t, k);
  const f = 52 + thr * 40 + ab * 22; eng.o1.frequency.setTargetAtTime(f, t, k); eng.o2.frequency.setTargetAtTime(f * 1.5, t, k);
  eng.oG.gain.setTargetAtTime(0.05 + thr * 0.05, t, k);
  eng.wh.frequency.setTargetAtTime(2100 + thr * 1900, t, k); eng.whG.gain.setTargetAtTime(s.cockpit ? 0.012 : 0.022, t, k);
  eng.windG.gain.setTargetAtTime(Math.min(0.35, s.speed / 900) * (s.cockpit ? 0.6 : 1), t, k); eng.windF.frequency.setTargetAtTime(600 + s.speed * 5, t, k);
  eng.muff.frequency.setTargetAtTime(s.cockpit ? 1300 : 9000, t, 0.15);
  gunNode.gg.gain.setTargetAtTime(live && s.gun ? 0.55 : 0, t, 0.012);
  // tones: gate with a square LFO computed here
  t0 = t;
  const beep = (hz, duty = 0.5) => ((t * hz) % 1) < duty;
  const set = (tn, on, g) => tones[tn].g.gain.setTargetAtTime(live && on ? g : 0, t, 0.006);
  set('seek', s.lock === 1 && beep(5, 0.35), 0.05);
  set('lock', s.lock === 2, 0.045);
  if (s.warn === 2) tones.warn.o.frequency.setValueAtTime(beep(4, 0.5) ? 1050 : 800, t);
  set('warn', s.warn === 2 && beep(8, 0.6), 0.09);
  set('radar', s.warn === 1 && beep(2.2, 0.45), 0.06);
  set('pull', s.pull && beep(3, 0.5), 0.07);
}
const dly = d => Math.min(1.6, (d || 0) / 340);
export const sfx = {
  click() { tone(880, 0.06, { gain: 0.08, type: 'triangle' }); },
  explode(size = 1, dist = 0) {
    const att = 1 / (1 + dist / 500), g = Math.min(1, 0.35 + size * 0.25) * att, d = dly(dist);
    if (g < 0.01) return;
    noise(1.2 + size * 0.6, { gain: g, from: 2600 * att + 300, to: 60, delay: d });
    noise(2.0 + size, { gain: g * 0.9, from: 400, to: 40, buf: brown, delay: d });
    tone(70, 0.9 + size * 0.3, { gain: g * 0.7, to: 28, delay: d, type: 'sine' });
  },
  boom(dist) { this.explode(0.4, dist); },
  bombRelease() { tone(160, 0.12, { gain: 0.25, to: 70, type: 'square' }); noise(0.15, { gain: 0.2, from: 900, to: 200 }); tone(2400, 2.6, { gain: 0.035, to: 700, delay: 0.3, attack: 0.4 }); },
  missile() { noise(1.4, { gain: 0.45, type: 'bandpass', from: 600, to: 2400, q: 1.2 }); noise(0.4, { gain: 0.3, from: 3000, to: 300 }); },
  flare() { for (let i = 0; i < 2; i++) { noise(0.12, { gain: 0.25, type: 'highpass', from: 2400, to: 1800, delay: i * 0.1 }); tone(1500, 0.08, { gain: 0.05, delay: i * 0.1, type: 'triangle' }); } },
  hit() { noise(0.18, { gain: 0.4, type: 'highpass', from: 3000, to: 800 }); tone(300 + Math.random() * 200, 0.1, { gain: 0.12, type: 'square', to: 120 }); },
  bigHit() { noise(0.6, { gain: 0.7, from: 3000, to: 100 }); tone(120, 0.5, { gain: 0.4, to: 40 }); },
  lockOn() { tone(1600, 0.08, { gain: 0.06, type: 'square' }); },
  rearm() { [660, 880, 1100].forEach((f, i) => tone(f, 0.14, { gain: 0.1, type: 'triangle', delay: i * 0.08 })); },
  objective() { [523, 659, 784].forEach((f, i) => tone(f, 0.22, { gain: 0.12, type: 'triangle', delay: i * 0.1 })); },
  success() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.4, { gain: 0.14, type: 'triangle', delay: i * 0.14 })); },
  fail() { [392, 330, 262].forEach((f, i) => tone(f, 0.5, { gain: 0.14, type: 'sawtooth', delay: i * 0.2 })); },
  launchWarn() { tone(1200, 0.1, { gain: 0.1, type: 'square' }); }
};

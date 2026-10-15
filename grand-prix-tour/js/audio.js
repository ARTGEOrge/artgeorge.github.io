/* All sound is synthesised with WebAudio — no audio files.
 * Engine: three detuned oscillators through a waveshaper and a filter that
 * opens with RPM. A second, quieter voice is the nearest rival (with a
 * Doppler-ish pitch bend as it passes). Tyres, wind, rain and crowd are
 * filtered noise. */
let ctx = null, master = null, noiseBuf = null, eng = null, rival = null, loops = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch (e) { return null; }
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}
export function unlock() { if (!ensure()) return; if (ctx.state === 'suspended') ctx.resume(); }
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; }
export function isMuted() { return muted; }

function shaper(amount) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / n * 2 - 1; c[i] = Math.tanh(x * amount); }
  const w = ctx.createWaveShaper(); w.curve = c; return w;
}
function voice(gainVal) {
  const out = ctx.createGain(); out.gain.value = 0;
  const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 3; filt.frequency.value = 900;
  const ws = shaper(2.2);
  const oscs = [['sawtooth', 1, 0], ['square', 0.5, 4], ['sawtooth', 2, -7]].map(([type, mul, det]) => {
    const o = ctx.createOscillator(); o.type = type; o.detune.value = det;
    const g = ctx.createGain(); g.gain.value = type === 'square' ? 0.35 : 0.5;
    o.connect(g); g.connect(ws); o.start(); return { o, mul };
  });
  ws.connect(filt); filt.connect(out); out.connect(master);
  return { out, filt, oscs, gainVal };
}
function noiseLoop(type, freq, q) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = 0;
  src.connect(f); f.connect(g); g.connect(master); src.start();
  return { g, f };
}

export function startEngine() {
  if (!ensure() || eng) return;
  eng = voice(0.22); rival = voice(0.1);
  loops = { tyre: noiseLoop('bandpass', 1900, 9), wind: noiseLoop('lowpass', 420, 0.7), rain: noiseLoop('highpass', 2600, 0.5), crowd: noiseLoop('bandpass', 700, 0.8), rumble: noiseLoop('lowpass', 120, 1) };
}
export function stopEngine() {
  if (!eng) return;
  const t = ctx.currentTime;
  for (const v of [eng, rival]) { v.out.gain.setTargetAtTime(0, t, 0.05); const vv = v; setTimeout(() => vv.oscs.forEach(o => { try { o.o.stop(); } catch (e) { } }), 400); }
  for (const k in loops) loops[k].g.gain.setTargetAtTime(0, t, 0.05);
  eng = rival = null; loops = null;
}

/* Called every frame with the player's state. */
export function update(s) {
  if (!eng || !ctx) return;
  const t = ctx.currentTime, tc = 0.04;
  const f = 70 + s.rpm * 520;
  eng.oscs.forEach(o => o.o.frequency.setTargetAtTime(f * o.mul, t, tc));
  eng.filt.frequency.setTargetAtTime(500 + s.rpm * 2600 + s.throttle * 1200, t, tc);
  eng.out.gain.setTargetAtTime(s.paused ? 0 : (0.07 + s.throttle * 0.13) * (s.cockpit ? 1.15 : 1), t, tc);
  const rv = s.rival;
  if (rv && !s.paused) {
    const rf = (70 + rv.rpm * 520) * rv.doppler;
    rival.oscs.forEach(o => o.o.frequency.setTargetAtTime(rf * o.mul, t, tc));
    rival.filt.frequency.setTargetAtTime(700 + rv.rpm * 1800, t, tc);
    rival.out.gain.setTargetAtTime(Math.min(0.1, 2.2 / (rv.dist + 8)), t, 0.06);
  } else rival.out.gain.setTargetAtTime(0, t, 0.1);
  const p = s.paused ? 0 : 1;
  loops.tyre.g.gain.setTargetAtTime(p * Math.min(0.16, s.squeal * 0.16), t, 0.05);
  loops.wind.g.gain.setTargetAtTime(p * Math.min(0.18, s.speed * s.speed * 0.000022), t, 0.1);
  loops.rain.g.gain.setTargetAtTime(p * (s.rain ? 0.05 : 0), t, 0.3);
  loops.crowd.g.gain.setTargetAtTime(p * s.crowd * 0.12, t, 0.3);
  loops.rumble.g.gain.setTargetAtTime(p * s.rumble * 0.5, t, 0.03);
}

function noise(dur, { gain = 0.5, type = 'lowpass', from = 4000, to = 200, q = 1, delay = 0 } = {}) {
  if (!ensure()) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const filt = ctx.createBiquadFilter(); filt.type = type; filt.Q.value = q;
  filt.frequency.setValueAtTime(from, t); filt.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filt); filt.connect(g); g.connect(master); src.start(t); src.stop(t + dur + 0.05);
}
function tone(freq, dur, { gain = 0.2, type = 'sine', to = null, delay = 0 } = {}) {
  if (!ensure()) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
export const sfx = {
  light() { tone(520, 0.22, { gain: 0.18, type: 'square' }); },
  go() { tone(1040, 0.5, { gain: 0.2, type: 'square' }); noise(1.2, { gain: 0.25, type: 'bandpass', from: 900, to: 500, q: 0.8 }); },
  bump(k = 1) { noise(0.18, { gain: 0.35 * k, from: 1600, to: 120 }); tone(90, 0.15, { gain: 0.25 * k, type: 'triangle', to: 50 }); },
  scrape() { noise(0.12, { gain: 0.18, type: 'bandpass', from: 4200, to: 2400, q: 3 }); },
  checkpoint() { tone(880, 0.12, { gain: 0.14 }); tone(1320, 0.2, { gain: 0.14, delay: 0.1 }); },
  drs() { tone(660, 0.08, { gain: 0.1, type: 'square' }); tone(990, 0.1, { gain: 0.1, type: 'square', delay: 0.07 }); },
  whoosh() { noise(0.5, { gain: 0.22, type: 'bandpass', from: 600, to: 2400, q: 1.2 }); },
  finish() { [0, 0.14, 0.28, 0.5].forEach((d, i) => tone([660, 880, 990, 1320][i], 0.35, { gain: 0.15, delay: d })); noise(2.5, { gain: 0.3, type: 'bandpass', from: 800, to: 500, q: 0.7 }); },
  click() { tone(1200, 0.04, { gain: 0.06, type: 'square' }); }
};

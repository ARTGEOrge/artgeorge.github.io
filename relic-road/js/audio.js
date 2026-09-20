/* Demon Fall — all sound is synthesised in the browser with WebAudio, so the
 * game ships with no audio files. Gunshots are noise bursts through a falling
 * filter; demons are detuned growls; the score is a slow drone that breathes
 * with how much danger the player is in. */

let ctx = null, master = null, musicGain = null, sfxGain = null, noiseBuf = null;
let started = false, droneNodes = null, tension = 0;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 1; sfxGain.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.34; musicGain.connect(master);

  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

export function unlock() {
  ensure();
  if (ctx && ctx.state === 'suspended') ctx.resume();
  started = true;
}

export function setVolume(v) { ensure(); if (master) master.gain.value = v; }

function noise(dur, { gain = 0.5, type = 'lowpass', from = 4000, to = 200, q = 1, delay = 0 } = {}) {
  if (!ensure()) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const filt = ctx.createBiquadFilter(); filt.type = type; filt.Q.value = q;
  filt.frequency.setValueAtTime(from, t);
  filt.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filt); filt.connect(g); g.connect(sfxGain);
  src.start(t); src.stop(t + dur + 0.05);
}

function tone(freq, dur, { gain = 0.25, type = 'sine', to = null, delay = 0, detune = 0 } = {}) {
  if (!ensure()) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = type; o.detune.value = detune;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxGain);
  o.start(t); o.stop(t + dur + 0.05);
}

/* ------------------------------------------------------------------ effects */
export const sfx = {
  pistol() { noise(0.16, { gain: 0.5, from: 5200, to: 380 }); tone(180, 0.12, { gain: 0.35, type: 'square', to: 60 }); },
  shotgun() { noise(0.34, { gain: 0.75, from: 3600, to: 140 }); tone(95, 0.3, { gain: 0.5, type: 'sawtooth', to: 40 }); },
  plasma() {
    tone(880, 0.22, { gain: 0.3, type: 'sawtooth', to: 140 });
    tone(1320, 0.18, { gain: 0.16, type: 'square', to: 300, detune: 12 });
    noise(0.2, { gain: 0.2, from: 6000, to: 900, type: 'bandpass', q: 3 });
  },
  dryFire() { noise(0.05, { gain: 0.25, from: 2600, to: 900, type: 'bandpass', q: 6 }); },
  reload() {
    noise(0.07, { gain: 0.3, from: 3000, to: 700, type: 'bandpass', q: 5 });
    noise(0.07, { gain: 0.3, from: 2200, to: 500, type: 'bandpass', q: 5, delay: 0.22 });
    tone(420, 0.05, { gain: 0.14, type: 'square', delay: 0.42 });
  },
  shell() { tone(1400 + Math.random() * 500, 0.06, { gain: 0.06, type: 'triangle', to: 700, delay: 0.25 }); },
  hit() { noise(0.09, { gain: 0.35, from: 1800, to: 240, type: 'bandpass', q: 1.4 }); },
  hitWall() { noise(0.07, { gain: 0.22, from: 5200, to: 1400, type: 'bandpass', q: 2 }); },
  gib() { noise(0.3, { gain: 0.5, from: 1200, to: 90 }); tone(70, 0.25, { gain: 0.3, type: 'sawtooth', to: 30 }); },
  growl(pitch = 1) {
    tone(70 * pitch, 0.55, { gain: 0.16, type: 'sawtooth', to: 48 * pitch });
    tone(104 * pitch, 0.5, { gain: 0.09, type: 'square', to: 60 * pitch, detune: -20 });
    noise(0.5, { gain: 0.1, from: 700 * pitch, to: 180, type: 'bandpass', q: 2 });
  },
  screech() { tone(900, 0.4, { gain: 0.2, type: 'sawtooth', to: 220 }); noise(0.4, { gain: 0.16, from: 4000, to: 800, type: 'bandpass', q: 4 }); },
  hurt() { noise(0.25, { gain: 0.4, from: 900, to: 90 }); tone(150, 0.22, { gain: 0.2, type: 'sawtooth', to: 60 }); },
  step(hard = true) { noise(0.06, { gain: hard ? 0.09 : 0.05, from: hard ? 900 : 500, to: 120, type: 'lowpass' }); },
  jump() { noise(0.09, { gain: 0.08, from: 700, to: 150 }); },
  land() { noise(0.14, { gain: 0.18, from: 600, to: 80 }); },
  pickup() { tone(660, 0.1, { gain: 0.18, type: 'triangle' }); tone(990, 0.12, { gain: 0.14, type: 'triangle', delay: 0.08 }); },
  heal() { tone(520, 0.18, { gain: 0.2, type: 'sine', to: 880 }); },
  door() { noise(0.9, { gain: 0.3, from: 400, to: 60 }); tone(60, 0.9, { gain: 0.2, type: 'sawtooth', to: 34 }); },
  alarm() { tone(660, 0.4, { gain: 0.16, type: 'square', to: 440 }); tone(660, 0.4, { gain: 0.16, type: 'square', to: 440, delay: 0.5 }); },
  explode() {
    noise(0.9, { gain: 0.8, from: 2600, to: 50 });
    tone(52, 0.8, { gain: 0.5, type: 'sawtooth', to: 22 });
  },
  fireball() { noise(0.4, { gain: 0.25, from: 1800, to: 260, type: 'bandpass', q: 1.2 }); tone(220, 0.35, { gain: 0.12, type: 'sawtooth', to: 80 }); },
  objective() { tone(523, 0.18, { gain: 0.2, type: 'triangle' }); tone(784, 0.3, { gain: 0.2, type: 'triangle', delay: 0.16 }); },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, { gain: 0.22, type: 'triangle', delay: i * 0.16 }));
  },
  lose() { [330, 262, 196, 147].forEach((f, i) => tone(f, 0.7, { gain: 0.22, type: 'sawtooth', delay: i * 0.22 })); },
  launch() {
    noise(4.5, { gain: 0.9, from: 1400, to: 60 });
    tone(40, 4.5, { gain: 0.4, type: 'sawtooth', to: 90 });
  },
  ui() { tone(760, 0.05, { gain: 0.1, type: 'square' }); }
};

/** Positional-ish volume: fades a one-shot by distance from the player. */
export function at(fn, dist, maxDist = 42) {
  if (!ensure()) return;
  const v = Math.max(0, 1 - dist / maxDist);
  if (v <= 0.02) return;
  const before = sfxGain.gain.value;
  sfxGain.gain.value = before * v * v;
  fn();
  // restore on the next tick so the scaled value applies only to this shot
  setTimeout(() => { if (sfxGain) sfxGain.gain.value = before; }, 0);
}

/* -------------------------------------------------------------------- music
 * A drone built from three detuned oscillators plus a heartbeat pulse. The
 * filter opens and the pulse speeds up as danger rises. */
export function startMusic(rootHz = 55) {
  if (!ensure()) return;
  stopMusic();
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = 220; filt.Q.value = 4;
  filt.connect(musicGain);
  const oscs = [];
  [[1, 'sawtooth', -8], [1.5, 'triangle', 6], [2.005, 'sine', 0], [0.5, 'sine', 0]].forEach(([mult, type, det]) => {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = rootHz * mult; o.detune.value = det;
    const g = ctx.createGain(); g.gain.value = mult > 1.9 ? 0.08 : 0.16;
    o.connect(g); g.connect(filt); o.start();
    oscs.push(o);
  });
  droneNodes = { oscs, filt, root: rootHz, pulseAt: 0 };
}

export function stopMusic() {
  if (droneNodes) {
    droneNodes.oscs.forEach(o => { try { o.stop(); } catch (e) { /* already stopped */ } });
    droneNodes = null;
  }
}

/** danger: 0 calm … 1 surrounded. Call every frame; it moves gently. */
export function setTension(v, t) {
  tension += (v - tension) * 0.02;
  if (!droneNodes || !ctx) return;
  droneNodes.filt.frequency.value = 180 + tension * 900;
  musicGain.gain.value = 0.22 + tension * 0.22;
  const beat = 1.35 - tension * 0.75;
  if (t > droneNodes.pulseAt) {
    droneNodes.pulseAt = t + beat;
    tone(droneNodes.root * 0.5, 0.16, { gain: 0.1 + tension * 0.16, type: 'sine', to: droneNodes.root * 0.35 });
    if (tension > 0.55) tone(droneNodes.root * 0.5, 0.12, { gain: 0.08, type: 'sine', delay: beat * 0.3 });
  }
}

export const isStarted = () => started;

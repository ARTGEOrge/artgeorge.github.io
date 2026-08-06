/* kart-audio.js — procedural sound effects for the kart game set.
   Everything is synthesised with WebAudio, so there are no asset files.
   Audio unlocks on the first key press or click (browser autoplay policy).
   M toggles mute. Degrades to a silent no-op where WebAudio is unavailable. */
(function (root) {
'use strict';

var AC = null, master = null, muted = false, unlocked = false;
var Ctor = (typeof root !== 'undefined') && (root.AudioContext || root.webkitAudioContext);
var engineNodes = null, skidNodes = null, noiseBuf = null;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function ready() { return !!(AC && !muted); }

function boot() {
  if (AC || !Ctor) return;
  try {
    AC = new Ctor();
    master = AC.createGain();
    master.gain.value = 0.42;
    var comp = AC.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 8;
    master.connect(comp); comp.connect(AC.destination);
  } catch (e) { AC = null; }
}
function unlock() {
  boot();
  if (!AC) return;
  if (AC.state === 'suspended') AC.resume();
  unlocked = true;
}
if (typeof root !== 'undefined' && root.addEventListener) {
  ['keydown', 'mousedown', 'touchstart'].forEach(function (ev) {
    root.addEventListener(ev, function () { unlock(); }, { once: false });
  });
}

function noise() {
  if (noiseBuf || !AC) return noiseBuf;
  var len = Math.floor(AC.sampleRate * 1.2);
  noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
  var d = noiseBuf.getChannelData(0);
  for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/* ---- primitives ---- */
function tone(o) {
  if (!ready()) return;
  o = o || {};
  var t = AC.currentTime, dur = o.dur || 0.18;
  var osc = AC.createOscillator();
  osc.type = o.type || 'square';
  osc.frequency.setValueAtTime(o.f || 440, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
  var g = AC.createGain();
  var v = (o.vol === undefined ? 0.22 : o.vol);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + (o.atk || 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  var dest = master;
  if (o.lp) {
    var f = AC.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = o.lp;
    g.connect(f); f.connect(master); dest = null;
  }
  osc.connect(g);
  if (dest) g.connect(master);
  osc.start(t); osc.stop(t + dur + 0.02);
}
function burst(o) {
  if (!ready()) return;
  o = o || {};
  var t = AC.currentTime, dur = o.dur || 0.25;
  var src = AC.createBufferSource();
  src.buffer = noise();
  src.loop = true;
  var f = AC.createBiquadFilter();
  f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.f || 900, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.to), t + dur);
  f.Q.value = o.q === undefined ? 1.2 : o.q;
  var g = AC.createGain();
  var v = (o.vol === undefined ? 0.3 : o.vol);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + (o.atk || 0.006));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.02);
}
function seq(notes, step, o) {
  if (!ready()) return;
  o = o || {};
  notes.forEach(function (n, i) {
    setTimeout(function () {
      tone({ f: n, dur: o.dur || 0.10, type: o.type || 'square', vol: o.vol === undefined ? 0.2 : o.vol });
    }, i * step * 1000);
  });
}

/* ---- continuous engine ---- */
function ensureEngine() {
  if (engineNodes || !AC) return engineNodes;
  var o1 = AC.createOscillator(); o1.type = 'sawtooth';
  var o2 = AC.createOscillator(); o2.type = 'sawtooth'; o2.detune.value = 14;
  var sub = AC.createOscillator(); sub.type = 'square';
  var lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 5;
  var g = AC.createGain(); g.gain.value = 0.0001;
  o1.connect(lp); o2.connect(lp); sub.connect(lp);
  lp.connect(g); g.connect(master);
  o1.start(); o2.start(); sub.start();
  engineNodes = { o1: o1, o2: o2, sub: sub, lp: lp, g: g };
  return engineNodes;
}
function engine(level, bias) {
  if (!AC || muted) { if (engineNodes) engineNodes.g.gain.value = 0.0001; return; }
  var e = ensureEngine(); if (!e) return;
  var l = clamp(level || 0, 0, 1), t = AC.currentTime;
  var f = 48 + l * 200 * (bias || 1);
  e.o1.frequency.setTargetAtTime(f, t, 0.05);
  e.o2.frequency.setTargetAtTime(f * 1.006, t, 0.05);
  e.sub.frequency.setTargetAtTime(f * 0.5, t, 0.05);
  e.lp.frequency.setTargetAtTime(300 + l * 2000, t, 0.06);
  e.g.gain.setTargetAtTime(0.016 + l * 0.05, t, 0.08);
}
function ensureSkid() {
  if (skidNodes || !AC) return skidNodes;
  var src = AC.createBufferSource(); src.buffer = noise(); src.loop = true;
  var f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 2.2;
  var g = AC.createGain(); g.gain.value = 0.0001;
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
  skidNodes = { src: src, f: f, g: g };
  return skidNodes;
}
function skid(on, amt) {
  if (!AC || muted) { if (skidNodes) skidNodes.g.gain.value = 0.0001; return; }
  var s = ensureSkid(); if (!s) return;
  s.g.gain.setTargetAtTime(on ? 0.02 + (amt || 0) * 0.05 : 0.0001, AC.currentTime, 0.05);
}

/* ---- event sounds ---- */
var SFX = {
  unlock: unlock,
  isReady: function () { return !!AC && unlocked; },
  isMuted: function () { return muted; },
  mute: function (m) {
    muted = !!m;
    if (muted) { if (engineNodes) engineNodes.g.gain.value = 0.0001; if (skidNodes) skidNodes.g.gain.value = 0.0001; }
    return muted;
  },
  toggle: function () { return SFX.mute(!muted); },
  engine: engine,
  skid: skid,
  tone: tone,
  burst: burst,

  coin:    function () { seq([1320, 1980], 0.055, { dur: 0.09, type: 'square', vol: 0.16 }); },
  pellet:  function () { tone({ f: 780, to: 1100, dur: 0.05, type: 'square', vol: 0.09 }); },
  shell:   function () { tone({ f: 900, to: 260, dur: 0.16, type: 'sawtooth', vol: 0.14 });
                         burst({ f: 2400, to: 700, dur: 0.14, vol: 0.12, q: 0.8 }); },
  whoosh:  function () { burst({ f: 480, to: 2400, dur: 0.22, vol: 0.13, q: 0.7 }); },
  hit:     function () { burst({ f: 1500, to: 90, dur: 0.34, vol: 0.34, q: 0.5, type: 'lowpass' });
                         tone({ f: 180, to: 50, dur: 0.3, type: 'square', vol: 0.2 }); },
  pop:     function () { burst({ f: 2600, to: 500, dur: 0.11, vol: 0.3, q: 0.6 });
                         tone({ f: 640, to: 200, dur: 0.09, type: 'triangle', vol: 0.16 }); },
  boost:   function () { tone({ f: 200, to: 1400, dur: 0.34, type: 'sawtooth', vol: 0.16, lp: 2600 });
                         burst({ f: 500, to: 3000, dur: 0.32, vol: 0.14, q: 0.6 }); },
  land:    function () { burst({ f: 320, to: 70, dur: 0.16, vol: 0.26, q: 0.7, type: 'lowpass' }); },
  jump:    function () { tone({ f: 300, to: 720, dur: 0.14, type: 'triangle', vol: 0.15 }); },
  trick:   function () { seq([880, 1174, 1568], 0.045, { dur: 0.08, type: 'triangle', vol: 0.16 }); },
  crash:   function () { burst({ f: 900, to: 60, dur: 0.5, vol: 0.36, q: 0.4, type: 'lowpass' });
                         tone({ f: 140, to: 40, dur: 0.42, type: 'sawtooth', vol: 0.18 }); },
  ring:    function () { seq([1046, 1568], 0.05, { dur: 0.10, type: 'triangle', vol: 0.16 }); },
  miss:    function () { tone({ f: 300, to: 160, dur: 0.2, type: 'sawtooth', vol: 0.14 }); },
  gate:    function () { tone({ f: 1200, to: 1600, dur: 0.07, type: 'square', vol: 0.12 }); },
  lap:     function () { seq([784, 988, 1319], 0.07, { dur: 0.13, type: 'square', vol: 0.17 }); },
  ui:      function () { tone({ f: 620, to: 880, dur: 0.06, type: 'square', vol: 0.13 }); },
  select:  function () { seq([660, 990], 0.05, { dur: 0.09, type: 'square', vol: 0.15 }); },
  frenzy:  function () { seq([523, 659, 784, 1046, 1319], 0.055, { dur: 0.11, type: 'square', vol: 0.16 }); },
  power:   function () { seq([392, 523, 659, 880], 0.06, { dur: 0.12, type: 'sawtooth', vol: 0.14 }); },
  win:     function () { seq([523, 659, 784, 1046, 1319, 1568], 0.09, { dur: 0.16, type: 'square', vol: 0.19 }); },
  lose:    function () { seq([440, 392, 330, 262], 0.11, { dur: 0.2, type: 'sawtooth', vol: 0.17 }); },
  alarm:   function () { tone({ f: 880, to: 660, dur: 0.12, type: 'square', vol: 0.12 }); }
};

root.SFX = SFX;
})(typeof window !== 'undefined' ? window : globalThis);

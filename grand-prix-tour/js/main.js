/* Grand Prix World Tour — boot, menus, HUD, input, saving and quality. */
import * as THREE from 'three';
import { LEVELS, LIVERIES } from './levels.js';
import { Race, STEP } from './race.js';
import { makeCar } from './car.js';
import { cardArt } from './art.js';
import * as audio from './audio.js';
import { TIERS } from './quality.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = id => document.getElementById(id);
const SAVE = 'nexusRacing.v1';
const TEST = /[?&]test\b/.test(location.search);
const OFFSITE = !location.pathname.includes('/grand-prix-tour/');

/* ------------------------------------------------------------ save */
function loadSave() {
  try {
    const r = JSON.parse(localStorage.getItem(SAVE) || '{}');
    return {
      unlocked: Math.min(LEVELS.length, Math.max(1, r.unlocked | 0 || 1)), best: r.best || {}, livery: (r.livery | 0) % LIVERIES.length,
      cam: r.cam === 'cockpit' ? 'cockpit' : 'chase', quality: ['auto', 'ultra', 'high', 'medium', 'low'].includes(r.quality) ? r.quality : 'auto', muted: !!r.muted
    };
  } catch (e) { return { unlocked: 1, best: {}, livery: 0, cam: 'chase', quality: 'auto', muted: false }; }
}
function store() { try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch (e) { /* private mode */ } }
const save = loadSave();
audio.setMuted(save.muted);

let race = null, level = null, acc = 0, paused = false, resultsAt = 0, introT = 0, lastHud = 0;

/* ------------------------------------------------------------ renderer */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const QPR = [Math.min(devicePixelRatio || 1, 1.75), 1, 0.72];
const tierOf = () => q === 0 ? (save.quality === 'ultra' ? TIERS.ultra : TIERS.high) : q === 1 ? TIERS.medium : TIERS.low;
let composer = null;
let q = save.quality === 'auto' ? (devicePixelRatio > 1.5 && Math.min(innerWidth, innerHeight) < 700 ? 1 : 0) : { ultra: 0, high: 0, medium: 1, low: 2 }[save.quality];
function applyQuality() {
  const pr = q === 0 && save.quality === 'ultra' ? Math.min(devicePixelRatio || 1, 2) : QPR[q];
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
  if (race) {
    race.drawDist = race.L.fog.far * [save.quality === 'ultra' ? 1.25 : 1.05, 0.9, 0.72][q] + 80;
    if (q > 0) { race.sun.castShadow = false; composer = null; } // stepped down at runtime: drop the expensive passes
  }
  if (composer) { composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight); }
}
function buildComposer() {
  composer = null;
  const T = race.tier;
  if (!(T.bloom === 'always' || (T.bloom === 'night' && race.L.night))) return;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(race.scene, race.camera));
  const night = !!race.L.night;
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), night ? 0.42 : 0.25, 0.4, night ? 0.92 : 0.97));
  composer.addPass(new OutputPass());
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight);
}
applyQuality();
addEventListener('resize', applyQuality);

/* ------------------------------------------------------------ showroom */
const show = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(36, 1, 0.1, 200), car: null, t: 0 };
(function buildShowroom() {
  const s = show.scene;
  s.background = new THREE.Color('#0b0c12');
  s.fog = new THREE.Fog('#0b0c12', 14, 40);
  s.add(new THREE.HemisphereLight('#b8c8ff', '#201418', 1.1));
  const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(4, 6, 3); s.add(key);
  const rim = new THREE.DirectionalLight('#ff5a40', 1.6); rim.position.set(-5, 2, -4); s.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: '#15161c', roughness: 0.35, metalness: 0.4 }));
  floor.rotation.x = -Math.PI / 2; s.add(floor);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.3, 0.08, 48), new THREE.MeshStandardMaterial({ color: '#22242c', roughness: 0.5, metalness: 0.5 }));
  disc.position.y = 0.04; s.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.25, 0.03, 6, 64), new THREE.MeshBasicMaterial({ color: '#e10600' }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.09; s.add(ring);
  for (let i = 0; i < 9; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6, 0.08), new THREE.MeshBasicMaterial({ color: '#2a2d38' }));
    const a = i / 9 * Math.PI * 2; bar.position.set(Math.cos(a) * 12, 3, Math.sin(a) * 12); s.add(bar);
  }
  setShowCar();
})();
function setShowCar() {
  if (show.car) show.scene.remove(show.car);
  show.car = makeCar(LIVERIES[save.livery], { standalone: true });
  show.car.position.y = 0.08;
  show.scene.add(show.car);
}

/* ------------------------------------------------------------ screens */
const SCREENS = ['menu', 'levels', 'garage', 'help', 'intro', 'pause', 'results'];
let screen = 'menu';
function go(name) {
  screen = name;
  for (const s of SCREENS) $(s).hidden = s !== name;
  const inRace = ['intro', 'race', 'pause', 'results'].includes(name) && race;
  $('hud').hidden = !(name === 'race' || name === 'pause');
  $('touch').hidden = !(name === 'race' && isTouch);
  if (name === 'levels') renderLevels();
  if (name === 'garage') renderGarage();
  if (!inRace && race) { disposeRace(); }
}
$('loading').hidden = true;
if (OFFSITE) $('bHome').hidden = true;

$('bRace').onclick = () => { audio.unlock(); audio.sfx.click(); go('levels'); };
$('bGarage').onclick = () => { audio.unlock(); audio.sfx.click(); go('garage'); };
$('bHelp').onclick = () => { audio.sfx.click(); go('help'); };
$('bHelpBack').onclick = () => go('menu');
$('bLvBack').onclick = () => go('menu');
$('bGarBack').onclick = () => go('menu');
function soundLabel() { $('bSound').textContent = 'Sound: ' + (save.muted ? 'off' : 'on'); }
$('bSound').onclick = () => { save.muted = !save.muted; audio.setMuted(save.muted); store(); soundLabel(); };
soundLabel();
function qualLabel() { $('bQuality').textContent = 'Quality: ' + save.quality; }
$('bQuality').onclick = () => {
  const o = ['auto', 'ultra', 'high', 'medium', 'low']; save.quality = o[(o.indexOf(save.quality) + 1) % 5]; store(); qualLabel();
  if (save.quality !== 'auto') q = { ultra: 0, high: 0, medium: 1, low: 2 }[save.quality];
  applyQuality();
};
qualLabel();

const fmt = t => { if (!isFinite(t)) return '--'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3); };
const ord = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const medalOf = p => p === 1 ? 'gold' : p === 2 ? 'silver' : p === 3 ? 'bronze' : null;
const stars = n => '●'.repeat(n) + '○'.repeat(5 - n);
const diffStars = L => Math.max(1, Math.min(5, Math.round((L.id + 1) / 2)));

function renderLevels() {
  const grid = $('levelGrid'); grid.innerHTML = '';
  let golds = 0;
  LEVELS.forEach(L => {
    const b = save.best[L.id], locked = L.id > save.unlocked, md = b && medalOf(b.place);
    if (md === 'gold') golds++;
    const el = document.createElement('button');
    el.className = 'lv' + (locked ? ' locked' : '');
    el.innerHTML = cardArt(L, 'lv' + L.id) + (locked ? `<div class="lock">🔒 LOCKED<br><small>Podium in race ${L.id - 1}</small></div>` : '') +
      (md ? `<span class="medal ${md}">${b.place}</span>` : '') +
      `<div class="meta"><div class="n">RACE ${L.id} · ${L.country.toUpperCase()}</div><div class="route">${L.from} → ${L.to}</div>
      <div class="info"><span>${(L.length / 1000).toFixed(1)} km · ${L.time}</span><span class="stars">${stars(diffStars(L))}</span></div>
      <div class="info"><span>${b ? 'Best ' + fmt(b.time) + ' · ' + ord(b.place) : 'Not raced'}</span></div></div>`;
    if (!locked) el.onclick = () => { audio.unlock(); audio.sfx.click(); openLevel(L.id); };
    grid.appendChild(el);
  });
  $('tourSub').textContent = `Finish in the top three to unlock the next race · ${golds}/10 gold`;
}

function renderGarage() {
  const box = $('livList'); box.innerHTML = '';
  LIVERIES.forEach((l, i) => {
    const el = document.createElement('button');
    el.className = 'liv' + (i === save.livery ? ' on' : '');
    el.innerHTML = `<div class="sw"><i style="background:${l.a}"></i><i style="background:${l.b}"></i><i style="background:${l.c}"></i></div><b>${l.team}</b><small>Car #${l.num}</small>`;
    el.onclick = () => { save.livery = i; store(); setShowCar(); renderGarage(); audio.sfx.click(); };
    box.appendChild(el);
  });
}

/* ------------------------------------------------------------ race lifecycle */
let mini = null, best = null, splitTimer = 0, msgTimer = 0;

function disposeRace() {
  audio.stopEngine();
  if (race) { race.dispose(); race = null; }
  composer = null;
}

function openLevel(id, { skipIntro = false } = {}) {
  disposeRace();
  level = LEVELS[id - 1];
  $('loading').hidden = false; $('loading').textContent = 'BUILDING ' + level.from.toUpperCase() + ' → ' + level.to.toUpperCase();
  return new Promise(res => setTimeout(() => {
    race = new Race(level, renderer, { livery: save.livery, quality: q, cam: save.cam, tier: tierOf() });
    applyQuality(); buildComposer();
    buildMini();
    buildTower();
    best = save.best[level.id] || null;
    $('loading').hidden = true;
    introT = 0;
    $('introArt').innerHTML = cardArt(level, 'in' + level.id);
    $('introK').textContent = `Race ${level.id} of ${LEVELS.length} · ${level.country}`;
    $('introRoute').innerHTML = `${level.from}<i>→</i>${level.to}`;
    $('introBlurb').textContent = level.blurb;
    $('introFacts').innerHTML = [['Distance', (level.length / 1000).toFixed(1) + ' km'], ['Conditions', level.time], ['Rivals', '<span class="stars">' + stars(diffStars(level)) + '</span>'], ['Grid', ord(level.grid) + ' / 12']]
      .map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('') + (best ? `<div style="grid-column:1/-1"><small>Your best</small><b>${fmt(best.time)} · ${ord(best.place)}</b></div>` : '');
    $('rFrom').textContent = level.from; $('rTo').textContent = level.to;
    if (skipIntro) beginRace(); else go('intro');
    res();
  }, 30));
}
$('bGo').onclick = () => { audio.unlock(); beginRace(); };
$('bIntroBack').onclick = () => go('levels');

function beginRace() {
  go('race');
  paused = false; acc = 0; resultsAt = 0;
  race.resetCamera();
  race.start();
  audio.startEngine();
  $('lights').hidden = false;
  [...$('lights').children].forEach(i => i.classList.remove('on'));
}

function pause(on) {
  if (!race || (screen !== 'race' && screen !== 'pause')) return;
  paused = on;
  go(on ? 'pause' : 'race');
  $('bCamP').textContent = 'Camera: ' + race.camMode;
}
$('bResume').onclick = () => pause(false);
$('bRestart').onclick = () => openLevel(level.id, { skipIntro: true });
$('bQuit').onclick = () => go('levels');
$('bCamP').onclick = () => { toggleCam(); $('bCamP').textContent = 'Camera: ' + race.camMode; };
$('bNext').onclick = () => openLevel(Math.min(LEVELS.length, level.id + 1));
$('bRetry').onclick = () => openLevel(level.id, { skipIntro: true });
$('bResTour').onclick = () => go('levels');
function toggleCam() { if (!race) return; race.camMode = race.camMode === 'chase' ? 'cockpit' : 'chase'; save.cam = race.camMode; store(); }
addEventListener('visibilitychange', () => { if (document.hidden && screen === 'race' && !TEST) pause(true); });

/* ------------------------------------------------------------ input */
const keys = new Set();
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'hand', ShiftLeft: 'drs', ShiftRight: 'drs', KeyE: 'drs' };
addEventListener('keydown', e => {
  if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); if (screen === 'race') e.preventDefault(); }
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') { if (screen === 'race') pause(true); else if (screen === 'pause') pause(false); }
  if (e.code === 'KeyC' && screen === 'race') toggleCam();
  if (e.code === 'KeyR' && screen === 'race') resetReq = true;
  if ((e.code === 'Enter' || e.code === 'Space') && screen === 'intro') beginRace();
});
addEventListener('keyup', e => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); });
addEventListener('blur', () => keys.clear());
let resetReq = false;
const isTouch = /[?&]touch(?:&|$)/.test(location.search) || matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
const touch = {};
for (const [id, k] of [['tLeft', 'left'], ['tRight', 'right'], ['tGas', 'up'], ['tBrake', 'down'], ['tDrs', 'drs']]) {
  const el = $(id);
  const on = e => { e.preventDefault(); touch[k] = true; el.classList.add('on'); audio.unlock(); };
  const off = e => { e.preventDefault(); touch[k] = false; el.classList.remove('on'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
}
$('tCam').addEventListener('pointerdown', e => { e.preventDefault(); toggleCam(); });
$('tPause').addEventListener('pointerdown', e => { e.preventDefault(); pause(true); });

const testInput = { active: false, throttle: 0, brake: 0, steer: 0, handbrake: false, drs: false, auto: false, autoSkill: 0.985 };
function readInput() {
  if (testInput.active) { const i = { ...testInput, reset: resetReq }; resetReq = false; return i; }
  const h = k => keys.has(k) || touch[k];
  const i = { throttle: h('up') ? 1 : 0, brake: h('down') ? 1 : 0, steer: (h('right') ? 1 : 0) - (h('left') ? 1 : 0), handbrake: keys.has('hand'), drs: h('drs'), reset: resetReq };
  resetReq = false;
  return i;
}

/* ------------------------------------------------------------ HUD */
const rpmBar = $('rpm'); for (let i = 0; i < 15; i++) rpmBar.appendChild(document.createElement('i'));
function flash(text, cls = '', dur = 1.2) { const m = $('msg'); m.textContent = text; m.className = 'on ' + cls; msgTimer = dur; }

function buildMini() {
  const t = race.track, c = document.createElement('canvas'); c.width = 380; c.height = 300;
  const g = c.getContext('2d');
  let a = Infinity, b = -Infinity, cz = Infinity, d = -Infinity;
  for (let i = 0; i < t.n; i += 4) { a = Math.min(a, t.x[i]); b = Math.max(b, t.x[i]); cz = Math.min(cz, t.z[i]); d = Math.max(d, t.z[i]); }
  const sc = Math.min(340 / (b - a), 260 / (d - cz));
  const ox = 190 - (a + b) / 2 * sc, oz = 150 - (cz + d) / 2 * sc;
  // x is flipped so left/right on the map match the driver's view from above
  const P = (x, z) => [380 - (x * sc + ox), 300 - (z * sc + oz)];
  const path = (i0, i1) => { g.beginPath(); for (let i = i0; i <= i1; i += 3) { const [px, pz] = P(t.x[i], t.z[i]); i === i0 ? g.moveTo(px, pz) : g.lineTo(px, pz); } };
  const iS = Math.round(140 / 2), iF = Math.round(t.finishS / 2);
  g.lineCap = g.lineJoin = 'round';
  path(iS, iF); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 11; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 5; g.stroke();
  for (const [s0, s1] of t.drs) { path(Math.round(s0 / 2), Math.round(s1 / 2)); g.strokeStyle = '#20d070'; g.lineWidth = 5; g.stroke(); }
  for (const s of t.checkpoints) { const [px, pz] = P(t.x[s / 2 | 0], t.z[s / 2 | 0]); g.fillStyle = '#ffcb3a'; g.beginPath(); g.arc(px, pz, 5, 0, 7); g.fill(); }
  let [px, pz] = P(t.x[iS], t.z[iS]); g.fillStyle = '#20d070'; g.beginPath(); g.arc(px, pz, 9, 0, 7); g.fill();
  [px, pz] = P(t.x[iF], t.z[iF]);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(px - 9 + x * 6, pz - 9 + y * 6, 6, 6); }
  mini = { base: c, P, ctx: $('mini').getContext('2d') };
}
function drawMini() {
  const g = mini.ctx; g.clearRect(0, 0, 380, 300); g.drawImage(mini.base, 0, 0);
  for (const c of race.cars) {
    const [x, z] = mini.P(c.x, c.z);
    g.fillStyle = c.isPlayer ? '#e10600' : c.liv.a; g.strokeStyle = c.isPlayer ? '#fff' : 'rgba(0,0,0,.6)'; g.lineWidth = c.isPlayer ? 3 : 1.5;
    g.beginPath(); g.arc(x, z, c.isPlayer ? 8 : 5, 0, 7); g.fill(); g.stroke();
  }
}
const code3 = c => c.isPlayer ? 'YOU' : c.liv.driver.split(' ').pop().slice(0, 3).toUpperCase();
function buildTower() {
  const box = $('towerRows'); box.innerHTML = '';
  race.cars.forEach(() => { const r = document.createElement('div'); r.className = 'r'; r.innerHTML = '<span class="p"></span><i></i><span class="nm"></span><span class="g"></span>'; box.appendChild(r); });
}
function updateTower() {
  const rows = $('towerRows').children, order = [...race.cars].sort((a, b) => a.place - b.place), lead = order[0];
  order.forEach((c, i) => {
    const r = rows[i]; r.className = 'r' + (c.isPlayer ? ' me' : '');
    r.children[0].textContent = c.place; r.children[1].style.background = c.liv.a; r.children[2].textContent = code3(c);
    let gap = '';
    if (i === 0) gap = 'Leader';
    else if (c.finished && lead.finished) gap = '+' + (c.finishTime - lead.finishTime).toFixed(1);
    else gap = '+' + Math.max(0, (lead.s - c.s) / Math.max(25, c.v)).toFixed(1);
    r.children[3].textContent = gap;
  });
  $('towerCp').textContent = 'CP ' + race.player.cp + '/' + race.track.checkpoints.length;
}
function updateHud(dt) {
  const p = race.player, t = race.track;
  const raceT = race.phase === 'race' || race.phase === 'done' ? (p.finished ? p.finishTime : race.raceT) : 0;
  $('timer').textContent = fmt(raceT);
  $('posN').textContent = p.place;
  const left = Math.max(0, t.finishS - p.s);
  $('dist').innerHTML = (left / 1000).toFixed(2) + ' <small>KM TO ' + level.to.toUpperCase() + '</small>';
  $('prog').firstChild.style.width = (100 * Math.min(1, Math.max(0, (p.s - 140) / level.length))) + '%';
  const kmh = Math.round(Math.abs(p.v) * 3.6);
  $('kmh').textContent = kmh;
  $('gear').textContent = p.v < -0.5 ? 'R' : (race.phase === 'race' || race.phase === 'done') ? (Math.abs(p.v) < 0.5 && p.throttle < 0.1 ? 'N' : p.gear) : 'N';
  const lit = Math.round(Math.max(0, (p.rpm - 0.35) / 0.65) * 15);
  [...rpmBar.children].forEach((el, i) => el.className = i < lit ? (i < 6 ? 'g' : i < 11 ? 'r' : 'b') : '');
  const inZone = t.drsFlag[t.idx(p.s)];
  $('tagDrs').className = p.drs ? 'on' : inZone ? 'av' : '';
  $('tagSlip').className = p.slip > 0.25 ? 'sl' : '';
  $('tagCam').textContent = race.camMode.toUpperCase();
  const next = t.checkpoints[p.cp];
  $('cpInfo').textContent = next ? `CHECKPOINT ${p.cp + 1} IN ${Math.max(0, next - p.s).toFixed(0)} M` : p.finished ? 'FINISHED' : 'FINAL SECTOR';
  if (performance.now() - lastHud > 250) { lastHud = performance.now(); updateTower(); }
  drawMini();
  if (p.wrong > 1.2) flash('Wrong way', 'red', 0.3);
  if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) $('msg').className = ''; }
  if (splitTimer > 0) { splitTimer -= dt; if (splitTimer <= 0) $('split').classList.remove('on'); }
  $('hit').style.opacity = Math.min(0.8, race.shake * 0.9);
}

function handleEvents() {
  const ev = race.events; race.events = [];
  for (const e of ev) {
    if (e.t === 'light') { [...$('lights').children].forEach((el, i) => el.classList.toggle('on', i < e.n)); audio.sfx.light(); }
    else if (e.t === 'go') { [...$('lights').children].forEach(el => el.classList.remove('on')); setTimeout(() => { $('lights').hidden = true; }, 700); flash('Go!', 'green', 1.1); audio.sfx.go(); }
    else if (e.t === 'cp') {
      audio.sfx.checkpoint();
      race.splits = race.splits || []; race.splits[e.n - 1] = e.time;
      const prev = best && best.splits && best.splits[e.n - 1];
      const el = $('split');
      if (prev) { const d = e.time - prev; el.textContent = `CP ${e.n}  ${fmt(e.time)}  ${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}`; el.style.background = d < 0 ? '#14a050' : '#c0281e'; }
      else { el.textContent = `CHECKPOINT ${e.n}  ${fmt(e.time)}`; el.style.background = 'rgba(0,0,0,.55)'; }
      el.classList.add('on'); splitTimer = 2.5;
    }
    else if (e.t === 'drs') { audio.sfx.drs(); flash('DRS open', 'green', 0.7); }
    else if (e.t === 'bump') audio.sfx.bump(e.k);
    else if (e.t === 'overtake') { if (msgTimer <= 0) flash('▲ P' + e.place, 'gold', 0.9); audio.sfx.whoosh(); }
    else if (e.t === 'finish') { finishRace(); }
  }
}

function finishRace() {
  const p = race.player, res = race.results(), place = res.findIndex(r => r.c.isPlayer) + 1;
  audio.sfx.finish();
  flash(place <= 3 ? ord(place) + ' — podium!' : 'Finished ' + ord(place), place <= 3 ? 'gold' : '', 2.6);
  // save
  const b = save.best[level.id] || {};
  const nb = { time: Math.min(b.time ?? Infinity, p.finishTime), place: Math.min(b.place ?? 99, place), splits: (!b.time || p.finishTime < b.time) ? race.splits || [] : b.splits };
  save.best[level.id] = nb;
  const unlockedNow = place <= 3 && level.id === save.unlocked && level.id < LEVELS.length;
  if (place <= 3) save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, level.id + 1));
  store();
  race.lastResult = { place, res, unlockedNow, time: p.finishTime };
  resultsAt = 2.8;
}
function showResults() {
  const r = race.lastResult, L = level;
  $('resK').textContent = `Race ${L.id} · ${L.country}`;
  $('resRoute').innerHTML = `${L.from}<i>→</i>${L.to}`;
  const md = medalOf(r.place);
  $('resMedal').innerHTML = (md ? `<span class="medal ${md}">${r.place}</span>` : '') + `<div><b>${ord(r.place)} place · ${fmt(r.time)}</b><div class="sub" style="margin:0;text-align:left">${md ? md[0].toUpperCase() + md.slice(1) + ' medal' : 'Finish in the top three for a medal'}${r.unlockedNow ? ' · <b style="color:#20d070">' + LEVELS[L.id].from + ' → ' + LEVELS[L.id].to + ' unlocked!</b>' : ''}${L.id === LEVELS.length && r.place <= 3 ? ' · <b style="color:#ffcb3a">World Tour complete!</b>' : ''}</div></div>`;
  const lead = r.res[0].time;
  $('resTable').innerHTML = r.res.map((x, i) => `<tr class="${x.c.isPlayer ? 'me' : ''}"><td class="p">${i + 1}</td><td><span class="bar" style="background:${x.c.liv.a}"></span>${x.c.isPlayer ? '<b>You</b>' : x.c.liv.driver}</td><td style="color:#9aa0aa">${x.c.liv.team} #${x.c.liv.num}</td><td class="t">${i === 0 ? fmt(x.time) : '+' + (x.time - lead).toFixed(3)}${x.est ? '*' : ''}</td></tr>`).join('');
  $('resTable').insertAdjacentHTML('beforeend', r.res.some(x => x.est) ? '<tr><td colspan="4" style="color:#9aa0aa;font-size:12px;border:0">* still racing: projected finishing gap</td></tr>' : '');
  $('bNext').hidden = !(L.id < LEVELS.length && save.unlocked > L.id);
  go('results');
}

/* ------------------------------------------------------------ loop */
const perf = { frames: [], work: [], sync: false };
let last = performance.now(), slowFrames = 0, fastFrames = 0, upgraded = false;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const w0 = performance.now();
  const aspect = innerWidth / Math.max(1, innerHeight);
  if (race && (screen === 'race' || screen === 'pause' || screen === 'intro' || screen === 'results')) {
    if (screen === 'intro') { introT += dt; race.frame(dt, aspect); race.introCamera(introT); }
    else {
      if (!paused) {
        acc += dt;
        let n = 0;
        while (acc >= STEP && n < 8) { race.step(readInput()); acc -= STEP; n++; }
        if (n === 8) acc = 0;
        race.frame(dt, aspect);
        handleEvents();
        if (screen === 'race') updateHud(dt);
        if (resultsAt > 0) { resultsAt -= dt; if (resultsAt <= 0 && screen === 'race') showResults(); }
      }
      feedAudio();
    }
    if (composer) composer.render(); else renderer.render(race.scene, race.camera);
  } else {
    show.t += dt;
    const a = show.t * 0.35 + (screen === 'garage' ? 0.8 : 2.2), r = screen === 'garage' ? 8.6 : 9.5;
    show.cam.aspect = aspect; show.cam.position.set(Math.sin(a) * r, screen === 'garage' ? 2.2 : 2.8, Math.cos(a) * r);
    show.cam.lookAt(0, screen === 'garage' ? 0.5 : 0.2, 0);
    const W = innerWidth, H = innerHeight;
    if (screen === 'menu' && W >= 900 && aspect > 1.2) show.cam.setViewOffset(W, H, -W * 0.2, 0, W, H);
    else if (screen === 'garage') show.cam.setViewOffset(W, H, 0, H * 0.14, W, H);
    else show.cam.clearViewOffset();
    show.cam.updateProjectionMatrix();
    renderer.render(show.scene, show.cam);
  }
  if (perf.sync) { const gl = renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); }
  const work = performance.now() - w0;
  perf.frames.push(dt * 1000); perf.work.push(work);
  if (perf.frames.length > 600) { perf.frames.shift(); perf.work.shift(); }
  autoQuality(dt);
}
function feedAudio() {
  const p = race.player;
  let rival = null, bd = 1e9;
  for (const c of race.cars) if (c !== p) { const dx = c.x - race.camera.position.x, dz = c.z - race.camera.position.z, d = Math.hypot(dx, dz); if (d < bd) { bd = d; rival = c; } }
  let rv = null;
  if (rival && bd < 80) {
    const dx = rival.x - p.x, dz = rival.z - p.z, d = Math.max(1, Math.hypot(dx, dz));
    const vr = ((Math.sin(rival.yaw) * rival.v - Math.sin(p.yaw) * p.v) * dx + (Math.cos(rival.yaw) * rival.v - Math.cos(p.yaw) * p.v) * dz) / d;
    rv = { rpm: rival.rpm, dist: bd, doppler: Math.max(0.7, Math.min(1.3, 1 - vr / 340 * 3)) };
  }
  const nearStand = Math.min(Math.abs(p.s - 140), Math.abs(p.s - race.track.finishS));
  audio.update({ rpm: p.rpm, throttle: p.throttle, speed: Math.abs(p.v), squeal: p.squeal || 0, paused: paused || screen !== 'race', cockpit: race.camMode === 'cockpit', rival: rv, rain: level.weather === 'rain', crowd: Math.max(0, 1 - nearStand / 120), rumble: p.offroad && Math.abs(p.v) > 5 ? 0.6 : p.scrape > 0 ? 0.4 : 0 });
}
function autoQuality(dt) {
  if (save.quality !== 'auto' || TEST || !race || screen !== 'race' || paused) return;
  if (dt > 0.0205) slowFrames++; else slowFrames = Math.max(0, slowFrames - 0.5);
  if (dt < 0.0125) fastFrames++; else fastFrames = 0;
  if (slowFrames > 90 && q < 2) { q++; slowFrames = 0; applyQuality(); }
  if (fastFrames > 600 && q > 0 && !upgraded) { q--; upgraded = true; fastFrames = 0; applyQuality(); }
}
go('menu');
requestAnimationFrame(loop);

/* ------------------------------------------------------------ test hook */
const stat = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return { avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2), p50: +s[s.length >> 1].toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), max: +s[s.length - 1].toFixed(2), n: a.length }; };
window.GAME = {
  LEVELS, save, get race() { return race; }, get screen() { return screen; },
  async start(n, opts = {}) { await openLevel(n, { skipIntro: opts.skipIntro !== false }); if (opts.skipLights) { race.phase = 'race'; race.raceT = 0; $('lights').hidden = true; } return this.state(); },
  intro(n) { return openLevel(n); },
  input(o) { Object.assign(testInput, { active: true }, o); },
  release() { testInput.active = false; },
  auto(on = true, skill = 0.985) { Object.assign(testInput, { active: true, auto: on, autoSkill: skill }); },
  /* run the simulation synchronously for `sec` seconds of race time */
  sim(sec) {
    const steps = Math.round(sec / STEP);
    for (let i = 0; i < steps; i++) { race.step(readInput()); if (i % 30 === 0) { handleEvents(); } }
    race.frame(STEP, innerWidth / innerHeight); handleEvents();
    if (resultsAt > 0) { resultsAt = 0; showResults(); }
    return this.state();
  },
  warp(s, d = 0) { const p = race.player, o = race.track.at(s, d, {}); p.x = o.x; p.z = o.z; p.yaw = o.th; race.locate(p); race.resetCamera(); return this.state(); },
  cam(m) { race.camMode = m; },
  state() {
    if (!race) return { screen };
    const p = race.player;
    return { screen, phase: race.phase, place: p.place, s: +p.s.toFixed(1), d: +p.d.toFixed(2), finishS: race.track.finishS, kmh: Math.round(p.v * 3.6), t: +(race.raceT || 0).toFixed(2), finished: p.finished, cp: p.cp, unlocked: save.unlocked, quality: q, seed: race.track.seed };
  },
  perf() { return { frame: stat(perf.frames), work: stat(perf.work) }; },
  perfReset(sync = false) { perf.frames.length = 0; perf.work.length = 0; perf.sync = sync; },
  setQuality(n) { q = n; applyQuality(); },
  setTier(name) { save.quality = name; q = { ultra: 0, high: 0, medium: 1, low: 2 }[name] ?? 0; applyQuality(); },
  go, showResults, pause, resetSave() { localStorage.removeItem(SAVE); Object.assign(save, loadSave()); }
};

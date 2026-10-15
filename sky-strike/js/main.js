/* Sky Strike — boot, renderer + quality, menus, input (keys, mouse stick,
 * touch), the fixed-step loop, HUD glue, saving and the ?test hook. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MISSIONS } from './missions.js';
import { World, STEP } from './world.js';
import { buildJet } from './jet.js';
import { Sky, skyMaterial } from './sky.js';
import { HUD } from './hud.js';
import { cardArt } from './art.js';
import * as audio from './audio.js';
import { TIERS, ORDER } from './quality.js';
import { clamp } from './util.js';

const $ = id => document.getElementById(id);
const SAVE = 'nexusSkyStrike.v1';
const TEST = /[?&]test\b/.test(location.search);
const OFFSITE = !location.pathname.includes('/sky-strike/');
const QOPTS = ['auto', 'ultra', 'high', 'medium', 'low'];

/* ------------------------------------------------------------ save */
function loadSave() {
  try {
    const r = JSON.parse(localStorage.getItem(SAVE) || '{}');
    return { unlocked: clamp(r.unlocked | 0 || 1, 1, MISSIONS.length), best: r.best || {}, quality: QOPTS.includes(r.quality) ? r.quality : 'auto', muted: !!r.muted, invert: !!r.invert, cam: r.cam === 'cockpit' ? 'cockpit' : 'chase' };
  } catch (e) { return { unlocked: 1, best: {}, quality: 'auto', muted: false, invert: false, cam: 'chase' }; }
}
function store() { try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch (e) { /* private mode */ } }
const save = loadSave();
audio.setMuted(save.muted);

/* ------------------------------------------------------------ renderer + quality */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const isTouch = /[?&]touch\b/.test(location.search) || matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');
let autoTier = isTouch || Math.min(innerWidth, innerHeight) < 600 ? 'medium' : 'high';
const buildTier = () => TIERS[save.quality === 'auto' ? autoTier : save.quality];
let rt = 0; // runtime step-down level under auto quality
const PRM = [1, 0.82, 0.68, 0.55];
let world = null, mission = null, composer = null, tier = buildTier();
function applyQuality() {
  const T = world ? world.tier : buildTier();
  const pr = T.pr() * PRM[rt];
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
  if (world) { world.sun.castShadow = !!T.shadows && rt === 0; if (rt >= 2) composer = null; }
  if (composer) { composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight); }
  hud.resize();
}
function buildComposer() {
  composer = null;
  const T = world.tier, night = !!world.M.env.night;
  if (!(T.bloom === true || (T.bloom === 'night' && night)) || rt >= 2) return;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(world.scene, world.camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), night ? 0.75 : 0.42, 0.55, night ? 0.72 : 0.9));
  composer.addPass(new OutputPass());
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight);
}
const hud = new HUD($('hud'), $('mini'));
addEventListener('resize', applyQuality);

/* ------------------------------------------------------------ showroom (menus) */
const show = (() => {
  const env = { ...MISSIONS[7].env, top: '#16244e', horizon: '#f0a474', sunDir: [0.75, 0.12, -0.45], fog: '#c88a74', fogDensity: 0.00008, glow: 1.1, clouds: { count: 70, alt: [-420, -160], span: 4000, lit: '#ffd8b8', shade: '#7a5a72', scale: 1.4, puffs: 16 } };
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(env.fog, env.fogDensity);
  const cam = new THREE.PerspectiveCamera(38, 1, 0.5, 16000);
  const sky = new Sky(scene, env, TIERS.medium);
  scene.add(new THREE.HemisphereLight('#a8b0e0', '#4a3830', 1.1));
  const sun = new THREE.DirectionalLight('#ffc89a', 3.2); sun.position.set(...env.sunDir).multiplyScalar(100); scene.add(sun);
  const rim = new THREE.DirectionalLight('#6a8aff', 1.4); rim.position.set(-50, 20, 60); scene.add(rim);
  const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMaterial(env)));
  scene.environment = pm.fromScene(es, 0, 0.1, 1000).texture; pm.dispose();
  const jet = buildJet(); scene.add(jet.group);
  return { scene, cam, sky, jet, t: 0 };
})();

/* ------------------------------------------------------------ screens */
const SCREENS = ['menu', 'missions', 'brief', 'help', 'pause', 'results'];
let screen = 'menu', paused = false, acc = 0, resultsAt = 0, msgT = 0, lastHud = 0, hitT = 0;
function go(name) {
  screen = name;
  for (const s of SCREENS) $(s).hidden = s !== name;
  $('hudDom').hidden = !(name === 'fly' || name === 'pause');
  $('touch').hidden = !(name === 'fly' && isTouch);
  if (name !== 'fly' && document.pointerLockElement) document.exitPointerLock();
  if (name === 'missions') renderMissions();
  if (['menu', 'missions', 'help'].includes(name) && world) disposeWorld();
  if (name !== 'fly') { $('cloud').style.opacity = 0; $('hit').style.opacity = 0; }
  if (name !== 'fly' && name !== 'pause') hud.g.clearRect(0, 0, hud.c.width, hud.c.height);
}
$('loading').hidden = true;
if (OFFSITE) $('bHome').hidden = true;
$('bPlay').onclick = () => { audio.unlock(); audio.sfx.click(); go('missions'); };
$('bHelp').onclick = () => { audio.sfx.click(); go('help'); };
$('bHelpBack').onclick = () => go('menu');
$('bMsBack').onclick = () => go('menu');
const soundLabel = () => $('bSound').textContent = 'Sound: ' + (save.muted ? 'off' : 'on');
$('bSound').onclick = () => { save.muted = !save.muted; audio.setMuted(save.muted); store(); soundLabel(); };
const qualLabel = () => $('bQuality').textContent = 'Quality: ' + save.quality;
$('bQuality').onclick = () => { save.quality = QOPTS[(QOPTS.indexOf(save.quality) + 1) % QOPTS.length]; rt = 0; store(); qualLabel(); applyQuality(); };
const invLabel = () => $('bInvert').textContent = 'Pitch: ' + (save.invert ? 'W climbs' : 'flight');
$('bInvert').onclick = () => { save.invert = !save.invert; store(); invLabel(); };
soundLabel(); qualLabel(); invLabel();

const fmt = t => { const m = Math.floor(t / 60), s = Math.floor(t - m * 60); return m + ':' + String(s).padStart(2, '0'); };
const starStr = n => '★'.repeat(n) + `<i>${'★'.repeat(3 - n)}</i>`;
function renderMissions() {
  const grid = $('grid'); grid.innerHTML = '';
  let stars = 0;
  MISSIONS.forEach(M => {
    const b = save.best[M.id], locked = M.id > save.unlocked; if (b) stars += b.stars;
    const el = document.createElement('button');
    el.className = 'ms' + (locked ? ' locked' : '');
    el.innerHTML = cardArt(M, 'c' + M.id) + (locked ? `<div class="lock">🔒 LOCKED<br><small>Complete mission ${M.id - 1}</small></div>` : '') +
      `<div class="meta"><div class="n">MISSION ${M.id} · ${M.place.toUpperCase()}</div><div class="nm">${M.name}</div>
      <div class="info"><span>${M.time} · par ${fmt(M.par)}</span><span class="st">${starStr(b ? b.stars : 0)}</span></div>
      <div class="info"><span>${b ? 'Best ' + b.score.toLocaleString() + ' · ' + fmt(b.time) : 'Not flown'}</span></div></div>`;
    if (!locked) el.onclick = () => { audio.unlock(); audio.sfx.click(); openMission(M.id); };
    grid.appendChild(el);
  });
  $('campSub').textContent = `Complete a mission to unlock the next · ${stars}/${MISSIONS.length * 3} stars`;
}

/* ------------------------------------------------------------ mission lifecycle */
function disposeWorld() { audio.stopEngine(); if (world) { world.dispose(); world = null; } composer = null; }
function openMission(id, { skipBrief = false, tierName } = {}) {
  disposeWorld();
  mission = MISSIONS[id - 1];
  $('loading').hidden = false; $('loading').textContent = 'PREPARING ' + mission.name.toUpperCase() + ' · ' + mission.place.toUpperCase();
  return new Promise(res => setTimeout(() => {
    const T = tierName ? TIERS[tierName] : buildTier();
    const t0 = performance.now();
    world = new World(mission, renderer, { tier: T, cam: save.cam });
    world.buildMs = Math.round(performance.now() - t0);
    renderer.toneMappingExposure = mission.env.exposure || 1;
    rt = 0; applyQuality(); buildComposer();
    world.introT = 0;
    $('loading').hidden = true;
    const b = save.best[mission.id];
    $('briefArt').innerHTML = cardArt(mission, 'b' + mission.id);
    $('briefK').textContent = `Mission ${mission.id} of ${MISSIONS.length} · ${mission.place} · ${mission.time}`;
    $('briefName').innerHTML = `Operation <i>${mission.name}</i>`;
    $('briefBlurb').textContent = mission.blurb;
    const objs = world.objectives.map(o => `${o.label} ×${o.total}`).join(' · ');
    $('briefFacts').innerHTML = [['Objectives', objs, 'wide'], ['Threats', mission.threats, 'wide'], ['Par time', fmt(mission.par)], ['Loadout', `${world.ammo.bombs} bombs · ${world.ammo.msl} msl`], ['Best', b ? `${b.score.toLocaleString()} ${'★'.repeat(b.stars)}` : '—']]
      .map(([k, v, c]) => `<div class="${c || ''}"><small>${k}</small><b>${v}</b></div>`).join('');
    buildObjRows();
    if (skipBrief) launch(); else go('brief');
    res();
  }, 30));
}
$('bLaunch').onclick = () => { audio.unlock(); launch(); };
$('bBriefBack').onclick = () => go('missions');
function launch() {
  go('fly'); paused = false; acc = 0; resultsAt = 0; feedClear();
  world.start(); world.camMode = save.cam;
  $('camTag').textContent = world.camMode.toUpperCase();
  if (!isTouch && !TEST) $('mouseHint').hidden = false;
}
function pause(on) {
  if (!world || (screen !== 'fly' && screen !== 'pause')) return;
  if (world.phase === 'done' && on) return;
  paused = on; go(on ? 'pause' : 'fly');
  $('bCamP').textContent = 'Camera: ' + world.camMode;
}
$('bResume').onclick = () => pause(false);
$('bRestart').onclick = () => openMission(mission.id, { skipBrief: true });
$('bQuit').onclick = () => go('missions');
$('bCamP').onclick = () => { toggleCam(); $('bCamP').textContent = 'Camera: ' + world.camMode; };
$('bNext').onclick = () => openMission(Math.min(MISSIONS.length, mission.id + 1));
$('bRetry').onclick = () => openMission(mission.id, { skipBrief: true });
$('bResCamp').onclick = () => go('missions');
function toggleCam() { if (!world) return; world.camMode = world.camMode === 'chase' ? 'cockpit' : 'chase'; save.cam = world.camMode; store(); $('camTag').textContent = world.camMode.toUpperCase(); }
addEventListener('visibilitychange', () => { if (document.hidden && screen === 'fly' && !TEST) pause(true); });
addEventListener('beforeunload', e => { if (screen === 'fly' && world && world.phase === 'fly' && !TEST) { e.preventDefault(); e.returnValue = ''; } });

/* ------------------------------------------------------------ input */
const keys = new Set(), latch = { bomb: false, missile: false, flare: false };
const KEYMAP = { KeyW: 'down', ArrowUp: 'down', KeyS: 'up', ArrowDown: 'up', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyQ: 'yawL', KeyE: 'yawR', ShiftLeft: 'ab', ShiftRight: 'ab', KeyZ: 'brake', ControlLeft: 'brake', ControlRight: 'brake', Space: 'gun', KeyB: 'bomb', KeyF: 'missile', KeyX: 'flare' };
addEventListener('keydown', e => {
  const k = KEYMAP[e.code];
  if (k) { keys.add(k); if (screen === 'fly') e.preventDefault(); if (!e.repeat && latch[k] !== undefined) latch[k] = true; }
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') { if (screen === 'fly') pause(true); else if (screen === 'pause') pause(false); }
  if (e.code === 'KeyC' && screen === 'fly') toggleCam();
  if ((e.code === 'Enter' || e.code === 'Space') && screen === 'brief') { e.preventDefault(); launch(); }
  audio.unlock();
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys.delete(k); });
addEventListener('blur', () => keys.clear());
// mouse: pointer-locked "centring stick"
const mouse = { x: 0, y: 0, l: false, r: false };
canvas.addEventListener('mousedown', e => {
  if (screen !== 'fly') return;
  audio.unlock();
  if (!document.pointerLockElement && !isTouch) { canvas.requestPointerLock?.(); $('mouseHint').hidden = true; return; }
  if (e.button === 0) mouse.l = true; if (e.button === 2) { mouse.r = true; latch.bomb = true; }
});
addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  mouse.x = clamp(mouse.x + e.movementX * 0.0042, -1, 1); mouse.y = clamp(mouse.y + e.movementY * 0.0042, -1, 1);
});
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) { mouse.x = mouse.y = 0; mouse.l = mouse.r = false; if (screen === 'fly' && world && world.phase === 'fly' && !TEST) pause(true); } });
// touch
const touch = { x: 0, y: 0 }, tHeld = {};
(() => {
  const st = $('stick'), kn = $('knob'); let id = null;
  const upd = e => { const r = st.getBoundingClientRect(), dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2), l = Math.max(1, Math.hypot(dx, dy)); touch.x = dx / l; touch.y = dy / l; kn.style.transform = `translate(${touch.x * 45}px, ${touch.y * 45}px)`; };
  st.addEventListener('pointerdown', e => { e.preventDefault(); id = e.pointerId; st.setPointerCapture(id); upd(e); audio.unlock(); });
  st.addEventListener('pointermove', e => { if (e.pointerId === id) upd(e); });
  const end = e => { if (e.pointerId !== id) return; id = null; touch.x = touch.y = 0; kn.style.transform = ''; };
  st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
  for (const [bid, k] of [['tGun', 'gun'], ['tBomb', 'bomb'], ['tMsl', 'missile'], ['tFlr', 'flare'], ['tAb', 'ab'], ['tBrk', 'brake']]) {
    const el = $(bid);
    const on = e => { e.preventDefault(); tHeld[k] = true; if (latch[k] !== undefined) latch[k] = true; el.classList.add('on'); audio.unlock(); };
    const off = e => { e.preventDefault(); tHeld[k] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
  }
  $('tCam').addEventListener('pointerdown', e => { e.preventDefault(); toggleCam(); });
  $('tPause').addEventListener('pointerdown', e => { e.preventDefault(); pause(true); });
})();

const testInput = { active: false, auto: false, pitch: 0, roll: 0, yaw: 0, ab: false, brake: false, gun: false, bomb: false, missile: false, flare: false };
function readInput(dt) {
  if (testInput.active) return testInput.auto && world ? world.autopilot() : { ...testInput };
  const h = k => keys.has(k) || tHeld[k];
  const inv = save.invert ? -1 : 1;
  mouse.x *= Math.exp(-dt * 1.6); mouse.y *= Math.exp(-dt * 1.6);
  const kp = ((keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0)) * inv;
  const mp = mouse.y * inv, tp = touch.y * inv;
  const i = {
    pitch: clamp(kp + mp * 1.6 + tp, -1, 1), roll: clamp((keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0) + mouse.x * 1.6 + touch.x, -1, 1), yaw: (keys.has('yawR') ? 1 : 0) - (keys.has('yawL') ? 1 : 0),
    ab: h('ab'), brake: h('brake'), gun: h('gun') || mouse.l, bomb: h('bomb') || mouse.r || latch.bomb, missile: latch.missile, flare: h('flare') || latch.flare
  };
  latch.bomb = latch.missile = latch.flare = false;
  return i;
}

/* ------------------------------------------------------------ HUD DOM */
function buildObjRows() {
  $('objRows').innerHTML = world.objectives.map((o, i) => `<div class="o" id="ob${i}"><b>${o.label}</b><span></span></div>`).join('');
}
function updateHudDom(dt) {
  const W = world;
  $('timer').textContent = fmt(W.result ? W.result.time : W.time);
  $('score').textContent = W.score.toLocaleString() + ' PTS';
  if (performance.now() - lastHud > 200) {
    lastHud = performance.now();
    W.objectives.forEach((o, i) => { const el = $('ob' + i); if (!el) return; el.className = 'o' + (o.complete ? ' done' : ''); el.lastChild.textContent = `${o.done}/${o.total}`; });
    $('objCount').textContent = `${W.objectives.filter(o => o.complete).length}/${W.objectives.length}`;
  }
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').className = ''; }
  hitT = Math.max(0, hitT - dt * 1.8);
  $('hit').style.opacity = Math.min(0.85, hitT + (W.player.alive && W.player.hp < 30 ? 0.18 + Math.sin(W.time * 6) * 0.08 : 0));
  $('cloud').style.opacity = Math.min(0.92, (W.cloudFog || 0) * 1.4);
}
function flash(text, cls = '', dur = 1.6) { const m = $('msg'); m.textContent = text; m.className = 'on ' + cls; msgT = dur; }
function feed(label, score, primary) {
  const box = $('feed'), d = document.createElement('div');
  d.className = primary ? 'p' : ''; d.innerHTML = `<b>+${score}</b>${label.toUpperCase()}`; box.prepend(d);
  while (box.children.length > 6) box.lastChild.remove();
  setTimeout(() => d.remove(), 2700);
}
function feedClear() { $('feed').innerHTML = ''; $('msg').className = ''; }
function handleEvents() {
  const ev = world.events; world.events = [];
  for (const e of ev) {
    if (e.t === 'msg') flash(e.text, e.cls, e.dur);
    else if (e.t === 'obj') flash(e.text, 'green', 2.2);
    else if (e.t === 'kill') feed(e.label, e.score, e.primary);
    else if (e.t === 'hit') hitT = Math.min(1, hitT + e.k * 0.05);
    else if (e.t === 'done') { flash(e.ok ? 'Mission complete' : e.reason, e.ok ? 'green' : 'red', 3); resultsAt = e.ok ? 3.2 : 3.6; finishMission(); }
  }
}
function finishMission() {
  const W = world, r = W.result, M = mission;
  const acc = W.shots.fired ? W.shots.hit / W.shots.fired : 0;
  const timeBonus = r.ok ? Math.max(0, Math.round((M.par - r.time) * 12)) : 0, hpBonus = r.ok ? r.hp * 15 : 0, accBonus = r.ok ? Math.round(acc * 1500) : 0;
  const total = W.score + timeBonus + hpBonus + accBonus;
  const stars = r.ok ? 1 + (r.time <= M.par ? 1 : 0) + (r.hp >= 50 ? 1 : 0) : 0;
  const b = save.best[M.id];
  let unlockedNow = false;
  if (r.ok) {
    save.best[M.id] = { score: Math.max(b?.score || 0, total), stars: Math.max(b?.stars || 0, stars), time: Math.min(b?.time ?? Infinity, r.time) };
    if (M.id === save.unlocked && M.id < MISSIONS.length) unlockedNow = true;
    save.unlocked = Math.max(save.unlocked, Math.min(MISSIONS.length, M.id + 1));
    store();
  }
  W.final = { total, stars, timeBonus, hpBonus, accBonus, acc, unlockedNow };
}
function showResults() {
  const W = world, r = W.result, F = W.final, M = mission;
  $('resK').textContent = `Mission ${M.id} · ${M.place} · ${r.ok ? 'Complete' : 'Failed'}`;
  $('resName').innerHTML = `Operation <i>${M.name}</i>`;
  $('resStars').innerHTML = starStr(F.stars);
  $('resWhy').innerHTML = (r.ok ? `${r.reason}. ` : `${r.reason}. `) + (F.unlockedNow ? `<b style="color:#5dff9a">Operation ${MISSIONS[M.id].name} unlocked!</b>` : '') + (r.ok && M.id === MISSIONS.length ? '<b style="color:#ffcb3a">The Iron Crown has fallen. Campaign complete!</b>' : '') + (r.ok ? `<br><small>★ complete · ★ under par (${fmt(M.par)}) · ★ finish with 50% airframe</small>` : '');
  const rows = [['Targets destroyed', `${W.kills} · ${W.score.toLocaleString()}`], ['Mission time', fmt(r.time)], ['Time bonus', '+' + F.timeBonus], ['Airframe ' + r.hp + '%', '+' + F.hpBonus], ['Gun accuracy ' + Math.round(F.acc * 100) + '%', '+' + F.accBonus]];
  $('resTable').innerHTML = rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('') + `<tr class="tot"><td>Total</td><td>${F.total.toLocaleString()}</td></tr>`;
  $('bNext').hidden = !(M.id < MISSIONS.length && save.unlocked > M.id);
  go('results');
}

/* ------------------------------------------------------------ loop */
const perf = { frames: [], work: [], sync: false };
let last = performance.now(), slow = 0, fast = 0, upgraded = false;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const w0 = performance.now(), aspect = innerWidth / Math.max(1, innerHeight);
  if (world && ['brief', 'fly', 'pause', 'results'].includes(screen)) {
    if (screen === 'brief') { world.introT += dt; world.frame(dt, aspect, {}); }
    else if (!paused) {
      acc += dt;
      let n = 0; const inp = readInput(dt);
      while (acc >= STEP && n < 6) { world.step(inp); inp.missile = false; acc -= STEP; n++; }
      if (n === 6) acc = 0;
      world.frame(dt, aspect, inp);
      handleEvents();
      if (screen === 'fly') { updateHudDom(dt); hud.draw(world, dt, { mouse }); }
      if (resultsAt > 0) { resultsAt -= dt; if (resultsAt <= 0 && screen === 'fly') showResults(); }
      audio.update({ thr: inp.brake ? 0.15 : 0.55 + world.player.ab * 0.45, ab: world.player.ab, speed: world.player.speed, cockpit: world.camMode === 'cockpit', gun: world.player.firing, lock: world.lock.locked ? 2 : world.lock.target && world.ammo.msl > 0 ? 1 : 0, warn: world.warn, pull: world.pullUp, paused: screen !== 'fly', dead: !world.player.alive });
    } else audio.update({ thr: 0, ab: 0, speed: 0, paused: true, lock: 0, warn: 0 });
    if (composer) composer.render(); else renderer.render(world.scene, world.camera);
  } else {
    show.t += dt;
    const S = show, j = S.jet, t = S.t;
    j.group.position.set(0, Math.sin(t * 0.7) * 0.6, 0); j.group.rotation.set(Math.sin(t * 0.5) * 0.06, 0, Math.sin(t * 0.35) * 0.35);
    j.setEngine(0.8, 0.6 + Math.sin(t * 0.9) * 0.4, t);
    const a = t * 0.12 + 2.3, r = screen === 'missions' ? 48 : 30;
    S.cam.aspect = aspect; S.cam.position.set(Math.sin(a) * r, -7 + Math.sin(t * 0.2) * 2, Math.cos(a) * r); S.cam.lookAt(0, 4, 0);
    const W = innerWidth, H = innerHeight;
    if (screen === 'menu' && W >= 900 && aspect > 1.2) S.cam.setViewOffset(W, H, -W * 0.2, 0, W, H); else S.cam.clearViewOffset();
    S.cam.updateProjectionMatrix(); S.sky.update(S.cam);
    renderer.toneMappingExposure = 1;
    renderer.render(S.scene, S.cam);
  }
  if (perf.sync) { const gl = renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); }
  const work = performance.now() - w0;
  perf.frames.push(dt * 1000); perf.work.push(work); if (perf.frames.length > 600) { perf.frames.shift(); perf.work.shift(); }
  autoQuality(dt);
}
function autoQuality(dt) {
  if (save.quality !== 'auto' || TEST || !world || screen !== 'fly' || paused) return;
  if (dt > 0.0205) slow++; else slow = Math.max(0, slow - 0.5);
  if (dt < 0.0125) fast++; else fast = 0;
  if (slow > 90 && rt < 3) { rt++; slow = 0; applyQuality(); if (rt >= 2) { const i = ORDER.indexOf(autoTier); if (i > 0) autoTier = ORDER[i - 1]; } }
  if (fast > 900 && rt > 0 && !upgraded) { rt--; upgraded = true; fast = 0; applyQuality(); if (rt === 0) buildComposer(); }
}
applyQuality();
go('menu');
requestAnimationFrame(loop);

/* ------------------------------------------------------------ test hook */
const stat = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return { avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2), p50: +s[s.length >> 1].toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), max: +s[s.length - 1].toFixed(2), n: a.length }; };
window.GAME = {
  MISSIONS, save, get world() { return world; }, get screen() { return screen; },
  async start(n, o = {}) { await openMission(n, { skipBrief: o.brief !== true, tierName: o.tier }); if (o.cam) { world.camMode = o.cam; } return this.state(); },
  input(o) { Object.assign(testInput, { active: true, auto: false, pitch: 0, roll: 0, yaw: 0, ab: false, brake: false, gun: false, bomb: false, missile: false, flare: false }, o); },
  release() { testInput.active = false; testInput.auto = false; },
  auto(on = true) { Object.assign(testInput, { active: on, auto: on }); },
  god(on = true, noCrash = on) { world.god = on; world.noCrash = noCrash; },
  sim(sec, frameEvery = 6) {
    const steps = Math.round(sec / STEP);
    for (let i = 0; i < steps; i++) {
      const inp = readInput(STEP); world.step(inp);
      if (i % frameEvery === 0) { world.frame(STEP * frameEvery, innerWidth / innerHeight, inp); handleEvents(); updateHudDom(STEP * frameEvery); }
      if (resultsAt > 0) { resultsAt -= STEP; if (resultsAt <= 0) { showResults(); break; } }
    }
    world && world.frame(STEP, innerWidth / innerHeight, {}); handleEvents();
    return this.state();
  },
  /* place the jet `dist` metres from a target (or point), `alt` above it, flying at it */
  warpTo(tag, dist = 1500, alt = 300, speed = 180) {
    const W = world, t = typeof tag === 'object' ? tag : W.targets.find(x => x.alive && (x.tag === tag || x.type === tag));
    if (!t) return null;
    const a = Math.atan2(t.pos.x - W.player.pos.x, t.pos.z - W.player.pos.z);
    const x = t.pos.x - Math.sin(a) * dist, z = t.pos.z - Math.cos(a) * dist, y = Math.max(t.pos.y + alt, W.terrain.ground(x, z) + 120);
    return this.warp(x, y, z, Math.atan2(-(t.pos.x - x), -(t.pos.z - z)), speed, Math.atan2(t.pos.y + t.cy - y, dist) * 0.9);
  },
  warp(x, y, z, yaw = 0, speed = 180, pitch = 0) {
    const P = world.player; P.pos.set(x, y, z);
    P.quat.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')); P.vel.set(0, 0, -1).applyQuaternion(P.quat).multiplyScalar(speed); P.speed = speed; P.rp = P.rr = 0;
    world.camQ.copy(P.quat); return this.state();
  },
  kill(tag) { for (const t of world.targets) if (t.alive && (tag == null || t.tag === tag)) world.destroy(t); for (const f of world.fighters) if (f.alive && (tag == null || tag === 'jets')) world.destroy(f); if (tag === 'jets' || tag == null) { const o = world.objectives.find(o => o.tag === 'jets'); if (o) world.jetKills = Math.max(world.jetKills || 0, o.total); } },
  spawnFighters(n = 1) { for (let i = 0; i < n; i++) { const P = world.player.pos; world.spawnFighter(P.x + 900 + i * 80, P.y + 100, P.z - 1200); } },
  cam(m) { world.camMode = m; },
  lookAt(t, dist = 260, h = 90, yaw = 0.8, fov = 55) { const p = t.pos || t; world.camOverride = { pos: new THREE.Vector3(p.x + Math.sin(yaw) * dist, Math.max(p.y + h, world.terrain.ground(p.x + Math.sin(yaw) * dist, p.z + Math.cos(yaw) * dist) + 20), p.z + Math.cos(yaw) * dist), look: new THREE.Vector3(p.x, p.y + 12, p.z), fov }; },
  freeCam() { world.camOverride = null; },
  frame() { world.frame(1 / 60, innerWidth / innerHeight, {}); if (composer) composer.render(); else renderer.render(world.scene, world.camera); hud.draw(world, 1 / 60); updateHudDom(1 / 60); },
  state() {
    if (!world) return { screen, unlocked: save.unlocked };
    const W = world, P = W.player;
    return { screen, phase: W.phase, t: +W.time.toFixed(1), alive: P.alive, hp: Math.round(P.hp), pos: [Math.round(P.pos.x), Math.round(P.pos.y), Math.round(P.pos.z)], agl: Math.round(P.agl || 0), kts: Math.round(P.speed * 1.944), ammo: { ...W.ammo }, score: W.score, kills: W.kills,
      objectives: W.objectives.map(o => `${o.label} ${o.done}/${o.total}${o.complete ? ' ✓' : ''}`), result: W.result, final: W.final ? { total: W.final.total, stars: W.final.stars } : null, unlocked: save.unlocked,
      targets: W.targets.length, tAlive: W.targets.filter(t => t.alive).length, fighters: W.fighters.filter(f => f.alive).length, tier: W.tier.name, rt, buildMs: W.buildMs, lock: W.lock.locked, warn: W.warn };
  },
  perf() { return { frame: stat(perf.frames), work: stat(perf.work) }; },
  perfReset(sync = false) { perf.frames.length = 0; perf.work.length = 0; perf.sync = sync; },
  go, showResults, pause, resetSave() { localStorage.removeItem(SAVE); Object.assign(save, loadSave()); }
};

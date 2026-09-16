/* Demon Fall — boot, menus and the HUD the game talks to. */
import { Game, LEVELS } from './game.js';
import { fmtTime, clamp, makeRng } from './util.js';
import * as audio from './audio.js';

const $ = id => document.getElementById(id);
const SAVE = 'demonFall.v1';

/* ------------------------------------------------------------- progress */
function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE) || '{}');
    return { unlocked: raw.unlocked || 1, best: raw.best || {}, finished: !!raw.finished };
  } catch (e) {
    return { unlocked: 1, best: {}, finished: false };
  }
}
function store(s) {
  try { localStorage.setItem(SAVE, JSON.stringify(s)); } catch (e) { /* private mode */ }
}
const save = loadSave();

/* -------------------------------------------------------- compass tape */
const PX_PER_DEG = 3;
(function buildCompass() {
  const tape = $('compassTape');
  const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  let html = '';
  for (let d = -540; d <= 540; d += 15) {
    const x = d * PX_PER_DEG;
    const n = ((d % 360) + 360) % 360;
    if (names[n] !== undefined) html += `<span class="${n % 90 === 0 ? 'card' : ''}" style="left:${x}px">${names[n]}</span>`;
    else html += `<i style="left:${x}px"></i>`;
  }
  tape.innerHTML = html;
})();
const wrapDeg = d => ((d + 540) % 360) - 180;

/* ------------------------------------------------------------------ HUD */
let lastAmmoKey = '';
const hud = {
  banner(num, name, objective) {
    $('bnrNum').textContent = 'STAGE ' + String(num).padStart(2, '0');
    $('bnrName').textContent = name;
    $('bnrObj').textContent = objective;
    const el = $('banner');
    el.hidden = false;
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
    clearTimeout(this._bnrT);
    this._bnrT = setTimeout(() => { el.hidden = true; }, 4100);
  },

  stage(num, name) { $('stageName').textContent = 'Stage ' + num + ' · ' + name; },

  objective(text) {
    const el = $('objective');
    const html = text.replace(/(\d+\/\d+|\d+:\d\d)/, '<b>$1</b>');
    if (el.innerHTML !== html) el.innerHTML = html;
  },

  objProgress(frac) {
    $('objProgress').hidden = frac == null;
    if (frac != null) $('objFill').style.width = (clamp(frac, 0, 1) * 100).toFixed(1) + '%';
  },

  subtitle(text) {
    const el = $('subtitle');
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(this._subT);
    this._subT = setTimeout(() => el.classList.remove('on'), 3200);
  },

  vitals(player) {
    const hp = Math.max(0, Math.round(player.hp)), ar = Math.round(player.armour), st = Math.round(player.stamina);
    $('hpFill').style.transform = 'scaleX(' + clamp(player.hp / player.maxHp, 0, 1) + ')';
    $('armFill').style.transform = 'scaleX(' + clamp(player.armour / player.maxArmour, 0, 1) + ')';
    $('stamFill').style.transform = 'scaleX(' + clamp(player.stamina / 100, 0, 1) + ')';
    if ($('hpNum').textContent !== String(hp)) $('hpNum').textContent = hp;
    if ($('armNum').textContent !== String(ar)) $('armNum').textContent = ar;
    if ($('stamNum').textContent !== String(st)) $('stamNum').textContent = st;
    $('vitals').classList.toggle('low', player.hp < 35);
  },

  ammo(weapon) {
    if (!weapon) return;
    const key = weapon.key + weapon.ammo + '/' + weapon.reserve + (weapon.isReloading ? 'r' : '');
    if (key === lastAmmoKey) return;
    lastAmmoKey = key;
    $('wepName').textContent = weapon.spec.name;
    $('ammoNum').textContent = weapon.isReloading ? '··' : weapon.ammo;
    $('ammoRes').textContent = '/ ' + weapon.reserve;
    $('ammoRow').classList.toggle('empty', weapon.ammo === 0);
    // one pip per round, capped so big magazines stay tidy
    const mag = weapon.spec.mag, per = Math.ceil(mag / 30);
    const pips = Math.ceil(mag / per), full = Math.ceil(weapon.ammo / per);
    let html = '';
    for (let i = 0; i < pips; i++) html += i < full ? '<i></i>' : '<i class="spent"></i>';
    $('magPips').innerHTML = html;
    $('reloadHint').classList.toggle('on', weapon.ammo === 0 && weapon.reserve > 0 && !weapon.isReloading);
  },

  slots(owned, current) {
    document.querySelectorAll('#slots span').forEach(s => {
      s.classList.toggle('on', s.dataset.w === current);
      s.classList.toggle('locked', !owned.includes(s.dataset.w));
    });
    lastAmmoKey = '';
  },

  compass(yaw, target, from) {
    const heading = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
    $('compassTape').style.transform = 'translateX(' + (-heading * PX_PER_DEG).toFixed(1) + 'px)';
    const mark = $('compassMark');
    if (!target || !from) { mark.classList.add('off'); $('objDist').textContent = ''; return; }
    const dx = target.x - from.x, dz = target.z - from.z;
    const bearing = Math.atan2(dx, -dz) * 180 / Math.PI;
    const rel = wrapDeg(bearing - heading);
    const strip = $('compassStrip').clientWidth;
    const x = clamp(rel * PX_PER_DEG, -strip / 2 + 8, strip / 2 - 8);
    mark.style.left = 'calc(50% + ' + x.toFixed(1) + 'px)';
    mark.classList.remove('off');
    mark.style.opacity = Math.abs(rel) * PX_PER_DEG > strip / 2 ? 0.45 : 1;
    $('objDist').textContent = Math.round(Math.hypot(dx, dz)) + ' m';
  },

  threat(alive) {
    const el = $('threat');
    const text = alive > 0 ? alive + (alive === 1 ? ' HOSTILE' : ' HOSTILES') : 'AREA CLEAR';
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle('clear', alive === 0);
  },

  feed(text, cls = '') {
    const el = document.createElement('div');
    el.textContent = text;
    if (cls) el.className = cls;
    const feed = $('killfeed');
    feed.appendChild(el);
    while (feed.children.length > 5) feed.removeChild(feed.firstChild);
    setTimeout(() => el.remove(), 2700);
  },

  hitmark(kill) {
    const el = $('hitmark');
    el.classList.toggle('kill', !!kill);
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    $('cross').classList.add('hot');
    clearTimeout(this._hotT);
    this._hotT = setTimeout(() => $('cross').classList.remove('hot'), 120);
  },

  crosshair(spread) {
    const g = (4 + spread).toFixed(1);
    $('chL').style.transform = 'translate(' + (-9 - g) + 'px,0)';
    $('chR').style.transform = 'translate(' + g + 'px,0)';
    $('chT').style.transform = 'translate(0,' + (-9 - g) + 'px)';
    $('chB').style.transform = 'translate(0,' + g + 'px)';
  },

  damage() {
    const el = $('dmg');
    el.style.opacity = 0.75;
    clearTimeout(this._dmgT);
    this._dmgT = setTimeout(() => { el.style.opacity = 0; }, 90);
  },

  /** relDeg: where the hit came from, relative to where you face (0 = ahead). */
  damageFrom(relDeg) {
    const arc = document.createElement('div');
    arc.className = 'dmgArc';
    arc.style.transform = 'rotate(' + relDeg.toFixed(0) + 'deg)';
    $('dmgDirs').appendChild(arc);
    setTimeout(() => arc.remove(), 1000);
  },

  showBoss(name) {
    $('bossName').textContent = name;
    $('bossFill').style.width = '100%';
    $('bossBar').hidden = false;
    this.subtitle(name + ' awakens');
  },
  bossHp(frac) { $('bossFill').style.width = (clamp(frac, 0, 1) * 100).toFixed(1) + '%'; },
  hideBoss() { $('bossBar').hidden = true; },

  marsMode(on) {
    document.body.classList.toggle('mars', on);
    if (on) { $('bossBar').hidden = true; this.objProgress(0); }
  },

  marsHud(flight) {
    $('hpFill').style.transform = 'scaleX(' + clamp(flight.hull / 100, 0, 1) + ')';
    $('hpNum').textContent = Math.round(flight.hull);
    $('vitals').classList.toggle('low', flight.hull < 35);
    this.objProgress(flight.progress);
    this.threat(0);
    $('threat').textContent = 'DEBRIS DOWN ' + flight.destroyed;
    $('objDist').textContent = flight.phase === 'landing' ? 'TOUCHDOWN' : 'MARS ' + Math.round(flight.progress * 100) + '%';
  },

  died(reason) {
    $('deadSub').textContent = reason || 'The horde takes the city.';
    show('dead');
  },

  levelCleared(summary) {
    $('clearTitle').textContent = summary.final ? 'Welcome to Mars' : 'Stage Clear';
    $('clearSub').textContent = summary.final ? 'You made it off Earth' : 'Stage ' + (summary.level + 1) + ' · ' + summary.name;
    $('stTime').textContent = summary.timeText;
    $('stKills').textContent = summary.kills;
    $('stHead').textContent = summary.headshots;
    $('stAcc').textContent = summary.accuracy + '%';
    $('clearScore').textContent = summary.score.toLocaleString() + ' POINTS';
    $('clearExtra').hidden = !summary.mars;
    if (summary.mars) $('clearExtra').textContent = `Flight: ${summary.mars.destroyed} rocks destroyed · hull ${summary.mars.hull}%`;
    $('nextLabel').textContent = summary.final ? 'Play again' : 'Next stage';

    const best = save.best[summary.level];
    if (!best || summary.score > best.score) save.best[summary.level] = { score: summary.score, time: summary.time };
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, summary.level + 2));
    if (summary.final) save.finished = true;
    store(save);
    refreshMenu();
    show('cleared');
  },

  pause(on, levelName) {
    if (on) { $('pauseSub').textContent = levelName; show('pause'); }
    else show(null);
  },

  lockHint(on) { $('lockHint').hidden = !on; },

  fps(v) {
    const el = $('fps');
    this._fpsAcc = (this._fpsAcc || 0) * 0.94 + v * 0.06;
    if (!el.hidden) el.textContent = Math.round(this._fpsAcc) + ' fps';
  }
};

/* --------------------------------------------------------------- screens */
const SCREENS = ['menu', 'levelScreen', 'pause', 'dead', 'cleared', 'ready'];
function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  $('hud').hidden = id !== null;
  $('homeLink').hidden = id !== 'menu' && id !== 'levelScreen';
  if (id) $('dmg').style.opacity = 0;
}

/* ------------------------------------------------------------------ boot */
const game = new Game(hud);
window.DF = game;                      // handy for poking at from the console

/** A small painted skyline for each stage card, in that stage's colours. */
function stageArt(lv, i) {
  const t = lv.theme, rng = makeRng(i * 131 + 7);
  const hex = n => '#' + n.toString(16).padStart(6, '0');
  let sky = '';
  let x = 0;
  const base = i === 2 || i === 4 ? 150 : 138;
  while (x < 320) {
    const w = rng.range(12, 30), h = rng.range(20, i === 1 ? 90 : 55);
    sky += `M${x.toFixed(0)} ${base}V${(base - h).toFixed(0)}H${(x + w).toFixed(0)}V${base}Z`;
    x += w + rng.range(0, 4);
  }
  let windows = '';
  for (let k = 0; k < 40; k++) windows += `<rect x="${rng.range(0, 318).toFixed(0)}" y="${rng.range(base - 60, base - 6).toFixed(0)}" width="1.6" height="2.4" fill="#ffb05a" opacity="${rng.range(.2, .8).toFixed(2)}"/>`;
  const rift = t.rift ? `<circle cx="210" cy="46" r="34" fill="url(#g${i})"/><circle cx="210" cy="46" r="10" fill="none" stroke="#ffcf9a" stroke-width="1.6" stroke-dasharray="7 3 2 4"/>` : '';
  const extra = [
    '<path d="M0 150 L320 150 L320 200 L0 200Z" fill="#141018"/><path d="M150 150 L170 150 L200 200 L120 200Z" fill="#26222c"/>',
    '<rect x="140" y="120" width="40" height="30" fill="#0c0808"/>',
    '<rect x="0" y="60" width="320" height="10" fill="#0a0a10"/><rect x="0" y="150" width="320" height="50" fill="#0e0e14"/><rect x="100" y="150" width="4" height="50" fill="#5a3a30"/><rect x="216" y="150" width="4" height="50" fill="#5a3a30"/>',
    '<path d="M130 150 V80 L160 50 L190 80 V150Z" fill="#0c0810"/><circle cx="160" cy="95" r="12" fill="#6a5aff" opacity=".7"/>',
    '<circle cx="160" cy="110" r="36" fill="none" stroke="#c89020" stroke-width="7"/><circle cx="160" cy="110" r="14" fill="#6ae0ff" opacity=".85"/>',
    '<path d="M154 150 L156 70 L160 56 L164 70 L166 150Z" fill="#cfd6de"/><ellipse cx="160" cy="156" rx="10" ry="16" fill="#ffb040" opacity=".8"/><circle cx="286" cy="34" r="14" fill="#c84a22"/>'
  ][i] || '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="s${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hex(t.skyTop)}"/><stop offset=".7" stop-color="${hex(t.skyHorizon)}"/><stop offset="1" stop-color="${hex(t.skyGlow || t.skyHorizon)}"/></linearGradient>
    <radialGradient id="g${i}"><stop offset="0" stop-color="#ffb070"/><stop offset=".3" stop-color="#ff4a3c" stop-opacity=".8"/><stop offset="1" stop-color="#a0102a" stop-opacity="0"/></radialGradient></defs>
    <rect width="320" height="200" fill="url(#s${i})"/>${rift}<path d="${sky}" fill="#0b070b"/>${windows}${extra}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") center/cover`;
}

function buildLevelList() {
  const box = $('levels');
  box.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const open = i < save.unlocked;
    const best = save.best[i];
    const el = document.createElement('button');
    el.className = 'lv' + (open ? '' : ' locked');
    el.style.setProperty('--art', stageArt(lv, i));
    el.innerHTML =
      '<div class="num">' + String(i + 1).padStart(2, '0') + '</div>' +
      (best ? '<div class="badge done">★ ' + best.score.toLocaleString() + '</div>'
            : open ? '' : '<div class="badge">LOCKED</div>') +
      '<div class="t">' + lv.name + '</div>' +
      '<div class="d">' + lv.brief + '</div>';
    if (open) el.onclick = () => startLevel(i);
    box.appendChild(el);
  });
}

function refreshMenu() {
  const next = Math.min(save.unlocked, LEVELS.length) - 1;
  $('playLabel').textContent = save.unlocked > 1 ? 'Continue' : 'Start campaign';
  $('playSub').textContent = 'Stage ' + (next + 1) + ' · ' + LEVELS[next].name;
  $('stagesSub').textContent = Math.min(save.unlocked, LEVELS.length) + ' / ' + LEVELS.length;
}

/**
 * Build the level behind a loading screen, then wait on a "click to play"
 * card. The mouse is captured by that click and nothing heavy runs after it —
 * the same flow NYC Walk uses.
 */
function runLevel(build) {
  audio.unlock();
  show(null);
  $('hud').hidden = true;
  $('loadText').textContent = 'Loading';
  $('loadFill').style.transform = 'scaleX(.35)';
  $('loading').hidden = false;
  setTimeout(() => {
    build();
    $('loadFill').style.transform = 'scaleX(1)';
    $('loading').hidden = true;
    const lv = LEVELS[game.levelIndex];
    $('readyNum').textContent = 'Stage ' + (game.levelIndex + 1) + ' of ' + LEVELS.length;
    $('readyName').textContent = lv.name;
    $('readyObj').textContent = lv.brief;
    hud.stage(game.levelIndex + 1, lv.name);
    game.ready();
    show('ready');
  }, 40);
}

function startLevel(i) { runLevel(() => game.loadLevel(i)); }

$('ready').addEventListener('click', () => {
  game.lock();          // first, while this click is still fresh
  show(null);
  game.start();
});

$('playBtn').onclick = () => startLevel(Math.min(save.unlocked, LEVELS.length) - 1);
$('levelsBtn').onclick = () => { audio.unlock(); buildLevelList(); show('levelScreen'); };
$('backBtn').onclick = () => show('menu');
$('resumeBtn').onclick = () => game.resume();
$('restartBtn').onclick = () => runLevel(() => game.restart(true));
$('quitBtn').onclick = () => toMenu();
$('retryBtn').onclick = () => runLevel(() => game.restart(true));
$('deadMenuBtn').onclick = () => toMenu();
$('clearMenuBtn').onclick = () => toMenu();
$('nextBtn').onclick = () => {
  const next = game.levelIndex + 1;
  if (next >= LEVELS.length) { toMenu(); return; }
  runLevel(() => game.loadLevel(next, true));
};

function toMenu() {
  game.quitToMenu();
  refreshMenu();
  game.menuBackdrop();
  show('menu');
}

addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    // Esc only pauses; resuming takes a click so the mouse can be captured
    if (game.state === 'playing' || game.state === 'mars') game.pause();
    else if (!$('levelScreen').hidden) show('menu');
  }
  if (e.code === 'F3') $('fps').hidden = !$('fps').hidden;
});

// clicking the frozen world resumes from the pause screen
addEventListener('mousedown', e => {
  if (game.state === 'paused' && e.target === game.renderer.domElement) game.resume();
});

// first paint: build the menu backdrop, then reveal the menu
refreshMenu();
requestAnimationFrame(() => {
  $('loadFill').style.transform = 'scaleX(.6)';
  setTimeout(() => {
    game.menuBackdrop();
    $('loadFill').style.transform = 'scaleX(1)';
    $('loading').hidden = true;
    // ?level=3 drops straight into a stage; anything else shows the menu
    const want = parseInt(new URLSearchParams(location.search).get('level'), 10);
    if (want >= 1 && want <= LEVELS.length) startLevel(want - 1);
    else show('menu');
  }, 60);
});

/* Demon Fall — boot, menus and the HUD the game talks to. */
import { Game, LEVELS } from './game.js';
import { fmtTime, clamp } from './util.js';
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
function store(save) {
  try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch (e) { /* private mode */ }
}
let save = loadSave();

/* ------------------------------------------------------------------ HUD */
const hud = {
  bossShown: false,

  banner(num, name, objective) {
    $('bnrNum').textContent = 'Stage ' + num;
    $('bnrName').textContent = name;
    $('bnrObj').textContent = objective;
    const el = $('banner');
    el.hidden = false;
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
    setTimeout(() => { el.hidden = true; }, 3900);
  },

  objective(text) { $('objective').innerHTML = text.replace(/(\d+\/\d+|\d+:\d\d)/, '<b>$1</b>'); },

  subtitle(text) {
    const el = $('subtitle');
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(this._subT);
    this._subT = setTimeout(() => el.classList.remove('on'), 3400);
  },

  vitals(player) {
    $('hpFill').style.transform = 'scaleX(' + clamp(player.hp / player.maxHp, 0, 1) + ')';
    $('armFill').style.transform = 'scaleX(' + clamp(player.armour / player.maxArmour, 0, 1) + ')';
    $('stamFill').style.transform = 'scaleX(' + clamp(player.stamina / 100, 0, 1) + ')';
    $('hpBar').classList.toggle('low', player.hp < 35);
  },

  ammo(weapon) {
    if (!weapon) return;
    $('ammoNum').innerHTML = weapon.ammo + '<small> / ' + weapon.reserve + '</small>';
    $('wepName').textContent = weapon.spec.name;
    $('reloadHint').classList.toggle('on', weapon.ammo === 0 && weapon.reserve > 0);
  },

  compass(yaw, target, from) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(((-yaw % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 4)) % 8;
    let text = dirs[idx];
    if (target && from) {
      const dx = target.x - from.x, dz = target.z - from.z;
      const dist = Math.hypot(dx, dz);
      const rel = Math.atan2(dx, dz) - (yaw + Math.PI);
      const deg = ((rel * 180 / Math.PI) % 360 + 360) % 360;
      const arrow = deg > 315 || deg < 45 ? '↑' : deg < 135 ? '→' : deg < 225 ? '↓' : '←';
      text += '   ' + arrow + ' ' + Math.round(dist) + 'm';
    }
    $('compass').textContent = text;
  },

  threat(alive) {
    $('threat').textContent = alive > 0 ? 'HOSTILES ' + alive : '';
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
  },

  damage() {
    const el = $('dmg');
    el.style.opacity = 0.85;
    clearTimeout(this._dmgT);
    this._dmgT = setTimeout(() => { el.style.opacity = 0; }, 90);
  },

  showBoss(name) {
    this.bossShown = true;
    this.subtitle(name.toUpperCase());
    $('threat').style.color = '#ff7a2f';
  },
  bossHp(frac) {
    $('threat').textContent = 'WARDEN  ' + Math.ceil(frac * 100) + '%';
  },
  hideBoss() {
    this.bossShown = false;
    $('threat').style.color = '';
  },

  marsMode(on) {
    $('ammoBox').hidden = on;
    $('cross').style.opacity = on ? 0.6 : 1;
    document.body.classList.toggle('mars', on);
  },

  marsHud(flight) {
    $('hpFill').style.transform = 'scaleX(' + clamp(flight.hull / 100, 0, 1) + ')';
    $('hpBar').classList.toggle('low', flight.hull < 35);
    $('armFill').style.transform = 'scaleX(' + flight.progress + ')';
    $('stamFill').style.transform = 'scaleX(1)';
    $('threat').textContent = 'DEBRIS DOWN ' + flight.destroyed;
    $('compass').textContent = flight.phase === 'landing' ? 'TOUCHDOWN' : 'MARS  ' + Math.round(flight.progress * 100) + '%';
  },

  died(reason) {
    $('deadSub').textContent = reason || 'The horde takes the city';
    show('dead');
  },

  levelCleared(summary) {
    const lastLevel = summary.level >= LEVELS.length - 1;
    $('clearTitle').textContent = summary.final ? 'Mars' : 'Stage Clear';
    $('clearSub').textContent = summary.final ? 'You made it off Earth' : summary.name;
    let text = `Time ${summary.timeText} · ${summary.kills} kills · ${summary.headshots} headshots · ${summary.accuracy}% accuracy · ${summary.score.toLocaleString()} points`;
    if (summary.mars) {
      text += `\nFlight: ${summary.mars.destroyed} rocks destroyed, hull ${summary.mars.hull}%`;
    }
    $('clearStats').textContent = text;
    $('nextBtn').textContent = summary.final ? 'Play again' : 'Next stage';

    // save progress
    const best = save.best[summary.level];
    if (!best || summary.score > best.score) save.best[summary.level] = { score: summary.score, time: summary.time };
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, summary.level + 2));
    if (summary.final) save.finished = true;
    store(save);

    show('cleared');
  },

  lockHint(on) { $('lockHint').hidden = !on; },

  pause(on, levelName) {
    if (on) { $('pauseSub').textContent = levelName; show('pause'); }
    else show(null);
  },

  fps(v) {
    if (!this._fpsEl) this._fpsEl = $('fps');
    this._fpsAcc = (this._fpsAcc || 0) * 0.94 + v * 0.06;
    if (!this._fpsEl.hidden) this._fpsEl.textContent = Math.round(this._fpsAcc) + ' fps';
  }
};

/* --------------------------------------------------------------- screens */
const SCREENS = ['menu', 'levelScreen', 'pause', 'dead', 'cleared', 'ready'];
function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  $('hud').hidden = id !== null;
  $('homeLink').hidden = id === null;
  if (id) $('dmg').style.opacity = 0;
}

/* ------------------------------------------------------------------ boot */
const game = new Game(hud);
window.DF = game;                      // handy for poking at from the console

function buildLevelList() {
  const box = $('levels');
  box.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const open = i < save.unlocked;
    const best = save.best[i];
    const el = document.createElement('button');
    el.className = 'lv' + (open ? '' : ' locked') + (best ? ' done' : '');
    el.innerHTML =
      '<div class="n">Stage ' + (i + 1) + '</div>' +
      '<div class="t">' + lv.name + '</div>' +
      '<div class="d">' + lv.brief + '</div>' +
      (best ? '<div class="best">BEST ' + best.score.toLocaleString() + ' · ' + fmtTime(best.time) + '</div>' : '') +
      (open ? '' : '<div class="lock">🔒</div>');
    if (open) el.onclick = () => startLevel(i);
    box.appendChild(el);
  });
}

/**
 * Build the level behind a loading screen, then wait on a "click to play"
 * card. The mouse is captured by that click and nothing heavy runs after it —
 * the same flow NYC Walk uses. (Asking for capture before a long build lets the
 * browser refuse it or drop it a moment later.)
 */
function runLevel(build) {
  audio.unlock();
  show(null);
  $('hud').hidden = true;
  $('loadText').textContent = 'Loading…';
  $('loading').hidden = false;
  setTimeout(() => {
    build();
    $('loading').hidden = true;
    const lv = LEVELS[game.levelIndex];
    $('readyNum').textContent = 'Stage ' + (game.levelIndex + 1);
    $('readyName').textContent = lv.name;
    $('readyObj').textContent = lv.brief;
    game.ready();
    show('ready');
  }, 30);
}

$('ready').addEventListener('click', () => {
  game.lock();          // first, while this click is still fresh
  show(null);
  game.start();
});

function startLevel(i) {
  runLevel(() => game.loadLevel(i));
}

$('playBtn').onclick = () => startLevel(Math.min(save.unlocked - 1, LEVELS.length - 1));
$('levelsBtn').onclick = () => { audio.unlock(); buildLevelList(); show('levelScreen'); };
$('backBtn').onclick = () => show('menu');
$('resumeBtn').onclick = () => game.resume();
$('restartBtn').onclick = () => runLevel(() => game.restart(true));
$('quitBtn').onclick = () => { game.quitToMenu(); show('menu'); };
$('retryBtn').onclick = () => runLevel(() => game.restart(true));
$('deadMenuBtn').onclick = () => { game.quitToMenu(); show('menu'); };
$('clearMenuBtn').onclick = () => { game.quitToMenu(); buildLevelList(); show('menu'); };
$('nextBtn').onclick = () => {
  const next = game.levelIndex + 1;
  if (next >= LEVELS.length) { game.quitToMenu(); buildLevelList(); show('menu'); return; }
  runLevel(() => game.loadLevel(next, true));
};

addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    // Esc only pauses; resuming takes a click so the mouse can be captured
    if (game.state === 'playing' || game.state === 'mars') game.pause();
  }
  if (e.code === 'F3') { $('fps').hidden = !$('fps').hidden; }
});

// clicking the frozen world resumes from the pause screen
addEventListener('mousedown', e => {
  if (game.state === 'paused' && e.target === game.renderer.domElement) game.resume();
});

// first paint: hide the loading screen once the first frame is on screen
requestAnimationFrame(() => {
  $('loadFill').style.transform = 'scaleX(1)';
  setTimeout(() => {
    $('loading').hidden = true;
    // ?level=3 drops straight into a stage, handy for picking up where you left
    // off and for testing; anything out of range just shows the menu
    const want = parseInt(new URLSearchParams(location.search).get('level'), 10);
    if (want >= 1 && want <= LEVELS.length) startLevel(want - 1);
    else show('menu');
  }, 260);
});

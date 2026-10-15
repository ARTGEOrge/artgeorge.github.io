/* Demon Fall — boot, menus and the HUD the game talks to. */
import { Game, LEVELS, WORLDS, worldOf } from './game.js';
import { fmtTime, clamp, makeRng } from './util.js';
import * as audio from './audio.js';

// Played from a disc or folder (e.g. through Aria) there is no site to go home to.
const OFFSITE = !location.pathname.includes('/demon-fall/');

const $ = id => document.getElementById(id);
const SAVE = 'demonFall.v1';

/* ------------------------------------------------------------- progress
 * Same key and shape as ever: { unlocked, best, finished } plus `won`.
 * `finished` has always meant "flew off Earth"; saves from before Mars existed
 * stop at unlocked 6, so a finished save opens Mars 1 (stage 7) for them. */
function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE) || '{}');
    const s = { unlocked: raw.unlocked || 1, best: raw.best || {}, finished: !!raw.finished, won: !!raw.won };
    if (s.finished) s.unlocked = Math.max(s.unlocked, 7);
    s.unlocked = Math.min(Math.max(1, s.unlocked | 0), LEVELS.length);
    return s;
  } catch (e) {
    return { unlocked: 1, best: {}, finished: false, won: false };
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
    $('bnrNum').textContent = worldOf(num - 1).name.toUpperCase() + ' · STAGE ' + String(num).padStart(2, '0');
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
    $('objDist').textContent = flight.phase === 'landing' ? 'TOUCHDOWN' : (flight.destName || 'MARS') + ' ' + Math.round(flight.progress * 100) + '%';
  },

  died(reason) {
    const w = worldOf(game.levelIndex).key;
    $('deadSub').textContent = reason || (w === 'mars' ? 'The colony takes another colonist.' : w === 'moon' ? 'Another body for the Hive.' : 'The horde takes the city.');
    show('dead');
  },

  levelCleared(summary) {
    const toMoon = summary.flight === 'moon';
    $('clearTitle').textContent = summary.victory ? 'Humanity Endures' : summary.final ? (toMoon ? 'Moonfall' : 'Welcome to Mars') : 'Stage Clear';
    $('clearSub').textContent = summary.victory ? 'Earth, Mars, the Moon — the war is over'
      : summary.final ? (toMoon ? 'Mars is behind you. The Moon is worse.' : 'You made it off Earth')
      : worldOf(summary.level).name + ' · Stage ' + (summary.level + 1) + ' · ' + summary.name;
    $('stTime').textContent = summary.timeText;
    $('stKills').textContent = summary.kills;
    $('stHead').textContent = summary.headshots;
    $('stAcc').textContent = summary.accuracy + '%';
    $('clearScore').textContent = summary.score.toLocaleString() + ' POINTS';
    $('clearExtra').hidden = !summary.mars;
    if (summary.mars) $('clearExtra').textContent = `Flight: ${summary.mars.destroyed} rocks destroyed · hull ${summary.mars.hull}%`;
    $('nextLabel').textContent = summary.victory ? 'Main menu' : summary.final ? (toMoon ? 'On to the Moon' : 'On to Mars') : 'Next stage';

    const best = save.best[summary.level];
    if (!best || summary.score > best.score) save.best[summary.level] = { score: summary.score, time: summary.time };
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, summary.level + 2));
    if (summary.final || summary.level >= 5) save.finished = true;
    if (summary.victory) save.won = true;
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
  $('homeLink').hidden = OFFSITE || (id !== 'menu' && id !== 'levelScreen');
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

/** Card art for Mars (dunes, domes, a pink dusk) and the Moon (black sky, Earth up high). */
function spaceArt(lv, i) {
  const t = lv.theme, rng = makeRng(i * 977 + 3);
  const hex = n => '#' + n.toString(16).padStart(6, '0');
  const moon = lv.world === 'moon';
  let stars = '';
  for (let k = 0; k < (moon ? 70 : 24); k++) stars += `<circle cx="${rng.range(0, 320).toFixed(0)}" cy="${rng.range(0, 110).toFixed(0)}" r="${rng.range(0.3, 1.1).toFixed(1)}" fill="#fff" opacity="${rng.range(0.3, 0.9).toFixed(2)}"/>`;
  let ridge = 'M0 200 L0 ' + (moon ? 150 : 140);
  for (let x = 0; x <= 320; x += 20) ridge += ` L${x} ${(moon ? 146 : 132) + rng.range(-10, 10)}`;
  ridge += ' L320 200Z';
  const ground = moon ? '#5a5a62' : '#7a3424', far = moon ? '#2a2a30' : '#4a1e18';
  let far2 = 'M0 200 L0 128';
  for (let x = 0; x <= 320; x += 32) far2 += ` L${x} ${(moon ? 132 : 112) + rng.range(-14, 6)}`;
  far2 += ' L320 200Z';
  const sky = moon ? `<circle cx="250" cy="44" r="22" fill="#3a6ac8"/><path d="M236 36 q8 -6 16 0 t10 10" stroke="#5aa04a" stroke-width="5" fill="none"/><circle cx="250" cy="44" r="25" fill="none" stroke="#7ab0ff" stroke-opacity=".4" stroke-width="3"/>`
    : `<circle cx="70" cy="${92 + (i % 3) * 6}" r="6" fill="#dfe8ff" opacity=".9"/><circle cx="250" cy="40" r="5" fill="#8a6a5a"/>`;
  const extra = {
    6: '<path d="M60 150 L64 96 L68 150Z" fill="#c8ccd2"/><ellipse cx="200" cy="150" rx="40" ry="22" fill="#d8d4cc"/><ellipse cx="270" cy="152" rx="24" ry="14" fill="#c8c0b4"/>',
    7: '<rect x="0" y="60" width="320" height="10" fill="#1a1a20"/><rect x="0" y="150" width="320" height="50" fill="#22222a"/><rect x="150" y="70" width="20" height="80" fill="#0a0a10"/><rect x="0" y="66" width="320" height="2" fill="#cfe4ff"/>',
    8: '<path d="M30 150 L30 90 L290 90 L290 150Z" fill="#9adcc8" opacity=".25"/><g fill="#6ac050">' + Array.from({ length: 14 }, (_, k) => `<circle cx="${30 + k * 19}" cy="140" r="8"/>`).join('') + '</g><rect x="30" y="100" width="260" height="2" fill="#e08aff"/>',
    9: '<path d="M0 200 L0 60 L110 70 L130 200Z" fill="#5a2418"/><path d="M320 200 L320 50 L210 70 L190 200Z" fill="#5a2418"/><path d="M150 150 L156 90 L164 90 L170 150Z" fill="#d8a830"/>',
    10: '<rect x="80" y="96" width="160" height="56" fill="#c8c8ce"/><rect x="92" y="108" width="136" height="16" fill="#3a7ac8" opacity=".9"/><path d="M160 96 L160 86" stroke="#ffb040" stroke-width="3"/>',
    11: '<path d="M154 150 L156 70 L160 56 L164 70 L166 150Z" fill="#cfd6de"/><ellipse cx="160" cy="156" rx="10" ry="16" fill="#ffb040" opacity=".8"/><circle cx="250" cy="40" r="9" fill="#8a6a5a"/>',
    12: '<path d="M60 150 L64 100 L68 150Z" fill="#c8ccd2"/><ellipse cx="220" cy="152" rx="44" ry="8" fill="#3a3a40"/><rect x="190" y="132" width="40" height="16" rx="8" fill="#d8d8dc"/>',
    13: '<rect x="0" y="60" width="320" height="10" fill="#14161c"/><rect x="0" y="150" width="320" height="50" fill="#1a1c22"/><circle cx="160" cy="110" r="18" fill="#3ac8ff" opacity=".5"/><rect x="0" y="66" width="320" height="2" fill="#cfe8ff"/>',
    14: '<path d="M50 150 L60 70 L70 150Z" fill="#6a90c8"/><path d="M240 150 L252 60 L264 150Z" fill="#6a90c8"/><rect x="130" y="110" width="40" height="40" rx="8" fill="#d8dce4"/>',
    15: '<rect x="40" y="128" width="90" height="26" rx="13" fill="#c8ccd2" transform="rotate(-12 85 141)"/><rect x="180" y="132" width="70" height="20" rx="10" fill="#a8acb4" transform="rotate(18 215 142)"/>',
    16: '<path d="M70 150 Q100 90 130 150Z" fill="#e8ecf0"/><path d="M200 150 Q240 80 280 150Z" fill="#e8ecf0"/><path d="M100 150 L100 120" stroke="#9aa0a8" stroke-width="3"/>',
    17: '<g fill="#5a6a8a">' + Array.from({ length: 8 }, (_, k) => `<ellipse cx="${30 + k * 38}" cy="${150 - (k % 3) * 4}" rx="${16 + (k % 2) * 8}" ry="10"/>`).join('') + '</g><g fill="#7af0ff">' + Array.from({ length: 10 }, (_, k) => `<circle cx="${20 + k * 30}" cy="${142 - (k % 2) * 6}" r="2.5"/>`).join('') + '</g>'
  }[i] || '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="s${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hex(t.skyTop)}"/><stop offset=".75" stop-color="${hex(t.skyHorizon)}"/><stop offset="1" stop-color="${hex(t.skyGlow || t.skyHorizon)}"/></linearGradient></defs>
    <rect width="320" height="200" fill="url(#s${i})"/>${stars}${sky}<path d="${far2}" fill="${far}"/><path d="${ridge}" fill="${ground}"/>${extra}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") center/cover`;
}

function buildLevelList() {
  const box = $('levels');
  box.innerHTML = '';
  for (const w of WORLDS) {
    const head = document.createElement('div');
    head.className = 'lvGroup' + (w.from < save.unlocked ? '' : ' locked');
    head.innerHTML = '<b>' + w.name + '</b><span>Stages ' + (w.from + 1) + '–' + (w.to + 1) + '</span>';
    box.appendChild(head);
    for (let i = w.from; i <= w.to; i++) {
      const lv = LEVELS[i];
      const open = i < save.unlocked;
      const best = save.best[i];
      const el = document.createElement('button');
      el.className = 'lv' + (open ? '' : ' locked');
      el.style.setProperty('--art', lv.world && lv.world !== 'earth' ? spaceArt(lv, i) : stageArt(lv, i));
      el.innerHTML =
        '<div class="num">' + String(i + 1).padStart(2, '0') + '</div>' +
        (best ? '<div class="badge done">★ ' + best.score.toLocaleString() + '</div>'
              : open ? '' : '<div class="badge">LOCKED</div>') +
        '<div class="t">' + lv.name + '</div>' +
        '<div class="d">' + lv.brief + '</div>';
      if (open) el.onclick = () => startLevel(i);
      box.appendChild(el);
    }
  }
}

function refreshMenu() {
  const next = Math.min(save.unlocked, LEVELS.length) - 1;
  $('playLabel').textContent = save.unlocked > 1 ? 'Continue' : 'Start campaign';
  $('playSub').textContent = worldOf(next).name + ' · Stage ' + (next + 1) + ' · ' + LEVELS[next].name;
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
    $('readyNum').textContent = worldOf(game.levelIndex).name + ' · Stage ' + (game.levelIndex + 1) + ' of ' + LEVELS.length;
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

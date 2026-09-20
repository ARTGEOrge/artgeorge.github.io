/**
 * Screens, the heads-up display, and the flow between cities.
 * The engine in game.js calls into `hud` here; this file owns the DOM.
 */
import { Game } from './game.js';
import { CITIES } from './cities.js';

const $ = id => document.getElementById(id);
const SCREENS = ['menu', 'cityScreen', 'ready', 'pause', 'cleared'];
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const PX_PER_DEG = 3;

function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  $('hud').hidden = id !== null;
  $('fps').hidden = id !== null;
  $('osm').hidden = id !== null;
  $('homeLink').hidden = !(id === 'menu' || id === 'cityScreen');
}

/* ------------------------------------------------------------------- HUD */
let toastTimer = 0;
let journalOpen = true;

const hud = {
  loading(p, text) {
    $('loading').hidden = false;
    $('loadFill').style.width = Math.round(p * 100) + '%';
    if (text) $('loadText').textContent = text;
    if (p >= 1) setTimeout(() => { $('loading').hidden = true; }, 220);
  },

  city(city, index, stats) {
    $('cityName').textContent = city.name;
    $('cityWhere').textContent = city.where;
    $('objective').textContent = 'Find three relics';
    $('readyNum').textContent = `City ${index + 1} of ${CITIES.length}`;
    $('readyName').textContent = city.name;
    $('readyIntro').textContent = city.intro;
    $('pauseCity').textContent = city.name;
    $('readyStats').innerHTML =
      `<div class="stat"><b>${stats.buildings.toLocaleString()}</b><span>buildings</span></div>` +
      `<div class="stat"><b>${stats.roads.toLocaleString()}</b><span>streets</span></div>` +
      `<div class="stat"><b>2 km</b><span>across</span></div>`;
  },

  relicCount(found, total) {
    const row = $('relicRow');
    [...row.children].forEach((el, i) => el.classList.toggle('on', i < found));
    $('objective').textContent = found >= total ? 'Read the map table' : 'Find three relics';
    row.parentElement.querySelector('.h').textContent = `Relics found · ${found} of ${total}`;
  },

  journal(list) {
    const box = $('journalList');
    if (!list || !list.length) {
      box.innerHTML = '<div class="none">Relics you find leave notes here.</div>';
      return;
    }
    box.innerHTML = list.map(j =>
      `<div class="j"><b>${esc(j.name)}</b><span>${esc(j.clue)}</span><br><em>Found at ${esc(j.at)}</em></div>`).join('');
  },

  found(name, clue, at) {
    const t = $('toast');
    t.querySelector('.w').textContent = `Relic found · ${at}`;
    t.querySelector('.t').textContent = name;
    t.querySelector('.c').textContent = clue;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 6500);
  },

  tableReady(label) {
    const t = $('toast');
    t.querySelector('.w').textContent = 'All three found';
    t.querySelector('.t').textContent = label;
    t.querySelector('.c').textContent = 'The map table is marked on your compass. Go and read it.';
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 7000);
  },

  resonance(heat, dist, isTable) {
    $('resFill').style.width = Math.round(heat * 100) + '%';
    $('resLabel').textContent = isTable ? 'Map table' : heat > 0.82 ? 'Very close' : heat > 0.5 ? 'Warm' : heat > 0.2 ? 'Faint' : 'Cold';
    $('objDist').textContent = dist ? `${Math.round(dist)} m` : '';
  },

  prompt(text) { $('prompt').textContent = text; },

  compass(yaw, target, from) {
    const deg = (-yaw * 180 / Math.PI + 360000) % 360;
    $('compassTape').style.transform = `translateX(${-deg * PX_PER_DEG + innerWidth * 0}px)`;
    const mark = $('compassMark');
    if (!target) { mark.classList.add('off'); return; }
    const bearing = (Math.atan2(target.x - from.x, -(target.z - from.z)) * 180 / Math.PI + 360) % 360;
    let rel = ((bearing - deg + 540) % 360) - 180;
    const strip = $('compassStrip').clientWidth;
    if (Math.abs(rel) > 92) { mark.classList.add('off'); return; }
    mark.classList.remove('off');
    mark.style.left = `${strip / 2 + rel * (strip / 210)}px`;
  },

  fps(v) { $('fps').textContent = Math.round(v) + ' fps'; },

  lockHint(on) { $('lockHint').hidden = !on; },

  pause(on) { $('pause').hidden = !on; $('hud').hidden = on; },

  toggleJournal() {
    journalOpen = !journalOpen;
    $('journal').style.display = journalOpen ? '' : 'none';
  },

  cleared(city, index, total) {
    const last = index + 1 >= total;
    $('clearEyebrow').textContent = last ? 'The road ends' : `City ${index + 1} of ${total} cleared`;
    $('clearTitle').textContent = last ? 'Treasure found' : city.name;
    $('clearText').textContent = last
      ? 'Eighteen relics, six cities, one road. The treasure of the Relic Road is yours.'
      : `The notes agree: the next mark is in ${city.next}.`;
    $('nextLabel').textContent = last ? 'Back to the map' : 'Travel on';
    $('nextSub').textContent = last ? '' : `City ${index + 2} · ${city.next}`;
    show('cleared');
  }
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ------------------------------------------------------------------ flow */
const game = new Game($('view'), hud);
window.RR = game;

let currentIndex = 0;

function cityArt(city, i) {
  const [a, b] = [city.theme.skyTop, city.theme.skyHorizon].map(c => '#' + c.toString(16).padStart(6, '0'));
  const ground = '#' + (city.look.tint.block).toString(16).padStart(6, '0');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="g${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="320" height="200" fill="url(#g${i})"/>
    ${Array.from({ length: 14 }, (_, k) => {
      const w = 12 + ((k * 37) % 26), h = 30 + ((k * 53) % 90), x = k * 23 - 6;
      return `<rect x="${x}" y="${200 - h}" width="${w}" height="${h}" fill="${ground}" opacity="${0.5 + (k % 3) * 0.16}"/>`;
    }).join('')}
    <rect y="176" width="320" height="24" fill="#1b1a16" opacity="0.8"/>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function buildCityList() {
  const list = $('cityList');
  list.innerHTML = '';
  CITIES.forEach((city, i) => {
    const unlocked = i < game.progress.unlocked;
    const done = (game.progress.journal[city.id] || []).length >= 3;
    const el = document.createElement('button');
    el.className = 'cty' + (unlocked ? '' : ' locked');
    el.style.setProperty('--art', cityArt(city, i));
    el.innerHTML = `<div class="num">${i + 1}</div>
      <div class="badge${done ? ' done' : ''}">${done ? 'Cleared' : unlocked ? 'Open' : 'Locked'}</div>
      <div class="t">${esc(city.name)}</div>
      <div class="d">${esc(city.where)}</div>`;
    if (unlocked) el.onclick = () => runCity(i);
    list.appendChild(el);
  });
}

function refreshMenu() {
  const next = Math.min(game.progress.unlocked - 1, CITIES.length - 1);
  currentIndex = next;
  $('playLabel').textContent = game.progress.unlocked > 1 ? 'Continue the hunt' : 'Start the hunt';
  $('playSub').textContent = `City ${next + 1} · ${CITIES[next].name}`;
  $('citiesSub').textContent = `${game.progress.unlocked} / ${CITIES.length}`;
}

async function runCity(i) {
  currentIndex = i;
  show(null);
  $('hud').hidden = true;
  await game.start(i);
  $('hud').hidden = false;
  show('ready');
}

function toMenu() {
  game.state = 'idle';
  document.exitPointerLock?.();
  refreshMenu();
  show('menu');
}

/* buttons */
$('playBtn').onclick = () => runCity(currentIndex);
$('citiesBtn').onclick = () => { buildCityList(); show('cityScreen'); };
$('backBtn').onclick = () => show('menu');
$('ready').onclick = () => { show(null); game.play(); };
$('lockHint').onclick = () => game.lock();
$('resumeBtn').onclick = () => game.resume();
$('restartBtn').onclick = () => { hud.pause(false); runCity(currentIndex); };
$('quitBtn').onclick = () => { hud.pause(false); toMenu(); };
$('clearMenuBtn').onclick = toMenu;
$('nextBtn').onclick = () => {
  if (currentIndex + 1 < CITIES.length) runCity(currentIndex + 1);
  else toMenu();
};

addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    if (!$('cityScreen').hidden) show('menu');
    else if (!$('pause').hidden) game.resume();
  }
});

/* compass tape: one label every 15 degrees, three laps so it never runs out */
(function tape() {
  const el = $('compassTape');
  let html = '';
  for (let lap = -1; lap <= 1; lap++) {
    for (let d = 0; d < 360; d += 15) {
      const label = d % 45 === 0 ? DIRS[(d / 45) % 8] : '·';
      html += `<span style="width:${15 * PX_PER_DEG}px">${label}</span>`;
    }
  }
  el.innerHTML = html;
  el.style.left = `calc(50% - ${360 * PX_PER_DEG}px)`;
})();

refreshMenu();
const deep = new URLSearchParams(location.search).get('city');
if (deep != null && CITIES[+deep - 1]) runCity(+deep - 1);
else show('menu');

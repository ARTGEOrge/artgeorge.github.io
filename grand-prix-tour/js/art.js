/* SVG card art for each location (level select + intro card). */
const SIL = {
  monaco: c => `<path d="M0 118 L30 96 L60 104 L92 80 L130 98 L170 86 L210 100 L240 92 L240 140 L0 140Z" fill="${c}" opacity=".55"/>
    ${[18, 40, 62, 150, 176, 200].map((x, i) => `<rect x="${x}" y="${96 - (i % 3) * 8}" width="16" height="${22 + (i % 3) * 8}" fill="#f6d7a8" opacity=".9"/><rect x="${x}" y="${92 - (i % 3) * 8}" width="16" height="5" fill="#c0583a"/>`).join('')}
    <rect x="0" y="118" width="240" height="22" fill="#1f6fa8"/><path d="M150 116 l18 0 l-3 4 l-12 0z M156 116 l0 -14 l6 14" fill="#fff"/>`,
  italy: c => `<path d="M0 112 Q60 86 120 104 T240 98 L240 140 L0 140Z" fill="#8a9a3e"/>
    ${[20, 34, 190, 204, 218].map(x => `<ellipse cx="${x}" cy="96" rx="4" ry="16" fill="#2b5426"/>`).join('')}
    <rect x="150" y="90" width="22" height="14" fill="#f2d8b0"/><path d="M148 90 l13 -8 l13 8z" fill="#c0583a"/>`,
  britain: c => `<path d="M0 108 Q80 92 140 104 T240 100 L240 140 L0 140Z" fill="#4f7a34"/>
    ${[30, 60, 190].map(x => `<circle cx="${x}" cy="94" r="12" fill="#3e6e2c"/><rect x="${x - 2}" y="100" width="4" height="10" fill="#5c4430"/>`).join('')}
    ${Array.from({ length: 40 }, (_, i) => `<line x1="${(i * 37) % 240}" y1="${(i * 23) % 120}" x2="${(i * 37) % 240 - 3}" y2="${(i * 23) % 120 + 10}" stroke="#d8e0e8" stroke-width=".8" opacity=".6"/>`).join('')}`,
  alps: c => `<path d="M0 110 L40 50 L70 84 L110 30 L150 80 L190 44 L240 100 L240 140 L0 140Z" fill="#7d8a98"/>
    <path d="M40 50 L50 64 L32 64Z M110 30 L124 50 L98 50Z M190 44 L202 60 L178 60Z" fill="#fff"/>
    ${[20, 36, 200, 216].map(x => `<path d="M${x} 112 l8 0 l-4 -18z" fill="#24452e"/>`).join('')}
    ${Array.from({ length: 30 }, (_, i) => `<circle cx="${(i * 53) % 240}" cy="${(i * 29) % 110}" r="1.2" fill="#fff"/>`).join('')}`,
  desert: c => `<path d="M0 112 Q50 96 100 110 T200 104 T240 108 L240 140 L0 140Z" fill="#d9a35c"/>
    <path d="M150 112 L152 30 L154 112Z" fill="#3a2a40"/>${[164, 172, 182, 196].map((x, i) => `<rect x="${x}" y="${80 - i * 7}" width="7" height="${32 + i * 7}" fill="#3a2a40"/>`).join('')}`,
  tokyo: c => `${[0, 22, 44, 70, 160, 182, 204, 222].map((x, i) => `<rect x="${x}" y="${40 + (i * 17) % 40}" width="20" height="100" fill="#141026"/>
    <rect x="${x + 4}" y="${48 + (i * 17) % 40}" width="10" height="16" fill="${['#ff2fa8', '#2fe0ff', '#ffcf2a'][i % 3]}" opacity=".9"/>`).join('')}`,
  brazil: c => `<path d="M140 120 Q150 50 172 60 Q186 70 190 120Z" fill="#2f6a3a"/><path d="M190 120 Q200 84 214 90 Q224 100 228 120Z" fill="#3a7a3a"/>
    <rect x="0" y="116" width="240" height="24" fill="#1b7fa0"/>${[10, 30, 52, 76].map(x => `<circle cx="${x}" cy="100" r="16" fill="#21612a"/>`).join('')}`,
  vegas: c => `${[0, 26, 60, 180, 206].map((x, i) => `<rect x="${x}" y="${50 + (i * 13) % 30}" width="24" height="90" fill="#1c1428"/><rect x="${x}" y="${56 + (i * 13) % 30}" width="24" height="4" fill="${['#ffcf2a', '#ff2fa8', '#2fe0ff'][i % 3]}"/>`).join('')}
    <path d="M100 112 L130 70 L160 112Z" fill="#0c0c12"/><rect x="128" y="0" width="4" height="70" fill="#e8f0ff" opacity=".35"/>`,
  outback: c => `<path d="M0 104 Q60 90 120 100 T240 96 L240 140 L0 140Z" fill="#b65a2c"/><rect x="0" y="120" width="90" height="20" fill="#1f78b8"/>
    ${[150, 200].map(x => `<rect x="${x}" y="80" width="3" height="22" fill="#d8d2c4"/><circle cx="${x + 2}" cy="78" r="10" fill="#6f7d4a"/>`).join('')}`,
  singapore: c => `<rect x="0" y="116" width="240" height="24" fill="#0c2848"/>${[150, 166, 182].map(x => `<rect x="${x}" y="54" width="10" height="64" fill="#26304a"/>`).join('')}
    <rect x="144" y="50" width="54" height="5" fill="#9ab8ff"/><circle cx="80" cy="76" r="30" fill="none" stroke="#9fe8ff" stroke-width="1.5"/>
    ${[20, 40].map(x => `<path d="M${x} 116 L${x + 2} 84 L${x - 8} 74 L${x + 14} 74 L${x + 4} 84 L${x + 6} 116Z" fill="#c040c0"/>`).join('')}`
};

export function cardArt(L, id = 'c' + L.id) {
  const s = L.sky;
  const sunY = 70 - Math.max(0, s.sun[1]) * 50, sunX = 120 + s.sun[0] * 80;
  const sun = s.sunSize > 0 ? `<circle cx="${sunX}" cy="${sunY}" r="${8 + s.sunSize * 4}" fill="${s.sunCol}" opacity=".95"/><circle cx="${sunX}" cy="${sunY}" r="${26 + s.sunSize * 8}" fill="${s.sunCol}" opacity=".18"/>` : (L.night ? `<circle cx="196" cy="26" r="7" fill="#e8ecf4" opacity=".9"/>` : '');
  const stars = s.stars ? Array.from({ length: 26 }, (_, i) => `<circle cx="${(i * 47) % 240}" cy="${(i * 19) % 60}" r=".7" fill="#fff" opacity="${0.4 + (i % 3) * 0.2}"/>`).join('') : '';
  return `<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><defs>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.top}"/><stop offset=".75" stop-color="${s.hor}"/><stop offset="1" stop-color="${s.bot}"/></linearGradient>
    <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.road}" stop-opacity=".6"/><stop offset="1" stop-color="${L.road}"/></linearGradient></defs>
    <rect width="240" height="140" fill="url(#${id}s)"/>${stars}${sun}${SIL[L.theme]('#556')}
    <path d="M112 104 L128 104 L196 140 L44 140Z" fill="url(#${id}r)"/><path d="M119.5 106 L120.5 106 L122 140 L118 140Z" fill="${L.line}" opacity=".8"/>
    <g transform="translate(120 128)"><rect x="-13" y="-6" width="26" height="3" fill="#111"/><rect x="-10" y="-11" width="20" height="5" rx="1" fill="#d81e2c"/><rect x="-4" y="-15" width="8" height="5" rx="2" fill="#d81e2c"/>
    <rect x="-15" y="-9" width="6" height="9" rx="1.5" fill="#151515"/><rect x="9" y="-9" width="6" height="9" rx="1.5" fill="#151515"/><rect x="-12" y="-17" width="24" height="2.5" fill="#d81e2c"/></g></svg>`;
}

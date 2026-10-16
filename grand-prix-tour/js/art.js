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
    ${[20, 40].map(x => `<path d="M${x} 116 L${x + 2} 84 L${x - 8} 74 L${x + 14} 74 L${x + 4} 84 L${x + 6} 116Z" fill="#c040c0"/>`).join('')}`,
  paris: c => `${[0, 26, 52, 176, 204].map((x, i) => `<rect x="${x}" y="${84 - (i % 2) * 6}" width="24" height="56" fill="#e2d6bc"/><rect x="${x}" y="${78 - (i % 2) * 6}" width="24" height="7" fill="#6a7480"/>${[4, 14].map(o => `<rect x="${x + o}" y="${92 - (i % 2) * 6}" width="5" height="7" fill="#4a5664"/>`).join('')}`).join('')}
    <path d="M112 112 L119 40 L121 40 L128 112 L124 112 L120 76 L116 112Z M114 92 h12 v2 h-12z" fill="#5a4636"/><rect x="119.4" y="26" width="1.2" height="14" fill="#5a4636"/>
    ${[90, 150].map(x => `<circle cx="${x}" cy="100" r="9" fill="#5a7a3a"/>`).join('')}`,
  barcelona: c => `<rect x="0" y="116" width="240" height="24" fill="#1d6fa6"/><path d="M0 116 L0 92 Q30 80 60 96 L70 116Z" fill="#a08a54"/>
    ${[[160, 50], [172, 36], [184, 36], [196, 50], [178, 22]].map(([x, y]) => `<rect x="${x - 3}" y="${y + 10}" width="6" height="${110 - y}" fill="#c8b08a"/><path d="M${x - 4} ${y + 10} L${x} ${y} L${x + 4} ${y + 10}Z" fill="#e8d8b0"/>`).join('')}
    ${[20, 40].map(x => `<rect x="${x}" y="90" width="2" height="26" fill="#8a6a44"/><path d="M${x + 1} 90 l-10 4 M${x + 1} 90 l10 4 M${x + 1} 90 l-6 -6 M${x + 1} 90 l6 -6" stroke="#2f7232" stroke-width="3"/>`).join('')}`,
  nurburg: c => `<path d="M0 104 Q60 80 120 98 T240 92 L240 140 L0 140Z" fill="#2e5226"/>
    ${[8, 24, 40, 60, 176, 196, 214, 230].map((x, i) => `<path d="M${x} ${112 - (i % 3) * 4} l9 0 l-4.5 -${26 + (i % 3) * 6}z" fill="#1e3a24"/>`).join('')}
    <rect x="140" y="62" width="30" height="20" fill="#8a8680"/><rect x="136" y="52" width="9" height="30" fill="#8a8680"/><path d="M135 52 l5.5 -9 l5.5 9z" fill="#4a4e58"/>
    <rect x="0" y="0" width="240" height="140" fill="#b8c0c6" opacity=".35"/>`,
  fjord: c => `<path d="M0 116 L0 30 L40 20 L70 60 L80 116Z" fill="#5a646a"/><path d="M240 116 L240 26 L200 18 L170 64 L160 116Z" fill="#646e74"/>
    <path d="M40 20 L52 34 L30 30Z M200 18 L212 30 L190 28Z" fill="#fff"/><rect x="80" y="116" width="80" height="24" fill="#24506a"/><rect x="0" y="116" width="80" height="24" fill="#4e7a3a"/><rect x="160" y="116" width="80" height="24" fill="#4e7a3a"/>
    ${[18, 30].map(x => `<rect x="${x}" y="106" width="9" height="8" fill="#a8322a"/><path d="M${x - 1} 106 l5.5 -5 l5.5 5z" fill="#3a2a24"/>`).join('')}`,
  iceland: c => `<path d="M0 110 Q60 100 120 108 T240 104 L240 140 L0 140Z" fill="#33302e"/><path d="M130 104 L170 60 L180 60 L220 104Z" fill="#3a3634"/>
    <path d="M168 60 Q160 40 172 28 Q186 16 178 0" stroke="#e8e8e8" stroke-width="10" fill="none" opacity=".5"/>
    ${[30, 70, 100].map(x => `<path d="M${x} 112 Q${x - 4} 90 ${x + 3} 70" stroke="#fff" stroke-width="6" fill="none" opacity=".35"/>`).join('')}
    ${[10, 50, 86, 200].map(x => `<ellipse cx="${x}" cy="112" rx="10" ry="3" fill="#5a7a34"/>`).join('')}`,
  highlands: c => `<path d="M0 106 L50 60 L90 92 L140 50 L200 90 L240 70 L240 140 L0 140Z" fill="#4e5448"/><rect x="0" y="114" width="120" height="26" fill="#2a3640"/>
    <path d="M120 114 Q180 104 240 112 L240 140 L120 140Z" fill="#6a4a5a"/><path d="M40 114 l0 -16 l6 -4 l0 20z M50 114 l0 -10 l10 0 l0 10z" fill="#5a5854"/>
    ${Array.from({ length: 40 }, (_, i) => `<line x1="${(i * 37) % 240}" y1="${(i * 23) % 120}" x2="${(i * 37) % 240 - 3}" y2="${(i * 23) % 120 + 10}" stroke="#d8e0e8" stroke-width=".8" opacity=".6"/>`).join('')}`,
  morocco: c => `<path d="M0 100 L50 50 L90 84 L140 40 L190 80 L240 56 L240 140 L0 140Z" fill="#9a6a4e"/><path d="M50 50 L60 62 L42 62Z M140 40 L152 54 L128 54Z" fill="#fff"/>
    <path d="M0 110 Q120 98 240 108 L240 140 L0 140Z" fill="#c8844a"/>
    ${[[150, 88], [184, 94]].map(([x, y]) => `<rect x="${x}" y="${y}" width="26" height="${112 - y}" fill="#a85a34"/>${[0, 20].map(o => `<rect x="${x + o}" y="${y - 6}" width="6" height="6" fill="#a85a34"/>`).join('')}`).join('')}
    ${[20, 40].map(x => `<rect x="${x}" y="88" width="2" height="24" fill="#8a6a44"/><path d="M${x + 1} 88 l-10 4 M${x + 1} 88 l10 4 M${x + 1} 88 l-6 -6 M${x + 1} 88 l6 -6" stroke="#2f7232" stroke-width="3"/>`).join('')}`,
  cairo: c => `<path d="M0 112 Q60 104 120 110 T240 106 L240 140 L0 140Z" fill="#d6a868"/>
    <path d="M120 112 L160 62 L200 112Z" fill="#c89a62"/><path d="M170 112 L200 76 L230 112Z" fill="#b8905a"/><path d="M84 112 L104 88 L124 112Z" fill="#d8b07a"/>
    <path d="M20 112 v-22 a10 10 0 0 1 20 0 v22z" fill="#a88a64"/><rect x="46" y="64" width="4" height="48" fill="#a88a64"/><path d="M45 64 l3 -8 l3 8z" fill="#a88a64"/>`,
  istanbul: c => `<rect x="0" y="116" width="240" height="24" fill="#1a2a48"/><path d="M60 116 v-20 a26 22 0 0 1 52 0 v20z" fill="#2a2440"/>
    ${[52, 120].map(x => `<rect x="${x}" y="60" width="4" height="56" fill="#2a2440"/><path d="M${x - 1} 60 l3 -10 l3 10z" fill="#2a2440"/>`).join('')}
    <path d="M140 108 L240 108" stroke="#9fd8ff" stroke-width="2"/><rect x="170" y="60" width="4" height="48" fill="#3a3a5a"/><path d="M140 108 Q172 60 172 60 Q200 96 240 90" stroke="#9fd8ff" stroke-width="1" fill="none"/>
    <circle cx="86" cy="104" r="2" fill="#ffd9a0"/><circle cx="76" cy="106" r="2" fill="#ffd9a0"/><circle cx="96" cy="106" r="2" fill="#ffd9a0"/>`,
  himalaya: c => `<path d="M0 108 L40 30 L80 76 L130 14 L180 70 L210 40 L240 80 L240 140 L0 140Z" fill="#7d8a98"/>
    <path d="M40 30 L52 50 L28 50Z M130 14 L146 40 L114 40Z M210 40 L220 54 L200 54Z" fill="#fff"/>
    <path d="M10 70 Q60 82 110 74" stroke="#888" stroke-width=".6" fill="none"/>${Array.from({ length: 12 }, (_, i) => `<rect x="${14 + i * 8}" y="${73 + Math.sin(i / 11 * Math.PI) * 6}" width="5" height="5" fill="${['#2a5ad8', '#f2f2f2', '#d82a2a', '#2aa84a', '#f2c82a'][i % 5]}"/>`).join('')}
    <path d="M170 112 a12 12 0 0 1 24 0z" fill="#f4f2ec"/><path d="M180 100 l2 -12 l2 12z" fill="#d8a830"/>
    ${Array.from({ length: 30 }, (_, i) => `<circle cx="${(i * 53) % 240}" cy="${(i * 29) % 110}" r="1.2" fill="#fff"/>`).join('')}`,
  shanghai: c => `<rect x="0" y="116" width="240" height="24" fill="#101c38"/>${[0, 20, 40, 150, 172, 196, 220].map((x, i) => `<rect x="${x}" y="${30 + (i * 19) % 50}" width="18" height="90" fill="#141026"/><rect x="${x + 4}" y="${40 + (i * 19) % 50}" width="10" height="3" fill="${['#ff3a6a', '#2fe0ff', '#ffcf2a'][i % 3]}"/>`).join('')}
    <rect x="98" y="20" width="4" height="96" fill="#3a3448"/><circle cx="100" cy="82" r="11" fill="#ff5aa0"/><circle cx="100" cy="40" r="7" fill="#ff5aa0"/><rect x="99.3" y="4" width="1.4" height="20" fill="#3a3448"/>`,
  seoul: c => `${[0, 24, 48, 160, 184, 208].map((x, i) => `<rect x="${x}" y="${50 + (i * 17) % 40}" width="22" height="90" fill="#141026"/>${[0, 1, 2].map(k => `<rect x="${x + 3}" y="${58 + (i * 17) % 40 + k * 12}" width="${8 + (k * 5) % 10}" height="6" fill="${['#ff2fa8', '#2fe0ff', '#ffcf2a', '#40ff9a'][(i + k) % 4]}"/>`).join('')}`).join('')}
    <path d="M80 112 Q120 70 160 112Z" fill="#141a18"/><rect x="118" y="30" width="4" height="62" fill="#3a3a48"/><rect x="112" y="36" width="16" height="7" fill="#9fe8ff"/>
    ${Array.from({ length: 40 }, (_, i) => `<line x1="${(i * 37) % 240}" y1="${(i * 23) % 120}" x2="${(i * 37) % 240 - 3}" y2="${(i * 23) % 120 + 10}" stroke="#8aa0ff" stroke-width=".8" opacity=".5"/>`).join('')}`,
  hongkong: c => `<rect x="0" y="118" width="240" height="22" fill="#0a2040"/><path d="M120 118 Q180 30 240 40 L240 118Z" fill="#14201a"/>
    ${[0, 14, 30, 46, 62, 80, 96, 112].map((x, i) => `<rect x="${x}" y="${20 + (i * 23) % 60}" width="13" height="100" fill="#141a2c"/><rect x="${x + 3}" y="${28 + (i * 23) % 60}" width="7" height="${30 + (i % 3) * 10}" fill="#ffd9a0" opacity=".35"/>`).join('')}
    <path d="M150 124 l14 0 l-2 4 l-10 0z" fill="#3a2a1a"/><path d="M156 124 l0 -12 l7 12z" fill="#c84a2a"/>`,
  kyoto: c => `<path d="M0 112 Q80 98 160 108 T240 104 L240 140 L0 140Z" fill="#7a7040"/>
    ${[0, 1, 2, 3, 4].map(i => `<rect x="${164 + i * 2}" y="${46 + i * 14}" width="${24 - i * 4}" height="8" fill="#8a2a1e"/><rect x="${160 + i * 2}" y="${43 + i * 14}" width="${32 - i * 4}" height="3" fill="#2a2a30"/>`).join('')}
    <rect x="44" y="76" width="4" height="36" fill="#d8401e"/><rect x="76" y="76" width="4" height="36" fill="#d8401e"/><rect x="36" y="72" width="52" height="4" fill="#2a2020"/><rect x="40" y="82" width="44" height="3" fill="#d8401e"/>
    ${[10, 22, 110, 130, 220].map((x, i) => `<circle cx="${x}" cy="${98 - (i % 2) * 6}" r="11" fill="${['#d83a22', '#e86a22', '#f0a030'][i % 3]}"/>`).join('')}`,
  route66: c => `<path d="M0 112 Q120 106 240 110 L240 140 L0 140Z" fill="#c0784a"/>
    <path d="M10 112 L20 70 L80 70 L92 112Z" fill="#a0522d"/><path d="M160 112 L168 82 L214 82 L224 112Z" fill="#b85a34"/>
    ${[100, 140, 200].map(x => `<rect x="${x}" y="80" width="2" height="32" fill="#5a4030"/><rect x="${x - 5}" y="82" width="12" height="1.5" fill="#5a4030"/>`).join('')}
    <path d="M50 100 L120 92 L200 96" stroke="#3a3030" stroke-width=".5" fill="none"/><path d="M128 112 v-12 a2 2 0 0 1 4 0 v12 M126 104 h-4 v-5 M134 102 h4 v-6" stroke="#4f7a3a" stroke-width="3" fill="none"/>`,
  miami: c => `<rect x="0" y="116" width="240" height="24" fill="#0c2848"/>${[[0, 70, '#ffc8d8'], [30, 60, '#c8f0e8'], [62, 76, '#fff0c0'], [170, 66, '#d8c8ff'], [204, 72, '#ffd8b0']].map(([x, y, col]) => `<rect x="${x}" y="${y}" width="28" height="${116 - y}" fill="${col}" opacity=".85"/><rect x="${x}" y="${y + 8}" width="28" height="2" fill="#ff4ac0"/><rect x="${x + 12}" y="${y - 10}" width="4" height="10" fill="#2fe0ff"/>`).join('')}
    ${[110, 140].map(x => `<rect x="${x}" y="80" width="2" height="36" fill="#3a2a2a"/><path d="M${x + 1} 80 l-12 4 M${x + 1} 80 l12 4 M${x + 1} 80 l-7 -7 M${x + 1} 80 l7 -7" stroke="#14301c" stroke-width="3"/>`).join('')}`,
  rockies: c => `<path d="M0 104 L44 34 L80 80 L126 20 L170 76 L204 36 L240 90 L240 140 L0 140Z" fill="#7a8088"/><path d="M44 34 L56 52 L32 52Z M126 20 L142 44 L110 44Z M204 36 L216 54 L192 54Z" fill="#fff"/>
    <rect x="80" y="116" width="160" height="24" fill="#2ab0b8"/><rect x="0" y="112" width="80" height="28" fill="#6a7a3a"/>
    ${[6, 20, 34, 52, 66].map((x, i) => i % 2 ? `<path d="M${x} 114 l9 0 l-4.5 -22z" fill="#24452e"/>` : `<circle cx="${x + 4}" cy="100" r="7" fill="#f0c030"/>`).join('')}`,
  mexico: c => `<path d="M0 112 Q120 104 240 110 L240 140 L0 140Z" fill="#6a6a3a"/><path d="M150 112 L160 102 L170 102 L172 92 L198 92 L200 102 L210 102 L220 112Z" fill="#8a7658"/><rect x="178" y="82" width="14" height="10" fill="#7a6648"/>
    ${[[0, '#f28a6a'], [22, '#f2d24a'], [44, '#6ac8f2'], [66, '#f26aa8']].map(([x, col]) => `<rect x="${x}" y="92" width="20" height="20" fill="${col}"/>`).join('')}
    <path d="M90 60 L130 20 L170 60Z" fill="#5a5a62" opacity=".6"/>
    ${Array.from({ length: 40 }, (_, i) => `<line x1="${(i * 37) % 240}" y1="${(i * 23) % 120}" x2="${(i * 37) % 240 - 3}" y2="${(i * 23) % 120 + 10}" stroke="#d8e0e8" stroke-width=".8" opacity=".6"/>`).join('')}`,
  patagonia: c => `<path d="M100 104 L116 30 L122 14 L130 36 L140 20 L148 46 L160 104Z" fill="#6a6a72"/><path d="M116 30 L122 14 L126 30Z M140 20 L144 32 L137 32Z" fill="#ffd8b0"/>
    <path d="M0 104 L50 70 L90 100 L170 100 L210 64 L240 90 L240 140 L0 140Z" fill="#7a7a80"/><rect x="0" y="114" width="110" height="26" fill="#6ab0c8"/><path d="M110 114 Q180 106 240 112 L240 140 L110 140Z" fill="#c0a462"/>`,
  abudhabi: c => `<rect x="0" y="116" width="240" height="24" fill="#122a50"/>${[150, 172, 196, 218].map((x, i) => `<rect x="${x}" y="${50 + (i * 13) % 30}" width="18" height="70" fill="#1c1430"/><rect x="${x + 3}" y="${56 + (i * 13) % 30}" width="12" height="2" fill="#c890ff"/>`).join('')}
    <path d="M20 108 Q70 64 120 108" fill="none" stroke="#7ad0ff" stroke-width="1.5"/><path d="M30 104 Q70 72 110 104 M45 96 L95 96 M70 76 L70 108" stroke="#7ad0ff" stroke-width=".8" fill="none"/>
    <rect x="16" y="104" width="34" height="12" fill="#2a2440"/><rect x="90" y="104" width="34" height="12" fill="#2a2440"/>`
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

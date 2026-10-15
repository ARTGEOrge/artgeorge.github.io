/* Grand Prix World Tour — the ten point-to-point road races.
 * Every race is a closed public road from one town to another. Each entry
 * holds the route generator settings (length, corner mix, width), the look
 * (sky, fog, light, ground, scenery theme) and how hard the field drives. */

export const LEVELS = [
  {
    id: 1, theme: 'monaco', from: 'Monte Carlo', to: 'Nice', country: 'Monaco · France',
    blurb: 'Harbour start under the casino, then the corniche along the Riviera cliffs. Sunny, smooth and wide: learn the car here.',
    time: 'Morning', weather: 'clear', seed: 1107, length: 6000, width: 13,
    narrow: { count: 0, w: 11 }, straight: [90, 260],
    mix: { sweep: 5, medium: 3, tight: 1, hairpin: 0, chicane: 1 }, maxDev: 75,
    elev: 6, climb: 0, coast: 'left', hill: 26, grip: 1,
    ai: 0.76, aiSpread: 0.08, grid: 6,
    sky: { top: '#3d82d6', hor: '#bfe2ff', bot: '#d9eefc', sun: [0.4, 0.55, 0.5], sunCol: '#fff4d8', sunSize: 1, stars: 0 },
    fog: { col: '#cfe6f8', near: 260, far: 1500 },
    light: { sky: '#dff0ff', gnd: '#8a8063', hemi: 1.05, sun: '#fff1d6', sunI: 2.1 },
    ground: { a: '#7d9a4c', b: '#a8a462', near: '#7e8f5a', far: '#9db0b8' }, sea: '#1f6fa8',
    road: '#55575c', barrier: 'armco', line: '#f4f4f4'
  },
  {
    id: 2, theme: 'italy', from: 'Monza', to: 'Milan', country: 'Italy',
    blurb: 'Out of the royal park and through the cypress-lined Lombardy farmland. Long, fast sweepers — keep it flat out.',
    time: 'Golden afternoon', weather: 'clear', seed: 2203, length: 7000, width: 13,
    narrow: { count: 1, w: 11 }, straight: [140, 380],
    mix: { sweep: 6, medium: 3, tight: 1, hairpin: 0, chicane: 2 }, maxDev: 70,
    elev: 8, climb: 0, coast: null, hill: 30, grip: 1,
    ai: 0.79, aiSpread: 0.08, grid: 7,
    sky: { top: '#4a7fc9', hor: '#ffd9a0', bot: '#f2d6a8', sun: [-0.5, 0.32, 0.6], sunCol: '#ffe2a8', sunSize: 1.2, stars: 0 },
    fog: { col: '#eed6ae', near: 240, far: 1400 },
    light: { sky: '#ffe9c4', gnd: '#7a7044', hemi: 1.0, sun: '#ffdca0', sunI: 2.2 },
    ground: { a: '#8a9a3e', b: '#b9a24c', near: '#7f9440', far: '#b9b07a' }, sea: null,
    road: '#5a5a5e', barrier: 'tecpro', line: '#f4f4f4'
  },
  {
    id: 3, theme: 'britain', from: 'Silverstone', to: 'Northampton', country: 'England',
    blurb: 'Classic British weather: steady rain, standing water and hedgerows. Grip is down — brake earlier and stay off the grass.',
    time: 'Overcast, rain', weather: 'rain', seed: 3319, length: 6800, width: 12,
    narrow: { count: 2, w: 10 }, straight: [100, 280],
    mix: { sweep: 4, medium: 4, tight: 2, hairpin: 0, chicane: 2 }, maxDev: 80,
    elev: 9, climb: 0, coast: null, hill: 22, grip: 0.87,
    ai: 0.81, aiSpread: 0.08, grid: 8,
    sky: { top: '#5d6670', hor: '#9aa3aa', bot: '#8d959b', sun: [0.2, 0.5, -0.6], sunCol: '#d8dde0', sunSize: 0, stars: 0 },
    fog: { col: '#8f989f', near: 90, far: 700 },
    light: { sky: '#c3cbd1', gnd: '#4e5a3c', hemi: 1.15, sun: '#dfe5ea', sunI: 0.8 },
    ground: { a: '#4f7a34', b: '#6b8e3e', near: '#4c6f33', far: '#7c8a80' }, sea: null,
    road: '#3e4044', barrier: 'armco', line: '#e8e8e8', wet: true
  },
  {
    id: 4, theme: 'alps', from: 'St. Moritz', to: 'Julier Pass', country: 'Switzerland',
    blurb: 'A climb into the Alps in falling snow. Narrow, steep and full of hairpins — the slowest corners on the tour.',
    time: 'Midday, snowfall', weather: 'snow', seed: 4421, length: 6000, width: 11,
    narrow: { count: 3, w: 9.5 }, straight: [70, 200],
    mix: { sweep: 2, medium: 3, tight: 3, hairpin: 3, chicane: 1 }, maxDev: 95,
    elev: 14, climb: 0.045, coast: null, hill: 220, grip: 0.9,
    ai: 0.84, aiSpread: 0.08, grid: 8,
    sky: { top: '#7d97b3', hor: '#dfe7ee', bot: '#e8edf2', sun: [0.3, 0.45, 0.4], sunCol: '#ffffff', sunSize: 0.4, stars: 0 },
    fog: { col: '#d5dee6', near: 120, far: 900 },
    light: { sky: '#eef4ff', gnd: '#9aa4ae', hemi: 1.2, sun: '#ffffff', sunI: 1.3 },
    ground: { a: '#eef3f7', b: '#d6dee6', near: '#e3e9ee', far: '#c8d2dc', snow: true }, sea: null,
    road: '#4a4c52', barrier: 'armco', line: '#ffd84a'
  },
  {
    id: 5, theme: 'desert', from: 'Dubai', to: 'Abu Dhabi', country: 'United Arab Emirates',
    blurb: 'The skyline fades behind you as the sun drops into the dunes. Huge straights and DRS zones — slipstream to win.',
    time: 'Sunset', weather: 'clear', seed: 5531, length: 8600, width: 14,
    narrow: { count: 1, w: 11.5 }, straight: [220, 520],
    mix: { sweep: 4, medium: 3, tight: 2, hairpin: 1, chicane: 2 }, maxDev: 70,
    elev: 5, climb: 0, coast: null, hill: 18, grip: 1,
    ai: 0.85, aiSpread: 0.08, grid: 9,
    sky: { top: '#2b3a78', hor: '#ff9a4a', bot: '#e9a060', sun: [-0.15, 0.07, 0.95], sunCol: '#ffb060', sunSize: 2.2, stars: 0.2 },
    fog: { col: '#e6a06a', near: 240, far: 1500 },
    light: { sky: '#ffc58a', gnd: '#a8743e', hemi: 0.95, sun: '#ffa860', sunI: 2.0 },
    ground: { a: '#d9a35c', b: '#e8b978', near: '#caa070', far: '#d6a070' }, sea: null,
    road: '#4c4a4a', barrier: 'wall', line: '#f4f4f4'
  },
  {
    id: 6, theme: 'tokyo', from: 'Shibuya', to: 'Tokyo Bay', country: 'Japan',
    blurb: 'Midnight through neon canyons. Tight 90-degree city corners and walls inches away — one mistake and the pack is gone.',
    time: 'Night', weather: 'clear', seed: 6607, length: 7000, width: 11.5,
    narrow: { count: 3, w: 9.5 }, straight: [90, 260],
    mix: { sweep: 1, medium: 3, tight: 5, hairpin: 1, chicane: 3 }, maxDev: 85,
    elev: 4, climb: 0, coast: null, hill: 0, grip: 1, city: true, night: true,
    ai: 0.87, aiSpread: 0.08, grid: 9,
    sky: { top: '#05040f', hor: '#2a1446', bot: '#120a20', sun: [0.2, 0.5, 0.3], sunCol: '#000000', sunSize: 0, stars: 0.4 },
    fog: { col: '#1d1030', near: 120, far: 900 },
    light: { sky: '#7a6cff', gnd: '#301838', hemi: 0.9, sun: '#b0a8ff', sunI: 0.45 },
    ground: { a: '#2a2a33', b: '#33333d', near: '#3a3a44', far: '#22202c' }, sea: null,
    road: '#36363c', barrier: 'neon', line: '#fdfdfd'
  },
  {
    id: 7, theme: 'brazil', from: 'São Paulo', to: 'Rio de Janeiro', country: 'Brazil',
    blurb: 'Down the Serra do Mar through rainforest to the Atlantic coast. Rolling hills, blind crests and quick changes of direction.',
    time: 'Tropical afternoon', weather: 'clear', seed: 7717, length: 7800, width: 11.5,
    narrow: { count: 2, w: 10 }, straight: [100, 300],
    mix: { sweep: 3, medium: 4, tight: 3, hairpin: 1, chicane: 2 }, maxDev: 85,
    elev: 18, climb: -0.012, coast: 'right', hill: 90, grip: 1,
    ai: 0.885, aiSpread: 0.08, grid: 10,
    sky: { top: '#2f86d8', hor: '#c9ecff', bot: '#d4ecf2', sun: [0.6, 0.6, -0.3], sunCol: '#fff5d0', sunSize: 1, stars: 0 },
    fog: { col: '#c8e2e6', near: 220, far: 1300 },
    light: { sky: '#e6fbff', gnd: '#3e6a2c', hemi: 1.05, sun: '#fff0cc', sunI: 2.1 },
    ground: { a: '#2f7a2c', b: '#4f9a34', near: '#3d7d35', far: '#5d8f74' }, sea: '#1b7fa0',
    road: '#525458', barrier: 'tecpro', line: '#ffe14a'
  },
  {
    id: 8, theme: 'vegas', from: 'The Strip', to: 'Red Rock Canyon', country: 'Nevada, USA',
    blurb: 'Lights blazing down the Strip, then out into the black desert. Flat-out boulevards broken by heavy-braking chicanes.',
    time: 'Night', weather: 'clear', seed: 8803, length: 8200, width: 13.5,
    narrow: { count: 2, w: 10.5 }, straight: [200, 480],
    mix: { sweep: 2, medium: 3, tight: 3, hairpin: 1, chicane: 4 }, maxDev: 75,
    elev: 6, climb: 0.006, coast: null, hill: 40, grip: 1, city: true, night: true,
    ai: 0.9, aiSpread: 0.08, grid: 10,
    sky: { top: '#060818', hor: '#3a1c4c', bot: '#140c1c', sun: [0.2, 0.5, 0.3], sunCol: '#000000', sunSize: 0, stars: 0.8 },
    fog: { col: '#25142e', near: 160, far: 1200 },
    light: { sky: '#ff9ad8', gnd: '#2c1a26', hemi: 0.85, sun: '#ffd0a0', sunI: 0.5 },
    ground: { a: '#5a3a2c', b: '#704634', near: '#4a3a34', far: '#2c1e1e' }, sea: null,
    road: '#38383e', barrier: 'neon', line: '#fdfdfd'
  },
  {
    id: 9, theme: 'outback', from: 'Melbourne', to: 'Great Ocean Road', country: 'Australia',
    blurb: 'Red earth, gum trees and a cliff-top run above the Southern Ocean. Narrow and relentlessly twisty under a blazing sun.',
    time: 'Midday', weather: 'clear', seed: 9901, length: 8200, width: 10.5,
    narrow: { count: 4, w: 9 }, straight: [80, 240],
    mix: { sweep: 3, medium: 4, tight: 4, hairpin: 2, chicane: 2 }, maxDev: 90,
    elev: 16, climb: 0, coast: 'left', hill: 60, grip: 1,
    ai: 0.915, aiSpread: 0.08, grid: 11,
    sky: { top: '#1f6fe0', hor: '#cfe9ff', bot: '#e6d8c4', sun: [0.1, 0.85, 0.3], sunCol: '#ffffff', sunSize: 0.9, stars: 0 },
    fog: { col: '#d9e6ee', near: 260, far: 1500 },
    light: { sky: '#e8f4ff', gnd: '#9a4e2c', hemi: 1.0, sun: '#fff6e4', sunI: 2.4 },
    ground: { a: '#b65a2c', b: '#c97a3c', near: '#a8623a', far: '#c8a080' }, sea: '#1f78b8',
    road: '#55565a', barrier: 'armco', line: '#f4f4f4'
  },
  {
    id: 10, theme: 'singapore', from: 'Marina Bay', to: 'Changi', country: 'Singapore',
    blurb: 'The grand finale: a long night race under floodlights, past the bay towers and glowing super-trees. The best drivers in the world.',
    time: 'Night, floodlit', weather: 'clear', seed: 10111, length: 10400, width: 11.5,
    narrow: { count: 4, w: 9.5 }, straight: [110, 360],
    mix: { sweep: 3, medium: 4, tight: 4, hairpin: 1, chicane: 3 }, maxDev: 85,
    elev: 5, climb: 0, coast: 'right', hill: 0, grip: 1, city: true, night: true,
    ai: 0.94, aiSpread: 0.08, grid: 12,
    sky: { top: '#050a1c', hor: '#24305a', bot: '#0c1224', sun: [0.2, 0.5, 0.3], sunCol: '#000000', sunSize: 0, stars: 0.3 },
    fog: { col: '#1a2240', near: 160, far: 1100 },
    light: { sky: '#9ab8ff', gnd: '#1a2030', hemi: 1.0, sun: '#e8f0ff', sunI: 0.75 },
    ground: { a: '#2c3a2c', b: '#344634', near: '#3a3d46', far: '#1c2232' }, sea: '#0c2848',
    road: '#3a3b40', barrier: 'neon', line: '#fdfdfd'
  }
];

/* Fictional teams. None of these are real teams, sponsors or numbers. */
export const LIVERIES = [
  { team: 'Vortex Rosso', num: 7, a: '#d81e2c', b: '#f5f5f5', c: '#1a1a1a', driver: 'You' },
  { team: 'Azure Dynamics', num: 14, a: '#1f4fd8', b: '#ffd23a', c: '#0f1830', driver: 'You' },
  { team: 'Verde Falcon', num: 22, a: '#0f7a4a', b: '#e8c45a', c: '#0b1f16', driver: 'You' },
  { team: 'Nightshade GP', num: 31, a: '#17171c', b: '#ff7a1a', c: '#2a2a30', driver: 'You' }
];
export const RIVALS = [
  { team: 'Solaris Motorsport', num: 3, a: '#ffcc12', b: '#151515', c: '#2a2a2a', driver: 'M. Varga' },
  { team: 'Polar Racing', num: 9, a: '#f2f6fa', b: '#19b4e6', c: '#1c2a38', driver: 'E. Lindqvist' },
  { team: 'Magenta Volt', num: 11, a: '#e0287a', b: '#2a58ff', c: '#1c1430', driver: 'R. Okafor' },
  { team: 'Titan Steel', num: 18, a: '#9aa4ae', b: '#12c6b0', c: '#22262c', driver: 'K. Brandt' },
  { team: 'Copper Crown', num: 27, a: '#ff7a24', b: '#13234a', c: '#13234a', driver: 'D. Moreau' },
  { team: 'Ember Corsa', num: 5, a: '#8c1420', b: '#f2c24a', c: '#2a0c10', driver: 'A. Ricci' },
  { team: 'Lumo Works', num: 40, a: '#9ae62a', b: '#5a1fb0', c: '#1a1a1a', driver: 'J. Tanaka' },
  { team: 'Aqua Marine', num: 16, a: '#16b8b0', b: '#ffffff', c: '#0c2c30', driver: 'S. Costa' },
  { team: 'Sakura Racing', num: 8, a: '#ff9ec4', b: '#ffffff', c: '#3a1428', driver: 'H. Mori' },
  { team: 'Vortex Rosso', num: 70, a: '#d81e2c', b: '#f5f5f5', c: '#1a1a1a', driver: 'P. Novak' },
  { team: 'Azure Dynamics', num: 41, a: '#1f4fd8', b: '#ffd23a', c: '#0f1830', driver: 'T. Walsh' },
  { team: 'Verde Falcon', num: 23, a: '#0f7a4a', b: '#e8c45a', c: '#0b1f16', driver: 'L. Duarte' },
  { team: 'Nightshade GP', num: 32, a: '#17171c', b: '#ff7a1a', c: '#2a2a30', driver: 'C. Hale' }
];

/* The 11 rivals for a race: never the same livery and number as the player. */
export function fieldFor(playerLivery) {
  const p = LIVERIES[playerLivery];
  return RIVALS.filter(r => !(r.team === p.team)).slice(0, 11);
}

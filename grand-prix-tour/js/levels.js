/* Grand Prix World Tour — the thirty point-to-point road races (three tours of ten).
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
  },

  /* ---------------------------------------------------------- World Tour II
   * Elite rivals: faster, defend their line, use the tow and get less help
   * from the rubber band. Roads get narrower and twistier. */
  {
    id: 11, theme: 'paris', from: 'Paris', to: 'Versailles', country: 'France',
    blurb: 'Cobbled boulevards past the iron tower, down the river quays and out to the palace gardens. Elite rivals from here on — they defend.',
    time: 'Spring morning', weather: 'clear', seed: 11113, length: 7400, width: 12.5,
    narrow: { count: 2, w: 10.5 }, straight: [90, 260],
    mix: { sweep: 3, medium: 4, tight: 3, hairpin: 0, chicane: 3 }, maxDev: 80,
    elev: 5, climb: 0, coast: null, hill: 14, grip: 1, city: true, gk: 'pavement',
    grid: 11,
    sky: { top: '#4f86cf', hor: '#d6e6f4', bot: '#e0e8ee', sun: [0.55, 0.5, 0.35], sunCol: '#fff6e2', sunSize: 0.9, stars: 0 },
    fog: { col: '#d4dfe8', near: 220, far: 1300 },
    light: { sky: '#e6f0ff', gnd: '#7a7468', hemi: 1.05, sun: '#fff2dc', sunI: 2.0 },
    ground: { a: '#6f8a4a', b: '#86985a', near: '#8c8a84', far: '#a8b0b4' }, sea: null,
    road: '#4e5056', barrier: 'stone', line: '#f4f4f4', gravel: '#c8bca0'
  },
  {
    id: 12, theme: 'barcelona', from: 'Barcelona', to: 'Sitges', country: 'Spain',
    blurb: 'From the spired old town down the Garraf coast road: cliffs, tunnels of pine and the Mediterranean glittering on your left.',
    time: 'Hot afternoon', weather: 'clear', seed: 12227, length: 7800, width: 12,
    narrow: { count: 2, w: 10.5 }, straight: [90, 280],
    mix: { sweep: 3, medium: 4, tight: 3, hairpin: 1, chicane: 2 }, maxDev: 80,
    elev: 12, climb: 0, coast: 'left', hill: 70, grip: 1, gk: 'dirt',
    grid: 11,
    sky: { top: '#2f78d2', hor: '#cbe6fa', bot: '#e6ddc8', sun: [-0.4, 0.62, 0.3], sunCol: '#fff2cc', sunSize: 1.1, stars: 0 },
    fog: { col: '#d6e4ee', near: 260, far: 1500 },
    light: { sky: '#eaf4ff', gnd: '#9a7a54', hemi: 1.0, sun: '#fff0d0', sunI: 2.3 },
    ground: { a: '#a08a54', b: '#b89a62', near: '#9a8a62', far: '#a8b4b0' }, sea: '#1d6fa6',
    road: '#56585c', barrier: 'armco', line: '#f4f4f4'
  },
  {
    id: 13, theme: 'nurburg', kit: 'britain', from: 'Nürburg', to: 'Adenau', country: 'Germany',
    blurb: 'The green hell through the Eifel forest. Thick fog, damp asphalt, blind crests and corners that tighten — memorise them or pay.',
    time: 'Foggy morning', weather: 'fog', seed: 13331, length: 8200, width: 11,
    narrow: { count: 3, w: 9.5 }, straight: [70, 220],
    mix: { sweep: 3, medium: 4, tight: 4, hairpin: 1, chicane: 1 }, maxDev: 90,
    elev: 22, climb: 0, coast: null, hill: 110, grip: 0.95, gk: 'grass', wet: true, cover: 0.95,
    grid: 11,
    sky: { top: '#77808a', hor: '#b4bcc2', bot: '#a8b0b4', sun: [0.3, 0.55, -0.5], sunCol: '#e8ecee', sunSize: 0, stars: 0 },
    fog: { col: '#aab2b8', near: 45, far: 430 },
    light: { sky: '#d0d8de', gnd: '#46523a', hemi: 1.2, sun: '#e6eaee', sunI: 0.9 },
    ground: { a: '#3e6a30', b: '#55803a', near: '#46683a', far: '#8a948e' }, sea: null,
    road: '#44464a', barrier: 'armco', line: '#f0f0f0'
  },
  {
    id: 14, theme: 'fjord', kit: 'alps', from: 'Geiranger', to: 'Trollstigen', country: 'Norway',
    blurb: 'Along the fjord under thousand-metre walls, then up the troll ladder: stacked hairpins with nothing but a stone wall above the drop.',
    time: 'Bright overcast', weather: 'clear', seed: 14447, length: 7600, width: 10.5,
    narrow: { count: 3, w: 9.5 }, straight: [70, 220],
    mix: { sweep: 2, medium: 3, tight: 3, hairpin: 4, chicane: 1 }, maxDev: 95,
    elev: 12, climb: 0.035, coast: 'right', hill: 240, grip: 1, gk: 'grass', rock: '#6a6e72', snowline: 150, cover: 0.65,
    grid: 12,
    sky: { top: '#5b7c9e', hor: '#cdd9e2', bot: '#c4d0d8', sun: [-0.3, 0.55, 0.45], sunCol: '#f4f6f8', sunSize: 0.5, stars: 0 },
    fog: { col: '#c2ced8', near: 200, far: 1300 },
    light: { sky: '#e2ecf4', gnd: '#4a5a40', hemi: 1.15, sun: '#f6f8fa', sunI: 1.5 },
    ground: { a: '#4e7a3a', b: '#62884a', near: '#557a40', far: '#7c8a8c' }, sea: '#24506a',
    road: '#4a4c50', barrier: 'stone', line: '#ffd84a'
  },
  {
    id: 15, theme: 'iceland', kit: 'outback', from: 'Reykjavík', to: 'Vík', country: 'Iceland',
    blurb: 'Black lava fields, moss and steaming vents under a low Arctic sun, with a smoking volcano on the horizon. Fast, open and unforgiving.',
    time: 'Low Arctic sun', weather: 'clear', seed: 15551, length: 8600, width: 11.5,
    narrow: { count: 3, w: 9.5 }, straight: [120, 360],
    mix: { sweep: 4, medium: 4, tight: 3, hairpin: 1, chicane: 2 }, maxDev: 85,
    elev: 10, climb: 0, coast: null, hill: 60, grip: 1, gk: 'dirt', rock: '#5a6a3a', gravel: '#3a3634', cover: 0.55,
    grid: 12,
    sky: { top: '#5a7aa0', hor: '#f2d2b0', bot: '#c8b8a8', sun: [0.6, 0.12, 0.7], sunCol: '#ffd8a8', sunSize: 1.6, stars: 0 },
    fog: { col: '#d8cabc', near: 220, far: 1400 },
    light: { sky: '#fff0e0', gnd: '#6a6458', hemi: 1.35, sun: '#ffdcb0', sunI: 2.3 },
    ground: { a: '#4a4640', b: '#5e6440', near: '#55524c', far: '#8a847a' }, sea: null,
    road: '#45454a', barrier: 'armco', line: '#ffd84a'
  },
  {
    id: 16, theme: 'highlands', kit: 'alps', from: 'Fort William', to: 'Glencoe', country: 'Scotland',
    blurb: 'Driving rain over the glens, heather and stone walls, a dark loch and a ruined castle. Grip is poor and the walls are close.',
    time: 'Heavy rain', weather: 'rain', seed: 16661, length: 8000, width: 10.5,
    narrow: { count: 4, w: 9.5 }, straight: [80, 240],
    mix: { sweep: 3, medium: 4, tight: 4, hairpin: 1, chicane: 2 }, maxDev: 90,
    elev: 14, climb: 0, coast: 'left', hill: 170, grip: 0.86, gk: 'grass', rock: '#5c5a58', wet: true,
    grid: 12,
    sky: { top: '#4c545c', hor: '#8a9298', bot: '#7c848a', sun: [0.2, 0.5, -0.6], sunCol: '#d0d6da', sunSize: 0, stars: 0 },
    fog: { col: '#7e868c', near: 70, far: 620 },
    light: { sky: '#b8c0c6', gnd: '#3e3a40', hemi: 1.15, sun: '#d8dee2', sunI: 0.7 },
    ground: { a: '#4a5a34', b: '#6a4a5a', near: '#4a5a38', far: '#6c7470' }, sea: '#2a3640',
    road: '#3a3c40', barrier: 'stone', line: '#e8e8e8'
  },
  {
    id: 17, theme: 'morocco', kit: 'alps', from: 'Marrakech', to: 'Ouarzazate', country: 'Morocco',
    blurb: 'Out past the palm groves and over the High Atlas: earth-red kasbahs, snow on the peaks and a mountain pass of switchbacks.',
    time: 'Golden afternoon', weather: 'clear', seed: 17771, length: 8400, width: 11,
    narrow: { count: 3, w: 9.5 }, straight: [90, 300],
    mix: { sweep: 3, medium: 4, tight: 3, hairpin: 3, chicane: 1 }, maxDev: 95,
    elev: 12, climb: 0.022, coast: null, hill: 150, grip: 1, gk: 'dirt', rock: '#8a4a2e', gravel: '#c89a6a', snowline: 170, cover: 0.15,
    grid: 12,
    sky: { top: '#3a70c0', hor: '#ffd8a8', bot: '#e8c098', sun: [-0.55, 0.3, 0.55], sunCol: '#ffd8a0', sunSize: 1.3, stars: 0 },
    fog: { col: '#eac8a0', near: 260, far: 1500 },
    light: { sky: '#ffe8c8', gnd: '#8a5030', hemi: 1.0, sun: '#ffd4a0', sunI: 2.2 },
    ground: { a: '#b8683a', b: '#c8844a', near: '#b07448', far: '#c89a7a' }, sea: null,
    road: '#55524e', barrier: 'armco', line: '#f4f4f4'
  },
  {
    id: 18, theme: 'cairo', kit: 'desert', from: 'Cairo', to: 'Giza', country: 'Egypt',
    blurb: 'Minarets and sandstone streets, then the desert opens and the pyramids rise out of the sunset haze. Big straights, brutal stops.',
    time: 'Hazy sunset', weather: 'clear', seed: 18881, length: 8800, width: 12,
    narrow: { count: 3, w: 10 }, straight: [180, 460],
    mix: { sweep: 3, medium: 3, tight: 4, hairpin: 1, chicane: 3 }, maxDev: 80,
    elev: 5, climb: 0, coast: null, hill: 22, grip: 1, gk: 'sand', cover: 0.1,
    grid: 12,
    sky: { top: '#5a5490', hor: '#ffa868', bot: '#e8a874', sun: [0.25, 0.08, 0.95], sunCol: '#ffb070', sunSize: 2.4, stars: 0.1 },
    fog: { col: '#e8a878', near: 200, far: 1350 },
    light: { sky: '#ffc898', gnd: '#a8784a', hemi: 0.95, sun: '#ffac70', sunI: 1.9 },
    ground: { a: '#d6a868', b: '#e4bc80', near: '#c8a478', far: '#d8a878' }, sea: null,
    road: '#4e4a48', barrier: 'wall', line: '#f4f4f4'
  },
  {
    id: 19, theme: 'istanbul', from: 'Sultanahmet', to: 'Bosphorus', country: 'Türkiye',
    blurb: 'Dusk over two continents: floodlit domes and minarets, ferries on the strait and the great bridge lighting up as you race beneath it.',
    time: 'Dusk', weather: 'clear', seed: 19991, length: 8400, width: 11,
    narrow: { count: 4, w: 9.5 }, straight: [90, 280],
    mix: { sweep: 3, medium: 4, tight: 4, hairpin: 1, chicane: 3 }, maxDev: 85,
    elev: 14, climb: 0, coast: 'right', hill: 50, grip: 1, city: true, night: true, gk: 'pavement',
    grid: 12,
    sky: { top: '#1c1e4a', hor: '#e8784a', bot: '#3a2a3a', sun: [-0.2, 0.02, 0.98], sunCol: '#ff8a4a', sunSize: 1.4, stars: 0.3 },
    fog: { col: '#5a3a4a', near: 180, far: 1250 },
    light: { sky: '#c8a0c0', gnd: '#2a2028', hemi: 0.95, sun: '#ffa070', sunI: 0.8 },
    ground: { a: '#3a3a34', b: '#44443a', near: '#4a464a', far: '#2a2430' }, sea: '#1a2a48',
    road: '#3a3a40', barrier: 'stone', line: '#fdfdfd'
  },
  {
    id: 20, theme: 'himalaya', kit: 'alps', from: 'Manali', to: 'Rohtang Pass', country: 'India · Himalaya',
    blurb: 'The roof of the tour. Prayer flags snap in the snow as the road climbs through hairpin after hairpin under 6,000-metre peaks.',
    time: 'High-altitude snow', weather: 'snow', seed: 20201, length: 7800, width: 10,
    narrow: { count: 4, w: 9 }, straight: [60, 190],
    mix: { sweep: 2, medium: 3, tight: 4, hairpin: 5, chicane: 1 }, maxDev: 100,
    elev: 14, climb: 0.05, coast: null, hill: 260, grip: 0.88, gk: 'snow', rock: '#7a7c86',
    grid: 12,
    sky: { top: '#5a7aa8', hor: '#dde6f0', bot: '#e8eef4', sun: [0.4, 0.5, 0.35], sunCol: '#ffffff', sunSize: 0.5, stars: 0 },
    fog: { col: '#d0dae4', near: 110, far: 850 },
    light: { sky: '#eef4ff', gnd: '#9aa0aa', hemi: 1.2, sun: '#ffffff', sunI: 1.4 },
    ground: { a: '#eef2f6', b: '#d2dae2', near: '#e0e6ec', far: '#c4cedb', snow: true }, sea: null,
    road: '#4a4c52', barrier: 'armco', line: '#ffd84a'
  },

  /* --------------------------------------------------------- World Tour III
   * Legend rivals: near-perfect pace, late braking, full tow, almost no
   * rubber band. More night and rain. */
  {
    id: 21, theme: 'shanghai', from: 'The Bund', to: 'Pudong', country: 'China',
    blurb: 'Legend rivals now. Along the riverfront under a forest of glowing towers, then over the water into the financial district.',
    time: 'Night', weather: 'clear', seed: 21211, length: 8800, width: 12,
    narrow: { count: 3, w: 10 }, straight: [120, 360],
    mix: { sweep: 3, medium: 4, tight: 4, hairpin: 1, chicane: 4 }, maxDev: 85,
    elev: 4, climb: 0, coast: 'right', hill: 0, grip: 1, city: true, night: true, gk: 'pavement', neon: '#ff3a6a',
    grid: 12,
    sky: { top: '#060818', hor: '#3a2448', bot: '#100c1c', sun: [0.2, 0.5, 0.3], sunCol: '#000000', sunSize: 0, stars: 0.2 },
    fog: { col: '#2a1a38', near: 170, far: 1250 },
    light: { sky: '#a890ff', gnd: '#2a1830', hemi: 0.95, sun: '#d0c0ff', sunI: 0.55 },
    ground: { a: '#2a2a33', b: '#33333d', near: '#3a3a44', far: '#22202c' }, sea: '#101c38',
    road: '#36363c', barrier: 'neon', line: '#fdfdfd'
  },
  {
    id: 22, theme: 'seoul', from: 'Gangnam', to: 'Namsan Tower', country: 'South Korea',
    blurb: 'Neon in the rain. Streaming signs reflect off soaked asphalt while the field fights through tight city blocks towards the tower on the hill.',
    time: 'Night, rain', weather: 'rain', seed: 22223, length: 8200, width: 11,
    narrow: { count: 4, w: 9.5 }, straight: [80, 260],
    mix: { sweep: 1, medium: 4, tight: 5, hairpin: 1, chicane: 3 }, maxDev: 85,
    elev: 10, climb: 0.008, coast: null, hill: 30, grip: 0.87, city: true, night: true, gk: 'pavement', wet: true, neon: '#2fe0ff', cover: 0.9,
    grid: 12,
    sky: { top: '#0a0a16', hor: '#2c1c3a', bot: '#120c1a', sun: [0.2, 0.5, 0.3], sunCol: '#000000', sunSize: 0, stars: 0 },
    fog: { col: '#22182e', near: 130, far: 820 },
    light: { sky: '#8a7aff', gnd: '#281830', hemi: 0.95, sun: '#b8b0ff', sunI: 0.45 },
    ground: { a: '#2a2a33', b: '#33333d', near: '#383842', far: '#201e2a' }, sea: null,
    road: '#2e2e34', barrier: 'neon', line: '#fdfdfd'
  },
  {
    id: 23, theme: 'hongkong', from: 'Central', to: 'Victoria Peak', country: 'Hong Kong',
    blurb: 'Harbour lights and junks below, skyscrapers stacked up the slope, then the climb to the Peak through wet jungle hairpins.',
    time: 'Night', weather: 'clear', seed: 23231, length: 8000, width: 10.5,
    narrow: { count: 4, w: 9.2 }, straight: [70, 230],
    mix: { sweep: 2, medium: 4, tight: 5, hairpin: 3, chicane: 2 }, maxDev: 95,
    elev: 10, climb: 0.028, coast: 'left', hill: 120, grip: 1, city: true, night: true, gk: 'pavement', neon: '#ffcf2a',
    grid: 12,
    sky: { top: '#050a1a', hor: '#1e2c50', bot: '#0a1020', sun: [0.2, 0.5, 0.3], sunCol: '#000000', sunSize: 0, stars: 0.35 },
    fog: { col: '#16203a', near: 160, far: 1150 },
    light: { sky: '#90b0ff', gnd: '#182030', hemi: 1.0, sun: '#e0e8ff', sunI: 0.6 },
    ground: { a: '#24342a', b: '#2c4030', near: '#383a42', far: '#1a2030' }, sea: '#0a2040',
    road: '#38393e', barrier: 'neon', line: '#fdfdfd'
  },
  {
    id: 24, theme: 'kyoto', from: 'Kyoto', to: 'Arashiyama', country: 'Japan',
    blurb: 'Blazing autumn maples, red shrine gates and a five-storey pagoda. Narrow temple lanes and bamboo groves — precise or nothing.',
    time: 'Autumn afternoon', weather: 'clear', seed: 24241, length: 8000, width: 10,
    narrow: { count: 5, w: 9 }, straight: [70, 220],
    mix: { sweep: 2, medium: 4, tight: 5, hairpin: 2, chicane: 3 }, maxDev: 90,
    elev: 12, climb: 0, coast: null, hill: 90, grip: 1, gk: 'grass',
    grid: 12,
    sky: { top: '#3a74c4', hor: '#ffe0b8', bot: '#e8d4b8', sun: [-0.5, 0.35, 0.55], sunCol: '#ffd8a0', sunSize: 1.2, stars: 0 },
    fog: { col: '#ecd8bc', near: 220, far: 1300 },
    light: { sky: '#ffe8d0', gnd: '#6a4a2a', hemi: 1.0, sun: '#ffd8a8', sunI: 2.1 },
    ground: { a: '#7a7a3a', b: '#9a6a34', near: '#7a7040', far: '#a89a7a' }, sea: null,
    road: '#505056', barrier: 'stone', line: '#f4f4f4'
  },
  {
    id: 25, theme: 'route66', kit: 'outback', from: 'Kingman', to: 'Oatman', country: 'Arizona, USA',
    blurb: 'The Mother Road: endless straights between red mesas and telegraph poles, then the Black Mountains switchbacks into an old mining town.',
    time: 'Blazing midday', weather: 'clear', seed: 25251, length: 9200, width: 11,
    narrow: { count: 4, w: 9.5 }, straight: [200, 520],
    mix: { sweep: 2, medium: 3, tight: 4, hairpin: 3, chicane: 2 }, maxDev: 90,
    elev: 12, climb: 0.01, coast: null, hill: 70, grip: 1, gk: 'dirt', rock: '#9a4a2a', gravel: '#c8986a', cover: 0.1,
    grid: 12,
    sky: { top: '#1c64d8', hor: '#cfe4f8', bot: '#e8d0b0', sun: [0.15, 0.85, 0.3], sunCol: '#ffffff', sunSize: 0.9, stars: 0 },
    fog: { col: '#e2dcd4', near: 300, far: 1600 },
    light: { sky: '#e8f2ff', gnd: '#a0603a', hemi: 1.0, sun: '#fff4e0', sunI: 2.5 },
    ground: { a: '#c0784a', b: '#d29a62', near: '#b8885a', far: '#c8a08a' }, sea: null,
    road: '#4a4a4e', barrier: 'armco', line: '#ffd84a'
  },
  {
    id: 26, theme: 'miami', from: 'South Beach', to: 'Key Biscayne', country: 'Florida, USA',
    blurb: 'Pastel art-deco hotels glowing pink and teal, palms against the night surf, then the long causeway across the bay. Flat out and close.',
    time: 'Night', weather: 'clear', seed: 26261, length: 9000, width: 11,
    narrow: { count: 4, w: 9.5 }, straight: [140, 400],
    mix: { sweep: 3, medium: 4, tight: 4, hairpin: 1, chicane: 4 }, maxDev: 85,
    elev: 4, climb: 0, coast: 'left', hill: 0, grip: 1, city: true, night: true, gk: 'sand', neon: '#ff4ac0', beach: '#e8d8b0',
    grid: 12,
    sky: { top: '#0a0a24', hor: '#4a2058', bot: '#140c24', sun: [0.2, 0.5, 0.3], sunCol: '#000000', sunSize: 0, stars: 0.5 },
    fog: { col: '#2a1838', near: 170, far: 1250 },
    light: { sky: '#ff90e0', gnd: '#20182a', hemi: 0.95, sun: '#c0e8ff', sunI: 0.55 },
    ground: { a: '#5a5440', b: '#6a6248', near: '#4a4640', far: '#201a2a' }, sea: '#0c2848',
    road: '#36363c', barrier: 'neon', line: '#fdfdfd'
  },
  {
    id: 27, theme: 'rockies', kit: 'alps', from: 'Banff', to: 'Lake Louise', country: 'Canada',
    blurb: 'Golden aspens and dark pines below snow-capped giants, a turquoise glacier lake beside you. Long fast sweepers and late hairpins.',
    time: 'Crisp autumn morning', weather: 'clear', seed: 27271, length: 9400, width: 10.5,
    narrow: { count: 4, w: 9.2 }, straight: [90, 300],
    mix: { sweep: 3, medium: 4, tight: 4, hairpin: 3, chicane: 2 }, maxDev: 95,
    elev: 14, climb: 0.012, coast: 'right', hill: 220, grip: 1, gk: 'grass', rock: '#787c84', snowline: 130,
    grid: 12,
    sky: { top: '#2e6ec8', hor: '#d0e6f6', bot: '#d8e2e8', sun: [0.5, 0.45, -0.4], sunCol: '#fff8e8', sunSize: 0.9, stars: 0 },
    fog: { col: '#cddde8', near: 240, far: 1450 },
    light: { sky: '#e8f2ff', gnd: '#5a5030', hemi: 1.05, sun: '#fff4e0', sunI: 2.1 },
    ground: { a: '#6a7a3a', b: '#8a843e', near: '#66743c', far: '#8a9896' }, sea: '#2ab0b8',
    road: '#4c4e54', barrier: 'armco', line: '#ffd84a'
  },
  {
    id: 28, theme: 'mexico', from: 'Mexico City', to: 'Teotihuacán', country: 'Mexico',
    blurb: 'A tropical storm breaks over painted streets and agave fields as you race out to the ancient stepped pyramids. Soaked, slippery, savage.',
    time: 'Afternoon storm', weather: 'rain', seed: 28281, length: 9200, width: 10.5,
    narrow: { count: 5, w: 9.2 }, straight: [90, 300],
    mix: { sweep: 2, medium: 4, tight: 5, hairpin: 2, chicane: 3 }, maxDev: 90,
    elev: 10, climb: 0, coast: null, hill: 60, grip: 0.86, gk: 'dirt', wet: true, rock: '#6a5a4a',
    grid: 12,
    sky: { top: '#3c444c', hor: '#8a9088', bot: '#7a7c74', sun: [0.2, 0.5, -0.6], sunCol: '#d8dcd4', sunSize: 0, stars: 0 },
    fog: { col: '#7c827c', near: 80, far: 680 },
    light: { sky: '#bcc4bc', gnd: '#4a3e30', hemi: 1.15, sun: '#dce2dc', sunI: 0.75 },
    ground: { a: '#6a6a3a', b: '#7a6a44', near: '#5e5a40', far: '#6c706a' }, sea: null,
    road: '#3a3c40', barrier: 'tecpro', line: '#f0f0f0'
  },
  {
    id: 29, theme: 'patagonia', kit: 'alps', from: 'El Calafate', to: 'Fitz Roy', country: 'Argentina',
    blurb: 'The end of the world: windswept golden steppe, a milky-blue glacier lake and granite spires lit orange by the evening sun.',
    time: 'Windy evening', weather: 'clear', seed: 29291, length: 9600, width: 10,
    narrow: { count: 5, w: 9 }, straight: [100, 340],
    mix: { sweep: 3, medium: 4, tight: 5, hairpin: 3, chicane: 2 }, maxDev: 95,
    elev: 14, climb: 0.006, coast: 'left', hill: 140, grip: 0.97, gk: 'dirt', rock: '#6c6a6a', gravel: '#b8a07a', snowline: 160, cover: 0.5,
    grid: 12,
    sky: { top: '#3a5c94', hor: '#f4c89a', bot: '#d8b898', sun: [0.65, 0.14, 0.7], sunCol: '#ffc888', sunSize: 1.5, stars: 0 },
    fog: { col: '#dcc4ac', near: 260, far: 1500 },
    light: { sky: '#f8e2c8', gnd: '#7a6440', hemi: 1.0, sun: '#ffc890', sunI: 2.0 },
    ground: { a: '#a8904e', b: '#c0a462', near: '#9e8a52', far: '#a8a49a' }, sea: '#6ab0c8',
    road: '#505054', barrier: 'armco', line: '#f4f4f4'
  },
  {
    id: 30, theme: 'abudhabi', kit: 'desert', from: 'Yas Marina', to: 'Saadiyat', country: 'Abu Dhabi · UAE',
    blurb: 'The grand finale at twilight: under the glowing hotel canopy, past the marina superyachts and along the floodlit corniche. Beat the Legends.',
    time: 'Twilight, floodlit', weather: 'clear', seed: 30301, length: 11200, width: 11,
    narrow: { count: 5, w: 9.2 }, straight: [110, 380],
    mix: { sweep: 3, medium: 4, tight: 5, hairpin: 2, chicane: 4 }, maxDev: 90,
    elev: 5, climb: 0, coast: 'right', hill: 0, grip: 1, city: true, night: true, gk: 'sand', neon: '#c890ff', dunes: false,
    grid: 12,
    sky: { top: '#0c1440', hor: '#c8508a', bot: '#2a1838', sun: [0.15, 0.01, 0.98], sunCol: '#ff7a8a', sunSize: 1.2, stars: 0.4 },
    fog: { col: '#3a2448', near: 180, far: 1300 },
    light: { sky: '#c8a8ff', gnd: '#2a2030', hemi: 1.0, sun: '#ffb0c0', sunI: 0.7 },
    ground: { a: '#7a6248', b: '#8a704e', near: '#4a4448', far: '#2a2034' }, sea: '#122a50',
    road: '#38383e', barrier: 'neon', line: '#fdfdfd'
  }
];

/* ------------------------------------------------------------ rival tiers
 * The tour has four named classes of rival driver. Races 1-10 keep their
 * original behaviour exactly; from race 11 every parameter ramps smoothly
 * so each race is a little harder than the one before. */
export const AI_TIERS = [
  { key: 'rookie', name: 'Rookie', from: 1, col: '#20d070' },
  { key: 'pro', name: 'Pro', from: 6, col: '#3a8bff' },
  { key: 'elite', name: 'Elite', from: 11, col: '#b14cff' },
  { key: 'legend', name: 'Legend', from: 21, col: '#ffcb3a' }
];
export const tierOfLevel = L => AI_TIERS.reduce((t, x) => (L.id >= x.from ? x : t), AI_TIERS[0]);

/* Race pace of the field (the median rival's share of the ideal speed
 * profile) for races 11-30, tuned with the autopilot sweep so the podium
 * threshold climbs steadily. */
const PACE = [0.941, 0.942, 0.9385, 0.958, 0.939, 0.9465, 0.940, 0.951, 0.951, 0.968,
  0.952, 0.949, 0.960, 0.970, 0.949, 0.948, 0.9655, 0.963, 0.971, 0.963];

/* Behaviour of the rivals in race L. */
export function aiOf(L) {
  const tier = tierOfLevel(L);
  if (L.id <= 10) return { tier, k: 0, pace: L.ai, spread: L.aiSpread, corner: 37, brake: 30, bandAhead: 0.022, bandBehind: 0.022, tow: 1.2, towRange: 30, towAny: false, passLook: 2.2, passGap: 7, margin: 2.7, defend: 0, react: [0.15, 0.35], top: 0 };
  const k = Math.min(1, (L.id - 11) / 19);
  return {
    tier, k,
    pace: PACE[L.id - 11],              // median rival speed vs the ideal profile
    spread: 0.07 - 0.02 * k,            // the pack gets tighter
    corner: 37 + 1.3 * k,               // lateral grip used (better lines, later apexes)
    brake: 30 + 2 * k,                  // later, harder braking
    bandAhead: 0.016 - 0.013 * k,       // how much a leading rival backs off for you
    bandBehind: 0.022,                  // how hard a trailing rival pushes to catch up
    tow: 1.6 + 1.6 * k, towRange: 34 + 12 * k, towAny: true,   // slipstream use
    passLook: 2.2 + 1.8 * k, passGap: 7 - 2.2 * k, margin: 2.7 - 0.3 * k, // overtaking aggression
    defend: 0.4 + 0.6 * k,              // covering the inside when you attack
    react: [0.13 - 0.05 * k, 0.3 - 0.14 * k], // launch reaction
    top: k                              // a touch more straight-line speed
  };
}

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

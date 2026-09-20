/**
 * The six stops of the hunt.
 *
 * Each entry says how its real district should look (sky, light, building
 * materials), which real landmarks the three relics hide at, and the line each
 * relic adds to the journal. Read the three lines together and they name the
 * next city.
 *
 * Landmark lookups list several spellings; the first one found in the map data
 * wins, and anything not found falls back to an offset from the centre.
 */

export const CITIES = [
  {
    id: 'berlin',
    name: 'Berlin',
    where: 'Mitte, from the Brandenburg Gate to Potsdamer Platz',
    intro: 'The trail starts under the quadriga. Three marks were left along Unter den Linden.',
    theme: {
      skyTop: 0x2f5f9c, skyHorizon: 0xbcd0e0, skyGround: 0x3b4450, skyGlow: 0xffd9a8,
      glowDir: [-0.5, 0.25, -0.8], fog: 0xc3d2de, fogNear: 220, fogFar: 1900,
      sun: 0xfff0dc, sunIntensity: 6.0, sunDir: [-0.5, 0.92, -0.4],
      ambient: 0x93a8bd, ambientIntensity: 2.40, exposure: 1.15
    },
    look: {
      // Mitte: sandstone and cream plaster, red brick side streets, glass on
      // Potsdamer Platz, and the grey zinc roofs you see from any tower
      ground: 'concrete', groundTint: 0xa8a49b, road: 'asphalt', roadTint: 0x6f7175,
      path: 'tile', pathTint: 0xb0a99c, green: 'foliage', greenTint: 0x86b75f, water: 0x3f7fa8,
      wall: { house: 'plaster', block: 'plaster', civic: 'concrete', industrial: 'brick', monument: 'marble' },
      palette: {
        house: [0xe6dcc4, 0xd9c9a6, 0xe2d3bb, 0xcbb894, 0xdedbd2],
        block: [0xe8dfc9, 0xd6c8ab, 0xc9b596, 0xe3ded2, 0xb9a98e, 0xa8714f],
        civic: [0xc6ccd2, 0xaebac6, 0xd4d8da, 0x9fb0bd],
        industrial: [0x9d5f45, 0x8d5740, 0xb07254],
        monument: [0xe6dfcd, 0xdad2bd, 0xcfc6ae]
      },
      roof: { all: [0x5a5d61, 0x4c4f53, 0x6a6d70, 0x7a6a5c] }, roofMat: 'tile'
    },
    spawn: { at: ['Brandenburger Tor'], offset: [95, 0], facing: Math.PI / 2 },
    relics: [
      { at: ['Brandenburger Tor'], name: 'Brass Quadriga Pin',
        clue: 'Scratched on the back: "Where the horses face east, count five columns."' },
      { at: ['Bundeskanzleramt', 'Reichstagskuppel', 'Reichstag'], name: 'River Bend Token',
        clue: 'A river bends around a glass dome on this token — and a word: CAESAR.' },
      { at: ['Kollhoff-Tower', 'Bahntower', 'Sony Europa Zentrale'], name: 'Steel Compass Rose',
        clue: 'The needle is stuck pointing south, to a city of seven hills.' }
    ],
    vault: { at: ['Brandenburger Tor'], offset: [120, -40], label: 'Map table under the colonnade' },
    next: 'Rome'
  },
  {
    id: 'rome',
    name: 'Rome',
    where: 'the Colosseum, the Forum and the Caelian hill',
    intro: 'Seven hills, one arena. The marks are cut into old stone here.',
    theme: {
      skyTop: 0x2a6bb5, skyHorizon: 0xdcc9a6, skyGround: 0x4a4335, skyGlow: 0xffcf8a,
      glowDir: [0.6, 0.3, -0.6], fog: 0xe0cfae, fogNear: 220, fogFar: 1900,
      sun: 0xfff2d2, sunIntensity: 6.0, sunDir: [0.55, 0.92, -0.2],
      ambient: 0xb9a98c, ambientIntensity: 2.40, exposure: 1.15
    },
    look: {
      // ochre, terracotta and burnt sienna walls under red pantile roofs
      ground: 'concrete', groundTint: 0xcfc4ac, road: 'asphalt', roadTint: 0x74706a,
      path: 'tile', pathTint: 0xb5a488, green: 'foliage', greenTint: 0x7fa855, water: 0x4f8f7a,
      wall: { house: 'plaster', block: 'plaster', civic: 'marble', industrial: 'brick', monument: 'marble' },
      palette: {
        house: [0xe0a96a, 0xd8945a, 0xe8c48a, 0xc97f4e, 0xefd9b0],
        block: [0xdfa463, 0xe7bd85, 0xcf8b55, 0xf0dcb8, 0xc06a44],
        civic: [0xe6dcc6, 0xd9cdb2, 0xefe6d2],
        industrial: [0xb26a45, 0x9d5c3c, 0xc47e55],
        monument: [0xe3d7bd, 0xd6c8a8, 0xcbbb98]
      },
      roof: { all: [0xb4573a, 0xa54e33, 0xc2653f, 0x8f4530] }, roofMat: 'tile'
    },
    spawn: { at: ['Colosseo', 'Colosseum', 'Anfiteatro Flavio'], offset: [70, 40], facing: -Math.PI / 2 },
    relics: [
      { at: ['Colosseo', 'Colosseum', 'Anfiteatro Flavio'], name: 'Arena Ticket Shard',
        clue: 'A broken clay tally, marked with a gate number and the word SAND.' },
      { at: ['Arco di Costantino', 'Arch of Constantine', 'Tempio di Venere e Roma'], name: 'Triumph Arch Seal',
        clue: 'Under the arch, a seal shows three triangles against a river.' },
      { at: ['Basilica di San Clemente', 'Ludus Magnus', 'Domus Aurea'], name: 'Lamp of the Lower Rooms',
        clue: 'An oil lamp from a room beneath a room. Its wick points to a desert.' }
    ],
    vault: { at: ['Colosseo', 'Colosseum'], offset: [-90, -30], label: 'Surveyor\'s table by the arena' },
    next: 'Cairo'
  },
  {
    id: 'cairo',
    name: 'Cairo',
    where: 'the Giza plateau, in the shadow of the pyramids',
    intro: 'Out past the last street, the sand starts and the old marks are sun-bleached.',
    theme: {
      skyTop: 0x2e79c4, skyHorizon: 0xf0d9a8, skyGround: 0x6e5a38, skyGlow: 0xffd48a,
      glowDir: [0.3, 0.4, 0.8], fog: 0xecd7a6, fogNear: 220, fogFar: 1900,
      sun: 0xfff4d6, sunIntensity: 6.0, sunDir: [0.3, 0.92, 0.3],
      ambient: 0xd8c197, ambientIntensity: 2.40, exposure: 1.15
    },
    look: {
      // the plateau: limestone, sand-coloured concrete and flat pale roofs
      ground: 'concrete', groundTint: 0xe2d4b0, road: 'asphalt', roadTint: 0x7d7566,
      path: 'sand', pathTint: 0xd9c091, green: 'foliage', greenTint: 0x789a4e, water: 0x3f86a0,
      wall: { house: 'plaster', block: 'plaster', civic: 'concrete', industrial: 'brick', monument: 'sand' },
      palette: {
        house: [0xdcc79b, 0xd2b989, 0xe6d6ae, 0xc9a877, 0xd8c8a4],
        block: [0xd9c091, 0xcbb07e, 0xe2d1a8, 0xbf9e6e],
        civic: [0xd5cdb8, 0xc6bda6, 0xe0d8c4],
        industrial: [0xb0916a, 0xa07f59],
        monument: [0xe8d5a6, 0xdcc894, 0xf0e0b8]
      },
      roof: { all: [0xc9b489, 0xb9a377, 0xa89468] }, roofMat: 'sand'
    },
    spawn: { at: ['Great Pyramid of Giza', 'Pyramid of Khufu', 'هرم خوفو'], offset: [140, 120], facing: -Math.PI / 4 },
    relics: [
      { at: ['Great Pyramid of Giza', 'Pyramid of Khufu', 'هرم خوفو'], name: 'Capstone Fragment',
        clue: 'Polished limestone, edged in gold leaf. A gull is scratched on the underside.' },
      { at: ['Great Sphinx of Giza', 'Sphinx', 'أبو الهول'], name: 'Lion Paw Amulet',
        clue: 'The amulet shows a lion facing sunrise, over water between two seas.' },
      { at: ['Pyramid of Khafre', 'Pyramid of Menkaure', 'هرم خفرع'], name: 'Star Shaft Key',
        clue: 'A key cut for a narrow shaft, and a dome with four minarets stamped in the bow.' }
    ],
    vault: { at: ['Great Sphinx of Giza', 'Sphinx'], offset: [60, 70], label: 'Excavation table on the sand' },
    next: 'Istanbul'
  },
  {
    id: 'istanbul',
    name: 'Istanbul',
    where: 'Sultanahmet, between the great mosque and the old palace',
    intro: 'Two seas, one hill of domes. The marks are set in marble and tile.',
    theme: {
      skyTop: 0x2b6aa8, skyHorizon: 0xd8d0c0, skyGround: 0x44484a, skyGlow: 0xffd2a0,
      glowDir: [-0.7, 0.3, 0.4], fog: 0xd6d4c8, fogNear: 220, fogFar: 1900,
      sun: 0xfff0d8, sunIntensity: 6.0, sunDir: [-0.6, 0.92, 0.2],
      ambient: 0xa9b2b8, ambientIntensity: 2.40, exposure: 1.15
    },
    look: {
      // Sultanahmet: pale pinks and yellows, red pantiles, lead-grey domes
      ground: 'tile', groundTint: 0xb3aca0, road: 'asphalt', roadTint: 0x726f6a,
      path: 'tile', pathTint: 0xb8ac99, green: 'foliage', greenTint: 0x6f9a4d, water: 0x2f7fa6,
      wall: { house: 'plaster', block: 'plaster', civic: 'concrete', industrial: 'brick', monument: 'marble' },
      palette: {
        house: [0xe8c9b0, 0xdcb59a, 0xefdcc0, 0xd6a58c, 0xe4d2ae],
        block: [0xe3c4a6, 0xd9b291, 0xeeddc4, 0xc99a7e, 0xb8846a],
        civic: [0xcfc8ba, 0xbdb6a6, 0xdcd6c8],
        industrial: [0xa86f52, 0x96613f],
        monument: [0xe0d6bd, 0xd2c6a8, 0xc2b79a]
      },
      roof: { all: [0xa85a3c, 0xb96a45, 0x8e5a48, 0x6f6f72] }, roofMat: 'tile'
    },
    spawn: { at: ['Ayasofya', 'Hagia Sophia', 'Ayasofya-i Kebir Cami-i Şerifi'], offset: [60, 60], facing: Math.PI / 2 },
    relics: [
      { at: ['Ayasofya', 'Hagia Sophia'], name: 'Mosaic Tessera',
        clue: 'One gold tile from a great dome, wrapped in paper marked "the cistern, column of tears".' },
      { at: ['Yerebatan Sarnıcı', 'Basilica Cistern', 'Sultan Ahmet Camii', 'Blue Mosque'], name: 'Cistern Coin',
        clue: 'A coin green with water. On the reverse: a wooden gate and a stone garden, far east.' },
      { at: ['Topkapı Sarayı', 'Topkapi Palace', 'Gülhane Parkı'], name: 'Tulip Seal',
        clue: 'A palace seal, a tulip inside a circle, and one word inked beside it: KYOTO.' }
    ],
    vault: { at: ['Ayasofya', 'Hagia Sophia'], offset: [-70, 40], label: 'Chart table in the square' },
    next: 'Kyoto'
  },
  {
    id: 'kyoto',
    name: 'Kyoto',
    where: 'the eastern hills, along the canal path below the temples',
    intro: 'A quiet quarter of timber and moss. The last marks before the sea crossing.',
    theme: {
      skyTop: 0x35618f, skyHorizon: 0xc9d6cd, skyGround: 0x3e4a3c, skyGlow: 0xffd7b4,
      glowDir: [0.2, 0.3, 0.9], fog: 0xc9d6cd, fogNear: 220, fogFar: 1900,
      sun: 0xffeedc, sunIntensity: 6.0, sunDir: [0.2, 0.92, 0.6],
      ambient: 0x9db3a4, ambientIntensity: 2.40, exposure: 1.15
    },
    look: {
      // dark cedar timber and white plaster under charcoal kawara tile roofs
      ground: 'dirt', groundTint: 0x9a927e, road: 'asphalt', roadTint: 0x6b6c68,
      path: 'dirt', pathTint: 0xa89a7c, green: 'foliage', greenTint: 0x5f9147, water: 0x4a8f80,
      wall: { house: 'wood', block: 'plaster', civic: 'concrete', industrial: 'wood', monument: 'wood' },
      palette: {
        house: [0x6f5236, 0x5c4229, 0x7d6042, 0xe4ddcc, 0x8a6b48],
        block: [0xded6c6, 0xcfc7b6, 0xbdb5a4, 0x9a8f7c],
        civic: [0xc8c6be, 0xb6b4ac, 0xd6d4cc],
        industrial: [0x6e5639, 0x5f4a30],
        monument: [0x6a4527, 0x7d5632, 0x8c6238]
      },
      roof: { all: [0x3f4448, 0x34383c, 0x4a5055, 0x5a5f5c] }, roofMat: 'tile'
    },
    spawn: { at: ['銀閣', '慈照寺', 'Ginkaku'], offset: [70, 60], facing: -Math.PI / 2 },
    relics: [
      { at: ['銀閣', '慈照寺', 'Ginkaku'], name: 'Sand Garden Rake Head',
        clue: 'Iron teeth still holding white grit. A wave pattern is filed into the shaft.' },
      { at: ['白沙村荘', '橋本関雪', '哲学の道', "Philosopher's Path"], name: 'Canal Path Lantern',
        clue: 'A stone lantern the size of a fist, its window cut in the shape of a mountain above a bay.' },
      { at: ['真正極楽寺', '真如堂', '平安神宮', '南禅寺'], name: 'Aqueduct Brick',
        clue: 'A brick from the old aqueduct, and under it in chalk: "the last stop is a statue over a bay".' }
    ],
    vault: { at: ['銀閣', '慈照寺'], offset: [-60, 50], label: 'Lacquer map box on the veranda' },
    next: 'Rio de Janeiro'
  },
  {
    id: 'rio',
    name: 'Rio de Janeiro',
    where: 'the Corcovado summit, above the forest',
    intro: 'The end of the road: a mountain of granite and trees, with the whole bay below.',
    theme: {
      skyTop: 0x1f5fb0, skyHorizon: 0xbfe0e8, skyGround: 0x2e4633, skyGlow: 0xffe0a8,
      glowDir: [0.8, 0.3, -0.3], fog: 0xbfe0e8, fogNear: 220, fogFar: 1900,
      sun: 0xfff6e2, sunIntensity: 6.0, sunDir: [0.7, 0.92, -0.2],
      ambient: 0x9fc0b4, ambientIntensity: 2.40, exposure: 1.15
    },
    look: {
      // the hillside: white and cream blocks, bright painted houses, red roofs,
      // and the deep green of the Tijuca forest
      ground: 'dirt', groundTint: 0x7f8f62, road: 'asphalt', roadTint: 0x6f7069,
      path: 'dirt', pathTint: 0xa89070, green: 'foliage', greenTint: 0x4f8f45, water: 0x2f8fb8,
      wall: { house: 'plaster', block: 'plaster', civic: 'concrete', industrial: 'concrete', monument: 'concrete' },
      palette: {
        house: [0xf0e6d2, 0xe8d9b8, 0xd9e8ea, 0xe9c9a0, 0xcfe0c2, 0xe6b9b0],
        block: [0xf2ece0, 0xe2dccc, 0xd6e2e6, 0xc9d8c2, 0xefd9b8],
        civic: [0xd8dcdc, 0xc6cccd, 0xe6eaea],
        industrial: [0xbdb8ae, 0xa9a49a],
        monument: [0xe0ddd6, 0xd2cfc8]
      },
      roof: { all: [0xb45a3c, 0xa8503a, 0x9c6b52, 0x6f7276] }, roofMat: 'tile'
    },
    spawn: { at: ['Cristo Redentor', 'Christ the Redeemer'], offset: [60, 60], facing: -Math.PI / 4 },
    relics: [
      { at: ['Cristo Redentor', 'Christ the Redeemer'], name: 'Soapstone Tile',
        clue: 'A tile from the statue\'s skin, warm to the touch, marked with a single arrow: down.' },
      { at: ['Corcovado', 'Estação do Corcovado', 'Trem do Corcovado'], name: 'Rack Railway Spike',
        clue: 'A cog-railway spike. Filed into it: "under the old platform, where the rails end".' },
      { at: ['Parque Nacional da Tijuca', 'Mirante Dona Marta', 'Paineiras'], name: 'Forest Survey Plate',
        clue: 'A surveyor\'s brass plate for a spot on the summit — the last mark on the road.' }
    ],
    vault: { at: ['Cristo Redentor', 'Christ the Redeemer'], offset: [-50, 70], label: 'The treasure of the Relic Road' },
    next: null
  }
];

export const byId = id => CITIES.find(c => c.id === id);
export const indexOf = id => CITIES.findIndex(c => c.id === id);

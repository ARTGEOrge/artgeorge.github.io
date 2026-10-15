/* Graphics tiers. Static settings (detail, density, terrain) are fixed when a
 * race is built; runtime settings (resolution, draw distance, shadows, bloom,
 * blur, reflections) can change on the fly when auto quality steps down. */
const dpr = () => (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1;

export const ORDER = ['low', 'medium', 'high', 'ultra'];

export const TIERS = {
  low: {
    name: 'low', pr: () => 0.72, draw: 0.72, terrainCell: 44, density: 0.55, carDetail: 'lo', carLodDist: 0,
    shadows: 0, shadowBox: 0, bloom: 'off', blur: false, reflections: false, clouds: false, weather: 500,
    particles: 0.6, extras: false, farLayer: false, water: 'flat', glows: false
  },
  medium: {
    name: 'medium', pr: () => 1, draw: 0.9, terrainCell: 32, density: 0.8, carDetail: 'lo', carLodDist: 0,
    shadows: 0, shadowBox: 0, bloom: 'off', blur: false, reflections: false, clouds: true, weather: 900,
    particles: 0.8, extras: true, farLayer: true, water: 'waves', glows: true
  },
  high: {
    name: 'high', pr: () => Math.min(dpr(), 1.5), draw: 1.05, terrainCell: 32, density: 1.0, carDetail: 'hi', carLodDist: 140,
    shadows: 1024, shadowBox: 70, bloom: 'night', blur: false, reflections: false, clouds: true, weather: 1200,
    particles: 1, extras: true, farLayer: true, water: 'waves', glows: true
  },
  ultra: {
    name: 'ultra', pr: () => Math.min(dpr(), 2), draw: 1.25, terrainCell: 26, density: 1.3, carDetail: 'hi', carLodDist: 220,
    shadows: 2048, shadowBox: 110, bloom: 'always', blur: true, reflections: true, clouds: true, weather: 1600,
    particles: 1.25, extras: true, farLayer: true, water: 'waves', glows: true
  }
};

export const tierAt = i => TIERS[ORDER[Math.max(0, Math.min(ORDER.length - 1, i))]];

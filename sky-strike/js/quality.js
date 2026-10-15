/* Graphics tiers. Build-time settings (terrain resolution, tree density,
 * particle budgets) are fixed when a mission is built; runtime settings
 * (resolution, shadows, bloom, draw distance) step down live under auto. */
const dpr = () => (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1;
export const ORDER = ['low', 'medium', 'high', 'ultra'];
export const TIERS = {
  low: { name: 'low', pr: () => Math.min(dpr(), 1) * 0.7, segs: 22, trees: 0.35, treeDist: 1300, shadows: 0, bloom: false, particles: 0.45, clouds: 0.4, draw: 0.75, lights: 2, decals: 40 },
  medium: { name: 'medium', pr: () => Math.min(dpr(), 1), segs: 30, trees: 0.65, treeDist: 1900, shadows: 0, bloom: 'night', particles: 0.7, clouds: 0.7, draw: 0.9, lights: 4, decals: 70 },
  high: { name: 'high', pr: () => Math.min(dpr(), 1.5), segs: 40, trees: 1, treeDist: 2600, shadows: 2048, shadowBox: 420, bloom: true, particles: 1, clouds: 1, draw: 1, lights: 6, decals: 110 },
  ultra: { name: 'ultra', pr: () => Math.min(dpr(), 2), segs: 52, trees: 1.35, treeDist: 3400, shadows: 4096, shadowBox: 650, bloom: true, particles: 1.3, clouds: 1.25, draw: 1.15, lights: 8, decals: 160 }
};

/**
 * Windows, sills and shopfronts, painted onto the extruded map buildings in
 * the shader.
 *
 * The footprints from the map are plain prisms, and their side UVs run however
 * the extruder felt like running them. So the facade is worked out from where
 * each pixel sits in the world instead: storeys from its height, window bays
 * from how far it is along the wall. Two per-vertex attributes carry what the
 * wall needs to know about its building:
 *
 *   aFacade  x  bay width in metres (0 = no windows: monuments, pyramids)
 *               -1 = dressed stone courses (the pyramids)
 *               -2 = stacked arcades (the Colosseum), storey height in y
 *            y  how much of each bay is glass (0..1)
 *            z  1 when the ground floor is a shopfront
 *            w  roof height, so the top storey stops short of the parapet
 *   aSeed       per-building number, so lit windows differ between neighbours
 *
 * On top of the glass and frames each wall gets: a string course at every
 * floor, stone surrounds, a mullion and transom in each window, shutters and
 * little balconies where the city has them, a door or two at street level,
 * shop signs with lettering over the shopfronts, grime toward the pavement,
 * and the sky reflected in the glass.
 *
 * `facade.night` is shared by every wall: 0 in daylight, 1 at night, when a
 * scatter of windows, most of the shops and their signs light up.
 * `facade.skyTop` / `facade.skyHorizon` are what the glass reflects.
 */
import * as THREE from 'three';

export const facade = {
  night: { value: 0 },
  skyTop: { value: new THREE.Color(0x3a6aa8) },
  skyHorizon: { value: new THREE.Color(0xbcd0e0) }
};

export const STOREY = 3.2;
const S = STOREY.toFixed(2);

const VERT_HEAD = /* glsl */`
attribute vec4 aFacade;
attribute float aSeed;
varying vec3 vFPos;
varying vec3 vFNorm;
varying vec4 vFacade;
varying float vFSeed;
`;

const VERT_BODY = /* glsl */`
vFPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vFNorm = normalize(mat3(modelMatrix) * objectNormal);
vFacade = aFacade;
vFSeed = aSeed;
`;

const FRAG_HEAD = /* glsl */`
uniform float uNight;
uniform vec3 uSkyTop, uSkyHor;
uniform vec4 uStyle;     // shutter colour, chance of shutters
uniform vec4 uStyle2;    // chance of a balcony, stone surrounds, grime
varying vec3 vFPos;
varying vec3 vFNorm;
varying vec4 vFacade;
varying float vFSeed;
float fHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float fBox(float v, float a, float b) { return step(a, v) * step(v, b); }
`;

/* Runs right after the wall texture and the building's colour are applied; sets fWin (0..1 glass),
 * fLit (this window has a light on), fWarm (which colour that light is) and
 * fSign (lettering that glows at night). */
const FRAG_WINDOWS = /* glsl */`
float fWin = 0.0, fLit = 0.0, fWarm = 1.0, fSign = 0.0;
vec3 fSignCol = vec3(1.0);
vec2 fTng = normalize(vec2(-vFNorm.z, vFNorm.x) + 1e-5);
float fAlong = dot(vFPos.xz, fTng);

if (vFacade.x < -0.5 && vFacade.x > -1.5) {
  // dressed limestone courses, each block a slightly different tone, the
  // joints dark; rougher and patchier where the casing has gone
  float row = floor(vFPos.y / 0.92);
  float fy = fract(vFPos.y / 0.92);
  float off = fHash(vec3(row, 3.0, vFSeed)) * 1.7;
  float bx = fract((fAlong + off) / 1.7);
  float blk = fHash(vec3(row, floor((fAlong + off) / 1.7), vFSeed));
  diffuseColor.rgb *= 0.86 + blk * 0.22;
  diffuseColor.rgb *= 1.0 - (1.0 - smoothstep(0.0, 0.07, fy)) * 0.45;   // the shadowed step under each course
  diffuseColor.rgb *= 1.0 - (1.0 - smoothstep(0.0, 0.025, min(bx, 1.0 - bx))) * 0.3;
  diffuseColor.rgb *= mix(1.0, 0.82, smoothstep(0.55, 0.9, fHash(vec3(floor(vFPos.y / 7.0), floor(fAlong / 9.0), 5.0))));
} else if (vFacade.x < -1.5) {
  // stacked arcades: an arch in every bay, half-columns between, a cornice
  // band over each tier and a solid attic at the top
  float st = vFacade.y;
  float tier = floor(vFPos.y / st), fy = fract(vFPos.y / st);
  float bay = 6.4, bx = fract(fAlong / bay);
  bool attic = vFPos.y > vFacade.w - st * 0.95;
  float ax = (bx - 0.5) * bay, ay = (fy - 0.56) * st;
  float open = attic ? 0.0 : step(abs(ax), 1.75) * step(0.04, fy) * (fy < 0.56 ? 1.0 : step(length(vec2(ax, ay)), 1.75));
  float col = 1.0 - smoothstep(0.0, 0.07, min(bx, 1.0 - bx));
  diffuseColor.rgb *= 1.0 + col * 0.18;
  float band = fBox(fy, 0.86, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.12, band);
  diffuseColor.rgb *= 1.0 - fBox(fy, 0.83, 0.86) * 0.35;
  // each voussoir ring round the arch reads lighter
  float ring = step(1.75, length(vec2(ax, ay))) * step(length(vec2(ax, ay)), 2.05) * step(0.56, fy);
  diffuseColor.rgb *= 1.0 + ring * 0.12;
  // the dark of the arcade inside, lighter deeper in where the next arch is lit
  vec3 inside = mix(vec3(0.07, 0.06, 0.05), diffuseColor.rgb * 0.45, smoothstep(0.1, 0.9, fy) * 0.5);
  diffuseColor.rgb = mix(diffuseColor.rgb, inside, open);
  // weathering: a patchy, sunburnt stone
  diffuseColor.rgb *= 0.88 + 0.16 * fHash(vec3(floor(fAlong / 2.1), floor(vFPos.y / 1.4), 9.0));
} else if (vFacade.x > 0.5 && abs(vFNorm.y) < 0.35) {
  float fl = floor(vFPos.y / ${S});
  float fy = fract(vFPos.y / ${S});
  float bay = vFacade.x;
  float bi = floor(fAlong / bay);
  float bx = fract(fAlong / bay);
  float hw = vFacade.y * 0.5;
  bool curtain = vFacade.y > 0.8;
  bool shop = fl < 0.5 && vFacade.z > 0.5;
  float cell = fHash(vec3(fl, bi, vFSeed));
  float cell2 = fHash(vec3(bi, fl * 1.7 + 3.0, vFSeed));
  // nothing in the parapet, nothing below the pavement
  float band = step(vFPos.y, vFacade.w - 1.1) * step(0.35, vFPos.y);

  // a door at street level now and then, where there is no shop
  bool door = !shop && !curtain && fl < 0.5 && fHash(vec3(bi, 7.0, vFSeed)) < 0.16;
  // a balcony on some upper floors: the window drops to a French door
  bool balc = !shop && !curtain && !door && fl > 0.5 && cell2 < uStyle2.x;

  float inX = shop ? fBox(bx, 0.05, 0.95) : fBox(bx, 0.5 - hw, 0.5 + hw);
  float y0 = shop ? 0.03 : balc ? 0.06 : door ? 0.0 : 0.30;
  float y1 = shop ? 0.74 : door ? 0.72 : 0.80;
  float inY = fBox(fy, y0, y1);
  fWin = inX * inY * band;

  fWarm = step(0.22, fract(cell * 7.31));
  fLit = shop ? step(cell, 0.82) : step(cell, 0.34);

  // the wall itself: a string course at each floor and a darker plinth
  if (!curtain) {
    float course = fBox(fy, 0.0, 0.035) * step(0.5, fl);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.16 + 0.03, course);
    diffuseColor.rgb *= 1.0 - fBox(fy, 0.035, 0.07) * step(0.5, fl) * 0.22;
  }
  float plinth = 1.0 - step(0.75, vFPos.y);
  diffuseColor.rgb *= 1.0 - plinth * 0.2;
  diffuseColor.rgb *= 1.0 - fBox(vFPos.y, 0.75, 0.82) * 0.3;
  // grime: darker toward the pavement, a soot line under the roof
  diffuseColor.rgb *= 1.0 - (1.0 - smoothstep(0.0, 2.4, vFPos.y)) * uStyle2.z;
  diffuseColor.rgb *= 1.0 - smoothstep(vFacade.w - 2.2, vFacade.w - 0.6, vFPos.y) * 0.12;

  // glass: dark, a little bluer toward the top; some blinds half down
  vec3 glass = mix(vec3(0.045, 0.06, 0.08), vec3(0.20, 0.25, 0.31), smoothstep(y0, y1, fy));
  float blind = step(0.72, cell) * step(mix(y0, y1, 0.58), fy) * (shop ? 0.0 : 1.0);
  glass = mix(glass, mix(vec3(0.66, 0.6, 0.5), vec3(0.72, 0.68, 0.62), fract(cell * 13.0)), blind);
  // the reveal: glass in shadow just inside the top and one side of the frame
  float wx = (bx - 0.5) * bay, wy = (fy - y0) * ${S};
  float halfW = shop ? 0.45 * bay : hw * bay;
  glass *= 1.0 - (1.0 - smoothstep(0.0, 0.14, (y1 - fy) * ${S})) * 0.5;
  glass *= 1.0 - (1.0 - smoothstep(0.0, 0.1, wx + halfW)) * 0.35;
  if (shop) {
    // a shop interior: shelves and the backs of things behind the glass
    float shelf = fBox(fract(fy * 3.2), 0.0, 0.06) * step(0.18, fy);
    glass = mix(vec3(0.06, 0.07, 0.075), vec3(0.17, 0.18, 0.19), fy) * (1.0 - shelf * 0.5);
    glass += vec3(0.05, 0.04, 0.03) * step(0.5, fract(fAlong * 1.3 + cell * 3.0)) * step(fy, 0.6);
  }
  if (door) glass = mix(vec3(0.16, 0.1, 0.06), vec3(0.22, 0.14, 0.08), fract(cell * 5.0)) *
                    (1.0 - fBox(abs(wx), 0.0, 0.03) * 0.5);

  // glazing bars: a mullion down the middle and a transom near the top
  float bars = 0.0;
  if (!curtain && !door) {
    bars = max(step(abs(wx), shop ? 0.04 : 0.035) * (shop ? step(0.5, fract(bi * 0.5 + 0.25)) : 1.0),
               step(abs(fy - mix(y0, y1, 0.74)) * ${S}, 0.03));
  } else if (curtain) {
    bars = max(step(min(bx, 1.0 - bx) * bay, 0.05), step(abs(fy - 0.27) * ${S}, 0.04));
    // spandrel panels between the floors of a curtain wall
    glass = mix(glass, vec3(0.09, 0.11, 0.13), step(fy, 0.27));
  }
  glass = mix(glass, diffuseColor.rgb * 0.7 + vec3(0.04), bars * fWin);

  // the frame: a thin darker border just outside the glass
  float pad = shop ? 0.02 : 0.035;
  float frX = shop ? fBox(bx, 0.05 - pad, 0.95 + pad) : fBox(bx, 0.5 - hw - pad, 0.5 + hw + pad);
  float frY = fBox(fy, y0 - (shop ? 0.03 : 0.03), y1 + 0.03);
  float frame = frX * frY * band * (1.0 - fWin);
  diffuseColor.rgb *= 1.0 - frame * 0.42;

  // stone surrounds: a lintel over each upstairs window and a pale sill under it
  if (!shop && !curtain) {
    float sur = uStyle2.y;
    float lint = fBox(bx, 0.5 - hw - 0.07, 0.5 + hw + 0.07) * fBox(fy, y1 + 0.03, y1 + 0.085) * band;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (1.0 + 0.3 * sur) + 0.05 * sur, lint);
    float key = step(abs(wx), 0.13) * fBox(fy, y1 + 0.03, y1 + 0.11) * band * sur;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.3 + 0.06, key);
    float sill = fBox(bx, 0.5 - hw - 0.06, 0.5 + hw + 0.06) * fBox(fy, y0 - 0.065, y0 - 0.03) * band * (balc ? 0.0 : 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.22 + 0.04, sill);
    // the shadow the sill throws on the wall below it
    diffuseColor.rgb *= 1.0 - fBox(bx, 0.5 - hw - 0.05, 0.5 + hw + 0.05) * fBox(fy, y0 - 0.12, y0 - 0.065) * band * 0.25;
    // rain streaks down from the corners of each sill
    float streak = fBox(abs(abs(wx) - halfW), 0.0, 0.05) * step(fy, y0 - 0.06) * step(y0 - 0.5, fy) * band;
    diffuseColor.rgb *= 1.0 - streak * 0.12 * uStyle2.z * 4.0;
  }

  // shutters, folded back each side of the window
  if (!shop && !curtain && !door && cell2 > 1.0 - uStyle.w) {
    float sw = hw * 0.5;
    float sx = max(fBox(bx, 0.5 - hw - sw - 0.01, 0.5 - hw - 0.012), fBox(bx, 0.5 + hw + 0.012, 0.5 + hw + sw + 0.01));
    float sh = sx * fBox(fy, y0, y1) * band;
    float louvre = step(0.55, fract(fy * ${S} / 0.07));
    vec3 shut = uStyle.rgb * (0.85 + louvre * 0.2) * (0.9 + fract(cell * 31.0) * 0.2);
    diffuseColor.rgb = mix(diffuseColor.rgb, shut, sh);
  }

  // a balcony: the slab, its shadow, and a railing of iron bars
  if (balc) {
    float bw = hw + 0.09;
    float inB = fBox(bx, 0.5 - bw, 0.5 + bw);
    float slab = inB * fBox(fy, 0.0, 0.05) * band;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.15 + 0.04, slab);
    float rail = inB * fBox(fy, 0.05, 0.36) * band;
    float bar = step(0.75, fract(wx / 0.12)) + fBox(fy, 0.33, 0.36);
    float rr = rail * clamp(bar, 0.0, 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.06, 0.065), rr);
    glass = mix(glass, glass * 0.6, rail);
    fWin *= 1.0 - rr;
  }

  // a shop's fascia over its window: a painted board and its lettering
  if (shop) {
    float board = fBox(fy, 0.78, 0.93) * band;
    float grp = floor(bi / 2.0);
    float h = fHash(vec3(grp, 11.0, vFSeed));
    vec3 paint = h < 0.25 ? vec3(0.08, 0.2, 0.14) : h < 0.5 ? vec3(0.32, 0.06, 0.07) :
                 h < 0.75 ? vec3(0.06, 0.09, 0.2) : vec3(0.05, 0.05, 0.05);
    diffuseColor.rgb = mix(diffuseColor.rgb, paint, board);
    float lx = fract(fAlong / (bay * 2.0));
    float word = fBox(lx, 0.14, 0.86) * fBox(fy, 0.815, 0.895);
    float glyph = step(0.42, fract(fAlong * 2.3 + h * 7.0)) * step(0.18, fract(fAlong * 0.71 + h * 3.0));
    float letters = board * word * glyph;
    fSignCol = h < 0.5 ? vec3(0.98, 0.86, 0.55) : vec3(0.95, 0.95, 0.92);
    diffuseColor.rgb = mix(diffuseColor.rgb, fSignCol, letters);
    fSign = letters;
    // and a deep shadow line where the board overhangs the window
    diffuseColor.rgb *= 1.0 - fBox(fy, 0.745, 0.78) * band * 0.5;
  }

  diffuseColor.rgb = mix(diffuseColor.rgb, glass, fWin);
}
`;

export function patchFacade(mat, style = {}) {
  const shutter = new THREE.Color(style.shutter ?? 0x3f5a3a);
  const uStyle = { value: new THREE.Vector4(shutter.r, shutter.g, shutter.b, style.shutters ?? 0) };
  const uStyle2 = { value: new THREE.Vector4(style.balconies ?? 0.1, style.surrounds ?? 0.6, style.grime ?? 0.16, 0) };
  mat.onBeforeCompile = shader => {
    shader.uniforms.uNight = facade.night;
    shader.uniforms.uSkyTop = facade.skyTop;
    shader.uniforms.uSkyHor = facade.skyHorizon;
    shader.uniforms.uStyle = uStyle;
    shader.uniforms.uStyle2 = uStyle2;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      // after the building's own colour is applied, so glass stays glass
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_WINDOWS)
      // glass is smooth, and flat: the wall's bump map should not ripple it
      .replace('#include <roughnessmap_fragment>',
               '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.16, fWin);')
      .replace('#include <normal_fragment_maps>',
               '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, fWin));')
      // a lit room, not a lamp: saturated and well under white, or tone
      // mapping at night exposure flattens every window to the same glare.
      // By day the glass picks up the sky instead.
      .replace('#include <emissivemap_fragment>',
               `#include <emissivemap_fragment>
                vec3 fGlow = mix(vec3(0.46, 0.58, 0.86), vec3(0.95, 0.56, 0.24), fWarm);
                float fBright = (vFPos.y < ${S} && vFacade.z > 0.5) ? 0.85 : 0.6;
                fBright *= 0.75 + 0.5 * fract(vFSeed * 0.37 + floor(vFPos.y / ${S}) * 0.61);
                totalEmissiveRadiance += fGlow * fWin * fLit * uNight * fBright;
                totalEmissiveRadiance += fSignCol * fSign * smoothstep(0.3, 0.8, uNight) * 1.1;
                vec3 fV = normalize(cameraPosition - vFPos);
                vec3 fR = reflect(-fV, normalize(vFNorm));
                float fFres = 0.06 + 0.5 * pow(1.0 - max(dot(fV, normalize(vFNorm)), 0.0), 4.0);
                vec3 fSky = mix(uSkyHor, uSkyTop, smoothstep(-0.05, 0.6, fR.y));
                fSky = mix(fSky * 0.35, fSky, smoothstep(-0.1, 0.05, fR.y));   // the street below, in the low half
                totalEmissiveRadiance += fSky * fWin * fFres * (1.0 - fLit * uNight) * 0.55;`);
  };
  mat.customProgramCacheKey = () => 'relic-facade-2';
  return mat;
}

/** How each kind of building's walls are divided up. */
const KINDS = {
  house:      { bay: 2.6, glass: 0.42, shop: 0.0 },
  block:      { bay: 3.0, glass: 0.46, shop: 0.72 },
  civic:      { bay: 2.4, glass: 0.66, shop: 0.35 },
  industrial: { bay: 5.2, glass: 0.44, shop: 0.0 },
  // old stone landmarks: a few tall, narrow windows far apart
  monument:   { bay: 4.4, glass: 0.24, shop: 0.0 }
};

/**
 * Give one extruded building its facade attributes.
 * `nearStreet` says whether a shopfront makes sense here at all.
 * `special` is 'pyramid' or 'arcade' for the landmarks that get their own walls.
 */
export function facadeAttributes(geo, kind, height, seed, nearStreet, special = null) {
  const k = KINDS[kind] || KINDS.block;
  let bay = k.bay, glass = k.glass;
  // tall offices read as curtain walls, not punched windows
  if (kind === 'civic' && height > 38) { bay = 1.6; glass = 0.86; }
  // low sheds and walls with nothing to see
  if (height < 3.4) bay = 0;
  // low ruins and tombs: bare stone
  if (kind === 'monument' && height < 8) bay = 0;
  let shop = nearStreet && height >= 6 && (seed % 1) < k.shop ? 1 : 0;
  if (special === 'pyramid') { bay = -1; glass = 0; shop = 0; }
  if (special === 'arcade') { bay = -2; glass = Math.max(8, height / 4); shop = 0; }

  const n = geo.attributes.position.count;
  const f = new Float32Array(n * 4), s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    f[i * 4] = bay; f[i * 4 + 1] = glass; f[i * 4 + 2] = shop; f[i * 4 + 3] = height;
    s[i] = seed * 97.13;
  }
  geo.setAttribute('aFacade', new THREE.BufferAttribute(f, 4));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
  return shop;
}

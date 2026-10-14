/**
 * The sky over each city: a proper daylight dome with a sun you can find, a
 * bright haze round it, drifting fair-weather clouds, a warm band at dusk, and
 * the moon and stars after dark.
 *
 * Everything is one shader on a sphere that follows the viewer, so it costs a
 * single draw call. Its uniforms are driven by game.js through setSky():
 *   sunDir   where the sun is (the same direction the scene's light comes from)
 *   night    0 in daylight, 1 at night
 *   dusk     0..1, how much sunset colour to pour into the horizon
 */
import * as THREE from 'three';

const VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;   // always at the far plane
  }`;

const FRAG = /* glsl */`
  varying vec3 vDir;
  uniform vec3 top, horizon, ground, glow, sunColor, duskColor;
  uniform vec3 sunDir, moonDir, glowDir;
  uniform float time, night, dusk, cloudCover, stars;

  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return s;
  }

  void main() {
    vec3 d = normalize(vDir);
    float up = d.y;
    vec3 sd = normalize(sunDir);
    float sunDot = max(dot(d, sd), 0.0);

    // the dome: horizon colour low down, deepening overhead
    float h = clamp(up, 0.0, 1.0);
    vec3 col = mix(horizon, top, pow(h, 0.55));
    // a bright band of haze sitting on the horizon all the way round
    col = mix(col, horizon * 1.08 + 0.03, exp(-max(up, 0.0) * 14.0) * 0.55 * (1.0 - night));
    // sunset: the horizon glows on the sun's side, and a little all round
    float duskSide = pow(max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-4), normalize(vec3(sd.x, 0.0, sd.z) + 1e-4)), 0.0), 2.0);
    col = mix(col, duskColor, dusk * exp(-max(up, 0.0) * 5.0) * (0.35 + 0.65 * duskSide));
    // forward scattering round the sun
    col += sunColor * (pow(sunDot, 6.0) * 0.18 + pow(sunDot, 48.0) * 0.35) * (1.0 - night * 0.9);
    // the city's own glow low on one side (light pollution at night)
    col += glow * pow(max(0.0, dot(d, normalize(glowDir))), 8.0) * (0.25 + night * 0.75);

    // stars, twinkling, only well above the haze
    if (stars > 0.0) {
      vec3 sp = d * 420.0;
      vec3 cell = floor(sp);
      float s = pow(hash3(cell), 260.0);
      vec3 f = fract(sp) - 0.5;
      s *= smoothstep(0.5, 0.06, length(f)) * 1.8;
      s *= 0.65 + 0.35 * sin(time * (1.5 + hash3(cell + 3.1) * 3.0) + hash3(cell) * 40.0);
      col += vec3(s) * stars * smoothstep(0.04, 0.4, up);
      // a faint milky band
      float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.2, 1.0))) * 3.2, 2.0));
      col += vec3(0.05, 0.06, 0.09) * band * fbm(d.xz * 9.0 / (abs(up) + 0.3)) * stars * smoothstep(0.05, 0.4, up);
    }

    // clouds: a layer seen in perspective, drifting with the wind
    if (up > 0.0) {
      vec2 uv = d.xz / (up + 0.09) * 1.15 + vec2(time * 0.006, time * 0.0025);
      float n = fbm(uv * 1.3);
      float n2 = fbm(uv * 3.1 + 4.0);
      float dens = smoothstep(1.0 - cloudCover, 1.18 - cloudCover * 0.6, n * 0.75 + n2 * 0.35);
      dens *= smoothstep(0.0, 0.22, up);
      // lit from the sun's side: bright rims, soft grey bellies
      float lit = 0.72 + 0.28 * smoothstep(0.2, 0.9, n2) + pow(sunDot, 4.0) * 0.4;
      vec3 day = mix(vec3(0.80, 0.83, 0.88), vec3(1.0, 0.99, 0.96), lit) * mix(vec3(1.0), sunColor, 0.25);
      vec3 sunset = mix(duskColor * 0.9, vec3(1.0, 0.82, 0.62), lit * duskSide);
      vec3 dark = mix(vec3(0.05, 0.06, 0.09), vec3(0.16, 0.14, 0.13), lit * 0.5) + glow * 0.12;
      vec3 cc = mix(day, sunset, dusk * 0.85);
      cc = mix(cc, dark, night);
      col = mix(col, cc, dens * 0.92);
    }

    // the sun itself, and its glare
    float disc = smoothstep(0.99955, 0.99975, sunDot);
    col += sunColor * disc * 6.0 * (1.0 - night) * smoothstep(-0.03, 0.02, sd.y);
    col += sunColor * pow(sunDot, 900.0) * 1.2 * (1.0 - night);

    // the moon: a pale disc with a hint of maria, and a soft halo
    vec3 md = normalize(moonDir);
    float mDot = max(dot(d, md), 0.0);
    float moon = smoothstep(0.99925, 0.9995, mDot);
    float mar = fbm((d.xy - md.xy) * 900.0) * 0.35;
    col = mix(col, vec3(0.92, 0.93, 0.88) * (1.0 - mar), moon * night);
    col += vec3(0.30, 0.34, 0.42) * pow(mDot, 220.0) * 0.6 * night;

    // below the horizon: the ground colour, so a low view never shows a void
    col = mix(ground, col, smoothstep(-0.06, 0.015, up));
    gl_FragColor = vec4(col, 1.0);
  }`;

export function makeSky(theme) {
  const geo = new THREE.SphereGeometry(1, 40, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(theme.skyTop) },
      horizon: { value: new THREE.Color(theme.skyHorizon) },
      ground: { value: new THREE.Color(theme.skyGround) },
      glow: { value: new THREE.Color(theme.skyGlow || 0x000000) },
      glowDir: { value: new THREE.Vector3(...(theme.glowDir || [0.4, 0.2, -1])) },
      sunColor: { value: new THREE.Color(theme.sun || 0xfff0d8) },
      duskColor: { value: new THREE.Color(0xff8a4a) },
      sunDir: { value: new THREE.Vector3(...(theme.sunDir || [0.3, 0.9, 0.3])).normalize() },
      moonDir: { value: new THREE.Vector3(-0.35, 0.55, -0.75).normalize() },
      time: { value: 0 }, night: { value: 0 }, dusk: { value: 0 },
      cloudCover: { value: theme.clouds ?? 0.42 }, stars: { value: 0 }
    },
    vertexShader: VERT, fragmentShader: FRAG
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(900);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

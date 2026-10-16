/* Demon Fall — the escape flights.
 *
 * After boarding, the game swaps to this scene: you fly the ship out, shooting
 * through debris, and set down at the destination. It is its own little arcade
 * game with its own scene, so nothing from the shooter has to be unloaded
 * mid-cutscene. Two routes share it:
 *   'mars' — Earth falls away behind, rift debris, land at the Tharsis colony
 *   'moon' — Mars falls away, a field of wrecked transports, land at Artemis
 *            (a little longer and denser: the campaign keeps getting harder)
 * and three more out past the Moon, each denser than the last:
 *   'venus'   — Earth falls away, Hive spore-pods drifting sunward, down through the yellow haze
 *   'jupiter' — Venus falls away, the asteroid belt, down onto the refinery over the cloud tops
 *   'neptune' — Jupiter falls away, a field of ice, down into the blue methane dark */
import * as THREE from 'three';
import { material, puffTexture } from './textures.js';
import { planetTexture } from './outer-kit.js';
import { clamp, damp, randRange, TAU, makeRng } from './util.js';
import * as audio from './audio.js';

const LANDING_TIME = 13;

export const ROUTES = {
  mars: {
    name: 'MARS', title: 'Mars', length: 62, density: 1, rockHp: 1, seed: 20260915,
    debrisText: 'Rift debris ahead — clear a path', approachText: 'Mars approach — hold her steady',
    failText: 'The ship broke up in the debris field'
  },
  moon: {
    name: 'MOON', title: 'the Moon', length: 58, density: 1.3, rockHp: 1.25, seed: 20261014,
    debrisText: 'Wrecked evac ships ahead — clear a path', approachText: 'Lunar approach — no air to brake, hold her steady',
    failText: 'The ship broke up in the wreckage field'
  },
  venus: {
    name: 'VENUS', title: 'Venus', length: 60, density: 1.45, rockHp: 1.3, seed: 20261101,
    debrisText: 'Hive spore-pods drifting sunward — burn a path', approachText: 'Venus entry — ninety atmospheres, hold her steady',
    failText: 'The ship broke up among the spore-pods',
    from: 'earth', halo: 0xffe0a0, debris: ['flesh', 0x9aa03a], dust: 0xd8c070,
    fog: 0xc8a050, fogDensity: 0.0042, surface: ['sulfur', 0xd8c890]
  },
  jupiter: {
    name: 'JUPITER', title: 'Jupiter', length: 64, density: 1.6, rockHp: 1.4, seed: 20261115, radius: 170,
    debrisText: 'The asteroid belt — clear a path', approachText: 'Jupiter approach — storms below, hold her steady',
    failText: 'The ship broke up in the asteroid belt',
    from: 'venus', halo: 0xffc890, debris: ['redrock', 0x7a6a5a], dust: 0xc89a6a,
    fog: 0x8a6440, fogDensity: 0.0032, surface: ['cloud', 0xd8a878], lightning: true
  },
  neptune: {
    name: 'NEPTUNE', title: 'Neptune', length: 66, density: 1.75, rockHp: 1.5, seed: 20261130,
    debrisText: 'Ice field ahead — shoot it apart', approachText: 'Neptune entry — methane storms, hold her steady',
    failText: 'The ship broke up in the ice field',
    from: 'jupiter', halo: 0x6aa0ff, debris: ['ice', 0xbfdcff], dust: 0xc8dcff,
    fog: 0x1a3a7a, fogDensity: 0.0038, surface: ['ice', 0xa8c8f0], ring: 0x9ab8e8
  }
};

export class MarsFlight {
  constructor(hud, opts = {}) {
    this.hud = hud;
    this.dest = ROUTES[opts.dest] ? opts.dest : 'mars';
    this.route = ROUTES[this.dest];
    this.destName = this.route.name;
    this.length = this.route.length;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 6000);
    this.rng = makeRng(this.route.seed);
    this.build();
    this.reset();
  }

  build() {
    const scene = this.scene;
    scene.background = new THREE.Color(0x02030a);

    // stars: a big point cloud that never moves
    const starCount = 2600;
    const pos = new Float32Array(starCount * 3);
    const col = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 1800 + this.rng() * 1600;
      const a = this.rng() * TAU, b = Math.acos(this.rng() * 2 - 1);
      pos[i * 3] = Math.sin(b) * Math.cos(a) * r;
      pos[i * 3 + 1] = Math.cos(b) * r;
      pos[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r;
      const warm = this.rng();
      col[i * 3] = 0.7 + warm * 0.3;
      col[i * 3 + 1] = 0.75 + warm * 0.2;
      col[i * 3 + 2] = 0.9 + this.rng() * 0.1;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 3.5, vertexColors: true, sizeAttenuation: false })));

    // the sun, far behind
    const sunLight = new THREE.DirectionalLight(0xfff0dd, 2.4);
    sunLight.position.set(-60, 30, 120);
    scene.add(sunLight, new THREE.AmbientLight(0x2a3050, 0.7));

    const moon = this.dest === 'moon';
    const R = this.route, outer = !!R.from;
    // where you left falling away behind: Earth, or Mars on the way to the Moon
    this.earth = outer ? this.outerFrom(R.from) : moon
      ? new THREE.Mesh(new THREE.SphereGeometry(120, 48, 32), material('sand', { repeat: 4, roughness: 1 }))
      : new THREE.Mesh(
        new THREE.SphereGeometry(140, 48, 32),
        new THREE.MeshStandardMaterial({
          color: 0x2a5a8a, roughness: 0.9,
          emissive: 0x3a0a08, emissiveIntensity: 0.35   // the rift burning on the night side
        })
      );
    this.earth.position.set(40, -60, 520);
    scene.add(this.earth);
    if (!outer) {
      const glow = new THREE.Mesh(new THREE.SphereGeometry(moon ? 126 : 148, 32, 24),
        new THREE.MeshBasicMaterial({ color: moon ? 0xff8a5a : 0x4a86c8, transparent: true, opacity: moon ? 0.14 : 0.18, side: THREE.BackSide }));
      this.earth.add(glow);
    }

    // the destination ahead — starts a dot, ends filling the screen
    this.mars = new THREE.Mesh(
      new THREE.SphereGeometry(R.radius || 120, 48, 32),
      outer ? new THREE.MeshStandardMaterial({ map: planetTexture(this.dest), roughness: 0.95, emissive: 0xffffff, emissiveMap: planetTexture(this.dest), emissiveIntensity: 0.18 })
        : moon ? material('regolith', { repeat: 3, roughness: 1, color: 0xd8d8dc }) : material('sand', { repeat: 4, roughness: 1 })
    );
    this.mars.position.set(0, 0, -4200);
    if (outer) this.mars.rotation.z = 0.15;
    scene.add(this.mars);
    if (outer) {
      const r0 = R.radius || 120;
      const halo = new THREE.Mesh(new THREE.SphereGeometry(r0 * 1.06, 32, 24),
        new THREE.MeshBasicMaterial({ color: R.halo, transparent: true, opacity: 0.16, side: THREE.BackSide }));
      this.mars.add(halo);
      if (R.ring || this.dest === 'jupiter') {
        const ring = new THREE.Mesh(new THREE.RingGeometry(r0 * 1.4, r0 * (this.dest === 'jupiter' ? 1.8 : 2.2), 64),
          new THREE.MeshBasicMaterial({ color: R.ring || 0xc8a888, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
        ring.rotation.x = Math.PI / 2 - 0.2;
        this.mars.add(ring);
      }
      // a moon or two hanging beside the giant
      for (let k = 0; k < (this.dest === 'jupiter' ? 3 : 1); k++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(10 + k * 4, 20, 14),
          material(this.dest === 'neptune' ? 'ice' : 'regolith', { repeat: 1, color: [0xe8d070, 0xd8d0c0, 0xa8a090][k] || 0xc8d8e8 }));
        m.position.set(-260 + k * 110, 90 - k * 60, 120 - k * 80);
        this.mars.add(m);
      }
    } else if (!moon) {
      const halo = new THREE.Mesh(new THREE.SphereGeometry(126, 32, 24),
        new THREE.MeshBasicMaterial({ color: 0xff8a5a, transparent: true, opacity: 0.14, side: THREE.BackSide }));
      this.mars.add(halo);
    } else {
      // home, hanging beside the Moon as you come in
      const home = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 32),
        new THREE.MeshStandardMaterial({ color: 0x2a5a8a, roughness: 0.9, emissive: 0x3a0a08, emissiveIntensity: 0.3 }));
      home.position.set(-520, 160, -900);
      const homeGlow = new THREE.Mesh(new THREE.SphereGeometry(158, 32, 24),
        new THREE.MeshBasicMaterial({ color: 0x4a86c8, transparent: true, opacity: 0.18, side: THREE.BackSide }));
      home.add(homeGlow);
      this.mars.add(home);
    }

    // the ship's nose and cockpit frame, seen from inside
    this.ship = new THREE.Group();
    const hull = material('hull', { repeat: 2, metalness: 0.8, roughness: 0.3 });
    // the nose sits low and ahead: its base used to sit a metre from your eyes and fill the windscreen
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 20), hull);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, -1.75, -5.2);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a3038, metalness: 0.7, roughness: 0.4 });
    const frame = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 8, 24), frameMat);
    frame.position.set(0, -0.15, -1.6);
    const dash = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1), frameMat);
    dash.position.set(0, -1.15, -1.2);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x5ad2ff, transparent: true, opacity: 0.8 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.32), screenMat);
    screen.position.set(0, -1.02, -1.35);
    screen.rotation.x = -0.6;
    this.ship.add(nose, frame, dash, screen);
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 1.2), hull);
      wing.position.set(s * 2.1, -0.9, -2);
      wing.rotation.z = s * 0.2;
      this.ship.add(wing);
      const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.4, 8), frameMat);
      gun.rotation.x = Math.PI / 2;
      gun.position.set(s * 1.5, -0.9, -2.6);
      this.ship.add(gun);
    }
    scene.add(this.ship);

    // debris field: instanced rocks streaming past
    this.rockGeo = new THREE.IcosahedronGeometry(1, 0);
    this.rockMat = outer ? material(R.debris[0], { repeat: 1, roughness: R.debris[0] === 'ice' ? 0.2 : 0.8, metalness: R.debris[0] === 'ice' ? 0.3 : 0.05, color: R.debris[1], emissive: R.debris[0] === 'flesh' ? 0x2a3a00 : 0x000000 })
      : moon ? material('hull', { repeat: 1, roughness: 0.6, metalness: 0.6, color: 0x7a7e86 }) : material('sand', { repeat: 1, roughness: 1, color: 0x6a5a52 });
    this.rocks = [];
    for (let i = 0; i < 90; i++) {
      const m = new THREE.Mesh(this.rockGeo, this.rockMat);
      m.visible = false;
      m.userData = { spin: new THREE.Vector3(), vel: new THREE.Vector3(), hp: 1, size: 1 };
      scene.add(m);
      this.rocks.push(m);
    }

    // shots the ship fires
    this.bolts = [];
    const boltGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6);
    boltGeo.rotateX(Math.PI / 2);
    const boltMat = new THREE.MeshBasicMaterial({ color: 0x8ae8ff });
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(boltGeo, boltMat);
      m.visible = false;
      scene.add(m);
      this.bolts.push({ mesh: m, life: 0, vel: new THREE.Vector3() });
    }

    // sparks when something is hit
    this.sparkTex = puffTexture('rgba(255,220,180,1)');
    this.sparks = [];
    for (let i = 0; i < 60; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.sparkTex, color: 0xffb066, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.visible = false;
      s.userData = { life: 0, vel: new THREE.Vector3() };
      scene.add(s);
      this.sparks.push(s);
    }

    // engine glow behind the camera, reflected on the frame
    this.engineLight = new THREE.PointLight(0x5ad2ff, 6, 20, 2);
    this.engineLight.position.set(0, -1, 3);
    scene.add(this.engineLight);

    // Mars surface for the landing, hidden until the end
    this.surface = new THREE.Group();
    const surfGeo = new THREE.PlaneGeometry(1200, 1200, 40, 40);
    surfGeo.rotateX(-Math.PI / 2);
    const p = surfGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, Math.sin(x * 0.01) * 6 + Math.cos(z * 0.013) * 7 + Math.sin((x + z) * 0.03) * 2);
    }
    surfGeo.computeVertexNormals();
    if (moon) {
      // craters: dish-shaped dents with a raised lip
      for (let c = 0; c < 26; c++) {
        const cx = (this.rng() - 0.5) * 1000, cz = (this.rng() - 0.5) * 1000, cr = 20 + this.rng() * 70;
        for (let i = 0; i < p.count; i++) {
          const d = Math.hypot(p.getX(i) - cx, p.getZ(i) - cz) / cr;
          if (d < 1.3) p.setY(i, p.getY(i) + (d < 1 ? -(1 - d * d) * cr * 0.25 : (1.3 - d) * cr * 0.2));
        }
      }
      surfGeo.computeVertexNormals();
    }
    const surf = new THREE.Mesh(surfGeo, outer ? material(R.surface[0], { repeat: 30, roughness: 1, color: R.surface[1] })
      : moon ? material('regolith', { repeat: 30, roughness: 1 }) : material('sand', { repeat: 30, roughness: 1 }));
    surf.position.y = -60;
    this.surface.add(surf);
    if (outer) this.outerLanding(R);
    // the colony: domes and a mast (on the Moon: low base modules)
    for (let i = 0; i < (outer ? 0 : 7); i++) {
      const a = (i / 7) * TAU;
      const dome = new THREE.Mesh(moon ? new THREE.CylinderGeometry(4, 4, 18 + this.rng() * 10, 16).rotateZ(Math.PI / 2).rotateY(a)
        : new THREE.SphereGeometry(8 + this.rng() * 6, 20, 12, 0, TAU, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xcfd6dd, roughness: 0.5, metalness: 0.3 }));
      dome.position.set(Math.cos(a) * (46 + this.rng() * 30), -58, -170 + Math.sin(a) * (40 + this.rng() * 30));
      this.surface.add(dome);
      const lamp = new THREE.PointLight(0x8ae8ff, 3, 60, 2);
      lamp.position.copy(dome.position).setY(-44);
      this.surface.add(lamp);
    }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 40, 8),
      new THREE.MeshStandardMaterial({ color: 0x9aa2aa, metalness: 0.6, roughness: 0.4 }));
    mast.position.set(0, -40, -190);
    if (!outer) this.surface.add(mast);
    this.surface.visible = false;
    scene.add(this.surface);

    this.dust = [];
    for (let i = 0; i < 80; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.sparkTex, color: outer ? R.dust : moon ? 0x9a9a9e : 0xc06a3a, opacity: 0.5, depthWrite: false }));
      s.visible = false;
      s.userData = { vel: new THREE.Vector3(), life: 0 };
      scene.add(s);
      this.dust.push(s);
    }
  }

  /** The world you are leaving, for the outer routes. */
  outerFrom(kind) {
    if (kind === 'earth') {
      const e = new THREE.Mesh(new THREE.SphereGeometry(140, 48, 32),
        new THREE.MeshStandardMaterial({ color: 0x2a5a8a, roughness: 0.9, emissive: 0x0a1a3a, emissiveIntensity: 0.35 }));
      const glow = new THREE.Mesh(new THREE.SphereGeometry(148, 32, 24),
        new THREE.MeshBasicMaterial({ color: 0x4a86c8, transparent: true, opacity: 0.18, side: THREE.BackSide }));
      e.add(glow);
      const moon = new THREE.Mesh(new THREE.SphereGeometry(36, 24, 16), material('regolith', { repeat: 1, color: 0xd8d8dc }));
      moon.position.set(-200, 60, -60);
      e.add(moon);
      return e;
    }
    const big = kind === 'jupiter';
    const p = new THREE.Mesh(new THREE.SphereGeometry(big ? 170 : 130, 48, 32),
      new THREE.MeshStandardMaterial({ map: planetTexture(kind), roughness: 0.95, emissive: 0xffffff, emissiveMap: planetTexture(kind), emissiveIntensity: 0.15 }));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(big ? 178 : 138, 32, 24),
      new THREE.MeshBasicMaterial({ color: big ? 0xffc890 : 0xffe0a0, transparent: true, opacity: 0.15, side: THREE.BackSide }));
    p.add(glow);
    return p;
  }

  /** What you set down on past the Moon: domes in the Venus haze, the refinery over Jupiter's clouds, the ice station on Neptune. */
  outerLanding(R) {
    const g = this.surface, rng = this.rng;
    const shell = new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.5, metalness: 0.35 });
    const lampCol = this.dest === 'venus' ? 0xffd27a : this.dest === 'jupiter' ? 0xffa050 : 0x8ad8ff;
    if (this.dest === 'jupiter') {
      // decks on stilts over the cloud tops, gas spheres on them
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU, d = 40 + rng() * 30;
        const deck = new THREE.Mesh(new THREE.BoxGeometry(30 + rng() * 20, 2, 24 + rng() * 14), shell);
        deck.position.set(Math.cos(a) * d, -50, -170 + Math.sin(a) * d);
        g.add(deck);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(5 + rng() * 3, 16, 12), shell);
        ball.position.copy(deck.position).add(new THREE.Vector3(0, 7, 0));
        g.add(ball);
      }
    } else {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU;
        const m = this.dest === 'venus'
          ? new THREE.Mesh(new THREE.SphereGeometry(8 + rng() * 6, 20, 12, 0, TAU, 0, Math.PI / 2), shell)
          : new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 10 + rng() * 14, 12), shell);
        m.position.set(Math.cos(a) * (46 + rng() * 30), -58, -170 + Math.sin(a) * (40 + rng() * 30));
        g.add(m);
        if (this.dest === 'neptune') {
          const spike = new THREE.Mesh(new THREE.ConeGeometry(3, 20 + rng() * 20, 5), material('ice', { repeat: 1, color: 0xbfe0ff }));
          spike.position.set(Math.cos(a + 0.4) * 80, -50, -170 + Math.sin(a + 0.4) * 80);
          g.add(spike);
        }
      }
    }
    for (let i = 0; i < 6; i++) {
      const lamp = new THREE.PointLight(lampCol, 3, 60, 2);
      lamp.position.set((i - 2.5) * 30, -44, -170 + (i % 2) * 30);
      g.add(lamp);
    }
    if (R.lightning) {
      this.bolt = new THREE.PointLight(0xc8d8ff, 0, 400, 1.2);
      this.bolt.position.set(0, -20, -260);
      g.add(this.bolt);
    }
  }

  reset() {
    this.t = 0;
    this.phase = 'launch';       // launch → flight → approach → landing → done
    this.hull = 100;
    this.score = 0;
    this.destroyed = 0;
    this.shake = 0;
    this.aim = new THREE.Vector2();
    this.nextShot = 0;
    this.spawnAt = 0;
    this.done = false;
    this.mars.position.set(0, 0, -4200);
    this.mars.scale.setScalar(1);
    this.earth.position.set(40, -60, 520);
    this.surface.visible = false;
    this.rocks.forEach(r => { r.visible = false; });
    this.bolts.forEach(b => { b.mesh.visible = false; b.life = 0; });
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);
    audio.sfx.launch();
  }

  /** input: { mouseX, mouseY, firing } — mouse deltas steer the ship. */
  update(dt, input) {
    this.t += dt;
    const camera = this.camera;

    // steering: the aim point drifts back to centre so it feels like flying
    this.aim.x = clamp(this.aim.x - input.mouseX * 0.0016, -1, 1);
    this.aim.y = clamp(this.aim.y - input.mouseY * 0.0016, -0.8, 0.8);
    this.aim.multiplyScalar(1 - dt * 0.6);

    camera.rotation.y = damp(camera.rotation.y, this.aim.x * 0.5, 6, dt);
    camera.rotation.x = damp(camera.rotation.x, this.aim.y * 0.4, 6, dt);
    camera.rotation.z = damp(camera.rotation.z, -this.aim.x * 0.6, 4, dt);
    camera.position.x = damp(camera.position.x, this.aim.x * 9, 3, dt);
    camera.position.y = damp(camera.position.y, this.aim.y * 6, 3, dt);

    this.ship.position.copy(camera.position);
    this.ship.rotation.copy(camera.rotation);
    this.engineLight.position.set(camera.position.x, camera.position.y - 1, camera.position.z + 3);
    this.engineLight.intensity = 5 + Math.sin(this.t * 22) * 1.5;

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2);
      camera.position.x += Math.sin(this.t * 60) * this.shake * 0.5;
      camera.position.y += Math.cos(this.t * 51) * this.shake * 0.5;
    }

    const speed = this.phase === 'launch' ? 60 + this.t * 40 : 210;

    // Earth recedes; Mars grows
    this.earth.position.z += speed * dt * 0.5;
    this.earth.rotation.y += dt * 0.02;
    this.mars.rotation.y += dt * 0.03;
    if (this.phase === 'flight' || this.phase === 'launch') {
      this.mars.position.z += speed * dt * 0.62;
    }

    if (this.phase === 'launch' && this.t > 4) {
      this.phase = 'flight';
      this.hud.subtitle(this.route.debrisText);
    }

    if (this.phase === 'flight') {
      this.flightUpdate(dt, input, speed);
      if (this.t > this.length) {
        this.phase = 'approach';
        this.hud.subtitle(this.route.approachText);
        audio.sfx.objective();
      }
    } else if (this.phase === 'approach') {
      // Mars swells and the camera pitches down toward the surface
      this.mars.position.z = damp(this.mars.position.z, -240, 0.6, dt);
      this.mars.scale.setScalar(damp(this.mars.scale.x, 1.9, 0.5, dt));
      if (this.mars.position.z > -420) {
        this.phase = 'landing';
        this.landT = 0;
        this.surface.visible = true;
        this.mars.visible = false;
        if (this.route.fog) {   // down into the haze
          this.scene.fog = new THREE.FogExp2(this.route.fog, this.route.fogDensity);
          this.scene.background = new THREE.Color(this.route.fog);
        }
        this.hud.subtitle('Touchdown in 10');
      }
    } else if (this.phase === 'landing') {
      this.landT += dt;
      const t = clamp(this.landT / LANDING_TIME, 0, 1);
      // drop toward the pad, nose levelling out
      this.surface.position.y = -20 + t * 62;
      camera.rotation.x = damp(camera.rotation.x, -0.35 + t * 0.35, 2, dt);
      camera.position.y = damp(camera.position.y, 0, 1.6, dt);
      if (Math.random() < dt * 40 * t) this.spawnDust();
      if (this.bolt) {   // Jupiter: lightning under the cloud tops
        this.bolt.intensity = Math.max(0, this.bolt.intensity - dt * 900);
        if (Math.random() < dt * 0.9) this.bolt.intensity = 600;
      }
      if (this.landT > LANDING_TIME * 0.55 && !this.thrusterSound) {
        this.thrusterSound = true;
        audio.sfx.launch();
      }
      if (t >= 1 && !this.done) {
        this.done = true;
        audio.sfx.win();
      }
    }

    this.updateBolts(dt);
    this.updateSparks(dt);
    this.updateDust(dt);
    return this.done;
  }

  flightUpdate(dt, input, speed) {
    // spawn debris ahead at a rate that rises through the flight
    const intensity = (0.4 + (this.t / this.length) * 1.6) * this.route.density;
    this.spawnAt -= dt * intensity;
    if (this.spawnAt <= 0) {
      this.spawnAt = randRange(0.12, 0.4);
      this.spawnRock();
    }

    for (const r of this.rocks) {
      if (!r.visible) continue;
      r.position.addScaledVector(r.userData.vel, dt);
      r.position.z += speed * dt;
      r.rotation.x += r.userData.spin.x * dt;
      r.rotation.y += r.userData.spin.y * dt;
      r.rotation.z += r.userData.spin.z * dt;
      if (r.position.z > 40) { r.visible = false; continue; }
      // collision with the ship
      const dx = r.position.x - this.camera.position.x;
      const dy = r.position.y - this.camera.position.y;
      const dz = r.position.z - this.camera.position.z;
      const rad = r.userData.size + 1.8;
      if (dx * dx + dy * dy + dz * dz < rad * rad) {
        this.hitShip(r);
      }
    }

    // firing
    if (input.firing && this.t > this.nextShot) {
      this.nextShot = this.t + 0.12;
      this.shoot();
    }
  }

  spawnRock() {
    const r = this.rocks.find(x => !x.visible);
    if (!r) return;
    const size = randRange(1.2, 4.2);
    r.visible = true;
    r.scale.setScalar(size);
    r.userData.size = size;
    r.userData.hp = Math.ceil(size * this.route.rockHp);
    r.position.set(randRange(-38, 38), randRange(-26, 26), -randRange(420, 700));
    r.userData.vel.set(randRange(-3, 3), randRange(-3, 3), 0);
    r.userData.spin.set(randRange(-2, 2), randRange(-2, 2), randRange(-2, 2));
  }

  shoot() {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    for (const side of [-1, 1]) {
      const b = this.bolts.find(x => !x.mesh.visible);
      if (!b) continue;
      b.mesh.visible = true;
      b.mesh.position.copy(this.camera.position).add(new THREE.Vector3(side * 1.5, -0.9, -3).applyQuaternion(this.camera.quaternion));
      b.mesh.quaternion.copy(this.camera.quaternion);
      b.vel.copy(dir).multiplyScalar(420);
      b.life = 2.2;
    }
    audio.sfx.plasma();
  }

  updateBolts(dt) {
    for (const b of this.bolts) {
      if (!b.mesh.visible) continue;
      b.life -= dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      if (b.life <= 0) { b.mesh.visible = false; continue; }
      for (const r of this.rocks) {
        if (!r.visible) continue;
        if (b.mesh.position.distanceToSquared(r.position) < (r.userData.size + 1.2) ** 2) {
          b.mesh.visible = false;
          r.userData.hp--;
          this.burst(r.position, r.userData.size);
          if (r.userData.hp <= 0) {
            r.visible = false;
            this.score += 100;
            this.destroyed++;
            audio.at(() => audio.sfx.explode(), 20, 200);
          } else {
            audio.at(() => audio.sfx.hitWall(), 20, 200);
          }
          break;
        }
      }
    }
  }

  hitShip(rock) {
    rock.visible = false;
    this.hull = Math.max(0, this.hull - 9 - rock.userData.size * 2);
    this.shake = 1;
    this.burst(rock.position, rock.userData.size * 1.5);
    audio.sfx.explode();
    this.hud.damage();
    if (this.hull <= 0) this.failed = true;
  }

  burst(pos, scale) {
    for (let i = 0; i < 10; i++) {
      const s = this.sparks.find(x => !x.visible);
      if (!s) break;
      s.visible = true;
      s.position.copy(pos);
      s.scale.setScalar(randRange(0.6, 2.2) * scale * 0.5);
      s.userData.vel.set(randRange(-14, 14), randRange(-14, 14), randRange(-6, 30));
      s.userData.life = randRange(0.3, 0.8);
      s.material.opacity = 1;
    }
  }

  updateSparks(dt) {
    for (const s of this.sparks) {
      if (!s.visible) continue;
      s.userData.life -= dt;
      s.position.addScaledVector(s.userData.vel, dt);
      s.material.opacity = Math.max(0, s.userData.life * 1.4);
      if (s.userData.life <= 0) s.visible = false;
    }
  }

  spawnDust() {
    const s = this.dust.find(x => !x.visible);
    if (!s) return;
    s.visible = true;
    s.position.set(randRange(-30, 30), -18 + randRange(-4, 4), randRange(-60, -10));
    s.scale.setScalar(randRange(6, 20));
    s.userData.vel.set(randRange(-12, 12), randRange(2, 10), randRange(-4, 4));
    s.userData.life = randRange(0.8, 2);
    s.material.opacity = 0.55;
  }

  updateDust(dt) {
    for (const s of this.dust) {
      if (!s.visible) continue;
      s.userData.life -= dt;
      s.position.addScaledVector(s.userData.vel, dt);
      s.material.opacity = Math.max(0, s.userData.life * 0.4);
      if (s.userData.life <= 0) s.visible = false;
    }
  }

  get progress() { return clamp(this.t / this.length, 0, 1); }

  dispose() {
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material.dispose && !o.material.__shared) o.material.dispose();
    });
  }
}

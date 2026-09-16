/* Demon Fall — the escape flight.
 *
 * After boarding, the game swaps to this scene: you fly the last ship out of
 * Earth orbit, shooting through rift debris, and set down on Mars. It is its
 * own little arcade game with its own scene, so nothing from the shooter has
 * to be unloaded mid-cutscene. */
import * as THREE from 'three';
import { material, puffTexture } from './textures.js';
import { clamp, damp, randRange, TAU, makeRng } from './util.js';
import * as audio from './audio.js';

const FLIGHT_LENGTH = 62;      // seconds of flight before Mars approach
const LANDING_TIME = 13;

export class MarsFlight {
  constructor(hud) {
    this.hud = hud;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 6000);
    this.rng = makeRng(20260915);
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

    // Earth falling away behind
    this.earth = new THREE.Mesh(
      new THREE.SphereGeometry(140, 48, 32),
      new THREE.MeshStandardMaterial({
        color: 0x2a5a8a, roughness: 0.9,
        emissive: 0x3a0a08, emissiveIntensity: 0.35   // the rift burning on the night side
      })
    );
    this.earth.position.set(40, -60, 520);
    scene.add(this.earth);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(148, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0x4a86c8, transparent: true, opacity: 0.18, side: THREE.BackSide }));
    this.earth.add(glow);

    // Mars ahead — starts a dot, ends filling the screen
    this.mars = new THREE.Mesh(
      new THREE.SphereGeometry(120, 48, 32),
      material('sand', { repeat: 4, roughness: 1 })
    );
    this.mars.position.set(0, 0, -4200);
    scene.add(this.mars);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(126, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0xff8a5a, transparent: true, opacity: 0.14, side: THREE.BackSide }));
    this.mars.add(halo);

    // the ship's nose and cockpit frame, seen from inside
    this.ship = new THREE.Group();
    const hull = material('hull', { repeat: 2, metalness: 0.8, roughness: 0.3 });
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4.5, 20), hull);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, -0.7, -3.4);
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
    this.rockMat = material('sand', { repeat: 1, roughness: 1, color: 0x6a5a52 });
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
    const surf = new THREE.Mesh(surfGeo, material('sand', { repeat: 30, roughness: 1 }));
    surf.position.y = -60;
    this.surface.add(surf);
    // the colony: domes and a mast
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(8 + this.rng() * 6, 20, 12, 0, TAU, 0, Math.PI / 2),
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
    this.surface.add(mast);
    this.surface.visible = false;
    scene.add(this.surface);

    this.dust = [];
    for (let i = 0; i < 80; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.sparkTex, color: 0xc06a3a, opacity: 0.5, depthWrite: false }));
      s.visible = false;
      s.userData = { vel: new THREE.Vector3(), life: 0 };
      scene.add(s);
      this.dust.push(s);
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
      this.hud.subtitle('Rift debris ahead — clear a path');
    }

    if (this.phase === 'flight') {
      this.flightUpdate(dt, input, speed);
      if (this.t > FLIGHT_LENGTH) {
        this.phase = 'approach';
        this.hud.subtitle('Mars approach — hold her steady');
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
    const intensity = 0.4 + (this.t / FLIGHT_LENGTH) * 1.6;
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
    r.userData.hp = Math.ceil(size);
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

  get progress() { return clamp(this.t / FLIGHT_LENGTH, 0, 1); }

  dispose() {
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material.dispose && !o.material.__shared) o.material.dispose();
    });
  }
}

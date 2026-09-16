/* Demon Fall — guns: the view model you see, and the maths behind each shot. */
import * as THREE from 'three';
import { material } from './textures.js';
import { clamp, damp, randRange, TAU } from './util.js';
import * as audio from './audio.js';

export const WEAPONS = {
  pistol: {
    name: 'M9 Sidearm', slot: 1, damage: 26, rpm: 320, mag: 15, reserve: 90, maxReserve: 180,
    spread: 0.008, pellets: 1, reload: 1.15, recoil: 0.9, auto: false, range: 90,
    sound: 'pistol', tracer: 0xffd9a0, kick: 0.028
  },
  shotgun: {
    name: 'Breacher 12g', slot: 2, damage: 17, rpm: 78, mag: 6, reserve: 28, maxReserve: 70,
    spread: 0.06, pellets: 9, reload: 2.0, recoil: 3.4, auto: false, range: 42,
    sound: 'shotgun', tracer: 0xffc070, kick: 0.09
  },
  plasma: {
    name: 'Rift Lance', slot: 3, damage: 34, rpm: 520, mag: 40, reserve: 160, maxReserve: 320,
    spread: 0.016, pellets: 1, reload: 1.6, recoil: 0.7, auto: true, range: 80,
    sound: 'plasma', tracer: 0x7ad9ff, kick: 0.022, pierce: 2
  }
};

/* --------------------------------------------------------------- models */
function metal(colour, rough = 0.58, metalness = 0.7) {
  return new THREE.MeshStandardMaterial({ color: colour, roughness: rough, metalness });
}

function buildPistol() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.3), metal(0x2b2f36));
  body.position.set(0, 0, -0.06);
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.33), metal(0x3a4049, 0.32));
  slide.position.set(0, 0.06, -0.07);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.19, 0.1), metal(0x17191d, 0.85, 0.2));
  grip.position.set(0, -0.12, 0.04);
  grip.rotation.x = -0.22;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.08, 10), metal(0x15171a));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, -0.23);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.018, 0.02), metal(0x6a7078));
  sight.position.set(0, 0.105, -0.2);
  g.add(body, slide, grip, barrel, sight);
  g.userData.muzzle = new THREE.Vector3(0, 0.035, -0.28);
  g.userData.slide = slide;
  return g;
}

function buildShotgun() {
  const g = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.03, 0.62, 12), metal(0x23262b, 0.5));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.035, -0.24);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.5, 10), metal(0x2c3036, 0.55));
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, -0.015, -0.2);
  const pump = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.15), new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.8 }));
  pump.position.set(0, -0.015, -0.2);
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.1, 0.24), metal(0x33383f, 0.45));
  receiver.position.set(0, 0.01, 0.05);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.26), new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.85, metalness: 0.05 }));
  stock.position.set(0, -0.03, 0.28);
  stock.rotation.x = 0.1;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.15, 0.08), new THREE.MeshStandardMaterial({ color: 0x3a2617, roughness: 0.9 }));
  grip.position.set(0, -0.11, 0.13);
  grip.rotation.x = -0.35;
  g.add(barrel, tube, pump, receiver, stock, grip);
  g.userData.muzzle = new THREE.Vector3(0, 0.035, -0.56);
  g.userData.pump = pump;
  return g;
}

function buildPlasma() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.42), metal(0x4a5560, 0.35, 0.7));
  body.position.set(0, 0, -0.08);
  const coilMat = new THREE.MeshStandardMaterial({ color: 0x1a2c38, roughness: 0.3, metalness: 0.9, emissive: 0x0a3a55, emissiveIntensity: 1.2 });
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 16), coilMat);
    ring.position.set(0, 0.01, -0.22 - i * 0.07);
    g.add(ring);
  }
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 12),
    new THREE.MeshBasicMaterial({ color: 0x7ad9ff }));
  core.rotation.x = Math.PI / 2;
  core.position.set(0, 0.01, -0.1);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.17, 0.09), metal(0x22272c, 0.8, 0.3));
  grip.position.set(0, -0.13, 0.06);
  grip.rotation.x = -0.2;
  const light = new THREE.PointLight(0x5ac8ff, 2.5, 3, 2);
  light.position.set(0, 0.02, -0.15);
  g.add(body, core, grip, light);
  g.userData.muzzle = new THREE.Vector3(0, 0.01, -0.46);
  g.userData.core = core;
  return g;
}

const BUILDERS = { pistol: buildPistol, shotgun: buildShotgun, plasma: buildPlasma };

/* --------------------------------------------------------------- the gun */
export class Weapon {
  constructor(key, camera, fx) {
    this.key = key;
    this.spec = WEAPONS[key];
    this.camera = camera;
    this.fx = fx;
    this.ammo = this.spec.mag;
    this.reserve = this.spec.reserve;
    this.model = BUILDERS[key]();
    this.model.visible = false;
    this.model.traverse(o => { o.renderOrder = 10; if (o.material) o.material.depthTest = true; });
    camera.add(this.model);

    this.basePos = new THREE.Vector3(0.23, -0.22, -0.5);
    this.model.scale.setScalar(0.72);
    this.model.position.copy(this.basePos);
    this.recoilPos = 0;
    this.recoilRot = 0;
    this.reloadT = 0;
    this.nextShot = 0;
    this.swayX = 0; this.swayY = 0;
    this.bobT = 0;
    this.raised = 0;         // 0 holstered, 1 up
    this.muzzleFlash = null;
    this.makeFlash();
  }

  makeFlash() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), mat.clone());
      m.rotation.z = (i / 3) * TAU;
      g.add(m);
    }
    g.position.copy(this.model.userData.muzzle);
    this.model.add(g);
    this.muzzleFlash = g;
    this.flashLight = new THREE.PointLight(0xffc27a, 0, 9, 2);
    this.flashLight.position.copy(this.model.userData.muzzle);
    this.model.add(this.flashLight);
  }

  get isReloading() { return this.reloadT > 0; }
  get full() { return this.ammo >= this.spec.mag; }

  show(v) {
    this.model.visible = v;
    if (v) this.raised = 0;
  }

  reload() {
    if (this.isReloading || this.full || this.reserve <= 0) return false;
    this.reloadT = this.spec.reload;
    audio.sfx.reload();
    return true;
  }

  /** ctx: { enemies, world, time, onHit, onKill, shake } */
  fire(ctx) {
    if (this.isReloading || ctx.time < this.nextShot) return false;
    if (this.ammo <= 0) {
      audio.sfx.dryFire();
      this.nextShot = ctx.time + 0.35;
      return false;
    }
    this.ammo--;
    this.nextShot = ctx.time + 60 / this.spec.rpm;
    audio.sfx[this.spec.sound]();
    if (this.key !== 'plasma') audio.sfx.shell();

    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    const baseDir = new THREE.Vector3();
    this.camera.getWorldDirection(baseDir);

    const spread = this.spec.spread * (ctx.moving ? 1.8 : 1) * (ctx.aiming ? 0.45 : 1);
    let anyHit = false, anyKill = false;

    for (let p = 0; p < this.spec.pellets; p++) {
      const dir = baseDir.clone();
      if (spread > 0) {
        dir.x += randRange(-spread, spread);
        dir.y += randRange(-spread, spread);
        dir.z += randRange(-spread, spread);
        dir.normalize();
      }
      let remaining = this.spec.pierce || 1;
      let from = origin.clone();
      let travel = this.spec.range;
      const already = new Set();

      while (remaining > 0 && travel > 0) {
        const wallHit = ctx.world.raycast(from, dir, travel);
        let enemyHit = ctx.enemies.raycast(from, dir, travel);
        if (enemyHit && already.has(enemyHit.enemy.id)) enemyHit = null;

        if (enemyHit && (!wallHit || enemyHit.dist < wallHit.dist)) {
          const point = from.clone().addScaledVector(dir, enemyHit.dist);
          const dealt = enemyHit.enemy.hurt(this.spec.damage, dir, enemyHit.head);
          already.add(enemyHit.enemy.id);
          this.fx.blood(point, dir, enemyHit.head ? 22 : 12);
          if (enemyHit.head) this.fx.gib(point, dir.clone().multiplyScalar(4).setY(3), enemyHit.enemy.type.gib, 1.2);
          audio.at(() => audio.sfx.hit(), origin.distanceTo(point));
          anyHit = true;
          if (enemyHit.enemy.dead) {
            anyKill = true;
            ctx.onKill(enemyHit.enemy, enemyHit.head);
          }
          this.fx.tracer(from === origin ? this.muzzleWorld() : from, point);
          from = point.clone().addScaledVector(dir, 0.05);
          travel -= enemyHit.dist + 0.05;
          remaining--;
          continue;
        }

        if (wallHit) {
          this.fx.decal(wallHit.point, wallHit.normal, randRange(0.18, 0.34), 0x2a2a2a);
          this.fx.sparks(wallHit.point, wallHit.normal, 6, this.key === 'plasma' ? [0.4, 0.8, 1] : [1, 0.75, 0.35]);
          this.fx.dust(wallHit.point, wallHit.normal, 5);
          audio.at(() => audio.sfx.hitWall(), origin.distanceTo(wallHit.point));
          this.fx.tracer(from === origin ? this.muzzleWorld() : from, wallHit.point);
          ctx.onWallHit && ctx.onWallHit(wallHit);
        } else {
          const end = from.clone().addScaledVector(dir, travel);
          this.fx.tracer(from === origin ? this.muzzleWorld() : from, end);
        }
        break;
      }
    }

    // feedback: flash, kick, shake
    this.muzzleFlash.children.forEach(m => { m.material.opacity = 0.95; m.rotation.z += 1.1; });
    this.flashLight.intensity = 9;
    this.recoilPos = Math.min(0.14, this.recoilPos + this.spec.kick);
    this.recoilRot = Math.min(0.3, this.recoilRot + this.spec.kick * 2.4);
    ctx.shake.add(this.spec.recoil * 0.02);
    ctx.onRecoil(this.spec.recoil);

    if (this.key === 'pistol' || this.key === 'shotgun') {
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const p = this.muzzleWorld().addScaledVector(side, 0.1);
      this.fx.gib(p, side.multiplyScalar(2.4).setY(2.2), 0xb8a05a, 0.35);
    }

    if (anyHit) ctx.onHit(anyKill);
    return true;
  }

  muzzleWorld(out = new THREE.Vector3()) {
    return this.model.localToWorld(out.copy(this.model.userData.muzzle));
  }

  update(dt, ctx) {
    const spec = this.spec;
    // recoil settles
    this.recoilPos = damp(this.recoilPos, 0, 11, dt);
    this.recoilRot = damp(this.recoilRot, 0, 9, dt);
    this.raised = damp(this.raised, 1, 9, dt);

    // reloading: dip the gun out of frame and back
    let reloadDip = 0, reloadRoll = 0;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      const t = 1 - clamp(this.reloadT / spec.reload, 0, 1);
      const arc = Math.sin(t * Math.PI);
      reloadDip = arc * 0.16;
      reloadRoll = arc * 0.9;
      if (this.reloadT <= 0) {
        const need = spec.mag - this.ammo;
        const take = Math.min(need, this.reserve);
        this.ammo += take;
        this.reserve -= take;
      }
    }

    // sway follows where the camera is turning, bob follows the feet
    this.swayX = damp(this.swayX, clamp(-ctx.turnX * 0.5, -0.05, 0.05), 8, dt);
    this.swayY = damp(this.swayY, clamp(-ctx.turnY * 0.5, -0.05, 0.05), 8, dt);
    this.bobT += dt * (ctx.speed > 0.4 ? 8 + ctx.speed : 2.2);
    const bobAmt = clamp(ctx.speed * 0.012, 0, 0.03);
    const bobX = Math.sin(this.bobT) * bobAmt;
    const bobY = Math.abs(Math.cos(this.bobT)) * bobAmt * 0.8;

    const aimBlend = ctx.aiming ? 1 : 0;
    this.aim = damp(this.aim == null ? 0 : this.aim, aimBlend, 12, dt);

    const target = this.basePos.clone();
    target.lerp(new THREE.Vector3(0, -0.075, -0.38), this.aim);   // pull to centre when aiming
    target.x += this.swayX + bobX;
    target.y += this.swayY + bobY - reloadDip - (1 - this.raised) * 0.35;
    target.z += this.recoilPos;
    this.model.position.lerp(target, 1 - Math.exp(-22 * dt));
    this.model.rotation.x = this.recoilRot + this.swayY * 2 + (1 - this.raised) * 0.5;
    this.model.rotation.z = reloadRoll + this.swayX * 1.5;
    this.model.rotation.y = -this.swayX * 1.2;

    // muzzle flash fades fast
    this.muzzleFlash.children.forEach(m => { m.material.opacity = Math.max(0, m.material.opacity - dt * 14); });
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 70);

    // moving parts
    const slide = this.model.userData.slide;
    if (slide) slide.position.z = -0.07 + this.recoilPos * 1.4;
    const pump = this.model.userData.pump;
    if (pump) pump.position.z = -0.2 + Math.sin(clamp(1 - this.reloadT / spec.reload, 0, 1) * Math.PI) * 0.12;
    const core = this.model.userData.core;
    if (core) core.material.color.setHSL(0.55, 1, 0.55 + Math.sin(ctx.time * 8) * 0.12 + this.recoilPos);
  }

  addAmmo(n) {
    const before = this.reserve;
    this.reserve = Math.min(this.spec.maxReserve, this.reserve + n);
    return this.reserve - before;
  }

  dispose() {
    this.camera.remove(this.model);
  }
}

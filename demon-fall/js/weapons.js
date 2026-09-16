/* Demon Fall — guns: the view model you see, and the maths behind each shot. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
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
// Gun steel is kept only mildly metallic: with nothing to reflect, very metallic
// surfaces render near-black, and the gun should read clearly in the dark.
function metal(colour, rough = 0.5, metalness = 0.75) {
  const c = new THREE.Color(colour).multiplyScalar(1.6);
  return new THREE.MeshStandardMaterial({ color: c, roughness: Math.min(0.7, rough + 0.1), metalness: metalness * 0.4 });
}
const polymer = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.05 });
const glow = c => new THREE.MeshBasicMaterial({ color: c });

function part(parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}
// soft-edged boxes: every block on the guns and hands gets rounded corners
const B = (w, h, d) => new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.42);
const C = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);

/* ---- hands: gloves and sleeves, so the gun is held rather than floating */
const GLOVE = polymer(0x1f1d1b);
const SLEEVE = new THREE.MeshStandardMaterial({ color: 0x2c3326, roughness: 0.95 });
const SKIN = new THREE.MeshStandardMaterial({ color: 0xb98a6a, roughness: 0.7 });

/**
 * A gloved hand wrapped round something. `side` 1 = right hand (on the grip),
 * -1 = left hand (supporting). The forearm runs back toward the camera.
 */
function hand(parent, x, y, z, side, { tilt = 0, reach = 0.34 } = {}) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  h.rotation.set(tilt, 0, 0);
  parent.add(h);
  part(h, B(0.05, 0.075, 0.09), GLOVE, side * 0.028, -0.01, 0.01);                   // palm, beside the grip
  for (let f = 0; f < 4; f++) {                                                       // fingers wrap the front
    part(h, B(0.07, 0.018, 0.02), GLOVE, -side * 0.004, 0.022 - f * 0.021, -0.045);
  }
  part(h, B(0.018, 0.018, 0.06), GLOVE, -side * 0.03, 0.03, -0.01, 0.3, 0, 0);       // thumb along the far side
  part(h, B(0.052, 0.03, 0.012), SKIN, side * 0.03, -0.035, 0.058);                   // a strip of wrist
  // forearm and sleeve reaching back and down, out of frame
  const arm = new THREE.Group();
  arm.position.set(side * 0.035, -0.04, 0.06);
  arm.rotation.set(-1.05, side * 0.35, 0);
  h.add(arm);
  part(arm, C(0.032, 0.036, 0.1), GLOVE, 0, 0.03, 0);
  part(arm, C(0.045, 0.056, reach), SLEEVE, 0, -reach / 2 + 0.02, 0);
  part(arm, C(0.05, 0.05, 0.03), polymer(0x20251c), 0, -0.02, 0);                     // cuff
  return h;
}

function buildPistol() {
  const g = new THREE.Group();
  const frame = metal(0x24272c), slideMat = metal(0x3a4048, 0.35, 0.85);
  part(g, B(0.07, 0.05, 0.28), frame, 0, 0.005, -0.06);
  const slide = part(g, B(0.075, 0.062, 0.31), slideMat, 0, 0.058, -0.065);
  for (let i = 0; i < 6; i++) part(slide, B(0.077, 0.05, 0.004), metal(0x1a1c20), 0, 0, 0.1 + i * 0.01);   // serrations
  part(slide, B(0.03, 0.02, 0.05), metal(0x15171a), 0.03, 0.01, -0.02);           // ejection port
  part(slide, B(0.012, 0.016, 0.018), metal(0x15171a), 0, 0.037, -0.14);         // front sight
  part(slide, B(0.004, 0.004, 0.004), glow(0x7aff6a), 0, 0.046, -0.131);
  part(slide, B(0.034, 0.016, 0.014), metal(0x15171a), 0, 0.037, 0.13);          // rear sight
  for (const s of [-1, 1]) part(slide, B(0.004, 0.004, 0.004), glow(0x7aff6a), s * 0.01, 0.046, 0.12);
  part(g, C(0.015, 0.015, 0.05), metal(0x101214), 0, 0.05, -0.23, Math.PI / 2);   // barrel crown
  part(g, B(0.05, 0.012, 0.09), frame, 0, -0.022, -0.14);                         // accessory rail
  for (let i = 0; i < 4; i++) part(g, B(0.052, 0.004, 0.006), metal(0x15171a), 0, -0.03, -0.17 + i * 0.022);
  const grip = new THREE.Group();
  grip.position.set(0, -0.08, 0.05);
  grip.rotation.x = -0.25;
  g.add(grip);
  part(grip, B(0.064, 0.17, 0.085), polymer(0x17191c), 0, 0, 0);
  for (let i = 0; i < 7; i++) part(grip, B(0.066, 0.006, 0.07), polymer(0x0e0f11), 0, -0.06 + i * 0.02, 0);   // stippling
  part(grip, B(0.058, 0.02, 0.08), metal(0x2a2d32), 0, -0.095, 0);               // magazine base
  part(g, new THREE.TorusGeometry(0.03, 0.006, 6, 12, Math.PI), frame, 0, -0.03, -0.035, 0, Math.PI / 2, Math.PI);
  part(g, B(0.008, 0.028, 0.008), metal(0x0c0d0f), 0, -0.02, -0.03, 0.3);        // trigger
  hand(grip, 0, 0.02, 0.0, 1);
  hand(g, -0.03, -0.1, -0.02, -1, { tilt: 0.4, reach: 0.3 });                     // support hand under the grip
  g.userData.muzzle = new THREE.Vector3(0, 0.05, -0.26);
  g.userData.slide = slide;
  g.userData.slideZ = -0.065;
  return g;
}

function buildShotgun() {
  const g = new THREE.Group();
  const steel = metal(0x25282d, 0.45);
  part(g, C(0.024, 0.026, 0.66), steel, 0, 0.04, -0.28, Math.PI / 2);             // barrel
  const shield = part(g, B(0.05, 0.03, 0.4), metal(0x2e3238, 0.55), 0, 0.064, -0.3);
  for (let i = 0; i < 6; i++) part(shield, B(0.052, 0.012, 0.03), metal(0x0c0d0f), 0, 0.006, -0.16 + i * 0.065);   // heat vents
  part(g, new THREE.SphereGeometry(0.007, 8, 6), metal(0xe0e0e0, 0.2, 1), 0, 0.083, -0.58);   // bead sight
  part(g, C(0.02, 0.02, 0.52), steel, 0, -0.012, -0.23, Math.PI / 2);             // magazine tube
  part(g, C(0.023, 0.023, 0.03), metal(0x1a1c20), 0, -0.012, -0.5, Math.PI / 2);  // tube cap
  const pump = new THREE.Group();
  pump.position.set(0, -0.012, -0.22);
  g.add(pump);
  part(pump, C(0.036, 0.036, 0.17, 12), polymer(0x3a2a1c), 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 7; i++) part(pump, C(0.038, 0.038, 0.008, 12), polymer(0x241a10), 0, 0, -0.07 + i * 0.023, Math.PI / 2);
  const receiver = part(g, B(0.07, 0.1, 0.26), metal(0x33373e, 0.42), 0, 0.02, 0.05);
  part(receiver, B(0.004, 0.035, 0.07), metal(0x0b0c0d), 0.036, 0.012, -0.01);     // ejection port
  part(receiver, B(0.02, 0.012, 0.2), metal(0x1a1c20), 0, 0.056, 0);               // top rail
  part(g, new THREE.TorusGeometry(0.03, 0.006, 6, 12, Math.PI), steel, 0, -0.035, 0.1, 0, Math.PI / 2, Math.PI);
  const grip = new THREE.Group();
  grip.position.set(0, -0.09, 0.19);
  grip.rotation.x = -0.45;
  g.add(grip);
  part(grip, B(0.05, 0.14, 0.07), polymer(0x3a2617), 0, 0, 0);
  const stock = part(g, B(0.055, 0.1, 0.26), polymer(0x3a2617), 0, -0.03, 0.36, 0.08);
  part(stock, B(0.058, 0.105, 0.03), polymer(0x0c0c0c), 0, 0, 0.14);             // recoil pad
  hand(grip, 0, 0.02, 0, 1);
  hand(pump, -0.02, -0.04, 0, -1, { tilt: 0.1, reach: 0.42 });                     // left hand rides the pump
  g.userData.muzzle = new THREE.Vector3(0, 0.04, -0.62);
  g.userData.pump = pump;
  return g;
}

function buildPlasma() {
  const g = new THREE.Group();
  const shell = metal(0x3e4852, 0.35, 0.65), dark = metal(0x1a2028, 0.5, 0.6);
  part(g, B(0.1, 0.12, 0.44), shell, 0, 0, -0.08);
  for (const s of [-1, 1]) {
    part(g, B(0.006, 0.06, 0.3), dark, s * 0.052, 0.01, -0.1);                     // side panel seams
    part(g, B(0.006, 0.012, 0.18), glow(0x5ac8ff), s * 0.053, -0.035, -0.12);        // light strips
  }
  const coilMat = new THREE.MeshStandardMaterial({ color: 0x1a2c38, roughness: 0.3, metalness: 0.9, emissive: 0x0a3a55, emissiveIntensity: 1.4 });
  for (let i = 0; i < 4; i++) part(g, new THREE.TorusGeometry(0.058, 0.011, 8, 18), coilMat, 0, 0.005, -0.3 - i * 0.055);
  part(g, C(0.03, 0.03, 0.22, 12), dark, 0, 0.005, -0.38, Math.PI / 2);            // emitter
  const core = part(g, C(0.026, 0.026, 0.2, 12), glow(0x7ad9ff), 0, 0.005, -0.38, Math.PI / 2);
  // energy cell slotted in behind the grip
  part(g, C(0.03, 0.03, 0.12, 12), dark, 0, -0.05, 0.14, 0.4);
  part(g, C(0.022, 0.022, 0.1, 12), glow(0x9aeaff), 0, -0.05, 0.14, 0.4);
  // holographic sight
  part(g, B(0.05, 0.012, 0.07), dark, 0, 0.066, -0.02);
  const frame = part(g, new THREE.TorusGeometry(0.024, 0.004, 6, 20), dark, 0, 0.098, -0.02);
  part(frame, new THREE.RingGeometry(0.004, 0.007, 16), new THREE.MeshBasicMaterial({ color: 0xff4a3c, side: THREE.DoubleSide }), 0, 0, 0.001);
  const grip = new THREE.Group();
  grip.position.set(0, -0.11, 0.05);
  grip.rotation.x = -0.25;
  g.add(grip);
  part(grip, B(0.058, 0.16, 0.08), polymer(0x20252a), 0, 0, 0);
  part(g, B(0.07, 0.06, 0.14), polymer(0x20252a), 0, -0.07, -0.22);               // forward handguard
  hand(grip, 0, 0.02, 0, 1);
  hand(g, -0.015, -0.09, -0.22, -1, { tilt: 0.2, reach: 0.44 });
  g.userData.muzzle = new THREE.Vector3(0, 0.005, -0.5);
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

    this.basePos = new THREE.Vector3(0.2, -0.19, -0.46);
    this.model.scale.setScalar(0.78);
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
    if (slide) slide.position.z = this.model.userData.slideZ + this.recoilPos * 1.4;
    const pump = this.model.userData.pump;
    if (pump) pump.position.z = -0.22 + Math.sin(clamp(1 - this.reloadT / spec.reload, 0, 1) * Math.PI) * 0.12;
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

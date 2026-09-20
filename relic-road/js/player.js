/* Demon Fall — the player: movement, collision, camera feel, health.
 *
 * Collision is a vertical cylinder against the level's axis-aligned boxes,
 * resolved one axis at a time so you slide along walls instead of sticking,
 * with a step-up allowance so kerbs and rubble don't stop you dead. */
import * as THREE from 'three';
import { clamp, damp, lerp, randRange } from './util.js';
import * as audio from './audio.js';

const EYE = 1.62;
const CROUCH_EYE = 0.95;
const RADIUS = 0.36;
const HEIGHT = 1.78;
const CROUCH_HEIGHT = 1.1;
const STEP = 0.55;

export class Player {
  constructor(camera, fx) {
    this.camera = camera;
    this.fx = fx;
    this.pos = new THREE.Vector3(0, 0, 0);      // feet
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.recoilPitch = 0; this.recoilYaw = 0;
    this.grounded = false;
    this.crouch = 0;
    this.bob = 0;
    this.landDip = 0;
    this.tilt = 0;
    this.stepAt = 0;

    this.hp = 100; this.maxHp = 100;
    this.regenTo = 55;              // wounds close back to this, slowly, out of combat
    this.armour = 0; this.maxArmour = 100;
    this.stamina = 100;
    this.staminaHold = 0;
    this.dead = false;
    this.lastHurt = -99;
    this.hurtFlash = 0;
    this.kills = 0;
    this.speedScalar = 1;

    // flashlight: a spotlight parented to the camera, because a torch that
    // lags behind the view feels broken
    this.torch = new THREE.SpotLight(0xfff0d8, 0, 40, 0.5, 0.6, 1.25);
    this.torch.position.set(-0.18, 0.05, 0.05);   // off the left shoulder, away from the gun
    this.torch.target.position.set(0, 0, -1);
    camera.add(this.torch, this.torch.target);
    this.torchOn = true;
    this.torchPower = 85;
  }

  reset(pos, facing = 0, keep = null) {
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    this.yaw = facing; this.pitch = 0;
    this.recoilPitch = this.recoilYaw = 0;
    this.hp = keep && keep.hp ? keep.hp : this.maxHp;
    this.armour = keep && keep.armour ? keep.armour : 0;
    this.stamina = 100;
    this.dead = false;
    this.grounded = false;
    this.crouch = 0;
  }

  eyePos(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + lerp(EYE, CROUCH_EYE, this.crouch), this.pos.z);
  }

  get height() { return lerp(HEIGHT, CROUCH_HEIGHT, this.crouch); }

  look(dx, dy, sensitivity) {
    this.yaw -= dx * sensitivity;
    this.pitch = clamp(this.pitch - dy * sensitivity, -1.45, 1.45);
  }

  addRecoil(amount) {
    this.recoilPitch += amount * 0.012;
    this.recoilYaw += randRange(-amount, amount) * 0.004;
  }

  hurt(amount, time) {
    if (this.dead) return;
    // armour soaks two thirds of a hit until it is gone
    if (this.armour > 0) {
      const soak = Math.min(this.armour, amount * 0.66);
      this.armour -= soak;
      amount -= soak;
    }
    this.hp -= amount;
    this.lastHurt = time;
    this.hurtFlash = 1;
    audio.sfx.hurt();
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
  addArmour(n) { this.armour = Math.min(this.maxArmour, this.armour + n); }

  toggleTorch() {
    this.torchOn = !this.torchOn;
    audio.sfx.ui();
  }

  /**
   * input: { forward, right, jump, sprint, crouch }
   * Returns the horizontal speed, which the HUD and weapon sway both use.
   */
  update(dt, input, world, time) {
    const wantCrouch = input.crouch ? 1 : 0;
    // don't stand up into a ceiling
    if (wantCrouch === 0 && this.crouch > 0.01 && !this.canStand(world)) input.crouch = true;
    this.crouch = damp(this.crouch, input.crouch ? 1 : 0, 12, dt);

    const sprinting = input.sprint && input.forward > 0.1 && this.stamina > 1 && this.crouch < 0.5;
    const maxSpeed = (this.crouch > 0.5 ? 2.4 : sprinting ? 7.1 : 4.6) * this.speedScalar;

    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - dt * 26);
      this.staminaHold = 0.7;
    } else {
      this.staminaHold = Math.max(0, this.staminaHold - dt);
      if (this.staminaHold <= 0) this.stamina = Math.min(100, this.stamina + dt * 22);
    }

    // desired direction in world space
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // camera forward is (-sin, -cos) and camera right is (cos, -sin) in XZ
    let wx = input.right * cos - input.forward * sin;
    let wz = -input.right * sin - input.forward * cos;
    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }

    const accel = this.grounded ? 62 : 14;
    this.vel.x += wx * maxSpeed * accel * dt;
    this.vel.z += wz * maxSpeed * accel * dt;

    // friction / speed cap
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const drag = this.grounded ? (len > 0.01 ? 9 : 14) : 0.6;
    const damped = Math.max(0, speed - speed * drag * dt);
    const capped = Math.min(damped, maxSpeed);
    if (speed > 0.0001) {
      this.vel.x = (this.vel.x / speed) * capped;
      this.vel.z = (this.vel.z / speed) * capped;
    }

    if (input.jump && this.grounded) {
      this.vel.y = 6.6;
      this.grounded = false;
      audio.sfx.jump();
    }

    this.vel.y -= 22 * dt;
    if (this.vel.y < -55) this.vel.y = -55;

    const wasGrounded = this.grounded;
    this.grounded = false;
    this.move(this.vel.x * dt, 0, 0, world);
    this.move(0, 0, this.vel.z * dt, world);
    const fallSpeed = this.vel.y;
    this.move(0, this.vel.y * dt, 0, world);

    if (!wasGrounded && this.grounded) {
      const impact = Math.min(1, -fallSpeed / 18);
      if (impact > 0.12) {
        this.landDip = impact * 0.35;
        audio.sfx.land();
        if (impact > 0.8) this.hurt((impact - 0.8) * 120, time);   // long falls hurt
      }
    }

    // footsteps and head bob
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && hspeed > 0.6) {
      this.bob += dt * (6 + hspeed * 1.5);
      if (this.bob > this.stepAt) {
        this.stepAt = this.bob + Math.PI;
        audio.sfx.step(true);
      }
    } else {
      this.bob = damp(this.bob, Math.round(this.bob / Math.PI) * Math.PI, 6, dt);
    }
    this.landDip = damp(this.landDip, 0, 7, dt);
    this.tilt = damp(this.tilt, -input.right * 0.022, 8, dt);

    // out of combat, patch yourself up to a floor — enough to keep a bad fight
    // from ending the run, not enough to make health pickups pointless
    if (time - this.lastHurt > 6 && this.hp < this.regenTo) {
      this.hp = Math.min(this.regenTo, this.hp + dt * 4.5);
    }

    // recoil recovers most, but not all, of the way back
    this.recoilPitch = damp(this.recoilPitch, 0, 7, dt);
    this.recoilYaw = damp(this.recoilYaw, 0, 6, dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.6);

    // apply to the camera
    const bobAmt = clamp(hspeed * 0.008, 0, 0.045) * (this.grounded ? 1 : 0);
    const eye = this.eyePos();
    this.camera.position.set(
      eye.x + Math.cos(this.bob * 0.5) * bobAmt * 0.6,
      eye.y + Math.sin(this.bob) * bobAmt - this.landDip,
      eye.z
    );
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw + this.recoilYaw);
    this.camera.rotateX(this.pitch + this.recoilPitch);
    this.camera.rotateZ(this.tilt + Math.sin(this.bob) * bobAmt * 0.25);

    // torch brightens with a small warm-up so toggling reads as a real lamp
    this.torch.intensity = damp(this.torch.intensity, this.torchOn ? this.torchPower : 0, 14, dt);

    return hspeed;
  }

  canStand(world) {
    const list = world.near(this.pos.x, this.pos.z, RADIUS + 0.1);
    const headTop = this.pos.y + HEIGHT;
    for (const c of list) {
      if (c.tag === 'ground') continue;
      if (this.pos.x + RADIUS <= c.min.x || this.pos.x - RADIUS >= c.max.x) continue;
      if (this.pos.z + RADIUS <= c.min.z || this.pos.z - RADIUS >= c.max.z) continue;
      if (c.min.y < headTop && c.max.y > this.pos.y + CROUCH_HEIGHT) return false;
    }
    return true;
  }

  /** Move along one axis and push back out of anything we end up inside. */
  move(dx, dy, dz, world) {
    this.pos.x += dx; this.pos.y += dy; this.pos.z += dz;
    const h = this.height;
    const list = world.near(this.pos.x, this.pos.z, RADIUS + 0.6);
    for (const c of list) {
      if (this.pos.x + RADIUS <= c.min.x || this.pos.x - RADIUS >= c.max.x) continue;
      if (this.pos.z + RADIUS <= c.min.z || this.pos.z - RADIUS >= c.max.z) continue;
      if (this.pos.y >= c.max.y - 0.0001 || this.pos.y + h <= c.min.y) continue;

      if (dy !== 0) {
        if (dy < 0) { this.pos.y = c.max.y; this.vel.y = 0; this.grounded = true; }
        else { this.pos.y = c.min.y - h; this.vel.y = Math.min(0, this.vel.y); }
        continue;
      }
      // step up onto low obstacles instead of being stopped by them
      const rise = c.max.y - this.pos.y;
      if (rise > 0 && rise <= STEP && this.vel.y <= 0.1) {
        this.pos.y = c.max.y;
        this.grounded = true;
        continue;
      }
      if (dx !== 0) {
        this.pos.x = dx > 0 ? c.min.x - RADIUS : c.max.x + RADIUS;
        this.vel.x = 0;
      }
      if (dz !== 0) {
        this.pos.z = dz > 0 ? c.min.z - RADIUS : c.max.z + RADIUS;
        this.vel.z = 0;
      }
    }
    if (this.pos.y < -30) {   // fell out of the world
      this.hp = 0; this.dead = true;
    }
  }
}

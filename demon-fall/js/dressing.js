/* Demon Fall — set dressing.
 *
 * Runs after a level has been built and before the world merges its batches.
 * It scatters non-solid detail over the floor the player actually walks on
 * (rubble, litter, spent brass, puddles, weeds, glass) and paints decals on
 * walls and ground (graffiti, posters, oil, cracks, scorch). It uses its own
 * random stream, so the level's layout, spawns and pickups are untouched, and
 * nothing here collides with anything. */
import * as THREE from 'three';
import { makeRng, TAU } from './util.js';
import { dressAtlas, material, puffTexture } from './textures.js';

const UP = new THREE.Vector3(0, -1, 0);

export function dress(world, theme, index, quality = 1, script = null) {
  const rng = makeRng(7919 + index * 104729);
  const outdoor = !theme.dark && theme.rift > 0;
  // Mars and the Moon: rock and panel debris instead of brick, dust drifts instead of puddles
  const space = theme.space || null;
  const stone = space === 'mars' ? 'redrock' : space === 'moon' ? 'regolith' : 'concrete';
  const drift = space && !theme.dark ? { collide: false, shadow: false, mat: { color: space === 'mars' ? 0xe8a888 : 0xb8b8bc } } : null;
  const decals = [];            // { pos, normal, size, cell, rot }

  // the walkable area: everything inside the floor collider that isn't a wall
  const ground = world.colliders.find(c => c.tag === 'ground');
  const half = ground ? Math.min(150, (ground.max.x - ground.min.x) / 2) : 80;
  const solids = world.colliders.filter(c => c.tag !== 'ground' && c.tag !== 'edge');
  const near = [];
  const f0 = world.playerStart.y;                     // the floor the level starts on
  const blocked = (x, z, pad, fy = f0) => {
    world.near(x, z, pad + 0.5, near);
    for (const c of near) {
      if (c.tag === 'ground' || c.tag === 'edge') continue;
      if (c.max.y < fy + 0.35) continue;               // the floor itself, kerbs and low slabs
      if (x > c.min.x - pad && x < c.max.x + pad && z > c.min.z - pad && z < c.max.z + pad && c.min.y < fy + 2) return true;
    }
    return false;
  };
  const floorAt = (x, z) => {
    const hit = world.raycast(new THREE.Vector3(x, f0 + 3, z), UP, 4);
    return hit && hit.point.y > f0 - 0.5 && hit.point.y < f0 + 2.2 && hit.normal.y > 0.5 ? hit.point.y : null;
  };
  // centre the scatter on where the level is: around the colliders' middle and the player start
  let cx = world.playerStart.x, cz = world.playerStart.z;
  const pts = [];
  const want = Math.round((outdoor ? 900 : 700) * quality);
  // the route the player is sent along: start, then each stage's goal zone
  const route = [new THREE.Vector3(cx, 0, cz)];
  for (const st of (script && script.stages) || []) if (st.zone) route.push(st.zone.getCenter(new THREE.Vector3()));
  for (let tries = 0; tries < want * 6 && pts.length < want; tries++) {
    // most samples hug the route, the rest sit near buildings or anywhere
    let x, z;
    const pick = rng();
    if (route.length > 1 && pick < 0.6) {
      const k = rng.int(0, route.length - 2), t = rng(), a = route[k], b = route[k + 1];
      x = a.x + (b.x - a.x) * t + rng.range(-9, 9);
      z = a.z + (b.z - a.z) * t + rng.range(-9, 9);
    } else if (solids.length && pick < 0.85) {
      const c = solids[rng.int(0, solids.length - 1)];
      x = (c.min.x + c.max.x) / 2 + rng.range(-8, 8);
      z = (c.min.z + c.max.z) / 2 + rng.range(-8, 8);
    } else { x = cx + rng.range(-half, half); z = cz + rng.range(-half, half); }
    if (Math.abs(x) > half || Math.abs(z) > half * 1.6) continue;
    const y = floorAt(x, z);
    if (y == null) continue;
    if (blocked(x, z, 0.25, y)) continue;
    pts.push([x, y, z]);
  }

  const brass = { uv: 1, collide: false, shadow: false, mat: { color: 0xc9a24a, metalness: 0.85, roughness: 0.35 } };
  const paper = [{ uv: 1, collide: false, mat: { color: 0xd8d0bc, roughness: 0.95 } }];
  const puddle = { collide: false, shadow: false, mat: { color: 0x1c232b, roughness: 0.06, metalness: 0.15 } };
  const glass = { collide: false, shadow: false, mat: { color: 0x9ab8c8, roughness: 0.05, metalness: 0.9 } };
  const weed = { collide: false, shadow: false, mat: { color: 0x5a6a30, roughness: 0.9 } };

  for (let i = 0; i < pts.length; i++) {
    const [x, y, z] = pts[i], r = rng();
    if (r < 0.2) {
      const mat = space ? (rng() < 0.8 ? stone : 'rust') : rng() < 0.5 ? 'concrete' : 'brick';
      for (let k = rng.int(4, 9); k > 0; k--) {     // tumbled chunks, sitting on whatever floor this is
        const a = rng() * TAU, d = rng() * 1.4, sz = rng.range(0.12, 0.45);
        world.box(x + Math.cos(a) * d, y + sz * 0.35, z + Math.sin(a) * d, sz, sz * rng.range(0.4, 0.9), sz * rng.range(0.6, 1.4), mat, { collide: false, rotY: rng() * TAU, uv: 1.2 });
      }
    } else if (r < 0.38) {
      // crumpled sheets of paper and card
      for (let k = 0; k < 5; k++) {
        world.box(x + rng.range(-1.2, 1.2), y + 0.012, z + rng.range(-1.2, 1.2), rng.range(0.25, 0.5), 0.012, rng.range(0.3, 0.6),
          'plaster', { ...paper[0], rotY: rng() * TAU });
      }
    } else if (r < 0.5) {
      // spent brass from the first night's fighting
      for (let k = 0; k < 6; k++) {
        world.shape(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 5), 'rust',
          { ...brass, pos: [x + rng.range(-0.8, 0.8), y + 0.012, z + rng.range(-0.8, 0.8)], rot: [Math.PI / 2, rng() * TAU, 0] });
      }
    } else if (r < 0.62) {
      // a still, black puddle that mirrors the lights
      const g = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
      if (drift) world.shape(g, space === 'mars' ? 'sand' : 'regolith', { ...drift, pos: [x, y + 0.012, z], scale: [rng.range(0.8, 2), 1, rng.range(0.5, 1.2)], rot: [0, rng() * TAU, 0] });
      else world.shape(g, 'asphalt', { ...puddle, pos: [x, y + 0.012, z], scale: [rng.range(0.4, 1.0), 1, rng.range(0.3, 0.8)], rot: [0, rng() * TAU, 0] });
    } else if (r < 0.72) {
      // broken planks and a length of pipe
      world.box(x, y + 0.04, z, rng.range(1, 2.2), 0.06, 0.2, 'wood', { uv: 1, collide: false, rotY: rng() * TAU });
      if (rng() < 0.5) world.shape(new THREE.CylinderGeometry(0.06, 0.06, rng.range(1, 2.5), 8), 'rust',
        { pos: [x + rng.range(-1, 1), y + 0.06, z + rng.range(-1, 1)], rot: [Math.PI / 2, rng() * TAU, 0], collide: false, mat: { metalness: 0.6, roughness: 0.6 } });
    } else if (r < 0.8) {
      // shattered glass glinting in the torch beam
      for (let k = 0; k < 8; k++) {
        const s = rng.range(0.04, 0.12);
        world.shape(new THREE.TetrahedronGeometry(s), 'rust', { ...glass, pos: [x + rng.range(-0.7, 0.7), y + 0.01, z + rng.range(-0.7, 0.7)], scale: [1, 0.15, 1], rot: [0, rng() * TAU, 0] });
      }
    } else if (r < 0.9 && outdoor) {
      // weeds pushing up through the cracks
      // flat blades fanned out from one clump
      for (let k = 0; k < 9; k++) {
        const h = rng.range(0.12, 0.34), a = rng() * TAU;
        world.shape(new THREE.PlaneGeometry(0.035, h).translate(0, h / 2, 0), 'dirt',
          { ...weed, pos: [x + Math.cos(a) * 0.05, y, z + Math.sin(a) * 0.05], rot: [rng.range(-0.5, 0.5), a, rng.range(-0.4, 0.4)] });
      }
    } else {
      // stains, cracks and scorch on the floor
      decals.push({ pos: new THREE.Vector3(x, y + 0.02, z), normal: new THREE.Vector3(0, 1, 0), size: rng.range(1.2, 3), cell: [4, 5, 6][rng.int(0, 2)], rot: rng() * TAU });
    }
  }

  // graffiti, sigils and posters on the walls at eye height
  const walls = solids.filter(c => c.max.y - c.min.y > 2.4 && c.min.y < 0.5 && ((c.max.x - c.min.x) > 2.5 || (c.max.z - c.min.z) > 2.5));
  const wallCount = Math.round(Math.min(160, walls.length * 0.9) * quality);
  for (let i = 0; i < wallCount; i++) {
    const c = walls[rng.int(0, walls.length - 1)];
    const alongX = (c.max.x - c.min.x) >= (c.max.z - c.min.z);
    const side = rng() < 0.5 ? -1 : 1;
    const lift = rng.range(1.2, 2.2), size = rng.range(1.1, 2.0);
    let x, z, n;
    if (alongX) {
      x = rng.range(c.min.x + size / 2, Math.max(c.min.x + size / 2, c.max.x - size / 2));
      z = side > 0 ? c.max.z : c.min.z; n = new THREE.Vector3(0, 0, side);
    } else {
      z = rng.range(c.min.z + size / 2, Math.max(c.min.z + size / 2, c.max.z - size / 2));
      x = side > 0 ? c.max.x : c.min.x; n = new THREE.Vector3(side, 0, 0);
    }
    // only where the wall face is out in the open
    const probeX = x + n.x * 0.6, probeZ = z + n.z * 0.6;
    const fy = floorAt(probeX, probeZ);
    if (fy == null || blocked(probeX, probeZ, 0.1, fy) || fy + lift + size / 2 > c.max.y) continue;
    const y = fy + lift;
    const cell = [0, 1, 2, 3, 7][rng.int(0, 4)];
    decals.push({ pos: new THREE.Vector3(x + n.x * 0.025, y, z + n.z * 0.025), normal: n, size, cell, rot: rng.range(-0.08, 0.08) });
  }

  material('dirt', weed.mat).side = THREE.DoubleSide;   // grass blades show from both sides
  if (decals.length) world.add(decalMesh(decals));

  // ---- street furniture along the route: lamps with pools of light, burnt-out cars well off the path
  const segDist = (x, z) => {
    let best = 1e9;
    for (let k = 0; k + 1 < route.length; k++) {
      const a = route[k], b = route[k + 1], dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L));
      best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
    }
    return best;
  };
  const pools = [];
  const iron = { uv: 1, collide: false, mat: { color: 0x22201e, metalness: 0.6, roughness: 0.6 } };
  const lampCount = Math.round((outdoor ? 26 : 14) * quality);
  for (let i = 0, tries = 0; i < lampCount && tries < 400; tries++) {
    if (route.length < 2) break;
    const k = rng.int(0, route.length - 2), t = rng(), a = route[k], b = route[k + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1, side = rng() < 0.5 ? -1 : 1;
    const x = a.x + (b.x - a.x) * t + (-(b.z - a.z) / len) * side * rng.range(4.5, 7);
    const z = a.z + (b.z - a.z) * t + ((b.x - a.x) / len) * side * rng.range(4.5, 7);
    const y = floorAt(x, z);
    if (y == null || blocked(x, z, 0.5, y)) continue;
    const h = outdoor ? 5.2 : 3.4;
    world.shape(new THREE.CylinderGeometry(0.07, 0.11, h, 6), 'rust', { ...iron, pos: [x, y + h / 2, z] });
    world.box(x, y + h, z, 0.5, 0.16, 0.32, 'rust', iron);
    const warm = rng() < 0.75, col = warm ? 0xffb066 : 0x9fc4ff;
    if (rng() < 0.85) {
      world.light(col, outdoor ? 10 : 7, x, y + h - 0.3, z, 14);
      pools.push({ x, y: y + 0.03, z, r: rng.range(2.6, 3.6), col, head: y + h - 0.09 });
    }
    i++;
  }
  if (pools.length) world.add(glowMesh(pools));

  if (outdoor) {
    for (let i = 0, tries = 0; i < Math.round(10 * quality) && tries < 300; tries++) {
      const p = pts[rng.int(0, pts.length - 1)];
      if (!p || segDist(p[0], p[2]) < 10) continue;
      if (blocked(p[0], p[2], 2.6, p[1])) continue;
      burntCar(world, p[0], p[1], p[2], rng.range(0, TAU), rng);
      i++;
    }
  }

  // ---- makeshift barricades against walls, away from the path: planks, crossed braces, sandbags
  const plank = { uv: 1, collide: false, mat: { color: 0x7a5a3a } };
  const bag = { uv: 1, collide: false, mat: { color: 0x8a7a5a, roughness: 1 } };
  for (let i = 0, tries = 0; i < Math.round(14 * quality) && tries < 400; tries++) {
    const p = pts[rng.int(0, pts.length - 1)];
    if (!p || segDist(p[0], p[2]) < 7) continue;
    if (!blocked(p[0], p[2], 1.6, p[1]) || blocked(p[0], p[2], 0.6, p[1])) continue;   // close to a wall, not in it
    const rot = rng() < 0.5 ? 0 : Math.PI / 2, c = Math.cos(rot), sn = Math.sin(rot), y = p[1];
    for (const lx of [-1.1, 1.1]) world.box(p[0] + lx * c, y + 0.6, p[2] - lx * sn, 0.12, 1.2, 0.12, 'wood', { ...plank, rotY: rot });
    world.box(p[0], y + 0.85, p[2], 2.4, 0.2, 0.06, 'wood', { ...plank, rotY: rot });
    world.shape(new THREE.BoxGeometry(2.6, 0.16, 0.05), 'wood', { ...plank, pos: [p[0], y + 0.55, p[2]], rot: [0, rot, 0.38] });
    world.shape(new THREE.BoxGeometry(2.6, 0.16, 0.05), 'wood', { ...plank, pos: [p[0], y + 0.55, p[2]], rot: [0, rot, -0.38] });
    for (let k = -2; k <= 2; k++) {
      world.shape(new THREE.SphereGeometry(0.28, 7, 5), 'dirt', { ...bag, pos: [p[0] + k * 0.5 * c + 0.4 * sn, y + 0.14, p[2] - k * 0.5 * sn + 0.4 * c], scale: [1, 0.45, 0.65], rot: [0, rot, 0] });
    }
    i++;
  }

  // ---- far-off fires: glows on the horizon and smoke columns climbing into the sky
  if (outdoor) world.add(skyFires(rng, world.playerStart, route));
}

function burntCar(world, x, y, z, rot, rng) {
  const shell = { uv: 0.8, collide: false, mat: { color: 0x2a201c, roughness: 0.9, metalness: 0.3 } };
  const soot = { uv: 1, collide: false, mat: { color: 0x0c0a0a, roughness: 1 } };
  const c = Math.cos(rot), s = Math.sin(rot);
  const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  let [px, pz] = P(0, 0);
  world.box(px, y + 0.65, pz, 4.2, 0.6, 1.85, 'rust', { ...shell, rotY: rot });
  [px, pz] = P(-0.25, 0);
  world.box(px, y + 1.2, pz, 2.0, 0.55, 1.6, 'rust', { ...soot, rotY: rot });          // gutted cabin
  for (const [lx, lz] of [[1.4, 0.95], [1.4, -0.95], [-1.4, 0.95], [-1.4, -0.95]]) {   // bare rims
    [px, pz] = P(lx, lz);
    world.shape(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8), 'rust', { pos: [px, y + 0.3, pz], rot: [Math.PI / 2, rot, 0], collide: false, mat: { color: 0x3a3634, metalness: 0.7, roughness: 0.6 } });
  }
  [px, pz] = P(2.15, 0);
  world.box(px, y + 0.5, pz, 0.12, 0.3, 1.7, 'rust', { ...soot, rotY: rot });
}

/** Additive pools of lamplight on the floor and a glow round each lamp head, merged. */
function glowMesh(list) {
  const pos = [], uv = [], col = [], idx = [], c = new THREE.Color();
  const quad = (x, y, z, r, flat) => {
    const base = pos.length / 3;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      if (flat) pos.push(x + (u - 0.5) * 2 * r, y, z + (v - 0.5) * 2 * r);
      else pos.push(x + (u - 0.5) * 2 * r, y + (v - 0.5) * 2 * r, z);
      uv.push(u, v); col.push(c.r, c.g, c.b);
    }
    idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  };
  for (const p of list) {
    c.setHex(p.col).multiplyScalar(0.55); quad(p.x, p.y, p.z, p.r, true);
    c.setHex(p.col); quad(p.x, p.head, p.z, 0.7, false);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: puffTexture(), vertexColors: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  m.renderOrder = 2;
  return m;
}

/** Glows of burning districts on the horizon and slow smoke columns over them. */
function skyFires(rng, start, route) {
  const g = new THREE.Group();
  const fireMat = new THREE.SpriteMaterial({ map: puffTexture(), color: 0xff6a24, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const smokeMat = new THREE.SpriteMaterial({ map: puffTexture(), color: 0x4a3c3c, transparent: true, opacity: 0.55, depthWrite: false, fog: false });
  const mid = route.length ? route[Math.floor(route.length / 2)] : start;
  for (let i = 0; i < 5; i++) {
    const a = rng() * TAU, d = rng.range(110, 170);
    const x = mid.x + Math.cos(a) * d, z = mid.z + Math.sin(a) * d;
    const glow = new THREE.Sprite(fireMat);
    glow.position.set(x, rng.range(14, 22), z); glow.scale.set(rng.range(70, 120), rng.range(34, 50), 1);
    g.add(glow);
    for (let k = 0; k < 5; k++) {
      const puff = new THREE.Sprite(smokeMat);
      const s = 16 + k * 10;
      puff.position.set(x + k * k * 1.6, 26 + k * 17, z + k * 2);
      puff.scale.set(s, s, 1);
      g.add(puff);
    }
  }
  g.renderOrder = -1;
  return g;
}

/** All decals of a level merged into one alpha-tested mesh. */
function decalMesh(list) {
  const pos = [], uv = [], nor = [], idx = [];
  const q = new THREE.Quaternion(), z = new THREE.Vector3(0, 0, 1), v = new THREE.Vector3(), rz = new THREE.Quaternion();
  const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  for (const d of list) {
    q.setFromUnitVectors(z, d.normal);
    rz.setFromAxisAngle(z, d.rot);
    q.multiply(rz);
    const u0 = (d.cell % 4) / 4, v0 = 1 - ((d.cell / 4 | 0) + 1) / 2;
    const base = pos.length / 3;
    corners.forEach(([cx, cy], k) => {
      v.set(cx * d.size, cy * d.size, 0).applyQuaternion(q).add(d.pos);
      pos.push(v.x, v.y, v.z);
      nor.push(d.normal.x, d.normal.y, d.normal.z);
      uv.push(u0 + (cx + 0.5) * 0.25, v0 + (cy + 0.5) * 0.5);
    });
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    map: dressAtlas(), transparent: true, alphaTest: 0.05, depthWrite: false, roughness: 0.9,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  }));
  m.receiveShadow = true;
  m.renderOrder = 1;
  return m;
}

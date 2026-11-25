/**
 * The town's life: people walking the streets and standing about the square,
 * boats working the water with their wakes, gulls overhead, and smoke off the
 * chimneys. All procedural, animated by clock, no animation data.
 */

import * as THREE from 'three';
import { key, rng, worldX, worldZ } from './grid';
import { Light } from './geo';
import { Resolved } from './rules';
import { GeoBuilder, blob, cone, cube, plate, post } from './geo';
import { ringTexture, smokeMaterial } from './materials';

type Tile = { x: number; z: number };

interface Walker {
  group: THREE.Group;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  path: Tile[];
  index: number;
  t: number;
  dir: 1 | -1;
  speed: number;
  wait: number;
  phase: number;
}

interface Idler {
  group: THREE.Group;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  base: number;
  phase: number;
}

interface Cat {
  group: THREE.Group;
  tail: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  speed: number;
  wait: number;
  phase: number;
}

interface Dog {
  group: THREE.Group;
  tail: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  speed: number;
  wait: number;
  phase: number;
}

interface Balloon {
  group: THREE.Group;
  radius: number;
  angle: number;
  speed: number;
  height: number;
  phase: number;
}

interface Pigeon {
  group: THREE.Group;
  baseY: number;
  phase: number;
}

interface Boat {
  group: THREE.Group;
  radius: number;
  angle: number;
  speed: number;
  phase: number;
  wakes: THREE.Mesh[];
}

interface Gull {
  group: THREE.Group;
  wingL: THREE.Object3D;
  wingR: THREE.Object3D;
  radius: number;
  angle: number;
  speed: number;
  height: number;
  phase: number;
}

const COATS = [0xc4633f, 0x5b7fa6, 0x7a8f5a, 0xb5874a, 0x8a6fa0, 0x3f6f6a];
const SKIN = 0xe7c6a5;
const HATS = [0x3a2f2a, 0x7a5a44, 0xa9503a, 0x8b90a3];

/** Roles with a chimney: where smoke comes from. */
const CHIMNEYS: ReadonlySet<string> = new Set([
  'house', 'townhouse', 'manor', 'cottage', 'barn', 'inn', 'watermill', 'shop', 'schoolhouse', 'smithy', 'townhall',
]);

const PLAZAS: ReadonlySet<string> = new Set(['plaza', 'square', 'bandstand', 'theatre']);

export class Life {
  readonly group = new THREE.Group();

  private readonly walkers: Walker[] = [];
  private readonly idlers: Idler[] = [];
  private readonly cats: Cat[] = [];
  private readonly dogs: Dog[] = [];
  private balloon: Balloon | null = null;
  private readonly pigeons: Pigeon[] = [];
  private readonly boats: Boat[] = [];
  private readonly gulls: Gull[] = [];
  private readonly smoke = smokeMaterial();
  private readonly rings = ringTexture();
  private glowPoints: THREE.Points | null = null;
  private smokePoints: THREE.Points | null = null;
  private dusk = 0;
  private time = 0;

  constructor(
    private readonly surface: THREE.ShaderMaterial,
    private readonly glow: THREE.ShaderMaterial,
  ) {}

  /** Rebuilds every living thing from the town as it stands now. */
  build(resolved: Map<string, Resolved>, seed: number, lights: Light[]): void {
    this.clear();
    const random = rng((seed ^ 0x2545f491) >>> 0);

    const roads = new Map<string, Resolved>();
    for (const [k, cell] of resolved) {
      if (cell.role === 'street' || cell.role === 'quay') roads.set(k, cell);
    }
    const roadKeys = new Set(roads.keys());

    // People walking, one every couple of street tiles.
    const starts = [...roads.values()];
    const walkers = Math.min(16, Math.floor(roads.size / 2));
    for (let i = 0; i < walkers; i++) {
      const start = starts[Math.floor(random() * starts.length)];
      const path = this.walk(start, roadKeys, random);
      if (path.length < 2) continue;
      const figure = this.figure(random, random() < 0.18 ? 0.72 : 1);
      if (!figure) continue;
      const tile = path[0];
      figure.group.position.set(worldX(tile.x), 0, worldZ(tile.z));
      figure.group.rotation.y = random() * Math.PI * 2;
      this.group.add(figure.group);
      this.walkers.push({
        ...figure,
        path,
        index: 0,
        t: random(),
        dir: 1,
        speed: 0.4 + random() * 0.5,
        wait: random() * 1.5,
        phase: random() * 10,
      });
    }

    // People standing about the square.
    const plazas = [...resolved.values()].filter((cell) => PLAZAS.has(cell.role));
    const idlers = Math.min(10, Math.floor(plazas.length / 2));
    for (let i = 0; i < idlers; i++) {
      const spot = plazas[Math.floor(random() * plazas.length)];
      const figure = this.figure(random, random() < 0.25 ? 0.7 : 1);
      if (!figure) continue;
      const ox = (random() - 0.5) * 0.5;
      const oz = (random() - 0.5) * 0.5;
      figure.group.position.set(worldX(spot.x) + ox, 0, worldZ(spot.z) + oz);
      figure.group.rotation.y = random() * Math.PI * 2;
      this.group.add(figure.group);
      this.idlers.push({
        group: figure.group,
        armL: figure.armL,
        armR: figure.armR,
        base: figure.group.rotation.y,
        phase: random() * 10,
      });
    }

    // Cats and pigeons: the small life of a square.
    const walkables = [...roads.values(), ...plazas];
    for (let i = 0; i < Math.min(3, Math.floor(walkables.length / 8)); i++) {
      const spot = walkables[Math.floor(random() * walkables.length)];
      const cat = this.cat(random);
      if (!cat) continue;
      const origin = new THREE.Vector3(worldX(spot.x), 0, worldZ(spot.z));
      cat.group.position.copy(origin);
      this.group.add(cat.group);
      this.cats.push({
        group: cat.group,
        tail: cat.tail,
        from: origin.clone(),
        to: origin.clone(),
        t: 1,
        speed: 0.18 + random() * 0.12,
        wait: random() * 2,
        phase: random() * 10,
      });
    }
    // Dogs: one per few streets, nosing about faster than the cats.
    for (let i = 0; i < Math.min(3, Math.floor(walkables.length / 10)); i++) {
      const spot = walkables[Math.floor(random() * walkables.length)];
      const dog = this.dog(random);
      if (!dog) continue;
      const origin = new THREE.Vector3(worldX(spot.x), 0, worldZ(spot.z));
      dog.group.position.copy(origin);
      this.group.add(dog.group);
      this.dogs.push({
        group: dog.group,
        tail: dog.tail,
        from: origin.clone(),
        to: origin.clone(),
        t: 1,
        speed: 0.3 + random() * 0.25,
        wait: random() * 2,
        phase: random() * 10,
      });
    }

    // One balloon over the island: the postcard of the whole town.
    const balloon = this.hotAirBalloon(random);
    if (balloon) {
      this.group.add(balloon.group);
      this.balloon = {
        group: balloon.group,
        radius: 4.6 + random() * 2.2,
        angle: random() * Math.PI * 2,
        speed: 0.028 + random() * 0.016,
        height: 2.7 + random() * 0.6,
        phase: random() * 10,
      };
    }

    for (let i = 0; i < Math.min(6, plazas.length); i++) {
      const spot = plazas[Math.floor(random() * plazas.length)];
      const pigeon = this.pigeon(random);
      if (!pigeon) continue;
      pigeon.position.set(worldX(spot.x) + (random() - 0.5) * 0.7, 0, worldZ(spot.z) + (random() - 0.5) * 0.7);
      this.group.add(pigeon);
      this.pigeons.push({ group: pigeon, baseY: 0, phase: random() * 10 });
    }

    // Boats: three of them working a slow circle offshore.
    const makers = [this.sailboat, this.rowboat, this.sailboat];
    for (let i = 0; i < 3; i++) {
      const boat = makers[i % makers.length].call(this, random);
      if (!boat) continue;
      this.group.add(boat.group);
      this.boats.push({
        group: boat.group,
        radius: 8.2 + random() * 2.2,
        angle: random() * Math.PI * 2,
        speed: (0.035 + random() * 0.045) * (random() < 0.5 ? 1 : -1),
        phase: random() * 10,
        wakes: boat.wakes,
      });
    }

    // Gulls, circling over the roofs.
    for (let i = 0; i < 4; i++) {
      const gull = this.gull(random);
      if (!gull) continue;
      this.group.add(gull.group);
      this.gulls.push({
        group: gull.group,
        wingL: gull.wingL,
        wingR: gull.wingR,
        radius: 2.6 + random() * 3.4,
        angle: random() * Math.PI * 2,
        speed: 0.12 + random() * 0.1,
        height: 2.5 + random() * 1.4,
        phase: random() * 10,
      });
    }

    this.buildSmoke(resolved, random);
    this.buildGlow(lights);
  }

  setDusk(dusk: number): void {
    this.dusk = dusk;
    this.glow.uniforms.uDusk.value = dusk;
    this.smoke.uniforms.uTime.value = this.time;
  }

  update(dt: number, time: number): void {
    this.time = time;
    this.smoke.uniforms.uTime.value = time;
    this.glow.uniforms.uTime.value = time;

    for (const walker of this.walkers) {
      if (walker.path.length < 2) continue;
      const walking = walker.wait <= 0;
      if (walking) {
        walker.t += dt * walker.speed;
        while (walker.t >= 1) {
          walker.t -= 1;
          walker.index += walker.dir;
          if (walker.index <= 0) {
            walker.index = 0;
            walker.dir = 1;
            walker.wait = 0.25 + Math.random() * 1.1;
          } else if (walker.index >= walker.path.length - 1) {
            walker.index = walker.path.length - 1;
            walker.dir = -1;
            walker.wait = 0.25 + Math.random() * 1.1;
          }
        }
      } else {
        walker.wait -= dt;
      }

      const from = walker.path[walker.index];
      const toIndex = Math.max(0, Math.min(walker.path.length - 1, walker.index + walker.dir));
      const to = walker.path[toIndex];
      const ax = worldX(from.x);
      const az = worldZ(from.z);
      const bx = worldX(to.x);
      const bz = worldZ(to.z);
      const t = walking ? walker.t : 0;
      walker.group.position.set(ax + (bx - ax) * t, 0, az + (bz - az) * t);
      if (bx !== ax || bz !== az) walker.group.rotation.y = Math.atan2(bx - ax, bz - az);
      walker.group.position.y = Math.abs(Math.sin((time + walker.phase) * 7)) * 0.012;

      const stride = walking ? Math.sin((time + walker.phase) * 9) * 0.5 : 0;
      walker.legL.rotation.x = stride;
      walker.legR.rotation.x = -stride;
      walker.armL.rotation.x = -stride * 0.7;
      walker.armR.rotation.x = stride * 0.7;
    }

    for (const idler of this.idlers) {
      const sway = Math.sin((time + idler.phase) * 0.6);
      idler.group.rotation.y = idler.base + sway * 0.35;
      idler.group.position.y = Math.abs(Math.sin((time + idler.phase) * 1.6)) * 0.006;
      idler.armL.rotation.x = -sway * 0.15;
      idler.armR.rotation.x = sway * 0.15;
    }

    for (const cat of this.cats) {
      if (cat.wait > 0) {
        cat.wait -= dt;
        cat.tail.rotation.z = Math.sin((time + cat.phase) * 2) * 0.2;
      } else {
        cat.t += dt * cat.speed;
        if (cat.t >= 1) {
          cat.t = 1;
          cat.wait = 1 + Math.random() * 3;
          // Pick a new spot to wander to, a couple of tiles away.
          cat.from.copy(cat.to);
          cat.to.set(
            cat.from.x + (Math.random() - 0.5) * 2.2,
            0,
            cat.from.z + (Math.random() - 0.5) * 2.2,
          );
          cat.t = 0;
        }
        const x = cat.from.x + (cat.to.x - cat.from.x) * cat.t;
        const z = cat.from.z + (cat.to.z - cat.from.z) * cat.t;
        cat.group.position.set(x, 0, z);
        if (cat.to.x !== cat.from.x || cat.to.z !== cat.from.z) {
          cat.group.rotation.y = Math.atan2(cat.to.x - cat.from.x, cat.to.z - cat.from.z);
        }
        cat.group.position.y = Math.abs(Math.sin((time + cat.phase) * 6)) * 0.008;
        cat.tail.rotation.z = Math.sin((time + cat.phase) * 3) * 0.45;
      }
    }

    for (const dog of this.dogs) {
      if (dog.wait > 0) {
        dog.wait -= dt;
        dog.tail.rotation.z = Math.sin((time + dog.phase) * 8) * 0.35;
      } else {
        dog.t += dt * dog.speed;
        if (dog.t >= 1) {
          dog.from.copy(dog.to);
          dog.to.set(dog.from.x + (Math.random() - 0.5) * 2.4, 0, dog.from.z + (Math.random() - 0.5) * 2.4);
          dog.t = 0;
          dog.wait = 0.5 + Math.random() * 2;
        }
        const x = dog.from.x + (dog.to.x - dog.from.x) * dog.t;
        const z = dog.from.z + (dog.to.z - dog.from.z) * dog.t;
        dog.group.position.set(x, Math.abs(Math.sin((time + dog.phase) * 8)) * 0.012, z);
        if (dog.to.x !== dog.from.x || dog.to.z !== dog.from.z) {
          dog.group.rotation.y = Math.atan2(dog.to.x - dog.from.x, dog.to.z - dog.from.z);
        }
        dog.tail.rotation.z = Math.sin((time + dog.phase) * 14) * 0.5;
      }
    }

    if (this.balloon) {
      const b = this.balloon;
      const angle = b.angle + time * b.speed;
      const x = Math.cos(angle) * b.radius;
      const z = Math.sin(angle) * b.radius;
      b.group.position.set(x, b.height + Math.sin(time * 0.5 + b.phase) * 0.12, z);
      b.group.rotation.y = -angle;
      b.group.rotation.z = Math.sin(time * 0.4 + b.phase) * 0.035;
    }

    for (const pigeon of this.pigeons) {
      const hop = Math.max(0, Math.sin((time + pigeon.phase) * 1.7));
      pigeon.group.position.y = pigeon.baseY + hop * 0.02;
      pigeon.group.rotation.y += Math.sin(time + pigeon.phase) * 0.002;
    }

    for (const boat of this.boats) {
      const angle = boat.angle + time * boat.speed;
      const x = Math.cos(angle) * boat.radius;
      const z = Math.sin(angle) * boat.radius;
      boat.group.position.set(x, -0.44 + Math.sin(time * 1.1 + boat.phase) * 0.018, z);
      boat.group.rotation.y = -angle + (boat.speed > 0 ? 0 : Math.PI);
      boat.group.rotation.z = Math.sin(time * 0.9 + boat.phase) * 0.05;
      boat.wakes.forEach((wake, index) => {
        const t = (time * 0.22 + boat.phase * 0.15 + index * 0.5) % 1;
        // The wake hangs behind the boat, in the boat's own frame.
        wake.position.set(-0.32 - t * 0.7, 0.006, 0);
        wake.scale.setScalar(0.32 + t * 0.9);
        const material = wake.material as THREE.MeshBasicMaterial;
        material.opacity = (1 - t) * 0.36;
      });
    }

    for (const gull of this.gulls) {
      const angle = gull.angle + time * gull.speed;
      const dive = Math.pow(Math.max(0, Math.sin(time * 0.35 + gull.phase)), 14);
      gull.group.position.set(
        Math.cos(angle) * gull.radius,
        gull.height + Math.sin(time * 0.7 + gull.phase) * 0.25 - dive * 1.1,
        Math.sin(angle) * gull.radius,
      );
      gull.group.rotation.y = -angle + Math.PI / 2;
      gull.group.rotation.z = dive * 0.5;
      const flap = Math.sin(time * 7 + gull.phase) * 0.55;
      gull.wingL.rotation.z = flap;
      gull.wingR.rotation.z = -flap;
    }
  }

  private buildSmoke(resolved: Map<string, Resolved>, random: () => number): void {
    const pipes: Array<{ x: number; y: number; z: number; steam: boolean }> = [];
    for (const cell of resolved.values()) {
      if (!CHIMNEYS.has(cell.role)) continue;
      pipes.push({ x: worldX(cell.x) + 0.1, y: 0.62, z: worldZ(cell.z) - 0.08, steam: cell.role === 'watermill' });
      if (random() < 0.5) pipes.push({ x: worldX(cell.x) - 0.18, y: 0.5, z: worldZ(cell.z) + 0.1, steam: false });
    }
    if (pipes.length === 0) return;

    const count = pipes.length * 3;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const lives = new Float32Array(count);
    const drifts = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const pipe = pipes[i % pipes.length];
      positions[i * 3] = pipe.x;
      positions[i * 3 + 1] = pipe.y;
      positions[i * 3 + 2] = pipe.z;
      phases[i] = random() * 10;
      lives[i] = 4.5 + random() * 2.5;
      drifts[i] = (random() - 0.5) * 0.7;
      seeds[i] = random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aLife', new THREE.BufferAttribute(lives, 1));
    geometry.setAttribute('aDrift', new THREE.BufferAttribute(drifts, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 40);
    this.smokePoints = new THREE.Points(geometry, this.smoke);
    this.smokePoints.frustumCulled = false;
    this.smokePoints.renderOrder = 2;
    this.group.add(this.smokePoints);
  }

  private buildGlow(lights: Light[]): void {
    if (lights.length === 0) return;
    const kept = lights.slice(0, 420);
    const positions = new Float32Array(kept.length * 3);
    const sizes = new Float32Array(kept.length);
    const phases = new Float32Array(kept.length);
    kept.forEach((light, i) => {
      positions[i * 3] = light.x;
      positions[i * 3 + 1] = light.y;
      positions[i * 3 + 2] = light.z;
      sizes[i] = 0.5 + light.size * 0.9;
      phases[i] = (i * 0.37) % 1;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 40);
    this.glowPoints = new THREE.Points(geometry, this.glow);
    this.glowPoints.frustumCulled = false;
    this.glowPoints.renderOrder = 3;
    this.glow.uniforms.uDusk.value = this.dusk;
    this.group.add(this.glowPoints);
  }

  /** A short random walk along the streets, ping-ponged by the walker. */
  private walk(start: Resolved, roads: Set<string>, random: () => number): Tile[] {
    const path: Tile[] = [{ x: start.x, z: start.z }];
    let previous: Tile | null = null;
    for (let step = 0; step < 12; step++) {
      const current = path[path.length - 1];
      const options = [
        { x: current.x + 1, z: current.z },
        { x: current.x - 1, z: current.z },
        { x: current.x, z: current.z + 1 },
        { x: current.x, z: current.z - 1 },
      ].filter(
        (tile) =>
          roads.has(key(tile.x, tile.z)) && !(previous && tile.x === previous.x && tile.z === previous.z),
      );
      if (options.length === 0) break;
      const next = options[Math.floor(random() * options.length)];
      path.push(next);
      previous = current;
    }
    return path;
  }

  /** A little person with legs and arms on their own pivots, so they can walk. */
  private figure(random: () => number, scale: number): Omit<Walker, 'path' | 'index' | 't' | 'dir' | 'speed' | 'wait' | 'phase'> | null {
    const coat = COATS[Math.floor(random() * COATS.length)];
    const hat = HATS[Math.floor(random() * HATS.length)];
    const group = new THREE.Group();

    const torso = new GeoBuilder();
    torso.add(plate(), coat, [0, 0.055, 0], [0, 0, 0], [0.085, 0.11, 0.07]);
    torso.add(blob(), SKIN, [0, 0.145, 0], [0, 0, 0], [0.066, 0.07, 0.066]);
    torso.add(cube(), hat, [0, 0.178, 0], [0, 0, 0], [0.085, 0.016, 0.085]);
    if (random() < 0.3) {
      // A basket on the way to market.
      torso.add(cube(), 0xb59068, [0.075, 0.105, 0.02], [0, 0, 0], [0.06, 0.05, 0.045]);
      torso.add(blob(), 0xc4633f, [0.075, 0.135, 0.02], [0, 0, 0], [0.05, 0.03, 0.04]);
    }
    const torsoGeometry = torso.build();
    if (!torsoGeometry) return null;
    group.add(new THREE.Mesh(torsoGeometry, this.surface));

    const legGeometry = new GeoBuilder()
      .add(cube(), 0x4a3f39, [0, -0.045, 0], [0, 0, 0], [0.028, 0.09, 0.028])
      .build();
    const armGeometry = new GeoBuilder()
      .add(cube(), coat, [0, -0.04, 0], [0, 0, 0], [0.022, 0.08, 0.022])
      .build();
    if (!legGeometry || !armGeometry) return null;

    const makeLeg = (x: number): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.09, 0);
      pivot.add(new THREE.Mesh(legGeometry, this.surface));
      group.add(pivot);
      return pivot;
    };
    const makeArm = (x: number): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.165, 0);
      pivot.add(new THREE.Mesh(armGeometry, this.surface));
      group.add(pivot);
      return pivot;
    };

    const legL = makeLeg(-0.024);
    const legR = makeLeg(0.024);
    const armL = makeArm(-0.05);
    const armR = makeArm(0.05);

    // The legs share one geometry, but each mesh needs its own: clone quietly.
    (legR.children[0] as THREE.Mesh).geometry = legGeometry.clone();
    (armR.children[0] as THREE.Mesh).geometry = armGeometry.clone();
    group.scale.setScalar(scale);
    return { group, legL, legR, armL, armR };
  }

  private makeBoat(hull: THREE.BufferGeometry, sail: THREE.BufferGeometry | null, wakes: THREE.Mesh[]): THREE.Group {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(hull, this.surface));
    if (sail) group.add(new THREE.Mesh(sail, this.surface));
    for (const wake of wakes) group.add(wake);
    return group;
  }

  private wakeMesh(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      map: this.rings,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    return new THREE.Mesh(geometry, material);
  }

  private sailboat(random: () => number): { group: THREE.Group; wakes: THREE.Mesh[] } | null {
    const hull = new GeoBuilder();
    hull.add(blob(), 0x9c7a58, [0, 0.05, 0], [0, 0, 0], [0.52, 0.16, 0.22]);
    hull.add(cube(), 0xf6edda, [0, 0.11, 0], [0, 0, 0], [0.36, 0.03, 0.17]);
    hull.add(cone(), 0x9c7a58, [0.26, 0.05, 0], [0, 0, -1.57], [0.16, 0.18, 0.14]);
    hull.add(post(), 0x7a5a44, [0, 0.26, 0], [0, 0, 0], [0.03, 0.36, 0.03]);
    hull.add(cube(), 0x3a2f2a, [0, 0.45, 0], [0, 0, 0], [0.02, 0.05, 0.02]);
    hull.add(cube(), 0x7a5a44, [-0.1, 0.16, 0], [0, 0, 0], [0.12, 0.06, 0.12]);
    const hullGeometry = hull.build();

    const sail = new GeoBuilder();
    const cloth = random() < 0.5 ? 0xf6edda : 0xece4d3;
    sail.add(cube(), cloth, [0.03, 0.3, 0], [0, 0, 0.07], [0.02, 0.26, 0.22]);
    sail.add(cube(), cloth, [-0.04, 0.22, 0], [0, 0, -0.1], [0.02, 0.14, 0.16]);
    sail.add(cube(), 0xc4633f, [0, 0.44, 0], [0, 0, 0], [0.12, 0.02, 0.02]);
    const sailGeometry = sail.build();

    if (!hullGeometry) return null;
    const wakes = [this.wakeMesh(), this.wakeMesh()];
    return { group: this.makeBoat(hullGeometry, sailGeometry, wakes), wakes };
  }

  private rowboat(random: () => number): { group: THREE.Group; wakes: THREE.Mesh[] } | null {
    const hull = new GeoBuilder();
    hull.add(blob(), 0x9c7a58, [0, 0.05, 0], [0, 0, 0], [0.42, 0.13, 0.2]);
    hull.add(cube(), 0x7a5a44, [0, 0.09, 0], [0, 0, 0], [0.3, 0.02, 0.14]);
    hull.add(post(), 0x7a5a44, [0, 0.13, 0], [0, 0, 0], [0.02, 0.06, 0.02]);
    hull.add(blob(), 0xe7c6a5, [0, 0.16, 0], [0, 0, 0], [0.05, 0.05, 0.05]);
    hull.add(cube(), COATS[Math.floor(random() * COATS.length)], [0, 0.12, 0], [0, 0, 0], [0.07, 0.07, 0.06]);
    hull.add(cube(), 0x7a5a44, [0, 0.12, 0.17], [0, 0.5, 0], [0.3, 0.015, 0.015]);
    hull.add(cube(), 0x7a5a44, [0, 0.12, -0.17], [0, -0.5, 0], [0.3, 0.015, 0.015]);
    const geometry = hull.build();
    if (!geometry) return null;
    const wakes = [this.wakeMesh()];
    return { group: this.makeBoat(geometry, null, wakes), wakes };
  }

  private dog(random: () => number): { group: THREE.Group; tail: THREE.Object3D } | null {
    const gb = new GeoBuilder();
    const coats = [0xb5874a, 0x8a6a4f, 0x3a2f2a, 0xe0d3bb, 0xc4633f];
    const coat = coats[Math.floor(random() * coats.length)];
    gb.add(blob(), coat, [0, 0.075, 0], [0, 0, 0], [0.19, 0.1, 0.1]);
    gb.add(blob(), coat, [0.11, 0.13, 0], [0, 0, 0], [0.095, 0.085, 0.08]);
    gb.add(cube(), coat, [0.185, 0.115, 0], [0, 0, 0], [0.07, 0.05, 0.05]);
    gb.add(cone(), coat, [0.1, 0.175, 0.04], [0.2, 0, 0.5], [0.045, 0.05, 0.03]);
    gb.add(cone(), coat, [0.1, 0.175, -0.04], [-0.2, 0, 0.5], [0.045, 0.05, 0.03]);
    gb.add(cube(), 0x3a2f2a, [0.215, 0.13, 0], [0, 0, 0], [0.022, 0.02, 0.022]);
    for (const [x, z] of [[-0.06, -0.035], [0.05, -0.035], [-0.06, 0.035], [0.05, 0.035]] as const) {
      gb.add(post(), coat, [x, 0.033, z], [0, 0, 0], [0.03, 0.066, 0.03]);
    }
    const geometry = gb.build();
    if (!geometry) return null;
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, this.surface));
    const tailGeometry = new GeoBuilder()
      .add(post(), coat, [0, 0.045, 0], [0, 0, 0], [0.026, 0.1, 0.026])
      .build();
    if (!tailGeometry) return null;
    const tail = new THREE.Group();
    tail.position.set(-0.1, 0.1, 0);
    tail.rotation.z = 0.9;
    tail.add(new THREE.Mesh(tailGeometry, this.surface));
    group.add(tail);
    group.scale.setScalar(0.9 + random() * 0.25);
    return { group, tail };
  }

  private hotAirBalloon(random: () => number): { group: THREE.Group } | null {
    const group = new THREE.Group();
    const envelope = new THREE.Group();
    const gb = new GeoBuilder();
    const panels = [0xc4633f, 0xf6edda, 0x6f9d8c, 0xf6edda];
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      gb.add(blob(), panels[i], [Math.cos(angle) * 0.12, 0, Math.sin(angle) * 0.12], [0, 0, 0], [0.32, 0.42, 0.3]);
    }
    gb.add(blob(), panels[0], [0, 0.2, 0], [0, 0, 0], [0.34, 0.3, 0.32]);
    // Ropes and basket.
    for (const [x, z] of [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]] as const) {
      gb.add(cube(), 0x3a2f2a, [x * 1.3, -0.42, z * 1.3], [0, 0, 0], [0.012, 0.34, 0.012]);
    }
    gb.add(cube(), 0x9c7a58, [0, -0.6, 0], [0, 0, 0], [0.17, 0.13, 0.17]);
    gb.add(cube(), 0x7a5a44, [0, -0.54, 0], [0, 0, 0], [0.19, 0.025, 0.19]);
    gb.add(cube(), 0x3a2f2a, [0, -0.59, 0], [0, 0, 0], [0.15, 0.02, 0.15]);
    const geometry = gb.build();
    if (!geometry) return null;
    envelope.add(new THREE.Mesh(geometry, this.surface));
    group.add(envelope);
    group.scale.setScalar(0.9 + random() * 0.2);
    return { group };
  }

  private cat(random: () => number): { group: THREE.Group; tail: THREE.Object3D } | null {
    const gb = new GeoBuilder();
    const coat = [0x3a2f2a, 0xc9bda6, 0xb5874a, 0x6b6560][Math.floor(random() * 4)];
    gb.add(blob(), coat, [0, 0.055, 0], [0, 0, 0], [0.13, 0.09, 0.08]);
    gb.add(blob(), coat, [0.075, 0.1, 0], [0, 0, 0], [0.075, 0.07, 0.07]);
    for (const sz of [-1, 1]) {
      gb.add(cone(), coat, [0.075, 0.13, sz * 0.022], [0, 0, 0], [0.028, 0.03, 0.028]);
    }
    gb.add(cube(), 0x3a2f2a, [0.105, 0.095, 0], [0, 0, 0], [0.012, 0.012, 0.012]);
    // Four little legs.
    for (const [x, z] of [[-0.03, -0.025], [0.02, -0.025], [-0.03, 0.025], [0.02, 0.025]] as const) {
      gb.add(post(), coat, [x, 0.02, z], [0, 0, 0], [0.018, 0.04, 0.018]);
    }
    const geometry = gb.build();
    if (!geometry) return null;
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, this.surface));
    const tailGeometry = new GeoBuilder()
      .add(post(), coat, [0, 0.035, 0], [0, 0, 0], [0.02, 0.09, 0.02])
      .build();
    if (!tailGeometry) return null;
    const tail = new THREE.Group();
    tail.position.set(-0.06, 0.075, 0);
    tail.rotation.z = 0.5;
    tail.add(new THREE.Mesh(tailGeometry, this.surface));
    group.add(tail);
    group.scale.setScalar(0.9 + random() * 0.3);
    return { group, tail };
  }

  private pigeon(random: () => number): THREE.Group | null {
    const gb = new GeoBuilder();
    const tone = random() < 0.5 ? 0x8b90a3 : 0xc9bda6;
    gb.add(blob(), tone, [0, 0.035, 0], [0, 0, 0], [0.075, 0.055, 0.05]);
    gb.add(blob(), tone, [0.05, 0.06, 0], [0, 0, 0], [0.045, 0.04, 0.04]);
    gb.add(cube(), 0x3a2f2a, [0.075, 0.058, 0], [0, 0, 0], [0.02, 0.012, 0.012]);
    gb.add(cube(), 0x6b6560, [-0.04, 0.045, 0], [0, 0, 0], [0.03, 0.012, 0.03]);
    const geometry = gb.build();
    if (!geometry) return null;
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, this.surface));
    group.rotation.y = random() * Math.PI * 2;
    return group;
  }

  private gull(random: () => number): { group: THREE.Group; wingL: THREE.Object3D; wingR: THREE.Object3D } | null {
    const group = new THREE.Group();
    const body = new GeoBuilder();
    body.add(blob(), 0xf6f1e4, [0, 0, 0], [0, 0, 0], [0.14, 0.09, 0.09]);
    body.add(cube(), 0x3a2f2a, [0, 0.01, 0.08], [0, 0, 0], [0.03, 0.02, 0.03]);
    const bodyGeometry = body.build();
    if (!bodyGeometry) return null;
    group.add(new THREE.Mesh(bodyGeometry, this.surface));

    const wing = new GeoBuilder();
    wing.add(cube(), 0xf6f1e4, [0.1, 0, 0], [0, 0, 0], [0.2, 0.012, 0.075]);
    const wingGeometry = wing.build();
    if (!wingGeometry) return null;

    const left = new THREE.Group();
    left.add(new THREE.Mesh(wingGeometry, this.surface));
    const right = new THREE.Group();
    right.add(new THREE.Mesh(wingGeometry.clone(), this.surface));
    right.scale.x = -1;
    left.position.x = 0.04;
    right.position.x = -0.04;
    group.add(left, right);
    group.scale.setScalar(0.9 + random() * 0.4);
    return { group, wingL: left, wingR: right };
  }

  private clear(): void {
    // Dispose what the group owns before dropping it: the shared surface
    // material and the smoke/ring textures stay.
    this.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = (object as THREE.Mesh).material as THREE.Material | undefined;
      if (material instanceof THREE.MeshBasicMaterial) material.dispose();
    });
    for (const child of [...this.group.children]) this.group.remove(child);
    this.glowPoints = null;
    this.smokePoints = null;
    this.walkers.length = 0;
    this.idlers.length = 0;
    this.cats.length = 0;
    this.dogs.length = 0;
    this.balloon = null;
    this.pigeons.length = 0;
    this.boats.length = 0;
    this.gulls.length = 0;
  }

  dispose(): void {
    this.clear();
    this.smoke.dispose();
    this.rings.dispose();
  }
}

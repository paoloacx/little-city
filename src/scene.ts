/** The diorama: renderer, camera, island, water, the town built on top, and the light of day. */

import * as THREE from 'three';
import { GRID, HALF, Town, isShore, landAt, makeIsland, rng, worldX, worldZ } from './grid';
import { GeoBuilder, Light, blob, cone, cube, panel, post, quad } from './geo';
import { Resolved, resolveTown } from './rules';
import { buildRole } from './buildings';
import { Life } from './life';
import {
  NIGHT_PAPER,
  PAPER,
  ghostMaterial,
  glowMaterial,
  inkMaterial,
  inkOutlineMaterial,
  shadowMaterial,
  waterMaterial,
} from './materials';

const TILE = 1;
const WATER_Y = -0.45;
/** One day and one night. */
const CYCLE = 210;

interface Biome {
  name: string;
  grass: number[];
  sand: number;
  sandDeep: number;
  earth: number;
  earthDeep: number;
  rock: number;
  pebble: number;
  /** What grows between the tiles. */
  props: 'flowers' | 'forest' | 'shells' | 'boulders';
}

/** Four islands, so "Crecer" does not always bring the same meadow. */
const BIOMES: Biome[] = [
  {
    name: 'prado',
    grass: [0x9dbb78, 0xa6c281, 0x94b371, 0xa2bd7c],
    sand: 0xe8d7ad,
    sandDeep: 0xdcc79a,
    earth: 0xa9855f,
    earthDeep: 0x8e6e4e,
    rock: 0xb9ab95,
    pebble: 0xc9bda6,
    props: 'flowers',
  },
  {
    name: 'bosque',
    grass: [0x7e9d63, 0x88a86d, 0x73915a, 0x93b076],
    sand: 0xdcc9a0,
    sandDeep: 0xcbb68d,
    earth: 0x92704d,
    earthDeep: 0x7a5c3f,
    rock: 0x9aa08c,
    pebble: 0xb3b199,
    props: 'forest',
  },
  {
    name: 'dunas',
    grass: [0xb3bf85, 0xbdc890, 0xa9b57b, 0xc4cd97],
    sand: 0xf0e2b8,
    sandDeep: 0xdecfa4,
    earth: 0xc0a172,
    earthDeep: 0xa78a5e,
    rock: 0xcdbb9d,
    pebble: 0xded0b4,
    props: 'shells',
  },
  {
    name: 'roquedo',
    grass: [0x93a883, 0x9db18a, 0x8a9f7c, 0xa3b592],
    sand: 0xd6c7ab,
    sandDeep: 0xc4b498,
    earth: 0x9c8a74,
    earthDeep: 0x82715e,
    rock: 0xa79c8a,
    pebble: 0xbdb3a0,
    props: 'boulders',
  },
];

export interface CameraState {
  azimuth: number;
  elevation: number;
  distance: number;
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
  private readonly canvas: HTMLCanvasElement;
  private readonly terrain = new THREE.Group();
  private readonly townGroup = new THREE.Group();
  private readonly ghost = new THREE.Group();
  private readonly surface = inkMaterial();
  private readonly outline = inkOutlineMaterial(0.034);
  private readonly shadowMaterial = shadowMaterial();
  private readonly water = waterMaterial();
  private readonly ghostMat = ghostMaterial();
  private readonly ghostBox = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), this.ghostMat);
  private readonly ghostPad = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), this.ghostMat);
  private readonly shadowGeometry = (() => {
    const geo = new THREE.PlaneGeometry(0.86, 0.86);
    geo.rotateX(-Math.PI / 2);
    return geo;
  })();
  private readonly life = new Life(this.surface, glowMaterial());
  private readonly clock = new THREE.Clock();
  private readonly paperDay = new THREE.Color(PAPER);
  private readonly paperNight = new THREE.Color(NIGHT_PAPER);
  private readonly paper = new THREE.Color(PAPER);
  private time = 0;
  private clockOffset = 0;
  private cycleOn = true;
  private dusk = 0;
  private mask: boolean[][] = [];
  private biome: Biome = BIOMES[0];
  private seed = 1;
  private disposed = false;

  readonly cam: CameraState = { azimuth: 0.72, elevation: 0.6, distance: 22 };

  /** Called when the light of day changes, so the page can follow it. */
  onDusk: ((dusk: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(PAPER, 1);
    THREE.ColorManagement.enabled = false;

    this.scene.add(this.terrain, this.townGroup, this.life.group, this.ghost);
    this.scene.background = new THREE.Color(PAPER);

    this.ghostBox.visible = false;
    this.ghostPad.visible = false;
    this.ghostPad.rotation.x = -Math.PI / 2;
    this.ghostPad.renderOrder = 3;
    this.ghost.add(this.ghostBox, this.ghostPad);

    this.buildWater();
    this.applyCamera();
    this.resize();

    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  get islandMask(): boolean[][] {
    return this.mask;
  }

  get duskValue(): number {
    return this.dusk;
  }

  private buildWater(): void {
    const geo = new THREE.PlaneGeometry(64, 64, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(geo, this.water);
    water.position.y = WATER_Y;
    water.renderOrder = -1;
    this.scene.add(water);
  }

  /** The name of the island's landscape, for the odd toast. */
  get biomeName(): string {
    return this.biome.name;
  }

  /** Builds the island plate: a grassy top, a sandy lip and the cliff below. */
  setSeed(seed: number): void {
    this.seed = seed;
    this.mask = makeIsland(seed);
    this.clearGroup(this.terrain);

    this.biome = BIOMES[Math.floor(rng((seed ^ 0x51ed270b) >>> 0)() * BIOMES.length) % BIOMES.length];
    const gb = new GeoBuilder();
    const random = rng(seed ^ 0x9e3779b9);
    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        if (!landAt(this.mask, x, z)) continue;
        const wx = worldX(x) * TILE;
        const wz = worldZ(z) * TILE;
        const shore = isShore(this.mask, x, z);
        const pick = this.biome.grass[Math.floor(random() * this.biome.grass.length)];
        const top = shore ? this.biome.sand : pick;
        gb.add(quad(), top, [wx, 0, wz], [0, 0, 0], [TILE, 1, TILE]);
        if (!shore && random() < 0.7) {
          gb.add(quad(), pick, [wx, 0.002 + random() * 0.001, wz], [0, random() * Math.PI, 0], [TILE * 0.5, 1, TILE * 0.5]);
        }

        const sides: Array<[number, number]> = [];
        if (!landAt(this.mask, x + 1, z)) sides.push([1, 0]);
        if (!landAt(this.mask, x - 1, z)) sides.push([-1, 0]);
        if (!landAt(this.mask, x, z + 1)) sides.push([0, 1]);
        if (!landAt(this.mask, x, z - 1)) sides.push([0, -1]);

        for (const [dx, dz] of sides) {
          const cx = wx + (dx * TILE) / 2;
          const cz = wz + (dz * TILE) / 2;
          const rotY = dx !== 0 ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : dz > 0 ? 0 : Math.PI;
          // Sandy lip at the top, darker earth under it.
          gb.add(panel(), this.biome.sandDeep, [cx, -0.11, cz], [0, rotY, 0], [TILE, 0.22, 1]);
          gb.add(panel(), this.biome.earth, [cx, -0.43, cz], [0, rotY, 0], [TILE, 0.42, 1]);
          gb.add(panel(), this.biome.earthDeep, [cx, -0.72, cz], [0, rotY, 0], [TILE, 0.16, 1]);
        }

        // The small stuff that makes a diorama feel drawn: each island has its own.
        this.scatter(gb, wx, wz, shore, random);
      }
    }

    const geometry = gb.build();
    if (!geometry) return;
    const mesh = new THREE.Mesh(geometry, this.surface);
    mesh.frustumCulled = false;
    this.terrain.add(mesh);
    const ink = new THREE.Mesh(geometry, this.outline);
    ink.frustumCulled = false;
    this.terrain.add(ink);
    this.terrain.userData.geometries = new Set([geometry]);
  }

  /**
   * What grows between the tiles, per island: flowers in the meadow, mushrooms
   * and fallen logs in the wood, shells on the dunes, boulders on the rock.
   */
  private scatter(gb: GeoBuilder, wx: number, wz: number, shore: boolean, random: () => number): void {
    const b = this.biome;
    const spot = (spread = 0.6): [number, number] => [
      wx + (random() - 0.5) * spread,
      wz + (random() - 0.5) * spread,
    ];
    const tuft = (x: number, z: number, scale = 1): void => {
      gb.add(cone(), b.grass[0], [x, 0.004, z], [0, random() * 3, 0], [0.09 * scale, 0.1 * scale, 0.09 * scale]);
    };
    const pebble = (x: number, z: number, scale = 1, color: number = b.pebble): void => {
      gb.add(blob(), color, [x, 0.03 * scale, z], [0, random() * 3, 0], [0.1 * scale, 0.07 * scale, 0.1 * scale]);
    };
    const flower = (x: number, z: number): void => {
      const petal = [0xd98d6a, 0xf6d98a, 0xece4d3, 0xb5874a][Math.floor(random() * 4)];
      gb.add(cube(), 0x6f9a52, [x, 0.022, z], [0, 0, 0], [0.012, 0.045, 0.012]);
      gb.add(blob(), petal, [x, 0.05, z], [0, random() * 3, 0], [0.032, 0.026, 0.032]);
    };

    if (shore) {
      if (random() < 0.55) {
        const [x, z] = spot(0.5);
        if (b.props === 'shells') {
          for (let i = 0; i < 3; i++) {
            gb.add(blob(), 0xf0e6d2, [x + (random() - 0.5) * 0.2, 0.02, z + (random() - 0.5) * 0.2], [0, 0, 0], [0.045, 0.025, 0.045]);
          }
          gb.add(cube(), 0xd98d6a, [x + 0.1, 0.02, z - 0.06], [0.3, 0, 0.2], [0.05, 0.018, 0.05]);
        } else if (b.props === 'forest') {
          // Driftwood: a small trunk of pale wood.
          gb.add(cube(), 0xb3a78e, [x, 0.035, z], [0, random() * 3, 0], [0.22, 0.05, 0.06]);
          gb.add(blob(), 0x8a7a5f, [x + 0.1, 0.04, z], [0, 0, 0], [0.06, 0.05, 0.05]);
        } else {
          pebble(x, z, 1 + random() * 0.5, b.rock);
          if (random() < 0.5) tuft(x + 0.1, z - 0.05, 0.8);
        }
      }
      return;
    }

    switch (b.props) {
      case 'flowers':
        if (random() < 0.3) {
          const [x, z] = spot();
          if (random() < 0.45) {
            for (let i = 0; i < 3; i++) flower(x + (random() - 0.5) * 0.16, z + (random() - 0.5) * 0.16);
          } else if (random() < 0.5) {
            tuft(x, z, 1.2);
          } else {
            pebble(x, z, 0.8);
          }
        }
        break;
      case 'forest':
        if (random() < 0.34) {
          const [x, z] = spot();
          const kind = random();
          if (kind < 0.4) {
            // A mushroom ring.
            for (let i = 0; i < 2; i++) {
              const mx = x + (random() - 0.5) * 0.2;
              const mz = z + (random() - 0.5) * 0.2;
              gb.add(post(), 0xe8dcc4, [mx, 0.03, mz], [0, 0, 0], [0.022, 0.06, 0.022]);
              gb.add(cone(), 0xc4633f, [mx, 0.055, mz], [0, 0, 0], [0.07, 0.045, 0.07]);
            }
          } else if (kind < 0.6) {
            gb.add(cube(), 0x8a6a4f, [x, 0.03, z], [0, random() * 3, 0], [0.2, 0.055, 0.07]);
          } else {
            tuft(x, z, 1.4);
          }
        }
        break;
      case 'shells':
        if (random() < 0.24) {
          const [x, z] = spot();
          if (random() < 0.4) {
            gb.add(blob(), 0xf0e6d2, [x, 0.02, z], [0, 0, 0], [0.05, 0.028, 0.05]);
          } else {
            tuft(x, z, 1.1);
          }
        }
        break;
      case 'boulders':
        if (random() < 0.3) {
          const [x, z] = spot();
          if (random() < 0.55) {
            pebble(x, z, 1.7 + random(), b.rock);
            gb.add(blob(), 0x8f9c74, [x + 0.05, 0.055, z], [0, 0, 0], [0.07, 0.045, 0.06]);
          } else {
            tuft(x, z, 1.2);
          }
        }
        break;
    }
  }

  /** Rebuilds every building from the current grid. */
  rebuild(town: Town): Map<string, Resolved> {
    const resolved = resolveTown(town, this.mask);
    this.clearGroup(this.townGroup);
    const geometries = new Set<THREE.BufferGeometry>();
    const lights: Light[] = [];

    for (const [key, cell] of resolved) {
      const gb = new GeoBuilder();
      const random = rng((this.seed * 7919 + cell.x * 131 + cell.z * 17) >>> 0);
      buildRole(cell.role, cell.storeys, gb, random);
      const geometry = gb.build();
      if (!geometry) continue;
      geometries.add(geometry);

      const onWater = !landAt(this.mask, cell.x, cell.z);
      const align =
        cell.role === 'bridge'
          ? landAt(this.mask, cell.x, cell.z - 1) || landAt(this.mask, cell.x, cell.z + 1)
            ? Math.PI / 2
            : 0
          : (random() - 0.5) * 0.05;
      const baseY = onWater && cell.role === 'dock' ? WATER_Y : 0;

      const group = new THREE.Group();
      const mesh = new THREE.Mesh(geometry, this.surface);
      const ink = new THREE.Mesh(geometry, this.outline);
      group.add(mesh, ink);
      if (!onWater) {
        const shadow = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial);
        shadow.position.set(0.1, 0.01, -0.08);
        shadow.rotation.y = 0.3;
        group.add(shadow);
      }
      group.position.set(worldX(cell.x) * TILE, baseY, worldZ(cell.z) * TILE);
      group.rotation.y = align;
      group.userData.key = key;
      this.townGroup.add(group);

      // The lights the builder left: windows, lamps, forges.
      const cos = Math.cos(align);
      const sin = Math.sin(align);
      for (const light of gb.lights) {
        lights.push({
          x: group.position.x + light.x * cos + light.z * sin,
          y: group.position.y + light.y,
          z: group.position.z - light.x * sin + light.z * cos,
          size: light.size,
        });
      }
    }

    this.townGroup.userData.geometries = geometries;
    this.life.build(resolved, this.seed, lights);
    return resolved;
  }

  /** Shows a ghost of the selected block on a tile, or hides it. */
  setGhost(x: number | null, z: number | null, kind: 'block' | 'erase' = 'block', level = 1): void {
    const on = x !== null && z !== null;
    this.ghostBox.visible = on && kind === 'block';
    this.ghostPad.visible = on;
    if (!on) return;
    const wx = worldX(x) * TILE;
    const wz = worldZ(z) * TILE;
    const height = 0.32 + (level - 1) * 0.16;
    this.ghostBox.scale.set(1, height / 0.62, 1);
    this.ghostBox.position.set(wx, height / 2, wz);
    this.ghostPad.position.set(wx, 0.02, wz);
    const color = kind === 'erase' ? new THREE.Color(0xa9503a) : new THREE.Color(0x3a2f2a);
    (this.ghostMat.uniforms.uInk.value as THREE.Color).copy(color);
    this.ghostMat.uniforms.uAlpha.value = kind === 'erase' ? 0.32 : 0.22;
  }

  /** Turns a pointer position into a tile, or null when it misses the island. */
  pick(clientX: number, clientY: number): { x: number; z: number; land: boolean } | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const x = Math.round(hit.x + HALF);
    const z = Math.round(hit.z + HALF);
    if (x < 0 || z < 0 || x >= GRID || z >= GRID) return null;
    return { x, z, land: landAt(this.mask, x, z) };
  }

  rotateBy(dx: number, dy: number): void {
    this.cam.azimuth -= dx * 0.006;
    this.cam.elevation = THREE.MathUtils.clamp(this.cam.elevation + dy * 0.004, 0.16, 1.24);
    this.applyCamera();
  }

  zoomBy(delta: number): void {
    this.cam.distance = THREE.MathUtils.clamp(this.cam.distance * (1 + delta * 0.0012), 12, 62);
    this.applyCamera();
  }

  /** Day and night on their own, or a fixed afternoon. */
  setCycle(on: boolean): void {
    this.cycleOn = on;
    this.applyDusk(on ? this.dusk : 0);
  }

  /** Starts the day at a given point of the cycle: 0 dawn, 0.7 dusk. */
  setPhase(phase: number): void {
    this.clockOffset = (phase % 1) * CYCLE;
  }

  /** The town as a PNG, for the postcard button. */
  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.canvas.toDataURL('image/png');
  }

  private applyCamera(): void {
    const { azimuth, elevation, distance } = this.cam;
    const horizontal = Math.cos(elevation) * distance;
    this.camera.position.set(
      Math.sin(azimuth) * horizontal,
      Math.sin(elevation) * distance,
      Math.cos(azimuth) * horizontal,
    );
    this.camera.lookAt(0, 0.15, 0);
  }

  private applyDusk(dusk: number): void {
    this.dusk = dusk;
    this.surface.uniforms.uDusk.value = dusk;
    this.water.uniforms.uDusk.value = dusk;
    this.paper.copy(this.paperDay).lerp(this.paperNight, dusk * 0.92);
    (this.surface.uniforms.uPaper.value as THREE.Color).copy(this.paper);
    (this.water.uniforms.uPaper.value as THREE.Color).copy(this.paper);
    (this.scene.background as THREE.Color).copy(this.paper);
    this.renderer.setClearColor(this.paper, 1);
    this.life.setDusk(dusk);
    this.onDusk?.(dusk);
  }

  /** A slow day: morning, afternoon, dusk, night, dawn. */
  private duskFor(phase: number): number {
    let value: number;
    if (phase < 0.42) value = 0;
    else if (phase < 0.58) value = (phase - 0.42) / 0.16;
    else if (phase < 0.86) value = 1;
    else value = 1 - (phase - 0.86) / 0.14;
    return value * value * (3 - 2 * value);
  }

  private frame(): void {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    this.water.uniforms.uTime.value = this.time;
    this.surface.uniforms.uTime.value = this.time;

    if (this.cycleOn) {
      const phase = ((this.time + this.clockOffset) % CYCLE) / CYCLE;
      this.applyDusk(this.duskFor(phase));
    }
    this.life.update(dt, this.time);
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.camera.aspect = aspect;
    // Portrait screens are narrow: pull back so the island still reads.
    this.cam.distance = THREE.MathUtils.clamp(aspect < 0.9 ? 22 / Math.max(aspect, 0.42) : 22, 18, 52);
    this.camera.updateProjectionMatrix();
    this.applyCamera();
  }

  /** Removes every child and disposes only the geometries this group owns. */
  private clearGroup(group: THREE.Group): void {
    const geometries = group.userData.geometries as Set<THREE.BufferGeometry> | undefined;
    if (geometries) {
      for (const geometry of geometries) geometry.dispose();
      group.userData.geometries = undefined;
    }
    for (const child of [...group.children]) group.remove(child);
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.clearGroup(this.terrain);
    this.clearGroup(this.townGroup);
    this.life.dispose();
    this.renderer.dispose();
  }
}

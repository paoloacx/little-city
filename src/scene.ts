/** The diorama: renderer, camera, island, water, the town built on top, and the light of day. */

import * as THREE from 'three';
import { GRID, HALF, Town, isChannel, key as gridKey, landAt, makeIsland, rng, worldX, worldZ } from './grid';
import { GeoBuilder, Light, blob, cone, cube, mixHex, panel, patch, post, puff, quad } from './geo';
import { Resolved, resolveTown } from './rules';
import { buildRole } from './buildings';
import { Weather, getSeason } from './season';
import { Life } from './life';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
/** Picking happens on every pointer move: reuse the maths instead of making garbage. */
const pickNdc = new THREE.Vector2();
const pickRay = new THREE.Raycaster();
const pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pickHit = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
/** One day and one night. */
const CYCLE = 210;
/** How much the ground rises at each hill terrace. */
const HILL_STEP = 0.07;
/** Inland water runs just under the grass: a stream you can step over. */
const RIVER_Y = -0.13;
const RIVER_BED = -0.23;

/**
 * A slow field over the island: neighbouring tiles get nearly the same tone, so
 * the grass drifts in big clouds instead of alternating like a chessboard.
 */
function driftField(seed: number, scale: number): (x: number, z: number) => number {
  const hash = (i: number, j: number): number => {
    let n = (i * 374761393 + j * 668265263 + seed * 2654435761) >>> 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  return (x, z) => {
    const fx = x / scale;
    const fz = z / scale;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const sx = tx * tx * (3 - 2 * tx);
    const sz = tz * tz * (3 - 2 * tz);
    const a = hash(ix, iz);
    const b = hash(ix + 1, iz);
    const c = hash(ix, iz + 1);
    const d = hash(ix + 1, iz + 1);
    return (a * (1 - sx) + b * sx) * (1 - sz) + (c * (1 - sx) + d * sx) * sz;
  };
}

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
  /** Garlands, lanterns and flags: only while the town is having a party. */
  private readonly fiestaGroup = new THREE.Group();
  private readonly ghost = new THREE.Group();
  private readonly surface = inkMaterial();
  private readonly outline = inkOutlineMaterial(0.008);
  private readonly shadowMaterial = shadowMaterial();
  private readonly water = waterMaterial();
  private readonly ghostMat = ghostMaterial();
  private readonly ghostInk = new THREE.Color(0x3a2f2a);
  private readonly eraseInk = new THREE.Color(0xa9503a);
  /** What the town looked like last time, so only what changed is rebuilt. */
  private lifeLayout = '';
  private lifeHeights = '';
  private lifeSeed: number | null = null;
  /** Where the last rebuild spent its time, in milliseconds. */
  readonly timings = { build: 0, merge: 0, life: 0, total: 0 };
  /**
   * Each tile keeps its geometry between rebuilds. An edit only rebuilds the
   * tiles whose role, height, turn or wall joins changed.
   */
  private readonly cellCache = new Map<
    string,
    { sig: string; geometry: THREE.BufferGeometry; shadow: THREE.BufferGeometry | null; lights: Light[] }
  >();
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
  /** A real coastline laid over the drawn one, when a place is loaded. */
  private island: boolean[][] | null = null;
  /** Slow field that decides where the ground rolls, cell by cell. */
  private hills: (x: number, z: number) => number = () => 0;
  /** Hills the player made by hand; they win over the island's own ground. */
  private edited: Map<string, number> | null = null;
  /** The party: garlands over the streets and people dancing. */
  private fiesta = false;
  private fiestaLights: Light[] = [];
  /** The town of the last rebuild, so a party can be hung without waiting. */
  private standing: Town | null = null;
  /** The same slow field the grass tone uses, so a hill matches its ground. */
  private grass: (x: number, z: number) => number = () => 0;
  private disposed = false;

  readonly cam: CameraState = { azimuth: 0.72, elevation: 0.6, distance: 22 };

  /** Called when the light of day changes, so the page can follow it. */
  onDusk: ((dusk: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(PAPER, 1);
    THREE.ColorManagement.enabled = false;

    this.scene.add(this.terrain, this.townGroup, this.fiestaGroup, this.life.group, this.ghost);
    this.scene.background = new THREE.Color(PAPER);

    this.ghostBox.visible = false;
    this.ghostPad.visible = false;
    this.ghostPad.rotation.x = -Math.PI / 2;
    this.ghostPad.renderOrder = 3;
    this.ghost.add(this.ghostBox, this.ghostPad);

    this.buildWater();
    // People, cats and dogs stand on the ground the hills give them.
    this.life.ground = (wx, wz) => this.hillLevel(this.worldCell(wx), this.worldCell(wz)) * HILL_STEP;
    this.applyCamera();
    this.resize();

    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** A world coordinate back to its cell, for the things that live between tiles. */
  private worldCell(w: number): number {
    return Math.round(w + HALF);
  }

  get islandMask(): boolean[][] {
    return this.mask;
  }

  get duskValue(): number {
    return this.dusk;
  }

  /** What the renderer is doing this frame: draws, triangles, programs. */
  stats(): { calls: number; triangles: number; geometries: number; programs: number } {
    const info = this.renderer.info;
    return {
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      programs: info.programs?.length ?? 0,
    };
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
    // The town that follows brings its own hills back in `rebuild`.
    this.edited = null;
    this.mask = this.island ?? makeIsland(seed);
    this.clearCellCache();
    this.clearGroup(this.terrain);

    this.biome = BIOMES[Math.floor(rng((seed ^ 0x51ed270b) >>> 0)() * BIOMES.length) % BIOMES.length];
    const gb = new GeoBuilder();
    const random = rng(seed ^ 0x9e3779b9);
    const drift = driftField(seed ^ 0x2545f491, 4.5);
    this.grass = drift;
    this.hills = driftField(seed ^ 0x5bd1e995, 2.6);
    const season = getSeason();
    const tones = this.biome.grass;
    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        if (!landAt(this.mask, x, z)) continue;
        const wx = worldX(x) * TILE;
        const wz = worldZ(z) * TILE;
        // Water at the edge of the island is the sea; water cut inland is a river
        // or a lake, and its bank is a low grassy lip, not a sandy cliff.
        const waterSides: Array<[number, number, boolean]> = [];
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as Array<[number, number]>) {
          if (landAt(this.mask, x + dx, z + dz)) continue;
          waterSides.push([dx, dz, isChannel(this.mask, x + dx, z + dz)]);
        }
        const shore = waterSides.length > 0;
        const coast = waterSides.some((side) => !side[2]);
        // A tone taken from the drift, so a tile is never its own colour.
        const g = Math.min(drift(x, z) * tones.length, tones.length - 1.0001);
        const near = Math.floor(g);
        const grass = mixHex(mixHex(tones[near], tones[near + 1] ?? tones[near], g - near), season.grass[0], season.grass[1]);
        const top = coast ? this.biome.sand : grass;
        gb.add(quad(), top, [wx, 0, wz], [0, 0, 0], [TILE, 1, TILE]);

        // Two irregular patches, barely a tint apart: they break the tile grid
        // without ever drawing a square.
        const inland =
          landAt(this.mask, x + 1, z) && landAt(this.mask, x - 1, z) && landAt(this.mask, x, z + 1) && landAt(this.mask, x, z - 1);
        if (!shore && inland) {
          const patches = random() < 0.35 ? 2 : 1;
          for (let p = 0; p < patches; p++) {
            const size = TILE * (p === 0 ? 1.05 + random() * 0.4 : 0.55 + random() * 0.3);
            const px = wx + (random() - 0.5) * TILE * 0.3;
            const pz = wz + (random() - 0.5) * TILE * 0.3;
            const tone = mixHex(grass, random() < 0.5 ? 0xffffff : 0x2c2a1f, 0.03 + random() * 0.045);
            gb.add(patch(Math.floor(random() * 6)), tone, [px, 0.0012 + p * 0.0007, pz], [0, random() * 6.283, 0], [size, 1, size]);
          }
        }

        for (const [dx, dz, channel] of waterSides) {
          const cx = wx + (dx * TILE) / 2;
          const cz = wz + (dz * TILE) / 2;
          const rotY = dx !== 0 ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : dz > 0 ? 0 : Math.PI;
          if (channel) {
            // A stream bank: grass overhanging a strip of wet earth.
            const lip = 0.06;
            const wall = -RIVER_BED - lip;
            gb.add(panel(), mixHex(grass, this.biome.earth, 0.45), [cx, -lip / 2, cz], [0, rotY, 0], [TILE, lip, 1]);
            // Wet moss rather than sand: a tan band around a pond reads as a pit.
            gb.add(panel(), mixHex(grass, 0x4c5c3d, 0.55), [cx, -lip - wall / 2, cz], [0, rotY, 0], [TILE, wall, 1]);
            // Reeds along the water: the bank of a stream is never bare.
            const reeds = 2 + Math.floor(random() * 3);
            for (let r = 0; r < reeds; r++) {
              const along = (random() - 0.5) * 0.8;
              const rx = cx + (dx === 0 ? along : dx * 0.05) + (random() - 0.5) * 0.05;
              const rz = cz + (dz === 0 ? along : dz * 0.05) + (random() - 0.5) * 0.05;
              const blade = 0.06 + random() * 0.06;
              const tone = season.bare ? mixHex(0xa8b06a, 0xe8ecef, 0.45) : mixHex(0x7d9a5c, 0x9fb46a, random());
              gb.add(cone(), tone, [rx, -0.02, rz], [0.08 * (random() - 0.5), 0, 0.1 * (random() - 0.5)], [0.024, blade, 0.024]);
            }
            continue;
          }
          // Sandy lip at the top, darker earth under it.
          gb.add(panel(), this.biome.sandDeep, [cx, -0.11, cz], [0, rotY, 0], [TILE, 0.22, 1]);
          gb.add(panel(), this.biome.earth, [cx, -0.43, cz], [0, rotY, 0], [TILE, 0.42, 1]);
          gb.add(panel(), this.biome.earthDeep, [cx, -0.72, cz], [0, rotY, 0], [TILE, 0.16, 1]);
        }

        // The small stuff that makes a diorama feel drawn: each island has its own.
        // A terrace hides whatever grows under it, so it is left bare.
        if (this.hillLevel(x, z) === 0 || shore) this.scatter(gb, wx, wz, shore && coast, random);
      }
    }

    // Rivers and lakes: a bed, the water just below the grass, and a little fall
    // wherever the inland water reaches the sea.
    const channels = new GeoBuilder();
    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        if (landAt(this.mask, x, z) || !isChannel(this.mask, x, z)) continue;
        const wx = worldX(x) * TILE;
        const wz = worldZ(z) * TILE;
        const randomCell = rng((seed * 4409 + x * 277 + z * 53) >>> 0);
        gb.add(quad(), mixHex(this.biome.earthDeep, 0x4f5b52, 0.45), [wx, RIVER_BED, wz], [0, 0, 0], [TILE, 1, TILE]);
        // Reeds and a stone or two on the bed, so the water has a floor.
        if (randomCell() < 0.5) {
          gb.add(blob(), this.biome.rock, [wx + (randomCell() - 0.5) * 0.5, RIVER_BED + 0.02, wz + (randomCell() - 0.5) * 0.5], [0, randomCell() * 3, 0], [0.11, 0.05, 0.1]);
        }
        channels.add(quad(), 0xffffff, [wx, RIVER_Y, wz], [0, 0, 0], [TILE * 1.002, 1, TILE * 1.002]);
        // A lily pad or two, floating just under the water line.
        if (randomCell() < 0.22) {
          gb.add(blob(), mixHex(0x6f9a52, 0x3f6b45, 0.35), [wx + (randomCell() - 0.5) * 0.4, RIVER_Y + 0.008, wz + (randomCell() - 0.5) * 0.4], [0, randomCell() * 3, 0], [0.13, 0.012, 0.11]);
        }
        // Where a cell of the stream touches the sea, the water drops.
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as Array<[number, number]>) {
          if (landAt(this.mask, x + dx, z + dz) || isChannel(this.mask, x + dx, z + dz)) continue;
          const cx = wx + (dx * TILE) / 2;
          const cz = wz + (dz * TILE) / 2;
          const rotY = dx !== 0 ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : dz > 0 ? 0 : Math.PI;
          gb.add(panel(), 0xcfe0dd, [cx, (RIVER_Y + WATER_Y) / 2, cz], [0, rotY, 0], [TILE, RIVER_Y - WATER_Y, 1]);
          for (let i = 0; i < 3; i++) {
            gb.add(blob(), 0xe8f1ee, [cx + (randomCell() - 0.5) * 0.5, WATER_Y + 0.02 + i * 0.008, cz + (randomCell() - 0.5) * 0.3], [0, 0, 0], [0.16 - i * 0.03, 0.02, 0.1]);
          }
        }
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
    const owned = new Set([geometry]);
    const river = channels.build();
    if (river) {
      const sheet = new THREE.Mesh(river, this.water);
      sheet.frustumCulled = false;
      sheet.renderOrder = -1;
      this.terrain.add(sheet);
      owned.add(river);
    }
    this.terrain.userData.geometries = owned;
  }

  /**
   * What grows between the tiles, per island: flowers in the meadow, mushrooms
   * and fallen logs in the wood, shells on the dunes, boulders on the rock.
   */
  private scatter(gb: GeoBuilder, wx: number, wz: number, shore: boolean, random: () => number): void {
    const b = this.biome;
    const season = getSeason();
    const spot = (spread = 0.6): [number, number] => [
      wx + (random() - 0.5) * spread,
      wz + (random() - 0.5) * spread,
    ];
    // Grass tufts are little bushes, not needles: a blade thinner than the pen
    // would come out as a black stroke, and a pale cone reads as a stray mark.
    const tuft = (x: number, z: number, scale = 1): void => {
      const turn = random() * 3;
      const tone = season.bare ? mixHex(0x6f9a52, 0xe8ecef, 0.86) : b.name === 'bosque' ? 0x5f7f4a : 0x6f9a52;
      gb.add(blob(), tone, [x, 0.045 * scale, z], [0, turn, 0.2], [0.17 * scale, 0.1 * scale, 0.17 * scale]);
      gb.add(blob(), tone, [x + 0.06 * scale, 0.035 * scale, z - 0.05 * scale], [0, turn + 1, -0.2], [0.11 * scale, 0.08 * scale, 0.11 * scale]);
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
          // A patch of sea grass where the sand meets the wood: no loose planks
          // lying about, which read as litter rather than as a shore.
          tuft(x, z, 1.1);
          pebble(x + 0.12, z - 0.08, 1.1, mixHex(b.pebble, b.sand, 0.4));
        } else {
          pebble(x, z, 1 + random() * 0.5, b.rock);
          if (random() < 0.5) tuft(x + 0.1, z - 0.05, 0.8);
        }
      }
      return;
    }

    switch (b.props) {
      case 'flowers':
        if (random() < (season.bare ? 0.06 : 0.3)) {
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
            // A clump of ferns: three low fronds, not a log on the ground.
            for (let i = 0; i < 3; i++) {
              const angle = (i * Math.PI * 2) / 3 + random();
              gb.add(
                blob(),
                mixHex(0x6f9a52, 0x4d7040, random() * 0.6),
                [x + Math.cos(angle) * 0.07, 0.05, z + Math.sin(angle) * 0.07],
                [0, random() * 3, 0.2 * Math.cos(angle)],
                [0.16, 0.05, 0.12],
              );
            }
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

  /** How high the ground stands on a cell: the player's hill, or the island's. */
  groundLevel(x: number, z: number): number {
    return this.hillLevel(x, z);
  }

  /** How high the ground stands on a cell: zero, one step or two, or more by hand. */
  private hillLevel(x: number, z: number): number {
    const lift = this.edited?.get(gridKey(x, z));
    return lift !== undefined ? lift : this.naturalLevel(x, z);
  }

  /** The hill the island drew here, ignoring any shovel: 0, 1 or 2 steps. */
  naturalLevel(x: number, z: number): number {
    const rise = this.hills(x, z);
    return rise < 0.54 ? 0 : rise < 0.72 ? 1 : 2;
  }

  /** The colour the island's grass has on this cell, hills included. */
  private grassTone(x: number, z: number): number {
    const tones = this.biome.grass;
    const g = Math.min(this.grass(x, z) * tones.length, tones.length - 1.0001);
    const near = Math.floor(g);
    return mixHex(mixHex(tones[near], tones[near + 1] ?? tones[near], g - near), getSeason().grass[0], getSeason().grass[1]);
  }

  /** Rebuilds the buildings that changed, then merges them into a few draws. */
  rebuild(town: Town): Map<string, Resolved> {
    const started = performance.now();
    this.timings.build = 0;
    this.timings.merge = 0;
    this.timings.life = 0;
    this.standing = town;
    const hills = town.ground ?? null;
    if (hills !== this.edited) {
      this.edited = hills;
      // People stand on the ground: a hill raised under them leaves them sunk.
      this.lifeLayout = '';
    }
    const resolved = resolveTown(town, this.mask, (x, z) => this.hillLevel(x, z));
    this.clearGroup(this.townGroup);
    const parts: THREE.BufferGeometry[] = [];
    const mounds: THREE.BufferGeometry[] = [];
    const shadows: THREE.BufferGeometry[] = [];
    const lights: Light[] = [];
    const matrix = new THREE.Matrix4();
    const shadowMatrix = new THREE.Matrix4();
    const offset = new THREE.Vector3();
    let layoutSig = `${this.seed}|`;
    let heightsSig = `${this.seed}|`;
    const alive = new Set<string>();

    for (const [key, cell] of resolved) {
      layoutSig += `${key}:${cell.role};`;
      heightsSig += `${key}:${cell.role}:${cell.storeys};`;
      alive.add(key);
      const onWater = !landAt(this.mask, cell.x, cell.z);
      const random = rng((this.seed * 7919 + cell.x * 131 + cell.z * 17) >>> 0);
      // The turn jitter is drawn first, so it does not depend on the role and
      // the tile can be cached: a wall turns with the walls it joins, a lone
      // one by hand, and a bridge across the water.
      const jitter = (random() - 0.5) * 0.05;
      const align =
        cell.role === 'bridge'
          ? landAt(this.mask, cell.x, cell.z - 1) || landAt(this.mask, cell.x, cell.z + 1)
            ? Math.PI / 2
            : 0
          : cell.block === 'wall' || cell.block === 'path'
            ? cell.links === 0
              ? (cell.rot * Math.PI) / 2
              // A wall or a lane that joins its neighbours draws its own arms
              // in world directions: turning the tile would break the run.
              : 0
            : (cell.rot * Math.PI) / 2 + jitter;
      const baseY = onWater && cell.role === 'dock' ? WATER_Y : this.hillLevel(cell.x, cell.z) * HILL_STEP;
      const season = getSeason();
      const wx = worldX(cell.x) * TILE;
      const wz = worldZ(cell.z) * TILE;
      const sig = `${cell.role}|${cell.storeys}|${cell.links}|${cell.rot}|${align.toFixed(4)}|${baseY}|${onWater}|${season.id}`;

      let cached = this.cellCache.get(key);
      if (cached && cached.sig !== sig) {
        cached.geometry.dispose();
        cached.shadow?.dispose();
        this.cellCache.delete(key);
        cached = undefined;
      }
      if (!cached) {
        const buildStarted = performance.now();
        const gb = new GeoBuilder();
        buildRole(cell.role, cell.storeys, gb, random, cell.links);
        const raw = gb.build();
        if (raw) {
          // One merged town: the cell geometry is baked into world space.
          matrix.makeRotationY(align);
          matrix.setPosition(wx, baseY, wz);
          raw.applyMatrix4(matrix);
          let shadow: THREE.BufferGeometry | null = null;
          if (!onWater) {
            shadow = this.shadowGeometry.clone();
            // The shadow lies on the ground the block stands on, so a house on a
            // terrace does not drop its shadow down the slope.
            offset.set(0.1, baseY + 0.012, -0.08).applyAxisAngle(Y_AXIS, align);
            shadowMatrix.makeRotationY(align + 0.3);
            shadowMatrix.setPosition(wx + offset.x, offset.y, wz + offset.z);
            shadow.applyMatrix4(shadowMatrix);
          }
          const cos = Math.cos(align);
          const sin = Math.sin(align);
          const cellLights = gb.lights.map((light) => ({
            x: wx + light.x * cos + light.z * sin,
            y: baseY + light.y,
            z: wz - light.x * sin + light.z * cos,
            size: light.size,
          }));
          cached = { sig, geometry: raw, shadow, lights: cellLights };
          this.cellCache.set(key, cached);
        }
        this.timings.build += performance.now() - buildStarted;
        if (!cached) continue;
      }

      parts.push(cached.geometry);
      if (cached.shadow) shadows.push(cached.shadow);
      for (const light of cached.lights) lights.push(light);
    }

    // Rolling ground: the hill field lifts a cell one or two steps, and the sides
    // of the step are drawn only where the neighbour is lower. It is cached like
    // any other tile, so a building on a hill sits on top of it.
    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        if (!landAt(this.mask, x, z)) continue;
        const at = gridKey(x, z);
        const built = resolved.has(at);
        const level = this.hillLevel(x, z);
        if (level === 0) continue;
        const sides = [
          landAt(this.mask, x, z + 1) ? this.hillLevel(x, z + 1) : 0,
          landAt(this.mask, x, z - 1) ? this.hillLevel(x, z - 1) : 0,
          landAt(this.mask, x + 1, z) ? this.hillLevel(x + 1, z) : 0,
          landAt(this.mask, x - 1, z) ? this.hillLevel(x - 1, z) : 0,
        ];
        const moundKey = `hill:${at}`;
        const sig = `${level}|${sides.join('')}|${built}`;
        alive.add(moundKey);
        let entry = this.cellCache.get(moundKey);
        if (entry && entry.sig !== sig) {
          entry.geometry.dispose();
          entry.shadow?.dispose();
          this.cellCache.delete(moundKey);
          entry = undefined;
        }
        if (!entry) {
          const gb = new GeoBuilder();
          const random = rng((this.seed * 6151 + x * 197 + z * 31) >>> 0);
          // Not perfectly level: a millimetre of wobble keeps the crowns from
          // reading as a sheet of glass laid over the field.
          const h = level * HILL_STEP + (random() - 0.5) * 0.014;
          const tone = this.grassTone(x, z);
          const lipTone = mixHex(tone, this.biome.earth, 0.3);
          const wallTone = mixHex(tone, 0x6f7f5a, 0.5);
          // The crown is drawn even under a building: a block does not always
          // cover its tile, and a missing floor would be a hole into the dark.
          gb.add(quad(), tone, [0, built ? h - 0.004 : h, 0], [0, 0, 0], [TILE, 1, TILE]);
          if (!built) {
            // A few tufts on the crown, so a hill has something growing on it.
            const tufts = 1 + Math.floor(random() * 2);
            // Snow covers the hill too: a green tuft on a white crown is a bug.
            const tuftTone = getSeason().bare ? mixHex(0x9aae94, 0xeef2f4, 0.72) : mixHex(0x6f9a52, tone, 0.35);
            for (let i = 0; i < tufts; i++) {
              const angle = random() * Math.PI * 2;
              const reach = 0.12 + random() * 0.22;
              gb.add(blob(), tuftTone, [Math.cos(angle) * reach, h + 0.03, Math.sin(angle) * reach], [0, random() * 3, 0.2], [0.15, 0.09, 0.15]);
            }
            if (random() < 0.4) {
              const angle = random() * Math.PI * 2;
              gb.add(blob(), this.biome.pebble, [Math.cos(angle) * 0.24, h + 0.025, Math.sin(angle) * 0.24], [0, random() * 3, 0], [0.09, 0.06, 0.09]);
            }
          }
          const faces: Array<[number, number, number]> = [
            [0, h, 0.5 * TILE],
            [0, h, -0.5 * TILE],
            [0.5 * TILE, h, 0],
            [-0.5 * TILE, h, 0],
          ];
          const turns = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
          for (let i = 0; i < 4; i++) {
            const low = sides[i] * HILL_STEP;
            if (low >= h - 0.012) continue;
            const [fx, , fz] = faces[i];
            // Two bands: a grassy lip at the very top and bare earth under it,
            // set a hair inwards so the grass overhangs the drop.
            const lip = 0.03;
            gb.add(panel(), lipTone, [fx, h - lip / 2, fz], [0, turns[i], 0], [TILE, lip, 1]);
            const wall = h - lip - low;
            if (wall > 0.004) {
              gb.add(panel(), mixHex(wallTone, this.biome.earth, 0.25), [fx * 0.985, low + wall / 2, fz * 0.985], [0, turns[i], 0], [TILE, wall, 1]);
            }
          }
          const raw = gb.build();
          if (!raw) continue;
          raw.applyMatrix4(new THREE.Matrix4().setPosition(worldX(x) * TILE, 0, worldZ(z) * TILE));
          entry = { sig, geometry: raw, shadow: null, lights: [] };
          this.cellCache.set(moundKey, entry);
        }
        mounds.push(entry.geometry);
      }
    }

    // Tiles that are gone take their geometry with them.
    for (const [key, entry] of this.cellCache) {
      if (alive.has(key)) continue;
      entry.geometry.dispose();
      entry.shadow?.dispose();
      this.cellCache.delete(key);
    }

    const owned = new Set<THREE.BufferGeometry>();
    const mergeStarted = performance.now();
    // The hill terraces go in without the ink pass: an inverted hull around a
    // panel three centimetres thick paints a black band along every step.
    const relief = mounds.length ? mergeGeometries(mounds, false) : null;
    if (relief) {
      relief.computeBoundingSphere();
      const mesh = new THREE.Mesh(relief, this.surface);
      mesh.frustumCulled = false;
      this.townGroup.add(mesh);
      owned.add(relief);
    }
    const merged = parts.length ? mergeGeometries(parts, false) : null;
    if (merged) {
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, this.surface);
      const ink = new THREE.Mesh(merged, this.outline);
      mesh.frustumCulled = false;
      ink.frustumCulled = false;
      this.townGroup.add(mesh, ink);
      owned.add(merged);
    }

    const ground = shadows.length ? mergeGeometries(shadows, false) : null;
    if (ground) {
      ground.computeBoundingSphere();
      const mesh = new THREE.Mesh(ground, this.shadowMaterial);
      mesh.frustumCulled = false;
      this.townGroup.add(mesh);
      owned.add(ground);
    }

    this.townGroup.userData.geometries = owned;
    this.timings.merge = performance.now() - mergeStarted;

    // People, boats and smoke only depend on what the town is made of and how
    // tall it is, not on how it is turned: turning a house only moves its lights.
    const lifeStarted = performance.now();
    if (this.lifeSeed !== this.seed) {
      this.lifeSeed = this.seed;
      this.lifeLayout = layoutSig;
      this.lifeHeights = heightsSig;
      this.life.build(resolved, this.seed);
    } else if (layoutSig !== this.lifeLayout) {
      this.lifeLayout = layoutSig;
      this.lifeHeights = heightsSig;
      this.life.rebuildLife(resolved, this.seed);
      this.life.rebuildSmoke(resolved, this.seed);
    } else if (heightsSig !== this.lifeHeights) {
      this.lifeHeights = heightsSig;
      this.life.rebuildSmoke(resolved, this.seed);
    }
    this.buildFiesta(resolved);
    this.life.setLights(this.fiesta ? [...lights, ...this.fiestaLights] : lights);
    this.timings.life = performance.now() - lifeStarted;
    this.timings.total = performance.now() - started;
    return resolved;
  }

  /** Turns the party on or off: garlands, lanterns and dancing. */
  setFiesta(on: boolean): void {
    if (this.fiesta === on) return;
    this.fiesta = on;
    this.life.setFiesta(on);
    if (this.standing) this.rebuild(this.standing);
    if (!on) this.clearGroup(this.fiestaGroup);
  }

  get fiestaOn(): boolean {
    return this.fiesta;
  }

  /**
   * A rope from a house to the house across the street, with its pennants and a
   * lantern every few steps, and strings over the square. It hangs on the street,
   * never on the roofs.
   */
  private buildFiesta(resolved: Map<string, Resolved>): void {
    this.clearGroup(this.fiestaGroup);
    this.fiestaLights = [];
    if (!this.fiesta) return;
    const gb = new GeoBuilder();
    const open = new Set(['street', 'quay', 'plaza', 'square', 'bandstand', 'theatre']);
    const square = new Set(['plaza', 'square', 'bandstand', 'theatre']);
    const flags = [0xe0674f, 0xf0c05a, 0x6fa8d0, 0xf2ece0, 0x8fbf6a];
    const ropeTone = 0x6a5a48;
    let count = 0;
    // Tied to the wall, a little under the eaves: above the roof it would float.
    const wallTop = (cell: Resolved): number => 0.34 + Math.min(cell.storeys, 5) * 0.12;

    const hang = (ax: number, ay: number, az: number, bx: number, by: number, bz: number): void => {
      const steps = 8;
      const sag = 0.08 + Math.abs(ay - by) * 0.12;
      const span = Math.hypot(bx - ax, bz - az);
      const segLen = span / steps;
      const alongX = Math.abs(bx - ax) > Math.abs(bz - az);
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const t1 = (i + 1) / steps;
        const y0 = ay + (by - ay) * t0 - sag * 4 * t0 * (1 - t0);
        const y1 = ay + (by - ay) * t1 - sag * 4 * t1 * (1 - t1);
        const mx = ax + (bx - ax) * ((t0 + t1) / 2);
        const mz = az + (bz - az) * ((t0 + t1) / 2);
        const dy = y1 - y0;
        const slope = Math.atan2(dy, segLen);
        const length = Math.hypot(segLen, dy);
        if (alongX) gb.add(cube(), ropeTone, [mx, (y0 + y1) / 2, mz], [0, 0, slope], [length + 0.01, 0.014, 0.014]);
        else gb.add(cube(), ropeTone, [mx, (y0 + y1) / 2, mz], [-slope, 0, 0], [0.014, 0.014, length + 0.01]);
        if (i % 2 === 1) {
          const tone = flags[count % flags.length];
          gb.add(cube(), tone, [mx, (y0 + y1) / 2 - 0.05, mz], [0, 0, 0], alongX ? [0.055, 0.08, 0.008] : [0.008, 0.08, 0.055]);
          if (count % 3 === 1) {
            gb.add(puff(), 0xf6d7a0, [mx, (y0 + y1) / 2 - 0.075, mz], [0, 0, 0], [0.07, 0.085, 0.07]);
            this.fiestaLights.push({ x: mx, y: (y0 + y1) / 2 - 0.08, z: mz, size: 0.8 });
          }
          count++;
        }
      }
    };

    for (const cell of resolved.values()) {
      if (open.has(cell.role)) continue;
      for (const [dx, dz] of [
        [1, 0],
        [0, 1],
      ] as Array<[number, number]>) {
        const between = resolved.get(gridKey(cell.x + dx, cell.z + dz));
        const far = resolved.get(gridKey(cell.x + 2 * dx, cell.z + 2 * dz));
        if (!between || !far) continue;
        if (!open.has(between.role) || open.has(far.role)) continue;
        // A tree across the way has no wall to tie the rope to.
        if (far.block === 'tree') continue;
        hang(
          worldX(cell.x) + dx * 0.44,
          wallTop(cell),
          worldZ(cell.z) + dz * 0.44,
          worldX(far.x) - dx * 0.44,
          wallTop(far),
          worldZ(far.z) - dz * 0.44,
        );
      }
    }

    // The square gets its own criss-cross of paper, high enough to read from above.
    for (const cell of resolved.values()) {
      if (!square.has(cell.role)) continue;
      if ((cell.x + cell.z) % 2 !== 0) continue;
      const cx = worldX(cell.x);
      const cz = worldZ(cell.z);
      const height = 0.82 + Math.min(cell.storeys, 3) * 0.06;
      hang(cx - 0.46, height, cz, cx + 0.46, height, cz);
      hang(cx, height, cz - 0.46, cx, height, cz + 0.46);
    }

    const geometry = gb.build();
    if (!geometry) return;
    const mesh = new THREE.Mesh(geometry, this.surface);
    mesh.frustumCulled = false;
    this.fiestaGroup.add(mesh);
    this.fiestaGroup.userData.geometries = new Set([geometry]);
  }

  /** Forgets every cached tile: used when the island changes under the town. */
  private clearCellCache(): void {
    for (const entry of this.cellCache.values()) {
      entry.geometry.dispose();
      entry.shadow?.dispose();
    }
    this.cellCache.clear();
    this.lifeLayout = '';
    this.lifeHeights = '';
    this.lifeSeed = null;
  }

  /** Shows a ghost of the selected block on a tile, or hides it. */
  setGhost(x: number | null, z: number | null, kind: 'block' | 'erase' = 'block', level = 1): void {
    const on = x !== null && z !== null;
    this.ghostBox.visible = on && kind === 'block';
    this.ghostPad.visible = on;
    if (!on) return;
    const wx = worldX(x) * TILE;
    const wz = worldZ(z) * TILE;
    const baseY = this.hillLevel(x, z) * HILL_STEP;
    const height = 0.32 + (level - 1) * 0.16;
    this.ghostBox.scale.set(1, height / 0.62, 1);
    this.ghostBox.position.set(wx, baseY + height / 2, wz);
    this.ghostPad.position.set(wx, baseY + 0.02, wz);
    (this.ghostMat.uniforms.uInk.value as THREE.Color).copy(kind === 'erase' ? this.eraseInk : this.ghostInk);
    this.ghostMat.uniforms.uAlpha.value = kind === 'erase' ? 0.32 : 0.22;
  }

  /** The weather of the season, over the whole island. */
  setWeather(kind: Weather): void {
    this.life.setWeather(kind);
  }

  /** Lays a real place under the town: its coastline replaces the drawn one. */
  setIsland(mask: boolean[][] | null): void {
    this.island = mask;
    this.clearCellCache();
    this.setSeed(this.seed);
  }

  /** Turns a pointer position into a tile, or null when it misses the island. */
  pick(clientX: number, clientY: number): { x: number; z: number; land: boolean } | null {
    const rect = this.canvas.getBoundingClientRect();
    pickNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    pickRay.setFromCamera(pickNdc, this.camera);
    if (!pickRay.ray.intersectPlane(pickPlane, pickHit)) return null;
    const x = Math.round(pickHit.x + HALF);
    const z = Math.round(pickHit.z + HALF);
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
      const next = this.duskFor(phase);
      if (Math.abs(next - this.dusk) > 0.002) this.applyDusk(next);
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
    this.clearCellCache();
    this.renderer.setAnimationLoop(null);
    this.clearGroup(this.terrain);
    this.clearGroup(this.townGroup);
    this.life.dispose();
    this.renderer.dispose();
  }
}

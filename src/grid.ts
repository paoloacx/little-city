/** The grid, the island and the saved town. */

export const GRID = 15;
export const HALF = (GRID - 1) / 2;
export const MAX_LEVEL = 5;

export type BlockKind =
  | 'house'
  | 'tower'
  | 'path'
  | 'tree'
  | 'plaza'
  | 'dock'
  | 'mill'
  | 'field'
  | 'garden'
  | 'wall';

export interface BlockDef {
  kind: BlockKind;
  label: string;
  swatch: string;
  hint: string;
}

/** Palette order is the order of the toolbar. */
export const BLOCK_DEFS: BlockDef[] = [
  { kind: 'house', label: 'Casa', swatch: '#f6edda', hint: 'Cinco clics y crece: casa, alta, casona, vecindad, palacio.' },
  { kind: 'tower', label: 'Torre', swatch: '#dcd3c2', hint: 'Crece a campanario, atalaya, aguja y torre maestra.' },
  { kind: 'path', label: 'Camino', swatch: '#d9c8a8', hint: 'Calle, muelle de piedra o puente sobre el agua.' },
  { kind: 'tree', label: 'Árbol', swatch: '#8db46a', hint: 'Cada clic lo hace más grande, hasta el roble. Cuatro juntos, huerto.' },
  { kind: 'plaza', label: 'Plaza', swatch: '#c9c2b4', hint: 'Rodeada de plaza, fuente; con torre, teatro.' },
  { kind: 'mill', label: 'Molino', swatch: '#d9b877', hint: 'Con campos, muele; junto al agua, molino de agua.' },
  { kind: 'field', label: 'Campo', swatch: '#c9d49a', hint: 'Junto a una casa la vuelve granero o herrería.' },
  { kind: 'dock', label: 'Muelle', swatch: '#9c7a58', hint: 'Se puede poner sobre el agua. Junto a casa, casa de botes.' },
  { kind: 'garden', label: 'Jardín', swatch: '#a8c47d', hint: 'Cinco clics: parque, invernadero, laberinto y arboreto.' },
  { kind: 'wall', label: 'Muralla', swatch: '#b9ae9c', hint: 'Cinco clics: muralla, torreón, fortaleza y alcázar.' },
];

/**
 * Some blocks are earned: they appear locked in the palette until the town has
 * discovered enough things. Casa, torre, camino, árbol and plaza are free.
 */
export const UNLOCK_AT: Partial<Record<BlockKind, number>> = {
  field: 2,
  dock: 4,
  mill: 6,
  garden: 10,
  wall: 16,
};

/** A placed block carries its height and its turn: click again to build up. */
export interface Placed {
  kind: BlockKind;
  level: number;
  /** Quarter turns, 0..3: each building can be turned to face any way. */
  rot?: number;
}

export const key = (x: number, z: number): string => `${x},${z}`;

/** The four sides of a tile: a bit each, for walls that join their neighbours. */
export const LINK_N = 1;
export const LINK_E = 2;
export const LINK_S = 4;
export const LINK_W = 8;

export interface Town {
  seed: number;
  blocks: Map<string, Placed>;
}

export interface SavedTown {
  seed: number;
  blocks: [number, number, BlockKind, number, number?][];
  found: string[];
  clicks: number;
}

export const TOWN_KEY = 'ciudad-pequena.town.v1';

/** A small, fast, seedable PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A blobby island: a superellipse whose outline wobbles with the seed. */
export function makeIsland(seed: number): boolean[][] {
  const random = rng(seed);
  const phases = [0, 1, 2, 3].map(() => random() * Math.PI * 2);
  const mask: boolean[][] = [];
  for (let z = 0; z < GRID; z++) {
    const row: boolean[] = [];
    for (let x = 0; x < GRID; x++) {
      const dx = (x - HALF) / HALF;
      const dz = (z - HALF) / HALF;
      const angle = Math.atan2(dz, dx);
      let radius = 0.84 + 0.08 * Math.sin(angle * 3 + phases[0]);
      radius += 0.05 * Math.sin(angle * 5 + phases[1]);
      radius += 0.035 * Math.sin(angle * 7 + phases[2]);
      row.push(Math.hypot(dx, dz) <= radius);
    }
    mask.push(row);
  }
  return mask;
}

export function landAt(mask: boolean[][], x: number, z: number): boolean {
  if (x < 0 || z < 0 || x >= GRID || z >= GRID) return false;
  return mask[z][x];
}

/** True when the tile touches water (or the edge of the diorama). */
export function isShore(mask: boolean[][], x: number, z: number): boolean {
  return (
    !landAt(mask, x + 1, z) ||
    !landAt(mask, x - 1, z) ||
    !landAt(mask, x, z + 1) ||
    !landAt(mask, x, z - 1)
  );
}

export function worldX(x: number): number {
  return x - HALF;
}

export function worldZ(z: number): number {
  return z - HALF;
}

export function loadSaved(): SavedTown | null {
  try {
    const raw = localStorage.getItem(TOWN_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { seed?: unknown; blocks?: unknown; found?: unknown; clicks?: unknown };
    if (!data || typeof data.seed !== 'number' || !Array.isArray(data.blocks)) return null;
    const blocks: [number, number, BlockKind, number, number?][] = [];
    for (const entry of data.blocks as unknown[]) {
      if (!Array.isArray(entry) || entry.length < 3) continue;
      const [x, z, kind, level, rot] = entry as [unknown, unknown, unknown, unknown, unknown];
      if (typeof x !== 'number' || typeof z !== 'number' || typeof kind !== 'string') continue;
      blocks.push([
        x,
        z,
        kind as BlockKind,
        typeof level === 'number' ? level : 1,
        typeof rot === 'number' ? rot : 0,
      ]);
    }
    return {
      seed: data.seed,
      blocks,
      found: Array.isArray(data.found) ? (data.found as unknown[]).filter((f): f is string => typeof f === 'string') : [],
      clicks: typeof data.clicks === 'number' && data.clicks >= 0 ? data.clicks : 0,
    };
  } catch {
    return null;
  }
}

export function saveTown(town: Town, found: Set<string>, clicks = 0): void {
  const data: SavedTown = {
    seed: town.seed,
    blocks: [...town.blocks].map(([k, placed]) => {
      const [x, z] = k.split(',').map(Number);
      return [x, z, placed.kind, placed.level, placed.rot ?? 0] as [number, number, BlockKind, number, number];
    }),
    found: [...found],
    clicks,
  };
  try {
    localStorage.setItem(TOWN_KEY, JSON.stringify(data));
  } catch {
    /* Storage can be full or blocked: the town still lives in memory. */
  }
}

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
  return carveWater(mask, seed);
}

/**
 * The water cut inland sits a little above the sea, so a river is a stream you
 * step over instead of a canyon: the scene needs to tell one from the other.
 */
const inlandWater = new WeakMap<boolean[][], boolean[][]>();

/** True when this water is a river or a lake, not the sea around the island. */
export function isChannel(mask: boolean[][], x: number, z: number): boolean {
  if (x < 0 || z < 0 || x >= GRID || z >= GRID) return false;
  return inlandWater.get(mask)?.[z]?.[x] ?? false;
}

/**
 * Rivers and lakes, cut out of the drawn island: sometimes a river comes in from
 * the sea and ends in a tarn, sometimes only the tarn, sometimes nothing. If the
 * water takes too much land the plain island stays, so a town always fits.
 */
function carveWater(mask: boolean[][], seed: number): boolean[][] {
  const random = rng((seed ^ 0x2f7d92a3) >>> 0);
  const out = mask.map((row) => [...row]);
  const sea = mask.map((row) => row.map((land) => !land));
  const cut: boolean[][] = out.map((row) => row.map(() => false));
  const dry = (x: number, z: number): boolean => x >= 0 && z >= 0 && x < GRID && z < GRID && out[z][x];
  const landCount = (): number => out.reduce((n, row) => n + row.filter(Boolean).length, 0);
  const before = landCount();
  const dig = (x: number, z: number): void => {
    if (x < 0 || z < 0 || x >= GRID || z >= GRID) return;
    out[z][x] = false;
    cut[z][x] = true;
  };

  if (random() < 0.55) {
    // A river: it comes in from the sea at one edge, wanders inland and ends in
    // a tarn. The island border is water already, so it starts at the shore.
    const edge = Math.floor(random() * 4);
    const lane = Math.floor(random() * (GRID - 6)) + 3;
    let x = edge === 0 ? lane : edge === 1 ? lane : edge === 2 ? 0 : GRID - 1;
    let z = edge === 0 ? 0 : edge === 1 ? GRID - 1 : lane;
    const dx = edge === 2 ? 1 : edge === 3 ? -1 : 0;
    const dz = edge === 0 ? 1 : edge === 1 ? -1 : 0;
    for (let guard = 0; guard < 6 && !dry(x, z); guard++) {
      x += dx;
      z += dz;
    }
    if (!dry(x, z)) {
      // No shore on that line: fall through to a tarn instead.
    } else {
      // Cut through the beach, so the stream really opens into the sea.
      for (let bx = x - dx, bz = z - dz; bx >= 0 && bz >= 0 && bx < GRID && bz < GRID && dry(bx, bz); bx -= dx, bz -= dz) dig(bx, bz);
      const length = 4 + Math.floor(random() * 4);
      // A cell the stream may still take: inland, and still land.
      const ahead = (cx: number, cz: number): boolean =>
        cx >= 1 && cz >= 1 && cx <= GRID - 2 && cz <= GRID - 2 && dry(cx, cz);
      for (let step = 0; step < length; step++) {
        dig(x, z);
        // Wider at the mouth, so it reads as an estuary.
        if (step === 0) dig(x + (dz !== 0 ? 1 : 0), z + (dx !== 0 ? 1 : 0));
        if (!ahead(x + dx, z + dz)) break;
        x += dx;
        z += dz;
        // The step ahead is always cut, and the drift is cut from there: water
        // that only touched at a point would leave the stream broken in two.
        dig(x, z);
        if (random() < 0.6) {
          const side = random() < 0.5 ? 1 : -1;
          const sx = x + (dx !== 0 ? 0 : side);
          const sz = z + (dz !== 0 ? 0 : side);
          if (ahead(sx, sz)) {
            dig(sx, sz);
            x = sx;
            z = sz;
          }
        }
      }
      // The tarn at the end of it.
      for (let ox = 0; ox < 2; ox++) {
        for (let oz = 0; oz < 2; oz++) {
          if (random() < 0.8) dig(x + ox - 1, z + oz - 1);
        }
      }
    }
  } else if (random() < 0.6) {
    // A tarn in a hollow, two or three cells wide.
    const cx = Math.floor(random() * 6) + 5;
    const cz = Math.floor(random() * 6) + 5;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        if (Math.abs(ox) + Math.abs(oz) > 1 && random() < 0.7) continue;
        dig(cx + ox, cz + oz);
      }
    }
  }

  // Never drown the town, and never cut a corner of land adrift: the grown town
  // would put lanes and people on an islet nobody can reach.
  if (landCount() < Math.max(52, Math.round(before * 0.68)) || !whole(out)) return mask;

  // A cut cell that still touches the sea is the mouth: the water steps down
  // there, so it keeps the sea level and the scene draws the little fall.
  const channel = cut.map((row, z) =>
    row.map((dug, x) => {
      if (!dug) return false;
      for (const [nx, nz] of [
        [x + 1, z],
        [x - 1, z],
        [x, z + 1],
        [x, z - 1],
      ]) {
        if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
        if (sea[nz][nx]) return false;
      }
      return true;
    }),
  );
  inlandWater.set(out, channel);
  return out;
}

/** True when every land tile can be walked to from every other one. */
function whole(mask: boolean[][]): boolean {
  let start: [number, number] | null = null;
  let land = 0;
  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      if (!mask[z][x]) continue;
      land++;
      start ??= [x, z];
    }
  }
  if (!start) return false;
  const seen = new Set<string>();
  const stack: Array<[number, number]> = [start];
  while (stack.length) {
    const [x, z] = stack.pop() as [number, number];
    const k = key(x, z);
    if (seen.has(k) || !landAt(mask, x, z)) continue;
    seen.add(k);
    stack.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  return seen.size === land;
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

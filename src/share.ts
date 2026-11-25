/** The town as a link, and nothing else: the seed and the blocks with their height. */

import { BlockKind, GRID, MAX_LEVEL, Placed, Town, key, makeIsland, landAt } from './grid';

// Los tipos nuevos van al final: los enlaces antiguos siguen apuntando bien.
const KINDS: BlockKind[] = ['house', 'tower', 'path', 'tree', 'plaza', 'dock', 'mill', 'field', 'garden', 'wall'];
const HASH = '#p=';

/** Four characters per block: x, z, kind and level. */
function encodeBlock(x: number, z: number, placed: Placed): string {
  return x.toString(16) + z.toString(16) + KINDS.indexOf(placed.kind).toString(36) + placed.level.toString(36);
}

export function encodeTown(town: Town): string {
  const body = [...town.blocks].map(([k, placed]) => {
    const [x, z] = k.split(',').map(Number);
    return encodeBlock(x, z, placed);
  }).join('');
  return `${town.seed.toString(36)}.${body}`;
}

export function decodeTown(payload: string): Town | null {
  const dot = payload.indexOf('.');
  if (dot <= 0) return null;
  const seed = Number.parseInt(payload.slice(0, dot), 36);
  if (!Number.isFinite(seed)) return null;
  const mask = makeIsland(seed);
  const body = payload.slice(dot + 1);
  const blocks = new Map<string, Placed>();
  for (let i = 0; i + 3 < body.length; i += 4) {
    const x = Number.parseInt(body[i], 16);
    const z = Number.parseInt(body[i + 1], 16);
    const kind = KINDS[Number.parseInt(body[i + 2], 36)];
    const level = Number.parseInt(body[i + 3], 36) || 1;
    if (!Number.isInteger(x) || !Number.isInteger(z) || !kind) continue;
    if (x < 0 || z < 0 || x >= GRID || z >= GRID) continue;
    // A block may sit on water (a bridge) but never outside the diorama.
    if (!landAt(mask, x, z) && kind !== 'path' && kind !== 'dock') continue;
    blocks.set(key(x, z), { kind, level: Math.min(Math.max(level, 1), MAX_LEVEL) });
  }
  return { seed, blocks };
}

export function shareUrl(payload: string): string {
  return `${location.origin}${location.pathname}${HASH}${payload}`;
}

/** Reads a town out of the address bar, if there is one. */
export function townFromHash(): Town | null {
  if (!location.hash.startsWith(HASH)) return null;
  return decodeTown(location.hash.slice(HASH.length));
}

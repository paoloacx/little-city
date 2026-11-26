/** The town as a link, and nothing else: the seed and the blocks with their height. */

import { BlockKind, GRID, MAX_GROUND, MAX_LEVEL, Placed, Town, islandFor, landAt, key, setGridSize } from './grid';

// Los tipos nuevos van al final: los enlaces antiguos siguen apuntando bien.
const KINDS: BlockKind[] = ['house', 'tower', 'path', 'tree', 'plaza', 'dock', 'mill', 'field', 'garden', 'wall'];
const HASH = '#p=';
/**
 * The hills the player made go after the blocks, behind this mark: an old link
 * has no mark and still reads, and a new one carries ground without asking.
 */
const GROUND_MARK = '~';
/**
 * Links made before buildings could turn carry four characters per block;
 * the versioned ones carry five, the last being the quarter turns.
 */
const VERSION = '3-';
/**
 * Links made once the board can grow carry the size of that board and give each
 * coordinate a single base-36 digit, so a nineteen-cell board still fits: cells
 * are shifted to start at zero before the town is read.
 */
const VERSION4 = '4-';

export function encodeTown(town: Town): string {
  const body = [...town.blocks]
    .map(([k, placed]) => {
      const [x, z] = k.split(',').map(Number);
      return (
        x.toString(36) +
        z.toString(36) +
        KINDS.indexOf(placed.kind).toString(36) +
        placed.level.toString(36) +
        ((placed.rot ?? 0) % 4).toString(36)
      );
    })
    .join('');
  const hills = town.ground
    ? [...town.ground]
        .map(([k, level]) => {
          const [x, z] = k.split(',').map(Number);
          return x.toString(36) + z.toString(36) + Math.min(level, MAX_GROUND).toString(36);
        })
        .join('')
    : '';
  const size = GRID.toString(36);
  return `${VERSION4}${size}${town.seed.toString(36)}.${body}${hills ? GROUND_MARK + hills : ''}`;
}

export function decodeTown(payload: string): Town | null {
  const modern = payload.startsWith(VERSION4);
  const versioned = payload.startsWith(VERSION);
  let body: string;
  let stride: number;
  if (modern) {
    // The size goes first, so the board is the right one before any cell is read.
    const size = Number.parseInt(payload[VERSION4.length], 36);
    if (!Number.isFinite(size) || size < 15) return null;
    setGridSize(size);
    body = payload.slice(VERSION4.length + 1);
    stride = 5;
  } else {
    setGridSize(15);
    body = versioned ? payload.slice(VERSION.length) : payload;
    stride = versioned ? 5 : 4;
  }
  const digit = modern ? 36 : 16;
  const dot = body.indexOf('.');
  if (dot <= 0) return null;
  const seed = Number.parseInt(body.slice(0, dot), 36);
  if (!Number.isFinite(seed)) return null;
  const mask = islandFor(seed, GRID);
  const payloadBody = body.slice(dot + 1);
  const mark = payloadBody.indexOf(GROUND_MARK);
  const text = mark < 0 ? payloadBody : payloadBody.slice(0, mark);
  const hills = mark < 0 ? '' : payloadBody.slice(mark + 1);
  const blocks = new Map<string, Placed>();
  for (let i = 0; i + stride - 1 < text.length; i += stride) {
    const x = Number.parseInt(text[i], digit);
    const z = Number.parseInt(text[i + 1], digit);
    const kind = KINDS[Number.parseInt(text[i + 2], 36)];
    const level = Number.parseInt(text[i + 3], 36) || 1;
    const rot = versioned || modern ? Number.parseInt(text[i + 4], 36) || 0 : 0;
    if (!Number.isInteger(x) || !Number.isInteger(z) || !kind) continue;
    if (x < 0 || z < 0 || x >= GRID || z >= GRID) continue;
    // A block may sit on water (a bridge) but never outside the diorama.
    if (!landAt(mask, x, z) && kind !== 'path' && kind !== 'dock') continue;
    blocks.set(key(x, z), { kind, level: Math.min(Math.max(level, 1), MAX_LEVEL), rot: ((rot % 4) + 4) % 4 });
  }
  const ground = new Map<string, number>();
  for (let i = 0; i + 2 < hills.length; i += 3) {
    const x = Number.parseInt(hills[i], digit);
    const z = Number.parseInt(hills[i + 1], digit);
    const level = Number.parseInt(hills[i + 2], 36);
    if (!Number.isInteger(x) || !Number.isInteger(z) || !Number.isInteger(level)) continue;
    if (x < 0 || z < 0 || x >= GRID || z >= GRID) continue;
    if (level <= 0) continue;
    ground.set(key(x, z), Math.min(level, MAX_GROUND));
  }
  return ground.size > 0 ? { seed, blocks, ground } : { seed, blocks };
}

export function shareUrl(payload: string): string {
  // The query carries the season and, if any, the real place: keep it.
  return `${location.origin}${location.pathname}${location.search}${HASH}${payload}`;
}

/** Reads a town out of the address bar, if there is one. */
export function townFromHash(): Town | null {
  if (!location.hash.startsWith(HASH)) return null;
  return decodeTown(location.hash.slice(HASH.length));
}

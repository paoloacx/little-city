/** The town as a link, and nothing else: the seed and the blocks with their height. */

import { BlockKind, GRID, MAX_GROUND, MAX_LEVEL, Placed, Town, key, makeIsland, landAt } from './grid';

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

function encodeBlock(x: number, z: number, placed: Placed): string {
  return (
    x.toString(16) +
    z.toString(16) +
    KINDS.indexOf(placed.kind).toString(36) +
    placed.level.toString(36) +
    ((placed.rot ?? 0) % 4).toString(36)
  );
}

export function encodeTown(town: Town): string {
  const body = [...town.blocks].map(([k, placed]) => {
    const [x, z] = k.split(',').map(Number);
    return encodeBlock(x, z, placed);
  }).join('');
  const hills = town.ground
    ? [...town.ground]
        .map(([k, level]) => {
          const [x, z] = k.split(',').map(Number);
          return x.toString(16) + z.toString(16) + Math.min(level, MAX_GROUND).toString(36);
        })
        .join('')
    : '';
  return `${VERSION}${town.seed.toString(36)}.${body}${hills ? GROUND_MARK + hills : ''}`;
}

export function decodeTown(payload: string): Town | null {
  const versioned = payload.startsWith(VERSION);
  const body = versioned ? payload.slice(VERSION.length) : payload;
  const stride = versioned ? 5 : 4;
  const dot = body.indexOf('.');
  if (dot <= 0) return null;
  const seed = Number.parseInt(body.slice(0, dot), 36);
  if (!Number.isFinite(seed)) return null;
  const mask = makeIsland(seed);
  const payloadBody = body.slice(dot + 1);
  const mark = payloadBody.indexOf(GROUND_MARK);
  const text = mark < 0 ? payloadBody : payloadBody.slice(0, mark);
  const hills = mark < 0 ? '' : payloadBody.slice(mark + 1);
  const blocks = new Map<string, Placed>();
  for (let i = 0; i + stride - 1 < text.length; i += stride) {
    const x = Number.parseInt(text[i], 16);
    const z = Number.parseInt(text[i + 1], 16);
    const kind = KINDS[Number.parseInt(text[i + 2], 36)];
    const level = Number.parseInt(text[i + 3], 36) || 1;
    const rot = versioned ? Number.parseInt(text[i + 4], 36) || 0 : 0;
    if (!Number.isInteger(x) || !Number.isInteger(z) || !kind) continue;
    if (x < 0 || z < 0 || x >= GRID || z >= GRID) continue;
    // A block may sit on water (a bridge) but never outside the diorama.
    if (!landAt(mask, x, z) && kind !== 'path' && kind !== 'dock') continue;
    blocks.set(key(x, z), { kind, level: Math.min(Math.max(level, 1), MAX_LEVEL), rot: ((rot % 4) + 4) % 4 });
  }
  const ground = new Map<string, number>();
  for (let i = 0; i + 2 < hills.length; i += 3) {
    const x = Number.parseInt(hills[i], 16);
    const z = Number.parseInt(hills[i + 1], 16);
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

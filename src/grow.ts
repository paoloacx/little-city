/** "Grow a town": fills a fresh island with a little settlement, rule by rule. */

import { BlockKind, GRID, HALF, Placed, Town, isShore, key, landAt, makeIsland, rng } from './grid';

export function growTown(seed: number): Town {
  const random = rng(seed);
  const mask = makeIsland(seed);
  const blocks = new Map<string, Placed>();

  const free = (x: number, z: number): boolean =>
    x >= 0 && z >= 0 && x < GRID && z < GRID && landAt(mask, x, z) && !blocks.has(key(x, z));

  const put = (x: number, z: number, kind: BlockKind, level = 1): boolean => {
    if (!free(x, z)) return false;
    blocks.set(key(x, z), { kind, level });
    return true;
  };

  const kindAt = (x: number, z: number): BlockKind | null => blocks.get(key(x, z))?.kind ?? null;

  /** A dock can stand on water, as long as it touches the shore. */
  const putDock = (x: number, z: number): boolean => {
    if (x < 0 || z < 0 || x >= GRID || z >= GRID || blocks.has(key(x, z))) return false;
    if (landAt(mask, x, z)) return false;
    // Only next to the shore: a pier has to start somewhere.
    const touchesLand =
      landAt(mask, x + 1, z) || landAt(mask, x - 1, z) || landAt(mask, x, z + 1) || landAt(mask, x, z - 1);
    if (!touchesLand) return false;
    blocks.set(key(x, z), { kind: 'dock', level: 1 });
    return true;
  };
  const has = (x: number, z: number, kind: BlockKind): boolean => kindAt(x, z) === kind;

  const neighbours = (x: number, z: number, kind: BlockKind): number => {
    let n = 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        if (has(x + dx, z + dz, kind)) n++;
      }
    }
    return n;
  };

  const sideNeighbours = (x: number, z: number, kind: BlockKind): number => {
    let n = 0;
    if (has(x + 1, z, kind)) n++;
    if (has(x - 1, z, kind)) n++;
    if (has(x, z + 1, kind)) n++;
    if (has(x, z - 1, kind)) n++;
    return n;
  };

  const land: Array<[number, number]> = [];
  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) if (mask[z][x]) land.push([x, z]);
  }
  const pick = <T>(items: T[]): T | null => (items.length ? items[Math.floor(random() * items.length)] : null);

  const arms: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];

  // 1. The square: a 3×3 plaza, so its middle becomes a fountain.
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) put(HALF + dx, HALF + dz, 'plaza');
  }

  // 2. Two roads out of the square, walking until the shore.
  for (const [dx, dz] of arms) {
    if (random() < 0.45) continue;
    let x = HALF + dx * 2;
    let z = HALF + dz * 2;
    let steps = 0;
    while (landAt(mask, x, z) && steps < 12) {
      put(x, z, 'path');
      x += dx;
      z += dz;
      steps++;
    }
  }

  // 3. A cross street past the square.
  for (let i = -2; i <= 2; i++) put(HALF + i, HALF + 2, 'path');

  // 3b. A little alley cross away from the square: its corners make shops.
  const alley = pick(
    land.filter(
      ([x, z]) =>
        Math.abs(x - HALF) >= 3 &&
        Math.abs(z - HALF) >= 3 &&
        ([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as Array<[number, number]>).every(([dx, dz]) => free(x + dx, z + dz)),
    ),
  );
  if (alley) {
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as Array<[number, number]>) {
      put(alley[0] + dx, alley[1] + dz, 'path');
    }
  }

  // 3c. A clock tower on a corner, with a house at its feet.
  const corner = pick(
    land.filter(
      ([x, z]) =>
        free(x, z) &&
        sideNeighbours(x, z, 'path') === 2 &&
        neighbours(x, z, 'plaza') === 0 &&
        neighbours(x, z, 'tower') === 0,
    ),
  );
  if (corner) {
    put(corner[0], corner[1], 'tower', 1);
    for (const [dx, dz] of [...arms, [1, 1] as [number, number], [-1, 1] as [number, number]]) {
      if (put(corner[0] + dx, corner[1] + dz, 'house')) break;
    }
  }

  // 3d. Houses on the corners, where the streets meet. Some grow a floor.
  for (const [x, z] of land) {
    if (!free(x, z)) continue;
    if (sideNeighbours(x, z, 'path') >= 2 && random() < 0.85) {
      put(x, z, 'house', random() < 0.35 ? 2 : 1);
    }
  }

  // 4. Houses along the roads.
  for (const [x, z] of land) {
    if (!free(x, z)) continue;
    if (neighbours(x, z, 'path') >= 1 && neighbours(x, z, 'path') <= 2 && random() < 0.72) {
      put(x, z, 'house', random() < 0.2 ? 2 : 1);
    }
  }

  // 5. A chapel: a tower beside a house.
  const houseTiles = [...blocks]
    .filter(([, placed]) => placed.kind === 'house')
    .map(([k]) => k.split(',').map(Number) as [number, number]);
  let chapels = 0;
  for (const [x, z] of houseTiles) {
    if (chapels >= 2 || random() > 0.5) continue;
    for (const [dx, dz] of arms) {
      if (put(x + dx, z + dz, 'tower')) {
        chapels++;
        break;
      }
    }
  }

  // 6. A castle: three towers in an L, somewhere with room.
  const castleCandidates = land.filter(([x, z]) => {
    let room = 0;
    for (const [dx, dz] of [...arms, [1, 1] as [number, number]]) {
      if (free(x + dx, z + dz)) room++;
    }
    return room >= 4 && free(x, z);
  });
  const castle = pick(castleCandidates);
  if (castle) {
    put(castle[0], castle[1], 'tower', 2);
    put(castle[0] + 1, castle[1], 'tower', 1);
    put(castle[0], castle[1] + 1, 'tower', 1);
  }

  // 7. Farm: a mill among fields, with a barn house beside them.
  const farm = pick(land.filter(([x, z]) => free(x, z) && !neighbours(x, z, 'path')));
  if (farm) {
    const [fx, fz] = farm;
    put(fx, fz, 'mill');
    let planted = 0;
    for (let dz = -2; dz <= 2 && planted < 5; dz++) {
      for (let dx = -2; dx <= 2 && planted < 5; dx++) {
        if (Math.abs(dx) < 1 && Math.abs(dz) < 1) continue;
        if (put(fx + dx, fz + dz, 'field')) planted++;
      }
    }
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (neighbours(fx + dx, fz + dz, 'field') >= 1 && random() < 0.6) {
          put(fx + dx, fz + dz, 'house');
          break;
        }
      }
    }
  }

  // 8. An orchard: four trees together.
  let orchards = 0;
  for (let attempt = 0; attempt < 40 && orchards < 2; attempt++) {
    const spot = pick(land);
    if (!spot) break;
    const [ox, oz] = spot;
    const corners: Array<[number, number]> = [
      [ox, oz],
      [ox + 1, oz],
      [ox, oz + 1],
      [ox + 1, oz + 1],
    ];
    if (!corners.every(([x, z]) => free(x, z))) continue;
    for (const [x, z] of corners) put(x, z, 'tree');
    orchards++;
  }

  // 9. A lighthouse on the shore, with a neighbour or two.
  const shore = land.filter(([x, z]) => isShore(mask, x, z) && free(x, z));
  const light = pick(shore);
  if (light) {
    put(light[0], light[1], 'tower', 2);
    let placed = 0;
    for (const [dx, dz] of [...arms, [1, 1] as [number, number], [-1, -1] as [number, number]]) {
      if (placed >= 2) break;
      if (put(light[0] + dx, light[1] + dz, 'house')) placed++;
    }
  }

  // 10. Piers standing in the water, and some trees for the rest of the island.
  const waterEdges: Array<[number, number]> = [];
  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      if (
        !landAt(mask, x, z) &&
        (landAt(mask, x + 1, z) || landAt(mask, x - 1, z) || landAt(mask, x, z + 1) || landAt(mask, x, z - 1))
      ) {
        waterEdges.push([x, z]);
      }
    }
  }
  for (const [x, z] of waterEdges) {
    if (random() < 0.16) putDock(x, z);
  }
  for (const [x, z] of land) {
    if (!free(x, z)) continue;
    if (neighbours(x, z, 'path') > 0 || neighbours(x, z, 'plaza') > 0) continue;
    if (random() < 0.3) put(x, z, 'tree');
  }

  // 11. A tower on the square (observatory), and trees for a bandstand.
  const ring: Array<[number, number]> = [];
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== 2) continue;
      ring.push([HALF + dx, HALF + dz]);
    }
  }
  const watch = pick(ring.filter(([x, z]) => free(x, z)));
  if (watch) put(watch[0], watch[1], 'tower', 3);
  for (let i = 0; i < 3; i++) {
    const spot = pick(ring.filter(([x, z]) => free(x, z)));
    if (spot) put(spot[0], spot[1], 'tree');
  }

  // 12. A watermill where the shore allows it, and a house that keeps a boat.
  const millShore = pick(land.filter(([x, z]) => isShore(mask, x, z) && free(x, z) && neighbours(x, z, 'plaza') === 0));
  if (millShore) {
    put(millShore[0], millShore[1], 'mill');
    let pier = 0;
    for (const [dx, dz] of arms) {
      if (pier >= 2) break;
      if (putDock(millShore[0] + dx, millShore[1] + dz)) pier++;
    }
  }
  for (const [x, z] of land) {
    if (free(x, z) && neighbours(x, z, 'dock') >= 1 && random() < 0.7) {
      put(x, z, 'house');
      if (random() < 0.5) break;
    }
  }

  // 13. A taller house or two, and one that reaches the top.
  for (const [x, z] of land) {
    if (random() > 0.28) continue;
    const placed = blocks.get(key(x, z));
    if (!placed || placed.kind !== 'house') continue;
    placed.level = 2 + Math.floor(random() * 3);
  }
  const tallest = pick(land.filter(([x, z]) => blocks.get(key(x, z))?.kind === 'house'));
  if (tallest) {
    const placed = blocks.get(key(tallest[0], tallest[1]));
    if (placed) placed.level = 5;
  }
  const spires = land.filter(([x, z]) => blocks.get(key(x, z))?.kind === 'tower');
  for (const [x, z] of spires) {
    const placed = blocks.get(key(x, z));
    if (placed && random() < 0.5) placed.level = Math.max(placed.level, 3 + Math.floor(random() * 3));
  }
  // A big tree on the green, and a great oak in the corner.
  for (const [x, z] of land) {
    const placed = blocks.get(key(x, z));
    if (!placed || placed.kind !== 'tree') continue;
    if (random() < 0.25) placed.level = 2;
  }
  const oak = pick(land.filter(([x, z]) => blocks.get(key(x, z))?.kind === 'tree'));
  if (oak) {
    const placed = blocks.get(key(oak[0], oak[1]));
    if (placed) placed.level = 3;
  }

  // 14. A garden by the square, a park, and a stretch of wall on the edge.
  const garden = pick(land.filter(([x, z]) => free(x, z) && sideNeighbours(x, z, 'plaza') >= 1));
  if (garden) {
    const placed = blocks.get(key(garden[0], garden[1]));
    void placed;
    blocks.set(key(garden[0], garden[1]), { kind: 'garden', level: 2 + Math.floor(random() * 2) });
  }
  const park = pick(land.filter(([x, z]) => free(x, z) && sideNeighbours(x, z, 'path') >= 1));
  if (park) {
    blocks.set(key(park[0], park[1]), { kind: 'garden', level: 3 + Math.floor(random() * 3) });
  }
  for (let i = 0; i < 4; i++) {
    const spot = pick(land.filter(([x, z]) => free(x, z) && neighbours(x, z, 'tree') >= 1));
    if (!spot) continue;
    blocks.set(key(spot[0], spot[1]), { kind: 'wall', level: 1 + Math.floor(random() * 2) });
  }
  const keepSpot = pick(land.filter(([x, z]) => free(x, z) && neighbours(x, z, 'path') >= 2));
  if (keepSpot) {
    blocks.set(key(keepSpot[0], keepSpot[1]), { kind: 'wall', level: 4 });
  }

  // 15. A vineyard by the garden, a gatehouse by a tower, a stable by two fields.
  const vineSpot = pick(land.filter(([x, z]) => free(x, z) && neighbours(x, z, 'garden') >= 1));
  if (vineSpot) {
    blocks.set(key(vineSpot[0], vineSpot[1]), { kind: 'field', level: 1 });
  }
  const gateSpot = land.find(([x, z]) => {
    const placed = blocks.get(key(x, z));
    return placed?.kind === 'wall' && neighbours(x, z, 'tower') >= 1;
  });
  if (gateSpot) {
    const placed = blocks.get(key(gateSpot[0], gateSpot[1]));
    if (placed) placed.level = Math.max(placed.level, 2);
  }
  const stableSpot = pick(land.filter(([x, z]) => free(x, z) && neighbours(x, z, 'field') >= 2));
  if (stableSpot) {
    blocks.set(key(stableSpot[0], stableSpot[1]), { kind: 'house', level: 1 });
  }

  return { seed, blocks };
}

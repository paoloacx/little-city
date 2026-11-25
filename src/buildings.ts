/**
 * What every role looks like. All of it is boxes, cones, cylinders and tori
 * merged in one geometry with vertex colours: no textures, no model files.
 * Levels add floors, and windows register lights for the evening.
 */

import { GeoBuilder, blob, cone, cube, dome, panel, plate, post, pyramid, quad, ring } from './geo';
import { Role } from './rules';

const C = {
  ink: 0x3a2f2a,
  wall: 0xf6edda,
  wallWarm: 0xf3e7d3,
  wallCool: 0xeeeae2,
  stone: 0xdcd3c2,
  stoneDark: 0xc3b7a3,
  stoneLight: 0xe9e2d4,
  roof: 0xc4633f,
  roofDeep: 0xa9503a,
  slate: 0x8b90a3,
  slateDeep: 0x767b8d,
  thatch: 0xd9b877,
  thatchDeep: 0xc19f60,
  copper: 0x6f9d8c,
  wood: 0x9c7a58,
  woodDark: 0x7a5a44,
  iron: 0x6b6560,
  door: 0x7d5a3c,
  glass: 0x6f8285,
  leaf: 0x8db46a,
  leafDeep: 0x6f9a52,
  leafLight: 0xa8c47d,
  trunk: 0x8a6a4f,
  path: 0xd9c8a8,
  soil: 0xb59068,
  cloth: 0xece4d3,
  clothWarm: 0xd98d6a,
  lamp: 0xf6d98a,
  water: 0xbcd6d6,
};

const PY = 1.41421356; // half-side → pyramid scale
const FLOOR = 0.3;

/**
 * A pyramid roof over a spot, with its eave board: the thin dark rim that makes
 * a roof read as built rather than as a cone stuck on a box.
 */
function roofAt(gb: GeoBuilder, x: number, z: number, halfW: number, halfD: number, h: number, color: number, y: number) {
  gb.add(cube(), C.woodDark, [x, y + 0.008, z], [0, 0, 0], [halfW * 2.08, 0.022, halfD * 2.08]);
  gb.add(pyramid(), color, [x, y + 0.016, z], [0, 0, 0], [halfW * PY, h, halfD * PY]);
}

/** The same roof, over the middle of the tile. */
function roof(gb: GeoBuilder, halfW: number, halfD: number, h: number, color: number, y: number) {
  roofAt(gb, 0, 0, halfW, halfD, h, color, y);
}

/**
 * A window that reads as a window: stone surround proud of the wall, dark glass
 * behind it, muntins crossing the panes and a sill underneath.
 */
function windowBox(gb: GeoBuilder, x: number, y: number, z: number, w = 0.1, h = 0.12, lit = true) {
  const frame = 0.016;
  gb.add(cube(), C.glass, [x, y, z], [0, 0, 0], [w, h, 0.018]);
  // Surround: four bars, so the glass stays visible.
  gb.add(cube(), C.stoneLight, [x, y + h / 2 + frame / 2, z + 0.006], [0, 0, 0], [w + frame * 2, frame, 0.03]);
  gb.add(cube(), C.stoneLight, [x, y - h / 2 - frame / 2, z + 0.006], [0, 0, 0], [w + frame * 2, frame, 0.03]);
  for (const side of [-1, 1]) {
    gb.add(cube(), C.stoneLight, [x + side * (w / 2 + frame / 2), y, z + 0.006], [0, 0, 0], [frame, h, 0.03]);
  }
  // Muntins: a cross, thinner than the frame.
  gb.add(cube(), C.stoneLight, [x, y, z + 0.014], [0, 0, 0], [0.006, h, 0.008]);
  gb.add(cube(), C.stoneLight, [x, y, z + 0.014], [0, 0, 0], [w, 0.006, 0.008]);
  // Sill, a touch wider than the surround.
  gb.add(cube(), C.stone, [x, y - h / 2 - frame - 0.006, z + 0.012], [0, 0, 0], [w + frame * 3.2, 0.016, 0.05]);
  if (lit) gb.light(x, y, z + 0.05, 0.8);
}

/**
 * A door with its jambs, a lintel, two panels and a handle, plus the stone step.
 * `z` is the face of the wall.
 */
function doorBox(gb: GeoBuilder, x: number, y: number, z: number, w = 0.13, h = 0.26) {
  const jamb = 0.018;
  gb.add(cube(), C.stoneLight, [x, y + h / 2 + jamb / 2, z + 0.004], [0, 0, 0], [w + jamb * 2.4, jamb, 0.026]);
  for (const side of [-1, 1]) {
    gb.add(cube(), C.stoneLight, [x + side * (w / 2 + jamb / 2), y, z + 0.004], [0, 0, 0], [jamb, h, 0.026]);
  }
  gb.add(cube(), C.door, [x, y, z + 0.012], [0, 0, 0], [w, h, 0.024]);
  // Two panels and the seam of the door.
  for (const side of [-1, 1]) {
    gb.add(cube(), C.woodDark, [x + side * w * 0.22, y + h * 0.12, z + 0.026], [0, 0, 0], [w * 0.32, h * 0.4, 0.006]);
    gb.add(cube(), C.woodDark, [x + side * w * 0.22, y - h * 0.24, z + 0.026], [0, 0, 0], [w * 0.32, h * 0.26, 0.006]);
  }
  gb.add(cube(), C.ink, [x, y, z + 0.026], [0, 0, 0], [0.004, h, 0.006]);
  gb.add(cube(), C.iron, [x + w * 0.32, y - 0.005, z + 0.03], [0, 0, 0], [0.012, 0.012, 0.01]);
  gb.add(cube(), C.stone, [x, y - h / 2 - 0.02, z + 0.04], [0, 0, 0], [w + 0.07, 0.03, 0.07]);
}


/** A slim iron finial, with a little cloth pennant if it is a flagpole. */
function finial(gb: GeoBuilder, x: number, y: number, z: number, h = 0.14, cloth?: number) {
  gb.add(post(), C.iron, [x, y + h / 2, z], [0, 0, 0], [0.013, h, 0.013]);
  gb.add(blob(), C.iron, [x, y + h + 0.004, z], [0, 0, 0], [0.03, 0.03, 0.03]);
  if (cloth === undefined) return;
  gb.add(cube(), C.iron, [x + 0.012, y + h - 0.006, z], [0, 0, 0], [0.028, 0.006, 0.006]);
  gb.add(cube(), cloth, [x + 0.032, y + h - 0.042, z], [0, 0, 0], [0.036, 0.075, 0.005]);
  gb.add(cube(), cloth, [x + 0.05, y + h - 0.012, z], [0, 0, 0], [0.012, 0.012, 0.005]);
}

/** The small iron cross on a chapel roof: fine lines, not a black plank. */
function chapelCross(gb: GeoBuilder, x: number, y: number, z: number) {
  gb.add(post(), C.iron, [x, y + 0.05, z], [0, 0, 0], [0.012, 0.11, 0.012]);
  gb.add(cube(), C.iron, [x, y + 0.075, z], [0, 0, 0], [0.055, 0.01, 0.01]);
  gb.add(blob(), C.iron, [x, y + 0.006, z], [0, 0, 0], [0.024, 0.024, 0.024]);
}

function lamp(gb: GeoBuilder, x: number, z: number) {
  gb.add(post(), C.woodDark, [x, 0.19, z], [0, 0, 0], [0.04, 0.38, 0.04]);
  gb.add(cube(), C.ink, [x, 0.41, z], [0, 0, 0], [0.1, 0.03, 0.1]);
  gb.add(cube(), C.lamp, [x, 0.45, z], [0, 0, 0], [0.075, 0.09, 0.075]);
  gb.add(cube(), C.ink, [x, 0.505, z], [0, 0, 0], [0.095, 0.02, 0.095]);
  gb.light(x, 0.46, z, 1.1);
}

function bench(gb: GeoBuilder, x: number, z: number, rotY: number) {
  gb.add(cube(), C.wood, [x, 0.11, z], [0, rotY, 0], [0.3, 0.03, 0.09]);
  gb.add(cube(), C.woodDark, [x, 0.06, z], [0, rotY, 0], [0.26, 0.05, 0.05]);
}

function tree(gb: GeoBuilder, x: number, z: number, s: number, rnd: () => number) {
  const h = 0.22 * s;
  gb.add(post(), C.trunk, [x, h / 2, z], [0, 0, 0], [0.07 * s, h, 0.07 * s]);
  const blobs = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < blobs; i++) {
    const r = (0.19 + rnd() * 0.07) * s;
    const ox = (rnd() - 0.5) * 0.12 * s;
    const oz = (rnd() - 0.5) * 0.12 * s;
    const oy = h + r * (0.75 + rnd() * 0.4);
    const leaf = [C.leaf, C.leafDeep, C.leafLight][Math.floor(rnd() * 3)];
    gb.add(blob(), leaf, [x + ox, oy, z + oz], [rnd() * 3, rnd() * 3, 0], [r * 2, r * 2.1, r * 2]);
  }
}

/**
 * A tree that really grows with its level: trunk, roots, branches and crown all
 * scale up, so the fifth click is a tree twice as tall as the first.
 */
function grownTree(gb: GeoBuilder, x: number, z: number, level: number, rnd: () => number) {
  const lv = Math.min(Math.max(level, 1), 5);
  const trunkH = 0.24 + (lv - 1) * 0.13;
  const trunkR = 0.05 + (lv - 1) * 0.016;
  const crown = 0.13 + (lv - 1) * 0.062;
  if (lv >= 3) {
    gb.add(plate(), C.trunk, [x, 0.014, z], [0, 0, 0], [0.18 + crown, 0.028, 0.18 + crown]);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + 0.35;
      gb.add(
        cube(),
        C.trunk,
        [x + Math.cos(angle) * (0.06 + crown * 0.16), 0.012, z + Math.sin(angle) * (0.06 + crown * 0.16)],
        [0, -angle, 0],
        [0.12 + crown * 0.4, 0.026, 0.045],
      );
    }
  }
  gb.add(post(), C.trunk, [x, trunkH / 2, z], [0, 0, 0], [trunkR * 2, trunkH, trunkR * 2]);
  for (let i = 1; i < lv; i++) {
    gb.add(post(), C.woodDark, [x, (trunkH * i) / lv, z], [0, 0, 0], [trunkR * 2.2, 0.012, trunkR * 2.2]);
  }
  const branches = lv - 1;
  for (let i = 0; i < branches; i++) {
    const angle = (i * Math.PI * 2) / Math.max(branches, 1) + 0.6;
    const len = 0.1 + (lv - 1) * 0.04;
    gb.add(
      post(),
      C.trunk,
      [x + Math.cos(angle) * len * 0.42, trunkH * 0.84, z + Math.sin(angle) * len * 0.42],
      [0.6 * Math.cos(angle), 0, -0.6 * Math.sin(angle)],
      [0.03, len, 0.03],
    );
  }
  const blobs = 2 + lv;
  for (let i = 0; i < blobs; i++) {
    const angle = (i * Math.PI * 2) / blobs + rnd() * 0.5;
    const spread = crown * (i === 0 ? 0.12 : 0.6 + rnd() * 0.5);
    const r = crown * (i === 0 ? 1.02 : 0.55 + rnd() * 0.35);
    const y = trunkH + crown * (i === 0 ? 0.86 : 0.3 + rnd() * 0.9);
    const leaf = [C.leaf, C.leafDeep, C.leafLight][Math.floor(rnd() * 3)];
    gb.add(
      blob(),
      leaf,
      [x + Math.cos(angle) * spread, y, z + Math.sin(angle) * spread],
      [rnd() * 3, rnd() * 3, 0],
      [r * 2, r * 2.05, r * 2],
    );
  }
  if (lv >= 4) {
    for (let i = 0; i < lv; i++) {
      gb.add(
        cube(),
        C.thatchDeep,
        [x + (rnd() - 0.5) * crown * 1.5, trunkH + crown * (0.5 + rnd() * 0.9), z + (rnd() - 0.5) * crown * 1.5],
        [0, 0, 0],
        [0.022, 0.022, 0.022],
      );
    }
  }
}

function chimney(gb: GeoBuilder, x: number, y: number, z: number) {
  gb.add(cube(), C.stoneDark, [x, y + 0.1, z], [0, 0, 0], [0.06, 0.2, 0.06]);
  gb.add(cube(), C.stone, [x, y + 0.2, z], [0, 0, 0], [0.085, 0.03, 0.085]);
}

interface HouseOptions {
  wall?: number;
  roof?: number;
  door?: boolean;
  windows?: boolean;
  chimney?: boolean;
  jetty?: boolean;
  /** Dark beams on the corners: the half-timbered look. */
  timber?: boolean;
}

/** The wall washes a house can get, so a street never looks like one building. */
const WALL_TINTS = [C.wall, C.wallWarm, C.wallCool, 0xf1e6cf, 0xf3ddd2, 0xe7ece1, 0xf4e4c8];

/**
 * A body of `floors` storeys with a roof on top. The upper floors lean out a
 * little, the way old town houses do, and every floor gets its own row of
 * windows so height reads at a glance.
 */
function houseBlock(
  gb: GeoBuilder,
  width: number,
  depth: number,
  floors: number,
  rnd: () => number,
  options: HouseOptions = {},
): number {
  const wall = options.wall ?? WALL_TINTS[Math.floor(rnd() * WALL_TINTS.length)];
  const roofColor = options.roof ?? C.roof;
  for (let i = 0; i < floors; i++) {
    const lean = options.jetty && i > 0 ? 1.05 + i * 0.03 : 1;
    const tone = i === 0 ? wall : rnd() < 0.5 ? wall : C.wallWarm;
    gb.add(cube(), tone, [0, i * FLOOR + FLOOR / 2, 0], [0, 0, 0], [width * lean, FLOOR, depth * lean]);
    gb.add(cube(), C.stoneLight, [0, i * FLOOR + 0.01, 0], [0, 0, 0], [width * lean * 1.02, 0.02, depth * lean * 1.02]);
    if (options.windows !== false && i > 0) {
      for (const sx of [-1, 1]) {
        windowBox(gb, sx * width * 0.25, i * FLOOR + FLOOR * 0.58, (depth * lean) / 2 + 0.012, 0.085, 0.09);
      }
    }
  }
  const top = floors * FLOOR;
  // Half-timbering: corner posts and the bands between floors, only on the faces
  // that are not carrying the door.
  if (options.timber) {
    for (const sx of [-1, 1]) {
      gb.add(cube(), C.woodDark, [sx * width * 0.5, top / 2, depth / 2 + 0.005], [0, 0, 0], [0.024, top, 0.02]);
      gb.add(cube(), C.woodDark, [sx * width * 0.5, top / 2, -depth / 2 - 0.005], [0, 0, 0], [0.024, top, 0.02]);
    }
    for (let i = 1; i <= floors; i++) {
      gb.add(cube(), C.woodDark, [0, i * FLOOR - 0.008, depth / 2 + 0.005], [0, 0, 0], [width, 0.022, 0.02]);
      gb.add(cube(), C.woodDark, [0, i * FLOOR - 0.008, -depth / 2 - 0.005], [0, 0, 0], [width, 0.022, 0.02]);
    }
  }
  // Plinth: every house sits on a stone base instead of floating on the grass.
  gb.add(cube(), C.stoneDark, [0, 0.014, 0], [0, 0, 0], [width * 1.06, 0.028, depth * 1.06]);
  roof(gb, width * 0.62, depth * 0.62, 0.16 + 0.06 * floors, roofColor, top);
  if (options.chimney !== false) chimney(gb, width * 0.28, top + 0.12, -depth * 0.22);
  if (options.door !== false) {
    // Door with its frame, a step, and a lamp beside it.
    doorBox(gb, 0.02, 0.145, depth / 2, 0.13, 0.24);
    gb.add(cube(), C.iron, [width * 0.24, 0.2, depth / 2 + 0.02], [0, 0, 0], [0.012, 0.012, 0.05]);
    gb.add(cube(), C.lamp, [width * 0.24, 0.18, depth / 2 + 0.05], [0, 0, 0], [0.04, 0.05, 0.04]);
    gb.light(width * 0.24, 0.18, depth / 2 + 0.06, 0.7);
    windowBox(gb, -width * 0.3, 0.19, depth / 2 + 0.012, 0.09, 0.1);
  }
  return top;
}

/** A stretch of wall with its coping stone. */
function wallSeg(gb: GeoBuilder, x: number, z: number, w: number, d: number, h: number) {
  gb.add(cube(), C.stone, [x, h / 2, z], [0, 0, 0], [w, h, d]);
  gb.add(cube(), C.stoneDark, [x, h + 0.015, z], [0, 0, 0], [w + 0.03, 0.03, d + 0.03]);
}

/** The square teeth along the top of a wall. */
function merlons(gb: GeoBuilder, x: number, z: number, w: number, d: number, y: number, count: number) {
  const alongX = w > d;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : -0.5 + i / (count - 1);
    gb.add(
      cube(),
      C.stoneLight,
      [x + (alongX ? t * w * 0.8 : 0), y, z + (alongX ? 0 : t * d * 0.8)],
      [0, 0, 0],
      [alongX ? w / (count * 2) : d * 0.4, 0.06, alongX ? d * 0.4 : d / (count * 2)],
    );
  }
}

/** A round tower: stone drum, corbels, crenellations, a slit and a door. */
function roundTower(gb: GeoBuilder, x: number, z: number, radius: number, h: number) {
  gb.add(plate(), C.stoneDark, [x, 0.03, z], [0, 0, 0], [radius * 2.4, 0.06, radius * 2.4]);
  gb.add(plate(), C.stone, [x, h / 2, z], [0, 0, 0], [radius * 2, h, radius * 2]);
  gb.add(plate(), C.stone, [x, h + 0.04, z], [0, 0, 0], [radius * 2.3, 0.08, radius * 2.3]);
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    gb.add(cube(), C.stoneLight, [x + Math.cos(angle) * radius, h + 0.1, z + Math.sin(angle) * radius], [0, -angle, 0], [0.07, 0.06, 0.05]);
  }
  gb.add(cube(), C.ink, [x, h * 0.55, z + radius + 0.005], [0, 0, 0], [0.03, h * 0.24, 0.02]);
  gb.add(cube(), C.door, [x, 0.11, z + radius + 0.005], [0, 0, 0], [0.1, 0.22, 0.02]);
}

const builders: Record<Role, (gb: GeoBuilder, rnd: () => number, level: number) => void> = {
  house: (gb, rnd, level) => {
    const floors = Math.min(level, 3);
    houseBlock(gb, 0.6, 0.56, floors, rnd, {
      roof: rnd() < 0.35 ? C.roofDeep : C.roof,
      timber: rnd() < 0.45,
    });
    if (rnd() < 0.5) gb.add(blob(), C.leafDeep, [0.24, 0.06, 0.3], [0, rnd() * 3, 0], [0.14, 0.12, 0.14]);
  },

  townhouse: (gb, rnd) => {
    houseBlock(gb, 0.62, 0.56, 2, rnd, { jetty: true, timber: true, roof: rnd() < 0.5 ? C.roof : C.slate });
    // A balcony over the street.
    gb.add(cube(), C.wood, [0, FLOOR + 0.03, 0.31], [0, 0, 0], [0.5, 0.03, 0.14]);
    gb.add(cube(), C.woodDark, [0, FLOOR + 0.1, 0.37], [0, 0, 0], [0.5, 0.12, 0.02]);
    gb.add(blob(), C.leafLight, [-0.22, FLOOR + 0.08, 0.3], [0, 0.4, 0], [0.1, 0.09, 0.1]);
  },

  manor: (gb, rnd) => {
    houseBlock(gb, 0.66, 0.58, 3, rnd, { jetty: true, timber: true, roof: C.slate, wall: C.wallCool });
    // Dormers in the roof and a flag over the door.
    for (const sx of [-1, 1]) {
      gb.add(cube(), C.wall, [sx * 0.17, 3 * FLOOR + 0.08, 0.14], [0, 0, 0], [0.14, 0.14, 0.12]);
      roof(gb, 0.1, 0.1, 0.12, C.slateDeep, 3 * FLOOR + 0.15);
      gb.add(cube(), C.glass, [sx * 0.17, 3 * FLOOR + 0.09, 0.21], [0, 0, 0], [0.07, 0.07, 0.02]);
      gb.light(sx * 0.17, 3 * FLOOR + 0.09, 0.23, 0.6);
    }
    finial(gb, 0.02, 0.3, 0.33, 0.2, C.roof);
    // Stone gateposts.
    for (const sx of [-1, 1]) gb.add(plate(), C.stone, [sx * 0.24, 0.06, 0.33], [0, 0, 0], [0.08, 0.12, 0.08]);
  },

  chapel: (gb) => {
    gb.add(cube(), C.wall, [0.06, 0.2, 0], [0, 0, 0], [0.44, 0.4, 0.62]);
    roof(gb, 0.3, 0.36, 0.24, C.slate, 0.4);
    gb.add(cube(), C.wall, [-0.28, 0.42, 0], [0, 0, 0], [0.24, 0.84, 0.24]);
    gb.add(cube(), C.stoneDark, [-0.28, 0.86, 0], [0, 0, 0], [0.27, 0.05, 0.27]);
    roof(gb, 0.19, 0.19, 0.3, C.slateDeep, 0.9);
    windowBox(gb, -0.28, 0.66, 0.13, 0.07, 0.13);
    doorBox(gb, -0.28, 0.12, 0.13, 0.11, 0.22);
    chapelCross(gb, -0.28, 1.22, 0);
    gb.add(plate(), C.glass, [0.2, 0.42, 0.32], [1.57, 0, 0], [0.14, 0.03, 0.14]);
    gb.light(0.2, 0.42, 0.34, 0.9);
  },

  cathedral: (gb, rnd, level) => {
    // A nave with buttresses, a rose window and a spire that keeps climbing.
    const naveH = 0.5 + (level - 2) * 0.08;
    gb.add(cube(), C.wall, [0.08, naveH / 2, 0], [0, 0, 0], [0.5, naveH, 0.66]);
    roof(gb, 0.32, 0.4, 0.3, C.slate, naveH);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 0, 1]) {
        gb.add(cube(), C.stoneDark, [sx * 0.27, naveH * 0.45, sz * 0.2], [0, 0, 0], [0.05, naveH * 0.8, 0.08]);
      }
    }
    // Facade tower, and a second one when it reaches three floors.
    const towerH = 0.95 + (level - 2) * 0.22;
    gb.add(cube(), C.wall, [-0.3, towerH / 2, 0], [0, 0, 0], [0.26, towerH, 0.26]);
    gb.add(cube(), C.stoneDark, [-0.3, towerH, 0], [0, 0, 0], [0.3, 0.05, 0.3]);
    roof(gb, 0.2, 0.2, 0.4, C.slateDeep, towerH + 0.04);
    gb.add(cube(), C.ink, [-0.3, towerH + 0.5, 0], [0, 0, 0], [0.02, 0.15, 0.02]);
    gb.add(cube(), C.ink, [-0.3, towerH + 0.53, 0], [0, 0, 0], [0.12, 0.02, 0.02]);
    if (level >= 3) {
      gb.add(cube(), C.wall, [0.3, (towerH * 0.7) / 2, 0], [0, 0, 0], [0.2, towerH * 0.7, 0.2]);
      roof(gb, 0.16, 0.16, 0.3, C.slateDeep, towerH * 0.7);
    }
    windowBox(gb, -0.3, towerH * 0.72, 0.14, 0.07, 0.14);
    windowBox(gb, 0.08, naveH * 0.7, 0.34, 0.1, 0.16);
    gb.add(plate(), C.glass, [0.08, naveH * 0.55, 0.34], [1.57, 0, 0], [0.2, 0.03, 0.2]);
    gb.light(0.08, naveH * 0.55, 0.36, 1.2);
    gb.add(cube(), C.door, [-0.3, 0.14, 0.14], [0, 0, 0], [0.12, 0.26, 0.03]);
    for (let i = 0; i < 3; i++) gb.add(cube(), C.stoneLight, [-0.4 + i * 0.06, 0.01, 0.3], [0, 0, 0], [0.06, 0.03, 0.06]);
    void rnd;
  },

  shop: (gb, rnd, level) => {
    houseBlock(gb, 0.58, 0.52, Math.min(level, 3), rnd, { roof: C.roof, windows: true });
    gb.add(cube(), C.glass, [0, 0.18, 0.27], [0, 0, 0], [0.34, 0.2, 0.03]);
    gb.add(cube(), C.woodDark, [0, 0.18, 0.27], [0, 0, 0], [0.02, 0.2, 0.035]);
    gb.add(cube(), rnd() < 0.5 ? C.clothWarm : C.cloth, [0, 0.33, 0.34], [-0.35, 0, 0], [0.46, 0.03, 0.2]);
    gb.add(cube(), C.cloth, [0, 0.31, 0.4], [0, 0, 0], [0.46, 0.04, 0.02]);
    gb.add(cube(), C.woodDark, [0.26, 0.42, 0.26], [0, 0, 0], [0.02, 0.16, 0.02]);
    gb.add(cube(), C.roofDeep, [0.26, 0.36, 0.26], [0, 0, 0], [0.1, 0.09, 0.02]);
    gb.light(0, 0.2, 0.29, 0.9);
  },

  cottage: (gb, rnd) => {
    houseBlock(gb, 0.46, 0.44, 1, rnd, { wall: C.wallWarm, roof: C.thatch, chimney: true });
    for (let i = 0; i < 4; i++) {
      gb.add(cube(), C.wood, [-0.42 + i * 0.1, 0.07, 0.34], [0, 0, 0], [0.025, 0.14, 0.025]);
    }
    gb.add(cube(), C.wood, [-0.27, 0.11, 0.34], [0, 0, 0], [0.3, 0.02, 0.02]);
    gb.add(blob(), C.leaf, [0.28, 0.07, 0.28], [0, rnd() * 3, 0], [0.16, 0.14, 0.16]);
    gb.add(blob(), rnd() < 0.5 ? C.leafLight : C.leafDeep, [-0.3, 0.06, -0.28], [0, rnd() * 3, 0], [0.12, 0.11, 0.12]);
  },

  barn: (gb, rnd, level) => {
    const h = 0.38 + (level - 1) * 0.08;
    gb.add(cube(), C.wood, [0, h / 2, 0], [0, 0, 0], [0.72, h, 0.54]);
    roof(gb, 0.46, 0.36, 0.26, C.thatchDeep, h);
    gb.add(cube(), C.woodDark, [0, 0.16, 0.28], [0, 0, 0], [0.34, 0.3, 0.03]);
    gb.add(cube(), C.door, [0, 0.14, 0.29], [0, 0, 0], [0.03, 0.26, 0.02]);
    gb.add(cube(), C.ink, [0, 0.2, 0.295], [0, 0, 0.5], [0.34, 0.02, 0.02]);
    gb.add(blob(), C.thatch, [0.3, 0.06, 0.3], [0, 0.6, 0], [0.18, 0.14, 0.18]);
    windowBox(gb, 0.22, h * 0.7, 0.28, 0.08, 0.08, false);
    void rnd;
  },

  lighthouse: (gb, rnd, level) => {
    const towerH = 0.7 + (level - 1) * 0.26;
    gb.add(plate(), C.stoneDark, [0, 0.09, 0], [0, 0, 0], [0.56, 0.18, 0.56]);
    gb.add(plate(), C.stone, [0, 0.2, 0], [0, 0, 0], [0.46, 0.06, 0.46]);
    gb.add(plate(), C.wall, [0, 0.22 + towerH / 2, 0], [0, 0, 0], [0.4, towerH, 0.4]);
    for (let i = 0; i < 2 + level; i++) {
      const y = 0.3 + (i * towerH) / (2.5 + level);
      if (y > towerH + 0.1) break;
      gb.add(plate(), C.roof, [0, y, 0], [0, 0, 0], [0.405, 0.08, 0.405]);
    }
    const top = 0.22 + towerH;
    gb.add(plate(), C.ink, [0, top + 0.02, 0], [0, 0, 0], [0.34, 0.06, 0.34]);
    gb.add(plate(), C.glass, [0, top + 0.11, 0], [0, 0, 0], [0.26, 0.12, 0.26]);
    gb.add(cube(), C.lamp, [0, top + 0.11, 0], [0, 0, 0], [0.11, 0.11, 0.11]);
    gb.light(0, top + 0.11, 0, 2.2);
    gb.add(cone(), C.slateDeep, [0, top + 0.17, 0], [0, 0, 0], [0.32, 0.16, 0.32]);
    finial(gb, 0, top + 0.3, 0, 0.07);
    // A keeper's door at the foot.
    gb.add(cube(), C.door, [0, 0.12, 0.2], [0, 0, 0], [0.1, 0.2, 0.03]);
    windowBox(gb, 0, 0.55, 0.2, 0.06, 0.08, rnd() < 0.5);
  },

  keep: (gb, _rnd, level) => {
    const wallH = 0.56 + (level - 1) * 0.16;
    gb.add(cube(), C.stoneDark, [0, 0.04, 0], [0, 0, 0], [0.94, 0.08, 0.94]);
    gb.add(cube(), C.stone, [0, wallH / 2 + 0.04, 0], [0, 0, 0], [0.54, wallH, 0.54]);
    for (let i = -1; i <= 1; i++) {
      for (const side of [-1, 1]) {
        gb.add(cube(), C.stone, [i * 0.19, wallH + 0.07, side * 0.27], [0, 0, 0], [0.11, 0.06, 0.05]);
        gb.add(cube(), C.stone, [side * 0.27, wallH + 0.07, i * 0.19], [0, 0, 0], [0.05, 0.06, 0.11]);
      }
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      gb.add(plate(), C.stone, [sx * 0.3, wallH * 0.6, sz * 0.3], [0, 0, 0], [0.22, wallH + 0.1, 0.22]);
      gb.add(plate(), C.stoneDark, [sx * 0.3, wallH + 0.12, sz * 0.3], [0, 0, 0], [0.25, 0.05, 0.25]);
      gb.add(cone(), C.slateDeep, [sx * 0.3, wallH + 0.14, sz * 0.3], [0, 0, 0], [0.3, 0.26 + level * 0.04, 0.3]);
    }
    roof(gb, 0.2, 0.2, 0.26 + level * 0.05, C.slate, wallH + 0.04);
    finial(gb, 0, wallH + 0.3, 0, 0.22, C.roof);
    gb.add(cube(), C.door, [0, 0.16, 0.275], [0, 0, 0], [0.14, 0.24, 0.03]);
    windowBox(gb, 0, wallH * 0.65, 0.275, 0.06, 0.1);
  },

  clocktower: (gb, rnd, level) => {
    const h = 0.8 + (level - 1) * 0.18;
    gb.add(cube(), C.stoneDark, [0, 0.05, 0], [0, 0, 0], [0.62, 0.1, 0.62]);
    gb.add(cube(), C.wall, [0, h / 2, 0], [0, 0, 0], [0.38, h, 0.38]);
    gb.add(cube(), C.stoneDark, [0, h + 0.02, 0], [0, 0, 0], [0.46, 0.06, 0.46]);
    gb.add(cube(), C.stone, [0, h + 0.1, 0], [0, 0, 0], [0.42, 0.1, 0.42]);
    roof(gb, 0.3, 0.3, 0.28, C.slate, h + 0.15);
    finial(gb, 0, h + 0.4, 0, 0.12);
    for (const sz of [1, -1]) {
      gb.add(plate(), C.cloth, [0, h - 0.2, sz * 0.2], [1.57, 0, 0], [0.24, 0.03, 0.24]);
      gb.add(cube(), C.ink, [0, h - 0.2, sz * 0.22], [0, 0, 0], [0.015, 0.09, 0.01]);
      gb.add(cube(), C.ink, [0.03, h - 0.2, sz * 0.22], [0, 0, 0.9], [0.015, 0.07, 0.01]);
      gb.light(0, h - 0.2, sz * 0.24, 0.7);
    }
    gb.add(cube(), C.door, [0, 0.13, 0.2], [0, 0, 0], [0.12, 0.24, 0.03]);
    void rnd;
  },

  tower: (gb, rnd, level) => {
    const h = 0.62 + (level - 1) * 0.3;
    gb.add(plate(), C.stoneDark, [0, 0.05, 0], [0, 0, 0], [0.5, 0.1, 0.5]);
    gb.add(plate(), rnd() < 0.5 ? C.stone : C.wallCool, [0, 0.1 + h / 2, 0], [0, 0, 0], [0.36, h, 0.36]);
    gb.add(plate(), C.stoneDark, [0, h + 0.1, 0], [0, 0, 0], [0.42, 0.05, 0.42]);
    gb.add(cone(), rnd() < 0.5 ? C.slate : C.roofDeep, [0, h + 0.12, 0], [0, 0, 0], [0.46, 0.3, 0.46]);
    finial(gb, 0, h + 0.38, 0, 0.09, C.cloth);
    // A banner hanging down the wall.
    gb.add(cube(), C.cloth, [0, h * 0.72, 0.19], [0, 0, 0], [0.07, 0.16, 0.008]);
    if (level > 1) windowBox(gb, 0, h * 0.45, 0.18, 0.06, 0.1);
  },

  belltower: (gb, rnd, level) => {
    const h = 0.9 + (level - 2) * 0.2;
    gb.add(cube(), C.stoneDark, [0, 0.06, 0], [0, 0, 0], [0.54, 0.12, 0.54]);
    gb.add(cube(), C.wall, [0, h / 2, 0], [0, 0, 0], [0.34, h, 0.34]);
    // Arched belfry: four openings with a bell hanging inside.
    for (const [dx, dz, rot] of [[0, 1, 0], [0, -1, 0], [1, 0, 1.57], [-1, 0, 1.57]] as const) {
      gb.add(cube(), C.ink, [dx * 0.17, h - 0.18, dz * 0.17], [0, rot, 0], [0.14, 0.2, 0.03]);
      gb.add(plate(), C.stoneDark, [dx * 0.17, h - 0.06, dz * 0.17], [0, rot, 0], [0.18, 0.03, 0.18]);
    }
    gb.add(blob(), C.ink, [0, h - 0.12, 0], [0, 0, 0], [0.14, 0.12, 0.14]);
    gb.add(cube(), C.ink, [0, h - 0.02, 0], [0, 0, 0], [0.03, 0.08, 0.03]);
    gb.add(cube(), C.stone, [0, h + 0.03, 0], [0, 0, 0], [0.42, 0.07, 0.42]);
    roof(gb, 0.28, 0.28, 0.36, C.slate, h + 0.07);
    finial(gb, 0, h + 0.39, 0, 0.12, C.cloth);
    gb.add(cube(), C.door, [0, 0.14, 0.18], [0, 0, 0], [0.11, 0.24, 0.03]);
    windowBox(gb, 0, h * 0.55, 0.18, 0.07, 0.12);
    void rnd;
  },

  watchtower: (gb, _rnd, level) => {
    const h = 1.2 + (level - 3) * 0.3;
    gb.add(plate(), C.stoneDark, [0, 0.06, 0], [0, 0, 0], [0.6, 0.12, 0.6]);
    gb.add(plate(), C.stone, [0, 0.1 + h / 2, 0], [0, 0, 0], [0.4, h, 0.4]);
    gb.add(plate(), C.stoneDark, [0, h + 0.12, 0], [0, 0, 0], [0.5, 0.06, 0.5]);
    // Crenellations and a wooden hoarding near the top.
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      gb.add(cube(), C.stone, [Math.cos(angle) * 0.2, h + 0.2, Math.sin(angle) * 0.2], [0, -angle, 0], [0.08, 0.08, 0.05]);
    }
    gb.add(cube(), C.wood, [0, h * 0.72, 0], [0, 0, 0], [0.52, 0.05, 0.52]);
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      gb.add(cube(), C.woodDark, [Math.cos(angle) * 0.25, h * 0.78, Math.sin(angle) * 0.25], [0, -angle, 0], [0.03, 0.12, 0.03]);
    }
    roof(gb, 0.3, 0.3, 0.34, C.slateDeep, h + 0.24);
    finial(gb, 0, h + 0.42, 0, 0.26, C.roofDeep);
    gb.add(cube(), C.cloth, [0, h * 0.58, 0.21], [0, 0, 0], [0.08, 0.18, 0.008]);
    windowBox(gb, 0, h * 0.85, 0.2, 0.07, 0.1);
  },

  observatory: (gb, rnd, level) => {
    const h = 0.7 + (level - 1) * 0.1;
    gb.add(plate(), C.stoneDark, [0, 0.07, 0], [0, 0, 0], [0.6, 0.14, 0.6]);
    gb.add(plate(), C.wall, [0, 0.19 + h / 2, 0], [0, 0, 0], [0.42, h, 0.42]);
    gb.add(plate(), C.stone, [0, h + 0.16, 0], [0, 0, 0], [0.48, 0.05, 0.48]);
    gb.add(dome(), C.stoneLight, [0, h + 0.18, 0], [0, 0, 0], [0.4, 0.36, 0.4]);
    // The shutter stands open and the telescope looks out of it.
    gb.add(cube(), C.stoneDark, [0, h + 0.3, 0.04], [0, 0, 0], [0.11, 0.13, 0.16]);
    gb.add(plate(), C.stone, [0, h + 0.37, 0], [0, 0, 0], [0.09, 0.03, 0.09]);
    gb.add(post(), C.iron, [0.015, h + 0.4, 0.09], [0.85, 0, 0.15], [0.045, 0.26, 0.045]);
    gb.add(plate(), C.iron, [0.045, h + 0.5, 0.18], [1.15, 0, 0], [0.055, 0.025, 0.055]);
    gb.add(plate(), C.glass, [0.047, h + 0.515, 0.19], [1.15, 0, 0], [0.04, 0.012, 0.04]);
    gb.add(cube(), C.door, [0, 0.12, 0.22], [0, 0, 0], [0.12, 0.22, 0.03]);
    windowBox(gb, 0, 0.34, 0.22, 0.08, 0.09);
    void rnd;
  },

  dovecote: (gb, rnd, level) => {
    const h = 0.62 + (level - 1) * 0.1;
    gb.add(plate(), C.stoneDark, [0, 0.06, 0], [0, 0, 0], [0.5, 0.12, 0.5]);
    gb.add(plate(), C.stone, [0, 0.12 + h / 2, 0], [0, 0, 0], [0.38, h, 0.38]);
    gb.add(plate(), C.stoneLight, [0, h + 0.12, 0], [0, 0, 0], [0.44, 0.05, 0.44]);
    gb.add(cone(), C.slateDeep, [0, h + 0.14, 0], [0, 0, 0], [0.52, 0.28, 0.52]);
    finial(gb, 0, h + 0.38, 0, 0.1);
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      gb.add(cube(), C.ink, [Math.cos(angle) * 0.18, h * 0.72, Math.sin(angle) * 0.18], [0, -angle, 0], [0.05, 0.05, 0.02]);
    }
    gb.add(blob(), C.cloth, [0.3, 0.06, 0.24], [0, 0.6, 0], [0.06, 0.05, 0.06]);
    gb.add(blob(), C.cloth, [-0.28, 0.05, 0.16], [0, 1.2, 0], [0.05, 0.045, 0.05]);
    void rnd;
  },

  windmill: (gb, rnd, level) => {
    const bodyH = 0.56 + (level - 1) * 0.12;
    gb.add(plate(), C.stoneDark, [0, 0.05, 0], [0, 0, 0], [0.62, 0.1, 0.62]);
    gb.add(plate(), C.wallWarm, [0, 0.1 + bodyH / 2, 0], [0, 0, 0], [0.44, bodyH, 0.44]);
    gb.add(plate(), C.stone, [0, bodyH + 0.1, 0], [0, 0, 0], [0.4, 0.08, 0.4]);
    gb.add(dome(), C.thatch, [0, bodyH + 0.14, 0], [0, 0, 0], [0.44, 0.3, 0.44]);
    gb.add(cube(), C.door, [0, 0.12, 0.19], [0, 0, 0], [0.12, 0.22, 0.03]);
    windowBox(gb, 0, bodyH * 0.7, 0.19, 0.08, 0.08);
    const hubY = bodyH * 0.75;
    gb.add(plate(), C.woodDark, [0, hubY, 0.3], [1.57, 0, 0], [0.1, 0.14, 0.1]);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      gb.add(
        cube(),
        C.wood,
        [Math.sin(angle) * 0.32, hubY + Math.cos(angle) * 0.32, 0.3],
        [0, 0, -angle],
        [0.05, 0.62, 0.02],
      );
      gb.add(
        cube(),
        C.cloth,
        [Math.sin(angle) * 0.36 + Math.cos(angle) * 0.06, hubY + Math.cos(angle) * 0.36, 0.31],
        [0, 0, -angle],
        [0.13, 0.5, 0.01],
      );
    }
    gb.light(0, bodyH * 0.7, 0.2, 0.6);
    void rnd;
  },

  watermill: (gb, rnd, level) => {
    const bodyH = 0.52 + (level - 1) * 0.1;
    gb.add(plate(), C.stoneDark, [0, 0.05, 0], [0, 0, 0], [0.66, 0.1, 0.66]);
    gb.add(cube(), C.wallWarm, [-0.06, 0.1 + bodyH / 2, 0], [0, 0, 0], [0.5, bodyH, 0.5]);
    gb.add(cube(), C.stone, [-0.06, bodyH + 0.12, 0], [0, 0, 0], [0.56, 0.06, 0.56]);
    roof(gb, 0.32, 0.32, 0.24, C.thatch, bodyH + 0.15);
    gb.add(cube(), C.door, [-0.06, 0.13, 0.26], [0, 0, 0], [0.13, 0.24, 0.03]);
    windowBox(gb, 0.08, bodyH * 0.7, 0.24, 0.08, 0.08);
    chimney(gb, -0.2, bodyH + 0.3, -0.14);
    const wheelX = 0.3;
    for (const side of [-0.05, 0.05]) {
      gb.add(ring(), C.woodDark, [wheelX + side, 0.26, 0], [0, 1.57, 0], [0.52, 0.52, 0.52]);
    }
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      gb.add(cube(), C.wood, [wheelX, 0.26 + Math.cos(angle) * 0.26, Math.sin(angle) * 0.26], [angle, 0, 0], [0.1, 0.03, 0.14]);
    }
    gb.add(post(), C.ink, [wheelX, 0.26, 0], [0, 0, 1.57], [0.04, 0.2, 0.04]);
    gb.add(blob(), C.water, [wheelX, 0.02, 0.16], [0, 0, 0], [0.16, 0.05, 0.14]);
    gb.light(-0.06, 0.2, 0.28, 0.7);
    void rnd;
  },

  street: (gb, rnd) => {
    gb.add(quad(), C.path, [0, 0.012, 0], [0, 0, 0], [0.98, 1, 0.98]);
    gb.add(cube(), C.stoneLight, [0, 0.02, 0], [0, 0, 0], [0.34, 0.02, 0.98]);
    gb.add(cube(), C.stoneLight, [0, 0.021, 0], [0, 0, 0], [0.98, 0.02, 0.34]);
    if (rnd() < 0.75) lamp(gb, 0.4, 0.4);
    if (rnd() < 0.3) lamp(gb, -0.4, -0.4);
    if (rnd() < 0.3) bench(gb, -0.36, 0.42, 0.2);
  },

  quay: (gb, rnd) => {
    gb.add(cube(), C.stoneDark, [0, 0.02, 0], [0, 0, 0], [1.0, 0.04, 1.0]);
    const n = 3;
    const step = 1 / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const px = -0.5 + step * (i + 0.5);
        const pz = -0.5 + step * (j + 0.5);
        const tone = rnd() < 0.35 ? C.stone : C.stoneLight;
        gb.add(cube(), tone, [px, 0.05, pz], [0, 0, 0], [step * 0.88, 0.02, step * 0.88]);
      }
    }
    for (const [x, z] of [[0.4, 0.4], [-0.4, -0.4]] as const) {
      gb.add(plate(), C.woodDark, [x, 0.14, z], [0, 0, 0], [0.1, 0.18, 0.1]);
    }
    if (rnd() < 0.4) lamp(gb, 0.4, -0.4);
  },

  bridge: (gb, rnd) => {
    // Deck, rails and the piers that carry it over the water.
    gb.add(cube(), C.stone, [0, 0.02, 0], [0, 0, 0], [1.04, 0.08, 0.66]);
    gb.add(cube(), C.stoneDark, [0, -0.05, 0], [0, 0, 0], [1.04, 0.06, 0.74]);
    for (const sz of [-1, 1]) {
      gb.add(cube(), C.stoneLight, [0, 0.14, sz * 0.3], [0, 0, 0], [1.04, 0.14, 0.06]);
      for (const sx of [-0.45, 0, 0.45]) {
        gb.add(cube(), C.stone, [sx, 0.06, sz * 0.3], [0, 0, 0], [0.07, 0.12, 0.07]);
      }
    }
    // Two arches under the deck.
    for (const sx of [-0.26, 0.26]) {
      gb.add(post(), C.stoneDark, [sx, -0.24, 0], [0, 0, 1.57], [0.16, 0.9, 0.16]);
      gb.add(plate(), C.stone, [sx, -0.28, 0], [0, 0, 0], [0.1, 0.42, 0.5]);
    }
    if (rnd() < 0.4) lamp(gb, 0.42, 0.3);
  },

  plaza: (gb, rnd) => {
    gb.add(cube(), C.stoneDark, [0, 0.016, 0], [0, 0, 0], [0.97, 0.032, 0.97]);
    const n = 4;
    const step = 0.97 / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const px = -0.485 + step * (i + 0.5);
        const pz = -0.485 + step * (j + 0.5);
        const tone = rnd() < 0.4 ? C.stone : C.stoneLight;
        gb.add(cube(), tone, [px, 0.04, pz], [0, 0, 0], [step * 0.9, 0.02, step * 0.9]);
      }
    }
  },

  square: (gb) => {
    builders.plaza(gb, () => 0.5, 1);
    gb.add(plate(), C.stone, [0, 0.11, 0], [0, 0, 0], [0.46, 0.14, 0.46]);
    gb.add(plate(), C.water, [0, 0.17, 0], [0, 0, 0], [0.36, 0.03, 0.36]);
    gb.add(plate(), C.stoneDark, [0, 0.18, 0], [0, 0, 0], [0.08, 0.16, 0.08]);
    gb.add(blob(), C.ink, [0, 0.28, 0], [0, 0, 0], [0.09, 0.09, 0.09]);
    bench(gb, 0.4, 0.34, 0.4);
    bench(gb, -0.4, -0.3, -0.5);
    tree(gb, -0.36, 0.36, 0.55, () => 0.4);
  },

  theatre: (gb, rnd) => {
    // A small odeon: two steps, a curved backdrop and four columns. No roof,
    // so it reads as seats in the open, not as a mushroom.
    gb.add(plate(), C.stoneDark, [0, 0.03, 0], [0, 0, 0], [0.86, 0.06, 0.86]);
    gb.add(plate(), C.stoneLight, [0, 0.07, 0], [0, 0, 0], [0.68, 0.04, 0.68]);
    for (let i = 0; i < 9; i++) {
      const angle = Math.PI * (0.12 + (i / 8) * 0.76);
      const x = Math.cos(angle) * 0.3;
      const z = -Math.sin(angle) * 0.3;
      gb.add(cube(), C.stone, [x, 0.16, z - 0.1], [0, -angle, 0], [0.14, 0.2, 0.05]);
      gb.add(cube(), C.stoneDark, [x, 0.25, z - 0.1], [0, -angle, 0], [0.15, 0.03, 0.06]);
    }
    for (const [x, z] of [[-0.2, 0.22], [0.2, 0.22], [-0.07, 0.3], [0.07, 0.3]] as const) {
      gb.add(post(), C.wall, [x, 0.2, z], [0, 0, 0], [0.05, 0.26, 0.05]);
      gb.add(cube(), C.stoneLight, [x, 0.33, z], [0, 0, 0], [0.08, 0.03, 0.08]);
    }
    gb.add(cube(), C.cloth, [0, 0.09, -0.04], [0, 0, 0], [0.24, 0.02, 0.18]);
    bench(gb, 0.34, 0.3, 0.4);
    gb.light(-0.2, 0.32, 0.24, 0.9);
    gb.light(0.2, 0.32, 0.24, 0.9);
    void rnd;
  },

  bandstand: (gb) => {
    gb.add(plate(), C.stoneDark, [0, 0.06, 0], [0, 0, 0], [0.72, 0.12, 0.72]);
    gb.add(plate(), C.wood, [0, 0.14, 0], [0, 0, 0], [0.64, 0.06, 0.64]);
    gb.add(plate(), C.stoneLight, [0, 0.04, 0], [0, 0, 0], [0.8, 0.04, 0.8]);
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      gb.add(post(), C.wall, [Math.cos(angle) * 0.29, 0.34, Math.sin(angle) * 0.29], [0, 0, 0], [0.05, 0.38, 0.05]);
    }
    gb.add(plate(), C.stone, [0, 0.54, 0], [0, 0, 0], [0.72, 0.05, 0.72]);
    gb.add(dome(), C.slate, [0, 0.56, 0], [0, 0, 0], [0.76, 0.4, 0.76]);
    gb.add(cube(), C.ink, [0, 0.92, 0], [0, 0, 0], [0.02, 0.12, 0.02]);
    gb.add(blob(), C.lamp, [0, 0.98, 0], [0, 0, 0], [0.07, 0.07, 0.07]);
    gb.light(0, 0.42, 0, 1.4);
  },

  tree: (gb, rnd, level) => {
    grownTree(gb, 0, 0, level, rnd);
    if (level >= 2) {
      gb.add(blob(), C.leafDeep, [0.26, 0.05, -0.22], [0, rnd() * 3, 0], [0.15, 0.11, 0.15]);
      gb.add(blob(), C.leafLight, [-0.24, 0.04, 0.2], [0, rnd() * 3, 0], [0.12, 0.09, 0.12]);
    }
  },

  greatoak: (gb, rnd, level) => {
    // The old oak: it keeps growing on the fourth and fifth click.
    const lv = Math.max(level, 3);
    grownTree(gb, 0, 0, lv, rnd);
    // Moss and flowers at its feet, and a bench to sit under it.
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3 + 0.4;
      gb.add(blob(), C.leafLight, [Math.cos(angle) * 0.32, 0.03, Math.sin(angle) * 0.32], [0, rnd() * 3, 0], [0.14, 0.06, 0.12]);
      gb.add(cube(), C.clothWarm, [Math.cos(angle + 0.5) * 0.34, 0.03, Math.sin(angle + 0.5) * 0.34], [0, 0, 0], [0.02, 0.02, 0.02]);
    }
    bench(gb, 0.34, 0.3, -0.5);
    if (lv >= 5) {
      // A swing under the oldest oak in town.
      gb.add(cube(), C.ink, [0.18, 0.5, 0.16], [0, 0, 0.35], [0.016, 0.3, 0.016]);
      gb.add(cube(), C.ink, [-0.16, 0.5, 0.16], [0, 0, -0.35], [0.016, 0.3, 0.016]);
      gb.add(cube(), C.wood, [0.01, 0.36, 0.16], [0, 0, 0], [0.3, 0.03, 0.1]);
    }
  },

  orchard: (gb, rnd) => {
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]] as const) tree(gb, x, z, 0.42, rnd);
    gb.add(quad(), C.leafLight, [0, 0.005, 0], [0, 0, 0], [0.9, 1, 0.9]);
  },

  dock: (gb) => {
    for (let i = -2; i <= 2; i++) {
      gb.add(cube(), C.wood, [i * 0.19, 0.06, 0], [0, 0, 0], [0.16, 0.035, 0.82]);
    }
    for (const [x, z] of [[-0.4, -0.34], [0.4, -0.34], [-0.4, 0.34], [0.4, 0.34]] as const) {
      gb.add(post(), C.woodDark, [x, -0.12, z], [0, 0, 0], [0.07, 0.5, 0.07]);
    }
    gb.add(cube(), C.woodDark, [0, 0.04, 0.4], [0, 0, 0], [0.86, 0.03, 0.06]);
  },

  field: (gb, rnd) => {
    gb.add(cube(), C.soil, [0, 0.015, 0], [0, 0, 0], [0.9, 0.03, 0.9]);
    for (let i = 0; i < 4; i++) {
      const x = -0.3 + i * 0.2;
      gb.add(cube(), rnd() < 0.5 ? C.leaf : C.leafLight, [x, 0.055, 0], [0, 0, 0], [0.09, 0.06, 0.78]);
    }
    if (rnd() < 0.5) gb.add(blob(), C.thatch, [0.34, 0.07, 0.32], [0, rnd() * 3, 0], [0.14, 0.12, 0.14]);
  },

  stall: (gb, rnd) => {
    houseBlock(gb, 0.5, 0.46, 1, rnd, { wall: C.wallWarm, roof: rnd() < 0.5 ? C.cloth : C.roof });
    gb.add(cube(), C.woodDark, [0, 0.2, 0.28], [0, 0, 0], [0.44, 0.03, 0.16]);
    for (let i = 0; i < 4; i++) {
      gb.add(cube(), i % 2 === 0 ? C.roof : C.cloth, [-0.16 + i * 0.11, 0.3, 0.3], [0, 0, 0], [0.1, 0.02, 0.22]);
    }
    gb.add(cube(), C.wood, [0, 0.06, 0.3], [0, 0, 0], [0.4, 0.1, 0.14]);
    gb.add(blob(), C.roof, [-0.1, 0.14, 0.3], [0, 0.4, 0], [0.09, 0.09, 0.09]);
    gb.add(blob(), C.leafDeep, [0.1, 0.14, 0.3], [0, 0.9, 0], [0.09, 0.09, 0.09]);
    windowBox(gb, 0.14, 0.22, 0.235, 0.08, 0.08);
  },

  inn: (gb, rnd, level) => {
    const floors = Math.max(2, Math.min(level + 1, 3));
    houseBlock(gb, 0.62, 0.5, floors, rnd, { wall: C.wallWarm, roof: C.roofDeep, jetty: true });
    for (const x of [-0.22, 0, 0.22]) windowBox(gb, x, FLOOR * 0.55, 0.25, 0.08, 0.09, rnd() < 0.6);
    gb.add(cube(), C.lamp, [0.06, 0.32, 0.3], [0, 0, 0], [0.06, 0.06, 0.04]);
    gb.light(0.06, 0.32, 0.32, 0.9);
    gb.add(cube(), C.woodDark, [0.34, 0.42, 0.26], [0, 0, 0], [0.02, 0.22, 0.02]);
    gb.add(cube(), rnd() < 0.5 ? C.roof : C.slate, [0.34, 0.34, 0.26], [0, 0, 0], [0.12, 0.11, 0.02]);
  },

  schoolhouse: (gb, rnd) => {
    // A long hall with a bell cupola and a yard.
    houseBlock(gb, 0.66, 0.46, 2, rnd, { wall: C.wallCool, roof: C.slate, chimney: false });
    gb.add(cube(), C.stone, [0, 2 * FLOOR + 0.04, -0.02], [0, 0, 0], [0.18, 0.16, 0.18]);
    roof(gb, 0.13, 0.13, 0.14, C.slateDeep, 2 * FLOOR + 0.12);
    gb.add(blob(), C.ink, [0, 2 * FLOOR + 0.06, -0.02], [0, 0, 0], [0.07, 0.06, 0.07]);
    for (const x of [-0.2, 0, 0.2]) windowBox(gb, x, FLOOR * 0.62, 0.24, 0.1, 0.12);
    gb.add(cube(), C.door, [0, 0.13, 0.24], [0, 0, 0], [0.14, 0.26, 0.03]);
    gb.add(quad(), C.stoneLight, [0, 0.008, 0.36], [0, 0, 0], [0.44, 1, 0.16]);
    gb.light(0, 0.3, 0.27, 1.3);
  },

  smithy: (gb, rnd) => {
    // A workshop with a smoking forge and a wagon wheel against the wall.
    houseBlock(gb, 0.56, 0.48, 1, rnd, { wall: C.stone, roof: C.slateDeep, windows: false });
    gb.add(cube(), C.woodDark, [0, 0.16, 0.26], [0, 0, 0], [0.22, 0.24, 0.03]);
    const forge = [0.16, 0.18, 0.28] as const;
    gb.add(cube(), C.ink, [forge[0], forge[1], forge[2]], [0, 0, 0], [0.12, 0.1, 0.05]);
    gb.add(cube(), C.roof, [forge[0], forge[1] - 0.01, forge[2] + 0.01], [0, 0, 0], [0.08, 0.06, 0.02]);
    gb.light(forge[0], forge[1], forge[2] + 0.05, 1.2);
    gb.add(post(), C.woodDark, [-0.36, 0.1, 0.3], [0, 0, 0], [0.04, 0.2, 0.04]);
    gb.add(ring(), C.wood, [-0.36, 0.16, 0.3], [0, 1.57, 0], [0.22, 0.22, 0.22]);
    gb.add(cube(), C.ink, [0.26, 0.03, 0.34], [0, 0.4, 0], [0.14, 0.06, 0.06]);
    gb.add(plate(), C.iron, [0.26, 0.1, 0.34], [0, 0, 0], [0.1, 0.08, 0.1]);
    gb.add(cube(), C.stoneDark, [0, 0.03, 0.36], [0, 0, 0], [0.4, 0.06, 0.1]);
  },

  boathouse: (gb) => {
    // A shed on stilts with a boat pulled inside.
    for (const [x, z] of [[-0.24, -0.2], [0.24, -0.2], [-0.24, 0.2], [0.24, 0.2]] as const) {
      gb.add(post(), C.woodDark, [x, 0.06, z], [0, 0, 0], [0.06, 0.34, 0.06]);
    }
    gb.add(cube(), C.wood, [0, 0.22, 0], [0, 0, 0], [0.62, 0.05, 0.56]);
    gb.add(cube(), C.wallWarm, [-0.16, 0.36, 0], [0, 0, 0], [0.3, 0.24, 0.5]);
    gb.add(cube(), C.wall, [0.16, 0.36, -0.02], [0, 0, 0], [0.3, 0.24, 0.46]);
    roof(gb, 0.34, 0.3, 0.16, C.thatchDeep, 0.48);
    gb.add(cube(), C.ink, [0.06, 0.32, 0.26], [0, 0, 0], [0.16, 0.2, 0.02]);
    gb.add(cube(), C.wood, [0.06, 0.18, 0.28], [0, 0, 0], [0.18, 0.07, 0.3]);
    gb.add(blob(), C.cloth, [0.06, 0.22, 0.3], [0, 0, 0], [0.06, 0.04, 0.1]);
    gb.add(cube(), C.stoneDark, [0.06, 0.13, 0.42], [0, 0, 0], [0.22, 0.03, 0.12]);
    gb.add(blob(), C.water, [0.06, 0.06, 0.46], [0, 0.4, 0], [0.24, 0.05, 0.12]);
    windowBox(gb, -0.16, 0.4, 0.25, 0.07, 0.07);
  },

  warehouse: (gb, rnd, level) => {
    const floors = 2 + (level > 1 ? 1 : 0);
    houseBlock(gb, 0.72, 0.52, floors, rnd, { wall: C.wallWarm, roof: C.slate, jetty: false, chimney: false });
    // Loading doors, a hoist beam and crates.
    for (let i = 0; i < floors; i++) {
      gb.add(cube(), C.woodDark, [0, i * FLOOR + 0.16, 0.27], [0, 0, 0], [0.24, 0.2, 0.03]);
      gb.add(cube(), C.ink, [0, i * FLOOR + 0.16, 0.29], [0, 0, 0], [0.2, 0.02, 0.02]);
    }
    gb.add(cube(), C.wood, [0.28, 2 * FLOOR + 0.18, 0.22], [0, 0, -0.5], [0.28, 0.04, 0.04]);
    gb.add(post(), C.ink, [0.34, 2 * FLOOR + 0.05, 0.24], [0, 0, 0], [0.01, 0.2, 0.01]);
    for (const [x, z, s] of [[-0.3, 0.34, 0.14], [0.32, 0.34, 0.12], [0.16, 0.4, 0.1]] as const) {
      gb.add(cube(), C.wood, [x, s / 2 + 0.02, z], [0, rnd() * 0.4, 0], [s, s, s]);
    }
    windowBox(gb, -0.3, FLOOR * 0.7, 0.28, 0.08, 0.1, false);
  },

  tenement: (gb, rnd, level) => {
    // Floors stacked over a shop: shutters, rails and laundry across the street.
    const floors = Math.min(Math.max(level, 3), 5);
    const width = 0.68;
    const depth = 0.56;
    const lean = (i: number) => (i > 0 ? 1.05 + i * 0.03 : 1);
    const top = houseBlock(gb, width, depth, floors, rnd, {
      wall: C.wallWarm,
      roof: C.roofDeep,
      jetty: true,
      chimney: false,
    });
    for (let i = 0; i < floors; i++) {
      const front = (depth * lean(i)) / 2 + 0.012;
      for (const sx of [-1, 1]) {
        const x = sx * width * 0.25 * lean(i);
        const y = i * FLOOR + FLOOR * 0.58;
        // Open shutters either side of the glass, and a stone sill.
        for (const side of [-1, 1]) {
          gb.add(cube(), C.wood, [x + side * 0.075, y, front + 0.004], [0, 0, 0], [0.05, 0.1, 0.02]);
          gb.add(cube(), C.woodDark, [x + side * 0.075, y - 0.02, front + 0.014], [0, 0, 0], [0.05, 0.06, 0.012]);
        }
        gb.add(cube(), C.stone, [x, y - 0.06, front + 0.02], [0, 0, 0], [0.12, 0.02, 0.05]);
        // A railed balcony on every floor but the first.
        if (i > 0) {
          gb.add(cube(), C.stoneDark, [x, y - 0.1, front + 0.04], [0, 0, 0], [0.15, 0.02, 0.09]);
          gb.add(cube(), C.iron, [x, y - 0.06, front + 0.08], [0, 0, 0], [0.15, 0.05, 0.008]);
          for (const side of [-1, 0, 1]) {
            gb.add(cube(), C.iron, [x + side * 0.07, y - 0.08, front + 0.08], [0, 0, 0], [0.008, 0.05, 0.008]);
          }
        }
      }
      // Flower boxes on the sills of the middle floors.
      if (i === 1 || i === 3) {
        for (const sx of [-1, 1]) {
          const x = sx * width * 0.25 * lean(i);
          gb.add(blob(), C.leaf, [x, i * FLOOR + 0.06, front + 0.03], [0, rnd() * 3, 0], [0.1, 0.06, 0.06]);
          gb.add(blob(), C.clothWarm, [x + 0.02, i * FLOOR + 0.08, front + 0.04], [0, rnd() * 3, 0], [0.04, 0.03, 0.03]);
        }
      }
    }
    // Laundry lines between the windows, high up under the roof.
    for (let i = 1; i < floors; i++) {
      const y = i * FLOOR + 0.16;
      const z = (depth * lean(i)) / 2 + 0.05;
      gb.add(cube(), C.ink, [0, y, z], [0, 0, 0], [width * 0.9, 0.008, 0.008]);
      const cloths = [[-0.2, C.cloth], [-0.02, C.clothWarm], [0.16, C.cloth]] as const;
      for (const [x, color] of cloths) {
        gb.add(cube(), color, [x, y - 0.07, z], [0, 0, 0], [0.1, 0.12, 0.01]);
      }
    }
    // The shop below: wide window, a striped awning and a hanging sign.
    gb.add(cube(), C.glass, [-0.13, 0.15, depth / 2 + 0.02], [0, 0, 0], [0.22, 0.18, 0.02]);
    gb.add(cube(), C.stone, [-0.13, 0.25, depth / 2 + 0.03], [0, 0, 0], [0.26, 0.03, 0.05]);
    for (let i = 0; i < 5; i++) {
      gb.add(cube(), i % 2 ? C.cloth : C.roof, [-0.24 + i * 0.055, 0.3, depth / 2 + 0.07], [-0.4, 0, 0], [
        0.055, 0.014, 0.17,
      ]);
    }
    gb.add(cube(), C.iron, [0.24, 0.3, depth / 2 + 0.05], [0, 0, 0], [0.012, 0.14, 0.012]);
    gb.add(cube(), C.roofDeep, [0.24, 0.24, depth / 2 + 0.07], [0, 0, 0], [0.1, 0.09, 0.014]);
    gb.light(-0.13, 0.16, depth / 2 + 0.05, 1);
    // Two chimney stacks on the warm roof.
    for (const x of [-0.18, 0.2]) chimney(gb, x, top + 0.06, -0.16);
  },

  palace: (gb, rnd, level) => {
    // A long stone front, four windows a floor, a domed pavilion and a garden gate.
    const floors = Math.max(4, Math.min(level, 5));
    const base = 0.05;
    const bodyH = floors * FLOOR;
    const roofY = base + bodyH;
    // Terrace, steps, gateposts, hedges and the gravel path.
    gb.add(cube(), C.stone, [0, base / 2, 0], [0, 0, 0], [0.96, base, 0.86]);
    for (let i = 0; i < 3; i++) {
      gb.add(cube(), i % 2 === 0 ? C.stone : C.stoneLight, [0, base + 0.015 + i * 0.02, 0.37 - i * 0.05], [0, 0, 0], [
        0.3 - i * 0.03, 0.04, 0.1,
      ]);
    }
    gb.add(quad(), C.path, [0, base + 0.004, 0.45], [0, 0, 0], [0.15, 1, 0.1]);
    for (const sx of [-1, 1]) {
      gb.add(cube(), C.stoneDark, [sx * 0.17, base + 0.08, 0.45], [0, 0, 0], [0.06, 0.16, 0.06]);
      gb.add(blob(), C.leafDeep, [sx * 0.17, base + 0.18, 0.45], [0, rnd() * 3, 0], [0.11, 0.08, 0.11]);
      gb.add(blob(), C.leafDeep, [sx * 0.36, base + 0.09, 0.33], [0, rnd() * 3, 0], [0.2, 0.14, 0.12]);
    }
    // The main block, with a stone band at every floor.
    gb.add(cube(), C.stoneLight, [0, base + bodyH / 2 - 0.02, -0.02], [0, 0, 0], [0.82, bodyH, 0.46]);
    for (let i = 1; i <= floors; i++) {
      gb.add(cube(), C.stone, [0, base + i * FLOOR - 0.014, -0.02], [0, 0, 0], [0.86, 0.024, 0.5]);
    }
    // Quoins down both corners.
    for (let i = 0; i < floors * 2; i++) {
      for (const sx of [-1, 1]) {
        gb.add(cube(), i % 2 ? C.stone : C.stoneDark, [sx * 0.39, base + 0.05 + i * 0.1, 0.19], [0, 0, 0], [0.05, 0.08, 0.03]);
      }
    }
    // Four tall windows a floor; the first floor gets its balcony.
    for (let i = 1; i <= floors; i++) {
      const y = base + i * FLOOR - 0.1;
      for (const sx of [-1, 1]) {
        for (const x of [0.13, 0.27]) {
          windowBox(gb, sx * x, y, 0.215, 0.075, 0.14, i > 1 ? rnd() < 0.5 : true);
          gb.add(cube(), C.stone, [sx * x, y - 0.086, 0.222], [0, 0, 0], [0.1, 0.02, 0.04]);
          if (i === 1) {
            gb.add(cube(), C.stoneDark, [sx * x, y - 0.115, 0.25], [0, 0, 0], [0.12, 0.02, 0.07]);
            gb.add(cube(), C.iron, [sx * x, y - 0.075, 0.282], [0, 0, 0], [0.12, 0.06, 0.008]);
            for (const side of [-1, 0, 1]) {
              gb.add(cube(), C.iron, [sx * x + side * 0.055, y - 0.09, 0.282], [0, 0, 0], [0.008, 0.06, 0.008]);
            }
          }
        }
      }
    }
    // The pavilion: one more floor than the roof, with the portico at the door.
    const pavH = bodyH + 0.28;
    const pavTop = base + pavH;
    gb.add(cube(), C.stoneLight, [0, base + pavH / 2, 0.2], [0, 0, 0], [0.3, pavH, 0.18]);
    for (let i = 1; i <= floors + 1; i++) {
      gb.add(cube(), C.stone, [0, base + i * FLOOR - 0.014, 0.2], [0, 0, 0], [0.34, 0.024, 0.22]);
    }
    doorBox(gb, 0, base + 0.15, 0.29, 0.16, 0.28);
    for (const x of [-0.1, 0.1]) {
      gb.add(post(), C.stoneLight, [x, base + 0.14, 0.31], [0, 0, 0], [0.045, 0.28, 0.045]);
    }
    gb.add(cube(), C.stone, [0, base + 0.29, 0.31], [0, 0, 0], [0.32, 0.04, 0.1]);
    gb.add(cube(), C.iron, [0, base + 0.34, 0.35], [0, 0, 0], [0.28, 0.05, 0.01]);
    gb.light(0, base + 0.32, 0.36, 1.4);
    for (let i = 1; i <= floors; i++) {
      windowBox(gb, 0, base + i * FLOOR - 0.09, 0.295, 0.07, 0.13, i > 1);
    }
    // Slate roofs either side, with dormers and chimneys.
    for (const sx of [-1, 1]) {
      roofAt(gb, sx * 0.23, -0.02, 0.17, 0.25, 0.16, C.slate, roofY);
      for (let i = 0; i < 2; i++) {
        const x = sx * (0.11 + i * 0.15);
        gb.add(cube(), C.wall, [x, roofY + 0.06, 0.13], [0, 0, 0], [0.1, 0.12, 0.1]);
        roofAt(gb, x, 0.13, 0.07, 0.07, 0.08, C.slateDeep, roofY + 0.12);
        gb.add(cube(), C.glass, [x, roofY + 0.07, 0.185], [0, 0, 0], [0.05, 0.06, 0.02]);
      }
      chimney(gb, sx * 0.35, roofY + 0.07, -0.18);
    }
    // Drum, copper dome, lantern, finial and the flag.
    gb.add(cube(), C.stone, [0, pavTop + 0.02, 0.2], [0, 0, 0], [0.38, 0.05, 0.26]);
    gb.add(plate(), C.stoneLight, [0, pavTop + 0.1, 0.2], [0, 0, 0], [0.28, 0.12, 0.22]);
    gb.add(cube(), C.glass, [0, pavTop + 0.1, 0.315], [0, 0, 0], [0.05, 0.07, 0.02]);
    gb.add(cube(), C.glass, [0, pavTop + 0.1, 0.085], [0, 0, 0], [0.05, 0.07, 0.02]);
    for (const sx of [-1, 1]) {
      gb.add(cube(), C.glass, [sx * 0.145, pavTop + 0.1, 0.2], [0, 0, 0], [0.02, 0.07, 0.05]);
    }
    gb.add(dome(), C.copper, [0, pavTop + 0.16, 0.2], [0, 0, 0], [0.42, 0.3, 0.36]);
    gb.add(cube(), C.stoneLight, [0, pavTop + 0.34, 0.2], [0, 0, 0], [0.06, 0.06, 0.06]);
    gb.add(cube(), C.ink, [0, pavTop + 0.42, 0.2], [0, 0, 0], [0.014, 0.1, 0.014]);
    gb.add(blob(), C.lamp, [0, pavTop + 0.44, 0.2], [0, 0, 0], [0.04, 0.04, 0.04]);
    gb.add(panel(), C.roof, [0.1, pavTop + 0.49, 0.2], [0, 0, 0], [0.18, 0.11, 1]);
    gb.light(0, pavTop + 0.18, 0.4, 1.6);
  },

  spire: (gb, rnd, level) => {
    // A slender tower with buttresses and a needle spire.
    const h = 1.1 + (level - 4) * 0.28;
    gb.add(plate(), C.stoneDark, [0, 0.06, 0], [0, 0, 0], [0.58, 0.12, 0.58]);
    gb.add(plate(), C.wall, [0, 0.12 + h / 2, 0], [0, 0, 0], [0.34, h, 0.34]);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      gb.add(cube(), C.stone, [Math.cos(angle) * 0.18, h * 0.3, Math.sin(angle) * 0.18], [0, -angle, 0], [0.09, h * 0.5, 0.09]);
    }
    gb.add(plate(), C.stone, [0, h + 0.1, 0], [0, 0, 0], [0.42, 0.06, 0.42]);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      gb.add(cube(), C.ink, [Math.cos(angle) * 0.16, h + 0.02, Math.sin(angle) * 0.16], [0, -angle, 0], [0.06, 0.12, 0.02]);
    }
    gb.add(cone(), C.slateDeep, [0, h + 0.13, 0], [0, 0, 0], [0.36, 0.62, 0.36]);
    finial(gb, 0, h + 0.68, 0, 0.14, C.cloth);
    gb.add(cube(), C.door, [0, 0.14, 0.18], [0, 0, 0], [0.11, 0.24, 0.03]);
    windowBox(gb, 0, h * 0.6, 0.18, 0.06, 0.12);
    void rnd;
  },

  greattower: (gb, rnd, level) => {
    // The tallest thing the town can raise: a round tower with a beacon.
    const h = 1.5 + (level - 5) * 0.3;
    gb.add(plate(), C.stoneDark, [0, 0.07, 0], [0, 0, 0], [0.66, 0.14, 0.66]);
    gb.add(plate(), C.stone, [0, 0.12 + h / 2, 0], [0, 0, 0], [0.44, h, 0.44]);
    gb.add(plate(), C.stoneLight, [0, h * 0.55, 0], [0, 0, 0], [0.47, 0.05, 0.47]);
    gb.add(plate(), C.stoneDark, [0, h + 0.14, 0], [0, 0, 0], [0.54, 0.06, 0.54]);
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5;
      gb.add(cube(), C.stone, [Math.cos(angle) * 0.22, h + 0.23, Math.sin(angle) * 0.22], [0, -angle, 0], [0.08, 0.1, 0.05]);
    }
    gb.add(cone(), C.slateDeep, [0, h + 0.28, 0], [0, 0, 0], [0.48, 0.5, 0.48]);
    // Beacon fire at the top.
    gb.add(blob(), C.roof, [0, h + 0.78, 0], [0, 0, 0], [0.14, 0.16, 0.14]);
    gb.light(0, h + 0.78, 0, 2.6);
    gb.add(cube(), C.cloth, [0, h * 0.62, 0.235], [0, 0, 0], [0.08, 0.18, 0.008]);
    windowBox(gb, 0, h * 0.35, 0.22, 0.07, 0.12);
    gb.add(cube(), C.door, [0, 0.15, 0.23], [0, 0, 0], [0.12, 0.26, 0.03]);
    void rnd;
  },

  citadel: (gb, rnd, level) => {
    // A castle that has grown a second ring of walls and taller towers.
    builders.keep(gb, rnd, Math.min(level, 5));
    const wallH = 0.5;
    for (const [sx, sz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      gb.add(cube(), C.stoneDark, [sx * 0.42, wallH / 2, sz * 0.42], [0, 0, 0], [sx ? 0.08 : 0.5, wallH, sz ? 0.08 : 0.5]);
      gb.add(cube(), C.stone, [sx * 0.42, wallH + 0.04, sz * 0.42], [0, 0, 0], [sx ? 0.11 : 0.54, 0.06, sz ? 0.11 : 0.54]);
    }
    for (const [sx, sz] of [[-1, -1], [1, 1]] as const) {
      gb.add(plate(), C.stone, [sx * 0.42, 0.4, sz * 0.42], [0, 0, 0], [0.2, 0.8, 0.2]);
      gb.add(cone(), C.slateDeep, [sx * 0.42, 0.8, sz * 0.42], [0, 0, 0], [0.28, 0.3, 0.28]);
    }
    gb.add(cube(), C.ink, [0, 1.5, 0], [0, 0, 0], [0.015, 0.3, 0.015]);
    gb.add(panel(), C.roof, [0.1, 1.6, 0], [0, 0, 0], [0.18, 0.11, 1]);
    gb.light(0, 0.5, 0.3, 1.2);
  },

  library: (gb, rnd, level) => {
    // A civic hall with a portico and a lantern on the roof.
    const floors = Math.min(level, 4);
    houseBlock(gb, 0.7, 0.5, floors, rnd, { wall: C.stoneLight, roof: C.slate, chimney: false, jetty: false });
    for (let i = 0; i < 4; i++) {
      gb.add(post(), C.stoneLight, [-0.24 + i * 0.16, 0.14, 0.33], [0, 0, 0], [0.07, 0.24, 0.07]);
    }
    gb.add(cube(), C.stone, [0, 0.28, 0.33], [0, 0, 0], [0.62, 0.05, 0.16]);
    roof(gb, 0.18, 0.1, 0.1, C.slateDeep, 0.3);
    gb.add(cube(), C.stone, [0, floors * FLOOR + 0.08, 0], [0, 0, 0], [0.2, 0.16, 0.2]);
    gb.add(dome(), C.copper, [0, floors * FLOOR + 0.16, 0], [0, 0, 0], [0.26, 0.22, 0.26]);
    gb.add(cube(), C.ink, [0, floors * FLOOR + 0.3, 0], [0, 0, 0], [0.015, 0.1, 0.015]);
    for (const x of [-0.18, 0.18]) windowBox(gb, x, FLOOR * 0.62, 0.26, 0.1, 0.13);
    gb.add(cube(), C.door, [0, 0.14, 0.27], [0, 0, 0], [0.15, 0.26, 0.03]);
    gb.light(0, 0.3, 0.4, 1.2);
  },

  townhall: (gb, rnd, level) => {
    const floors = Math.min(level, 3);
    houseBlock(gb, 0.68, 0.5, floors, rnd, { wall: C.stoneLight, roof: C.slate, chimney: false });
    // A portico of four columns, and the town flag.
    gb.add(cube(), C.stone, [0, 0.04, 0.32], [0, 0, 0], [0.66, 0.08, 0.18]);
    for (const x of [-0.24, -0.08, 0.08, 0.24]) {
      gb.add(post(), C.stoneLight, [x, 0.18, 0.36], [0, 0, 0], [0.07, 0.28, 0.07]);
    }
    gb.add(cube(), C.stone, [0, 0.33, 0.34], [0, 0, 0], [0.62, 0.06, 0.2]);
    roof(gb, 0.2, 0.14, 0.14, C.slateDeep, 0.36);
    gb.add(cube(), C.ink, [0, 0.6, 0.16], [0, 0, 0], [0.015, 0.24, 0.015]);
    gb.add(panel(), C.roof, [0.08, 0.7, 0.16], [0, 0, 0], [0.16, 0.1, 1]);
    for (const x of [-0.18, 0.18]) windowBox(gb, x, FLOOR * 0.7, 0.26, 0.09, 0.11);
    gb.add(cube(), C.door, [0, 0.14, 0.27], [0, 0, 0], [0.16, 0.26, 0.03]);
    gb.light(0, 0.24, 0.4, 1.1);
  },

  garden: (gb, rnd) => {
    // A small walled garden: hedges, flower beds, a bird bath and a bench.
    gb.add(quad(), C.leafLight, [0, 0.004, 0], [0, 0, 0], [0.94, 1, 0.94]);
    for (const [x, z, w, d] of [[0, -0.41, 0.9, 0.08], [0, 0.41, 0.9, 0.08], [-0.41, 0, 0.08, 0.74], [0.41, 0, 0.08, 0.74]] as const) {
      gb.add(cube(), C.leafDeep, [x, 0.05, z], [0, 0, 0], [w, 0.1, d]);
      gb.add(cube(), C.leaf, [x, 0.105, z], [0, 0, 0], [w * 0.94, 0.02, d * 0.94]);
    }
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]] as const) {
      gb.add(cube(), C.soil, [x, 0.014, z], [0, 0, 0], [0.26, 0.024, 0.26]);
      for (let i = 0; i < 3; i++) {
        gb.add(blob(), [C.clothWarm, C.lamp, C.cloth][i % 3], [x + (rnd() - 0.5) * 0.18, 0.06, z + (rnd() - 0.5) * 0.18], [0, 0, 0], [0.045, 0.04, 0.045]);
      }
    }
    gb.add(quad(), C.path, [0, 0.008, 0], [0, 0, 0], [0.14, 1, 0.8]);
    gb.add(quad(), C.path, [0, 0.009, 0], [0, Math.PI / 2, 0], [0.14, 1, 0.8]);
    gb.add(plate(), C.stone, [0, 0.06, 0], [0, 0, 0], [0.15, 0.08, 0.15]);
    gb.add(quad(), C.water, [0, 0.1, 0], [0, 0, 0], [0.11, 1, 0.11]);
    bench(gb, 0.26, -0.26, -0.5);
    // A dovecote on a pole, so the garden has something tall.
    gb.add(cube(), C.woodDark, [0.06, 0.3, -0.32], [0, 0, 0], [0.02, 0.6, 0.02]);
    gb.add(cube(), C.wood, [0.06, 0.5, -0.32], [0, 0, 0], [0.16, 0.02, 0.02]);
    gb.add(cube(), C.cloth, [0.06, 0.6, -0.32], [0, 0, 0], [0.1, 0.14, 0.1]);
    roofAt(gb, 0.06, -0.32, 0.08, 0.08, 0.1, C.roof, 0.67);
    gb.add(cube(), C.ink, [0.06, 0.58, -0.26], [0, 0, 0], [0.03, 0.03, 0.02]);
  },

  park: (gb, rnd) => {
    // Bigger garden: pond, walks, three trees and benches.
    gb.add(quad(), C.leafLight, [0, 0.004, 0], [0, 0, 0], [0.96, 1, 0.96]);
    gb.add(quad(), C.path, [0, 0.008, 0.14], [0, 0, 0], [0.94, 1, 0.13]);
    gb.add(quad(), C.path, [0.14, 0.008, 0], [0, Math.PI / 2, 0], [0.11, 1, 0.92]);
    gb.add(plate(), C.stone, [-0.22, 0.02, -0.24], [0, 0, 0], [0.44, 0.04, 0.36]);
    gb.add(quad(), C.water, [-0.22, 0.045, -0.24], [0, 0, 0], [0.36, 1, 0.28]);
    for (let i = 0; i < 3; i++) {
      gb.add(blob(), C.leafDeep, [-0.32 + i * 0.1, 0.06, -0.3 + i * 0.05], [0, 0, 0], [0.07, 0.05, 0.07]);
    }
    grownTree(gb, 0.26, 0.3, 3, rnd);
    grownTree(gb, -0.3, 0.3, 2, rnd);
    tree(gb, 0.32, -0.22, 0.55, rnd);
    bench(gb, -0.12, 0.06, 0.3);
    bench(gb, 0.06, -0.06, -1.2);
    lamp(gb, -0.36, 0.04);
    lamp(gb, 0.34, 0.16);
    // Ducks on the pond.
    gb.add(blob(), C.cloth, [-0.16, 0.07, -0.2], [0, 0, 0], [0.05, 0.04, 0.05]);
    gb.add(cube(), C.clothWarm, [-0.13, 0.08, -0.2], [0, 0, 0], [0.03, 0.03, 0.02]);
  },

  greenhouse: (gb, rnd) => {
    // A glasshouse: stone base, iron frame, glazed roof and plants inside.
    gb.add(cube(), C.stone, [0, 0.03, 0], [0, 0, 0], [0.78, 0.06, 0.62]);
    const w = 0.7;
    const d = 0.54;
    const h = 0.34;
    gb.add(cube(), C.glass, [0, 0.06 + h / 2, 0], [0, 0, 0], [w, h, d]);
    for (let i = 0; i < 5; i++) {
      const x = -w / 2 + (i * w) / 4;
      gb.add(cube(), C.stoneLight, [x, 0.06 + h / 2, d / 2 + 0.008], [0, 0, 0], [0.022, h, 0.022]);
      gb.add(cube(), C.stoneLight, [x, 0.06 + h / 2, -d / 2 - 0.008], [0, 0, 0], [0.022, h, 0.022]);
    }
    gb.add(cube(), C.stoneLight, [0, 0.06 + h, 0], [0, 0, 0], [w + 0.02, 0.03, d + 0.02]);
    roofAt(gb, 0, 0, w / 2, d / 2, 0.2, C.glass, 0.09 + h);
    for (let i = 0; i < 4; i++) {
      gb.add(blob(), i % 2 ? C.leaf : C.leafDeep, [-0.24 + i * 0.16, 0.12, 0.05], [0, rnd() * 3, 0], [0.12, 0.11, 0.12]);
    }
    for (const [x, z] of [[-0.28, -0.18], [0.28, -0.18]] as const) {
      gb.add(cube(), C.wood, [x, 0.11, z], [0, 0, 0], [0.12, 0.1, 0.12]);
      gb.add(blob(), C.leafLight, [x, 0.2, z], [0, 0, 0], [0.13, 0.12, 0.13]);
    }
    gb.add(cube(), C.copper, [0.3, 0.5, -0.24], [0, 0, 0], [0.05, 0.18, 0.05]);
    gb.add(blob(), C.leafDeep, [0.3, 0.4, -0.24], [0, 0, 0], [0.05, 0.06, 0.05]);
    gb.light(0, 0.24, 0.3, 1.1);
  },

  maze: (gb, rnd) => {
    // A hedge maze with a little pavilion in the middle.
    gb.add(quad(), C.leafLight, [0, 0.004, 0], [0, 0, 0], [0.96, 1, 0.96]);
    const hedge = (x: number, z: number, w: number, d: number, h = 0.2) => {
      gb.add(cube(), C.leafDeep, [x, h / 2, z], [0, 0, 0], [w, h, d]);
      gb.add(cube(), C.leaf, [x, h + 0.01, z], [0, 0, 0], [w * 0.9, 0.02, d * 0.9]);
    };
    hedge(0, -0.42, 0.86, 0.08);
    hedge(-0.3, 0.42, 0.26, 0.08);
    hedge(0.3, 0.42, 0.26, 0.08);
    hedge(-0.42, 0, 0.08, 0.76);
    hedge(0.42, -0.22, 0.08, 0.4);
    hedge(0.42, 0.28, 0.08, 0.28);
    hedge(-0.12, -0.14, 0.52, 0.08);
    hedge(-0.2, 0.12, 0.36, 0.08);
    hedge(0.18, 0.12, 0.14, 0.08);
    hedge(0.12, -0.14, 0.08, 0.3);
    hedge(-0.24, 0.14, 0.08, 0.22);
    hedge(-0.02, 0.26, 0.34, 0.08);
    // Centre: a small pavilion on a stone drum.
    gb.add(plate(), C.stone, [0, 0.05, 0.02], [0, 0, 0], [0.18, 0.1, 0.18]);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      gb.add(post(), C.stoneLight, [Math.cos(angle) * 0.07, 0.16, 0.02 + Math.sin(angle) * 0.07], [0, 0, 0], [0.026, 0.16, 0.026]);
    }
    gb.add(cone(), C.slate, [0, 0.24, 0.02], [0, 0, 0], [0.2, 0.12, 0.2]);
    gb.add(cube(), C.lamp, [0, 0.16, 0.02], [0, 0, 0], [0.04, 0.05, 0.04]);
    gb.light(0, 0.18, 0.06, 0.9);
    for (let i = 0; i < 6; i++) {
      gb.add(blob(), C.clothWarm, [(rnd() - 0.5) * 0.7, 0.04, (rnd() - 0.5) * 0.7], [0, 0, 0], [0.025, 0.025, 0.025]);
    }
  },

  arboretum: (gb, rnd) => {
    // The great garden: specimen trees, a ring walk and an obelisk.
    gb.add(quad(), C.leafLight, [0, 0.004, 0], [0, 0, 0], [0.98, 1, 0.98]);
    gb.add(quad(), C.path, [0, 0.008, 0], [0, 0, 0], [0.98, 1, 0.12]);
    gb.add(quad(), C.path, [0, 0.009, 0], [0, Math.PI / 2, 0], [0.98, 1, 0.12]);
    gb.add(plate(), C.path, [0, 0.01, 0], [0, 0, 0], [0.5, 0.02, 0.5]);
    grownTree(gb, -0.27, -0.27, 4, rnd);
    grownTree(gb, 0.28, -0.24, 3, rnd);
    grownTree(gb, 0.26, 0.3, 2, rnd);
    grownTree(gb, -0.3, 0.28, 3, rnd);
    gb.add(plate(), C.stone, [0, 0.05, 0], [0, 0, 0], [0.16, 0.1, 0.16]);
    gb.add(cube(), C.stoneLight, [0, 0.26, 0], [0, 0, 0], [0.07, 0.32, 0.07]);
    gb.add(pyramid(), C.stoneLight, [0, 0.42, 0], [0, 0, 0], [0.06, 0.12, 0.06]);
    gb.add(cube(), C.lamp, [0, 0.56, 0], [0, 0, 0], [0.03, 0.03, 0.03]);
    gb.light(0, 0.56, 0, 0.9);
    for (const [x, z] of [[-0.14, -0.06], [0.14, 0.06]] as const) {
      gb.add(blob(), C.leafDeep, [x, 0.06, z], [0, 0, 0], [0.12, 0.1, 0.1]);
    }
    for (let i = 0; i < 8; i++) {
      gb.add(blob(), [C.clothWarm, C.lamp, C.cloth][i % 3], [-0.4 + i * 0.11, 0.04, 0.06], [0, 0, 0], [0.022, 0.022, 0.022]);
    }
  },

  wall: (gb, rnd) => {
    // A stone wall round the plot, with a gate in the front.
    wallSeg(gb, 0, -0.42, 0.9, 0.09, 0.2);
    wallSeg(gb, -0.3, 0.42, 0.3, 0.09, 0.2);
    wallSeg(gb, 0.3, 0.42, 0.3, 0.09, 0.2);
    wallSeg(gb, -0.42, 0, 0.09, 0.84, 0.2);
    wallSeg(gb, 0.42, 0, 0.09, 0.84, 0.2);
    for (const sx of [-1, 1]) {
      gb.add(cube(), C.stoneLight, [sx * 0.13, 0.2, 0.42], [0, 0, 0], [0.1, 0.4, 0.12]);
      gb.add(cube(), C.stone, [sx * 0.13, 0.41, 0.42], [0, 0, 0], [0.13, 0.03, 0.15]);
      gb.add(cube(), C.lamp, [sx * 0.13, 0.45, 0.42], [0, 0, 0], [0.045, 0.05, 0.045]);
      gb.light(sx * 0.13, 0.45, 0.48, 0.8);
    }
    // Ivy on the stones, and a little garden plot inside.
    for (let i = 0; i < 3; i++) {
      gb.add(blob(), C.leafDeep, [-0.3 + i * 0.3, 0.07, 0.16], [0, rnd() * 3, 0], [0.1, 0.09, 0.08]);
    }
    gb.add(cube(), C.soil, [-0.14, 0.012, -0.16], [0, 0, 0], [0.32, 0.022, 0.26]);
    for (let i = 0; i < 5; i++) {
      gb.add(blob(), [C.leaf, C.leafLight, C.clothWarm][i % 3], [-0.26 + i * 0.06, 0.05, -0.2 + (i % 2) * 0.09], [0, 0, 0], [0.04, 0.035, 0.04]);
    }
    gb.add(cube(), C.wood, [0.2, 0.12, -0.18], [0, 0.3, 0], [0.14, 0.03, 0.1]);
    gb.add(cube(), C.woodDark, [0.2, 0.06, -0.18], [0, 0.3, 0], [0.12, 0.05, 0.05]);
  },

  rampart: (gb, rnd) => {
    // A proper rampart: adarve, merlons and a stair.
    const h = 0.42;
    wallSeg(gb, 0, -0.42, 0.9, 0.16, h);
    wallSeg(gb, -0.3, 0.42, 0.3, 0.16, h);
    wallSeg(gb, 0.3, 0.42, 0.3, 0.16, h);
    wallSeg(gb, -0.42, 0, 0.16, 0.8, h);
    wallSeg(gb, 0.42, 0, 0.16, 0.8, h);
    merlons(gb, 0, -0.42, 0.86, 0.2, h + 0.03, 5);
    merlons(gb, -0.42, 0, 0.2, 0.8, h + 0.03, 4);
    merlons(gb, 0.42, 0, 0.2, 0.8, h + 0.03, 4);
    for (const sx of [-1, 1]) {
      gb.add(cube(), C.stoneLight, [sx * 0.13, 0.26, 0.42], [0, 0, 0], [0.12, 0.52, 0.2]);
      gb.add(cube(), C.stone, [sx * 0.13, 0.54, 0.42], [0, 0, 0], [0.15, 0.04, 0.23]);
      gb.add(cube(), C.ink, [sx * 0.13, 0.34, 0.53], [0, 0, 0], [0.04, 0.1, 0.02]);
      gb.light(sx * 0.13, 0.5, 0.5, 0.7);
    }
    for (let i = 0; i < 4; i++) {
      gb.add(cube(), C.stoneDark, [-0.33, 0.05 + i * 0.09, 0.2 - i * 0.07], [0, 0, 0], [0.18, 0.05, 0.08]);
    }
    gb.add(cube(), C.wood, [0.18, 0.06, 0.2], [0, rnd() * 0.4, 0], [0.12, 0.12, 0.12]);
  },

  bastion: (gb, rnd) => {
    // The rampart grows a round tower at the corner.
    builders.rampart(gb, rnd, 2);
    roundTower(gb, 0.3, -0.28, 0.16, 0.56);
    gb.add(cone(), C.slate, [0.3, 0.66, -0.28], [0, 0, 0], [0.26, 0.2, 0.26]);
    gb.add(cube(), C.ink, [0.3, 0.9, -0.28], [0, 0, 0], [0.014, 0.1, 0.014]);
    gb.add(panel(), C.roof, [0.38, 0.96, -0.28], [0, 0, 0], [0.16, 0.09, 1]);
    gb.light(0.3, 0.84, -0.18, 0.8);
  },

  fortress: (gb, _rnd) => {
    // Two towers, a gatehouse and a banner.
    const h = 0.5;
    wallSeg(gb, 0, -0.42, 0.9, 0.16, h);
    wallSeg(gb, -0.32, 0.42, 0.26, 0.16, h);
    wallSeg(gb, 0.32, 0.42, 0.26, 0.16, h);
    wallSeg(gb, -0.42, 0, 0.16, 0.8, h);
    wallSeg(gb, 0.42, 0, 0.16, 0.8, h);
    merlons(gb, 0, -0.42, 0.86, 0.2, h + 0.03, 5);
    roundTower(gb, -0.32, -0.3, 0.16, 0.66);
    roundTower(gb, 0.32, -0.3, 0.16, 0.66);
    for (const sx of [-1, 1]) {
      gb.add(cube(), C.stoneLight, [sx * 0.13, 0.3, 0.42], [0, 0, 0], [0.12, 0.6, 0.2]);
      gb.add(cube(), C.stone, [sx * 0.13, 0.62, 0.42], [0, 0, 0], [0.15, 0.04, 0.23]);
      gb.add(cube(), C.woodDark, [sx * 0.07, 0.3, 0.53], [0, 0, 0], [0.025, 0.5, 0.02]);
    }
    gb.add(cube(), C.iron, [0, 0.3, 0.5], [0, 0, 0], [0.22, 0.5, 0.02]);
    gb.add(cube(), C.stone, [0, 0.58, 0.47], [0, 0, 0], [0.3, 0.1, 0.1]);
    for (const sx of [-1, 1]) gb.add(cone(), C.slateDeep, [sx * 0.32, 0.62, -0.3], [0, 0, 0], [0.26, 0.22, 0.26]);
    gb.add(cube(), C.ink, [0, 0.7, 0.2], [0, 0, 0], [0.014, 0.3, 0.014]);
    gb.add(panel(), C.roof, [0.08, 0.82, 0.2], [0, 0, 0], [0.16, 0.1, 1]);
    gb.light(0, 0.34, 0.55, 1.2);
  },

  alcazar: (gb, _rnd) => {
    // The full castle: keep, towers, banners and a bridge over the gate.
    builders.fortress(gb, _rnd, 4);
    gb.add(cube(), C.stoneLight, [0, 0.28, -0.02], [0, 0, 0], [0.3, 0.56, 0.3]);
    gb.add(cube(), C.stone, [0, 0.57, -0.02], [0, 0, 0], [0.34, 0.04, 0.34]);
    merlons(gb, 0, -0.02, 0.34, 0.34, 0.61, 4);
    gb.add(cone(), C.slateDeep, [0, 0.6, -0.02], [0, 0, 0], [0.3, 0.26, 0.3]);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      gb.add(cube(), C.ink, [Math.cos(angle) * 0.14, 0.3, -0.02 + Math.sin(angle) * 0.14], [0, -angle, 0], [0.03, 0.08, 0.02]);
    }
    for (const [x, z] of [[-0.42, 0.42], [0.42, 0.42]] as const) {
      roundTower(gb, x, z, 0.13, 0.5);
      gb.add(cone(), C.slateDeep, [x, 0.54, z], [0, 0, 0], [0.22, 0.18, 0.22]);
    }
    for (const sx of [-1, 1]) {
      gb.add(cube(), C.ink, [sx * 0.2, 0.72, 0.3], [0, 0, 0], [0.012, 0.22, 0.012]);
      gb.add(panel(), C.roof, [sx * 0.26, 0.74, 0.33], [0, 0, 0], [0.12, 0.16, 1]);
    }
    for (let i = 0; i < 3; i++) gb.add(cube(), C.wood, [0, 0.03 + i * 0.02, 0.56], [0, 0, 0], [0.22, 0.02, 0.12]);
    gb.light(0, 0.5, -0.02, 1.4);
    gb.light(-0.42, 0.5, 0.42, 0.8);
    gb.light(0.42, 0.5, 0.42, 0.8);
  },

  parterre: (gb, rnd) => {
    // A formal garden for the square: clipped hedges, beds, a fountain, urns.
    gb.add(quad(), C.path, [0, 0.004, 0], [0, 0, 0], [0.94, 1, 0.94]);
    for (const [x, z, w, d] of [[0, -0.4, 0.7, 0.07], [0, 0.4, 0.7, 0.07], [-0.4, 0, 0.07, 0.7], [0.4, 0, 0.07, 0.7]] as const) {
      gb.add(cube(), C.leafDeep, [x, 0.05, z], [0, 0, 0], [w, 0.1, d]);
    }
    for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]] as const) {
      gb.add(cube(), C.soil, [x, 0.012, z], [0, 0, 0], [0.24, 0.02, 0.24]);
      for (let i = 0; i < 4; i++) {
        gb.add(blob(), i % 2 ? C.clothWarm : C.lamp, [x + (rnd() - 0.5) * 0.16, 0.045, z + (rnd() - 0.5) * 0.16], [0, 0, 0], [0.035, 0.03, 0.035]);
      }
    }
    // Central fountain: octagonal basin, water, pedestal and a small figure.
    gb.add(plate(), C.stone, [0, 0.06, 0], [0, 0, 0], [0.34, 0.1, 0.34]);
    gb.add(plate(), C.stoneLight, [0, 0.11, 0], [0, 0, 0], [0.3, 0.03, 0.3]);
    gb.add(quad(), C.water, [0, 0.115, 0], [0, 0, 0], [0.22, 1, 0.22]);
    gb.add(post(), C.stone, [0, 0.18, 0], [0, 0, 0], [0.07, 0.18, 0.07]);
    gb.add(plate(), C.stoneLight, [0, 0.28, 0], [0, 0, 0], [0.1, 0.02, 0.1]);
    gb.add(blob(), C.stoneLight, [0, 0.33, 0], [0, 0, 0], [0.08, 0.1, 0.06]);
    gb.add(cube(), C.stoneLight, [0.05, 0.36, 0], [0, 0, 0.5], [0.12, 0.02, 0.02]);
    gb.add(cone(), C.water, [0, 0.3, 0], [0, 0, 0], [0.06, 0.1, 0.06]);
    gb.light(0, 0.2, 0.1, 1);
    // Urns on stone plinths at the corners.
    for (const [x, z] of [[-0.32, 0], [0.32, 0], [0, -0.32], [0, 0.32]] as const) {
      gb.add(cube(), C.stoneDark, [x, 0.09, z], [0, 0, 0], [0.08, 0.18, 0.08]);
      gb.add(plate(), C.stoneLight, [x, 0.2, z], [0, 0, 0], [0.1, 0.06, 0.08]);
      gb.add(blob(), C.leaf, [x, 0.24, z], [0, rnd() * 3, 0], [0.11, 0.07, 0.1]);
    }
  },

  gatehouse: (gb, rnd) => {
    // A wall with a proper gate: two round towers, an arch and a portcullis.
    const h = 0.46;
    wallSeg(gb, 0, -0.42, 0.9, 0.14, h);
    wallSeg(gb, -0.42, 0, 0.14, 0.8, h);
    wallSeg(gb, 0.42, 0, 0.14, 0.8, h);
    merlons(gb, 0, -0.42, 0.86, 0.18, h + 0.03, 5);
    merlons(gb, -0.42, 0, 0.18, 0.8, h + 0.03, 4);
    merlons(gb, 0.42, 0, 0.18, 0.8, h + 0.03, 4);
    roundTower(gb, -0.28, 0.36, 0.13, 0.56);
    roundTower(gb, 0.28, 0.36, 0.13, 0.56);
    // Arch over the gate, with a stone lintel and a portcullis.
    gb.add(cube(), C.stoneLight, [0, 0.3, 0.4], [0, 0, 0], [0.4, 0.14, 0.1]);
    gb.add(cube(), C.stone, [0, 0.38, 0.4], [0, 0, 0], [0.46, 0.05, 0.14]);
    gb.add(cube(), C.door, [0, 0.15, 0.42], [0, 0, 0], [0.16, 0.28, 0.03]);
    for (let i = -2; i <= 2; i++) {
      gb.add(cube(), C.iron, [i * 0.035, 0.29, 0.44], [0, 0, 0], [0.008, 0.14, 0.008]);
    }
    // Banners and torch light.
    for (const sx of [-1, 1]) {
      gb.add(cube(), C.ink, [sx * 0.28, 0.82, 0.36], [0, 0, 0], [0.012, 0.2, 0.012]);
      gb.add(panel(), C.roof, [sx * 0.34, 0.84, 0.36], [0, 0, 0], [0.11, 0.14, 1]);
      gb.add(cube(), C.lamp, [sx * 0.17, 0.3, 0.46], [0, 0, 0], [0.04, 0.05, 0.04]);
      gb.light(sx * 0.17, 0.3, 0.5, 0.9);
    }
    gb.add(cube(), C.wood, [0.22, 0.06, 0.12], [0, rnd() * 0.4, 0], [0.12, 0.12, 0.12]);
  },

  vineyard: (gb, rnd) => {
    // Rows of vines, a pergola and the barrels of the year's wine.
    gb.add(cube(), C.soil, [0, 0.012, 0], [0, 0, 0], [0.92, 0.024, 0.92]);
    for (let row = 0; row < 4; row++) {
      const z = -0.27 + row * 0.18;
      gb.add(cube(), C.woodDark, [0, 0.09, z], [0, 0, 0], [0.78, 0.018, 0.018]);
      for (let i = 0; i < 5; i++) {
        const x = -0.36 + i * 0.18;
        gb.add(post(), C.wood, [x, 0.16, z], [0, 0, 0], [0.018, 0.32, 0.018]);
        gb.add(blob(), C.leafDeep, [x, 0.22, z], [0, rnd() * 3, 0], [0.12, 0.11, 0.1]);
        if (rnd() < 0.7) {
          gb.add(blob(), C.leaf, [x + (rnd() - 0.5) * 0.06, 0.26, z + (rnd() - 0.5) * 0.04], [0, rnd() * 3, 0], [0.09, 0.08, 0.08]);
        }
        if (rnd() < 0.4) gb.add(blob(), C.clothWarm, [x, 0.26, z + 0.03], [0, 0, 0], [0.03, 0.03, 0.03]);
      }
    }
    // Pergola at the back with vines over it.
    for (const sx of [-1, 1]) {
      gb.add(post(), C.wood, [sx * 0.3, 0.16, -0.38], [0, 0, 0], [0.03, 0.32, 0.03]);
    }
    gb.add(cube(), C.wood, [0, 0.32, -0.38], [0, 0, 0], [0.68, 0.025, 0.03]);
    for (let i = 0; i < 4; i++) {
      gb.add(blob(), i % 2 ? C.leaf : C.leafDeep, [-0.24 + i * 0.16, 0.34, -0.38], [0, rnd() * 3, 0], [0.15, 0.07, 0.1]);
    }
    for (const [x, z] of [[0.3, 0.3], [0.38, 0.24]] as const) {
      gb.add(plate(), C.wood, [x, 0.08, z], [0, 0, 0], [0.09, 0.14, 0.09]);
      gb.add(plate(), C.ink, [x, 0.08, z], [0, 0, 0], [0.095, 0.02, 0.095]);
    }
    gb.add(cube(), C.wood, [-0.3, 0.08, 0.32], [0, 0, 0], [0.1, 0.14, 0.06]);
    gb.light(0, 0.2, 0.2, 0.8);
  },


  watergarden: (gb, rnd) => {
    // A garden on the shore: pond, lily pads, reeds and a little landing.
    gb.add(quad(), C.leafLight, [0, 0.004, 0], [0, 0, 0], [0.94, 1, 0.94]);
    gb.add(plate(), C.stone, [0.02, 0.02, 0.02], [0, 0, 0], [0.62, 0.04, 0.58]);
    gb.add(quad(), C.water, [0.02, 0.045, 0.02], [0, 0, 0], [0.54, 1, 0.5]);
    for (let i = 0; i < 5; i++) {
      const x = -0.16 + rnd() * 0.36;
      const z = -0.14 + rnd() * 0.32;
      gb.add(plate(), C.leaf, [x, 0.052, z], [0, rnd() * 3, 0], [0.09, 0.012, 0.08]);
      if (rnd() < 0.5) gb.add(blob(), C.cloth, [x + 0.02, 0.06, z], [0, 0, 0], [0.02, 0.02, 0.02]);
    }
    // Reeds along the water's edge.
    for (let i = 0; i < 6; i++) {
      const x = -0.3 + i * 0.11;
      gb.add(post(), C.leafDeep, [x, 0.1, -0.3], [0, 0, 0.05 * (i % 2 ? 1 : -1)], [0.018, 0.2, 0.018]);
      gb.add(cone(), C.leafDeep, [x, 0.17, -0.3], [0, 0, 0], [0.04, 0.08, 0.04]);
    }
    // A small wooden landing at one corner.
    gb.add(cube(), C.wood, [0.28, 0.055, 0.26], [0, 0, 0], [0.22, 0.03, 0.14]);
    for (const x of [0.2, 0.36]) gb.add(post(), C.woodDark, [x, 0.02, 0.32], [0, 0, 0], [0.04, 0.16, 0.04]);
    // Beds and a bench under a willow.
    for (const [x, z] of [[-0.3, 0.3], [0.3, -0.3]] as const) {
      gb.add(cube(), C.soil, [x, 0.012, z], [0, 0, 0], [0.2, 0.02, 0.2]);
      for (let i = 0; i < 3; i++) {
        gb.add(blob(), i % 2 ? C.clothWarm : C.lamp, [x + (rnd() - 0.5) * 0.14, 0.045, z + (rnd() - 0.5) * 0.14], [0, 0, 0], [0.032, 0.028, 0.032]);
      }
    }
    bench(gb, -0.24, 0.18, 0.4);
    grownTree(gb, -0.26, -0.28, 3, rnd);
    gb.light(0.24, 0.12, 0.3, 0.8);
  },

  stable: (gb, rnd) => {
    // A long low stable with a fenced yard, hay, trough and a pale horse.
    gb.add(cube(), C.stoneDark, [0, 0.02, -0.04], [0, 0, 0], [0.82, 0.04, 0.66]);
    gb.add(cube(), C.wood, [0, 0.25, -0.14], [0, 0, 0], [0.68, 0.42, 0.38]);
    for (let i = 0; i < 6; i++) {
      gb.add(cube(), C.woodDark, [-0.28 + i * 0.11, 0.25, 0.045], [0, 0, 0], [0.016, 0.42, 0.02]);
    }
    roofAt(gb, 0, -0.14, 0.4, 0.24, 0.18, C.thatch, 0.46);
    gb.add(cube(), C.door, [0.16, 0.16, 0.05], [0, 0, 0], [0.18, 0.27, 0.03]);
    gb.add(cube(), C.woodDark, [0.16, 0.16, 0.075], [0, 0, 0], [0.02, 0.27, 0.012]);
    gb.add(cube(), C.glass, [0.16, 0.37, 0.05], [0, 0, 0], [0.09, 0.08, 0.02]);
    gb.add(cube(), C.wood, [0.16, 0.32, 0.06], [0, 0, 0], [0.15, 0.02, 0.03]);
    // Hay on the right of the door, trough beyond it.
    for (const [x, z, h] of [[0.28, 0.3, 0.08], [0.34, 0.33, 0.08], [0.31, 0.31, 0.17]] as const) {
      gb.add(cube(), C.thatch, [x, h, z], [0, rnd() * 0.4, 0], [0.12, 0.1, 0.11]);
    }
    gb.add(cube(), C.stone, [-0.3, 0.06, 0.24], [0, 0, 0], [0.2, 0.08, 0.09]);
    gb.add(quad(), C.water, [-0.3, 0.103, 0.24], [0, 0, 0], [0.17, 1, 0.06]);
    // Fence along the yard.
    for (const x of [-0.38, -0.06, 0.3]) {
      gb.add(post(), C.woodDark, [x, 0.1, 0.45], [0, 0, 0], [0.026, 0.2, 0.026]);
    }
    gb.add(cube(), C.wood, [-0.04, 0.16, 0.45], [0, 0, 0], [0.74, 0.02, 0.026]);
    // The horse stands on the left, pale against the dark wood.
    const horse = 0xe0d3bb;
    gb.add(blob(), horse, [-0.06, 0.25, 0.26], [0, 0.25, 0], [0.3, 0.15, 0.13]);
    gb.add(cube(), horse, [0.11, 0.33, 0.24], [0, 0, -0.42], [0.078, 0.17, 0.085]);
    gb.add(blob(), horse, [0.17, 0.42, 0.24], [0, 0, 0], [0.11, 0.085, 0.075]);
    gb.add(cone(), 0x6b6560, [0.14, 0.49, 0.24], [0, 0, 0], [0.035, 0.055, 0.03]);
    gb.add(cone(), 0x6b5140, [0.19, 0.36, 0.24], [0, 0, 0], [0.028, 0.04, 0.028]);
    for (const [x, z] of [[-0.16, 0.22], [-0.16, 0.3], [0.05, 0.22], [0.05, 0.3]] as const) {
      gb.add(post(), 0xb8a68a, [x, 0.14, z], [0, 0, 0], [0.028, 0.28, 0.028]);
    }
    gb.add(post(), 0x6b5140, [-0.21, 0.25, 0.26], [0, 0, 0.55], [0.026, 0.16, 0.026]);
    gb.add(cube(), 0x6b5140, [-0.27, 0.34, 0.26], [0, 0, 0.3], [0.06, 0.1, 0.05]);
    gb.light(0.16, 0.37, 0.09, 0.8);
  },
};

export function buildRole(role: Role, level: number, gb: GeoBuilder, rnd: () => number): void {
  builders[role](gb, rnd, level);
}

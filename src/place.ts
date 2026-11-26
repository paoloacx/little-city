/**
 * A real place, read from OpenStreetMap and laid on our grid.
 *
 * The plot is a square of `size` metres around a point; each of the fifteen by
 * fifteen cells looks at what OpenStreetMap has there — water, a building, a
 * green, a road — and decides which block to place and whether the cell is land
 * at all. Nothing is drawn here: this module only turns the map into a mask and
 * a list of blocks, which is exactly what the town and the island expect.
 */

import { GRID, HALF, BlockKind } from './grid';

export interface PlaceBlock {
  x: number;
  z: number;
  kind: BlockKind;
  level: number;
  rot: number;
}

export interface Place {
  name: string;
  lat: number;
  lon: number;
  size: number;
  /** Land or water, row by row, southwards. */
  mask: boolean[][];
  blocks: PlaceBlock[];
  /** "© OpenStreetMap contributors": ODbL asks for it wherever the data is shown. */
  credit: string;
}

export interface PlaceHit {
  name: string;
  lat: number;
  lon: number;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
/**
 * Three Overpass mirrors: the main one is often at capacity, and the others
 * answer the same query. The first that answers wins.
 */
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/** How wide the net is: 400 m is about ten streets across. */
export const DEFAULT_SIZE = 400;

const METRES_PER_DEGREE = 111320;

interface Point {
  lat: number;
  lon: number;
}

interface Way {
  tags: Record<string, string>;
  points: Point[];
}

/* ------------------------------------------------------------------ search */

/** Looks a place up by name, the way the search box on the map does. */
export async function searchPlace(query: string): Promise<PlaceHit[]> {
  const url = `${NOMINATIM}?format=jsonv2&limit=6&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`El buscador no contesta (${response.status})`);
  const rows = (await response.json()) as Array<{ display_name: string; lat: string; lon: string; name?: string }>;
  return rows.map((row) => ({
    name: row.name?.trim() || row.display_name.split(',')[0].trim(),
    lat: Number(row.lat),
    lon: Number(row.lon),
  }));
}

/* ------------------------------------------------------------------- fetch */

/** A query that is small enough for the public servers to answer quickly. */
function overpassQuery(box: string): string {
  return `[out:json][timeout:25];(
way["building"](${box});
way["highway"](${box});
way["natural"~"^(water|coastline|wood)$"](${box});
way["waterway"~"^(river|canal|riverbank)$"](${box});
way["landuse"~"^(forest|grass|meadow|farmland|orchard|vineyard)$"](${box});
way["leisure"~"^(park|garden|playground)$"](${box});
way["place"="square"](${box});
way["man_made"="pier"](${box});
);out geom;`;
}

/** Asks the mirrors in turn, with a deadline, until one of them answers. */
async function overpass(
  body: string,
  note: (message: string) => void,
): Promise<{
  elements?: Array<{ type: string; tags?: Record<string, string>; geometry?: Point[] }>;
}> {
  let last = 'sin respuesta';
  // The public servers answer "at capacity" when they are busy; their own advice
  // is to wait and ask again, so we do: two rounds over the mirrors.
  for (let round = 0; round < 2; round++) {
    for (const endpoint of OVERPASS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 14000);
      try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
        if (!response.ok) {
          last = response.status === 429 || response.status === 504 ? 'el mapa está a tope' : `el mapa contestó ${response.status}`;
          continue;
        }
        return (await response.json()) as {
          elements?: Array<{ type: string; tags?: Record<string, string>; geometry?: Point[] }>;
        };
      } catch (error) {
        last = controller.signal.aborted ? 'el mapa tardó demasiado' : 'no se pudo llegar al mapa';
        void error;
      } finally {
        clearTimeout(timer);
      }
    }
    if (round === 0) {
      note('El mapa está a tope; espero y lo intento otra vez…');
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
  }
  throw new Error(`El mapa de OpenStreetMap no contestó (${last}). Prueba otra vez en un minuto.`);
}

/** Everything OpenStreetMap draws inside the square, with its geometry. */
async function fetchWays(lat: number, lon: number, size: number, note: (message: string) => void): Promise<Way[]> {
  const latSpan = size / 2 / METRES_PER_DEGREE;
  const lonSpan = latSpan / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const south = lat - latSpan;
  const north = lat + latSpan;
  const west = lon - lonSpan;
  const east = lon + lonSpan;
  const box = `${south.toFixed(6)},${west.toFixed(6)},${north.toFixed(6)},${east.toFixed(6)}`;
  const data = await overpass(`data=${encodeURIComponent(overpassQuery(box))}`, note);
  const ways: Way[] = [];
  for (const element of data.elements ?? []) {
    if (element.type !== 'way' || !element.geometry || element.geometry.length < 2) continue;
    ways.push({ tags: element.tags ?? {}, points: element.geometry });
  }
  return ways;
}

/* --------------------------------------------------------------- geometry */

const metresX = (lon: number, lon0: number, lat0: number): number =>
  (lon - lon0) * METRES_PER_DEGREE * Math.cos((lat0 * Math.PI) / 180);
const metresZ = (lat: number, lat0: number): number => -(lat - lat0) * METRES_PER_DEGREE;

/** Ray casting: is the point inside the ring? */
function inside(polygon: Array<[number, number]>, x: number, z: number): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

/** Distance from a point to a polyline, in metres. */
function distanceToLine(line: Array<[number, number]>, x: number, z: number): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1];
    const [bx, bz] = line[i];
    const dx = bx - ax;
    const dz = bz - az;
    const length = dx * dx + dz * dz;
    const t = length > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length)) : 0;
    const px = ax + dx * t;
    const pz = az + dz * t;
    best = Math.min(best, Math.hypot(x - px, z - pz));
  }
  return best;
}

/** Which quarter turn best matches the long side of a footprint. */
function turnOf(polygon: Array<[number, number]>): number {
  let best = 0;
  let longest = 0;
  for (let i = 1; i < polygon.length; i++) {
    const dx = polygon[i][0] - polygon[i - 1][0];
    const dz = polygon[i][1] - polygon[i - 1][1];
    const length = Math.hypot(dx, dz);
    if (length > longest) {
      longest = length;
      best = Math.atan2(dz, dx);
    }
  }
  const quarter = Math.round(((best / (Math.PI / 2)) % 4 + 4) % 4);
  return quarter % 4;
}

/* ------------------------------------------------------------ the place */

/**
 * Turns the square around a point into a mask and a town. One block per cell:
 * the water, the buildings, the greens and the roads decide which.
 */
export async function loadPlace(
  lat: number,
  lon: number,
  size = DEFAULT_SIZE,
  name = '',
  note: (message: string) => void = () => {},
): Promise<Place> {
  const cached = readCache(lat, lon, size);
  if (cached) {
    note('Este sitio ya estaba en el mapa: lo saco de la copia guardada.');
    return { ...cached, name: name || cached.name };
  }
  const ways = await fetchWays(lat, lon, size, note);
  const cell = size / GRID;
  const project = (point: Point): [number, number] => [metresX(point.lon, lon, lat), metresZ(point.lat, lat)];

  const water: Array<Array<[number, number]>> = [];
  const waterLines: Array<Array<[number, number]>> = [];
  const coast: Array<Array<[number, number]>> = [];
  const buildings: Array<{ ring: Array<[number, number]>; level: number; turn: number }> = [];
  const greens: Array<{ ring: Array<[number, number]>; kind: BlockKind }> = [];
  const roads: Array<Array<[number, number]>> = [];
  const squares: Array<Array<[number, number]>> = [];
  const piers: Array<Array<[number, number]>> = [];

  for (const way of ways) {
    const tags = way.tags;
    const line = way.points.map(project);
    const closed = line.length > 3 && line[0][0] === line[line.length - 1][0] && line[0][1] === line[line.length - 1][1];

    if (tags.building) {
      const levels = Number(tags['building:levels'] ?? 0) || Math.max(1, Math.round(Number(tags.height ?? 0) / 3.2)) || 1;
      buildings.push({ ring: line, level: Math.max(1, Math.min(3, Math.round(levels))), turn: turnOf(line) });
      continue;
    }
    if (tags.natural === 'coastline') {
      coast.push(line);
      continue;
    }
    if (tags.natural === 'water' || tags.waterway === 'riverbank') {
      if (closed) water.push(line);
      continue;
    }
    if (tags.waterway === 'river' || tags.waterway === 'canal') {
      waterLines.push(line);
      continue;
    }
    if (tags.man_made === 'pier') {
      piers.push(line);
      continue;
    }
    if (tags.place === 'square') {
      squares.push(line);
      continue;
    }
    if (tags.landuse === 'farmland' || tags.landuse === 'orchard' || tags.landuse === 'vineyard') {
      greens.push({ ring: line, kind: 'field' });
      continue;
    }
    if (
      tags.leisure === 'park' ||
      tags.leisure === 'garden' ||
      tags.leisure === 'playground' ||
      tags.natural === 'wood' ||
      tags.landuse === 'forest' ||
      tags.landuse === 'grass' ||
      tags.landuse === 'meadow'
    ) {
      greens.push({ ring: line, kind: 'tree' });
      continue;
    }
    if (tags.highway) {
      roads.push(line);
    }
  }

  const mask: boolean[][] = [];
  const blocks: PlaceBlock[] = [];
  for (let z = 0; z < GRID; z++) {
    const row: boolean[] = [];
    for (let x = 0; x < GRID; x++) {
      const px = (x - HALF) * cell;
      const pz = (z - HALF) * cell;
      let land = true;

      // Water: a lake or a river, and the sea behind a coastline.
      if (water.some((ring) => inside(ring, px, pz))) land = false;
      if (land && waterLines.some((line) => distanceToLine(line, px, pz) < cell * 0.45)) land = false;
      if (land) {
        for (const line of coast) {
          if (distanceToLine(line, px, pz) > cell * 1.6) continue;
          // OpenStreetMap keeps the water on the right of the coastline.
          let side = 0;
          for (let i = 1; i < line.length; i++) {
            const [ax, az] = line[i - 1];
            const [bx, bz] = line[i];
            const cross = (bx - ax) * (pz - az) - (bz - az) * (px - ax);
            if (Math.abs(cross) > 0.001) {
              side = cross;
              break;
            }
          }
          if (side < 0) land = false;
        }
      }

      row.push(land);
      if (!land) continue;

      const building = buildings.find((candidate) => inside(candidate.ring, px, pz));
      if (building) {
        blocks.push({ x, z, kind: 'house', level: building.level, rot: building.turn });
        continue;
      }
      if (piers.some((ring) => inside(ring, px, pz))) {
        blocks.push({ x, z, kind: 'dock', level: 1, rot: 0 });
        continue;
      }
      if (squares.some((ring) => inside(ring, px, pz))) {
        blocks.push({ x, z, kind: 'plaza', level: 1, rot: 0 });
        continue;
      }
      const green = greens.find((candidate) => inside(candidate.ring, px, pz));
      if (green) {
        blocks.push({ x, z, kind: green.kind, level: green.kind === 'tree' ? 2 : 1, rot: 0 });
        continue;
      }
      if (roads.some((line) => distanceToLine(line, px, pz) < cell * 0.55)) {
        blocks.push({ x, z, kind: 'path', level: 1, rot: 0 });
      }
    }
    mask.push(row);
  }

  // Second pass: where the map has no building but a street runs past, the game
  // lays a plot. The streets and the water are the real ones; the houses that
  // nobody has mapped are the game's, so a barrio is playable on the first click.
  const taken = new Set(blocks.map((block) => `${block.x},${block.z}`));
  const random = campaign(lat, lon);
  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      if (!mask[z][x] || taken.has(`${x},${z}`)) continue;
      const px = (x - HALF) * cell;
      const pz = (z - HALF) * cell;
      let nearest = Infinity;
      let turn = 0;
      for (const line of roads) {
        const distance = distanceToLine(line, px, pz);
        if (distance >= nearest) continue;
        nearest = distance;
        turn = nearestTurn(line, px, pz);
      }
      if (nearest > cell * 1.1) continue;
      if (random() > 0.62) continue;
      const level = random() < 0.16 ? 3 : random() < 0.55 ? 2 : 1;
      blocks.push({ x, z, kind: 'house', level, rot: turn });
    }
  }

  return { name, lat, lon, size, mask, blocks, credit: '© OpenStreetMap contributors' };
}

/** Which quarter turn matches the road that runs closest to this cell. */
function nearestTurn(line: Array<[number, number]>, x: number, z: number): number {
  let best = Infinity;
  let angle = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1];
    const [bx, bz] = line[i];
    const dx = bx - ax;
    const dz = bz - az;
    const length = dx * dx + dz * dz;
    const t = length > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length)) : 0;
    const distance = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (distance < best) {
      best = distance;
      angle = Math.atan2(dz, dx);
    }
  }
  return Math.round(((angle / (Math.PI / 2)) % 4 + 4) % 4) % 4;
}

/** A repeatable stream of random numbers for one place. */
function campaign(lat: number, lon: number): () => number {
  let a = seedOf(lat, lon);
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

const PLACE_KEY = 'ciudad-pequena.place.v1';

/**
 * The last place is kept in the browser: a link to a barrio opens even when the
 * map servers are down, which they are, often.
 */
export function readCache(lat: number, lon: number, size: number): Place | null {
  try {
    const raw = localStorage.getItem(PLACE_KEY);
    if (!raw) return null;
    const place = JSON.parse(raw) as Place;
    const near = Math.abs(place.lat - lat) < 0.0004 && Math.abs(place.lon - lon) < 0.0004;
    if (!near || place.size !== size) return null;
    return place;
  } catch {
    return null;
  }
}

/** The last place drawn in this browser, whatever its coordinates are. */
export function readAnyCache(): Place | null {
  try {
    const raw = localStorage.getItem(PLACE_KEY);
    return raw ? (JSON.parse(raw) as Place) : null;
  } catch {
    return null;
  }
}

export function writeCache(place: Place): void {
  try {
    localStorage.setItem(PLACE_KEY, JSON.stringify(place));
  } catch {
    /* A full storage must not stop the town from being drawn. */
  }
}

/** A stable seed for a place, so its island keeps its own plants and gulls. */
export function seedOf(lat: number, lon: number): number {
  return ((Math.round(lat * 1e5) * 73856093) ^ (Math.round(lon * 1e5) * 19349663) ^ 0x5f3759df) >>> 0;
}

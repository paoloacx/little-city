/**
 * The four seasons. Each one gives the trees, the fields and the lawn its own
 * palette and asks for its own weather, so the same town looks like a different
 * place four times a year.
 *
 * Everything here is a plain table: no assets, no textures, four tones per
 * season. The buildings read the active season through `getSeason()` and
 * `scene.ts` rebuilds the island with its grass mixed towards `grass[0]`.
 */

export type SeasonId = 'primavera' | 'verano' | 'otono' | 'invierno';

export type Weather = 'petal' | 'none' | 'leaf' | 'snow';

export interface Season {
  id: SeasonId;
  label: string;
  /** One line for the toast when the season turns. */
  note: string;
  /** Leaf, deep leaf and light leaf: the crown, the shadow and the sunlit top. */
  leaf: [number, number, number];
  /** Hedges and lawns that are drawn in the leaf tones. */
  lawn: [number, number, number];
  /** Crop rows and stubble. */
  crop: [number, number];
  /** The grass of the island is mixed towards this colour, by this much. */
  grass: [number, number];
  /** Deciduous trees drop their leaves: bare branches with a little snow. */
  bare: boolean;
  weather: Weather;
  /** The colour of the falling thing. */
  flake: number;
}

export const SEASONS: Season[] = [
  {
    id: 'primavera',
    label: 'Primavera',
    note: 'Primavera: los árboles en flor y el trigo tierno',
    leaf: [0x9cc46c, 0x7cae55, 0xbad88c],
    lawn: [0xa8cf86, 0x8ab86a, 0xc0dd9c],
    crop: [0xa9cb72, 0x8db25c],
    grass: [0xa4cd7c, 0.22],
    bare: false,
    weather: 'petal',
    flake: 0xf2bfcb,
  },
  {
    id: 'verano',
    label: 'Verano',
    note: 'Verano: el trigo alto y la siesta a la sombra',
    leaf: [0x8db46a, 0x6f9a52, 0xa8c47d],
    lawn: [0x9dbb78, 0x7e9d63, 0xb6cd8f],
    crop: [0xd6c276, 0xb7a15c],
    grass: [0x9dc06f, 0],
    bare: false,
    weather: 'none',
    flake: 0xffffff,
  },
  {
    id: 'otono',
    label: 'Otoño',
    note: 'Otoño: hojas de cobre y el rastrojo segado',
    leaf: [0xc98b46, 0x9c642f, 0xdfac60],
    lawn: [0xb9a86c, 0x9c8a54, 0xcdbc80],
    crop: [0xc7a86a, 0xa2864f],
    grass: [0xb7a566, 0.2],
    bare: false,
    weather: 'leaf',
    flake: 0xc4863c,
  },
  {
    id: 'invierno',
    label: 'Invierno',
    note: 'Invierno: los árboles desnudos y la nieve en el suelo',
    leaf: [0x74836a, 0x50694f, 0x93a086],
    lawn: [0xdde2e6, 0xc3cdd4, 0xf1f4f6],
    crop: [0xc2bfa8, 0xa5a390],
    grass: [0xe9eef2, 0.82],
    bare: true,
    weather: 'snow',
    flake: 0xffffff,
  },
];

const BY_ID = new Map<SeasonId, Season>(SEASONS.map((season) => [season.id, season]));

let current: Season = SEASONS[1];

export function getSeason(): Season {
  return current;
}

export function seasonById(id: string | null | undefined): Season | null {
  if (!id) return null;
  return BY_ID.get(id as SeasonId) ?? null;
}

/** The next season round the year, starting from the current one. */
export function nextSeason(): Season {
  const at = SEASONS.indexOf(current);
  return SEASONS[(at + 1) % SEASONS.length];
}

export function setSeason(season: Season): void {
  current = season;
}

/** The season that matches the month, so a first visit lands somewhere sensible. */
export function seasonForMonth(month: number): Season {
  return SEASONS[Math.floor(month / 3) % SEASONS.length];
}

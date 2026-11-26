/**
 * The rules. Each block is read together with its neighbourhood and its height,
 * and the first rule that matches decides what it becomes. This is what makes
 * placing blocks feel like a puzzle instead of a paint job.
 */

import { BlockKind, GRID, LINK_E, LINK_N, LINK_S, LINK_W, key, landAt, isShore, Town } from './grid';

export type Role =
  | 'house' | 'townhouse' | 'manor' | 'chapel' | 'cathedral' | 'shop' | 'cottage' | 'barn'
  | 'lighthouse' | 'stall' | 'inn' | 'boathouse' | 'schoolhouse' | 'smithy' | 'warehouse' | 'townhall'
  | 'tenement' | 'palace' | 'spire' | 'greattower' | 'citadel' | 'library' | 'greatoak'
  | 'villa' | 'fisherhouse' | 'towerhouse' | 'millhouse'
  | 'tower' | 'belltower' | 'watchtower' | 'keep' | 'clocktower' | 'observatory' | 'dovecote'
  | 'windmill' | 'watermill'
  | 'street' | 'quay' | 'bridge'
  | 'plaza' | 'square' | 'theatre' | 'bandstand'
  | 'tree' | 'orchard'
  | 'garden' | 'park' | 'greenhouse' | 'maze' | 'arboretum' | 'parterre' | 'watergarden'
  | 'mirador'
  | 'wall' | 'rampart' | 'bastion' | 'fortress' | 'alcazar' | 'gatehouse'
  | 'aqueduct' | 'battery' | 'orchardwall'
  | 'vineyard' | 'stable'
  | 'wheat' | 'rice' | 'olivar' | 'meadow'
  | 'tidemill' | 'sawmill' | 'postmill'
  | 'fishmarket' | 'shipyard' | 'cargodock' | 'saltpans'
  | 'wallwalk' | 'avenue'
  | 'willow' | 'olive' | 'hedge' | 'summitpine'
  | 'porticada' | 'market'
  | 'rockgarden' | 'rosaleda' | 'botanico'
  | 'bakery' | 'apothecary' | 'bathhouse' | 'pottery' | 'weaver' | 'dairy'
  | 'bodega' | 'icehouse' | 'lodge' | 'monastery' | 'barracks' | 'courthouse'
  | 'press' | 'hospice' | 'guildhall'
  | 'horreo' | 'albarrana' | 'signal' | 'ermita' | 'concejo' | 'twintower' | 'vigia'
  | 'dock' | 'field';

export interface RoleDef {
  label: string;
  /** A discovery: it counts towards the finds panel. */
  special: boolean;
  how: string;
}

export const ROLES: Record<Role, RoleDef> = {
  house: { label: 'Casa', special: false, how: 'Una casa sola, con su puerta y su ventana.' },
  townhouse: { label: 'Casa alta', special: true, how: 'Una casa con un piso más (dos clics en la casilla).' },
  manor: { label: 'Casona', special: true, how: 'Una casa de tres pisos (tres clics en la casilla).' },
  chapel: { label: 'Capilla', special: true, how: 'Una casa pegada a una torre.' },
  cathedral: { label: 'Catedral', special: true, how: 'Una casa de dos o tres pisos junto a una torre.' },
  shop: { label: 'Tienda', special: true, how: 'Una casa abierta a dos calles.' },
  cottage: { label: 'Casa de campo', special: true, how: 'Una casa entre dos o más árboles.' },
  barn: { label: 'Granero', special: true, how: 'Una casa junto a un campo.' },
  lighthouse: { label: 'Faro', special: true, how: 'Una torre en la orilla. Más alta, si la subes.' },
  stall: { label: 'Puesto de mercado', special: true, how: 'Una casa entre la plaza y el camino.' },
  boathouse: { label: 'Casa de botes', special: true, how: 'Una casa junto a un embarcadero.' },
  inn: { label: 'Posada', special: true, how: 'Una casa en el rincón de la plaza, con dos calles.' },
  schoolhouse: { label: 'Escuela', special: true, how: 'Una casa junto a la plaza, con dos casas alrededor.' },
  smithy: { label: 'Herrería', special: true, how: 'Una casa junto a un campo y un camino.' },
  warehouse: { label: 'Almacén', special: true, how: 'Una casa entre dos embarcaderos.' },
  townhall: { label: 'Ayuntamiento', special: true, how: 'Una casa alta junto a la plaza, con una calle.' },
  tenement: { label: 'Casa de vecindad', special: true, how: 'Una casa de cuatro pisos.' },
  villa: { label: 'Casa solariega', special: true, how: 'Una casa baja junto a un jardín, con verja y parra.' },
  fisherhouse: { label: 'Casa de pescadores', special: true, how: 'Una casa baja en la orilla, lejos del embarcadero.' },
  towerhouse: { label: 'Casa torre', special: true, how: 'Una casa baja entre dos torres, con escalera de caracol.' },
  millhouse: { label: 'Casa del molinero', special: true, how: 'Una casa baja junto a un molino, con sacos y polea.' },
  palace: { label: 'Palacio', special: true, how: 'Una casa de cinco pisos, con su cimborrio.' },
  spire: { label: 'Aguja', special: true, how: 'Una torre de cuatro pisos junto a las casas.' },
  greattower: { label: 'Torre maestra', special: true, how: 'Una torre de cinco pisos.' },
  citadel: { label: 'Ciudadela', special: true, how: 'Un castillo con una torre de cuatro pisos o más.' },
  library: { label: 'Biblioteca', special: true, how: 'Una casa alta junto a la plaza, con casas alrededor.' },
  greatoak: { label: 'Roble', special: true, how: 'El gran roble: sigue creciendo en el cuarto y el quinto clic.' },
  tower: { label: 'Torre', special: false, how: 'Una torre sola.' },
  belltower: { label: 'Campanario', special: true, how: 'Una torre con un piso más.' },
  watchtower: { label: 'Atalaya', special: true, how: 'Una torre de tres pisos.' },
  keep: { label: 'Castillo', special: true, how: 'Tres torres juntas. Si las subes, crece.' },
  clocktower: { label: 'Torre del reloj', special: true, how: 'Una torre con dos calles y una casa cerca.' },
  observatory: { label: 'Observatorio', special: true, how: 'Una torre junto a la plaza.' },
  dovecote: { label: 'Palomar', special: true, how: 'Una torre entre dos árboles.' },
  windmill: { label: 'Molino', special: false, how: 'Un molino con sus aspas.' },
  watermill: { label: 'Molino de agua', special: true, how: 'Un molino junto al agua.' },
  street: { label: 'Calle', special: false, how: 'Un camino, con sus farolas.' },
  quay: { label: 'Muelle de piedra', special: true, how: 'Un camino que toca el agua.' },
  bridge: { label: 'Puente', special: true, how: 'Un camino puesto sobre el agua.' },
  plaza: { label: 'Plaza', special: false, how: 'Un suelo empedrado.' },
  square: { label: 'Plaza con fuente', special: true, how: 'Cuatro plazas juntas.' },
  theatre: { label: 'Teatro', special: true, how: 'Una plaza junto a una torre.' },
  bandstand: { label: 'Templete', special: true, how: 'Una plaza entre tres árboles o más.' },
  tree: { label: 'Árbol', special: false, how: 'Un árbol: cada clic lo hace más alto y más ancho.' },
  orchard: { label: 'Huerto', special: true, how: 'Cuatro árboles juntos.' },
  dock: { label: 'Embarcadero', special: false, how: 'Un muelle de tablas, en tierra o sobre el agua.' },
  field: { label: 'Campo', special: false, how: 'Un campo arado.' },
  garden: { label: 'Jardín', special: false, how: 'Un jardín con sus setos, sus flores y su pajarera.' },
  mirador: { label: 'Mirador', special: true, how: 'Un jardín en lo alto (dos escalones o más): balaustrada y vistas.' },
  park: { label: 'Parque', special: true, how: 'Un jardín de dos clics: árboles, bancos y un estanque.' },
  greenhouse: { label: 'Invernadero', special: true, how: 'Un jardín de tres clics, con cristaleras.' },
  maze: { label: 'Laberinto', special: true, how: 'Un jardín de cuatro clics: setos en laberinto.' },
  arboretum: { label: 'Arboreto', special: true, how: 'Un jardín de cinco clics, con árboles de todo el mundo.' },
  wall: { label: 'Tapia', special: false, how: 'Una tapia de piedra con su puerta.' },
  rampart: { label: 'Muralla', special: true, how: 'Una tapia de dos clics, con adarve y almenas.' },
  bastion: { label: 'Torreón', special: true, how: 'Una muralla de tres clics, con torre redonda.' },
  fortress: { label: 'Fortaleza', special: true, how: 'Una muralla de cuatro clics, con dos torres y puerta.' },
  alcazar: { label: 'Alcázar', special: true, how: 'Una muralla de cinco clics: el alcázar del pueblo.' },
  parterre: { label: 'Jardín de la plaza', special: true, how: 'Un jardín junto a la plaza, con fuente y setos recortados.' },
  watergarden: { label: 'Jardín de agua', special: true, how: 'Un jardín en la orilla, con estanque, nenúfares y embarcadero.' },
  gatehouse: { label: 'Puerta de la muralla', special: true, how: 'Una muralla de dos o tres clics junto a una torre.' },
  vineyard: { label: 'Viñedo', special: true, how: 'Un campo junto a un jardín, con sus parras.' },
  stable: { label: 'Cuadra', special: true, how: 'Una casa entre dos campos, con caballos.' },
  bakery: { label: 'Panadería', special: true, how: 'Una casa de un piso en una esquina con tres casas alrededor: horno y panes.' },
  apothecary: { label: 'Botica', special: true, how: 'Una casa de un piso rodeada de casas y sin calle: botica con su letrero.' },
  bathhouse: { label: 'Casa de baños', special: true, how: 'Una casa de dos pisos en la orilla: cúpula, vapor y su piscina.' },
  pottery: { label: 'Alfarería', special: true, how: 'Una casa de un piso en la orilla, junto a un embarcadero: horno y cacharros.' },
  weaver: { label: 'Telar', special: true, how: 'Una casa de dos pisos entre cuatro casas o más: telares y paños al sol.' },
  dairy: { label: 'Quesería', special: true, how: 'Una casa de un piso con dos casas al lado y un árbol: lecheras y quesos.' },
  bodega: { label: 'Bodega', special: true, how: 'Una casa de un piso en alto, con una casa al lado: cubas y parra.' },
  icehouse: { label: 'Nevera', special: true, how: 'Una casa de un piso a la sombra de un edificio alto, con un árbol: pozo de hielo.' },
  lodge: { label: 'Pabellón de caza', special: true, how: 'Una casa de un piso sola, con un árbol al lado: pabellón de caza.' },
  monastery: { label: 'Monasterio', special: true, how: 'Una casa de dos pisos junto a una torre en diagonal: claustro y campanilla.' },
  barracks: { label: 'Cuartel', special: true, how: 'Una casa de dos pisos pegada a dos murallas: cuartel con bandera.' },
  courthouse: { label: 'Audiencia', special: true, how: 'Una casa de tres pisos junto a una muralla: columnas y frontón.' },
  press: { label: 'Imprenta', special: true, how: 'Una casa de dos pisos en llano, con calle y tres casas alrededor: prensa de tornillo.' },
  hospice: { label: 'Hospital', special: true, how: 'Una casa de un piso entre cuatro casas o más: hospital con su cruz.' },
  guildhall: { label: 'Lonja de gremios', special: true, how: 'Una casa de tres pisos entre tres casas, sin plaza: lonja de gremios.' },
  horreo: { label: 'Hórreo', special: true, how: 'Una torre de un piso junto a un campo: granero sobre cuatro pies.' },
  albarrana: { label: 'Torre albarrana', special: true, how: 'Una torre de tres pisos o menos pegada a una muralla.' },
  signal: { label: 'Torre de señales', special: true, how: 'Una torre baja junto a un embarcadero: mástil de señales.' },
  ermita: { label: 'Ermita', special: true, how: 'Una torre de un piso entre tres árboles o más.' },
  concejo: { label: 'Torre del concejo', special: true, how: 'Una torre de dos pisos con tres plazas alrededor: balcón y pendón.' },
  twintower: { label: 'Torres gemelas', special: true, how: 'Una torre de dos pisos o menos con otra torre al lado.' },
  vigia: { label: 'Torre vigía', special: true, how: 'Una torre de tres pisos o menos en lo alto (dos escalones de terreno).' },
  porticada: { label: 'Plaza porticada', special: true, how: 'Una plaza con dos calles: soportales en dos lados.' },
  market: { label: 'Mercadillo', special: true, how: 'Una plaza con tres casas alrededor: puestos de toldo.' },
  rockgarden: { label: 'Rocalla', special: true, how: 'Un jardín en alto (un escalón): peñas y plantas de montaña.' },
  rosaleda: { label: 'Rosaleda', special: true, how: 'Un jardín de un piso con calle y dos casas al lado: rosas y arcos.' },
  botanico: { label: 'Jardín botánico', special: true, how: 'Un jardín de dos pisos junto a otro jardín: parterres con cartel.' },
  wheat: { label: 'Trigal', special: true, how: 'Un campo junto a otro campo: espigas y gavillas.' },
  rice: { label: 'Arrozal', special: true, how: 'Un campo en la orilla: eras inundadas.' },
  olivar: { label: 'Olivar', special: true, how: 'Un campo subido dos clics: olivos en hilera.' },
  meadow: { label: 'Prado', special: true, how: 'Un campo entre dos árboles o más: hierba, flores y un pajar.' },
  tidemill: { label: 'Molino de marea', special: true, how: 'Un molino en la orilla, junto a un embarcadero: rueda en el agua.' },
  sawmill: { label: 'Aserradero', special: true, how: 'Un molino entre dos árboles o más: sierra y troncos.' },
  postmill: { label: 'Molino de monte', special: true, how: 'Un molino en alto (un escalón de terreno), con su cola y sus aspas.' },
  fishmarket: { label: 'Lonja de pescado', special: true, how: 'Un embarcadero junto a una plaza: pescado y cajas.' },
  shipyard: { label: 'Astillero', special: true, how: 'Un embarcadero junto a un árbol y una casa: cuaderna a medio hacer.' },
  cargodock: { label: 'Muelle de carga', special: true, how: 'Un embarcadero de dos clics: grúa y cajas.' },
  saltpans: { label: 'Salinas', special: true, how: 'Un embarcadero junto a un campo: eras de sal.' },
  wallwalk: { label: 'Camino de ronda', special: true, how: 'Un camino junto a una muralla.' },
  avenue: { label: 'Paseo arbolado', special: true, how: 'Un camino entre dos árboles o más: hilera, bancos y farolas.' },
  willow: { label: 'Sauce llorón', special: true, how: 'Un árbol en la orilla del agua.' },
  olive: { label: 'Olivo', special: true, how: 'Un árbol junto a un campo.' },
  hedge: { label: 'Seto', special: true, how: 'Un árbol entre tres casas o más: seto recortado.' },
  summitpine: { label: 'Pino de cumbre', special: true, how: 'Un árbol en lo alto (dos escalones de terreno).' },
  aqueduct: { label: 'Acueducto', special: true, how: 'Una muralla de tres clics con un camino al lado: arcos de agua.' },
  battery: { label: 'Batería de costa', special: true, how: 'Una muralla de dos pisos o menos en la orilla: cañones al agua.' },
  orchardwall: { label: 'Cerca del huerto', special: true, how: 'Una muralla de un piso junto a un jardín: espalderas.' },
};

const ALL_ROLES = Object.keys(ROLES) as Role[];

export const SPECIAL_ROLES: Role[] = ALL_ROLES.filter((r) => ROLES[r].special);

export const SPECIAL_COUNT = SPECIAL_ROLES.length;

const BASE_ROLE: Record<BlockKind, Role> = {
  house: 'house',
  tower: 'tower',
  path: 'street',
  tree: 'tree',
  plaza: 'plaza',
  dock: 'dock',
  mill: 'windmill',
  field: 'field',
  garden: 'garden',
  wall: 'wall',
};

type NeighbourCounts = Record<BlockKind, number>;

const emptyCounts = (): NeighbourCounts => ({
  house: 0, tower: 0, path: 0, tree: 0, plaza: 0, dock: 0, mill: 0, field: 0, garden: 0, wall: 0,
});

export interface Facts {
  x: number;
  z: number;
  block: BlockKind;
  /** How many times the tile was built up: 1, 2 or 3. */
  level: number;
  /** The tile itself is land (a path can also be laid over water). */
  land: boolean;
  /** Touches water. */
  shore: boolean;
  /** Steps of ground under the cell: 0 low, 1 a terrace, 2 or 3 up a hill. */
  ground: number;
  /** The tallest neighbour, and how many neighbours are three storeys or more. */
  top: number;
  tall: number;
  /** The eight neighbours. */
  around: NeighbourCounts;
  /** The four neighbours. */
  side: NeighbourCounts;
}

export interface Rule {
  id: string;
  role: Role;
  when: (f: Facts) => boolean;
}

/** Ordered: the most specific rule wins. */
export const RULES: Rule[] = [
  // Gardens and walls: they grow on their own, click by click.
  // A garden up a hill is a mirador: the terrace is the thing you built.
  { id: 'R-G07', role: 'mirador', when: (f) => f.block === 'garden' && f.ground >= 2 },
  { id: 'R-G08', role: 'rockgarden', when: (f) => f.block === 'garden' && f.ground >= 1 },
  { id: 'R-G06', role: 'watergarden', when: (f) => f.block === 'garden' && f.shore && f.level <= 2 },
  { id: 'R-G05', role: 'parterre', when: (f) => f.block === 'garden' && f.side.plaza >= 1 && f.level <= 2 },
  { id: 'R-G04', role: 'arboretum', when: (f) => f.block === 'garden' && f.level >= 5 },
  { id: 'R-G03', role: 'maze', when: (f) => f.block === 'garden' && f.level >= 4 },
  { id: 'R-G02', role: 'greenhouse', when: (f) => f.block === 'garden' && f.level >= 3 },
  { id: 'R-G10', role: 'botanico', when: (f) => f.block === 'garden' && f.level === 2 && f.around.garden >= 1 },
  { id: 'R-G09', role: 'rosaleda', when: (f) => f.block === 'garden' && f.level === 1 && f.side.path >= 1 && f.around.house >= 2 },
  { id: 'R-G01', role: 'park', when: (f) => f.block === 'garden' && f.level >= 2 },
  { id: 'R-W04', role: 'alcazar', when: (f) => f.block === 'wall' && f.level >= 5 },
  { id: 'R-W03', role: 'fortress', when: (f) => f.block === 'wall' && f.level >= 4 },
  { id: 'R-W08', role: 'aqueduct', when: (f) => f.block === 'wall' && f.level === 3 && f.around.path >= 1 },
  { id: 'R-W07', role: 'battery', when: (f) => f.block === 'wall' && f.shore && f.level <= 2 },
  { id: 'R-W06', role: 'orchardwall', when: (f) => f.block === 'wall' && f.level === 1 && f.around.garden >= 1 },
  { id: 'R-W02', role: 'bastion', when: (f) => f.block === 'wall' && f.level >= 3 && f.around.tower === 0 },
  { id: 'R-W05', role: 'gatehouse', when: (f) => f.block === 'wall' && f.around.tower >= 1 && f.level >= 2 && f.level <= 3 },
  { id: 'R-W01', role: 'rampart', when: (f) => f.block === 'wall' && f.level >= 2 },
  // Towers next: the tallest things in town.
  {
    id: 'R-M04',
    role: 'citadel',
    when: (f) => f.block === 'tower' && f.side.tower >= 2 && (f.level >= 4 || f.top >= 4),
  },
  { id: 'R-M03', role: 'keep', when: (f) => f.block === 'tower' && f.side.tower >= 2 },
  { id: 'R-T11', role: 'signal', when: (f) => f.block === 'tower' && f.level <= 2 && f.around.dock >= 1 },
  { id: 'R-L01', role: 'lighthouse', when: (f) => f.block === 'tower' && f.shore },
  { id: 'R-T15', role: 'concejo', when: (f) => f.block === 'tower' && f.level === 2 && f.around.plaza >= 3 },
  { id: 'R-T14', role: 'ermita', when: (f) => f.block === 'tower' && f.level === 1 && f.around.tree >= 3 },
  { id: 'R-T13', role: 'albarrana', when: (f) => f.block === 'tower' && f.level <= 3 && f.around.wall >= 1 },
  { id: 'R-T12', role: 'horreo', when: (f) => f.block === 'tower' && f.level === 1 && f.around.field >= 1 },
  { id: 'R-T10', role: 'twintower', when: (f) => f.block === 'tower' && f.level <= 2 && f.side.tower === 1 },
  { id: 'R-T06', role: 'vigia', when: (f) => f.block === 'tower' && f.level <= 3 && f.ground >= 2 },
  { id: 'R-T04', role: 'observatory', when: (f) => f.block === 'tower' && f.around.plaza >= 1 },
  { id: 'R-T05', role: 'dovecote', when: (f) => f.block === 'tower' && f.around.tree >= 2 },
  {
    id: 'R-T03',
    role: 'clocktower',
    when: (f) => f.block === 'tower' && f.side.path >= 2 && f.around.house >= 1,
  },
  { id: 'R-T09', role: 'greattower', when: (f) => f.block === 'tower' && f.level >= 5 },
  { id: 'R-T08', role: 'spire', when: (f) => f.block === 'tower' && f.level >= 4 && f.around.house >= 1 },
  { id: 'R-T07', role: 'watchtower', when: (f) => f.block === 'tower' && f.level >= 3 },
  { id: 'R-T02', role: 'belltower', when: (f) => f.block === 'tower' && f.level >= 2 },

  // A house hemmed in by towers grows a turret of its own.
  { id: 'R-H25', role: 'towerhouse', when: (f) => f.block === 'house' && f.level <= 2 && f.around.tower >= 2 },

  // Trades with a sign of their own: they read the neighbours and the ground,
  // never the height alone, so the plain house keeps its ladder.
  { id: 'R-H51', role: 'hospice', when: (f) => f.block === 'house' && f.level === 1 && f.around.house >= 4 },
  { id: 'R-H40', role: 'bakery', when: (f) => f.block === 'house' && f.level === 1 && f.around.house >= 3 && f.side.path >= 1 },
  { id: 'R-H41', role: 'apothecary', when: (f) => f.block === 'house' && f.level === 1 && f.around.house >= 3 && f.side.path === 0 },
  { id: 'R-H42', role: 'bathhouse', when: (f) => f.block === 'house' && f.level === 2 && f.shore },
  { id: 'R-H43', role: 'pottery', when: (f) => f.block === 'house' && f.level === 1 && f.shore && f.around.dock >= 1 },
  { id: 'R-H44', role: 'weaver', when: (f) => f.block === 'house' && f.level === 2 && f.around.house >= 4 },
  { id: 'R-H45', role: 'dairy', when: (f) => f.block === 'house' && f.level === 1 && f.around.house >= 2 && f.around.tree === 1 },
  { id: 'R-H46', role: 'bodega', when: (f) => f.block === 'house' && f.level === 1 && f.ground >= 1 && f.around.house >= 1 },
  { id: 'R-H47', role: 'icehouse', when: (f) => f.block === 'house' && f.level === 1 && f.tall >= 1 && f.around.tree >= 1 },
  { id: 'R-H48', role: 'lodge', when: (f) => f.block === 'house' && f.level === 1 && f.around.tree === 1 && f.around.house === 0 },
  { id: 'R-H49', role: 'monastery', when: (f) => f.block === 'house' && f.level === 2 && f.around.tower >= 1 && f.side.tower === 0 },
  { id: 'R-H50', role: 'press', when: (f) => f.block === 'house' && f.level === 2 && f.around.house >= 3 && f.side.path >= 1 && f.ground === 0 },
  { id: 'R-H52', role: 'guildhall', when: (f) => f.block === 'house' && f.level === 3 && f.around.plaza === 0 && f.around.house >= 3 },

  // Houses that lean on a tower.
  { id: 'R-C02', role: 'cathedral', when: (f) => f.block === 'house' && f.level >= 2 && f.side.tower >= 1 },
  { id: 'R-H01', role: 'chapel', when: (f) => f.block === 'house' && f.side.tower >= 1 },

  // Civic houses, around the square.
  {
    id: 'R-C01',
    role: 'townhall',
    when: (f) => f.block === 'house' && f.level >= 2 && f.around.plaza >= 1 && f.side.path >= 1,
  },
  { id: 'R-H06', role: 'inn', when: (f) => f.block === 'house' && f.side.path >= 2 && f.around.plaza >= 1 },
  {
    id: 'R-H22',
    role: 'library',
    when: (f) => f.block === 'house' && f.level >= 2 && f.around.plaza >= 1 && f.around.house >= 2,
  },
  {
    id: 'R-H21',
    role: 'schoolhouse',
    when: (f) => f.block === 'house' && f.around.plaza >= 1 && f.around.house >= 2,
  },

  // Small houses with a trade, before the height rules claim them.
  {
    id: 'R-H26',
    role: 'fisherhouse',
    when: (f) => f.block === 'house' && f.level <= 2 && f.shore && f.around.dock === 0,
  },
  { id: 'R-H27', role: 'millhouse', when: (f) => f.block === 'house' && f.level <= 2 && f.around.mill >= 1 },
  { id: 'R-H28', role: 'villa', when: (f) => f.block === 'house' && f.level <= 2 && f.around.garden >= 1 },

  { id: 'R-H53', role: 'barracks', when: (f) => f.block === 'house' && f.level === 2 && f.around.wall >= 2 },
  { id: 'R-H54', role: 'courthouse', when: (f) => f.block === 'house' && f.level === 3 && f.around.wall >= 1 },

  // Height alone: the tallest wins.
  { id: 'R-C03', role: 'palace', when: (f) => f.block === 'house' && f.level >= 5 },
  { id: 'R-H23', role: 'tenement', when: (f) => f.block === 'house' && f.level >= 4 },
  { id: 'R-H09', role: 'manor', when: (f) => f.block === 'house' && f.level >= 3 },
  { id: 'R-H10', role: 'townhouse', when: (f) => f.block === 'house' && f.level >= 2 },

  // Water and work.
  { id: 'R-H30', role: 'tidemill', when: (f) => f.block === 'mill' && f.shore && f.around.dock >= 1 },
  { id: 'R-H31', role: 'sawmill', when: (f) => f.block === 'mill' && f.around.tree >= 2 },
  { id: 'R-H32', role: 'postmill', when: (f) => f.block === 'mill' && f.ground >= 1 },
  { id: 'R-H33', role: 'cargodock', when: (f) => f.block === 'dock' && f.level >= 2 },
  { id: 'R-H16', role: 'watermill', when: (f) => f.block === 'mill' && f.shore },
  { id: 'R-H17', role: 'warehouse', when: (f) => f.block === 'house' && f.around.dock >= 2 },
  { id: 'R-H05', role: 'boathouse', when: (f) => f.block === 'house' && f.around.dock >= 1 },
  { id: 'R-H19', role: 'smithy', when: (f) => f.block === 'house' && f.around.field >= 1 && f.around.path >= 1 },
  { id: 'R-H07', role: 'shop', when: (f) => f.block === 'house' && f.side.path >= 2 },
  { id: 'R-S01', role: 'stall', when: (f) => f.block === 'house' && f.around.plaza >= 1 && f.around.path >= 1 },
  { id: 'R-H24', role: 'stable', when: (f) => f.block === 'house' && f.around.field >= 2 },
  { id: 'R-H18', role: 'barn', when: (f) => f.block === 'house' && f.around.field >= 1 },
  { id: 'R-H15', role: 'cottage', when: (f) => f.block === 'house' && f.around.tree >= 2 },

  // Ground.
  { id: 'R-B01', role: 'bridge', when: (f) => f.block === 'path' && !f.land },
  { id: 'R-D02', role: 'wallwalk', when: (f) => f.block === 'path' && f.land && f.around.wall >= 1 },
  { id: 'R-D03', role: 'avenue', when: (f) => f.block === 'path' && f.land && f.around.tree >= 2 },
  { id: 'R-D01', role: 'quay', when: (f) => f.block === 'path' && f.land && f.shore },
  { id: 'R-M11', role: 'theatre', when: (f) => f.block === 'plaza' && f.side.plaza >= 3 && f.around.tower >= 1 },
  { id: 'R-M12', role: 'bandstand', when: (f) => f.block === 'plaza' && f.around.tree >= 3 },
  { id: 'R-F01', role: 'square', when: (f) => f.block === 'plaza' && f.side.plaza >= 4 },
  { id: 'R-F03', role: 'porticada', when: (f) => f.block === 'plaza' && f.side.path >= 2 },
  { id: 'R-F04', role: 'market', when: (f) => f.block === 'plaza' && f.around.house >= 3 },
  { id: 'R-P06', role: 'willow', when: (f) => f.block === 'tree' && f.shore },
  { id: 'R-P05', role: 'hedge', when: (f) => f.block === 'tree' && f.around.house >= 3 },
  { id: 'R-P04', role: 'olive', when: (f) => f.block === 'tree' && f.around.field >= 1 },
  { id: 'R-P03', role: 'summitpine', when: (f) => f.block === 'tree' && f.ground >= 2 },
  { id: 'R-P02', role: 'greatoak', when: (f) => f.block === 'tree' && f.level >= 3 },
  { id: 'R-P01', role: 'orchard', when: (f) => f.block === 'tree' && f.around.tree >= 4 },
  { id: 'R-F02', role: 'vineyard', when: (f) => f.block === 'field' && f.around.garden >= 1 },
  { id: 'R-F06', role: 'rice', when: (f) => f.block === 'field' && f.shore },
  { id: 'R-F05', role: 'meadow', when: (f) => f.block === 'field' && f.around.tree >= 2 },
  { id: 'R-F07', role: 'olivar', when: (f) => f.block === 'field' && f.level >= 2 },
  { id: 'R-F08', role: 'wheat', when: (f) => f.block === 'field' && f.around.field >= 1 },
  { id: 'R-F09', role: 'saltpans', when: (f) => f.block === 'dock' && f.around.field >= 1 },
  { id: 'R-F10', role: 'fishmarket', when: (f) => f.block === 'dock' && f.around.plaza >= 1 },
  { id: 'R-F11', role: 'shipyard', when: (f) => f.block === 'dock' && f.around.tree >= 1 && f.around.house >= 1 },
];

/** Turns a block and its surroundings into what it becomes. */
export function resolveCell(block: BlockKind, facts: Facts): Role {
  for (const rule of RULES) {
    if (rule.when(facts)) return rule.role;
  }
  return BASE_ROLE[block];
}

export interface Resolved {
  role: Role;
  block: BlockKind;
  level: number;
  /** What actually gets drawn: the level, plus one floor if a neighbour towers over it. */
  storeys: number;
  x: number;
  z: number;
  rule: string | null;
  /** Quarter turns the player gave this block. */
  rot: number;
  /** For walls: which sides carry on into a neighbouring wall. */
  links: number;
}

export function gatherFacts(
  town: Town,
  mask: boolean[][],
  x: number,
  z: number,
  block: BlockKind,
  level: number,
  ground = 0,
): Facts {
  const around = emptyCounts();
  const side = emptyCounts();
  const at = (dx: number, dz: number): BlockKind | null => {
    const nx = x + dx;
    const nz = z + dz;
    if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) return null;
    return town.blocks.get(key(nx, nz))?.kind ?? null;
  };
  let top = 0;
  let tall = 0;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue;
      const kind = at(dx, dz);
      if (kind) around[kind]++;
      if (kind && (dx === 0 || dz === 0)) side[kind]++;
      if (kind) {
        const level = town.blocks.get(key(x + dx, z + dz))?.level ?? 1;
        if (level > top) top = level;
        if (level >= 3) tall++;
      }
    }
  }
  return {
    x,
    z,
    block,
    level,
    top,
    tall,
    ground,
    land: landAt(mask, x, z),
    shore: isShore(mask, x, z),
    around,
    side,
  };
}

/** Resolves every placed block of the town in one pass. */
export function resolveTown(
  town: Town,
  mask: boolean[][],
  ground?: (x: number, z: number) => number,
): Map<string, Resolved> {
  const out = new Map<string, Resolved>();
  for (const [k, placed] of town.blocks) {
    const [x, z] = k.split(',').map(Number);
    const facts = gatherFacts(town, mask, x, z, placed.kind, placed.level, ground ? ground(x, z) : 0);
    const rule = RULES.find((r) => r.when(facts)) ?? null;
    // A house leans on its tall neighbour and gains a floor: nothing is broken,
    // the town just grows into itself.
    const storeys = Math.min(5, placed.level + (facts.top >= placed.level + 3 ? 1 : 0));
    let links = 0;
    if (placed.kind === 'wall') {
      const wall = (dx: number, dz: number): boolean =>
        town.blocks.get(key(x + dx, z + dz))?.kind === 'wall';
      if (wall(0, -1)) links |= LINK_N;
      if (wall(1, 0)) links |= LINK_E;
      if (wall(0, 1)) links |= LINK_S;
      if (wall(-1, 0)) links |= LINK_W;
    } else if (placed.kind === 'path' || placed.kind === 'plaza') {
      // A lane or a square knows which way it runs, so it can be drawn as one
      // floor: no kerbs across the way it carries on, and ruts along a lane.
      const road = (dx: number, dz: number): boolean => {
        const kind = town.blocks.get(key(x + dx, z + dz))?.kind;
        return kind === 'path' || kind === 'plaza';
      };
      if (road(0, -1)) links |= LINK_N;
      if (road(1, 0)) links |= LINK_E;
      if (road(0, 1)) links |= LINK_S;
      if (road(-1, 0)) links |= LINK_W;
    }
    out.set(k, {
      role: rule ? rule.role : BASE_ROLE[placed.kind],
      block: placed.kind,
      level: placed.level,
      storeys,
      x,
      z,
      rule: rule?.id ?? null,
      rot: ((placed.rot ?? 0) % 4 + 4) % 4,
      links,
    });
  }
  return out;
}

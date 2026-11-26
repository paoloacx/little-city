import './style.css';

import { BLOCK_DEFS, BlockKind, MAX_LEVEL, Town, UNLOCK_AT, key, landAt, loadSaved, saveTown } from './grid';
import { ROLES, SPECIAL_COUNT } from './rules';
import { growTown } from './grow';
import { World } from './scene';
import { encodeTown, shareUrl, townFromHash } from './share';
import { openGuide } from './guide';
import { Season, getSeason, nextSeason, seasonById, seasonForMonth, setSeason } from './season';
import { DEFAULT_SIZE, Place, loadPlace, readAnyCache, seedOf, writeCache } from './place';
import { openPlaceDialog } from './placeui';
import { introSeen, openIntro } from './intro';
import { loadSlots, openSaves, persistSlots, type SlotData } from './saves';
import { Ambience } from './audio';

const SOUND_KEY = 'ciudad-pequena.sound';
const CYCLE_KEY = 'ciudad-pequena.cycle';
const SEASON_KEY = 'ciudad-pequena.season';

const canvas = document.getElementById('town') as HTMLCanvasElement;
const paletteEl = document.getElementById('palette') as HTMLDivElement;
const countEl = document.getElementById('found-count') as HTMLElement;
const totalEl = document.getElementById('found-total') as HTMLElement;
const lastEl = document.getElementById('found-last') as HTMLElement;
const hintEl = document.querySelector('.lc-hint') as HTMLElement;
const growEl = document.getElementById('grow') as HTMLButtonElement;
const clearEl = document.getElementById('clear') as HTMLButtonElement;
const shareEl = document.getElementById('share') as HTMLButtonElement;
const postcardEl = document.getElementById('postcard') as HTMLButtonElement;
const guideEl = document.getElementById('guide') as HTMLButtonElement;
const soundEl = document.getElementById('sound') as HTMLButtonElement;
const cycleEl = document.getElementById('cycle') as HTMLButtonElement;
const seasonEl = document.getElementById('season') as HTMLButtonElement;
const placeEl = document.getElementById('place') as HTMLButtonElement;
const undoEl = document.getElementById('undo') as HTMLButtonElement;
const rotateEl = document.getElementById('rotate') as HTMLButtonElement;
const brushEl = document.getElementById('brush') as HTMLButtonElement;

const world = new World(canvas);
const ambience = new Ambience();

type Tool = BlockKind | 'erase';
let tool: Tool = 'house';
let town: Town;
const found = new Set<string>();
let recent: string[] = [];

/* ---------------------------------------------------------------- the town */

const clickEl = document.getElementById('click-count') as HTMLElement;
const clickRow = document.getElementById('click-row') as HTMLElement;
let clicks = 0;

/** Snapshots let the player walk back out of any mistake, Ctrl+Z at a time. */
interface Snapshot {
  seed: number;
  clicks: number;
  blocks: [string, BlockKind, number, number][];
}
const undoStack: Snapshot[] = [];
const HISTORY_MAX = 40;
let brush = false;
/** The last block the player put down: the turn button works on it. */
let lastPlaced: { x: number; z: number } | null = null;
let lastPaint: { x: number; z: number } | null = null;

const shared = townFromHash();
const stored = shared ? null : loadSaved();
if (shared) {
  town = shared;
} else if (stored) {
  town = {
    seed: stored.seed,
    blocks: new Map(stored.blocks.map(([x, z, kind, level, rot]) => [key(x, z), { kind, level, rot: rot ?? 0 }])),
  };
  for (const role of stored.found) found.add(role);
  clicks = stored.clicks;
} else {
  town = growTown((Math.random() * 1e9) | 0);
}

/** The season for this visit: a link, the last one used, or the month. */
function loadSeason(): Season {
  const fromLink = seasonById(new URLSearchParams(location.search).get('estacion'));
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(SEASON_KEY);
  } catch {
    stored = null;
  }
  return fromLink ?? seasonById(stored) ?? seasonForMonth(new Date().getMonth());
}

setSeason(loadSeason());
world.setSeed(town.seed);

/*
 * A town that came from a real place keeps its coastline: the seed says which
 * place it was, so the cached square goes back under it, even from "Pueblos".
 */
const cachedPlace = readAnyCache();
if (cachedPlace && seedOf(cachedPlace.lat, cachedPlace.lon) === town.seed) {
  world.setIsland(cachedPlace.mask);
}
totalEl.textContent = String(SPECIAL_COUNT);
boot();
paintSeason();
world.setWeather(getSeason().weather);

function boot(): void {
  resolve(false);
  syncPanel();
  updateLocks();
  clickEl.textContent = String(clicks);
  save();
}

/* ------------------------------------------------------- undo and unlocking */

function snapshot(): Snapshot {
  return {
    seed: town.seed,
    clicks,
    blocks: [...town.blocks].map(
      ([k, placed]) => [k, placed.kind, placed.level, placed.rot ?? 0] as [string, BlockKind, number, number],
    ),
  };
}

function pushHistory(): void {
  undoStack.push(snapshot());
  if (undoStack.length > HISTORY_MAX) undoStack.shift();
  undoEl.disabled = false;
}

function restore(snap: Snapshot): void {
  if (town.seed !== snap.seed) {
    town = { seed: snap.seed, blocks: new Map() };
    world.setSeed(snap.seed);
  }
  town = {
    seed: snap.seed,
    blocks: new Map(snap.blocks.map(([k, kind, level, rot]) => [k, { kind, level, rot }])),
  };
  clicks = snap.clicks;
  lastPlaced = null;
  clickEl.textContent = String(clicks);
}

function undo(): void {
  const snap = undoStack.pop();
  if (!snap) return;
  restore(snap);
  resolve(false);
  syncPanel();
  updateLocks();
  save();
  undoEl.disabled = undoStack.length === 0;
  lastPaint = null;
  updateGhost(lastPointer.x, lastPointer.y);
  toast('Deshecho');
}

function unlockNeed(kind: BlockKind): number {
  return UNLOCK_AT[kind] ?? 0;
}

function isLocked(kind: BlockKind): boolean {
  return found.size < unlockNeed(kind);
}

function updateLocks(): void {
  for (const button of paletteEl.querySelectorAll('button')) {
    const kind = button.dataset.tool as BlockKind | 'erase';
    if (kind === 'erase') continue;
    const locked = isLocked(kind);
    button.classList.toggle('locked', locked);
    button.setAttribute('aria-disabled', String(locked));
    const badge = button.querySelector('.lc-lock');
    if (badge) badge.textContent = String(unlockNeed(kind));
  }
}

/** Tells the player when a new block just became available. */
function announceUnlocks(before: Set<BlockKind>): void {
  const fresh = BLOCK_DEFS.map((d) => d.kind).filter((kind) => !before.has(kind) && !isLocked(kind));
  if (fresh.length === 0) return;
  const labels = fresh.map((kind) => BLOCK_DEFS.find((d) => d.kind === kind)?.label ?? kind);
  updateLocks();
  toast(`Desbloqueado: ${labels.join(' · ')}`);
}

function unlockedNow(): Set<BlockKind> {
  return new Set(BLOCK_DEFS.map((d) => d.kind).filter((kind) => !isLocked(kind)));
}

/** Rebuilds the world and collects any discovery the town now holds. */
function resolve(announce: boolean): void {
  const resolved = world.rebuild(town);
  const fresh: string[] = [];
  for (const cell of resolved.values()) {
    if (!ROLES[cell.role].special) continue;
    if (found.has(cell.role)) continue;
    found.add(cell.role);
    if (announce) fresh.push(ROLES[cell.role].label);
  }
  if (fresh.length) recent = [...fresh, ...recent].slice(0, 3);
}

function syncClicks(): void {
  clickEl.textContent = String(clicks);
  clickRow.classList.remove('pop');
  // Restarting the animation needs a reflow between the two classes.
  void clickRow.offsetWidth;
  clickRow.classList.add('pop');
}

function syncPanel(): void {
  countEl.textContent = String(found.size);
  if (recent.length === 0) {
    lastEl.textContent = found.size
      ? 'Sigue colocando: cada esquina cambia lo que sale.'
      : 'Prueba una casa junto a una torre, junto al agua.';
    return;
  }
  lastEl.textContent = `Nuevo: ${recent.join(' · ')}`;
}

function apply(): void {
  const before = unlockedNow();
  resolve(true);
  syncPanel();
  announceUnlocks(before);
  save();
}

function save(): void {
  saveTown(town, found, clicks);
}

/* --------------------------------------------------------------- the toast */

let toastTimer: number | null = null;

function toast(message: string): void {
  let el = document.querySelector('.lc-toast') as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.className = 'lc-toast';
    document.body.append(el);
  }
  el.textContent = message;
  requestAnimationFrame(() => el?.classList.add('show'));
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el?.classList.remove('show'), 2200);
}

/* ------------------------------------------------------------- the picking */

const WATER_TILES: ReadonlySet<Tool> = new Set<Tool>(['path', 'dock']);

function place(x: number, z: number): void {
  const land = landAt(world.islandMask, x, z);
  if (!land && !WATER_TILES.has(tool)) return;
  if (tool !== 'erase' && isLocked(tool)) {
    toast(`Se desbloquea con ${unlockNeed(tool)} hallazgos: llevas ${found.size}`);
    return;
  }
  const k = key(x, z);

  if (tool === 'erase') {
    if (!town.blocks.has(k)) return;
    pushHistory();
    town.blocks.delete(k);
    clicks += 1;
    syncClicks();
    ambience.tick();
    apply();
    return;
  }

  const current = town.blocks.get(k);
  if (current && current.kind === tool) {
    // The same block again: one floor higher, all the way to five. Nothing is
    // ever knocked down by clicking; for that there is the eraser.
    if (current.level >= MAX_LEVEL) {
      toast('Ya está al máximo: cinco alturas');
      return;
    }
    pushHistory();
    current.level += 1;
  } else {
    pushHistory();
    town.blocks.set(k, { kind: tool, level: 1, rot: 0 });
  }
  lastPlaced = { x, z };
  clicks += 1;
  syncClicks();
  ambience.tick();
  apply();
}

/**
 * One stroke of the brush: only the first pass over a tile counts, so holding
 * the button down never builds a tower by accident.
 */
function paintAt(x: number, z: number): void {
  if (lastPaint && lastPaint.x === x && lastPaint.z === z) return;
  lastPaint = { x, z };
  const land = landAt(world.islandMask, x, z);
  if (!land && !WATER_TILES.has(tool)) return;
  if (tool !== 'erase' && isLocked(tool)) return;
  const k = key(x, z);
  const current = town.blocks.get(k);
  if (tool === 'erase') {
    if (!current) return;
    pushHistory();
    town.blocks.delete(k);
  } else {
    if (current && current.kind === tool) return;
    pushHistory();
    town.blocks.set(k, { kind: tool, level: 1, rot: 0 });
  }
  lastPlaced = { x, z };
  clicks += 1;
  syncClicks();
  ambience.tick();
  apply();
}

/** Right click: straight to five storeys, for players in a hurry. */
function placeMax(x: number, z: number): void {
  const land = landAt(world.islandMask, x, z);
  if (!land && !WATER_TILES.has(tool)) return;
  if (tool === 'erase') {
    place(x, z);
    return;
  }
  if (isLocked(tool)) {
    toast(`Se desbloquea con ${unlockNeed(tool)} hallazgos: llevas ${found.size}`);
    return;
  }
  const k = key(x, z);
  const current = town.blocks.get(k);
  if (current && current.kind === tool && current.level >= MAX_LEVEL) {
    toast('Ya está al máximo: cinco alturas');
    return;
  }
  pushHistory();
  town.blocks.set(k, { kind: tool, level: MAX_LEVEL, rot: current?.rot ?? 0 });
  lastPlaced = { x, z };
  clicks += 1;
  syncClicks();
  ambience.tick();
  apply();
}

const UNTURNABLE: ReadonlySet<BlockKind> = new Set<BlockKind>(['tree', 'field', 'garden']);

/** Whether a wall at this tile is already tied into its neighbours. */
function wallJoined(x: number, z: number): boolean {
  return (
    town.blocks.get(key(x + 1, z))?.kind === 'wall' ||
    town.blocks.get(key(x - 1, z))?.kind === 'wall' ||
    town.blocks.get(key(x, z + 1))?.kind === 'wall' ||
    town.blocks.get(key(x, z - 1))?.kind === 'wall'
  );
}

/**
 * Turns one building a quarter turn: the one under the pointer if there is
 * one, and otherwise the last one placed.
 */
function rotateBlock(): void {
  const hit = world.pick(lastPointer.x, lastPointer.y);
  const target = hit && town.blocks.has(key(hit.x, hit.z)) ? { x: hit.x, z: hit.z } : lastPlaced;
  if (!target) {
    toast('Coloca algo y pulsa Girar para darle la vuelta');
    return;
  }
  const placed = town.blocks.get(key(target.x, target.z));
  if (!placed) {
    lastPlaced = null;
    toast('Ahí ya no hay nada que girar');
    return;
  }
  if (UNTURNABLE.has(placed.kind)) {
    toast('Eso no tiene cara: no hace falta girarlo');
    return;
  }
  if (placed.kind === 'wall' && wallJoined(target.x, target.z)) {
    toast('La muralla se une sola: no hay que girarla');
    return;
  }
  pushHistory();
  placed.rot = ((placed.rot ?? 0) + 1) % 4;
  lastPlaced = target;
  apply();
  const def = BLOCK_DEFS.find((b) => b.kind === placed.kind);
  toast(`${def?.label ?? ''} girada`);
}

function updateGhost(clientX: number, clientY: number): void {
  const hit = world.pick(clientX, clientY);
  if (!hit) {
    world.setGhost(null, null);
    return;
  }
  if (tool !== 'erase' && !hit.land && !WATER_TILES.has(tool)) {
    world.setGhost(null, null);
    hintEl.textContent = 'Aquí solo caben caminos y muelles';
    return;
  }
  const current = town.blocks.get(key(hit.x, hit.z));
  const level = current && current.kind === tool ? Math.min(current.level + 1, MAX_LEVEL) : 1;
  world.setGhost(hit.x, hit.z, tool === 'erase' ? 'erase' : 'block', level);
  if (tool === 'erase') {
    hintEl.textContent = 'Borrar: quita el bloque entero';
    return;
  }
  const def = BLOCK_DEFS.find((b) => b.kind === tool);
  hintEl.textContent =
    level === 1
      ? `${def?.label ?? ''} · otro clic lo hace más alto`
      : `${def?.label ?? ''} · nivel ${level} de ${MAX_LEVEL}`;
}

/* ---------------------------------------------------------------- the input */

const pointers = new Map<number, { x: number; y: number }>();
let lastPointer = { x: 0, y: 0 };
let travel = 0;
let pinch = 0;

const pinchSpread = (): number => {
  const points = [...pointers.values()];
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
};

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

canvas.addEventListener('pointerdown', (event) => {
  if (event.button === 2) return;
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 1) {
    lastPointer = { x: event.clientX, y: event.clientY };
    travel = 0;
    lastPaint = null;
  } else {
    pinch = pinchSpread();
  }
  canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', (event) => {
  if (!pointers.has(event.pointerId)) {
    updateGhost(event.clientX, event.clientY);
    return;
  }
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pointers.size >= 2) {
    const spread = pinchSpread();
    if (pinch > 0) world.zoomBy((pinch - spread) * 2.4);
    pinch = spread;
    return;
  }

  const dx = event.clientX - lastPointer.x;
  const dy = event.clientY - lastPointer.y;
  lastPointer = { x: event.clientX, y: event.clientY };
  travel += Math.abs(dx) + Math.abs(dy);
  if (travel > 5) {
    if (brush && !event.shiftKey) {
      const hit = world.pick(event.clientX, event.clientY);
      if (hit) paintAt(hit.x, hit.z);
    } else {
      world.rotateBy(dx, dy);
    }
    world.setGhost(null, null);
  }
});

const release = (event: PointerEvent, act: boolean): void => {
  if (event.button === 2) {
    const hit = world.pick(event.clientX, event.clientY);
    if (hit) placeMax(hit.x, hit.z);
    updateGhost(event.clientX, event.clientY);
    return;
  }
  pointers.delete(event.pointerId);
  if (pointers.size > 0) return;
  canvas.classList.remove('dragging');
  pinch = 0;
  lastPaint = null;
  if (!act) return;
  if (travel > 5) return;
  const hit = world.pick(event.clientX, event.clientY);
  if (hit) place(hit.x, hit.z);
  updateGhost(event.clientX, event.clientY);
};

canvas.addEventListener('pointerup', (event) => release(event, true));
canvas.addEventListener('pointercancel', (event) => release(event, false));
canvas.addEventListener('pointerleave', () => {
  world.setGhost(null, null);
  hintEl.textContent = brush
    ? 'Pincel: arrastra para pintar · Shift para girar · R gira una casa'
    : 'Arrastra para girar la isla · rueda para acercar · R gira el edificio';
});

canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    world.zoomBy(event.deltaY);
  },
  { passive: false },
);

window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && (event.key === 'z' || event.key === 'Z')) {
    event.preventDefault();
    undo();
    return;
  }
  if (event.key === 'e' || event.key === 'E' || event.key === 'Backspace') {
    select('erase');
    return;
  }
  if (event.key === 'b' || event.key === 'B') {
    setBrush(!brush);
    return;
  }
  if (event.key === 'r' || event.key === 'R') {
    rotateBlock();
    return;
  }
  // 1..9 and then 0 for the tenth block.
  const index = event.key === '0' ? 10 : Number(event.key);
  if (Number.isInteger(index) && index >= 1 && index <= BLOCK_DEFS.length) {
    select(BLOCK_DEFS[index - 1].kind);
  }
});

/* --------------------------------------------------------------- the panel */

function select(next: Tool): void {
  tool = next;
  for (const button of paletteEl.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
  }
  updateGhost(lastPointer.x, lastPointer.y);
}

function renderPalette(): void {
  const frag = document.createDocumentFragment();
  for (const [index, def] of BLOCK_DEFS.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tool = def.kind;
    button.title = `${def.label} (${index + 1}) — ${def.hint}`;
    button.setAttribute('aria-pressed', String(def.kind === tool));
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.setProperty('--swatch', def.swatch);
    const label = document.createElement('span');
    label.textContent = def.label;
    const lock = document.createElement('span');
    lock.className = 'lc-lock';
    button.append(swatch, label, lock);
    button.addEventListener('click', () => {
      if (isLocked(def.kind)) {
        toast(`Se desbloquea con ${unlockNeed(def.kind)} hallazgos: llevas ${found.size}`);
        return;
      }
      select(def.kind);
    });
    frag.append(button);
  }

  const erase = document.createElement('button');
  erase.type = 'button';
  erase.dataset.tool = 'erase';
  erase.title = 'Borrar (E) — quita lo que hay en la casilla';
  erase.setAttribute('aria-pressed', 'false');
  const swatch = document.createElement('span');
  swatch.className = 'swatch';
  swatch.style.setProperty('--swatch', 'repeating-linear-gradient(45deg, #fbf8f1 0 3px, #cdbfa9 3px 5px)');
  const label = document.createElement('span');
  label.textContent = 'Borrar';
  erase.append(swatch, label);
  erase.addEventListener('click', () => select('erase'));
  frag.append(erase);

  paletteEl.append(frag);
}

function setBrush(on: boolean): void {
  brush = on;
  brushEl.textContent = on ? 'Pincel: sí' : 'Pincel: no';
  brushEl.setAttribute('aria-pressed', String(on));
  hintEl.textContent = on
    ? 'Pincel: arrastra para pintar · Shift para girar · botón derecho: cinco alturas'
    : 'Arrastra para girar · clic derecho: cinco alturas · rueda para acercar';
}

brushEl.addEventListener('click', () => setBrush(!brush));
undoEl.addEventListener('click', () => undo());
rotateEl.addEventListener('click', () => rotateBlock());

growEl.addEventListener('click', () => {
  pushHistory();
  town = growTown((Math.random() * 1e9) | 0);
  clicks = 0;
  world.setSeed(town.seed);
  found.clear();
  recent = [];
  resolve(true);
  syncPanel();
  updateLocks();
  save();
  toast(`Isla de ${world.biomeName}: pueblo nuevo`);
});

clearEl.addEventListener('click', () => {
  pushHistory();
  town = { seed: town.seed, blocks: new Map() };
  clicks = 0;
  found.clear();
  recent = [];
  resolve(false);
  syncPanel();
  updateLocks();
  save();
});

shareEl.addEventListener('click', () => {
  const payload = encodeTown(town);
  const url = shareUrl(payload);
  history.replaceState(null, '', `${location.search}#p=${payload}`);
  const done = (): void => toast('Enlace copiado: el pueblo va dentro');
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(done).catch(() => toast('El enlace está en la barra del navegador'));
  } else {
    toast('El enlace está en la barra del navegador');
  }
});

postcardEl.addEventListener('click', () => {
  const image = world.snapshot();
  const link = document.createElement('a');
  link.href = image;
  link.download = 'ciudad-pequena.png';
  link.click();
  toast('Postal descargada');
});

guideEl.addEventListener('click', () => openGuide(found));

soundEl.addEventListener('click', () => {
  const on = soundEl.getAttribute('aria-pressed') !== 'true';
  soundEl.setAttribute('aria-pressed', String(on));
  soundEl.textContent = on ? 'Sonido: sí' : 'Sonido: no';
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    /* A blocked storage must not break the sound. */
  }
  void ambience.setEnabled(on);
});

function setCycle(on: boolean): void {
  cycleEl.setAttribute('aria-pressed', String(on));
  cycleEl.textContent = on ? 'Ciclo: sí' : 'Ciclo: no';
  world.setCycle(on);
  try {
    localStorage.setItem(CYCLE_KEY, on ? 'on' : 'off');
  } catch {
    /* Ignored: the toggle still works for this session. */
  }
}

cycleEl.addEventListener('click', () => setCycle(cycleEl.getAttribute('aria-pressed') !== 'true'));

function paintSeason(): void {
  seasonEl.textContent = `Estación: ${getSeason().label.toLowerCase()}`;
  seasonEl.title = getSeason().note;
  document.body.dataset.season = getSeason().id;
}

/**
 * Turns the year: the island and every cell are rebuilt in the new palette and
 * the weather follows. Costly only for the click that asks for it.
 */
function applySeason(season: Season, announce = false): void {
  setSeason(season);
  paintSeason();
  world.setSeed(town.seed);
  resolve(false);
  world.setWeather(season.weather);
  try {
    localStorage.setItem(SEASON_KEY, season.id);
  } catch {
    /* Ignored: the season still holds for this visit. */
  }
  if (announce) toast(season.note);
}

seasonEl.addEventListener('click', () => applySeason(nextSeason(), true));

/* ------------------------------------------------------------ real places */

/**
 * Lays a real barrio on the board: its coastline becomes the island, and one
 * block per cell comes from what OpenStreetMap has there. From then on the town
 * is yours to change, like any other.
 */
function applyPlace(place: Place): void {
  const seed = seedOf(place.lat, place.lon);
  town = { seed, blocks: new Map() };
  for (const block of place.blocks) {
    const at = key(block.x, block.z);
    if (town.blocks.has(at)) continue;
    town.blocks.set(at, { kind: block.kind, level: block.level, rot: block.rot });
  }
  clicks = 0;
  lastPlaced = null;
  undoStack.length = 0;
  undoEl.disabled = true;
  writeCache(place);
  world.setIsland(place.mask);
  world.setSeed(seed);
  resolve(false);
  updateLocks();
  syncPanel();
  syncClicks();
  save();
  const params = new URLSearchParams(location.search);
  params.set('sitio', `${place.lat.toFixed(5)},${place.lon.toFixed(5)},${place.size}`);
  params.set('lugar', place.name);
  history.replaceState(null, '', `?${params}${location.hash}`);
  document.body.dataset.lugar = place.name;
  toast(`${place.name}: el barrio ya está en el tablero`);
}

placeEl.addEventListener('click', () => openPlaceDialog(applyPlace));

/*
 * A link can carry the place, so the same barrio opens again: `?sitio=lat,lon,m`.
 * It is fetched again, because the map is the authority on what is there.
 */
const siteParam = new URLSearchParams(location.search).get('sitio');
if (siteParam) {
  const [latText, lonText, sizeText] = siteParam.split(',');
  const lat = Number(latText);
  const lon = Number(lonText);
  const size = Number(sizeText) || DEFAULT_SIZE;
  const name = new URLSearchParams(location.search).get('lugar') ?? 'Tu barrio';
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    void loadPlace(lat, lon, size, name)
      .then(applyPlace)
      .catch(() => toast('No se pudo abrir el lugar del enlace; sigues en tu pueblo'));
  }
}

renderPalette();

/* ------------------------------------------------------------ photo mode */

const photoEl = document.getElementById('photo') as HTMLButtonElement;
const savesEl = document.getElementById('saves') as HTMLButtonElement;

/* ------------------------------------------------------------- saved towns */

function currentSlot(): SlotData {
  return {
    seed: town.seed,
    blocks: [...town.blocks].map(([k, placed]) => {
      const [x, z] = k.split(',').map(Number);
      return [x, z, placed.kind, placed.level, placed.rot ?? 0] as [number, number, BlockKind, number, number];
    }),
    found: [...found],
    clicks,
    savedAt: Date.now(),
  };
}

function loadSlot(data: SlotData): void {
  pushHistory();
  town = {
    seed: data.seed,
    blocks: new Map(data.blocks.map(([x, z, kind, level, rot]) => [key(x, z), { kind, level, rot: rot ?? 0 }])),
  };
  found.clear();
  for (const role of data.found) found.add(role);
  clicks = data.clicks;
  world.setSeed(town.seed);
  resolve(false);
  syncPanel();
  syncClicks();
  updateLocks();
  save();
  toast(`Pueblo cargado: ${world.biomeName}`);
}

savesEl.addEventListener('click', () =>
  openSaves({
    slots: loadSlots(),
    current: currentSlot,
    label: () => `Isla de ${world.biomeName}`,
    onLoad: loadSlot,
    onChange: persistSlots,
  }),
);

function setPhoto(on: boolean): void {
  document.body.classList.toggle('lc-photo', on);
  photoEl.textContent = on ? 'Salir' : 'Foto';
  photoEl.setAttribute('aria-pressed', String(on));
}

photoEl.addEventListener('click', () => setPhoto(!document.body.classList.contains('lc-photo')));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('lc-photo')) setPhoto(false);
});

/* First visit: the four things worth knowing, and then out of the way. */
if (!introSeen()) {
  openIntro(() => updateGhost(lastPointer.x, lastPointer.y));
}


/* Sound is off by default: it waits for the listener to ask for it. */
if (localStorage.getItem(SOUND_KEY) === 'on') {
  soundEl.setAttribute('aria-pressed', 'true');
  soundEl.textContent = 'Sonido: sí';
  void ambience.setEnabled(true);
}

/* The page follows the light: at night the title turns to paper. */
world.onDusk = (dusk) => document.body.classList.toggle('lc-night', dusk > 0.45);

/* Day and night are on by default, starting in the morning. */
setCycle(localStorage.getItem(CYCLE_KEY) !== 'off');

/* `?hora=0.7` starts the clock at dusk: handy for looking at the lights. */
const hour = Number(new URLSearchParams(location.search).get('hora'));
if (Number.isFinite(hour) && hour >= 0) world.setPhase(hour);

/* A small handle for poking at the diorama from the console: stats and timing. */
if (import.meta.env.DEV) {
  (window as unknown as { __ciudad: unknown }).__ciudad = {
    world,
    town,
    stats: () => world.stats(),
    rebuild: (times = 1): number => {
      const started = performance.now();
      for (let i = 0; i < times; i++) world.rebuild(town);
      return (performance.now() - started) / times;
    },
  };
}

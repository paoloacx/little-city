import './style.css';

import { BLOCK_DEFS, BlockKind, MAX_LEVEL, Town, key, landAt, loadSaved, saveTown } from './grid';
import { ROLES, SPECIAL_COUNT } from './rules';
import { growTown } from './grow';
import { World } from './scene';
import { encodeTown, shareUrl, townFromHash } from './share';
import { openGuide } from './guide';
import { Ambience } from './audio';

const SOUND_KEY = 'ciudad-pequena.sound';
const CYCLE_KEY = 'ciudad-pequena.cycle';

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

const shared = townFromHash();
const stored = shared ? null : loadSaved();
if (shared) {
  town = shared;
} else if (stored) {
  town = {
    seed: stored.seed,
    blocks: new Map(stored.blocks.map(([x, z, kind, level]) => [key(x, z), { kind, level }])),
  };
  for (const role of stored.found) found.add(role);
  clicks = stored.clicks;
} else {
  town = growTown((Math.random() * 1e9) | 0);
}

world.setSeed(town.seed);
totalEl.textContent = String(SPECIAL_COUNT);
boot();

function boot(): void {
  resolve(false);
  syncPanel();
  clickEl.textContent = String(clicks);
  save();
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
  resolve(true);
  syncPanel();
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
  const k = key(x, z);

  if (tool === 'erase') {
    if (!town.blocks.delete(k)) return;
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
    current.level += 1;
  } else {
    town.blocks.set(k, { kind: tool, level: 1 });
  }
  clicks += 1;
  syncClicks();
  ambience.tick();
  apply();
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

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 1) {
    lastPointer = { x: event.clientX, y: event.clientY };
    travel = 0;
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
    world.rotateBy(dx, dy);
    world.setGhost(null, null);
  }
});

const release = (event: PointerEvent, act: boolean): void => {
  pointers.delete(event.pointerId);
  if (pointers.size > 0) return;
  canvas.classList.remove('dragging');
  pinch = 0;
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
  hintEl.textContent = 'Arrastra para girar · rueda para acercar · toca para colocar';
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
  if (event.key === 'e' || event.key === 'E' || event.key === 'Backspace') {
    select('erase');
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
    button.append(swatch, label);
    button.addEventListener('click', () => select(def.kind));
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

growEl.addEventListener('click', () => {
  town = growTown((Math.random() * 1e9) | 0);
  clicks = 0;
  world.setSeed(town.seed);
  found.clear();
  recent = [];
  resolve(true);
  syncPanel();
  save();
});

clearEl.addEventListener('click', () => {
  town = { seed: town.seed, blocks: new Map() };
  clicks = 0;
  found.clear();
  recent = [];
  resolve(false);
  syncPanel();
  save();
});

shareEl.addEventListener('click', () => {
  const payload = encodeTown(town);
  const url = shareUrl(payload);
  history.replaceState(null, '', `#p=${payload}`);
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

renderPalette();

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

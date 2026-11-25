/** Three saved towns, kept in the browser: enough to try ideas without losing the last one. */

import { BlockKind } from './grid';

export interface SlotData {
  seed: number;
  blocks: [number, number, BlockKind, number, number?][];
  found: string[];
  clicks: number;
  savedAt: number;
}

const SLOTS_KEY = 'ciudad-pequena.slots.v1';
export const SLOT_COUNT = 3;

export function loadSlots(): Array<SlotData | null> {
  const empty: Array<SlotData | null> = Array.from({ length: SLOT_COUNT }, () => null);
  try {
    const raw = localStorage.getItem(SLOTS_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return empty;
    return empty.map((_, index) => {
      const entry = parsed[index] as SlotData | undefined;
      if (!entry || typeof entry.seed !== 'number' || !Array.isArray(entry.blocks)) return null;
      return {
        seed: entry.seed,
        blocks: entry.blocks.filter((b) => Array.isArray(b) && b.length >= 4) as SlotData['blocks'],
        found: Array.isArray(entry.found) ? entry.found.filter((f): f is string => typeof f === 'string') : [],
        clicks: typeof entry.clicks === 'number' ? entry.clicks : 0,
        savedAt: typeof entry.savedAt === 'number' ? entry.savedAt : Date.now(),
      };
    });
  } catch {
    return empty;
  }
}

export function persistSlots(slots: Array<SlotData | null>): void {
  try {
    localStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
  } catch {
    /* Storage full or blocked: the towns still work until the page closes. */
  }
}

export interface SavesOptions {
  slots: Array<SlotData | null>;
  current: () => SlotData;
  label: (data: SlotData) => string;
  onLoad: (data: SlotData) => void;
  onChange: (slots: Array<SlotData | null>) => void;
}

function describe(data: SlotData, label: (data: SlotData) => string): string {
  const when = new Date(data.savedAt);
  const day = when.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return `${label(data)} · ${day}`;
}

export function openSaves(options: SavesOptions): void {
  let slots = options.slots;

  const overlay = document.createElement('div');
  overlay.className = 'lc-guide lc-saves';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Pueblos guardados');

  const card = document.createElement('div');
  card.className = 'lc-guide-card';

  const close = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'lc-guide-close';
  closeButton.textContent = 'Cerrar';
  closeButton.addEventListener('click', close);

  const title = document.createElement('h2');
  title.textContent = 'Pueblos guardados';

  const lead = document.createElement('p');
  lead.className = 'lc-lead';
  lead.textContent = 'Tres huecos en este navegador. Guardar pisa lo que hubiera en el hueco.';

  const list = document.createElement('div');
  list.className = 'lc-saves-list';

  const render = (): void => {
    list.textContent = '';
    slots.forEach((slot, index) => {
      const row = document.createElement('div');
      row.className = 'lc-saves-row';

      const info = document.createElement('div');
      info.className = 'lc-saves-info';
      const name = document.createElement('strong');
      name.textContent = slot ? describe(slot, options.label) : `Hueco ${index + 1} · vacío`;
      const meta = document.createElement('span');
      meta.textContent = slot ? `${slot.blocks.length} bloques · ${slot.found.length} hallazgos` : 'Guarda aquí el pueblo que tienes ahora.';
      info.append(name, meta);

      const actions = document.createElement('div');
      actions.className = 'lc-saves-actions';

      const store = document.createElement('button');
      store.type = 'button';
      store.textContent = 'Guardar';
      store.title = `Guardar el pueblo actual en el hueco ${index + 1}`;
      store.addEventListener('click', () => {
        slots = slots.slice();
        slots[index] = options.current();
        options.onChange(slots);
        render();
      });

      const load = document.createElement('button');
      load.type = 'button';
      load.textContent = 'Cargar';
      load.disabled = !slot;
      load.addEventListener('click', () => {
        if (!slot) return;
        options.onLoad(slot);
        close();
      });

      const drop = document.createElement('button');
      drop.type = 'button';
      drop.className = 'lc-quiet';
      drop.textContent = 'Borrar';
      drop.disabled = !slot;
      drop.addEventListener('click', () => {
        slots = slots.slice();
        slots[index] = null;
        options.onChange(slots);
        render();
      });

      actions.append(store, load, drop);
      row.append(info, actions);
      list.append(row);
    });
  };

  render();
  card.append(closeButton, title, lead, list);
  overlay.append(card);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  document.body.append(overlay);
}

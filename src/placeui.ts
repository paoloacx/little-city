/**
 * The little window that turns a real address into a town: search by name or
 * use the browser's location, then hand the place back to main.
 */

import { DEFAULT_SIZE, Place, loadPlace, searchPlace } from './place';

const SIZES = [250, 400, 600, 900];

export function openPlaceDialog(onPick: (place: Place) => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'lc-guide lc-place';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Un lugar de verdad');

  const card = document.createElement('div');
  card.className = 'lc-guide-card';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'lc-guide-close';
  close.textContent = 'Cerrar';

  const title = document.createElement('h2');
  title.textContent = 'Un barrio de verdad';

  const lead = document.createElement('p');
  lead.className = 'lc-lead';
  lead.textContent =
    'Busca una dirección o usa tu ubicación: el pueblo se dibuja sobre las calles, los edificios y el agua que hay de verdad en ese sitio.';

  const form = document.createElement('form');
  form.className = 'lc-place-form';

  const input = document.createElement('input');
  input.type = 'search';
  input.name = 'lugar';
  input.placeholder = 'Rúa de Manuel Cominges, Vigo';
  input.required = true;
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Dirección o lugar');

  const sizeLabel = document.createElement('label');
  sizeLabel.className = 'lc-place-size';
  sizeLabel.textContent = 'Ancho';
  const sizeSelect = document.createElement('select');
  for (const metres of SIZES) {
    const option = document.createElement('option');
    option.value = String(metres);
    option.textContent = `${metres} m`;
    if (metres === DEFAULT_SIZE) option.selected = true;
    sizeSelect.append(option);
  }
  sizeLabel.append(sizeSelect);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Buscar';

  const locate = document.createElement('button');
  locate.type = 'button';
  locate.className = 'lc-quiet';
  locate.textContent = 'Mi ubicación';

  form.append(input, sizeLabel, submit, locate);

  const status = document.createElement('p');
  status.className = 'lc-place-status';
  status.setAttribute('aria-live', 'polite');

  const results = document.createElement('div');
  results.className = 'lc-place-results';

  const credit = document.createElement('p');
  credit.className = 'lc-place-credit';
  credit.textContent = 'Datos del mapa: © OpenStreetMap contributors (ODbL). Tu dirección se envía a overpass-api.de solo para dibujarla.';

  card.append(close, title, lead, form, status, results, credit);
  overlay.append(card);
  document.body.append(overlay);

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') dismiss();
  };
  const dismiss = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  close.addEventListener('click', dismiss);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) dismiss();
  });
  document.addEventListener('keydown', onKey);
  input.focus();

  const size = (): number => Number(sizeSelect.value) || DEFAULT_SIZE;

  const busy = (message: string): void => {
    status.textContent = message;
    results.replaceChildren();
    submit.disabled = true;
    locate.disabled = true;
  };
  const ready = (): void => {
    submit.disabled = false;
    locate.disabled = false;
  };

  const draw = async (lat: number, lon: number, name: string): Promise<void> => {
    busy(`Dibujando ${name}…`);
    try {
      const place = await loadPlace(lat, lon, size(), name, (message) => {
        status.textContent = message;
      });
      if (place.blocks.length === 0 && !place.mask.some((row) => row.some((land) => !land))) {
        status.textContent = 'En ese cuadrado no hay nada que dibujar. Prueba un ancho mayor o otro punto.';
        ready();
        return;
      }
      dismiss();
      onPick(place);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'No se pudo leer el mapa.';
      ready();
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    busy('Buscando el sitio…');
    try {
      const hits = await searchPlace(query);
      if (hits.length === 0) {
        status.textContent = 'No encuentro ese sitio. Prueba con la calle y la ciudad.';
        ready();
        return;
      }
      status.textContent = 'Elige el sitio:';
      ready();
      results.replaceChildren(
        ...hits.map((hit) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'lc-place-hit';
          button.textContent = hit.name;
          button.title = `${hit.lat.toFixed(4)}, ${hit.lon.toFixed(4)}`;
          button.addEventListener('click', () => void draw(hit.lat, hit.lon, hit.name));
          return button;
        }),
      );
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'No se pudo buscar.';
      ready();
    }
  });

  locate.addEventListener('click', () => {
    if (!('geolocation' in navigator)) {
      status.textContent = 'Este navegador no sabe dónde estás.';
      return;
    }
    busy('Preguntando al navegador dónde estás…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void draw(position.coords.latitude, position.coords.longitude, 'Mi barrio');
      },
      () => {
        status.textContent = 'Sin permiso de ubicación: escribe la dirección a mano.';
        ready();
      },
      { timeout: 8000 },
    );
  });
}

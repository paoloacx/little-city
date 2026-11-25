/** The first visit: four things worth knowing before placing anything. */

const INTRO_KEY = 'ciudad-pequena.intro';

const TIPS: Array<[string, string]> = [
  ['Cinco alturas', 'Toca la misma casilla otra vez: sube un piso hasta cinco. Nada se rompe al insistir.'],
  ['Todo se mezcla', 'Lo que sale depende de los vecinos: casa junto a torre, jardín junto a plaza, campo junto a jardín.'],
  ['Se desbloquea jugando', 'Campo, muelle, molino, jardín y muralla se ganan con hallazgos. La paleta enseña cuántos faltan.'],
  ['Pincel y deshacer', 'Arrastra con el pincel para pintar varias casillas; Ctrl+Z deshace. El clic derecho sube a cinco de golpe.'],
];

export function introSeen(): boolean {
  try {
    return localStorage.getItem(INTRO_KEY) === 'ok';
  } catch {
    return true;
  }
}

export function openIntro(onClose: () => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'lc-guide lc-intro';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Cómo se juega');

  const card = document.createElement('div');
  card.className = 'lc-guide-card';

  const title = document.createElement('h2');
  title.textContent = 'Cuatro cosas y a construir';

  const list = document.createElement('ul');
  list.className = 'lc-intro-list';
  for (const [head, text] of TIPS) {
    const item = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = head;
    const p = document.createElement('span');
    p.textContent = text;
    item.append(strong, p);
    list.append(item);
  }

  const start = document.createElement('button');
  start.type = 'button';
  start.className = 'lc-guide-close lc-intro-start';
  start.textContent = 'A jugar';

  const close = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    try {
      localStorage.setItem(INTRO_KEY, 'ok');
    } catch {
      /* Storage blocked: the card just shows again next time. */
    }
    onClose();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' || event.key === 'Enter') close();
  };

  start.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', onKey);

  card.append(title, list, start);
  overlay.append(card);
  document.body.append(overlay);
}

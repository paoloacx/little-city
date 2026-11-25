/** The guide: every role the town can hold, and whether you have met it yet. */

import { ROLES, SPECIAL_ROLES, Role } from './rules';

const BASE_ROLES: Role[] = (Object.keys(ROLES) as Role[]).filter((role) => !ROLES[role].special);

export function openGuide(found: Set<string>): void {
  const overlay = document.createElement('div');
  overlay.className = 'lc-guide';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Guía de la ciudad');

  const card = document.createElement('div');
  card.className = 'lc-guide-card';

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') dismiss();
  };
  const dismiss = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'lc-guide-close';
  close.textContent = 'Cerrar';
  close.addEventListener('click', dismiss);

  const title = document.createElement('h2');
  title.textContent = `Guía: ${found.size} de ${SPECIAL_ROLES.length} hallazgos`;

  const lead = document.createElement('p');
  lead.className = 'lc-lead';
  lead.textContent = 'Los hallazgos salen solos al juntar bloques. Los que faltan quedan en gris.';

  card.append(close, title, lead);

  const special = document.createElement('h3');
  special.textContent = 'Hallazgos';
  card.append(special, list(SPECIAL_ROLES, found));

  const base = document.createElement('h3');
  base.textContent = 'Bloques base';
  card.append(base, list(BASE_ROLES, found));

  overlay.append(card);
  document.body.append(overlay);

  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) dismiss();
  });
  close.focus();
}

function list(roles: Role[], found: Set<string>): HTMLUListElement {
  const ul = document.createElement('ul');
  for (const role of roles) {
    const def = ROLES[role];
    const met = def.special ? found.has(role) : true;
    const item = document.createElement('li');
    if (!met) item.className = 'locked';
    if (met && def.special) item.className = 'found';

    const mark = document.createElement('span');
    mark.className = 'mark';
    mark.textContent = met ? '✓' : '?';

    const text = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = def.label;
    const how = document.createElement('small');
    how.textContent = def.how;
    text.append(name, how);

    item.append(mark, text);
    ul.append(item);
  }
  return ul;
}

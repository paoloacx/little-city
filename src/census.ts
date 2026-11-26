/**
 * The census: how many people live in the town, read out of what is built and
 * how tall it is. A house of one storey holds a family; every floor above it
 * holds another. A town of mills and fields holds nobody — there is nowhere to
 * sleep — which is the whole point of the count: it says whether you built a
 * place to live or only a place to work.
 */

import { Resolved } from './rules';

/**
 * People behind each facade on its first floor. Roles that are not here house
 * nobody: fields, mills, streets, gardens, walls.
 */
const HEADS: Partial<Record<string, number>> = {
  house: 4,
  townhouse: 5,
  manor: 8,
  tenement: 14,
  palace: 20,
  cottage: 4,
  villa: 6,
  fisherhouse: 4,
  towerhouse: 6,
  millhouse: 4,
  inn: 7,
  shop: 3,
  stall: 1,
  smithy: 3,
  schoolhouse: 2,
  townhall: 2,
  library: 1,
  chapel: 1,
  cathedral: 3,
  lighthouse: 2,
  boathouse: 2,
  warehouse: 1,
  keep: 8,
  citadel: 14,
  fortress: 10,
  alcazar: 16,
  watchtower: 3,
  gatehouse: 2,
  bastion: 4,
  rampart: 1,
  belltower: 1,
  clocktower: 1,
  observatory: 1,
  greattower: 2,
  spire: 1,
  dovecote: 1,
};

/**
 * Extra people each further storey holds, on top of `HEADS`. Tall things are
 * lived in: a five-storey palace is not five times a cottage on paper, but it
 * is a lot more than one.
 */
const PER_STOREY: Partial<Record<string, number>> = {
  house: 2,
  townhouse: 2,
  manor: 2,
  tenement: 2,
  palace: 3,
  towerhouse: 1,
  keep: 1,
  citadel: 1,
  fortress: 1,
  alcazar: 1,
  watchtower: 1,
  inn: 1,
};

/** People in one cell: a dwelling, a workshop with a family over it, or nobody. */
export function heads(cell: Resolved): number {
  const base = HEADS[cell.role] ?? 0;
  if (base === 0) return 0;
  const extra = Math.max(0, cell.storeys - 1);
  return base + extra * (PER_STOREY[cell.role] ?? 0);
}

/** The whole town: every cell added up. */
export function population(resolved: Map<string, Resolved>): number {
  let people = 0;
  for (const cell of resolved.values()) people += heads(cell);
  return people;
}

/** How many figures of the crowd the town can carry: soft caps for phones. */
export function crowdSize(people: number, crowd: number): { walkers: number; idlers: number } {
  if (people <= 0) return { walkers: 0, idlers: 0 };
  return {
    walkers: Math.min(28, Math.max(1, Math.round(people * 0.16 * crowd))),
    idlers: Math.min(22, Math.max(people >= 12 ? 1 : 0, Math.round(people * 0.09 * crowd))),
  };
}

import type { DataSource, EntityManager } from 'typeorm';
import { ConflictError } from '../errors';
import { LedgerEntity } from '../entity/claim/LedgerEntity';

const MAX_HIERARCHY_DEPTH = 5;

// Evidence dedupes on (claimId, url), so one source filed once with a trailing
// slash and once without counted twice towards corroboration. Only the trailing
// slash is trimmed: case and query strings can pick out a different page.
export const normalizeEvidenceUrl = (url: string): string => {
  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/\/+$/, '');

    // A bare origin has nothing but the slash, and dropping it would leave the
    // url without a path at all.
    if (!pathname || pathname === parsed.pathname) {
      return trimmed;
    }

    parsed.pathname = pathname;

    return parsed.toString();
  } catch {
    return trimmed;
  }
};

// The canonical name and every alias, lowercased into one array. Declared as an
// immutable function so a GIN index can be built over it: matching with && then
// answers the whole lookup from the index, where the equivalent lower() and
// unnest() predicates force a sequential scan.
const searchNames =
  'ledger_entity_search_names(le."canonicalName", le."aliases")';

export const findLedgerEntitiesByName = ({
  con,
  names,
}: {
  con: DataSource | EntityManager;
  names: string[];
}): Promise<LedgerEntity[]> =>
  con
    .getRepository(LedgerEntity)
    .createQueryBuilder('le')
    .select([
      'le.id',
      'le.canonicalName',
      'le.kind',
      'le.aliases',
      'le.parentId',
    ])
    .where(`${searchNames} && :names`, {
      names: names.map((name) => name.trim().toLowerCase()),
    })
    .getMany();

// The extractor names the replacement as a string, and a name resolves to an
// entity only if one already exists: an entity minted here would carry no claim
// of its own, and entities are demand-driven. Ambiguity resolves to null rather
// than a guess — a wrong displacement link points a reader at the wrong
// replacement, which is worse than an absent one, so it goes to review instead.
export const resolveSupersededByEntityId = async ({
  con,
  name,
}: {
  con: DataSource | EntityManager;
  name: string | null;
}): Promise<string | null> => {
  if (!name) {
    return null;
  }

  const matches = await findLedgerEntitiesByName({ con, names: [name] });

  return matches.length === 1 ? matches[0].id : null;
};

// Every name an entity answers to must be unique across the whole ledger,
// otherwise a claim can be filed against two different rows for one artifact.
export const assertLedgerNamesAvailable = async ({
  con,
  names,
  excludeId,
}: {
  con: DataSource | EntityManager;
  names: string[];
  excludeId?: string;
}): Promise<void> => {
  const taken = (await findLedgerEntitiesByName({ con, names })).filter(
    (entity) => entity.id !== excludeId,
  );

  if (taken.length) {
    throw new ConflictError(
      `Ledger entity name already in use by "${taken[0].canonicalName}"`,
    );
  }
};

// Claims filed against a child entity answer questions about its parent, so a
// query for "next.js" must also return claims about "next.js app router".
export const expandLedgerEntityIds = async ({
  con,
  entityIds,
}: {
  con: DataSource | EntityManager;
  entityIds: string[];
}): Promise<string[]> => {
  const collected = new Set(entityIds);
  let frontier = entityIds;

  for (let depth = 0; depth < MAX_HIERARCHY_DEPTH && frontier.length; depth++) {
    const children = await con
      .getRepository(LedgerEntity)
      .createQueryBuilder('le')
      .select(['le.id'])
      .where('le."parentId" = ANY(:parentIds)', { parentIds: frontier })
      .getMany();

    frontier = children.map(({ id }) => id).filter((id) => !collected.has(id));
    frontier.forEach((id) => collected.add(id));
  }

  return [...collected];
};

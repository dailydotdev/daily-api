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

// The canonical name and every alias — code-only included, since a name is
// unique across the whole ledger no matter which array holds it — lowercased
// into one array. Declared as an immutable function so a GIN index can be
// built over it: matching with && then answers the whole lookup from the
// index, where the equivalent lower() and unnest() predicates force a
// sequential scan.
const searchNames =
  'ledger_entity_search_names(le."canonicalName", le."aliases", le."codeOnlyAliases")';

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
      'le.codeOnlyAliases',
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
// Anything that qualifies a name: whitespace, and the punctuation registry
// identifiers are built from (`app-router`, `laravel/framework`, `@scope/pkg`).
const NAME_QUALIFIER = /[-\s/@._:]/;

// A single-word alias of a qualified name drops the very word that makes it
// unique — "Konnect" for "Kong Konnect", "Neo" for "Pulumi Neo". Uniqueness
// INSIDE the ledger does not make such a name unambiguous in the world, so it
// matches products the ledger has never heard of and the link points a reader
// at an unrelated replacement. Machine identifiers are exempt: they carry their
// own qualifier and are what a lockfile actually says.
const isUnderqualifiedAlias = ({
  entity,
  name,
}: {
  entity: LedgerEntity;
  name: string;
}): boolean => {
  const canonicalName = entity.canonicalName.trim();

  if (name === canonicalName.toLowerCase()) {
    return false;
  }

  return !NAME_QUALIFIER.test(name) && NAME_QUALIFIER.test(canonicalName);
};

export const resolveSupersededByEntityId = async ({
  con,
  name,
  statement,
}: {
  con: DataSource | EntityManager;
  name: string | null;
  statement?: string | null;
}): Promise<string | null> => {
  if (!name) {
    return null;
  }

  const matches = await findLedgerEntitiesByName({ con, names: [name] });

  if (matches.length !== 1) {
    return null;
  }

  const [entity] = matches;
  const matchedName = name.trim().toLowerCase();

  // The claim naming the replacement in full is the corroboration a bare word
  // cannot supply on its own. Without it the link stays empty and goes to
  // review, which is the same answer ambiguity already gets.
  if (
    isUnderqualifiedAlias({ entity, name: matchedName }) &&
    !(statement ?? '')
      .toLowerCase()
      .includes(entity.canonicalName.trim().toLowerCase())
  ) {
    return null;
  }

  return entity.id;
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

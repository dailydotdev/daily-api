import type { DataSource, EntityManager } from 'typeorm';
import { ConflictError } from '../errors';
import { LedgerEntity } from '../entity/claim/LedgerEntity';

const MAX_HIERARCHY_DEPTH = 5;

export const findLedgerEntitiesByName = ({
  con,
  names,
}: {
  con: DataSource | EntityManager;
  names: string[];
}): Promise<LedgerEntity[]> => {
  const normalized = names.map((name) => name.trim().toLowerCase());

  return con
    .getRepository(LedgerEntity)
    .createQueryBuilder('le')
    .select([
      'le.id',
      'le.canonicalName',
      'le.kind',
      'le.aliases',
      'le.parentId',
    ])
    .where('lower(le."canonicalName") = ANY(:names)', { names: normalized })
    .orWhere(
      'EXISTS (SELECT 1 FROM unnest(le."aliases") alias WHERE lower(alias) = ANY(:names))',
      { names: normalized },
    )
    .getMany();
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

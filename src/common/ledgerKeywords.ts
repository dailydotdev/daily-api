import type { DataSource, EntityManager } from 'typeorm';
import { LedgerEntity } from '../entity/claim/LedgerEntity';
import { Keyword, KeywordStatus } from '../entity/Keyword';

// `ledger_entity.keywordValue` is a soft reference to `keyword.value`, and it is
// what connects a ledger entity to the corpus's own measure of developer
// attention: how many posts carry that tag. Nothing can be demand-weighted
// without it — not the describe queue's ordering, not rot-bench's registered
// sampling rule, not "which entities were hot in month M".
//
// The link only ever reaches the head of the ledger, and that is correct rather
// than a shortfall: the allowed keyword vocabulary is a curated ~1k tags, so at
// most ~500 of 16k entities can match. Those are exactly the entities the
// weighting is about.
//
// Deliberately NOT matched: `pending` and `deny` keywords. `pending` is the
// 2.4M-row raw tail every post drags in, and matching it would attach noise to
// the field a sampling rule reads.
const MATCHABLE = [KeywordStatus.Allow, KeywordStatus.Synonym];

export type KeywordLink = {
  entityId: string;
  canonicalName: string;
  keywordValue: string;
  // How the name reached the keyword, so a reviewer can judge the weaker routes
  // without re-deriving them.
  via: 'canonical' | 'slug' | 'synonym' | 'alias';
};

// A keyword value is a lowercase slug, so a canonical name reaches it either
// directly or with its spaces collapsed to dashes ("Visual Studio Code" →
// "visual-studio-code").
const nameForms = (canonicalName: string): string[] => {
  const lowered = canonicalName.trim().toLowerCase();
  const slug = lowered.replace(/\s+/g, '-');

  return lowered === slug ? [lowered] : [lowered, slug];
};

// Resolution order is strongest-evidence-first: the entity's own name beats its
// slug, which beats a synonym redirect, which beats an alias. An alias is the
// weakest because aliases are the surface forms a post happened to use.
const rank: Record<KeywordLink['via'], number> = {
  canonical: 0,
  slug: 1,
  synonym: 2,
  alias: 3,
};

export const findEntityKeywordLinks = async ({
  con,
}: {
  con: DataSource | EntityManager;
}): Promise<KeywordLink[]> => {
  const entities = await con
    .getRepository(LedgerEntity)
    .createQueryBuilder('le')
    .select(['le.id', 'le.canonicalName', 'le.aliases', 'le.codeOnlyAliases'])
    .where('le."keywordValue" IS NULL')
    .getMany();

  if (!entities.length) {
    return [];
  }

  const keywords = await con
    .getRepository(Keyword)
    .createQueryBuilder('k')
    .select(['k.value', 'k.status', 'k.synonym'])
    .where('k.status IN (:...statuses)', { statuses: MATCHABLE })
    .getMany();

  const byValue = new Map(keywords.map((k) => [k.value, k]));

  // A synonym is only useful when it lands on an allowed keyword; a redirect
  // into a denied or pending value is a dead end, not a link.
  const resolve = (value: string): string | null => {
    const keyword = byValue.get(value);

    if (!keyword) {
      return null;
    }

    if (keyword.status === KeywordStatus.Allow) {
      return keyword.value;
    }

    const target = keyword.synonym ? byValue.get(keyword.synonym) : undefined;

    return target?.status === KeywordStatus.Allow ? target.value : null;
  };

  const candidates: KeywordLink[] = [];

  entities.forEach((entity) => {
    const forms = nameForms(entity.canonicalName);

    forms.forEach((form, index) => {
      const value = resolve(form);

      if (!value) {
        return;
      }

      const direct = byValue.get(form)?.status === KeywordStatus.Allow;
      candidates.push({
        entityId: entity.id,
        canonicalName: entity.canonicalName,
        keywordValue: value,
        via: direct ? (index === 0 ? 'canonical' : 'slug') : 'synonym',
      });
    });

    [...entity.aliases, ...entity.codeOnlyAliases].forEach((alias) => {
      const value = resolve(alias.trim().toLowerCase());

      if (value) {
        candidates.push({
          entityId: entity.id,
          canonicalName: entity.canonicalName,
          keywordValue: value,
          via: 'alias',
        });
      }
    });
  });

  // One keyword, one entity. Two entities competing for a tag means the tag
  // cannot say which one the corpus was paying attention to, so neither is
  // linked and the ambiguity is left visible rather than resolved by luck.
  const byKeyword = new Map<string, KeywordLink[]>();
  const bestPerEntity = new Map<string, KeywordLink>();

  candidates.forEach((candidate) => {
    const held = bestPerEntity.get(candidate.entityId);

    if (!held || rank[candidate.via] < rank[held.via]) {
      bestPerEntity.set(candidate.entityId, candidate);
    }
  });

  [...bestPerEntity.values()].forEach((link) => {
    byKeyword.set(link.keywordValue, [
      ...(byKeyword.get(link.keywordValue) ?? []),
      link,
    ]);
  });

  const taken = new Set(
    (
      await con
        .getRepository(LedgerEntity)
        .createQueryBuilder('le')
        .select('le."keywordValue"', 'keywordValue')
        .where('le."keywordValue" IS NOT NULL')
        .getRawMany<{ keywordValue: string }>()
    ).map(({ keywordValue }) => keywordValue),
  );

  return [...byKeyword.entries()]
    .filter(([value, links]) => links.length === 1 && !taken.has(value))
    .map(([, links]) => links[0]);
};

export const linkEntityKeywords = async ({
  con,
}: {
  con: DataSource | EntityManager;
}): Promise<number> => {
  const links = await findEntityKeywordLinks({ con });

  // Grouped by keyword so one UPDATE covers each value; the set is small enough
  // that this stays a handful of statements.
  for (const link of links) {
    await con
      .getRepository(LedgerEntity)
      .update(link.entityId, { keywordValue: link.keywordValue });
  }

  return links.length;
};

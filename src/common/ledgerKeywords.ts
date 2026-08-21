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
// than a shortfall: the allowed keyword vocabulary is a curated ~1k tags, so
// only a few hundred of 16k entities can match. Those are exactly the entities
// the weighting is about.
//
// ONLY EXACT NAME MATCHES AGAINST AN ALLOWED TAG. The two looser routes were
// built, measured against prod, and deleted:
//
// - **Synonyms are category rollups, not spellings.** The taxonomy redirects
//   niche terms into broad buckets: `playstation` and `confluence` both point at
//   `tech-news` (116,149 posts), `llvm` at `general-programming` (85,555),
//   `ffmpeg` at `backend`, `mlflow` at `machine-learning`. 339 of 340 redirects
//   were of this shape and exactly one was a spelling variant. Following them
//   would credit an entity with a whole category's attention, which is worse
//   than leaving the field null — a sampling rule trusts this number.
// - **Aliases mis-link roughly one in six.** `Stratis Storage` reaches
//   `blockchain` (a different Stratis), `Progress Telerik` reaches `xamarin`,
//   `Xanadu Aurora` reaches `aurora`. An alias is the surface form some post
//   used, which is not evidence that the tag counts this entity.
//
// Both remain available to an operator by hand via `/entities/update`, where a
// human can see that the tag really does count this entity.
const nameForms = (canonicalName: string): string[] => {
  const lowered = canonicalName.trim().toLowerCase().replace(/\s+/g, ' ');
  const slug = lowered.replace(/ /g, '-');

  return lowered === slug ? [lowered] : [lowered, slug];
};

export type KeywordLink = {
  entityId: string;
  canonicalName: string;
  keywordValue: string;
  via: 'canonical' | 'slug';
};

export const findEntityKeywordLinks = async ({
  con,
}: {
  con: DataSource | EntityManager;
}): Promise<KeywordLink[]> => {
  const entities = await con
    .getRepository(LedgerEntity)
    .createQueryBuilder('le')
    .select(['le.id', 'le.canonicalName'])
    .where('le."keywordValue" IS NULL')
    .getMany();

  if (!entities.length) {
    return [];
  }

  const allowed = new Set(
    (
      await con
        .getRepository(Keyword)
        .createQueryBuilder('k')
        .select('k.value', 'value')
        .where('k.status = :status', { status: KeywordStatus.Allow })
        .getRawMany<{ value: string }>()
    ).map(({ value }) => value),
  );

  const candidates: KeywordLink[] = [];

  entities.forEach((entity) => {
    nameForms(entity.canonicalName).forEach((form, index) => {
      if (allowed.has(form)) {
        candidates.push({
          entityId: entity.id,
          canonicalName: entity.canonicalName,
          keywordValue: form,
          via: index === 0 ? 'canonical' : 'slug',
        });
      }
    });
  });

  // One entity keeps at most one link, and its own name beats its slug.
  const bestPerEntity = new Map<string, KeywordLink>();

  candidates.forEach((candidate) => {
    if (!bestPerEntity.has(candidate.entityId)) {
      bestPerEntity.set(candidate.entityId, candidate);
    }
  });

  // One keyword, one entity. Two entities competing for a tag means the tag
  // cannot say which one the corpus was paying attention to, so neither is
  // linked and the ambiguity stays visible rather than resolved by luck.
  const byKeyword = new Map<string, KeywordLink[]>();

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

  for (const link of links) {
    await con
      .getRepository(LedgerEntity)
      .update(link.entityId, { keywordValue: link.keywordValue });
  }

  return links.length;
};

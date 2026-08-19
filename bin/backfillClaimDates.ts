import '../src/config';
import { In } from 'typeorm';
import createOrGetConnection from '../src/db';
import { Claim, ClaimDateSource } from '../src/entity/claim/Claim';

// Half the backfilled ledger carries no extracted date, and the claim query
// used to stand in the row's own "createdAt" — one day for every backfilled
// claim. The posts a claim cites are dated, so the earliest of them is a far
// better answer: an upper bound on when the change landed, which "dateSource"
// records so a month window can leave it out.
(async (): Promise<void> => {
  const dryRun = process.argv.includes('--dry-run');
  const con = await createOrGetConnection();

  const cited = await con
    .getRepository(Claim)
    .createQueryBuilder('c')
    .select('c.id', 'id')
    .addSelect(
      `MIN(COALESCE(e."publishedAt", p."publishedAt"))::date::text`,
      'published',
    )
    .addSelect(`MIN(p."createdAt")::date::text`, 'crawled')
    .innerJoin('claim_evidence', 'e', 'e."claimId" = c.id')
    .leftJoin('post', 'p', 'p.id = e."postId"')
    .where('c."effectiveDate" IS NULL')
    .groupBy('c.id')
    .getRawMany<{
      id: string;
      published: string | null;
      crawled: string | null;
    }>();

  // Evidence dates cluster hard, so one update per distinct date beats one per
  // claim by three orders of magnitude.
  const groups = new Map<string, string[]>();

  cited.forEach(({ id, published, crawled }) => {
    const effectiveDate = published ?? crawled;

    if (!effectiveDate) {
      return;
    }

    const source = published
      ? ClaimDateSource.EvidencePublished
      : ClaimDateSource.EvidenceCrawled;
    const key = `${effectiveDate}|${source}`;

    groups.set(key, [...(groups.get(key) ?? []), id]);
  });

  const datable = [...groups.values()].reduce(
    (sum, ids) => sum + ids.length,
    0,
  );
  console.log(
    `${cited.length} undated claims cite evidence, ${datable} datable across ${groups.size} dates`,
  );

  if (dryRun) {
    console.table(
      [...groups.entries()]
        .slice(0, 20)
        .map(([key, ids]) => ({ key, claims: ids.length })),
    );
    process.exit(0);
  }

  let done = 0;

  for (const [key, ids] of groups) {
    const [effectiveDate, dateSource] = key.split('|');

    await con
      .getRepository(Claim)
      .update(
        { id: In(ids) },
        { effectiveDate, dateSource: dateSource as ClaimDateSource },
      );

    done += ids.length;
    console.log(`${done}/${datable}`);
  }

  process.exit(0);
})();

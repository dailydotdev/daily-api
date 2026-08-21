import { Cron } from './cron';
import { Claim, ClaimDateSource, ClaimStatus } from '../entity/claim/Claim';
import {
  ClaimCandidate,
  ClaimCandidateStatus,
} from '../entity/claim/ClaimCandidate';
import { evidenceDerivedDate } from '../common/claimLedger';
import { linkEntityKeywords } from '../common/ledgerKeywords';

// Claims a consumer actually reads. `rejected` rows are merge-absorbed: their
// evidence moved to the surviving claim, so they are undatable by construction
// and counting them makes a finished backfill look like a permanent backlog.
const CONSUMABLE = [
  ClaimStatus.Candidate,
  ClaimStatus.Corroborated,
  ClaimStatus.Verified,
];

// Thresholds are the point of this cron. Every ledger maintenance pass is a
// script somebody remembers to run, and a lane that has stopped looks exactly
// like a lane with nothing to do — the failure already recorded for the
// upstream worker in product-wiki/claim-ledger.md §6, which recurred one layer
// down when a review lane sat quiet for 16 hours and read as healthy.
const REVIEW_STALL_HOURS = 12;
const PENDING_POOL_WARN = 750;
const UNDATED_WARN = 100;
const UNSIGNED_WARN = 500;

// Claims that gained evidence after they were created: the resolve route dates
// a claim from the post it cites at birth, so this only ever sees rows that
// were undatable then and became datable since.
const dateFromEvidence = async (con: Parameters<Cron['handler']>[0]) => {
  const undated = await con
    .getRepository(Claim)
    .createQueryBuilder('c')
    .select('c.id', 'id')
    .addSelect('MIN(COALESCE(e."publishedAt", p."publishedAt"))', 'publishedAt')
    .addSelect('MIN(p."createdAt")', 'createdAt')
    .innerJoin('claim_evidence', 'e', 'e."claimId" = c.id')
    .leftJoin('post', 'p', 'p.id = e."postId"')
    .where('c."effectiveDate" IS NULL')
    .andWhere('c.status IN (:...statuses)', { statuses: CONSUMABLE })
    .groupBy('c.id')
    .getRawMany<{
      id: string;
      publishedAt: Date | null;
      createdAt: Date | null;
    }>();

  // Evidence dates cluster hard, so one UPDATE per distinct (date, source)
  // beats one per claim by orders of magnitude.
  const groups = new Map<string, string[]>();

  undated.forEach((row) => {
    const derived = evidenceDerivedDate(row);

    if (!derived) {
      return;
    }

    const key = `${derived.effectiveDate}|${derived.dateSource}`;
    groups.set(key, [...(groups.get(key) ?? []), row.id]);
  });

  let dated = 0;

  for (const [key, ids] of groups) {
    const [effectiveDate, dateSource] = key.split('|');

    await con.getRepository(Claim).update(ids, {
      effectiveDate,
      dateSource: dateSource as ClaimDateSource,
    });

    dated += ids.length;
  }

  return dated;
};

export const ledgerHygieneCron: Cron = {
  name: 'ledger-hygiene',
  handler: async (con, logger) => {
    const dated = await dateFromEvidence(con);

    // Entities arrive continuously, so the keyword link has to be maintained
    // rather than backfilled once — the same lesson the dating queue taught.
    await linkEntityKeywords({ con });

    const [pending, undated, unsigned, newest] = await Promise.all([
      con
        .getRepository(ClaimCandidate)
        .count({ where: { status: ClaimCandidateStatus.Pending } }),
      con
        .getRepository(Claim)
        .createQueryBuilder('c')
        .where('c."effectiveDate" IS NULL')
        .andWhere('c.status IN (:...statuses)', { statuses: CONSUMABLE })
        .getCount(),
      con
        .getRepository(Claim)
        .createQueryBuilder('c')
        .where('c."signaturesBackfilledAt" IS NULL')
        .andWhere('c.status IN (:...statuses)', { statuses: CONSUMABLE })
        .getCount(),
      con
        .getRepository(Claim)
        .createQueryBuilder('c')
        .select('MAX(c."createdAt")', 'createdAt')
        .getRawOne<{ createdAt: Date | null }>(),
    ]);

    const stalledHours = newest?.createdAt
      ? (Date.now() - new Date(newest.createdAt).getTime()) / (1000 * 60 * 60)
      : null;

    // Only the abnormal is logged: a healthy pass is visible in the data, and a
    // routine success line trains a reader to skim past the one that matters.
    if (
      stalledHours !== null &&
      stalledHours > REVIEW_STALL_HOURS &&
      pending > 0
    ) {
      logger.warn(
        { stalledHours: Math.round(stalledHours), pending },
        'ledger review lane has resolved nothing while candidates wait',
      );
    }

    if (pending > PENDING_POOL_WARN) {
      logger.warn({ pending }, 'ledger pending candidate pool is growing');
    }

    if (undated > UNDATED_WARN) {
      logger.warn(
        { undated, datedThisRun: dated },
        'ledger claims are undated beyond what evidence can repair',
      );
    }

    if (unsigned > UNSIGNED_WARN) {
      logger.warn(
        { unsigned },
        'ledger claims await the signature pass (bin/backfillClaimSignatures.js)',
      );
    }
  },
};

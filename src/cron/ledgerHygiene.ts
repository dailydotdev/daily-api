import { Cron } from './cron';
import { Claim } from '../entity/claim/Claim';
import {
  ClaimCandidate,
  ClaimCandidateStatus,
} from '../entity/claim/ClaimCandidate';
import {
  CONSUMABLE_STATUSES,
  clearPreReleaseDates,
  clearSelfDisplacementLinks,
  dateClaimsFromEvidence,
} from '../common/ledgerHygiene';
import { linkEntityKeywords } from '../common/ledgerKeywords';

// Thresholds are the point of this cron. Every ledger maintenance pass is a
// script somebody remembers to run, and a lane that has stopped looks exactly
// like a lane with nothing to do — the failure already recorded for the
// upstream worker in product-wiki/claim-ledger.md §6, which recurred one layer
// down when a review lane sat quiet for 16 hours and read as healthy.
const REVIEW_STALL_HOURS = 12;
const PENDING_POOL_WARN = 750;
const UNDATED_WARN = 100;
const UNSIGNED_WARN = 500;

export const ledgerHygieneCron: Cron = {
  name: 'ledger-hygiene',
  handler: async (con, logger) => {
    // Each repair is a named rule in src/common/ledgerHygiene.ts; this file
    // only decides what runs and what is worth waking someone for. Every one is
    // here because it RECURS — a defect extraction keeps re-emitting, or a
    // field that goes stale as rows arrive. One-shot repairs belong in bin/.
    const repaired = {
      datedFromEvidence: await dateClaimsFromEvidence(con),
      selfDisplacementCleared: await clearSelfDisplacementLinks(con),
      preReleaseDatesCleared: await clearPreReleaseDates(con),
      keywordsLinked: await linkEntityKeywords({ con }),
    };

    const [pending, undated, unsigned, newest] = await Promise.all([
      con
        .getRepository(ClaimCandidate)
        .count({ where: { status: ClaimCandidateStatus.Pending } }),
      con
        .getRepository(Claim)
        .createQueryBuilder('c')
        .where('c."effectiveDate" IS NULL')
        .andWhere('c.status IN (:...statuses)', {
          statuses: CONSUMABLE_STATUSES,
        })
        .andWhere(
          `(c."versionScope" IS NULL OR lower(c."versionScope") NOT LIKE '%(pre-release)%')`,
        )
        .getCount(),
      con
        .getRepository(Claim)
        .createQueryBuilder('c')
        .where('c."signaturesBackfilledAt" IS NULL')
        .andWhere('c.status IN (:...statuses)', {
          statuses: CONSUMABLE_STATUSES,
        })
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
    // A repair that found something IS abnormal — these defects recur, so a
    // non-zero count is how the upstream cause stays visible.
    const fixed = Object.entries(repaired).filter(([, count]) => count > 0);

    if (fixed.length) {
      logger.warn(Object.fromEntries(fixed), 'ledger hygiene repaired rows');
    }

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
        { undated, datedThisRun: repaired.datedFromEvidence },
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

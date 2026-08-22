import type { DataSource, EntityManager } from 'typeorm';
import { Claim, ClaimStatus } from '../entity/claim/Claim';
import { ClaimEvidenceSourceClass } from '../entity/claim/ClaimEvidence';
import { distinctPublishers, evidencePublisher } from './evidencePublisher';

type Con = DataSource | EntityManager;

// WHAT THIS MODULE GUARANTEES
//
// `ClaimStatus.Corroborated` was an enum value nothing computed. Every claim is
// born `candidate` by `/candidates/resolve` and only an explicit
// `POST /claims/status` moved it, so the status meant "a reviewer got to it",
// not "the evidence supports it" — and the plan-reviewer, which floors at
// `corroborated`, inherited a recall bound set by review capacity.
//
// This module computes it from the evidence pile, and guarantees:
//
//  1. It only ever promotes `candidate` -> `corroborated`. It NEVER demotes,
//     never touches `verified` or `rejected`, and never revisits a claim that is
//     already `corroborated`. `verified` is a property of the REVIEW PERFORMED
//     (playbook §2) and no amount of evidence can earn it — law 1, "corroboration
//     counts NEVER promote to verified".
//  2. `sourceClass` is NOT AN INPUT to the default verdict. See VENDOR CROSS-CLASS
//     below; this is law 3 ("sourceClass upgrades never promote") made structural
//     rather than remembered.
//  3. It is idempotent. A promoted claim is no longer `candidate`, so a second
//     run selects nothing; the verdict itself is a pure function of the evidence.
//
// THE CRITERION, and why this reading of it
//
// A `candidate` claim becomes `corroborated` when its evidence names >= 2
// DISTINCT PUBLISHERS, where a publisher is the registrable domain of the
// evidence url (see `evidencePublisher.ts` for how that identity is built).
//
// The playbook stated this twice and not identically. The §2 heading says
// "**>= 2 independent sources**"; the sentence under it makes the operational
// test "distinct POSTS, not candidate rows", with an RT-mirror carve-out. Those
// are different rules and prod knows the difference: 3,498 candidate claims have
// >= 2 distinct posts, 2,415 have >= 2 distinct publishers, so the reading is
// worth 1,049 claims. The wiki records the question being raised rather than
// settled (§6h, on the Babel claim whose two posts were both babeljs.io).
//
// Settled here as INDEPENDENT PUBLISHERS, for three reasons:
//   - "Independent" is the word in the heading, and one vendor blog posting
//     twice is not independent of itself under any reading.
//   - Precision over recall is the ledger's standing bias (playbook §1), and
//     this is the strictly more precise of the two readings.
//   - The distinct-POSTS test needs the RT carve-out bolted on precisely because
//     it counts mirrors as sources. Publishers subsume that carve-out for free:
//     every retweet already resolves to one x.com.
//
// VENDOR CROSS-CLASS, available and off
//
// product-wiki §3 names "changelog confirms + community reports breakage" the
// strongest signal, which argues for a second branch: >= 1 vendor/registry row
// plus >= 1 other row, even from one publisher. It is implemented below and
// DEFAULT OFF, because measuring it turned a design argument into an easy call:
//
//   - it promotes 20 additional claims today (0.8% on top of 2,415), while
//   - the population it opens up is 1,049 claims that have >= 2 posts from a
//     single publisher, every one of which would promote the moment a row was
//     relabelled `vendor_changelog`.
//
// That relabelling is not hypothetical — bulk reclassification against a
// vendor-primary url pattern set is explicitly sanctioned (playbook §2, law 3,
// Ido 2026-08-18) and law 3 exists because ignoring it once cost 104
// over-promotions. Twenty claims of recall is not worth putting a hard law
// behind an operator's discipline. Flip `allowVendorCrossClass` if that trade
// ever changes; the tests prove both directions.
//
// NO RECENCY FILTER. Open thread 8 pairs corroboration with "claim recency
// filtering", but neither the playbook nor the wiki states what that rule would
// be, and this module will not invent one. The nearest written rule, M1, denies
// PENDING CANDIDATES older than 24 months at review time — a different object at
// a different stage. Corroboration here is time-blind: an old claim with two
// independent publishers is corroborated, and whether a consumer wants it is the
// serving query's `since` filter to decide.

// The classes that speak for the thing itself rather than about it. Used only by
// the off-by-default branch below.
const OFFICIAL_SOURCE_CLASSES: ReadonlySet<string> = new Set([
  ClaimEvidenceSourceClass.VendorChangelog,
  ClaimEvidenceSourceClass.Registry,
]);

export type CorroborationEvidence = {
  url: string;
  sourceClass: ClaimEvidenceSourceClass | string;
};

export type CorroborationReason =
  | 'distinct_publishers'
  | 'vendor_cross_class'
  | 'single_publisher'
  | 'no_independent_evidence';

export type CorroborationVerdict = {
  corroborated: boolean;
  reason: CorroborationReason;
  publishers: string[];
};

// The whole rule, as one pure function over one claim's evidence rows. Every
// caller — cron, backfill, test — goes through this; there is no second copy of
// the criterion anywhere.
export const corroborationVerdict = (
  evidence: CorroborationEvidence[],
  { allowVendorCrossClass = false }: { allowVendorCrossClass?: boolean } = {},
): CorroborationVerdict => {
  const publishers = distinctPublishers(evidence.map(({ url }) => url));

  if (publishers.length >= 2) {
    return { corroborated: true, reason: 'distinct_publishers', publishers };
  }

  // Rows that name no publisher at all (unparseable urls, our own permalinks)
  // are already gone from `publishers`, but they must also not prop up the
  // cross-class branch: a vendor changelog corroborated by a daily.dev
  // Collection is the self-citation the exclusion exists to stop.
  const independent = evidence.filter(({ url }) => evidencePublisher(url));

  if (allowVendorCrossClass && publishers.length === 1) {
    const official = independent.filter(({ sourceClass }) =>
      OFFICIAL_SOURCE_CLASSES.has(sourceClass),
    );
    const other = independent.filter(
      ({ sourceClass }) => !OFFICIAL_SOURCE_CLASSES.has(sourceClass),
    );

    if (official.length >= 1 && other.length >= 1) {
      return { corroborated: true, reason: 'vendor_cross_class', publishers };
    }
  }

  return {
    corroborated: false,
    reason: publishers.length ? 'single_publisher' : 'no_independent_evidence',
    publishers,
  };
};

export type CorroborationPlanRow = {
  claimId: string;
  verdict: CorroborationVerdict;
};

// Which `candidate` claims the criterion promotes, without writing anything.
//
// The status filter is the never-demote guarantee expressed as a WHERE clause
// rather than as care: rows that are already `corroborated`, or that a reviewer
// moved to `verified` or `rejected`, are never even selected, so no bug in the
// verdict below can reach them.
//
// Exported so `bin/backfillClaimCorroboration.ts --dry-run` reports exactly what
// the cron would do, from the same query and the same rule.
export const planClaimCorroboration = async (
  con: Con,
  options: { allowVendorCrossClass?: boolean } = {},
): Promise<CorroborationPlanRow[]> => {
  const rows = await con
    .getRepository(Claim)
    .createQueryBuilder('c')
    .select('c.id', 'id')
    .addSelect(
      `json_agg(json_build_object('url', e.url, 'sourceClass', e."sourceClass"))`,
      'evidence',
    )
    .innerJoin('claim_evidence', 'e', 'e."claimId" = c.id')
    .where('c.status = :status', { status: ClaimStatus.Candidate })
    .groupBy('c.id')
    .getRawMany<{ id: string; evidence: CorroborationEvidence[] }>();

  return rows.map(({ id, evidence }) => ({
    claimId: id,
    verdict: corroborationVerdict(evidence ?? [], options),
  }));
};

// Promote everything the plan says qualifies, and report what happened by
// reason. The update repeats the status filter so a claim a reviewer moved
// between the plan and the write is left alone.
export const corroborateClaims = async (
  con: Con,
  options: { allowVendorCrossClass?: boolean } = {},
): Promise<Record<CorroborationReason, number>> => {
  const plan = await planClaimCorroboration(con, options);
  const counts: Record<CorroborationReason, number> = {
    distinct_publishers: 0,
    vendor_cross_class: 0,
    single_publisher: 0,
    no_independent_evidence: 0,
  };

  plan.forEach(({ verdict }) => {
    counts[verdict.reason] += 1;
  });

  const promote = plan
    .filter(({ verdict }) => verdict.corroborated)
    .map(({ claimId }) => claimId);

  // One UPDATE per chunk rather than per claim: the first prod run promotes
  // thousands of rows and `update(ids, ...)` builds an IN list.
  for (let index = 0; index < promote.length; index += 500) {
    await con
      .getRepository(Claim)
      .createQueryBuilder()
      .update()
      .set({ status: ClaimStatus.Corroborated })
      .whereInIds(promote.slice(index, index + 500))
      .andWhere('status = :status', { status: ClaimStatus.Candidate })
      .execute();
  }

  return counts;
};

import type { DataSource, EntityManager } from 'typeorm';
import { Claim, ClaimDateSource, ClaimStatus } from '../entity/claim/Claim';
import { evidenceDerivedDate } from './claimLedger';

type Con = DataSource | EntityManager;

// Claims a consumer actually reads. `rejected` rows are merge-absorbed: their
// evidence moved to the surviving claim, so they are undatable by construction
// and counting them makes a finished backfill look like a permanent backlog.
export const CONSUMABLE_STATUSES = [
  ClaimStatus.Candidate,
  ClaimStatus.Corroborated,
  ClaimStatus.Verified,
];

// The playbook's R24 marker, and the only sanctioned maturity wording in
// `versionScope` (§13 forbids the rest). A claim about an unreleased line must
// keep `effectiveDate` NULL: nothing bites before GA, so a date here would
// place a change that has not happened.
//
// This is why the check lives next to the dating rules rather than in review
// procedure. The resolve route dates a claim from the post that reports it, so
// a pre-GA claim minted from a dated post would silently acquire a date and
// contradict R24 — leaving the operator to remember a manual null on every
// single one. Encoding it here is what makes that step unnecessary.
const PRE_RELEASE_MARKER = '(pre-release)';

export const isPreReleaseScope = (versionScope: string | null): boolean =>
  !!versionScope && versionScope.toLowerCase().includes(PRE_RELEASE_MARKER);

// Claims that gained evidence after they were created: the resolve route dates
// a claim from the post it cites at birth, so this only ever sees rows that
// were undatable then and became datable since.
export const dateClaimsFromEvidence = async (con: Con): Promise<number> => {
  const undated = await con
    .getRepository(Claim)
    .createQueryBuilder('c')
    .select('c.id', 'id')
    .addSelect('MIN(COALESCE(e."publishedAt", p."publishedAt"))', 'publishedAt')
    .addSelect('MIN(p."createdAt")', 'createdAt')
    .innerJoin('claim_evidence', 'e', 'e."claimId" = c.id')
    .leftJoin('post', 'p', 'p.id = e."postId"')
    .where('c."effectiveDate" IS NULL')
    .andWhere('c.status IN (:...statuses)', { statuses: CONSUMABLE_STATUSES })
    .andWhere(
      `(c."versionScope" IS NULL OR lower(c."versionScope") NOT LIKE :marker)`,
      { marker: `%${PRE_RELEASE_MARKER}%` },
    )
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

// A claim whose displacement link points at its own entity says "X is replaced
// by X", which is not a displacement — it is version supersession mistaken for
// one, and it belongs in the statement and `versionScope` instead.
//
// Repaired at 248 rows on 2026-08-21 and recurring, because extraction keeps
// producing the shape: every one was "X version N is superseded by X version
// N+1". Left alone they also feed the describe queue's displacement arm, so
// they manufacture describe work whose "displaced approach" is the entity
// itself.
export const clearSelfDisplacementLinks = async (con: Con): Promise<number> => {
  const { affected } = await con
    .getRepository(Claim)
    .createQueryBuilder()
    .update()
    .set({ supersededByEntityId: null })
    .where('"supersededByEntityId" = "entityId"')
    .andWhere('status != :rejected', { rejected: ClaimStatus.Rejected })
    .execute();

  return affected ?? 0;
};

// A pre-GA claim that acquired a date before the rule above existed, or through
// a route that does not know about the marker. R24 wants these NULL until the
// GA flip sets them deliberately.
export const clearPreReleaseDates = async (con: Con): Promise<number> => {
  const { affected } = await con
    .getRepository(Claim)
    .createQueryBuilder()
    .update()
    .set({ effectiveDate: null, dateSource: null })
    .where(`lower("versionScope") LIKE :marker`, {
      marker: `%${PRE_RELEASE_MARKER}%`,
    })
    .andWhere('"effectiveDate" IS NOT NULL')
    .andWhere('"dateSource" != :extracted', {
      extracted: ClaimDateSource.Extracted,
    })
    .andWhere('status != :rejected', { rejected: ClaimStatus.Rejected })
    .execute();

  return affected ?? 0;
};

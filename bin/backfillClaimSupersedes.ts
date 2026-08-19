import '../src/config';
import { In, IsNull, Not } from 'typeorm';
import createOrGetConnection from '../src/db';
import { Claim } from '../src/entity/claim/Claim';
import { ClaimCandidate } from '../src/entity/claim/ClaimCandidate';
import { resolveSupersededByEntityId } from '../src/common/claimLedger';

// Extraction has always emitted the replacement as a name on the candidate, and
// the merge step never resolved it, so every displacement in the ledger is prose
// and claim."supersededByEntityId" is empty. Re-runnable on purpose: a name only
// resolves once the replacement entity exists, and for a genuinely new thing that
// can be later than the claim about what it replaced.
(async (): Promise<void> => {
  const dryRun = process.argv.includes('--dry-run');
  const con = await createOrGetConnection();

  const candidates = await con.getRepository(ClaimCandidate).find({
    select: ['id', 'claimId', 'supersededBy', 'rawEntityName'],
    where: { supersededBy: Not(IsNull()), claimId: Not(IsNull()) },
  });

  const unlinked = await con.getRepository(Claim).find({
    select: ['id'],
    where: {
      id: In(candidates.map(({ claimId }) => claimId as string)),
      supersededByEntityId: IsNull(),
    },
  });
  const needsLink = new Set(unlinked.map(({ id }) => id));

  console.log(
    `${candidates.length} candidates name a replacement, ${needsLink.size} of their claims are unlinked`,
  );

  const resolved: { claimId: string; entityId: string; name: string }[] = [];
  const unresolved: { name: string; from: string }[] = [];

  for (const candidate of candidates) {
    if (!candidate.claimId || !needsLink.has(candidate.claimId)) {
      continue;
    }

    const entityId = await resolveSupersededByEntityId({
      con,
      name: candidate.supersededBy,
    });

    if (!entityId) {
      unresolved.push({
        name: candidate.supersededBy as string,
        from: candidate.rawEntityName,
      });
      continue;
    }

    resolved.push({
      claimId: candidate.claimId,
      entityId,
      name: candidate.supersededBy as string,
    });
  }

  console.log(
    `${resolved.length} resolve to exactly one entity, ${unresolved.length} do not`,
  );

  if (unresolved.length) {
    // Either the replacement has no entity yet, or the name answers to more than
    // one. Neither is guessable here; both are review work.
    console.log('\nleft for review:');
    console.table(unresolved.slice(0, 25));
  }

  if (dryRun) {
    console.table(resolved.slice(0, 25));
    process.exit(0);
  }

  // Grouped by target: one displacement target absorbs many claims, so this is
  // a few dozen updates rather than a few hundred.
  const byEntity = new Map<string, string[]>();
  resolved.forEach(({ claimId, entityId }) =>
    byEntity.set(entityId, [...(byEntity.get(entityId) ?? []), claimId]),
  );

  let done = 0;

  for (const [entityId, claimIds] of byEntity) {
    await con
      .getRepository(Claim)
      .update({ id: In(claimIds) }, { supersededByEntityId: entityId });
    done += claimIds.length;
    console.log(`${done}/${resolved.length}`);
  }

  process.exit(0);
})();

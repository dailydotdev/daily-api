import '../src/config';
import createOrGetConnection from '../src/db';
import {
  corroborateClaims,
  planClaimCorroboration,
} from '../src/common/claimCorroboration';

// The one-shot pass over the ledger's history. `ledger-corroboration` keeps up
// with daily inflow, but it was switched on against 40k claims nothing had ever
// evaluated, and that first sweep is this script.
//
// Who qualifies is NOT decided here — it is `src/common/claimCorroboration.ts`,
// the same rule and the same query the cron runs. This is the mistake
// `bin/backfillClaimDates.ts` records in its own header: its private copy of the
// dating query lacked a filter the cron had, so the two fought over 660 rows
// every night. A backfill that decides for itself is a backfill that drifts.
//
// Idempotent for the same reason the cron is: promotion only reads `candidate`
// rows, so anything this run promotes is invisible to the next one.
(async (): Promise<void> => {
  const dryRun = process.argv.includes('--dry-run');
  const con = await createOrGetConnection();

  if (dryRun) {
    const plan = await planClaimCorroboration(con);
    const byReason = new Map<string, number>();

    plan.forEach(({ verdict }) =>
      byReason.set(verdict.reason, (byReason.get(verdict.reason) ?? 0) + 1),
    );

    const promoting = plan.filter(({ verdict }) => verdict.corroborated);

    console.log(
      `${promoting.length} of ${plan.length} candidate claims with evidence would be promoted`,
    );
    console.table(
      [...byReason.entries()].map(([reason, claims]) => ({ reason, claims })),
    );

    // A sample, because a count cannot show a systematic error and reading
    // twenty rows can. Printed with the publishers that earned each promotion so
    // a reviewer can see WHY without a second query.
    console.log('\nsample of 20 promotions:');
    console.table(
      promoting.slice(0, 20).map(({ claimId, verdict }) => ({
        claimId,
        reason: verdict.reason,
        publishers: verdict.publishers.join(', '),
      })),
    );

    process.exit(0);
  }

  console.table(await corroborateClaims(con));
  process.exit(0);
})();

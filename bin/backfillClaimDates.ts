import '../src/config';
import createOrGetConnection from '../src/db';
import {
  dateClaimsFromEvidence,
  planClaimDatesFromEvidence,
} from '../src/common/ledgerHygiene';

// Half the backfilled ledger carries no extracted date, and the claim query used
// to stand in the row's own "createdAt" — one day for every backfilled claim. The
// posts a claim cites are dated, so the earliest of them is a far better answer:
// an upper bound on when the change landed, which "dateSource" records so a month
// window can leave it out.
//
// Who is datable is NOT decided here. It is `src/common/ledgerHygiene.ts`, the
// same rule the hygiene cron applies, because this script deciding for itself is
// what caused the 2026-08-21 regression: its own copy of the query omitted the
// R24 pre-release exclusion and the consumable-status filter, so each run re-dated
// the `(pre-release)` family from coverage dates and the next cron pass nulled all
// 660 of them again.
(async (): Promise<void> => {
  const dryRun = process.argv.includes('--dry-run');
  const con = await createOrGetConnection();

  if (dryRun) {
    const groups = await planClaimDatesFromEvidence(con);
    const datable = [...groups.values()].reduce(
      (sum, ids) => sum + ids.length,
      0,
    );

    console.log(`${datable} claims datable across ${groups.size} dates`);
    console.table(
      [...groups.entries()]
        .slice(0, 20)
        .map(([key, ids]) => ({ key, claims: ids.length })),
    );
    process.exit(0);
  }

  console.log(`${await dateClaimsFromEvidence(con)} claims dated`);
  process.exit(0);
})();

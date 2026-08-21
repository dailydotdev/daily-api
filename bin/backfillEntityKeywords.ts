import '../src/config';
import createOrGetConnection from '../src/db';
import {
  findEntityKeywordLinks,
  linkEntityKeywords,
} from '../src/common/ledgerKeywords';

// One-shot pass over every unlinked entity. The `ledger-hygiene` cron runs the
// same linker for new arrivals, so this exists for the initial fill and for
// re-running after the keyword taxonomy itself changes (a tag promoted from
// pending to allow makes new links possible that did not exist before).
(async (): Promise<void> => {
  const dryRun = process.argv.includes('--dry-run');
  const con = await createOrGetConnection();

  if (dryRun) {
    const links = await findEntityKeywordLinks({ con });
    const byVia = links.reduce<Record<string, number>>(
      (acc, link) => ({ ...acc, [link.via]: (acc[link.via] ?? 0) + 1 }),
      {},
    );

    console.log(`${links.length} links available: ${JSON.stringify(byVia)}`);
    console.table(links.slice(0, 25));
    process.exit(0);
  }

  console.log(`${await linkEntityKeywords({ con })} entities linked`);
  process.exit(0);
})();

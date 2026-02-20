import '../src/config';
import createOrGetConnection from '../src/db';
import { MachineSource } from '../src/entity/Source';
import { pubsub } from '../src/common/pubsub';
import { parseArgs } from 'node:util';

const MERGE_PAIRS: {
  deleteId: string;
  keepId: string;
  twitterHandle: string;
}[] = [
  { deleteId: 'claudeai', keepId: 'claude', twitterHandle: 'claudeai' },
  { deleteId: 'cursor_ai', keepId: 'cursor', twitterHandle: 'cursor_ai' },
  { deleteId: 'windsurfai', keepId: 'windsurf', twitterHandle: 'WindsurfAI' },
  {
    deleteId: 'fireship_dev',
    keepId: 'fireship',
    twitterHandle: 'fireship_dev',
  },
  {
    deleteId: 'karpathy',
    keepId: 'andrejkarpathy',
    twitterHandle: 'karpathy',
  },
  {
    deleteId: 'mattpocockuk',
    keepId: 'mattpocock',
    twitterHandle: 'mattpocockuk',
  },
  {
    deleteId: 'theprimeagen',
    keepId: 'primeagen',
    twitterHandle: 'ThePrimeagen',
  },
  {
    deleteId: 'simonw',
    keepId: 'simonwillison',
    twitterHandle: 'simonw',
  },
];

const READD_DELAY_MS = 10_000;

const sourceFeedRemovedTopic = pubsub.topic('source-feed-removed');
const sourceAddedTopic = pubsub.topic('source-added');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const start = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'skip-delete': { type: 'boolean', default: false },
      'only-readd': { type: 'boolean', default: false },
      only: { type: 'string' },
    },
  });

  const dryRun = values['dry-run'];
  const skipDelete = values['skip-delete'];
  const onlyReadd = values['only-readd'];
  const onlyFilter = values.only;

  const pairs = onlyFilter
    ? MERGE_PAIRS.filter((p) => p.deleteId === onlyFilter)
    : MERGE_PAIRS;

  if (pairs.length === 0) {
    throw new Error(`No pair found for --only=${onlyFilter}`);
  }

  console.log(`Processing ${pairs.length} pair(s)...`);

  const con = await createOrGetConnection();

  if (!onlyReadd) {
    for (const pair of pairs) {
      const existing = await con
        .getRepository(MachineSource)
        .findOneBy({ id: pair.deleteId });

      if (!existing) {
        console.log(`[SKIP] ${pair.deleteId} — not found in DB`);
        continue;
      }

      console.log(
        `[${pair.deleteId} → ${pair.keepId}] Removing feed from yggdrasil...`,
      );
      const feedUrl = `https://x.com/${pair.twitterHandle}`;

      if (dryRun) {
        console.log(`  DRY RUN: would publish source-feed-removed:`, {
          feed: feedUrl,
          sourceId: pair.deleteId,
        });
      } else {
        await sourceFeedRemovedTopic.publishMessage({
          json: { feed: feedUrl, sourceId: pair.deleteId },
        });
        console.log(`  Published source-feed-removed for ${feedUrl}`);
      }

      if (!skipDelete) {
        console.log(`  Deleting source ${pair.deleteId}...`);
        if (dryRun) {
          console.log(`  DRY RUN: would delete source ${pair.deleteId}`);
        } else {
          await con.getRepository(MachineSource).delete(pair.deleteId);
          console.log(`  Deleted source ${pair.deleteId}`);
        }
      }
    }

    console.log(
      `\nWaiting ${READD_DELAY_MS / 1000}s for yggdrasil to process removals...`,
    );
    if (!dryRun) {
      await sleep(READD_DELAY_MS);
    }
  }

  console.log('\nRe-adding Twitter feeds to existing sources...');
  for (const pair of pairs) {
    const keepSource = await con
      .getRepository(MachineSource)
      .findOneBy({ id: pair.keepId });

    if (!keepSource) {
      console.log(`[SKIP] ${pair.keepId} — keep source not found!`);
      continue;
    }

    const message = {
      url: `https://x.com/${pair.twitterHandle}`,
      source_id: pair.keepId,
      engine_id: 'twitter:account',
      status: 'processing',
      options: {
        twitter_account: { username: pair.twitterHandle },
      },
    };

    if (dryRun) {
      console.log(
        `  DRY RUN: would publish source-added for ${pair.keepId}:`,
        message,
      );
    } else {
      await sourceAddedTopic.publishMessage({ json: message });
      console.log(
        `  Published source-added: ${pair.keepId} ← @${pair.twitterHandle}`,
      );
    }
  }
};

start()
  .then(() => {
    console.log('\ndone');
    process.exit();
  })
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  });

import '../src/config';

import { parseArgs } from 'node:util';
import z from 'zod';
import createOrGetConnection from '../src/db';
import { logger } from '../src/logger';
import {
  checkAchievementProgress,
  AchievementEventType,
} from '../src/common/achievement';

const BATCH_SIZE = 500;

(async () => {
  const { values } = parseArgs({
    options: {
      offset: { type: 'string', short: 'o' },
      limit: { type: 'string', short: 'l' },
    },
  });

  const schema = z.object({
    offset: z.coerce.number().int().nonnegative().default(0),
    limit: z.coerce.number().int().positive().default(5000),
  });

  const { error, data } = schema.safeParse(values);
  if (error) {
    logger.error({ err: error }, 'Invalid arguments');
    process.exit(1);
  }

  const { offset, limit } = data;
  const con = await createOrGetConnection();

  const rows: { userId: string }[] = await con.query(
    `SELECT ucp."userId"
     FROM user_candidate_preference ucp
     JOIN "user" u ON u.id = ucp."userId"
     WHERE ucp.cv->>'blob' IS NOT NULL
       AND (u.flags->>'syncedAchievements')::boolean = true
       AND NOT EXISTS (
         SELECT 1 FROM user_achievement ua
         JOIN achievement a ON a.id = ua."achievementId"
         WHERE ua."userId" = ucp."userId"
           AND a."eventType" = $1
           AND ua."unlockedAt" IS NOT NULL
       )
     ORDER BY ucp."userId"
     OFFSET $2
     LIMIT $3`,
    [AchievementEventType.CVUpload, offset, limit],
  );

  logger.info(
    { offset, limit, found: rows.length },
    'Found eligible users for CV achievement',
  );

  let granted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      try {
        await checkAchievementProgress(
          con,
          logger,
          row.userId,
          AchievementEventType.CVUpload,
        );
        granted++;
      } catch (err) {
        errors++;
        logger.error(
          { err, userId: row.userId },
          'Failed to grant CV achievement',
        );
      }
    }

    logger.info(
      { processed: Math.min(i + BATCH_SIZE, rows.length), total: rows.length },
      'Batch progress',
    );
  }

  logger.info({ granted, errors, total: rows.length }, 'Done');

  if (rows.length === limit) {
    const nextOffset = offset + limit;
    console.log(
      `\nNext command:\n  npx ts-node bin/retroGrantCvAchievement.ts --offset ${nextOffset} --limit ${limit}`,
    );
  } else {
    console.log('\nAll eligible users processed. No further runs needed.');
  }

  con.destroy();
  process.exit(0);
})();

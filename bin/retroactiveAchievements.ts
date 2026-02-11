import '../src/config';
import createOrGetConnection from '../src/db';
import { Achievement } from '../src/entity/Achievement';
import { syncUsersRetroactiveAchievements } from '../src/common/achievement/retroactive';
import { logger } from '../src/logger';

(async () => {
  const offset = parseInt(process.argv[2], 10);
  const limit = parseInt(process.argv[3], 10);

  if (isNaN(offset) || isNaN(limit) || offset < 0 || limit <= 0) {
    console.error(
      'Usage: npx ts-node bin/retroactiveAchievements.ts <offset> <limit>',
    );
    process.exit(1);
  }

  const startTime = Date.now();
  const log = logger.child({ script: 'retroactiveAchievements' });

  const con = await createOrGetConnection();

  const allAchievements = await con.getRepository(Achievement).find();

  const userRows: { id: string }[] = await con.query(
    `SELECT id FROM "user" ORDER BY id OFFSET $1 LIMIT $2`,
    [offset, limit],
  );
  const userIds = userRows.map((r) => r.id);

  log.info(
    {
      offset,
      limit,
      userCount: userIds.length,
      achievementCount: allAchievements.length,
      eventTypeCount: new Set(allAchievements.map((a) => a.eventType)).size,
    },
    'Starting retroactive achievement processing',
  );

  if (userIds.length === 0) {
    log.info('No users found for the given offset/limit');
    process.exit(0);
  }

  const { totalUnlocked } = await syncUsersRetroactiveAchievements({
    con,
    logger: log,
    userIds,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const nextOffset = offset + userIds.length;

  log.info(
    {
      usersProcessed: userIds.length,
      totalUnlocked,
      elapsedSeconds: elapsed,
      nextCommand:
        userIds.length < limit
          ? null
          : `npx ts-node bin/retroactiveAchievements.ts ${nextOffset} ${limit}`,
    },
    userIds.length < limit
      ? 'Retroactive achievement processing complete (last batch)'
      : 'Retroactive achievement processing complete',
  );

  process.exit(0);
})();

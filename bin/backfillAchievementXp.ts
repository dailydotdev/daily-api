import '../src/config';
import createOrGetConnection from '../src/db';
import z from 'zod';
import { zodToParseArgs } from './common';

const argsSchema = z.object({
  'dry-run': z.boolean().default(false),
});

(async () => {
  const args = zodToParseArgs(argsSchema);
  const dryRun = args['dry-run'];

  const con = await createOrGetConnection();

  const [stats] = await con.query(
    `SELECT
      COUNT(DISTINCT ua."userId") AS user_count,
      COALESCE(SUM(a.xp), 0)::int AS total_xp
    FROM user_achievement ua
    JOIN achievement a ON ua."achievementId" = a.id
    WHERE ua."unlockedAt" IS NOT NULL`,
  );

  console.log(`Users with unlocked achievements: ${stats.user_count}`);
  console.log(`Total XP to award: ${stats.total_xp}`);

  if (dryRun) {
    console.log('Dry run — no changes made');
    process.exit();
  }

  const insertResult = await con.query(
    `INSERT INTO user_quest_profile ("userId", "totalXp")
      SELECT DISTINCT ua."userId", 0
      FROM user_achievement ua
      WHERE ua."unlockedAt" IS NOT NULL
    ON CONFLICT DO NOTHING`,
  );
  console.log(`New user_quest_profile rows created: ${insertResult[1]}`);

  const updateResult = await con.query(
    `UPDATE user_quest_profile uqp
      SET
        "totalXp" = uqp."totalXp" + agg.xp,
        "updatedAt" = NOW()
      FROM (
        SELECT ua."userId", SUM(a.xp)::int AS xp
        FROM user_achievement ua
        JOIN achievement a ON ua."achievementId" = a.id
        WHERE ua."unlockedAt" IS NOT NULL
        GROUP BY ua."userId"
      ) agg
      WHERE uqp."userId" = agg."userId"`,
  );
  console.log(`user_quest_profile rows updated: ${updateResult[1]}`);

  console.log('Backfill complete');
  process.exit();
})();

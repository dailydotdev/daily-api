import '../src/config';
import createOrGetConnection from '../src/db';
import { Achievement, AchievementEventType, User } from '../src/entity';
import { updateUserAchievementProgress } from '../src/common/achievement';
import { logger } from '../src/logger';

type ProgressMap = Map<string, number>;

const ACHIEVEMENTS_BATCH_2_NAMES = [
  'My plus one',
  'Referral spree',
  'Core values',
  'Coraholic',
  "Can't spend it all",
  'Poll it',
  'Verifiably verified',
  'The word around town',
  'Orator',
  'Infamous poster',
];

const toProgressMap = (
  rows: { userId: string; count?: string | number }[],
): ProgressMap => {
  const map: ProgressMap = new Map();

  for (const row of rows) {
    map.set(row.userId, Number(row.count ?? 1));
  }

  return map;
};

const toInstantMap = (rows: { userId: string }[]): ProgressMap => {
  const map: ProgressMap = new Map();

  for (const row of rows) {
    map.set(row.userId, 1);
  }

  return map;
};

const start = async (): Promise<void> => {
  const con = await createOrGetConnection();

  try {
    const achievements = await con
      .getRepository(Achievement)
      .createQueryBuilder('achievement')
      .where('achievement.name IN (:...names)', {
        names: ACHIEVEMENTS_BATCH_2_NAMES,
      })
      .getMany();

    const foundAchievementNames = new Set(achievements.map(({ name }) => name));
    const missingAchievementNames = ACHIEVEMENTS_BATCH_2_NAMES.filter(
      (name) => !foundAchievementNames.has(name),
    );

    if (missingAchievementNames.length > 0) {
      throw new Error(
        `Missing AchievementsBatch2 achievements: ${missingAchievementNames.join(', ')}`,
      );
    }

    const userRows = await con
      .getRepository(User)
      .createQueryBuilder('user')
      .select('user.id', 'id')
      .where(
        `COALESCE(("user"."flags"->>'syncedAchievements')::boolean, false) = true`,
      )
      .getRawMany<{ id: string }>();

    const userIds = userRows.map(({ id }) => id);

    console.log(
      `Found ${userIds.length} users with synced achievements and ${achievements.length} AchievementsBatch2 achievements.`,
    );

    if (userIds.length === 0) {
      return;
    }

    const handlers: Partial<
      Record<AchievementEventType, () => Promise<ProgressMap>>
    > = {
      [AchievementEventType.ReferralCount]: async () => {
        const rows = await con.query(
          `SELECT "referralId" AS "userId", COUNT(*)::int AS count
           FROM "user"
           WHERE "referralId" = ANY($1)
           GROUP BY "referralId"`,
          [userIds],
        );

        return toProgressMap(rows);
      },
      [AchievementEventType.CoresSpent]: async () => {
        const rows = await con.query(
          `SELECT "senderId" AS "userId", COALESCE(SUM(value), 0)::int AS count
           FROM user_transaction
           WHERE "senderId" = ANY($1)
             AND "receiverId" IS NOT NULL
             AND "productId" IS NOT NULL
             AND status = 0
           GROUP BY "senderId"`,
          [userIds],
        );

        return toProgressMap(rows);
      },
      [AchievementEventType.PollCreate]: async () => {
        const rows = await con.query(
          `SELECT DISTINCT "authorId" AS "userId"
           FROM post
           WHERE "authorId" = ANY($1) AND type = 'poll'`,
          [userIds],
        );

        return toInstantMap(rows);
      },
      [AchievementEventType.CompanyVerified]: async () => {
        const rows = await con.query(
          `SELECT DISTINCT "userId"
           FROM user_company
           WHERE "userId" = ANY($1) AND verified = true`,
          [userIds],
        );

        return toInstantMap(rows);
      },
      [AchievementEventType.PostImpressions]: async () => {
        const rows = await con.query(
          `SELECT p."authorId" AS "userId",
                  COALESCE(SUM(pa.impressions + pa."impressionsAds"), 0)::int AS count
           FROM post p
           JOIN post_analytics pa ON pa.id = p.id
           WHERE p."authorId" = ANY($1)
             AND p.deleted = false
             AND p.visible = true
             AND p.type NOT IN ('brief', 'digest')
           GROUP BY p."authorId"`,
          [userIds],
        );

        return toProgressMap(rows);
      },
    };

    const achievementsByEventType = new Map<
      AchievementEventType,
      Achievement[]
    >();

    for (const achievement of achievements) {
      const list = achievementsByEventType.get(achievement.eventType) ?? [];
      list.push(achievement);
      achievementsByEventType.set(achievement.eventType, list);
    }

    let totalUnlocked = 0;
    let totalUpdated = 0;

    for (const [eventType, eventAchievements] of achievementsByEventType) {
      const handler = handlers[eventType];

      if (!handler) {
        throw new Error(
          `No AchievementsBatch2 handler registered for event type: ${eventType}`,
        );
      }

      const progressMap = await handler();
      let eventUpdated = 0;
      let eventUnlocked = 0;

      for (const [userId, progress] of progressMap) {
        if (progress <= 0) {
          continue;
        }

        for (const achievement of eventAchievements) {
          const wasUnlocked = await updateUserAchievementProgress(
            con,
            logger,
            userId,
            achievement.id,
            progress,
            achievement.criteria.targetCount ?? 1,
          );

          eventUpdated++;
          totalUpdated++;

          if (wasUnlocked) {
            eventUnlocked++;
            totalUnlocked++;
          }
        }
      }

      console.log(
        `Processed ${eventType}: qualifyingUsers=${progressMap.size}, updated=${eventUpdated}, newlyUnlocked=${eventUnlocked}`,
      );
    }

    console.log(
      `Finished AchievementsBatch2 sync. Updated ${totalUpdated} achievement rows and unlocked ${totalUnlocked} achievements.`,
    );
  } finally {
    await con.destroy();
  }
};

start()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

import { differenceInMonths } from 'date-fns';
import type { FastifyBaseLogger } from 'fastify';
import type { DataSource, EntityManager } from 'typeorm';
import { Achievement, AchievementEventType } from '../../entity/Achievement';
import { updateUserAchievementProgress } from './index';
type ProgressMap = Map<string, number>;
type RetroactiveHandler = (
  con: DataSource | EntityManager,
  userIds: string[],
) => Promise<ProgressMap>;

interface SyncUsersRetroactiveAchievementsParams {
  con: DataSource | EntityManager;
  logger: FastifyBaseLogger;
  userIds: string[];
}

interface SyncUserRetroactiveAchievementsParams {
  con: DataSource | EntityManager;
  logger: FastifyBaseLogger;
  userId: string;
}

export interface RetroactiveAchievementSyncResult {
  totalUnlocked: number;
  unlockedAchievementIdsByUser: Map<string, string[]>;
}

const toProgressMap = (
  rows: { userId: string; count?: string | number }[],
  field: 'userId' | string = 'userId',
  countField: 'count' | string = 'count',
): ProgressMap => {
  const map: ProgressMap = new Map();
  for (const row of rows) {
    const id = (row as Record<string, unknown>)[field] as string;
    const count = Number((row as Record<string, unknown>)[countField] ?? 1);
    map.set(id, count);
  }

  return map;
};

const toInstantMap = (
  rows: { userId: string }[],
  field = 'userId',
): ProgressMap => {
  const map: ProgressMap = new Map();
  for (const row of rows) {
    map.set((row as Record<string, unknown>)[field] as string, 1);
  }

  return map;
};

const makeExperienceHandler =
  (experienceType: string): RetroactiveHandler =>
  async (con, userIds) => {
    const rows = await con.query(
      `SELECT DISTINCT "userId" FROM user_experience WHERE "userId" = ANY($1) AND type = $2`,
      [userIds, experienceType],
    );

    return toInstantMap(rows);
  };

const handleProfileImageUpdate: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT id AS "userId" FROM "user" WHERE id = ANY($1) AND image IS NOT NULL AND image != ''`,
    [userIds],
  );

  return toInstantMap(rows);
};

const handleProfileCoverUpdate: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT id AS "userId" FROM "user" WHERE id = ANY($1) AND cover IS NOT NULL AND cover != ''`,
    [userIds],
  );

  return toInstantMap(rows);
};

const handleProfileLocationUpdate: RetroactiveHandler = async (
  con,
  userIds,
) => {
  const rows = await con.query(
    `SELECT id AS "userId" FROM "user" WHERE id = ANY($1) AND "locationId" IS NOT NULL`,
    [userIds],
  );

  return toInstantMap(rows);
};

const handlePostFreeform: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT DISTINCT "authorId" AS "userId" FROM post WHERE "authorId" = ANY($1) AND type = 'freeform'`,
    [userIds],
  );

  return toInstantMap(rows);
};

const handlePostShare: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT DISTINCT "authorId" AS "userId" FROM post WHERE "authorId" = ANY($1) AND type = 'share' AND visible = true`,
    [userIds],
  );

  return toInstantMap(rows);
};

const handleFeedCreate: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT DISTINCT "userId" FROM feed WHERE "userId" = ANY($1) AND id != "userId"`,
    [userIds],
  );

  return toInstantMap(rows);
};

const handleSquadCreate: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT DISTINCT sm."userId"
     FROM source_member sm
     JOIN source s ON sm."sourceId" = s.id
     WHERE sm."userId" = ANY($1) AND s.type = 'squad' AND sm.role = 'admin'`,
    [userIds],
  );

  return toInstantMap(rows);
};

const handlePlusSubscribe: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT id AS "userId" FROM "user" WHERE id = ANY($1) AND "subscriptionFlags"->>'cycle' IS NOT NULL`,
    [userIds],
  );

  return toInstantMap(rows);
};

const handleCVUpload: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT "userId" FROM user_candidate_preference WHERE "userId" = ANY($1) AND cv->>'blob' IS NOT NULL`,
    [userIds],
  );

  return toInstantMap(rows);
};

const handlePostBoost: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT DISTINCT "senderId" AS "userId" FROM user_transaction WHERE "senderId" = ANY($1) AND status = 0 AND "referenceType" = 'post_boost'`,
    [userIds],
  );

  return toInstantMap(rows);
};

const handleAwardReceived: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT DISTINCT "receiverId" AS "userId"
     FROM user_transaction
     WHERE "receiverId" = ANY($1)
       AND status = 0
       AND "referenceType" IN ('post', 'comment')
       AND "senderId" IS NOT NULL
       AND "senderId" != "receiverId"`,
    [userIds],
  );

  return toInstantMap(rows);
};

const handleShareClick: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT DISTINCT p."authorId" AS "userId"
     FROM post p
     JOIN post_analytics pa ON pa.id = p.id
     WHERE p."authorId" = ANY($1) AND p.type = 'share' AND pa.clicks > 0`,
    [userIds],
  );

  return toInstantMap(rows);
};

const handleBookmarkListCreate: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT DISTINCT "userId" FROM bookmark_list WHERE "userId" = ANY($1)`,
    [userIds],
  );

  return toInstantMap(rows);
};

const handleProfileComplete: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT u.id AS "userId"
     FROM "user" u
     WHERE u.id = ANY($1)
       AND u.image IS NOT NULL AND u.image != ''
       AND u.bio IS NOT NULL AND u.bio != ''
       AND u."experienceLevel" IS NOT NULL
       AND EXISTS (SELECT 1 FROM user_experience ue WHERE ue."userId" = u.id AND ue.type = 'work')
       AND EXISTS (SELECT 1 FROM user_experience ue WHERE ue."userId" = u.id AND ue.type = 'education')`,
    [userIds],
  );

  return toInstantMap(rows);
};

const handlePostUpvote: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT up."userId", COUNT(*)::int AS count
     FROM user_post up
     JOIN post p ON up."postId" = p.id
     WHERE up."userId" = ANY($1)
       AND up.vote = 1
       AND up."userId" != COALESCE(p."authorId", '')
       AND up."userId" != COALESCE(p."scoutId", '')
     GROUP BY up."userId"`,
    [userIds],
  );

  return toProgressMap(rows);
};

const handleCommentUpvote: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT uc."userId", COUNT(*)::int AS count
     FROM user_comment uc
     JOIN comment c ON uc."commentId" = c.id
     WHERE uc."userId" = ANY($1)
       AND uc.vote = 1
       AND uc."userId" != c."userId"
     GROUP BY uc."userId"`,
    [userIds],
  );

  return toProgressMap(rows);
};

const handleUpvoteReceived: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT "userId", SUM(count)::int AS count FROM (
       SELECT p."authorId" AS "userId", COUNT(*) AS count
       FROM user_post up
       JOIN post p ON up."postId" = p.id
       WHERE p."authorId" = ANY($1)
         AND up.vote = 1
         AND up."userId" != p."authorId"
       GROUP BY p."authorId"
       UNION ALL
       SELECT c."userId", COUNT(*) AS count
       FROM user_comment uc
       JOIN comment c ON uc."commentId" = c.id
       WHERE c."userId" = ANY($1)
         AND uc.vote = 1
         AND uc."userId" != c."userId"
       GROUP BY c."userId"
     ) sub
     GROUP BY "userId"`,
    [userIds],
  );

  return toProgressMap(rows);
};

const handleCommentCreate: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT "userId", COUNT(*)::int AS count FROM comment WHERE "userId" = ANY($1) GROUP BY "userId"`,
    [userIds],
  );

  return toProgressMap(rows);
};

const handleBookmarkPost: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT "userId", COUNT(*)::int AS count FROM bookmark WHERE "userId" = ANY($1) GROUP BY "userId"`,
    [userIds],
  );

  return toProgressMap(rows);
};

const handleSquadJoin: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT sm."userId", COUNT(DISTINCT sm."sourceId")::int AS count
     FROM source_member sm
     JOIN source s ON sm."sourceId" = s.id
     WHERE sm."userId" = ANY($1) AND s.type = 'squad' AND sm.role = 'member'
     GROUP BY sm."userId"`,
    [userIds],
  );

  return toProgressMap(rows);
};

const handleBriefRead: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT v."userId", COUNT(DISTINCT v."postId")::int AS count
     FROM view v
     JOIN post p ON v."postId" = p.id
     WHERE v."userId" = ANY($1) AND p.type = 'brief'
     GROUP BY v."userId"`,
    [userIds],
  );

  return toProgressMap(rows);
};

const handleHotTakeCreate: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT "userId", COUNT(*)::int AS count FROM hot_take WHERE "userId" = ANY($1) GROUP BY "userId"`,
    [userIds],
  );

  return toProgressMap(rows);
};

const handleExperienceSkill: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT "userId", COUNT(*)::int AS count FROM user_stack WHERE "userId" = ANY($1) GROUP BY "userId"`,
    [userIds],
  );

  return toProgressMap(rows);
};

const handleUserFollow: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT "userId", COUNT(DISTINCT "referenceId")::int AS count
     FROM content_preference
     WHERE "userId" = ANY($1) AND type = 'user' AND status IN ('follow', 'subscribed')
     GROUP BY "userId"`,
    [userIds],
  );

  return toProgressMap(rows);
};

const handleAwardGiven: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT "senderId" AS "userId", COUNT(*)::int AS count
     FROM user_transaction
     WHERE "senderId" = ANY($1)
       AND status = 0
       AND "referenceType" IN ('post', 'comment')
       AND "senderId" != "receiverId"
     GROUP BY "senderId"`,
    [userIds],
  );

  return toProgressMap(rows);
};

const handleReputationGain: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT id AS "userId", reputation AS count FROM "user" WHERE id = ANY($1)`,
    [userIds],
  );

  return toProgressMap(rows);
};

const handleFollowerGain: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT "referenceId" AS "userId", COUNT(*)::int AS count
     FROM content_preference
     WHERE "referenceId" = ANY($1) AND type = 'user' AND status IN ('follow', 'subscribed')
     GROUP BY "referenceId"`,
    [userIds],
  );

  return toProgressMap(rows);
};

const handleTopReaderBadge: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT "userId", COUNT(*)::int AS count FROM user_top_reader WHERE "userId" = ANY($1) GROUP BY "userId"`,
    [userIds],
  );

  return toProgressMap(rows);
};

const handleReadingStreak: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT "userId", "maxStreak" AS count FROM user_streak WHERE "userId" = ANY($1)`,
    [userIds],
  );

  return toProgressMap(rows);
};

const handleSubscriptionAnniversary: RetroactiveHandler = async (
  con,
  userIds,
) => {
  const rows: { userId: string; createdAt: string }[] = await con.query(
    `SELECT id AS "userId", "subscriptionFlags"->>'createdAt' AS "createdAt"
     FROM "user"
     WHERE id = ANY($1) AND "subscriptionFlags"->>'createdAt' IS NOT NULL`,
    [userIds],
  );

  const map: ProgressMap = new Map();
  const now = new Date();
  for (const row of rows) {
    const created = new Date(row.createdAt);
    const months = differenceInMonths(now, created);
    if (months > 0) {
      map.set(row.userId, months);
    }
  }

  return map;
};

const handleShareClickMilestone: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT p."authorId" AS "userId", MAX(pa.clicks)::int AS count
     FROM post p
     JOIN post_analytics pa ON pa.id = p.id
     WHERE p."authorId" = ANY($1) AND p.type = 'share'
     GROUP BY p."authorId"`,
    [userIds],
  );

  return toProgressMap(rows);
};

const handleSharePostsClicked: RetroactiveHandler = async (con, userIds) => {
  const rows = await con.query(
    `SELECT p."authorId" AS "userId", COUNT(*)::int AS count
     FROM post p
     JOIN post_analytics pa ON pa.id = p.id
     WHERE p."authorId" = ANY($1) AND p.type = 'share' AND pa.clicks > 0
     GROUP BY p."authorId"`,
    [userIds],
  );

  return toProgressMap(rows);
};

const handlers: Partial<Record<AchievementEventType, RetroactiveHandler>> = {
  [AchievementEventType.ProfileImageUpdate]: handleProfileImageUpdate,
  [AchievementEventType.ProfileCoverUpdate]: handleProfileCoverUpdate,
  [AchievementEventType.ProfileLocationUpdate]: handleProfileLocationUpdate,
  [AchievementEventType.PostFreeform]: handlePostFreeform,
  [AchievementEventType.PostShare]: handlePostShare,
  [AchievementEventType.FeedCreate]: handleFeedCreate,
  [AchievementEventType.SquadCreate]: handleSquadCreate,
  [AchievementEventType.PlusSubscribe]: handlePlusSubscribe,
  [AchievementEventType.CVUpload]: handleCVUpload,
  [AchievementEventType.PostBoost]: handlePostBoost,
  [AchievementEventType.AwardReceived]: handleAwardReceived,
  [AchievementEventType.ShareClick]: handleShareClick,
  [AchievementEventType.BookmarkListCreate]: handleBookmarkListCreate,
  [AchievementEventType.ProfileComplete]: handleProfileComplete,
  [AchievementEventType.ExperienceWork]: makeExperienceHandler('work'),
  [AchievementEventType.ExperienceEducation]:
    makeExperienceHandler('education'),
  [AchievementEventType.ExperienceOpenSource]:
    makeExperienceHandler('opensource'),
  [AchievementEventType.ExperienceProject]: makeExperienceHandler('project'),
  [AchievementEventType.ExperienceVolunteering]:
    makeExperienceHandler('volunteering'),
  [AchievementEventType.ExperienceCertification]:
    makeExperienceHandler('certification'),
  [AchievementEventType.PostUpvote]: handlePostUpvote,
  [AchievementEventType.CommentUpvote]: handleCommentUpvote,
  [AchievementEventType.UpvoteReceived]: handleUpvoteReceived,
  [AchievementEventType.CommentCreate]: handleCommentCreate,
  [AchievementEventType.BookmarkPost]: handleBookmarkPost,
  [AchievementEventType.SquadJoin]: handleSquadJoin,
  [AchievementEventType.BriefRead]: handleBriefRead,
  [AchievementEventType.HotTakeCreate]: handleHotTakeCreate,
  [AchievementEventType.ExperienceSkill]: handleExperienceSkill,
  [AchievementEventType.UserFollow]: handleUserFollow,
  [AchievementEventType.AwardGiven]: handleAwardGiven,
  [AchievementEventType.ReputationGain]: handleReputationGain,
  [AchievementEventType.FollowerGain]: handleFollowerGain,
  [AchievementEventType.TopReaderBadge]: handleTopReaderBadge,
  [AchievementEventType.ReadingStreak]: handleReadingStreak,
  [AchievementEventType.SubscriptionAnniversary]: handleSubscriptionAnniversary,
  [AchievementEventType.ShareClickMilestone]: handleShareClickMilestone,
  [AchievementEventType.SharePostsClicked]: handleSharePostsClicked,
};

export const syncUsersRetroactiveAchievements = async ({
  con,
  logger,
  userIds,
}: SyncUsersRetroactiveAchievementsParams): Promise<RetroactiveAchievementSyncResult> => {
  if (userIds.length === 0) {
    return {
      totalUnlocked: 0,
      unlockedAchievementIdsByUser: new Map(),
    };
  }

  const allAchievements = await con.getRepository(Achievement).find();
  const achievementsByEventType = new Map<
    AchievementEventType,
    Achievement[]
  >();

  for (const achievement of allAchievements) {
    const list = achievementsByEventType.get(achievement.eventType) ?? [];
    list.push(achievement);
    achievementsByEventType.set(achievement.eventType, list);
  }

  let totalUnlocked = 0;
  const unlockedAchievementIdsByUser = new Map<string, string[]>();

  for (const [eventType, achievements] of achievementsByEventType) {
    const handler = handlers[eventType];

    if (!handler) {
      logger.warn({ eventType }, 'No retroactive handler registered');
      continue;
    }

    try {
      const progressMap = await handler(con, userIds);
      let eventUnlocked = 0;

      for (const [userId, progress] of progressMap) {
        if (progress <= 0) {
          continue;
        }

        for (const achievement of achievements) {
          const targetCount = achievement.criteria.targetCount ?? 1;
          const wasUnlocked = await updateUserAchievementProgress(
            con,
            logger,
            userId,
            achievement.id,
            progress,
            targetCount,
          );

          if (wasUnlocked) {
            eventUnlocked++;
            totalUnlocked++;

            const ids = unlockedAchievementIdsByUser.get(userId) ?? [];
            ids.push(achievement.id);
            unlockedAchievementIdsByUser.set(userId, ids);
          }
        }
      }

      logger.info(
        {
          eventType,
          qualifyingUsers: progressMap.size,
          newlyUnlocked: eventUnlocked,
        },
        'Processed event type',
      );
    } catch (error) {
      logger.error({ eventType, error }, 'Failed to process event type');
    }
  }

  return {
    totalUnlocked,
    unlockedAchievementIdsByUser,
  };
};

export const syncUserRetroactiveAchievements = async ({
  con,
  logger,
  userId,
}: SyncUserRetroactiveAchievementsParams): Promise<{
  totalUnlocked: number;
  unlockedAchievementIds: string[];
}> => {
  const result = await syncUsersRetroactiveAchievements({
    con,
    logger,
    userIds: [userId],
  });

  return {
    totalUnlocked: result.totalUnlocked,
    unlockedAchievementIds:
      result.unlockedAchievementIdsByUser.get(userId) ?? [],
  };
};

import { startOfToday } from 'date-fns';
import { Cron } from './cron';
import { Post } from '../entity/posts/Post';
import { PostAnalytics } from '../entity/posts/PostAnalytics';
import { AchievementEventType } from '../entity/Achievement';
import { syncUsersRetroactiveAchievements } from '../common/achievement/retroactive';
import { queryReadReplica } from '../common/queryReadReplica';
import { getRedisHash, setRedisHash } from '../redis';
import { generateStorageKey, StorageTopic } from '../config';

type PostAnalyticsAchievementsCronConfig = Partial<{
  lastRunAt: string;
}>;

const analyticsEventTypes: AchievementEventType[] = [
  AchievementEventType.PostImpressions,
  AchievementEventType.ShareClick,
  AchievementEventType.ShareClickMilestone,
  AchievementEventType.SharePostsClicked,
];

const userChunkSize = 1000;

export const postAnalyticsAchievementsCron: Cron = {
  name: 'post-analytics-achievements',
  handler: async (con, logger) => {
    const redisStorageKey = generateStorageKey(
      StorageTopic.Cron,
      postAnalyticsAchievementsCron.name,
      'config',
    );

    const cronConfig: PostAnalyticsAchievementsCronConfig =
      await getRedisHash(redisStorageKey);

    const lastRunAt = cronConfig.lastRunAt
      ? new Date(cronConfig.lastRunAt)
      : startOfToday();

    if (Number.isNaN(lastRunAt.getTime())) {
      throw new Error('Invalid last run time');
    }

    const currentRunAt = new Date();

    const rows = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager
        .getRepository(Post)
        .createQueryBuilder('p')
        .innerJoin(PostAnalytics, 'pa', 'pa.id = p.id')
        .select('p."authorId"', 'authorId')
        .distinct(true)
        .where('pa."updatedAt" > :lastRunAt', { lastRunAt })
        .andWhere('p."authorId" IS NOT NULL')
        .getRawMany<{ authorId: string }>(),
    );

    const userIds = rows.map((row) => row.authorId);

    for (let i = 0; i < userIds.length; i += userChunkSize) {
      const chunk = userIds.slice(i, i + userChunkSize);

      await syncUsersRetroactiveAchievements({
        con,
        logger,
        userIds: chunk,
        eventTypes: analyticsEventTypes,
      });
    }

    await setRedisHash<PostAnalyticsAchievementsCronConfig>(redisStorageKey, {
      lastRunAt: currentRunAt.toISOString(),
    });
  },
};

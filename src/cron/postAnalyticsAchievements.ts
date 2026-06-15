import { startOfToday } from 'date-fns';
import { Cron } from './cron';
import { Post } from '../entity/posts/Post';
import { PostAnalytics } from '../entity/posts/PostAnalytics';
import { AchievementEventType } from '../entity/Achievement';
import { syncUsersRetroactiveAchievements } from '../common/achievement/retroactive';
import { processStreamInBatches } from '../common/streaming';
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

const batchSize = 100;
const concurrency = 5;

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

    const stream = await con
      .getRepository(Post)
      .createQueryBuilder('p')
      .innerJoin(PostAnalytics, 'pa', 'pa.id = p.id')
      .select('p."authorId"', 'authorId')
      .distinct(true)
      .where('pa."updatedAt" > :lastRunAt', { lastRunAt })
      .andWhere('p."authorId" IS NOT NULL')
      .stream();

    await processStreamInBatches<{ authorId: string }>(
      stream,
      async (batch) => {
        await con.transaction((manager) =>
          syncUsersRetroactiveAchievements({
            con: manager,
            logger,
            userIds: batch.map((row) => row.authorId),
            eventTypes: analyticsEventTypes,
          }),
        );
      },
      concurrency,
      batchSize,
    );

    await setRedisHash<PostAnalyticsAchievementsCronConfig>(redisStorageKey, {
      lastRunAt: currentRunAt.toISOString(),
    });
  },
};

import { crons } from '../../src/cron/index';
import { postAnalyticsAchievementsCron as cron } from '../../src/cron/postAnalyticsAchievements';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import createOrGetConnection from '../../src/db';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  Achievement,
  AchievementEventType,
  AchievementType,
  Post,
  PostType,
  Source,
  User,
} from '../../src/entity';
import { PostAnalytics } from '../../src/entity/posts/PostAnalytics';
import { UserAchievement } from '../../src/entity/user/UserAchievement';
import { sourcesFixture } from '../fixture/source';
import { deleteRedisKey, setRedisHash } from '../../src/redis';
import { generateStorageKey, StorageTopic } from '../../src/config';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const cronConfigRedisKey = generateStorageKey(
  StorageTopic.Cron,
  cron.name,
  'config',
);

const authorId = randomUUID();
const impressionsAchievementId = randomUUID();
const shareClickAchievementId = randomUUID();
const shareClickMilestoneAchievementId = randomUUID();
const sharePostsClickedAchievementId = randomUUID();

beforeEach(async () => {
  jest.clearAllMocks();
  await deleteRedisKey(cronConfigRedisKey);

  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, User, [
    {
      id: authorId,
      name: 'Analytics Author',
      image: 'https://daily.dev/analytics-author.jpg',
      email: `analytics-author-${authorId}@daily.dev`,
      username: `analytics${authorId.slice(0, 8)}`,
      infoConfirmed: true,
    },
  ]);

  await con.getRepository(Achievement).save([
    {
      id: impressionsAchievementId,
      name: 'Post Impressions Achievement',
      description: 'Reach 2000 impressions',
      image: '',
      type: AchievementType.Milestone,
      eventType: AchievementEventType.PostImpressions,
      criteria: { targetCount: 2000 },
      points: 10,
    },
    {
      id: shareClickAchievementId,
      name: 'Share Click Achievement',
      description: 'Get your first share click',
      image: '',
      type: AchievementType.Instant,
      eventType: AchievementEventType.ShareClick,
      criteria: { targetCount: 1 },
      points: 10,
    },
    {
      id: shareClickMilestoneAchievementId,
      name: 'Share Click Milestone Achievement',
      description: 'Reach 10 clicks on a single share post',
      image: '',
      type: AchievementType.Milestone,
      eventType: AchievementEventType.ShareClickMilestone,
      criteria: { targetCount: 10 },
      points: 10,
    },
    {
      id: sharePostsClickedAchievementId,
      name: 'Share Posts Clicked Achievement',
      description: 'Have 5 share posts with clicks',
      image: '',
      type: AchievementType.Milestone,
      eventType: AchievementEventType.SharePostsClicked,
      criteria: { targetCount: 5 },
      points: 10,
    },
  ]);

  await con.getRepository(Post).save([
    {
      id: 'paa-article',
      shortId: 'paaart1',
      title: 'Analytics article',
      authorId,
      sourceId: 'a',
      type: PostType.Article,
    },
    {
      id: 'paa-share',
      shortId: 'paashr1',
      title: 'Analytics share',
      authorId,
      sourceId: 'a',
      type: PostType.Share,
    },
  ]);
});

describe('postAnalyticsAchievements cron', () => {
  it('should be registered', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);

    expect(registeredWorker).toBeDefined();
  });

  it('should sync analytics achievements for authors with recent analytics changes', async () => {
    await con.getRepository(PostAnalytics).save([
      { id: 'paa-article', impressions: 700, impressionsAds: 300, clicks: 0 },
      { id: 'paa-share', impressions: 0, impressionsAds: 0, clicks: 5 },
    ]);

    await expectSuccessfulCron(cron);

    const progress = await con.getRepository(UserAchievement).find({
      where: { userId: authorId },
    });

    expect(progress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          achievementId: impressionsAchievementId,
          progress: 1000,
          unlockedAt: null,
        }),
        expect.objectContaining({
          achievementId: shareClickMilestoneAchievementId,
          progress: 5,
          unlockedAt: null,
        }),
        expect.objectContaining({
          achievementId: sharePostsClickedAchievementId,
          progress: 1,
          unlockedAt: null,
        }),
      ]),
    );

    const shareClick = await con.getRepository(UserAchievement).findOneBy({
      achievementId: shareClickAchievementId,
      userId: authorId,
    });
    expect(shareClick?.progress).toEqual(1);
    expect(shareClick?.unlockedAt).not.toBeNull();
  });

  it('should not process analytics that predate the last run', async () => {
    await con.getRepository(PostAnalytics).save([
      {
        id: 'paa-article',
        impressions: 1000,
        impressionsAds: 1000,
        clicks: 0,
      },
    ]);

    await setRedisHash(cronConfigRedisKey, {
      lastRunAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await expectSuccessfulCron(cron);

    const progress = await con.getRepository(UserAchievement).findOneBy({
      achievementId: impressionsAchievementId,
      userId: authorId,
    });

    expect(progress).toBeNull();
  });
});

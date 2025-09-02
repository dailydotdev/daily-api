import { crons } from '../../src/cron/index';
import { postAnalyticsClickhouseCron as cron } from '../../src/cron/postAnalyticsClickhouse';
import {
  expectSuccessfulCron,
  mockClickhouseClientOnce,
  mockClickhouseQueryJSONOnce,
} from '../helpers';
import { postAnalyticsFixture } from '../fixture/postAnalytics';
import createOrGetConnection from '../../src/db';
import type { DataSource } from 'typeorm';
import { PostAnalytics } from '../../src/entity/posts/PostAnalytics';
import { deleteRedisKey, getRedisHash } from '../../src/redis';
import { generateStorageKey, StorageTopic } from '../../src/config';
import { format, startOfToday } from 'date-fns';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const cronConfigRedisKey = generateStorageKey(
  StorageTopic.Cron,
  cron.name,
  'config',
);

beforeEach(async () => {
  jest.clearAllMocks();
  await deleteRedisKey(cronConfigRedisKey);
});

describe('postAnalyticsClickhouse cron', () => {
  it('should be registered', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);

    expect(registeredWorker).toBeDefined();
  });

  it('should sync post analytics data', async () => {
    const clickhouseClientMock = mockClickhouseClientOnce();

    const queryJSONSpy = mockClickhouseQueryJSONOnce(
      clickhouseClientMock,
      postAnalyticsFixture.map((item, index) => {
        return {
          ...item,
          updatedAt: new Date(Date.now() + index * 1000).toISOString(),
          id: `pap-${index}`,
        };
      }),
    );

    const now = new Date();

    await expectSuccessfulCron(cron);

    expect(queryJSONSpy).toHaveBeenCalledTimes(1);
    expect(queryJSONSpy).toHaveBeenCalledWith({
      query: expect.stringContaining('SELECT'),
      format: 'JSONEachRow',
      query_params: {
        lastRunAt: format(startOfToday(), 'yyyy-MM-dd HH:mm:ss'),
      },
    });

    const postAnalytics = await con.getRepository(PostAnalytics).find({
      order: {
        updatedAt: 'ASC',
      },
    });

    expect(postAnalytics.length).toBe(postAnalyticsFixture.length);

    postAnalytics.forEach((item, index) => {
      expect(item).toEqual({
        id: `pap-${index}`,
        updatedAt: expect.any(Date),
        createdAt: expect.any(Date),
        ...postAnalyticsFixture[index],
        awards: 0,
        comments: 0,
        coresEarned: 0,
        downvotes: 0,
        reputation: 0,
        upvotes: 0,
        boostImpressions: 0,
        boostReach: 0,
      } as PostAnalytics);
    });

    const cronConfig = await getRedisHash(cronConfigRedisKey);

    expect(cronConfig).toBeDefined();
    expect(cronConfig.lastRunAt).toBeDefined();
    expect(new Date(cronConfig.lastRunAt).getTime()).toBeGreaterThan(
      now.getTime(),
    );
  });

  it('should use lastRunAt from previous run', async () => {
    let clickhouseClientMock = mockClickhouseClientOnce();

    mockClickhouseQueryJSONOnce(
      clickhouseClientMock,
      postAnalyticsFixture.map((item, index) => {
        return {
          ...item,
          updatedAt: new Date(Date.now() + index * 1000).toISOString(),
          id: `pap-${index}`,
        };
      }),
    );

    await expectSuccessfulCron(cron);

    const postAnalytics = await con.getRepository(PostAnalytics).find({
      order: {
        updatedAt: 'ASC',
      },
    });

    expect(postAnalytics.length).toBe(postAnalyticsFixture.length);

    postAnalytics.forEach((item, index) => {
      expect(item).toEqual({
        id: `pap-${index}`,
        updatedAt: expect.any(Date),
        createdAt: expect.any(Date),
        ...postAnalyticsFixture[index],
        awards: 0,
        comments: 0,
        coresEarned: 0,
        downvotes: 0,
        reputation: 0,
        upvotes: 0,
        boostImpressions: 0,
        boostReach: 0,
      } as PostAnalytics);
    });

    const lastCronConfig = await getRedisHash(cronConfigRedisKey);

    clickhouseClientMock = mockClickhouseClientOnce();

    const queryJSONSpy = mockClickhouseQueryJSONOnce(
      clickhouseClientMock,
      postAnalyticsFixture.map((item, index) => {
        return {
          ...item,
          updatedAt: new Date(Date.now() + index * 1000).toISOString(),
          id: `pap-${index}`,
        };
      }),
    );

    await expectSuccessfulCron(cron);

    expect(queryJSONSpy).toHaveBeenCalledTimes(1);
    expect(queryJSONSpy).toHaveBeenCalledWith({
      query: expect.stringContaining('SELECT'),
      format: 'JSONEachRow',
      query_params: {
        lastRunAt: format(
          new Date(lastCronConfig.lastRunAt),
          'yyyy-MM-dd HH:mm:ss',
        ),
      },
    });

    const cronConfig = await getRedisHash(cronConfigRedisKey);

    expect(cronConfig).toBeDefined();
    expect(cronConfig.lastRunAt).toBeDefined();
    expect(new Date(cronConfig.lastRunAt).getTime()).toBeGreaterThan(
      new Date(lastCronConfig.lastRunAt).getTime(),
    );
  });

  it('should upsert new post analytics data on repeated runs', async () => {
    let clickhouseClientMock = mockClickhouseClientOnce();

    mockClickhouseQueryJSONOnce(
      clickhouseClientMock,
      postAnalyticsFixture.map((item, index) => {
        return {
          ...item,
          updatedAt: new Date(Date.now() + index * 1000).toISOString(),
          id: `pap-${index}`,
        };
      }),
    );

    await expectSuccessfulCron(cron);

    clickhouseClientMock = mockClickhouseClientOnce();

    mockClickhouseQueryJSONOnce(
      clickhouseClientMock,
      postAnalyticsFixture.map((item, index) => {
        return {
          ...item,
          updatedAt: new Date(Date.now() + index * 1000).toISOString(),
          id: `pap-${index}`,
          impressions: item.impressions + 10,
        };
      }),
    );

    await expectSuccessfulCron(cron);

    const postAnalytics = await con.getRepository(PostAnalytics).find({
      select: ['id', 'impressions'],
      order: {
        updatedAt: 'ASC',
      },
    });

    expect(postAnalytics.length).toBe(postAnalyticsFixture.length);

    postAnalytics.forEach((item, index) => {
      expect(item).toEqual({
        id: `pap-${index}`,
        impressions: postAnalyticsFixture[index].impressions + 10,
      } as PostAnalytics);
    });
  });
});

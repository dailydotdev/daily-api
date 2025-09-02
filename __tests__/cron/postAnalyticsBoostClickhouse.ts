import { crons } from '../../src/cron/index';
import { postAnalyticsBoostClickhouseCron as cron } from '../../src/cron/postAnalyticsBoostClickhouse';
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

describe('postAnalyticsBoostClickhouse cron', () => {
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
          updatedAt: new Date(Date.now() + index * 1000).toISOString(),
          id: `pabp-${index}`,
          boostImpressions: item.impressions,
          boostReach: item.reach,
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
      select: [
        'id',
        'createdAt',
        'updatedAt',
        'boostImpressions',
        'boostReach',
      ],
      order: {
        updatedAt: 'ASC',
      },
    });

    expect(postAnalytics.length).toBe(postAnalyticsFixture.length);

    postAnalytics.forEach((item, index) => {
      expect(item).toEqual({
        id: `pabp-${index}`,
        updatedAt: expect.any(Date),
        createdAt: expect.any(Date),
        boostImpressions: postAnalyticsFixture[index].impressions,
        boostReach: postAnalyticsFixture[index].reach,
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
          updatedAt: new Date(Date.now() + index * 1000).toISOString(),
          id: `pabp-${index}`,
          boostImpressions: item.impressions,
          boostReach: item.reach,
        };
      }),
    );

    await expectSuccessfulCron(cron);

    const postAnalytics = await con.getRepository(PostAnalytics).find({
      select: [
        'id',
        'createdAt',
        'updatedAt',
        'boostImpressions',
        'boostReach',
      ],
      order: {
        updatedAt: 'ASC',
      },
    });

    expect(postAnalytics.length).toBe(postAnalyticsFixture.length);

    postAnalytics.forEach((item, index) => {
      expect(item).toEqual({
        id: `pabp-${index}`,
        updatedAt: expect.any(Date),
        createdAt: expect.any(Date),
        boostImpressions: postAnalyticsFixture[index].impressions,
        boostReach: postAnalyticsFixture[index].reach,
      } as PostAnalytics);
    });

    const lastCronConfig = await getRedisHash(cronConfigRedisKey);

    clickhouseClientMock = mockClickhouseClientOnce();

    const queryJSONSpy = mockClickhouseQueryJSONOnce(
      clickhouseClientMock,
      postAnalyticsFixture.map((item, index) => {
        return {
          updatedAt: new Date(Date.now() + index * 1000).toISOString(),
          id: `pabp-${index}`,
          boostImpressions: item.impressions,
          boostReach: item.reach,
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
          updatedAt: new Date(Date.now() + index * 1000).toISOString(),
          id: `pabp-${index}`,
          boostImpressions: item.impressions,
          boostReach: item.reach,
        };
      }),
    );

    await expectSuccessfulCron(cron);

    clickhouseClientMock = mockClickhouseClientOnce();

    mockClickhouseQueryJSONOnce(
      clickhouseClientMock,
      postAnalyticsFixture.map((item, index) => {
        return {
          updatedAt: new Date(Date.now() + index * 1000).toISOString(),
          id: `pabp-${index}`,
          boostImpressions: item.impressions + 10,
          boostReach: item.reach + 10,
        };
      }),
    );

    await expectSuccessfulCron(cron);

    const postAnalytics = await con.getRepository(PostAnalytics).find({
      select: ['id', 'boostImpressions', 'boostReach'],
      order: {
        updatedAt: 'ASC',
      },
    });

    expect(postAnalytics.length).toBe(postAnalyticsFixture.length);

    postAnalytics.forEach((item, index) => {
      expect(item).toEqual({
        id: `pabp-${index}`,
        boostImpressions: postAnalyticsFixture[index].impressions + 10,
        boostReach: postAnalyticsFixture[index].reach + 10,
      } as PostAnalytics);
    });
  });
});

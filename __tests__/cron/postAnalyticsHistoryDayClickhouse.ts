import { crons } from '../../src/cron/index';
import { postAnalyticsHistoryDayClickhouseCron as cron } from '../../src/cron/postAnalyticsHistoryDayClickhouse';

import {
  expectSuccessfulCron,
  mockClickhouseClientOnce,
  mockClickhouseQueryJSONOnce,
} from '../helpers';
import { postAnalyticsFixture } from '../fixture/postAnalytics';
import createOrGetConnection from '../../src/db';
import type { DataSource } from 'typeorm';
import { deleteRedisKey, getRedisHash } from '../../src/redis';
import { generateStorageKey, StorageTopic } from '../../src/config';
import { format, startOfToday } from 'date-fns';
import { PostAnalyticsHistory } from '../../src/entity/posts/PostAnalyticsHistory';

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

describe('postAnalyticsHistoryDayClickhouse cron', () => {
  it('should be registered', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);

    expect(registeredWorker).toBeDefined();
  });

  it('should sync post analytics data', async () => {
    const clickhouseClientMock = mockClickhouseClientOnce();
    const date = format(new Date(), 'yyyy-MM-dd');

    const queryJSONSpy = mockClickhouseQueryJSONOnce(
      clickhouseClientMock,
      postAnalyticsFixture.map((item, index) => {
        return {
          updatedAt: new Date(Date.now() + index * 1000).toISOString(),
          id: `pap-${index}`,
          date,
          impressions: item.impressions,
          impressionsAds: item.impressionsAds,
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
        date,
        lastRunAt: format(startOfToday(), 'yyyy-MM-dd HH:mm:ss'),
      },
    });

    const postAnalytics = await con.getRepository(PostAnalyticsHistory).find({
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
        impressions: postAnalyticsFixture[index].impressions,
        impressionsAds: postAnalyticsFixture[index].impressionsAds,
        date,
      } as PostAnalyticsHistory);
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
    const date = format(new Date(), 'yyyy-MM-dd');

    mockClickhouseQueryJSONOnce(
      clickhouseClientMock,
      postAnalyticsFixture.map((item, index) => {
        return {
          updatedAt: new Date(Date.now() + index * 1000).toISOString(),
          id: `pap-${index}`,
          date,
          impressions: item.impressions,
          impressionsAds: item.impressionsAds,
        };
      }),
    );

    await expectSuccessfulCron(cron);

    const postAnalytics = await con.getRepository(PostAnalyticsHistory).find({
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
        impressions: postAnalyticsFixture[index].impressions,
        impressionsAds: postAnalyticsFixture[index].impressionsAds,
        date,
      } as PostAnalyticsHistory);
    });

    const lastCronConfig = await getRedisHash(cronConfigRedisKey);

    clickhouseClientMock = mockClickhouseClientOnce();

    const queryJSONSpy = mockClickhouseQueryJSONOnce(
      clickhouseClientMock,
      postAnalyticsFixture.map((item, index) => {
        return {
          updatedAt: new Date(Date.now() + index * 1000).toISOString(),
          id: `pap-${index}`,
          date,
          impressions: item.impressions,
          impressionsAds: item.impressionsAds,
        };
      }),
    );

    await expectSuccessfulCron(cron);

    expect(queryJSONSpy).toHaveBeenCalledTimes(1);
    expect(queryJSONSpy).toHaveBeenCalledWith({
      query: expect.stringContaining('SELECT'),
      format: 'JSONEachRow',
      query_params: {
        date,
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
    const date = format(new Date(), 'yyyy-MM-dd');

    mockClickhouseQueryJSONOnce(
      clickhouseClientMock,
      postAnalyticsFixture.map((item, index) => {
        return {
          updatedAt: new Date(Date.now() + index * 1000).toISOString(),
          id: `pap-${index}`,
          date,
          impressions: item.impressions,
          impressionsAds: item.impressionsAds,
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
          id: `pap-${index}`,
          date,
          impressions: item.impressions + 10,
          impressionsAds: item.impressionsAds + 5,
        };
      }),
    );

    await expectSuccessfulCron(cron);

    const postAnalytics = await con.getRepository(PostAnalyticsHistory).find({
      select: ['id', 'impressions', 'date', 'impressionsAds'],
      order: {
        updatedAt: 'ASC',
      },
    });

    expect(postAnalytics.length).toBe(postAnalyticsFixture.length);

    postAnalytics.forEach((item, index) => {
      expect(item).toEqual({
        id: `pap-${index}`,
        date,
        impressions: postAnalyticsFixture[index].impressions + 10,
        impressionsAds: postAnalyticsFixture[index].impressionsAds + 5,
      } as PostAnalyticsHistory);
    });
  });
});

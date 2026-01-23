import { crons } from '../../src/cron/index';
import { userProfileAnalyticsHistoryClickhouseCron as cron } from '../../src/cron/userProfileAnalyticsHistoryClickhouse';
import {
  expectSuccessfulCron,
  mockClickhouseClientOnce,
  mockClickhouseQueryJSONOnce,
  saveFixtures,
} from '../helpers';
import { userProfileAnalyticsFixture } from '../fixture/userProfileAnalytics';
import { usersFixture, plusUsersFixture } from '../fixture/user';
import createOrGetConnection from '../../src/db';
import type { DataSource } from 'typeorm';
import { UserProfileAnalyticsHistory } from '../../src/entity/user/UserProfileAnalyticsHistory';
import { User } from '../../src/entity/user/User';
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
  await saveFixtures(con, User, [...usersFixture, ...plusUsersFixture]);
});

const userIds = ['1', '2', '3', '4', '5'];

describe('userProfileAnalyticsHistoryClickhouse cron', () => {
  it('should be registered', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);

    expect(registeredWorker).toBeDefined();
  });

  it('should sync user profile analytics history data', async () => {
    const clickhouseClientMock = mockClickhouseClientOnce();
    const date = format(new Date(), 'yyyy-MM-dd');

    const queryJSONSpy = mockClickhouseQueryJSONOnce(
      clickhouseClientMock,
      userProfileAnalyticsFixture.map((item, index) => ({
        updatedAt: new Date(Date.now() + index * 1000).toISOString(),
        id: userIds[index],
        date,
        uniqueVisitors: item.uniqueVisitors,
      })),
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

    const userProfileAnalyticsHistory = await con
      .getRepository(UserProfileAnalyticsHistory)
      .find({
        order: {
          updatedAt: 'ASC',
        },
      });

    expect(userProfileAnalyticsHistory.length).toBe(
      userProfileAnalyticsFixture.length,
    );

    userProfileAnalyticsHistory.forEach((item, index) => {
      expect(item).toEqual({
        id: userIds[index],
        updatedAt: expect.any(Date),
        createdAt: expect.any(Date),
        uniqueVisitors: userProfileAnalyticsFixture[index].uniqueVisitors,
        date,
      } as UserProfileAnalyticsHistory);
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
      userProfileAnalyticsFixture.map((item, index) => ({
        updatedAt: new Date(Date.now() + index * 1000).toISOString(),
        id: userIds[index],
        date,
        uniqueVisitors: item.uniqueVisitors,
      })),
    );

    await expectSuccessfulCron(cron);

    const userProfileAnalyticsHistory = await con
      .getRepository(UserProfileAnalyticsHistory)
      .find({
        order: {
          updatedAt: 'ASC',
        },
      });

    expect(userProfileAnalyticsHistory.length).toBe(
      userProfileAnalyticsFixture.length,
    );

    userProfileAnalyticsHistory.forEach((item, index) => {
      expect(item).toEqual({
        id: userIds[index],
        updatedAt: expect.any(Date),
        createdAt: expect.any(Date),
        uniqueVisitors: userProfileAnalyticsFixture[index].uniqueVisitors,
        date,
      } as UserProfileAnalyticsHistory);
    });

    const lastCronConfig = await getRedisHash(cronConfigRedisKey);

    clickhouseClientMock = mockClickhouseClientOnce();

    const queryJSONSpy = mockClickhouseQueryJSONOnce(
      clickhouseClientMock,
      userProfileAnalyticsFixture.map((item, index) => ({
        updatedAt: new Date(Date.now() + index * 1000).toISOString(),
        id: userIds[index],
        date,
        uniqueVisitors: item.uniqueVisitors,
      })),
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

  it('should upsert user profile analytics history data on repeated runs', async () => {
    let clickhouseClientMock = mockClickhouseClientOnce();
    const date = format(new Date(), 'yyyy-MM-dd');

    mockClickhouseQueryJSONOnce(
      clickhouseClientMock,
      userProfileAnalyticsFixture.map((item, index) => ({
        updatedAt: new Date(Date.now() + index * 1000).toISOString(),
        id: userIds[index],
        date,
        uniqueVisitors: item.uniqueVisitors,
      })),
    );

    await expectSuccessfulCron(cron);

    clickhouseClientMock = mockClickhouseClientOnce();

    mockClickhouseQueryJSONOnce(
      clickhouseClientMock,
      userProfileAnalyticsFixture.map((item, index) => ({
        updatedAt: new Date(Date.now() + index * 1000).toISOString(),
        id: userIds[index],
        date,
        uniqueVisitors: item.uniqueVisitors + 50,
      })),
    );

    await expectSuccessfulCron(cron);

    const userProfileAnalyticsHistory = await con
      .getRepository(UserProfileAnalyticsHistory)
      .find({
        select: ['id', 'uniqueVisitors', 'date'],
        order: {
          updatedAt: 'ASC',
        },
      });

    expect(userProfileAnalyticsHistory.length).toBe(
      userProfileAnalyticsFixture.length,
    );

    userProfileAnalyticsHistory.forEach((item, index) => {
      expect(item).toEqual({
        id: userIds[index],
        date,
        uniqueVisitors: userProfileAnalyticsFixture[index].uniqueVisitors + 50,
      } as UserProfileAnalyticsHistory);
    });
  });
});

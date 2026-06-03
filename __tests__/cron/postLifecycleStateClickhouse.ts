import { crons } from '../../src/cron/index';
import { postLifecycleStateClickhouseCron as cron } from '../../src/cron/postLifecycleStateClickhouse';
import {
  expectSuccessfulCron,
  mockClickhouseClientOnce,
  mockClickhouseQueryJSONOnce,
  saveFixtures,
} from '../helpers';
import createOrGetConnection from '../../src/db';
import type { DataSource } from 'typeorm';
import {
  PostLifecycleState,
  PostLifecycleStateValue,
} from '../../src/entity/PostLifecycleState';
import { Post, Source } from '../../src/entity';
import { PostHero } from '../../src/entity/PostHero';
import { postsFixture } from '../fixture/post';
import { sourcesFixture } from '../fixture/source';
import { deleteRedisKey, getRedisHash } from '../../src/redis';
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

beforeEach(async () => {
  jest.clearAllMocks();
  await deleteRedisKey(cronConfigRedisKey);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await con.getRepository(PostLifecycleState).clear();
});

describe('postLifecycleStateClickhouse cron', () => {
  it('should be registered', () => {
    const registered = crons.find((item) => item.name === cron.name);

    expect(registered).toBeDefined();
  });

  it('should insert a new breakout row', async () => {
    const clickhouseClientMock = mockClickhouseClientOnce();
    mockClickhouseQueryJSONOnce(clickhouseClientMock, [
      {
        post_id: 'p1',
        state: PostLifecycleStateValue.Breakout,
        last_updated_at: new Date().toISOString(),
      },
    ]);

    await expectSuccessfulCron(cron);

    const rows = await con.getRepository(PostLifecycleState).find();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      postId: 'p1',
      state: PostLifecycleStateValue.Breakout,
      updatedAt: expect.any(Date),
    });
  });

  it('should insert a new evergreen row', async () => {
    const clickhouseClientMock = mockClickhouseClientOnce();
    mockClickhouseQueryJSONOnce(clickhouseClientMock, [
      {
        post_id: 'p1',
        state: PostLifecycleStateValue.Evergreen,
        last_updated_at: new Date().toISOString(),
      },
    ]);

    await expectSuccessfulCron(cron);

    const rows = await con.getRepository(PostLifecycleState).find();
    expect(rows).toHaveLength(1);
    expect(rows[0].state).toBe(PostLifecycleStateValue.Evergreen);
  });

  it('should update state and bump updatedAt on subsequent sync', async () => {
    const earlier = new Date(Date.now() - 60 * 60 * 1000);
    await con.getRepository(PostLifecycleState).insert({
      postId: 'p1',
      state: PostLifecycleStateValue.Breakout,
      updatedAt: earlier,
    });

    const clickhouseClientMock = mockClickhouseClientOnce();
    mockClickhouseQueryJSONOnce(clickhouseClientMock, [
      {
        post_id: 'p1',
        state: PostLifecycleStateValue.Evergreen,
        last_updated_at: new Date().toISOString(),
      },
    ]);

    await expectSuccessfulCron(cron);

    const row = await con
      .getRepository(PostLifecycleState)
      .findOneByOrFail({ postId: 'p1' });
    expect(row.state).toBe(PostLifecycleStateValue.Evergreen);
    expect(row.updatedAt.getTime()).toBeGreaterThan(earlier.getTime());
  });

  it('should delete row when state moves to untracked', async () => {
    await con.getRepository(PostLifecycleState).insert({
      postId: 'p1',
      state: PostLifecycleStateValue.Breakout,
    });

    const clickhouseClientMock = mockClickhouseClientOnce();
    mockClickhouseQueryJSONOnce(clickhouseClientMock, [
      {
        post_id: 'p1',
        state: 'steady',
        last_updated_at: new Date().toISOString(),
      },
    ]);

    await expectSuccessfulCron(cron);

    const rows = await con.getRepository(PostLifecycleState).find();
    expect(rows).toHaveLength(0);
  });

  it('should not error when deleting a non-existent row', async () => {
    const clickhouseClientMock = mockClickhouseClientOnce();
    mockClickhouseQueryJSONOnce(clickhouseClientMock, [
      {
        post_id: 'p1',
        state: 'killed',
        last_updated_at: new Date().toISOString(),
      },
    ]);

    await expectSuccessfulCron(cron);

    const rows = await con.getRepository(PostLifecycleState).find();
    expect(rows).toHaveLength(0);
  });

  it('should persist lastRunAt on success', async () => {
    const now = new Date();
    const clickhouseClientMock = mockClickhouseClientOnce();
    mockClickhouseQueryJSONOnce(clickhouseClientMock, []);

    await expectSuccessfulCron(cron);

    const cronConfig = await getRedisHash(cronConfigRedisKey);
    expect(cronConfig.lastRunAt).toBeDefined();
    expect(new Date(cronConfig.lastRunAt).getTime()).toBeGreaterThanOrEqual(
      now.getTime() - 1000,
    );
  });

  it('should handle empty clickhouse response', async () => {
    const clickhouseClientMock = mockClickhouseClientOnce();
    mockClickhouseQueryJSONOnce(clickhouseClientMock, []);

    await expectSuccessfulCron(cron);

    const rows = await con.getRepository(PostLifecycleState).find();
    expect(rows).toHaveLength(0);
  });

  it('should refresh post_hero MV after sync', async () => {
    const clickhouseClientMock = mockClickhouseClientOnce();
    mockClickhouseQueryJSONOnce(clickhouseClientMock, [
      {
        post_id: 'p1',
        state: PostLifecycleStateValue.Breakout,
        last_updated_at: new Date().toISOString(),
      },
    ]);

    await expectSuccessfulCron(cron);

    const hero = await con.getRepository(PostHero).findOneBy({ postId: 'p1' });
    expect(hero).toMatchObject({
      postId: 'p1',
      headline: 'Breaking out',
    });
  });
});

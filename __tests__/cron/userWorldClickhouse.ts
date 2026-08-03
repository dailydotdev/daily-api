import type { DataSource } from 'typeorm';
import { crons } from '../../src/cron/index';
import { userWorldClickhouseCron as cron } from '../../src/cron/userWorldClickhouse';
import {
  expectSuccessfulCron,
  mockClickhouseClientOnce,
  mockClickhouseQueryJSONOnce,
  saveFixtures,
} from '../helpers';
import createOrGetConnection from '../../src/db';
import { UserNicheAnalytics } from '../../src/entity/user/UserNicheAnalytics';
import { UserNicheGrowth } from '../../src/entity/user/UserNicheGrowth';
import { Niche } from '../../src/entity/Niche';
import { User } from '../../src/entity/user/User';
import { usersFixture } from '../fixture/user';
import { deleteRedisKey, getRedisHash, setRedisHash } from '../../src/redis';
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

// Must be well-formed v4 UUIDs: the delta schema validates `nicheId` with
// z.uuid(), which enforces the version and variant nibbles. Repeated-digit
// placeholders like 1111-1111-1111 fail it.
const nicheJs = '11111111-1111-4111-8111-111111111111';
const nicheAi = '22222222-2222-4222-8222-222222222222';

// Well before the fixture dates, so every delta falls inside the window.
const seedCursor = '2026-01-01T00:00:00.000Z';

beforeEach(async () => {
  jest.clearAllMocks();
  await deleteRedisKey(cronConfigRedisKey);
  // Production always has a cursor once the bulk seed has run; an absent one is
  // the recovery path, exercised explicitly below.
  await setRedisHash(cronConfigRedisKey, { cursor: seedCursor });
  await con.getRepository(UserNicheAnalytics).clear();
  await con.getRepository(UserNicheGrowth).clear();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Niche, [
    { id: nicheJs, slug: 'js_ts', title: 'JavaScript / TypeScript' },
    { id: nicheAi, slug: 'ai_llm', title: 'LLMs' },
  ]);
});

const delta = [
  { userId: '1', date: '2026-07-01', nicheId: nicheJs, reads: 3 },
  { userId: '1', date: '2026-07-02', nicheId: nicheJs, reads: 2 },
  { userId: '1', date: '2026-07-02', nicheId: nicheAi, reads: 5 },
  { userId: '2', date: '2026-07-03', nicheId: nicheAi, reads: 1 },
];

const runWith = async (rows: typeof delta) => {
  const client = mockClickhouseClientOnce();
  mockClickhouseQueryJSONOnce(client, rows);
  await expectSuccessfulCron(cron);
};

describe('userWorldClickhouse cron', () => {
  it('should be registered', () => {
    expect(crons.find((item) => item.name === cron.name)).toBeDefined();
  });

  it('should write the growth log and fold it into districts', async () => {
    await runWith(delta);

    const growth = await con
      .getRepository(UserNicheGrowth)
      .find({ order: { userId: 'ASC', date: 'ASC', nicheId: 'ASC' } });
    expect(growth).toHaveLength(4);

    const districts = await con
      .getRepository(UserNicheAnalytics)
      .find({ where: { userId: '1' }, order: { reads: 'DESC' } });

    expect(districts).toHaveLength(2);
    // js_ts spans two days, so its reads sum and activeDays counts both
    expect(districts).toEqual([
      expect.objectContaining({
        userId: '1',
        nicheId: nicheJs,
        reads: 5,
        firstReadAt: '2026-07-01',
        lastReadAt: '2026-07-02',
        activeDays: 2,
      }),
      expect.objectContaining({
        userId: '1',
        nicheId: nicheAi,
        reads: 5,
        firstReadAt: '2026-07-02',
        lastReadAt: '2026-07-02',
        activeDays: 1,
      }),
    ]);
  });

  it('should be a no-op when the same window is replayed', async () => {
    await runWith(delta);
    const before = await con.getRepository(UserNicheAnalytics).find();

    // Drop the cursor entirely: the cron recovers it from the growth log, which
    // lands a day after the newest row, and the identical window is fetched again.
    // Districts advance only from rows the growth insert returned, and every row
    // now conflicts, so this must be inert rather than double-counting.
    await deleteRedisKey(cronConfigRedisKey);
    await runWith(delta);

    const after = await con.getRepository(UserNicheAnalytics).find();
    expect(after).toHaveLength(before.length);
    expect(
      after.map(({ userId, nicheId, reads, activeDays }) => ({
        userId,
        nicheId,
        reads,
        activeDays,
      })),
    ).toEqual(
      before.map(({ userId, nicheId, reads, activeDays }) => ({
        userId,
        nicheId,
        reads,
        activeDays,
      })),
    );
    expect(await con.getRepository(UserNicheGrowth).count()).toBe(4);
  });

  it('should accumulate across windows', async () => {
    await runWith(delta);
    // a later day's run; the cursor is recovered from the growth log
    await deleteRedisKey(cronConfigRedisKey);
    await runWith([
      { userId: '1', date: '2026-07-05', nicheId: nicheJs, reads: 4 },
    ]);

    const district = await con
      .getRepository(UserNicheAnalytics)
      .findOneByOrFail({ userId: '1', nicheId: nicheJs });

    expect(district.reads).toBe(9);
    expect(district.activeDays).toBe(3);
    expect(district.firstReadAt).toBe('2026-07-01');
    expect(district.lastReadAt).toBe('2026-07-05');
  });

  it('should advance the cursor even when there is nothing to sync', async () => {
    await runWith([]);

    const config = await getRedisHash(cronConfigRedisKey);
    expect(config.cursor).toBeTruthy();
    expect(new Date(config.cursor).getTime()).not.toBeNaN();
  });

  it('should only ever cover whole UTC days', async () => {
    await runWith([]);

    // The growth row is inserted ON CONFLICT DO NOTHING, so a day written by one
    // run can never be topped up by the next. The cursor must therefore land on a
    // UTC midnight, or the tail of the day it stopped inside is lost for good.
    const { cursor } = await getRedisHash(cronConfigRedisKey);
    const at = new Date(cursor);

    expect(at.getUTCHours()).toBe(0);
    expect(at.getUTCMinutes()).toBe(0);
    expect(at.getUTCSeconds()).toBe(0);
    expect(at.getUTCMilliseconds()).toBe(0);
  });

  it('should recover the cursor from the growth log when redis is empty', async () => {
    await runWith(delta);
    await deleteRedisKey(cronConfigRedisKey);

    // Newest growth row is 2026-07-03, so the next window opens on 07-04 and a
    // read on 07-04 must be picked up rather than skipped or replayed from 2022.
    await runWith([
      { userId: '1', date: '2026-07-04', nicheId: nicheJs, reads: 2 },
    ]);

    const district = await con
      .getRepository(UserNicheAnalytics)
      .findOneByOrFail({ userId: '1', nicheId: nicheJs });

    expect(district.reads).toBe(7);
    expect(district.lastReadAt).toBe('2026-07-04');
  });

  it('should refuse to run with no cursor and an empty growth log', async () => {
    await deleteRedisKey(cronConfigRedisKey);

    // Guessing here is worse than failing: an early default replays years through
    // the delta path, a late one silently skips whatever was missed.
    await expect(expectSuccessfulCron(cron)).rejects.toThrow(
      /user_niche_growth is empty/,
    );
  });

  it('should skip users that no longer exist in postgres', async () => {
    // The delta is built from a ClickHouse mirror of the user table, which lags.
    // A row for an account Postgres has already deleted violates the growth FK and
    // aborts the whole transaction — so the rest of the batch must not be lost with
    // it. This is the failure that took down the first production run.
    await runWith([
      ...delta,
      {
        userId: 'deleted-user',
        date: '2026-07-02',
        nicheId: nicheJs,
        reads: 9,
      },
    ]);

    expect(await con.getRepository(UserNicheGrowth).count()).toBe(delta.length);
    expect(
      await con
        .getRepository(UserNicheGrowth)
        .countBy({ userId: 'deleted-user' }),
    ).toBe(0);

    // the surviving rows still fold into districts exactly as they would have
    const district = await con
      .getRepository(UserNicheAnalytics)
      .findOneByOrFail({ userId: '1', nicheId: nicheJs });
    expect(district.reads).toBe(5);
    expect(district.activeDays).toBe(2);
  });

  it('should be a no-op when run twice on the same day', async () => {
    await runWith(delta);
    const { cursor } = await getRedisHash(cronConfigRedisKey);

    // Second run: the cursor is already at the last UTC midnight, so the cron
    // returns before touching ClickHouse at all — no mock is consumed.
    await expectSuccessfulCron(cron);

    expect((await getRedisHash(cronConfigRedisKey)).cursor).toBe(cursor);
    expect(await con.getRepository(UserNicheGrowth).count()).toBe(4);
  });
});

import type { DataSource } from 'typeorm';
import { formatInTimeZone } from 'date-fns-tz';
import { subHours } from 'date-fns';
import createOrGetConnection from '../../../src/db';
import { Niche } from '../../../src/entity/Niche';
import { User } from '../../../src/entity/user/User';
import {
  Achievement,
  AchievementEventType,
  AchievementType,
} from '../../../src/entity/Achievement';
import { UserAchievement } from '../../../src/entity/user/UserAchievement';
import { NotificationType } from '../../../src/notifications/common';
import type { NotificationWorldDistrictLevelUpContext } from '../../../src/notifications';
import { worldDistrictLevelUpNotification as worker } from '../../../src/workers/notifications/worldDistrictLevelUpNotification';
import { workers } from '../../../src/workers';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { usersFixture } from '../../fixture/user';

let con: DataSource;

const nicheRust = '44444444-4444-4444-8444-444444444444';
const nicheGo = '66666666-6666-4666-8666-666666666666';
const nicheGone = '55555555-5555-4555-8555-555555555555';

const achievementFixture = {
  id: '88888888-8888-4888-8888-888888888888',
  name: 'World test achievement',
  description: 'Unlocked in a test',
  image: 'https://daily.dev/achievement.png',
  type: AchievementType.Instant,
  eventType: AchievementEventType.ProfileImageUpdate,
};

const invoke = (
  payload: Parameters<typeof worker.handler>[0],
): ReturnType<typeof worker.handler> =>
  invokeTypedNotificationWorker<'api.v1.world-district-level-up'>(
    worker,
    payload,
  );

const contextOf = async (
  payload: Parameters<typeof worker.handler>[0],
): Promise<NotificationWorldDistrictLevelUpContext> => {
  const result = await invoke(payload);

  expect(result).toHaveLength(1);
  expect(result![0].type).toBe(NotificationType.WorldDistrictLevelUp);

  return result![0].ctx as NotificationWorldDistrictLevelUpContext;
};

describe('worldDistrictLevelUpNotification worker', () => {
  beforeAll(async () => {
    con = await createOrGetConnection();
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    await con.getRepository(UserAchievement).clear();
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Niche, [
      { id: nicheRust, slug: 'rust', title: 'Rust' },
      { id: nicheGo, slug: 'go', title: 'Go' },
    ]);
  });

  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should notify the owner with the niche title', async () => {
    const ctx = await contextOf({
      userId: '1',
      districts: [{ nicheId: nicheRust, level: 7 }],
      total: 1,
    });

    expect(ctx.userIds).toEqual(['1']);
    expect(ctx.districts).toEqual([
      { nicheId: nicheRust, nicheTitle: 'Rust', level: 7 },
    ]);
    expect(ctx.total).toBe(1);
  });

  it('should hand the username to the world route, not the id', async () => {
    const ctx = await contextOf({
      userId: '1',
      districts: [{ nicheId: nicheRust, level: 7 }],
      total: 1,
    });

    // The route is /world/:handle. Reversed it lands on a profile tab that
    // does not exist.
    expect(ctx.handle).toBe('idoshamun');
  });

  it('should fall back to the id when the reader has no username', async () => {
    await con.getRepository(User).update({ id: '1' }, { username: null });

    const ctx = await contextOf({
      userId: '1',
      districts: [{ nicheId: nicheRust, level: 7 }],
      total: 1,
    });

    expect(ctx.handle).toBe('1');
  });

  it('should name at most two districts and keep the rest as a count', async () => {
    const ctx = await contextOf({
      userId: '1',
      districts: [
        { nicheId: nicheRust, level: 7 },
        { nicheId: nicheGo, level: 5 },
      ],
      total: 6,
    });

    expect(ctx.districts).toHaveLength(2);
    expect(ctx.total).toBe(6);
  });

  it('should bucket the dedup key by ISO week', async () => {
    const ctx = await contextOf({
      userId: '1',
      districts: [{ nicheId: nicheRust, level: 7 }],
      total: 1,
    });

    // The rate limit: the per-user notification unique key is derived from this,
    // so a second level-up in the same calendar week is dropped on insert.
    expect(ctx.dedupKey).toBe(
      formatInTimeZone(new Date(), 'Etc/UTC', "RRRR-'W'II"),
    );
  });

  it('should hold the send until a reasonable hour in the reader timezone', async () => {
    await con.getRepository(User).update({ id: '1' }, { timezone: 'Etc/UTC' });

    const ctx = await contextOf({
      userId: '1',
      districts: [{ nicheId: nicheRust, level: 7 }],
      total: 1,
    });

    // The cron runs at 03:00 UTC. Whenever the test happens to run, the send
    // must land on the configured hour rather than immediately.
    expect(ctx.sendAtMs).toBeGreaterThan(Date.now());
    expect(
      formatInTimeZone(new Date(ctx.sendAtMs as number), 'Etc/UTC', 'HH'),
    ).toBe('18');
  });

  it('should drop a district the catalogue no longer has, from names and count', async () => {
    const ctx = await contextOf({
      userId: '1',
      districts: [
        { nicheId: nicheRust, level: 7 },
        { nicheId: nicheGone, level: 5 },
      ],
      total: 2,
    });

    expect(ctx.districts).toEqual([
      { nicheId: nicheRust, nicheTitle: 'Rust', level: 7 },
    ]);
    // Counting it would promise growth the reader cannot find in their world.
    expect(ctx.total).toBe(1);
  });

  it('should do nothing when no niche survives', async () => {
    const result = await invoke({
      userId: '1',
      districts: [{ nicheId: nicheGone, level: 7 }],
      total: 1,
    });

    expect(result).toBeUndefined();
  });

  it('should stand down while the reader is unlocking achievements', async () => {
    await saveFixtures(con, Achievement, [achievementFixture]);
    await con.getRepository(UserAchievement).save({
      userId: '1',
      achievementId: achievementFixture.id,
      unlockedAt: subHours(new Date(), 2),
    });

    const result = await invoke({
      userId: '1',
      districts: [{ nicheId: nicheRust, level: 7 }],
      total: 1,
    });

    expect(result).toBeUndefined();
  });

  it('should take its turn once the achievement run dries up', async () => {
    await saveFixtures(con, Achievement, [achievementFixture]);
    await con.getRepository(UserAchievement).save({
      userId: '1',
      achievementId: achievementFixture.id,
      unlockedAt: subHours(new Date(), 30),
    });

    const ctx = await contextOf({
      userId: '1',
      districts: [{ nicheId: nicheRust, level: 7 }],
      total: 1,
    });

    expect(ctx.userIds).toEqual(['1']);
  });

  it('should ignore an achievement the reader has only made progress on', async () => {
    await saveFixtures(con, Achievement, [achievementFixture]);
    // Progress without an unlock produces no notification, so there is nothing
    // to stay out of the way of.
    await con.getRepository(UserAchievement).save({
      userId: '1',
      achievementId: achievementFixture.id,
      progress: 3,
      unlockedAt: null,
    });

    const ctx = await contextOf({
      userId: '1',
      districts: [{ nicheId: nicheRust, level: 7 }],
      total: 1,
    });

    expect(ctx.userIds).toEqual(['1']);
  });

  it('should stand down for one reader without touching another', async () => {
    await saveFixtures(con, Achievement, [achievementFixture]);
    await con.getRepository(UserAchievement).save({
      userId: '1',
      achievementId: achievementFixture.id,
      unlockedAt: subHours(new Date(), 2),
    });

    const quiet = await invoke({
      userId: '1',
      districts: [{ nicheId: nicheRust, level: 7 }],
      total: 1,
    });
    const other = await invoke({
      userId: '2',
      districts: [{ nicheId: nicheRust, level: 7 }],
      total: 1,
    });

    expect(quiet).toBeUndefined();
    expect(other).toHaveLength(1);
  });

  it('should do nothing when the user is gone', async () => {
    const result = await invoke({
      userId: 'deleted-user',
      districts: [{ nicheId: nicheRust, level: 7 }],
      total: 1,
    });

    expect(result).toBeUndefined();
  });
});

import updateAchievementRarity from '../../src/cron/updateAchievementRarity';
import { crons } from '../../src/cron/index';
import {
  AchievementType,
  AchievementEventType,
} from '../../src/entity/Achievement';
import { Achievement } from '../../src/entity/Achievement';
import { User } from '../../src/entity/user/User';
import { UserAchievement } from '../../src/entity/user/UserAchievement';
import createOrGetConnection from '../../src/db';
import { usersFixture } from '../fixture/user';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource, DeepPartial } from 'typeorm';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const createAchievement = (
  overrides: DeepPartial<Achievement> = {},
): DeepPartial<Achievement> => ({
  name: 'Test Achievement',
  description: 'A test achievement',
  image: 'https://daily.dev/badge.jpg',
  type: AchievementType.Instant,
  eventType: AchievementEventType.ProfileImageUpdate,
  criteria: {},
  points: 10,
  ...overrides,
});

describe('updateAchievementRarity cron', () => {
  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
  });

  it('should be registered', () => {
    const registeredCron = crons.find(
      ({ name }) => name === updateAchievementRarity.name,
    );

    expect(registeredCron).toBeDefined();
  });

  it('should update rarity using only unlocked achievements', async () => {
    const [a1, a2, a3] = await con.getRepository(Achievement).save([
      createAchievement({ name: 'Achievement 1', rarity: null }),
      createAchievement({
        name: 'Achievement 2',
        eventType: AchievementEventType.PostUpvote,
        rarity: null,
      }),
      createAchievement({
        name: 'Achievement 3',
        eventType: AchievementEventType.CommentUpvote,
        rarity: 42,
      }),
    ]);

    await con.getRepository(UserAchievement).save([
      {
        userId: '1',
        achievementId: a1.id,
        unlockedAt: new Date('2024-01-01'),
      },
      {
        userId: '2',
        achievementId: a1.id,
        unlockedAt: new Date('2024-01-02'),
      },
      {
        userId: '3',
        achievementId: a2.id,
        unlockedAt: new Date('2024-01-03'),
      },
      {
        userId: '1',
        achievementId: a2.id,
        unlockedAt: null,
        progress: 1,
      },
      {
        userId: '4',
        achievementId: a3.id,
        unlockedAt: null,
        progress: 3,
      },
    ]);

    await expectSuccessfulCron(updateAchievementRarity);

    const updated = await con
      .getRepository(Achievement)
      .findBy([{ id: a1.id }, { id: a2.id }, { id: a3.id }]);

    const rarityById = new Map(
      updated.map((achievement) => [achievement.id, achievement.rarity]),
    );

    expect(rarityById.get(a1.id)).toBeCloseTo((2 / 3) * 100, 4);
    expect(rarityById.get(a2.id)).toBeCloseTo((1 / 3) * 100, 4);
    expect(rarityById.get(a3.id)).toBe(42);
  });

  it('should skip updates when there are no unlocked achievements', async () => {
    const [a1, a2] = await con.getRepository(Achievement).save([
      createAchievement({ name: 'Achievement 1', rarity: 12 }),
      createAchievement({
        name: 'Achievement 2',
        eventType: AchievementEventType.PostUpvote,
        rarity: 24,
      }),
    ]);

    await con.getRepository(UserAchievement).save([
      {
        userId: '1',
        achievementId: a1.id,
        unlockedAt: null,
        progress: 2,
      },
      {
        userId: '2',
        achievementId: a2.id,
        unlockedAt: null,
        progress: 4,
      },
    ]);

    await expectSuccessfulCron(updateAchievementRarity);

    const updated = await con
      .getRepository(Achievement)
      .findBy([{ id: a1.id }, { id: a2.id }]);

    const rarityById = new Map(
      updated.map((achievement) => [achievement.id, achievement.rarity]),
    );

    expect(rarityById.get(a1.id)).toBe(12);
    expect(rarityById.get(a2.id)).toBe(24);
  });
});

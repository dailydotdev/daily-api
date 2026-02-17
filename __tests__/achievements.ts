import { randomUUID } from 'node:crypto';
import {
  Achievement,
  AchievementEventType,
  AchievementType,
  User,
} from '../src/entity';
import { UserAchievement } from '../src/entity/user/UserAchievement';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testQueryErrorCode,
} from './helpers';
import createOrGetConnection from '../src/db';
import { DataSource } from 'typeorm';
import { usersFixture } from './fixture/user';

const achievementIds = {
  a1: randomUUID(),
  a2: randomUUID(),
  a3: randomUUID(),
};

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

afterAll(() => disposeGraphQLTesting(state));

const achievementsFixture = [
  {
    id: achievementIds.a1,
    name: 'First Steps',
    description: 'Upload a profile picture',
    image: 'https://example.com/a1.png',
    type: AchievementType.Instant,
    eventType: AchievementEventType.ProfileImageUpdate,
    criteria: {},
    points: 5,
    rarity: 0.8,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: achievementIds.a2,
    name: 'Bookworm',
    description: 'Bookmark 10 posts',
    image: 'https://example.com/a2.png',
    type: AchievementType.Milestone,
    eventType: AchievementEventType.BookmarkPost,
    criteria: { targetCount: 10 },
    points: 10,
    rarity: 0.5,
    createdAt: new Date('2024-01-02'),
  },
  {
    id: achievementIds.a3,
    name: 'Social Butterfly',
    description: 'Join a squad',
    image: 'https://example.com/a3.png',
    type: AchievementType.Instant,
    eventType: AchievementEventType.SquadJoin,
    criteria: {},
    points: 5,
    rarity: 0.6,
    createdAt: new Date('2024-01-03'),
  },
];

beforeEach(async () => {
  loggedUser = null;
  await con
    .getRepository(UserAchievement)
    .createQueryBuilder()
    .delete()
    .execute();
  await con.getRepository(Achievement).createQueryBuilder().delete().execute();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Achievement, achievementsFixture);
});

const USER_ACHIEVEMENTS_QUERY = /* GraphQL */ `
  query UserAchievements($userId: ID) {
    userAchievements(userId: $userId) {
      achievement {
        id
        name
      }
      progress
      unlockedAt
    }
  }
`;

const USER_ACHIEVEMENT_STATS_QUERY = /* GraphQL */ `
  query UserAchievementStats($userId: ID) {
    userAchievementStats(userId: $userId) {
      totalAchievements
      unlockedCount
      lockedCount
    }
  }
`;

describe('query userAchievements', () => {
  it('should return all achievements for own profile with progress', async () => {
    loggedUser = '1';

    await con.getRepository(UserAchievement).save([
      {
        achievementId: achievementIds.a1,
        userId: '1',
        progress: 1,
        unlockedAt: new Date('2024-06-01'),
      },
      {
        achievementId: achievementIds.a2,
        userId: '1',
        progress: 5,
        unlockedAt: null,
      },
    ]);

    const res = await client.query(USER_ACHIEVEMENTS_QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data.userAchievements).toHaveLength(3);

    const [first, second, third] = res.data.userAchievements;
    expect(first.achievement.id).toBe(achievementIds.a1);
    expect(first.progress).toBe(1);
    expect(first.unlockedAt).toBeTruthy();

    expect(second.achievement.id).toBe(achievementIds.a2);
    expect(second.progress).toBe(5);
    expect(second.unlockedAt).toBeNull();

    expect(third.achievement.id).toBe(achievementIds.a3);
    expect(third.progress).toBe(0);
    expect(third.unlockedAt).toBeNull();
  });

  it('should return all achievements for another user including locked ones', async () => {
    loggedUser = '1';

    await con.getRepository(UserAchievement).save([
      {
        achievementId: achievementIds.a1,
        userId: '2',
        progress: 1,
        unlockedAt: new Date('2024-06-01'),
      },
    ]);

    const res = await client.query(USER_ACHIEVEMENTS_QUERY, {
      variables: { userId: '2' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.userAchievements).toHaveLength(3);

    const unlocked = res.data.userAchievements.find(
      (a) => a.achievement.id === achievementIds.a1,
    );
    expect(unlocked.unlockedAt).toBeTruthy();
    expect(unlocked.progress).toBe(1);

    const locked = res.data.userAchievements.filter(
      (a) => a.achievement.id !== achievementIds.a1,
    );
    for (const a of locked) {
      expect(a.unlockedAt).toBeNull();
      expect(a.progress).toBe(0);
    }
  });

  it('should return all achievements for unauthenticated user with userId', async () => {
    loggedUser = null;

    await con.getRepository(UserAchievement).save([
      {
        achievementId: achievementIds.a2,
        userId: '2',
        progress: 10,
        unlockedAt: new Date('2024-07-01'),
      },
    ]);

    const res = await client.query(USER_ACHIEVEMENTS_QUERY, {
      variables: { userId: '2' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.userAchievements).toHaveLength(3);

    const unlocked = res.data.userAchievements.find(
      (a) => a.achievement.id === achievementIds.a2,
    );
    expect(unlocked.unlockedAt).toBeTruthy();
    expect(unlocked.progress).toBe(10);
  });

  it('should return authentication error for unauthenticated user without userId', async () => {
    loggedUser = null;

    await testQueryErrorCode(
      client,
      { query: USER_ACHIEVEMENTS_QUERY },
      'UNAUTHENTICATED',
    );
  });
});

describe('query userAchievementStats', () => {
  it('should return correct stats for own profile', async () => {
    loggedUser = '1';

    await con.getRepository(UserAchievement).save([
      {
        achievementId: achievementIds.a1,
        userId: '1',
        progress: 1,
        unlockedAt: new Date('2024-06-01'),
      },
      {
        achievementId: achievementIds.a2,
        userId: '1',
        progress: 5,
        unlockedAt: null,
      },
    ]);

    const res = await client.query(USER_ACHIEVEMENT_STATS_QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data.userAchievementStats).toEqual({
      totalAchievements: 3,
      unlockedCount: 1,
      lockedCount: 2,
    });
  });

  it('should return correct stats for another user', async () => {
    loggedUser = '1';

    await con.getRepository(UserAchievement).save([
      {
        achievementId: achievementIds.a1,
        userId: '2',
        progress: 1,
        unlockedAt: new Date('2024-06-01'),
      },
      {
        achievementId: achievementIds.a2,
        userId: '2',
        progress: 10,
        unlockedAt: new Date('2024-07-01'),
      },
    ]);

    const res = await client.query(USER_ACHIEVEMENT_STATS_QUERY, {
      variables: { userId: '2' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.userAchievementStats).toEqual({
      totalAchievements: 3,
      unlockedCount: 2,
      lockedCount: 1,
    });
  });

  it('should return stats for unauthenticated user with userId', async () => {
    loggedUser = null;

    await con.getRepository(UserAchievement).save([
      {
        achievementId: achievementIds.a1,
        userId: '2',
        progress: 1,
        unlockedAt: new Date('2024-06-01'),
      },
    ]);

    const res = await client.query(USER_ACHIEVEMENT_STATS_QUERY, {
      variables: { userId: '2' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.userAchievementStats).toEqual({
      totalAchievements: 3,
      unlockedCount: 1,
      lockedCount: 2,
    });
  });

  it('should return authentication error for unauthenticated user without userId', async () => {
    loggedUser = null;

    await testQueryErrorCode(
      client,
      { query: USER_ACHIEVEMENT_STATS_QUERY },
      'UNAUTHENTICATED',
    );
  });
});

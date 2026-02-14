import { DataSource, DeepPartial } from 'typeorm';
import {
  Achievement,
  AchievementType,
  AchievementEventType,
  User,
} from '../src/entity';
import { UserAchievement } from '../src/entity/user/UserAchievement';
import createOrGetConnection from '../src/db';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import { usersFixture } from './fixture/user';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;

const achievementsFixture: DeepPartial<Achievement>[] = [
  {
    id: 'a1111111-1111-1111-1111-111111111111',
    name: 'First Upvote',
    description: 'Upvote your first post',
    image: 'https://daily.dev/achievement1.png',
    type: AchievementType.Instant,
    eventType: AchievementEventType.PostUpvote,
    criteria: {},
    points: 5,
  },
  {
    id: 'a2222222-2222-2222-2222-222222222222',
    name: 'Bookworm',
    description: 'Bookmark 10 posts',
    image: 'https://daily.dev/achievement2.png',
    type: AchievementType.Milestone,
    eventType: AchievementEventType.BookmarkPost,
    criteria: { targetCount: 10 },
    points: 10,
  },
  {
    id: 'a3333333-3333-3333-3333-333333333333',
    name: 'Social Butterfly',
    description: 'Join a squad',
    image: 'https://daily.dev/achievement3.png',
    type: AchievementType.Instant,
    eventType: AchievementEventType.SquadJoin,
    criteria: {},
    points: 15,
  },
  {
    id: 'a4444444-4444-4444-4444-444444444444',
    name: 'Streak Master',
    description: '7 day reading streak',
    image: 'https://daily.dev/achievement4.png',
    type: AchievementType.Streak,
    eventType: AchievementEventType.ReadingStreak,
    criteria: { targetCount: 7 },
    points: 20,
  },
];

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

afterAll(() => disposeGraphQLTesting(state));

beforeEach(async () => {
  loggedUser = null;
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Achievement, achievementsFixture);
});

const createUnlockedAchievements = async (
  userId: string,
  achievementIds: string[],
) => {
  const repo = con.getRepository(UserAchievement);
  for (const achievementId of achievementIds) {
    await repo.save(
      repo.create({
        userId,
        achievementId,
        progress: 1,
        unlockedAt: new Date(),
      }),
    );
  }
};

describe('mutation updateShowcasedAchievements', () => {
  const MUTATION = `
    mutation UpdateShowcasedAchievements($achievementIds: [ID!]!) {
      updateShowcasedAchievements(achievementIds: $achievementIds) {
        achievement {
          id
          name
          points
        }
        unlockedAt
      }
    }
  `;

  it('should return unauthenticated when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { achievementIds: [] },
      },
      'UNAUTHENTICATED',
    ));

  it('should set showcased achievements with valid unlocked IDs', async () => {
    loggedUser = '1';
    const ids = [
      achievementsFixture[0].id,
      achievementsFixture[1].id,
      achievementsFixture[2].id,
    ];
    await createUnlockedAchievements('1', ids as string[]);

    const res = await client.mutate(MUTATION, {
      variables: { achievementIds: ids },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.updateShowcasedAchievements).toHaveLength(3);
    expect(res.data.updateShowcasedAchievements[0].achievement.id).toBe(ids[0]);
    expect(res.data.updateShowcasedAchievements[1].achievement.id).toBe(ids[1]);
    expect(res.data.updateShowcasedAchievements[2].achievement.id).toBe(ids[2]);
  });

  it('should enforce max 3 achievements', async () => {
    loggedUser = '1';
    const ids = achievementsFixture.map((a) => a.id);
    await createUnlockedAchievements('1', ids as string[]);

    const res = await client.mutate(MUTATION, {
      variables: { achievementIds: ids },
    });

    expect(res.errors).toBeTruthy();
    expect(res.errors[0].extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('should reject locked achievements', async () => {
    loggedUser = '1';
    // Only unlock the first achievement
    await createUnlockedAchievements('1', [
      achievementsFixture[0].id as string,
    ]);

    const res = await client.mutate(MUTATION, {
      variables: {
        achievementIds: [achievementsFixture[0].id, achievementsFixture[1].id],
      },
    });

    expect(res.errors).toBeTruthy();
    expect(res.errors[0].extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('should reject non-existent achievement IDs', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        achievementIds: ['a9999999-9999-9999-9999-999999999999'],
      },
    });

    expect(res.errors).toBeTruthy();
    expect(res.errors[0].extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('should clear showcase with empty array', async () => {
    loggedUser = '1';
    await createUnlockedAchievements('1', [
      achievementsFixture[0].id as string,
    ]);

    // First set some
    await client.mutate(MUTATION, {
      variables: { achievementIds: [achievementsFixture[0].id] },
    });

    // Then clear
    const res = await client.mutate(MUTATION, {
      variables: { achievementIds: [] },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.updateShowcasedAchievements).toHaveLength(0);
  });
});

describe('query showcasedAchievements', () => {
  const QUERY = `
    query ShowcasedAchievements($userId: ID!) {
      showcasedAchievements(userId: $userId) {
        achievement {
          id
          name
          points
        }
        unlockedAt
      }
    }
  `;

  it('should return empty array when user has no showcased achievements', async () => {
    const res = await client.query(QUERY, {
      variables: { userId: '1' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.showcasedAchievements).toHaveLength(0);
  });

  it('should return showcased achievements in order', async () => {
    loggedUser = '1';
    const ids = [
      achievementsFixture[2].id as string,
      achievementsFixture[0].id as string,
    ];
    await createUnlockedAchievements('1', ids);

    // Set showcase
    const MUTATION = `
      mutation UpdateShowcasedAchievements($achievementIds: [ID!]!) {
        updateShowcasedAchievements(achievementIds: $achievementIds) {
          achievement { id }
        }
      }
    `;
    await client.mutate(MUTATION, { variables: { achievementIds: ids } });

    // Query as another user (no auth required)
    loggedUser = null;
    const res = await client.query(QUERY, {
      variables: { userId: '1' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.showcasedAchievements).toHaveLength(2);
    // Order should match what was set
    expect(res.data.showcasedAchievements[0].achievement.id).toBe(ids[0]);
    expect(res.data.showcasedAchievements[1].achievement.id).toBe(ids[1]);
  });

  it('should return empty array for non-existent user', async () => {
    const res = await client.query(QUERY, {
      variables: { userId: 'nonexistent' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.showcasedAchievements).toHaveLength(0);
  });
});

describe('query userAchievementStats with totalPoints', () => {
  const QUERY = `
    query UserAchievementStats($userId: ID) {
      userAchievementStats(userId: $userId) {
        totalAchievements
        unlockedCount
        lockedCount
        totalPoints
      }
    }
  `;

  it('should return unauthenticated when not logged in', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should return correct totalPoints', async () => {
    loggedUser = '1';
    // Unlock first two achievements (5 + 10 = 15 points)
    await createUnlockedAchievements('1', [
      achievementsFixture[0].id as string,
      achievementsFixture[1].id as string,
    ]);

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.userAchievementStats.totalAchievements).toBe(4);
    expect(res.data.userAchievementStats.unlockedCount).toBe(2);
    expect(res.data.userAchievementStats.lockedCount).toBe(2);
    expect(res.data.userAchievementStats.totalPoints).toBe(15);
  });

  it('should return 0 totalPoints when no achievements unlocked', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.userAchievementStats.totalPoints).toBe(0);
  });
});

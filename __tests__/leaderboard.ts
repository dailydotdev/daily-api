import {
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
} from './helpers';
import {
  HotTake,
  Post,
  Source,
  User,
  UserCompany,
  UserStats,
  UserStreak,
} from '../src/entity';
import { PopularHotTake } from '../src/entity/PopularHotTake';
import {
  Achievement,
  AchievementType,
  AchievementEventType,
} from '../src/entity/Achievement';
import { UserAchievement } from '../src/entity/user/UserAchievement';

import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';

import { hotTakeFixture, usersFixture } from './fixture/user';
import { postsFixture } from './fixture/post';
import { sourcesFixture } from './fixture/source';
import { Company } from '../src/entity/Company';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser, []),
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = null;
  jest.clearAllMocks();
});

describe('leaderboard', () => {
  const LEADERBOARD_FRAMENT = `
    fragment LeaderboardFragment on Leaderboard {
      score
      user {
        id
        username
      }
    }
  `;

  const QUERY = (limit = 3) => `query Leaderboard($limit: Int = ${limit}) {
      highestReputation(limit: $limit) {
        ...LeaderboardFragment
      }
      longestStreak(limit: $limit) {
        ...LeaderboardFragment
      }
      highestPostViews(limit: $limit) {
        ...LeaderboardFragment
      }
      mostUpvoted(limit: $limit) {
        ...LeaderboardFragment
      }
      mostReferrals(limit: $limit) {
        ...LeaderboardFragment
      }
      mostReadingDays(limit: $limit) {
        ...LeaderboardFragment
      }
      mostVerifiedUsers(limit: $limit) {
        score
        company {
          name
          image
        }
      }
    }
    ${LEADERBOARD_FRAMENT}
  `;

  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, Post, postsFixture);
  });

  it('should return highest reputation', async () => {
    const reputation = [100, 200, 300];
    await saveFixtures(
      con,
      User,
      usersFixture.map((item, index) => {
        return {
          ...item,
          reputation: reputation[index] || 0,
        };
      }),
    );

    const res = await client.query(QUERY());
    expect(res.data.highestReputation).toHaveLength(3);
    expect(res.data.highestReputation).toMatchObject([
      {
        score: 300,
        user: {
          id: '3',
          username: 'nimroddaily',
        },
      },
      {
        score: 200,
        user: {
          id: '2',
          username: 'tsahidaily',
        },
      },
      {
        score: 100,
        user: {
          id: '1',
          username: 'idoshamun',
        },
      },
    ]);
  });

  it('should return longest streak', async () => {
    const streak = [10, 50, 100];
    await saveFixtures(
      con,
      UserStreak,
      streak.map((item, index) => {
        return {
          userId: usersFixture[index].id,
          currentStreak: item,
          maxStreak: item,
          totalStreak: item,
        };
      }),
    );

    const res = await client.query(QUERY());
    expect(res.data.longestStreak).toHaveLength(3);
    expect(res.data.longestStreak).toMatchObject([
      {
        score: 100,
        user: {
          id: '3',
          username: 'nimroddaily',
        },
      },
      {
        score: 50,
        user: {
          id: '2',
          username: 'tsahidaily',
        },
      },
      {
        score: 10,
        user: {
          id: '1',
          username: 'idoshamun',
        },
      },
    ]);
  });

  it('should return most reading days', async () => {
    const streak = [10, 50, 100];
    await saveFixtures(
      con,
      UserStreak,
      streak.map((item, index) => {
        return {
          userId: usersFixture[index].id,
          currentStreak: item,
          maxStreak: item,
          totalStreak: item,
        };
      }),
    );

    const res = await client.query(QUERY());
    expect(res.data.mostReadingDays).toHaveLength(3);
    expect(res.data.mostReadingDays).toMatchObject([
      {
        score: 100,
        user: {
          id: '3',
          username: 'nimroddaily',
        },
      },
      {
        score: 50,
        user: {
          id: '2',
          username: 'tsahidaily',
        },
      },
      {
        score: 10,
        user: {
          id: '1',
          username: 'idoshamun',
        },
      },
    ]);
  });

  it('should return highest post views', async () => {
    const userViews = ['1', '1', '2', '3', '1', '3'];
    const views = [30, 20, 10, 5, 3, 2];
    await saveFixtures(
      con,
      Post,
      userViews.map((userId, index) => {
        return {
          ...postsFixture[index],
          scoutId: userId,
          views: views[index],
        };
      }),
    );
    await con.query(
      `REFRESH MATERIALIZED VIEW ${con.getRepository(UserStats).metadata.tableName}`,
    );

    const res = await client.query(QUERY());
    expect(res.data.highestPostViews).toHaveLength(3);
    expect(res.data.highestPostViews).toMatchObject([
      {
        score: 53,
        user: {
          id: '1',
          username: 'idoshamun',
        },
      },
      {
        score: 10,
        user: {
          id: '2',
          username: 'tsahidaily',
        },
      },
      {
        score: 7,
        user: {
          id: '3',
          username: 'nimroddaily',
        },
      },
    ]);
  });

  it('should return most upvoted', async () => {
    const userUpvotes = ['1', '1', '2', '3', '1', '3'];
    const upvotes = [10, 5, 3, 2, 1, 3];
    await saveFixtures(
      con,
      Post,
      userUpvotes.map((userId, index) => {
        return {
          ...postsFixture[index],
          scoutId: userId,
          upvotes: upvotes[index],
        };
      }),
    );
    await con.query(
      `REFRESH MATERIALIZED VIEW ${con.getRepository(UserStats).metadata.tableName}`,
    );

    const res = await client.query(QUERY());
    expect(res.data.mostUpvoted).toHaveLength(3);
    expect(res.data.mostUpvoted).toMatchObject([
      {
        score: 16,
        user: {
          id: '1',
          username: 'idoshamun',
        },
      },
      {
        score: 5,
        user: {
          id: '3',
          username: 'nimroddaily',
        },
      },
      {
        score: 3,
        user: {
          id: '2',
          username: 'tsahidaily',
        },
      },
    ]);
  });

  it('should return most referrals', async () => {
    const userReferrals = ['1', '1', '2', '3', '1', '3'];
    await saveFixtures(
      con,
      User,
      userReferrals.map((userId, index) => {
        return {
          id: `r${index}`,
          username: `referral${index}`,
          email: `referral${index}@test.com`,
          referralId: userId,
        };
      }),
    );
    await con.query(
      `REFRESH MATERIALIZED VIEW ${con.getRepository(UserStats).metadata.tableName}`,
    );

    const res = await client.query(QUERY());
    expect(res.data.mostReferrals).toHaveLength(3);
    expect(res.data.mostReferrals).toMatchObject([
      {
        score: 3,
        user: {
          id: '1',
          username: 'idoshamun',
        },
      },
      {
        score: 2,
        user: {
          id: '3',
          username: 'nimroddaily',
        },
      },
      {
        score: 1,
        user: {
          id: '2',
          username: 'tsahidaily',
        },
      },
    ]);
  });

  it('should return most upvoted', async () => {
    const userUpvotes = ['1', '1', '2', '3', '1', '3'];
    const upvotes = [10, 5, 3, 2, 1, 3];
    await saveFixtures(
      con,
      Post,
      userUpvotes.map((userId, index) => {
        return {
          ...postsFixture[index],
          scoutId: userId,
          upvotes: upvotes[index],
        };
      }),
    );
    await con.query(
      `REFRESH MATERIALIZED VIEW ${con.getRepository(UserStats).metadata.tableName}`,
    );

    const res = await client.query(QUERY());
    expect(res.data.mostUpvoted).toHaveLength(3);
    expect(res.data.mostUpvoted).toMatchObject([
      {
        score: 16,
        user: {
          id: '1',
          username: 'idoshamun',
        },
      },
      {
        score: 5,
        user: {
          id: '3',
          username: 'nimroddaily',
        },
      },
      {
        score: 3,
        user: {
          id: '2',
          username: 'tsahidaily',
        },
      },
    ]);
  });

  it('should return most verified users', async () => {
    await con.getRepository(Company).save([
      {
        id: '1',
        name: 'Company 1',
        image: 'https://daily.dev/company1.jpg',
        domains: ['company1.com'],
      },
      {
        id: '2',
        name: 'Company 2',
        image: 'https://daily.dev/company2.jpg',
        domains: ['company2.com'],
      },
      {
        id: '3',
        name: 'Company 3',
        image: 'https://daily.dev/company3.jpg',
        domains: ['company3.com'],
      },
    ]);
    await con.getRepository(UserCompany).save([
      {
        userId: '1',
        companyId: '1',
        verified: true,
        email: 'u1@com1.com',
        code: '123',
      },
      {
        userId: '1',
        companyId: '2',
        verified: true,
        email: 'u1@com2.com',
        code: '123',
      },
      {
        userId: '2',
        companyId: '2',
        verified: true,
        email: 'u2@com2.com',
        code: '123',
      },
      {
        userId: '1',
        companyId: '3',
        verified: true,
        email: 'u1@com3.com',
        code: '123',
      },
      {
        userId: '2',
        companyId: '3',
        verified: true,
        email: 'u2@com4.com',
        code: '123',
      },
      {
        userId: '3',
        companyId: '3',
        verified: true,
        email: 'u3@com4.com',
        code: '123',
      },
    ]);
    const res = await client.query(QUERY());
    expect(res.data.mostVerifiedUsers).toHaveLength(3);
    expect(res.data.mostVerifiedUsers).toMatchObject([
      {
        score: 3,
        company: {
          name: 'Company 3',
          image: 'https://daily.dev/company3.jpg',
        },
      },
      {
        score: 2,
        company: {
          name: 'Company 2',
          image: 'https://daily.dev/company2.jpg',
        },
      },
      {
        score: 1,
        company: {
          name: 'Company 1',
          image: 'https://daily.dev/company1.jpg',
        },
      },
    ]);
  });

  describe('mostAchievementPoints', () => {
    const ACHIEVEMENT_QUERY = `
      query MostAchievementPoints($limit: Int) {
        mostAchievementPoints(limit: $limit) {
          score
          user {
            id
            username
          }
        }
      }
    `;

    const createAchievement = (
      overrides: Partial<Achievement> = {},
    ): Partial<Achievement> => ({
      name: 'Test Achievement',
      description: 'A test achievement',
      image: 'https://daily.dev/badge.jpg',
      type: AchievementType.Instant,
      eventType: AchievementEventType.ProfileImageUpdate,
      criteria: {},
      points: 10,
      ...overrides,
    });

    it('should return empty when no achievements are unlocked', async () => {
      const res = await client.query(ACHIEVEMENT_QUERY);
      expect(res.errors).toBeFalsy();
      expect(res.data.mostAchievementPoints).toEqual([]);
    });

    it('should return users ranked by total achievement points', async () => {
      const [a1, a2, a3] = await con.getRepository(Achievement).save([
        createAchievement({ name: 'Achievement 1', points: 10 }),
        createAchievement({
          name: 'Achievement 2',
          points: 20,
          eventType: AchievementEventType.PostUpvote,
        }),
        createAchievement({
          name: 'Achievement 3',
          points: 30,
          eventType: AchievementEventType.CommentUpvote,
        }),
      ]);

      const now = new Date();
      await con.getRepository(UserAchievement).save([
        { userId: '1', achievementId: a1.id, unlockedAt: now },
        { userId: '1', achievementId: a2.id, unlockedAt: now },
        { userId: '2', achievementId: a3.id, unlockedAt: now },
        { userId: '3', achievementId: a1.id, unlockedAt: now },
      ]);

      const res = await client.query(ACHIEVEMENT_QUERY);
      expect(res.errors).toBeFalsy();
      expect(res.data.mostAchievementPoints).toHaveLength(3);
      expect(res.data.mostAchievementPoints).toMatchObject([
        { score: 30, user: { id: '1' } },
        { score: 30, user: { id: '2' } },
        { score: 10, user: { id: '3' } },
      ]);
    });

    it('should rank users who reached the same score earlier higher', async () => {
      const [a1] = await con
        .getRepository(Achievement)
        .save([createAchievement({ name: 'Achievement 1', points: 10 })]);

      await con.getRepository(UserAchievement).save([
        {
          userId: '1',
          achievementId: a1.id,
          unlockedAt: new Date('2024-06-01'),
        },
        {
          userId: '2',
          achievementId: a1.id,
          unlockedAt: new Date('2024-01-01'),
        },
      ]);

      const res = await client.query(ACHIEVEMENT_QUERY);
      expect(res.errors).toBeFalsy();
      expect(res.data.mostAchievementPoints).toMatchObject([
        { score: 10, user: { id: '2' } },
        { score: 10, user: { id: '1' } },
      ]);
    });

    it('should not include achievements that are not unlocked', async () => {
      const [a1, a2] = await con.getRepository(Achievement).save([
        createAchievement({ name: 'Achievement 1', points: 10 }),
        createAchievement({
          name: 'Achievement 2',
          points: 50,
          eventType: AchievementEventType.PostUpvote,
        }),
      ]);

      await con.getRepository(UserAchievement).save([
        { userId: '1', achievementId: a1.id, unlockedAt: new Date() },
        {
          userId: '1',
          achievementId: a2.id,
          unlockedAt: null,
          progress: 5,
        },
      ]);

      const res = await client.query(ACHIEVEMENT_QUERY);
      expect(res.errors).toBeFalsy();
      expect(res.data.mostAchievementPoints).toHaveLength(1);
      expect(res.data.mostAchievementPoints[0]).toMatchObject({
        score: 10,
        user: { id: '1' },
      });
    });

    it('should respect the limit parameter', async () => {
      const [a1] = await con
        .getRepository(Achievement)
        .save([createAchievement({ name: 'Achievement 1', points: 10 })]);

      await con.getRepository(UserAchievement).save([
        { userId: '1', achievementId: a1.id, unlockedAt: new Date() },
        { userId: '2', achievementId: a1.id, unlockedAt: new Date() },
        { userId: '3', achievementId: a1.id, unlockedAt: new Date() },
      ]);

      const res = await client.query(ACHIEVEMENT_QUERY, {
        variables: { limit: 2 },
      });
      expect(res.errors).toBeFalsy();
      expect(res.data.mostAchievementPoints).toHaveLength(2);
    });

    it('should use latest unlock time as tiebreaker across multiple achievements', async () => {
      const [a1, a2] = await con.getRepository(Achievement).save([
        createAchievement({ name: 'Achievement 1', points: 10 }),
        createAchievement({
          name: 'Achievement 2',
          points: 10,
          eventType: AchievementEventType.PostUpvote,
        }),
      ]);

      await con.getRepository(UserAchievement).save([
        {
          userId: '1',
          achievementId: a1.id,
          unlockedAt: new Date('2024-01-01'),
        },
        {
          userId: '1',
          achievementId: a2.id,
          unlockedAt: new Date('2024-12-01'),
        },
        {
          userId: '2',
          achievementId: a1.id,
          unlockedAt: new Date('2024-06-01'),
        },
        {
          userId: '2',
          achievementId: a2.id,
          unlockedAt: new Date('2024-06-15'),
        },
      ]);

      const res = await client.query(ACHIEVEMENT_QUERY);
      expect(res.errors).toBeFalsy();
      // Both have 20 points, but user 2's MAX(unlockedAt) is earlier
      expect(res.data.mostAchievementPoints).toMatchObject([
        { score: 20, user: { id: '2' } },
        { score: 20, user: { id: '1' } },
      ]);
    });
  });

  describe('popularHotTakes', () => {
    const QUERY = /* GraphQL */ `
      query PopularHotTakes($limit: Int) {
        popularHotTakes(limit: $limit) {
          score
          hotTake {
            id
            title
          }
          user {
            id
          }
        }
      }
    `;

    beforeEach(async () => {
      await saveFixtures(con, HotTake, hotTakeFixture);

      await con.query(
        `REFRESH MATERIALIZED VIEW ${con.getRepository(PopularHotTake).metadata.tableName}`,
      );
    });

    it('should return popular hot takes', async () => {
      const res = await client.query(QUERY);
      expect(res.data.popularHotTakes).toHaveLength(7);
    });

    it('should limit return popular hot takes', async () => {
      const res = await client.query(QUERY, { variables: { limit: 5 } });
      expect(res.data.popularHotTakes).toHaveLength(5);
    });
  });
});

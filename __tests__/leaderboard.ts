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

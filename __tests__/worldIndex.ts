import { subDays, subHours } from 'date-fns';
import { DataSource, DeepPartial } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  GraphQLTestClient,
  GraphQLTestingState,
  MockContext,
  disposeGraphQLTesting,
  expectSuccessfulCron,
  initializeGraphQLTesting,
  saveFixtures,
  testQueryErrorCode,
} from './helpers';
import { Niche, NicheBucketGroup, NicheDomain } from '../src/entity/Niche';
import { NicheWorldStats } from '../src/entity/NicheWorldStats';
import { DomainWorldStats } from '../src/entity/DomainWorldStats';
import { UserDomainRank } from '../src/entity/user/UserDomainRank';
import { Feed, Source, User } from '../src/entity';
import { SourceMember } from '../src/entity/SourceMember';
import { UserNicheAnalytics } from '../src/entity/user/UserNicheAnalytics';
import { UserNicheGrowth } from '../src/entity/user/UserNicheGrowth';
import { UserNicheRank } from '../src/entity/user/UserNicheRank';
import { UserWorldLevelUp } from '../src/entity/user/UserWorldLevelUp';
import { UserWorldSettings } from '../src/entity/user/UserWorldSettings';
import { UserWorldSummary } from '../src/entity/user/UserWorldSummary';
import { ContentPreferenceUser } from '../src/entity/contentPreference/ContentPreferenceUser';
import { ContentPreferenceStatus } from '../src/entity/contentPreference/types';
import { SourceMemberRoles } from '../src/roles';
import { worldIndexCron } from '../src/cron/worldIndex';
import { WORLD_RANK_DEPTH } from '../src/common/worldIndex';
import { usersFixture } from './fixture/user';
import { sourcesFixture } from './fixture/source';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

afterAll(() => disposeGraphQLTesting(state));

const nicheJs = '11111111-1111-4111-8111-111111111111';
const nicheAi = '22222222-2222-4222-8222-222222222222';
const nicheGo = '44444444-4444-4444-8444-444444444444';
const nicheRust = '55555555-5555-4555-8555-555555555555';
// Hidden at serving time, so it must not reach a listing, a total, or the
// district floor.
const nicheChain = '33333333-3333-4333-8333-333333333333';

const day = (ago: number): string =>
  subDays(new Date(), ago).toISOString().slice(0, 10);

/**
 * A world of `districts` topics, in niches the ranking assertions never touch,
 * so a fixture can clear the floor without joining a leaderboard.
 */
const filler = (
  userId: string,
  districts: number,
): DeepPartial<UserNicheAnalytics>[] =>
  [nicheAi, nicheGo, nicheRust].slice(0, districts).map((nicheId) => ({
    userId,
    nicheId,
    reads: 1,
    firstReadAt: day(30),
    lastReadAt: day(1),
    activeDays: 1,
  }));

/**
 * Empty the index's views by refreshing them off the emptied sources.
 *
 * A view cannot be cleared, and leaving one alone carries a world from one test
 * into the next. Not CONCURRENTLY: that buys nothing on a fixture-sized view.
 */
const refreshIndexViews = async (): Promise<void> => {
  for (const view of [
    UserWorldSummary,
    UserNicheRank,
    NicheWorldStats,
    UserDomainRank,
    DomainWorldStats,
  ]) {
    await con.query(
      `REFRESH MATERIALIZED VIEW ${con.getRepository(view).metadata.tableName}`,
    );
  }
};

beforeEach(async () => {
  loggedUser = null;
  await con.getRepository(UserWorldLevelUp).clear();
  await con.getRepository(UserNicheGrowth).clear();
  await con.getRepository(UserNicheAnalytics).clear();
  await con.getRepository(UserWorldSettings).clear();
  await con.getRepository(ContentPreferenceUser).clear();
  await con.getRepository(SourceMember).clear();
  await refreshIndexViews();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, User, usersFixture);
  // content_preference keys its rows by feed, and the main feed is the user's
  // own id.
  await saveFixtures(
    con,
    Feed,
    usersFixture.map(({ id }) => ({ id, userId: id })),
  );
  await saveFixtures(con, Niche, [
    {
      id: nicheJs,
      slug: 'js_ts',
      title: 'JavaScript / TypeScript',
      bucketGroup: NicheBucketGroup.Ecosystem,
      domain: NicheDomain.Web,
    },
    {
      id: nicheAi,
      slug: 'ai_llm',
      title: 'LLMs',
      bucketGroup: NicheBucketGroup.Theme,
      domain: NicheDomain.Ai,
    },
    {
      id: nicheGo,
      slug: 'go',
      title: 'Go',
      bucketGroup: NicheBucketGroup.Ecosystem,
      domain: NicheDomain.Cloud,
    },
    {
      id: nicheRust,
      slug: 'rust',
      title: 'Rust',
      bucketGroup: NicheBucketGroup.Ecosystem,
      domain: NicheDomain.Systems,
    },
    {
      id: nicheChain,
      slug: 'blockchain',
      title: 'Blockchain',
      bucketGroup: NicheBucketGroup.Theme,
      domain: NicheDomain.Ai,
    },
  ]);
});

/**
 * Four readers of `js_ts`, all clearing the district floor.
 *
 * All time and the week disagree on purpose: user 1 has read the most ever and
 * almost nothing this week, user 4 the reverse. A ranking that quietly served
 * one period for the other would pass on neither.
 */
const saveRankingFixtures = async () => {
  const lifetime: Record<string, number> = { 1: 500, 2: 300, 3: 120, 4: 40 };
  const week: Record<string, number> = { 1: 2, 2: 9, 3: 15, 4: 30 };

  await saveFixtures(con, UserNicheAnalytics, [
    ...Object.entries(lifetime).map(([userId, reads]) => ({
      userId,
      nicheId: nicheJs,
      reads,
      firstReadAt: day(300),
      lastReadAt: day(1),
      activeDays: 50,
    })),
    ...Object.keys(lifetime).flatMap((userId) => filler(userId, 2)),
  ]);

  await saveFixtures(
    con,
    UserNicheGrowth,
    Object.entries(week).map(([userId, reads]) => ({
      userId,
      date: day(2),
      nicheId: nicheJs,
      reads,
    })),
  );
};

/** Strip a world back to its one ranked district, below the listing floor. */
const dropBelowFloor = async (userId: string) => {
  await con
    .getRepository(UserNicheAnalytics)
    .delete({ userId, nicheId: nicheAi });
  await con
    .getRepository(UserNicheAnalytics)
    .delete({ userId, nicheId: nicheGo });
};

const RANKING_QUERY = /* GraphQL */ `
  query WorldTopicRanking(
    $nicheId: ID!
    $period: WorldRankPeriod!
    $limit: Int
  ) {
    worldTopicRanking(nicheId: $nicheId, period: $period, limit: $limit) {
      rank
      articles
      level
      worldName
      user {
        id
        username
      }
    }
  }
`;

const POSITION_QUERY = /* GraphQL */ `
  query WorldTopicRankPosition($nicheId: ID!, $period: WorldRankPeriod!) {
    worldTopicRankPosition(nicheId: $nicheId, period: $period) {
      rank
      articles
      level
      cappedAt
    }
  }
`;

const rankedUsers = (nicheId: string, period: string, limit?: number) =>
  client
    .query(RANKING_QUERY, { variables: { nicheId, period, limit } })
    .then((res) =>
      res.data.worldTopicRanking.map(
        (row: { rank: number; user: { id: string } }) => [
          row.rank,
          row.user.id,
        ],
      ),
    );

describe('world index materialisation', () => {
  it('leaves a private world out of every table it builds', async () => {
    await saveRankingFixtures();
    await con
      .getRepository(UserWorldSettings)
      .save({ userId: '2', private: true });

    await expectSuccessfulCron(worldIndexCron);

    expect(
      await con.getRepository(UserWorldSummary).findOneBy({ userId: '2' }),
    ).toBeNull();
    expect(
      await con.getRepository(UserNicheRank).findBy({ userId: '2' }),
    ).toEqual([]);
    // Counted readers must drop with them, otherwise the count is a way of
    // asking how many private worlds read a topic.
    expect(
      await con.getRepository(NicheWorldStats).findOneBy({ nicheId: nicheJs }),
    ).toMatchObject({ readers: 3 });
  });

  it('lists a world only once it clears the district floor', async () => {
    await saveFixtures(con, UserNicheAnalytics, [
      ...filler('1', 2),
      ...filler('2', 3),
    ]);

    await expectSuccessfulCron(worldIndexCron);

    expect(
      (await con.getRepository(UserWorldSummary).find()).map(
        ({ userId, districts }) => ({ userId, districts }),
      ),
    ).toEqual([{ userId: '2', districts: 3 }]);
  });

  it('does not let a hidden niche carry a world over the floor', async () => {
    // Two visible districts plus blockchain, which counted naively is three.
    await saveFixtures(con, UserNicheAnalytics, [
      ...filler('1', 2),
      {
        userId: '1',
        nicheId: nicheChain,
        reads: 400,
        firstReadAt: day(30),
        lastReadAt: day(1),
        activeDays: 3,
      },
      ...filler('2', 3),
    ]);

    await expectSuccessfulCron(worldIndexCron);

    expect(
      (await con.getRepository(UserWorldSummary).find()).map(
        (row) => row.userId,
      ),
    ).toEqual(['2']);
  });

  it('summarises a world with its totals and its three largest topics', async () => {
    await saveFixtures(con, UserNicheAnalytics, [
      {
        userId: '1',
        nicheId: nicheJs,
        reads: 90,
        firstReadAt: day(30),
        lastReadAt: day(1),
        activeDays: 10,
      },
      {
        userId: '1',
        nicheId: nicheAi,
        reads: 40,
        firstReadAt: day(30),
        lastReadAt: day(1),
        activeDays: 10,
      },
      {
        userId: '1',
        nicheId: nicheGo,
        reads: 7,
        firstReadAt: day(30),
        lastReadAt: day(1),
        activeDays: 10,
      },
      {
        userId: '1',
        nicheId: nicheChain,
        reads: 999,
        firstReadAt: day(30),
        lastReadAt: day(1),
        activeDays: 10,
      },
    ]);

    await expectSuccessfulCron(worldIndexCron);

    // Blockchain is the biggest district and appears in none of these.
    expect(
      await con.getRepository(UserWorldSummary).findOneBy({ userId: '1' }),
    ).toMatchObject({
      districts: 3,
      reads: 137,
      topNiches: [
        { nicheId: nicheJs, reads: 90 },
        { nicheId: nicheAi, reads: 40 },
        { nicheId: nicheGo, reads: 7 },
      ],
    });
  });

  it('sweeps level ups past their retention', async () => {
    await saveFixtures(con, UserNicheAnalytics, filler('1', 3));
    await con.getRepository(UserWorldLevelUp).save([
      {
        userId: '1',
        nicheId: nicheJs,
        level: 5,
        reads: 10,
        createdAt: new Date(),
      },
      {
        userId: '1',
        nicheId: nicheAi,
        level: 4,
        reads: 5,
        createdAt: subDays(new Date(), 30),
      },
    ]);

    await expectSuccessfulCron(worldIndexCron);

    expect(
      (await con.getRepository(UserWorldLevelUp).find()).map(
        (row) => row.level,
      ),
    ).toEqual([5]);
  });
});

describe('query worldTopicRanking', () => {
  beforeEach(async () => {
    await saveRankingFixtures();
    await con
      .getRepository(UserWorldSettings)
      .save({ userId: '1', name: 'Ido Prime' });
    await expectSuccessfulCron(worldIndexCron);
  });

  it('ranks a topic by lifetime articles over all time', async () => {
    expect(await rankedUsers(nicheJs, 'all')).toEqual([
      [1, '1'],
      [2, '2'],
      [3, '3'],
      [4, '4'],
    ]);
  });

  it('ranks the same topic by the week and gets a different order', async () => {
    expect(await rankedUsers(nicheJs, 'week')).toEqual([
      [1, '4'],
      [2, '3'],
      [3, '2'],
      [4, '1'],
    ]);
  });

  it('shows the lifetime level on a weekly row', async () => {
    const res = await client.query(RANKING_QUERY, {
      variables: { nicheId: nicheJs, period: 'week' },
    });

    // User 4 leads the week on 30 articles but has read 40 in total, which is
    // rung seven. Scoring the week would have put them on rung six.
    expect(res.data.worldTopicRanking[0]).toMatchObject({
      articles: 30,
      level: 7,
      user: { id: '4' },
    });
  });

  it('serves the world name, and null when there is none', async () => {
    const res = await client.query(RANKING_QUERY, {
      variables: { nicheId: nicheJs, period: 'all' },
    });

    expect(
      res.data.worldTopicRanking.map(
        (row: { worldName: string | null }) => row.worldName,
      ),
    ).toEqual(['Ido Prime', null, null, null]);
  });

  it('drops a world made private after the tables were built', async () => {
    // The whole point of the live check: nothing is rebuilt in between.
    await con
      .getRepository(UserWorldSettings)
      .save({ userId: '1', private: true });

    expect(await rankedUsers(nicheJs, 'all')).toEqual([
      [1, '2'],
      [2, '3'],
      [3, '4'],
    ]);
  });

  it('excludes a world that has dropped below the district floor', async () => {
    // Taken off the districts the summary is built from, rather than off the
    // summary: the eligibility rule is the view's, and deleting the row it
    // produced would test nothing but the join.
    await dropBelowFloor('2');
    await refreshIndexViews();

    expect(await rankedUsers(nicheJs, 'all')).toEqual([
      [1, '1'],
      [2, '3'],
      [3, '4'],
    ]);
  });
});

describe('query worldTopicRankPosition', () => {
  beforeEach(async () => {
    await saveRankingFixtures();
    await expectSuccessfulCron(worldIndexCron);
  });

  it('requires authentication', () =>
    testQueryErrorCode(
      client,
      {
        query: POSITION_QUERY,
        variables: { nicheId: nicheJs, period: 'all' },
      },
      'UNAUTHENTICATED',
    ));

  it('places the viewer even though the page they were served stops above them', async () => {
    loggedUser = '4';

    // The page is the top two; the viewer is fourth.
    expect(await rankedUsers(nicheJs, 'all', 2)).toEqual([
      [1, '1'],
      [2, '2'],
    ]);

    const res = await client.query(POSITION_QUERY, {
      variables: { nicheId: nicheJs, period: 'all' },
    });

    expect(res.data.worldTopicRankPosition).toEqual({
      rank: 4,
      articles: 40,
      level: 7,
      cappedAt: WORLD_RANK_DEPTH,
    });
  });

  it('places the viewer on the week, which is a different placing', async () => {
    loggedUser = '4';
    const res = await client.query(POSITION_QUERY, {
      variables: { nicheId: nicheJs, period: 'week' },
    });

    expect(res.data.worldTopicRankPosition).toMatchObject({
      rank: 1,
      articles: 30,
      // Still the lifetime rung.
      level: 7,
    });
  });

  it('does not count a private world among those outranking the viewer', async () => {
    loggedUser = '3';
    await con
      .getRepository(UserWorldSettings)
      .save({ userId: '2', private: true });

    const res = await client.query(POSITION_QUERY, {
      variables: { nicheId: nicheJs, period: 'all' },
    });

    // Third of four, but the world above them is hidden, so second of three.
    expect(res.data.worldTopicRankPosition).toMatchObject({ rank: 2 });
  });

  it('answers with a null placing and a real count for an unranked viewer', async () => {
    loggedUser = '4';
    // A world of one district is never listed, so its owner is never ranked.
    // The reader still read, and that number is still theirs.
    await dropBelowFloor('4');
    await expectSuccessfulCron(worldIndexCron);

    expect(
      (
        await client.query(POSITION_QUERY, {
          variables: { nicheId: nicheJs, period: 'all' },
        })
      ).data.worldTopicRankPosition,
    ).toEqual({
      rank: null,
      articles: 40,
      level: 7,
      cappedAt: WORLD_RANK_DEPTH,
    });

    expect(
      (
        await client.query(POSITION_QUERY, {
          variables: { nicheId: nicheJs, period: 'week' },
        })
      ).data.worldTopicRankPosition,
      // Thirty this week, forty in all, and the rung is always the lifetime one.
    ).toMatchObject({ rank: null, articles: 30, level: 7 });
  });

  it('answers zero for a topic the viewer has never read', async () => {
    loggedUser = '4';
    const res = await client.query(POSITION_QUERY, {
      variables: { nicheId: nicheRust, period: 'all' },
    });

    expect(res.data.worldTopicRankPosition).toMatchObject({
      rank: null,
      articles: 0,
      level: 0,
    });
  });
});

describe('query worldTopicReaders', () => {
  it('counts only the worlds the index would list', async () => {
    await saveRankingFixtures();
    await con
      .getRepository(UserWorldSettings)
      .save({ userId: '1', private: true });
    // One district, so below the floor however much they read.
    await dropBelowFloor('4');
    await expectSuccessfulCron(worldIndexCron);

    const res = await client.query(
      /* GraphQL */ `
        query WorldTopicReaders($nicheIds: [ID!]) {
          worldTopicReaders(nicheIds: $nicheIds) {
            readers
            niche {
              id
              title
            }
          }
        }
      `,
      { variables: { nicheIds: [nicheJs] } },
    );

    // Four readers of the topic, one private and one below the floor.
    expect(res.data.worldTopicReaders).toEqual([
      { readers: 2, niche: { id: nicheJs, title: 'JavaScript / TypeScript' } },
    ]);
  });
});

describe('query worldRecentLevelUps', () => {
  const LEVEL_UP_QUERY = /* GraphQL */ `
    query WorldRecentLevelUps {
      worldRecentLevelUps {
        level
        niche {
          id
        }
        world {
          name
          topics
          articles
          user {
            id
          }
          topTopics {
            articles
            level
            niche {
              id
            }
          }
        }
      }
    }
  `;

  beforeEach(async () => {
    await saveRankingFixtures();
    await expectSuccessfulCron(worldIndexCron);
  });

  it('returns the crossing, its topic and the world it happened to', async () => {
    await con.getRepository(UserWorldLevelUp).save({
      userId: '4',
      nicheId: nicheJs,
      level: 7,
      reads: 40,
      createdAt: subHours(new Date(), 2),
    });

    const res = await client.query(LEVEL_UP_QUERY);

    expect(res.data.worldRecentLevelUps).toEqual([
      {
        level: 7,
        niche: { id: nicheJs },
        world: {
          name: null,
          topics: 3,
          articles: 42,
          user: { id: '4' },
          topTopics: [
            { articles: 40, level: 7, niche: { id: nicheJs } },
            { articles: 1, level: 1, niche: { id: nicheAi } },
            { articles: 1, level: 1, niche: { id: nicheGo } },
          ],
        },
      },
    ]);
  });

  it('keeps one crossing per world, the highest rung it reached', async () => {
    await con.getRepository(UserWorldLevelUp).save([
      { userId: '4', nicheId: nicheJs, level: 7, reads: 40 },
      { userId: '4', nicheId: nicheAi, level: 2, reads: 2 },
    ]);

    const res = await client.query(LEVEL_UP_QUERY);

    expect(res.data.worldRecentLevelUps).toHaveLength(1);
    expect(res.data.worldRecentLevelUps[0]).toMatchObject({ level: 7 });
  });

  it('leaves out crossings older than the window, and private worlds', async () => {
    await con
      .getRepository(UserWorldSettings)
      .save({ userId: '2', private: true });
    await con.getRepository(UserWorldLevelUp).save([
      { userId: '2', nicheId: nicheJs, level: 9, reads: 300 },
      {
        userId: '3',
        nicheId: nicheJs,
        level: 8,
        reads: 120,
        createdAt: subDays(new Date(), 4),
      },
      { userId: '4', nicheId: nicheJs, level: 7, reads: 40 },
    ]);

    const res = await client.query(LEVEL_UP_QUERY);

    expect(
      res.data.worldRecentLevelUps.map(
        (row: { world: { user: { id: string } } }) => row.world.user.id,
      ),
    ).toEqual(['4']);
  });
});

describe('query followedWorlds', () => {
  const FOLLOWED_QUERY = /* GraphQL */ `
    query FollowedWorlds($first: Int, $after: String) {
      followedWorlds(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            articles
            user {
              id
            }
          }
        }
      }
    }
  `;

  const followedIds = async (variables?: {
    first?: number;
    after?: string;
  }): Promise<string[]> => {
    const res = await client.query(FOLLOWED_QUERY, { variables });
    return res.data.followedWorlds.edges.map(
      (edge: { node: { user: { id: string } } }) => edge.node.user.id,
    );
  };

  beforeEach(async () => {
    await saveRankingFixtures();
    await expectSuccessfulCron(worldIndexCron);
  });

  it('requires authentication', () =>
    testQueryErrorCode(client, { query: FOLLOWED_QUERY }, 'UNAUTHENTICATED'));

  it('returns the worlds of people the viewer follows', async () => {
    loggedUser = '1';
    await con.getRepository(ContentPreferenceUser).save({
      userId: '1',
      referenceId: '2',
      referenceUserId: '2',
      feedId: '1',
      status: ContentPreferenceStatus.Follow,
    });

    // User 1 is the viewer; nobody else here is followed.
    expect(await followedIds()).toEqual(['2']);
  });

  it('does not return a squadmate the viewer has not followed', async () => {
    loggedUser = '1';
    await con.getRepository(SourceMember).save([
      {
        sourceId: 'a',
        userId: '1',
        role: SourceMemberRoles.Member,
        referralToken: 'tok-1',
      },
      {
        sourceId: 'a',
        userId: '3',
        role: SourceMemberRoles.Member,
        referralToken: 'tok-3',
      },
    ]);

    expect(await followedIds()).toEqual([]);
  });

  it('pages through the follow list with a cursor', async () => {
    loggedUser = '1';
    await con.getRepository(ContentPreferenceUser).save(
      ['2', '3', '4'].map((referenceId) => ({
        userId: '1',
        referenceId,
        referenceUserId: referenceId,
        feedId: '1',
        status: ContentPreferenceStatus.Follow,
      })),
    );

    const first = await client.query(FOLLOWED_QUERY, {
      variables: { first: 2 },
    });
    const firstIds = first.data.followedWorlds.edges.map(
      (edge: { node: { user: { id: string } } }) => edge.node.user.id,
    );

    expect(firstIds).toHaveLength(2);
    expect(first.data.followedWorlds.pageInfo.hasNextPage).toBe(true);

    const rest = await followedIds({
      first: 2,
      after: first.data.followedWorlds.pageInfo.endCursor,
    });

    // The second page continues where the first stopped, with no repeats.
    expect(rest).toHaveLength(1);
    expect(firstIds).not.toContain(rest[0]);
    expect([...firstIds, ...rest].sort()).toEqual(['2', '3', '4']);
  });

  it('reports no next page when the last page is exactly full', async () => {
    loggedUser = '1';
    await con.getRepository(ContentPreferenceUser).save({
      userId: '1',
      referenceId: '2',
      referenceUserId: '2',
      feedId: '1',
      status: ContentPreferenceStatus.Follow,
    });

    const res = await client.query(FOLLOWED_QUERY, { variables: { first: 1 } });

    expect(res.data.followedWorlds.edges).toHaveLength(1);
    expect(res.data.followedWorlds.pageInfo.hasNextPage).toBe(false);
  });

  it('never returns a private world, even from a direct follow', async () => {
    loggedUser = '1';
    await con
      .getRepository(UserWorldSettings)
      .save({ userId: '2', private: true });
    await con.getRepository(ContentPreferenceUser).save({
      userId: '1',
      referenceId: '2',
      referenceUserId: '2',
      feedId: '1',
      status: ContentPreferenceStatus.Follow,
    });

    expect(await followedIds()).toEqual([]);
  });

  it('does not return a followed world that is below the district floor', async () => {
    loggedUser = '1';
    await dropBelowFloor('4');
    await expectSuccessfulCron(worldIndexCron);
    await con.getRepository(ContentPreferenceUser).save({
      userId: '1',
      referenceId: '4',
      referenceUserId: '4',
      feedId: '1',
      status: ContentPreferenceStatus.Follow,
    });

    expect(await followedIds()).toEqual([]);
  });
});

/**
 * Two districts outside the AI domain, so a world clears the listing floor
 * without changing the domain under test. `filler` cannot be used here: it
 * leads with `ai_llm`, which these fixtures set explicitly.
 */
const outsideAi = (userId: string): DeepPartial<UserNicheAnalytics>[] =>
  [nicheGo, nicheRust].map((nicheId) => ({
    userId,
    nicheId,
    reads: 1,
    firstReadAt: day(30),
    lastReadAt: day(1),
    activeDays: 1,
  }));

const DOMAIN_RANKING_QUERY = /* GraphQL */ `
  query WorldDomainRanking(
    $domain: NicheDomain!
    $period: WorldRankPeriod!
    $limit: Int
  ) {
    worldDomainRanking(domain: $domain, period: $period, limit: $limit) {
      rank
      articles
      worldName
      user {
        id
      }
    }
  }
`;

const domainRanked = (domain: string, period: string, limit?: number) =>
  client
    .query(DOMAIN_RANKING_QUERY, { variables: { domain, period, limit } })
    .then((res) =>
      res.data.worldDomainRanking.map(
        (row: { rank: number; user: { id: string }; articles: number }) => [
          row.rank,
          row.user.id,
          row.articles,
        ],
      ),
    );

describe('query worldDomainRanking', () => {
  /**
   * Two readers of the AI domain who disagree with every niche board in it.
   *
   * User 2 is deeper than user 1 in `ai_llm` alone, so the niche ranking puts
   * them first. User 1 also reads the domain's other niche, and across the
   * domain reads more. This is the case a client-side merge of niche boards
   * cannot get right.
   */
  const saveDomainFixtures = async () => {
    await saveFixtures(con, UserNicheAnalytics, [
      {
        userId: '1',
        nicheId: nicheAi,
        reads: 100,
        firstReadAt: day(300),
        lastReadAt: day(1),
        activeDays: 40,
      },
      {
        userId: '1',
        nicheId: nicheChain,
        reads: 400,
        firstReadAt: day(300),
        lastReadAt: day(1),
        activeDays: 40,
      },
      {
        userId: '2',
        nicheId: nicheAi,
        reads: 180,
        firstReadAt: day(300),
        lastReadAt: day(1),
        activeDays: 40,
      },
      ...outsideAi('1'),
      ...outsideAi('2'),
    ]);
    await refreshIndexViews();
  };

  it('ranks a domain by the sum across its topics, not by any one of them', async () => {
    await saveFixtures(con, UserNicheAnalytics, [
      {
        userId: '1',
        nicheId: nicheAi,
        reads: 100,
        firstReadAt: day(300),
        lastReadAt: day(1),
        activeDays: 40,
      },
      {
        userId: '2',
        nicheId: nicheAi,
        reads: 180,
        firstReadAt: day(300),
        lastReadAt: day(1),
        activeDays: 40,
      },
      ...outsideAi('1'),
      ...outsideAi('2'),
    ]);
    await refreshIndexViews();

    // Only one niche carries the domain here, so the two boards agree.
    expect(await domainRanked('ai', 'all')).toEqual([
      [1, '2', 180],
      [2, '1', 100],
    ]);
  });

  it('leaves a serving-hidden topic out of the domain total', async () => {
    await saveDomainFixtures();

    // `blockchain` is hidden at serving time and shares the AI domain, so
    // user 1's 400 reads there must not count towards it.
    expect(await domainRanked('ai', 'all')).toEqual([
      [1, '2', 180],
      [2, '1', 100],
    ]);
  });

  it('never returns a private world', async () => {
    await saveDomainFixtures();
    await con
      .getRepository(UserWorldSettings)
      .save({ userId: '2', private: true });

    expect(await domainRanked('ai', 'all')).toEqual([[1, '1', 100]]);
  });

  it('does not return a world below the district floor', async () => {
    await saveDomainFixtures();
    await dropBelowFloor('2');
    await refreshIndexViews();

    expect(await domainRanked('ai', 'all')).toEqual([[1, '1', 100]]);
  });

  it('scores the week off the growth log rather than the districts', async () => {
    await saveDomainFixtures();
    await saveFixtures(con, UserNicheGrowth, [
      { userId: '1', date: day(2), nicheId: nicheAi, reads: 30 },
      { userId: '2', date: day(2), nicheId: nicheAi, reads: 4 },
    ]);
    await refreshIndexViews();

    // Reversed against all time, which is the whole point of the two periods.
    expect(await domainRanked('ai', 'week')).toEqual([
      [1, '1', 30],
      [2, '2', 4],
    ]);
  });
});

describe('query worldDomainRankPosition', () => {
  const POSITION = /* GraphQL */ `
    query WorldDomainRankPosition(
      $domain: NicheDomain!
      $period: WorldRankPeriod!
    ) {
      worldDomainRankPosition(domain: $domain, period: $period) {
        rank
        articles
        cappedAt
      }
    }
  `;

  it('requires authentication', () =>
    testQueryErrorCode(
      client,
      { query: POSITION, variables: { domain: 'ai', period: 'all' } },
      'UNAUTHENTICATED',
    ));

  it('places the viewer on their domain total', async () => {
    await saveFixtures(con, UserNicheAnalytics, [
      {
        userId: '1',
        nicheId: nicheAi,
        reads: 100,
        firstReadAt: day(300),
        lastReadAt: day(1),
        activeDays: 40,
      },
      {
        userId: '2',
        nicheId: nicheAi,
        reads: 180,
        firstReadAt: day(300),
        lastReadAt: day(1),
        activeDays: 40,
      },
      ...outsideAi('1'),
      ...outsideAi('2'),
    ]);
    await refreshIndexViews();
    loggedUser = '1';

    const res = await client.query(POSITION, {
      variables: { domain: 'ai', period: 'all' },
    });

    expect(res.data.worldDomainRankPosition).toEqual({
      rank: 2,
      articles: 100,
      cappedAt: WORLD_RANK_DEPTH,
    });
  });

  it('answers a real total for a viewer the ranking does not hold', async () => {
    loggedUser = '1';
    await saveFixtures(con, UserNicheAnalytics, [
      {
        userId: '1',
        nicheId: nicheAi,
        reads: 7,
        firstReadAt: day(30),
        lastReadAt: day(1),
        activeDays: 3,
      },
    ]);

    const res = await client.query(POSITION, {
      variables: { domain: 'ai', period: 'all' },
    });

    // Below the district floor, so unranked, but the count is still theirs.
    expect(res.data.worldDomainRankPosition).toEqual({
      rank: null,
      articles: 7,
      cappedAt: WORLD_RANK_DEPTH,
    });
  });
});

describe('query worldDomainReaders', () => {
  it('counts a reader once per domain, not once per topic', async () => {
    await saveFixtures(con, UserNicheAnalytics, [
      // One reader with a district in three domains, so `cloud` must count them
      // exactly once however many topics of it they read.
      {
        userId: '1',
        nicheId: nicheGo,
        reads: 40,
        firstReadAt: day(300),
        lastReadAt: day(1),
        activeDays: 20,
      },
      {
        userId: '1',
        nicheId: nicheAi,
        reads: 5,
        firstReadAt: day(300),
        lastReadAt: day(1),
        activeDays: 5,
      },
      {
        userId: '1',
        nicheId: nicheRust,
        reads: 3,
        firstReadAt: day(300),
        lastReadAt: day(1),
        activeDays: 3,
      },
    ]);
    await refreshIndexViews();

    const res = await client.query(/* GraphQL */ `
      query {
        worldDomainReaders {
          domain
          readers
        }
      }
    `);
    const byDomain = Object.fromEntries(
      res.data.worldDomainReaders.map(
        (row: { domain: string; readers: number }) => [row.domain, row.readers],
      ),
    );

    expect(byDomain.cloud).toBe(1);
  });
});

import { format, subDays } from 'date-fns';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  Feed,
  Post,
  Source,
  SourceMember,
  SourceType,
  SquadPostsAnalytics,
  User,
} from '../src/entity';
import { PostAnalytics } from '../src/entity/posts/PostAnalytics';
import { PostAnalyticsHistory } from '../src/entity/posts/PostAnalyticsHistory';
import { SourceMemberRoles } from '../src/roles';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testQueryErrorCode,
} from './helpers';
import { usersFixture } from './fixture/user';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;

const SQUAD_ID = 'sq-analytics';
const EMPTY_SQUAD_ID = 'sq-empty';

const ensureSquadPostsAnalyticsView = async (): Promise<void> => {
  await con.query('DROP MATERIALIZED VIEW IF EXISTS squad_posts_analytics');
  await con.query(`
    CREATE MATERIALIZED VIEW squad_posts_analytics AS
    SELECT
      p."sourceId" AS id,
      COALESCE(SUM(pa.impressions + pa."impressionsAds"), 0)::integer AS impressions,
      COALESCE(SUM(pa.reach), 0)::integer AS reach,
      COALESCE(SUM(pa."reachAll"), 0)::integer AS "reachAll",
      COALESCE(SUM(pa.upvotes), 0)::integer AS upvotes,
      COALESCE(SUM(pa.downvotes), 0)::integer AS downvotes,
      COALESCE(SUM(pa.comments), 0)::integer AS comments,
      COALESCE(SUM(pa.bookmarks), 0)::integer AS bookmarks,
      COALESCE(SUM(pa.awards), 0)::integer AS awards,
      COALESCE(SUM(pa."sharesInternal" + pa."sharesExternal"), 0)::integer AS shares,
      COALESCE(SUM(pa.clicks + pa."clicksAds" + pa."goToLink"), 0)::integer AS clicks,
      NOW() AS "updatedAt"
    FROM post p
    INNER JOIN post_analytics pa ON p.id = pa.id
    WHERE p."sourceId" IS NOT NULL
      AND p.deleted = false
      AND p.visible = true
    GROUP BY p."sourceId"
  `);
  await con.query(`
    CREATE UNIQUE INDEX squad_posts_analytics_id_idx ON squad_posts_analytics (id)
  `);
};

beforeAll(async () => {
  con = await createOrGetConnection();
  await ensureSquadPostsAnalyticsView();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = null;

  await saveFixtures(con, User, usersFixture);
  await saveFixtures(
    con,
    Feed,
    usersFixture.map(({ id }) => ({ userId: id, id })),
  );

  await saveFixtures(con, Source, [
    {
      id: SQUAD_ID,
      handle: 'sq-analytics',
      name: 'Analytics Squad',
      image: 'https://daily.dev/sq-analytics.jpg',
      type: SourceType.Squad,
      active: true,
      private: true,
    },
    {
      id: EMPTY_SQUAD_ID,
      handle: 'sq-empty',
      name: 'Empty Squad',
      image: 'https://daily.dev/sq-empty.jpg',
      type: SourceType.Squad,
      active: true,
      private: true,
    },
    {
      id: 'other-source',
      handle: 'other-source',
      name: 'Other source',
      image: 'https://daily.dev/other.jpg',
      type: SourceType.Squad,
      active: true,
      private: true,
    },
  ]);

  await saveFixtures(con, SourceMember, [
    {
      sourceId: SQUAD_ID,
      userId: '1',
      role: SourceMemberRoles.Admin,
      referralToken: randomUUID(),
    },
    {
      sourceId: SQUAD_ID,
      userId: '2',
      role: SourceMemberRoles.Moderator,
      referralToken: randomUUID(),
    },
    {
      sourceId: SQUAD_ID,
      userId: '3',
      role: SourceMemberRoles.Member,
      referralToken: randomUUID(),
    },
    {
      sourceId: EMPTY_SQUAD_ID,
      userId: '1',
      role: SourceMemberRoles.Admin,
      referralToken: randomUUID(),
    },
  ]);

  await saveFixtures(con, Post, [
    {
      id: 'sq-post-1',
      shortId: 'sqp1',
      title: 'Squad post 1',
      url: 'https://example.com/sq-post-1',
      sourceId: SQUAD_ID,
      authorId: '1',
      visible: true,
      deleted: false,
    },
    {
      id: 'sq-post-2',
      shortId: 'sqp2',
      title: 'Squad post 2',
      url: 'https://example.com/sq-post-2',
      sourceId: SQUAD_ID,
      authorId: '2',
      visible: true,
      deleted: false,
    },
    {
      id: 'sq-post-deleted',
      shortId: 'sqpd',
      title: 'Deleted post',
      url: 'https://example.com/sq-post-deleted',
      sourceId: SQUAD_ID,
      authorId: '1',
      visible: true,
      deleted: true,
    },
    {
      id: 'other-post',
      shortId: 'oth1',
      title: 'Other post',
      url: 'https://example.com/other-post',
      sourceId: 'other-source',
      authorId: '1',
      visible: true,
      deleted: false,
    },
  ]);

  await saveFixtures(con, PostAnalytics, [
    {
      id: 'sq-post-1',
      impressions: 100,
      impressionsAds: 20,
      reach: 50,
      reachAll: 60,
      upvotes: 10,
      downvotes: 2,
      comments: 3,
      bookmarks: 4,
      awards: 1,
      sharesInternal: 5,
      sharesExternal: 1,
      clicks: 7,
      clicksAds: 2,
      goToLink: 1,
    },
    {
      id: 'sq-post-2',
      impressions: 50,
      impressionsAds: 0,
      reach: 30,
      reachAll: 20,
      upvotes: 4,
      downvotes: 1,
      comments: 2,
      bookmarks: 1,
      awards: 0,
      sharesInternal: 0,
      sharesExternal: 2,
      clicks: 2,
      clicksAds: 0,
      goToLink: 3,
    },
    {
      id: 'sq-post-deleted',
      impressions: 500,
      impressionsAds: 0,
      reach: 400,
      reachAll: 400,
      upvotes: 100,
      downvotes: 1,
      comments: 50,
      bookmarks: 20,
      awards: 5,
      sharesInternal: 1,
      sharesExternal: 1,
      clicks: 1,
      clicksAds: 0,
      goToLink: 0,
    },
    {
      id: 'other-post',
      impressions: 999,
      impressionsAds: 999,
      reach: 999,
      reachAll: 999,
      upvotes: 999,
      downvotes: 0,
      comments: 999,
      bookmarks: 999,
      awards: 999,
      sharesInternal: 999,
      sharesExternal: 999,
      clicks: 999,
      clicksAds: 999,
      goToLink: 999,
    },
  ]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const oldDate = format(subDays(new Date(), 60), 'yyyy-MM-dd');

  await saveFixtures(con, PostAnalyticsHistory, [
    {
      id: 'sq-post-1',
      date: today,
      impressions: 100,
      impressionsAds: 20,
    },
    {
      id: 'sq-post-2',
      date: today,
      impressions: 50,
      impressionsAds: 10,
    },
    {
      id: 'sq-post-1',
      date: yesterday,
      impressions: 70,
      impressionsAds: 5,
    },
    {
      id: 'sq-post-2',
      date: oldDate,
      impressions: 700,
      impressionsAds: 50,
    },
    {
      id: 'sq-post-deleted',
      date: today,
      impressions: 500,
      impressionsAds: 100,
    },
  ]);

  await con.query(
    `REFRESH MATERIALIZED VIEW ${con.getRepository(SquadPostsAnalytics).metadata.tableName}`,
  );
});

afterAll(async () => {
  await disposeGraphQLTesting(state);
  await con.destroy();
});

describe('query squadAnalytics', () => {
  const QUERY = /* GraphQL */ `
    query SquadAnalytics($sourceId: ID!) {
      squadAnalytics(sourceId: $sourceId) {
        id
        impressions
        reach
        upvotes
        downvotes
        comments
        bookmarks
        awards
        shares
        clicks
        upvotesRatio
      }
    }
  `;

  it('should return aggregated analytics for squad admin', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { sourceId: SQUAD_ID },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.squadAnalytics).toMatchObject({
      id: SQUAD_ID,
      impressions: 170,
      reach: 80,
      upvotes: 14,
      downvotes: 3,
      comments: 5,
      bookmarks: 5,
      awards: 1,
      shares: 8,
      clicks: 15,
      upvotesRatio: 82,
    });
  });

  it('should allow squad moderators to view analytics', async () => {
    loggedUser = '2';

    const res = await client.query(QUERY, {
      variables: { sourceId: SQUAD_ID },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.squadAnalytics).toMatchObject({
      id: SQUAD_ID,
      impressions: 170,
      upvotes: 14,
      comments: 5,
    });
  });

  it('should deny regular members', async () => {
    loggedUser = '3';

    await testQueryErrorCode(
      client,
      { query: QUERY, variables: { sourceId: SQUAD_ID } },
      'FORBIDDEN',
    );
  });

  it('should return null when squad has no posts', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { sourceId: EMPTY_SQUAD_ID },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.squadAnalytics).toBeNull();
  });
});

describe('query squadAnalyticsHistory', () => {
  const QUERY = /* GraphQL */ `
    query SquadAnalyticsHistory($sourceId: ID!) {
      squadAnalyticsHistory(sourceId: $sourceId) {
        date
        impressions
        impressionsAds
      }
    }
  `;

  it('should return daily aggregated impressions history for admins', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { sourceId: SQUAD_ID },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.squadAnalyticsHistory).toHaveLength(2);
    expect(res.data.squadAnalyticsHistory[0]).toMatchObject({
      date: expect.any(String),
      impressions: 180,
      impressionsAds: 30,
    });
    expect(res.data.squadAnalyticsHistory[1]).toMatchObject({
      date: expect.any(String),
      impressions: 75,
      impressionsAds: 5,
    });
  });

  it('should allow squad moderators to view analytics history', async () => {
    loggedUser = '2';

    const res = await client.query(QUERY, {
      variables: { sourceId: SQUAD_ID },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.squadAnalyticsHistory).toHaveLength(2);
  });

  it('should deny regular members for analytics history', async () => {
    loggedUser = '3';

    await testQueryErrorCode(
      client,
      { query: QUERY, variables: { sourceId: SQUAD_ID } },
      'FORBIDDEN',
    );
  });
});

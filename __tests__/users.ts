import { FastifyInstance } from 'fastify';
import { Connection, getConnection } from 'typeorm';
import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import {
  addDays,
  addHours,
  startOfDay,
  startOfISOWeek,
  subDays,
  subHours,
} from 'date-fns';
import createApolloServer from '../src/apollo';
import { Context } from '../src/Context';
import {
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import appFunc from '../src';
import { Comment, Post, Source, User, View } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { DevCard } from '../src/entity/DevCard';

let app: FastifyInstance;
let con: Connection;
let server: ApolloServer;
let client: ApolloServerTestClient;
let loggedUser: string = null;
let loggedUserTimezoned: string = null;

beforeAll(async () => {
  con = await getConnection();
  server = await createApolloServer({
    context: (): Context => new MockContext(con, loggedUser),
    playground: false,
  });
  client = createTestClient(server);
  app = await appFunc();
  return app.ready();
});

const now = new Date();

beforeEach(async () => {
  loggedUser = null;
  loggedUserTimezoned = null;

  await con.getRepository(User).save([
    {
      id: '1',
      name: 'Ido',
      image: 'https://daily.dev/ido.jpg',
      timezone: 'utc',
    },
    {
      id: '2',
      name: 'Tsahi',
      image: 'https://daily.dev/tsahi.jpg',
      timezone: 'Pacific/Midway',
    },
  ]);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, [
    {
      id: 'p1',
      shortId: 'sp1',
      title: 'P1',
      url: 'http://p1.com',
      sourceId: 'a',
      createdAt: now,
      authorId: '1',
      views: 20,
      upvotes: 5,
      image: 'sample.image.test',
    },
    {
      id: 'p2',
      shortId: 'sp2',
      title: 'P2',
      url: 'http://p2.com',
      sourceId: 'b',
      createdAt: new Date(now.getTime() - 1000),
      views: 5,
      upvotes: 1,
      image: 'sample.image.test',
    },
    {
      id: 'p3',
      shortId: 'sp3',
      title: 'P3',
      url: 'http://p3.com',
      sourceId: 'c',
      createdAt: new Date(now.getTime() - 2000),
      authorId: '1',
      views: 80,
      upvotes: 10,
      image: 'sample.image.test',
    },
    {
      id: 'p4',
      shortId: 'sp4',
      title: 'P4',
      url: 'http://p4.com',
      sourceId: 'a',
      createdAt: new Date(now.getTime() - 3000),
      authorId: '1',
      upvotes: 5,
      image: 'sample.image.test',
    },
    {
      id: 'p5',
      shortId: 'sp5',
      title: 'P5',
      url: 'http://p5.com',
      sourceId: 'b',
      createdAt: new Date(now.getTime() - 4000),
      image: 'sample.image.test',
    },
    {
      id: 'p6',
      shortId: 'sp6',
      title: 'P6',
      url: 'http://p6.com',
      sourceId: 'p',
      createdAt: new Date(now.getTime() - 5000),
      views: 40,
      image: 'sample.image.test',
    },
    {
      id: 'p7',
      shortId: 'sp7',
      title: 'P7',
      url: 'http://p7.com',
      sourceId: 'p',
      createdAt: new Date(now.getTime() - 6000),
      views: 10,
      image: 'sample.image.test',
    },
  ]);
  await con.getRepository(Comment).save([
    {
      id: 'c1',
      postId: 'p1',
      userId: '1',
      content: 'parent comment',
      createdAt: new Date(2020, 1, 6, 0, 0),
      upvotes: 5,
    },
    {
      id: 'c2',
      parentId: 'c1',
      postId: 'p1',
      userId: '1',
      content: 'child comment',
      createdAt: new Date(2020, 1, 7, 0, 0),
      upvotes: 10,
    },
    {
      id: 'c3',
      postId: 'p1',
      userId: '2',
      content: 'parent comment #2',
      createdAt: new Date(2020, 1, 8, 0, 0),
      upvotes: 2,
    },
  ]);
});

afterAll(() => app.close());

describe('query userStats', () => {
  const QUERY = `query UserStats($id: ID!){
    userStats(id: $id) {
      numPosts
      numComments
      numPostViews
      numPostUpvotes
      numCommentUpvotes
    }
  }`;

  it('should return partially null result when the user is not the stats owner', async () => {
    loggedUser = '1';
    const res = await client.query({ query: QUERY, variables: { id: '2' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userStats).toMatchSnapshot();
  });

  it('should return the user stats', async () => {
    loggedUser = '1';
    const res = await client.query({ query: QUERY, variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should return partial user stats when no posts or no comments', async () => {
    loggedUser = '2';
    const res = await client.query({ query: QUERY, variables: { id: '2' } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('query userReadingRank', () => {
  const QUERY = `query UserReadingRank($id: ID!){
    userReadingRank(id: $id) {
      rankThisWeek
      rankLastWeek
      currentRank
      progressThisWeek
      readToday
    }
  }`;

  const now = new Date();
  const thisWeekStart = startOfISOWeek(now);
  const lastWeekStart = startOfISOWeek(subDays(now, 7));
  const dayStart = startOfDay(now);

  it('should return partially null result when the user asks for someone else', async () => {
    loggedUser = '1';
    const res = await client.query({ query: QUERY, variables: { id: '2' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRank).toMatchSnapshot();
  });

  it('should return the reading rank', async () => {
    loggedUser = '1';
    await con.getRepository(View).save([
      { userId: loggedUser, postId: 'p1', timestamp: lastWeekStart },
      {
        userId: loggedUser,
        postId: 'p2',
        timestamp: addDays(lastWeekStart, 1),
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: addDays(lastWeekStart, 3),
      },
      {
        userId: loggedUser,
        postId: 'p4',
        timestamp: addDays(thisWeekStart, 1),
      },
      {
        userId: loggedUser,
        postId: 'p5',
        timestamp: addDays(thisWeekStart, 2),
      },
      {
        userId: loggedUser,
        postId: 'p6',
        timestamp: addDays(thisWeekStart, 3),
      },
      {
        userId: loggedUser,
        postId: 'p7',
        timestamp: addDays(thisWeekStart, 4),
      },
    ]);
    const res = await client.query({ query: QUERY, variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRank).toMatchSnapshot({
      readToday: expect.anything(),
    });
  });

  it('should return last week rank as current rank', async () => {
    loggedUser = '1';
    await con.getRepository(View).save([
      { userId: loggedUser, postId: 'p1', timestamp: lastWeekStart },
      {
        userId: loggedUser,
        postId: 'p2',
        timestamp: addDays(lastWeekStart, 1),
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: addDays(lastWeekStart, 3),
      },
      {
        userId: loggedUser,
        postId: 'p4',
        timestamp: addDays(thisWeekStart, 1),
      },
    ]);
    const res = await client.query({ query: QUERY, variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRank.currentRank).toEqual(1);
  });

  it('should return different results if a timezone is set', async () => {
    loggedUser = '1';
    loggedUserTimezoned = '2';
    const timeZoneLastWeekStart = subHours(startOfISOWeek(subDays(now, 7)), 5);
    await con.getRepository(View).save([
      {
        userId: loggedUser,
        postId: 'p1',
        timestamp: timeZoneLastWeekStart,
      },
      {
        userId: loggedUser,
        postId: 'p2',
        timestamp: addDays(timeZoneLastWeekStart, 2),
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: addDays(timeZoneLastWeekStart, 3),
      },
      {
        userId: loggedUserTimezoned,
        postId: 'p1',
        timestamp: timeZoneLastWeekStart,
      },
      {
        userId: loggedUserTimezoned,
        postId: 'p2',
        timestamp: addDays(timeZoneLastWeekStart, 2),
      },
      {
        userId: loggedUserTimezoned,
        postId: 'p3',
        timestamp: addDays(timeZoneLastWeekStart, 3),
      },
    ]);
    const res = await client.query({ query: QUERY, variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRank.currentRank).toEqual(0);

    const resPacific = await client.query({
      query: QUERY,
      variables: { id: loggedUserTimezoned },
    });
    expect(resPacific.errors).toBeFalsy();
    expect(resPacific.data.userReadingRank.currentRank).toEqual(1);
  });

  it('should set readToday to true', async () => {
    loggedUser = '1';
    await con
      .getRepository(View)
      .save([{ userId: loggedUser, postId: 'p4', timestamp: dayStart }]);
    const res = await client.query({ query: QUERY, variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRank.readToday).toEqual(true);
  });

  it('should group progress by day', async () => {
    loggedUser = '1';
    await con.getRepository(View).save([
      { userId: loggedUser, postId: 'p1', timestamp: thisWeekStart },
      {
        userId: loggedUser,
        postId: 'p2',
        timestamp: addHours(thisWeekStart, 1),
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: addHours(thisWeekStart, 3),
      },
    ]);
    const res = await client.query({ query: QUERY, variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRank.progressThisWeek).toEqual(1);
  });
});

describe('query userReadingRankHistory with timezone', () => {
  const QUERY = `query UserReadingRankHistory($id: ID!){
    userReadingRankHistory(id: $id) {
      rank
      count
    }
  }`;

  const now = new Date();
  // const thisWeekStart = subHours(startOfISOWeek(new Date()), 5);
  const lastWeekStart = subHours(startOfISOWeek(subDays(now, 7)), 5);
  const lastTwoWeeksStart = subHours(startOfISOWeek(subDays(now, 14)), 5);
  const lastThreeWeeksStart = subHours(startOfISOWeek(subDays(now, 21)), 5);

  it('should return the reading rank history', async () => {
    loggedUser = '1';
    const loggedUserTimezonded = '2';
    await con.getRepository(View).save([
      { userId: loggedUser, postId: 'p1', timestamp: lastThreeWeeksStart },
      {
        userId: loggedUser,
        postId: 'p2',
        timestamp: lastTwoWeeksStart,
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: addDays(lastTwoWeeksStart, 1),
      },
      {
        userId: loggedUser,
        postId: 'p4',
        timestamp: addDays(lastTwoWeeksStart, 2),
      },
      {
        userId: loggedUser,
        postId: 'p5',
        timestamp: addDays(lastWeekStart, 3),
      },
      {
        userId: loggedUser,
        postId: 'p6',
        timestamp: addDays(lastWeekStart, 4),
      },
      {
        userId: loggedUser,
        postId: 'p7',
        timestamp: addDays(lastWeekStart, 5),
      },
      {
        userId: loggedUserTimezonded,
        postId: 'p1',
        timestamp: lastThreeWeeksStart,
      },
      {
        userId: loggedUserTimezonded,
        postId: 'p2',
        timestamp: lastTwoWeeksStart,
      },
      {
        userId: loggedUserTimezonded,
        postId: 'p3',
        timestamp: addDays(lastTwoWeeksStart, 1),
      },
      {
        userId: loggedUserTimezonded,
        postId: 'p4',
        timestamp: addDays(lastTwoWeeksStart, 2),
      },
      {
        userId: loggedUserTimezonded,
        postId: 'p5',
        timestamp: addDays(lastWeekStart, 3),
      },
      {
        userId: loggedUserTimezonded,
        postId: 'p6',
        timestamp: addDays(lastWeekStart, 4),
      },
      {
        userId: loggedUserTimezonded,
        postId: 'p7',
        timestamp: addDays(lastWeekStart, 5),
      },
    ]);
    const res = await client.query({ query: QUERY, variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRankHistory).toMatchSnapshot();
    expect(res.data.userReadingRankHistory[0].count).toBe(3);
    expect(res.data.userReadingRankHistory[1].count).toBe(1);

    const resPacific = await client.query({
      query: QUERY,
      variables: { id: loggedUserTimezonded },
    });
    expect(resPacific.errors).toBeFalsy();
    expect(resPacific.data.userReadingRankHistory).toMatchSnapshot();
    expect(resPacific.data.userReadingRankHistory[0].count).toBe(1);
    expect(resPacific.data.userReadingRankHistory[1].count).toBe(2);
  });
});

describe('query userReadingRankHistory', () => {
  const QUERY = `query UserReadingRankHistory($id: ID!){
    userReadingRankHistory(id: $id) {
      rank
      count
    }
  }`;

  const now = new Date();
  const thisWeekStart = startOfISOWeek(now);
  const lastWeekStart = startOfISOWeek(subDays(now, 7));
  const lastTwoWeeksStart = startOfISOWeek(subDays(now, 14));
  const lastThreeWeeksStart = startOfISOWeek(subDays(now, 21));

  it('should return the reading rank history', async () => {
    loggedUser = '1';
    await con.getRepository(View).save([
      { userId: loggedUser, postId: 'p1', timestamp: lastThreeWeeksStart },
      {
        userId: loggedUser,
        postId: 'p2',
        timestamp: lastTwoWeeksStart,
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: addDays(lastTwoWeeksStart, 1),
      },
      {
        userId: loggedUser,
        postId: 'p4',
        timestamp: addDays(lastTwoWeeksStart, 2),
      },
      {
        userId: loggedUser,
        postId: 'p5',
        timestamp: addDays(lastWeekStart, 3),
      },
      {
        userId: loggedUser,
        postId: 'p6',
        timestamp: addDays(lastWeekStart, 4),
      },
      {
        userId: loggedUser,
        postId: 'p7',
        timestamp: addDays(lastWeekStart, 5),
      },
    ]);
    const res = await client.query({ query: QUERY, variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRankHistory).toMatchSnapshot();
  });

  it('should not count views in the same day multiple times', async () => {
    loggedUser = '1';
    await con.getRepository(View).save([
      { userId: loggedUser, postId: 'p1', timestamp: lastThreeWeeksStart },
      {
        userId: loggedUser,
        postId: 'p2',
        timestamp: lastTwoWeeksStart,
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: addHours(lastTwoWeeksStart, 1),
      },
      {
        userId: loggedUser,
        postId: 'p4',
        timestamp: addDays(lastTwoWeeksStart, 2),
      },
      {
        userId: loggedUser,
        postId: 'p5',
        timestamp: addDays(lastWeekStart, 3),
      },
      {
        userId: loggedUser,
        postId: 'p6',
        timestamp: addDays(lastWeekStart, 4),
      },
      {
        userId: loggedUser,
        postId: 'p7',
        timestamp: addDays(lastWeekStart, 5),
      },
    ]);
    const res = await client.query({ query: QUERY, variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRankHistory).toMatchSnapshot();
  });

  it('should ignore views during current week', async () => {
    loggedUser = '1';
    await con.getRepository(View).save([
      { userId: loggedUser, postId: 'p1', timestamp: thisWeekStart },
      {
        userId: loggedUser,
        postId: 'p2',
        timestamp: addDays(thisWeekStart, 1),
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: addDays(thisWeekStart, 2),
      },
      {
        userId: loggedUser,
        postId: 'p4',
        timestamp: addDays(lastWeekStart, 2),
      },
      {
        userId: loggedUser,
        postId: 'p5',
        timestamp: addDays(lastWeekStart, 3),
      },
      {
        userId: loggedUser,
        postId: 'p6',
        timestamp: addDays(lastWeekStart, 4),
      },
      {
        userId: loggedUser,
        postId: 'p7',
        timestamp: addDays(lastWeekStart, 5),
      },
    ]);
    const res = await client.query({ query: QUERY, variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRankHistory).toMatchSnapshot();
  });
});

describe('query userReads', () => {
  const QUERY = `query UserReads {
    userReads
  }`;

  it('should not authorize when not logged-in', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should return the number of articles the user read', async () => {
    loggedUser = '1';
    await con.getRepository(View).save([
      { userId: loggedUser, postId: 'p1', timestamp: new Date() },
      {
        userId: loggedUser,
        postId: 'p2',
        timestamp: new Date(),
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: addDays(new Date(), 1),
      },
      {
        userId: loggedUser,
        postId: 'p4',
        timestamp: addDays(new Date(), 2),
      },
      {
        userId: loggedUser,
        postId: 'p5',
        timestamp: addDays(new Date(), 3),
      },
      {
        userId: loggedUser,
        postId: 'p6',
        timestamp: addDays(new Date(), 4),
      },
      {
        userId: loggedUser,
        postId: 'p7',
        timestamp: addDays(new Date(), 5),
      },
    ]);
    const res = await client.query({ query: QUERY });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReads).toEqual(7);
  });
});

describe('query userReadHistory', () => {
  const QUERY = `query UserReadHistory($id: ID!, $after: String!, $before: String!){
    userReadHistory(id: $id, after: $after, before: $before) {
      date
      reads
    }
  }`;

  const now = new Date(2021, 4, 2);
  const thisWeekStart = startOfISOWeek(now);
  const lastWeekStart = startOfISOWeek(subDays(now, 7));
  const lastTwoWeeksStart = startOfISOWeek(subDays(now, 14));
  const lastThreeWeeksStart = startOfISOWeek(subDays(now, 21));

  it('should return the read history', async () => {
    loggedUser = '1';
    await con.getRepository(View).save([
      { userId: loggedUser, postId: 'p1', timestamp: thisWeekStart },
      {
        userId: loggedUser,
        postId: 'p2',
        timestamp: thisWeekStart,
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: thisWeekStart,
      },
      {
        userId: loggedUser,
        postId: 'p4',
        timestamp: addDays(lastTwoWeeksStart, 2),
      },
      {
        userId: loggedUser,
        postId: 'p5',
        timestamp: addDays(lastTwoWeeksStart, 2),
      },
      {
        userId: loggedUser,
        postId: 'p6',
        timestamp: addDays(lastWeekStart, 4),
      },
      {
        userId: loggedUser,
        postId: 'p7',
        timestamp: addDays(lastWeekStart, 5),
      },
    ]);
    const res = await client.query({
      query: QUERY,
      variables: {
        id: '1',
        after: lastThreeWeeksStart.toISOString(),
        before: now.toISOString(),
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadHistory).toMatchSnapshot();
  });

  it('should return the timezone based read history', async () => {
    loggedUser = '1';
    const loggedUserTimezonded = '2';
    await con.getRepository(View).save([
      {
        userId: loggedUser,
        postId: 'p1',
        timestamp: subHours(thisWeekStart, 5),
      },
      {
        userId: loggedUserTimezonded,
        postId: 'p1',
        timestamp: subHours(thisWeekStart, 5),
      },
    ]);
    const res = await client.query({
      query: QUERY,
      variables: {
        id: '1',
        after: lastThreeWeeksStart.toISOString(),
        before: now.toISOString(),
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadHistory).toMatchSnapshot();
    expect(res.data.userReadHistory[0].date).toBe('2021-04-25');

    const resPacific = await client.query({
      query: QUERY,
      variables: {
        id: loggedUserTimezonded,
        after: lastThreeWeeksStart.toISOString(),
        before: now.toISOString(),
      },
    });
    expect(resPacific.errors).toBeFalsy();
    expect(resPacific.data.userReadHistory[0].date).toBe('2021-04-26');
  });
});

describe('query readHistory', () => {
  const QUERY = `
    query ReadHistory($after: String, $first: Int) {
      readHistory(first: $first, after: $after) {
        pageInfo { endCursor, hasNextPage }
        edges {
          node {
            timestamp
            post {
              id
              url
              title
              image
              source {
                image
              }
            }
          }
        }
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it("should return user's reading history paginated", async () => {
    loggedUser = '1';
    const createdAtOld = new Date('2020-09-22T07:15:51.247Z');
    const createdAtOlder = new Date('2021-08-22T07:15:51.247Z');
    const createdAtNew = new Date('2021-09-22T07:15:51.247Z');
    const createdAtNewer = new Date('2021-10-22T07:15:51.247Z');

    await saveFixtures(con, View, [
      {
        userId: '1',
        postId: 'p1',
        timestamp: createdAtOld,
      },
      {
        userId: '1',
        postId: 'p2',
        timestamp: createdAtNewer,
      },
      {
        userId: '1',
        postId: 'p2',
        timestamp: createdAtOlder,
      },
      {
        userId: '1',
        postId: 'p2',
        timestamp: createdAtNew,
      },
    ]);
    const res = await client.query({ query: QUERY });
    const [secondView, firstView] = res.data.readHistory.edges;
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
    expect(new Date(secondView.node.timestamp).getTime()).toBeGreaterThan(
      new Date(firstView.node.timestamp).getTime(),
    );
  });

  it('should return the reading history of user in descending order', async () => {
    loggedUser = '1';
    const createdAtOld = new Date('2020-09-22T07:15:51.247Z');
    const createdAtNew = new Date('2021-09-22T07:15:51.247Z');
    await saveFixtures(con, View, [
      {
        userId: '1',
        postId: 'p1',
        timestamp: createdAtNew,
      },
      {
        userId: '1',
        postId: 'p2',
        timestamp: createdAtOld,
      },
    ]);
    const res = await client.query({ query: QUERY });
    const [firstButLaterView, secondButEarlierView] =
      res.data.readHistory.edges;
    const firstDate = new Date(firstButLaterView.node.timestamp).getTime();
    const secondDate = new Date(secondButEarlierView.node.timestamp).getTime();
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
    expect(firstDate).toBeGreaterThan(secondDate);
  });

  it("should return user's reading history in without the hidden ones", async () => {
    loggedUser = '1';
    const createdAtOld = new Date('2020-09-22T07:15:51.247Z');
    const createdAtNew = new Date('2021-09-22T07:15:51.247Z');
    await saveFixtures(con, View, [
      {
        userId: '1',
        postId: 'p1',
        timestamp: createdAtOld,
        hidden: true,
      },
      {
        userId: '1',
        postId: 'p2',
        timestamp: createdAtNew,
      },
    ]);

    const res = await client.query({ query: QUERY });
    expect(res.errors).toBeFalsy();
    expect(res.data.readHistory.edges.length).toEqual(1);
    expect(res.data).toMatchSnapshot();
  });
});

describe('mutation generateDevCard', () => {
  const MUTATION = `mutation GenerateDevCard($file: Upload, $url: String){
    generateDevCard(file: $file, url: $url) {
      imageUrl
    }
  }`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
      },
      'UNAUTHENTICATED',
    ));

  it('should not validate passed url', () => {
    loggedUser = '1';
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { url: 'hh::/not-a-valid-url.test' },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should generate new dev card', async () => {
    loggedUser = '1';
    const res = await client.mutate({ mutation: MUTATION });
    expect(res.errors).toBeFalsy();
    const devCards = await con.getRepository(DevCard).find();
    expect(devCards.length).toEqual(1);
    expect(res.data.generateDevCard.imageUrl).toMatch(
      new RegExp(
        `http://localhost:4000/devcards/${devCards[0].id.replace(
          /-/g,
          '',
        )}.png\\?r=.*`,
      ),
    );
  });

  it('should generate new dev card based from the url', async () => {
    loggedUser = '1';
    const url =
      'https://daily-now-res.cloudinary.com/image/upload/v1634801813/devcard/bg/halloween.jpg';
    const res = await client.mutate({ mutation: MUTATION, variables: { url } });
    expect(res.errors).toBeFalsy();
    const devCards = await con.getRepository(DevCard).find();
    expect(devCards.length).toEqual(1);
    expect(res.data.generateDevCard.imageUrl).toMatch(
      new RegExp(
        `http://localhost:4000/devcards/${devCards[0].id.replace(
          /-/g,
          '',
        )}.png\\?r=.*`,
      ),
    );
  });

  it('should use an existing dev card entity', async () => {
    loggedUser = '1';
    await con.getRepository(DevCard).insert({ userId: '1' });
    const res = await client.mutate({ mutation: MUTATION });
    expect(res.errors).toBeFalsy();
    const devCards = await con.getRepository(DevCard).find();
    expect(devCards.length).toEqual(1);
    expect(res.data.generateDevCard.imageUrl).toMatch(
      new RegExp(
        `http://localhost:4000/devcards/${devCards[0].id.replace(
          /-/g,
          '',
        )}.png\\?r=.*`,
      ),
    );
  });
});

describe('mutation hideReadHistory', () => {
  const MUTATION = `
    mutation HideReadHistory($postId: String!, $timestamp: DateTime!) {
      hideReadHistory(postId: $postId, timestamp: $timestamp) {
        _
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { postId: 'p1', timestamp: now.toISOString() },
      },
      'UNAUTHENTICATED',
    ));

  it('should set view history hidden property to true', async () => {
    loggedUser = '1';
    const repo = con.getRepository(View);
    const createdAtOld = new Date('2020-09-22T07:15:51.247Z');
    const createdAtNew = new Date('2021-09-22T07:15:51.247Z');

    await repo.save([
      {
        userId: '1',
        postId: 'p1',
        hidden: false,
        timestamp: createdAtOld.toISOString(),
      },
      {
        userId: '1',
        postId: 'p2',
        hidden: false,
        timestamp: createdAtNew.toISOString(),
      },
    ]);

    const res = await client.mutate({
      mutation: MUTATION,
      variables: { postId: 'p2', timestamp: createdAtNew.toISOString() },
    });

    expect(res.errors).toBeFalsy();
    expect(await repo.find()).toMatchSnapshot();
  });

  it('should set view history hidden property to true without matching milliseconds value', async () => {
    loggedUser = '1';
    const createdAt = new Date('2020-09-22T07:15:51.247231Z');
    const createdAtDifferentMS = new Date('2020-09-22T07:15:51.247Z');
    const repo = con.getRepository(View);

    await repo.save([
      {
        userId: '1',
        postId: 'p1',
        timestamp: createdAt.toISOString(),
        hidden: false,
      },
      {
        userId: '1',
        postId: 'p2',
        hidden: false,
        timestamp: new Date('2019-09-22T07:15:51.247231Z').toISOString(),
      },
    ]);

    const res = await client.mutate({
      mutation: MUTATION,
      variables: {
        postId: 'p1',
        timestamp: createdAtDifferentMS.toISOString(),
      },
    });

    expect(res.errors).toBeFalsy();
    expect(await repo.find()).toMatchSnapshot();
  });
});

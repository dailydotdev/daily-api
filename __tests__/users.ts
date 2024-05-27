import nock from 'nock';
import { keywordsFixture } from './fixture/keywords';
import { Keyword } from './../src/entity/Keyword';
import { PostKeyword } from './../src/entity/PostKeyword';
import {
  addDays,
  addHours,
  startOfDay,
  startOfISOWeek,
  subDays,
  subHours,
} from 'date-fns';
import {
  authorizeRequest,
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  TEST_UA,
  testMutationErrorCode,
  testQueryError,
  testQueryErrorCode,
} from './helpers';
import {
  Alerts,
  ArticlePost,
  Comment,
  Feature,
  FeatureType,
  FeatureValue,
  Post,
  Source,
  User,
  View,
  UserPersonalizedDigest,
  UserStreak,
  MarketingCta,
  UserMarketingCta,
  UserPersonalizedDigestType,
  UserPersonalizedDigestSendType,
} from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { getTimezonedStartOfISOWeek } from '../src/common';
import { DataSource, In, IsNull } from 'typeorm';
import createOrGetConnection from '../src/db';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import setCookieParser from 'set-cookie-parser';
import { DisallowHandle } from '../src/entity/DisallowHandle';
import { DayOfWeek } from '../src/types';
import { CampaignType, Invite } from '../src/entity/Invite';
import { usersFixture } from './fixture/user';
import { deleteRedisKey, getRedisObject } from '../src/redis';
import { StorageKey, StorageTopic, generateStorageKey } from '../src/config';

let con: DataSource;
let app: FastifyInstance;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;
const userTimezone = 'Pacific/Midway';

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
  app = state.app;
});

const now = new Date();

beforeEach(async () => {
  loggedUser = null;
  nock.cleanAll();

  await con.getRepository(User).save([
    {
      id: '1',
      name: 'Ido',
      image: 'https://daily.dev/ido.jpg',
      timezone: 'utc',
      createdAt: new Date(),
    },
    {
      id: '2',
      name: 'Tsahi',
      image: 'https://daily.dev/tsahi.jpg',
      timezone: userTimezone,
    },
    {
      id: '3',
      name: 'Lee',
      image: 'https://daily.dev/lee.jpg',
      timezone: userTimezone,
      username: 'lee',
      twitter: 'lee',
      github: 'lee',
      hashnode: 'lee',
    },
  ]);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, [
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
      scoutId: '1',
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
    {
      id: 'pb',
      shortId: 'spb',
      title: 'PB',
      url: 'http://pb.com',
      sourceId: 'p',
      createdAt: new Date(now.getTime() - 6000),
      views: 10,
      banned: true,
      image: 'sample.image.test',
    },
    {
      id: 'pd',
      shortId: 'spd',
      title: 'PD',
      url: 'http://pd.com',
      sourceId: 'p',
      createdAt: new Date(now.getTime() - 6000),
      views: 10,
      deleted: true,
      image: 'sample.image.test',
    },
    {
      id: 'pp',
      shortId: 'spp',
      title: 'Private',
      url: 'http://pp.com',
      sourceId: 'p',
      createdAt: new Date(now.getTime() - 6000),
      views: 10,
      private: true,
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

const postKeywordFixtures: Partial<PostKeyword>[] = [
  { postId: 'p1', keyword: 'javascript', status: 'allow' },
  { postId: 'p1', keyword: 'ai', status: 'allow' },
  { postId: 'p1', keyword: 'security', status: 'allow' },
  { postId: 'p2', keyword: 'javascript', status: 'allow' },
  { postId: 'p2', keyword: 'cloud', status: 'allow' },
  { postId: 'p2', keyword: 'devops', status: 'allow' },
  { postId: 'p3', keyword: 'javascript', status: 'allow' },
  { postId: 'p3', keyword: 'crypto', status: 'allow' },
  { postId: 'p3', keyword: 'blockchain', status: 'allow' },
  { postId: 'p4', keyword: 'javascript', status: 'allow' },
  { postId: 'p4', keyword: 'security', status: 'allow' },
  { postId: 'p4', keyword: 'web3', status: 'allow' },
  { postId: 'p5', keyword: 'python', status: 'allow' },
  { postId: 'p5', keyword: 'ai', status: 'allow' },
  { postId: 'p5', keyword: 'analytics', status: 'allow' },
  { postId: 'p6', keyword: 'golang', status: 'allow' },
  { postId: 'p6', keyword: 'backend', status: 'allow' },
  { postId: 'p6', keyword: 'devops', status: 'allow' },
];

const additionalKeywords: Partial<Keyword>[] = [
  { value: 'security', occurrences: 15, status: 'allow' },
  { value: 'web3', occurrences: 20, status: 'allow' },
  { value: 'blockchain', occurrences: 30, status: 'allow' },
  { value: 'cloud', occurrences: 45, status: 'allow' },
  { value: 'backend', occurrences: 105, status: 'allow' },
  { value: 'crypto', occurrences: 180, status: 'allow' },
  { value: 'ai', occurrences: 270, status: 'allow' },
  { value: 'analytics', occurrences: 420, status: 'allow' },
  { value: 'devops', occurrences: 760, status: 'allow' },
  { value: 'javascript', occurrences: 980, status: 'allow' },
];

const mockLogout = () => {
  nock(process.env.KRATOS_ORIGIN)
    .get('/self-service/logout/browser')
    .reply(200, {});
};

afterAll(() => disposeGraphQLTesting(state));

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

  it('should return the user stats', async () => {
    const res = await client.query(QUERY, { variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should return partial user stats when no posts or no comments', async () => {
    loggedUser = '2';
    const res = await client.query(QUERY, { variables: { id: '2' } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('query userStreaks', () => {
  const QUERY = `query UserStreak {
    userStreak {
      max
      total
      current
      lastViewAt
    }
  }`;

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should not allow unauthenticated users', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should return the user streaks', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
  });

  it('should return empty streak when the user has no streak yet', async () => {
    loggedUser = '1';
    await con.getRepository(UserStreak).delete({ userId: loggedUser });
    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      userStreak: {
        max: 0,
        total: 0,
        current: 0,
        lastViewAt: null,
      },
    });
  });

  it('should return the user streaks when last view is null', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
  });

  const expectStreak = async (
    currentStreak: number,
    expectedCurrentStreak: number,
    lastViewAt: Date,
  ) => {
    const repo = con.getRepository(UserStreak);
    await repo.update({ userId: loggedUser }, { currentStreak, lastViewAt });

    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();

    const streak = await repo.findOneBy({ userId: loggedUser });
    expect(streak.currentStreak).toEqual(expectedCurrentStreak);
  };

  it('should reset streak on Saturday when last read is Thursday', async () => {
    loggedUser = '1';
    const fakeToday = new Date(2024, 0, 6); // Saturday
    const lastViewAt = subDays(fakeToday, 2); // Thursday

    jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
    await expectStreak(5, 0, lastViewAt);
  });

  it('should reset streak on Sunday when last read is Thursday', async () => {
    loggedUser = '1';
    const fakeToday = new Date(2024, 0, 7); // Sunday
    const lastViewAt = subDays(fakeToday, 3); // Thursday

    jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
    await expectStreak(5, 0, lastViewAt);
  });

  it('should not reset streak on Saturday when last read is Friday', async () => {
    loggedUser = '1';
    const fakeToday = new Date(2024, 0, 6); // Saturday
    const lastViewAt = subDays(fakeToday, 1); // Friday

    jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
    await expectStreak(5, 5, lastViewAt);
  });

  it('should not reset streak on Sunday when last read is Friday', async () => {
    loggedUser = '1';
    const fakeToday = new Date(2024, 0, 7); // Sunday
    const lastViewAt = subDays(fakeToday, 2); // Friday

    jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
    await expectStreak(5, 5, lastViewAt);
  });

  it('should reset streak on Monday when last read was Thursday', async () => {
    loggedUser = '1';
    const fakeToday = new Date(2024, 0, 8); // Monday
    const lastViewAt = subDays(fakeToday, 4); // Thursday

    jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
    await expectStreak(5, 0, lastViewAt);
  });

  it('should not reset streak on Monday when last read was Friday', async () => {
    loggedUser = '1';
    const fakeToday = new Date(2024, 0, 8); // Monday
    const lastViewAt = subDays(fakeToday, 3); // Friday

    jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
    await expectStreak(5, 5, lastViewAt);
  });

  it('should reset streak on Tuesday when last read was Friday', async () => {
    loggedUser = '1';
    const fakeToday = new Date(2024, 0, 9); // Tuesday
    const lastViewAt = subDays(fakeToday, 4); // Friday

    jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
    await expectStreak(5, 0, lastViewAt);
  });

  it('should not reset streak on Tuesday when last read was Monday', async () => {
    loggedUser = '1';
    const fakeToday = new Date(2024, 0, 9); // Tuesday
    const lastViewAt = subDays(fakeToday, 1); // Monday

    jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
    await expectStreak(5, 5, lastViewAt);
  });

  it('should not reset streak if last view is the same day today', async () => {
    loggedUser = '1';
    const fakeToday = new Date(2024, 0, 9); // Tuesday
    const lastViewAt = subDays(fakeToday, 0); // Tuesday

    jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
    await expectStreak(5, 5, lastViewAt);
  });

  it('should reset streak when considering user timezone', async () => {
    loggedUser = '1';
    const tz = 'America/Tijuana';
    await con.getRepository(User).update({ id: loggedUser }, { timezone: tz });
    const fakeToday = new Date(2024, 0, 6); // Saturday
    const fakeTodayTz = addHours(fakeToday, 12); // To ensure UTC offset would not make today as Friday
    const lastViewAt = subDays(fakeToday, 1); // Friday on UTC - but on user's timezone, this is still Thursday
    // No reset should happen if we are not considering timezone
    // but here, it should reset

    jest.useFakeTimers({ advanceTimers: true, now: fakeTodayTz });
    await expectStreak(5, 0, lastViewAt);
  });

  it('should not reset streak when considering user timezone', async () => {
    loggedUser = '1';
    const tz = 'Asia/Manila';
    await con.getRepository(User).update({ id: loggedUser }, { timezone: tz });
    const fakeToday = new Date(2024, 0, 6); // Saturday
    const fakeTodayTz = addHours(fakeToday, 12); // To ensure UTC offset would not make today as Friday
    const lastViewAt = subDays(fakeToday, 2); // Thursday
    const lastViewAtTz = addHours(lastViewAt, 22); // by UTC time, this should still be Thursday
    // Reset should happen if we are not considering timezone
    // but here, it should not reset since from that time in Asia/Manila, it is already Friday

    jest.useFakeTimers({ advanceTimers: true, now: fakeTodayTz });
    await expectStreak(5, 5, lastViewAtTz);
  });
});

describe('query referredUsers', () => {
  const QUERY = `query ReferredUsers {
    referredUsers {
      edges {
        node {
          id
          name
          username
          bio
          image
        }
      }
    }
  }`;

  it('should not allow unauthenticated users', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should return users that have been referred by the logged in user', async () => {
    loggedUser = '1';
    const referred = ['4', '2', '3'];
    const outsideReferred = ['1', '5', '6'];
    await con
      .getRepository(User)
      .update({ id: In(referred) }, { referralId: '1' });
    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    const isAllReferred = res.data.referredUsers.edges.every(({ node }) =>
      referred.includes(node.id),
    );
    expect(isAllReferred).toBeTruthy();
    const noUnReferred = res.data.referredUsers.edges.every(
      ({ node }) => !outsideReferred.includes(node.id),
    );
    expect(noUnReferred).toBeTruthy();
  });
});

describe('query userMostReadTags', () => {
  const QUERY = `query UserMostReadTags($id: ID!, $limit: Int){
    userMostReadTags(id: $id, limit: $limit) {
      value
      count
      total
      percentage
    }
  }`;

  it('should return the user most read tags', async () => {
    loggedUser = '1';
    const now = new Date();
    await con
      .getRepository(Keyword)
      .save([...keywordsFixture, ...additionalKeywords]);
    await con.getRepository(PostKeyword).save(postKeywordFixtures);
    await con.getRepository(View).save([
      { userId: loggedUser, timestamp: subDays(now, 1), postId: 'p1' },
      { userId: loggedUser, timestamp: subDays(now, 2), postId: 'p2' },
      { userId: loggedUser, timestamp: subDays(now, 3), postId: 'p3' },
      { userId: loggedUser, timestamp: subDays(now, 4), postId: 'p4' },
      { userId: loggedUser, timestamp: subDays(now, 5), postId: 'p5' },
      { userId: loggedUser, timestamp: subDays(now, 6), postId: 'p6' },
      { userId: loggedUser, timestamp: subDays(now, 7), postId: 'p1' },
    ]);
    const res = await client.query(QUERY, { variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userMostReadTags.length).toEqual(5);
    expect(res.data.userMostReadTags).toMatchSnapshot();

    const limit = 8;
    const limited = await client.query(QUERY, {
      variables: { id: '1', limit },
    });
    expect(limited.errors).toBeFalsy();
    expect(limited.data.userMostReadTags.length).toEqual(limit);
    expect(limited.data.userMostReadTags).toMatchSnapshot();
  });
});

describe('query user', () => {
  const QUERY = `query User($id: ID!) {
    user(id: $id) {
      name
      username
      image
    }
  }`;

  it('should return user info with name, username, and image', async () => {
    const requestUserId = '1';
    const res = await client.query(QUERY, { variables: { id: requestUserId } });
    expect(res.errors).toBeFalsy();
    expect(res.data.user).toMatchSnapshot();
  });
});

describe('query userReadingRank', () => {
  const QUERY = `query UserReadingRank($id: ID!, $version: Int, $limit: Int){
    userReadingRank(id: $id, version: $version, limit: $limit) {
      rankThisWeek
      rankLastWeek
      currentRank
      progressThisWeek
      readToday
      lastReadTime
      tags {
        tag
        readingDays
        percentage
      }
    }
  }`;

  const now = new Date();
  const thisWeekStart = startOfISOWeek(now);
  const lastWeekStart = startOfISOWeek(subDays(now, 7));
  const dayStart = startOfDay(now);

  it('should return partially null result when the user asks for someone else', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY, { variables: { id: '2' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRank).toMatchSnapshot();
  });

  it('should return the reading rank', async () => {
    loggedUser = '1';
    await con
      .getRepository(Keyword)
      .save([...keywordsFixture, ...additionalKeywords]);
    await con.getRepository(PostKeyword).save(postKeywordFixtures);
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
        postId: 'p1',
        timestamp: addDays(thisWeekStart, 1),
      },
      {
        userId: loggedUser,
        postId: 'p2',
        timestamp: addDays(thisWeekStart, 2),
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: addDays(thisWeekStart, 3),
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
    const res = await client.query(QUERY, { variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    const { rankThisWeek, progressThisWeek } = res.data.userReadingRank;
    expect(rankThisWeek).not.toEqual(progressThisWeek);
    expect(res.data.userReadingRank).toMatchSnapshot({
      readToday: expect.anything(),
      lastReadTime: expect.anything(),
    });
  });

  it('should return the reading rank with tags and accurate current rank on version 2', async () => {
    loggedUser = '1';
    await con
      .getRepository(Keyword)
      .save([...keywordsFixture, ...additionalKeywords]);
    await con.getRepository(PostKeyword).save(postKeywordFixtures);
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
        postId: 'p1',
        timestamp: addDays(thisWeekStart, 1),
      },
      {
        userId: loggedUser,
        postId: 'p2',
        timestamp: addDays(thisWeekStart, 2),
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: addDays(thisWeekStart, 3),
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
    const res = await client.query(QUERY, {
      variables: { id: '1', version: 2, limit: 8 },
    });
    expect(res.errors).toBeFalsy();
    const { tags } = res.data.userReadingRank;
    expect(tags.length).toEqual(8);
    const sum = tags.reduce((total, { readingDays }) => total + readingDays, 0);
    expect(sum).toEqual(12);
    const { rankThisWeek, progressThisWeek } = res.data.userReadingRank;
    expect(rankThisWeek).toEqual(progressThisWeek);

    const limited = await client.query(QUERY, {
      variables: { id: '1', version: 2, limit: 6 },
    });
    expect(limited.errors).toBeFalsy();
    const { tags: limitedTags } = limited.data.userReadingRank;
    expect(limitedTags.length).toEqual(6);
    const limitedSum = limitedTags.reduce(
      (total, { readingDays }) => total + readingDays,
      0,
    );
    expect(limitedSum).toEqual(10);
  });

  it('should return the last read time accurately', async () => {
    loggedUser = '1';
    const createdAtNew = new Date('2021-09-22T07:15:51.247Z');
    const createdAtNewer = new Date('2021-10-22T07:15:51.247Z');
    await con.getRepository(View).save([
      {
        userId: loggedUser,
        postId: 'p1',
        timestamp: createdAtNewer,
      },
      {
        userId: loggedUser,
        postId: 'p2',
        timestamp: createdAtNew,
      },
    ]);
    const res = await client.query(QUERY, { variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRank).toMatchSnapshot({
      readToday: expect.anything(),
    });
    expect(res.data.userReadingRank.lastReadTime).toEqual(
      createdAtNewer.toISOString(),
    );
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
    const res = await client.query(QUERY, { variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRank.currentRank).toEqual(1);
  });

  it('should test the supported timezone change results', async () => {
    loggedUser = '2';
    const lastWeekStartTimezoned = subDays(
      getTimezonedStartOfISOWeek({ date: now, timezone: userTimezone }),
      7,
    );
    await con.getRepository(View).save([
      {
        userId: loggedUser,
        postId: 'p1',
        timestamp: lastWeekStartTimezoned,
      },
      {
        userId: loggedUser,
        postId: 'p2',
        timestamp: addDays(lastWeekStartTimezoned, 2),
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: addDays(lastWeekStartTimezoned, 3),
      },
    ]);

    const res = await client.query(QUERY, {
      variables: { id: loggedUser, version: 2 },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRank.currentRank).toEqual(3);
  });

  it('should not return 8 reading days for a timezone edge case', async () => {
    loggedUser = '2';
    const lastWeekStartTimezoned = subDays(
      getTimezonedStartOfISOWeek({ date: now, timezone: userTimezone }),
      7,
    );
    await con.getRepository(View).save([
      {
        userId: loggedUser,
        postId: 'p1',
        timestamp: subHours(lastWeekStartTimezoned, 8),
      },
      {
        userId: loggedUser,
        postId: 'p1',
        timestamp: addHours(lastWeekStartTimezoned, 4),
      },
      {
        userId: loggedUser,
        postId: 'p2',
        timestamp: addDays(lastWeekStartTimezoned, 1),
      },
      {
        userId: loggedUser,
        postId: 'p2',
        timestamp: addDays(lastWeekStartTimezoned, 2),
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: addDays(lastWeekStartTimezoned, 3),
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: addDays(lastWeekStartTimezoned, 4),
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: addDays(lastWeekStartTimezoned, 5),
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: addDays(lastWeekStartTimezoned, 6),
      },
      {
        userId: loggedUser,
        postId: 'p3',
        timestamp: addDays(lastWeekStartTimezoned, 7),
      },
    ]);
    const res = await client.query(QUERY, {
      variables: { id: loggedUser, version: 2 },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRank.rankLastWeek).toEqual(7);
  });

  it('should set readToday to true', async () => {
    loggedUser = '1';
    await con
      .getRepository(View)
      .save([{ userId: loggedUser, postId: 'p4', timestamp: dayStart }]);
    const res = await client.query(QUERY, { variables: { id: '1' } });
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
    const res = await client.query(QUERY, { variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRank.progressThisWeek).toEqual(1);
  });
});

describe('query userReadingRankHistory', () => {
  const QUERY = `query UserReadingRankHistory($id: ID!, $after: String!, $before: String!, $version: Int){
    userReadingRankHistory(id: $id, after: $after, before: $before, version: $version) {
      rank
      count
    }
  }`;

  const now = new Date();
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
    const res = await client.query(QUERY, {
      variables: {
        id: '1',
        after: lastThreeWeeksStart.toISOString(),
        before: now.toISOString(),
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRankHistory).toMatchSnapshot();
  });

  it('should return the reading rank history utilizing timezone', async () => {
    const thisWeekStartTimezoned = getTimezonedStartOfISOWeek({
      date: now,
      timezone: userTimezone,
    });
    const lastWeekStartTimezoned = startOfISOWeek(
      subDays(thisWeekStartTimezoned, 7),
    );
    const lastTwoWeeksStartTimezoned = startOfISOWeek(
      subDays(thisWeekStartTimezoned, 14),
    );
    const lastThreeWeeksStartTimezoned = startOfISOWeek(
      subDays(thisWeekStartTimezoned, 21),
    );

    const loggedUserTimezonded = '2';
    await con.getRepository(View).save([
      {
        userId: loggedUserTimezonded,
        postId: 'p1',
        timestamp: lastThreeWeeksStartTimezoned,
      },
      {
        userId: loggedUserTimezonded,
        postId: 'p2',
        timestamp: lastTwoWeeksStartTimezoned,
      },
      {
        userId: loggedUserTimezonded,
        postId: 'p3',
        timestamp: addDays(lastTwoWeeksStartTimezoned, 1),
      },
      {
        userId: loggedUserTimezonded,
        postId: 'p4',
        timestamp: addDays(lastTwoWeeksStartTimezoned, 2),
      },
      {
        userId: loggedUserTimezonded,
        postId: 'p5',
        timestamp: addDays(lastWeekStartTimezoned, 3),
      },
      {
        userId: loggedUserTimezonded,
        postId: 'p6',
        timestamp: addDays(lastWeekStartTimezoned, 4),
      },
      {
        userId: loggedUserTimezonded,
        postId: 'p7',
        timestamp: addDays(lastWeekStartTimezoned, 5),
      },
    ]);
    const res = await client.query(QUERY, {
      variables: {
        id: loggedUserTimezonded,
        after: lastThreeWeeksStartTimezoned.toISOString(),
        before: now.toISOString(),
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRankHistory).toMatchSnapshot();
  });

  it('should return the reading rank history v2 utilizing timezone', async () => {
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
    const res = await client.query(QUERY, {
      variables: {
        id: '1',
        after: lastThreeWeeksStart.toISOString(),
        before: now.toISOString(),
        version: 2,
      },
    });
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
    const res = await client.query(QUERY, {
      variables: {
        id: '1',
        after: lastThreeWeeksStart.toISOString(),
        before: now.toISOString(),
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadingRankHistory).toMatchSnapshot();
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
    const res = await client.query(QUERY, {
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
    const thisWeekStartTimezoned = getTimezonedStartOfISOWeek({
      date: thisWeekStart,
      timezone: userTimezone,
    });
    await con.getRepository(View).save([
      {
        userId: loggedUser,
        postId: 'p1',
        timestamp: subHours(thisWeekStart, 5),
      },
      {
        userId: loggedUserTimezonded,
        postId: 'p1',
        timestamp: subHours(thisWeekStartTimezoned, 5),
      },
    ]);
    const res = await client.query(QUERY, {
      variables: {
        id: '1',
        after: lastThreeWeeksStart.toISOString(),
        before: now.toISOString(),
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.userReadHistory).toMatchSnapshot();
    expect(res.data.userReadHistory[0].date).toBe('2021-04-25');

    const resPacific = await client.query(QUERY, {
      variables: {
        id: loggedUserTimezonded,
        after: lastThreeWeeksStart.toISOString(),
        before: now.toISOString(),
      },
    });
    expect(resPacific.errors).toBeFalsy();
    expect(resPacific.data.userReadHistory[0].date).toBe('2021-04-25');
  });
});

describe('query public readHistory', () => {
  const QUERY = `
    query ReadHistory($after: String, $first: Int) {
      readHistory(first: $first, after: $after, isPublic: true) {
        pageInfo { endCursor, hasNextPage }
        edges {
          node {
            timestamp
            timestampDb
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

  it("should return user's reading history without private posts", async () => {
    loggedUser = '1';
    const createdAtOld = new Date('2020-09-22T07:15:51.247Z');
    const createdAtNew = new Date('2021-09-22T07:15:51.247Z');
    await saveFixtures(con, View, [
      {
        userId: '1',
        postId: 'pp',
        timestamp: createdAtOld,
      },
      {
        userId: '1',
        postId: 'p2',
        timestamp: createdAtNew,
      },
    ]);

    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data.readHistory.edges.length).toEqual(1);
    expect(res.data.readHistory.edges[0].node.post.id).toEqual('p2');
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
            timestampDb
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
    const res = await client.query(QUERY);
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
    const res = await client.query(QUERY);
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

    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data.readHistory.edges.length).toEqual(1);
    expect(res.data).toMatchSnapshot();
  });

  it("should return user's reading history without the deleted posts", async () => {
    loggedUser = '1';
    const createdAtOld = new Date('2020-09-22T07:15:51.247Z');
    const createdAtNew = new Date('2021-09-22T07:15:51.247Z');
    await saveFixtures(con, View, [
      {
        userId: '1',
        postId: 'pd',
        timestamp: createdAtOld,
      },
      {
        userId: '1',
        postId: 'p2',
        timestamp: createdAtNew,
      },
    ]);

    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data.readHistory.edges.length).toEqual(1);
    expect(res.data.readHistory.edges[0].node.post.id).toEqual('p2');
  });

  it("should return user's reading history with the banned posts", async () => {
    loggedUser = '1';
    const createdAtOld = new Date('2020-09-22T07:15:51.247Z');
    const createdAtNew = new Date('2021-09-22T07:15:51.247Z');
    await saveFixtures(con, View, [
      {
        userId: '1',
        postId: 'pb',
        timestamp: createdAtOld,
      },
      {
        userId: '1',
        postId: 'p2',
        timestamp: createdAtNew,
      },
    ]);

    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data.readHistory.edges.length).toEqual(2);
    expect(res.data.readHistory.edges[1].node.post.id).toEqual('pb');
  });

  it('should return the same date for a non-timezoned user', async () => {
    loggedUser = '1';
    const createdAt = new Date('2020-09-22T07:15:51.247Z');
    await saveFixtures(con, View, [
      {
        userId: loggedUser,
        postId: 'p1',
        timestamp: createdAt,
      },
    ]);
    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.readHistory.edges.length).toEqual(1);
    expect(res.data.readHistory.edges[0].node.timestamp).toBe(
      res.data.readHistory.edges[0].node.timestampDb,
    );
    expect(res.data).toMatchSnapshot();
  });

  it('should return two different dates for a timezoned user', async () => {
    loggedUser = '2';
    const createdAt = new Date('2020-09-22T07:15:51.247Z');
    await saveFixtures(con, View, [
      {
        userId: loggedUser,
        postId: 'p1',
        timestamp: createdAt,
      },
    ]);
    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.readHistory.edges.length).toEqual(1);
    expect(res.data.readHistory.edges[0].node.timestamp).not.toBe(
      res.data.readHistory.edges[0].node.timestampDb,
    );
    expect(res.data).toMatchSnapshot();
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

    const res = await client.mutate(MUTATION, {
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

    const res = await client.mutate(MUTATION, {
      variables: {
        postId: 'p1',
        timestamp: createdAtDifferentMS.toISOString(),
      },
    });

    expect(res.errors).toBeFalsy();
    expect(await repo.find()).toMatchSnapshot();
  });
});

describe('query searchReadingHistorySuggestions', () => {
  const QUERY = (query: string): string => `{
    searchReadingHistorySuggestions(query: "${query}") {
      query
      hits {
        title
      }
    }
  }
`;

  it('should return reading history search suggestions', async () => {
    loggedUser = '1';
    await con.getRepository(View).save([
      { userId: loggedUser, timestamp: subDays(now, 1), postId: 'p1' },
      { userId: loggedUser, timestamp: subDays(now, 2), postId: 'p2' },
      { userId: loggedUser, timestamp: subDays(now, 3), postId: 'p3' },
      { userId: loggedUser, timestamp: subDays(now, 4), postId: 'p4' },
      { userId: loggedUser, timestamp: subDays(now, 5), postId: 'p5' },
      { userId: loggedUser, timestamp: subDays(now, 6), postId: 'p6' },
      { userId: loggedUser, timestamp: subDays(now, 7), postId: 'p1' },
    ]);
    const res = await client.query(QUERY('p1'));
    expect(res.data).toMatchSnapshot();
  });
});

describe('query search reading history', () => {
  const QUERY = `
  query SearchReadingHistory($query: String!, $after: String, $first: Int) {
    readHistory: searchReadingHistory(query: $query, first: $first, after: $after) {
      pageInfo { hasNextPage }
      edges {
        node {
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

  it('should return reading history search feed', async () => {
    loggedUser = '1';
    await con.getRepository(View).save([
      { userId: loggedUser, timestamp: subDays(now, 1), postId: 'p1' },
      { userId: loggedUser, timestamp: subDays(now, 2), postId: 'p2' },
      { userId: loggedUser, timestamp: subDays(now, 3), postId: 'p3' },
      { userId: loggedUser, timestamp: subDays(now, 4), postId: 'p4' },
      { userId: loggedUser, timestamp: subDays(now, 5), postId: 'p5' },
      { userId: loggedUser, timestamp: subDays(now, 6), postId: 'p6' },
      { userId: loggedUser, timestamp: subDays(now, 7), postId: 'p1' },
    ]);
    const res = await client.query(QUERY, { variables: { query: 'p1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should return reading history search empty feed', async () => {
    loggedUser = '1';
    await con.getRepository(View).save([
      { userId: loggedUser, timestamp: subDays(now, 1), postId: 'p1' },
      { userId: loggedUser, timestamp: subDays(now, 2), postId: 'p2' },
      { userId: loggedUser, timestamp: subDays(now, 3), postId: 'p3' },
      { userId: loggedUser, timestamp: subDays(now, 4), postId: 'p4' },
      { userId: loggedUser, timestamp: subDays(now, 5), postId: 'p5' },
      { userId: loggedUser, timestamp: subDays(now, 6), postId: 'p6' },
      { userId: loggedUser, timestamp: subDays(now, 7), postId: 'p1' },
    ]);
    const res = await client.query(QUERY, {
      variables: { query: 'NOT FOUND' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('mutation updateUserProfile', () => {
  const MUTATION = `
    mutation updateUserProfile($data: UpdateUserInput!) {
      updateUserProfile(data: $data) {
        id
        name
        image
        username
        permalink
        bio
        twitter
        github
        hashnode
        createdAt
        infoConfirmed
        notificationEmail
        timezone
        experienceLevel
      }
    }
  `;

  it('should not authorize when not logged in', async () =>
    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { data: { username: 'Test' } } },
      'UNAUTHENTICATED',
    ));

  it('should not allow duplicated github', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { data: { github: 'lee' } } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should not allow duplicated twitter', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { data: { twitter: 'lee' } } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should not allow duplicated hashnode', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { data: { hashnode: 'lee' } } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should not allow duplicated username', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { data: { username: 'lee' } } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should not allow empty username', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { data: { username: null } } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should not allow duplicated username with different case', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { data: { username: 'Lee' } } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should not allow disallowed username', async () => {
    loggedUser = '1';

    await con.getRepository(DisallowHandle).save({ value: 'disallow' });

    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { data: { username: 'disallow' } } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should not allow invalid github handle', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { data: { github: '#a1' } } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should not allow invalid twitter handle', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { data: { twitter: '#a1' } } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should not allow invalid hashnode handle', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { data: { hashnode: '#a1' } } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should not allow invalid username handle', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { data: { username: '#a1' } } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should update user profile', async () => {
    loggedUser = '1';

    const repo = con.getRepository(User);
    const user = await repo.findOneBy({ id: loggedUser });
    const timezone = 'Asia/Manila';
    const res = await client.mutate(MUTATION, {
      variables: { data: { timezone, username: 'aaa1', name: 'Ido' } },
    });

    expect(res.errors?.length).toBeFalsy();
    const updatedUser = await repo.findOneBy({ id: loggedUser });
    expect(updatedUser?.timezone).not.toEqual(user?.timezone);
    expect(updatedUser?.timezone).toEqual(timezone);
    expect(res.data.updateUserProfile).toMatchSnapshot({
      createdAt: expect.any(String),
    });
  });

  it('should update user profile and set info confirmed', async () => {
    loggedUser = '1';

    const repo = con.getRepository(User);
    await repo.update({ id: loggedUser }, { email: 'sample@daily.dev' });
    const user = await repo.findOneBy({ id: loggedUser });
    const username = 'aaa1';
    expect(user?.infoConfirmed).toBeFalsy();
    const res = await client.mutate(MUTATION, {
      variables: { data: { username, name: user.name } },
    });
    expect(res.errors?.length).toBeFalsy();
    const updatedUser = await repo.findOneBy({ id: loggedUser });
    expect(updatedUser?.infoConfirmed).toBeTruthy();
  });

  it('should update user profile and change email', async () => {
    loggedUser = '1';

    const repo = con.getRepository(User);
    const user = await repo.findOneBy({ id: loggedUser });

    const email = 'sample@daily.dev';
    expect(user?.infoConfirmed).toBeFalsy();
    const res = await client.mutate(MUTATION, {
      variables: { data: { email, username: 'uuu1', name: user.name } },
    });
    expect(res.errors?.length).toBeFalsy();
    const updatedUser = await repo.findOneBy({ id: loggedUser });
    expect(updatedUser?.email).toEqual(email);
  });

  it('should update user profile and change experience level', async () => {
    loggedUser = '1';

    const repo = con.getRepository(User);
    const user = await repo.findOneBy({ id: loggedUser });

    const experienceLevel = 'foo';
    expect(user?.experienceLevel).toBeNull();
    const res = await client.mutate(MUTATION, {
      variables: {
        data: { experienceLevel, username: 'uuu1', name: user.name },
      },
    });
    expect(res.errors?.length).toBeFalsy();
    const updatedUser = await repo.findOneBy({ id: loggedUser });
    expect(updatedUser?.experienceLevel).toEqual(experienceLevel);
  });

  it('should update notification email preference', async () => {
    loggedUser = '1';

    const repo = con.getRepository(User);
    const user = await repo.findOneBy({ id: loggedUser });
    expect(user?.notificationEmail).toBeTruthy();
    const notificationEmail = false;
    const res = await client.mutate(MUTATION, {
      variables: {
        data: { username: 'sample', name: 'test', notificationEmail },
      },
    });
    expect(res.errors).toBeFalsy();
    const updatedUser = await repo.findOneBy({ id: loggedUser });
    expect(updatedUser?.notificationEmail).toEqual(notificationEmail);
  });

  it('should not update if username is empty', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { data: { name: 'Ido' } } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should not update if name is empty', async () => {
    loggedUser = '1';
    await con.getRepository(User).update({ id: loggedUser }, { name: null });

    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { data: { username: 'u1' } } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should update if name is already set but not provided', async () => {
    loggedUser = '1';
    await con
      .getRepository(User)
      .update({ id: loggedUser }, { username: 'handle' });
    const res = await client.mutate(MUTATION, {
      variables: {
        data: { acceptedMarketing: true },
      },
    });
    expect(res.errors).toBeFalsy();
  });

  it('should not update user profile if email exists', async () => {
    loggedUser = '1';

    const repo = con.getRepository(User);
    const email = 'sample@daily.dev';
    await repo.update({ id: '2' }, { email });

    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { data: { email } } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });
});

describe('mutation deleteUser', () => {
  const MUTATION = `
    mutation deleteUser {
      deleteUser {
        _
      }
    }
  `;

  it('should not authorize when not logged in', async () =>
    await testMutationErrorCode(
      client,
      { mutation: MUTATION },
      'UNAUTHENTICATED',
    ));

  it('should delete user from database', async () => {
    loggedUser = '1';

    await con.getRepository(User).save([
      {
        id: '404',
        name: 'Not found',
        image: 'https://daily.dev/404.jpg',
        timezone: 'utc',
        createdAt: new Date(),
      },
    ]);

    await client.mutate(MUTATION);

    const users = await con.getRepository(User).find();
    expect(users.length).toEqual(3);

    const userOne = await con.getRepository(User).findOneBy({ id: '1' });
    expect(userOne).toEqual(null);
  });

  it('should delete author ID from post', async () => {
    loggedUser = '1';

    await con.getRepository(User).save([
      {
        id: '404',
        name: 'Not found',
        image: 'https://daily.dev/404.jpg',
        timezone: 'utc',
        createdAt: new Date(),
      },
    ]);

    await client.mutate(MUTATION);

    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post.authorId).toEqual(null);
  });

  it('should delete scout ID from post', async () => {
    loggedUser = '1';

    await con.getRepository(User).save([
      {
        id: '404',
        name: 'Not found',
        image: 'https://daily.dev/404.jpg',
        timezone: 'utc',
        createdAt: new Date(),
      },
    ]);

    await client.mutate(MUTATION);

    const post = await con.getRepository(Post).findOneBy({ id: 'p6' });
    expect(post.authorId).toEqual(null);
  });
});

describe('POST /v1/users/logout', () => {
  const BASE_PATH = '/v1/users/logout';

  it('should logout and clear cookies', async () => {
    mockLogout();
    const res = await authorizeRequest(request(app.server).post(BASE_PATH))
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'da3=1;da2=1')
      .expect(204);

    const cookies = setCookieParser.parse(res, { map: true });
    expect(cookies['da2'].value).toBeTruthy();
    expect(cookies['da2'].value).not.toEqual('1');
    expect(cookies['da3'].value).toBeFalsy();
  });
});

describe('DELETE /v1/users/me', () => {
  const BASE_PATH = '/v1/users/me';

  beforeEach(async () => {
    await con.getRepository(User).save([
      {
        id: '404',
        name: 'Not found',
        image: 'https://daily.dev/404.jpg',
        timezone: 'utc',
        createdAt: new Date(),
      },
    ]);
  });

  it('should not authorize when not logged in', async () => {
    await request(app.server).delete(BASE_PATH).expect(401);
  });

  it('should delete user from database', async () => {
    mockLogout();
    await authorizeRequest(request(app.server).delete(BASE_PATH)).expect(204);

    const users = await con.getRepository(User).find();
    expect(users.length).toEqual(3);

    const userOne = await con.getRepository(User).findOneBy({ id: '1' });
    expect(userOne).toEqual(null);
  });

  it('should clear cookies', async () => {
    mockLogout();
    const res = await authorizeRequest(request(app.server).delete(BASE_PATH))
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'da3=1;da2=1')
      .expect(204);

    const cookies = setCookieParser.parse(res, { map: true });
    expect(cookies['da2'].value).toBeTruthy();
    expect(cookies['da2'].value).not.toEqual('1');
    expect(cookies['da3'].value).toBeFalsy();
  });

  it('clears invitedBy from associated features', async () => {
    await con.getRepository(Feature).insert({
      feature: FeatureType.Search,
      userId: '2',
      value: FeatureValue.Allow,
      invitedById: '1',
    });

    mockLogout();
    await authorizeRequest(request(app.server).delete(BASE_PATH)).expect(204);

    const feature = await con.getRepository(Feature).findOneBy({ userId: '2' });
    expect(feature.invitedById).toBeNull();
  });

  it('removes associated invite records', async () => {
    await con.getRepository(Invite).insert({
      userId: '1',
      campaign: CampaignType.Search,
    });

    mockLogout();
    await authorizeRequest(request(app.server).delete(BASE_PATH)).expect(204);

    expect(await con.getRepository(Invite).count()).toEqual(0);
  });
});

describe('query generateUniqueUsername', () => {
  const QUERY = `
    query GenerateUniqueUsername($name: String!) {
      generateUniqueUsername(name: $name)
  }`;

  it('should return a unique username', async () => {
    const res = await client.query(QUERY, { variables: { name: 'John Doe' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.generateUniqueUsername).toEqual('johndoe');
  });

  it('should return a unique username with a random string', async () => {
    await con.getRepository(User).update({ id: '1' }, { username: 'johndoe' });

    const res = await client.query(QUERY, { variables: { name: 'John Doe' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.generateUniqueUsername).not.toEqual('johndoe');
  });

  it('should return a unique username with a random string if disallowed', async () => {
    await con.getRepository(DisallowHandle).save({ value: 'johndoe' });

    const res = await client.query(QUERY, { variables: { name: 'John Doe' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.generateUniqueUsername).not.toEqual('johndoe');
  });
});

describe('query referralCampaign', () => {
  const QUERY = `
    query ReferralCampaign($referralOrigin: String!) {
      referralCampaign(referralOrigin: $referralOrigin) {
        referredUsersCount
        referralCountLimit
        referralToken
        url
      }
  }`;

  beforeEach(async () => {
    await con.getRepository(Invite).save({
      userId: '1',
      campaign: CampaignType.Search,
      limit: 5,
      count: 1,
      token: 'd688afeb-381c-43b5-89af-533f81ccd036',
    });
  });

  it('should return campaign progress for user', async () => {
    loggedUser = '1';

    await con
      .getRepository(User)
      .update(
        { id: '2' },
        { referralId: '1', referralOrigin: 'knightcampaign' },
      );
    await con
      .getRepository(User)
      .update(
        { id: '3' },
        { referralId: '1', referralOrigin: 'knightcampaign' },
      );

    const res = await client.query(QUERY, {
      variables: { referralOrigin: 'knightcampaign' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.referralCampaign.referredUsersCount).toBe(2);
    expect(res.data.referralCampaign.url).toBe(
      `${process.env.COMMENTS_PREFIX}/join?cid=knightcampaign&userid=1`,
    );
  });

  it('should require authentication', async () => {
    await testQueryErrorCode(
      client,
      { query: QUERY, variables: { referralOrigin: 'knightcampaign' } },
      'UNAUTHENTICATED',
    );
  });

  describe('with an existing invite record for the user', () => {
    it('should include the campaign progress & token from the invite', async () => {
      loggedUser = '1';

      const res = await client.query(QUERY, {
        variables: { referralOrigin: 'search' },
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.referralCampaign.referredUsersCount).toBe(1);
      expect(res.data.referralCampaign.referralCountLimit).toBe(5);
      expect(res.data.referralCampaign.referralToken).toBe(
        'd688afeb-381c-43b5-89af-533f81ccd036',
      );
    });

    it('should include the invite token in the URL', async () => {
      loggedUser = '1';

      const res = await client.query(QUERY, {
        variables: { referralOrigin: 'search' },
      });

      expect(res.data.referralCampaign.url).toBe(
        `${process.env.COMMENTS_PREFIX}/join?cid=search&userid=1&ctoken=d688afeb-381c-43b5-89af-533f81ccd036`,
      );
    });
  });
});

describe('query personalizedDigest', () => {
  const QUERY = `
    query PersonalizedDigest {
      personalizedDigest {
        preferredDay
        preferredHour
      }
  }`;

  beforeEach(async () => {
    await con.getRepository(UserPersonalizedDigest).clear();
  });

  it('should require authentication', async () => {
    await testQueryErrorCode(
      client,
      { query: QUERY, variables: {} },
      'UNAUTHENTICATED',
    );
  });

  it('should throw not found exception when user is not subscribed', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { token: 'notfound' },
      },
      'NOT_FOUND',
    );
  });

  it('should return personalized digest settings for user', async () => {
    loggedUser = '1';

    await con.getRepository(UserPersonalizedDigest).save({
      userId: loggedUser,
    });

    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data.personalizedDigest).toMatchObject([
      {
        preferredDay: 1,
        preferredHour: 9,
      },
    ]);
  });

  describe('flags field', () => {
    const FLAGS_QUERY = `
    query PersonalizedDigest {
      personalizedDigest {
        type
        flags {
          sendType
        }
      }
  }`;

    beforeEach(async () => {
      loggedUser = '1';

      await con.getRepository(UserPersonalizedDigest).save({
        userId: loggedUser,
        type: UserPersonalizedDigestType.Digest,
      });
    });

    it('should return all the public flags', async () => {
      await con.getRepository(UserPersonalizedDigest).save({
        userId: loggedUser,
        type: UserPersonalizedDigestType.Digest,
        flags: {
          sendType: UserPersonalizedDigestSendType.workdays,
        },
      });

      const res = await client.query(FLAGS_QUERY);

      expect(res.errors).toBeFalsy();
      expect(res.data.personalizedDigest.length).toEqual(1);
      expect(res.data.personalizedDigest[0].flags).toEqual({
        sendType: UserPersonalizedDigestSendType.workdays,
      });
    });

    it('should contain all default values in db query', async () => {
      const res = await client.query(FLAGS_QUERY);

      expect(res.errors).toBeFalsy();
      expect(res.data.personalizedDigest.length).toEqual(1);
      expect(res.data.personalizedDigest[0].flags).toEqual({
        sendType: UserPersonalizedDigestSendType.weekly,
      });
    });
  });
});

describe('mutation subscribePersonalizedDigest', () => {
  const MUTATION = `mutation SubscribePersonalizedDigest($hour: Int, $day: Int, $type: DigestType) {
    subscribePersonalizedDigest(hour: $hour, day: $day, type: $type) {
      preferredDay
      preferredHour
    }
  }`;

  beforeEach(async () => {
    await con.getRepository(UserPersonalizedDigest).clear();
  });

  it('should require authentication', async () => {
    await testQueryErrorCode(
      client,
      {
        query: MUTATION,
        variables: {
          day: DayOfWeek.Monday,
          hour: 9,
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should throw validation error if day param is less then 0', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: MUTATION,
        variables: {
          day: -1,
          hour: 9,
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should throw validation error if day param is more then 6', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: MUTATION,
        variables: {
          day: 7,
          hour: 9,
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should throw validation error if day param is less then 0', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: MUTATION,
        variables: {
          day: DayOfWeek.Monday,
          hour: -1,
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should throw validation error if hour param is more then 23', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: MUTATION,
        variables: {
          day: DayOfWeek.Monday,
          hour: 24,
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should subscribe to personal digest for user with default settings', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {},
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.subscribePersonalizedDigest).toMatchObject({
      preferredDay: DayOfWeek.Monday,
      preferredHour: 9,
    });
  });

  it('should subscribe to personal digest for user with settings', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        day: DayOfWeek.Wednesday,
        hour: 17,
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.subscribePersonalizedDigest).toMatchObject({
      preferredDay: DayOfWeek.Wednesday,
      preferredHour: 17,
    });
  });

  it('should update settings for personal digest if already exists', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        day: DayOfWeek.Wednesday,
        hour: 17,
      },
    });
    expect(res.errors).toBeFalsy();

    const resUpdate = await client.mutate(MUTATION, {
      variables: {
        day: DayOfWeek.Friday,
        hour: 22,
      },
    });
    expect(resUpdate.errors).toBeFalsy();
    expect(resUpdate.data.subscribePersonalizedDigest).toMatchObject({
      preferredDay: DayOfWeek.Friday,
      preferredHour: 22,
    });
  });

  it('should subscribe to reading reminder', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        type: UserPersonalizedDigestType.ReadingReminder,
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.subscribePersonalizedDigest).toMatchObject({
      preferredDay: DayOfWeek.Monday,
      preferredHour: 9,
    });
    const digest = await con.getRepository(UserPersonalizedDigest).findOneBy({
      userId: loggedUser,
      type: UserPersonalizedDigestType.ReadingReminder,
    });
    expect(digest.flags).toEqual({
      sendType: UserPersonalizedDigestSendType.workdays,
    });
  });
});

describe('mutation unsubscribePersonalizedDigest', () => {
  const MUTATION = `mutation UnsubscribePersonalizedDigest {
    unsubscribePersonalizedDigest {
      _
    }
  }`;

  beforeEach(async () => {
    await con.getRepository(UserPersonalizedDigest).clear();
  });

  it('should require authentication', async () => {
    await testQueryErrorCode(
      client,
      {
        query: MUTATION,
      },
      'UNAUTHENTICATED',
    );
  });

  it('should unsubscribe from personal digest for user', async () => {
    loggedUser = '1';

    await con.getRepository(UserPersonalizedDigest).save({
      userId: loggedUser,
    });

    const res = await client.mutate(MUTATION);
    expect(res.errors).toBeFalsy();

    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: loggedUser,
      });
    expect(personalizedDigest).toBeNull();
  });

  it('should not throw error if not subscribed', async () => {
    loggedUser = '1';

    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: loggedUser,
      });
    expect(personalizedDigest).toBeNull();

    const res = await client.mutate(MUTATION);
    expect(res.errors).toBeFalsy();
  });
});

describe('mutation acceptFeatureInvite', () => {
  const MUTATION = `mutation AcceptFeatureInvite($token: String!, $referrerId: ID!, $feature: String!) {
    acceptFeatureInvite(token: $token, referrerId: $referrerId, feature: $feature) {
      _
    }
  }`;

  beforeEach(async () => {
    await con.getRepository(Invite).save({
      userId: '2',
      campaign: CampaignType.Search,
      limit: 5,
      count: 1,
      token: 'd688afeb-381c-43b5-89af-533f81ccd036',
    });
  });

  it('should require authentication', async () => {
    await testQueryErrorCode(
      client,
      {
        query: MUTATION,
        variables: {
          token: 'd688afeb-381c-43b5-89af-533f81ccd036',
          referrerId: 2,
          feature: CampaignType.Search,
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should return a 404 if the token and referrer mismatch', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: MUTATION,
        variables: {
          token: 'd688afeb-381c-43b5-89af-533f81ccd036',
          referrerId: 1,
          feature: CampaignType.Search,
        },
      },
      'NOT_FOUND',
    );
  });

  it('should raise a validation error if the invite limit has been reached', async () => {
    loggedUser = '1';

    await con
      .getRepository(Invite)
      .update(
        { token: 'd688afeb-381c-43b5-89af-533f81ccd036' },
        { limit: 5, count: 5 },
      );

    await testQueryError(
      client,
      {
        query: MUTATION,
        variables: {
          token: 'd688afeb-381c-43b5-89af-533f81ccd036',
          referrerId: 2,
          feature: CampaignType.Search,
        },
      },
      (errors) => {
        expect(errors[0].extensions.code).toEqual('GRAPHQL_VALIDATION_FAILED');
        expect(errors[0].message).toEqual('INVITE_LIMIT_REACHED');
      },
    );
  });

  it('should do nothing if the feature already exists', async () => {
    loggedUser = '1';

    await con.getRepository(Feature).save({
      feature: FeatureType.Search,
      userId: loggedUser,
      value: FeatureValue.Allow,
    });

    // pre-check
    const inviteBefore = await con
      .getRepository(Invite)
      .findOneBy({ token: 'd688afeb-381c-43b5-89af-533f81ccd036' });
    expect(inviteBefore.count).toEqual(1);

    const res = await client.mutate(MUTATION, {
      variables: {
        token: 'd688afeb-381c-43b5-89af-533f81ccd036',
        referrerId: '2',
        feature: CampaignType.Search,
      },
    });

    expect(res.errors).toBeFalsy();
    const inviteAfter = await con
      .getRepository(Invite)
      .findOneBy({ token: 'd688afeb-381c-43b5-89af-533f81ccd036' });
    expect(inviteAfter.count).toEqual(1);
  });

  it('should update the invite count for the referrer', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        token: 'd688afeb-381c-43b5-89af-533f81ccd036',
        referrerId: '2',
        feature: CampaignType.Search,
      },
    });

    expect(res.errors).toBeFalsy();
    const invite = await con
      .getRepository(Invite)
      .findOneBy({ token: 'd688afeb-381c-43b5-89af-533f81ccd036' });
    expect(invite.count).toEqual(2);
  });

  it('should create a feature and enable it for the referred', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        token: 'd688afeb-381c-43b5-89af-533f81ccd036',
        referrerId: '2',
        feature: CampaignType.Search,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(
      await con.getRepository(Feature).count({
        where: {
          userId: loggedUser,
          feature: FeatureType.Search,
        },
      }),
    ).toEqual(1);

    const feature = await con.getRepository(Feature).findOneBy({
      userId: loggedUser,
      feature: FeatureType.Search,
    });

    expect(feature.value).toEqual(FeatureValue.Allow);
    expect(feature.invitedById).toEqual('2');
  });

  it('should not enable the feature or increment invites count for the referred if it already exists', async () => {
    loggedUser = '1';

    await con.getRepository(Feature).save({
      userId: loggedUser,
      feature: FeatureType.Search,
      value: FeatureValue.Block,
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        token: 'd688afeb-381c-43b5-89af-533f81ccd036',
        referrerId: '2',
        feature: CampaignType.Search,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(
      await con.getRepository(Feature).count({
        where: {
          userId: loggedUser,
          feature: FeatureType.Search,
        },
      }),
    ).toEqual(1);

    const feature = await con.getRepository(Feature).findOneBy({
      userId: loggedUser,
      feature: FeatureType.Search,
    });

    expect(feature.value).toEqual(FeatureValue.Block);
    expect(feature.invitedById).toBeNull();

    const invite = await con
      .getRepository(Invite)
      .findOneBy({ token: 'd688afeb-381c-43b5-89af-533f81ccd036' });
    expect(invite.count).toEqual(1);
  });
});

describe('mutation updateReadme', () => {
  const MUTATION = `mutation UpdateReadme($content: String!) {
    updateReadme(content: $content) {
      readme
      readmeHtml
    }
  }`;

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { content: 'test' },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should update the readme and render markdown', async () => {
    loggedUser = '1';

    const expected = `Hello

**Readme!**`;
    const res = await client.mutate(MUTATION, {
      variables: { content: expected },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.updateReadme).toEqual({
      readme: expected,
      readmeHtml: '<p>Hello</p>\n<p><strong>Readme!</strong></p>\n',
    });
  });
});

describe('user_create_alerts_trigger after insert trigger', () => {
  it('should insert default alerts', async () => {
    await con.getRepository(User).delete({});
    const repo = con.getRepository(Alerts);
    await repo.delete({});
    const [user] = usersFixture;
    await saveFixtures(con, User, [user]);
    const alerts = await repo.findOneBy({ userId: user.id });
    expect(alerts).toBeTruthy();
  });
});

describe('addUserAcquisitionChannel mutation', () => {
  const MUTATION = `
    mutation AddUserAcquisitionChannel($acquisitionChannel: String!) {
      addUserAcquisitionChannel(acquisitionChannel: $acquisitionChannel) {
        _
      }
    }
  `;

  it('should not allow unauthenticated users', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { acquisitionChannel: 'friend' } },
      'UNAUTHENTICATED',
    ));

  it('should not throw an error when user is authenticated', async () => {
    loggedUser = '1';

    const user = await con.getRepository(User).findOneBy({ id: loggedUser });
    expect(user.acquisitionChannel).toBeNull();

    await client.mutate(MUTATION, {
      variables: { acquisitionChannel: 'friend' },
    });

    const updatedUser = await con
      .getRepository(User)
      .findOneBy({ id: loggedUser });
    expect(updatedUser.acquisitionChannel).toEqual('friend');
  });
});

describe('mutation clearUserMarketingCta', () => {
  const MUTATION = /* GraphQL */ `
    mutation ClearUserMarketingCta($campaignId: String!) {
      clearUserMarketingCta(campaignId: $campaignId) {
        _
      }
    }
  `;
  const redisKey1 = generateStorageKey(
    StorageTopic.Boot,
    StorageKey.MarketingCta,
    '1',
  );
  const redisKey2 = generateStorageKey(
    StorageTopic.Boot,
    StorageKey.MarketingCta,
    '2',
  );

  beforeEach(async () => {
    await con.getRepository(MarketingCta).save([
      {
        campaignId: 'worlds-best-campaign',
        variant: 'card',
        createdAt: new Date('2024-03-13 12:00:00'),
        flags: {
          title: 'Join the best community in the world',
          description: 'Join the best community in the world',
          ctaUrl: 'http://localhost:5002',
          ctaText: 'Join now',
        },
      },
      {
        campaignId: 'worlds-second-best-campaign',
        variant: 'card',
        createdAt: new Date('2024-03-13 13:00:00'),
        flags: {
          title: 'Join the second best community in the world',
          description: 'Join the second best community in the world',
          ctaUrl: 'http://localhost:5002',
          ctaText: 'Join now',
        },
      },
    ]);

    await con.getRepository(UserMarketingCta).save([
      {
        marketingCtaId: 'worlds-best-campaign',
        userId: '1',
        createdAt: new Date('2024-03-13 12:00:00'),
      },
      {
        marketingCtaId: 'worlds-best-campaign',
        userId: '2',
        createdAt: new Date('2024-03-13 12:00:00'),
      },
    ]);

    await deleteRedisKey(redisKey1);
    await deleteRedisKey(redisKey2);
  });

  it('should not allow unauthenticated users', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { campaignId: 'worlds-best-campaign' } },
      'UNAUTHENTICATED',
    ));

  it('should mark the user marketing cta as read', async () => {
    loggedUser = '1';

    expect(
      await con.getRepository(UserMarketingCta).findOneBy({
        userId: '1',
        marketingCtaId: 'worlds-best-campaign',
        readAt: IsNull(),
      }),
    ).toBeTruthy();

    await client.mutate(MUTATION, {
      variables: { campaignId: 'worlds-best-campaign' },
    });

    expect(
      await con.getRepository(UserMarketingCta).findOneBy({
        userId: '1',
        marketingCtaId: 'worlds-best-campaign',
        readAt: IsNull(),
      }),
    ).toBeFalsy();

    expect(await getRedisObject(redisKey1)).toEqual('SLEEPING');
  });

  it('should pre-load the next user marketing cta', async () => {
    loggedUser = '1';
    await con.getRepository(UserMarketingCta).save([
      {
        marketingCtaId: 'worlds-second-best-campaign',
        userId: '1',
        createdAt: new Date('2024-03-13 13:00:00'),
      },
    ]);

    await client.mutate(MUTATION, {
      variables: { campaignId: 'worlds-best-campaign' },
    });

    expect(
      JSON.parse((await getRedisObject(redisKey1)) as string),
    ).toMatchObject({
      campaignId: 'worlds-second-best-campaign',
      variant: 'card',
      createdAt: '2024-03-13T13:00:00.000Z',
      flags: {
        title: 'Join the second best community in the world',
        description: 'Join the second best community in the world',
        ctaUrl: 'http://localhost:5002',
        ctaText: 'Join now',
      },
    });
  });

  it('should not write to redis if there is no current marketing cta', async () => {
    loggedUser = '1';

    await con.getRepository(UserMarketingCta).update(
      {
        userId: '1',
        marketingCtaId: 'worlds-best-campaign',
        readAt: IsNull(),
      },
      { readAt: new Date() },
    );

    await client.mutate(MUTATION, {
      variables: { campaignId: 'worlds-best-campaign' },
    });

    expect(JSON.parse((await getRedisObject(redisKey1)) as string)).toBeNull();
  });

  it('should not update other users marketing cta', async () => {
    loggedUser = '1';

    await client.mutate(MUTATION, {
      variables: { campaignId: 'worlds-best-campaign' },
    });

    expect(
      await con.getRepository(UserMarketingCta).findOneBy({
        userId: '2',
        marketingCtaId: 'worlds-best-campaign',
        readAt: IsNull(),
      }),
    ).toBeTruthy();
  });

  it('should not update other marketing cta', async () => {
    loggedUser = '1';

    await con.getRepository(UserMarketingCta).save([
      {
        marketingCtaId: 'worlds-second-best-campaign',
        userId: '1',
        createdAt: new Date('2024-03-13 13:00:00'),
      },
    ]);

    await client.mutate(MUTATION, {
      variables: { campaignId: 'worlds-best-campaign' },
    });

    expect(
      await con.getRepository(UserMarketingCta).findOneBy({
        userId: '1',
        marketingCtaId: 'worlds-best-campaign',
        readAt: IsNull(),
      }),
    ).toBeFalsy();
    expect(
      await con.getRepository(UserMarketingCta).findOneBy({
        userId: '1',
        marketingCtaId: 'worlds-second-best-campaign',
        readAt: IsNull(),
      }),
    ).toBeTruthy();
  });
});

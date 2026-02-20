import nock from 'nock';
import { keywordsFixture } from './fixture/keywords';
import { Keyword } from './../src/entity/Keyword';
import { PostKeyword } from './../src/entity/PostKeyword';
import {
  addDays,
  addHours,
  addSeconds,
  addYears,
  format,
  startOfDay,
  startOfISOWeek,
  subDays,
  subHours,
  subMonths,
} from 'date-fns';
import {
  authorizeRequest,
  createMockNjordTransport,
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  TEST_UA,
  testMutationError,
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
  Feed,
  MarketingCta,
  Post,
  PostReport,
  Settings,
  Source,
  SourceMember,
  User,
  UserAction,
  UserActionType,
  UserMarketingCta,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserPersonalizedDigestType,
  UserPost,
  UserStats,
  UserStreak,
  UserStreakAction,
  UserStreakActionType,
  UserTopReader,
  View,
  PostType,
} from '../src/entity';
import { UserProfileAnalytics } from '../src/entity/user/UserProfileAnalytics';
import { UserProfileAnalyticsHistory } from '../src/entity/user/UserProfileAnalyticsHistory';
import { PostAnalyticsHistory } from '../src/entity/posts/PostAnalyticsHistory';
import { sourcesFixture } from './fixture/source';
import {
  CioTransactionalMessageTemplateId,
  DayOfWeek,
  encrypt,
  getTimezonedStartOfISOWeek,
  ghostUser,
  type GQLUserTopReader,
  portfolioLimit,
  sendEmail,
  systemUser,
  updateFlagsStatement,
  updateSubscriptionFlags,
  UploadPreset,
} from '../src/common';
import {
  blueskySchema,
  codepenSchema,
  githubSchema,
  linkedinSchema,
  mastodonSchema,
  portfolioSchema,
  redditSchema,
  roadmapSchema,
  stackoverflowSchema,
  threadsSchema,
  twitterSchema,
} from '../src/common/schema/socials';
import { DataSource, In, IsNull } from 'typeorm';
import createOrGetConnection from '../src/db';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import setCookieParser from 'set-cookie-parser';
import { DisallowHandle } from '../src/entity/DisallowHandle';
import { Invite, InviteCampaignType } from '../src/entity/Invite';
import { plusUsersFixture, usersFixture } from './fixture/user';
import {
  deleteKeysByPattern,
  deleteRedisKey,
  getRedisObject,
  ioRedisPool,
  setRedisObjectWithExpiry,
} from '../src/redis';
import {
  generateStorageKey,
  RESUME_BUCKET_NAME,
  StorageKey,
  StorageTopic,
} from '../src/config';
import {
  UserIntegration,
  UserIntegrationType,
} from '../src/entity/UserIntegration';
import { Company } from '../src/entity/Company';
import { UserCompany } from '../src/entity/UserCompany';
import { UserExperience } from '../src/entity/user/experiences/UserExperience';
import { UserExperienceType } from '../src/entity/user/experiences/types';
import { SourceReport } from '../src/entity/sources/SourceReport';
import { SourceMemberRoles } from '../src/roles';
import { rateLimiterName } from '../src/directive/rateLimit';
import { CommentReport } from '../src/entity/CommentReport';
import { getRestoreStreakCache } from '../src/workers/cdc/primary';
import { ContentPreferenceUser } from '../src/entity/contentPreference/ContentPreferenceUser';
import { ContentPreferenceStatus } from '../src/entity/contentPreference/types';
import { identifyUserPersonalizedDigest } from '../src/cio';
import type { GQLUser } from '../src/schema/users';
import { cancelSubscription } from '../src/common/paddle';
import { isPlusMember, SubscriptionCycles } from '../src/paddle';
import { CoresRole, StreakRestoreCoresPrice } from '../src/types';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../src/entity/user/UserTransaction';
import { DeletedUser } from '../src/entity/user/DeletedUser';
import { randomUUID } from 'crypto';
import {
  ClaimableItem,
  ClaimableItemFlags,
  ClaimableItemTypes,
} from '../src/entity/ClaimableItem';
import { addClaimableItemsToUser } from '../src/entity/user/utils';
import { getGeo } from '../src/common/geo';
import { SubscriptionProvider, SubscriptionStatus } from '../src/common/plus';
import * as njordCommon from '../src/common/njord';
import { createClient } from '@connectrpc/connect';
import {
  Credits,
  EntityType,
  OpportunityState,
  OpportunityType,
} from '@dailydotdev/schema';
import { Organization } from '../src/entity';
import { Opportunity } from '../src/entity/opportunities/Opportunity';
import { OpportunityJob } from '../src/entity/opportunities/OpportunityJob';
import { OpportunityUser } from '../src/entity/opportunities/user';
import { OpportunityUserType } from '../src/entity/opportunities/types';
import * as googleCloud from '../src/common/googleCloud';
import { fileTypeFromBuffer } from './setup';
import { Bucket } from '@google-cloud/storage';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationType,
} from '../src/notifications/common';
import { UserCandidatePreference } from '../src/entity/user/UserCandidatePreference';

jest.mock('../src/common/geo', () => ({
  ...(jest.requireActual('../src/common/geo') as Record<string, unknown>),
  getGeo: jest.fn(),
}));

const uploadResumeFromBuffer = jest.spyOn(
  googleCloud,
  'uploadResumeFromBuffer',
);
const deleteFileFromBucket = jest.spyOn(googleCloud, 'deleteFileFromBucket');

let con: DataSource;
let app: FastifyInstance;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;
let isPlus: boolean;
let isTeamMember = false;
const userTimezone = 'Pacific/Midway';

jest.mock('../src/common/paddle/index.ts', () => ({
  ...(jest.requireActual('../src/common/paddle/index.ts') as Record<
    string,
    unknown
  >),
  cancelSubscription: jest.fn(),
  paddleInstance: {
    subscriptions: {
      update: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock('../src/common/mailing.ts', () => ({
  ...(jest.requireActual('../src/common/mailing.ts') as Record<
    string,
    unknown
  >),
  sendEmail: jest.fn(),
}));

jest.mock('../src/cio', () => ({
  ...(jest.requireActual('../src/cio') as Record<string, unknown>),
  identifyUserPersonalizedDigest: jest.fn(),
  syncNotificationFlagsToCio: jest.fn(),
}));

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () =>
      new MockContext(
        con,
        loggedUser,
        undefined,
        undefined,
        isTeamMember,
        isPlus,
        'US',
      ),
  );
  client = state.client;
  app = state.app;
});

const now = new Date();

beforeEach(async () => {
  loggedUser = null;
  isPlus = false;
  isTeamMember = false;
  nock.cleanAll();
  jest.clearAllMocks();

  await con.getRepository(User).save([
    {
      id: '1',
      name: 'Ido',
      username: 'ido',
      image: 'https://daily.dev/ido.jpg',
      timezone: 'utc',
      createdAt: new Date(),
    },
    {
      id: '2',
      name: 'Tsahi',
      username: 'tsahi',
      image: 'https://daily.dev/tsahi.jpg',
      timezone: userTimezone,
    },
    {
      id: '3',
      name: 'Lee',
      image: 'https://daily.dev/lee.jpg',
      timezone: userTimezone,
      username: 'lee',
      socialLinks: [
        { platform: 'twitter', url: 'https://twitter.com/lee' },
        { platform: 'github', url: 'https://github.com/lee' },
        { platform: 'hashnode', url: 'https://hashnode.com/@lee' },
        { platform: 'roadmap', url: 'https://roadmap.sh/u/lee' },
        { platform: 'threads', url: 'https://threads.net/@lee' },
        { platform: 'codepen', url: 'https://codepen.io/lee' },
        { platform: 'reddit', url: 'https://reddit.com/u/lee' },
        {
          platform: 'stackoverflow',
          url: 'https://stackoverflow.com/users/999999/lee',
        },
        { platform: 'youtube', url: 'https://youtube.com/@lee' },
        { platform: 'linkedin', url: 'https://linkedin.com/in/lee' },
        { platform: 'mastodon', url: 'https://mastodon.social/@lee' },
      ],
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

  it('should return follow stats', async () => {
    const QUERY = `query UserStats($id: ID!){
      userStats(id: $id) {
        numFollowers
        numFollowing
      }
    }`;

    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `${item.id}-usf`,
          username: `${item.username}-usf`,
        };
      }),
    );
    await saveFixtures(
      con,
      Feed,
      usersFixture.map((item) => ({
        id: `${item.id}-usf`,
        userId: `${item.id}-usf`,
      })),
    );

    await con.getRepository(ContentPreferenceUser).save([
      {
        userId: '1-usf',
        feedId: '1-usf',
        referenceId: '2-usf',
        referenceUserId: '2-usf',
        status: ContentPreferenceStatus.Follow,
      },
      {
        userId: '1-usf',
        feedId: '1-usf',
        referenceId: '3-usf',
        referenceUserId: '3-usf',
        status: ContentPreferenceStatus.Follow,
      },
      {
        userId: '2-usf',
        feedId: '2-usf',
        referenceId: '1-usf',
        referenceUserId: '1-usf',
        status: ContentPreferenceStatus.Follow,
      },
      {
        userId: '1-usf',
        feedId: '1-usf',
        referenceId: '4-usf',
        referenceUserId: '4-usf',
        status: ContentPreferenceStatus.Follow,
      },
    ]);

    const res = await client.query(QUERY, { variables: { id: '1-usf' } });
    expect(res.errors).toBeFalsy();

    expect(res.data).toEqual({
      userStats: {
        numFollowers: 1,
        numFollowing: 3,
      },
    });
  });
});

describe('query userStreaks', () => {
  const QUERY = `query UserStreak {
    userStreak {
      max
      total
      current
      lastViewAt
      weekStart
    }
  }`;

  beforeEach(async () => {
    nock('http://localhost:5000').post('/e').reply(204);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should not allow unauthenticated users', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should return the user streaks', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      userStreak: {
        max: 0,
        total: 0,
        current: 0,
        lastViewAt: null,
        weekStart: DayOfWeek.Monday,
      },
    });
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
        weekStart: DayOfWeek.Monday,
      },
    });
  });

  it('should return the correct weekStart', async () => {
    loggedUser = '1';
    await con
      .getRepository(User)
      .update({ id: loggedUser }, { weekStart: DayOfWeek.Sunday });

    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      userStreak: {
        max: 0,
        total: 0,
        current: 0,
        lastViewAt: null,
        weekStart: DayOfWeek.Sunday,
      },
    });
  });

  it('should return the user streaks when last view is null', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
  });

  it('should return null when user has opted out of reading streaks', async () => {
    loggedUser = '1';
    await con.getRepository(Settings).save({
      userId: loggedUser,
      optOutReadingStreak: true,
    });

    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      userStreak: null,
    });
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

  describe('incorporating streak restore', () => {
    beforeEach(async () => {
      nock('http://localhost:5000').post('/e').reply(204);
    });

    it('should not reset streak when the user restored streak today', async () => {
      loggedUser = '1';

      const fakeToday = new Date(2024, 0, 1); // Monday
      const lastViewAt = subDays(fakeToday, 4); // Thursday

      jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
      await expectStreak(5, 0, lastViewAt);

      await con
        .getRepository(UserStreak)
        .update({ userId: loggedUser }, { currentStreak: 5 });
      await con.getRepository(UserStreakAction).save([
        {
          userId: loggedUser,
          type: UserStreakActionType.Recover,
          createdAt: fakeToday,
        },
      ]);

      await expectStreak(5, 5, lastViewAt);
    });

    it('should not reset streak when the user restored streak today with timezone', async () => {
      loggedUser = '1';

      const tz = 'Asia/Tokyo'; // the important part here is that we look at the dates below as if they are in this timezone
      await con
        .getRepository(User)
        .update({ id: loggedUser }, { timezone: tz });

      const lastViewRecoverAt = new Date(2024, 8, 27, 15, 10, 0); // Friday on Asia/Tokyo
      jest.useFakeTimers({ advanceTimers: true, now: lastViewRecoverAt });

      const lastViewAt = new Date(2024, 8, 26, 13, 47, 0); // Wednesday on both UTC and Asia/Tokyo
      await expectStreak(5, 0, lastViewAt); // successful clearance

      await con.getRepository(UserStreakAction).save([
        {
          userId: loggedUser,
          type: UserStreakActionType.Recover,
          createdAt: lastViewRecoverAt,
        },
      ]);

      const oldStreak = 5;
      await con
        .getRepository(UserStreak)
        .update({ userId: loggedUser }, { currentStreak: oldStreak });

      const fakeToday = new Date(2024, 8, 28, 0, 2, 0); // Saturday on Asia/Tokyo
      jest.useFakeTimers({ advanceTimers: true, now: fakeToday });

      const repo = con.getRepository(UserStreak);
      const res = await client.query(QUERY);
      expect(res.errors).toBeFalsy();

      const streak = await repo.findOneBy({ userId: loggedUser });
      expect(streak!.currentStreak).toEqual(oldStreak);
    });

    it('should reset streak when the user restored streak was yesterday and did not read', async () => {
      nock('http://localhost:5000').post('/e').reply(204);
      loggedUser = '1';

      const fakeToday = new Date(2024, 0, 2); // Tuesday
      const lastViewAt = subDays(fakeToday, 5); // Thursday

      jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
      await expectStreak(5, 0, lastViewAt);

      await con
        .getRepository(UserStreak)
        .update({ userId: loggedUser }, { currentStreak: 5 });
      await con.getRepository(UserStreakAction).save([
        {
          userId: loggedUser,
          type: UserStreakActionType.Recover,
          createdAt: subDays(fakeToday, 1),
        },
      ]);

      await expectStreak(5, 0, lastViewAt);
    });

    it('should not reset streak when the user restored streak yesterday and read a post', async () => {
      nock('http://localhost:5000').post('/e').reply(204);
      loggedUser = '1';

      const fakeToday = new Date(2024, 0, 2); // Tuesday
      const lastViewAt = subDays(fakeToday, 5); // Thursday

      jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
      await expectStreak(5, 0, lastViewAt);

      await con
        .getRepository(UserStreak)
        .update({ userId: loggedUser }, { currentStreak: 5 });
      const yesterday = subDays(fakeToday, 1);
      await con.getRepository(UserStreakAction).save([
        {
          userId: loggedUser,
          type: UserStreakActionType.Recover,
          createdAt: yesterday,
        },
      ]);

      await expectStreak(5, 5, yesterday);
    });

    it('should not reset streak when the user restored streak on Saturday and it is only Sunday', async () => {
      nock('http://localhost:5000').post('/e').reply(204);
      loggedUser = '1';

      const fakeToday = new Date(2024, 0, 7); // Sunday
      const lastViewAt = subDays(fakeToday, 3); // Thursday

      jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
      await expectStreak(5, 0, lastViewAt);

      await con
        .getRepository(UserStreak)
        .update({ userId: loggedUser }, { currentStreak: 5 });
      await con.getRepository(UserStreakAction).save([
        {
          userId: loggedUser,
          type: UserStreakActionType.Recover,
          createdAt: subDays(fakeToday, 1), // Saturday
        },
      ]);

      await expectStreak(5, 5, lastViewAt);
    });

    it('should not reset streak when the user restored streak on Thursday and it is still Thursday with timezone', async () => {
      nock('http://localhost:5000').post('/e').reply(204);
      loggedUser = '1';

      await con
        .getRepository(User)
        .update({ id: loggedUser }, { timezone: 'Asia/Manila' });
      const fakeToday = new Date(2024, 8, 4, 17, 35, 41); // Wednesday in UTC - but in Manila it is Thursday already
      const lastViewAt = new Date(2024, 8, 3, 15, 50, 23); // Tuesday

      jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
      await expectStreak(5, 0, lastViewAt);

      await con
        .getRepository(UserStreak)
        .update({ userId: loggedUser }, { currentStreak: 5 });
      await con.getRepository(UserStreakAction).save([
        {
          userId: loggedUser,
          type: UserStreakActionType.Recover,
          createdAt: subHours(fakeToday, 1),
          // Same day - without the timestamptz, the recovery is getting pushed way back
          // Instead of becoming 1AM Thursday after converting, it becomes 5PM Wednesday)
        },
      ]);

      await expectStreak(5, 5, lastViewAt);
    });

    it('should not reset streak when the user restored streak on Friday and it is only Saturday with Sunday as workday', async () => {
      nock('http://localhost:5000').post('/e').reply(204);
      loggedUser = '1';

      const fakeToday = new Date(2024, 0, 6); // Saturday
      const lastViewAt = subDays(fakeToday, 3); // Wednesday
      await con
        .getRepository(User)
        .update({ id: loggedUser }, { weekStart: DayOfWeek.Sunday });

      jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
      await expectStreak(5, 0, lastViewAt);

      await con
        .getRepository(UserStreak)
        .update({ userId: loggedUser }, { currentStreak: 5 });
      await con.getRepository(UserStreakAction).save([
        {
          userId: loggedUser,
          type: UserStreakActionType.Recover,
          createdAt: subDays(fakeToday, 1), // Friday
        },
      ]);

      await expectStreak(5, 5, lastViewAt);
    });
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

  it('should not reset streak on Monday when last read is Friday', async () => {
    loggedUser = '1';
    const fakeToday = new Date(2024, 0, 8); // Monday
    const lastViewAt = subDays(fakeToday, 3); // Friday

    expect(lastViewAt.getDay()).toEqual(5); // Friday
    jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
    await expectStreak(5, 5, lastViewAt);
  });

  describe('Sunday as the start of the week', () => {
    it('should not reset streak on Saturday when last read is Thursday', async () => {
      loggedUser = '1';
      await con
        .getRepository(User)
        .update({ id: loggedUser }, { weekStart: DayOfWeek.Sunday });
      const fakeToday = new Date(2024, 0, 6, 12, 0, 0, 0); // Saturday
      const lastViewAt = subDays(fakeToday, 2); // Thursday

      expect(lastViewAt.getDay()).toEqual(4); // Thursday
      jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
      await expectStreak(5, 5, lastViewAt);
    });

    it('should not reset streak on Sunday when last read is Thursday', async () => {
      loggedUser = '1';
      await con
        .getRepository(User)
        .update({ id: loggedUser }, { weekStart: DayOfWeek.Sunday });
      const fakeToday = new Date(2024, 0, 7, 12, 0, 0, 0); // Sunday
      const lastViewAt = subDays(fakeToday, 3); // Thursday

      expect(lastViewAt.getDay()).toEqual(4); // Thursday
      jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
      await expectStreak(5, 5, lastViewAt);
    });
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

describe('streak recover query', () => {
  const QUERY = `query StreakRecover {
    streakRecover {
      canRecover
      cost
      oldStreakLength
      regularCost
    }
  }`;

  beforeEach(async () => {
    await ioRedisPool.execute((client) => client.flushall());

    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => ({
        ...item,
        id: `${item.id}-sr`,
        username: `${item.username}-sr`,
        coresRole: CoresRole.User,
      })),
    );
  });

  it('should return recover data when user fetch query', async () => {
    nock('http://localhost:5000').post('/e').reply(204);
    loggedUser = '1-sr';

    const { data, errors } = await client.query(QUERY);
    expect(errors).toBeFalsy();
    const { streakRecover } = data;
    expect(streakRecover).toHaveProperty('canRecover');
    expect(streakRecover).toHaveProperty('cost');
    expect(streakRecover).toHaveProperty('oldStreakLength');
  });

  it('should disallow recover when user is not authenticated', async () => {
    loggedUser = null;
    return testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED');
  });

  it('should disallow recover when user has no streak', async () => {
    loggedUser = '2-sr';
    const { data, errors } = await client.query(QUERY);
    expect(errors).toBeFalsy();
    expect(data.streakRecover.canRecover).toBeFalsy();
  });

  it('should allow recover when user has streak', async () => {
    loggedUser = '1-sr';
    const oldLength = 5;
    await con.getRepository(UserStreak).save({
      userId: loggedUser,
      currentStreak: 0,
      lastViewAt: subDays(new Date(), 2),
    });

    // insert redis key with old streak length
    const redisKey = generateStorageKey(
      StorageTopic.Streak,
      StorageKey.Reset,
      loggedUser,
    );
    await setRedisObjectWithExpiry(
      redisKey,
      oldLength,
      addDays(new Date(), 1).getTime(),
    );

    const { data, errors } = await client.query(QUERY);
    expect(errors).toBeFalsy();
    expect(data.streakRecover.canRecover).toBeTruthy();
    expect(data.streakRecover.oldStreakLength).toBe(oldLength);
    expect(data.streakRecover.cost).toBe(0);
    expect(data.streakRecover.regularCost).toBe(
      StreakRestoreCoresPrice.Regular,
    );
  });

  it('should allow recover when user has streak but greater value on the second time', async () => {
    loggedUser = '1-sr';
    const oldLength = 5;
    await con.getRepository(UserStreak).save({
      userId: loggedUser,
      currentStreak: 0,
      lastViewAt: subDays(new Date(), 2),
    });
    await con.getRepository(UserStreakAction).save([
      {
        userId: loggedUser,
        type: UserStreakActionType.Recover,
        createdAt: subDays(new Date(), 4),
      },
    ]);

    // insert redis key with old streak length
    const redisKey = generateStorageKey(
      StorageTopic.Streak,
      StorageKey.Reset,
      loggedUser,
    );
    await setRedisObjectWithExpiry(
      redisKey,
      oldLength,
      addDays(new Date(), 1).getTime(),
    );

    const { data, errors } = await client.query(QUERY);
    expect(errors).toBeFalsy();
    expect(data.streakRecover.canRecover).toBeTruthy();
    expect(data.streakRecover.oldStreakLength).toBe(oldLength);
    expect(data.streakRecover.cost).toBe(StreakRestoreCoresPrice.Regular);
    expect(data.streakRecover.regularCost).toBe(
      StreakRestoreCoresPrice.Regular,
    );
  });
});

describe('clearImage mutation', () => {
  const MUTATION = `
    mutation ClearUserImage($presets: [UploadPreset]!) {
      clearImage(presets: $presets) {
        _
      }
    }
  `;

  it('should not allow unauthenticated users', async () =>
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { presets: [UploadPreset.ProfileCover] },
      },
      'UNAUTHENTICATED',
    ));

  it("should clear user's avatar", async () => {
    loggedUser = '1';

    await con
      .getRepository(User)
      .update({ id: loggedUser }, { image: 'test', cover: 'cover' });

    const res = await client.mutate(MUTATION, {
      variables: { presets: [UploadPreset.Avatar] },
    });

    expect(res.errors).toBeFalsy();

    const user = await con.getRepository(User).findOneBy({ id: loggedUser });
    expect(user.image).toBeNull();
    expect(user.cover).not.toBeNull();
  });

  it("should clear user's cover", async () => {
    loggedUser = '1';

    await con
      .getRepository(User)
      .update({ id: loggedUser }, { image: 'test', cover: 'cover' });

    const res = await client.mutate(MUTATION, {
      variables: { presets: [UploadPreset.ProfileCover] },
    });

    expect(res.errors).toBeFalsy();

    const user = await con.getRepository(User).findOneBy({ id: loggedUser });
    expect(user.image).not.toBeNull();
    expect(user.cover).toBeNull();
  });
});

describe('streak recovery mutation', () => {
  const MUTATION = `
    mutation RecoverStreak {
      recoverStreak(cores: true) {
        current
        lastViewAt
        max
        balance {
          amount
        }
      }
    }
  `;

  beforeEach(async () => {
    const mockTransport = createMockNjordTransport();

    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => createClient(Credits, mockTransport));

    await ioRedisPool.execute((client) => client.flushall());

    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => ({
        ...item,
        id: `${item.id}-srm`,
        username: `${item.username}-srm`,
        coresRole: CoresRole.User,
      })),
    );
  });

  it('should not authorize when not logged in', async () =>
    await testMutationErrorCode(
      client,
      { mutation: MUTATION },
      'UNAUTHENTICATED',
    ));

  it('should not recover if old streak has expired', async () => {
    loggedUser = '1-srm';
    await con.getRepository(UserStreak).update(
      { userId: loggedUser },
      {
        currentStreak: 0,
        lastViewAt: subDays(new Date(), 2),
      },
    );
    await con.getRepository(UserStreakAction).save([
      {
        userId: loggedUser,
        type: UserStreakActionType.Recover,
        createdAt: subDays(new Date(), 4),
      },
    ]);

    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      idempotencyKey: crypto.randomUUID(),
      transfers: [
        {
          sender: { id: 'system', type: EntityType.SYSTEM },
          receiver: { id: '1-srm', type: EntityType.USER },
          amount: 500,
        },
      ],
    });

    await testMutationError(client, { mutation: MUTATION }, (errors) => {
      expect(errors).toBeDefined();
      expect(errors[0].message).toEqual('No streak to recover');
    });
  });

  it('should not recover if user has not enough Cores', async () => {
    loggedUser = '1-srm';
    await con.getRepository(UserStreak).update(
      { userId: loggedUser },
      {
        currentStreak: 0,
        lastViewAt: subDays(new Date(), 2),
      },
    );
    await con.getRepository(UserStreakAction).save([
      {
        userId: loggedUser,
        type: UserStreakActionType.Recover,
        createdAt: subDays(new Date(), 4),
      },
    ]);

    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      idempotencyKey: crypto.randomUUID(),
      transfers: [
        {
          sender: { id: 'system', type: EntityType.SYSTEM },
          receiver: { id: '1-srm', type: EntityType.USER },
          amount: 50,
        },
      ],
    });

    const oldLength = 10;
    const redisKey = generateStorageKey(
      StorageTopic.Streak,
      StorageKey.Reset,
      loggedUser,
    );
    await setRedisObjectWithExpiry(
      redisKey,
      oldLength,
      addDays(new Date(), 1).getTime(),
    );

    await testMutationError(client, { mutation: MUTATION }, (errors) => {
      expect(errors).toBeDefined();
      expect(errors[0].message).toEqual('Not enough Cores to recover streak');
    });
  });

  it('should recover the streak if user has enough Cores', async () => {
    loggedUser = '1-srm';
    await con.getRepository(UserStreak).update(
      { userId: loggedUser },
      {
        currentStreak: 0,
        lastViewAt: subDays(new Date(), 2),
      },
    );

    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      idempotencyKey: crypto.randomUUID(),
      transfers: [
        {
          sender: { id: systemUser.id, type: EntityType.SYSTEM },
          receiver: { id: loggedUser, type: EntityType.USER },
          amount: 100,
        },
      ],
    });

    // insert redis key with old streak length
    const oldLength = 10;
    const redisKey = generateStorageKey(
      StorageTopic.Streak,
      StorageKey.Reset,
      loggedUser,
    );
    await setRedisObjectWithExpiry(
      redisKey,
      oldLength,
      addDays(new Date(), 1).getTime(),
    );

    const { data, errors } = await client.mutate(MUTATION);
    const { recoverStreak } = data;
    expect(errors).toBeFalsy();
    expect(recoverStreak).toBeTruthy();
    expect(recoverStreak.current).toEqual(oldLength);
    expect(recoverStreak.balance.amount).toEqual(100);

    const redisCache = await getRestoreStreakCache({ userId: loggedUser });
    expect(redisCache).toBeNull();

    const userTransaction = await con.getRepository(UserTransaction).findOne({
      where: {
        senderId: loggedUser,
        receiverId: systemUser.id,
      },
    });
    expect(userTransaction).toBeTruthy();
    expect(userTransaction!.value).toEqual(StreakRestoreCoresPrice.First);
    expect(userTransaction!.valueIncFees).toEqual(
      StreakRestoreCoresPrice.First,
    );
    expect(userTransaction!.flags.note).toEqual('Streak restore');
  });

  it('should not update maxStreak if the recovered streak is less than the current maxStreak', async () => {
    loggedUser = '1-srm';
    await con.getRepository(UserStreak).update(
      { userId: loggedUser },
      {
        currentStreak: 0,
        maxStreak: 20,
        lastViewAt: subDays(new Date(), 2),
      },
    );

    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      idempotencyKey: crypto.randomUUID(),
      transfers: [
        {
          sender: { id: systemUser.id, type: EntityType.SYSTEM },
          receiver: { id: loggedUser, type: EntityType.USER },
          amount: 100,
        },
      ],
    });

    // insert redis key with old streak length
    const oldLength = 10;
    const redisKey = generateStorageKey(
      StorageTopic.Streak,
      StorageKey.Reset,
      loggedUser,
    );
    await setRedisObjectWithExpiry(
      redisKey,
      oldLength,
      addDays(new Date(), 1).getTime(),
    );

    const { data, errors } = await client.mutate(MUTATION);
    const { recoverStreak } = data;
    expect(errors).toBeFalsy();
    expect(recoverStreak).toBeTruthy();
    expect(recoverStreak.current).toEqual(oldLength);
    expect(recoverStreak.max).toEqual(20);

    const userTransaction = await con.getRepository(UserTransaction).findOne({
      where: {
        senderId: loggedUser,
        receiverId: systemUser.id,
      },
    });
    expect(userTransaction).toBeTruthy();
    expect(userTransaction!.value).toEqual(StreakRestoreCoresPrice.First);
    expect(userTransaction!.valueIncFees).toEqual(
      StreakRestoreCoresPrice.First,
    );
    expect(userTransaction!.flags.note).toEqual('Streak restore');
  });

  it('should update maxStreak if the recovered streak is more than the current maxStreak', async () => {
    loggedUser = '1-srm';
    await con.getRepository(UserStreak).update(
      { userId: loggedUser },
      {
        currentStreak: 1,
        maxStreak: 20,
        lastViewAt: subDays(new Date(), 2),
      },
    );

    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      idempotencyKey: crypto.randomUUID(),
      transfers: [
        {
          sender: { id: systemUser.id, type: EntityType.SYSTEM },
          receiver: { id: loggedUser, type: EntityType.USER },
          amount: 100,
        },
      ],
    });

    // insert redis key with old streak length
    const oldLength = 20;
    const redisKey = generateStorageKey(
      StorageTopic.Streak,
      StorageKey.Reset,
      loggedUser,
    );
    await setRedisObjectWithExpiry(
      redisKey,
      oldLength,
      addDays(new Date(), 1).getTime(),
    );

    const { data, errors } = await client.mutate(MUTATION);
    const { recoverStreak } = data;
    expect(errors).toBeFalsy();
    expect(recoverStreak).toBeTruthy();
    expect(recoverStreak.current).toEqual(21);
    expect(recoverStreak.max).toEqual(21);

    const userTransaction = await con.getRepository(UserTransaction).findOne({
      where: {
        senderId: loggedUser,
        receiverId: systemUser.id,
      },
    });
    expect(userTransaction).toBeTruthy();
    expect(userTransaction!.value).toEqual(StreakRestoreCoresPrice.First);
    expect(userTransaction!.valueIncFees).toEqual(
      StreakRestoreCoresPrice.First,
    );
    expect(userTransaction!.flags.note).toEqual('Streak restore');
  });

  it('should recover streak with 0 points on the first time', async () => {
    loggedUser = '1-srm';
    const missing = await con.getRepository(UserStreakAction).findOneBy({
      userId: loggedUser,
      type: UserStreakActionType.Recover,
    });
    expect(missing).toBeNull();
    await con.getRepository(UserStreak).update(
      { userId: loggedUser },
      {
        currentStreak: 1,
        maxStreak: 20,
        lastViewAt: subDays(new Date(), 2),
      },
    );

    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      idempotencyKey: crypto.randomUUID(),
      transfers: [
        {
          sender: { id: systemUser.id, type: EntityType.SYSTEM },
          receiver: { id: loggedUser, type: EntityType.USER },
          amount: 100,
        },
      ],
    });

    // insert redis key with old streak length
    const oldLength = 20;
    const redisKey = generateStorageKey(
      StorageTopic.Streak,
      StorageKey.Reset,
      loggedUser,
    );
    await setRedisObjectWithExpiry(
      redisKey,
      oldLength,
      addDays(new Date(), 1).getTime(),
    );

    const { data, errors } = await client.mutate(MUTATION);
    const { recoverStreak } = data;
    expect(errors).toBeFalsy();
    expect(recoverStreak).toBeTruthy();
    expect(recoverStreak.current).toEqual(21);
    expect(recoverStreak.max).toEqual(21);
    expect(recoverStreak.balance.amount).toEqual(100);

    const recoverAction = await con.getRepository(UserStreakAction).findOneBy({
      userId: loggedUser,
      type: UserStreakActionType.Recover,
    });
    expect(recoverAction).toBeTruthy();

    const userTransaction = await con.getRepository(UserTransaction).findOne({
      where: {
        senderId: loggedUser,
        receiverId: systemUser.id,
      },
    });
    expect(userTransaction).toBeTruthy();
    expect(userTransaction!.value).toEqual(StreakRestoreCoresPrice.First);
    expect(userTransaction!.valueIncFees).toEqual(
      StreakRestoreCoresPrice.First,
    );
    expect(userTransaction!.flags.note).toEqual('Streak restore');
  });

  it('should recover streak with 100 points on the second time', async () => {
    loggedUser = '1-srm';
    const yesterday = subDays(new Date(), 1);
    await con.getRepository(UserStreakAction).save([
      {
        userId: loggedUser,
        type: UserStreakActionType.Recover,
        createdAt: yesterday,
      },
    ]);
    await con.getRepository(UserStreak).update(
      { userId: loggedUser },
      {
        currentStreak: 1,
        maxStreak: 20,
        lastViewAt: subDays(new Date(), 2),
      },
    );

    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      idempotencyKey: crypto.randomUUID(),
      transfers: [
        {
          sender: { id: systemUser.id, type: EntityType.SYSTEM },
          receiver: { id: loggedUser, type: EntityType.USER },
          amount: 100,
        },
      ],
    });

    // insert redis key with old streak length
    const oldLength = 20;
    const redisKey = generateStorageKey(
      StorageTopic.Streak,
      StorageKey.Reset,
      loggedUser,
    );
    await setRedisObjectWithExpiry(
      redisKey,
      oldLength,
      addDays(new Date(), 1).getTime(),
    );

    const { data, errors } = await client.mutate(MUTATION);
    const { recoverStreak } = data;
    expect(errors).toBeFalsy();
    expect(recoverStreak).toBeTruthy();
    expect(recoverStreak.current).toEqual(21);
    expect(recoverStreak.max).toEqual(21);
    const redisCache = await getRestoreStreakCache({ userId: loggedUser });
    expect(redisCache).toBeNull();
    expect(recoverStreak.balance.amount).toEqual(0);

    const userTransaction = await con.getRepository(UserTransaction).findOne({
      where: {
        senderId: loggedUser,
        receiverId: systemUser.id,
      },
    });
    expect(userTransaction).toBeTruthy();
    expect(userTransaction!.value).toEqual(StreakRestoreCoresPrice.Regular);
    expect(userTransaction!.valueIncFees).toEqual(
      StreakRestoreCoresPrice.Regular,
    );
    expect(userTransaction!.flags.note).toEqual('Streak restore');
  });

  it('should throw when user does not have access to Cores', async () => {
    loggedUser = '4-srm';

    await con.getRepository(UserStreak).update(
      { userId: loggedUser },
      {
        currentStreak: 1,
        maxStreak: 20,
        lastViewAt: subDays(new Date(), 2),
      },
    );

    // insert redis key with old streak length
    const oldLength = 20;
    const redisKey = generateStorageKey(
      StorageTopic.Streak,
      StorageKey.Reset,
      loggedUser,
    );
    await setRedisObjectWithExpiry(
      redisKey,
      oldLength,
      addDays(new Date(), 1).getTime(),
    );

    await con
      .getRepository(User)
      .update({ id: loggedUser }, { coresRole: CoresRole.None });

    await testMutationErrorCode(
      client,
      { mutation: MUTATION },
      'FORBIDDEN',
      'You do not have access to Cores',
    );
  });

  it('should throw when non Cores client tries to recover', async () => {
    loggedUser = '1-srm';

    const MUTATION_NON_CORES = `
    mutation RecoverStreak {
      recoverStreak {
        current
        lastViewAt
        max
      }
    }
  `;

    await testMutationErrorCode(
      client,
      { mutation: MUTATION_NON_CORES },
      'FORBIDDEN',
    );
  });
});

describe('mutation updateStreakConfig', () => {
  const QUERY = `mutation UpdateStreakConfig($weekStart: Int) {
    updateStreakConfig(weekStart: $weekStart) {
      max
      total
      current
      lastViewAt
      weekStart
    }
  }`;

  it('should not allow unauthenticated users', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should update the streak config and return the streak', async () => {
    loggedUser = '1';

    expect(
      (await con.getRepository(User).findOneBy({ id: loggedUser }))?.weekStart,
    ).toEqual(DayOfWeek.Monday);

    const res = await client.query(QUERY, {
      variables: { weekStart: DayOfWeek.Sunday },
    });

    expect(
      (await con.getRepository(User).findOneBy({ id: loggedUser }))?.weekStart,
    ).toEqual(DayOfWeek.Sunday);

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      updateStreakConfig: {
        max: 0,
        total: 0,
        current: 0,
        lastViewAt: null,
        weekStart: DayOfWeek.Sunday,
      },
    });
  });
});

describe('query userStreaksProfile', () => {
  const QUERY_BY_USER_ID = `query UserStreakProfile($id: ID!) {
    userStreakProfile(id: $id) {
      max
      total
    }
  }`;

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should not allow to query without user id', () =>
    testQueryErrorCode(
      client,
      { query: QUERY_BY_USER_ID },
      'GRAPHQL_VALIDATION_FAILED',
    ));

  it('should return default user streaks based on user id when no streak is found', async () => {
    const res = await client.query(QUERY_BY_USER_ID, {
      variables: { id: '2' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      userStreakProfile: {
        max: 0,
        total: 0,
      },
    });
  });

  it('should return updated user streak for user id when streak is found', async () => {
    const userId = '2';
    const fakeToday = new Date(2024, 0, 6); // Saturday
    const lastViewAt = subDays(fakeToday, 2); // Thursday

    jest.useFakeTimers({ advanceTimers: true, now: fakeToday });
    const repo = con.getRepository(UserStreak);
    await repo.update({ userId }, { currentStreak: 5, lastViewAt });

    const res = await client.query(QUERY_BY_USER_ID, {
      variables: { id: userId },
    });
    expect(res.errors).toBeFalsy();

    const streak = await repo.findOneBy({ userId });
    expect(streak.currentStreak).toEqual(5);
  });

  it('should return null when user has opted out of reading streaks', async () => {
    const userId = '2';
    await con.getRepository(Settings).save({
      userId,
      optOutReadingStreak: true,
    });

    const res = await client.query(QUERY_BY_USER_ID, {
      variables: { id: userId },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      userStreakProfile: null,
    });
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

describe('query user socialLinks', () => {
  const QUERY = `query User($id: ID!) {
    user(id: $id) {
      id
      socialLinks {
        platform
        url
      }
    }
  }`;

  it('should return empty socialLinks when user has none', async () => {
    const requestUserId = '1';
    const res = await client.query(QUERY, { variables: { id: requestUserId } });
    expect(res.errors).toBeFalsy();
    expect(res.data.user.socialLinks).toEqual([]);
  });

  it('should return socialLinks when user has them', async () => {
    await con.getRepository(User).update(
      { id: '1' },
      {
        socialLinks: [
          { platform: 'github', url: 'https://github.com/testuser' },
          { platform: 'twitter', url: 'https://twitter.com/testhandle' },
        ],
      },
    );

    const res = await client.query(QUERY, { variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.user.socialLinks).toEqual([
      { platform: 'github', url: 'https://github.com/testuser' },
      { platform: 'twitter', url: 'https://twitter.com/testhandle' },
    ]);
  });

  it('should resolve legacy social fields from socialLinks for backwards compatibility', async () => {
    await con.getRepository(User).update(
      { id: '1' },
      {
        socialLinks: [
          { platform: 'github', url: 'https://github.com/testuser' },
          { platform: 'twitter', url: 'https://twitter.com/testhandle' },
          { platform: 'linkedin', url: 'https://linkedin.com/in/testprofile' },
          { platform: 'mastodon', url: 'https://mastodon.social/@testuser' },
          { platform: 'portfolio', url: 'https://example.com' },
        ],
      },
    );

    const LEGACY_QUERY = `query User($id: ID!) {
      user(id: $id) {
        id
        github
        twitter
        linkedin
        mastodon
        portfolio
      }
    }`;

    const res = await client.query(LEGACY_QUERY, { variables: { id: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.user.github).toBe('testuser');
    expect(res.data.user.twitter).toBe('testhandle');
    expect(res.data.user.linkedin).toBe('testprofile');
    expect(res.data.user.mastodon).toBe('https://mastodon.social/@testuser');
    expect(res.data.user.portfolio).toBe('https://example.com');
  });
});

describe('query team members', () => {
  const QUERY = `query User($id: ID!) {
    user(id: $id) {
      name
      username
      image
      isTeamMember
    }
  }`;

  it('should return team member as false', async () => {
    const requestUserId = '1';
    const res = await client.query(QUERY, { variables: { id: requestUserId } });
    expect(res.errors).toBeFalsy();
    expect(res.data.user).toMatchObject({
      name: 'Ido',
      username: 'ido',
      image: 'https://daily.dev/ido.jpg',
      isTeamMember: false,
    });
  });

  it('should return team member as true', async () => {
    await con.getRepository(Feature).insert({
      feature: FeatureType.Team,
      userId: '1',
      value: 1,
    });
    const requestUserId = '1';
    const res = await client.query(QUERY, { variables: { id: requestUserId } });
    expect(res.errors).toBeFalsy();
    expect(res.data.user).toMatchObject({
      name: 'Ido',
      username: 'ido',
      image: 'https://daily.dev/ido.jpg',
      isTeamMember: true,
    });
  });
});

describe('user company', () => {
  beforeEach(async () => {
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
        userId: '1',
        companyId: '3',
        verified: false,
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
      { userId: '1', verified: true, email: 'u1@com5.com', code: '123' },
    ]);
    // Add current work experiences for verified companies
    await con.getRepository(UserExperience).save([
      {
        userId: '1',
        companyId: '1',
        title: 'Engineer',
        type: UserExperienceType.Work,
        startedAt: new Date('2023-01-01'),
        endedAt: null, // Current position
      },
      {
        userId: '1',
        companyId: '2',
        title: 'Developer',
        type: UserExperienceType.Work,
        startedAt: new Date('2022-01-01'),
        endedAt: null, // Current position
      },
      {
        userId: '2',
        companyId: '3',
        title: 'Manager',
        type: UserExperienceType.Work,
        startedAt: new Date('2021-01-01'),
        endedAt: null, // Current position
      },
    ]);
  });

  describe('query user (companies)', () => {
    const QUERY = `query User($id: ID!) {
    user(id: $id) {
      companies {
        id
        name
        image
      }
    }
  }`;
    it('should return verified records where companies exist', async () => {
      const requestUserId = '1';
      const res = await client.query(QUERY, {
        variables: { id: requestUserId },
      });
      expect(res.errors).toBeFalsy();
      expect(res.data.user.companies).toMatchObject([
        {
          id: '1',
          image: 'https://daily.dev/company1.jpg',
          name: 'Company 1',
        },
        {
          id: '2',
          image: 'https://daily.dev/company2.jpg',
          name: 'Company 2',
        },
      ]);
    });

    it('return data for other users', async () => {
      loggedUser = '1';
      const requestUserId = '2';
      const res = await client.query(QUERY, {
        variables: { id: requestUserId },
      });
      expect(res.errors).toBeFalsy();
      expect(res.data.user.companies).toMatchObject([
        { id: '3', name: 'Company 3', image: 'https://daily.dev/company3.jpg' },
      ]);
    });

    it('return empty array if no companies found', async () => {
      const requestUserId = '3';
      const res = await client.query(QUERY, {
        variables: { id: requestUserId },
      });
      expect(res.errors).toBeFalsy();
      expect(res.data.user.companies).toMatchObject([]);
    });

    it('should not return verified company with no work experiences', async () => {
      // Company 1 is verified for user 1, but let's remove the work experience
      await con
        .getRepository(UserExperience)
        .delete({ userId: '1', companyId: '1' });
      const res = await client.query(QUERY, {
        variables: { id: '1' },
      });
      expect(res.errors).toBeFalsy();
      // Should only return Company 2 now since Company 1 has no work experience
      expect(res.data.user.companies).toMatchObject([
        { id: '2', name: 'Company 2' },
      ]);
    });

    it('should not return verified company with only ended work experiences', async () => {
      // Update user 1's work experience at Company 1 to be ended
      await con
        .getRepository(UserExperience)
        .update(
          { userId: '1', companyId: '1' },
          { endedAt: new Date('2023-12-31') },
        );
      const res = await client.query(QUERY, {
        variables: { id: '1' },
      });
      expect(res.errors).toBeFalsy();
      // Should only return Company 2 now since Company 1 has no current work experience
      expect(res.data.user.companies).toMatchObject([
        { id: '2', name: 'Company 2' },
      ]);
    });

    it('should return company if user has at least one current work experience (multiple experiences at same company)', async () => {
      // Add an ended work experience for user 1 at Company 1 (in addition to current one)
      await con.getRepository(UserExperience).save({
        userId: '1',
        companyId: '1',
        title: 'Previous Role',
        type: UserExperienceType.Work,
        startedAt: new Date('2020-01-01'),
        endedAt: new Date('2022-12-31'), // Ended
      });
      const res = await client.query(QUERY, {
        variables: { id: '1' },
      });
      expect(res.errors).toBeFalsy();
      // Should still return both companies since Company 1 has at least one current experience
      expect(res.data.user.companies.length).toBe(2);
    });

    it('should order companies by most recent startedAt (current positions)', async () => {
      // Update Company 2's experience to have a more recent start date than Company 1
      await con
        .getRepository(UserExperience)
        .update(
          { userId: '1', companyId: '2' },
          { startedAt: new Date('2024-06-01') },
        );
      const res = await client.query(QUERY, {
        variables: { id: '1' },
      });
      expect(res.errors).toBeFalsy();
      // Company 2 should come first due to more recent start date
      expect(res.data.user.companies[0].id).toBe('2');
      expect(res.data.user.companies[1].id).toBe('1');
    });

    it('should ignore non-work experience types', async () => {
      // Remove the work experience and add an education experience
      await con
        .getRepository(UserExperience)
        .delete({ userId: '1', companyId: '1' });
      await con.getRepository(UserExperience).save({
        userId: '1',
        companyId: '1',
        title: 'CS Degree',
        type: UserExperienceType.Education,
        startedAt: new Date('2020-01-01'),
        endedAt: null, // Current education
      });
      const res = await client.query(QUERY, {
        variables: { id: '1' },
      });
      expect(res.errors).toBeFalsy();
      // Company 1 should not be returned since education type doesn't count
      expect(res.data.user.companies).toMatchObject([
        { id: '2', name: 'Company 2' },
      ]);
    });
  });

  describe('query companies', () => {
    const QUERY = `query Companies {
    companies {
      email
      company {
      id
     }
    }
  }`;

    it('should not authorize when not logged in', () =>
      testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

    it('should return user companies that are verified', async () => {
      loggedUser = '1';
      const res = await client.query(QUERY);
      expect(res.errors).toBeFalsy();
      expect(res.data.companies).toMatchObject([
        { email: 'u1@com1.com', company: { id: '1' } },
        { email: 'u1@com2.com', company: { id: '2' } },
        { email: 'u1@com5.com', company: null },
      ]);
    });
  });

  describe('mutation addUserCompany', () => {
    const QUERY = `mutation addUserCompany($email: String!) {
    addUserCompany(email: $email) {
      _
    }
  }`;

    beforeEach(async () => {
      await deleteKeysByPattern(`${rateLimiterName}:*`);
    });

    it('should not authorize when not logged in', () => {
      return testQueryError(
        client,
        { query: QUERY, variables: { email: 'test@test.com' } },
        (errors) => {
          expect(errors[0].extensions.code).toEqual('UNAUTHENTICATED');
        },
      );
    });

    it('should fail if no email is passed', async () => {
      loggedUser = '1';
      return testQueryErrorCode(
        client,
        { query: QUERY },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('should fail if email was already used by other user', async () => {
      loggedUser = '1';
      return testQueryError(
        client,
        { query: QUERY, variables: { email: 'u2@com4.com' } },
        (errors) => {
          expect(errors[0].extensions!.code).toEqual(
            'GRAPHQL_VALIDATION_FAILED',
          );
          expect(errors[0].message).toEqual(
            'Oops, there was an issue verifying this email. Please use a different one.',
          );
        },
      );
    });

    it('should fail if email invalid format', async () => {
      loggedUser = '1';
      return testQueryError(
        client,
        { query: QUERY, variables: { email: 'u2@com4' } },
        (errors) => {
          expect(errors[0].extensions.code).toEqual(
            'GRAPHQL_VALIDATION_FAILED',
          );
          expect(errors[0].message).toEqual('Invalid email');
        },
      );
    });

    it('should fail if email is in list of ignored work email domains', async () => {
      loggedUser = '1';
      return testQueryError(
        client,
        { query: QUERY, variables: { email: 'u2@igored.com' } },
        (errors) => {
          expect(errors[0].extensions.code).toEqual(
            'GRAPHQL_VALIDATION_FAILED',
          );
          expect(errors[0].message).toEqual(
            'We can only verify unique company domains',
          );
        },
      );
    });

    it('should create user company record without linked company if domain partially matches ignored domain', async () => {
      loggedUser = '1';
      const res = await client.query(QUERY, {
        variables: { email: 'u1@extraigored.com' },
      });
      expect(res.errors).toBeFalsy();
      const row = await con.getRepository(UserCompany).findOneByOrFail({
        email: 'u1@extraigored.com',
      });
      expect(row.verified).toBeFalsy();
      expect(row.code.length).toEqual(6);
      expect(row.companyId).toEqual(null);
    });

    it('should create user company record without linked company', async () => {
      loggedUser = '1';
      const res = await client.query(QUERY, {
        variables: { email: 'u1@com4.com' },
      });
      expect(res.errors).toBeFalsy();
      const row = await con.getRepository(UserCompany).findOneByOrFail({
        email: 'u1@com4.com',
      });
      expect(row.verified).toBeFalsy();
      expect(row.code.length).toEqual(6);
      expect(row.companyId).toEqual(null);
    });

    it('should create user company record with linked company', async () => {
      loggedUser = '1';
      await con.getRepository(Company).save([
        {
          id: '4',
          name: 'Company 4',
          image: 'https://daily.dev/company4.jpg',
          domains: ['com4.com'],
        },
      ]);
      const res = await client.query(QUERY, {
        variables: { email: 'u1@com4.com' },
      });
      expect(res.errors).toBeFalsy();
      const row = await con.getRepository(UserCompany).findOneByOrFail({
        email: 'u1@com4.com',
      });
      expect(row.verified).toBeFalsy();
      expect(row.code.length).toEqual(6);
      expect(row.companyId).toEqual('4');
    });

    it('should update verification code if it was an existing record', async () => {
      loggedUser = '1';
      const res = await client.query(QUERY, {
        variables: { email: 'u1@com3.com' },
      });
      expect(res.errors).toBeFalsy();
      const row = await con.getRepository(UserCompany).findOneByOrFail({
        email: 'u1@com3.com',
      });
      expect(row.verified).toBeFalsy();
      expect(row.code.length).toEqual(6);
    });

    it('should send verification email to user if email is not verified', async () => {
      loggedUser = '1';
      const res = await client.query(QUERY, {
        variables: { email: 'u1@com4.com' },
      });
      expect(res.errors).toBeFalsy();
      const row = await con.getRepository(UserCompany).findOneByOrFail({
        email: 'u1@com4.com',
      });
      expect(row.verified).toBeFalsy();
      expect(row.code.length).toEqual(6);
      expect(row.companyId).toEqual(null);

      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendEmail).toHaveBeenCalledWith({
        to: 'u1@com4.com',
        send_to_unsubscribed: true,
        message_data: {
          code: expect.any(String),
        },
        identifiers: {
          id: loggedUser,
        },
        transactional_message_id:
          CioTransactionalMessageTemplateId.VerifyCompany,
      });
    });

    it('should not send verification email to user if email is verified', async () => {
      loggedUser = '1';
      await con.getRepository(UserCompany).save({
        verified: true,
        email: 'u1@com3.com',
        code: '654321',
        userId: loggedUser,
      });
      return testQueryError(
        client,
        { query: QUERY, variables: { email: 'u1@com3.com' } },
        (errors) => {
          expect(errors[0].extensions!.code).toEqual(
            'GRAPHQL_VALIDATION_FAILED',
          );
          expect(errors[0].message).toEqual(
            'This email has already been verified',
          );

          expect(sendEmail).not.toHaveBeenCalled();
        },
      );
    });
  });

  describe('mutation removeUserCompany', () => {
    const QUERY = `mutation RemoveUserCompany($email: String!) {
    removeUserCompany(email: $email) {
      _
    }
  }`;

    it('should not authorize when not logged in', () => {
      return testQueryError(
        client,
        { query: QUERY, variables: { email: 'test@test.com' } },
        (errors) => {
          expect(errors[0].extensions.code).toEqual('UNAUTHENTICATED');
        },
      );
    });

    it('should fail if no email is passed', async () => {
      loggedUser = '1';
      return testQueryErrorCode(
        client,
        { query: QUERY },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('should ignore if email is not known', async () => {
      loggedUser = '1';
      const res = await client.query(QUERY, {
        variables: { email: 'random@random.com' },
      });
      expect(res.errors).toBeFalsy();
      expect(res.data.removeUserCompany._).toBeTruthy();
    });

    it('should ignore if email is not owned by user', async () => {
      loggedUser = '1';
      const res = await client.query(QUERY, {
        variables: { email: 'u2@com4.com' },
      });
      expect(res.errors).toBeFalsy();
      expect(res.data.removeUserCompany._).toBeTruthy();
      const row = await con.getRepository(UserCompany).findOneBy({
        email: 'u2@com4.com',
      });
      expect(row).toBeTruthy();
    });

    it('should delete if user is owner of email', async () => {
      loggedUser = '1';
      const res = await client.query(QUERY, {
        variables: { email: 'u1@com2.com' },
      });
      expect(res.errors).toBeFalsy();
      expect(res.data.removeUserCompany._).toBeTruthy();
      const row = await con.getRepository(UserCompany).findOneBy({
        email: 'u1@com2.com',
      });
      expect(row).toBeFalsy();
    });
  });

  describe('mutation verifyUserCompanyCode', () => {
    const QUERY = `mutation VerifyUserCompanyCode($email: String!, $code: String!) {
    verifyUserCompanyCode(email: $email, code: $code) {
      email
    }
  }`;

    beforeEach(async () => {
      await deleteKeysByPattern(`${rateLimiterName}:*`);
    });

    it('should not authorize when not logged in', () => {
      return testQueryError(
        client,
        { query: QUERY, variables: { email: 'test@test.com', code: '123' } },
        (errors) => {
          expect(errors[0].extensions.code).toEqual('UNAUTHENTICATED');
        },
      );
    });

    it('should fail if no email is passed', async () => {
      loggedUser = '1';
      return testQueryErrorCode(
        client,
        { query: QUERY, variables: { code: '123' } },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('should fail if email but no code is passed', async () => {
      loggedUser = '1';
      return testQueryErrorCode(
        client,
        { query: QUERY, variables: { email: 'test@test.com' } },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('should fail if email not found', async () => {
      loggedUser = '1';
      return testQueryError(
        client,
        { query: QUERY, variables: { email: 'test@test.com', code: '123' } },
        (errors) => {
          expect(errors[0].message).toEqual('Entity not found');
        },
      );
    });

    it('should fail if email not owned by user', async () => {
      loggedUser = '1';
      return testQueryError(
        client,
        { query: QUERY, variables: { email: 'u2@com4.com', code: '123' } },
        (errors) => {
          expect(errors[0].message).toEqual('Entity not found');
        },
      );
    });

    it('should fail if email already verified', async () => {
      loggedUser = '1';
      return testQueryError(
        client,
        { query: QUERY, variables: { email: 'u1@com1.com', code: '123' } },
        (errors) => {
          expect(errors[0].message).toEqual('Entity not found');
        },
      );
    });

    it('should fail if code not correct', async () => {
      loggedUser = '1';
      return testQueryError(
        client,
        { query: QUERY, variables: { email: 'u1@com3.com', code: '456' } },
        (errors) => {
          expect(errors[0].message).toEqual('Invalid code');
        },
      );
    });

    it('should verify the record', async () => {
      loggedUser = '1';
      const res = await client.query(QUERY, {
        variables: { email: 'u1@com3.com', code: '123' },
      });
      expect(res.errors).toBeFalsy();
      expect(res.data.verifyUserCompanyCode.email).toEqual('u1@com3.com');
      const row = await con.getRepository(UserCompany).findOneBy({
        email: 'u1@com3.com',
      });
      expect(row.verified).toBeTruthy();
    });
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

  it('should handle special characters in search (C++)', async () => {
    loggedUser = '1';
    await con.getRepository(ArticlePost).save({
      id: 'cpp-post',
      title: 'Learn C++ programming',
      shortId: 'cpp',
      url: 'http://cpp.com',
      sourceId: 'a',
      visible: true,
    });
    await con.getRepository(View).save({
      userId: loggedUser,
      timestamp: now,
      postId: 'cpp-post',
    });
    const res = await client.query(QUERY('c++'));
    expect(res.data.searchReadingHistorySuggestions.query).toBe('c++');
    expect(
      res.data.searchReadingHistorySuggestions.hits.length,
    ).toBeGreaterThan(0);
  });

  it('should handle special characters in search (C#)', async () => {
    loggedUser = '1';
    await con.getRepository(ArticlePost).save({
      id: 'csharp-post',
      title: 'Learn C# programming',
      shortId: 'csharp',
      url: 'http://csharp.com',
      sourceId: 'a',
      visible: true,
    });
    await con.getRepository(View).save({
      userId: loggedUser,
      timestamp: now,
      postId: 'csharp-post',
    });
    const res = await client.query(QUERY('c#'));
    expect(res.data.searchReadingHistorySuggestions.query).toBe('c#');
    expect(
      res.data.searchReadingHistorySuggestions.hits.length,
    ).toBeGreaterThan(0);
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
        timezone
        experienceLevel
        language
      }
    }
  `;

  it('should not authorize when not logged in', async () =>
    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { data: { username: 'Test' } } },
      'UNAUTHENTICATED',
    ));

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

  it('should not allow invalid timezone', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { data: { timezone: 'Europe/Trondheim' } },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should update user profile', async () => {
    loggedUser = '1';

    const repo = con.getRepository(User);
    const user = await repo.findOneBy({ id: loggedUser });
    const timezone = 'Europe/London';
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

  it('should update marketing notification flags', async () => {
    loggedUser = '1';

    const repo = con.getRepository(User);

    const res1 = await client.mutate(MUTATION, {
      variables: { data: { acceptedMarketing: false } },
    });

    expect(res1.errors?.length).toBeFalsy();
    const updatedUser1 = await repo.findOneBy({ id: loggedUser });
    expect(updatedUser1?.notificationFlags.marketing.email).toEqual('muted');
    expect(updatedUser1?.notificationFlags.marketing.inApp).toEqual('muted');

    loggedUser = '2';

    const res2 = await client.mutate(MUTATION, {
      variables: { data: { acceptedMarketing: true } },
    });

    expect(res2.errors?.length).toBeFalsy();
    const updatedUser2 = await repo.findOneBy({ id: loggedUser });
    expect(updatedUser2?.notificationFlags.marketing.email).toEqual(
      'subscribed',
    );
    expect(updatedUser2?.notificationFlags.marketing.inApp).toEqual(
      'subscribed',
    );
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

    const email = 'SamPle@daily.dev';
    expect(user?.infoConfirmed).toBeFalsy();
    const res = await client.mutate(MUTATION, {
      variables: { data: { email, username: 'uuu1', name: user.name } },
    });
    expect(res.errors?.length).toBeFalsy();
    const updatedUser = await repo.findOneBy({ id: loggedUser });
    expect(updatedUser?.email).toEqual(email.toLowerCase());
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

  it('should update user profile and change language', async () => {
    loggedUser = '1';

    const repo = con.getRepository(User);
    const user = await repo.findOneBy({ id: loggedUser });

    const language = 'de';
    expect(user!.language).toBeNull();
    const res = await client.mutate(MUTATION, {
      variables: {
        data: { language, username: 'uuu1', name: user!.name },
      },
    });
    expect(res.errors?.length).toBeFalsy();
    const updatedUser = await repo.findOneBy({ id: loggedUser });
    expect(updatedUser!.language).toEqual(language);
  });

  it('should not update user profile if language is invalid', async () => {
    loggedUser = '1';

    const repo = con.getRepository(User);
    const user = await repo.findOneBy({ id: loggedUser });

    const language = 'klingon';
    expect(user!.language).toBeNull();

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          data: { language, username: 'uuu1', name: user!.name },
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );

    const updatedUser = await repo.findOneBy({ id: loggedUser });
    expect(updatedUser!.language).toEqual(null);
  });

  it('should not update if username is empty', async () => {
    loggedUser = '1';

    await con
      .getRepository(User)
      .update({ id: loggedUser }, { username: null });

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

  it('should not update user profile if email exists (case insensitive)', async () => {
    loggedUser = '1';

    const repo = con.getRepository(User);
    await repo.update({ id: '2' }, { email: 'SamPlE@daily.dev' });

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { data: { email: 'sAMple@daily.dev' } },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should validate github handle', () => {
    const valid = [
      'lee',
      '@lee',
      'github.com/lee',
      'https://github.com/lee',
      'https://github.com/lee/',
    ];
    const invalid = [
      'lee#',
      'http://github.com/lee',
      'http://github.com',
      'github.com',
      'https://example.com/lee',
      'https://github.com/lee?bla=1',
    ];

    valid.forEach((item) => {
      const result = githubSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('lee');
    });

    invalid.forEach((item) => {
      expect(githubSchema.safeParse(item).success).toBe(false);
    });
  });

  it('should validate twitter handle', () => {
    const valid = [
      'lee',
      '@lee',
      'x.com/lee',
      'https://x.com/lee',
      'https://x.com/lee/',
      'twitter.com/lee',
      'https://twitter.com/lee',
      'https://twitter.com/lee/',
    ];
    const invalid = [
      'lee#',
      'http://twitter.com/lee',
      'http://x.com/lee',
      'http://twitter.com',
      'http://x.com',
      'twitter.com',
      'x.com',
      'https://example.com/u/lee',
      'https://twitter.com/lee?bla=1',
      'https://x.com/lee?bla=1',
    ];

    valid.forEach((item) => {
      const result = twitterSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('lee');
    });

    invalid.forEach((item) => {
      expect(twitterSchema.safeParse(item).success).toBe(false);
    });
  });

  it('should validate bluesky handle', () => {
    const valid = [
      'https://bsky.app/profile/amar.com',
      'https://bsky.app/profile/amartrebinjac.bsky.social',
      'bsky.app/profile/user.example.com',
      'www.bsky.app/profile/test.bsky.social',
      'amar.com',
      'amartrebinjac.bsky.social',
      'user.example.com',
    ];

    const invalid = [
      'https://bsky.app/amar.com',
      'https://bsky.app/amar/',
      'https://bsky.app/',
      '#amar.com',
    ];

    valid.forEach((item) => {
      expect(blueskySchema.safeParse(item).success).toBe(true);
    });

    invalid.forEach((item) => {
      expect(blueskySchema.safeParse(item).success).toBe(false);
    });
  });

  it('should validate roadmap handle', () => {
    const valid = [
      'lee',
      'roadmap.sh/u/lee',
      'https://roadmap.sh/u/lee',
      'https://roadmap.sh/u/lee/',
    ];
    const invalid = [
      'lee#',
      'http://roadmap.sh/lee',
      'http://roadmap.sh',
      'roadmap.sh',
      'https://example.com/u/lee',
      'https://roadmap.sh/lee?bla=1',
    ];

    valid.forEach((item) => {
      const result = roadmapSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('lee');
    });

    invalid.forEach((item) => {
      expect(roadmapSchema.safeParse(item).success).toBe(false);
    });
  });

  it('should validate threads handle', () => {
    const valid = [
      'lee',
      '@lee',
      'threads.net/lee',
      'https://threads.net/@lee',
      'https://threads.net/@lee/',
      'https://threads.net/lee',
      'https://threads.net/lee/',
    ];
    const invalid = [
      'lee#',
      'http://threads.net/lee',
      'http://threads.net',
      'threads.net',
      'https://example.com/@lee',
      'https://example.com/lee',
      'https://threads.net/lee?bla=1',
    ];

    valid.forEach((item) => {
      const result = threadsSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('lee');
    });

    invalid.forEach((item) => {
      expect(threadsSchema.safeParse(item).success).toBe(false);
    });
  });

  it('should validate codepen handle', () => {
    const valid = [
      'lee',
      'codepen.io/lee',
      'https://codepen.io/lee',
      'https://codepen.io/lee/',
    ];
    const invalid = [
      'lee#',
      'http://codepen.io/lee',
      'http://codepen.io',
      'codepen.io',
      'https://example.com/lee',
      'https://codepen.io/lee?bla=1',
    ];

    valid.forEach((item) => {
      const result = codepenSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('lee');
    });

    invalid.forEach((item) => {
      expect(codepenSchema.safeParse(item).success).toBe(false);
    });
  });

  it('should validate reddit handle', () => {
    const valid = [
      'lee',
      'reddit.com/u/lee',
      'reddit.com/user/lee',
      'https://reddit.com/u/lee',
      'https://reddit.com/u/lee/',
      'https://reddit.com/user/lee',
      'https://reddit.com/user/lee/',
    ];
    const invalid = [
      'lee#',
      'http://reddit.com/lee',
      'http://reddit.com',
      'reddit.com',
      'https://example.com/u/lee',
      'https://reddit.com/user/lee?bla=1',
    ];

    valid.forEach((item) => {
      const result = redditSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('lee');
    });

    invalid.forEach((item) => {
      expect(redditSchema.safeParse(item).success).toBe(false);
    });
  });

  it('should validate stackoverflow handle', () => {
    const valid = [
      'stackoverflow.com/users/999999/lee',
      'https://stackoverflow.com/users/999999/lee',
      'https://stackoverflow.com/users/999999/lee/',
      '999999/lee',
    ];
    const invalid = [
      'lee',
      'lee#',
      'http://stackoverflow.com/lee',
      'http://stackoverflow.com',
      'stackoverflow.com',
      'https://example.com/users/lee',
      'https://example.com/users/999999/lee',
      'kfdfsfs/lee',
      'https://stackoverflow.com/users/999999/lee?bla=1',
    ];

    valid.forEach((item) => {
      const result = stackoverflowSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('999999/lee');
    });

    invalid.forEach((item) => {
      expect(stackoverflowSchema.safeParse(item).success).toBe(false);
    });
  });

  it('should validate linkedin handle', () => {
    const valid: Array<[string, string]> = [
      ['lee', 'lee'],
      ['linkedin.com/in/lee', 'lee'],
      ['https://linkedin.com/in/lee', 'lee'],
      ['https://linkedin.com/in/lee/', 'lee'],
      // Unicode/accented characters (issue #1507)
      ['ítalo-oliveira-800923162', 'ítalo-oliveira-800923162'],
      [
        'https://linkedin.com/in/ítalo-oliveira-800923162',
        'ítalo-oliveira-800923162',
      ],
    ];
    const invalid = [
      'lee#',
      'http://linkedin.com/lee',
      'http://linkedin.com',
      'linkedin.com',
      'https://example.com/in/lee',
      'https://linkedin.com/in/lee?bla=1',
    ];

    valid.forEach(([input, expected]) => {
      const result = linkedinSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe(expected);
    });

    invalid.forEach((item) => {
      expect(linkedinSchema.safeParse(item).success).toBe(false);
    });
  });

  it('should validate mastodon handle', () => {
    const valid = [
      'https://mastodon.social/@lee',
      'https://selfhostedmastodon.dev/@lee',
      'https://selfhostedmastodon.dev/@lee/',
    ];
    const invalid = [
      'lee#',
      'http://mastodon.social/lee',
      'http://mastodon.social',
      'mastodon.sh',
      'https://mastodon.social/@lee?bla=1',
      'mastodon.social/@lee',
    ];

    valid.forEach((item) => {
      const result = mastodonSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe(item);
    });

    invalid.forEach((item) => {
      expect(mastodonSchema.safeParse(item).success).toBe(false);
    });
  });

  it('should validate portfolio link', () => {
    const valid = [
      'https://example.com',
      'https://example.com/',
      'https://example.com?bla=1',
      'https://example.com/portfolio?bla=1',
      'https://example.com/portfolio',
      'https://example.com/portfolio/design',
      'https://example.com/portfolio/design/',
      'https://example.com/portfolio?bla=1&da=2',
      'https://example.com/portfolio/?bla=1&da=2',
    ];
    const invalid = [
      'lee#',
      '//example.com',
      '/example.com',
      'example.com/',
      'http://example.com',
      'example.com',
      'ftp://example.com/portfolio',
    ];

    valid.forEach((item) => {
      const result = portfolioSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe(item);
    });

    invalid.forEach((item) => {
      expect(portfolioSchema.safeParse(item).success).toBe(false);
    });
  });

  it('should throw validation error if portfolio is larger then limit', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: MUTATION,
        variables: {
          data: { portfolio: new Array(portfolioLimit).fill('a').join('') },
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should update showPlusGift flag', async () => {
    loggedUser = '1';
    await con.getRepository(User).update(
      { id: loggedUser },
      {
        flags: updateFlagsStatement({
          showPlusGift: true,
          vordr: true,
          trustScore: 0.9,
        }),
      },
    );
    const res = await client.mutate(MUTATION, {
      variables: {
        data: { flags: { showPlusGift: false } },
      },
    });
    expect(res.errors).toBeFalsy();

    const updated = await con.getRepository(User).findOneBy({ id: loggedUser });
    expect(updated?.flags.showPlusGift).toBe(false);
    expect(updated?.flags.vordr).toBe(true);
    expect(updated?.flags.trustScore).toBe(0.9);
  });

  it('should update socialLinks with auto-detected platforms', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        data: {
          socialLinks: [
            { url: 'https://github.com/testuser' },
            { url: 'https://twitter.com/testhandle' },
          ],
        },
      },
    });

    expect(res.errors).toBeFalsy();

    const updated = await con.getRepository(User).findOneBy({ id: loggedUser });
    expect(updated?.socialLinks).toEqual([
      { platform: 'github', url: 'https://github.com/testuser' },
      { platform: 'twitter', url: 'https://twitter.com/testhandle' },
    ]);
  });

  it('should update socialLinks with explicit platform override', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        data: {
          socialLinks: [
            { url: 'https://example.com/profile', platform: 'custom' },
          ],
        },
      },
    });

    expect(res.errors).toBeFalsy();

    const updated = await con.getRepository(User).findOneBy({ id: loggedUser });
    expect(updated?.socialLinks).toEqual([
      { platform: 'custom', url: 'https://example.com/profile' },
    ]);
  });

  it('should dual-write to legacy columns when updating socialLinks', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        data: {
          socialLinks: [
            { url: 'https://github.com/myhandle' },
            { url: 'https://linkedin.com/in/myprofile' },
          ],
        },
      },
    });

    expect(res.errors).toBeFalsy();

    const updated = await con.getRepository(User).findOneBy({ id: loggedUser });
    expect(updated?.github).toBe('myhandle');
    expect(updated?.linkedin).toBe('myprofile');
  });

  it('should clear socialLinks when empty array is provided', async () => {
    loggedUser = '1';

    // First set some social links
    await con.getRepository(User).update(
      { id: loggedUser },
      {
        socialLinks: [{ platform: 'github', url: 'https://github.com/test' }],
      },
    );

    // Then clear them
    const res = await client.mutate(MUTATION, {
      variables: {
        data: {
          socialLinks: [],
        },
      },
    });

    expect(res.errors).toBeFalsy();

    const updated = await con.getRepository(User).findOneBy({ id: loggedUser });
    expect(updated?.socialLinks).toEqual([]);
  });

  it('should reverse dual-write: update socialLinks when legacy fields are provided', async () => {
    loggedUser = '1';

    // Use legacy format (individual fields)
    const res = await client.mutate(MUTATION, {
      variables: {
        data: {
          github: 'myhandle',
          linkedin: 'myprofile',
        },
      },
    });

    expect(res.errors).toBeFalsy();

    // Verify socialLinks JSONB is populated with full URLs
    const updated = await con.getRepository(User).findOneBy({ id: loggedUser });
    expect(updated?.socialLinks).toEqual(
      expect.arrayContaining([
        { platform: 'github', url: 'https://github.com/myhandle' },
        { platform: 'linkedin', url: 'https://linkedin.com/in/myprofile' },
      ]),
    );
  });
});

describe('mutation deleteUser', () => {
  const MUTATION = /* GraphQL */ `
    mutation deleteUser {
      deleteUser {
        _
      }
    }
  `;

  beforeEach(async () => {
    await con.getRepository(User).save([ghostUser]);
  });

  it('should not authorize when not logged in', async () =>
    await testMutationErrorCode(
      client,
      { mutation: MUTATION },
      'UNAUTHENTICATED',
    ));

  it('should delete user from database', async () => {
    loggedUser = '1';

    await client.mutate(MUTATION);

    const users = await con.getRepository(User).find();
    expect(users.length).toEqual(4);

    const userOne = await con.getRepository(User).findOneBy({ id: '1' });
    expect(userOne).toEqual(null);
  });

  it('should delete author ID from post', async () => {
    loggedUser = '1';

    await client.mutate(MUTATION);

    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post.authorId).toEqual(null);
  });

  it('should delete scout ID from post', async () => {
    loggedUser = '1';

    await client.mutate(MUTATION);

    const post = await con.getRepository(Post).findOneBy({ id: 'p6' });
    expect(post.authorId).toEqual(null);
  });

  it('should cancel paddle subscription for user', async () => {
    loggedUser = '1';

    await con.getRepository(User).update(
      { id: '1' },
      {
        subscriptionFlags: updateSubscriptionFlags({
          subscriptionId: '123',
          provider: SubscriptionProvider.Paddle,
        }),
      },
    );

    await client.mutate(MUTATION);

    expect(cancelSubscription).toHaveBeenCalledWith({ subscriptionId: '123' });
    const userOne = await con.getRepository(User).findOneBy({ id: '1' });
    expect(userOne).toEqual(null);
  });

  it('should not call cancel subscription for gifted subscription', async () => {
    loggedUser = '1';

    await con.getRepository(User).update(
      { id: '1' },
      {
        subscriptionFlags: updateSubscriptionFlags({
          subscriptionId: '123',
          provider: SubscriptionProvider.Paddle,
          giftExpirationDate: new Date(Date.now() + 86400000), // 1 day from now
        }),
      },
    );

    await client.mutate(MUTATION);

    expect(cancelSubscription).not.toHaveBeenCalled();
    const userOne = await con.getRepository(User).findOneBy({ id: '1' });
    expect(userOne).toEqual(null);
  });

  describe('when user has a storekit subscription', () => {
    beforeEach(async () => {
      await saveFixtures(con, User, [
        {
          id: 'sk-del-user-0',
          username: 'sk-del-user-0',
          subscriptionFlags: {
            appAccountToken: '7e3fb20b-4cdb-47cc-936d-99d65f608138',
          },
        },
      ]);
    });

    afterEach(async () => {
      await saveFixtures(con, User, [
        {
          id: 'sk-del-user-0',
          username: 'sk-del-user-0',
          subscriptionFlags: {},
        },
      ]);
    });

    it('should not delete user if storekit subscription is active', async () => {
      loggedUser = 'sk-del-user-0';

      await con.getRepository(User).update(
        { id: 'sk-del-user-0' },
        {
          subscriptionFlags: updateSubscriptionFlags({
            subscriptionId: '123',
            provider: SubscriptionProvider.AppleStoreKit,
            status: SubscriptionStatus.Active,
          }),
        },
      );

      await testMutationErrorCode(client, { mutation: MUTATION }, 'UNEXPECTED');

      expect(cancelSubscription).toHaveBeenCalledTimes(0);
      const userOne = await con
        .getRepository(User)
        .findOneBy({ id: 'sk-del-user-0' });
      expect(userOne).not.toEqual(null);
    });

    it('should delete user if storekit subscription is cancelled', async () => {
      loggedUser = 'sk-del-user-0';

      await con.getRepository(User).update(
        { id: 'sk-del-user-0' },
        {
          subscriptionFlags: updateSubscriptionFlags({
            subscriptionId: '123',
            provider: SubscriptionProvider.AppleStoreKit,
            status: SubscriptionStatus.Cancelled,
          }),
        },
      );

      await client.mutate(MUTATION);

      expect(cancelSubscription).toHaveBeenCalledTimes(0);
      const userOne = await con
        .getRepository(User)
        .findOneBy({ id: 'sk-del-user-0' });
      expect(userOne).toEqual(null);
    });

    it('should delete user if storekit subscription is expired', async () => {
      loggedUser = 'sk-del-user-0';

      await con.getRepository(User).update(
        { id: 'sk-del-user-0' },
        {
          subscriptionFlags: updateSubscriptionFlags({
            subscriptionId: '123',
            provider: SubscriptionProvider.AppleStoreKit,
            status: SubscriptionStatus.Expired,
          }),
        },
      );

      await client.mutate(MUTATION);

      expect(cancelSubscription).toHaveBeenCalledTimes(0);
      const userOne = await con
        .getRepository(User)
        .findOneBy({ id: 'sk-del-user-0' });
      expect(userOne).toEqual(null);
    });
  });

  it('should set user transactions to ghost', async () => {
    loggedUser = '1';

    const userTransactions = await con.getRepository(UserTransaction).save([
      {
        id: '962c880f-7523-426c-b02f-e5695e94d77f',
        processor: UserTransactionProcessor.Njord,
        receiverId: '1',
        status: UserTransactionStatus.Success,
        productId: null,
        senderId: '2',
        fee: 0,
        value: 100,
        valueIncFees: 100,
      },
      {
        id: '4f2e8ff9-4489-466b-9296-87630839fdac',
        processor: UserTransactionProcessor.Njord,
        receiverId: '2',
        status: UserTransactionStatus.Success,
        productId: null,
        senderId: '1',
        fee: 0,
        value: 100,
        valueIncFees: 100,
      },
    ]);

    await client.mutate(MUTATION);

    const transactions = await con.getRepository(UserTransaction).findBy({
      id: In(userTransactions.map((t) => t.id)),
    });

    expect(transactions.length).toEqual(2);
    expect(
      transactions.find((t) => t.id === '962c880f-7523-426c-b02f-e5695e94d77f')!
        .receiverId,
    ).toEqual(ghostUser.id);
    expect(
      transactions.find((t) => t.id === '4f2e8ff9-4489-466b-9296-87630839fdac')!
        .senderId,
    ).toEqual(ghostUser.id);
  });

  it('should soft delete user', async () => {
    loggedUser = '1';

    const user = await con.getRepository(User).findOneBy({ id: '1' });

    expect(user).not.toBeNull();

    await client.mutate(MUTATION);

    const deletedUser = await con
      .getRepository(DeletedUser)
      .findOneBy({ id: '1' });
    expect(deletedUser).not.toBeNull();
  });

  describe('deleting user resume', () => {
    it('should delete user resume if it exists', async () => {
      loggedUser = '1';

      await client.mutate(MUTATION);

      // Verify we requested delete action for every extension supported
      expect(deleteFileFromBucket).toHaveBeenCalledWith(
        expect.any(Bucket),
        loggedUser,
      );
    });

    it('should handle case when user has no resume', async () => {
      loggedUser = '1';

      // Mock that the resume file doesn't exist

      await client.mutate(MUTATION);

      // Verify the function was called but no error was thrown
      expect(deleteFileFromBucket).toHaveBeenCalledWith(
        expect.any(Bucket),
        loggedUser,
      );

      // User should still be deleted
      const userOne = await con.getRepository(User).findOneBy({ id: '1' });
      expect(userOne).toEqual(null);
    });
  });

  describe('deleting user employment agreement', () => {
    it('should delete user employment agreement if it exists', async () => {
      loggedUser = '1';

      await client.mutate(MUTATION);

      // Verify we requested delete action for every extension supported
      expect(deleteFileFromBucket).toHaveBeenCalledWith(
        expect.any(Bucket),
        'employment-agreement/1',
      );
    });

    it('should handle case when user has no employment agreement', async () => {
      loggedUser = '1';

      await client.mutate(MUTATION);

      // Verify the function was called but no error was thrown
      expect(deleteFileFromBucket).toHaveBeenCalledWith(
        expect.any(Bucket),
        'employment-agreement/1',
      );

      // User should still be deleted
      const userOne = await con.getRepository(User).findOneBy({ id: '1' });
      expect(userOne).toEqual(null);
    });
  });

  describe('opportunity and organization cleanup', () => {
    const testUserId = 'opp-cleanup-user';
    const testUserId2 = 'opp-cleanup-user-2';

    beforeEach(async () => {
      await saveFixtures(con, User, [
        { id: testUserId, username: testUserId },
        { id: testUserId2, username: testUserId2 },
      ]);
    });

    it('should block deletion when organization has active subscription', async () => {
      loggedUser = testUserId;
      const oppId = randomUUID();
      const orgId = randomUUID();

      await con.getRepository(Organization).save({
        id: orgId,
        name: `Test Org ${orgId}`,
        recruiterSubscriptionFlags: { status: SubscriptionStatus.Active },
      });
      await con.getRepository(OpportunityJob).save({
        id: oppId,
        type: OpportunityType.JOB,
        state: OpportunityState.DRAFT,
        title: 'Test Opportunity',
        tldr: 'Test',
        content: {},
        meta: {},
        flags: {},
        organizationId: orgId,
      });
      await con.getRepository(OpportunityUser).save({
        opportunityId: oppId,
        userId: testUserId,
        type: OpportunityUserType.Recruiter,
      });

      await testMutationErrorCode(
        client,
        { mutation: MUTATION },
        'CONFLICT',
        'Cannot delete your account because one of your organizations has an active recruiter subscription. Please cancel the subscription first.',
      );

      expect(
        await con.getRepository(User).findOneBy({ id: testUserId }),
      ).not.toBeNull();
      expect(
        await con.getRepository(Opportunity).findOneBy({ id: oppId }),
      ).not.toBeNull();
      expect(
        await con.getRepository(Organization).findOneBy({ id: orgId }),
      ).not.toBeNull();
    });
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
    await con.getRepository(User).save([ghostUser]);
  });

  it('should not authorize when not logged in', async () => {
    await request(app.server).delete(BASE_PATH).expect(401);
  });

  it('should delete user from database', async () => {
    mockLogout();
    await authorizeRequest(request(app.server).delete(BASE_PATH)).expect(204);

    const users = await con.getRepository(User).find();
    expect(users.length).toEqual(4);

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
      campaign: InviteCampaignType.Search,
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
      campaign: InviteCampaignType.Search,
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
  const MUTATION = `mutation SubscribePersonalizedDigest($hour: Int, $day: Int, $type: DigestType, $sendType: UserPersonalizedDigestSendType) {
    subscribePersonalizedDigest(hour: $hour, day: $day, type: $type, sendType: $sendType) {
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

    expect(
      jest.mocked(identifyUserPersonalizedDigest).mock.calls[0][0],
    ).toEqual({
      cio: expect.any(Object),
      userId: '1',
      subscribed: true,
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

  it('should subscribe to brief', async () => {
    loggedUser = '1';
    isPlus = true;

    const res = await client.mutate(MUTATION, {
      variables: {
        type: UserPersonalizedDigestType.Brief,
        sendType: UserPersonalizedDigestSendType.daily,
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.subscribePersonalizedDigest).toMatchObject({
      preferredDay: DayOfWeek.Monday,
      preferredHour: 9,
    });
    const digest = await con.getRepository(UserPersonalizedDigest).findOneBy({
      userId: loggedUser,
      type: UserPersonalizedDigestType.Brief,
    });
    expect(digest).toBeDefined();
    expect(digest!.flags).toEqual({
      sendType: UserPersonalizedDigestSendType.daily,
    });
  });

  it('should not subscribe to brief when user is not plus member', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          type: UserPersonalizedDigestType.Brief,
        },
      },
      'CONFLICT',
    );
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

    expect(
      jest.mocked(identifyUserPersonalizedDigest).mock.calls[0][0],
    ).toEqual({
      cio: expect.any(Object),
      userId: '1',
      subscribed: false,
    });
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
      campaign: InviteCampaignType.Search,
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
          feature: InviteCampaignType.Search,
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
          feature: InviteCampaignType.Search,
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
          feature: InviteCampaignType.Search,
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
        feature: InviteCampaignType.Search,
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
        feature: InviteCampaignType.Search,
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
        feature: InviteCampaignType.Search,
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
        feature: InviteCampaignType.Search,
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
    await con.getRepository(User).createQueryBuilder().delete().execute();
    const repo = con.getRepository(Alerts);
    await repo.clear();
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

describe('query userIntegration', () => {
  const QUERY = `
  query UserIntegration($id: ID!) {
    userIntegration(id: $id) {
      id
      type
      name
      userId
    }
  }
`;

  it('should require authentication', async () => {
    await testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { id: '5e061c07-d0ee-4f03-84b1-d53daad4b317' },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should return user integration', async () => {
    loggedUser = '1';
    const createdAt = new Date();

    await con.getRepository(UserIntegration).save({
      id: '5e061c07-d0ee-4f03-84b1-d53daad4b317',
      userId: '1',
      type: UserIntegrationType.Slack,
      createdAt: addSeconds(createdAt, 3),
      name: 'daily.dev',
      meta: {
        appId: 'sapp1',
        scope: 'channels:read,chat:write,channels:join',
        teamId: 'st1',
        teamName: 'daily.dev',
        tokenType: 'bot',
        accessToken: await encrypt(
          'xoxb-token',
          process.env.SLACK_DB_KEY as string,
        ),
        slackUserId: 'su1',
      },
    });

    const res = await client.query(QUERY, {
      variables: {
        id: '5e061c07-d0ee-4f03-84b1-d53daad4b317',
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.userIntegration).toMatchObject({
      id: expect.any(String),
      type: UserIntegrationType.Slack,
      name: 'daily.dev',
      userId: '1',
    });
  });

  it('should not return user integration if from different user', async () => {
    loggedUser = '1';
    const createdAt = new Date();

    await con.getRepository(UserIntegration).save({
      id: '5e061c07-d0ee-4f03-84b1-d53daad4b317',
      userId: '2',
      type: UserIntegrationType.Slack,
      createdAt: addSeconds(createdAt, 3),
      name: 'daily.dev',
      meta: {
        appId: 'sapp1',
        scope: 'channels:read,chat:write,channels:join',
        teamId: 'st1',
        teamName: 'daily.dev',
        tokenType: 'bot',
        accessToken: await encrypt(
          'xoxb-token',
          process.env.SLACK_DB_KEY as string,
        ),
        slackUserId: 'su1',
      },
    });

    const res = await client.query(QUERY, {
      variables: {
        id: '5e061c07-d0ee-4f03-84b1-d53daad4b317',
      },
    });
    expect(res.errors).toBeTruthy();
    expect(res.errors[0].extensions.code).toEqual('NOT_FOUND');
  });
});

describe('query userIntegrations', () => {
  const QUERY = `
  query UserIntegrations {
    userIntegrations {
      edges {
        node {
          id
          type
          name
          userId
        }
      }
    }
  }
`;

  it('should require authentication', async () => {
    await testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED');
  });

  it('should return user integrations', async () => {
    loggedUser = '1';
    const createdAt = new Date();

    await con.getRepository(UserIntegration).save([
      {
        userId: '1',
        type: UserIntegrationType.Slack,
        createdAt: addSeconds(createdAt, 3),
        name: 'daily.dev',
        meta: {
          appId: 'sapp1',
          scope: 'channels:read,chat:write,channels:join',
          teamId: 'st1',
          teamName: 'daily.dev',
          tokenType: 'bot',
          accessToken: await encrypt(
            'xoxb-token',
            process.env.SLACK_DB_KEY as string,
          ),
          slackUserId: 'su1',
        },
      },
      {
        userId: '1',
        type: UserIntegrationType.Slack,
        createdAt: addSeconds(createdAt, 2),
        name: 'daily.dev',
        meta: {
          appId: 'sapp2',
          scope: 'channels:read,chat:write,channels:join',
          teamId: 'st2',
          teamName: 'example team',
          tokenType: 'bot',
          accessToken: await encrypt(
            'xoxb-token2',
            process.env.SLACK_DB_KEY as string,
          ),
          slackUserId: 'su2',
        },
      },
      {
        userId: '1',
        type: UserIntegrationType.Slack,
        createdAt: addSeconds(createdAt, 1),
        name: 'daily.dev',
        meta: {
          appId: 'sapp2',
          scope: 'channels:read,chat:write,channels:join',
          teamId: 'st2',
          tokenType: 'bot',
          accessToken: await encrypt(
            'xoxb-token3',
            process.env.SLACK_DB_KEY as string,
          ),
          slackUserId: 'su2',
        },
      },
    ]);

    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data.userIntegrations).toMatchObject({
      edges: [
        {
          node: {
            id: expect.any(String),
            type: UserIntegrationType.Slack,
            name: 'daily.dev',
            userId: '1',
          },
        },
        {
          node: {
            id: expect.any(String),
            type: UserIntegrationType.Slack,
            name: 'example team',
            userId: '1',
          },
        },
        {
          node: {
            id: expect.any(String),
            type: UserIntegrationType.Slack,
            name: expect.stringContaining('Slack '),
            userId: '1',
          },
        },
      ],
    });
  });
});

describe('mutation sendReport', () => {
  const MUTATION = `
    mutation SendReport($type: ReportEntity!, $id: ID!, $reason: ReportReason!, $comment: String, $tags: [String]) {
      sendReport(type: $type, id: $id, reason: $reason, comment: $comment, tags: $tags) {
        _
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { type: 'post', id: 'p1', reason: 'BROKEN' },
      },
      'UNAUTHENTICATED',
    ));

  describe('post report entity', () => {
    const variables = {
      type: 'post',
      id: 'p1',
      reason: 'BROKEN',
      comment: 'Test comment',
    };

    it('should throw not found when cannot find post', () => {
      loggedUser = '1';
      return testMutationErrorCode(
        client,
        {
          mutation: MUTATION,
          variables: { ...variables, id: 'invalid' },
        },
        'NOT_FOUND',
      );
    });

    it('should throw error when user cannot access the post', async () => {
      loggedUser = '1';
      await con.getRepository(Source).update({ id: 'a' }, { private: true });
      return testMutationErrorCode(
        client,
        { mutation: MUTATION, variables },
        'FORBIDDEN',
      );
    });

    it('should report post with comment', async () => {
      loggedUser = '1';
      const res = await client.mutate(MUTATION, { variables });
      expect(res.errors).toBeFalsy();
      const actualUserPost = await con.getRepository(UserPost).findOneBy({
        userId: loggedUser,
        postId: 'p1',
      });
      expect(actualUserPost).toMatchObject({
        userId: loggedUser,
        postId: 'p1',
        hidden: true,
      });
      expect(
        await con
          .getRepository(PostReport)
          .findOneBy({ userId: loggedUser, postId: 'p1' }),
      ).toEqual({
        postId: 'p1',
        userId: '1',
        createdAt: expect.anything(),
        reason: 'BROKEN',
        tags: null,
        comment: 'Test comment',
      });
    });

    it('should report post without comment', async () => {
      loggedUser = '1';
      const res = await client.mutate(MUTATION, {
        variables: { ...variables, comment: undefined },
      });
      expect(res.errors).toBeFalsy();
      const actualUserPost = await con.getRepository(UserPost).findOneBy({
        userId: loggedUser,
        postId: 'p1',
      });
      expect(actualUserPost).toMatchObject({
        userId: loggedUser,
        postId: 'p1',
        hidden: true,
      });
      expect(
        await con
          .getRepository(PostReport)
          .findOneBy({ userId: loggedUser, postId: 'p1' }),
      ).toEqual({
        postId: 'p1',
        userId: '1',
        createdAt: expect.anything(),
        reason: 'BROKEN',
        tags: null,
        comment: null,
      });
    });

    it('should ignore conflicts', async () => {
      loggedUser = '1';
      await con.getRepository(UserPost).save({
        userId: loggedUser,
        postId: 'p1',
        hidden: true,
      });
      const res = await client.mutate(MUTATION, { variables });
      expect(res.errors).toBeFalsy();
      const actualUserPost = await con.getRepository(UserPost).findOneBy({
        userId: loggedUser,
        postId: 'p1',
      });
      expect(actualUserPost).toMatchObject({
        userId: loggedUser,
        postId: 'p1',
        hidden: true,
      });
    });

    it('should save all the irrelevant tags', async () => {
      loggedUser = '1';
      const tags = ['js', 'react'];
      const res = await client.mutate(MUTATION, {
        variables: {
          ...variables,
          comment: undefined,
          reason: 'IRRELEVANT',
          tags,
        },
      });
      expect(res.errors).toBeFalsy();
      const actualUserPost = await con.getRepository(UserPost).findOneBy({
        userId: loggedUser,
        postId: 'p1',
      });
      expect(actualUserPost).toMatchObject({
        userId: loggedUser,
        postId: 'p1',
        hidden: true,
      });
      expect(
        await con
          .getRepository(PostReport)
          .findOneBy({ userId: loggedUser, postId: 'p1' }),
      ).toEqual({
        postId: 'p1',
        userId: '1',
        createdAt: expect.anything(),
        reason: 'IRRELEVANT',
        tags,
        comment: null,
      });
    });

    it('should throw an error if there is no irrelevant tags when the reason is IRRELEVANT', async () => {
      loggedUser = '1';

      await testMutationErrorCode(
        client,
        {
          mutation: MUTATION,
          variables: { ...variables, tags: [], reason: 'IRRELEVANT' },
        },
        'GRAPHQL_VALIDATION_FAILED',
      );

      return testMutationErrorCode(
        client,
        {
          mutation: MUTATION,
          variables: { ...variables, id: 'p1', reason: 'IRRELEVANT' },
        },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('should save report if post is hidden already', async () => {
      loggedUser = '1';
      await con.getRepository(UserPost).save({
        userId: loggedUser,
        postId: 'p1',
        hidden: true,
      });
      const res = await client.mutate(MUTATION, { variables });
      expect(res.errors).toBeFalsy();
      const actual = await con.getRepository(PostReport).findOne({
        where: { userId: loggedUser },
        select: ['postId', 'userId'],
      });
      expect(actual).toEqual({
        postId: 'p1',
        userId: '1',
      });
    });
  });

  describe('source report entity', () => {
    const variables = {
      type: 'source',
      id: 'a',
      reason: 'SPAM',
      comment: 'Test comment',
    };

    it('should throw not found when cannot find source', () => {
      loggedUser = '1';
      return testMutationErrorCode(
        client,
        {
          mutation: MUTATION,
          variables: { ...variables, id: 'invalid' },
        },
        'NOT_FOUND',
      );
    });

    it('should throw error when user cannot access the source', async () => {
      loggedUser = '1';
      await con.getRepository(Source).update({ id: 'a' }, { private: true });
      return testMutationErrorCode(
        client,
        { mutation: MUTATION, variables },
        'FORBIDDEN',
      );
    });

    it('should report private source as a member', async () => {
      loggedUser = '1';
      await con.getRepository(Source).update({ id: 'a' }, { private: true });
      await con.getRepository(SourceMember).save({
        userId: loggedUser,
        sourceId: 'a',
        role: SourceMemberRoles.Member,
        referralToken: 't1',
      });
      const res = await client.mutate(MUTATION, { variables });
      expect(res.errors).toBeFalsy();

      const report = await con
        .getRepository(SourceReport)
        .findOneBy({ userId: loggedUser, sourceId: 'a' });

      expect(report).toEqual({
        sourceId: 'a',
        userId: '1',
        createdAt: expect.anything(),
        reason: 'SPAM',
        comment: 'Test comment',
      });
    });

    it('should report source with comment', async () => {
      loggedUser = '1';
      const res = await client.mutate(MUTATION, { variables });
      expect(res.errors).toBeFalsy();

      const report = await con
        .getRepository(SourceReport)
        .findOneBy({ userId: loggedUser, sourceId: 'a' });

      expect(report).toEqual({
        sourceId: 'a',
        userId: '1',
        createdAt: expect.anything(),
        reason: 'SPAM',
        comment: 'Test comment',
      });
    });

    it('should report source without comment', async () => {
      loggedUser = '1';
      const res = await client.mutate(MUTATION, {
        variables: { ...variables, comment: undefined },
      });
      expect(res.errors).toBeFalsy();

      const report = await con
        .getRepository(SourceReport)
        .findOneBy({ userId: loggedUser, sourceId: 'a' });

      expect(report).toEqual({
        sourceId: 'a',
        userId: '1',
        createdAt: expect.anything(),
        reason: 'SPAM',
        comment: null,
      });
    });
  });

  describe('comment report entity', () => {
    const variables = {
      type: 'comment',
      id: 'c1',
      reason: 'HATEFUL',
      comment: 'Test comment',
    };

    it('should throw not found when cannot find comment', () => {
      loggedUser = '1';
      return testMutationErrorCode(
        client,
        {
          mutation: MUTATION,
          variables: { ...variables, id: 'invalid' },
        },
        'NOT_FOUND',
      );
    });

    it('should report comment with note', async () => {
      loggedUser = '1';
      const res = await client.mutate(MUTATION, { variables });
      expect(res.errors).toBeFalsy();
      const comment = await con
        .getRepository(CommentReport)
        .findOneBy({ commentId: 'c1' });
      expect(comment).toEqual({
        commentId: 'c1',
        userId: '1',
        createdAt: expect.anything(),
        reason: 'HATEFUL',
        note: 'Test comment',
      });
    });

    it('should report comment without note', async () => {
      loggedUser = '1';
      const res = await client.mutate(MUTATION, {
        variables: { type: 'comment', id: 'c1', reason: 'HATEFUL' },
      });
      expect(res.errors).toBeFalsy();
      const comment = await con
        .getRepository(CommentReport)
        .findOneBy({ commentId: 'c1' });
      expect(comment).toEqual({
        commentId: 'c1',
        userId: '1',
        createdAt: expect.anything(),
        reason: 'HATEFUL',
        note: null,
      });
    });

    it('should ignore conflicts', async () => {
      loggedUser = '1';
      const res1 = await client.mutate(MUTATION, {
        variables: { type: 'comment', id: 'c1', reason: 'HATEFUL' },
      });
      expect(res1.errors).toBeFalsy();
      const comment = await con
        .getRepository(CommentReport)
        .findOneBy({ commentId: 'c1' });
      expect(comment).toEqual({
        commentId: 'c1',
        userId: '1',
        createdAt: expect.anything(),
        reason: 'HATEFUL',
        note: null,
      });
      const res2 = await client.mutate(MUTATION, {
        variables: { type: 'comment', id: 'c1', reason: 'HATEFUL' },
      });
      expect(res2.errors).toBeFalsy();
    });
  });
});

describe('contentPreference field', () => {
  const QUERY = `
    query User($id: ID!) {
      user(id: $id) {
        contentPreference {
          status
          referenceId
        }
      }
    }
  `;

  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `${item.id}-cpf`,
          username: `${item.username}-cpf`,
        };
      }),
    );

    await saveFixtures(
      con,
      Feed,
      usersFixture.map((item) => ({
        id: `${item.id}-cpf`,
        userId: `${item.id}-cpf`,
      })),
    );

    await con.getRepository(ContentPreferenceUser).save([
      {
        userId: '1-cpf',
        feedId: '1-cpf',
        status: ContentPreferenceStatus.Follow,
        referenceId: '2-cpf',
        referenceUserId: '2-cpf',
      },
      {
        userId: '1-cpf',
        feedId: '1-cpf',
        status: ContentPreferenceStatus.Follow,
        referenceId: '3-cpf',
        referenceUserId: '3-cpf',
      },
    ]);
  });

  it('should return content preference for user', async () => {
    loggedUser = '1-cpf';

    const res = await client.query(QUERY, {
      variables: { id: '2-cpf' },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.user.contentPreference).toMatchObject({
      referenceId: '2-cpf',
      status: 'follow',
    });

    const res2 = await client.query(QUERY, {
      variables: { id: '3-cpf' },
    });

    expect(res2.errors).toBeFalsy();

    expect(res2.data.user.contentPreference).toMatchObject({
      referenceId: '3-cpf',
      status: 'follow',
    });
  });

  it('should return null if content preference does not exist', async () => {
    loggedUser = '1-cpf';

    const res = await client.query(QUERY, {
      variables: { id: '4-cpf' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.user.contentPreference).toBeNull();
  });

  it('should return null for anonymous', async () => {
    const res = await client.query(QUERY, {
      variables: { id: '2-cpf' },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.user.contentPreference).toBeNull();
  });
});

describe('query topReaderBadgeById', () => {
  const QUERY = `
    query TopReaderBadgeById($id: ID!) {
      topReaderBadgeById(id: $id) {
        id
        issuedAt
        keyword {
          value
          flags {
            title
          }
        }
        user {
          id
          name
          username
          image
        }
      }
    }
  `;

  beforeEach(async () => {
    // await saveFixtures(con, User, usersFixture);
    await saveFixtures(
      con,
      Keyword,
      [1, 2, 3, 4, 5, 6].map((key) => ({
        value: `kw_${key}`,
        flags: {
          title: `kw_${key} title`,
        },
      })),
    );
    await saveFixtures(con, UserTopReader, [
      {
        id: '09164a3c-5a95-4546-bfb0-04e19bf28f73',
        userId: '1',
        issuedAt: new Date(),
        keywordValue: 'kw_1',
        image: 'https://daily.dev/image.jpg',
      },
      {
        id: '3d8485ea-be95-464a-a89a-f14084e5b939',
        userId: '2',
        issuedAt: new Date(),
        keywordValue: 'kw_2',
        image: 'https://daily.dev/image.jpg',
      },
    ]);
  });

  it('should return the top reader badge by id', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { id: '09164a3c-5a95-4546-bfb0-04e19bf28f73' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.topReaderBadgeById.id).toEqual(
      '09164a3c-5a95-4546-bfb0-04e19bf28f73',
    );
    expect(res.data.topReaderBadgeById.issuedAt).toEqual(expect.any(String));
    expect(res.data.topReaderBadgeById.keyword).toMatchObject({
      value: 'kw_1',
      flags: {
        title: 'kw_1 title',
      },
    });
    expect(res.data.topReaderBadgeById.user).toMatchObject({
      id: '1',
      name: 'Ido',
      username: 'ido',
      image: 'https://daily.dev/ido.jpg',
    });
  });

  it('should return the top reader badge by id when user is not logged in', async () => {
    const res = await client.query(QUERY, {
      variables: { id: '3d8485ea-be95-464a-a89a-f14084e5b939' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.topReaderBadgeById.id).toEqual(
      '3d8485ea-be95-464a-a89a-f14084e5b939',
    );
    expect(res.data.topReaderBadgeById.issuedAt).toEqual(expect.any(String));
    expect(res.data.topReaderBadgeById.keyword).toMatchObject({
      value: 'kw_2',
      flags: {
        title: 'kw_2 title',
      },
    });
    expect(res.data.topReaderBadgeById.user).toMatchObject({
      id: '2',
      name: 'Tsahi',
      username: 'tsahi',
      image: 'https://daily.dev/tsahi.jpg',
    });
  });
});

describe('query topReaderBadge', () => {
  const QUERY = /* GraphQL */ `
    query TopReaderBadge($limit: Int, $userId: ID!) {
      topReaderBadge(limit: $limit, userId: $userId) {
        id
        issuedAt
        image
        total
        keyword {
          value
          flags {
            title
          }
        }
        user {
          id
        }
      }
    }
  `;

  beforeEach(async () => {
    await saveFixtures(
      con,
      Keyword,
      [1, 2, 3, 4, 5, 6].map((key) => ({
        value: `kw_${key}`,
        flags: {
          title: `kw_${key} title`,
        },
      })),
    );
    await saveFixtures(
      con,
      User,
      [usersFixture[0], usersFixture[1]].map((user) => ({
        ...user,
        infoConfirmed: true,
      })),
    );
    await saveFixtures(con, UserTopReader, [
      {
        userId: '1',
        issuedAt: new Date(),
        keywordValue: 'kw_1',
        image: 'https://daily.dev/image.jpg',
      },
      {
        userId: '1',
        issuedAt: subMonths(new Date(), 1),
        keywordValue: 'kw_2',
        image: 'https://daily.dev/image.jpg',
      },
      {
        userId: '1',
        issuedAt: subMonths(new Date(), 2),
        keywordValue: 'kw_3',
        image: 'https://daily.dev/image.jpg',
      },
      {
        userId: '1',
        issuedAt: subMonths(new Date(), 3),
        keywordValue: 'kw_4',
        image: 'https://daily.dev/image.jpg',
      },
      {
        userId: '1',
        issuedAt: subMonths(new Date(), 4),
        keywordValue: 'kw_5',
        image: 'https://daily.dev/image.jpg',
      },
      {
        userId: '1',
        issuedAt: addHours(new Date(), 1),
        keywordValue: 'kw_6',
        image: 'https://daily.dev/image.jpg',
      },
      {
        id: 'bb48487e-a778-4f66-ae6c-159438fca86e',
        userId: '2',
        issuedAt: new Date(),
        keywordValue: 'kw_1',
        image: 'https://daily.dev/image.jpg',
      },
      {
        userId: '2',
        issuedAt: subMonths(new Date(), 1),
        keywordValue: 'kw_3',
        image: 'https://daily.dev/image.jpg',
      },
    ]);

    await con.query(
      `REFRESH MATERIALIZED VIEW ${con.getRepository(UserStats).metadata.tableName}`,
    );
  });

  it('should return the 5 most recent top reader badges', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY, {
      variables: { userId: loggedUser },
    });
    const topReaderBadge: GQLUserTopReader[] = res.data.topReaderBadge;

    expect(res.errors).toBeFalsy();
    expect(topReaderBadge.length).toEqual(5);
    expect(topReaderBadge[0].keyword.value).toEqual('kw_6');
    expect(topReaderBadge[topReaderBadge.length - 1].keyword.value).toEqual(
      'kw_4',
    );
  });

  it('should limit the return to 1 top reader badge', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY, {
      variables: { limit: 1, userId: loggedUser },
    });
    const topReaderBadge: GQLUserTopReader[] = res.data.topReaderBadge;

    expect(res.errors).toBeFalsy();
    expect(topReaderBadge.length).toEqual(1);
    expect(topReaderBadge[0].keyword.value).toEqual('kw_6');
  });

  it('should return top reader badge by userId', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY, {
      variables: { userId: '2' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.topReaderBadge[0].user.id).toEqual('2');
  });

  it('should return the total number of badges', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY, {
      variables: { userId: loggedUser },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.topReaderBadge[0].total).toEqual(6);
  });

  describe('topReader field on User', () => {
    const QUERY = /* GraphQL */ `
      query User($id: ID!) {
        user(id: $id) {
          id
          topReader {
            id
          }
        }
      }
    `;
    it('should return the top reader badge for the user', async () => {
      loggedUser = '1';

      const res = await client.query(QUERY, { variables: { id: '2' } });
      const user: GQLUser = res.data.user;

      expect(res.errors).toBeFalsy();
      expect(user.id).toEqual('2');
      expect(user.topReader?.id).toEqual(
        'bb48487e-a778-4f66-ae6c-159438fca86e',
      );
    });

    it('should return null if the user has no top reader badge', async () => {
      loggedUser = '1';

      const res = await client.query(QUERY, { variables: { id: '3' } });
      const user: GQLUser = res.data.user;

      expect(res.errors).toBeFalsy();
      expect(user.id).toEqual('3');
      expect(user.topReader).toBeNull();
    });
  });
});

describe('query getGifterUser', () => {
  const QUERY = /* GraphQL */ `
    query GetGifterUser {
      plusGifterUser {
        id
        username
        image
      }
    }
  `;

  beforeEach(async () => {
    await saveFixtures(con, User, plusUsersFixture);
  });

  it('should throw an error if the user is not logged in', async () => {
    await testQueryErrorCode(
      client,
      {
        query: QUERY,
      },
      'UNAUTHENTICATED',
    );
  });

  it('should throw an error if the user is not plus', async () => {
    loggedUser = '1';
    await testQueryErrorCode(
      client,
      {
        query: QUERY,
      },
      'FORBIDDEN',
    );
  });

  it('should throw an error if the user is plus but has no gifter', async () => {
    loggedUser = '5';
    const user = await con
      .getRepository(User)
      .findOneByOrFail({ id: loggedUser });
    const isPlus = isPlusMember(user?.subscriptionFlags?.cycle);

    expect(isPlus).toBeTruthy();

    await testQueryErrorCode(
      client,
      {
        query: QUERY,
      },
      'FORBIDDEN',
    );
  });

  it('should return the gifter user', async () => {
    loggedUser = '1';
    await con.getRepository(User).update(
      {
        id: loggedUser,
      },
      {
        subscriptionFlags: updateSubscriptionFlags({
          cycle: 'plus',
          gifterId: '2',
          giftExpirationDate: addYears(new Date(), 1),
          createdAt: new Date(),
        }),
      },
    );

    const user = await con.getRepository(User).findOneByOrFail({ id: '1' });
    const isPlus = isPlusMember(user?.subscriptionFlags?.cycle);
    expect(isPlus).toBeTruthy();

    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data.plusGifterUser.id).toEqual('2');
    expect(res.data.plusGifterUser.username).toBe('tsahi');
    expect(res.data.plusGifterUser.image).toBeTruthy();
  });
});

describe('mutation requestAppAccountToken', () => {
  const MUTATION = /* GraphQL */ `
    mutation RequestAppAccountToken {
      requestAppAccountToken
    }
  `;

  it('should throw an error if the user is not logged in', async () => {
    await testMutationErrorCode(
      client,
      { mutation: MUTATION },
      'UNAUTHENTICATED',
    );
  });

  it('should generate a new app account token if the user does not have one', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION);
    expect(res.errors).toBeFalsy();
    expect(res.data.requestAppAccountToken).toBeTruthy();
  });

  it('should return the existing app account token if the user already has one', async () => {
    loggedUser = '1';
    await con.getRepository(User).update(
      { id: loggedUser },
      {
        subscriptionFlags: updateSubscriptionFlags({
          appAccountToken: '77601fd2-0490-44e8-a042-4fd516929715',
        }),
      },
    );

    const res = await client.mutate(MUTATION);
    expect(res.errors).toBeFalsy();
    expect(res.data.requestAppAccountToken).toEqual(
      '77601fd2-0490-44e8-a042-4fd516929715',
    );
  });
});

describe('coresRole field on User', () => {
  const QUERY = /* GraphQL */ `
    query User($id: ID!) {
      user(id: $id) {
        id
        coresRole
      }
    }
  `;

  it('should return coresRole', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, { variables: { id: '2' } });
    const user: GQLUser = res.data.user;

    expect(res.errors).toBeFalsy();

    expect(user.id).toEqual('2');
    expect(user.coresRole).toEqual(CoresRole.None);
  });
});

describe('query checkLocation', () => {
  const QUERY = /* GraphQL */ `
    query checkLocation {
      checkLocation {
        _
      }
    }
  `;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return false when user already has lastStored location flag set', async () => {
    loggedUser = '1';

    // Set up user with existing country flag
    await con
      .getRepository(User)
      .update(
        { id: '1' },
        { flags: { country: 'US', location: { lastStored: new Date() } } },
      );

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.checkLocation._).toBe(false);
  });

  it('should return false when user does not exist', async () => {
    loggedUser = 'nonexistent';

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.checkLocation._).toBe(false);
  });

  it('should throw error when geo cannot be extracted', async () => {
    loggedUser = '1';

    // Clear any existing flags
    await con.getRepository(User).update({ id: '1' }, { flags: {} });

    (getGeo as jest.Mock).mockImplementation(() => null);

    const res = await client.query(QUERY);

    expect(res.errors).toBeTruthy();
    expect(res.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED');
    expect(res.errors[0].message).toBe('Geo could not be extracted');
  });

  it('should throw error when geo has no country', async () => {
    loggedUser = '1';

    // Clear any existing flags
    await con.getRepository(User).update({ id: '1' }, { flags: {} });

    (getGeo as jest.Mock).mockImplementation(() => ({
      city: 'New York',
    }));

    const res = await client.query(QUERY);

    expect(res.errors).toBeTruthy();
    expect(res.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED');
    expect(res.errors[0].message).toBe('Geo could not be extracted');
  });

  it('should return true and set flags when geo is successfully extracted', async () => {
    loggedUser = '1';

    // Clear any existing flags
    await con.getRepository(User).update({ id: '1' }, { flags: {} });

    const mockGeo = {
      country: 'US',
      city: 'New York',
      continent: 'North America',
      subdivision: 'NY',
      location: {
        accuracyRadius: 50,
        lat: 40.7128,
        lng: -74.006,
      },
    };

    (getGeo as jest.Mock).mockImplementation(() => mockGeo);

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.checkLocation._).toBe(true);

    // Verify flags were updated
    const updatedUser = await con.getRepository(User).findOne({
      where: { id: '1' },
      select: ['flags'],
    });

    expect(updatedUser.flags).toEqual({
      country: 'US',
      city: 'New York',
      continent: 'North America',
      subdivision: 'NY',
      location: {
        lastStored: expect.any(String),
        accuracyRadius: 50,
        lat: 40.7128,
        lng: -74.006,
      },
    });
  });

  it('should return true and set JSON parsed flags when geo is successfully extracted', async () => {
    loggedUser = '1';

    // Clear any existing flags
    await con.getRepository(User).update({ id: '1' }, { flags: {} });

    const mockGeo = {
      country: 'RE',
      city: "L'Étang-Salé",
      continent: 'AF',
      location: { lastStored: '2025-08-29T11:35:06.392Z', accuracyRadius: 50 },
    };

    (getGeo as jest.Mock).mockImplementation(() => mockGeo);

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.checkLocation._).toBe(true);

    // Verify flags were updated
    const updatedUser = await con.getRepository(User).findOne({
      where: { id: '1' },
      select: ['flags'],
    });

    expect(updatedUser.flags).toEqual({
      city: "L'Étang-Salé",
      continent: 'AF',
      country: 'RE',
      location: {
        accuracyRadius: 50,
        lastStored: expect.any(String),
      },
    });
  });

  it('should return true and set partial flags when geo has minimal data', async () => {
    loggedUser = '1';

    // Clear any existing flags
    await con.getRepository(User).update({ id: '1' }, { flags: {} });

    const mockGeo = {
      country: 'CA',
    };

    (getGeo as jest.Mock).mockImplementation(() => mockGeo);

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.checkLocation._).toBe(true);

    // Verify flags were updated with available data
    const updatedUser = await con.getRepository(User).findOne({
      where: { id: '1' },
      select: ['flags'],
    });

    expect(updatedUser.flags).toEqual({
      country: 'CA',
      city: undefined,
      continent: undefined,
      subdivision: undefined,
      location: {
        lastStored: expect.any(String),
        accuracyRadius: undefined,
        lat: undefined,
        lng: undefined,
      },
    });
  });
});

describe('query checkCoresRole', () => {
  const QUERY = /* GraphQL */ `
    query checkCoresRole {
      checkCoresRole {
        coresRole
      }
    }
  `;

  beforeEach(() => {
    (getGeo as jest.Mock).mockImplementation(() => {
      return {
        country: 'US',
      };
    });
  });

  it('should return coresRole', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();

    expect(res.data.checkCoresRole.coresRole).toEqual(CoresRole.Creator);
  });

  it('should set UserAction for cores role', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();

    const userAction = con.getRepository(UserAction).findOneBy({
      userId: '1',
      type: UserActionType.CheckedCoresRole,
    });

    expect(userAction).not.toBeNull();
  });
});

describe('add claimable items to user', () => {
  describe('utility function', () => {
    it('should add the claimable item to the user', async () => {
      const userId = randomUUID();
      const claimableItemUuid = randomUUID();

      const flags: ClaimableItemFlags = {
        cycle: SubscriptionCycles.Yearly,
        status: SubscriptionStatus.Active,
        provider: SubscriptionProvider.Paddle,
        createdAt: new Date(),
        // customerId: 'ctm_01jktawy94f7ypbn7x8wdvtv86',
        subscriptionId: 'sub_01jv95ymhjr71a700kpx8txt2j',
      };

      await con.getRepository(ClaimableItem).save({
        id: claimableItemUuid,
        type: ClaimableItemTypes.Plus,
        identifier: 'john.doe@example.com',
        flags,
      });

      await con.getRepository(User).save({
        id: userId,
        name: 'John Doe',
        email: 'john.doe@example.com',
      });

      await addClaimableItemsToUser(con, {
        id: userId,
        email: 'john.doe@example.com',
        createdAt: new Date(),
        name: '',
        infoConfirmed: false,
        acceptedMarketing: false,
        experienceLevel: null,
        language: null,
      });

      const user = await con.getRepository(User).findOneBy({ id: userId });
      expect(user).not.toBeNull();
      expect(user?.subscriptionFlags).toBeDefined();
      expect(user?.subscriptionFlags?.cycle).toEqual(flags.cycle);
      expect(user?.subscriptionFlags?.status).toEqual(flags.status);
      expect(user?.subscriptionFlags?.provider).toEqual(flags.provider);

      const claimableItem = await con.getRepository(ClaimableItem).findOneBy({
        id: claimableItemUuid,
      });
      expect(claimableItem).not.toBeNull();
      expect(claimableItem?.claimedAt).not.toBeNull();
    });

    it('should create user but not add any claimable items if there were none found', async () => {
      const userId = randomUUID();
      await con.getRepository(User).save({
        id: userId,
        name: 'Clark Kent',
        email: 'clark.kent@example.com',
      });

      await addClaimableItemsToUser(con, {
        id: userId,
        email: 'clark.kent@example.com',
        createdAt: new Date(),
        name: 'Clark Kent',
        infoConfirmed: false,
        acceptedMarketing: false,
        experienceLevel: null,
        language: null,
      });

      const user = await con.getRepository(User).findOneBy({ id: userId });
      expect(user).not.toBeNull();
      expect(user?.subscriptionFlags).toMatchObject({});
    });
  });

  describe('mutation claimUnclaimedItem', () => {
    const MUTATION = /* GraphQL */ `
      mutation ClaimUnclaimedItem {
        claimUnclaimedItem {
          claimed
        }
      }
    `;

    it('should throw an error if the user is not logged in', async () => {
      await testMutationErrorCode(
        client,
        { mutation: MUTATION },
        'UNAUTHENTICATED',
      );
    });

    it('should not add a subscription if the user have no claimable items', async () => {
      loggedUser = '1-claim';
      await con.getRepository(User).save({
        id: loggedUser,
        name: 'John Doe',
        email: 'johnclaim@email.com',
      });

      const res = await client.mutate(MUTATION);

      expect(res.errors).toBeFalsy();
      expect(res.data.claimUnclaimedItem.claimed).toBeFalsy();
    });

    it('should add subscription if already have a claimable item', async () => {
      loggedUser = '1-claim';
      const claimableItemUuid = randomUUID();

      const flags: ClaimableItemFlags = {
        cycle: SubscriptionCycles.Yearly,
        status: SubscriptionStatus.Active,
        provider: SubscriptionProvider.Paddle,
        createdAt: new Date(),
        subscriptionId: 'sub_01jv95ymhjr71a700kpx8txt2j',
      };

      await con.getRepository(User).save({
        id: loggedUser,
        name: 'John Doe',
        email: 'johnclaim@email.com',
      });

      await con.getRepository(ClaimableItem).save({
        id: claimableItemUuid,
        type: ClaimableItemTypes.Plus,
        identifier: 'johnclaim@email.com',
        flags,
      });

      const res = await client.mutate(MUTATION);

      expect(res.errors).toBeFalsy();
      expect(res.data.claimUnclaimedItem.claimed).toBeTruthy();

      const user = await con.getRepository(User).findOneBy({
        id: loggedUser,
      });

      expect(user).not.toBeNull();
      expect(user?.subscriptionFlags).toBeDefined();
      expect(user?.subscriptionFlags).toEqual(
        JSON.parse(JSON.stringify(flags)),
      );
    });
  });
});

describe('mutation uploadResume', () => {
  const MUTATION = /* GraphQL */ `
    mutation UploadResume($resume: Upload!) {
      uploadResume(resume: $resume) {
        _
      }
    }
  `;

  beforeEach(async () => {
    jest.clearAllMocks();
    await deleteRedisKey(`${rateLimiterName}:1:Mutation.uploadResume`);
  });

  it('should require authentication', async () => {
    loggedUser = '';

    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .field(
          'operations',
          JSON.stringify({
            query: MUTATION,
            variables: { resume: null },
          }),
        )
        .field('map', JSON.stringify({ '0': ['variables.resume'] }))
        .attach('0', './__tests__/fixture/happy_card.png', 'sample.pdf'),
      loggedUser,
    ).expect(200);

    const body = res.body;
    expect(body.errors).toBeTruthy();
    expect(body.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('should upload pdf resume successfully', async () => {
    loggedUser = '1';

    // mock the file-type check to allow PDF files
    fileTypeFromBuffer.mockResolvedValue({
      ext: 'pdf',
      mime: 'application/pdf',
    });

    // Mock the upload function to return a URL
    uploadResumeFromBuffer.mockResolvedValue(
      `https://storage.cloud.google.com/${RESUME_BUCKET_NAME}/1`,
    );

    // Execute the mutation with a file upload
    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .field(
          'operations',
          JSON.stringify({
            query: MUTATION,
            variables: { resume: null },
          }),
        )
        .field('map', JSON.stringify({ '0': ['variables.resume'] }))
        .attach('0', './__tests__/fixture/screen.pdf'),
      loggedUser,
    ).expect(200);

    // Verify the response
    const body = res.body;
    expect(body.errors).toBeFalsy();

    // Verify the mocks were called correctly
    expect(uploadResumeFromBuffer).toHaveBeenCalledWith(
      loggedUser,
      expect.any(Object),
      { contentType: 'application/pdf' },
    );

    const ucp = await con
      .getRepository(UserCandidatePreference)
      .findOneByOrFail({
        userId: loggedUser,
      });

    expect(ucp.cv).toEqual(
      expect.objectContaining({
        blob: loggedUser,
        fileName: 'screen.pdf',
        bucket: RESUME_BUCKET_NAME,
        contentType: 'application/pdf',
        lastModified: expect.any(String),
      }),
    );
  });

  it('should upload docx resume successfully', async () => {
    loggedUser = '1';

    // mock the file-type check to allow PDF files
    fileTypeFromBuffer.mockResolvedValue({
      ext: 'docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    // Mock the upload function to return a URL
    uploadResumeFromBuffer.mockResolvedValue(
      `https://storage.cloud.google.com/${RESUME_BUCKET_NAME}/1`,
    );

    // Execute the mutation with a file upload
    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .field(
          'operations',
          JSON.stringify({
            query: MUTATION,
            variables: { resume: null },
          }),
        )
        .field('map', JSON.stringify({ '0': ['variables.resume'] }))
        .attach('0', './__tests__/fixture/screen.pdf', 'sample.docx'),
      loggedUser,
    ).expect(200);

    // Verify the response
    const body = res.body;
    expect(body.errors).toBeFalsy();

    // Verify the mocks were called correctly
    expect(uploadResumeFromBuffer).toHaveBeenCalledWith(
      loggedUser,
      expect.any(Object),
      {
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    );

    const ucp = await con
      .getRepository(UserCandidatePreference)
      .findOneByOrFail({
        userId: loggedUser,
      });

    expect(ucp.cv).toEqual(
      expect.objectContaining({
        blob: loggedUser,
        bucket: RESUME_BUCKET_NAME,
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        lastModified: expect.any(String),
      }),
    );
  });

  it('should throw error when file is missing', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should throw error when file extension is not supported', async () => {
    loggedUser = '1';

    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .field(
          'operations',
          JSON.stringify({
            query: MUTATION,
            variables: { resume: null },
          }),
        )
        .field('map', JSON.stringify({ '0': ['variables.resume'] }))
        .attach('0', './__tests__/fixture/happy_card.png'),
      loggedUser,
    ).expect(200);

    const body = res.body;
    expect(body.errors).toBeTruthy();
    expect(body.errors[0].message).toEqual('File extension not supported');
  });

  it('should throw error when file mime is not supported', async () => {
    loggedUser = '1';

    // mock the file-type check to allow PDF files
    fileTypeFromBuffer.mockResolvedValue({
      ext: 'png',
      mime: 'image/png',
    });

    // Rename the file to have a .pdf extension
    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .field(
          'operations',
          JSON.stringify({
            query: MUTATION,
            variables: { resume: null },
          }),
        )
        .field('map', JSON.stringify({ '0': ['variables.resume'] }))
        .attach('0', './__tests__/fixture/happy_card.png', 'fake.pdf'),
      loggedUser,
    ).expect(200);

    const body = res.body;
    expect(body.errors).toBeTruthy();
    expect(body.errors[0].message).toEqual('File type not supported');
  });

  it("should throw error when file extension doesn't match the mime type", async () => {
    loggedUser = '1';

    // mock the file-type check to allow PDF files
    fileTypeFromBuffer.mockResolvedValue({
      ext: 'pdf',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // Incorrect mime type for a PDF
    });

    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .field(
          'operations',
          JSON.stringify({
            query: MUTATION,
            variables: { resume: null },
          }),
        )
        .field('map', JSON.stringify({ '0': ['variables.resume'] }))
        .attach('0', './__tests__/fixture/happy_card.png', 'fake.pdf'),
      loggedUser,
    ).expect(200);

    const body = res.body;
    expect(body.errors).toBeTruthy();
    expect(body.errors[0].message).toEqual('File type not supported');
  });
});
describe('mutation updateNotificationSettings', () => {
  const MUTATION = `mutation UpdateNotificationSettings($notificationFlags: JSON!) {
    updateNotificationSettings(notificationFlags: $notificationFlags) {
      _
    }
  }`;

  it('should overwrite notification settings', async () => {
    loggedUser = '1';

    const updatedFlags = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      [NotificationType.ArticleNewComment]: {
        email: 'muted',
        inApp: 'subscribed',
      },
    };

    const res = await client.mutate(MUTATION, {
      variables: { notificationFlags: updatedFlags },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.updateNotificationSettings._).toBeTruthy();

    const user = await con.getRepository(User).findOneBy({ id: loggedUser });
    expect(user?.notificationFlags).toEqual(updatedFlags);
  });

  it('should update acceptedMarketing flag', async () => {
    loggedUser = '1';

    await con
      .getRepository(User)
      .update({ id: loggedUser }, { acceptedMarketing: true });

    const res = await client.mutate(MUTATION, {
      variables: {
        notificationFlags: {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          marketing: {
            email: 'muted',
            inApp: 'muted',
          },
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.updateNotificationSettings._).toBeTruthy();

    const user = await con.getRepository(User).findOneBy({ id: loggedUser });
    expect(user?.acceptedMarketing).toBeFalsy();
  });

  it('should throw error because of invalid notification flags', async () => {
    loggedUser = '1';

    const updatedFlags = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      new_pokemon: {
        email: 'subscribed',
        inApp: 'subscribed',
      },
    };

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { notificationFlags: updatedFlags },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });
});

describe('mutation clearResume', () => {
  const MUTATION = /* GraphQL */ `
    mutation ClearResume {
      clearResume {
        _
      }
    }
  `;

  beforeEach(async () => {
    await saveFixtures(con, UserCandidatePreference, [
      {
        userId: '1',
        cv: { blob: 'blobname' },
        cvParsed: { some: 'data' },
        cvParsedMarkdown: '# Sample CV',
      },
    ]);
  });

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
      },
      'UNAUTHENTICATED',
    );
  });

  it('should delete user resume if it exists', async () => {
    loggedUser = '1';

    await client.mutate(MUTATION);

    expect(deleteFileFromBucket).toHaveBeenCalledWith(
      expect.any(Bucket),
      loggedUser,
    );

    const ucp = await con
      .getRepository(UserCandidatePreference)
      .findOneByOrFail({
        userId: loggedUser,
      });

    expect(ucp.cv).toEqual({});
    expect(ucp.cvParsed).toEqual({});
    expect(ucp.cvParsedMarkdown).toEqual(null);
  });

  it('should handle case when user has no candidate preferences', async () => {
    loggedUser = '2';

    expect(
      await con.getRepository(UserCandidatePreference).countBy({
        userId: loggedUser,
      }),
    ).toEqual(0);

    await client.mutate(MUTATION);

    expect(deleteFileFromBucket).toHaveBeenCalledWith(
      expect.any(Bucket),
      loggedUser,
    );

    expect(
      await con.getRepository(UserCandidatePreference).countBy({
        userId: loggedUser,
      }),
    ).toEqual(0);
  });
});

describe('query userProfileAnalytics', () => {
  const QUERY = `
    query UserProfileAnalytics($userId: ID!) {
      userProfileAnalytics(userId: $userId) {
        id
        uniqueVisitors
        updatedAt
      }
    }
  `;

  it('should not allow unauthenticated users', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { userId: '1' } },
      'UNAUTHENTICATED',
    ));

  it('should return null when viewing another user analytics', async () => {
    loggedUser = '2';

    await con.getRepository(UserProfileAnalytics).save({
      id: '1',
      uniqueVisitors: 150,
    });

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userProfileAnalytics).toBeNull();
  });

  it('should return analytics for own profile', async () => {
    loggedUser = '1';

    const analytics = await con.getRepository(UserProfileAnalytics).save({
      id: '1',
      uniqueVisitors: 150,
    });

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userProfileAnalytics).toMatchObject({
      id: '1',
      uniqueVisitors: 150,
      updatedAt: analytics.updatedAt.toISOString(),
    });
  });

  it('should allow team member to view any user analytics', async () => {
    loggedUser = '2';
    isTeamMember = true;

    const analytics = await con.getRepository(UserProfileAnalytics).save({
      id: '1',
      uniqueVisitors: 150,
    });

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userProfileAnalytics).toMatchObject({
      id: '1',
      uniqueVisitors: 150,
      updatedAt: analytics.updatedAt.toISOString(),
    });
  });

  it('should return not found error when no analytics record exists', () => {
    loggedUser = '1';

    return testQueryErrorCode(
      client,
      { query: QUERY, variables: { userId: '1' } },
      'NOT_FOUND',
    );
  });
});

describe('query userProfileAnalyticsHistory', () => {
  const QUERY = `
    query UserProfileAnalyticsHistory($userId: ID!, $first: Int, $after: String) {
      userProfileAnalyticsHistory(userId: $userId, first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            date
            uniqueVisitors
            updatedAt
          }
        }
      }
    }
  `;

  it('should not allow unauthenticated users', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { userId: '1' } },
      'UNAUTHENTICATED',
    ));

  it('should return null when viewing another user history', async () => {
    loggedUser = '2';

    await con
      .getRepository(UserProfileAnalyticsHistory)
      .save([{ id: '1', date: '2026-01-15', uniqueVisitors: 10 }]);

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userProfileAnalyticsHistory).toBeNull();
  });

  it('should return history for own profile', async () => {
    loggedUser = '1';

    await con.getRepository(UserProfileAnalyticsHistory).save([
      { id: '1', date: '2026-01-15', uniqueVisitors: 10 },
      { id: '1', date: '2026-01-14', uniqueVisitors: 25 },
      { id: '1', date: '2026-01-13', uniqueVisitors: 15 },
    ]);

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userProfileAnalyticsHistory.edges).toHaveLength(3);
    expect(res.data.userProfileAnalyticsHistory.edges[0].node).toMatchObject({
      id: '1',
      date: '2026-01-15T00:00:00.000Z',
      uniqueVisitors: 10,
    });
  });

  it('should allow team member to view any user history', async () => {
    loggedUser = '2';
    isTeamMember = true;

    await con
      .getRepository(UserProfileAnalyticsHistory)
      .save([{ id: '1', date: '2026-01-15', uniqueVisitors: 10 }]);

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userProfileAnalyticsHistory.edges).toHaveLength(1);
    expect(res.data.userProfileAnalyticsHistory.edges[0].node).toMatchObject({
      id: '1',
      date: '2026-01-15T00:00:00.000Z',
      uniqueVisitors: 10,
    });
  });

  it('should paginate with first parameter', async () => {
    loggedUser = '1';

    await con.getRepository(UserProfileAnalyticsHistory).save([
      { id: '1', date: '2026-01-15', uniqueVisitors: 10 },
      { id: '1', date: '2026-01-14', uniqueVisitors: 25 },
      { id: '1', date: '2026-01-13', uniqueVisitors: 15 },
      { id: '1', date: '2026-01-12', uniqueVisitors: 20 },
      { id: '1', date: '2026-01-11', uniqueVisitors: 30 },
    ]);

    const res = await client.query(QUERY, {
      variables: { userId: '1', first: 2 },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.userProfileAnalyticsHistory.edges).toHaveLength(2);
    expect(res.data.userProfileAnalyticsHistory.pageInfo.hasNextPage).toBe(
      true,
    );
  });

  it('should return empty edges when no history exists', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.userProfileAnalyticsHistory.edges).toHaveLength(0);
  });
});

describe('query userPostsAnalytics', () => {
  const QUERY = /* GraphQL */ `
    query UserPostsAnalytics {
      userPostsAnalytics {
        id
        impressions
        upvotes
        comments
      }
    }
  `;

  it('should require authentication', async () => {
    await testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED');
  });

  it('should return null when no analytics exist', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.userPostsAnalytics).toBeNull();
  });
});

describe('query userPostsAnalyticsHistory', () => {
  const QUERY = /* GraphQL */ `
    query UserPostsAnalyticsHistory {
      userPostsAnalyticsHistory {
        date
        impressions
        impressionsAds
      }
    }
  `;

  beforeEach(async () => {
    await saveFixtures(con, Post, [
      {
        id: 'p1-upah',
        shortId: 'sp1-upah',
        title: 'Test Post',
        url: 'https://example.com/p1-upah',
        sourceId: 'a',
        authorId: '1',
      },
    ]);

    await con.getRepository(PostAnalyticsHistory).save([
      {
        id: 'p1-upah',
        date: format(new Date(), 'yyyy-MM-dd'),
        impressions: 100,
        impressionsAds: 50,
      },
      {
        id: 'p1-upah',
        date: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
        impressions: 80,
        impressionsAds: 40,
      },
    ]);
  });

  it('should require authentication', async () => {
    await testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED');
  });

  it('should return aggregated daily impressions history', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.userPostsAnalyticsHistory).toHaveLength(2);
    expect(res.data.userPostsAnalyticsHistory[0]).toMatchObject({
      date: expect.any(String),
      impressions: 150,
      impressionsAds: 50,
    });
  });

  it('should exclude brief posts from analytics history', async () => {
    await saveFixtures(con, Post, [
      {
        id: 'brief-upah',
        shortId: 'sbrf-upah',
        title: 'Brief Post',
        url: 'https://example.com/brief-upah',
        sourceId: 'a',
        authorId: '1',
        type: PostType.Brief,
      },
    ]);

    await con.getRepository(PostAnalyticsHistory).save([
      {
        id: 'brief-upah',
        date: format(new Date(), 'yyyy-MM-dd'),
        impressions: 200,
        impressionsAds: 100,
      },
    ]);

    loggedUser = '1';

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.userPostsAnalyticsHistory).toHaveLength(2);
    expect(res.data.userPostsAnalyticsHistory[0]).toMatchObject({
      date: expect.any(String),
      impressions: 150,
      impressionsAds: 50,
    });
  });
});

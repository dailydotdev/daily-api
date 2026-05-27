import nock from 'nock';
import { keywordsFixture } from './fixture/keywords';
import { Keyword } from './../src/entity/Keyword';
import {
  addHours,
  addSeconds,
  addYears,
  format,
  subDays,
  subMonths,
} from 'date-fns';
import {
  authorizeRequest,
  createGarmrMock,
  createMockBragiPipelinesTransport,
  createMockBragiPipelinesNotFoundTransport,
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
  Feed,
  MarketingCta,
  Post,
  PostReport,
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
  UserTopReader,
  PostType,
} from '../src/entity';
import { UserProfileAnalytics } from '../src/entity/user/UserProfileAnalytics';
import { UserProfileAnalyticsHistory } from '../src/entity/user/UserProfileAnalyticsHistory';
import { PostAnalyticsHistory } from '../src/entity/posts/PostAnalyticsHistory';
import { sourcesFixture } from './fixture/source';
import {
  DayOfWeek,
  encrypt,
  ghostUser,
  type GQLUserTopReader,
  updateSubscriptionFlags,
} from '../src/common';

import { DataSource, IsNull } from 'typeorm';
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
import { SourceReport } from '../src/entity/sources/SourceReport';
import { SourceMemberRoles } from '../src/roles';
import { rateLimiterName } from '../src/directive/rateLimit';
import { CommentReport } from '../src/entity/CommentReport';
import { ContentPreferenceUser } from '../src/entity/contentPreference/ContentPreferenceUser';
import { ContentPreferenceStatus } from '../src/entity/contentPreference/types';
import { identifyUserPersonalizedDigest } from '../src/cio';
import type { GQLUser } from '../src/schema/users';
import { cancelSubscription } from '../src/common/paddle';
import { isPlusMember, SubscriptionCycles } from '../src/paddle';
import { CoresRole } from '../src/types';
import { randomUUID } from 'crypto';
import {
  ClaimableItem,
  ClaimableItemFlags,
  ClaimableItemTypes,
} from '../src/entity/ClaimableItem';
import { addClaimableItemsToUser } from '../src/entity/user/utils';
import { getGeo } from '../src/common/geo';
import { SubscriptionProvider, SubscriptionStatus } from '../src/common/plus';
import { createClient } from '@connectrpc/connect';
import {
  ExtractedProfileTag,
  OnboardingProfileTagsResponse,
  OpportunityState,
  OpportunityType,
  Pipelines,
} from '@dailydotdev/schema';
import * as bragiClients from '../src/integrations/bragi/clients';
import type { ServiceClient } from '../src/types';
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

const mockSetPassword = jest.fn();
const mockBetterAuthHandler = jest.fn(async () => new Response('{}'));
jest.mock('../src/betterAuth', () => ({
  ...(jest.requireActual('../src/betterAuth') as Record<string, unknown>),
  getBetterAuth: () => ({
    handler: mockBetterAuthHandler,
    api: {
      setPassword: mockSetPassword,
    },
  }),
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

afterAll(() => disposeGraphQLTesting(state));

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

    const userOne = await con.getRepository(User).findOneBy({ id: '1' });
    expect(userOne?.flags).toMatchObject({ inDeletion: true });
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
    expect(userOne?.flags).toMatchObject({ inDeletion: true });
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
    expect(userOne?.flags).toMatchObject({ inDeletion: true });
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
      expect(userOne?.flags).toMatchObject({ inDeletion: true });
    });

    it('should mark user for deletion if storekit subscription is expired', async () => {
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
      expect(userOne?.flags).toMatchObject({ inDeletion: true });
    });
  });

  it('should mark user for deletion', async () => {
    loggedUser = '1';

    const user = await con.getRepository(User).findOneBy({ id: '1' });
    expect(user).not.toBeNull();

    await client.mutate(MUTATION);

    const markedUser = await con.getRepository(User).findOneBy({ id: '1' });
    expect(markedUser?.flags).toMatchObject({ inDeletion: true });
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
    const res = await authorizeRequest(request(app.server).post(BASE_PATH))
      .set('User-Agent', TEST_UA)
      .set(
        'Cookie',
        'da3=1;da2=1;dast=1;ory_kratos_session=legacy;ory_kratos_continuity=legacy',
      )
      .expect(204);

    const cookies = setCookieParser.parse(res, { map: true });
    expect(cookies['da2'].value).toBeTruthy();
    expect(cookies['da2'].value).not.toEqual('1');
    expect(cookies['da3'].value).toBeFalsy();
    expect(cookies.dast.value).toBeFalsy();
    expect(cookies.ory_kratos_session.value).toBeFalsy();
    expect(cookies.ory_kratos_continuity.value).toBeFalsy();
    expect(mockBetterAuthHandler).toHaveBeenCalledTimes(1);
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
    await authorizeRequest(request(app.server).delete(BASE_PATH)).expect(204);

    const userOne = await con.getRepository(User).findOneBy({ id: '1' });
    expect(userOne?.flags).toMatchObject({ inDeletion: true });
  });

  it('should clear cookies', async () => {
    const res = await authorizeRequest(request(app.server).delete(BASE_PATH))
      .set('User-Agent', TEST_UA)
      .set(
        'Cookie',
        'da3=1;da2=1;dast=1;ory_kratos_session=legacy;ory_kratos_continuity=legacy',
      )
      .expect(204);

    const cookies = setCookieParser.parse(res, { map: true });
    expect(cookies['da2'].value).toBeTruthy();
    expect(cookies['da2'].value).not.toEqual('1');
    expect(cookies['da3'].value).toBeFalsy();
    expect(cookies.dast.value).toBeFalsy();
    expect(cookies.ory_kratos_session.value).toBeFalsy();
    expect(cookies.ory_kratos_continuity.value).toBeFalsy();
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

  it('should exclude digest posts from analytics history', async () => {
    await saveFixtures(con, Post, [
      {
        id: 'digest-upah',
        shortId: 'sdgst-upah',
        title: 'Digest Post',
        url: 'https://example.com/digest-upah',
        sourceId: 'a',
        authorId: '1',
        type: PostType.Digest,
      },
    ]);

    await con.getRepository(PostAnalyticsHistory).save([
      {
        id: 'digest-upah',
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

describe('mutation setPassword', () => {
  const MUTATION = `
    mutation SetPassword($newPassword: String!) {
      setPassword(newPassword: $newPassword) {
        _
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { newPassword: 'newPassword123!' },
      },
      'UNAUTHENTICATED',
    ));

  it('should set password via better auth api', async () => {
    loggedUser = '1';
    mockSetPassword.mockResolvedValueOnce({ status: true });

    const res = await client.mutate(MUTATION, {
      variables: { newPassword: 'newPassword123!' },
    });

    expect(res.errors).toBeFalsy();
    expect(mockSetPassword).toHaveBeenCalledWith({
      body: { newPassword: 'newPassword123!' },
      headers: expect.any(Headers),
    });
  });

  it('should propagate error when better auth api fails', async () => {
    loggedUser = '1';
    mockSetPassword.mockRejectedValueOnce(new Error('Password too weak'));

    const res = await client.mutate(MUTATION, {
      variables: { newPassword: 'weak' },
    });

    expect(res.errors).toBeTruthy();
    expect(res.errors[0].message).toBe('Password too weak');
  });
});

describe('githubProfileTags mutation', () => {
  const GITHUB_PROFILE_TAGS_MUTATION = `
    mutation {
      githubProfileTags {
        includeTags
      }
    }
  `;

  const seedGitHubAccount = async (userId: string) => {
    await con.query(
      `INSERT INTO ba_account (id, "accountId", "providerId", "userId", "accessToken", scope, "createdAt", "updatedAt")
       VALUES ($1, $2, 'github', $3, $4, 'user:email', NOW(), NOW())`,
      [`ba-${userId}`, `gh-${userId}`, userId, 'gho_test_token_123'],
    );
  };

  beforeEach(async () => {
    await deleteKeysByPattern(`${rateLimiterName}:*`);
    await saveFixtures(con, Keyword, keywordsFixture);
    await con.getRepository(Feed).save({ id: '1', userId: '1' });

    jest.spyOn(bragiClients, 'getBragiClient').mockImplementation(
      (): ServiceClient<typeof Pipelines> => ({
        instance: createClient(Pipelines, createMockBragiPipelinesTransport()),
        garmr: createGarmrMock(),
      }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return extracted tags for user with GitHub account', async () => {
    loggedUser = '1';
    await seedGitHubAccount('1');

    const res = await client.mutate(GITHUB_PROFILE_TAGS_MUTATION);

    expect(res.errors).toBeFalsy();
    expect(res.data.githubProfileTags.includeTags).toEqual(
      expect.arrayContaining(['webdev', 'rust', 'golang']),
    );
  });

  it('should return error when no GitHub account linked', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      { mutation: GITHUB_PROFILE_TAGS_MUTATION },
      'NOT_FOUND',
      'No GitHub account linked',
    );
  });

  it('should require authentication', async () => {
    loggedUser = null;

    return testMutationErrorCode(
      client,
      { mutation: GITHUB_PROFILE_TAGS_MUTATION },
      'UNAUTHENTICATED',
    );
  });

  it('should propagate bragi NotFound error', async () => {
    loggedUser = '1';
    await seedGitHubAccount('1');

    jest.restoreAllMocks();
    jest.spyOn(bragiClients, 'getBragiClient').mockImplementation(
      (): ServiceClient<typeof Pipelines> => ({
        instance: createClient(
          Pipelines,
          createMockBragiPipelinesNotFoundTransport(),
        ),
        garmr: createGarmrMock(),
      }),
    );

    return testMutationErrorCode(
      client,
      { mutation: GITHUB_PROFILE_TAGS_MUTATION },
      'NOT_FOUND',
      'GitHub profile tags not found',
    );
  });

  it('should return saved tags on repeated call without calling bragi', async () => {
    loggedUser = '1';
    await seedGitHubAccount('1');

    const first = await client.mutate(GITHUB_PROFILE_TAGS_MUTATION);
    expect(first.errors).toBeFalsy();

    const spy = jest.fn();
    jest.restoreAllMocks();
    jest.spyOn(bragiClients, 'getBragiClient').mockImplementation(
      (): ServiceClient<typeof Pipelines> => ({
        instance: {
          gitHubProfileTags: spy,
        } as unknown as ReturnType<typeof createClient<typeof Pipelines>>,
        garmr: createGarmrMock(),
      }),
    );

    const second = await client.mutate(GITHUB_PROFILE_TAGS_MUTATION);
    expect(second.errors).toBeFalsy();
    expect(second.data.githubProfileTags.includeTags).toEqual(
      first.data.githubProfileTags.includeTags,
    );
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('onboardingProfileTags mutation', () => {
  const ONBOARDING_PROFILE_TAGS_MUTATION = `
    mutation OnboardingProfileTags($prompt: String!) {
      onboardingProfileTags(prompt: $prompt) {
        includeTags
      }
    }
  `;

  beforeEach(async () => {
    await deleteKeysByPattern(`${rateLimiterName}:*`);
    await saveFixtures(con, Keyword, keywordsFixture);
    await con.getRepository(Feed).save({ id: '1', userId: '1' });

    jest.spyOn(bragiClients, 'getBragiClient').mockImplementation(
      (): ServiceClient<typeof Pipelines> => ({
        instance: createClient(Pipelines, createMockBragiPipelinesTransport()),
        garmr: createGarmrMock(),
      }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return extracted tags from prompt', async () => {
    loggedUser = '1';

    const res = await client.mutate(ONBOARDING_PROFILE_TAGS_MUTATION, {
      variables: { prompt: 'I love Python and machine learning' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.onboardingProfileTags.includeTags).toEqual(
      expect.arrayContaining(['webdev', 'fullstack']),
    );
  });

  it('should return error for empty prompt', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      {
        mutation: ONBOARDING_PROFILE_TAGS_MUTATION,
        variables: { prompt: '' },
      },
      'ZOD_VALIDATION_ERROR',
    );
  });

  it('should require authentication', async () => {
    loggedUser = null;

    return testMutationErrorCode(
      client,
      {
        mutation: ONBOARDING_PROFILE_TAGS_MUTATION,
        variables: { prompt: 'I love coding' },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should return saved tags on repeated call without calling bragi', async () => {
    loggedUser = '1';

    const first = await client.mutate(ONBOARDING_PROFILE_TAGS_MUTATION, {
      variables: { prompt: 'I love Python and machine learning' },
    });
    expect(first.errors).toBeFalsy();

    const spy = jest.fn();
    jest.restoreAllMocks();
    jest.spyOn(bragiClients, 'getBragiClient').mockImplementation(
      (): ServiceClient<typeof Pipelines> => ({
        instance: {
          onboardingProfileTags: spy,
        } as unknown as ReturnType<typeof createClient<typeof Pipelines>>,
        garmr: createGarmrMock(),
      }),
    );

    const second = await client.mutate(ONBOARDING_PROFILE_TAGS_MUTATION, {
      variables: { prompt: 'different prompt' },
    });
    expect(second.errors).toBeFalsy();
    expect(second.data.onboardingProfileTags.includeTags).toEqual(
      first.data.onboardingProfileTags.includeTags,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('should pass tag vocabulary to bragi', async () => {
    loggedUser = '1';

    jest.restoreAllMocks();
    await deleteKeysByPattern(`${rateLimiterName}:*`);

    const bragiSpy = jest.fn().mockResolvedValue(
      new OnboardingProfileTagsResponse({
        id: 'mock-id',
        extractedTags: [
          new ExtractedProfileTag({ name: 'webdev', confidence: 0.9 }),
          new ExtractedProfileTag({ name: 'rust', confidence: 0.7 }),
        ],
      }),
    );

    jest.spyOn(bragiClients, 'getBragiClient').mockImplementation(
      (): ServiceClient<typeof Pipelines> => ({
        instance: {
          onboardingProfileTags: bragiSpy,
        } as unknown as ReturnType<typeof createClient<typeof Pipelines>>,
        garmr: createGarmrMock(),
      }),
    );

    const res = await client.mutate(ONBOARDING_PROFILE_TAGS_MUTATION, {
      variables: { prompt: 'I like web development and rust' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.onboardingProfileTags.includeTags).toEqual(
      expect.arrayContaining(['webdev', 'rust']),
    );
    expect(bragiSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        onboardingPrompt: 'I like web development and rust',
        tagVocabulary: expect.arrayContaining(['webdev', 'rust', 'golang']),
      }),
    );
  });

  it('should propagate bragi NotFound error', async () => {
    loggedUser = '1';

    jest.restoreAllMocks();
    await deleteKeysByPattern(`${rateLimiterName}:*`);
    jest.spyOn(bragiClients, 'getBragiClient').mockImplementation(
      (): ServiceClient<typeof Pipelines> => ({
        instance: createClient(
          Pipelines,
          createMockBragiPipelinesNotFoundTransport(),
        ),
        garmr: createGarmrMock(),
      }),
    );

    return testMutationErrorCode(
      client,
      {
        mutation: ONBOARDING_PROFILE_TAGS_MUTATION,
        variables: { prompt: 'I love coding' },
      },
      'NOT_FOUND',
      'Onboarding profile tags not found',
    );
  });

  it('should return error for prompt exceeding max length', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      {
        mutation: ONBOARDING_PROFILE_TAGS_MUTATION,
        variables: { prompt: 'a'.repeat(2001) },
      },
      'ZOD_VALIDATION_ERROR',
    );
  });
});

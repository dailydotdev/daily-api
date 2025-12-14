import { setTimeout } from 'node:timers/promises';
import { FastifyInstance } from 'fastify';
import request from 'supertest';
import {
  createMockNjordTransport,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  TEST_UA,
} from './helpers';
import createOrGetConnection from '../src/db';
import { DataSource } from 'typeorm';
import {
  Alerts,
  ALERTS_DEFAULT,
  ArticlePost,
  Banner,
  Feature,
  FeatureType,
  Feed,
  MachineSource,
  MarketingCta,
  MarketingCtaStatus,
  NotificationV2,
  Organization,
  Post,
  Settings,
  SETTINGS_DEFAULT,
  Source,
  SourceMember,
  SourceType,
  SQUAD_IMAGE_PLACEHOLDER,
  SquadSource,
  User,
  UserMarketingCta,
  UserNotification,
} from '../src/entity';
import { DatasetLocation } from '../src/entity/dataset/DatasetLocation';
import {
  OrganizationMemberRole,
  SourceMemberRoles,
  sourceRoleRank,
} from '../src/roles';
import { notificationV2Fixture } from './fixture/notifications';
import { usersFixture } from './fixture/user';
import {
  deleteKeysByPattern,
  getRedisObject,
  getRedisObjectExpiry,
  ioRedisPool,
  RedisMagicValues,
  setRedisObject,
} from '../src/redis';
import {
  FEED_SURVEY_INTERVAL,
  generateStorageKey,
  REDIS_BANNER_KEY,
  StorageKey,
  StorageTopic,
} from '../src/config';
import nock from 'nock';
import { addDays, setMilliseconds, subDays } from 'date-fns';
import setCookieParser from 'set-cookie-parser';
import { postsFixture } from './fixture/post';
import { sourcesFixture } from './fixture/source';
import { SourcePermissions } from '../src/schema/sources';
import { base64 } from 'graphql-relay/utils/base64';
import { cookies } from '../src/cookies';
import { signJwt } from '../src/auth';
import {
  DEFAULT_TIMEZONE,
  submitArticleThreshold,
  THREE_MONTHS_IN_SECONDS,
  updateFlagsStatement,
} from '../src/common';
import { saveReturnAlerts } from '../src/schema/alerts';
import { CoresRole, UserVote } from '../src/types';
import { BootAlerts, FunnelBoot } from '../src/routes/boot';
import { excludeProperties } from '../src/routes/boot';
import { SubscriptionCycles } from '../src/paddle';
import * as njordCommon from '../src/common/njord';
import { Credits, EntityType } from '@dailydotdev/schema';
import { createClient } from '@connectrpc/connect';
import { FunnelState } from '../src/integrations/freyja';
import { SubscriptionProvider, SubscriptionStatus } from '../src/common/plus';
import {
  ContentPreferenceOrganization,
  ContentPreferenceOrganizationStatus,
} from '../src/entity/contentPreference/ContentPreferenceOrganization';

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;

const BASE_BODY = {
  alerts: {
    ...excludeProperties(ALERTS_DEFAULT, ['lastFeedSettingsFeedback']),
    lastChangelog: expect.any(String),
    lastBanner: expect.any(String),
    shouldShowFeedFeedback: false,
  },
  settings: { ...SETTINGS_DEFAULT },
  notifications: { unreadNotificationsCount: 0 },
  squads: [],
  visit: {
    sessionId: expect.any(String),
    visitId: expect.any(String),
  },
  exp: { f: 'enc', e: [], a: {} },
  geo: {},
};

const LOGGED_IN_BODY = {
  ...BASE_BODY,
  alerts: {
    ...BASE_BODY.alerts,
    bootPopup: true,
    flags: {},
  },
  accessToken: {
    expiresIn: expect.any(String),
    token: expect.any(String),
  },
  user: {
    ...excludeProperties(usersFixture[0], ['notificationFlags']),
    createdAt: (usersFixture[0].createdAt as Date).toISOString(),
    permalink: 'http://localhost:5002/idoshamun',
    providers: [null],
    roles: [],
    title: null,
    timezone: DEFAULT_TIMEZONE,
    reputation: 10,
    portfolio: null,
    company: null,
    experienceLevel: null,
    isTeamMember: false,
    bluesky: null,
    roadmap: null,
    threads: null,
    codepen: null,
    reddit: null,
    stackoverflow: null,
    youtube: null,
    linkedin: null,
    mastodon: null,
    readme: null,
    language: undefined,
    isPlus: false,
    defaultFeedId: null,
    flags: {
      showPlusGift: false,
    },
    balance: {
      amount: 0,
    },
    subscriptionFlags: {},
    coresRole: CoresRole.None,
    clickbaitTries: null,
    hasLocationSet: false,
    location: null,
    hideExperience: false,
  },
  marketingCta: null,
  feeds: [],
};

const ANONYMOUS_BODY = {
  ...BASE_BODY,
  settings: SETTINGS_DEFAULT,
  user: {
    id: expect.any(String),
    firstVisit: expect.any(String),
    shouldVerify: false,
  },
};

const getBootAlert = (data: Alerts): BootAlerts =>
  new Object({
    ...excludeProperties(saveReturnAlerts(data), [
      'userId',
      'lastFeedSettingsFeedback',
    ]),
    shouldShowFeedFeedback:
      subDays(new Date(), FEED_SURVEY_INTERVAL) > data.lastFeedSettingsFeedback,
  }) as BootAlerts;

jest.mock('../src/growthbook', () => ({
  ...(jest.requireActual('../src/growthbook') as Record<string, unknown>),
  getEncryptedFeatures: () => 'enc',
  getUserGrowthBookInstance: () => {
    return {
      loadFeatures: jest.fn(),
      getFeatures: jest.fn(),
      getFeatureValue: () => 'gbId',
    };
  },
}));

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(() => new MockContext(con));
  app = state.app;
});

beforeEach(async () => {
  jest.clearAllMocks();
  await con.getRepository(User).save(usersFixture[0]);
  await con.getRepository(Source).save(sourcesFixture);
  await con.getRepository(Post).save(postsFixture);
  await ioRedisPool.execute((client) => client.flushall());

  await deleteKeysByPattern('njord:cores_balance:*');

  const mockTransport = createMockNjordTransport();
  jest
    .spyOn(njordCommon, 'getNjordClient')
    .mockImplementation(() => createClient(Credits, mockTransport));
});

const BASE_PATH = '/boot';
const KRATOS_EXPIRATION = addDays(setMilliseconds(new Date(), 0), 1);

const mockWhoami = (expected: unknown, statusCode = 200) => {
  nock(process.env.HEIMDALL_ORIGIN)
    .get('/api/whoami')
    .reply(statusCode, JSON.stringify(expected), {
      'set-cookie': `ory_kratos_session=new_value; Path=/; Expires=${KRATOS_EXPIRATION.toUTCString()}; Max-Age=86399; HttpOnly; SameSite=Lax`,
    });
};

const mockLoggedIn = (userId = '1') =>
  mockWhoami({
    session: {
      identity: { traits: { userId } },
      expires_at: KRATOS_EXPIRATION,
    },
    verified: true,
  });

const mockLegacyLoggedIn = (userId = '1') =>
  mockWhoami({
    identity: { traits: { userId } },
    expires_at: KRATOS_EXPIRATION,
  });

describe('anonymous boot', () => {
  it('should return defaults', async () => {
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .expect(200);
    expect(res.body).toEqual(ANONYMOUS_BODY);
  });

  it('should keep the same tracking and session id', async () => {
    const first = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .expect(200);
    const second = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', first.headers['set-cookie'])
      .expect(200);
    expect(second.body.user.id).toEqual(first.body.user.id);
    expect(second.body.visit.sessionId).toEqual(first.body.visit.sessionId);
  });

  it('should read join_referral cookie', async () => {
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', ['join_referral=1:knightcampaign'])
      .expect(200);
    expect(res.body).toEqual({
      ...ANONYMOUS_BODY,
      user: {
        id: expect.any(String),
        firstVisit: expect.any(String),
        referralId: '1',
        referralOrigin: 'knightcampaign',
        shouldVerify: false,
      },
      visit: {
        visitId: expect.any(String),
      },
    });
  });

  it('should set first visit value if null', async () => {
    const first = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .expect(200);
    expect(first.body.user.firstVisit).toBeTruthy();
    await ioRedisPool.execute((client) => client.flushall());
    const second = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', first.headers['set-cookie'])
      .expect(200);
    expect(second.body.user.id).toEqual(first.body.user.id);
    expect(second.body.user.firstVisit).toBeTruthy();
    expect(second.body.user.firstVisit).not.toEqual(first.body.user.firstVisit);
  });

  it('should retain first visit value if not null', async () => {
    const first = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .expect(200);
    expect(first.body.user.firstVisit).toBeTruthy();
    const second = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', first.headers['set-cookie'])
      .expect(200);
    expect(second.body.user.id).toEqual(first.body.user.id);
    expect(second.body.user.firstVisit).toBeTruthy();
    expect(second.body.user.firstVisit).toEqual(first.body.user.firstVisit);
  });

  it('should extend the TTL for redis cache if user visits a second time', async () => {
    const first = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .expect(200);

    const key = generateStorageKey(
      StorageTopic.Boot,
      'first_visit',
      first.body.user.id,
    );

    const firstTTL = await ioRedisPool.execute((client) => client.ttl(key));
    await setTimeout(1000);
    await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', first.headers['set-cookie'])
      .expect(200);
    const secondTTL = await ioRedisPool.execute((client) => client.ttl(key));
    // Should have reset the TTL
    expect(firstTTL).toEqual(secondTTL);
  });

  it('should return anonymous boot if jwt is expired', async () => {
    const accessToken = await signJwt(
      {
        userId: '1',
        roles: [],
      },
      -15 * 60 * 1000,
    );
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set(
        'Cookie',
        `${cookies.auth.key}=${app.signCookie(accessToken.token)};`,
      )
      .expect(200);
    expect(res.body).toEqual(ANONYMOUS_BODY);
  });
});

describe('logged in boot', () => {
  it('should boot data when no access token cookie but whoami succeeds', async () => {
    mockLoggedIn();
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body).toEqual({
      ...LOGGED_IN_BODY,
      user: {
        ...LOGGED_IN_BODY.user,
        canSubmitArticle:
          LOGGED_IN_BODY.user.reputation >= submitArticleThreshold,
      },
    });
  });

  it('should boot data when legacy kratos whoami is returned', async () => {
    mockLegacyLoggedIn();
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body).toEqual({
      ...LOGGED_IN_BODY,
      user: {
        ...LOGGED_IN_BODY.user,
        canSubmitArticle:
          LOGGED_IN_BODY.user.reputation >= submitArticleThreshold,
      },
    });
  });

  it('should set hasLocationSet to true when user has location date flag', async () => {
    await con.getRepository(User).save({
      ...usersFixture[0],
      flags: {
        country: 'US',
        location: {
          lastStored: new Date(),
        },
      },
    });
    mockLoggedIn();
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.user.hasLocationSet).toBe(true);
  });

  it('should return location when user has locationId set', async () => {
    const location = await con.getRepository(DatasetLocation).save({
      country: 'United States',
      city: 'San Francisco',
      subdivision: 'California',
      iso2: 'US',
      iso3: 'USA',
      timezone: 'America/Los_Angeles',
      externalId: '123',
      ranking: 1,
    });

    await con.getRepository(User).save({
      ...usersFixture[0],
      locationId: location.id,
    });

    mockLoggedIn();
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);

    expect(res.body.user.location).toEqual({
      id: location.id,
      city: 'San Francisco',
      subdivision: 'California',
      country: 'United States',
      externalId: '123',
    });
  });

  it('should return null location when user has no locationId', async () => {
    mockLoggedIn();
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);

    expect(res.body.user.location).toBeNull();
  });

  it('should set kratos cookie expiration', async () => {
    mockLoggedIn();
    const kratosCookie = 'ory_kratos_session';
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', `${kratosCookie}=value;`)
      .expect(200);
    const cookies = setCookieParser.parse(res, { map: true });
    expect(cookies[kratosCookie].value).toEqual('new_value');
    expect(cookies[kratosCookie].expires).toEqual(KRATOS_EXPIRATION);
  });

  it('should set tracking id according to user id', async () => {
    mockLoggedIn();
    const trackingCookie = 'da2';
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', `ory_kratos_session=value;${trackingCookie}=t;`)
      .expect(200);
    const cookies = setCookieParser.parse(res, { map: true });
    expect(cookies[trackingCookie].value).toEqual('1');
  });

  it('should handle 401 from auth server', async () => {
    mockWhoami({}, 401);
    const trackingCookie = 'da2';
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    const cookies = setCookieParser.parse(res, { map: true });
    expect(cookies[trackingCookie].value).toBeTruthy();
    expect(cookies[trackingCookie].value).not.toEqual('1');
    expect(res.body).toEqual({
      ...ANONYMOUS_BODY,
    });
  });

  it('should handle user does not exist', async () => {
    mockLoggedIn('2');
    const trackingCookie = 'da2';
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    const cookies = setCookieParser.parse(res, { map: true });
    expect(cookies[trackingCookie].value).toBeTruthy();
    expect(cookies[trackingCookie].value).not.toEqual('2');
    expect(res.body).toEqual({
      ...ANONYMOUS_BODY,
    });
  });

  it('should not dispatch whoami when jwt is available', async () => {
    const accessToken = await signJwt(
      {
        userId: '1',
        roles: [],
      },
      15 * 60 * 1000,
    );
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set(
        'Cookie',
        `${cookies.auth.key}=${app.signCookie(accessToken.token)};`,
      )
      .expect(200);
    expect(res.body).toEqual({
      ...LOGGED_IN_BODY,
      user: {
        ...LOGGED_IN_BODY.user,
        canSubmitArticle:
          LOGGED_IN_BODY.user.reputation >= submitArticleThreshold,
      },
    });
  });

  it('should not re-issue JWT token when isPlus in payload is same as user', async () => {
    await saveFixtures(con, User, [
      {
        ...usersFixture[0],
        id: `${usersFixture[0].id}-lbnp`,
        username: `${usersFixture[0].username}-lbnp`,
        github: undefined,
        subscriptionFlags: {},
      },
    ]);

    const accessToken = await signJwt(
      {
        userId: `${usersFixture[0].id}-lbnp`,
        roles: [],
        isPlus: false,
      },
      15 * 60 * 1000,
    );
    const key = app.signCookie(accessToken.token);
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', `${cookies.auth.key}=${key};`)
      .expect(200);

    (res.get('set-cookie') as unknown as string[]).forEach((cookie) => {
      // cookies.auth.key should not be in cookie
      expect(cookie).not.toEqual(expect.stringContaining(cookies.auth.key));
    });
  });

  it('should re-issue JWT token when isPlus in payload is different from user', async () => {
    await saveFixtures(con, User, [
      {
        ...usersFixture[0],
        id: `${usersFixture[0].id}-lbp`,
        username: `${usersFixture[0].username}-lbp`,
        github: undefined,
      },
    ]);

    const accessToken = await signJwt(
      {
        userId: `${usersFixture[0].id}-lbp`,
        roles: [],
        isPlus: true,
      },
      15 * 60 * 1000,
    );
    const key = app.signCookie(accessToken.token);
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', `${cookies.auth.key}=${key};`)
      .expect(200);

    (res.get('set-cookie') as unknown as string[]).forEach((cookie) => {
      if (cookie.startsWith(`${cookies.auth.key}=`)) {
        const jwt = app.unsignCookie(
          cookie.slice(`${cookies.auth.key}=`.length),
        );
        expect(jwt).not.toEqual(key);
      }
    });
  });

  it('should set team member to true if user is a team member', async () => {
    await con.getRepository(Feature).save({
      feature: FeatureType.Team,
      userId: '1',
      value: 1,
    });
    mockLoggedIn();
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.user.isTeamMember).toEqual(true);
  });

  it('should return default feed id if set', async () => {
    await con.getRepository(Feed).save({
      id: '1',
      name: 'My Feed',
      userId: '1',
    });
    await con.getRepository(User).save({
      ...usersFixture[0],
      subscriptionFlags: {
        cycle: SubscriptionCycles.Yearly,
      },
      defaultFeedId: '1',
    });
    mockLoggedIn();
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.user.defaultFeedId).toEqual('1');
  });

  it('should not return default feed id if not plus', async () => {
    await con.getRepository(Feed).save({
      id: '1',
      name: 'My Feed',
      userId: '1',
    });
    await con.getRepository(User).save({
      ...usersFixture[0],
      defaultFeedId: '1',
    });
    mockLoggedIn();
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.user.defaultFeedId).toBeNull();
  });

  describe('subscriptionFlags', () => {
    describe('provider flag', () => {
      it('should not return provider when not set on user', async () => {
        mockLoggedIn();
        const res = await request(app.server)
          .get(BASE_PATH)
          .set('Cookie', 'ory_kratos_session=value;')
          .expect(200);
        expect(res.body.user.subscriptionFlags.provider).toBeUndefined();
      });

      it('should return the correct plus provider when paddle', async () => {
        await con.getRepository(User).save({
          ...usersFixture[0],
          subscriptionFlags: {
            provider: SubscriptionProvider.Paddle,
          },
        });
        mockLoggedIn();
        const res = await request(app.server)
          .get(BASE_PATH)
          .set('Cookie', 'ory_kratos_session=value;')
          .expect(200);
        expect(res.body.user.subscriptionFlags.provider).toEqual(
          SubscriptionProvider.Paddle,
        );
      });

      it('should return the correct plus provider when storekit', async () => {
        await con.getRepository(User).save({
          ...usersFixture[0],
          subscriptionFlags: {
            provider: SubscriptionProvider.AppleStoreKit,
          },
        });
        mockLoggedIn();
        const res = await request(app.server)
          .get(BASE_PATH)
          .set('Cookie', 'ory_kratos_session=value;')
          .expect(200);
        expect(res.body.user.subscriptionFlags.provider).toEqual(
          SubscriptionProvider.AppleStoreKit,
        );
      });
    });

    describe('appAccountToken flag', () => {
      it('should not return appAccountToken when not set on user', async () => {
        mockLoggedIn();
        const res = await request(app.server)
          .get(BASE_PATH)
          .set('Cookie', 'ory_kratos_session=value;')
          .expect(200);
        expect(res.body.user.subscriptionFlags.appAccountToken).toBeUndefined();
      });

      it('should not return appAccountToken when set on user', async () => {
        await con.getRepository(User).save({
          ...usersFixture[0],
          subscriptionFlags: {
            appAccountToken: 'b381c50a-b79d-4ec9-9284-973d4d5d767b',
          },
        });
        mockLoggedIn();
        const res = await request(app.server)
          .get(BASE_PATH)
          .set('Cookie', 'ory_kratos_session=value;')
          .expect(200);
        expect(res.body.user.subscriptionFlags.appAccountToken).toEqual(
          'b381c50a-b79d-4ec9-9284-973d4d5d767b',
        );
      });
    });
  });

  describe('balance field', () => {
    it('should return default balance', async () => {
      mockLoggedIn();
      const res = await request(app.server)
        .get(BASE_PATH)
        .set('Cookie', 'ory_kratos_session=value;')
        .expect(200);
      expect(res.body.user.balance).toEqual({
        amount: 0,
      });
    });

    it('should return balance', async () => {
      const testNjordClient = njordCommon.getNjordClient();
      await testNjordClient.transfer({
        idempotencyKey: crypto.randomUUID(),
        transfers: [
          {
            sender: { id: 'system', type: EntityType.SYSTEM },
            receiver: { id: '1', type: EntityType.USER },
            amount: 100,
          },
        ],
      });

      mockLoggedIn();
      const res = await request(app.server)
        .get(BASE_PATH)
        .set('Cookie', 'ory_kratos_session=value;')
        .expect(200);
      expect(res.body.user.balance).toEqual({
        amount: 100,
      });
    });
  });

  describe('last activity', () => {
    it('should set last activity in redis if user is part of organization', async () => {
      await saveFixtures(con, Organization, [
        {
          id: 'org-1',
          seats: 1,
          name: 'Organization 1',
          subscriptionFlags: {
            cycle: SubscriptionCycles.Yearly,
            status: SubscriptionStatus.Active,
          },
        },
      ]);

      await saveFixtures(con, Feed, [
        {
          id: '1',
          userId: '1',
        },
      ]);

      await saveFixtures(con, ContentPreferenceOrganization, [
        {
          userId: '1',
          referenceId: 'org-1',
          organizationId: 'org-1',
          feedId: '1',
          status: ContentPreferenceOrganizationStatus.Plus,
          flags: {
            role: OrganizationMemberRole.Owner,
            referralToken: 'ref-token-1',
          },
        },
      ]);

      const userId = '1';
      mockLoggedIn(userId);
      await request(app.server)
        .get(BASE_PATH)
        .set('Cookie', 'ory_kratos_session=value;')
        .expect(200);

      // Wait for the onResponse hook to finish
      await setTimeout(50);

      const redisKey = generateStorageKey(
        StorageTopic.Boot,
        StorageKey.UserLastOnline,
        userId,
      );
      const storesRedisValue = await getRedisObject(redisKey);

      expect(storesRedisValue).not.toBeNull();
      expect(new Date(parseInt(storesRedisValue!))).toBeInstanceOf(Date);

      // Check expiry, to not cause it to be flaky, we check if it is within 10 seconds
      expect(await getRedisObjectExpiry(redisKey)).toBeLessThanOrEqual(
        THREE_MONTHS_IN_SECONDS,
      );
      expect(await getRedisObjectExpiry(redisKey)).toBeGreaterThanOrEqual(
        THREE_MONTHS_IN_SECONDS - 10,
      );
    });

    it('should not set last activity in redis if user is not part of organization', async () => {
      const userId = '1';
      mockLoggedIn(userId);
      await request(app.server)
        .get(BASE_PATH)
        .set('Cookie', 'ory_kratos_session=value;')
        .expect(200);
      const redisKey = generateStorageKey(
        StorageTopic.Boot,
        StorageKey.UserLastOnline,
        userId,
      );
      const storesRedisValue = await getRedisObject(redisKey);
      expect(storesRedisValue).toBeNull();
    });
  });
});

describe('boot marketing cta', () => {
  it('should not return marketing cta for anonymous user', async () => {
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .expect(200);

    expect(res.body).not.toHaveProperty('marketingCta');
  });

  it('should return null if the user has no marketing cta', async () => {
    const userId = '1';
    mockLoggedIn(userId);
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);

    expect(res.body.marketingCta).toBeNull();
    expect(
      await getRedisObject(
        generateStorageKey(StorageTopic.Boot, StorageKey.MarketingCta, userId),
      ),
    ).toEqual(RedisMagicValues.SLEEPING);
  });

  it('should not check the database if redis value is set to sleeping', async () => {
    const userId = '1';
    mockLoggedIn(userId);
    await setRedisObject(
      generateStorageKey(StorageTopic.Boot, StorageKey.MarketingCta, userId),
      RedisMagicValues.SLEEPING,
    );

    expect(
      await getRedisObject(
        generateStorageKey(StorageTopic.Boot, StorageKey.MarketingCta, userId),
      ),
    ).toEqual(RedisMagicValues.SLEEPING);

    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);

    expect(res.body.marketingCta).toBeNull();
    expect(
      await getRedisObject(
        generateStorageKey(StorageTopic.Boot, StorageKey.MarketingCta, userId),
      ),
    ).toEqual(RedisMagicValues.SLEEPING);
  });

  it('should return null if user has no marketing cta on future ', async () => {
    const userId = '1';
    mockLoggedIn(userId);
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);

    expect(res.body.marketingCta).toBeNull();
    expect(
      await getRedisObject(
        generateStorageKey(StorageTopic.Boot, StorageKey.MarketingCta, userId),
      ),
    ).toEqual(RedisMagicValues.SLEEPING);
  });

  it('should return marketing cta for user', async () => {
    const userId = '1';
    mockLoggedIn(userId);

    await con.getRepository(MarketingCta).save({
      campaignId: 'worlds-best-campaign',
      variant: 'card',
      createdAt: new Date('2024-03-13 12:00:00'),
      flags: {
        title: 'Join the best community in the world',
        description: 'Join the best community in the world',
        ctaUrl: 'http://localhost:5002',
        ctaText: 'Join now',
      },
    });
    await con.getRepository(UserMarketingCta).save({
      marketingCtaId: 'worlds-best-campaign',
      userId,
      createdAt: new Date('2024-03-13 12:00:00'),
    });

    expect(
      await getRedisObject(
        generateStorageKey(StorageTopic.Boot, StorageKey.MarketingCta, userId),
      ),
    ).toBeNull();

    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);

    expect(res.body.marketingCta).toMatchObject({
      campaignId: 'worlds-best-campaign',
      variant: 'card',
      createdAt: '2024-03-13T12:00:00.000Z',
      flags: {
        title: 'Join the best community in the world',
        description: 'Join the best community in the world',
        ctaUrl: 'http://localhost:5002',
        ctaText: 'Join now',
      },
    });

    expect(res.body.marketingCta).toMatchObject(
      JSON.parse(
        (await getRedisObject(
          generateStorageKey(
            StorageTopic.Boot,
            StorageKey.MarketingCta,
            userId,
          ),
        )) as string,
      ),
    );
  });

  it('should not return marketing cta for user if campaign is not active', async () => {
    const userId = '1';
    mockLoggedIn(userId);

    await con.getRepository(MarketingCta).save({
      campaignId: 'worlds-best-campaign',
      variant: 'card',
      status: MarketingCtaStatus.Paused,
      createdAt: new Date('2024-03-13 12:00:00'),
      flags: {
        title: 'Join the best community in the world',
        description: 'Join the best community in the world',
        ctaUrl: 'http://localhost:5002',
        ctaText: 'Join now',
      },
    });
    await con.getRepository(UserMarketingCta).save({
      marketingCtaId: 'worlds-best-campaign',
      userId,
      createdAt: new Date('2024-03-13 12:00:00'),
    });

    expect(
      await getRedisObject(
        generateStorageKey(StorageTopic.Boot, StorageKey.MarketingCta, userId),
      ),
    ).toBeNull();

    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);

    expect(res.body.marketingCta).toBeNull();

    expect(
      await getRedisObject(
        generateStorageKey(StorageTopic.Boot, StorageKey.MarketingCta, userId),
      ),
    ).toEqual(RedisMagicValues.SLEEPING);
  });
});

describe('boot alerts', () => {
  it('should return user alerts', async () => {
    mockLoggedIn();
    const data = await con.getRepository(Alerts).save({
      ...ALERTS_DEFAULT,
      userId: '1',
      myFeed: 'created',
    });

    const alerts = getBootAlert(data);
    alerts['changelog'] = false;
    alerts['banner'] = false;
    alerts['bootPopup'] = true;
    delete alerts['userId'];
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.alerts).toEqual({
      ...alerts,
      lastBanner: expect.any(String),
      lastChangelog: expect.any(String),
    });
  });

  it('should return banner as true', async () => {
    mockLoggedIn();
    await setRedisObject(REDIS_BANNER_KEY, '2023-02-06 12:00:00');
    const data = await con.getRepository(Alerts).save({
      ...ALERTS_DEFAULT,
      userId: '1',
      myFeed: 'created',
      lastBanner: new Date('2023-02-05 12:00:00'),
      lastChangelog: new Date('2023-02-05 12:00:00'),
    });
    const alerts = getBootAlert(data);
    alerts['shouldShowFeedFeedback'] = false;
    alerts['changelog'] = false;
    alerts['banner'] = true;
    alerts['bootPopup'] = true;
    delete alerts['userId'];
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.alerts).toEqual(alerts);
  });

  it('should return banner as false', async () => {
    mockLoggedIn();
    await setRedisObject(REDIS_BANNER_KEY, '2023-02-05 12:00:00');
    const data = await con.getRepository(Alerts).save({
      ...ALERTS_DEFAULT,
      userId: '1',
      myFeed: 'created',
      lastBanner: new Date('2023-02-06 12:00:00'),
      lastChangelog: new Date('2023-02-06 12:00:00'),
    });
    const alerts = getBootAlert(data);
    alerts['banner'] = false;
    alerts['changelog'] = false;
    alerts['bootPopup'] = true;
    delete alerts['userId'];
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.alerts).toEqual(alerts);
  });

  it('should return banner as false if redis is false', async () => {
    mockLoggedIn();
    const data = await con.getRepository(Alerts).save({
      ...ALERTS_DEFAULT,
      userId: '1',
      myFeed: 'created',
      lastChangelog: new Date('2023-02-05 12:00:00'),
      lastBanner: new Date('2023-02-05 12:00:00'),
    });
    const alerts = getBootAlert(data);
    alerts['shouldShowFeedFeedback'] = false;
    alerts['changelog'] = false;
    alerts['banner'] = false;
    alerts['bootPopup'] = true;
    delete alerts['userId'];
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.alerts).toEqual(alerts);
  });

  it('should return banner as true if redis is empty', async () => {
    mockLoggedIn();
    const data = await con.getRepository(Alerts).save({
      ...ALERTS_DEFAULT,
      userId: '1',
      myFeed: 'created',
      lastChangelog: new Date('2023-02-05 12:00:00'),
      lastBanner: new Date('2023-02-06 12:00:00'),
    });
    const banner = await con.getRepository(Banner).save({
      timestamp: '2023-02-08T12:00:00.000Z',
      title: 'test',
      subtitle: 'test',
      cta: 'test',
      url: 'test',
      theme: 'cabbage',
    });
    const alerts = getBootAlert(data);
    alerts['banner'] = true;
    alerts['changelog'] = false;
    alerts['shouldShowFeedFeedback'] = false;
    alerts['bootPopup'] = true;
    delete alerts['userId'];
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.alerts).toEqual(alerts);
    expect(await getRedisObject(REDIS_BANNER_KEY)).toEqual(
      banner.timestamp.toISOString(),
    );
  });

  it('should return showGenericReferral as true', async () => {
    mockLoggedIn();
    const data = await con.getRepository(Alerts).save({
      ...ALERTS_DEFAULT,
      userId: '1',
      myFeed: 'created',
      lastChangelog: new Date('2023-02-05 12:00:00'),
      lastBanner: new Date('2023-02-05 12:00:00'),
      banner: false,
      changelog: false,
      showGenericReferral: true,
    });
    const alerts = getBootAlert(data);
    alerts['shouldShowFeedFeedback'] = false;
    alerts['bootPopup'] = true;
    delete alerts['userId'];
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.alerts).toEqual(alerts);
  });

  it('should return true on "flags.showGiftPlus" if user is gift recipient', async () => {
    mockLoggedIn();
    await con.getRepository(User).update(
      { id: '1' },
      {
        flags: updateFlagsStatement({
          showPlusGift: true,
        }),
      },
    );

    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.user.flags.showPlusGift).toEqual(true);
  });
});

describe('boot misc', () => {
  it('should return user settings', async () => {
    mockLoggedIn();
    const data = await con.getRepository(Settings).save({
      userId: '1',
      theme: 'bright',
      insaneMode: true,
    });
    const settings = new Object(data);
    delete settings['updatedAt'];
    delete settings['userId'];
    delete settings['bookmarkSlug'];
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.settings).toEqual({
      ...settings,
      flags: {
        sidebarCustomFeedsExpanded: true,
        sidebarOtherExpanded: true,
        sidebarResourcesExpanded: true,
        sidebarSquadExpanded: true,
        sidebarBookmarksExpanded: true,
        clickbaitShieldEnabled: true,
      },
    });
  });

  it('should return unread notifications count', async () => {
    mockLoggedIn();
    const notifs = await con.getRepository(NotificationV2).save([
      notificationV2Fixture,
      {
        ...notificationV2Fixture,
        uniqueKey: '2',
      },
      {
        ...notificationV2Fixture,
        uniqueKey: '3',
      },
    ]);
    await con.getRepository(UserNotification).insert([
      {
        userId: '1',
        notificationId: notifs[0].id,
        createdAt: notificationV2Fixture.createdAt,
      },
      {
        userId: '1',
        notificationId: notifs[1].id,
      },
      {
        userId: '1',
        notificationId: notifs[2].id,
        readAt: new Date(),
      },
    ]);
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.notifications).toEqual({ unreadNotificationsCount: 2 });
  });

  it('should return the user squads', async () => {
    mockLoggedIn();
    await con.getRepository(SquadSource).save([
      {
        id: 's1',
        handle: 's1',
        name: 'Squad',
        private: false,
        active: false,
      },
      {
        id: 's2',
        handle: 's2',
        name: 'Squad 2',
        private: true,
        active: true,
      },
      {
        id: 's3',
        handle: 's3',
        name: 'Squad 3',
        private: true,
        active: true,
      },
      {
        id: 's5',
        handle: 's5',
        name: 'Squad 5',
        private: true,
        active: true,
        memberPostingRank: sourceRoleRank[SourceMemberRoles.Moderator],
      },
    ]);
    await con.getRepository(MachineSource).save([
      {
        id: 's4',
        handle: 's4',
        name: 'Source',
        private: false,
        active: false,
      },
    ]);
    await con.getRepository(SourceMember).save([
      {
        sourceId: 's1',
        userId: '1',
        referralToken: 'rt',
        role: SourceMemberRoles.Member,
      },
      {
        sourceId: 's2',
        userId: '1',
        referralToken: 'rt2',
        role: SourceMemberRoles.Member,
      },
      {
        sourceId: 's4',
        userId: '1',
        referralToken: 'rt3',
        role: SourceMemberRoles.Member,
      },
      {
        sourceId: 's5',
        userId: '1',
        referralToken: 'rt5',
        role: SourceMemberRoles.Member,
      },
    ]);
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.squads).toEqual([
      {
        active: false,
        handle: 's1',
        id: 's1',
        image: SQUAD_IMAGE_PLACEHOLDER,
        moderationRequired: false,
        name: 'Squad',
        permalink: 'http://localhost:5002/squads/s1',
        public: true,
        type: SourceType.Squad,
        currentMember: {
          permissions: [SourcePermissions.Post],
        },
      },
      {
        active: true,
        handle: 's2',
        id: 's2',
        image: SQUAD_IMAGE_PLACEHOLDER,
        moderationRequired: false,
        name: 'Squad 2',
        permalink: 'http://localhost:5002/squads/s2',
        public: false,
        type: SourceType.Squad,
        currentMember: {
          permissions: [SourcePermissions.Post],
        },
      },
      {
        active: true,
        handle: 's5',
        id: 's5',
        image: SQUAD_IMAGE_PLACEHOLDER,
        moderationRequired: false,
        name: 'Squad 5',
        permalink: 'http://localhost:5002/squads/s5',
        public: false,
        type: SourceType.Squad,
        currentMember: {
          permissions: [],
        },
      },
    ]);
  });

  it('should not return squads users blocked from', async () => {
    mockLoggedIn();
    await con.getRepository(SquadSource).save([
      {
        id: 's1',
        handle: 's1',
        name: 'Squad',
        private: false,
        active: false,
      },
      {
        id: 's3',
        handle: 's3',
        name: 'Squad 3',
        private: true,
        active: true,
      },
    ]);
    await con.getRepository(MachineSource).save([
      {
        id: 's4',
        handle: 's4',
        name: 'Source',
        private: false,
        active: false,
      },
    ]);
    await con.getRepository(SourceMember).save([
      {
        sourceId: 's1',
        userId: '1',
        referralToken: 'rt',
        role: SourceMemberRoles.Member,
      },
      {
        sourceId: 's3',
        userId: '1',
        referralToken: 'rt3',
        role: SourceMemberRoles.Blocked,
      },
    ]);
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.squads).toEqual([
      {
        active: false,
        handle: 's1',
        id: 's1',
        image: SQUAD_IMAGE_PLACEHOLDER,
        moderationRequired: false,
        name: 'Squad',
        permalink: 'http://localhost:5002/squads/s1',
        public: true,
        type: SourceType.Squad,
        currentMember: {
          permissions: [SourcePermissions.Post],
        },
      },
    ]);
  });

  it('should return the user feeds', async () => {
    mockLoggedIn();
    const feeds = [
      {
        id: '1',
        userId: '1',

        slug: '1',
      },
      {
        id: 'cf1',
        userId: '1',
        flags: {
          name: 'Cool feed',
        },
        slug: 'cool-feed-cf1',
      },
      {
        id: 'cf2',
        userId: '1',
        flags: {
          name: 'PHP feed',
        },
        slug: 'php-feed-cf2',
      },
      {
        id: 'cf3',
        userId: '2',
        flags: {
          name: 'Awful feed',
        },
        slug: 'awful-feed-cf3',
      },
    ];
    await saveFixtures(con, User, usersFixture);
    await con.getRepository(Feed).save(feeds);
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.feeds).toMatchObject([
      {
        id: 'cf1',
        userId: '1',
        flags: {
          name: 'Cool feed',
        },
        slug: 'cool-feed-cf1',
      },
      {
        id: 'cf2',
        userId: '1',
        flags: {
          name: 'PHP feed',
        },
        slug: 'php-feed-cf2',
      },
    ]);
  });
});

describe('boot experimentation', () => {
  it('should return recent experiments from redis', async () => {
    mockLoggedIn();
    await ioRedisPool.execute((client) =>
      client.hset('exp:1', {
        e1: `v1:${new Date(2023, 5, 20).getTime()}`,
        e2: `v2:${new Date(2023, 5, 19).getTime()}`,
      }),
    );
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.exp.e).toEqual([base64('e1:v1'), base64('e2:v2')]);
  });

  it('should return features as attributes', async () => {
    mockLoggedIn();
    await con.getRepository(Feature).save([
      {
        userId: '1',
        feature: FeatureType.Search,
      },
      {
        userId: '1',
        feature: FeatureType.Squad,
      },
    ]);
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.exp.a).toEqual({ search: 1, squad: 1 });
  });
});

describe('companion boot', () => {
  const POST_DATA = {
    author: null,
    bookmarked: null,
    commentsPermalink: 'http://localhost:5002/posts/p1-p1',
    createdAt: expect.any(String),
    id: 'p1',
    image: 'https://daily.dev/image.jpg',
    numComments: 0,
    numUpvotes: 0,
    permalink: 'http://localhost:4000/r/sp1',
    readTime: null,
    source: {
      id: 'a',
      image: 'http://image.com/a',
      name: 'A',
    },
    summary: null,
    tags: ['javascript', 'webdev'],
    title: 'P1',
    trending: null,
    upvoted: null,
    downvoted: null,
    userState: null,
  };

  it('should support anonymous user', async () => {
    const res = await request(app.server)
      .get(`${BASE_PATH}/companion`)
      .query({ url: (postsFixture[0] as ArticlePost).url })
      .set('User-Agent', TEST_UA)
      .expect(200);
    expect(res.body).toEqual({
      ...ANONYMOUS_BODY,
      postData: POST_DATA,
    });
  });

  it('should support logged user', async () => {
    mockLoggedIn();
    const res = await request(app.server)
      .get(`${BASE_PATH}/companion`)
      .query({ url: (postsFixture[0] as ArticlePost).url })
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body).toEqual({
      ...LOGGED_IN_BODY,
      postData: {
        ...POST_DATA,
        bookmarked: false,
        upvoted: false,
        downvoted: false,
        userState: {
          vote: UserVote.None,
        },
      },
      user: {
        ...LOGGED_IN_BODY.user,
        canSubmitArticle:
          LOGGED_IN_BODY.user.reputation >= submitArticleThreshold,
      },
    });
  });

  it('should handle url not found', async () => {
    const res = await request(app.server)
      .get(`${BASE_PATH}/companion`)
      .query({ url: 'notfound' })
      .set('User-Agent', TEST_UA)
      .expect(200);
    expect(res.body).toEqual(ANONYMOUS_BODY);
  });

  it('should handle url not found', async () => {
    const res = await request(app.server)
      .get(`${BASE_PATH}/companion`)
      .query({ url: 'notfound' })
      .set('User-Agent', TEST_UA)
      .expect(200);
    expect(res.body).toEqual(ANONYMOUS_BODY);
  });
});

describe('boot alerts shouldShowFeedFeedback property', () => {
  it('should be false when the user has no alerts', async () => {
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .expect(200);
    expect(res.body.alerts.shouldShowFeedFeedback).toBeFalsy();
  });

  it('should be false when the user has seen the survey few days ago', async () => {
    mockLoggedIn();
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.alerts.shouldShowFeedFeedback).toBeFalsy();
  });

  it('should be true when the user has has seen the survey more than 30 days ago', async () => {
    await con
      .getRepository(Alerts)
      .update(
        { userId: '1' },
        { lastFeedSettingsFeedback: subDays(new Date(), 30) },
      );
    mockLoggedIn();
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.alerts.shouldShowFeedFeedback).toBeTruthy();
  });
});

describe('funnel boot', () => {
  const FUNNEL_DATA: FunnelState = {
    session: {
      userId: '1',
      id: 'sessionId',
      currentStep: '5',
    },
    funnel: {
      id: 'funnelId',
      version: 2,
    },
  };

  const FUNNEL_BOOT_BODY: FunnelBoot = {
    ...ANONYMOUS_BODY,
    funnelState: FUNNEL_DATA,
  };

  it('should return the funnel data for an anonymous user', async () => {
    nock(process.env.FREYJA_ORIGIN)
      .post('/api/sessions', {
        userId: '1',
        funnelId: 'funnelId',
        version: 2,
      })
      .reply(200, JSON.stringify(FUNNEL_DATA));

    const res = await request(app.server)
      .get(`${BASE_PATH}/funnel?id=funnelId&v=2`)
      .set('User-Agent', TEST_UA)
      .set('Cookie', `${cookies.tracking.key}=1;`)
      .expect(200);
    expect(res.body).toEqual(FUNNEL_BOOT_BODY);
  });

  it('should return the logged in user', async () => {
    nock(process.env.FREYJA_ORIGIN)
      .post('/api/sessions')
      .reply(200, JSON.stringify(FUNNEL_DATA));

    const accessToken = await signJwt(
      {
        userId: '1',
        roles: [],
      },
      15 * 60 * 1000,
    );

    const res = await request(app.server)
      .get(`${BASE_PATH}/funnel?id=funnelId`)
      .set('User-Agent', TEST_UA)
      .set(
        'Cookie',
        `${cookies.auth.key}=${app.signCookie(accessToken.token)};`,
      )
      .expect(200);
    expect(res.body).toEqual({
      ...FUNNEL_BOOT_BODY,
      user: excludeProperties(LOGGED_IN_BODY.user, [
        'balance',
        'flags',
        'isPlus',
        'isTeamMember',
        'language',
        'roles',
        'subscriptionFlags',
        'clickbaitTries',
        'hasLocationSet',
        'location',
        'readme',
      ]),
    });
  });

  it('should return anonymous user if jwt is expired', async () => {
    nock(process.env.FREYJA_ORIGIN)
      .post('/api/sessions')
      .reply(200, JSON.stringify(FUNNEL_DATA));

    const accessToken = await signJwt(
      {
        userId: '1',
        roles: [],
      },
      -15 * 60 * 1000,
    );

    const res = await request(app.server)
      .get(`${BASE_PATH}/funnel?id=funnelId`)
      .set('User-Agent', TEST_UA)
      .set(
        'Cookie',
        `${cookies.auth.key}=${app.signCookie(accessToken.token)};`,
      )
      .expect(200);
    expect(res.body).toEqual(FUNNEL_BOOT_BODY);
  });

  it('should set cookie for the new funnel', async () => {
    nock(process.env.FREYJA_ORIGIN)
      .post('/api/sessions')
      .reply(200, JSON.stringify(FUNNEL_DATA));

    const res = await request(app.server)
      .get(`${BASE_PATH}/funnel?id=funnelId`)
      .set('User-Agent', TEST_UA)
      .set('Cookie', `${cookies.tracking.key}=1;`)
      .expect(200);

    const cookie = (res.get('set-cookie') as unknown as string[]).find((c) =>
      c.startsWith(cookies.funnel.key),
    );
    expect(cookie?.split(';')[0]).toEqual(
      `${cookies.funnel.key}=${FUNNEL_DATA.session.id}`,
    );
  });

  it('should load funnel when cookie is present', async () => {
    nock(process.env.FREYJA_ORIGIN)
      .get(`/api/sessions/${FUNNEL_DATA.session.id}`)
      .reply(200, JSON.stringify(FUNNEL_DATA));

    const res = await request(app.server)
      .get(`${BASE_PATH}/funnel?id=funnelId`)
      .set('User-Agent', TEST_UA)
      .set(
        'Cookie',
        `${cookies.tracking.key}=1;${cookies.funnel.key}=${FUNNEL_DATA.session.id};`,
      )
      .expect(200);
    expect(res.body).toEqual(FUNNEL_BOOT_BODY);
  });

  it('should ignore cookie when the user does not match', async () => {
    nock(process.env.FREYJA_ORIGIN)
      .get(`/api/sessions/${FUNNEL_DATA.session.id}`)
      .reply(200, JSON.stringify(FUNNEL_DATA));

    const clone = structuredClone(FUNNEL_DATA);
    clone.session.userId = '2';
    nock(process.env.FREYJA_ORIGIN)
      .post('/api/sessions')
      .reply(200, JSON.stringify(clone));

    const res = await request(app.server)
      .get(`${BASE_PATH}/funnel?id=funnelId`)
      .set('User-Agent', TEST_UA)
      .set(
        'Cookie',
        `${cookies.tracking.key}=2;${cookies.funnel.key}=${FUNNEL_DATA.session.id};`,
      )
      .expect(200);
    expect(res.body.funnelState.session.userId).toEqual('2');
  });

  it('should ignore cookie when the funnel does not match', async () => {
    nock(process.env.FREYJA_ORIGIN)
      .get(`/api/sessions/${FUNNEL_DATA.session.id}`)
      .reply(200, JSON.stringify(FUNNEL_DATA));

    nock(process.env.FREYJA_ORIGIN)
      .post('/api/sessions')
      .reply(200, JSON.stringify(FUNNEL_DATA));

    const res = await request(app.server)
      .get(`${BASE_PATH}/funnel?id=funnelId2`)
      .set('User-Agent', TEST_UA)
      .set(
        'Cookie',
        `${cookies.tracking.key}=1;${cookies.funnel.key}=${FUNNEL_DATA.session.id};`,
      )
      .expect(200);
    expect(res.body).toEqual(FUNNEL_BOOT_BODY);
  });

  it('should load funnel id from growthbook', async () => {
    nock(process.env.FREYJA_ORIGIN)
      .post('/api/sessions', {
        userId: '1',
        funnelId: 'gbId',
      })
      .reply(200, JSON.stringify(FUNNEL_DATA));

    await request(app.server)
      .get(`${BASE_PATH}/funnel`)
      .set('User-Agent', TEST_UA)
      .set('Cookie', `${cookies.tracking.key}=1;`)
      .expect(200);
  });

  describe('funnels/:id route', () => {
    it('should return the funnel data for "onboarding" funnel', async () => {
      nock(process.env.FREYJA_ORIGIN)
        .post('/api/sessions', {
          userId: '1',
          funnelId: 'gbId',
        })
        .reply(200, JSON.stringify(FUNNEL_DATA));

      await request(app.server)
        .get(`${BASE_PATH}/funnels/onboarding`)
        .set('User-Agent', TEST_UA)
        .set('Cookie', `${cookies.tracking.key}=1;`)
        .expect(200);
    });

    it('should return 404 for invalid funnel id', async () => {
      const res = await request(app.server)
        .get(`${BASE_PATH}/funnels/invalid`)
        .set('User-Agent', TEST_UA)
        .set('Cookie', `${cookies.tracking.key}=1;`)
        .expect(404);

      expect(res.body).toEqual({ error: 'Funnel not found' });
    });

    it('should set different cookies for legacy funnel and onboarding funnel', async () => {
      // Mock responses for both funnel types
      nock(process.env.FREYJA_ORIGIN)
        .post('/api/sessions')
        .twice()
        .reply(200, JSON.stringify(FUNNEL_DATA));

      // Request legacy funnel
      const legacyRes = await request(app.server)
        .get(`${BASE_PATH}/funnel?id=funnelId`)
        .set('User-Agent', TEST_UA)
        .set('Cookie', `${cookies.tracking.key}=1;`)
        .expect(200);

      // Request onboarding funnel
      const onboardingRes = await request(app.server)
        .get(`${BASE_PATH}/funnels/onboarding`)
        .set('User-Agent', TEST_UA)
        .set('Cookie', `${cookies.tracking.key}=1;`)
        .expect(200);

      // Extract cookies from responses
      const legacyCookies = setCookieParser.parse(
        legacyRes.get('set-cookie') as unknown as string[],
      );
      const onboardingCookies = setCookieParser.parse(
        onboardingRes.get('set-cookie') as unknown as string[],
      );

      // Find the funnel cookies
      const legacyFunnelCookie = legacyCookies.find(
        (c) => c.name === cookies.funnel.key,
      );
      const onboardingFunnelCookie = onboardingCookies.find(
        (c) => c.name === cookies.onboarding.key,
      );

      // Verify both cookies exist
      expect(legacyFunnelCookie).toBeDefined();
      expect(onboardingFunnelCookie).toBeDefined();

      // Verify cookies have different names
      expect(legacyFunnelCookie?.name).not.toEqual(
        onboardingFunnelCookie?.name,
      );

      // Verify cookie values
      expect(legacyFunnelCookie?.value).toEqual(FUNNEL_DATA.session.id);
      expect(onboardingFunnelCookie?.value).toEqual(FUNNEL_DATA.session.id);
    });
  });
});

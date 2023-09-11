import { FastifyInstance } from 'fastify';
import request from 'supertest';
import {
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  mockFeatureFlagForUser,
  TEST_UA,
} from './helpers';
import createOrGetConnection from '../src/db';
import { DataSource } from 'typeorm';
import {
  Alerts,
  ALERTS_DEFAULT,
  ArticlePost,
  Banner,
  MachineSource,
  Notification,
  Post,
  Settings,
  SETTINGS_DEFAULT,
  Source,
  SourceMember,
  SourceType,
  SQUAD_IMAGE_PLACEHOLDER,
  SquadSource,
  User,
  UserPostVote,
} from '../src/entity';
import { SourceMemberRoles, sourceRoleRank } from '../src/roles';
import { notificationFixture } from './fixture/notifications';
import { usersFixture } from './fixture/user';
import { getRedisObject, ioRedisPool, setRedisObject } from '../src/redis';
import {
  generateStorageKey,
  REDIS_BANNER_KEY,
  REDIS_CHANGELOG_KEY,
  StorageTopic,
} from '../src/config';
import nock from 'nock';
import { addDays, setMilliseconds } from 'date-fns';
import setCookieParser from 'set-cookie-parser';
import flagsmith from '../src/flagsmith';
import { postsFixture } from './fixture/post';
import { sourcesFixture } from './fixture/source';
import { DEFAULT_FLAGS } from '../src/featureFlags';
import { SourcePermissions } from '../src/schema/sources';
import { getEncryptedFeatures } from '../src/growthbook';
import { base64 } from 'graphql-relay/utils/base64';

jest.mock('../src/flagsmith', () => ({
  getIdentityFlags: jest.fn(),
}));

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;

const BASE_BODY = {
  alerts: {
    ...ALERTS_DEFAULT,
    lastChangelog: expect.any(String),
    lastBanner: expect.any(String),
  },
  settings: { ...SETTINGS_DEFAULT, companionExpanded: null },
  notifications: { unreadNotificationsCount: 0 },
  squads: [],
  flags: DEFAULT_FLAGS,
  visit: {
    sessionId: expect.any(String),
    visitId: expect.any(String),
  },
  exp: { f: 'enc', e: [] },
};

const LOGGED_IN_BODY = {
  ...BASE_BODY,
  accessToken: {
    expiresIn: expect.any(String),
    token: expect.any(String),
  },
  user: {
    ...usersFixture[0],
    createdAt: (usersFixture[0].createdAt as Date).toISOString(),
    permalink: 'http://localhost:5002/idoshamun',
    providers: [null],
    roles: [],
    title: null,
    timezone: null,
    reputation: 10,
    portfolio: null,
    notificationEmail: true,
    acceptedMarketing: false,
    company: null,
  },
};

const ANONYMOUS_BODY = {
  ...BASE_BODY,
  settings: SETTINGS_DEFAULT,
  user: {
    id: expect.any(String),
    firstVisit: expect.any(String),
  },
  shouldLogout: false,
};

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(() => new MockContext(con));
  app = state.app;
});

beforeEach(async () => {
  jest.resetAllMocks();
  jest.mocked(getEncryptedFeatures).mockReturnValue('enc');
  await con.getRepository(User).save(usersFixture[0]);
  await con.getRepository(Source).save(sourcesFixture);
  await con.getRepository(Post).save(postsFixture);
  mockFeatureFlagForUser();
  await ioRedisPool.execute((client) => client.flushall());
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

  it('should not set tracking and session id for bots', async () => {
    const res = await request(app.server).get(BASE_PATH).expect(200);
    expect(res.body).toEqual({
      ...ANONYMOUS_BODY,
      user: {
        id: null,
        firstVisit: null,
      },
      visit: {
        visitId: expect.any(String),
      },
    });
  });

  it('should read join_referral cookie', async () => {
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', ['join_referral=1:knightcampaign'])
      .expect(200);
    expect(res.body).toEqual({
      ...ANONYMOUS_BODY,
      user: {
        id: null,
        firstVisit: null,
        referralId: '1',
        referralOrigin: 'knightcampaign',
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

  it('should validate onboarding v2 requirement', async () => {
    const first = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .expect(200);
    await ioRedisPool.execute((client) =>
      client.set(
        generateStorageKey(
          StorageTopic.Boot,
          'first_visit',
          first.body.user.id,
        ),
        new Date(2023, 6, 10).toISOString(),
      ),
    );
    mockFeatureFlagForUser('onboarding_v2', true, 'v1');
    const second = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', first.headers['set-cookie'])
      .expect(200);
    expect(second.body.user.id).toEqual(first.body.user.id);
    expect(second.body.flags.onboarding_v2.enabled).toBeFalsy();
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
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', first.headers['set-cookie'])
      .expect(200);
    const secondTTL = await ioRedisPool.execute((client) => client.ttl(key));
    // Should have reset the TTL
    expect(firstTTL).toEqual(secondTTL);
  });

  it('should not change value if user is not a pre onboarding v2 user', async () => {
    mockFeatureFlagForUser('onboarding_v2', true, 'v1');
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .expect(200);
    expect(res.body.flags.onboarding_v2.enabled).toBeTruthy();
    expect(res.body.flags.onboarding_v2.value).toEqual('v1');
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
    expect(res.body).toEqual(LOGGED_IN_BODY);
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
      shouldLogout: true,
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
      shouldLogout: true,
    });
  });
});

describe('boot alerts', () => {
  it('should return user alerts', async () => {
    mockLoggedIn();
    const data = await con.getRepository(Alerts).save({
      userId: '1',
      myFeed: 'created',
    });
    const alerts = new Object(data);
    alerts['changelog'] = false;
    alerts['banner'] = false;
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

  it('should return changelog as true', async () => {
    mockLoggedIn();
    await setRedisObject(REDIS_CHANGELOG_KEY, '2023-02-06 12:00:00');
    const data = await con.getRepository(Alerts).save({
      userId: '1',
      myFeed: 'created',
      lastChangelog: new Date('2023-02-05 12:00:00'),
      lastBanner: new Date('2023-02-05 12:00:00'),
    });
    const alerts = new Object(data);
    alerts['lastChangelog'] = '2023-02-05T12:00:00.000Z';
    alerts['changelog'] = true;
    alerts['banner'] = false;
    alerts['lastBanner'] = '2023-02-05T12:00:00.000Z';

    delete alerts['userId'];
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.alerts).toEqual(alerts);
  });

  it('should return changelog as false', async () => {
    mockLoggedIn();
    await setRedisObject(REDIS_CHANGELOG_KEY, '2023-02-05 12:00:00');
    const data = await con.getRepository(Alerts).save({
      userId: '1',
      myFeed: 'created',
      lastChangelog: new Date('2023-02-06 12:00:00'),
      lastBanner: new Date('2023-02-06 12:00:00'),
    });
    const alerts = new Object(data);
    alerts['lastChangelog'] = '2023-02-06T12:00:00.000Z';
    alerts['lastBanner'] = '2023-02-06T12:00:00.000Z';
    alerts['changelog'] = false;
    alerts['banner'] = false;
    delete alerts['userId'];
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.alerts).toEqual(alerts);
  });

  it('should return changelog as true if redis is empty', async () => {
    mockLoggedIn();
    await setRedisObject(REDIS_CHANGELOG_KEY, null);
    const data = await con.getRepository(Alerts).save({
      userId: '1',
      myFeed: 'created',
      lastChangelog: new Date('2023-02-05 12:00:00'),
      lastBanner: new Date('2023-02-05 12:00:00'),
    });
    await con.getRepository(Source).save({
      id: 'daily_updates',
      name: 'daily_updates',
      handle: 'daily_updates',
    });
    const post = await con.getRepository(Post).save({
      id: 'daily_updates_1',
      shortId: 'du1',
      title: 'daily_updates_1',
      createdAt: new Date('2023-02-06 12:00:00'),
      sourceId: 'daily_updates',
    });
    const alerts = new Object(data);
    alerts['lastChangelog'] = '2023-02-05T12:00:00.000Z';
    alerts['lastBanner'] = '2023-02-05T12:00:00.000Z';
    alerts['changelog'] = true;
    alerts['banner'] = false;
    delete alerts['userId'];
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.alerts).toEqual(alerts);
    expect(await getRedisObject(REDIS_CHANGELOG_KEY)).toEqual(
      post.createdAt.toISOString(),
    );
  });

  it('should return changelog as false if redis is empty', async () => {
    mockLoggedIn();
    await setRedisObject(REDIS_CHANGELOG_KEY, null);
    const data = await con.getRepository(Alerts).save({
      userId: '1',
      myFeed: 'created',
      lastChangelog: new Date('2023-02-06 12:00:00'),
      lastBanner: new Date('2023-02-06 12:00:00'),
    });
    await con.getRepository(Source).save({
      id: 'daily_updates',
      name: 'daily_updates',
      handle: 'daily_updates',
    });
    const post = await con.getRepository(Post).save({
      id: 'daily_updates_1',
      shortId: 'du1',
      title: 'daily_updates_1',
      createdAt: new Date('2023-02-05 12:00:00'),
      sourceId: 'daily_updates',
    });
    const alerts = new Object(data);
    alerts['lastChangelog'] = '2023-02-06T12:00:00.000Z';
    alerts['lastBanner'] = '2023-02-06T12:00:00.000Z';
    alerts['changelog'] = false;
    alerts['banner'] = false;
    delete alerts['userId'];
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.alerts).toEqual(alerts);
    expect(await getRedisObject(REDIS_CHANGELOG_KEY)).toEqual(
      post.createdAt.toISOString(),
    );
  });

  it('should return banner as true', async () => {
    mockLoggedIn();
    await setRedisObject(REDIS_BANNER_KEY, '2023-02-06 12:00:00');
    const data = await con.getRepository(Alerts).save({
      userId: '1',
      myFeed: 'created',
      lastBanner: new Date('2023-02-05 12:00:00'),
      lastChangelog: new Date('2023-02-05 12:00:00'),
    });
    const alerts = new Object(data);
    alerts['lastBanner'] = '2023-02-05T12:00:00.000Z';
    alerts['lastChangelog'] = '2023-02-05T12:00:00.000Z';
    alerts['changelog'] = false;
    alerts['banner'] = true;
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
      userId: '1',
      myFeed: 'created',
      lastBanner: new Date('2023-02-06 12:00:00'),
      lastChangelog: new Date('2023-02-06 12:00:00'),
    });
    const alerts = new Object(data);
    alerts['lastChangelog'] = '2023-02-06T12:00:00.000Z';
    alerts['lastBanner'] = '2023-02-06T12:00:00.000Z';
    alerts['banner'] = false;
    alerts['changelog'] = false;
    delete alerts['userId'];
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.alerts).toEqual(alerts);
  });

  it('should return banner as false if redis is false', async () => {
    mockLoggedIn();
    await setRedisObject(REDIS_CHANGELOG_KEY, 'false');
    const data = await con.getRepository(Alerts).save({
      userId: '1',
      myFeed: 'created',
      lastChangelog: new Date('2023-02-05 12:00:00'),
      lastBanner: new Date('2023-02-05 12:00:00'),
    });
    const alerts = new Object(data);
    alerts['lastChangelog'] = '2023-02-05T12:00:00.000Z';
    alerts['changelog'] = false;
    alerts['lastBanner'] = '2023-02-05T12:00:00.000Z';
    alerts['banner'] = false;
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
    const alerts = new Object(data);
    alerts['lastBanner'] = '2023-02-06T12:00:00.000Z';
    alerts['banner'] = true;
    alerts['changelog'] = false;
    alerts['lastChangelog'] = '2023-02-05T12:00:00.000Z';
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
    expect(res.body.settings).toEqual(settings);
  });

  it('should return submit article true', async () => {
    mockLoggedIn();
    await con.getRepository(User).update({ id: '1' }, { reputation: 300 });
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.flags.submit_article.enabled).toEqual(true);
  });

  it('should return unread notifications count', async () => {
    mockLoggedIn();
    await con
      .getRepository(Notification)
      .save([
        notificationFixture,
        { ...notificationFixture, uniqueKey: '2' },
        { ...notificationFixture, uniqueKey: '3', readAt: new Date() },
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
});

describe('boot feature flags', () => {
  it('should return user feature flags', async () => {
    mockLoggedIn();
    mockFeatureFlagForUser('my_flag', true, 'value');
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.flags).toEqual({
      my_flag: {
        enabled: true,
        value: 'value',
      },
    });
  });

  it('should return valid response when flagsmith returns error', async () => {
    mockLoggedIn();
    jest.mocked(flagsmith.getIdentityFlags).mockRejectedValue('error');
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body).toEqual(LOGGED_IN_BODY);
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
});

describe('companion boot', () => {
  const POST_DATA = {
    author: null,
    bookmarked: null,
    commentsPermalink: 'http://localhost:5002/posts/p1',
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
          vote: UserPostVote.None,
        },
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
});

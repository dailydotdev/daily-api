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
  Settings,
  SETTINGS_DEFAULT,
  Notification,
  User,
  SquadSource,
  Source,
  SourceMember,
  SourceMemberRoles,
  MachineSource,
  SQUAD_IMAGE_PLACEHOLDER,
  SourceType,
  Post,
} from '../src/entity';
import { notificationFixture } from './fixture/notifications';
import { usersFixture } from './fixture/user';
import { setRedisObject } from '../src/redis';
import { REDIS_CHANGELOG_KEY } from '../src/config';
import nock from 'nock';
import { addDays, setMilliseconds } from 'date-fns';
import setCookieParser from 'set-cookie-parser';
import flagsmith from '../src/flagsmith';
import { postsFixture } from './fixture/post';
import { sourcesFixture } from './fixture/source';
import { DEFAULT_FLAGS } from '../src/featureFlags';

jest.mock('../src/flagsmith', () => ({
  getIdentityFlags: jest.fn(),
}));

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;

const BASE_BODY = {
  alerts: { ...ALERTS_DEFAULT, lastChangelog: expect.any(String) },
  settings: { ...SETTINGS_DEFAULT, companionExpanded: null },
  notifications: { unreadNotificationsCount: 0 },
  squads: [],
  flags: DEFAULT_FLAGS,
  visit: {
    sessionId: expect.any(String),
    visitId: expect.any(String),
  },
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
  await con.getRepository(User).save(usersFixture[0]);
  await con.getRepository(Source).save(sourcesFixture);
  await con.getRepository(Post).save(postsFixture);
  mockFeatureFlagForUser();
});

const BASE_PATH = '/boot';
const KRATOS_EXPIRATION = addDays(setMilliseconds(new Date(), 0), 1);

const mockWhoami = (expected: unknown, statusCode = 200) => {
  nock(process.env.HEIMDALL_ORIGIN)
    .get('/api/whoami')
    .reply(statusCode, JSON.stringify(expected));
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
      },
      visit: {
        visitId: expect.any(String),
      },
    });
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
    expect(cookies[kratosCookie].value).toEqual('value');
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
    delete alerts['userId'];
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.alerts).toEqual({
      ...alerts,
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
    });
    const alerts = new Object(data);
    alerts['lastChangelog'] = '2023-02-05T12:00:00.000Z';
    alerts['changelog'] = true;
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
    });
    const alerts = new Object(data);
    alerts['lastChangelog'] = '2023-02-06T12:00:00.000Z';
    alerts['changelog'] = false;
    delete alerts['userId'];
    const res = await request(app.server)
      .get(BASE_PATH)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body.alerts).toEqual(alerts);
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
  };

  it('should support anonymous user', async () => {
    const res = await request(app.server)
      .get(`${BASE_PATH}/companion`)
      .query({ url: postsFixture[0].url })
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
      .query({ url: postsFixture[0].url })
      .set('User-Agent', TEST_UA)
      .set('Cookie', 'ory_kratos_session=value;')
      .expect(200);
    expect(res.body).toEqual({
      ...LOGGED_IN_BODY,
      postData: {
        ...POST_DATA,
        bookmarked: false,
        upvoted: false,
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

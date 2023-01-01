import { FastifyInstance } from 'fastify';
import request from 'supertest';
import {
  authorizeRequest,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
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
  SourceMember,
  SourceMemberRoles,
  MachineSource,
  SQUAD_IMAGE_PLACEHOLDER,
} from '../src/entity';
import { notificationFixture } from './fixture/notifications';
import { usersFixture } from './fixture/user';

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;

const DEFAULT_BODY = {
  alerts: ALERTS_DEFAULT,
  settings: { ...SETTINGS_DEFAULT, companionExpanded: null },
  notifications: { unreadNotificationsCount: 0 },
  squads: [],
};

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(() => new MockContext(con));
  app = state.app;
});

beforeEach(async () => {
  await con.getRepository(User).save(usersFixture[0]);
});

it('should return defaults for anonymous', async () => {
  const res = await request(app.server).get('/boot').expect(200);
  expect(res.body).toEqual({
    ...DEFAULT_BODY,
    settings: SETTINGS_DEFAULT,
  });
});

it('should return defaults for user when not set', async () => {
  const res = await authorizeRequest(request(app.server).get('/boot')).expect(
    200,
  );
  expect(res.body).toEqual(DEFAULT_BODY);
});

it('should return user alerts', async () => {
  const data = await con.getRepository(Alerts).save({
    userId: '1',
    myFeed: 'created',
  });
  const alerts = new Object(data);
  delete alerts['userId'];
  const res = await authorizeRequest(request(app.server).get('/boot')).expect(
    200,
  );
  expect(res.body).toEqual({
    ...DEFAULT_BODY,
    alerts,
  });
});

it('should return user settings', async () => {
  const data = await con.getRepository(Settings).save({
    userId: '1',
    theme: 'bright',
    insaneMode: true,
  });
  const settings = new Object(data);
  delete settings['updatedAt'];
  delete settings['userId'];
  delete settings['bookmarkSlug'];
  const res = await authorizeRequest(request(app.server).get('/boot')).expect(
    200,
  );
  expect(res.body).toEqual({
    ...DEFAULT_BODY,
    settings,
  });
});

it('should return unread notifications count', async () => {
  await con
    .getRepository(Notification)
    .save([
      notificationFixture,
      { ...notificationFixture, uniqueKey: '2' },
      { ...notificationFixture, uniqueKey: '3', readAt: new Date() },
    ]);
  const res = await authorizeRequest(request(app.server).get('/boot')).expect(
    200,
  );
  expect(res.body).toEqual({
    ...DEFAULT_BODY,
    notifications: { unreadNotificationsCount: 2 },
  });
});

it('should return the user squads', async () => {
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
  const res = await authorizeRequest(request(app.server).get('/boot')).expect(
    200,
  );
  expect(res.body).toEqual({
    ...DEFAULT_BODY,
    squads: [
      {
        active: false,
        handle: 's1',
        id: 's1',
        image: SQUAD_IMAGE_PLACEHOLDER,
        name: 'Squad',
        permalink: 'http://localhost:5002/squads/s1',
        public: true,
        type: 'squad',
      },
      {
        active: true,
        handle: 's2',
        id: 's2',
        image: SQUAD_IMAGE_PLACEHOLDER,
        name: 'Squad 2',
        permalink: 'http://localhost:5002/squads/s2',
        public: false,
        type: 'squad',
      },
    ],
  });
});

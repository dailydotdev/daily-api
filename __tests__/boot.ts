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
} from '../src/entity';
import { notificationFixture } from './fixture/notifications';
import { usersFixture } from './fixture/user';

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;

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
    alerts: ALERTS_DEFAULT,
    settings: SETTINGS_DEFAULT,
    notifications: { unreadNotificationsCount: 0 },
  });
});

it('should return defaults for user when not set', async () => {
  const res = await authorizeRequest(request(app.server).get('/boot')).expect(
    200,
  );
  expect(res.body).toEqual({
    alerts: ALERTS_DEFAULT,
    settings: { ...SETTINGS_DEFAULT, companionExpanded: null },
    notifications: { unreadNotificationsCount: 0 },
  });
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
    alerts,
    settings: { ...SETTINGS_DEFAULT, companionExpanded: null },
    notifications: { unreadNotificationsCount: 0 },
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
    alerts: ALERTS_DEFAULT,
    settings,
    notifications: { unreadNotificationsCount: 0 },
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
    alerts: ALERTS_DEFAULT,
    settings: { ...SETTINGS_DEFAULT, companionExpanded: null },
    notifications: { unreadNotificationsCount: 2 },
  });
});

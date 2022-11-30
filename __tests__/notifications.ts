import {
  authorizeRequest,
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
} from './helpers';
import { Banner, Notification, NotificationType, User } from '../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { usersFixture } from './fixture/user';

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
  app = state.app;
});

beforeEach(async () => {
  loggedUser = null;
});

afterAll(() => disposeGraphQLTesting(state));

describe('notifications route', () => {
  it('should return not found when not authorized', async () => {
    await authorizeRequest(request(app.server).get('/notifications')).expect(
      401,
    );
  });

  it('should return 0 notifications by default', async () => {
    loggedUser = '1';
    const expected = { notificationCount: 0 };
    const res = await authorizeRequest(
      request(app.server).get('/notifications'),
    ).expect(200);
    expect(res.body).toEqual(expected);
  });

  it('should return 1 notification if unread', async () => {
    loggedUser = '1';
    await con.getRepository(User).save([usersFixture[0]]);
    const defaultNotification = {
      userId: '1',
      type: <NotificationType>'community_picks_failed',
      icon: '1',
      targetUrl: '#1',
      title: 'Test',
    };
    const repo = con.getRepository(Notification);
    const settings = [
      repo.create({ ...defaultNotification }),
      repo.create({
        ...defaultNotification,
        readAt: new Date(),
      }),
    ];
    await repo.save(settings);

    const expected = { notificationCount: 1 };
    const res = await authorizeRequest(
      request(app.server).get('/notifications'),
    ).expect(200);
    expect(res.body).toEqual(expected);
  });
});

describe('query notification count', () => {
  const QUERY = (): string => `{
  notificationCount
}`;

  it('should return empty response by default', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY());
    expect(res.data).toEqual({ notificationCount: 0 });
  });

  it('should return 1 if unread notifications', async () => {
    loggedUser = '1';
    const defaultNotification = {
      userId: '1',
      type: <NotificationType>'community_picks_failed',
      icon: '1',
      targetUrl: '#1',
      title: 'Test',
    };
    await con.getRepository(User).save([usersFixture[0]]);
    await con.getRepository(Notification).save([
      {
        ...defaultNotification,
      },
      {
        ...defaultNotification,
        readAt: new Date(),
      },
    ]);
    const res = await client.query(QUERY());
    expect(res.data).toEqual({ notificationCount: 1 });
  });
});

describe('query banner', () => {
  const QUERY = (lastSeen: Date): string => `{
  banner(lastSeen: "${lastSeen.toISOString()}") {
    title
    subtitle
    cta
    url
    theme
  }
}`;

  const now = new Date();

  beforeEach(() =>
    con.getRepository(Banner).save({
      timestamp: now,
      cta: 'CTA',
      subtitle: 'Subtitle',
      title: 'Title',
      theme: 'Theme',
      url: 'https://daily.dev',
    }),
  );

  it('should return the banner', async () => {
    const res = await client.query(QUERY(new Date(now.getTime() - 100000)));
    expect(res.data).toMatchSnapshot();
  });

  it('should return empty response when no relevant banner', async () => {
    const res = await client.query(QUERY(new Date(now.getTime() + 1)));
    expect(res.data).toMatchSnapshot();
  });
});

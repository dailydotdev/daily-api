import {
  authorizeRequest,
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import {
  Banner,
  Notification,
  NotificationAttachment,
  NotificationAvatar,
  User,
} from '../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { usersFixture } from './fixture/user';
import { notificationFixture } from './fixture/notifications';
import { subDays } from 'date-fns';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { NotificationType } from '../src/notifications';

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

beforeEach(async () => {
  loggedUser = null;
  jest.resetAllMocks();

  await con.getRepository(User).save(usersFixture);
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
    const expected = { unreadNotificationsCount: 0 };
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

    const expected = { unreadNotificationsCount: 1 };
    const res = await authorizeRequest(
      request(app.server).get('/notifications'),
    ).expect(200);
    expect(res.body).toEqual(expected);
  });
});

describe('query notification count', () => {
  const QUERY = (): string => `{
  unreadNotificationsCount
}`;

  it('should return empty response by default', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY());
    expect(res.data).toEqual({ unreadNotificationsCount: 0 });
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
    expect(res.data).toEqual({ unreadNotificationsCount: 1 });
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

describe('query notifications', () => {
  const QUERY = `
  query Notifications($after: String, $first: Int) {
    notifications(after: $after, first: $first) {
      pageInfo { endCursor, hasNextPage }
      edges {
        node {
          type
          icon
          createdAt
          readAt
          title
          description
          targetUrl
          avatars {
            type
            image
            name
            targetUrl
          }
          attachments {
            type
            image
            title
          }
        }
      }
    }
}`;

  it('should not authorize when not logged-in', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should return the notifications of the logged user', async () => {
    loggedUser = '1';
    await con
      .getRepository(Notification)
      .save([
        { ...notificationFixture },
        { ...notificationFixture, userId: '2', title: 'notification #2' },
      ]);
    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });

  it('should return the public notifications', async () => {
    loggedUser = '1';
    await con
      .getRepository(Notification)
      .save([
        { ...notificationFixture },
        { ...notificationFixture, public: false, title: 'notification #2' },
      ]);
    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });

  it('should return avatars and attachments', async () => {
    loggedUser = '1';
    const { id } = await con
      .getRepository(Notification)
      .save({ ...notificationFixture });
    await con.getRepository(NotificationAttachment).save([
      {
        notificationId: id,
        image: 'img#1',
        title: 'att #1',
        order: 2,
        type: 'post',
        referenceId: '1',
      },
      {
        notificationId: id,
        image: 'img#2',
        title: 'att #2',
        order: 1,
        type: 'post',
        referenceId: '2',
      },
    ]);
    await con.getRepository(NotificationAvatar).save([
      {
        notificationId: id,
        image: 'img#1',
        referenceId: '1',
        order: 2,
        type: 'user',
        targetUrl: 'user#1',
        name: 'User #1',
      },
      {
        notificationId: id,
        image: 'img#2',
        referenceId: '2',
        order: 1,
        type: 'source',
        targetUrl: 'source#1',
        name: 'Source #1',
      },
    ]);
    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });

  it('should return pagination response', async () => {
    loggedUser = '1';
    await con.getRepository(Notification).save(
      Array.from(Array(5)).map((_, i) => ({
        ...notificationFixture,
        title: `notification #${i + 1}`,
        createdAt: subDays(notificationFixture.createdAt as Date, i),
      })),
    );
    const res1 = await client.query(QUERY, { variables: { first: 2 } });
    expect(res1.data).toMatchSnapshot();
    const res2 = await client.query(QUERY, {
      variables: {
        first: 2,
        after: res1.data.notifications.pageInfo.endCursor,
      },
    });
    expect(res2.data).toMatchSnapshot();
  });
});

describe('mutation readNotifications', () => {
  const QUERY = `
  mutation ReadNotifications {
    readNotifications {
      _
    }
}`;

  it('should not authorize when not logged-in', () =>
    testMutationErrorCode(client, { mutation: QUERY }, 'UNAUTHENTICATED'));

  it('should set unread notifications as read', async () => {
    loggedUser = '1';
    await con.getRepository(Notification).save([
      { ...notificationFixture },
      {
        ...notificationFixture,
        readAt: new Date(),
        createdAt: subDays(notificationFixture.createdAt as Date, 1),
      },
      {
        ...notificationFixture,
        createdAt: subDays(notificationFixture.createdAt as Date, 2),
      },
      {
        ...notificationFixture,
        readAt: new Date(),
        createdAt: subDays(notificationFixture.createdAt as Date, 3),
      },
      {
        ...notificationFixture,
        userId: '2',
      },
    ]);
    await client.mutate(QUERY);
    const res1 = await con
      .getRepository(Notification)
      .find({ where: { userId: '1' }, order: { createdAt: 'desc' } });
    res1.map((notification) => expect(notification.readAt).toBeTruthy());
    const res2 = await con
      .getRepository(Notification)
      .find({ where: { userId: '2' }, order: { createdAt: 'desc' } });
    res2.map((notification) => expect(notification.readAt).toBeFalsy());
  });
});

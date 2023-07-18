import {
  authorizeRequest,
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import {
  Banner,
  Notification,
  NotificationAttachment,
  NotificationAvatar,
  NotificationPreferencePost,
  Post,
  User,
  Source,
  NotificationPreferenceSource,
  NotificationPreference,
} from '../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { usersFixture } from './fixture/user';
import { notificationFixture } from './fixture/notifications';
import { subDays } from 'date-fns';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import {
  NotificationPreferenceStatus,
  NotificationPreferenceType,
  NotificationType,
} from '../src/notifications/common';
import { postsFixture } from './fixture/post';
import { sourcesFixture } from './fixture/source';

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

const prepareNotificationPreferences = async () => {
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await con.getRepository(NotificationPreferencePost).save([
    {
      userId: '1',
      postId: postsFixture[0].id,
      uniqueKey: postsFixture[0].id,
      notificationType: NotificationType.ArticleNewComment,
      status: NotificationPreferenceStatus.Muted,
    },
    {
      userId: '2',
      postId: postsFixture[1].id,
      uniqueKey: postsFixture[1].id,
      notificationType: NotificationType.ArticleNewComment,
      status: NotificationPreferenceStatus.Muted,
    },
  ]);
  await con.getRepository(NotificationPreferenceSource).save([
    {
      userId: '1',
      sourceId: sourcesFixture[0].id,
      uniqueKey: sourcesFixture[0].id,
      notificationType: NotificationType.SourceApproved,
      status: NotificationPreferenceStatus.Muted,
    },
  ]);
};

describe('query notificationPreferences', () => {
  const QUERY = `
    query NotificationPreferences($type: String) {
      notificationPreferences(type: $type) {
        uniqueKey
        userId
        notificationType
        status
        type
      }
    }
  `;

  it('should not authorize when not logged-in', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it("should return logged in user's notification preferences", async () => {
    loggedUser = '1';

    await prepareNotificationPreferences();

    const res = await client.query(QUERY);
    const isValid = res.data.notificationPreferences.every(
      ({ userId }: NotificationPreferencePost) => userId === loggedUser,
    );
    expect(isValid).toBeTruthy();
  });

  it('should return based on notification preferences type', async () => {
    loggedUser = '1';

    await prepareNotificationPreferences();

    const requestType = NotificationPreferenceType.Post;
    const res = await client.query(QUERY, { variables: { type: requestType } });
    const isValid = res.data.notificationPreferences.every(
      ({ userId, type }: NotificationPreferencePost) =>
        userId === loggedUser && type === requestType,
    );
    expect(isValid).toBeTruthy();
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

describe('mutation muteNotificationPreference', () => {
  const MUTATION = `
    mutation MuteNotificationPreference($referenceId: ID!, $type: String!) {
      muteNotificationPreference(referenceId: $referenceId, type: $type) {
        _
      }
    }
  `;

  it('should not authorize when not logged-in', () =>
    testMutationErrorCode(client, { mutation: MUTATION }, 'UNAUTHENTICATED'));

  it('should throw an error when type is not yet defined in the map', () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { referenceId: '1', type: NotificationType.ArticlePicked },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should throw an error referenced id is not found', () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          referenceId: '1',
          type: NotificationType.ArticleNewComment,
        },
      },
      'NOT_FOUND',
    );
  });

  it('should set notification preference to muted', async () => {
    loggedUser = '1';

    await prepareNotificationPreferences();

    const params = {
      userId: loggedUser,
      uniqueKey: postsFixture[2].id,
      notificationType: NotificationType.ArticleNewComment,
    };

    const preference = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(preference).toBeFalsy();

    await client.mutate(MUTATION, {
      variables: {
        referenceId: params.uniqueKey,
        type: params.notificationType,
      },
    });

    const muted = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(muted).toBeTruthy();
  });

  it('should ignore when preference is already muted', async () => {
    loggedUser = '1';

    await prepareNotificationPreferences();

    const params = {
      userId: loggedUser,
      uniqueKey: postsFixture[2].id,
      notificationType: NotificationType.ArticleNewComment,
    };

    await client.mutate(MUTATION, {
      variables: {
        referenceId: params.uniqueKey,
        type: params.notificationType,
      },
    });

    const preference = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(preference).toBeTruthy();

    await client.mutate(MUTATION, {
      variables: {
        referenceId: params.uniqueKey,
        type: params.notificationType,
      },
    });

    const muted = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(muted).toBeTruthy();
    expect(muted.status).toEqual(NotificationPreferenceStatus.Muted);
  });
});

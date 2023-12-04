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
  Comment,
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
  notificationPreferenceMap,
  NotificationPreferenceStatus,
  NotificationPreferenceType,
  NotificationType,
  saveNotificationPreference,
} from '../src/notifications/common';
import { postsFixture, sharedPostsFixture } from './fixture/post';
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

const prepareNotificationPreferences = async ({
  status,
}: {
  status: NotificationPreferenceStatus;
}) => {
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await saveFixtures(con, Post, sharedPostsFixture);
  await con.getRepository(NotificationPreferencePost).save([
    {
      userId: '1',
      postId: postsFixture[0].id,
      referenceId: postsFixture[0].id,
      notificationType: NotificationType.ArticleNewComment,
      status,
    },
    {
      userId: '2',
      postId: postsFixture[1].id,
      referenceId: postsFixture[1].id,
      notificationType: NotificationType.ArticleNewComment,
      status,
    },
  ]);
  await con.getRepository(NotificationPreferenceSource).save([
    {
      userId: '1',
      sourceId: sourcesFixture[0].id,
      referenceId: sourcesFixture[0].id,
      notificationType: NotificationType.SquadPostAdded,
      status,
    },
  ]);
};

describe('query notificationPreferences', () => {
  const QUERY = `
    query NotificationPreferences($data: [NotificationPreferenceInput]!) {
      notificationPreferences(data: $data) {
        referenceId
        userId
        notificationType
        status
        type
      }
    }
  `;

  it('should not authorize when not logged-in', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { data: [] } },
      'UNAUTHENTICATED',
    ));

  it('should throw an error when parameters are empty', () => {
    loggedUser = '1';

    return testQueryErrorCode(
      client,
      { query: QUERY, variables: { data: [] } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should return based on notification preferences type and reference id', async () => {
    loggedUser = '1';

    await prepareNotificationPreferences({
      status: NotificationPreferenceStatus.Muted,
    });

    const requestType = NotificationPreferenceType.Post;
    const res = await client.query(QUERY, {
      variables: {
        data: [
          {
            referenceId: postsFixture[0].id,
            notificationType: NotificationType.ArticleNewComment,
          },
        ],
      },
    });
    expect(res.data.notificationPreferences.length).toEqual(1);
    const isValid = res.data.notificationPreferences.every(
      ({ userId, type }: NotificationPreferencePost) =>
        userId === loggedUser && type === requestType,
    );
    expect(isValid).toBeTruthy();
  });

  it('should return different reference types and ids using notification preferences type and reference id', async () => {
    loggedUser = '1';

    await prepareNotificationPreferences({
      status: NotificationPreferenceStatus.Muted,
    });

    const postParam = {
      referenceId: postsFixture[0].id,
      notificationType: NotificationType.ArticleNewComment,
    };
    const sourceParam = {
      referenceId: sourcesFixture[0].id,
      notificationType: NotificationType.SquadPostAdded,
    };
    const res = await client.query(QUERY, {
      variables: { data: [postParam, sourceParam] },
    });
    expect(res.data.notificationPreferences.length).toEqual(2);

    const hasPost = res.data.notificationPreferences.some(
      ({ notificationType, referenceId }) =>
        notificationType === postParam.notificationType &&
        referenceId === postParam.referenceId,
    );
    expect(hasPost).toBeTruthy();

    const hasSource = res.data.notificationPreferences.some(
      ({ notificationType, referenceId }) =>
        notificationType === sourceParam.notificationType &&
        referenceId === sourceParam.referenceId,
    );
    expect(hasSource).toBeTruthy();

    const isLoggedUserOnly = res.data.notificationPreferences.every(
      ({ userId }) => userId === loggedUser,
    );
    expect(isLoggedUserOnly).toBeTruthy();
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
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          referenceId: postsFixture[0].id,
          type: NotificationType.ArticleNewComment,
        },
      },
      'UNAUTHENTICATED',
    ));

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

    await prepareNotificationPreferences({
      status: NotificationPreferenceStatus.Muted,
    });

    const params = {
      userId: loggedUser,
      referenceId: postsFixture[2].id,
      notificationType: NotificationType.ArticleNewComment,
    };

    const preference = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(preference).toBeFalsy();

    await client.mutate(MUTATION, {
      variables: {
        referenceId: params.referenceId,
        type: params.notificationType,
      },
    });

    const muted = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(muted).toBeTruthy();
    expect(muted.type).toEqual(
      notificationPreferenceMap[params.notificationType],
    );
  });

  it('should set notification preference to muted and fetch the reference id if it is article new comment or squad new comment', async () => {
    loggedUser = '1';

    await prepareNotificationPreferences({
      status: NotificationPreferenceStatus.Muted,
    });
    const comment = {
      id: 'c1',
      postId: postsFixture[0].id,
      content: '',
      userId: '1',
    };
    await con.getRepository(Comment).save(comment);

    const params = {
      userId: loggedUser,
      referenceId: 'c1',
      notificationType: NotificationType.ArticleNewComment,
    };

    const preference = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(preference).toBeFalsy();

    await client.mutate(MUTATION, {
      variables: {
        referenceId: params.referenceId,
        type: params.notificationType,
      },
    });

    const muted = await con.getRepository(NotificationPreference).findOneBy({
      notificationType: params.notificationType,
      referenceId: comment.postId,
    });

    expect(muted).toBeTruthy();
    expect(muted.type).toEqual(
      notificationPreferenceMap[params.notificationType],
    );
  });

  it('should ignore when preference is already muted', async () => {
    loggedUser = '1';

    await prepareNotificationPreferences({
      status: NotificationPreferenceStatus.Muted,
    });

    const params = {
      userId: loggedUser,
      referenceId: postsFixture[2].id,
      notificationType: NotificationType.ArticleNewComment,
    };

    await client.mutate(MUTATION, {
      variables: {
        referenceId: params.referenceId,
        type: params.notificationType,
      },
    });

    const preference = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(preference).toBeTruthy();

    await client.mutate(MUTATION, {
      variables: {
        referenceId: params.referenceId,
        type: params.notificationType,
      },
    });

    const muted = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(muted).toBeTruthy();
    expect(muted.status).toEqual(NotificationPreferenceStatus.Muted);
  });

  it('should update status when different preference is set', async () => {
    loggedUser = '1';

    await prepareNotificationPreferences({
      status: NotificationPreferenceStatus.Muted,
    });

    const params = {
      userId: loggedUser,
      referenceId: postsFixture[2].id,
      notificationType: NotificationType.ArticleNewComment,
    };

    const SUBSCRIBE_MUTATION = `
      mutation SubscribeNotificationPreference($referenceId: ID!, $type: String!) {
        subscribeNotificationPreference(referenceId: $referenceId, type: $type) {
          _
        }
      }
    `;

    await client.mutate(SUBSCRIBE_MUTATION, {
      variables: {
        referenceId: params.referenceId,
        type: params.notificationType,
      },
    });

    const preference = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(preference).toBeTruthy();

    await client.mutate(MUTATION, {
      variables: {
        referenceId: params.referenceId,
        type: params.notificationType,
      },
    });

    const notificationPreference = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(notificationPreference).toBeTruthy();
    expect(notificationPreference!.status).toEqual(
      NotificationPreferenceStatus.Muted,
    );
  });
});

describe('mutation clearNotificationPreference', () => {
  const MUTATION = `
    mutation ClearNotificationPreference($referenceId: ID!, $type: String!) {
      clearNotificationPreference(referenceId: $referenceId, type: $type) {
        _
      }
    }
  `;

  it('should not authorize when not logged-in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          referenceId: postsFixture[0].id,
          type: NotificationType.ArticleNewComment,
        },
      },
      'UNAUTHENTICATED',
    ));

  it('should remove preference if it exists', async () => {
    loggedUser = '1';

    await prepareNotificationPreferences({
      status: NotificationPreferenceStatus.Muted,
    });

    const params = {
      userId: loggedUser,
      referenceId: sourcesFixture[0].id,
      notificationType: NotificationType.SquadPostAdded,
    };

    const preference = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(preference).toBeTruthy();

    await client.mutate(MUTATION, {
      variables: {
        referenceId: params.referenceId,
        type: params.notificationType,
      },
    });

    const muted = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(muted).toBeFalsy();

    const other = await con
      .getRepository(NotificationPreference)
      .findOneBy({ userId: '2' });

    expect(other).toBeTruthy();
  });

  it('should clear notification preference by fetching the reference id if it is article new comment or squad new comment', async () => {
    loggedUser = '1';

    await prepareNotificationPreferences({
      status: NotificationPreferenceStatus.Muted,
    });
    const repo = con.getRepository(NotificationPreference);
    const comment = {
      id: 'c1',
      postId: postsFixture[0].id,
      content: '',
      userId: '1',
    };
    await con.getRepository(Comment).save(comment);

    const params = {
      userId: loggedUser,
      referenceId: 'c1',
      notificationType: NotificationType.ArticleNewComment,
    };

    await saveNotificationPreference(
      con,
      params.userId,
      params.referenceId,
      params.notificationType,
      NotificationPreferenceStatus.Muted,
    );
    const preference = await repo.findOneBy({
      ...params,
      referenceId: postsFixture[0].id,
    });
    expect(preference).toBeTruthy();

    await client.mutate(MUTATION, {
      variables: {
        referenceId: params.referenceId,
        type: params.notificationType,
      },
    });

    const muted = await repo.findOneBy({
      notificationType: params.notificationType,
      referenceId: postsFixture[0].id,
    });

    expect(muted).toBeFalsy();
  });
});

describe('mutation subscribeNotificationPreference', () => {
  const MUTATION = `
    mutation SubscribeNotificationPreference($referenceId: ID!, $type: String!) {
      subscribeNotificationPreference(referenceId: $referenceId, type: $type) {
        _
      }
    }
  `;

  it('should not authorize when not logged-in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          referenceId: postsFixture[0].id,
          type: NotificationType.ArticleNewComment,
        },
      },
      'UNAUTHENTICATED',
    ));

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

  it('should set notification preference to subscribed', async () => {
    loggedUser = '1';

    await prepareNotificationPreferences({
      status: NotificationPreferenceStatus.Subscribed,
    });

    const params = {
      userId: loggedUser,
      referenceId: postsFixture[2].id,
      notificationType: NotificationType.ArticleNewComment,
    };

    const preference = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(preference).toBeFalsy();

    await client.mutate(MUTATION, {
      variables: {
        referenceId: params.referenceId,
        type: params.notificationType,
      },
    });

    const notificationPreference = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(notificationPreference).not.toBeNull();
    expect(notificationPreference!.type).toEqual(
      notificationPreferenceMap[params.notificationType],
    );
    expect(notificationPreference!.status).toEqual(
      NotificationPreferenceStatus.Subscribed,
    );
  });

  it('should set notification preference to subscribed and fetch the reference id if it is article new comment or squad new comment', async () => {
    loggedUser = '1';

    await prepareNotificationPreferences({
      status: NotificationPreferenceStatus.Subscribed,
    });
    const comment = {
      id: 'c1',
      postId: postsFixture[0].id,
      content: '',
      userId: '1',
    };
    await con.getRepository(Comment).save(comment);

    const params = {
      userId: loggedUser,
      referenceId: 'c1',
      notificationType: NotificationType.ArticleNewComment,
    };

    const preference = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(preference).toBeFalsy();

    await client.mutate(MUTATION, {
      variables: {
        referenceId: params.referenceId,
        type: params.notificationType,
      },
    });

    const notificationPreference = await con
      .getRepository(NotificationPreference)
      .findOneBy({
        notificationType: params.notificationType,
        referenceId: comment.postId,
        status: NotificationPreferenceStatus.Subscribed,
      });

    expect(notificationPreference).toBeTruthy();
    expect(notificationPreference!.type).toEqual(
      notificationPreferenceMap[params.notificationType],
    );
    expect(notificationPreference!.status).toEqual(
      NotificationPreferenceStatus.Subscribed,
    );
  });

  it('should ignore when preference is already subscribed', async () => {
    loggedUser = '1';

    await prepareNotificationPreferences({
      status: NotificationPreferenceStatus.Subscribed,
    });

    const params = {
      userId: loggedUser,
      referenceId: postsFixture[2].id,
      notificationType: NotificationType.ArticleNewComment,
    };

    await client.mutate(MUTATION, {
      variables: {
        referenceId: params.referenceId,
        type: params.notificationType,
      },
    });

    const preference = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(preference).toBeTruthy();

    await client.mutate(MUTATION, {
      variables: {
        referenceId: params.referenceId,
        type: params.notificationType,
      },
    });

    const notificationPreference = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(notificationPreference).toBeTruthy();
    expect(notificationPreference!.status).toEqual(
      NotificationPreferenceStatus.Subscribed,
    );
  });

  it('should update status when different preference is set', async () => {
    loggedUser = '1';

    await prepareNotificationPreferences({
      status: NotificationPreferenceStatus.Subscribed,
    });

    const params = {
      userId: loggedUser,
      referenceId: postsFixture[2].id,
      notificationType: NotificationType.ArticleNewComment,
    };

    const MUTE_MUTATION = `
      mutation MuteNotificationPreference($referenceId: ID!, $type: String!) {
        muteNotificationPreference(referenceId: $referenceId, type: $type) {
          _
        }
      }
    `;

    await client.mutate(MUTE_MUTATION, {
      variables: {
        referenceId: params.referenceId,
        type: params.notificationType,
      },
    });

    const preference = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(preference).toBeTruthy();

    await client.mutate(MUTATION, {
      variables: {
        referenceId: params.referenceId,
        type: params.notificationType,
      },
    });

    const notificationPreference = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(notificationPreference).toBeTruthy();
    expect(notificationPreference!.status).toEqual(
      NotificationPreferenceStatus.Subscribed,
    );
  });

  it('should not update other user preferences of the same type', async () => {
    loggedUser = '1';

    await prepareNotificationPreferences({
      status: NotificationPreferenceStatus.Subscribed,
    });

    const params = {
      userId: loggedUser,
      referenceId: postsFixture[2].id,
      notificationType: NotificationType.ArticleNewComment,
    };

    const MUTE_MUTATION = `
      mutation MuteNotificationPreference($referenceId: ID!, $type: String!) {
        muteNotificationPreference(referenceId: $referenceId, type: $type) {
          _
        }
      }
    `;

    await client.mutate(MUTE_MUTATION, {
      variables: {
        referenceId: params.referenceId,
        type: params.notificationType,
      },
    });

    await client.mutate(MUTE_MUTATION, {
      variables: {
        referenceId: postsFixture[3].id,
        type: params.notificationType,
      },
    });

    const preference = await con
      .getRepository(NotificationPreference)
      .findOneBy(params);

    expect(preference).toBeTruthy();

    await client.mutate(MUTATION, {
      variables: {
        referenceId: params.referenceId,
        type: params.notificationType,
      },
    });

    const notificationPreference = await con
      .getRepository(NotificationPreference)
      .findOneBy({
        ...params,
        referenceId: postsFixture[3].id,
      });

    expect(notificationPreference).toBeTruthy();
    expect(notificationPreference!.status).toEqual(
      NotificationPreferenceStatus.Muted,
    );
  });
});

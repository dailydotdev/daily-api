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
  NotificationPreferencePost,
  Post,
  User,
  Comment,
  Source,
  NotificationPreferenceSource,
  NotificationPreference,
  NotificationAttachmentType,
  UserPersonalizedDigest,
} from '../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { usersFixture } from './fixture/user';
import { notificationV2Fixture } from './fixture/notifications';
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
import {
  NotificationV2,
  UserNotification,
  NotificationAttachmentV2,
  NotificationAvatarV2,
} from '../src/entity';
import { signJwt } from '../src/auth';
import { UnsubscribeGroup } from '../src/common';

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
    const notifs = await con.getRepository(NotificationV2).save([
      { ...notificationV2Fixture },
      {
        ...notificationV2Fixture,
        uniqueKey: '2',
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
        readAt: new Date(),
      },
    ]);

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
    const notifs = await con.getRepository(NotificationV2).save([
      { ...notificationV2Fixture },
      {
        ...notificationV2Fixture,
        uniqueKey: '2',
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
    const notifs = await con.getRepository(NotificationV2).save([
      { ...notificationV2Fixture },
      {
        ...notificationV2Fixture,
        uniqueKey: '2',
        title: 'notification #2',
      },
    ]);
    await con.getRepository(UserNotification).insert([
      {
        userId: '1',
        notificationId: notifs[0].id,
        createdAt: notificationV2Fixture.createdAt,
      },
      {
        userId: '2',
        notificationId: notifs[1].id,
      },
    ]);
    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });

  it('should return the public notifications', async () => {
    loggedUser = '1';
    const notifs = await con.getRepository(NotificationV2).save([
      { ...notificationV2Fixture },
      {
        ...notificationV2Fixture,
        uniqueKey: '2',
        public: false,
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
        public: false,
      },
    ]);
    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });

  it('should return avatars and attachments', async () => {
    loggedUser = '1';
    const attchs = await con.getRepository(NotificationAttachmentV2).save([
      {
        image: 'img#1',
        title: 'att #1',
        type: NotificationAttachmentType.Post,
        referenceId: '1',
      },
      {
        image: 'img#2',
        title: 'att #2',
        type: NotificationAttachmentType.Post,
        referenceId: '2',
      },
    ]);
    const avatars = await con.getRepository(NotificationAvatarV2).save([
      {
        image: 'img#1',
        referenceId: '1',
        type: 'user',
        targetUrl: 'user#1',
        name: 'User #1',
      },
      {
        image: 'img#2',
        referenceId: '2',
        type: 'source',
        targetUrl: 'source#1',
        name: 'Source #1',
      },
    ]);
    const notifs = await con.getRepository(NotificationV2).save([
      {
        ...notificationV2Fixture,
        attachments: [attchs[1].id, attchs[0].id],
        avatars: [avatars[1].id, avatars[0].id],
      },
    ]);
    await con.getRepository(UserNotification).insert([
      {
        userId: '1',
        notificationId: notifs[0].id,
        createdAt: notificationV2Fixture.createdAt,
      },
    ]);
    const res = await client.query(QUERY);
    expect(res.data.notifications.edges[0].node.attachments).toEqual([
      {
        image: 'img#2',
        title: 'att #2',
        type: 'post',
      },
      {
        image: 'img#1',
        title: 'att #1',
        type: 'post',
      },
    ]);
    expect(res.data.notifications.edges[0].node.avatars).toEqual([
      {
        image: 'img#2',
        name: 'Source #1',
        targetUrl: 'source#1',
        type: 'source',
      },
      {
        image: 'img#1',
        name: 'User #1',
        targetUrl: 'user#1',
        type: 'user',
      },
    ]);
  });

  it('should return pagination response', async () => {
    loggedUser = '1';
    const notifs = await con.getRepository(NotificationV2).save(
      Array.from(Array(5)).map((_, i) => ({
        ...notificationV2Fixture,
        title: `notification #${i + 1}`,
        createdAt: subDays(notificationV2Fixture.createdAt as Date, i),
        uniqueKey: i.toString(),
      })),
    );
    await con.getRepository(UserNotification).insert(
      notifs.map((n) => ({
        notificationId: n.id,
        userId: '1',
        public: true,
        createdAt: n.createdAt,
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

  it('should populate the readAt field', async () => {
    loggedUser = '1';
    const notifs = await con
      .getRepository(NotificationV2)
      .save([{ ...notificationV2Fixture }]);
    const date = new Date();
    await con.getRepository(UserNotification).insert([
      {
        userId: '1',
        notificationId: notifs[0].id,
        createdAt: notificationV2Fixture.createdAt,
        readAt: date,
      },
    ]);
    const res = await client.query(QUERY);
    expect(res.data.notifications.edges[0].node.readAt).toEqual(
      date.toISOString(),
    );
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

  it('should set unread notifications as read v2', async () => {
    loggedUser = '1';
    const notifs = await con.getRepository(NotificationV2).save([
      { ...notificationV2Fixture },
      {
        ...notificationV2Fixture,
        uniqueKey: '2',
      },
      {
        ...notificationV2Fixture,
        uniqueKey: '3',
      },
      {
        ...notificationV2Fixture,
        uniqueKey: '4',
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
        createdAt: subDays(notificationV2Fixture.createdAt as Date, 1),
        readAt: new Date(),
      },
      {
        userId: '1',
        notificationId: notifs[2].id,
        createdAt: subDays(notificationV2Fixture.createdAt as Date, 2),
      },
      {
        userId: '1',
        notificationId: notifs[3].id,
        createdAt: subDays(notificationV2Fixture.createdAt as Date, 3),
        readAt: new Date(),
      },
      { userId: '2', notificationId: notifs[0].id },
    ]);
    await client.mutate(QUERY);
    const res1 = await con
      .getRepository(UserNotification)
      .find({ where: { userId: '1' }, order: { createdAt: 'desc' } });
    res1.map((notification) => expect(notification.readAt).toBeTruthy());
    const res2 = await con
      .getRepository(UserNotification)
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

describe('POST /notifications/unsubscribe', () => {
  it('should unsubscribe from notifications', async () => {
    await con
      .getRepository(User)
      .update({ id: '1' }, { notificationEmail: true });
    const token = await signJwt({
      userId: '1',
      group: UnsubscribeGroup.Notifications,
    });
    await request(app.server)
      .post('/notifications/unsubscribe')
      .query({ token: token.token })
      .expect(204);
    const user = await con.getRepository(User).findOneBy({ id: '1' });
    expect(user.notificationEmail).toBe(false);
  });

  it('should unsubscribe from digest', async () => {
    const upd1 = await con
      .getRepository(UserPersonalizedDigest)
      .findBy({ userId: '1' });
    expect(upd1.length).toBe(1);
    const token = await signJwt({
      userId: '1',
      group: UnsubscribeGroup.Digest,
    });
    await request(app.server)
      .post('/notifications/unsubscribe')
      .query({ token: token.token })
      .expect(204);
    const upd2 = await con
      .getRepository(UserPersonalizedDigest)
      .findBy({ userId: '1' });
    expect(upd2.length).toBe(0);
  });
});

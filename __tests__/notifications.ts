import {
  authorizeRequest,
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  invokeTypedNotificationWorker,
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
  PostType,
  UserPost,
} from '../src/entity';
import type { UserNotificationFlags } from '../src/entity/user/User';
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
  streamNotificationUsers,
  NotificationChannel,
} from '../src/notifications/common';
import { postsFixture, sharedPostsFixture } from './fixture/post';
import { sourcesFixture } from './fixture/source';
import {
  NotificationV2,
  UserNotification,
  NotificationAttachmentV2,
  NotificationAvatarV2,
} from '../src/entity';
import { getTableName } from '../src/workers/cdc/common';
import { PollPost } from '../src/entity/posts/PollPost';
import { pollResultNotification } from '../src/workers/notifications/pollResultNotification';
import { pollResultAuthorNotification } from '../src/workers/notifications/pollResultAuthorNotification';
import { PollOption } from '../src/entity/polls/PollOption';

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

describe('streamNotificationUsers', () => {
  const setupNotificationAndUsers = async (
    users: {
      id: string;
      name: string;
      email: string;
      notificationFlags?: UserNotificationFlags;
    }[],
  ) => {
    await con.getRepository(User).save(users);

    const notif = await con.getRepository(NotificationV2).save({
      ...notificationV2Fixture,
      type: NotificationType.ArticleNewComment,
    });

    const userNotifications = users.map((user) => ({
      userId: user.id,
      notificationId: notif.id,
      public: true,
      createdAt: notificationV2Fixture.createdAt,
    }));

    await con.getRepository(UserNotification).insert(userNotifications);

    return notif.id;
  };

  const streamToArray = async (
    stream: NodeJS.ReadableStream,
  ): Promise<{ userId: string }[]> => {
    const results: { userId: string }[] = [];
    return new Promise((res) => {
      stream.on('data', (data: { userId: string }) => {
        results.push({ userId: data.userId });
      });
      stream.on('end', () => res(results));
    });
  };

  it('should return users for inApp channel when no preferences set', async () => {
    const users = [
      { id: 'user1', name: 'User 1', email: 'user1@test.com' },
      { id: 'user2', name: 'User 2', email: 'user2@test.com' },
    ];

    const notifId = await setupNotificationAndUsers(users);
    const stream = await streamNotificationUsers(
      con,
      notifId,
      NotificationChannel.InApp,
    );
    const results = await streamToArray(stream);

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.userId).sort()).toEqual(['user1', 'user2']);
  });

  it('should return users for email channel when no preferences set', async () => {
    const users = [
      { id: 'user3', name: 'User 3', email: 'user3@test.com' },
      { id: 'user4', name: 'User 4', email: 'user4@test.com' },
    ];

    const notifId = await setupNotificationAndUsers(users);
    const stream = await streamNotificationUsers(
      con,
      notifId,
      NotificationChannel.Email,
    );
    const results = await streamToArray(stream);

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.userId).sort()).toEqual(['user3', 'user4']);
  });

  it('should exclude users with global inApp mute preference', async () => {
    const users = [
      {
        id: 'user5',
        name: 'User 5',
        email: 'user5@test.com',
        notificationFlags: {
          [NotificationType.ArticleNewComment]: {
            inApp: NotificationPreferenceStatus.Muted,
          },
        },
      },
      {
        id: 'user6',
        name: 'User 6',
        email: 'user6@test.com',
        notificationFlags: {
          [NotificationType.ArticleNewComment]: {
            inApp: NotificationPreferenceStatus.Subscribed,
          },
        },
      },
    ];

    const notifId = await setupNotificationAndUsers(users);
    const stream = await streamNotificationUsers(
      con,
      notifId,
      NotificationChannel.InApp,
    );
    const results = await streamToArray(stream);

    expect(results).toHaveLength(1);
    expect(results[0].userId).toBe('user6');
  });

  it('should exclude users with global email mute preference', async () => {
    const users = [
      {
        id: 'user7',
        name: 'User 7',
        email: 'user7@test.com',
        notificationFlags: {
          [NotificationType.ArticleNewComment]: {
            email: NotificationPreferenceStatus.Muted,
          },
        },
      },
      {
        id: 'user8',
        name: 'User 8',
        email: 'user8@test.com',
        notificationFlags: {
          [NotificationType.ArticleNewComment]: {
            email: NotificationPreferenceStatus.Subscribed,
          },
        },
      },
    ];

    const notifId = await setupNotificationAndUsers(users);
    const stream = await streamNotificationUsers(
      con,
      notifId,
      NotificationChannel.Email,
    );
    const results = await streamToArray(stream);

    expect(results).toHaveLength(1);
    expect(results[0].userId).toBe('user8');
  });

  it('should not send notification to user with global inApp mute preference and email subscribed', async () => {
    const users = [
      {
        id: 'user9',
        name: 'User 9',
        email: 'user9@test.com',
        notificationFlags: {
          [NotificationType.ArticleNewComment]: {
            inApp: NotificationPreferenceStatus.Muted,
            email: NotificationPreferenceStatus.Subscribed,
          },
        },
      },
    ];

    const notifId = await setupNotificationAndUsers(users);

    const inAppStream = await streamNotificationUsers(
      con,
      notifId,
      NotificationChannel.InApp,
    );
    const inAppResults = await streamToArray(inAppStream);
    expect(inAppResults).toHaveLength(0);

    const emailStream = await streamNotificationUsers(
      con,
      notifId,
      NotificationChannel.Email,
    );
    const emailResults = await streamToArray(emailStream);
    expect(emailResults).toHaveLength(1);
    expect(emailResults[0].userId).toBe('user9');
  });

  it('should exclude globally muted users even if they have entity-level subscriptions', async () => {
    const users = [
      {
        id: 'user14',
        name: 'User 14',
        email: 'user14@test.com',
        notificationFlags: {
          [NotificationType.ArticleNewComment]: {
            inApp: NotificationPreferenceStatus.Muted,
          },
        },
      },
    ];

    await con.getRepository(User).save(users);
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, Post, postsFixture);

    await con.getRepository(NotificationPreferencePost).save({
      userId: 'user14',
      postId: postsFixture[0].id,
      referenceId: postsFixture[0].id,
      notificationType: NotificationType.ArticleNewComment,
      status: NotificationPreferenceStatus.Subscribed,
      type: NotificationPreferenceType.Post,
    });

    const notif = await con.getRepository(NotificationV2).save({
      ...notificationV2Fixture,
      type: NotificationType.ArticleNewComment,
    });

    await con.getRepository(UserNotification).insert([
      {
        userId: 'user14',
        notificationId: notif.id,
        public: true,
        createdAt: notificationV2Fixture.createdAt,
      },
    ]);

    const stream = await streamNotificationUsers(
      con,
      notif.id,
      NotificationChannel.InApp,
    );
    const results = await streamToArray(stream);

    expect(results).toHaveLength(0);
  });
});

describe('poll result notifications', () => {
  beforeEach(async () => {
    await con.getRepository(User).save(usersFixture);
    await saveFixtures(con, Source, sourcesFixture);
  });

  const createPollPost = async (authorId: string, endsAt?: Date) => {
    return con.getRepository(Post).save({
      id: 'poll-1',
      shortId: 'poll-short',
      authorId,
      sourceId: 'a',
      title: 'What is your favorite framework?',
      type: PostType.Poll,
      createdAt: new Date('2021-09-22T07:15:51.247Z'),
      endsAt,
    });
  };

  const createPollOptions = async (pollId: string) => {
    return con.getRepository(PollOption).save([
      {
        id: '01234567-0123-0123-0123-0123456789ab',
        postId: pollId,
        text: 'React',
        order: 1,
        numVotes: 0,
      },
      {
        id: '01234567-0123-0123-0123-0123456789ac',
        postId: pollId,
        text: 'Vue',
        order: 2,
        numVotes: 0,
      },
    ]);
  };

  const createPollVotes = async (
    pollId: string,
    voterIds: string[],
    optionId = '01234567-0123-0123-0123-0123456789ab',
  ) => {
    return con.getRepository(UserPost).save(
      voterIds.map((userId) => ({
        userId,
        postId: pollId,
        pollVoteOptionId: optionId,
      })),
    );
  };

  it('should send notification to poll author when poll expires', async () => {
    const poll = await createPollPost('1'); // user '1' is the author

    const result =
      await invokeTypedNotificationWorker<'api.v1.delayed-notification-reminder'>(
        pollResultAuthorNotification,
        {
          entityId: poll.id,
          entityTableName: getTableName(con, PollPost),
          scheduledAtMs: Date.now(),
          delayMs: 1000,
        },
      );

    expect(result).toHaveLength(1);
    expect(result![0].type).toBe(NotificationType.PollResult);
    expect(result![0].ctx.userIds).toEqual(['1']);
  });

  it('should send notifications to poll voters when poll expires', async () => {
    const poll = await createPollPost('1'); // user '1' is the author
    await createPollOptions(poll.id);
    await createPollVotes(poll.id, ['2', '3', '4']); // users 2, 3, 4 voted

    const result =
      await invokeTypedNotificationWorker<'api.v1.delayed-notification-reminder'>(
        pollResultNotification,
        {
          entityId: poll.id,
          entityTableName: getTableName(con, PollPost),
          scheduledAtMs: Date.now(),
          delayMs: 1000,
        },
      );

    expect(result).toHaveLength(1);
    expect(result![0].type).toBe(NotificationType.PollResult);
    expect(result![0].ctx.userIds).toEqual(['2', '3', '4']);
  });

  it('should exclude poll author from voter notifications', async () => {
    const poll = await createPollPost('1'); // user '1' is the author
    await createPollOptions(poll.id);
    await createPollVotes(poll.id, ['1', '2', '3']); // author also voted

    const result =
      await invokeTypedNotificationWorker<'api.v1.delayed-notification-reminder'>(
        pollResultNotification,
        {
          entityId: poll.id,
          entityTableName: getTableName(con, PollPost),
          scheduledAtMs: Date.now(),
          delayMs: 1000,
        },
      );

    expect(result).toHaveLength(1);
    expect(result![0].type).toBe(NotificationType.PollResult);
    expect(result![0].ctx.userIds).toEqual(['2', '3']); // author excluded
  });

  it('should return nothing if no voters exist', async () => {
    const poll = await createPollPost('1');
    // No votes created

    const result =
      await invokeTypedNotificationWorker<'api.v1.delayed-notification-reminder'>(
        pollResultNotification,
        {
          entityId: poll.id,
          entityTableName: getTableName(con, PollPost),
          scheduledAtMs: Date.now(),
          delayMs: 1000,
        },
      );

    expect(result).toBeUndefined();
  });

  it('should return nothing if poll does not exist', async () => {
    const result =
      await invokeTypedNotificationWorker<'api.v1.delayed-notification-reminder'>(
        pollResultNotification,
        {
          entityId: 'non-existent-poll',
          entityTableName: getTableName(con, PollPost),
          scheduledAtMs: Date.now(),
          delayMs: 1000,
        },
      );

    expect(result).toBeUndefined();
  });
});

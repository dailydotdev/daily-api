import { DataSource, In } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import {
  ArticlePost,
  NotificationAttachmentType,
  NotificationAttachmentV2,
  NotificationAvatarV2,
  NotificationV2,
  Source,
  User,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { usersFixture } from '../fixture/user';
import { notificationWorkerToWorker } from '../../src/workers/notifications';
import { buildPostContext } from '../../src/workers/notifications/utils';
import { NotificationType } from '../../src/notifications/common';
import { UserNotification } from '../../src/entity/notifications/UserNotification';
import { notificationV2Fixture } from '../fixture/notifications';
import { Message, TypedNotificationWorker } from '../../src/workers/worker';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, User, usersFixture);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baseWorker: TypedNotificationWorker<any> = {
  subscription: 'sub',
  handler: async (message, con) => {
    const postCtx = await buildPostContext(con, 'p1');
    const users = await con
      .getRepository(User)
      .find({ where: { id: In(['1', '2']) } });
    return [
      {
        type: NotificationType.ArticleUpvoteMilestone,
        ctx: {
          ...postCtx,
          upvoters: users,
          upvotes: 2,
          userIds: ['3', '4'],
        },
      },
    ];
  },
};

const message = (data) => {
  const messageData = Buffer.from(JSON.stringify(data), 'utf-8');

  const message: Message = {
    data: messageData,
    messageId: '1',
  };
  return message;
};

describe('notificationWorkerToWorker', () => {
  it('should create notifications v2', async () => {
    const worker = notificationWorkerToWorker(baseWorker);
    await worker.handler(message({}), con, null, null);
    const avatars = await con
      .getRepository(NotificationAvatarV2)
      .find({ order: { referenceId: 'ASC' } });
    expect(avatars).toEqual([
      {
        id: expect.any(String),
        image: 'https://daily.dev/ido.jpg',
        name: 'Ido',
        referenceId: '1',
        targetUrl: 'http://localhost:5002/idoshamun',
        type: 'user',
      },
      {
        id: expect.any(String),
        image: 'https://daily.dev/tsahi.jpg',
        name: 'Tsahi',
        referenceId: '2',
        targetUrl: 'http://localhost:5002/tsahidaily',
        type: 'user',
      },
    ]);
    const attachments = await con
      .getRepository(NotificationAttachmentV2)
      .find({ order: { referenceId: 'ASC' } });
    expect(attachments).toEqual([
      {
        id: expect.any(String),
        image: 'https://daily.dev/image.jpg',
        referenceId: 'p1',
        title: 'P1',
        type: 'post',
      },
    ]);
    const notifications = await con.getRepository(NotificationV2).find();
    expect(notifications).toEqual([
      {
        attachments: attachments.map(({ id }) => id),
        avatars: avatars.map(({ id }) => id),
        createdAt: expect.any(Date),
        description: null,
        icon: 'Upvote',
        id: expect.any(String),
        numTotalAvatars: null,
        public: true,
        referenceId: 'p1',
        referenceType: 'post',
        targetUrl: 'http://localhost:5002/posts/p1',
        title: expect.any(String),
        type: 'article_upvote_milestone',
        uniqueKey: '2',
      },
    ]);
    const userNotifications = await con
      .getRepository(UserNotification)
      .find({ order: { userId: 'ASC' } });
    expect(userNotifications).toEqual([
      {
        createdAt: notifications[0].createdAt,
        notificationId: notifications[0].id,
        public: true,
        readAt: null,
        userId: '3',
        uniqueKey: null,
      },
      {
        createdAt: notifications[0].createdAt,
        notificationId: notifications[0].id,
        public: true,
        readAt: null,
        userId: '4',
        uniqueKey: null,
      },
    ]);
  });

  it('should reuse attachments and avatars', async () => {
    const worker = notificationWorkerToWorker(baseWorker);
    await con.getRepository(NotificationAvatarV2).save({
      image: 'https://daily.dev/ido.jpg',
      name: 'Ido',
      referenceId: '1',
      targetUrl: 'http://localhost:5002/idoshamun',
      type: 'user',
    });
    await con.getRepository(NotificationAttachmentV2).save({
      image: 'https://daily.dev/image.jpg',
      referenceId: 'p1',
      title: 'P1',
      type: NotificationAttachmentType.Post,
    });
    await worker.handler(message({}), con, null, null);
    const avatars = await con
      .getRepository(NotificationAvatarV2)
      .find({ order: { referenceId: 'ASC' } });
    expect(avatars.length).toEqual(2);
    const attachments = await con
      .getRepository(NotificationAttachmentV2)
      .find({ order: { referenceId: 'ASC' } });
    expect(attachments.length).toEqual(1);
    const notifications = await con.getRepository(NotificationV2).find();
    expect(notifications[0].attachments).toEqual(
      expect.arrayContaining(attachments.map(({ id }) => id)),
    );

    avatars
      .map(({ id }) => id)
      .forEach((id) => {
        expect(notifications[0].avatars).toContain(id);
      });
  });

  it('should denormalize public properly', async () => {
    const worker = notificationWorkerToWorker({
      subscription: 'sub',
      handler: async (message, con) => {
        const postCtx = await buildPostContext(con, 'p1');
        return [
          {
            type: NotificationType.ArticleReportApproved,
            ctx: {
              ...postCtx,
              userIds: ['3', '4'],
            },
          },
        ];
      },
    });
    await worker.handler(message({}), con, null, null);
    const notifications = await con.getRepository(NotificationV2).find();
    expect(notifications.length).toEqual(1);
    expect(notifications[0].public).toEqual(false);
    const userNotifications = await con
      .getRepository(UserNotification)
      .find({ where: { public: false } });
    expect(userNotifications.length).toEqual(2);
  });

  it('should handle duplicate notification', async () => {
    await con.getRepository(NotificationV2).save({
      ...notificationV2Fixture,
      type: NotificationType.ArticleUpvoteMilestone,
      referenceId: 'p1',
      referenceType: 'post',
      uniqueKey: '2',
    });
    const worker = notificationWorkerToWorker(baseWorker);
    await worker.handler(message({}), con, null, null);
    const notifications = await con.getRepository(NotificationV2).find();
    expect(notifications.length).toEqual(1);
    const userNotifications = await con.getRepository(UserNotification).find();
    expect(userNotifications.length).toEqual(0);
  });
});

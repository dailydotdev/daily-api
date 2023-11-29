import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/newNotificationRealTime';
import {
  Notification,
  NotificationAttachment,
  NotificationAvatar,
  User,
} from '../../src/entity';
import { redisPubSub } from '../../src/redis';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { usersFixture } from '../fixture/user';
import { notificationFixture } from '../fixture/notifications';
import { NotificationType } from '../../src/notifications/common';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, [usersFixture[0]]);
});

it('should publish an event to redis', async () => {
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
  return new Promise<void>(async (resolve) => {
    const subId = await redisPubSub.subscribe(
      'events.notifications.1.new',
      (value) => {
        expect(value).toEqual({
          attachments: [
            {
              image: 'img#2',
              notificationId: expect.any(String),
              order: 1,
              referenceId: '2',
              title: 'att #2',
              type: 'post',
            },
            {
              image: 'img#1',
              notificationId: expect.any(String),
              order: 2,
              referenceId: '1',
              title: 'att #1',
              type: 'post',
            },
          ],
          avatars: [
            {
              image: 'img#2',
              name: 'Source #1',
              notificationId: expect.any(String),
              order: 1,
              referenceId: '2',
              targetUrl: 'source#1',
              type: 'source',
            },
            {
              image: 'img#1',
              name: 'User #1',
              notificationId: expect.any(String),
              order: 2,
              referenceId: '1',
              targetUrl: 'user#1',
              type: 'user',
            },
          ],
          createdAt: '2021-05-02T00:00:00.000Z',
          description: 'description',
          icon: 'icon',
          id: expect.any(String),
          numTotalAvatars: null,
          public: true,
          readAt: null,
          referenceId: null,
          referenceType: null,
          targetUrl: 'https://daily.dev',
          title: 'notification #1',
          type: NotificationType.CommentMention,
          uniqueKey: '0',
          userId: '1',
        });
        redisPubSub.unsubscribe(subId);
        resolve();
      },
    );
    await expectSuccessfulBackground(worker, {
      notification: {
        id,
        public: true,
      },
    });
  });
});

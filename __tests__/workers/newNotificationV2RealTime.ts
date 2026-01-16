import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/newNotificationV2RealTime';
import {
  NotificationAttachmentType,
  NotificationAttachmentV2,
  NotificationAvatarV2,
  NotificationV2,
  UserNotification,
  User,
} from '../../src/entity';
import { redisPubSub } from '../../src/redis';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { usersFixture } from '../fixture/user';
import { notificationV2Fixture } from '../fixture/notifications';
import { NotificationType } from '../../src/notifications/common';
import { Readable } from 'stream';

let con: DataSource;

// Skip this test in parallel mode because Redis pub/sub channels are shared across workers
// and events can be consumed by the wrong subscriber
const isParallelMode =
  process.env.ENABLE_SCHEMA_ISOLATION === 'true' &&
  process.env.JEST_WORKER_ID !== undefined;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
});

(isParallelMode ? it.skip : it)(
  'should publish an event to redis',
  async () => {
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
    const avtars = await con.getRepository(NotificationAvatarV2).save([
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
    const { id } = await con.getRepository(NotificationV2).save({
      ...notificationV2Fixture,
      attachments: [attchs[1].id, attchs[0].id],
      avatars: [avtars[1].id, avtars[0].id],
    });
    await con.getRepository(UserNotification).insert([
      { userId: '1', notificationId: id },
      { userId: '2', notificationId: id },
    ]);
    const expected = {
      attachments: [
        {
          id: expect.any(String),
          image: 'img#2',
          referenceId: '2',
          title: 'att #2',
          type: 'post',
        },
        {
          id: expect.any(String),
          image: 'img#1',
          referenceId: '1',
          title: 'att #1',
          type: 'post',
        },
      ],
      avatars: [
        {
          id: expect.any(String),
          image: 'img#2',
          name: 'Source #1',
          referenceId: '2',
          targetUrl: 'source#1',
          type: 'source',
        },
        {
          id: expect.any(String),
          image: 'img#1',
          name: 'User #1',
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
      referenceId: null,
      referenceType: null,
      targetUrl: 'https://daily.dev',
      title: 'notification #1',
      type: NotificationType.CommentMention,
      uniqueKey: '0',
    };

    const stream = new Readable();
    let processed = 0;
    const subscribe = async (userId: string) => {
      const subId = await redisPubSub.subscribe(
        `events.notifications.${userId}.new`,
        (value) => {
          processed += 1;
          expect(value).toEqual(expected);
          redisPubSub.unsubscribe(subId);
          stream.push(userId);
          if (processed >= 2) {
            stream.destroy();
          }
        },
      );
    };
    await subscribe('1');
    await subscribe('2');
    await expectSuccessfulBackground(worker, {
      notification: {
        id,
        public: true,
      },
    });
    return new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('close', resolve);
    });
  },
  15000,
);

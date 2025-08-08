import {
  expectSuccessfulBackground,
  saveFixtures,
  saveNotificationV2Fixture,
} from '../helpers';
import worker from '../../src/workers/newNotificationV2Push';
import {
  ArticlePost,
  NotificationAttachmentType,
  NotificationAttachmentV2,
  NotificationAvatarV2,
  NotificationV2,
  Source,
  User,
} from '../../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { usersFixture } from '../fixture/user';
import { notificationV2Fixture } from '../fixture/notifications';
import { UserNotification } from '../../src/entity/notifications/UserNotification';
import { sendPushNotification } from '../../src/onesignal';
import { cacheConnectedUser } from '../../src/subscription';
import { deleteKeysByPattern } from '../../src/redis';
import {
  NotificationPostContext,
  NotificationUserContext,
  Reference,
  type NotificationAwardContext,
} from '../../src/notifications/types';
import { postsFixture } from '../fixture/post';
import { NotificationType } from '../../src/notifications/common';
import { sourcesFixture } from '../fixture';
import { Product, ProductType } from '../../src/entity/Product';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../../src/entity/user/UserTransaction';
import { env } from 'node:process';

jest.mock('../../src/onesignal', () => ({
  ...(jest.requireActual('../../src/onesignal') as Record<string, unknown>),
  sendPushNotification: jest.fn(),
}));

let con: DataSource;
let notif: NotificationV2;
let avatars: NotificationAvatarV2[];

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await deleteKeysByPattern('connected:*');
  await saveFixtures(con, User, usersFixture);
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
  avatars = await con.getRepository(NotificationAvatarV2).save([
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
  notif = await con.getRepository(NotificationV2).save({
    ...notificationV2Fixture,
    attachments: [attchs[1].id, attchs[0].id],
    avatars: [avatars[1].id, avatars[0].id],
  });
  const { id } = notif;
  await con.getRepository(UserNotification).insert([
    { userId: '1', notificationId: id },
    { userId: '2', notificationId: id },
  ]);
});

it('should send push notifications to all users', async () => {
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notif.id,
      public: true,
    },
  });
  expect(sendPushNotification).toHaveBeenCalledWith(
    ['1', '2'],
    notif,
    avatars[1],
  );
});

it('should send push notifications to disconnected users only', async () => {
  await cacheConnectedUser('1');
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notif.id,
      public: true,
    },
  });
  expect(sendPushNotification).toHaveBeenCalledWith(['2'], notif, avatars[1]);
});

it('should not send follow push notification if the user prefers not to receive them', async () => {
  const userId = '1';
  const repo = con.getRepository(User);
  const user = await repo.findOneBy({ id: userId });
  await repo.save({ ...user, followNotifications: false });
  await saveFixtures(con, Source, sourcesFixture);
  const post = await con.getRepository(ArticlePost).save(postsFixture[0]);
  const source = await con.getRepository(Source).findOneBy({
    id: post.sourceId,
  });
  const ctx: NotificationUserContext & NotificationPostContext = {
    userIds: ['1'],
    user: user as Reference<User>,
    post,
    source: source as Reference<Source>,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.UserPostAdded,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId,
      public: true,
    },
  });
  expect(sendPushNotification).toHaveBeenCalledTimes(0);
});

it('should not send award push notification if the user prefers not to receive them', async () => {
  const userId = '1';
  const repo = con.getRepository(User);
  const receiver = await repo.findOneBy({ id: userId });
  const sender = await repo.findOneBy({ id: '2' });
  await repo.save({ ...receiver, awardNotifications: false });

  await saveFixtures(con, Product, [
    {
      id: '9104b834-6fac-4276-a168-0be1294ab371',
      name: 'Test Award',
      image: 'https://daily.dev/award.jpg',
      type: ProductType.Award,
      value: 100,
    },
  ]);

  const transaction = await con.getRepository(UserTransaction).save({
    processor: UserTransactionProcessor.Njord,
    receiverId: '1',
    senderId: '2',
    value: 100,
    valueIncFees: 100,
    fee: 0,
    request: {},
    flags: {},
    productId: '9104b834-6fac-4276-a168-0be1294ab371',
    status: UserTransactionStatus.Success,
  });
  const ctx: NotificationAwardContext = {
    userIds: ['1'],
    transaction,
    receiver: receiver as Reference<User>,
    sender: sender as Reference<User>,
    targetUrl: `${env.COMMENTS_PREFIX}/idoshamun`,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.UserReceivedAward,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId,
      public: true,
    },
  });
  expect(sendPushNotification).toHaveBeenCalledTimes(0);
});

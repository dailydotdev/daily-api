import { expectSuccessfulBackground, saveFixtures } from '../../helpers';
import worker from '../../../src/workers/notifications/postDeleted';
import {
  ArticlePost,
  Notification,
  NotificationAttachment,
  NotificationAvatar,
  Post,
  PostOrigin,
  PostType,
  SharePost,
  Source,
  User,
} from '../../../src/entity';
import { sourcesFixture } from '../../fixture/source';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { usersFixture } from '../../fixture/user';
import { NotificationType } from '../../../src/notifications/common';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const createSharedPost = async (id = 'sp1') => {
  const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
  await con.getRepository(SharePost).save({
    ...post,
    id,
    shortId: `short-${id}`,
    sharedPostId: 'p1',
    type: PostType.Share,
    visible: false,
  });
};

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, [
    {
      id: 'p1',
      shortId: 'p1',
      url: 'http://p1.com',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'a',
      visible: true,
      createdAt: new Date('01-05-2020 12:00:00'),
      origin: PostOrigin.Squad,
      title: 'testing',
    },
  ]);
  await createSharedPost();
  await con.getRepository(Notification).save({
    id: '60e66c38-84a3-46cc-a97e-23080a31d410',
    userId: '1',
    type: NotificationType.SquadPostAdded,
    title: 'title',
    referenceId: 'sp1',
    referenceType: 'post',
    icon: 'bell',
    targetUrl: 'http://target.com',
  });
  await con.getRepository(NotificationAttachment).save({
    notificationId: '60e66c38-84a3-46cc-a97e-23080a31d410',
    order: 0,
    type: 'post',
    image: 'http://image.com',
    title: 'title',
    referenceId: 'referenceId',
  });
  await con.getRepository(NotificationAvatar).save({
    notificationId: '60e66c38-84a3-46cc-a97e-23080a31d410',
    order: 0,
    type: 'source',
    image: 'http://image.com',
    targetUrl: 'http://target.com',
    name: 'test',
    referenceId: 'referenceId',
  });
});

it('should not delete notification objects if post not found', async () => {
  await expectSuccessfulBackground(worker, {
    post: {
      id: 'sp2',
    },
  });

  const notifications = await con.getRepository(Notification).find();
  expect(notifications.length).toEqual(1);
  const attachments = await con.getRepository(NotificationAttachment).find();
  expect(attachments.length).toEqual(1);
  const avatars = await con.getRepository(NotificationAvatar).find();
  expect(avatars.length).toEqual(1);
});
it('should delete all notification objects related to a deleted post', async () => {
  await expectSuccessfulBackground(worker, {
    post: {
      id: 'sp1',
    },
  });

  const notifications = await con.getRepository(Notification).find();
  expect(notifications.length).toEqual(0);
  const attachments = await con.getRepository(NotificationAttachment).find();
  expect(attachments.length).toEqual(0);
  const avatars = await con.getRepository(NotificationAvatar).find();
  expect(avatars.length).toEqual(0);
});

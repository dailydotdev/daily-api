import {
  expectSuccessfulBackground,
  saveFixtures,
  saveNotificationFixture,
} from '../helpers';
import worker from '../../src/workers/usernameChangedUpdateNotifications';
import {
  Comment,
  NotificationAvatar,
  Post,
  Source,
  User,
} from '../../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { usersFixture } from '../fixture/user';
import { NotificationCommenterContext } from '../../src/notifications';
import { postsFixture } from '../fixture/post';
import { sourcesFixture } from '../fixture/source';
import { NotificationType } from '../../src/notifications/common';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
});

it('should update targetUrl of user avatars', async () => {
  const post = await con.getRepository(Post).save(postsFixture[0]);
  const source = await con.getRepository(Source).findOneBy({ id: 'a' });
  const comment1 = await con.getRepository(Comment).save({
    id: 'c1',
    postId: 'p1',
    userId: '2',
    content: 'parent comment',
  });
  const commenter1 = await con.getRepository(User).findOneBy({ id: '2' });
  const ctx1: NotificationCommenterContext = {
    userIds: ['1'],
    post,
    source,
    comment: comment1,
    commenter: commenter1,
  };
  await saveNotificationFixture(con, NotificationType.CommentMention, ctx1);
  const comment2 = await con.getRepository(Comment).save({
    id: 'c2',
    postId: 'p1',
    userId: '3',
    content: 'parent comment',
  });
  const commenter2 = await con.getRepository(User).findOneBy({ id: '3' });
  const ctx2: NotificationCommenterContext = {
    userIds: ['1'],
    post,
    source,
    comment: comment2,
    commenter: commenter2,
  };
  await saveNotificationFixture(con, NotificationType.CommentMention, ctx2);
  await con.getRepository(User).update({ id: '2' }, { username: 'test' });
  await expectSuccessfulBackground(worker, { userId: '2' });
  const avatars = await con
    .getRepository(NotificationAvatar)
    .find({ order: { referenceId: 'asc' } });
  expect(avatars.map((a) => a.targetUrl)).toEqual([
    'http://localhost:5002/test',
    'http://localhost:5002/nimroddaily',
  ]);
});

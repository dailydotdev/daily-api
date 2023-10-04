import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postDeletedCommentsCleanup';
import notificationWorker from '../../src/workers/notifications/commentDeleted';
import {
  ArticlePost,
  Comment,
  CommentMention,
  CommentUpvote,
  Notification,
  NotificationAttachment,
  NotificationAvatar,
  Post,
  PostOrigin,
  PostType,
  SharePost,
  Source,
  User,
} from '../../src/entity';
import { CommentReport } from '../../src/entity/CommentReport';
import { sourcesFixture } from '../fixture/source';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { usersFixture } from '../fixture/user';
import { NotificationType } from '../../src/notifications/common';

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
  await con.getRepository(Comment).save({
    id: 'c1',
    postId: 'p1',
    userId: '1',
    content: 'test',
    contentHtml: '<p>test</t>',
  });
  await con.getRepository(CommentUpvote).save({
    commentId: 'c1',
    userId: '1',
  });
  await con.getRepository(CommentMention).save({
    commentId: 'c1',
    commentByUserId: '1',
    mentionedUserId: '2',
  });

  await con.getRepository(Comment).save({
    id: 'c2',
    postId: 'sp1',
    userId: '1',
    content: 'test',
    contentHtml: '<p>test</t>',
  });
  await con.getRepository(CommentReport).save({
    commentId: 'c2',
    userId: '3',
    reason: 'HATEFUL',
  });

  await con.getRepository(Comment).save({
    id: 'c3',
    postId: 'sp1',
    userId: '1',
    content: 'test',
    contentHtml: '<p>test</t>',
  });
  await con.getRepository(CommentUpvote).save({
    commentId: 'c3',
    userId: '1',
  });
  await con.getRepository(CommentMention).save({
    commentId: 'c3',
    commentByUserId: '1',
    mentionedUserId: '2',
  });
  await con.getRepository(Notification).save({
    id: '60e66c38-84a3-46cc-a97e-23080a31d410',
    userId: '1',
    type: NotificationType.SquadNewComment,
    title: 'title',
    referenceId: 'c3',
    referenceType: 'comment',
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

it('should not delete comments if post not found', async () => {
  await expectSuccessfulBackground(worker, {
    post: {
      id: 'sp2',
    },
  });
  const comments = await con.getRepository(Comment).find();
  const upvotes = await con.getRepository(CommentUpvote).find();
  const mentions = await con.getRepository(CommentMention).find();

  expect(comments.length).toEqual(3);
  expect(upvotes.length).toEqual(2);
  expect(mentions.length).toEqual(2);
});

it('should not delete comments if post is not deleted', async () => {
  await expectSuccessfulBackground(worker, {
    post: {
      id: 'sp1',
    },
  });

  const comments = await con.getRepository(Comment).find();
  const upvotes = await con.getRepository(CommentUpvote).find();
  const mentions = await con.getRepository(CommentMention).find();

  expect(comments.length).toEqual(3);
  expect(upvotes.length).toEqual(2);
  expect(mentions.length).toEqual(2);
});

it('should delete comments if post is deleted', async () => {
  await con.getRepository(SharePost).update({ id: 'sp1' }, { deleted: true });
  await expectSuccessfulBackground(worker, {
    post: {
      id: 'sp1',
    },
  });

  const comments = await con.getRepository(Comment).find();
  const upvotes = await con.getRepository(CommentUpvote).find();
  const mentions = await con.getRepository(CommentMention).find();

  expect(comments.length).toEqual(1);
  expect(upvotes.length).toEqual(1);
  expect(mentions.length).toEqual(1);
});

it('should not delete comment reports if post is deleted', async () => {
  await con.getRepository(SharePost).update({ id: 'sp1' }, { deleted: true });
  await expectSuccessfulBackground(worker, {
    post: {
      id: 'sp1',
    },
  });

  const reports = await con
    .getRepository(CommentReport)
    .find({ where: { commentId: 'c2' } });

  const comments = await con
    .getRepository(Comment)
    .find({ where: { postId: 'sp2' } });

  expect(comments.length).toEqual(0);
  expect(reports.length).toEqual(1);
});

it('should delete notifications for the deleted comments', async () => {
  await con.getRepository(SharePost).update({ id: 'sp1' }, { deleted: true });
  await expectSuccessfulBackground(worker, {
    post: {
      id: 'sp1',
    },
  });
  await expectSuccessfulBackground(notificationWorker, {
    comment: {
      id: 'c3',
    },
  });

  const comments = await con.getRepository(Comment).find();
  const upvotes = await con.getRepository(CommentUpvote).find();
  const mentions = await con.getRepository(CommentMention).find();
  const notifications = await con.getRepository(Notification).find();

  expect(comments.length).toEqual(1);
  expect(upvotes.length).toEqual(1);
  expect(mentions.length).toEqual(1);
  expect(notifications.length).toEqual(0);
});

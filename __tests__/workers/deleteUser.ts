import { Connection, getConnection } from 'typeorm';

import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/deleteUser';
import {
  AdvancedSettings,
  Alerts,
  Bookmark,
  BookmarkList,
  Comment,
  CommentUpvote,
  DevCard,
  Feed,
  FeedAdvancedSettings,
  FeedSource,
  FeedTag,
  HiddenPost,
  Post,
  PostReport,
  Settings,
  Source,
  SourceDisplay,
  SourceRequest,
  Upvote,
  User,
  View,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';

let con: Connection;

beforeAll(async () => {
  con = await getConnection();
});

beforeEach(async () => {
  const now = new Date();
  jest.resetAllMocks();
  await con.getRepository(User).save([
    {
      id: 'u1',
      name: 'ido',
      image: 'https://daily.dev/image.jpg',
      profileConfirmed: true,
      createdAt: new Date(2021, 7, 11),
    },
    {
      id: 'u2',
      name: 'nimrod',
      image: 'https://daily.dev/image.jpg',
      profileConfirmed: true,
      createdAt: new Date(2021, 7, 11),
    },
  ]);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await con.getRepository(Post).save({
    id: 'p7',
    shortId: 'sp7',
    title: 'P7',
    url: 'http://p7.com',
    score: 10,
    sourceId: 'p',
    authorId: 'u1',
    createdAt: new Date(now.getTime() - 5000),
  });
  await saveFixtures(con, View, [
    { postId: 'p1', userId: 'u1', timestamp: new Date(now.getTime()) },
    { postId: 'p1', userId: 'u1', timestamp: new Date(now.getTime() - 1) },
    { postId: 'p1', userId: 'u1', timestamp: new Date(now.getTime() - 2) },
    { postId: 'p1', userId: 'u1', timestamp: new Date(now.getTime() - 3) },
    { postId: 'p1', userId: 'u1', timestamp: new Date(now.getTime() - 4) },
    { postId: 'p2', userId: 'u1', timestamp: new Date(now.getTime() - 5) },
    { postId: 'p2', userId: 'u1', timestamp: new Date(now.getTime() - 6) },
  ]);
  await con.getRepository(BookmarkList).save([
    {
      id: '950406df-37dd-4d74-a91a-4a1b5081c988',
      userId: 'u1',
      name: 'list 1',
    },
    {
      id: '950406df-37dd-4d74-a91a-4a1b5081c999',
      userId: 'u1',
      name: 'list 2',
    },
  ]);
  await con.getRepository(Bookmark).save([
    {
      postId: 'p1',
      userId: 'u1',
      listId: null,
    },
    {
      postId: 'p2',
      userId: 'u1',
      listId: '950406df-37dd-4d74-a91a-4a1b5081c988',
    },
  ]);
  await con.getRepository(Alerts).save({
    userId: 'u1',
    filter: true,
    rankLastSeen: null,
    myFeed: 'created',
  });
  await con.getRepository(Comment).save([
    {
      id: 'c1',
      postId: 'p1',
      userId: 'u1',
      content: 'parent comment',
      createdAt: new Date(2020, 1, 6, 0, 0),
      upvotes: 1,
    },
    {
      id: 'c2',
      postId: 'p1',
      userId: 'u2',
      content: 'sub comment',
      createdAt: new Date(2020, 1, 6, 0, 0),
      parentId: 'c1',
    },
    {
      id: 'c3',
      postId: 'p1',
      userId: 'u1',
      content: 'sub comment',
      createdAt: new Date(2020, 1, 6, 0, 0),
      parentId: 'c1',
    },
    {
      id: 'c4',
      postId: 'p1',
      userId: 'u2',
      content: 'main comment user 2',
      createdAt: new Date(2020, 1, 6, 0, 0),
    },
  ]);
  await con.getRepository(CommentUpvote).save([
    {
      commentId: 'c1',
      userId: 'u1',
    },
    {
      commentId: 'c1',
      userId: 'u2',
    },
    {
      commentId: 'c2',
      userId: 'u1',
    },
    {
      commentId: 'c4',
      userId: 'u1',
    },
    {
      commentId: 'c4',
      userId: 'u2',
    },
  ]);
  await con.getRepository(DevCard).save({
    userId: 'u1',
  });
  await con.getRepository(Feed).save({
    id: 'f1',
    userId: 'u1',
  });
  await con.getRepository(AdvancedSettings).save({
    id: 1,
    title: 'as1',
    description: 'text',
    defaultEnabledState: true,
  });
  await con.getRepository(FeedAdvancedSettings).save({
    feedId: 'f1',
    advancedSettingsId: 1,
    enabled: false,
  });
  await con.getRepository(FeedSource).save({
    feedId: 'f1',
    sourceId: 'a',
  });
  await con.getRepository(FeedTag).save({
    feedId: 'f1',
    tag: 'javascript',
    blocked: true,
  });
  await con.getRepository(HiddenPost).save([
    {
      postId: 'p1',
      userId: 'u1',
    },
    {
      postId: 'p2',
      userId: 'u1',
    },
  ]);
  await con.getRepository(PostReport).save([
    {
      postId: 'p1',
      userId: 'u1',
      reason: 'CLICKBAIT',
      comment: 'comment 1',
    },
    {
      postId: 'p2',
      userId: 'u1',
      reason: 'LOW',
      comment: 'comment 1',
    },
  ]);
  await con.getRepository(Settings).save({
    userId: 'u1',
    theme: 'bright',
    insaneMode: true,
  });
  await con.getRepository(SourceDisplay).save({
    sourceId: 'p',
    name: 'Private',
    image: 'http://image.com/p',
    enabled: true,
    userId: 'u1',
  });
  await con.getRepository(SourceRequest).save({
    sourceUrl: 'http://2.com',
    userId: 'u1',
    closed: true,
    approved: false,
    createdAt: new Date('2020-10-08T12:24:17.662Z'),
  });
  await con.getRepository(Upvote).save([
    {
      postId: 'p1',
      userId: 'u1',
    },
    {
      postId: 'p2',
      userId: 'u1',
    },
    {
      postId: 'p1',
      userId: 'u2',
    },
  ]);
});

it('should delete an existing user', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'u1',
    name: 'ido',
    image: 'https://daily.dev/image.jpg',
    createdAt: new Date(2021, 7, 11),
  });
  const users = await con.getRepository(User).find();
  expect(users.length).toEqual(1);
});

it('should delete views for the deleted user', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'u1',
    name: 'ido',
    image: 'https://daily.dev/image.jpg',
    createdAt: new Date(2021, 7, 11),
  });
  const views = await con.getRepository(View).find();
  expect(views.length).toEqual(0);
});

it('should delete all alerts for the deleted user', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'u1',
    name: 'ido',
    image: 'https://daily.dev/image.jpg',
    createdAt: new Date(2021, 7, 11),
  });
  const alerts = await con.getRepository(Alerts).find();
  expect(alerts.length).toEqual(0);
});

it('should delete all bookmark list and bookmarks for the deleted user', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'u1',
    name: 'ido',
    image: 'https://daily.dev/image.jpg',
    createdAt: new Date(2021, 7, 11),
  });
  const bookmarkLists = await con.getRepository(BookmarkList).find();
  expect(bookmarkLists.length).toEqual(0);
  const bookmarks = await con.getRepository(Bookmark).find();
  expect(bookmarks.length).toEqual(0);
});

it('should delete all comments and comment upvotes for the deleted user', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'u1',
    name: 'ido',
    image: 'https://daily.dev/image.jpg',
    createdAt: new Date(2021, 7, 11),
  });
  const comments = await con.getRepository(Comment).find();
  expect(comments.length).toEqual(1);

  const commentUpvotes = await con.getRepository(CommentUpvote).find();
  expect(commentUpvotes.length).toEqual(1);
});

it('should delete the DevCard for the deleted user', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'u1',
    name: 'ido',
    image: 'https://daily.dev/image.jpg',
    createdAt: new Date(2021, 7, 11),
  });
  const devCards = await con.getRepository(DevCard).find();
  expect(devCards.length).toEqual(0);
});

it('should delete the feed and related items for the deleted user', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'u1',
    name: 'ido',
    image: 'https://daily.dev/image.jpg',
    createdAt: new Date(2021, 7, 11),
  });
  const feed = await con.getRepository(Feed).find();
  expect(feed.length).toEqual(0);

  const feedAdvancedSettings = await con
    .getRepository(FeedAdvancedSettings)
    .find();
  expect(feedAdvancedSettings.length).toEqual(0);

  const feedSource = await con.getRepository(FeedSource).find();
  expect(feedSource.length).toEqual(0);

  const feedTags = await con.getRepository(FeedTag).find();
  expect(feedTags.length).toEqual(0);
});

it('should delete hidden posts for the deleted user', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'u1',
    name: 'ido',
    image: 'https://daily.dev/image.jpg',
    createdAt: new Date(2021, 7, 11),
  });
  const hiddenPosts = await con.getRepository(HiddenPost).find();
  expect(hiddenPosts.length).toEqual(0);
});

it('should delete reported posts for the deleted user', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'u1',
    name: 'ido',
    image: 'https://daily.dev/image.jpg',
    createdAt: new Date(2021, 7, 11),
  });
  const reportedPosts = await con.getRepository(PostReport).find();
  expect(reportedPosts.length).toEqual(0);
});

it('should delete settings for the deleted user', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'u1',
    name: 'ido',
    image: 'https://daily.dev/image.jpg',
    createdAt: new Date(2021, 7, 11),
  });
  const settings = await con.getRepository(Settings).find();
  expect(settings.length).toEqual(0);
});

it('should delete source displays for the deleted user', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'u1',
    name: 'ido',
    image: 'https://daily.dev/image.jpg',
    createdAt: new Date(2021, 7, 11),
  });
  const sourceDisplays = await con.getRepository(SourceDisplay).find();
  expect(sourceDisplays.length).toEqual(0);
});

it('should delete source requests for the deleted user', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'u1',
    name: 'ido',
    image: 'https://daily.dev/image.jpg',
    createdAt: new Date(2021, 7, 11),
  });
  const sourceRequests = await con.getRepository(SourceRequest).find();
  expect(sourceRequests.length).toEqual(0);
});

it('should delete upvotes for the deleted user', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'u1',
    name: 'ido',
    image: 'https://daily.dev/image.jpg',
    createdAt: new Date(2021, 7, 11),
  });
  const upvotes = await con.getRepository(Upvote).find();
  expect(upvotes.length).toEqual(1);
});

it('should clear author from posts for the deleted user', async () => {
  const sanityCheck = await con
    .getRepository(Post)
    .find({ where: { authorId: 'u1' } });
  expect(sanityCheck.length).toEqual(1);
  await expectSuccessfulBackground(worker, {
    id: 'u1',
    name: 'ido',
    image: 'https://daily.dev/image.jpg',
    createdAt: new Date(2021, 7, 11),
  });
  const authorPosts = await con
    .getRepository(Post)
    .find({ where: { authorId: 'u1' } });
  expect(authorPosts.length).toEqual(0);
});

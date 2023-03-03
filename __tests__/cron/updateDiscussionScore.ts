import cron from '../../src/cron/updateDiscussionScore';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { ArticlePost, Comment, Post, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await con.getRepository(User).save([
    {
      id: '1',
      name: 'Ido',
      image: 'https://daily.dev/ido.jpg',
      reputation: 300,
    },
    {
      id: '2',
      name: 'Tsahi',
      image: 'https://daily.dev/tsahi.jpg',
      reputation: 100,
    },
    { id: '3', name: 'Nimrod', image: 'https://daily.dev/nimrod.jpg' },
  ]);
});

it('should update discussion score', async () => {
  const now = new Date();
  await saveFixtures(con, ArticlePost, [
    {
      id: 'p1',
      shortId: 'p1',
      title: 'P1',
      url: 'http://p1.com',
      sourceId: 'a',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 20),
      comments: 3,
    },
    {
      id: 'p2',
      shortId: 'p2',
      title: 'P2',
      url: 'http://p2.com',
      sourceId: 'b',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 100),
      comments: 1,
    },
    {
      id: 'p3',
      shortId: 'p3',
      title: 'P3',
      url: 'http://p3.com',
      sourceId: 'c',
      discussionScore: 10,
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 150),
      comments: 1,
    },
    {
      id: 'p4',
      shortId: 'p4',
      title: 'P4',
      url: 'http://p4.com',
      sourceId: 'c',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 150),
    },
  ]);
  await con.getRepository(Comment).save([
    {
      id: 'c1',
      postId: 'p1',
      userId: '1',
      content: 'parent comment',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24),
      upvotes: 5,
    },
    {
      id: 'c2',
      parentId: 'c1',
      postId: 'p1',
      userId: '1',
      content: 'child comment',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 20),
    },
    {
      id: 'c3',
      postId: 'p1',
      userId: '2',
      content: 'parent comment #2',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10),
      upvotes: 10,
    },
    {
      id: 'c4',
      postId: 'p2',
      userId: '3',
      content: 'parent comment #3',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30),
    },
    {
      id: 'c5',
      postId: 'p3',
      userId: '2',
      content: 'parent comment #4',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 100),
    },
  ]);

  await expectSuccessfulCron(cron);
  const posts = await con.getRepository(Post).find({
    select: ['id', 'discussionScore'],
    order: { id: 'ASC' },
  });
  expect(posts[0].discussionScore).toBeGreaterThan(0);
  expect(posts[1].discussionScore).toBeGreaterThan(0);
  expect(posts[2].discussionScore).toEqual(null);
  expect(posts[3].discussionScore).toEqual(null);
});

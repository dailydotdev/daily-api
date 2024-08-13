import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ArticlePost, Post, PostType, Source, User } from '../../src/entity';
import { vordrPostPrevented as worker } from '../../src/workers/vordrPostPrevented';
import { badUsersFixture, sourcesFixture, usersFixture } from '../fixture';
import { postsFixture } from '../fixture/post';
import { typedWorkers } from '../../src/workers';
import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import { notifyNewVordrPost } from '../../src/common';
import { ChangeObject } from '../../src/types';

let con: DataSource;

jest.mock('../../src/common', () => ({
  ...jest.requireActual<Record<string, unknown>>('../../src/common'),
  notifyNewVordrPost: jest.fn(),
}));

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, User, badUsersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await saveFixtures(con, ArticlePost, [
    {
      id: 'vordr1',
      shortId: 'svordr1',
      title: 'vordr1',
      url: 'http://vordr1.com',
      image: 'https://daily.dev/image.jpg',
      score: 10,
      sourceId: 'b',
      createdAt: new Date(new Date().getTime() - 4000),
      tagsStr: 'html,javascript',
      type: PostType.Article,
      contentCuration: ['c1', 'c2'],
      authorId: '2',
      flags: { vordr: true },
    },
    {
      id: 'vordr2',
      shortId: 'svordr2',
      title: 'vordr2',
      url: 'http://vordr2.com',
      image: 'https://daily.dev/image.jpg',
      score: 10,
      sourceId: 'b',
      createdAt: new Date(new Date().getTime() - 4000),
      tagsStr: 'html,javascript',
      type: PostType.Article,
      contentCuration: ['c1', 'c2'],
      authorId: '2',
      flags: { vordr: true },
    },
  ]);
});

describe('vordrPostPrevented', () => {
  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should send slack message when vordr prevented a post', async () => {
    const post = await con.getRepository(ArticlePost).findOneByOrFail({
      id: 'vordr1',
    });

    await expectSuccessfulTypedBackground(worker, {
      post: post as unknown as ChangeObject<ArticlePost>,
    });

    expect(notifyNewVordrPost).toHaveBeenCalledTimes(1);
  });

  it('should not send slack message when vordr did not prevented a post', async () => {
    const post = await con.getRepository(ArticlePost).findOneByOrFail({
      id: 'p1',
    });

    await expectSuccessfulTypedBackground(worker, {
      post: post as unknown as ChangeObject<ArticlePost>,
    });

    expect(notifyNewVordrPost).toHaveBeenCalledTimes(0);
  });
});

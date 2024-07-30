import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { Comment, Post, Source, User } from '../../src/entity';
import worker from '../../src/workers/vordrPostCommentPrevented';
import { badUsersFixture, sourcesFixture, usersFixture } from '../fixture';
import { postsFixture } from '../fixture/post';
import { typedWorkers } from '../../src/workers';
import { PubSubSchema } from '../../src/common';
import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import { notifyNewVordrComment } from '../../src/common';

let con: DataSource;

jest.mock('../../src/common', () => ({
  ...jest.requireActual<Record<string, unknown>>('../../src/common'),
  notifyNewVordrComment: jest.fn(),
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
  await saveFixtures(con, Comment, [
    {
      id: 'c1',
      postId: 'p1',
      userId: '1',
      content: 'comment',
      contentHtml: '<p>comment</p>',
      flags: { vordr: false },
    },
    {
      id: 'c2',
      postId: 'p1',
      userId: 'vordr',
      content: 'comment',
      contentHtml: '<p>comment</p>',
      flags: { vordr: true },
    },
  ]);
});

describe('vordrPostCommentPrevented', () => {
  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should send slack message when vordr prevented a comment', async () => {
    (await expectSuccessfulTypedBackground(worker, {
      userId: 'vordr',
      commentId: 'c2',
      postId: 'p1',
    })) as unknown as PubSubSchema['post-commented'];

    expect(notifyNewVordrComment).toHaveBeenCalledTimes(1);
  });

  it('should not send slack message when vordr did not prevented a comment', async () => {
    (await expectSuccessfulTypedBackground(worker, {
      userId: 'vordr',
      commentId: 'c1',
      postId: 'p1',
    })) as unknown as PubSubSchema['post-commented'];

    expect(notifyNewVordrComment).toHaveBeenCalledTimes(0);
  });
});

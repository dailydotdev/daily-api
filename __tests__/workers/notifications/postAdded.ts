import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { Comment, Post, Source, User } from '../../../src/entity';
import worker from '../../../src/workers/notifications/postAdded';
import { badUsersFixture, sourcesFixture, usersFixture } from '../../fixture';
import { postsFixture } from '../../fixture/post';
import { workers } from '../../../src/workers/notifications';
import { invokeNotificationWorker, saveFixtures } from '../../helpers';

let con: DataSource;

// jest.mock('../../src/common', () => ({
//   ...jest.requireActual<Record<string, unknown>>('../../src/common'),
//   notifyNewVordrComment: jest.fn(),
// }));

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
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  describe('vordr', () => {
    it('should not send notification when the comment is prevented by vordr', async () => {
      const payload = {
        post: {
          id: 'p1',
        },
      };

      await con
        .getRepository(Post)
        .update('p1', { authorId: '1', flags: { vordr: true } });

      const result = await invokeNotificationWorker(
        worker,
        payload as unknown as Record<string, unknown>,
      );

      expect(result).toBeUndefined();
    });

    it('should send notification when the comment is not prevented by vordr', async () => {
      const payload = {
        post: {
          id: 'p1',
        },
      };

      await con
        .getRepository(Post)
        .update('p1', { authorId: '1', flags: { vordr: false } });

      const result = await invokeNotificationWorker(
        worker,
        payload as unknown as Record<string, unknown>,
      );

      expect(result?.length).toEqual(1);
    });
  });
});

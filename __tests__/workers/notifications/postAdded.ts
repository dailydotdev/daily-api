import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { Comment, Post, Source, User } from '../../../src/entity';
import { postAdded } from '../../../src/workers/notifications/postAdded';
import { badUsersFixture, sourcesFixture, usersFixture } from '../../fixture';
import { postsFixture } from '../../fixture/post';
import { workers } from '../../../src/workers/notifications';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';

let con: DataSource;

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
      (item) => item.subscription === postAdded.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  describe('vordr', () => {
    it('should not send notification when the comment is prevented by vordr', async () => {
      await con
        .getRepository(Post)
        .update('p1', { authorId: '1', flags: { vordr: true } });

      const result = await invokeTypedNotificationWorker<'api.v1.post-visible'>(
        postAdded,
        {
          post: {
            id: 'p1',
          },
        },
      );

      expect(result).toBeUndefined();
    });

    it('should send notification when the comment is not prevented by vordr', async () => {
      await con
        .getRepository(Post)
        .update('p1', { authorId: '1', flags: { vordr: false } });

      const result = await invokeTypedNotificationWorker<'api.v1.post-visible'>(
        postAdded,
        {
          post: {
            id: 'p1',
          },
        },
      );

      expect(result?.length).toEqual(1);
    });
  });
});

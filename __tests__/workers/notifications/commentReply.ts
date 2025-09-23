import { DataSource } from 'typeorm';
import { commentReply } from '../../../src/workers/notifications/commentReply';
import createOrGetConnection from '../../../src/db';
import { Comment, Post, Source, User } from '../../../src/entity';
import { badUsersFixture, sourcesFixture, usersFixture } from '../../fixture';
import { postsFixture } from '../../fixture/post';
import { workers } from '../../../src/workers';
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
      parentId: 'c1',
      postId: 'p1',
      userId: '1',
      content: 'comment',
      contentHtml: '<p>comment</p>',
      flags: { vordr: true },
    },
  ]);
});

describe('commentReply', () => {
  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === commentReply.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should not send notification when the comment is prevented by vordr', async () => {
    const result = await invokeTypedNotificationWorker<'comment-commented'>(
      commentReply,
      {
        postId: 'p1',
        userId: '1',
        parentCommentId: 'c0',
        childCommentId: 'c2',
        contentHtml: '<p>Test</p>',
      },
    );

    expect(result).toBeUndefined();
  });
});

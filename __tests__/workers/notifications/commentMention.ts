import { DataSource } from 'typeorm';
import worker, {
  Data,
} from '../../../src/workers/notifications/commentMention';
import createOrGetConnection from '../../../src/db';
import {
  Comment,
  CommentMention,
  Post,
  Source,
  User,
} from '../../../src/entity';
import { badUsersFixture, sourcesFixture, usersFixture } from '../../fixture';
import { postsFixture } from '../../fixture/post';
import { workers } from '../../../src/workers';
import { invokeNotificationWorker, saveFixtures } from '../../helpers';

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
      flags: { vordr: true },
    },
  ]);
  await saveFixtures(con, CommentMention, [
    {
      commentId: 'c1',
      commentByUserId: '1',
      mentionedUserId: '2',
    },
  ]);
});

describe('commentMention', () => {
  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should not send notification when the comment is prevented by vordr', async () => {
    const payload: Data = {
      commentMention: {
        commentId: 'c2',
        commentByUserId: '1',
        mentionedUserId: '2',
      },
    };

    const result = await invokeNotificationWorker(
      worker,
      payload as unknown as Record<string, unknown>,
    );

    expect(result).toBeUndefined();
  });
});

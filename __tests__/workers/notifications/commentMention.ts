import { DataSource } from 'typeorm';
import worker, {
  Data,
} from '../../../src/workers/notifications/commentMention';
import createOrGetConnection from '../../../src/db';
import {
  Comment,
  CommentMention,
  NotificationPreferenceComment,
  Post,
  Source,
  User,
} from '../../../src/entity';
import { badUsersFixture, sourcesFixture, usersFixture } from '../../fixture';
import { postsFixture } from '../../fixture/post';
import { workers } from '../../../src/workers';
import { invokeNotificationWorker, saveFixtures } from '../../helpers';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../../../src/notifications/common';

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
    {
      id: 'c2',
      postId: 'p1',
      userId: '1',
      content: 'comment',
      contentHtml: '<p>comment</p>',
    },
    {
      id: 'c3',
      postId: 'p1',
      userId: '2',
      content: 'comment',
      contentHtml: '<p>comment</p>',
      parentId: 'c2',
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
        commentId: 'c1',
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

  it('should not send notification when the parent commenter is mentioned', async () => {
    const payload: Data = {
      commentMention: {
        commentId: 'c3',
        commentByUserId: '2',
        mentionedUserId: '1',
      },
    };

    const result = await invokeNotificationWorker(
      worker,
      payload as unknown as Record<string, unknown>,
    );

    expect(result).toBeUndefined();
  });

  it('should not send notification when the author is mentioned', async () => {
    await con.getRepository(Post).update('p1', { authorId: '3' });
    const payload: Data = {
      commentMention: {
        commentId: 'c2',
        commentByUserId: '1',
        mentionedUserId: '3',
      },
    };

    const result = await invokeNotificationWorker(
      worker,
      payload as unknown as Record<string, unknown>,
    );

    expect(result).toBeUndefined();
  });

  it('should not send notification when the user muted the thread', async () => {
    await con.getRepository(NotificationPreferenceComment).save({
      userId: '3',
      referenceId: 'c2',
      notificationType: NotificationType.CommentReply,
      status: NotificationPreferenceStatus.Muted,
    });
    const payload: Data = {
      commentMention: {
        commentId: 'c3',
        commentByUserId: '2',
        mentionedUserId: '3',
      },
    };

    const result = await invokeNotificationWorker(
      worker,
      payload as unknown as Record<string, unknown>,
    );

    expect(result).toBeUndefined();
  });

  it('should send notification to mentioned user', async () => {
    const payload: Data = {
      commentMention: {
        commentId: 'c3',
        commentByUserId: '2',
        mentionedUserId: '3',
      },
    };

    const result = await invokeNotificationWorker(
      worker,
      payload as unknown as Record<string, unknown>,
    );

    expect(result?.length).toEqual(1);
    expect(result?.[0].ctx.userIds).toEqual(['3']);
    expect(result?.[0].type).toEqual(NotificationType.CommentMention);
  });
});

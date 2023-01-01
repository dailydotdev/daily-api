import { invokeNotificationWorker } from '../helpers';
import {
  Comment,
  CommentUpvote,
  Post,
  PostReport,
  Source,
  SubmissionStatus,
  Upvote,
  User,
} from '../../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { usersFixture } from '../fixture/user';
import { postsFixture } from '../fixture/post';
import { sourcesFixture } from '../fixture/source';
import {
  NotificationCommentContext,
  NotificationCommenterContext,
  NotificationPostContext,
  NotificationSourceContext,
  NotificationSourceRequestContext,
  NotificationUpvotersContext,
} from '../../src/notifications';
import { NotificationReason } from '../../src/common';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await con.getRepository(User).save(usersFixture);
  await con.getRepository(Source).save(sourcesFixture);
  await con.getRepository(Post).save([postsFixture[0]]);
  await con.getRepository(Comment).save([
    {
      id: 'c1',
      postId: 'p1',
      userId: '2',
      content: 'comment',
      contentHtml: '<p>comment</p>',
    },
  ]);
});

it('should add community picks failed notification', async () => {
  const worker = await import(
    '../../src/workers/notifications/communityPicksFailed'
  );
  const actual = await invokeNotificationWorker(worker.default, {
    id: 'sr1',
    url: 'http://sample.abc.com',
    userId: '1',
    createdAt: 1601187916999999,
    status: SubmissionStatus.Rejected,
  });
  expect(actual.length).toEqual(1);
  expect(actual[0].type).toEqual('community_picks_failed');
  expect(actual[0].ctx).toEqual({
    userId: '1',
    submission: {
      id: 'sr1',
      url: 'http://sample.abc.com',
      userId: '1',
      createdAt: 1601187916999999,
      status: SubmissionStatus.Rejected,
    },
  });
});

it('should add community picks succeeded notification', async () => {
  const worker = await import(
    '../../src/workers/notifications/communityPicksSucceeded'
  );
  const actual = await invokeNotificationWorker(worker.default, {
    scoutId: '1',
    postId: 'p1',
  });
  const posts = await con.getRepository(Post).find();
  expect(actual.length).toEqual(1);
  expect(actual[0].type).toEqual('community_picks_succeeded');
  expect(actual[0].ctx).toEqual({
    userId: '1',
    post: posts[0],
  });
});

it('should add community picks granted notification', async () => {
  const worker = await import(
    '../../src/workers/notifications/communityPicksGranted'
  );
  const actual = await invokeNotificationWorker(worker.default, {
    userId: '1',
  });
  expect(actual.length).toEqual(1);
  expect(actual[0].type).toEqual('community_picks_granted');
  expect(actual[0].ctx).toEqual({
    userId: '1',
  });
});

it('should add article picked notification', async () => {
  const worker = await import('../../src/workers/notifications/articlePicked');
  const actual = await invokeNotificationWorker(worker.default, {
    authorId: '1',
    postId: 'p1',
  });
  const posts = await con.getRepository(Post).find();
  expect(actual.length).toEqual(1);
  expect(actual[0].type).toEqual('article_picked');
  expect(actual[0].ctx).toEqual({
    userId: '1',
    post: posts[0],
  });
});

describe('article new comment', () => {
  it('should add notification for scout and author', async () => {
    const worker = await import(
      '../../src/workers/notifications/articleNewCommentPostCommented'
    );
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        scoutId: '1',
        authorId: '3',
      },
    );
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '1',
      postId: 'p1',
      commentId: 'c1',
    });
    expect(actual.length).toEqual(2);
    actual.forEach((bundle) => {
      expect(bundle.type).toEqual('article_new_comment');
      expect((bundle.ctx as NotificationPostContext).post.id).toEqual('p1');
      expect((bundle.ctx as NotificationCommentContext).comment.id).toEqual(
        'c1',
      );
      expect((bundle.ctx as NotificationCommenterContext).commenter.id).toEqual(
        '2',
      );
    });
    expect(actual[0].ctx.userId).toEqual('1');
    expect(actual[1].ctx.userId).toEqual('3');
  });

  it('should add one notification when scout and author are the same', async () => {
    const worker = await import(
      '../../src/workers/notifications/articleNewCommentPostCommented'
    );
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        scoutId: '1',
        authorId: '1',
      },
    );
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '1',
      postId: 'p1',
      commentId: 'c1',
    });
    expect(actual.length).toEqual(1);
    expect(actual[0].ctx.userId).toEqual('1');
  });

  it('should not add notification when the author commented', async () => {
    const worker = await import(
      '../../src/workers/notifications/articleNewCommentPostCommented'
    );
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        authorId: '1',
      },
    );
    await con.getRepository(Comment).update(
      { id: 'c1' },
      {
        userId: '1',
      },
    );
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '1',
      postId: 'p1',
      commentId: 'c1',
    });
    expect(actual).toBeFalsy();
  });

  it('should add notification for scout and author on new reply', async () => {
    const worker = await import(
      '../../src/workers/notifications/articleNewCommentCommentCommented'
    );
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        scoutId: '1',
        authorId: '3',
      },
    );
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '1',
      postId: 'p1',
      childCommentId: 'c1',
    });
    expect(actual.length).toEqual(2);
    expect(actual[0].ctx.userId).toEqual('1');
    expect(actual[1].ctx.userId).toEqual('3');
  });
});

describe('article upvote milestone', () => {
  it('should add notification for scout and author', async () => {
    const worker = await import(
      '../../src/workers/notifications/articleUpvoteMilestone'
    );
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        scoutId: '1',
        authorId: '3',
        upvotes: 5,
      },
    );
    await con.getRepository(Upvote).save([
      {
        userId: '2',
        postId: 'p1',
      },
      { userId: '4', postId: 'p1' },
    ]);
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '2',
      postId: 'p1',
    });
    expect(actual.length).toEqual(2);
    actual.forEach((bundle) => {
      expect(bundle.type).toEqual('article_upvote_milestone');
      expect((bundle.ctx as NotificationPostContext).post.id).toEqual('p1');
      expect((bundle.ctx as NotificationUpvotersContext).upvotes).toEqual(5);
      expect(
        (bundle.ctx as NotificationUpvotersContext).upvoters.length,
      ).toEqual(2);
    });
    expect(actual[0].ctx.userId).toEqual('1');
    expect(actual[1].ctx.userId).toEqual('3');
  });

  it('should add one notification when scout and author are the same', async () => {
    const worker = await import(
      '../../src/workers/notifications/articleUpvoteMilestone'
    );
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        scoutId: '1',
        authorId: '1',
        upvotes: 5,
      },
    );
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '2',
      postId: 'p1',
    });
    expect(actual.length).toEqual(1);
    expect(actual[0].ctx.userId).toEqual('1');
  });

  it('should not add notification when the author upvoted', async () => {
    const worker = await import(
      '../../src/workers/notifications/articleUpvoteMilestone'
    );
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        authorId: '1',
      },
    );
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '1',
      postId: 'p1',
    });
    expect(actual).toBeFalsy();
  });

  it('should not add notification if it is not milestone', async () => {
    const worker = await import(
      '../../src/workers/notifications/articleUpvoteMilestone'
    );
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        authorId: '1',
        upvotes: 11,
      },
    );
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '2',
      postId: 'p1',
    });
    expect(actual).toBeFalsy();
  });
});

it('should add article report approved notification for every reporter', async () => {
  const worker = await import(
    '../../src/workers/notifications/articleReportApproved'
  );
  await con.getRepository(PostReport).save([
    { userId: '1', postId: 'p1', reason: 'NSFW' },
    { userId: '2', postId: 'p1', reason: 'CLICKBAIT' },
  ]);
  const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
  const actual = await invokeNotificationWorker(worker.default, {
    post,
  });
  expect(actual.length).toEqual(2);
  expect(actual[0].type).toEqual('article_report_approved');
  expect(actual[0].ctx.userId).toEqual('1');
  expect((actual[0].ctx as NotificationPostContext).post.id).toEqual('p1');
  expect(actual[1].type).toEqual('article_report_approved');
  expect(actual[1].ctx.userId).toEqual('2');
  expect((actual[1].ctx as NotificationPostContext).post.id).toEqual('p1');
});

it('should add article analytics notification for scout and author', async () => {
  const worker = await import(
    '../../src/workers/notifications/articleAnalytics'
  );
  await con.getRepository(Post).update(
    { id: 'p1' },
    {
      authorId: '1',
      scoutId: '3',
    },
  );
  const actual = await invokeNotificationWorker(worker.default, {
    postId: 'p1',
  });
  expect(actual.length).toEqual(2);
  expect(actual[0].type).toEqual('article_analytics');
  expect(actual[0].ctx.userId).toEqual('3');
  expect((actual[0].ctx as NotificationPostContext).post.id).toEqual('p1');
  expect(actual[1].type).toEqual('article_analytics');
  expect(actual[1].ctx.userId).toEqual('1');
  expect((actual[1].ctx as NotificationPostContext).post.id).toEqual('p1');
});

describe('source request', () => {
  it('should add source approved notification', async () => {
    const worker = await import(
      '../../src/workers/notifications/sourceRequest'
    );
    const actual = await invokeNotificationWorker(worker.default, {
      reason: NotificationReason.Publish,
      sourceRequest: {
        id: 'sr1',
        userId: '1',
        sourceId: sourcesFixture[0].id,
      },
    });
    expect(actual.length).toEqual(1);
    expect(actual[0].type).toEqual('source_approved');
    expect(actual[0].ctx.userId).toEqual('1');
    expect(
      (actual[0].ctx as NotificationSourceRequestContext).sourceRequest.id,
    ).toEqual('sr1');
    expect((actual[0].ctx as NotificationSourceContext).source.id).toEqual('a');
  });

  it('should add source rejected notification', async () => {
    const worker = await import(
      '../../src/workers/notifications/sourceRequest'
    );
    const actual = await invokeNotificationWorker(worker.default, {
      reason: NotificationReason.Decline,
      sourceRequest: {
        id: 'sr1',
        userId: '1',
        sourceId: sourcesFixture[0].id,
      },
    });
    expect(actual.length).toEqual(1);
    expect(actual[0].type).toEqual('source_rejected');
    expect(actual[0].ctx.userId).toEqual('1');
    expect(
      (actual[0].ctx as NotificationSourceRequestContext).sourceRequest.id,
    ).toEqual('sr1');
  });

  it('should add source rejected notification on existing source', async () => {
    const worker = await import(
      '../../src/workers/notifications/sourceRequest'
    );
    const actual = await invokeNotificationWorker(worker.default, {
      reason: NotificationReason.Exists,
      sourceRequest: {
        id: 'sr1',
        userId: '1',
        sourceId: sourcesFixture[0].id,
      },
    });
    expect(actual.length).toEqual(1);
    expect(actual[0].type).toEqual('source_rejected');
    expect(actual[0].ctx.userId).toEqual('1');
    expect(
      (actual[0].ctx as NotificationSourceRequestContext).sourceRequest.id,
    ).toEqual('sr1');
  });

  it('should do nothing otherwise', async () => {
    const worker = await import(
      '../../src/workers/notifications/sourceRequest'
    );
    const actual = await invokeNotificationWorker(worker.default, {
      reason: NotificationReason.New,
      sourceRequest: {
        id: 'sr1',
        userId: '1',
        sourceId: sourcesFixture[0].id,
      },
    });
    expect(actual).toBeFalsy();
  });
});

it('should add comment mention notification', async () => {
  const worker = await import('../../src/workers/notifications/commentMention');
  const actual = await invokeNotificationWorker(worker.default, {
    commentMention: {
      commentId: 'c1',
      mentionedUserId: '1',
      commentUserId: '2',
    },
  });
  expect(actual.length).toEqual(1);
  expect(actual[0].type).toEqual('comment_mention');
  expect(actual[0].ctx.userId).toEqual('1');
  expect((actual[0].ctx as NotificationPostContext).post.id).toEqual('p1');
  expect((actual[0].ctx as NotificationCommentContext).comment.id).toEqual(
    'c1',
  );
  expect((actual[0].ctx as NotificationCommenterContext).commenter.id).toEqual(
    '2',
  );
});

it('should add comment reply notification', async () => {
  await con.getRepository(Comment).save([
    {
      id: 'c2',
      postId: 'p1',
      userId: '2',
      content: 'sub comment',
      createdAt: new Date(2020, 1, 6, 0, 0),
      parentId: 'c1',
    },
    {
      id: 'c3',
      postId: 'p1',
      userId: '1',
      content: 'sub comment2',
      createdAt: new Date(2020, 1, 6, 0, 0),
      parentId: 'c1',
    },
    {
      id: 'c4',
      postId: 'p1',
      userId: '3',
      content: 'sub comment3',
      createdAt: new Date(2020, 1, 6, 0, 0),
      parentId: 'c1',
    },
    {
      id: 'c5',
      postId: 'p1',
      userId: '4',
      content: 'sub comment4',
      createdAt: new Date(2020, 1, 6, 0, 0),
      parentId: 'c1',
    },
  ]);
  const worker = await import('../../src/workers/notifications/commentReply');
  const actual = await invokeNotificationWorker(worker.default, {
    postId: 'p1',
    userId: '4',
    childCommentId: 'c5',
  });
  expect(actual.length).toEqual(3);
  actual.forEach((bundle) => {
    expect(bundle.type).toEqual('comment_reply');
    expect((bundle.ctx as NotificationPostContext).post.id).toEqual('p1');
    expect((bundle.ctx as NotificationCommentContext).comment.id).toEqual('c5');
    expect((bundle.ctx as NotificationCommenterContext).commenter.id).toEqual(
      '4',
    );
  });
  expect(actual.map((bundle) => bundle.ctx.userId)).toEqual(['1', '3', '2']);
});

it('should not add comment reply notification to comment author on their reply', async () => {
  await con.getRepository(Comment).save([
    {
      id: 'c2',
      postId: 'p1',
      userId: '2',
      content: 'sub comment',
      createdAt: new Date(2020, 1, 6, 0, 0),
      parentId: 'c1',
    },
    {
      id: 'c3',
      postId: 'p1',
      userId: '1',
      content: 'sub comment2',
      createdAt: new Date(2020, 1, 6, 0, 0),
      parentId: 'c1',
    },
  ]);
  const worker = await import('../../src/workers/notifications/commentReply');
  const actual = await invokeNotificationWorker(worker.default, {
    postId: 'p1',
    userId: '1',
    childCommentId: 'c3',
  });
  expect(actual.length).toEqual(1);
  expect(actual[0].ctx.userId).toEqual('2');
});

describe('comment upvote milestone', () => {
  it('should add notification for author', async () => {
    const worker = await import(
      '../../src/workers/notifications/commentUpvoteMilestone'
    );
    await con.getRepository(Comment).update({ id: 'c1' }, { upvotes: 5 });
    await con.getRepository(CommentUpvote).save([
      {
        userId: '1',
        commentId: 'c1',
      },
      { userId: '4', commentId: 'c1' },
    ]);
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '1',
      commentId: 'c1',
    });
    expect(actual.length).toEqual(1);
    expect(actual[0].type).toEqual('comment_upvote_milestone');
    expect((actual[0].ctx as NotificationPostContext).post.id).toEqual('p1');
    expect((actual[0].ctx as NotificationCommentContext).comment.id).toEqual(
      'c1',
    );
    expect((actual[0].ctx as NotificationUpvotersContext).upvotes).toEqual(5);
    expect(
      (actual[0].ctx as NotificationUpvotersContext).upvoters.length,
    ).toEqual(2);
    expect(actual[0].ctx.userId).toEqual('2');
  });

  it('should not add notification when the author upvoted', async () => {
    await con.getRepository(Comment).update({ id: 'c1' }, { upvotes: 5 });
    const worker = await import(
      '../../src/workers/notifications/commentUpvoteMilestone'
    );
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '2',
      commentId: 'c1',
    });
    expect(actual).toBeFalsy();
  });

  it('should not add notification if it is not milestone', async () => {
    await con.getRepository(Comment).update({ id: 'c1' }, { upvotes: 11 });
    const worker = await import(
      '../../src/workers/notifications/commentUpvoteMilestone'
    );
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '1',
      commentId: 'c1',
    });
    expect(actual).toBeFalsy();
  });
});

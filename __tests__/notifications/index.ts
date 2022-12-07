import {
  generateNotification,
  NotificationBaseContext,
  NotificationCommentContext,
  NotificationCommenterContext,
  NotificationPostContext,
  NotificationSourceContext,
  NotificationSourceRequestContext,
  NotificationSubmissionContext,
  NotificationUpvotersContext,
  Reference,
  storeNotificationBundle,
} from '../../src/notifications';
import { postsFixture } from '../fixture/post';
import {
  Comment,
  Post,
  User,
  Source,
  SourceRequest,
  NotificationAttachment,
  NotificationAvatar,
  Notification,
} from '../../src/entity';
import { scoutArticleLink } from '../../src/common';
import { usersFixture } from '../fixture/user';
import createOrGetConnection from '../../src/db';
import { DataSource } from 'typeorm';

const userId = '1';
const commentFixture: Reference<Comment> = {
  id: 'c1',
  postId: 'p1',
  userId: '2',
  content: 'Complex **markdown** comment that needs to be `simplified`',
  contentHtml: '<p>parent comment</p>',
  createdAt: new Date(2020, 1, 6, 0, 0),
} as Reference<Comment>;

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('generateNotification', () => {
  it('should generate community_picks_failed notification', () => {
    const type = 'community_picks_failed';
    const ctx: NotificationSubmissionContext = {
      userId,
      submission: { id: 's1' },
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(false);
    expect(actual.notification.referenceId).toEqual('s1');
    expect(actual.notification.referenceType).toEqual('submission');
    expect(actual.avatars.length).toEqual(0);
    expect(actual.attachments.length).toEqual(0);
  });

  it('should generate community_picks_succeeded notification', () => {
    const type = 'community_picks_succeeded';
    const ctx: NotificationSubmissionContext & NotificationPostContext = {
      userId,
      submission: { id: 's1' },
      post: postsFixture[0] as Reference<Post>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(true);
    expect(actual.notification.referenceId).toEqual('p1');
    expect(actual.notification.referenceType).toEqual('post');
    expect(actual.notification.targetUrl).toEqual(
      'http://localhost:5002/posts/p1',
    );
    expect(actual.avatars.length).toEqual(0);
    expect(actual.attachments).toEqual([
      {
        image: 'https://daily.dev/image.jpg',
        order: 0,
        referenceId: 'p1',
        title: 'P1',
        type: 'post',
      },
    ]);
  });

  it('should generate community_picks_granted notification', () => {
    const type = 'community_picks_granted';
    const ctx: NotificationBaseContext = { userId };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(true);
    expect(actual.notification.referenceId).toEqual('system');
    expect(actual.notification.referenceType).toEqual('system');
    expect(actual.notification.targetUrl).toEqual(scoutArticleLink);
    expect(actual.avatars.length).toEqual(0);
    expect(actual.attachments.length).toEqual(0);
  });

  it('should generate article_picked notification', () => {
    const type = 'article_picked';
    const ctx: NotificationPostContext = {
      userId,
      post: postsFixture[0] as Reference<Post>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(true);
    expect(actual.notification.referenceId).toEqual('p1');
    expect(actual.notification.referenceType).toEqual('post');
    expect(actual.notification.targetUrl).toEqual(
      'http://localhost:5002/posts/p1',
    );
    expect(actual.avatars.length).toEqual(0);
    expect(actual.attachments).toEqual([
      {
        image: 'https://daily.dev/image.jpg',
        order: 0,
        referenceId: 'p1',
        title: 'P1',
        type: 'post',
      },
    ]);
  });

  it('should generate article_new_comment notification', () => {
    const type = 'article_new_comment';
    const ctx: NotificationCommenterContext = {
      userId,
      post: postsFixture[0] as Reference<Post>,
      comment: commentFixture,
      commenter: usersFixture[1] as Reference<User>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(true);
    expect(actual.notification.referenceId).toEqual('c1');
    expect(actual.notification.referenceType).toEqual('comment');
    expect(actual.notification.targetUrl).toEqual(
      'http://localhost:5002/posts/p1#c-c1',
    );
    expect(actual.notification.description).toEqual(
      'Complex markdown comment that needs to be simplified',
    );
    expect(actual.avatars).toEqual([
      {
        image: 'https://daily.dev/tsahi.jpg',
        name: 'Tsahi',
        order: 0,
        referenceId: '2',
        targetUrl: 'http://localhost:5002/tsahidaily',
        type: 'user',
      },
    ]);
    expect(actual.attachments.length).toEqual(0);
  });

  it('should generate article_upvote_milestone notification', () => {
    const type = 'article_upvote_milestone';
    const ctx: NotificationPostContext & NotificationUpvotersContext = {
      userId,
      post: postsFixture[0] as Reference<Post>,
      upvotes: 50,
      upvoters: [usersFixture[1], usersFixture[2]] as Reference<User>[],
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(true);
    expect(actual.notification.uniqueKey).toEqual('50');
    expect(actual.notification.referenceId).toEqual('p1');
    expect(actual.notification.referenceType).toEqual('post');
    expect(actual.notification.targetUrl).toEqual(
      'http://localhost:5002/posts/p1',
    );
    expect(actual.avatars).toEqual([
      {
        image: 'https://daily.dev/tsahi.jpg',
        name: 'Tsahi',
        order: 0,
        referenceId: '2',
        targetUrl: 'http://localhost:5002/tsahidaily',
        type: 'user',
      },
      {
        image: 'https://daily.dev/nimrod.jpg',
        name: 'Nimrod',
        order: 1,
        referenceId: '3',
        targetUrl: 'http://localhost:5002/nimroddaily',
        type: 'user',
      },
    ]);
    expect(actual.attachments).toEqual([
      {
        image: 'https://daily.dev/image.jpg',
        order: 0,
        referenceId: 'p1',
        title: 'P1',
        type: 'post',
      },
    ]);
  });

  it('should generate article_report_approved notification', () => {
    const type = 'article_report_approved';
    const ctx: NotificationPostContext = {
      userId,
      post: postsFixture[0] as Reference<Post>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(false);
    expect(actual.notification.referenceId).toEqual('p1');
    expect(actual.notification.referenceType).toEqual('post');
    expect(actual.avatars.length).toEqual(0);
    expect(actual.attachments.length).toEqual(0);
  });

  it('should generate article_analytics notification', () => {
    const type = 'article_analytics';
    const ctx: NotificationPostContext = {
      userId,
      post: postsFixture[0] as Reference<Post>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(false);
    expect(actual.notification.referenceId).toEqual('p1');
    expect(actual.notification.referenceType).toEqual('post');
    expect(actual.avatars.length).toEqual(0);
    expect(actual.attachments.length).toEqual(0);
  });

  it('should generate source_approved notification', () => {
    const type = 'source_approved';
    const ctx: NotificationSourceRequestContext & NotificationSourceContext = {
      userId,
      source: {
        id: 's1',
        name: 'Source',
        image: 'https://daily.dev/s1.jpg',
      } as Reference<Source>,
      sourceRequest: {
        id: 'sr1',
      } as Reference<SourceRequest>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(true);
    expect(actual.notification.referenceId).toEqual('sr1');
    expect(actual.notification.referenceType).toEqual('source_request');
    expect(actual.notification.targetUrl).toEqual(
      'http://localhost:5002/sources/s1',
    );
    expect(actual.avatars).toEqual([
      {
        image: 'https://daily.dev/s1.jpg',
        name: 'Source',
        order: 0,
        referenceId: 's1',
        targetUrl: 'http://localhost:5002/sources/s1',
        type: 'source',
      },
    ]);
  });

  it('should generate source_rejected notification', () => {
    const type = 'source_rejected';
    const ctx: NotificationSourceRequestContext = {
      userId,
      sourceRequest: {
        id: 'sr1',
      } as Reference<SourceRequest>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(false);
    expect(actual.notification.referenceId).toEqual('sr1');
    expect(actual.notification.referenceType).toEqual('source_request');
    expect(actual.avatars.length).toEqual(0);
    expect(actual.attachments.length).toEqual(0);
  });

  it('should generate comment_mention notification', () => {
    const type = 'comment_mention';
    const ctx: NotificationCommenterContext = {
      userId,
      post: postsFixture[0] as Reference<Post>,
      comment: commentFixture,
      commenter: usersFixture[1] as Reference<User>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(true);
    expect(actual.notification.referenceId).toEqual('c1');
    expect(actual.notification.referenceType).toEqual('comment');
    expect(actual.notification.targetUrl).toEqual(
      'http://localhost:5002/posts/p1#c-c1',
    );
    expect(actual.notification.description).toEqual(
      'Complex markdown comment that needs to be simplified',
    );
    expect(actual.avatars).toEqual([
      {
        image: 'https://daily.dev/tsahi.jpg',
        name: 'Tsahi',
        order: 0,
        referenceId: '2',
        targetUrl: 'http://localhost:5002/tsahidaily',
        type: 'user',
      },
    ]);
    expect(actual.attachments.length).toEqual(0);
  });

  //TODO: fix the test once we finalize this notification
  it('should generate comment_reply notification', () => {
    const type = 'comment_reply';
    const ctx: NotificationCommenterContext = {
      userId,
      post: postsFixture[0] as Reference<Post>,
      comment: commentFixture,
      commenter: usersFixture[1] as Reference<User>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
  });

  it('should generate comment_upvote_milestone notification', () => {
    const type = 'comment_upvote_milestone';
    const ctx: NotificationCommentContext & NotificationUpvotersContext = {
      userId,
      post: postsFixture[0] as Reference<Post>,
      comment: commentFixture,
      upvotes: 50,
      upvoters: [usersFixture[1], usersFixture[2]] as Reference<User>[],
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(true);
    expect(actual.notification.uniqueKey).toEqual('50');
    expect(actual.notification.referenceId).toEqual('c1');
    expect(actual.notification.referenceType).toEqual('comment');
    expect(actual.notification.targetUrl).toEqual(
      'http://localhost:5002/posts/p1#c-c1',
    );
    expect(actual.notification.description).toEqual(
      'Complex markdown comment that needs to be simplified',
    );
    expect(actual.avatars).toEqual([
      {
        image: 'https://daily.dev/tsahi.jpg',
        name: 'Tsahi',
        order: 0,
        referenceId: '2',
        targetUrl: 'http://localhost:5002/tsahidaily',
        type: 'user',
      },
      {
        image: 'https://daily.dev/nimrod.jpg',
        name: 'Nimrod',
        order: 1,
        referenceId: '3',
        targetUrl: 'http://localhost:5002/nimroddaily',
        type: 'user',
      },
    ]);
    expect(actual.attachments.length).toEqual(0);
  });
});

describe('storeNotificationBundle', () => {
  beforeEach(async () => {
    await con.getRepository(User).save([usersFixture[0]]);
  });

  it('should save the notification and its children', async () => {
    const ctx: NotificationPostContext & NotificationUpvotersContext = {
      userId,
      post: postsFixture[0] as Reference<Post>,
      upvotes: 50,
      upvoters: [usersFixture[1], usersFixture[2]] as Reference<User>[],
    };
    await con.transaction((manager) =>
      storeNotificationBundle(manager, [
        generateNotification('article_upvote_milestone', ctx),
      ]),
    );
    const notifications = await con.getRepository(Notification).find();
    expect(notifications.length).toEqual(1);
    const attachments = await con.getRepository(NotificationAttachment).find();
    expect(attachments.length).toEqual(1);
    const avatars = await con.getRepository(NotificationAvatar).find();
    expect(avatars.length).toEqual(2);
  });

  it('should ignore duplicates', async () => {
    const ctx: NotificationPostContext & NotificationUpvotersContext = {
      userId,
      post: postsFixture[0] as Reference<Post>,
      upvotes: 50,
      upvoters: [usersFixture[1], usersFixture[2]] as Reference<User>[],
    };
    await con.transaction((manager) =>
      storeNotificationBundle(manager, [
        generateNotification('article_upvote_milestone', ctx),
        generateNotification('article_upvote_milestone', ctx),
      ]),
    );
    const notifications = await con.getRepository(Notification).find();
    expect(notifications.length).toEqual(1);
    const attachments = await con.getRepository(NotificationAttachment).find();
    expect(attachments.length).toEqual(1);
    const avatars = await con.getRepository(NotificationAvatar).find();
    expect(avatars.length).toEqual(2);
  });
});

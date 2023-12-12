import {
  generateNotification,
  NotificationBaseContext,
  NotificationBundle,
  NotificationCommentContext,
  NotificationCommenterContext,
  NotificationDoneByContext,
  NotificationPostContext,
  NotificationSourceContext,
  NotificationSourceMemberRoleContext,
  NotificationSourceRequestContext,
  NotificationSubmissionContext,
  NotificationUpvotersContext,
  Reference,
  storeNotificationBundle,
} from '../../src/notifications';
import { postsFixture } from '../fixture/post';
import {
  Comment,
  FreeformPost,
  Notification,
  NotificationAttachment,
  NotificationAvatar,
  Post,
  PostType,
  Source,
  SourceMember,
  SourceRequest,
  SourceType,
  SquadSource,
  User,
  WelcomePost,
} from '../../src/entity';
import {
  createSquadWelcomePost,
  notificationsLink,
  scoutArticleLink,
} from '../../src/common';
import { usersFixture } from '../fixture/user';
import createOrGetConnection from '../../src/db';
import { DataSource } from 'typeorm';
import { sourcesFixture } from '../fixture/source';
import { SourceMemberRoles } from '../../src/roles';
import { NotificationType } from '../../src/notifications/common';

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
  const verifyPostMention = (actual: NotificationBundle) => {
    const type = 'post_mention';
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
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
    ]);
    expect(actual.attachments.length).toEqual(0);
  };

  it('should generate post_mention notification with mention on title', async () => {
    const type = NotificationType.PostMention;
    const title = `Some title mention @${usersFixture[0].username}`;
    const post = { ...postsFixture[0], title } as Reference<Post>;
    const ctx: NotificationPostContext & NotificationDoneByContext = {
      userIds: [userId],
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
      post,
      doneBy: usersFixture[1] as Reference<User>,
      doneTo: usersFixture[0] as Reference<User>,
    };

    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    verifyPostMention(actual[0]);
    expect(actual[0].notification.description).toEqual(title);
  });

  it('should generate post_mention notification with mention on content', async () => {
    const type = NotificationType.PostMention;
    const title = `Some title without mention `;
    const content = `Some content mention @${usersFixture[0].username}`;
    const post = {
      ...postsFixture[0],
      title,
      content,
    } as Reference<FreeformPost>;
    const ctx: NotificationPostContext & NotificationDoneByContext = {
      userIds: [userId],
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
      post,
      doneBy: usersFixture[1] as Reference<User>,
      doneTo: usersFixture[0] as Reference<User>,
    };

    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    verifyPostMention(actual[0]);
    expect(actual[0].notification.description).toEqual(content);
  });

  it('should generate community_picks_failed notification', () => {
    const type = NotificationType.CommunityPicksFailed;
    const ctx: NotificationSubmissionContext = {
      userIds: [userId],
      submission: { id: 's1' },
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(false);
    expect(actual[0].notification.referenceId).toEqual('s1');
    expect(actual[0].notification.referenceType).toEqual('submission');
    expect(actual[0].avatars.length).toEqual(0);
    expect(actual[0].attachments.length).toEqual(0);
  });

  it('should generate community_picks_succeeded notification', () => {
    const type = NotificationType.CommunityPicksSucceeded;
    const ctx: NotificationSubmissionContext & NotificationPostContext = {
      userIds: [userId],
      submission: { id: 's1' },
      source: sourcesFixture[0] as Reference<Source>,
      post: postsFixture[0] as Reference<Post>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual('p1');
    expect(actual[0].notification.referenceType).toEqual('post');
    expect(actual[0].notification.targetUrl).toEqual(
      'http://localhost:5002/posts/p1',
    );
    expect(actual[0].avatars.length).toEqual(0);
    expect(actual[0].attachments).toEqual([
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
    const type = NotificationType.CommunityPicksGranted;
    const ctx: NotificationBaseContext = { userIds: [userId] };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual('system');
    expect(actual[0].notification.referenceType).toEqual('system');
    expect(actual[0].notification.targetUrl).toEqual(scoutArticleLink);
    expect(actual[0].avatars.length).toEqual(0);
    expect(actual[0].attachments.length).toEqual(0);
  });

  it('should generate article_picked notification', () => {
    const type = NotificationType.ArticlePicked;
    const ctx: NotificationPostContext = {
      userIds: [userId],
      source: sourcesFixture[0] as Reference<Source>,
      post: postsFixture[0] as Reference<Post>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual('p1');
    expect(actual[0].notification.referenceType).toEqual('post');
    expect(actual[0].notification.targetUrl).toEqual(
      'http://localhost:5002/posts/p1',
    );
    expect(actual[0].avatars.length).toEqual(0);
    expect(actual[0].attachments).toEqual([
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
    const type = NotificationType.ArticleNewComment;
    const ctx: NotificationCommenterContext = {
      userIds: [userId],
      source: sourcesFixture[0] as Reference<Source>,
      post: postsFixture[0] as Reference<Post>,
      comment: commentFixture,
      commenter: usersFixture[1] as Reference<User>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual('c1');
    expect(actual[0].notification.referenceType).toEqual('comment');
    expect(actual[0].notification.targetUrl).toEqual(
      'http://localhost:5002/posts/p1#c-c1',
    );
    expect(actual[0].notification.description).toEqual(
      'Complex markdown comment that needs to be simplified',
    );
    expect(actual[0].avatars).toEqual([
      {
        image: 'https://daily.dev/tsahi.jpg',
        name: 'Tsahi',
        order: 0,
        referenceId: '2',
        targetUrl: 'http://localhost:5002/tsahidaily',
        type: 'user',
      },
    ]);
    expect(actual[0].attachments.length).toEqual(0);
  });

  it('should generate article_upvote_milestone notification', () => {
    const type = NotificationType.ArticleUpvoteMilestone;
    const ctx: NotificationPostContext & NotificationUpvotersContext = {
      userIds: [userId],
      source: sourcesFixture[0] as Reference<Source>,
      post: postsFixture[0] as Reference<Post>,
      upvotes: 50,
      upvoters: [usersFixture[1], usersFixture[2]] as Reference<User>[],
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.uniqueKey).toEqual('50');
    expect(actual[0].notification.referenceId).toEqual('p1');
    expect(actual[0].notification.referenceType).toEqual('post');
    expect(actual[0].notification.targetUrl).toEqual(
      'http://localhost:5002/posts/p1',
    );
    expect(actual[0].avatars).toEqual([
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
    expect(actual[0].attachments).toEqual([
      {
        image: 'https://daily.dev/image.jpg',
        order: 0,
        referenceId: 'p1',
        title: 'P1',
        type: 'post',
      },
    ]);
  });

  it('should add source avatar to article_upvote_milestone when it is a squad post', () => {
    const type = NotificationType.ArticleUpvoteMilestone;
    const ctx: NotificationPostContext & NotificationUpvotersContext = {
      userIds: [userId],
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
      post: postsFixture[0] as Reference<Post>,
      upvotes: 50,
      upvoters: [usersFixture[1], usersFixture[2]] as Reference<User>[],
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].avatars).toEqual([
      {
        image: 'http://image.com/a',
        name: 'A',
        order: 0,
        referenceId: 'a',
        targetUrl: 'http://localhost:5002/squads/a',
        type: 'source',
      },
      {
        image: 'https://daily.dev/tsahi.jpg',
        name: 'Tsahi',
        order: 1,
        referenceId: '2',
        targetUrl: 'http://localhost:5002/tsahidaily',
        type: 'user',
      },
      {
        image: 'https://daily.dev/nimrod.jpg',
        name: 'Nimrod',
        order: 2,
        referenceId: '3',
        targetUrl: 'http://localhost:5002/nimroddaily',
        type: 'user',
      },
    ]);
  });

  it('should generate article_report_approved notification', () => {
    const type = NotificationType.ArticleReportApproved;
    const ctx: NotificationPostContext = {
      userIds: [userId],
      source: sourcesFixture[0] as Reference<Source>,
      post: postsFixture[0] as Reference<Post>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(false);
    expect(actual[0].notification.referenceId).toEqual('p1');
    expect(actual[0].notification.referenceType).toEqual('post');
    expect(actual[0].avatars.length).toEqual(0);
    expect(actual[0].attachments.length).toEqual(0);
  });

  it('should generate article_analytics notification', () => {
    const type = NotificationType.ArticleAnalytics;
    const ctx: NotificationPostContext = {
      userIds: [userId],
      source: sourcesFixture[0] as Reference<Source>,
      post: postsFixture[0] as Reference<Post>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(false);
    expect(actual[0].notification.referenceId).toEqual('p1');
    expect(actual[0].notification.referenceType).toEqual('post');
    expect(actual[0].avatars.length).toEqual(0);
    expect(actual[0].attachments.length).toEqual(0);
  });

  it('should generate source_approved notification', () => {
    const type = NotificationType.SourceApproved;
    const ctx: NotificationSourceRequestContext & NotificationSourceContext = {
      userIds: [userId],
      source: {
        id: 's1',
        name: 'Source',
        image: 'https://daily.dev/s1.jpg',
        handle: 's1',
      } as Reference<Source>,
      sourceRequest: {
        id: 'sr1',
      } as Reference<SourceRequest>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual('sr1');
    expect(actual[0].notification.referenceType).toEqual('source_request');
    expect(actual[0].notification.targetUrl).toEqual(
      'http://localhost:5002/sources/s1',
    );
    expect(actual[0].avatars).toEqual([
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
    const type = NotificationType.SourceRejected;
    const ctx: NotificationSourceRequestContext = {
      userIds: [userId],
      sourceRequest: {
        id: 'sr1',
      } as Reference<SourceRequest>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(false);
    expect(actual[0].notification.referenceId).toEqual('sr1');
    expect(actual[0].notification.referenceType).toEqual('source_request');
    expect(actual[0].avatars.length).toEqual(0);
    expect(actual[0].attachments.length).toEqual(0);
  });

  it('should generate comment_mention notification', () => {
    const type = NotificationType.CommentMention;
    const ctx: NotificationCommenterContext = {
      userIds: [userId],
      source: sourcesFixture[0] as Reference<Source>,
      post: postsFixture[0] as Reference<Post>,
      comment: commentFixture,
      commenter: usersFixture[1] as Reference<User>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual('c1');
    expect(actual[0].notification.referenceType).toEqual('comment');
    expect(actual[0].notification.targetUrl).toEqual(
      'http://localhost:5002/posts/p1#c-c1',
    );
    expect(actual[0].notification.description).toEqual(
      'Complex markdown comment that needs to be simplified',
    );
    expect(actual[0].avatars).toEqual([
      {
        image: 'https://daily.dev/tsahi.jpg',
        name: 'Tsahi',
        order: 0,
        referenceId: '2',
        targetUrl: 'http://localhost:5002/tsahidaily',
        type: 'user',
      },
    ]);
    expect(actual[0].attachments.length).toEqual(0);
  });

  it('should generate comment_reply notification', () => {
    const type = NotificationType.CommentReply;
    const ctx: NotificationCommenterContext = {
      userIds: [userId],
      source: sourcesFixture[0] as Reference<Source>,
      post: postsFixture[0] as Reference<Post>,
      comment: commentFixture,
      commenter: usersFixture[1] as Reference<User>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual('c1');
    expect(actual[0].notification.referenceType).toEqual('comment');
    expect(actual[0].notification.targetUrl).toEqual(
      'http://localhost:5002/posts/p1#c-c1',
    );
    expect(actual[0].notification.description).toEqual(
      'Complex markdown comment that needs to be simplified',
    );
    expect(actual[0].avatars).toEqual([
      {
        image: 'https://daily.dev/tsahi.jpg',
        name: 'Tsahi',
        order: 0,
        referenceId: '2',
        targetUrl: 'http://localhost:5002/tsahidaily',
        type: 'user',
      },
    ]);
    expect(actual[0].attachments.length).toEqual(0);
  });

  it('should generate comment_upvote_milestone notification', () => {
    const type = NotificationType.CommentUpvoteMilestone;
    const ctx: NotificationCommentContext & NotificationUpvotersContext = {
      userIds: [userId],
      source: sourcesFixture[0] as Reference<Source>,
      post: postsFixture[0] as Reference<Post>,
      comment: commentFixture,
      upvotes: 50,
      upvoters: [usersFixture[1], usersFixture[2]] as Reference<User>[],
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.uniqueKey).toEqual('50');
    expect(actual[0].notification.referenceId).toEqual('c1');
    expect(actual[0].notification.referenceType).toEqual('comment');
    expect(actual[0].notification.targetUrl).toEqual(
      'http://localhost:5002/posts/p1#c-c1',
    );
    expect(actual[0].notification.description).toEqual(
      'Complex markdown comment that needs to be simplified',
    );
    expect(actual[0].avatars).toEqual([
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
    expect(actual[0].attachments.length).toEqual(0);
  });

  it('should generate squad_post_added notification', () => {
    const type = NotificationType.SquadPostAdded;
    const ctx: NotificationPostContext & NotificationDoneByContext = {
      userIds: [userId],
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
      post: postsFixture[0] as Reference<Post>,
      doneBy: usersFixture[1] as Reference<User>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual('p1');
    expect(actual[0].notification.referenceType).toEqual('post');
    expect(actual[0].notification.description).toBeFalsy();
    expect(actual[0].notification.targetUrl).toEqual(
      'http://localhost:5002/posts/p1',
    );
    expect(actual[0].avatars).toEqual([
      {
        image: 'http://image.com/a',
        name: 'A',
        order: 0,
        referenceId: 'a',
        targetUrl: 'http://localhost:5002/squads/a',
        type: 'source',
      },
      {
        image: 'https://daily.dev/tsahi.jpg',
        name: 'Tsahi',
        order: 1,
        referenceId: '2',
        targetUrl: 'http://localhost:5002/tsahidaily',
        type: 'user',
      },
    ]);
    expect(actual[0].attachments).toEqual([
      {
        image: 'https://daily.dev/image.jpg',
        order: 0,
        referenceId: 'p1',
        title: 'P1',
        type: 'post',
      },
    ]);
  });

  it('should set attachment as shared post on squad_post_added notification', () => {
    const type = NotificationType.SquadPostAdded;
    const ctx: NotificationPostContext & NotificationDoneByContext = {
      userIds: [userId],
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
      post: {
        id: 'ps',
        title: 'Commentary',
        sourceId: 'a',
        type: PostType.Share,
      } as Reference<Post>,
      sharedPost: postsFixture[0] as Reference<Post>,
      doneBy: usersFixture[1] as Reference<User>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual('ps');
    expect(actual[0].notification.referenceType).toEqual('post');
    expect(actual[0].notification.description).toEqual('Commentary');
    expect(actual[0].notification.targetUrl).toEqual(
      'http://localhost:5002/posts/ps',
    );
    expect(actual[0].avatars).toEqual([
      {
        image: 'http://image.com/a',
        name: 'A',
        order: 0,
        referenceId: 'a',
        targetUrl: 'http://localhost:5002/squads/a',
        type: 'source',
      },
      {
        image: 'https://daily.dev/tsahi.jpg',
        name: 'Tsahi',
        order: 1,
        referenceId: '2',
        targetUrl: 'http://localhost:5002/tsahidaily',
        type: 'user',
      },
    ]);
    expect(actual[0].attachments).toEqual([
      {
        image: 'https://daily.dev/image.jpg',
        order: 0,
        referenceId: 'p1',
        title: 'P1',
        type: 'post',
      },
    ]);
  });

  it('should generate squad_post_viewed notification', () => {
    const type = NotificationType.SquadPostViewed;
    const ctx: NotificationPostContext & NotificationDoneByContext = {
      userIds: [userId],
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
      post: {
        id: 'ps',
        title: 'Commentary',
        sourceId: 'a',
        type: PostType.Share,
      } as Reference<Post>,
      sharedPost: postsFixture[0] as Reference<Post>,
      doneBy: usersFixture[1] as Reference<User>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual('ps');
    expect(actual[0].notification.referenceType).toEqual('post');
    expect(actual[0].notification.description).toEqual('Commentary');
    expect(actual[0].notification.uniqueKey).toEqual('2');
    expect(actual[0].notification.targetUrl).toEqual(
      'http://localhost:5002/posts/ps',
    );
    expect(actual[0].avatars).toEqual([
      {
        image: 'http://image.com/a',
        name: 'A',
        order: 0,
        referenceId: 'a',
        targetUrl: 'http://localhost:5002/squads/a',
        type: 'source',
      },
      {
        image: 'https://daily.dev/tsahi.jpg',
        name: 'Tsahi',
        order: 1,
        referenceId: '2',
        targetUrl: 'http://localhost:5002/tsahidaily',
        type: 'user',
      },
    ]);
    expect(actual[0].attachments).toEqual([
      {
        image: 'https://daily.dev/image.jpg',
        order: 0,
        referenceId: 'p1',
        title: 'P1',
        type: 'post',
      },
    ]);
  });

  it('should generate squad_member_joined notification', async () => {
    const type = NotificationType.SquadMemberJoined;
    await con.getRepository(Source).save(sourcesFixture[0]);
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    const source = await con.getRepository(Source).findOneBy({ id: 'a' });
    await con.getRepository(User).save(usersFixture);
    await con.getRepository(SourceMember).save({
      sourceId: 'a',
      userId: '1',
      role: SourceMemberRoles.Admin,
      referralToken: 'random',
    });
    const post = await createSquadWelcomePost(con, source as SquadSource, '1');
    await con
      .getRepository(WelcomePost)
      .update({ id: post.id }, { id: 'welcome1' });
    post.id = 'welcome1'; // for a consistent id in the test
    const ctx: NotificationPostContext & NotificationDoneByContext = {
      userIds: [userId],
      post,
      source,
      doneBy: usersFixture[1] as Reference<User>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual(post.id);
    expect(actual[0].notification.referenceType).toEqual('post');
    expect(actual[0].notification.uniqueKey).toEqual('2');
    expect(actual[0].notification.targetUrl).toEqual(
      'http://localhost:5002/posts/welcome1?comment=%40tsahidaily+welcome+to+A%21',
    );
    expect(actual[0].avatars).toEqual([
      {
        image: 'http://image.com/a',
        name: 'A',
        order: 0,
        referenceId: 'a',
        targetUrl: 'http://localhost:5002/squads/a',
        type: 'source',
      },
      {
        image: 'https://daily.dev/tsahi.jpg',
        name: 'Tsahi',
        order: 1,
        referenceId: '2',
        targetUrl: 'http://localhost:5002/tsahidaily',
        type: 'user',
      },
    ]);
    expect(actual[0].attachments.length).toEqual(0);
  });

  it('should generate squad_blocked notification', () => {
    const type = NotificationType.SquadBlocked;
    const ctx: NotificationSourceContext = {
      userIds: [userId],
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual('a');
    expect(actual[0].notification.referenceType).toEqual('source');
    expect(actual[0].notification.icon).toEqual('Block');
    expect(actual[0].notification.title).toEqual(
      `You are no longer part of <b>${sourcesFixture[0].name}</b>`,
    );
  });

  it('should generate promoted_to_admin notification', () => {
    const type = NotificationType.PromotedToAdmin;
    const ctx: NotificationSourceMemberRoleContext = {
      userIds: [userId],
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
      role: SourceMemberRoles.Admin,
    };
    const url = new URL(notificationsLink);
    url.searchParams.set('promoted', 'true');
    url.searchParams.set('sid', sourcesFixture[0].handle);

    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual('a');
    expect(actual[0].notification.referenceType).toEqual('source');
    expect(actual[0].notification.icon).toEqual('Star');
    expect(actual[0].notification.title).toEqual(
      `Congratulations! You are now an <span class="text-theme-color-cabbage">${SourceMemberRoles.Admin}</span> of <b>${sourcesFixture[0].name}</b>`,
    );
    expect(actual[0].notification.targetUrl).toEqual(url.toString());
  });

  it('should generate demoted_to_member notification', () => {
    const type = NotificationType.DemotedToMember;
    const ctx: NotificationSourceMemberRoleContext = {
      userIds: [userId],
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
      role: SourceMemberRoles.Admin,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual('a');
    expect(actual[0].notification.referenceType).toEqual('source');
    expect(actual[0].notification.icon).toEqual('Star');
    expect(actual[0].notification.title).toEqual(
      `You are no longer a <span class="text-theme-color-cabbage">${SourceMemberRoles.Admin}</span> in <b>${sourcesFixture[0].name}</b>`,
    );
    expect(actual[0].notification.targetUrl).toEqual(
      'http://localhost:5002/squads/a',
    );
  });

  it('should generate promoted_to_moderator notification', () => {
    const type = NotificationType.PromotedToModerator;
    const ctx: NotificationSourceContext = {
      userIds: [userId],
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
    };
    const url = new URL(notificationsLink);
    url.searchParams.set('promoted', 'true');
    url.searchParams.set('sid', sourcesFixture[0].handle);
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual('a');
    expect(actual[0].notification.referenceType).toEqual('source');
    expect(actual[0].notification.icon).toEqual('User');
    expect(actual[0].notification.title).toEqual(
      `You are now a <span class="text-theme-color-cabbage">moderator</span> in <b>${sourcesFixture[0].name}</b>`,
    );
    expect(actual[0].notification.targetUrl).toEqual(url.toString());
  });
});

describe('storeNotificationBundle', () => {
  beforeEach(async () => {
    await con.getRepository(User).save([usersFixture[0]]);
  });

  it('should save the notification and its children', async () => {
    const ctx: NotificationPostContext & NotificationUpvotersContext = {
      userIds: [userId],
      source: sourcesFixture[0] as Reference<Source>,
      post: postsFixture[0] as Reference<Post>,
      upvotes: 50,
      upvoters: [usersFixture[1], usersFixture[2]] as Reference<User>[],
    };
    await con.transaction((manager) =>
      storeNotificationBundle(
        manager,
        generateNotification(NotificationType.ArticleUpvoteMilestone, ctx),
      ),
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
      userIds: [userId],
      source: sourcesFixture[0] as Reference<Source>,
      post: postsFixture[0] as Reference<Post>,
      upvotes: 50,
      upvoters: [usersFixture[1], usersFixture[2]] as Reference<User>[],
    };
    await con.transaction((manager) =>
      storeNotificationBundle(manager, [
        ...generateNotification(NotificationType.ArticleUpvoteMilestone, ctx),
        ...generateNotification(NotificationType.ArticleUpvoteMilestone, ctx),
      ]),
    );
    const notifications = await con.getRepository(Notification).find();
    expect(notifications.length).toEqual(1);
    const attachments = await con.getRepository(NotificationAttachment).find();
    expect(attachments.length).toEqual(1);
    const avatars = await con.getRepository(NotificationAvatar).find();
    expect(avatars.length).toEqual(2);
  });

  it('should generate squad_new_comment notification', () => {
    const type = NotificationType.SquadNewComment;
    const ctx: NotificationCommenterContext = {
      userIds: [userId],
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
      post: postsFixture[0] as Reference<Post>,
      comment: commentFixture,
      commenter: usersFixture[1] as Reference<User>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual('c1');
    expect(actual[0].notification.referenceType).toEqual('comment');
    expect(actual[0].notification.targetUrl).toEqual(
      'http://localhost:5002/posts/p1#c-c1',
    );
    expect(actual[0].notification.description).toEqual(
      'Complex markdown comment that needs to be simplified',
    );
    expect(actual[0].avatars).toEqual([
      {
        image: 'http://image.com/a',
        name: 'A',
        order: 0,
        referenceId: 'a',
        targetUrl: 'http://localhost:5002/squads/a',
        type: 'source',
      },
      {
        image: 'https://daily.dev/tsahi.jpg',
        name: 'Tsahi',
        order: 1,
        referenceId: '2',
        targetUrl: 'http://localhost:5002/tsahidaily',
        type: 'user',
      },
    ]);
    expect(actual[0].attachments.length).toEqual(0);
  });

  it('should generate squad_reply notification', () => {
    const type = NotificationType.SquadReply;
    const ctx: NotificationCommenterContext = {
      userIds: [userId],
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
      post: postsFixture[0] as Reference<Post>,
      comment: commentFixture,
      commenter: usersFixture[1] as Reference<User>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual('c1');
    expect(actual[0].notification.referenceType).toEqual('comment');
    expect(actual[0].notification.targetUrl).toEqual(
      'http://localhost:5002/posts/p1#c-c1',
    );
    expect(actual[0].notification.description).toEqual(
      'Complex markdown comment that needs to be simplified',
    );
    expect(actual[0].avatars).toEqual([
      {
        image: 'http://image.com/a',
        name: 'A',
        order: 0,
        referenceId: 'a',
        targetUrl: 'http://localhost:5002/squads/a',
        type: 'source',
      },
      {
        image: 'https://daily.dev/tsahi.jpg',
        name: 'Tsahi',
        order: 1,
        referenceId: '2',
        targetUrl: 'http://localhost:5002/tsahidaily',
        type: 'user',
      },
    ]);
    expect(actual[0].attachments.length).toEqual(0);
  });

  it('should generate squad_access notification', () => {
    const type = NotificationType.SquadAccess;
    const ctx: NotificationBaseContext = {
      userIds: [userId],
    };
    const actual = generateNotification(type, ctx);
    expect(actual.length).toEqual(1);
    expect(actual[0].notification.type).toEqual(type);
    expect(actual[0].notification.userId).toEqual(userId);
    expect(actual[0].notification.public).toEqual(true);
    expect(actual[0].notification.referenceId).toEqual('system');
    expect(actual[0].notification.referenceType).toEqual('system');
    expect(actual[0].notification.targetUrl).toEqual(
      `${process.env.COMMENTS_PREFIX}?squad=true`,
    );
    expect(actual[0].notification.description).toEqual('Create your new Squad');
    expect(actual[0].attachments.length).toEqual(0);
  });
});

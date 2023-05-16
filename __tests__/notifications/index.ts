import {
  generateNotification,
  NotificationBaseContext,
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
import { createSquadWelcomePost, scoutArticleLink } from '../../src/common';
import { usersFixture } from '../fixture/user';
import createOrGetConnection from '../../src/db';
import { DataSource } from 'typeorm';
import { sourcesFixture } from '../fixture/source';
import { SourceMemberRoles } from '../../src/roles';

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
      source: sourcesFixture[0] as Reference<Source>,
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
      source: sourcesFixture[0] as Reference<Source>,
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
      source: sourcesFixture[0] as Reference<Source>,
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
      source: sourcesFixture[0] as Reference<Source>,
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

  it('should add source avatar to article_upvote_milestone when it is a squad post', () => {
    const type = 'article_upvote_milestone';
    const ctx: NotificationPostContext & NotificationUpvotersContext = {
      userId,
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
      post: postsFixture[0] as Reference<Post>,
      upvotes: 50,
      upvoters: [usersFixture[1], usersFixture[2]] as Reference<User>[],
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.avatars).toEqual([
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
    const type = 'article_report_approved';
    const ctx: NotificationPostContext = {
      userId,
      source: sourcesFixture[0] as Reference<Source>,
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
      source: sourcesFixture[0] as Reference<Source>,
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
        handle: 's1',
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
      source: sourcesFixture[0] as Reference<Source>,
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

  it('should generate comment_reply notification', () => {
    const type = 'comment_reply';
    const ctx: NotificationCommenterContext = {
      userId,
      source: sourcesFixture[0] as Reference<Source>,
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

  it('should generate comment_upvote_milestone notification', () => {
    const type = 'comment_upvote_milestone';
    const ctx: NotificationCommentContext & NotificationUpvotersContext = {
      userId,
      source: sourcesFixture[0] as Reference<Source>,
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

  it('should generate squad_post_added notification', () => {
    const type = 'squad_post_added';
    const ctx: NotificationPostContext & NotificationDoneByContext = {
      userId,
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
      post: postsFixture[0] as Reference<Post>,
      doneBy: usersFixture[1] as Reference<User>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(true);
    expect(actual.notification.referenceId).toEqual('p1');
    expect(actual.notification.referenceType).toEqual('post');
    expect(actual.notification.description).toBeFalsy();
    expect(actual.notification.targetUrl).toEqual(
      'http://localhost:5002/posts/p1',
    );
    expect(actual.avatars).toEqual([
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

  it('should set attachment as shared post on squad_post_added notification', () => {
    const type = 'squad_post_added';
    const ctx: NotificationPostContext & NotificationDoneByContext = {
      userId,
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
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(true);
    expect(actual.notification.referenceId).toEqual('ps');
    expect(actual.notification.referenceType).toEqual('post');
    expect(actual.notification.description).toEqual('Commentary');
    expect(actual.notification.targetUrl).toEqual(
      'http://localhost:5002/posts/ps',
    );
    expect(actual.avatars).toEqual([
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

  it('should generate squad_post_viewed notification', () => {
    const type = 'squad_post_viewed';
    const ctx: NotificationPostContext & NotificationDoneByContext = {
      userId,
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
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(true);
    expect(actual.notification.referenceId).toEqual('ps');
    expect(actual.notification.referenceType).toEqual('post');
    expect(actual.notification.description).toEqual('Commentary');
    expect(actual.notification.uniqueKey).toEqual('2');
    expect(actual.notification.targetUrl).toEqual(
      'http://localhost:5002/posts/ps',
    );
    expect(actual.avatars).toEqual([
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

  it('should generate squad_member_joined notification', async () => {
    const type = 'squad_member_joined';
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
      userId,
      post,
      source,
      doneBy: usersFixture[1] as Reference<User>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(true);
    expect(actual.notification.referenceId).toEqual(post.id);
    expect(actual.notification.referenceType).toEqual('post');
    expect(actual.notification.uniqueKey).toEqual('2');
    expect(actual.notification.targetUrl).toEqual(
      'http://localhost:5002/posts/welcome1?comment=%40tsahidaily+welcome+to+A%21',
    );
    expect(actual.avatars).toEqual([
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
    expect(actual.attachments.length).toEqual(0);
  });

  it('should generate squad_blocked notification', () => {
    const type = 'squad_blocked';
    const ctx: NotificationSourceContext = {
      userId,
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(true);
    expect(actual.notification.referenceId).toEqual('a');
    expect(actual.notification.referenceType).toEqual('source');
    expect(actual.notification.icon).toEqual('Block');
    expect(actual.notification.title).toEqual(
      `You are no longer part of <b>${sourcesFixture[0].name}</b>`,
    );
  });

  it('should generate promoted_to_admin notification', () => {
    const type = 'promoted_to_admin';
    const ctx: NotificationSourceMemberRoleContext = {
      userId,
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
      role: SourceMemberRoles.Admin,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(true);
    expect(actual.notification.referenceId).toEqual('a');
    expect(actual.notification.referenceType).toEqual('source');
    expect(actual.notification.icon).toEqual('Star');
    expect(actual.notification.title).toEqual(
      `Congratulations! You are now an <span class="text-theme-color-cabbage">${SourceMemberRoles.Admin}</span> of <b>${sourcesFixture[0].name}</b>`,
    );
    expect(actual.notification.targetUrl).toEqual(
      'http://localhost:5002/squads/a',
    );
  });

  it('should generate demoted_to_member notification', () => {
    const type = 'demoted_to_member';
    const ctx: NotificationSourceMemberRoleContext = {
      userId,
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
      role: SourceMemberRoles.Admin,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(true);
    expect(actual.notification.referenceId).toEqual('a');
    expect(actual.notification.referenceType).toEqual('source');
    expect(actual.notification.icon).toEqual('Star');
    expect(actual.notification.title).toEqual(
      `You are no longer a <span class="text-theme-color-cabbage">${SourceMemberRoles.Admin}</span> in <b>${sourcesFixture[0].name}</b>`,
    );
    expect(actual.notification.targetUrl).toEqual(
      'http://localhost:5002/squads/a',
    );
  });

  it('should generate promoted_to_moderator notification', () => {
    const type = 'promoted_to_moderator';
    const ctx: NotificationSourceContext = {
      userId,
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(true);
    expect(actual.notification.referenceId).toEqual('a');
    expect(actual.notification.referenceType).toEqual('source');
    expect(actual.notification.icon).toEqual('User');
    expect(actual.notification.title).toEqual(
      `You are now a <span class="text-theme-color-cabbage">moderator</span> in <b>${sourcesFixture[0].name}</b>`,
    );
    expect(actual.notification.targetUrl).toEqual(
      'http://localhost:5002/squads/a',
    );
  });
});

describe('storeNotificationBundle', () => {
  beforeEach(async () => {
    await con.getRepository(User).save([usersFixture[0]]);
  });

  it('should save the notification and its children', async () => {
    const ctx: NotificationPostContext & NotificationUpvotersContext = {
      userId,
      source: sourcesFixture[0] as Reference<Source>,
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
      source: sourcesFixture[0] as Reference<Source>,
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

  it('should generate squad_new_comment notification', () => {
    const type = 'squad_new_comment';
    const ctx: NotificationCommenterContext = {
      userId,
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
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
    expect(actual.attachments.length).toEqual(0);
  });

  it('should generate squad_reply notification', () => {
    const type = 'squad_reply';
    const ctx: NotificationCommenterContext = {
      userId,
      source: {
        ...sourcesFixture[0],
        type: SourceType.Squad,
      } as Reference<Source>,
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
    expect(actual.attachments.length).toEqual(0);
  });

  it('should generate squad_access notification', () => {
    const type = 'squad_access';
    const ctx: NotificationBaseContext = {
      userId,
    };
    const actual = generateNotification(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.notification.userId).toEqual(userId);
    expect(actual.notification.public).toEqual(true);
    expect(actual.notification.referenceId).toEqual('system');
    expect(actual.notification.referenceType).toEqual('system');
    expect(actual.notification.targetUrl).toEqual(
      `${process.env.COMMENTS_PREFIX}?squad=true`,
    );
    expect(actual.notification.description).toEqual('Create your new Squad');
    expect(actual.attachments.length).toEqual(0);
  });
});

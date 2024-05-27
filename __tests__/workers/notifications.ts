import { invokeNotificationWorker } from '../helpers';
import {
  Comment,
  MachineSource,
  NotificationPreferenceComment,
  NotificationPreferencePost,
  NotificationPreferenceSource,
  Post,
  PostReport,
  PostType,
  Source,
  SourceMember,
  SourceType,
  SquadSource,
  SubmissionStatus,
  User,
  UserAction,
  UserActionType,
  UserPost,
} from '../../src/entity';
import { SourceMemberRoles } from '../../src/roles';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { usersFixture } from '../fixture/user';
import { postsFixture } from '../fixture/post';
import { sourcesFixture } from '../fixture/source';
import {
  NotificationCommentContext,
  NotificationCommenterContext,
  NotificationDoneByContext,
  NotificationPostContext,
  NotificationSourceContext,
  NotificationSourceRequestContext,
  NotificationUpvotersContext,
} from '../../src/notifications';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../../src/notifications/common';
import { createSquadWelcomePost, NotificationReason } from '../../src/common';
import { randomUUID } from 'crypto';
import { UserVote } from '../../src/types';
import { UserComment } from '../../src/entity/user/UserComment';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await con.getRepository(User).save(usersFixture);
  await con.getRepository(MachineSource).save(sourcesFixture);
  await con.getRepository(Post).save([postsFixture[0], postsFixture[1]]);
  await con.getRepository(Comment).save([
    {
      id: 'c1',
      postId: 'p1',
      userId: '2',
      content: 'comment',
      contentHtml: '<p>comment</p>',
    },
  ]);
  await con
    .getRepository(UserAction)
    .save({ userId: '1', type: UserActionType.SquadFirstPost });
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
    userIds: ['1'],
    submission: {
      id: 'sr1',
      url: 'http://sample.abc.com',
      userId: '1',
      createdAt: 1601187916999999,
      status: SubmissionStatus.Rejected,
    },
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
    userIds: ['1'],
  });
});

it('should add devcard unlocked notification if user has reached the reputation threshold', async () => {
  const worker = await import(
    '../../src/workers/notifications/devCardUnlocked'
  );
  const actual = await invokeNotificationWorker(worker.default, {
    user: {
      id: '1',
      reputation: 10,
    },
    userAfter: {
      id: '1',
      reputation: 21,
    },
  });
  expect(actual.length).toEqual(1);
  expect(actual[0].type).toEqual('dev_card_unlocked');
  expect(actual[0].ctx).toEqual({
    userIds: ['1'],
  });
});

it('should NOT add devcard unlocked notification if user has NOT reached the reputation threshold', async () => {
  const worker = await import(
    '../../src/workers/notifications/devCardUnlocked'
  );
  const actual = await invokeNotificationWorker(worker.default, {
    user: {
      id: '1',
      reputation: 10,
    },
    userAfter: {
      id: '1',
      reputation: 15,
    },
  });
  expect(actual).toEqual(null);
});

it('should NOT add devcard unlocked notification if user had already reached the dev card threshold', async () => {
  const worker = await import(
    '../../src/workers/notifications/devCardUnlocked'
  );
  const actual = await invokeNotificationWorker(worker.default, {
    user: {
      id: '1',
      reputation: 30,
    },
    userAfter: {
      id: '1',
      reputation: 40,
    },
  });
  expect(actual).toEqual(null);
});

describe('source member role changed', () => {
  const baseMember = {
    userId: '1',
    sourceId: 'squad',
    referralToken: 'rt1',
  };

  it('should add blocked notification', async () => {
    const worker = await import(
      '../../src/workers/notifications/sourceMemberRoleChanged'
    );
    const actual = await invokeNotificationWorker(worker.default, {
      previousRole: SourceMemberRoles.Member,
      sourceMember: { ...baseMember, role: SourceMemberRoles.Blocked },
    });
    const source = await con.getRepository(Source).findOneBy({ id: 'squad' });
    expect(actual.length).toEqual(1);
    expect(actual[0].type).toEqual('squad_blocked');
    expect(actual[0].ctx).toEqual({ userIds: ['1'], source });
  });
  it('should add member to moderator notification', async () => {
    const worker = await import(
      '../../src/workers/notifications/sourceMemberRoleChanged'
    );
    const actual = await invokeNotificationWorker(worker.default, {
      previousRole: SourceMemberRoles.Member,
      sourceMember: { ...baseMember, role: SourceMemberRoles.Moderator },
    });
    const source = await con.getRepository(Source).findOneBy({ id: 'squad' });

    expect(actual.length).toEqual(1);
    expect(actual[0].type).toEqual('promoted_to_moderator');
    expect(actual[0].ctx).toEqual({ userIds: ['1'], source });
  });
  it('should add member to admin notification', async () => {
    const worker = await import(
      '../../src/workers/notifications/sourceMemberRoleChanged'
    );
    const actual = await invokeNotificationWorker(worker.default, {
      previousRole: SourceMemberRoles.Member,
      sourceMember: { ...baseMember, role: SourceMemberRoles.Admin },
    });
    const source = await con.getRepository(Source).findOneBy({ id: 'squad' });

    expect(actual.length).toEqual(1);
    expect(actual[0].type).toEqual('promoted_to_admin');
    expect(actual[0].ctx).toEqual({
      userIds: ['1'],
      source,
    });
  });
  it('should add moderator to member notification', async () => {
    const worker = await import(
      '../../src/workers/notifications/sourceMemberRoleChanged'
    );
    const actual = await invokeNotificationWorker(worker.default, {
      previousRole: SourceMemberRoles.Moderator,
      sourceMember: { ...baseMember, role: SourceMemberRoles.Member },
    });
    const source = await con.getRepository(Source).findOneBy({ id: 'squad' });

    expect(actual.length).toEqual(1);
    expect(actual[0].type).toEqual('demoted_to_member');
    expect(actual[0].ctx).toEqual({
      userIds: ['1'],
      role: SourceMemberRoles.Moderator,
      source,
    });
  });
  it('should add moderator to admin notification', async () => {
    const worker = await import(
      '../../src/workers/notifications/sourceMemberRoleChanged'
    );
    const actual = await invokeNotificationWorker(worker.default, {
      previousRole: SourceMemberRoles.Moderator,
      sourceMember: { ...baseMember, role: SourceMemberRoles.Admin },
    });
    const source = await con.getRepository(Source).findOneBy({ id: 'squad' });
    expect(actual.length).toEqual(1);
    expect(actual[0].type).toEqual('promoted_to_admin');
    expect(actual[0].ctx).toEqual({
      userIds: ['1'],
      source,
    });
  });
  it('should add admin to member notification', async () => {
    const worker = await import(
      '../../src/workers/notifications/sourceMemberRoleChanged'
    );
    const actual = await invokeNotificationWorker(worker.default, {
      previousRole: SourceMemberRoles.Admin,
      sourceMember: { ...baseMember, role: SourceMemberRoles.Member },
    });
    const source = await con.getRepository(Source).findOneBy({ id: 'squad' });

    expect(actual.length).toEqual(1);
    expect(actual[0].type).toEqual('demoted_to_member');
    expect(actual[0].ctx).toEqual({
      userIds: ['1'],
      role: SourceMemberRoles.Admin,
      source,
    });
  });
  it('should add admin to moderator notification', async () => {
    const worker = await import(
      '../../src/workers/notifications/sourceMemberRoleChanged'
    );
    const actual = await invokeNotificationWorker(worker.default, {
      previousRole: SourceMemberRoles.Admin,
      sourceMember: { ...baseMember, role: SourceMemberRoles.Moderator },
    });
    const source = await con.getRepository(Source).findOneBy({ id: 'squad' });

    expect(actual.length).toEqual(1);
    expect(actual[0].type).toEqual('promoted_to_moderator');
    expect(actual[0].ctx).toEqual({
      userIds: ['1'],
      source,
    });
  });
});

describe('post added notifications', () => {
  it('should not add any notification if post is a welcome post', async () => {
    const worker = await import('../../src/workers/notifications/postAdded');
    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { authorId: '1', type: PostType.Welcome });
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(SourceMember).save({
      userId: '2',
      sourceId: 'a',
      role: SourceMemberRoles.Member,
      referralToken: 'random',
    });
    const actual = await invokeNotificationWorker(worker.default, {
      post: postsFixture[0],
    });
    expect(actual).toBeFalsy();
  });

  it('should add article picked notification', async () => {
    const worker = await import('../../src/workers/notifications/postAdded');
    await con.getRepository(Post).update({ id: 'p1' }, { authorId: '1' });
    const actual = await invokeNotificationWorker(worker.default, {
      post: postsFixture[0],
    });
    expect(actual.length).toEqual(1);
    expect(actual[0].type).toEqual('article_picked');
    const ctx = actual[0].ctx as NotificationPostContext;
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    const source = await con.getRepository(Source).findOneBy({ id: 'a' });
    expect(ctx.userIds).toEqual(['1']);
    expect(ctx.post.id).toEqual(post.id);
    expect(ctx.source).toEqual(source);
    expect(ctx.sharedPost).toBeFalsy();
  });

  it('should insert or ignore completed action for squad first post', async () => {
    const worker = await import('../../src/workers/notifications/postAdded');
    const repo = con.getRepository(UserAction);
    await con
      .getRepository(UserAction)
      .delete({ userId: '1', type: UserActionType.SquadFirstPost });
    const getAction = () =>
      repo.findOneBy({
        userId: '1',
        type: UserActionType.SquadFirstPost,
      });
    const exists = await getAction();
    expect(exists).toBeFalsy();
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con
      .getRepository(Post)
      .update(
        { id: 'p1' },
        { authorId: '1', sourceId: 'a', type: PostType.Share },
      );
    await invokeNotificationWorker(worker.default, {
      post: postsFixture[0],
    });
    const inserted = await getAction();
    expect(inserted).toBeTruthy();

    await invokeNotificationWorker(worker.default, {
      post: postsFixture[0],
    });

    const sameAction = await getAction();
    expect(sameAction.completedAt).toEqual(sameAction.completedAt);
  });

  it('should not add completed action for first post if source is not squad', async () => {
    const worker = await import('../../src/workers/notifications/postAdded');
    await con.getRepository(Post).update({ id: 'p1' }, { authorId: '1' });
    await con
      .getRepository(UserAction)
      .delete({ userId: '1', type: UserActionType.SquadFirstPost });
    await invokeNotificationWorker(worker.default, {
      post: postsFixture[0],
    });
    const exists = await con.getRepository(UserAction).findOneBy({
      userId: '1',
      type: UserActionType.SquadFirstPost,
    });
    expect(exists).toBeFalsy();
  });

  it('should not add article picked notification on blocked members', async () => {
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(SourceMember).insert({
      userId: '2',
      sourceId: 'a',
      role: SourceMemberRoles.Blocked,
      createdAt: new Date(),
      referralToken: randomUUID(),
    });
    const worker = await import('../../src/workers/notifications/postAdded');
    await con.getRepository(Post).update({ id: 'p1' }, { authorId: '1' });
    const actual = await invokeNotificationWorker(worker.default, {
      post: postsFixture[0],
    });
    expect(actual.length).toEqual(0);
  });

  it('should not add article picked notification for private post', async () => {
    const worker = await import('../../src/workers/notifications/postAdded');
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        authorId: '1',
        private: true,
      },
    );
    const actual = await invokeNotificationWorker(worker.default, {
      post: postsFixture[0],
    });
    expect(actual.length).toEqual(0);
  });

  it('should add community picks succeeded notification', async () => {
    const worker = await import('../../src/workers/notifications/postAdded');
    await con.getRepository(Post).update({ id: 'p1' }, { scoutId: '1' });
    const actual = await invokeNotificationWorker(worker.default, {
      post: postsFixture[0],
    });
    expect(actual.length).toEqual(1);
    expect(actual[0].type).toEqual('community_picks_succeeded');
    const ctx = actual[0].ctx as NotificationPostContext;
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    const source = await con.getRepository(Source).findOneBy({ id: 'a' });
    expect(ctx.userIds).toEqual(['1']);
    expect(ctx.post.id).toEqual(post.id);
    expect(ctx.source).toEqual(source);
    expect(ctx.sharedPost).toBeFalsy();
  });

  it('should not add notification when there is no author', async () => {
    const worker = await import('../../src/workers/notifications/postAdded');
    const post = postsFixture[0];
    const actual = await invokeNotificationWorker(worker.default, { post });
    expect(actual.length).toEqual(0);
  });

  it('should add post added notification to all source members except the author', async () => {
    const worker = await import('../../src/workers/notifications/postAdded');
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(Post).update({ id: 'p1' }, { authorId: '1' });
    await con.getRepository(SourceMember).save([
      {
        sourceId: 'a',
        userId: '2',
        referralToken: 'rt1',
        role: SourceMemberRoles.Member,
      },
      {
        sourceId: 'a',
        userId: '3',
        referralToken: 'rt2',
        role: SourceMemberRoles.Member,
      },
    ]);
    const actual = await invokeNotificationWorker(worker.default, {
      post: postsFixture[0],
    });
    expect(actual.length).toEqual(1);
    const bundle = actual[0];
    expect(bundle.type).toEqual('squad_post_added');
    expect((bundle.ctx as NotificationPostContext).post.id).toEqual('p1');
    expect((bundle.ctx as NotificationPostContext).source.id).toEqual('a');
    expect((bundle.ctx as NotificationDoneByContext).doneBy.id).toEqual('1');
    expect(bundle.ctx.userIds).toIncludeSameMembers(['2', '3']);
  });

  it('should add post added notification to all source members except the author and muted members', async () => {
    const worker = await import('../../src/workers/notifications/postAdded');
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(Post).update({ id: 'p1' }, { authorId: '1' });
    await con.getRepository(SourceMember).save([
      {
        sourceId: 'a',
        userId: '2',
        referralToken: 'rt1',
        role: SourceMemberRoles.Member,
      },
      {
        sourceId: 'a',
        userId: '3',
        referralToken: 'rt2',
        role: SourceMemberRoles.Member,
      },
    ]);
    await con.getRepository(NotificationPreferenceSource).save({
      userId: '3',
      sourceId: 'a',
      referenceId: 'a',
      status: NotificationPreferenceStatus.Muted,
      notificationType: NotificationType.SquadPostAdded,
    });
    const actual = await invokeNotificationWorker(worker.default, {
      post: postsFixture[0],
    });
    expect(actual.length).toEqual(1);
    const bundle = actual[0];
    expect(bundle.type).toEqual('squad_post_added');
    expect((bundle.ctx as NotificationPostContext).post.id).toEqual('p1');
    expect((bundle.ctx as NotificationPostContext).source.id).toEqual('a');
    expect((bundle.ctx as NotificationDoneByContext).doneBy.id).toEqual('1');
    expect(bundle.ctx.userIds).toEqual(['2']);
  });

  const prepareSubscribeTests = async (postId = 'p1', sourceId = 'a') => {
    await con
      .getRepository(Source)
      .update({ id: sourceId }, { type: SourceType.Squad });
    await con
      .getRepository(Post)
      .update({ id: postId }, { authorId: '1', type: PostType.Share });
  };

  it('should not add squad subscribe to notification when user has made many posts already', async () => {
    await prepareSubscribeTests();
    await con
      .getRepository(UserAction)
      .save({ userId: '1', type: UserActionType.SquadFirstPost });
    const worker = await import('../../src/workers/notifications/postAdded');
    const actual = await invokeNotificationWorker(worker.default, {
      post: postsFixture[0],
    });
    const subscribe = actual.some(
      ({ type }) => type === NotificationType.SquadSubscribeToNotification,
    );
    expect(subscribe).toBeFalsy();
  });

  it('should not add squad subscribe to notification when user has subscribe in the past already', async () => {
    await prepareSubscribeTests();
    await con
      .getRepository(UserAction)
      .save({ userId: '1', type: UserActionType.EnableNotification });
    const worker = await import('../../src/workers/notifications/postAdded');
    const actual = await invokeNotificationWorker(worker.default, {
      post: postsFixture[0],
    });
    const subscribe = actual.some(
      ({ type }) => type === NotificationType.SquadSubscribeToNotification,
    );
    expect(subscribe).toBeFalsy();
  });

  it('should add source post added notification to all source members', async () => {
    const worker = await import('../../src/workers/notifications/postAdded');
    await con.getRepository(NotificationPreferenceSource).save({
      userId: '3',
      sourceId: 'a',
      referenceId: 'a',
      status: NotificationPreferenceStatus.Subscribed,
      notificationType: NotificationType.SourcePostAdded,
    });
    const actual = await invokeNotificationWorker(worker.default, {
      post: postsFixture[0],
    });
    expect(actual.length).toEqual(1);
    const bundle = actual[0];
    expect(bundle.type).toEqual(NotificationType.SourcePostAdded);
    expect((bundle.ctx as NotificationPostContext).post.id).toEqual('p1');
    expect((bundle.ctx as NotificationPostContext).source.id).toEqual('a');
    expect(bundle.ctx.userIds).toEqual(['3']);
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
    expect(actual.length).toEqual(1);
    const bundle = actual[0];
    expect(bundle.type).toEqual('article_new_comment');
    expect((bundle.ctx as NotificationPostContext).post.id).toEqual('p1');
    expect((bundle.ctx as NotificationPostContext).source.id).toEqual('a');
    expect((bundle.ctx as NotificationCommentContext).comment.id).toEqual('c1');
    expect((bundle.ctx as NotificationCommenterContext).commenter.id).toEqual(
      '2',
    );
    expect(actual[0].ctx.userIds).toIncludeSameMembers(['1', '3']);
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
    expect(actual[0].ctx.userIds).toEqual(['1']);
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

  it('should not add notification for scout and author when they are following a thread as they will receive one from reply', async () => {
    const worker = await import(
      '../../src/workers/notifications/articleNewCommentCommentCommented'
    );
    const repo = con.getRepository(Comment);
    await repo.save([
      {
        id: 'c2',
        postId: 'p1',
        parentId: 'c1',
        userId: '3',
        content: 'a',
      },
      {
        id: 'c3',
        postId: 'p1',
        parentId: 'c1',
        userId: '1',
        content: 'a',
      },
    ]);
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
      childCommentId: 'c3',
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
    expect(actual.length).toEqual(1);
    expect(actual[0].ctx.userIds).toIncludeSameMembers(['1', '3']);
  });

  it('should add notification but ignore users with muted settings', async () => {
    const worker = await import(
      '../../src/workers/notifications/articleNewCommentCommentCommented'
    );
    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { scoutId: '1', authorId: '3' });
    await con.getRepository(NotificationPreferencePost).save({
      userId: '1',
      postId: 'p1',
      referenceId: 'p1',
      status: NotificationPreferenceStatus.Muted,
      notificationType: NotificationType.ArticleNewComment,
    });
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '1',
      postId: 'p1',
      childCommentId: 'c1',
    });
    expect(actual.length).toEqual(1);
    expect(actual[0].ctx.userIds).toEqual(['3']);
  });

  it('should insert or ignore completed action type first post comment', async () => {
    const worker = await import(
      '../../src/workers/notifications/articleNewCommentCommentCommented'
    );
    const repo = con.getRepository(UserAction);
    const getAction = () =>
      repo.findOneBy({
        userId: '1',
        type: UserActionType.SquadFirstComment,
      });
    const exists = await getAction();
    await con.getRepository(Comment).update({ id: 'c1' }, { userId: '1' });
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    expect(exists).toBeFalsy();

    await invokeNotificationWorker(worker.default, {
      postId: 'p1',
      childCommentId: 'c1',
    });

    const inserted = await getAction();
    expect(inserted).toBeTruthy();

    await invokeNotificationWorker(worker.default, {
      userId: '1',
      postId: 'p1',
      childCommentId: 'c1',
    });

    const existing = await getAction();
    expect(existing).toBeTruthy();
    expect(existing.completedAt).toEqual(inserted.completedAt);
  });

  it('should not insert completed action type first post comment if source is not squad', async () => {
    const worker = await import(
      '../../src/workers/notifications/articleNewCommentCommentCommented'
    );

    await con.getRepository(Comment).update({ id: 'c1' }, { userId: '1' });
    await invokeNotificationWorker(worker.default, {
      postId: 'p1',
      childCommentId: 'c1',
    });
    const exists = await con.getRepository(UserAction).findOneBy({
      userId: '1',
      type: UserActionType.SquadFirstComment,
    });
    expect(exists).toBeFalsy();
  });

  it('should not add notification for new squad comment when author is blocked from squad', async () => {
    const worker = await import(
      '../../src/workers/notifications/articleNewCommentPostCommented'
    );
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con
      .getRepository(SourceMember)
      .update(
        { sourceId: 'a', userId: '1' },
        { role: SourceMemberRoles.Blocked },
      );
    await con.getRepository(Post).update({ id: 'p1' }, { authorId: '1' });
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '1',
      postId: 'p1',
      commentId: 'c1',
    });
    expect(actual).toBeFalsy();
  });

  it('should not add notification for new squad comment when author is not par of the squad anymore', async () => {
    const worker = await import(
      '../../src/workers/notifications/articleNewCommentPostCommented'
    );
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con
      .getRepository(SourceMember)
      .delete({ sourceId: 'a', userId: '1' });
    await con.getRepository(Post).update({ id: 'p1' }, { authorId: '1' });
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '1',
      postId: 'p1',
      commentId: 'c1',
    });
    expect(actual).toBeFalsy();
  });

  it('should add notification for new squad comment', async () => {
    const worker = await import(
      '../../src/workers/notifications/articleNewCommentPostCommented'
    );
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        authorId: '1',
      },
    );
    await con.getRepository(SourceMember).insert({
      userId: '1',
      sourceId: 'a',
      role: SourceMemberRoles.Member,
      createdAt: new Date(),
      referralToken: randomUUID(),
    });
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '1',
      postId: 'p1',
      commentId: 'c1',
    });
    expect(actual.length).toEqual(1);
    actual.forEach((bundle) => {
      expect(bundle.type).toEqual('squad_new_comment');
      expect((bundle.ctx as NotificationPostContext).post.id).toEqual('p1');
      expect((bundle.ctx as NotificationPostContext).source.id).toEqual('a');
      expect((bundle.ctx as NotificationCommentContext).comment.id).toEqual(
        'c1',
      );
      expect((bundle.ctx as NotificationCommenterContext).commenter.id).toEqual(
        '2',
      );
    });

    expect(actual[0].ctx.userIds).toEqual(['1']);
  });

  it('should add notification for new squad comment but ignore muted users', async () => {
    const worker = await import(
      '../../src/workers/notifications/articleNewCommentPostCommented'
    );
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        authorId: '1',
      },
    );
    await con.getRepository(SourceMember).insert({
      userId: '1',
      sourceId: 'a',
      role: SourceMemberRoles.Member,
      createdAt: new Date(),
      referralToken: randomUUID(),
    });
    await con.getRepository(NotificationPreferencePost).save({
      userId: '1',
      postId: 'p1',
      referenceId: 'p1',
      status: NotificationPreferenceStatus.Muted,
      notificationType: NotificationType.SquadNewComment,
    });
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '1',
      postId: 'p1',
      commentId: 'c1',
    });
    expect(actual).toBeFalsy();
  });
});

describe('article upvote milestone', () => {
  it('should not add notification when scout/author is not member anymore', async () => {
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
    await con.getRepository(UserPost).save([
      {
        userId: '2',
        postId: 'p1',
        vote: UserVote.Up,
      },
      { userId: '4', postId: 'p1', vote: UserVote.Up },
    ]);
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    const repo = con.getRepository(SourceMember);
    await repo.update(
      { userId: '1', sourceId: 'a' },
      { role: SourceMemberRoles.Blocked },
    );
    await repo.delete({ userId: '3', sourceId: 'a' });
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '2',
      postId: 'p1',
    });
    expect(actual).toBeFalsy();
  });

  it('should add notification for scout and author', async () => {
    const worker = await import(
      '../../src/workers/notifications/articleUpvoteMilestone'
    );
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        scoutId: '1',
        authorId: '3',
        upvotes: 3,
      },
    );
    await con.getRepository(UserPost).save([
      {
        userId: '2',
        postId: 'p1',
        vote: UserVote.Up,
      },
      { userId: '4', postId: 'p1', vote: UserVote.Up },
    ]);
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '2',
      postId: 'p1',
    });
    expect(actual.length).toEqual(1);
    const bundle = actual[0];
    expect(bundle.type).toEqual('article_upvote_milestone');
    expect((bundle.ctx as NotificationPostContext).post.id).toEqual('p1');
    expect((bundle.ctx as NotificationPostContext).source.id).toEqual('a');
    expect((bundle.ctx as NotificationUpvotersContext).upvotes).toEqual(5);
    expect((bundle.ctx as NotificationUpvotersContext).upvoters.length).toEqual(
      2,
    );
    expect(bundle.ctx.userIds).toIncludeSameMembers(['1', '3']);
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
    expect(actual[0].ctx.userIds).toEqual(['1']);
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
  expect(actual.length).toEqual(1);
  expect(actual[0].type).toEqual('article_report_approved');
  expect(actual[0].ctx.userIds).toIncludeSameMembers(['1', '2']);
  expect((actual[0].ctx as NotificationPostContext).post.id).toEqual('p1');
  expect((actual[0].ctx as NotificationPostContext).source.id).toEqual('a');
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
  expect(actual.length).toEqual(1);
  expect(actual[0].type).toEqual('article_analytics');
  expect(actual[0].ctx.userIds).toIncludeSameMembers(['3', '1']);
  expect((actual[0].ctx as NotificationPostContext).post.id).toEqual('p1');
  expect((actual[0].ctx as NotificationPostContext).source.id).toEqual('a');
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
    expect(actual[0].ctx.userIds).toEqual(['1']);
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
    expect(actual[0].ctx.userIds).toEqual(['1']);
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
    expect(actual[0].ctx.userIds).toEqual(['1']);
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

it('should add post mention notification', async () => {
  const worker = await import('../../src/workers/notifications/postMention');
  const actual = await invokeNotificationWorker(worker.default, {
    postMention: {
      postId: 'p1',
      mentionedUserId: '2',
      mentionedByUserId: '1',
    },
  });
  type Context = NotificationPostContext & NotificationDoneByContext;
  expect(actual.length).toEqual(1);
  expect(actual[0].type).toEqual('post_mention');
  expect(actual[0].ctx.userIds).toEqual(['2']);
  expect((actual[0].ctx as Context).post.id).toEqual('p1');
  expect((actual[0].ctx as Context).source.id).toEqual('a');
  expect((actual[0].ctx as Context).doneBy.id).toEqual('1');
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
  expect(actual[0].type).toEqual(NotificationType.CommentMention);
  expect(actual[0].ctx.userIds).toEqual(['1']);
  expect((actual[0].ctx as NotificationPostContext).post.id).toEqual('p1');
  expect((actual[0].ctx as NotificationPostContext).source.id).toEqual('a');
  expect((actual[0].ctx as NotificationCommentContext).comment.id).toEqual(
    'c1',
  );
  expect((actual[0].ctx as NotificationCommenterContext).commenter.id).toEqual(
    '2',
  );
});

it('should not add comment mention notification when you mentioned the author', async () => {
  const mentionedUserId = '1';
  await con
    .getRepository(Post)
    .update({ id: 'p1' }, { authorId: mentionedUserId });
  const worker = await import('../../src/workers/notifications/commentMention');
  const actual = await invokeNotificationWorker(worker.default, {
    commentMention: {
      commentId: 'c1',
      commentUserId: '2',
      mentionedUserId,
    },
  });
  expect(actual).toBeFalsy();
});

it('should not add comment mention notification when you mentioned the scout', async () => {
  const mentionedUserId = '1';
  await con
    .getRepository(Post)
    .update({ id: 'p1' }, { authorId: mentionedUserId });
  const worker = await import('../../src/workers/notifications/commentMention');
  const actual = await invokeNotificationWorker(worker.default, {
    commentMention: {
      commentId: 'c1',
      commentUserId: '2',
      mentionedUserId,
    },
  });
  expect(actual).toBeFalsy();
});

it('should not add comment mention notification when you mentioned the parent comment author', async () => {
  const mentionedUserId = '2';
  await con.getRepository(Comment).save([
    {
      id: 'c2',
      postId: 'p1',
      userId: '1',
      content: 'sub comment',
      createdAt: new Date(2020, 1, 6, 0, 0),
      parentId: 'c1',
    },
  ]);
  const worker = await import('../../src/workers/notifications/commentMention');
  const actual = await invokeNotificationWorker(worker.default, {
    commentMention: {
      commentId: 'c2',
      commentUserId: '1',
      mentionedUserId,
    },
  });
  expect(actual).toBeFalsy();
});

it('should not add comment mention notification when you mentioned someone in the same thread', async () => {
  const mentionedUserId = '3';
  await con.getRepository(Comment).save([
    {
      id: 'c2',
      postId: 'p1',
      userId: '1',
      content: 'sub comment',
      createdAt: new Date(2020, 1, 6, 0, 0),
      parentId: 'c1',
    },
    {
      id: 'c3',
      postId: 'p1',
      userId: '3',
      content: 'sub comment',
      createdAt: new Date(2020, 1, 6, 0, 0),
      parentId: 'c1',
    },
  ]);
  const worker = await import('../../src/workers/notifications/commentMention');
  const actual = await invokeNotificationWorker(worker.default, {
    commentMention: {
      commentId: 'c2',
      commentUserId: '1',
      mentionedUserId,
    },
  });
  expect(actual).toBeFalsy();
});

describe('comment reply worker', () => {
  const prepareComments = async () =>
    con.getRepository(Comment).save([
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

  it('should add comment reply notification', async () => {
    await prepareComments();
    const worker = await import('../../src/workers/notifications/commentReply');
    const actual = await invokeNotificationWorker(worker.default, {
      postId: 'p1',
      userId: '4',
      childCommentId: 'c5',
    });
    expect(actual.length).toEqual(1);
    const bundle = actual[0];
    expect(bundle.type).toEqual('comment_reply');
    expect((bundle.ctx as NotificationPostContext).post.id).toEqual('p1');
    expect((bundle.ctx as NotificationPostContext).source.id).toEqual('a');
    expect((bundle.ctx as NotificationCommentContext).comment.id).toEqual('c5');
    expect((bundle.ctx as NotificationCommenterContext).commenter.id).toEqual(
      '4',
    );

    expect(actual[0].ctx.userIds).toIncludeSameMembers(['1', '3', '2']);
  });

  it('should add comment reply notification but ignore muted users', async () => {
    await prepareComments();
    await con.getRepository(NotificationPreferenceComment).save({
      userId: '3',
      commentId: 'c5',
      referenceId: 'c5',
      status: NotificationPreferenceStatus.Muted,
      notificationType: NotificationType.CommentReply,
    });
    const worker = await import('../../src/workers/notifications/commentReply');
    const actual = await invokeNotificationWorker(worker.default, {
      postId: 'p1',
      userId: '4',
      childCommentId: 'c5',
    });
    expect(actual.length).toEqual(1);
    const bundle = actual[0];
    expect(bundle.type).toEqual('comment_reply');
    expect((bundle.ctx as NotificationPostContext).post.id).toEqual('p1');
    expect((bundle.ctx as NotificationPostContext).source.id).toEqual('a');
    expect((bundle.ctx as NotificationCommentContext).comment.id).toEqual('c5');
    expect((bundle.ctx as NotificationCommenterContext).commenter.id).toEqual(
      '4',
    );
    expect(actual[0].ctx.userIds).toIncludeSameMembers(['1', '2']);
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
    expect(actual[0].ctx.userIds).toEqual(['2']);
  });
});

describe('comment upvote milestone', () => {
  it('should not add notification for author when not a member or blocked in the squad', async () => {
    const worker = await import(
      '../../src/workers/notifications/commentUpvoteMilestone'
    );
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    const repo = con.getRepository(SourceMember);
    await con.getRepository(Comment).update({ id: 'c1' }, { upvotes: 3 });
    await con.getRepository(UserComment).save([
      {
        userId: '1',
        commentId: 'c1',
        vote: UserVote.Up,
      },
      { userId: '4', commentId: 'c1', vote: UserVote.Up },
    ]);
    const params = { userId: '1', sourceId: 'a' };
    await repo.update(params, { role: SourceMemberRoles.Blocked });
    const actual1 = await invokeNotificationWorker(worker.default, {
      userId: '1',
      commentId: 'c1',
    });
    expect(actual1).toBeFalsy();
    await repo.delete(params);
    const actual2 = await invokeNotificationWorker(worker.default, {
      userId: '1',
      commentId: 'c1',
    });
    expect(actual2).toBeFalsy();
  });

  it('should add notification for author', async () => {
    const worker = await import(
      '../../src/workers/notifications/commentUpvoteMilestone'
    );
    await con.getRepository(Comment).update({ id: 'c1' }, { upvotes: 3 });
    await con.getRepository(UserComment).save([
      {
        userId: '1',
        commentId: 'c1',
        vote: UserVote.Up,
      },
      { userId: '4', commentId: 'c1', vote: UserVote.Up },
    ]);
    const actual = await invokeNotificationWorker(worker.default, {
      userId: '1',
      commentId: 'c1',
    });
    expect(actual.length).toEqual(1);
    expect(actual[0].type).toEqual('comment_upvote_milestone');
    expect((actual[0].ctx as NotificationPostContext).post.id).toEqual('p1');
    expect((actual[0].ctx as NotificationPostContext).source.id).toEqual('a');
    expect((actual[0].ctx as NotificationCommentContext).comment.id).toEqual(
      'c1',
    );
    expect((actual[0].ctx as NotificationUpvotersContext).upvotes).toEqual(5);
    expect(
      (actual[0].ctx as NotificationUpvotersContext).upvoters.length,
    ).toEqual(2);
    expect(actual[0].ctx.userIds).toEqual(['2']);
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

describe('squad member joined', () => {
  const prepareSquad = async () => {
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    const source = await con.getRepository(Source).findOneBy({ id: 'a' });
    await createSquadWelcomePost(con, source as SquadSource, '1');
    await con.getRepository(SourceMember).save([
      {
        sourceId: 'a',
        userId: '2',
        referralToken: 'rt1',
        role: SourceMemberRoles.Admin,
      },
    ]);
  };

  it('should add notification to squad admin', async () => {
    const worker = await import(
      '../../src/workers/notifications/squadMemberJoined'
    );
    await prepareSquad();
    const actual = await invokeNotificationWorker(worker.default, {
      sourceMember: {
        sourceId: 'a',
        userId: '1',
      },
    });
    expect(actual.length).toEqual(1);
    expect(actual[0].type).toEqual('squad_member_joined');
    expect(actual[0].ctx.userIds).toEqual(['2']);
    const ctx = actual[0].ctx as NotificationSourceContext &
      NotificationDoneByContext;
    expect(ctx.source.id).toEqual('a');
    expect(ctx.doneBy.id).toEqual('1');
  });

  it('should add notification to squad admin but exclude muted users', async () => {
    const worker = await import(
      '../../src/workers/notifications/squadMemberJoined'
    );
    await prepareSquad();
    await con.getRepository(SourceMember).save({
      sourceId: 'a',
      userId: '3',
      role: SourceMemberRoles.Admin,
      referralToken: 'token',
    });
    await con.getRepository(NotificationPreferenceSource).save({
      userId: '3',
      sourceId: 'a',
      referenceId: 'a',
      status: NotificationPreferenceStatus.Muted,
      notificationType: NotificationType.SquadMemberJoined,
    });
    const actual = await invokeNotificationWorker(worker.default, {
      sourceMember: {
        sourceId: 'a',
        userId: '1',
      },
    });
    expect(actual.length).toEqual(1);
    expect(actual[0].type).toEqual('squad_member_joined');
    expect(actual[0].ctx.userIds).toEqual(['2']);
    const ctx = actual[0].ctx as NotificationSourceContext &
      NotificationDoneByContext;
    expect(ctx.source.id).toEqual('a');
    expect(ctx.doneBy.id).toEqual('1');
  });

  it('should not add notification when admin joins', async () => {
    const worker = await import(
      '../../src/workers/notifications/squadMemberJoined'
    );
    await con.getRepository(SourceMember).save([
      {
        sourceId: 'a',
        userId: '2',
        referralToken: 'rt1',
        role: SourceMemberRoles.Admin,
      },
    ]);
    const actual = await invokeNotificationWorker(worker.default, {
      sourceMember: {
        sourceId: 'a',
        userId: '2',
      },
    });
    expect(actual).toBeFalsy();
  });

  const testJoinSquadAction = async (
    type: UserActionType,
    role: SourceMemberRoles = SourceMemberRoles.Admin,
  ) => {
    const worker = await import(
      '../../src/workers/notifications/squadMemberJoined'
    );
    const params = { userId: '2', type };
    const repo = con.getRepository(UserAction);
    const exists = await repo.findOneBy(params);
    expect(exists).toBeFalsy();
    await con.getRepository(SourceMember).save([
      {
        sourceId: 'a',
        userId: '2',
        referralToken: 'rt1',
        role,
      },
    ]);
    await invokeNotificationWorker(worker.default, {
      sourceMember: {
        sourceId: 'a',
        userId: '2',
        role,
      },
    });

    const action = await repo.findOneBy(params);
    expect(action).toBeTruthy();
    expect(action.type).toEqual(type);

    await invokeNotificationWorker(worker.default, {
      sourceMember: {
        sourceId: 'a',
        userId: '2',
      },
    });
    const createSquad = await repo.findOneBy(params);
    expect(action.completedAt).toEqual(createSquad.completedAt);
  };

  it('should insert or ignore record for action type join_squad when user is a member', async () =>
    testJoinSquadAction(UserActionType.JoinSquad, SourceMemberRoles.Member));

  it('should insert or ignore record for action type join_squad when user is a moderator', async () =>
    testJoinSquadAction(UserActionType.JoinSquad, SourceMemberRoles.Moderator));
});

it('should add squad reply notification', async () => {
  await con
    .getRepository(Source)
    .update({ id: 'a' }, { type: SourceType.Squad });
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
  expect(actual.length).toEqual(1);
  const bundle = actual[0];
  expect(bundle.type).toEqual('squad_reply');
  expect((bundle.ctx as NotificationPostContext).post.id).toEqual('p1');
  expect((bundle.ctx as NotificationPostContext).source.id).toEqual('a');
  expect((bundle.ctx as NotificationCommentContext).comment.id).toEqual('c5');
  expect((bundle.ctx as NotificationCommenterContext).commenter.id).toEqual(
    '4',
  );
  expect(actual[0].ctx.userIds).toIncludeSameMembers(['1', '3', '2']);
});

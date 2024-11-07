import {
  expectSuccessfulBackground,
  saveNotificationV2Fixture,
} from '../helpers';
import {
  createSquadWelcomePost,
  formatMailDate,
  notificationsLink,
  sendEmail,
} from '../../src/common';
import worker, {
  notificationToTemplateId,
} from '../../src/workers/newNotificationV2Mail';
import {
  ArticlePost,
  CollectionPost,
  Comment,
  FreeformPost,
  PostOrigin,
  PostRelation,
  PostRelationType,
  SharePost,
  Source,
  SourceRequest,
  SourceType,
  SquadPublicRequest,
  SquadPublicRequestStatus,
  Submission,
  SubmissionStatus,
  User,
  WelcomePost,
} from '../../src/entity';
import { usersFixture } from '../fixture/user';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  NotificationBaseContext,
  NotificationCollectionContext,
  NotificationCommentContext,
  NotificationCommenterContext,
  NotificationDoneByContext,
  NotificationPostContext,
  NotificationSourceContext,
  NotificationSourceMemberRoleContext,
  NotificationSourceRequestContext,
  NotificationSquadRequestContext,
  NotificationSubmissionContext,
  NotificationUpvotersContext,
  NotificationUserContext,
  Reference,
} from '../../src/notifications';
import { postsFixture } from '../fixture/post';
import { sourcesFixture } from '../fixture/source';
import { SourceMemberRoles } from '../../src/roles';
import { NotificationType } from '../../src/notifications/common';
import { buildPostContext } from '../../src/workers/notifications/utils';
import { SendEmailRequestWithTemplate } from 'customerio-node/dist/lib/api/requests';

jest.mock('../../src/common/mailing', () => ({
  ...(jest.requireActual('../../src/common/mailing') as Record<
    string,
    unknown
  >),
  sendEmail: jest.fn(),
}));

let con: DataSource;
let source: Source;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await con.getRepository(User).save(usersFixture);
  await con.getRepository(Source).save(sourcesFixture);
  source = await con.getRepository(Source).findOneBy({ id: 'a' });
});

it('should set parameters for community_picks_failed email', async () => {
  const submission = await con.getRepository(Submission).save({
    url: 'http://sample.abc.com',
    createdAt: new Date(2022, 11, 12),
    status: SubmissionStatus.Rejected,
    userId: '1',
  });
  const ctx: NotificationSubmissionContext = {
    userIds: ['1'],
    submission: { id: submission.id },
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.CommunityPicksFailed,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    article_link: 'http://sample.abc.com',
    reason: expect.any(String),
    submitted_at: 'Dec 12, 2022',
  });
  expect(args.transactional_message_id).toEqual('28');
});

it('should set parameters for community_picks_succeeded email', async () => {
  await con.getRepository(Submission).save({
    url: 'http://sample.abc.com',
    createdAt: new Date(2022, 11, 12),
    status: SubmissionStatus.Accepted,
    userId: '1',
  });
  const post = await con.getRepository(ArticlePost).save({
    ...postsFixture[0],
    url: 'http://sample.abc.com',
  });
  const ctx: NotificationPostContext = {
    userIds: ['1'],
    post,
    source,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.CommunityPicksSucceeded,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    article_link: 'http://sample.abc.com',
    discussion_link:
      'http://localhost:5002/posts/p1?utm_source=notification&utm_medium=email&utm_campaign=community_picks_succeeded',
    post_image: 'https://daily.dev/image.jpg',
    post_title: 'P1',
    submitted_at: 'Dec 12, 2022',
  });
  expect(args.transactional_message_id).toEqual('27');
});

it('should set parameters for community_picks_granted email', async () => {
  const ctx: NotificationBaseContext = {
    userIds: ['1'],
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.CommunityPicksGranted,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({});
  expect(args.transactional_message_id).toEqual('26');
});

it('should set parameters for article_picked email', async () => {
  const post = await con.getRepository(ArticlePost).save(postsFixture[0]);
  const ctx: NotificationPostContext = {
    userIds: ['1'],
    post,
    source,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.ArticlePicked,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    discussion_link:
      'http://localhost:5002/posts/p1?utm_source=notification&utm_medium=email&utm_campaign=article_picked',
    post_image: 'https://daily.dev/image.jpg',
    post_title: 'P1',
  });
  expect(args.transactional_message_id).toEqual('32');
});

it('should set parameters for article_new_comment email', async () => {
  await con.getRepository(User).update({ id: '2' }, { reputation: 2500 });
  const post = await con.getRepository(ArticlePost).save(postsFixture[0]);
  const comment = await con.getRepository(Comment).save({
    id: 'c1',
    postId: 'p1',
    userId: '2',
    content: 'parent comment',
    createdAt: new Date(2020, 1, 6, 0, 0),
    upvotes: 5,
  });
  const commenter = await con.getRepository(User).findOneBy({ id: '2' });
  const ctx: NotificationCommenterContext = {
    userIds: ['1'],
    post,
    source,
    comment,
    commenter,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.ArticleNewComment,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    discussion_link:
      'http://localhost:5002/posts/p1?utm_source=notification&utm_medium=email&utm_campaign=article_new_comment#c-c1',
    full_name: 'Tsahi',
    new_comment: 'parent comment',
    post_image: 'https://daily.dev/image.jpg',
    post_title: 'P1',
    profile_image: 'https://daily.dev/tsahi.jpg',
    user_reputation: '2,500',
  });
  expect(args.transactional_message_id).toEqual('33');
});

it('should set parameters for article_upvote_milestone email', async () => {
  const post = await con.getRepository(ArticlePost).save(postsFixture[0]);
  const ctx: NotificationPostContext & NotificationUpvotersContext = {
    userIds: ['1'],
    post,
    source,
    upvotes: 50,
    upvoters: [],
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.ArticleUpvoteMilestone,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    discussion_link:
      'http://localhost:5002/posts/p1?utm_source=notification&utm_medium=email&utm_campaign=article_upvote_milestone',
    post_image: 'https://daily.dev/image.jpg',
    post_title: 'P1',
    upvotes: '50',
    upvote_title: 'Good job! You earned 50 upvotes 🚴‍♀️',
  });
  expect(args.transactional_message_id).toEqual('22');
});

it('should set parameters for article_report_approved email', async () => {
  const post = await con.getRepository(ArticlePost).save(postsFixture[0]);
  const ctx: NotificationPostContext = {
    userIds: ['1'],
    post,
    source,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.ArticleReportApproved,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    post_image: 'https://daily.dev/image.jpg',
    post_title: 'P1',
  });
  expect(args.transactional_message_id).toEqual('30');
});

it('should set parameters for article_analytics email', async () => {
  const post = await con.getRepository(ArticlePost).save({
    ...postsFixture[0],
    upvotes: 6,
    views: 11,
    comments: 2,
    authorId: '1',
  });
  await con.getRepository(ArticlePost).save({
    ...postsFixture[1],
    upvotes: 5,
    views: 10,
    comments: 1,
    authorId: '1',
  });
  const ctx: NotificationPostContext = {
    userIds: ['1'],
    post,
    source,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.ArticleAnalytics,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    post_comments: '2',
    post_image: 'https://daily.dev/image.jpg',
    post_title: 'P1',
    post_upvotes: '6',
    post_views: '11',
    post_comments_total: '3',
    post_upvotes_total: '11',
    post_views_total: '21',
    profile_link:
      'http://localhost:5002/idoshamun?utm_source=notification&utm_medium=email&utm_campaign=article_analytics',
  });
  expect(args.transactional_message_id).toEqual('31');
});

it('should set parameters for source_approved email', async () => {
  const source = await con
    .getRepository(Source)
    .findOneBy({ id: sourcesFixture[0].id });
  const sourceRequest = await con.getRepository(SourceRequest).save({
    userId: '1',
    sourceUrl: 'https://daily.dev',
    sourceFeed: 'https://rss.com',
    closed: false,
  });
  const ctx: NotificationSourceRequestContext & NotificationSourceContext = {
    userIds: ['1'],
    source,
    sourceRequest,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.SourceApproved,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    rss_link: 'https://rss.com',
    source_image: 'http://image.com/a',
    source_link:
      'http://localhost:5002/sources/a?utm_source=notification&utm_medium=email&utm_campaign=source_approved',
    source_name: 'A',
  });
  expect(args.transactional_message_id).toEqual('34');
});

it('should set parameters for source_rejected email', async () => {
  const sourceRequest = await con.getRepository(SourceRequest).save({
    userId: '1',
    sourceUrl: 'https://daily.dev',
    sourceFeed: 'https://rss.com',
    closed: false,
  });
  const ctx: NotificationSourceRequestContext = {
    userIds: ['1'],
    sourceRequest,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.SourceRejected,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    rss_link: 'https://daily.dev',
  });
  expect(args.transactional_message_id).toEqual('35');
});

it('should set parameters for comment_mention email', async () => {
  const post = await con.getRepository(ArticlePost).save(postsFixture[0]);
  const comment = await con.getRepository(Comment).save({
    id: 'c1',
    postId: 'p1',
    userId: '2',
    content: 'parent comment',
    createdAt: new Date(2020, 1, 6, 0, 0),
    upvotes: 5,
  });
  const commenter = await con.getRepository(User).findOneBy({ id: '2' });
  const ctx: NotificationCommenterContext = {
    userIds: ['1'],
    post,
    comment,
    commenter,
    source,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.CommentMention,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    post_link:
      'http://localhost:5002/posts/p1?utm_source=notification&utm_medium=email&utm_campaign=comment_mention#c-c1',
    full_name: 'Tsahi',
    comment: 'parent comment',
    post_image: 'https://daily.dev/image.jpg',
    post_title: 'P1',
    commenter_profile_image: 'https://daily.dev/tsahi.jpg',
    user_reputation: '10',
  });
  expect(args.transactional_message_id).toEqual('29');
});

it('should set parameters for comment_reply email', async () => {
  const post = await con.getRepository(ArticlePost).save(postsFixture[0]);
  await con.getRepository(Comment).save({
    id: 'c1',
    postId: 'p1',
    userId: '1',
    content: 'parent comment',
    createdAt: new Date(2020, 1, 6, 0, 0),
  });
  const comment = await con.getRepository(Comment).save({
    id: 'c2',
    postId: 'p1',
    userId: '2',
    content: 'child comment',
    createdAt: new Date(2020, 1, 7, 0, 0),
    parentId: 'c1',
  });
  const commenter = await con.getRepository(User).findOneBy({ id: '2' });
  const ctx: NotificationCommenterContext = {
    userIds: ['1'],
    post,
    comment,
    commenter,
    source,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.CommentReply,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    commenter_profile_image: 'https://daily.dev/tsahi.jpg',
    commenter_reputation: '10',
    discussion_link:
      'http://localhost:5002/posts/p1?utm_source=notification&utm_medium=email&utm_campaign=comment_reply#c-c2',
    full_name: 'Tsahi',
    main_comment: 'parent comment',
    new_comment: 'child comment',
    post_title: 'P1',
    user_name: 'Ido',
    user_profile_image: 'https://daily.dev/ido.jpg',
    user_reputation: '10',
  });
  expect(args.transactional_message_id).toEqual('37');
});

it('should set parameters for squad_reply email', async () => {
  await con.getRepository(ArticlePost).save(postsFixture[0]);
  await con
    .getRepository(Source)
    .update({ id: 'a' }, { type: SourceType.Squad });
  const source = await con.getRepository(Source).findOneBy({ id: 'a' });
  const post = await con.getRepository(SharePost).save({
    id: 'ps',
    shortId: 'ps',
    sourceId: 'a',
    title: 'Shared post',
    sharedPostId: 'p1',
    authorId: '1',
  });
  await con.getRepository(Comment).save({
    id: 'c1',
    postId: 'ps',
    userId: '1',
    content: 'parent comment',
    createdAt: new Date(2020, 1, 6, 0, 0),
  });
  const comment = await con.getRepository(Comment).save({
    id: 'c2',
    postId: 'ps',
    userId: '2',
    content: 'child comment',
    createdAt: new Date(2020, 1, 6, 0, 0),
    upvotes: 5,
    parentId: 'c1',
  });
  const commenter = await con.getRepository(User).findOneBy({ id: '2' });
  const ctx: NotificationCommenterContext = {
    userIds: ['1'],
    post,
    comment,
    commenter,
    source,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.SquadReply,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    full_name: 'Tsahi',
    profile_image: 'https://daily.dev/tsahi.jpg',
    squad_name: 'A',
    squad_image: 'http://image.com/a',
    commenter_reputation: '10',
    new_comment: 'child comment',
    post_link:
      'http://localhost:5002/posts/ps?utm_source=notification&utm_medium=email&utm_campaign=squad_reply#c-c2',
    user_name: 'Ido',
    user_reputation: '10',
    user_image: 'https://daily.dev/ido.jpg',
    main_comment: 'parent comment',
  });
  expect(args.transactional_message_id).toEqual('20');
});

it('should set parameters for comment_upvote_milestone email', async () => {
  const post = await con.getRepository(ArticlePost).save(postsFixture[0]);
  const comment = await con.getRepository(Comment).save({
    id: 'c1',
    postId: 'p1',
    userId: '1',
    content: 'parent comment',
    createdAt: new Date(2020, 1, 6, 0, 0),
  });
  const ctx: NotificationCommentContext & NotificationUpvotersContext = {
    userIds: ['1'],
    post,
    comment,
    upvotes: 50,
    upvoters: [],
    source,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.CommentUpvoteMilestone,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    discussion_link:
      'http://localhost:5002/posts/p1?utm_source=notification&utm_medium=email&utm_campaign=comment_upvote_milestone#c-c1',
    main_comment: 'parent comment',
    upvote_title: 'Good job! You earned 50 upvotes 🚴‍♀️',
  });
  expect(args.transactional_message_id).toEqual('44');
});

it('should not send email notification if the user prefers not to receive them', async () => {
  const userId = '1';
  const repo = con.getRepository(User);
  const user = await repo.findOneBy({ id: userId });
  await repo.save({ ...user, notificationEmail: false });
  const post = await con.getRepository(ArticlePost).save(postsFixture[0]);
  const comment = await con.getRepository(Comment).save({
    id: 'c1',
    postId: 'p1',
    userId: '1',
    content: 'parent comment',
    createdAt: new Date(2020, 1, 6, 0, 0),
  });
  const ctx: NotificationCommentContext & NotificationUpvotersContext = {
    userIds: ['1'],
    post,
    comment,
    upvotes: 50,
    upvoters: [],
    source,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.CommentUpvoteMilestone,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId,
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(0);
});

it('should not send follow email notification if the user prefers not to receive them', async () => {
  const userId = '1';
  const repo = con.getRepository(User);
  const user = await repo.findOneBy({ id: userId });
  await repo.save({ ...user, followingEmail: false });
  const post = await con.getRepository(ArticlePost).save(postsFixture[0]);
  const ctx: NotificationUserContext & NotificationPostContext = {
    userIds: ['1'],
    user: user as Reference<User>,
    post,
    source,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.UserPostAdded,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId,
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(0);
});

it('should set parameters for squad_post_added email for sharedPost', async () => {
  const sharedPost = await con.getRepository(ArticlePost).save(postsFixture[0]);
  await con
    .getRepository(Source)
    .update({ id: 'a' }, { type: SourceType.Squad });
  const source = await con.getRepository(Source).findOneBy({ id: 'a' });
  const post = await con.getRepository(SharePost).save({
    id: 'ps',
    shortId: 'ps',
    sourceId: 'a',
    title: 'Shared post',
    sharedPostId: 'p1',
    authorId: '2',
  });
  const doneBy = await con.getRepository(User).findOneBy({ id: '2' });
  const ctx: NotificationPostContext & NotificationDoneByContext = {
    userIds: ['1'],
    post,
    sharedPost,
    source,
    doneBy,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.SquadPostAdded,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    commentary: 'Shared post',
    full_name: 'Tsahi',
    post_image: 'https://daily.dev/image.jpg',
    post_link:
      'http://localhost:5002/posts/ps?utm_source=notification&utm_medium=email&utm_campaign=squad_post_added',
    post_title: 'P1',
    profile_image: 'https://daily.dev/tsahi.jpg',
    squad_image: 'http://image.com/a',
    squad_name: 'A',
    user_reputation: '10',
  });
  expect(args.transactional_message_id).toEqual('17');
});

it('should set parameters for squad_post_added email for freeForm', async () => {
  await con
    .getRepository(Source)
    .update({ id: 'a' }, { type: SourceType.Squad });
  const source = await con.getRepository(Source).findOneBy({ id: 'a' });
  const post = await con.getRepository(FreeformPost).save({
    id: 'ps',
    shortId: 'ps',
    sourceId: 'a',
    title: 'Shared post',
    content: 'Some copy descriping the post',
    image: 'https://daily.dev/freeform_image.jpg',
    authorId: '2',
  });
  const doneBy = await con.getRepository(User).findOneBy({ id: '2' });
  const ctx: NotificationPostContext & NotificationDoneByContext = {
    userIds: ['1'],
    post,
    source,
    doneBy,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.SquadPostAdded,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    commentary: 'Some copy descriping the post',
    full_name: 'Tsahi',
    post_image: 'https://daily.dev/freeform_image.jpg',
    post_link:
      'http://localhost:5002/posts/ps?utm_source=notification&utm_medium=email&utm_campaign=squad_post_added',
    post_title: 'Shared post',
    profile_image: 'https://daily.dev/tsahi.jpg',
    squad_image: 'http://image.com/a',
    squad_name: 'A',
    user_reputation: '10',
  });
  expect(args.transactional_message_id).toEqual('17');
});

it('should set parameters for squad_post_added email for freeForm with only title', async () => {
  await con
    .getRepository(Source)
    .update({ id: 'a' }, { type: SourceType.Squad });
  const source = await con.getRepository(Source).findOneBy({ id: 'a' });
  const post = await con.getRepository(FreeformPost).save({
    id: 'ps',
    shortId: 'ps',
    sourceId: 'a',
    title: 'Shared post',
    authorId: '2',
  });
  const doneBy = await con.getRepository(User).findOneBy({ id: '2' });
  const ctx: NotificationPostContext & NotificationDoneByContext = {
    userIds: ['1'],
    post,
    source,
    doneBy,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.SquadPostAdded,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    commentary: '',
    full_name: 'Tsahi',
    post_image: expect.any(String),
    post_link:
      'http://localhost:5002/posts/ps?utm_source=notification&utm_medium=email&utm_campaign=squad_post_added',
    post_title: 'Shared post',
    profile_image: 'https://daily.dev/tsahi.jpg',
    squad_image: 'http://image.com/a',
    squad_name: 'A',
    user_reputation: '10',
  });
  expect(args.transactional_message_id).toEqual('17');
});

it('should set parameters for post_mention email for SharePost', async () => {
  const sharedPost = await con.getRepository(ArticlePost).save(postsFixture[0]);
  await con
    .getRepository(Source)
    .update({ id: 'a' }, { type: SourceType.Squad });
  const source = await con.getRepository(Source).findOneBy({ id: 'a' });
  const post = await con.getRepository(SharePost).save({
    id: 'ps',
    shortId: 'ps',
    sourceId: 'a',
    title: 'Shared post',
    sharedPostId: 'p1',
    authorId: '2',
  });
  const doneBy = await con.getRepository(User).findOneBy({ id: '2' });
  const doneTo = await con.getRepository(User).findOneBy({ id: '1' });
  const ctx: NotificationPostContext & NotificationDoneByContext = {
    userIds: ['1'],
    post,
    sharedPost,
    source,
    doneBy,
    doneTo,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.PostMention,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    commentary: 'Shared post',
    full_name: 'Tsahi',
    post_image: 'https://daily.dev/image.jpg',
    post_link:
      'http://localhost:5002/posts/ps?utm_source=notification&utm_medium=email&utm_campaign=post_mention',
    post_title: 'P1',
    profile_image: 'https://daily.dev/tsahi.jpg',
    squad_image: 'http://image.com/a',
    squad_name: 'A',
    user_reputation: '10',
  });
  expect(args.transactional_message_id).toEqual('54');
});

it('should set parameters for post_mention email for freeForm', async () => {
  await con
    .getRepository(Source)
    .update({ id: 'a' }, { type: SourceType.Squad });
  const source = await con.getRepository(Source).findOneBy({ id: 'a' });
  const post = await con.getRepository(FreeformPost).save({
    id: 'ps',
    shortId: 'ps',
    sourceId: 'a',
    title: 'Shared post',
    content: 'Some copy descriping the post',
    image: 'https://daily.dev/freeform_image.jpg',
    authorId: '2',
  });
  const doneBy = await con.getRepository(User).findOneBy({ id: '2' });
  const doneTo = await con.getRepository(User).findOneBy({ id: '1' });
  const ctx: NotificationPostContext & NotificationDoneByContext = {
    userIds: ['1'],
    post,
    source,
    doneBy,
    doneTo,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.PostMention,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    commentary: 'Some copy descriping the post',
    full_name: 'Tsahi',
    post_image: 'https://daily.dev/freeform_image.jpg',
    post_link:
      'http://localhost:5002/posts/ps?utm_source=notification&utm_medium=email&utm_campaign=post_mention',
    post_title: 'Shared post',
    profile_image: 'https://daily.dev/tsahi.jpg',
    squad_image: 'http://image.com/a',
    squad_name: 'A',
    user_reputation: '10',
  });
  expect(args.transactional_message_id).toEqual('54');
});

it('should set parameters for post_mention email for freeForm with only title', async () => {
  await con
    .getRepository(Source)
    .update({ id: 'a' }, { type: SourceType.Squad });
  const source = await con.getRepository(Source).findOneBy({ id: 'a' });
  const post = await con.getRepository(FreeformPost).save({
    id: 'ps',
    shortId: 'ps',
    sourceId: 'a',
    title: 'Shared post',
    authorId: '2',
  });
  const doneBy = await con.getRepository(User).findOneBy({ id: '2' });
  const doneTo = await con.getRepository(User).findOneBy({ id: '1' });
  const ctx: NotificationPostContext & NotificationDoneByContext = {
    userIds: ['1'],
    post,
    source,
    doneBy,
    doneTo,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.PostMention,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    commentary: '',
    full_name: 'Tsahi',
    post_image: expect.any(String),
    post_link:
      'http://localhost:5002/posts/ps?utm_source=notification&utm_medium=email&utm_campaign=post_mention',
    post_title: 'Shared post',
    profile_image: 'https://daily.dev/tsahi.jpg',
    squad_image: 'http://image.com/a',
    squad_name: 'A',
    user_reputation: '10',
  });
  expect(args.transactional_message_id).toEqual('54');
});

it('should set parameters for squad_member_joined email', async () => {
  await con
    .getRepository(Source)
    .update({ id: 'a' }, { type: SourceType.Squad });
  const source = await con.getRepository(Source).findOneBy({ id: 'a' });
  const doneBy = await con.getRepository(User).findOneBy({ id: '2' });
  const post = await createSquadWelcomePost(con, source, '1');
  await con
    .getRepository(WelcomePost)
    .update({ id: post.id }, { id: 'welcome1' });
  post.id = 'welcome1'; // for a consistent id in the test
  const ctx: NotificationPostContext & NotificationDoneByContext = {
    userIds: ['1'],
    source,
    doneBy,
    post,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.SquadMemberJoined,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    full_name: 'Tsahi',
    new_member_handle: 'tsahidaily',
    post_link:
      'http://localhost:5002/posts/welcome1?comment=%40tsahidaily+welcome+to+A%21&utm_source=notification&utm_medium=email&utm_campaign=squad_member_joined',
    profile_image: 'https://daily.dev/tsahi.jpg',
    squad_image: 'http://image.com/a',
    squad_name: 'A',
    user_reputation: '10',
  });
  expect(args.transactional_message_id).toEqual('18');
});

it('should set parameters for squad_new_comment email', async () => {
  await con.getRepository(User).update({ id: '2' }, { reputation: 2500 });
  const sharedPost = await con.getRepository(ArticlePost).save(postsFixture[0]);
  await con
    .getRepository(Source)
    .update({ id: 'a' }, { type: SourceType.Squad });
  const source = await con.getRepository(Source).findOneBy({ id: 'a' });
  const post = await con.getRepository(SharePost).save({
    id: 'ps',
    shortId: 'ps',
    sourceId: 'a',
    title: 'Shared post',
    sharedPostId: 'p1',
    authorId: '1',
  });
  const comment = await con.getRepository(Comment).save({
    id: 'c1',
    postId: 'ps',
    userId: '2',
    content: 'parent comment',
    createdAt: new Date(2020, 1, 6, 0, 0),
    upvotes: 5,
  });
  const commenter = await con.getRepository(User).findOneBy({ id: '2' });
  const ctx: NotificationCommenterContext = {
    userIds: ['1'],
    post,
    sharedPost,
    source,
    comment,
    commenter,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.SquadNewComment,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    commentary: 'Shared post',
    commenter_reputation: '2,500',
    full_name: 'Tsahi',
    new_comment: 'parent comment',
    post_image: 'https://daily.dev/image.jpg',
    post_link:
      'http://localhost:5002/posts/ps?utm_source=notification&utm_medium=email&utm_campaign=squad_new_comment#c-c1',
    post_title: 'P1',
    profile_image: 'https://daily.dev/tsahi.jpg',
    squad_image: 'http://image.com/a',
    squad_name: 'A',
    user_image: 'https://daily.dev/ido.jpg',
    user_name: 'Ido',
    user_reputation: '10',
  });
  expect(args.transactional_message_id).toEqual('19');
});

it('should set parameters for promoted_to_admin email', async () => {
  await con
    .getRepository(Source)
    .update({ id: 'a' }, { type: SourceType.Squad });
  const source = await con.getRepository(Source).findOneBy({ id: 'a' });
  const ctx: NotificationSourceContext = {
    userIds: ['1'],
    source,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.PromotedToAdmin,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  const url = new URL(notificationsLink);
  url.searchParams.set('promoted', 'true');
  url.searchParams.set('sid', sourcesFixture[0].handle);
  const params =
    'utm_source=notification&utm_medium=email&utm_campaign=promoted_to_admin'.split(
      '&',
    );
  params.forEach((param) => {
    const [key, value] = param.split('=');
    url.searchParams.set(key, value);
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  expect(args.message_data).toEqual({
    squad_link: url.toString(),
    squad_name: 'A',
  });
  expect(args.transactional_message_id).toEqual('12');
});

it('should set parameters for promoted_to_moderator email', async () => {
  await con
    .getRepository(Source)
    .update({ id: 'a' }, { type: SourceType.Squad });
  const source = await con.getRepository(Source).findOneBy({ id: 'a' });
  const ctx: NotificationSourceContext = {
    userIds: ['1'],
    source,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.PromotedToModerator,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const args = jest.mocked(sendEmail).mock
    .calls[0][0] as SendEmailRequestWithTemplate;
  const url = new URL(notificationsLink);
  url.searchParams.set('promoted', 'true');
  url.searchParams.set('sid', sourcesFixture[0].handle);
  const params =
    'utm_source=notification&utm_medium=email&utm_campaign=promoted_to_moderator'.split(
      '&',
    );
  params.forEach((param) => {
    const [key, value] = param.split('=');
    url.searchParams.set(key, value);
  });
  expect(args.message_data).toEqual({
    squad_link: url.toString(),
    squad_name: 'A',
  });
  expect(args.transactional_message_id).toEqual('13');
});

it('should not invoke demoted_to_member email', async () => {
  await con
    .getRepository(Source)
    .update({ id: 'a' }, { type: SourceType.Squad });
  const source = await con.getRepository(Source).findOneBy({ id: 'a' });
  const ctx: NotificationSourceMemberRoleContext = {
    userIds: ['1'],
    source,
    role: SourceMemberRoles.Admin,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.DemotedToMember,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(0);
});

it('should not invoke squad_blocked email', async () => {
  await con
    .getRepository(Source)
    .update({ id: 'a' }, { type: SourceType.Squad });
  const source = await con.getRepository(Source).findOneBy({ id: 'a' });
  const ctx: NotificationSourceContext = {
    userIds: ['1'],
    source,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.SquadBlocked,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(0);
});

describe('collection_post notification', () => {
  it('should send email', async () => {
    const sourceA = await con.getRepository(Source).findOneBy({
      id: 'a',
    });

    await con.getRepository(CollectionPost).save({
      id: 'cp1',
      shortId: 'cp1',
      url: 'http://cp1.com',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'a',
      visible: true,
      createdAt: new Date('01-05-2020 12:00:00'),
      origin: PostOrigin.Crawler,
      yggdrasilId: '3d5da6ec-b960-4ad8-8278-665a66b71c1f',
      title: 'New title',
      summary: 'New summary',
      content: '## New heading\n\n New content',
      contentHtml: '<h2>New heading</h2>\n<p>New content</p>\n',
    });
    await con.getRepository(ArticlePost).save({
      id: 'rp1',
      shortId: 'rp1',
      url: 'http://rp1.com',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'a',
      visible: true,
      createdAt: new Date('01-07-2020 12:00:00'),
      origin: PostOrigin.Crawler,
      yggdrasilId: '3d5da6ec-b960-4ad8-8278-665a66b71ddd',
      title: 'Related post title',
    });
    await con.getRepository(PostRelation).save({
      postId: 'cp1',
      relatedPostId: 'rp1',
      createdAt: new Date('01-05-2020 12:00:00'),
      type: PostRelationType.Collection,
    });

    const postContext = await buildPostContext(con, 'cp1');

    const ctx: NotificationCollectionContext = {
      ...postContext!,
      userIds: ['3'],
      sources: [sourceA!],
      total: 4,
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.CollectionUpdated,
      ctx,
    );
    await expectSuccessfulBackground(worker, {
      notification: {
        id: notificationId,
        userId: '1',
      },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const args = jest.mocked(sendEmail).mock
      .calls[0][0] as SendEmailRequestWithTemplate;
    expect(args.message_data).toMatchObject({
      post_comments: '0',
      post_image:
        'https://media.daily.dev/image/upload/f_auto/v1/placeholders/1',
      post_link:
        'http://localhost:5002/posts/cp1?utm_source=notification&utm_medium=email&utm_campaign=collection_updated',
      post_timestamp: 'Jan 05, 2020',
      post_title: 'New title',
      post_upvotes: '0',
      source_image:
        'https://media.daily.dev/image/upload/f_auto/v1/placeholders/1',
      source_name: 'A',
      source_timestamp: 'Jan 07, 2020',
      source_title: 'Related post title',
    });
    expect(args.transactional_message_id).toEqual('11');
  });

  it('should not send if post does not have related posts', async () => {
    const sourceA = await con.getRepository(Source).findOneBy({
      id: 'a',
    });

    await con.getRepository(CollectionPost).save({
      id: 'cp1',
      shortId: 'cp1',
      url: 'http://cp1.com',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'a',
      visible: true,
      createdAt: new Date('01-05-2020 12:00:00'),
      origin: PostOrigin.Crawler,
      yggdrasilId: '3d5da6ec-b960-4ad8-8278-665a66b71c1f',
    });

    const postContext = await buildPostContext(con, 'cp1');

    const ctx: NotificationCollectionContext = {
      ...postContext!,
      userIds: ['3'],
      sources: [sourceA!],
      total: 4,
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.CollectionUpdated,
      ctx,
    );
    await expectSuccessfulBackground(worker, {
      notification: {
        id: notificationId,
        userId: '1',
      },
    });
    expect(sendEmail).toHaveBeenCalledTimes(0);
  });
});

it('should send email to multiple users', async () => {
  const sourceRequest = await con.getRepository(SourceRequest).save({
    userId: '1',
    sourceUrl: 'https://daily.dev',
    sourceFeed: 'https://rss.com',
    closed: false,
  });
  const ctx: NotificationSourceRequestContext = {
    userIds: ['1', '2'],
    sourceRequest,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.SourceRejected,
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toHaveBeenCalledTimes(2);
  const authors = ['tsahi@daily.dev', 'ido@daily.dev'];
  authors.forEach((email, i) => {
    const args = jest.mocked(sendEmail).mock.calls[
      i
    ][0] as SendEmailRequestWithTemplate;
    expect(args.message_data).toEqual({
      rss_link: 'https://daily.dev',
    });
    expect(args.transactional_message_id).toEqual('35');
    expect(authors).toContain(args.to);
  });
});

describe('source_post_added notification', () => {
  it('should send email', async () => {
    const post = await con.getRepository(ArticlePost).save(postsFixture[0]);
    const ctx: NotificationPostContext & NotificationSourceContext = {
      userIds: ['1'],
      post,
      source,
    };
    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.SourcePostAdded,
      ctx,
    );
    await expectSuccessfulBackground(worker, {
      notification: {
        id: notificationId,
        userId: '1',
      },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const args = jest.mocked(sendEmail).mock
      .calls[0][0] as SendEmailRequestWithTemplate;
    expect(args.message_data).toEqual({
      post_image: 'https://daily.dev/image.jpg',
      post_link: `http://localhost:5002/posts/p1?utm_source=notification&utm_medium=email&utm_campaign=${NotificationType.SourcePostAdded}`,
      post_title: 'P1',
      source_name: 'A',
      source_image: 'http://image.com/a',
    });
    expect(args.transactional_message_id).toEqual(
      notificationToTemplateId[NotificationType.SourcePostAdded],
    );
  });
});

describe('squad featured notifications', () => {
  beforeEach(async () => {
    source = await con.getRepository(Source).findOneBy({ id: 'a' });
  });

  it('should send an email squad name, image, and squad featured page url', async () => {
    const ctx: NotificationSourceContext = {
      userIds: ['1'],
      source,
    };
    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.SquadFeatured,
      ctx,
    );
    await expectSuccessfulBackground(worker, {
      notification: {
        id: notificationId,
        userId: '1',
      },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const args = jest.mocked(sendEmail).mock
      .calls[0][0] as SendEmailRequestWithTemplate;
    expect(args.message_data).toEqual({
      squad_image: 'http://image.com/a',
      squad_name: 'A',
      squad_link:
        'http://localhost:5002/squads/discover/featured?utm_source=notification&utm_medium=email&utm_campaign=squad_featured',
    });
    expect(args.transactional_message_id).toEqual('56');
  });
});

describe('squad public request notifications', () => {
  beforeEach(async () => {
    source = await con.getRepository(Source).findOneBy({ id: 'a' });
  });

  it('should send an email to the requestor when submitted', async () => {
    const request = await con.getRepository(SquadPublicRequest).save({
      requestorId: '1',
      sourceId: 'a',
      status: SquadPublicRequestStatus.Pending,
    });
    const ctx: NotificationSquadRequestContext & NotificationSourceContext = {
      squadRequest: request,
      userIds: ['1'],
      source,
    };
    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.SquadPublicSubmitted,
      ctx,
    );
    await expectSuccessfulBackground(worker, {
      notification: {
        id: notificationId,
        userId: '1',
      },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const args = jest.mocked(sendEmail).mock
      .calls[0][0] as SendEmailRequestWithTemplate;
    expect(args.message_data).toEqual({
      squad_handle: 'a',
      squad_image: 'http://image.com/a',
      squad_name: 'A',
      timestamp: formatMailDate(new Date()),
    });
    expect(args.transactional_message_id).toEqual('42');
  });

  it('should send an email to the requestor when rejected', async () => {
    const request = await con.getRepository(SquadPublicRequest).save({
      requestorId: '1',
      sourceId: 'a',
      status: SquadPublicRequestStatus.Rejected,
    });
    const ctx: NotificationSquadRequestContext & NotificationSourceContext = {
      squadRequest: request,
      userIds: ['1'],
      source,
    };
    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.SquadPublicRejected,
      ctx,
    );
    await expectSuccessfulBackground(worker, {
      notification: {
        id: notificationId,
        userId: '1',
      },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const args = jest.mocked(sendEmail).mock
      .calls[0][0] as SendEmailRequestWithTemplate;
    expect(args.message_data).toEqual({
      squad_handle: 'a',
      squad_image: 'http://image.com/a',
      squad_name: 'A',
    });
    expect(args.transactional_message_id).toEqual('43');
  });

  it('should send an email to the requestor when approved', async () => {
    const request = await con.getRepository(SquadPublicRequest).save({
      requestorId: '1',
      sourceId: 'a',
      status: SquadPublicRequestStatus.Approved,
    });
    const ctx: NotificationSquadRequestContext & NotificationSourceContext = {
      squadRequest: request,
      userIds: ['1'],
      source,
    };
    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.SquadPublicApproved,
      ctx,
    );
    await expectSuccessfulBackground(worker, {
      notification: {
        id: notificationId,
        userId: '1',
      },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const args = jest.mocked(sendEmail).mock
      .calls[0][0] as SendEmailRequestWithTemplate;
    expect(args.message_data).toEqual({
      squad_handle: 'a',
      squad_image: 'http://image.com/a',
      squad_name: 'A',
    });
    expect(args.transactional_message_id).toEqual('41');
  });
});

describe('user_post_added notification', () => {
  it('should send email', async () => {
    const post = await con.getRepository(ArticlePost).save(postsFixture[0]);
    const user = await con.getRepository(User).findOneBy({ id: '1' });
    const ctx: NotificationUserContext & NotificationPostContext = {
      userIds: ['1'],
      user: user as Reference<User>,
      post,
      source,
    };
    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.UserPostAdded,
      ctx,
    );
    await expectSuccessfulBackground(worker, {
      notification: {
        id: notificationId,
        userId: '1',
      },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const args = jest.mocked(sendEmail).mock
      .calls[0][0] as SendEmailRequestWithTemplate;
    expect(args.message_data).toEqual({
      post_image: 'https://daily.dev/image.jpg',
      post_link: `http://localhost:5002/posts/p1?utm_source=notification&utm_medium=email&utm_campaign=${NotificationType.UserPostAdded}`,
      post_title: 'P1',
      full_name: 'Ido',
      profile_image: 'https://daily.dev/ido.jpg',
    });
    expect(args.transactional_message_id).toEqual(
      notificationToTemplateId[NotificationType.UserPostAdded],
    );
  });
});

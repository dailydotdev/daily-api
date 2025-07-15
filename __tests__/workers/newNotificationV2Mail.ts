import {
  expectSuccessfulBackground,
  saveFixtures,
  saveNotificationV2Fixture,
} from '../helpers';
import {
  createSquadWelcomePost,
  formatMailDate,
  notificationsLink,
  sendEmail,
  updateFlagsStatement,
} from '../../src/common';
import worker, {
  notificationToTemplateId,
} from '../../src/workers/newNotificationV2Mail';
import {
  ArticlePost,
  BRIEFING_SOURCE,
  CollectionPost,
  Comment,
  FreeformPost,
  Post,
  PostOrigin,
  PostRelation,
  PostRelationType,
  PostType,
  SharePost,
  Source,
  SourceRequest,
  SourceType,
  SquadPublicRequest,
  SquadPublicRequestStatus,
  Submission,
  SubmissionStatus,
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserPersonalizedDigestType,
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
  NotificationPostModerationContext,
  NotificationSourceContext,
  NotificationSourceMemberRoleContext,
  NotificationSourceRequestContext,
  NotificationSquadRequestContext,
  NotificationSubmissionContext,
  NotificationUpvotersContext,
  NotificationUserContext,
  Reference,
  type NotificationAwardContext,
  NotificationBoostContext,
} from '../../src/notifications';
import { postsFixture } from '../fixture/post';
import { sourcesFixture } from '../fixture/source';
import { SourceMemberRoles } from '../../src/roles';
import { NotificationType } from '../../src/notifications/common';
import {
  buildPostContext,
  getPostModerationContext,
} from '../../src/workers/notifications/utils';
import { SendEmailRequestWithTemplate } from 'customerio-node/dist/lib/api/requests';
import {
  SourcePostModeration,
  SourcePostModerationStatus,
} from '../../src/entity/SourcePostModeration';
import { ChangeObject } from '../../src/types';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../../src/entity/user/UserTransaction';
import { env } from 'node:process';
import { Product, ProductType } from '../../src/entity/Product';
import { BriefPost } from '../../src/entity/posts/BriefPost';
import { skadiApiClient } from '../../src/integrations/skadi/api/clients';

jest.mock('../../src/common/mailing', () => ({
  ...(jest.requireActual('../../src/common/mailing') as Record<
    string,
    unknown
  >),
  sendEmail: jest.fn(),
}));

// Mock the skadiApiClient
jest.mock('../../src/integrations/skadi/api/clients', () => ({
  skadiApiClient: {
    getCampaignById: jest.fn(),
  },
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

it('should not send award email notification if the user prefers not to receive them', async () => {
  const userId = '1';
  const repo = con.getRepository(User);
  const receiver = await repo.findOneBy({ id: userId });
  const sender = await repo.findOneBy({ id: '2' });
  await repo.save({ ...receiver, awardEmail: false });

  await saveFixtures(con, Product, [
    {
      id: '9104b834-6fac-4276-a168-0be1294ab371',
      name: 'Test Award',
      image: 'https://daily.dev/award.jpg',
      type: ProductType.Award,
      value: 100,
    },
  ]);

  const transaction = await con.getRepository(UserTransaction).save({
    processor: UserTransactionProcessor.Njord,
    receiverId: '1',
    senderId: '2',
    value: 100,
    valueIncFees: 100,
    fee: 0,
    request: {},
    flags: {},
    productId: '9104b834-6fac-4276-a168-0be1294ab371',
    status: UserTransactionStatus.Success,
  });
  const ctx: NotificationAwardContext = {
    userIds: ['1'],
    transaction,
    receiver: receiver as Reference<User>,
    sender: sender as Reference<User>,
    targetUrl: `${env.COMMENTS_PREFIX}/idoshamun`,
  };

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.UserReceivedAward,
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

it('should not send brief email notification if the user prefers not to receive them', async () => {
  const userId = '1';

  const ctx: NotificationPostContext = {
    userIds: ['1'],
    source: sourcesFixture.find(
      (item) => item.id === 'unknown',
    ) as Reference<Source>,
    post: postsFixture[0] as Reference<Post>,
  };

  await con.getRepository(UserPersonalizedDigest).save({
    userId: '1',
    type: UserPersonalizedDigestType.Brief,
    flags: {
      email: false,
    },
  } as UserPersonalizedDigest);

  const notificationId = await saveNotificationV2Fixture(
    con,
    NotificationType.BriefingReady,
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

describe('source_post_approved notification', () => {
  it('should send email of type shared post', async () => {
    await con.getRepository(Post).save(postsFixture);
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { authorId: '1', type: PostType.Share });
    await con
      .getRepository(SharePost)
      .update({ id: 'p1' }, { sharedPostId: 'p2' });
    await con
      .getRepository(ArticlePost)
      .update({ id: 'p2' }, { image: 'https://daily.dev/p2.jpg' });
    const postCtx = await buildPostContext(con, 'p1');
    const ctx: NotificationPostContext = {
      ...postCtx,
      userIds: ['1'],
    };
    await con.getRepository(SourcePostModeration).save({
      sourceId: 'a',
      type: PostType.Share,
      createdById: '1',
      sharedPostId: 'p2',
      status: SourcePostModerationStatus.Approved,
    });
    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.SourcePostApproved,
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
      full_name: 'Ido',
      profile_image: 'https://daily.dev/ido.jpg',
      squad_name: 'A',
      commenter_reputation: '10',
      squad_image: 'http://image.com/a',
      post_link: `http://localhost:5002/posts/p1?utm_source=notification&utm_medium=email&utm_campaign=source_post_approved`,
      post_image: 'https://daily.dev/p2.jpg',
      post_title: 'P2',
      commentary: 'P1',
    });
    expect(args.transactional_message_id).toEqual('62');
  });

  it('should send email of type freeform post', async () => {
    await con.getRepository(Post).save(postsFixture);
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { authorId: '1', type: PostType.Freeform });
    await con
      .getRepository(FreeformPost)
      .update({ id: 'p1' }, { content: 'Sample content' });
    const postCtx = await buildPostContext(con, 'p1');
    const ctx: NotificationPostContext = {
      ...postCtx,
      userIds: ['1'],
    };
    await con.getRepository(SourcePostModeration).save({
      sourceId: 'a',
      type: PostType.Share,
      createdById: '1',
      sharedPostId: 'p2',
      status: SourcePostModerationStatus.Approved,
    });
    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.SourcePostApproved,
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
      full_name: 'Ido',
      profile_image: 'https://daily.dev/ido.jpg',
      squad_name: 'A',
      commenter_reputation: '10',
      squad_image: 'http://image.com/a',
      post_link: `http://localhost:5002/posts/p1?utm_source=notification&utm_medium=email&utm_campaign=source_post_approved`,
      post_image: 'https://daily.dev/image.jpg',
      post_title: 'P1',
      commentary: 'Sample content',
    });
    expect(args.transactional_message_id).toEqual('62');
  });
});

describe('source_post_submitted notification', () => {
  it('should send email of type share post', async () => {
    await con.getRepository(Post).save(postsFixture);
    await con.getRepository(Post).update({ id: 'p2' }, { title: 'P2' });
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(User).update({ id: '1' }, { reputation: 100 });
    const post = await con.getRepository(SourcePostModeration).save({
      sourceId: 'a',
      createdById: '1',
      status: SourcePostModerationStatus.Pending,
      type: PostType.Share,
      sharedPostId: 'p2',
      title: 'Shared post',
      content: 'Content shared',
    });
    const moderationCtx = await getPostModerationContext(
      con,
      post as unknown as ChangeObject<SourcePostModeration>,
    );
    const ctx: NotificationPostModerationContext = {
      ...moderationCtx,
      userIds: ['2'],
    };
    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.SourcePostSubmitted,
      ctx,
    );
    await expectSuccessfulBackground(worker, {
      notification: {
        id: notificationId,
        userId: '2',
      },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const args = jest.mocked(sendEmail).mock
      .calls[0][0] as SendEmailRequestWithTemplate;
    expect(args.message_data).toEqual({
      full_name: 'Tsahi',
      profile_image: 'https://daily.dev/ido.jpg',
      squad_name: 'A',
      creator_name: 'Ido',
      creator_reputation: '100',
      squad_image: 'http://image.com/a',
      post_link: `http://localhost:5002/squads/a/moderate`,
      post_image: 'https://daily.dev/image.jpg',
      post_title: 'P2',
      commentary: 'Shared post',
    });
    expect(args.transactional_message_id).toEqual('61');
  });

  it('should send email of type freeform post', async () => {
    await con.getRepository(Post).save(postsFixture);
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(User).update({ id: '1' }, { reputation: 100 });
    const post = await con.getRepository(SourcePostModeration).save({
      sourceId: 'a',
      createdById: '1',
      title: 'Sample',
      content: 'Content',
      status: SourcePostModerationStatus.Pending,
      type: PostType.Freeform,
    });
    const moderationCtx = await getPostModerationContext(
      con,
      post as unknown as ChangeObject<SourcePostModeration>,
    );
    const ctx: NotificationPostModerationContext = {
      ...moderationCtx,
      userIds: ['2'],
    };
    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.SourcePostSubmitted,
      ctx,
    );
    await expectSuccessfulBackground(worker, {
      notification: {
        id: notificationId,
        userId: '2',
      },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const args = jest.mocked(sendEmail).mock
      .calls[0][0] as SendEmailRequestWithTemplate;
    expect(args.message_data).toEqual({
      full_name: 'Tsahi',
      profile_image: 'https://daily.dev/ido.jpg',
      squad_name: 'A',
      creator_name: 'Ido',
      creator_reputation: '100',
      squad_image: 'http://image.com/a',
      post_link: `http://localhost:5002/squads/a/moderate`,
      post_image: null,
      post_title: 'Sample',
      commentary: 'Content',
    });
    expect(args.transactional_message_id).toEqual('61');
  });
});

describe('post_boost_completed notification', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should send email with correct parameters for freeform post', async () => {
    const campaignId = 'campaign-123';
    const post = await con.getRepository(FreeformPost).save({
      id: 'boost-post-1',
      shortId: 'bp1',
      sourceId: 'a',
      title: 'Boosted Post Title',
      content: 'This is the content of the boosted post',
      image: 'https://daily.dev/boosted-image.jpg',
      authorId: '1',
    });

    const campaign = {
      campaignId,
      postId: post.id,
      startedAt: new Date('2024-01-15T10:00:00Z').getTime() * 1000,
      endedAt: new Date('2024-01-16T10:00:00Z').getTime() * 1000,
      impressions: 5000,
      clicks: 250,
    };

    (skadiApiClient.getCampaignById as jest.Mock).mockResolvedValue(campaign);

    const ctx: NotificationBoostContext = {
      userIds: ['1'],
      user: {
        id: '1',
        name: 'Ido',
        image: 'https://daily.dev/ido.jpg',
      } as Reference<User>,
      campaignId,
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.PostBoostCompleted,
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
      start_date: 'Jan 15, 2024',
      end_date: 'Jan 16, 2024',
      impressions: '5.0K',
      clicks: '250',
      engagement: '5.0K',
      post_link: `http://localhost:5002/posts/boosted-post-title-boost-post-1`,
      analytics_link: `http://localhost:5002/notifications?post_boost=true&c_id=campaign-123&utm_source=notification&utm_medium=email&utm_campaign=post_boost_completed`,
      post_image: 'https://daily.dev/boosted-image.jpg',
      post_title: 'Boosted Post Title',
    });
    expect(args.transactional_message_id).toEqual('');
  });

  it('should send email with correct parameters for share post', async () => {
    const campaignId = 'campaign-456';
    const sharedPost = await con.getRepository(ArticlePost).save({
      id: 'shared-post-1',
      shortId: 'sp1',
      title: 'Shared Article Title',
      image: 'https://daily.dev/shared-image.jpg',
      url: 'https://example.com/article',
    });

    const post = await con.getRepository(SharePost).save({
      id: 'share-post-1',
      shortId: 'shp1',
      sourceId: 'a',
      title: 'My commentary on the shared post',
      sharedPostId: sharedPost.id,
      authorId: '1',
    });

    const campaign = {
      campaignId,
      postId: post.id,
      startedAt: new Date('2024-01-20T10:00:00Z').getTime() * 1000,
      endedAt: new Date('2024-01-21T10:00:00Z').getTime() * 1000,
      impressions: 10000,
      clicks: 500,
    };

    (skadiApiClient.getCampaignById as jest.Mock).mockResolvedValue(campaign);

    const ctx: NotificationBoostContext = {
      userIds: ['1'],
      user: {
        id: '1',
        name: 'Ido',
        image: 'https://daily.dev/ido.jpg',
      } as Reference<User>,
      campaignId,
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.PostBoostCompleted,
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
      start_date: 'Jan 20, 2024',
      end_date: 'Jan 21, 2024',
      impressions: '10.0K',
      clicks: '500',
      engagement: '10.0K',
      post_link: `http://localhost:5002/posts/my-commentary-on-the-shared-post-share-post-1`,
      analytics_link: `http://localhost:5002/notifications?post_boost=true&c_id=campaign-456&utm_source=notification&utm_medium=email&utm_campaign=post_boost_completed`,
      post_image: 'https://daily.dev/shared-image.jpg',
      post_title: 'My commentary on the shared post',
    });
    expect(args.transactional_message_id).toEqual('');
  });

  it('should not send email when campaign is not found', async () => {
    const campaignId = 'non-existent-campaign';

    (skadiApiClient.getCampaignById as jest.Mock).mockResolvedValue(null);

    const ctx: NotificationBoostContext = {
      userIds: ['1'],
      user: {
        id: '1',
        name: 'Ido',
        image: 'https://daily.dev/ido.jpg',
      } as Reference<User>,
      campaignId,
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.PostBoostCompleted,
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

  it('should not send email when post is not found', async () => {
    const campaignId = 'campaign-789';

    const campaign = {
      campaignId,
      postId: 'non-existent-post',
      startedAt: new Date('2024-01-25T10:00:00Z').getTime() * 1000,
      endedAt: new Date('2024-01-26T10:00:00Z').getTime() * 1000,
      impressions: 3000,
      clicks: 150,
    };

    (skadiApiClient.getCampaignById as jest.Mock).mockResolvedValue(campaign);

    const ctx: NotificationBoostContext = {
      userIds: ['1'],
      user: {
        id: '1',
        name: 'Ido',
        image: 'https://daily.dev/ido.jpg',
      } as Reference<User>,
      campaignId,
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.PostBoostCompleted,
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

  it('should handle share post with missing shared post gracefully', async () => {
    const campaignId = 'campaign-777';
    // First create the shared post that will be referenced
    const sharedPost = await con.getRepository(ArticlePost).save({
      id: 'shared-post-2',
      shortId: 'sp2',
      title: 'Shared Article Title',
      image: 'https://daily.dev/shared-image.jpg',
      url: 'https://example.com/article',
    });

    const post = await con.getRepository(SharePost).save({
      id: 'share-post-2',
      shortId: 'shp2',
      sourceId: 'a',
      title: 'My commentary on the shared post',
      sharedPostId: sharedPost.id,
      authorId: '1',
    });

    const campaign = {
      campaignId,
      postId: post.id,
      startedAt: new Date('2024-02-05T10:00:00Z').getTime() * 1000,
      endedAt: new Date('2024-02-06T10:00:00Z').getTime() * 1000,
      impressions: 8000,
      clicks: 400,
    };

    (skadiApiClient.getCampaignById as jest.Mock).mockResolvedValue(campaign);

    const ctx: NotificationBoostContext = {
      userIds: ['1'],
      user: {
        id: '1',
        name: 'Ido',
        image: 'https://daily.dev/ido.jpg',
      } as Reference<User>,
      campaignId,
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.PostBoostCompleted,
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
      start_date: 'Feb 05, 2024',
      end_date: 'Feb 06, 2024',
      impressions: '8.0K',
      clicks: '400',
      engagement: '8.0K',
      post_link: `http://localhost:5002/posts/my-commentary-on-the-shared-post-share-post-2`,
      analytics_link: `http://localhost:5002/notifications?post_boost=true&c_id=campaign-777&utm_source=notification&utm_medium=email&utm_campaign=post_boost_completed`,
      post_image: 'https://daily.dev/shared-image.jpg',
      post_title: 'My commentary on the shared post',
    });
    expect(args.transactional_message_id).toEqual('');
  });
});

describe('briefing_ready notification', () => {
  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((user) => {
        return {
          ...user,
          id: `u-bnp-${user.id}`,
          username: `u-bnp-${user.username}`,
          github: undefined,
        };
      }),
    );

    await con.getRepository(BriefPost).save({
      id: 'bnp-1',
      shortId: 'bnp-1',
      sourceId: BRIEFING_SOURCE,
      visible: true,
      private: true,
      authorId: 'u-bnp-1',
      title: 'Presidential briefing',
      content: `## Must know

- **OpenAI gets a DoD contract, Microsoft gets salty**: OpenAI landed a $200 million contract with the US Department of Defense for AI tools, marking its first direct federal government partnership. This move, reported by The Verge and TechCrunch, signals a shift from OpenAI’s previous stance on military use. It also puts them in direct competition with Microsoft, their main investor, who previously handled government AI contracts through Azure. The tension is real, with OpenAI reportedly considering an antitrust complaint against Microsoft to loosen their grip.

## Good to know

- **AI agents are still pretty dumb, and dangerous**: Salesforce's CRMArena-Pro benchmark found AI agents only 58% successful on single tasks and 35% on multi-step CRM tasks, often mishandling sensitive data due to poor confidentiality awareness.
- **Threads gets Fediverse feed**: Meta's Threads now offers a dedicated opt-in feed for ActivityPub content and improved profile search for Fediverse users, marking its most prominent integration with the open social web to date.`,
      flags: {
        posts: 91,
        sources: 42,
        savedTime: 320,
        generatedAt: new Date(),
      },
      readTime: 4,
      contentJSON: [
        {
          title: 'Must know',
          items: [
            {
              title: 'OpenAI gets a DoD contract, Microsoft gets salty',
              body: 'OpenAI landed a $200 million contract with the US Department of Defense for AI tools, marking its first direct federal government partnership. This move, reported by The Verge and TechCrunch, signals a shift from OpenAI’s previous stance on military use. It also puts them in direct competition with Microsoft, their main investor, who previously handled government AI contracts through Azure. The tension is real, with OpenAI reportedly considering an antitrust complaint against Microsoft to loosen their grip.',
            },
          ],
        },
        {
          title: 'Good to know',
          items: [
            {
              title: 'AI agents are still pretty dumb, and dangerous',
              body: "Salesforce's CRMArena-Pro benchmark found AI agents only 58% successful on single tasks and 35% on multi-step CRM tasks, often mishandling sensitive data due to poor confidentiality awareness.",
            },
            {
              title: 'Threads gets Fediverse feed',
              body: "Meta's Threads now offers a dedicated opt-in feed for ActivityPub content and improved profile search for Fediverse users, marking its most prominent integration with the open social web to date.",
            },
          ],
        },
      ],
    });

    await con.getRepository(UserPersonalizedDigest).save({
      userId: 'u-bnp-1',
      type: UserPersonalizedDigestType.Brief,
      flags: {
        sendType: UserPersonalizedDigestSendType.daily,
        email: true,
      },
    });
  });

  it('should send email', async () => {
    const postContext = await buildPostContext(con, 'bnp-1');

    const ctx: NotificationPostContext = {
      ...postContext!,
      userIds: ['u-bnp-1'],
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.BriefingReady,
      ctx,
    );
    await expectSuccessfulBackground(worker, {
      notification: {
        id: notificationId,
        userId: 'u-bnp-1',
      },
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);

    const args = jest.mocked(sendEmail).mock
      .calls[0][0] as SendEmailRequestWithTemplate;

    expect(args.message_data).toMatchObject({
      isPlus: false,
      posts_number: '91',
      read_link: 'http://localhost:5002/posts/bnp-1',
      read_time: '4 minutes',
      saved_time: '5 hours',
      sources_number: '42',
      sections: [
        {
          title: 'Must know',
          items: [
            {
              title: 'OpenAI gets a DoD contract, Microsoft gets salty',
              body: 'OpenAI landed a $200 million contract with the US Department of Defense for AI tools, marking its first direct federal government partnership. This move, reported by The Verge and TechCrunch, signals a shift from OpenAI’s previous stance on military use. It also puts them in direct competition with Microsoft, their main investor, who previously handled government AI contracts through Azure. The tension is real, with OpenAI reportedly considering an antitrust complaint against Microsoft to loosen their grip.',
            },
          ],
        },
        {
          title: 'Good to know',
          items: [
            {
              title: 'AI agents are still pretty dumb, and dangerous',
              body: "Salesforce's CRMArena-Pro benchmark found AI agents only 58% successful on single tasks and 35% on multi-step CRM tasks, often mishandling sensitive data due to poor confidentiality awareness.",
            },
            {
              title: 'Threads gets Fediverse feed',
              body: "Meta's Threads now offers a dedicated opt-in feed for ActivityPub content and improved profile search for Fediverse users, marking its most prominent integration with the open social web to date.",
            },
          ],
        },
      ],
    });
    expect(args.transactional_message_id).toEqual('81');
  });

  it('should not send email if digest flag is not true', async () => {
    await con.getRepository(UserPersonalizedDigest).update(
      {
        userId: 'u-bnp-1',
        type: UserPersonalizedDigestType.Brief,
      },
      {
        flags: updateFlagsStatement<UserPersonalizedDigest>({
          email: false,
        }),
      },
    );

    const postContext = await buildPostContext(con, 'bnp-1');

    const ctx: NotificationPostContext = {
      ...postContext!,
      userIds: ['u-bnp-1'],
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.BriefingReady,
      ctx,
    );
    await expectSuccessfulBackground(worker, {
      notification: {
        id: notificationId,
        userId: 'u-bnp-1',
      },
    });

    expect(sendEmail).toHaveBeenCalledTimes(0);
  });

  it('should not send email if contentJSON is missing', async () => {
    await con.getRepository(BriefPost).update(
      {
        id: `bnp-1`,
      },
      {
        contentJSON: null,
      },
    );

    const postContext = await buildPostContext(con, 'bnp-1');

    const ctx: NotificationPostContext = {
      ...postContext!,
      userIds: ['u-bnp-1'],
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.BriefingReady,
      ctx,
    );
    await expectSuccessfulBackground(worker, {
      notification: {
        id: notificationId,
        userId: 'u-bnp-1',
      },
    });

    expect(sendEmail).toHaveBeenCalledTimes(0);
  });

  it('should send email if notificationEmail is false', async () => {
    await con.getRepository(User).update(
      {
        id: 'u-bnp-1',
      },
      {
        notificationEmail: false,
      },
    );

    const postContext = await buildPostContext(con, 'bnp-1');

    const ctx: NotificationPostContext = {
      ...postContext!,
      userIds: ['u-bnp-1'],
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.BriefingReady,
      ctx,
    );
    await expectSuccessfulBackground(worker, {
      notification: {
        id: notificationId,
        userId: 'u-bnp-1',
      },
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

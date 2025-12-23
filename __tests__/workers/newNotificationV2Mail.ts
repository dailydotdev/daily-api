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
  updateNotificationFlags,
} from '../../src/common';
import worker, {
  notificationToTemplateId,
} from '../../src/workers/newNotificationV2Mail';
import {
  ArticlePost,
  BRIEFING_SOURCE,
  Campaign,
  CampaignPost,
  CampaignSource,
  CampaignType,
  CampaignState,
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
  Organization,
} from '../../src/entity';
import { PollPost } from '../../src/entity/posts/PollPost';
import { usersFixture } from '../fixture/user';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  NotificationCampaignContext,
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
  type NotificationOpportunityMatchContext,
  type NotificationWarmIntroContext,
} from '../../src/notifications';
import { postsFixture } from '../fixture/post';
import { sourcesFixture } from '../fixture/source';
import { SourceMemberRoles } from '../../src/roles';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../../src/notifications/common';
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
import { CampaignUpdateEvent } from '../../src/common/campaign/common';
import { Opportunity } from '../../src/entity/opportunities/Opportunity';
import { OpportunityMatch } from '../../src/entity/OpportunityMatch';
import { OpportunityUserRecruiter } from '../../src/entity/opportunities/user';
import { OpportunityUserType } from '../../src/entity/opportunities/types';
import {
  datasetLocationsFixture,
  opportunitiesFixture,
  opportunityMatchesFixture,
  organizationsFixture,
} from '../fixture/opportunity';
import { DatasetLocation } from '../../src/entity/dataset/DatasetLocation';

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
  await repo.save({
    ...user,
    notificationFlags: {
      [NotificationType.CommentUpvoteMilestone]: { email: 'muted' },
    },
  });
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
  await repo.save({
    ...user,
    notificationFlags: {
      [NotificationType.UserPostAdded]: { email: 'muted' },
    },
  });
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
  await repo.save({
    ...receiver,
    notificationFlags: {
      [NotificationType.UserReceivedAward]: { email: 'muted' },
    },
  });

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

  const briefPost = await con.getRepository(BriefPost).save({
    id: 'bnp-1-send',
    shortId: 'bnp-1-send',
    sourceId: BRIEFING_SOURCE,
    visible: true,
    private: true,
    authorId: '1',
    title: 'Presidential briefing',
    content: '',
    readTime: 4,
    contentJSON: [],
  });

  const ctx: NotificationPostContext = {
    userIds: ['1'],
    source: sourcesFixture.find(
      (item) => item.id === 'unknown',
    ) as Reference<Source>,
    post: briefPost as Reference<Post>,
  };

  await con.getRepository(UserPersonalizedDigest).save({
    userId: '1',
    type: UserPersonalizedDigestType.Brief,
  } as UserPersonalizedDigest);

  await con.getRepository(User).update(
    { id: '1' },
    {
      notificationFlags: () =>
        `jsonb_set(
          jsonb_set("notificationFlags", '{briefing_ready}', coalesce("notificationFlags"->'briefing_ready', '{}'::jsonb)),
          '{briefing_ready,email}',
          '"muted"'
        )`,
    },
  );

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

it('should send email notification if the user prefers not to receive in app notifications', async () => {
  const userId = '1';

  const briefPost = await con.getRepository(BriefPost).save({
    id: 'bnp-1-send',
    shortId: 'bnp-1-send',
    sourceId: BRIEFING_SOURCE,
    visible: true,
    private: true,
    authorId: '1',
    title: 'Presidential briefing',
    content: '',
    readTime: 4,
    contentJSON: [],
  });

  const ctx: NotificationPostContext = {
    userIds: ['1'],
    source: sourcesFixture.find(
      (item) => item.id === 'unknown',
    ) as Reference<Source>,
    post: briefPost as Reference<Post>,
  };

  await con.getRepository(UserPersonalizedDigest).save({
    userId: '1',
    type: UserPersonalizedDigestType.Brief,
  } as UserPersonalizedDigest);

  await con.getRepository(User).update(
    { id: '1' },
    {
      notificationFlags: updateNotificationFlags<User>({
        briefing_ready: {
          inApp: NotificationPreferenceStatus.Muted,
          email: NotificationPreferenceStatus.Subscribed,
        },
      }),
    },
  );

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
  expect(sendEmail).toHaveBeenCalledTimes(1);
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

describe('new_opportunity_match notification', () => {
  it('should send email', async () => {
    await saveFixtures(con, DatasetLocation, datasetLocationsFixture);
    await saveFixtures(con, Organization, organizationsFixture);
    await saveFixtures(con, Opportunity, opportunitiesFixture);
    await saveFixtures(con, OpportunityMatch, opportunityMatchesFixture);
    const ctx: NotificationOpportunityMatchContext = {
      userIds: ['1'],
      opportunityId: opportunitiesFixture[0].id,
      reasoningShort: 'Your skills match this opportunity',
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.NewOpportunityMatch,
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
      opportunity_link: `http://localhost:5002/opportunity/${opportunitiesFixture[0].id}`,
    });
    expect(args.transactional_message_id).toEqual('87');
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

  it('should not send email if digest subscription is missing', async () => {
    await con.getRepository(UserPersonalizedDigest).delete({
      userId: 'u-bnp-1',
      type: UserPersonalizedDigestType.Brief,
    });

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

  it('should schedule email', async () => {
    const sendAtMs = Date.now() + 100_000;

    await con.getRepository(UserPersonalizedDigest).update(
      {
        userId: 'u-bnp-1',
        type: UserPersonalizedDigestType.Brief,
      },
      {
        lastSendDate: new Date(sendAtMs),
      },
    );

    const postContext = await buildPostContext(con, 'bnp-1');

    const ctx: NotificationPostContext = {
      ...postContext!,
      userIds: ['u-bnp-1'],
      sendAtMs,
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
    expect(args.send_at).toEqual(Math.floor(sendAtMs / 1000));
  });

  it('should send email instead of schedule sentAtMs is in the past', async () => {
    const sendAtMs = Date.now() - 100_000;

    await con.getRepository(UserPersonalizedDigest).update(
      {
        userId: 'u-bnp-1',
        type: UserPersonalizedDigestType.Brief,
      },
      {
        lastSendDate: new Date(sendAtMs),
      },
    );

    const postContext = await buildPostContext(con, 'bnp-1');

    const ctx: NotificationPostContext = {
      ...postContext!,
      userIds: ['u-bnp-1'],
      sendAtMs,
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
    expect(args.send_at).toBeUndefined();
  });
});

describe('campaign_post_completed notifications', () => {
  it('should set parameters for Post Campaign Completed email', async () => {
    await con.getRepository(ArticlePost).save(postsFixture[0]);

    // Create a CampaignPost (not just Campaign) with postId pointing to the post
    const campaignPost = await con.getRepository(CampaignPost).save({
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      referenceId: 'p1',
      userId: '1',
      type: CampaignType.Post,
      state: CampaignState.Completed,
      createdAt: new Date(2023, 0, 15, 10, 0),
      endedAt: new Date(2023, 0, 22, 10, 0),
      postId: 'p1', // This is the key field that was missing
      flags: {},
    });
    const user = await con.getRepository(User).findOneBy({ id: '1' });

    const ctx: NotificationCampaignContext = {
      userIds: ['1'],
      user: user as Reference<User>,
      campaign: campaignPost as Reference<Campaign>,
      event: CampaignUpdateEvent.Completed,
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.CampaignPostCompleted,
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
      start_date: 'Jan 15, 2023',
      end_date: 'Jan 22, 2023',
      analytics_link:
        'http://localhost:5002/notifications?c_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890&utm_source=notification&utm_medium=email&utm_campaign=campaign_post_completed',
      post_link: 'http://localhost:5002/posts/p1-p1',
      post_image: 'https://daily.dev/image.jpg',
      post_title: 'P1',
    });
    expect(args.transactional_message_id).toEqual('79');
  });
});

describe('campaign_squad_completed notifications', () => {
  it('should set parameters for Squad Campaign Completed email', async () => {
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    const source = await con.getRepository(Source).findOneBy({ id: 'a' });
    // Create a CampaignSource (not just Campaign) with sourceId pointing to the source
    const campaignSource = await con.getRepository(CampaignSource).save({
      id: 'f68db959-3142-423d-8f8d-b294b5f49b97',
      referenceId: 'a',
      userId: '1',
      type: CampaignType.Squad,
      state: CampaignState.Completed,
      createdAt: new Date(2023, 1, 10, 9, 0),
      endedAt: new Date(2023, 1, 17, 9, 0),
      sourceId: 'a', // This is the key field that was missing
      flags: {},
    });
    const user = await con.getRepository(User).findOneBy({ id: '1' });

    const ctx: NotificationCampaignContext = {
      userIds: ['1'],
      user: user as Reference<User>,
      campaign: campaignSource as Reference<Campaign>,
      source: source as Reference<Source>,
      event: CampaignUpdateEvent.Completed,
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.CampaignSquadCompleted,
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
      start_date: 'Feb 10, 2023',
      end_date: 'Feb 17, 2023',
      analytics_link:
        'http://localhost:5002/notifications?c_id=f68db959-3142-423d-8f8d-b294b5f49b97&utm_source=notification&utm_medium=email&utm_campaign=campaign_squad_completed',
      source_image: 'http://image.com/a',
      source_handle: 'a',
      source_name: 'A',
    });
    expect(args.transactional_message_id).toEqual('83');
  });
});

describe('campaign_post_first_milestone notifications', () => {
  it('should set parameters for Post Campaign First Milestone email', async () => {
    await con.getRepository(ArticlePost).save(postsFixture[0]);

    // Create a CampaignPost (not just Campaign) with postId pointing to the post
    const campaignPost = await con.getRepository(CampaignPost).save({
      id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
      referenceId: 'p1',
      userId: '1',
      type: CampaignType.Post,
      state: CampaignState.Active,
      createdAt: new Date(2023, 2, 10, 14, 30),
      endedAt: new Date(2023, 2, 17, 14, 30),
      postId: 'p1', // This is the key field that was missing
      flags: {},
    });
    const user = await con.getRepository(User).findOneBy({ id: '1' });

    const ctx: NotificationCampaignContext = {
      userIds: ['1'],
      user: user as Reference<User>,
      campaign: campaignPost as Reference<Campaign>,
      event: CampaignUpdateEvent.BudgetUpdated,
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.CampaignPostFirstMilestone,
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
      start_date: 'Mar 10, 2023',
      end_date: 'Mar 17, 2023',
      analytics_link:
        'http://localhost:5002/notifications?c_id=b2c3d4e5-f6a7-8901-bcde-f23456789012&utm_source=notification&utm_medium=email&utm_campaign=campaign_post_first_milestone',
      post_link: 'http://localhost:5002/posts/p1-p1',
      post_image: 'https://daily.dev/image.jpg',
      post_title: 'P1',
    });
    expect(args.transactional_message_id).toEqual('80');
  });
});

describe('campaign_squad_first_milestone notifications', () => {
  it('should set parameters for Squad Campaign First Milestone email', async () => {
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    const source = await con.getRepository(Source).findOneBy({ id: 'a' });
    // Create a CampaignSource (not just Campaign) with sourceId pointing to the source
    const campaignSource = await con.getRepository(CampaignSource).save({
      id: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
      referenceId: 'a',
      userId: '1',
      type: CampaignType.Squad,
      state: CampaignState.Active,
      createdAt: new Date(2023, 3, 5, 11, 45),
      endedAt: new Date(2023, 3, 12, 11, 45),
      sourceId: 'a', // This is the key field that was missing
      flags: {},
    });
    const user = await con.getRepository(User).findOneBy({ id: '1' });

    const ctx: NotificationCampaignContext = {
      userIds: ['1'],
      user: user as Reference<User>,
      campaign: campaignSource as Reference<Campaign>,
      source: source as Reference<Source>,
      event: CampaignUpdateEvent.BudgetUpdated,
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.CampaignSquadFirstMilestone,
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
      start_date: 'Apr 05, 2023',
      end_date: 'Apr 12, 2023',
      analytics_link:
        'http://localhost:5002/notifications?c_id=c3d4e5f6-a7b8-9012-cdef-345678901234&utm_source=notification&utm_medium=email&utm_campaign=campaign_squad_first_milestone',
      source_image: 'http://image.com/a',
      source_handle: 'a',
      source_name: 'A',
    });
    expect(args.transactional_message_id).toEqual('82');
  });
});

describe('poll result notifications', () => {
  it('should set parameters for poll_result email', async () => {
    const poll = await con.getRepository(Post).save({
      id: 'poll1',
      shortId: 'poll1',
      sourceId: 'a',
      title: 'What is your favorite programming language?',
      createdAt: new Date(2023, 0, 1),
      authorId: '2',
      type: PostType.Poll,
    });
    await con.getRepository(PollPost).save({
      id: 'poll1',
      endsAt: new Date(2023, 0, 5),
      numPollVotes: 150,
    });

    const ctx: NotificationPostContext & NotificationSourceContext = {
      userIds: ['1'],
      post: { id: poll.id } as Reference<Post>,
      source,
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.PollResult,
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

    const baseUrl = process.env.COMMENTS_PREFIX;
    const data = args.message_data!;

    expect(data.post_link).toEqual(
      `${baseUrl}/posts/poll1?utm_source=notification&utm_medium=email&utm_campaign=poll_result`,
    );
    expect(data.analytics_link).toEqual(
      `${baseUrl}/posts/poll1/analytics?utm_source=notification&utm_medium=email&utm_campaign=poll_result`,
    );
    expect(data.post_title).toEqual(
      'What is your favorite programming language?',
    );
    expect(data.title).toEqual('The poll you voted on has ended');
    expect(data.subtitle).toEqual(
      'Thanks for voting! The poll is now closed. Curious to see how others voted?',
    );
    expect(args.transactional_message_id).toEqual('84');
    expect(args.transactional_message_id).toEqual('84');
  });

  it('should set parameters for poll_result_author email', async () => {
    const poll = await con.getRepository(Post).save({
      id: 'poll2',
      shortId: 'poll2',
      sourceId: 'a',
      title: 'Which framework do you prefer?',
      createdAt: new Date(2023, 0, 1),
      authorId: '1',
      type: PostType.Poll,
    });
    await con.getRepository(PollPost).save({
      id: 'poll2',
      endsAt: new Date(2023, 0, 5),
      numPollVotes: 75,
    });

    const ctx: NotificationPostContext & NotificationSourceContext = {
      userIds: ['1'],
      post: { id: poll.id } as Reference<Post>,
      source,
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.PollResultAuthor,
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

    const baseUrl = process.env.COMMENTS_PREFIX;
    const data = args.message_data!;

    expect(data.post_link).toEqual(
      `${baseUrl}/posts/poll2?utm_source=notification&utm_medium=email&utm_campaign=poll_result_author`,
    );
    expect(data.analytics_link).toEqual(
      `${baseUrl}/posts/poll2/analytics?utm_source=notification&utm_medium=email&utm_campaign=poll_result_author`,
    );
    expect(data.post_title).toEqual('Which framework do you prefer?');
    expect(data.title).toEqual('Your poll has ended');
    expect(data.subtitle).toEqual(
      'Your poll just wrapped up. Curious to see how everyone voted? The results are waiting.',
    );
    expect(args.transactional_message_id).toEqual('84');
  });
});

describe('warm_intro notification', () => {
  it('should send email to both candidate and recruiter', async () => {
    await saveFixtures(con, DatasetLocation, datasetLocationsFixture);
    await saveFixtures(con, Organization, organizationsFixture);
    await saveFixtures(con, Opportunity, opportunitiesFixture);
    await saveFixtures(con, OpportunityMatch, opportunityMatchesFixture);

    // Create a recruiter user
    const recruiter = await con.getRepository(User).save({
      id: 'recruiter123',
      name: 'John Recruiter',
      email: 'recruiter@test.com',
      username: 'recruiter',
    });

    // Link recruiter to opportunity
    await con.getRepository(OpportunityUserRecruiter).save({
      opportunityId: opportunitiesFixture[0].id,
      userId: recruiter.id,
      type: OpportunityUserType.Recruiter,
    });

    // Update opportunity match with warmIntro
    await con.getRepository(OpportunityMatch).update(
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: '1',
      },
      {
        applicationRank: {
          warmIntro: '<p>Great match based on your experience!</p>',
        },
      },
    );

    const ctx: NotificationWarmIntroContext = {
      userIds: ['1'],
      opportunityId: opportunitiesFixture[0].id,
      description: 'Great match based on your experience!',
      recruiter,
      organization: organizationsFixture[0],
    };

    const notificationId = await saveNotificationV2Fixture(
      con,
      NotificationType.WarmIntro,
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
      title: `[Action Required] It's a match!`,
      copy: '<p>Great match based on your experience!</p>',
      cc: 'recruiter@test.com',
    });

    // Verify both emails are in the 'to' field
    expect(args.to).toEqual('ido@daily.dev,recruiter@test.com');
    expect(args.transactional_message_id).toEqual('85');
  });
});

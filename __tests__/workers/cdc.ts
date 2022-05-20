import nock from 'nock';
import {
  ReputationEvent,
  ReputationType,
  ReputationReason,
} from './../../src/entity/ReputationEvent';
import {
  notifySourceRequest,
  notifyPostUpvoted,
  notifyPostUpvoteCanceled,
  notifyCommentUpvoted,
  notifyCommentCommented,
  notifyPostCommented,
  notifyCommentUpvoteCanceled,
  notifyUserReputationUpdated,
  notifyPostAuthorMatched,
  notifySendAnalyticsReport,
  notifyPostReachedViewsThreshold,
  notifyPostBannedOrRemoved,
  notifyDevCardEligible,
  notifyPostReport,
  notifyAlertsUpdated,
  notifySourceFeedAdded,
  notifySourceFeedRemoved,
  notifySettingsUpdated,
  notifySubmissionChanged,
  notifySubmissionCreated,
  sendEmail,
  baseNotificationEmailData,
  pickImageUrl,
  truncatePost,
  getDiscussionLink,
} from '../../src/common';
import worker from '../../src/workers/cdc';
import {
  expectSuccessfulBackground,
  mockChangeMessage,
  saveFixtures,
} from '../helpers';
import {
  Comment,
  CommentMention,
  CommentUpvote,
  Feed,
  Post,
  Settings,
  Source,
  SourceFeed,
  SourceRequest,
  Submission,
  SubmissionStatus,
  Upvote,
  User,
} from '../../src/entity';
import { mocked } from 'ts-jest/utils';
import { ChangeObject } from '../../src/types';
import { PostReport } from '../../src/entity';
import { Connection, getConnection } from 'typeorm';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { Alerts } from '../../src/entity';
import { randomUUID } from 'crypto';

jest.mock('../../src/common', () => ({
  ...(jest.requireActual('../../src/common') as Record<string, unknown>),
  notifySourceRequest: jest.fn(),
  notifyPostUpvoted: jest.fn(),
  notifyPostUpvoteCanceled: jest.fn(),
  notifyCommentUpvoteCanceled: jest.fn(),
  notifyCommentUpvoted: jest.fn(),
  notifyCommentCommented: jest.fn(),
  notifyPostCommented: jest.fn(),
  notifyUserReputationUpdated: jest.fn(),
  notifyPostAuthorMatched: jest.fn(),
  notifySendAnalyticsReport: jest.fn(),
  notifyPostReachedViewsThreshold: jest.fn(),
  notifyPostBannedOrRemoved: jest.fn(),
  notifyDevCardEligible: jest.fn(),
  notifyPostReport: jest.fn(),
  notifyAlertsUpdated: jest.fn(),
  notifySourceFeedAdded: jest.fn(),
  notifySourceFeedRemoved: jest.fn(),
  notifySettingsUpdated: jest.fn(),
  notifySubmissionChanged: jest.fn(),
  notifySubmissionCreated: jest.fn(),
  sendEmail: jest.fn(),
}));

let con: Connection;

beforeAll(async () => {
  con = await getConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
});

const defaultUser: ChangeObject<User> = {
  id: '1',
  name: 'Ido',
  image: 'https://daily.dev/image.jpg',
  reputation: 5,
  devcardEligible: false,
  profileConfirmed: false,
  twitter: null,
  username: 'idoshamun',
  infoConfirmed: true,
  acceptedMarketing: true,
};
const saveMentionCommentFixtures = async (base: ChangeObject<User>) => {
  const usersFixture = [
    base,
    { id: '2', name: 'Tsahi', image: 'https://daily.dev/tsahi.jpg' },
    { id: '3', name: 'Nimrod', image: 'https://daily.dev/nimrod.jpg' },
    { id: '4', name: 'Lee', image: 'https://daily.dev/lee.jpg' },
    { id: '5', name: 'Hansel', image: 'https://daily.dev/Hansel.jpg' },
    { id: '6', name: 'Samson', image: 'https://daily.dev/samson.jpg' },
    { id: '7', name: 'Solevilla', image: 'https://daily.dev/solevilla.jpg' },
  ];
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await con.getRepository(Comment).save({
    id: 'c1',
    postId: 'p1',
    userId: '2',
    content: `parent comment @${base.username}`,
    contentHtml: `<p>parent comment <a>${base.username}</a></p>`,
    createdAt: new Date(2020, 1, 6, 0, 0),
  });
  await con
    .getRepository(CommentMention)
    .save({ commentId: 'c1', commentByUserId: '2', mentionedUserId: base.id });
};

describe('source request', () => {
  type ObjectType = SourceRequest;
  const base: ChangeObject<ObjectType> = {
    id: '1',
    userName: 'idoshamun',
    userId: '1',
    userEmail: 'hi@daily.dev',
    sourceUrl: 'http://source.com',
    closed: false,
    createdAt: 0,
    updatedAt: 0,
  };

  it('should notify on new source request', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'source_request',
      }),
    );
    expect(notifySourceRequest).toBeCalledTimes(1);
    expect(mocked(notifySourceRequest).mock.calls[0].slice(1)).toEqual([
      'new',
      after,
    ]);
  });

  it('should notify on source request published', async () => {
    const before: ChangeObject<ObjectType> = {
      ...base,
      approved: true,
    };
    const after: ChangeObject<ObjectType> = {
      ...before,
      closed: true,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before,
        op: 'u',
        table: 'source_request',
      }),
    );
    expect(notifySourceRequest).toBeCalledTimes(1);
    expect(mocked(notifySourceRequest).mock.calls[0].slice(1)).toEqual([
      'publish',
      after,
    ]);
  });

  it('should notify on source request declined', async () => {
    const before: ChangeObject<ObjectType> = {
      ...base,
    };
    const after: ChangeObject<ObjectType> = {
      ...before,
      closed: true,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before,
        op: 'u',
        table: 'source_request',
      }),
    );
    expect(notifySourceRequest).toBeCalledTimes(1);
    expect(mocked(notifySourceRequest).mock.calls[0].slice(1)).toEqual([
      'decline',
      after,
    ]);
  });

  it('should notify on source request approve', async () => {
    const before: ChangeObject<ObjectType> = {
      ...base,
    };
    const after: ChangeObject<ObjectType> = {
      ...before,
      approved: true,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before,
        op: 'u',
        table: 'source_request',
      }),
    );
    expect(notifySourceRequest).toBeCalledTimes(1);
    expect(mocked(notifySourceRequest).mock.calls[0].slice(1)).toEqual([
      'approve',
      after,
    ]);
  });
});

describe('post upvote', () => {
  type ObjectType = Upvote;
  const base: ChangeObject<ObjectType> = {
    userId: '1',
    postId: 'p1',
    createdAt: 0,
  };

  it('should notify on new upvote', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'upvote',
      }),
    );
    expect(notifyPostUpvoted).toBeCalledTimes(1);
    expect(mocked(notifyPostUpvoted).mock.calls[0].slice(1)).toEqual([
      'p1',
      '1',
    ]);
  });

  it('should notify on upvote deleted', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: null,
        before: base,
        op: 'd',
        table: 'upvote',
      }),
    );
    expect(notifyPostUpvoteCanceled).toBeCalledTimes(1);
    expect(mocked(notifyPostUpvoteCanceled).mock.calls[0].slice(1)).toEqual([
      'p1',
      '1',
    ]);
  });
});

describe('comment upvote', () => {
  type ObjectType = CommentUpvote;
  const base: ChangeObject<ObjectType> = {
    userId: '1',
    commentId: 'c1',
    createdAt: 0,
  };

  it('should notify on new upvote', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'comment_upvote',
      }),
    );
    expect(notifyCommentUpvoted).toBeCalledTimes(1);
    expect(mocked(notifyCommentUpvoted).mock.calls[0].slice(1)).toEqual([
      'c1',
      '1',
    ]);
  });

  it('should notify on upvote deleted', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: null,
        before: base,
        op: 'd',
        table: 'comment_upvote',
      }),
    );
    expect(notifyCommentUpvoteCanceled).toBeCalledTimes(1);
    expect(mocked(notifyCommentUpvoteCanceled).mock.calls[0].slice(1)).toEqual([
      'c1',
      '1',
    ]);
  });
});

describe('comment', () => {
  type ObjectType = Comment;
  const base: ChangeObject<ObjectType> = {
    id: 'c1',
    postId: 'p1',
    userId: '1',
    content: 'comment',
    contentHtml: '<p>comment</p>',
    parentId: null,
    comments: 0,
    upvotes: 0,
    featured: false,
    createdAt: 0,
    lastUpdatedAt: 0,
  };

  it('should notify on new post comment', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'comment',
      }),
    );
    expect(notifyPostCommented).toBeCalledTimes(1);
    expect(mocked(notifyPostCommented).mock.calls[0].slice(1)).toEqual([
      'p1',
      '1',
      'c1',
    ]);
  });

  it('should notify on new comment reply', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      parentId: 'c2',
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'comment',
      }),
    );
    expect(notifyCommentCommented).toBeCalledTimes(1);
    expect(mocked(notifyCommentCommented).mock.calls[0].slice(1)).toEqual([
      'p1',
      '1',
      'c2',
      'c1',
    ]);
  });
});

describe('user', () => {
  type ObjectType = User;
  const base: ChangeObject<ObjectType> = { ...defaultUser };

  it('should notify on new user reputation change', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      reputation: 10,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'user',
      }),
    );
    expect(notifyUserReputationUpdated).toBeCalledTimes(1);
    expect(mocked(notifyUserReputationUpdated).mock.calls[0].slice(1)).toEqual([
      '1',
      10,
    ]);
  });

  it('should notify on dev card eligibility', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      devcardEligible: true,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'user',
      }),
    );
    expect(notifyDevCardEligible).toBeCalledTimes(1);
    expect(mocked(notifyDevCardEligible).mock.calls[0].slice(1)).toEqual(['1']);
  });
});

describe('comment mention', () => {
  type ObjectType = CommentMention;
  const base: ChangeObject<ObjectType> = {
    commentId: 'c1',
    mentionedUserId: '1',
    commentByUserId: '2',
  };

  beforeEach(async () => {
    await saveMentionCommentFixtures(defaultUser);
  });

  it('should send email for the mentioned user', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'comment_mention',
      }),
    );
    const comment = await con.getRepository(Comment).findOne(base.commentId);
    const post = await comment.post;
    const commenter = await comment.user;
    const mentioned = await con
      .getRepository(User)
      .findOne(base.mentionedUserId);
    const [first_name] = mentioned.name.split(' ');
    const params = {
      ...baseNotificationEmailData,
      to: mentioned.email,
      templateId: 'd-6949e2e50def4c6698900032973d469b',
      dynamicTemplateData: {
        first_name,
        full_name: commenter.name,
        comment: comment.content,
        user_handle: mentioned.username,
        commenter_profile_image: commenter.image,
        post_title: truncatePost(post),
        post_image: post.image || pickImageUrl(post),
        post_link: getDiscussionLink(post.id),
      },
    };
    expect(sendEmail).toBeCalledTimes(1);
    expect(sendEmail).toBeCalledWith(params);
  });
});

describe('post', () => {
  type ObjectType = Partial<Post>;
  const base: ChangeObject<ObjectType> = {
    id: 'p1',
    shortId: 'sp1',
    title: 'P1',
    url: 'http://p1.com',
    score: 0,
    sourceId: 'a',
    createdAt: 0,
    tagsStr: 'javascript,webdev',
  };

  it('should notify on author matched', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      authorId: 'u1',
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'post',
      }),
    );
    expect(notifyPostAuthorMatched).toBeCalledTimes(1);
    expect(mocked(notifyPostAuthorMatched).mock.calls[0].slice(1)).toEqual([
      'p1',
      'u1',
    ]);
  });

  it('should notify on send analytics report', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      sentAnalyticsReport: true,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'post',
      }),
    );
    expect(notifySendAnalyticsReport).toBeCalledTimes(1);
    expect(mocked(notifySendAnalyticsReport).mock.calls[0].slice(1)).toEqual([
      'p1',
    ]);
  });

  it('should notify on views threshold reached', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      viewsThreshold: 1,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'post',
      }),
    );
    expect(notifyPostReachedViewsThreshold).toBeCalledTimes(1);
    expect(
      mocked(notifyPostReachedViewsThreshold).mock.calls[0].slice(1),
    ).toEqual(['p1', 250]);
  });

  it('should notify on post banned', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      banned: true,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'post',
      }),
    );
    expect(notifyPostBannedOrRemoved).toBeCalledTimes(1);
    expect(mocked(notifyPostBannedOrRemoved).mock.calls[0].slice(1)).toEqual([
      after,
    ]);
  });

  it('should notify on post removed', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      deleted: true,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: after,
        before: base,
        op: 'u',
        table: 'post',
      }),
    );
    expect(notifyPostBannedOrRemoved).toBeCalledTimes(1);
    expect(mocked(notifyPostBannedOrRemoved).mock.calls[0].slice(1)).toEqual([
      after,
    ]);
  });

  it('should not notify on post removed when banned already', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      banned: true,
      deleted: true,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: after,
        before: {
          ...base,
          banned: true,
        },
        op: 'u',
        table: 'post',
      }),
    );
    expect(notifyPostBannedOrRemoved).toBeCalledTimes(0);
  });

  it('should update post metadata changed at', async () => {
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, Post, postsFixture);
    const oldPost = await con.getRepository(Post).findOne({ id: 'p1' });
    const localBase: ChangeObject<Post> = {
      ...oldPost,
      createdAt: 0,
      metadataChangedAt: 0,
      publishedAt: 0,
      lastTrending: 0,
    };
    const after: ChangeObject<ObjectType> = {
      ...localBase,
      banned: true,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: after,
        before: localBase,
        op: 'u',
        table: 'post',
      }),
    );
    const updatedPost = await con.getRepository(Post).findOne({ id: 'p1' });
    expect(updatedPost.metadataChangedAt.getTime()).toBeGreaterThan(
      oldPost.metadataChangedAt.getTime(),
    );
  });
});

describe('post report', () => {
  type ObjectType = PostReport;
  const base: ChangeObject<ObjectType> = {
    userId: 'u1',
    postId: 'p1',
    createdAt: 0,
    reason: 'BROKEN',
    comment: 'Test comment',
  };

  beforeEach(async () => {
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, Post, postsFixture);
  });

  it('should notify on new post report', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'post_report',
      }),
    );
    const post = await con.getRepository(Post).findOne('p1');
    expect(notifyPostReport).toBeCalledTimes(1);
    expect(notifyPostReport).toBeCalledWith(
      'u1',
      post,
      '💔 Link is broken',
      'Test comment',
    );
  });
});

describe('alerts', () => {
  type ObjectType = Alerts;
  const rankLastSeen = new Date('2020-09-21T07:15:51.247Z');
  const rankLastSeenNew = new Date('2020-09-22T07:15:51.247Z');
  const base: ChangeObject<ObjectType> = {
    userId: '1',
    filter: true,
    rankLastSeen: rankLastSeen.getTime(),
    myFeed: 'created',
    companionHelper: true,
  };

  it('should notify on alert.filter changed', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      filter: false,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'alerts',
      }),
    );
    expect(notifyAlertsUpdated).toBeCalledTimes(1);
    expect(mocked(notifyAlertsUpdated).mock.calls[0].slice(1)).toEqual([after]);
  });

  it('should notify on alert.rank changed', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      rankLastSeen: rankLastSeenNew.getTime(),
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'alerts',
      }),
    );
    expect(notifyAlertsUpdated).toBeCalledTimes(1);
    expect(mocked(notifyAlertsUpdated).mock.calls[0].slice(1)).toEqual([after]);
  });

  it('should notify on alert.myFeed changed', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      myFeed: null,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'alerts',
      }),
    );
    expect(notifyAlertsUpdated).toBeCalledTimes(1);
    expect(mocked(notifyAlertsUpdated).mock.calls[0].slice(1)).toEqual([after]);
  });

  it('should notify on alerts created', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      filter: false,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'alerts',
      }),
    );
    expect(notifyAlertsUpdated).toBeCalledTimes(1);
    expect(mocked(notifyAlertsUpdated).mock.calls[0].slice(1)).toEqual([after]);
  });
});

describe('feed', () => {
  type ObjectType = Feed;
  const base: ChangeObject<ObjectType> = {
    userId: '1',
    id: '1',
  };
  it('should update alerts when feed is created', async () => {
    const repo = con.getRepository(Alerts);
    await repo.save({ userId: base.userId, myFeed: null });
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: base,
        before: null,
        op: 'c',
        table: 'feed',
      }),
    );
    const alerts = await repo.findOne({ userId: base.userId });
    expect(alerts.myFeed).toEqual('created');
  });
});

describe('settings', () => {
  type ObjectType = Settings;
  const date = new Date('2020-09-21T07:15:51.247Z');
  const base: ChangeObject<ObjectType> = {
    userId: '1',
    theme: 'darcula',
    showTopSites: true,
    insaneMode: false,
    spaciness: 'eco',
    showOnlyUnreadPosts: false,
    openNewTab: true,
    sidebarExpanded: true,
    companionExpanded: true,
    sortingEnabled: false,
    customLinks: null,
    optOutWeeklyGoal: false,
    optOutCompanion: false,
    autoDismissNotifications: true,
    updatedAt: date.getTime(),
  };

  it('should notify on any of settings has changed', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      theme: 'light',
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'settings',
      }),
    );
    expect(notifySettingsUpdated).toBeCalledTimes(1);
    expect(mocked(notifySettingsUpdated).mock.calls[0].slice(1)).toEqual([
      after,
    ]);
  });

  it('should notify on settings created', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: base,
        before: null,
        op: 'c',
        table: 'settings',
      }),
    );
    expect(notifySettingsUpdated).toBeCalledTimes(1);
    expect(mocked(notifySettingsUpdated).mock.calls[0].slice(1)).toEqual([
      base,
    ]);
  });
});

describe('source feed', () => {
  type ObjectType = SourceFeed;
  const base: ChangeObject<ObjectType> = {
    sourceId: 's1',
    feed: 'https://daily.dev',
    lastFetched: new Date().getTime(),
  };

  it('should notify on new source feed', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'source_feed',
      }),
    );
    expect(notifySourceFeedAdded).toBeCalledTimes(1);
    expect(mocked(notifySourceFeedAdded).mock.calls[0].slice(1)).toEqual([
      base.sourceId,
      base.feed,
    ]);
  });

  it('should notify on source feed removed', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: null,
        before: base,
        op: 'd',
        table: 'source_feed',
      }),
    );
    expect(notifySourceFeedRemoved).toBeCalledTimes(1);
    expect(mocked(notifySourceFeedRemoved).mock.calls[0].slice(1)).toEqual([
      base.sourceId,
      base.feed,
    ]);
  });
});

describe('reputation event', () => {
  type ObjectType = ReputationEvent;
  const base: ChangeObject<ObjectType> = {
    amount: 50,
    grantToId: '1',
    reason: ReputationReason.CommentUpvoted,
    targetType: ReputationType.Comment,
    targetId: 'c1',
    timestamp: Date.now(),
    grantById: '',
  };

  it('should update user reputation on create', async () => {
    const after: ChangeObject<ObjectType> = base;
    await saveFixtures(con, User, [defaultUser]);
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'reputation_event',
      }),
    );
    const user = await con.getRepository(User).findOne(defaultUser.id);
    expect(user.reputation).toEqual(55);
  });

  it('should not turn user reputation to negative', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      reason: ReputationReason.PostBanned,
      targetType: ReputationType.Post,
      targetId: 'p1',
      amount: -100,
    };
    await saveFixtures(con, User, [defaultUser]);
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'reputation_event',
      }),
    );
    const user = await con.getRepository(User).findOne(defaultUser.id);
    expect(user.reputation).toEqual(0);
  });

  it('should correctly revert user reputation with negative amount', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      reason: ReputationReason.PostBanned,
      targetType: ReputationType.Post,
      targetId: 'p1',
      amount: -100,
    };
    await saveFixtures(con, User, [defaultUser]);
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: null,
        before: after,
        op: 'd',
        table: 'reputation_event',
      }),
    );
    const user = await con.getRepository(User).findOne(defaultUser.id);
    expect(user.reputation).toEqual(105);
  });

  it('should update user reputation on delete', async () => {
    const updatedUser = { ...defaultUser, reputation: 55 };
    await saveFixtures(con, User, [updatedUser]);
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: null,
        before: base,
        op: 'd',
        table: 'reputation_event',
      }),
    );
    const user = await con.getRepository(User).findOne(defaultUser.id);
    expect(user.reputation).toEqual(5);
  });
});

describe('submission', () => {
  type ObjectType = Submission;
  const id = randomUUID();
  const base: ChangeObject<ObjectType> = {
    id,
    userId: '1',
    url: '',
    reason: '',
    status: SubmissionStatus.NotStarted,
    createdAt: Date.now(),
  };

  it('should notify crawler for this article', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'submission',
      }),
    );
    expect(notifySubmissionCreated).toBeCalledTimes(1);
    expect(mocked(notifySubmissionCreated).mock.calls[0].slice(1)).toEqual([
      { url: after.url, submissionId: after.id, sourceId: 'TBD' },
    ]);
  });

  it('should notify when the status turns to started', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      status: SubmissionStatus.Started,
    };
    await saveFixtures(con, User, [defaultUser]);
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'u',
        table: 'submission',
      }),
    );
    expect(notifySubmissionChanged).toBeCalledTimes(1);
    expect(mocked(notifySubmissionChanged).mock.calls[0].slice(1)).toEqual([
      after,
    ]);
  });

  it('should notify when the status turns to rejected', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      status: SubmissionStatus.Rejected,
    };
    await saveFixtures(con, User, [defaultUser]);
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'u',
        table: 'submission',
      }),
    );
    expect(notifySubmissionChanged).toBeCalledTimes(1);
    expect(mocked(notifySubmissionChanged).mock.calls[0].slice(1)).toEqual([
      after,
    ]);
  });

  it('should not notify when the status turns to accepted', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      status: SubmissionStatus.Accepted,
    };
    await saveFixtures(con, User, [defaultUser]);
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'u',
        table: 'submission',
      }),
    );
    expect(notifySubmissionChanged).toBeCalledTimes(0);
  });
});

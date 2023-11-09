import nock from 'nock';
import {
  Banner,
  FreeformPost,
  PostMention,
  ReputationEvent,
  ReputationReason,
  ReputationType,
  PostType,
  UserPost,
  UserPostVote,
  CampaignCtaPlacement,
} from '../../src/entity';
import {
  notifyAlertsUpdated,
  notifyCommentCommented,
  notifyCommentUpvoteCanceled,
  notifyCommentUpvoted,
  notifyFeatureAccess,
  notifyMemberJoinedSource,
  notifyNewPostMention,
  notifyNewCommentMention,
  notifyNewNotification,
  notifyPostBannedOrRemoved,
  notifyPostCommented,
  notifyPostReport,
  notifyCommentReport,
  notifyPostUpvoteCanceled,
  notifyPostUpvoted,
  notifySendAnalyticsReport,
  notifySettingsUpdated,
  notifySourceFeedAdded,
  notifySourceFeedRemoved,
  notifySourcePrivacyUpdated,
  notifySourceRequest,
  notifySubmissionGrantedAccess,
  notifySubmissionRejected,
  notifyUserCreated,
  notifyUsernameChanged,
  notifyUserUpdated,
  notifyPostVisible,
  notifySourceMemberRoleChanged,
  notifyContentRequested,
  notifyContentImageDeleted,
  notifyPostContentEdited,
  notifyCommentEdited,
  notifyCommentDeleted,
  notifyFreeformContentRequested,
  notifyBannerCreated,
  notifyBannerRemoved,
} from '../../src/common';
import worker from '../../src/workers/cdc';
import {
  expectSuccessfulBackground,
  mockChangeMessage,
  saveFixtures,
} from '../helpers';
import {
  Alerts,
  ArticlePost,
  Comment,
  CommentMention,
  CommentUpvote,
  COMMUNITY_PICKS_SOURCE,
  Feature,
  FeatureType,
  Feed,
  Notification,
  Post,
  PostReport,
  Settings,
  Source,
  SourceFeed,
  SourceMember,
  SourceRequest,
  Submission,
  SubmissionStatus,
  User,
  UserState,
  UserStateKey,
  ContentImage,
} from '../../src/entity';
import { ChangeObject } from '../../src/types';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { randomUUID } from 'crypto';
import { submissionAccessThreshold } from '../../src/schema/submissions';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { TypeOrmError } from '../../src/errors';
import { SourceMemberRoles } from '../../src/roles';
import { CommentReport } from '../../src/entity/CommentReport';
import { usersFixture } from '../fixture/user';
import { NotificationType } from '../../src/notifications/common';

jest.mock('../../src/common', () => ({
  ...(jest.requireActual('../../src/common') as Record<string, unknown>),
  notifySourceRequest: jest.fn(),
  notifyPostUpvoted: jest.fn(),
  notifyPostUpvoteCanceled: jest.fn(),
  notifyCommentUpvoteCanceled: jest.fn(),
  notifyCommentUpvoted: jest.fn(),
  notifyCommentCommented: jest.fn(),
  notifyPostCommented: jest.fn(),
  notifyCommentEdited: jest.fn(),
  notifyCommentDeleted: jest.fn(),
  notifyUsernameChanged: jest.fn(),
  notifyMemberJoinedSource: jest.fn(),
  notifySendAnalyticsReport: jest.fn(),
  notifyPostBannedOrRemoved: jest.fn(),
  notifyPostReport: jest.fn(),
  notifyCommentReport: jest.fn(),
  notifyAlertsUpdated: jest.fn(),
  notifySourceFeedAdded: jest.fn(),
  notifySourceFeedRemoved: jest.fn(),
  notifySettingsUpdated: jest.fn(),
  notifySubmissionRejected: jest.fn(),
  notifySubmissionGrantedAccess: jest.fn(),
  notifyNewPostMention: jest.fn(),
  notifyNewCommentMention: jest.fn(),
  notifyNewNotification: jest.fn(),
  notifyUserCreated: jest.fn(),
  notifyUserUpdated: jest.fn(),
  notifyFeatureAccess: jest.fn(),
  sendEmail: jest.fn(),
  notifySourcePrivacyUpdated: jest.fn(),
  notifyContentRequested: jest.fn(),
  notifyFreeformContentRequested: jest.fn(),
  notifyPostVisible: jest.fn(),
  notifySourceMemberRoleChanged: jest.fn(),
  notifyContentImageDeleted: jest.fn(),
  notifyPostContentEdited: jest.fn(),
  notifyBannerCreated: jest.fn(),
  notifyBannerRemoved: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
});

const defaultUser: ChangeObject<Omit<User, 'createdAt'>> = {
  id: '1',
  name: 'Ido',
  email: 'ido@daily.dev',
  permalink: 'https://app.daily.dev/idoshamun',
  image: 'https://daily.dev/image.jpg',
  reputation: 5,
  devcardEligible: false,
  profileConfirmed: false,
  twitter: null,
  username: 'idoshamun',
  infoConfirmed: true,
  acceptedMarketing: true,
  notificationEmail: true,
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
    expect(jest.mocked(notifySourceRequest).mock.calls[0].slice(1)).toEqual([
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
    expect(jest.mocked(notifySourceRequest).mock.calls[0].slice(1)).toEqual([
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
    expect(jest.mocked(notifySourceRequest).mock.calls[0].slice(1)).toEqual([
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
    expect(jest.mocked(notifySourceRequest).mock.calls[0].slice(1)).toEqual([
      'approve',
      after,
    ]);
  });
});

describe('post upvote', () => {
  type ObjectType = UserPost;
  const base: ChangeObject<ObjectType> = {
    userId: '1',
    postId: 'p1',
    votedAt: 0,
    vote: UserPostVote.Up,
    hidden: false,
    updatedAt: 0,
    createdAt: 0,
    flags: {},
  };

  it('should notify on new upvote', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'user_post',
      }),
    );
    expect(notifyPostUpvoted).toBeCalledTimes(1);
    expect(notifyPostUpvoteCanceled).toBeCalledTimes(0);
    expect(jest.mocked(notifyPostUpvoted).mock.calls[0].slice(1)).toEqual([
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
        table: 'user_post',
      }),
    );
    expect(notifyPostUpvoted).toBeCalledTimes(0);
    expect(notifyPostUpvoteCanceled).toBeCalledTimes(1);
    expect(
      jest.mocked(notifyPostUpvoteCanceled).mock.calls[0].slice(1),
    ).toEqual(['p1', '1']);
  });

  it('should notify on upvote updated', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: base,
        before: {
          ...base,
          vote: UserPostVote.None,
        },
        op: 'u',
        table: 'user_post',
      }),
    );
    expect(notifyPostUpvoted).toBeCalledTimes(1);
    expect(notifyPostUpvoteCanceled).toBeCalledTimes(0);
    expect(jest.mocked(notifyPostUpvoted).mock.calls[0].slice(1)).toEqual([
      'p1',
      '1',
    ]);
  });

  it('should notify on upvote canceled', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: {
          ...base,
          vote: UserPostVote.None,
        },
        before: base,
        op: 'u',
        table: 'user_post',
      }),
    );
    expect(notifyPostUpvoted).toBeCalledTimes(0);
    expect(notifyPostUpvoteCanceled).toBeCalledTimes(1);
    expect(
      jest.mocked(notifyPostUpvoteCanceled).mock.calls[0].slice(1),
    ).toEqual(['p1', '1']);
  });

  it('should not notify if entity is not upvote', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: {
          ...base,
          vote: UserPostVote.None,
        },
        before: {
          ...base,
          vote: UserPostVote.Down,
        },
        op: 'u',
        table: 'user_post',
      }),
    );
    expect(notifyPostUpvoted).toBeCalledTimes(0);
    expect(notifyPostUpvoteCanceled).toBeCalledTimes(0);
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
    expect(jest.mocked(notifyCommentUpvoted).mock.calls[0].slice(1)).toEqual([
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
    expect(
      jest.mocked(notifyCommentUpvoteCanceled).mock.calls[0].slice(1),
    ).toEqual(['c1', '1']);
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
    expect(jest.mocked(notifyPostCommented).mock.calls[0].slice(1)).toEqual([
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
    expect(jest.mocked(notifyCommentCommented).mock.calls[0].slice(1)).toEqual([
      'p1',
      '1',
      'c2',
      'c1',
    ]);
  });

  it('should notify on edit comment', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      contentHtml: 'test',
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'comment',
      }),
    );
    expect(notifyCommentEdited).toBeCalledTimes(1);
    expect(jest.mocked(notifyCommentEdited).mock.calls[0].slice(1)).toEqual([
      after,
    ]);
  });

  it('should notify on delete comment', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: null,
        before: base,
        op: 'd',
        table: 'comment',
      }),
    );
    expect(notifyCommentDeleted).toBeCalledTimes(1);
    expect(jest.mocked(notifyCommentDeleted).mock.calls[0].slice(1)).toEqual([
      base,
    ]);
  });
});

describe('user', () => {
  type ObjectType = User;
  const base: ChangeObject<ObjectType> = { ...defaultUser };

  it('should notify on user created', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: base,
        table: 'user',
        op: 'c',
      }),
    );
    expect(notifyUserCreated).toBeCalledTimes(1);
    expect(jest.mocked(notifyUserCreated).mock.calls[0].slice(1)).toEqual([
      base,
    ]);
  });

  it('should notify on user updated', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      username: 'newidoshamun',
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        table: 'user',
        op: 'u',
      }),
    );
    expect(notifyUserUpdated).toBeCalledTimes(1);
    expect(jest.mocked(notifyUserUpdated).mock.calls[0].slice(1)).toEqual([
      base,
      after,
    ]);
  });

  it('should notify on username change', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      username: 'newidoshamun',
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        table: 'user',
        op: 'u',
      }),
    );
    expect(notifyUsernameChanged).toBeCalledTimes(1);
    expect(jest.mocked(notifyUsernameChanged).mock.calls[0].slice(1)).toEqual([
      '1',
      'idoshamun',
      'newidoshamun',
    ]);
  });

  it('should create user state when the user had passed the reputation threshold for community link submission', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      reputation: submissionAccessThreshold,
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
    const [state] = await con.getRepository(UserState).find();
    expect(state?.key).toEqual(UserStateKey.CommunityLinkAccess);
  });

  it('should throw an error when creating user state and not related to duplicate entry', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      reputation: submissionAccessThreshold,
    };
    after.id = '1234567890123456789012345678901234567'; // 37 characters - exceeds limit
    try {
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: base,
          op: 'u',
          table: 'user',
        }),
      );
      expect(true).toBeFalsy(); // ensure the worker threw an error and not reach this code
    } catch (ex) {
      const state = await con.getRepository(UserState).find();
      expect(state.length).toEqual(0);
      expect(ex.code).not.toEqual(TypeOrmError.DUPLICATE_ENTRY);
    }
  });

  it('should handle the thrown error when user state already exists', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      reputation: submissionAccessThreshold,
    };
    const repo = con.getRepository(UserState);
    await repo.save({ userId: '1', key: UserStateKey.CommunityLinkAccess });
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'user',
      }),
    );
    const state = await con.getRepository(UserState).find();
    expect(state.length).toEqual(1);
  });
});

describe('user_state', () => {
  type ObjectType = UserState;
  it('should notify on user state is created with the right key', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: {
          userId: defaultUser.id,
          key: UserStateKey.CommunityLinkAccess,
          value: false,
        },
        op: 'c',
        table: 'user_state',
      }),
    );
    expect(notifySubmissionGrantedAccess).toBeCalledTimes(1);
    expect(
      jest.mocked(notifySubmissionGrantedAccess).mock.calls[0].slice(1),
    ).toEqual(['1']);
  });
});

describe('comment mention', () => {
  type ObjectType = CommentMention;
  const base: ChangeObject<ObjectType> = {
    commentId: 'c1',
    mentionedUserId: '1',
    commentByUserId: '2',
  };

  it('should notify on new comment mention', async () => {
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
    expect(notifyNewCommentMention).toBeCalledTimes(1);
    expect(jest.mocked(notifyNewCommentMention).mock.calls[0].slice(1)).toEqual(
      [after],
    );
  });
});

describe('post mention', () => {
  type ObjectType = PostMention;
  const base: ChangeObject<ObjectType> = {
    postId: 'c1',
    mentionedByUserId: '1',
    mentionedUserId: '2',
  };

  it('should notify on new post mention', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'post_mention',
      }),
    );
    expect(notifyNewPostMention).toBeCalledTimes(1);
    expect(jest.mocked(notifyNewPostMention).mock.calls[0].slice(1)).toEqual([
      after,
    ]);
  });
});

describe('post', () => {
  type ObjectType = Partial<ArticlePost>;
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

  it('should not notify on post visible', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: base,
        before: null,
        op: 'c',
        table: 'post',
      }),
    );
    expect(notifyPostVisible).toBeCalledTimes(0);
  });

  it('should notify on post visible on creation', async () => {
    const after = {
      ...base,
      visible: true,
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
    expect(notifyPostVisible).toBeCalledTimes(1);
    expect(jest.mocked(notifyPostVisible).mock.calls[0].slice(1)).toEqual([
      after,
    ]);
  });

  it('should notify on post visible', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      visible: true,
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
    expect(notifyPostVisible).toBeCalledTimes(1);
    expect(jest.mocked(notifyPostVisible).mock.calls[0].slice(1)).toEqual([
      after,
    ]);
  });

  it('should not notify on post edited', async () => {
    const after: ChangeObject<Partial<FreeformPost>> = {
      ...(base as ChangeObject<Partial<Post>>),
      visible: true,
      content: '1',
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<Partial<FreeformPost>>({
        after,
        before: {
          ...(base as ChangeObject<Partial<Post>>),
          visible: false,
          content: '2',
        },
        op: 'u',
        table: 'post',
      }),
    );
    expect(notifyPostContentEdited).toBeCalledTimes(0);
  });

  it('should notify on post edited', async () => {
    const after: ChangeObject<Partial<FreeformPost>> = {
      ...(base as ChangeObject<Partial<Post>>),
      visible: true,
      content: '1',
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<Partial<FreeformPost>>({
        after,
        before: {
          ...(base as ChangeObject<Partial<Post>>),
          visible: true,
          content: '2',
        },
        op: 'u',
        table: 'post',
      }),
    );
    expect(notifyPostContentEdited).toBeCalledTimes(1);
    expect(jest.mocked(notifyPostContentEdited).mock.calls[0].slice(1)).toEqual(
      [after],
    );
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
    expect(
      jest.mocked(notifySendAnalyticsReport).mock.calls[0].slice(1),
    ).toEqual(['p1']);
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
    expect(
      jest.mocked(notifyPostBannedOrRemoved).mock.calls[0].slice(1),
    ).toEqual([after]);
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
    expect(
      jest.mocked(notifyPostBannedOrRemoved).mock.calls[0].slice(1),
    ).toEqual([after]);
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
    await saveFixtures(con, ArticlePost, postsFixture);
    const oldPost = await con.getRepository(Post).findOneBy({ id: 'p1' });
    const localBase: ChangeObject<ArticlePost> = {
      ...(oldPost as ArticlePost),
      createdAt: 0,
      metadataChangedAt: 0,
      publishedAt: 0,
      lastTrending: 0,
      visible: true,
      visibleAt: 0,
      pinnedAt: null,
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
    const updatedPost = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(updatedPost.metadataChangedAt.getTime()).toBeGreaterThan(
      oldPost.metadataChangedAt.getTime(),
    );
  });

  it('should update post metadata changed at for flags', async () => {
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, ArticlePost, postsFixture);
    const oldPost = await con.getRepository(Post).findOneBy({ id: 'p1' });
    const localBase: ChangeObject<ArticlePost> = {
      ...(oldPost as ArticlePost),
      createdAt: 0,
      metadataChangedAt: 0,
      publishedAt: 0,
      lastTrending: 0,
      visible: true,
      visibleAt: 0,
      pinnedAt: null,
    };
    const after: ChangeObject<ObjectType> = {
      ...localBase,
      flags: {
        promoteToPublic: 123,
      },
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
    const updatedPost = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(updatedPost.metadataChangedAt.getTime()).toBeGreaterThan(
      oldPost.metadataChangedAt.getTime(),
    );
  });

  it('should notify for new freeform post greater than 1000 characters', async () => {
    const after = {
      ...base,
      type: PostType.Freeform,
      content: '1'.repeat(1000),
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

    expect(notifyFreeformContentRequested).toBeCalledTimes(1);
    expect(
      jest.mocked(notifyFreeformContentRequested).mock.calls[0][1].payload
        .after,
    ).toEqual(after);
  });

  it('should not notify for new freeform post less than 1000 characters', async () => {
    const after = {
      ...base,
      type: PostType.Freeform,
      content: '1'.repeat(999),
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

    expect(notifyFreeformContentRequested).toBeCalledTimes(0);
  });

  it('should not notify on welcome post', async () => {
    const after = {
      ...base,
      type: PostType.Welcome,
      content: '1'.repeat(1000),
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

    expect(notifyContentRequested).toBeCalledTimes(0);
  });

  it('should not notify on shared post', async () => {
    const after = {
      ...base,
      type: PostType.Share,
      content: '1'.repeat(1000),
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

    expect(notifyContentRequested).toBeCalledTimes(0);
  });

  it('should notify for edited freeform post greater than 200 edited characters', async () => {
    const before = {
      ...base,
      type: PostType.Freeform,
      content: '1',
    };

    const after = {
      ...before,
      content: before.content + '2'.repeat(200),
    };

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before,
        op: 'u',
        table: 'post',
      }),
    );

    expect(notifyFreeformContentRequested).toBeCalledTimes(1);
    expect(
      jest.mocked(notifyFreeformContentRequested).mock.calls[0][1].payload
        .before,
    ).toEqual(before);
    expect(
      jest.mocked(notifyFreeformContentRequested).mock.calls[0][1].payload
        .after,
    ).toEqual(after);
  });

  it('should not notify for edited freeform post less than 200 edited characters', async () => {
    const before = {
      ...base,
      type: PostType.Freeform,
      content: '1',
    };

    const after = {
      ...before,
      content: before.content + '2'.repeat(100),
    };

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before,
        op: 'u',
        table: 'post',
      }),
    );

    expect(notifyContentRequested).toBeCalledTimes(0);
  });
});

describe('comment report', () => {
  type ObjectType = CommentReport;
  const base: ChangeObject<ObjectType> = {
    userId: 'u1',
    commentId: 'c1',
    createdAt: 0,
    reason: 'MISINFORMATION',
    note: 'Test note',
  };

  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, ArticlePost, postsFixture);
    await con.getRepository(Comment).save({
      id: 'c1',
      postId: 'p1',
      content: 'User placed comment',
      userId: '1',
    });
  });

  it('should notify on new comment report', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'comment_report',
      }),
    );
    const comment = await con.getRepository(Comment).findOneBy({ id: 'c1' });
    expect(notifyCommentReport).toBeCalledTimes(1);
    expect(notifyCommentReport).toBeCalledWith(
      'u1',
      comment,
      'False Information or Misinformation',
      'Test note',
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
    await saveFixtures(con, ArticlePost, postsFixture);
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
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(notifyPostReport).toBeCalledTimes(1);
    expect(notifyPostReport).toBeCalledWith(
      'u1',
      post,
      '💔 Link is broken',
      'Test comment',
      undefined,
    );
  });

  it('should notify on new post report with tags', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: {
          ...after,
          tags: ['php', 'webdev'],
        },
        before: null,
        op: 'c',
        table: 'post_report',
      }),
    );
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(notifyPostReport).toBeCalledTimes(1);
    expect(notifyPostReport).toBeCalledWith(
      'u1',
      post,
      '💔 Link is broken',
      'Test comment',
      ['php', 'webdev'],
    );
  });
});

describe('alerts', () => {
  type ObjectType = Omit<Alerts, 'flags'>;
  const rankLastSeen = new Date('2020-09-21T07:15:51.247Z');
  const rankLastSeenNew = new Date('2020-09-22T07:15:51.247Z');
  const base: ChangeObject<ObjectType> = {
    userId: '1',
    filter: true,
    rankLastSeen: rankLastSeen.getTime(),
    myFeed: 'created',
    companionHelper: true,
    lastChangelog: null,
    lastBanner: null,
    squadTour: true,
    showGenericReferral: false,
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
    expect(jest.mocked(notifyAlertsUpdated).mock.calls[0].slice(1)).toEqual([
      after,
    ]);
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
    expect(jest.mocked(notifyAlertsUpdated).mock.calls[0].slice(1)).toEqual([
      after,
    ]);
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
    expect(jest.mocked(notifyAlertsUpdated).mock.calls[0].slice(1)).toEqual([
      after,
    ]);
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
    expect(jest.mocked(notifyAlertsUpdated).mock.calls[0].slice(1)).toEqual([
      after,
    ]);
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
    const alerts = await repo.findOneBy({ userId: base.userId });
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
    campaignCtaPlacement: CampaignCtaPlacement.Header,
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
    expect(jest.mocked(notifySettingsUpdated).mock.calls[0].slice(1)).toEqual([
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
    expect(jest.mocked(notifySettingsUpdated).mock.calls[0].slice(1)).toEqual([
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
    expect(jest.mocked(notifySourceFeedAdded).mock.calls[0].slice(1)).toEqual([
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
    expect(jest.mocked(notifySourceFeedRemoved).mock.calls[0].slice(1)).toEqual(
      [base.sourceId, base.feed],
    );
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
    const user = await con
      .getRepository(User)
      .findOneBy({ id: defaultUser.id });
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
    const user = await con
      .getRepository(User)
      .findOneBy({ id: defaultUser.id });
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
    const user = await con
      .getRepository(User)
      .findOneBy({ id: defaultUser.id });
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
    const user = await con
      .getRepository(User)
      .findOneBy({ id: defaultUser.id });
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
    reason: null,
    status: SubmissionStatus.Started,
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
    expect(notifyContentRequested).toBeCalledTimes(1);
    expect(jest.mocked(notifyContentRequested).mock.calls[0].slice(1)).toEqual([
      {
        url: after.url,
        submissionId: after.id,
        sourceId: COMMUNITY_PICKS_SOURCE,
      },
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
    expect(notifySubmissionRejected).toBeCalledTimes(1);
    expect(
      jest.mocked(notifySubmissionRejected).mock.calls[0].slice(1),
    ).toEqual([after]);
  });
});

describe('notification', () => {
  type ObjectType = Notification;
  const id = randomUUID();
  const base: ChangeObject<ObjectType> = {
    id,
    userId: '1',
    type: NotificationType.CommunityPicksGranted,
    title: 'hello',
    targetUrl: 'target',
    icon: 'icon',
    public: true,
    createdAt: Date.now(),
  };

  it('should notify new notification', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'notification',
      }),
    );
    expect(notifyNewNotification).toBeCalledTimes(1);
    expect(jest.mocked(notifyNewNotification).mock.calls[0].slice(1)).toEqual([
      after,
    ]);
  });
});

describe('source member', () => {
  type ObjectType = Partial<SourceMember>;
  const base: ChangeObject<ObjectType> = {
    userId: '1',
    sourceId: 'a',
    referralToken: 'rt',
    role: SourceMemberRoles.Member,
  };

  it('should notify on new source member', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: base,
        before: null,
        op: 'c',
        table: 'source_member',
      }),
    );
    expect(notifyMemberJoinedSource).toBeCalledTimes(1);
    expect(
      jest.mocked(notifyMemberJoinedSource).mock.calls[0].slice(1),
    ).toEqual([base]);
  });

  it('should notify when role changed', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      role: SourceMemberRoles.Admin,
    };
    await saveFixtures(con, User, [defaultUser]);
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'source_member',
      }),
    );
    expect(notifySourceMemberRoleChanged).toBeCalledTimes(1);
    expect(
      jest.mocked(notifySourceMemberRoleChanged).mock.calls[0].slice(1),
    ).toEqual([base.role, after]);
  });

  it("should not notify if role doesn't change", async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      referralToken: 'rtnew',
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'source_member',
      }),
    );
    expect(notifySourceMemberRoleChanged).toBeCalledTimes(0);
  });
});

describe('feature', () => {
  type ObjectType = Partial<Feature>;
  const base: ChangeObject<ObjectType> = {
    feature: FeatureType.Squad,
    userId: '1',
    createdAt: Date.now(),
  };

  it('should notify on new feature', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: base,
        before: null,
        op: 'c',
        table: 'feature',
      }),
    );
    expect(notifyFeatureAccess).toBeCalledTimes(1);
    expect(jest.mocked(notifyFeatureAccess).mock.calls[0].slice(1)).toEqual([
      base,
    ]);
  });
});

describe('source', () => {
  type ObjectType = Partial<Source>;
  const base: ChangeObject<ObjectType> = {
    id: 'a',
    private: true,
  };

  it('should notify on source privacy change', async () => {
    const after = { ...base, private: false };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'source',
      }),
    );
    expect(notifySourcePrivacyUpdated).toBeCalledTimes(1);
    expect(
      jest.mocked(notifySourcePrivacyUpdated).mock.calls[0].slice(1),
    ).toEqual([after]);
  });
});

describe('content image', () => {
  type ObjectType = Partial<ContentImage>;
  const base: ChangeObject<ObjectType> = {
    serviceId: '1',
  };

  it('should notify on content image deleted', async () => {
    const before = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        before,
        op: 'd',
        table: 'content_image',
      }),
    );
    expect(notifyContentImageDeleted).toBeCalledTimes(1);
    expect(
      jest.mocked(notifyContentImageDeleted).mock.calls[0].slice(1),
    ).toEqual([before]);
  });
});

describe('banner', () => {
  type ObjectType = Partial<Banner>;
  const base: ChangeObject<ObjectType> = {
    timestamp: Date.now(),
    title: 'test',
    subtitle: 'test',
    cta: 'test',
    url: 'test',
    theme: 'cabbage',
  };

  it('should notify on banner created', async () => {
    const before = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: before,
        before,
        op: 'c',
        table: 'banner',
      }),
    );
    expect(notifyBannerCreated).toBeCalledTimes(1);
    expect(jest.mocked(notifyBannerCreated).mock.calls[0].slice(1)).toEqual([
      before,
    ]);
  });

  it('should notify on banner deleted', async () => {
    const before = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        before,
        op: 'd',
        table: 'banner',
      }),
    );
    expect(notifyBannerRemoved).toBeCalledTimes(1);
    expect(jest.mocked(notifyBannerRemoved).mock.calls[0].slice(1)).toEqual([
      before,
    ]);
  });
});

import nock from 'nock';
import {
  CandidateStatus,
  OpportunityState,
  OpportunityType,
} from '@dailydotdev/schema';
import {
  Alerts,
  ArticlePost,
  Banner,
  Bookmark,
  CampaignCtaPlacement,
  type CampaignPost,
  type CampaignSource,
  CampaignState,
  CampaignType,
  ChecklistViewState,
  CollectionPost,
  Comment,
  CommentMention,
  COMMUNITY_PICKS_SOURCE,
  ContentImage,
  Feature,
  FeatureType,
  Feed,
  FREEFORM_POST_MINIMUM_CHANGE_LENGTH,
  FREEFORM_POST_MINIMUM_CONTENT_LENGTH,
  FreeformPost,
  MarketingCta,
  MarketingCtaStatus,
  NotificationV2,
  Organization,
  Post,
  PostKeyword,
  PostMention,
  PostRelation,
  PostRelationType,
  PostReport,
  PostType,
  ReputationEvent,
  ReputationReason,
  ReputationType,
  Settings,
  SharePost,
  Source,
  SourceFeed,
  SourceMember,
  SourceRequest,
  SourceType,
  SourceUser,
  SQUAD_IMAGE_PLACEHOLDER,
  SquadPublicRequest,
  SquadPublicRequestStatus,
  SquadSource,
  Submission,
  SubmissionStatus,
  UNKNOWN_SOURCE,
  User,
  UserCompany,
  UserMarketingCta,
  UserNotification,
  UserPost,
  UserState,
  UserStateKey,
  UserStreak,
  UserStreakAction,
  UserStreakActionType,
  YouTubePost,
} from '../../../src/entity';
import { PollPost } from '../../../src/entity/posts/PollPost';
import { PollOption } from '../../../src/entity/polls/PollOption';
import { addDays, addYears, isSameDay } from 'date-fns';
import {
  DayOfWeek,
  debeziumTimeToDate,
  demoCompany,
  notifyBannerCreated,
  notifyBannerRemoved,
  notifyCommentCommented,
  notifyCommentDeleted,
  notifyCommentEdited,
  notifyCommentReport,
  notifyContentImageDeleted,
  notifyContentRequested,
  notifyFeatureAccess,
  notifyFreeformContentRequested,
  notifyMemberJoinedSource,
  notifyNewCommentMention,
  notifyNewPostMention,
  notifyPostBannedOrRemoved,
  notifyPostCollectionUpdated,
  notifyPostCommented,
  notifyPostContentEdited,
  notifyPostReport,
  notifyPostVisible,
  notifyPostYggdrasilIdSet,
  notifyReputationIncrease,
  notifySendAnalyticsReport,
  notifySettingsUpdated,
  notifySourceFeedAdded,
  notifySourceFeedRemoved,
  notifySourceMemberRoleChanged,
  notifySourcePrivacyUpdated,
  notifySourceReport,
  notifySquadFeaturedUpdated,
  notifySubmissionGrantedAccess,
  notifySubmissionRejected,
  notifyUsernameChanged,
  notifyUserReadmeUpdated,
  PubSubSchema,
  triggerTypedEvent,
} from '../../../src/common';
import worker, {
  getRestoreStreakCache,
} from '../../../src/workers/cdc/primary';
import {
  doNotFake,
  expectSuccessfulBackground,
  expectTypedEvent,
  mockChangeMessage,
  saveFixtures,
} from '../../helpers';
import { ChangeObject, CoresRole, UserVote } from '../../../src/types';
import { sourcesFixture } from '../../fixture/source';
import {
  contentUpdatedPost,
  postKeywordsFixture,
  postsFixture,
  relatedPostsFixture,
} from '../../fixture/post';
import { randomUUID } from 'crypto';
import { DataSource, Not } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { TypeOrmError } from '../../../src/errors';
import { SourceMemberRoles } from '../../../src/roles';
import { CommentReport } from '../../../src/entity/CommentReport';
import { badUsersFixture, usersFixture } from '../../fixture/user';
import { DEFAULT_DEV_CARD_UNLOCKED_THRESHOLD } from '../../../src/workers/notifications/devCardUnlocked';
import { UserComment } from '../../../src/entity/user/UserComment';
import * as redisFile from '../../../src/redis';
import {
  getRedisKeysByPattern,
  getRedisObject,
  ioRedisPool,
  setRedisObject,
} from '../../../src/redis';
import {
  generateStorageKey,
  StorageKey,
  StorageTopic,
  submissionAccessThreshold,
} from '../../../src/config';
import { generateUUID } from '../../../src/ids';
import {
  cancelEntityReminderWorkflow,
  cancelReminderWorkflow,
  runEntityReminderWorkflow,
  runReminderWorkflow,
} from '../../../src/temporal/notifications/utils';
import { ReportReason } from '../../../src/entity/common';
import { SourceReport } from '../../../src/entity/sources/SourceReport';
import {
  SourcePostModeration,
  SourcePostModerationStatus,
} from '../../../src/entity/SourcePostModeration';
import { NotificationType } from '../../../src/notifications/common';
import type { UserReport } from '../../../src/entity/UserReport';
import { SubscriptionCycles } from '../../../src/paddle';
import type { ContentPreferenceUser } from '../../../src/entity/contentPreference/ContentPreferenceUser';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../../../src/entity/contentPreference/types';
import { OpportunityMatch } from '../../../src/entity/OpportunityMatch';
import { UserCandidatePreference } from '../../../src/entity/user/UserCandidatePreference';
import {
  OpportunityMatchStatus,
  OpportunityUserType,
} from '../../../src/entity/opportunities/types';
import { OpportunityJob } from '../../../src/entity/opportunities/OpportunityJob';
import {
  opportunitiesFixture,
  organizationsFixture,
} from '../../fixture/opportunity';
import { Opportunity } from '../../../src/entity/opportunities/Opportunity';
import type z from 'zod';
import type { entityReminderSchema } from '../../../src/common/schema/reminders';
import {
  ContentPreferenceOrganization,
  ContentPreferenceOrganizationStatus,
} from '../../../src/entity/contentPreference/ContentPreferenceOrganization';
import { OpportunityUser } from '../../../src/entity/opportunities/user';
import { UserExperience } from '../../../src/entity/user/experiences/UserExperience';
import { UserExperienceWork } from '../../../src/entity/user/experiences/UserExperienceWork';
import { UserExperienceType } from '../../../src/entity/user/experiences/types';
import { Company } from '../../../src/entity/Company';

jest.mock('../../../src/common', () => ({
  ...(jest.requireActual('../../../src/common') as Record<string, unknown>),
  triggerTypedEvent: jest.fn(),
  notifyCommentCommented: jest.fn(),
  notifyPostCommented: jest.fn(),
  notifyCommentEdited: jest.fn(),
  notifyCommentDeleted: jest.fn(),
  notifyUsernameChanged: jest.fn(),
  notifyMemberJoinedSource: jest.fn(),
  notifySendAnalyticsReport: jest.fn(),
  notifyPostBannedOrRemoved: jest.fn(),
  notifyPostReport: jest.fn(),
  notifySourceReport: jest.fn(),
  notifyCommentReport: jest.fn(),
  notifyReportUser: jest.fn(),
  notifySourceFeedAdded: jest.fn(),
  notifySourceFeedRemoved: jest.fn(),
  notifySettingsUpdated: jest.fn(),
  notifySubmissionRejected: jest.fn(),
  notifySubmissionGrantedAccess: jest.fn(),
  notifyNewPostMention: jest.fn(),
  notifyNewCommentMention: jest.fn(),
  notifyNewNotification: jest.fn(),
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
  notifyPostYggdrasilIdSet: jest.fn(),
  notifyPostCollectionUpdated: jest.fn(),
  notifyUserReadmeUpdated: jest.fn(),
  notifyReputationIncrease: jest.fn(),
  runReminderWorkflow: jest.fn(),
  cancelReminderWorkflow: jest.fn(),
  notifySquadFeaturedUpdated: jest.fn(),
}));

jest.mock('../../../src/temporal/notifications/utils', () => ({
  ...jest.requireActual('../../../src/temporal/notifications/utils'),
  runReminderWorkflow: jest.fn(),
  cancelReminderWorkflow: jest.fn(),
  runEntityReminderWorkflow: jest.fn(),
  cancelEntityReminderWorkflow: jest.fn(),
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
  twitter: null,
  username: 'idoshamun',
  infoConfirmed: true,
  acceptedMarketing: true,
  notificationEmail: true,
  acquisitionChannel: null,
  experienceLevel: null,
  flags: {
    trustScore: 1,
    vordr: false,
  },
  language: null,
  followingEmail: true,
  followNotifications: true,
  awardEmail: true,
  awardNotifications: true,
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
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'pub-request',
      { reason: 'new', sourceRequest: after },
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
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'pub-request',
      { reason: 'publish', sourceRequest: after },
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
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'pub-request',
      { reason: 'decline', sourceRequest: after },
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
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'pub-request',
      { reason: 'approve', sourceRequest: after },
    ]);
  });
});

describe('post upvote', () => {
  type ObjectType = UserPost;
  const base: ChangeObject<ObjectType> = {
    userId: '1',
    postId: 'p1',
    votedAt: 0,
    vote: UserVote.Up,
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
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'post-upvoted',
      {
        postId: 'p1',
        userId: '1',
      },
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
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'post-upvote-canceled',
      { postId: 'p1', userId: '1' },
    ]);
  });

  it('should notify on upvote updated', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: base,
        before: {
          ...base,
          vote: UserVote.None,
        },
        op: 'u',
        table: 'user_post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'post-upvoted',
      {
        postId: 'p1',
        userId: '1',
      },
    ]);
  });

  it('should notify on upvote canceled', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: {
          ...base,
          vote: UserVote.None,
        },
        before: base,
        op: 'u',
        table: 'user_post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'post-upvote-canceled',
      { postId: 'p1', userId: '1' },
    ]);
  });

  it('should notify on upvote from downvote', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: {
          ...base,
          vote: UserVote.Up,
        },
        before: {
          ...base,
          vote: UserVote.Down,
        },
        op: 'u',
        table: 'user_post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(2);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.post-downvote-canceled',
      { postId: 'p1', userId: '1' },
    ]);
    expect(jest.mocked(triggerTypedEvent).mock.calls[1].slice(1)).toEqual([
      'post-upvoted',
      { postId: 'p1', userId: '1' },
    ]);
  });

  it('should not notify when vote stays the same', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: base,
        before: base,
        op: 'u',
        table: 'user_post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
  });
});

describe('comment upvote', () => {
  type ObjectType = UserComment;
  const base: ChangeObject<ObjectType> = {
    userId: '1',
    commentId: 'c1',
    votedAt: 0,
    vote: UserVote.Up,
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
        table: 'user_comment',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'comment-upvoted',
      {
        commentId: 'c1',
        userId: '1',
      },
    ]);
  });

  it('should notify on upvote deleted', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: null,
        before: base,
        op: 'd',
        table: 'user_comment',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'comment-upvote-canceled',
      { commentId: 'c1', userId: '1' },
    ]);
  });

  it('should notify on upvote updated', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: base,
        before: {
          ...base,
          vote: UserVote.None,
        },
        op: 'u',
        table: 'user_comment',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'comment-upvoted',
      {
        commentId: 'c1',
        userId: '1',
      },
    ]);
  });

  it('should notify on upvote canceled', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: {
          ...base,
          vote: UserVote.None,
        },
        before: base,
        op: 'u',
        table: 'user_comment',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'comment-upvote-canceled',
      { commentId: 'c1', userId: '1' },
    ]);
  });

  it('should notify on upvote from downvote', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: {
          ...base,
          vote: UserVote.Up,
        },
        before: {
          ...base,
          vote: UserVote.Down,
        },
        op: 'u',
        table: 'user_comment',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(2);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.comment-downvote-canceled',
      { commentId: 'c1', userId: '1' },
    ]);
    expect(jest.mocked(triggerTypedEvent).mock.calls[1].slice(1)).toEqual([
      'comment-upvoted',
      { commentId: 'c1', userId: '1' },
    ]);
  });

  it('should not notify when vote stays the same', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: base,
        before: base,
        op: 'u',
        table: 'user_comment',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
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
    downvotes: 0,
    featured: false,
    createdAt: 0,
    lastUpdatedAt: 0,
    flags: {
      vordr: false,
    },
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
    expect(notifyPostCommented).toHaveBeenCalledTimes(1);
    expect(jest.mocked(notifyPostCommented).mock.calls[0].slice(1)).toEqual([
      'p1',
      '1',
      'c1',
      '<p>comment</p>',
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
    expect(notifyCommentCommented).toHaveBeenCalledTimes(1);
    expect(jest.mocked(notifyCommentCommented).mock.calls[0].slice(1)).toEqual([
      'p1',
      '1',
      'c2',
      'c1',
      '<p>comment</p>',
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
    expect(notifyCommentEdited).toHaveBeenCalledTimes(1);
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
    expect(notifyCommentDeleted).toHaveBeenCalledTimes(1);
    expect(jest.mocked(notifyCommentDeleted).mock.calls[0].slice(1)).toEqual([
      base,
    ]);
  });
});

describe('user', () => {
  type ObjectType = Omit<User, 'createdAt'>;
  const base: ChangeObject<ObjectType> = { ...defaultUser };

  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
  });

  it('should notify on user created', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: base,
        table: 'user',
        op: 'c',
      }),
    );
    expectTypedEvent('api.v1.user-created', {
      user: base,
    } as unknown as PubSubSchema['api.v1.user-created']);
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
    expectTypedEvent('user-updated', {
      user: base,
      newProfile: after,
    } as unknown as PubSubSchema['user-updated']);
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
    expect(notifyUsernameChanged).toHaveBeenCalledTimes(1);
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

  it('should call notifyReputationIncrease when the user reputation has increased', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      reputation: DEFAULT_DEV_CARD_UNLOCKED_THRESHOLD,
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
    expect(notifyReputationIncrease).toHaveBeenCalledTimes(1);
    expect(
      jest.mocked(notifyReputationIncrease).mock.calls[0].slice(1)[0],
    ).toEqual(base);
    expect(
      jest.mocked(notifyReputationIncrease).mock.calls[0].slice(2)[0],
    ).toEqual(after);
  });

  it('should NOT call notifyReputationIncrease when the user reputation has not increased', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
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
    expect(notifyReputationIncrease).not.toHaveBeenCalled();
  });

  it('should notify on user readme updated', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      readme: 'hello',
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
    expect(notifyUserReadmeUpdated).toHaveBeenCalledTimes(1);
    expect(jest.mocked(notifyUserReadmeUpdated).mock.calls[0].slice(1)).toEqual(
      [after],
    );
  });

  it('should notify on gift plus subscription', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      subscriptionFlags: JSON.stringify({
        cycle: SubscriptionCycles.Yearly,
        gifterId: '2',
        giftExpirationDate: addYears(new Date(), 1),
      }),
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
    expectTypedEvent('user-updated', {
      user: base,
      newProfile: after,
    } as unknown as PubSubSchema['user-updated']);
  });

  describe('update user source', () => {
    beforeEach(async () => {
      await saveFixtures(con, SourceUser, [
        { id: '1', userId: '1', handle: 'idoshamun', name: 'Ido' },
      ]);
    });

    it('should update user source when name changed', async () => {
      expect(
        await con.getRepository(SourceUser).findOneBy({ userId: '1' }),
      ).toMatchObject({
        name: 'Ido',
      });

      const after: ChangeObject<ObjectType> = {
        ...base,
        name: 'New Ido Shamun',
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
      expectTypedEvent('user-updated', {
        user: base,
        newProfile: after,
      } as unknown as PubSubSchema['user-updated']);

      expect(
        await con.getRepository(SourceUser).findOneBy({ userId: '1' }),
      ).toMatchObject({
        name: 'New Ido Shamun',
      });
    });

    it('should update user source when image changed', async () => {
      expect(
        await con.getRepository(SourceUser).findOneBy({ userId: '1' }),
      ).toMatchObject({
        image: SQUAD_IMAGE_PLACEHOLDER,
      });

      const after: ChangeObject<ObjectType> = {
        ...base,
        image: 'https://daily.dev/new-image.jpg',
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
      expectTypedEvent('user-updated', {
        user: base,
        newProfile: after,
      } as unknown as PubSubSchema['user-updated']);

      expect(
        await con.getRepository(SourceUser).findOneBy({ userId: '1' }),
      ).toMatchObject({
        name: 'Ido',
        image: 'https://daily.dev/new-image.jpg',
      });
    });

    it('fallback to username when no name', async () => {
      const after: ChangeObject<ObjectType> = {
        ...base,
        name: null,
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
      expectTypedEvent('user-updated', {
        user: base,
        newProfile: after,
      } as unknown as PubSubSchema['user-updated']);

      expect(
        await con.getRepository(SourceUser).findOneBy({ userId: '1' }),
      ).toMatchObject({
        name: 'idoshamun',
      });
    });

    it('fallback to default image when no image', async () => {
      await con
        .getRepository(SourceUser)
        .update({ userId: '1' }, { image: 'http://daily.dev/image.jpg' });
      const after: ChangeObject<ObjectType> = {
        ...base,
        image: null,
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
      expectTypedEvent('user-updated', {
        user: base,
        newProfile: after,
      } as unknown as PubSubSchema['user-updated']);

      expect(
        await con.getRepository(SourceUser).findOneBy({ userId: '1' }),
      ).toMatchObject({
        image: SQUAD_IMAGE_PLACEHOLDER,
      });
    });

    it('should do nothing if user source does not exist', async () => {
      const before = { ...base, id: '2' };
      const after: ChangeObject<ObjectType> = {
        ...base,
        id: '2',
        name: 'New Ido Shamun',
      };

      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before,
          table: 'user',
          op: 'u',
        }),
      );
      expectTypedEvent('user-updated', {
        user: before,
        newProfile: after,
      } as unknown as PubSubSchema['user-updated']);

      expect(
        await con.getRepository(SourceUser).countBy({ userId: '2' }),
      ).toEqual(0);
    });
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
    expect(notifySubmissionGrantedAccess).toHaveBeenCalledTimes(1);
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
    expect(notifyNewCommentMention).toHaveBeenCalledTimes(1);
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
    expect(notifyNewPostMention).toHaveBeenCalledTimes(1);
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
    expect(notifyPostVisible).toHaveBeenCalledTimes(0);
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
    expect(notifyPostVisible).toHaveBeenCalledTimes(1);
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
    expect(notifyPostVisible).toHaveBeenCalledTimes(1);
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
    expect(notifyPostContentEdited).toHaveBeenCalledTimes(0);
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
    expect(notifyPostContentEdited).toHaveBeenCalledTimes(1);
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
    expect(notifySendAnalyticsReport).toHaveBeenCalledTimes(1);
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
    expect(notifyPostBannedOrRemoved).toHaveBeenCalledTimes(1);
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
    expect(notifyPostBannedOrRemoved).toHaveBeenCalledTimes(1);
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
    expect(notifyPostBannedOrRemoved).toHaveBeenCalledTimes(0);
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
      statsUpdatedAt: 0,
      flags: JSON.stringify(oldPost?.flags),
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
      statsUpdatedAt: 0,
      flags: JSON.stringify(oldPost?.flags),
    };
    const after: ChangeObject<ObjectType> = {
      ...localBase,
      flags: JSON.stringify({
        promoteToPublic: 123,
      }),
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

  it('should notify for new freeform post greater than the required amount characters', async () => {
    const after = {
      ...base,
      type: PostType.Freeform,
      content: '1'.repeat(FREEFORM_POST_MINIMUM_CONTENT_LENGTH),
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

    expect(notifyFreeformContentRequested).toHaveBeenCalledTimes(1);
    expect(
      jest.mocked(notifyFreeformContentRequested).mock.calls[0][1].payload
        .after,
    ).toEqual(after);
  });

  it('should notify for new freeform post when title and content is greater than the required amount characters', async () => {
    const after = {
      ...base,
      type: PostType.Freeform,
      // not setting content, title length should be enough
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

    expect(notifyFreeformContentRequested).toHaveBeenCalledTimes(1);
    expect(
      jest.mocked(notifyFreeformContentRequested).mock.calls[0][1].payload
        .after,
    ).toEqual(after);
  });

  it('should not notify for new freeform post when title and content is less than the required amount characters', async () => {
    const after = {
      ...base,
      type: PostType.Freeform,
      content: '',
    };
    after.title = '';

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'post',
      }),
    );

    expect(notifyFreeformContentRequested).toHaveBeenCalledTimes(0);
  });

  it('should not notify on welcome post', async () => {
    const after = {
      ...base,
      type: PostType.Welcome,
      content: '1'.repeat(FREEFORM_POST_MINIMUM_CONTENT_LENGTH),
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

    expect(notifyContentRequested).toHaveBeenCalledTimes(0);
  });

  it('should not notify on shared post', async () => {
    const after = {
      ...base,
      type: PostType.Share,
      content: '1'.repeat(FREEFORM_POST_MINIMUM_CONTENT_LENGTH),
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

    expect(notifyContentRequested).toHaveBeenCalledTimes(0);
  });

  it('should notify for edited freeform post greater than the required amount edited characters', async () => {
    const before = {
      ...base,
      type: PostType.Freeform,
      content: '1',
    };

    const after = {
      ...before,
      content: before.content + '2'.repeat(FREEFORM_POST_MINIMUM_CHANGE_LENGTH),
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

    expect(notifyFreeformContentRequested).toHaveBeenCalledTimes(1);
    expect(
      jest.mocked(notifyFreeformContentRequested).mock.calls[0][1].payload
        .before,
    ).toEqual(before);
    expect(
      jest.mocked(notifyFreeformContentRequested).mock.calls[0][1].payload
        .after,
    ).toEqual(after);
  });

  it('should not notify for edited freeform post less than the required amount edited characters', async () => {
    const before = {
      ...base,
      type: PostType.Freeform,
      content: '1',
    };

    const after = {
      ...before,
      content:
        before.content + '2'.repeat(FREEFORM_POST_MINIMUM_CHANGE_LENGTH - 1),
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

    expect(notifyContentRequested).toHaveBeenCalledTimes(0);
  });

  it('should notify when yggdrasil id is available on creation', async () => {
    const after = {
      ...base,
      yggdrasilId: 'yid',
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
    expect(notifyPostYggdrasilIdSet).toHaveBeenCalledTimes(1);
    expect(
      jest.mocked(notifyPostYggdrasilIdSet).mock.calls[0].slice(1),
    ).toEqual([after]);
  });

  it('should notify when yggdrasil id is available on update', async () => {
    const after = {
      ...base,
      yggdrasilId: 'yid',
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
    expect(notifyPostYggdrasilIdSet).toHaveBeenCalledTimes(1);
    expect(
      jest.mocked(notifyPostYggdrasilIdSet).mock.calls[0].slice(1),
    ).toEqual([after]);
  });

  it('should not notify when yggdrasil id was already available', async () => {
    const after = {
      ...base,
      yggdrasilId: 'yid',
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: after,
        op: 'u',
        table: 'post',
      }),
    );
    expect(notifyPostYggdrasilIdSet).toHaveBeenCalledTimes(0);
  });

  it('should notify on post metrics changed', async () => {
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, ArticlePost, postsFixture);
    const oldPost = await con.getRepository(Post).findOneBy({ id: 'p1' });

    const before = {
      ...oldPost,
      flags: '{}',
    };
    const after: ChangeObject<ObjectType> = {
      ...before,
      flags: '{}',
      upvotes: 10,
      downvotes: 5,
      comments: 2,
      awards: 1,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: after,
        before: before,
        op: 'u',
        table: 'post',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(2);
    expect(jest.mocked(triggerTypedEvent).mock.calls[1].slice(1)).toEqual([
      'api.v1.post-metrics-updated',
      {
        postId: 'p1',
        payload: {
          upvotes: 10,
          downvotes: 5,
          comments: 2,
          awards: 1,
        },
      },
    ]);
  });

  describe('collection', () => {
    it('should notify when collection content is updated', async () => {
      const before = {
        ...base,
        type: PostType.Collection,
        content: 'before',
      };

      const after = { ...before, content: 'after' };

      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before,
          op: 'u',
          table: 'post',
        }),
      );
      expect(notifyPostCollectionUpdated).toHaveBeenCalledTimes(1);
    });

    it('should notify when collection summary is updated', async () => {
      const before = {
        ...base,
        type: PostType.Collection,
        summary: 'before',
      };
      const after = { ...before, summary: 'after' };

      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before,
          op: 'u',
          table: 'post',
        }),
      );
      expect(notifyPostCollectionUpdated).toHaveBeenCalledTimes(1);
    });

    it('should not notify when neither collection summary or content is not updated', async () => {
      const before = {
        ...base,
        type: PostType.Collection,
        title: 'Before',
        summary: 'before',
        content: 'before',
      };
      const after = {
        ...before,
        after: 'After',
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
      expect(notifyPostCollectionUpdated).toHaveBeenCalledTimes(0);
    });
  });
});

describe('comment report', () => {
  type ObjectType = CommentReport;
  const base: ChangeObject<ObjectType> = {
    userId: 'u1',
    commentId: 'c1',
    createdAt: 0,
    reason: ReportReason.Misinformation,
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
    expect(notifyCommentReport).toHaveBeenCalledTimes(1);
    expect(notifyCommentReport).toBeCalledWith(
      'u1',
      comment,
      'False Information or Misinformation',
      'Test note',
    );
  });
});

describe('User report', () => {
  type ObjectType = UserReport;
  const base: ChangeObject<ObjectType> = {
    reportedUserId: '2',
    reason: ReportReason.Harassment,
    note: 'This guy is very mean',
  };

  it('should notify on new user report', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'user_report',
      }),
    );
  });
});

describe('post report', () => {
  type ObjectType = PostReport;
  const base: ChangeObject<ObjectType> = {
    userId: 'u1',
    postId: 'p1',
    createdAt: 0,
    reason: ReportReason.Broken,
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
    expect(notifyPostReport).toHaveBeenCalledTimes(1);
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
    expect(notifyPostReport).toHaveBeenCalledTimes(1);
    expect(notifyPostReport).toBeCalledWith(
      'u1',
      post,
      '💔 Link is broken',
      'Test comment',
      ['php', 'webdev'],
    );
  });
});

describe('source report', () => {
  type ObjectType = SourceReport;
  const base: ChangeObject<ObjectType> = {
    userId: 'u1',
    sourceId: 'a',
    createdAt: 0,
    reason: ReportReason.Harassment,
    comment: 'Test comment',
  };

  beforeEach(async () => {
    await saveFixtures(con, Source, sourcesFixture);
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
  });

  it('should notify on new source report', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'source_report',
      }),
    );
    const source = await con.getRepository(Source).findOneBy({ id: 'a' });
    expect(notifySourceReport).toHaveBeenCalledTimes(1);
    expect(notifySourceReport).toHaveBeenCalledWith(
      'u1',
      source,
      '🤬 Harrasment or bullying',
      'Test comment',
    );
  });
});

describe('feed', () => {
  type ObjectType = Feed;
  const base: ChangeObject<ObjectType> = {
    userId: '1',
    id: '1',
    slug: '1',
    flags: {},
    createdAt: Date.now(),
  };

  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
  });

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
    optOutReadingStreak: false,
    optOutCompanion: false,
    autoDismissNotifications: true,
    campaignCtaPlacement: CampaignCtaPlacement.Header,
    updatedAt: date.getTime(),
    onboardingChecklistView: ChecklistViewState.Hidden,
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
    expect(notifySettingsUpdated).toHaveBeenCalledTimes(1);
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
    expect(notifySettingsUpdated).toHaveBeenCalledTimes(1);
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
    expect(notifySourceFeedAdded).toHaveBeenCalledTimes(1);
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
    expect(notifySourceFeedRemoved).toHaveBeenCalledTimes(1);
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

  it('should notify post reputation on create', async () => {
    const after = { ...base, targetType: ReputationType.Post, targetId: 'p1' };

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: after,
        before: null,
        op: 'c',
        table: 'reputation_event',
      }),
    );

    expectTypedEvent('api.v1.reputation-event', {
      op: 'c',
      payload: after,
    });
  });

  it('should notify post reputation on delete', async () => {
    const before = { ...base, targetType: ReputationType.Post, targetId: 'p1' };

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: null,
        before: before,
        op: 'd',
        table: 'reputation_event',
      }),
    );

    expectTypedEvent('api.v1.reputation-event', {
      op: 'd',
      payload: before,
    });
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
    flags: {},
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
    expect(notifyContentRequested).toHaveBeenCalledTimes(1);
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
    expect(notifySubmissionRejected).toHaveBeenCalledTimes(1);
    expect(
      jest.mocked(notifySubmissionRejected).mock.calls[0].slice(1),
    ).toEqual([after]);
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
    expect(notifyMemberJoinedSource).toHaveBeenCalledTimes(1);
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
    expect(notifySourceMemberRoleChanged).toHaveBeenCalledTimes(1);
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
    expect(notifySourceMemberRoleChanged).toHaveBeenCalledTimes(0);
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
    expect(notifyFeatureAccess).toHaveBeenCalledTimes(1);
    expect(jest.mocked(notifyFeatureAccess).mock.calls[0].slice(1)).toEqual([
      base,
    ]);
  });
});

describe('source', () => {
  type ObjectType = Partial<SquadSource>;
  const base: ChangeObject<ObjectType> = {
    id: 'a',
    private: true,
  };
  const flags = JSON.stringify({
    featured: true,
    totalViews: 0,
    totalUpvotes: 0,
    totalPosts: 0,
  }) as never;

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
    expect(notifySourcePrivacyUpdated).toHaveBeenCalledTimes(1);
    expect(
      jest.mocked(notifySourcePrivacyUpdated).mock.calls[0].slice(1),
    ).toEqual([after]);
  });

  it('should notify when squad is featured from non-featured', async () => {
    const after = { ...base, flags };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'source',
      }),
    );
    expect(notifySquadFeaturedUpdated).toHaveBeenCalledTimes(1);
    expect(
      jest.mocked(notifySquadFeaturedUpdated).mock.calls[0].slice(1),
    ).toEqual([{ ...after, flags: JSON.parse(flags) }]);
  });

  it('should not notify when squad is featured and some other column changed', async () => {
    const after = { ...base, flags, name: 'Aaa' };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: { ...base, flags },
        op: 'u',
        table: 'source',
      }),
    );
    expect(notifySquadFeaturedUpdated).not.toHaveBeenCalled();
  });

  it('should approve all pending posts when switching `moderationRequired` to false', async () => {
    // update everything
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, User, usersFixture);
    await con
      .getRepository(Source)
      .update({ type: SourceType.Machine }, { type: SourceType.Squad });
    await con
      .getRepository(SquadSource)
      .createQueryBuilder()
      .update({ moderationRequired: true })
      .execute();
    await con.getRepository(SourcePostModeration).save([
      {
        sourceId: 'a',
        type: PostType.Share,
        createdById: '1',
        status: SourcePostModerationStatus.Pending,
      },
      {
        sourceId: 'a',
        type: PostType.Share,
        createdById: '2',
        status: SourcePostModerationStatus.Pending,
      },
      {
        sourceId: 'a',
        type: PostType.Share,
        createdById: '3',
        status: SourcePostModerationStatus.Approved,
      },
      {
        sourceId: 'a',
        type: PostType.Share,
        createdById: '4',
        status: SourcePostModerationStatus.Rejected,
      },
    ]);

    const after = { ...base, moderationRequired: false };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: { ...base, moderationRequired: true },
        op: 'u',
        table: 'source',
      }),
    );

    const pendingPosts = await con
      .getRepository(SourcePostModeration)
      .findBy({ sourceId: 'a', status: SourcePostModerationStatus.Pending });
    expect(pendingPosts.length).toBe(0);

    const approvedPosts = await con
      .getRepository(SourcePostModeration)
      .findBy({ sourceId: 'a', status: SourcePostModerationStatus.Approved });
    expect(approvedPosts.length).toBe(3); // 2 pending + 1 already approved

    const rejectedPosts = await con
      .getRepository(SourcePostModeration)
      .findBy({ sourceId: 'a', status: SourcePostModerationStatus.Rejected });
    expect(rejectedPosts.length).toBe(1);
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
    expect(notifyContentImageDeleted).toHaveBeenCalledTimes(1);
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
    expect(notifyBannerCreated).toHaveBeenCalledTimes(1);
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
    expect(notifyBannerRemoved).toHaveBeenCalledTimes(1);
    expect(jest.mocked(notifyBannerRemoved).mock.calls[0].slice(1)).toEqual([
      before,
    ]);
  });
});

describe('post relation collection', () => {
  type ObjectType = PostRelation;

  beforeEach(async () => {
    jest.resetAllMocks();

    await con.getRepository(Source).save(sourcesFixture);
    await con.getRepository(ArticlePost).save(postsFixture);
    await con.getRepository(CollectionPost).save({
      id: 'pc1',
      shortId: 'pc1',
      title: 'PC1',
      description: 'pc1',
      image: 'https://daily.dev/image.jpg',
      sourceId: 'a',
      tagsStr: 'javascript,webdev',
      type: PostType.Collection,
      collectionSources: [],
    });
  });

  it('should update collection sources', async () => {
    const collection = await con.getRepository(CollectionPost).findOneByOrFail({
      id: 'pc1',
    });

    expect(collection.collectionSources.length).toBe(0);

    const postRelations = await con.getRepository(PostRelation).save([
      {
        postId: 'pc1',
        relatedPostId: 'p1',
        type: PostRelationType.Collection,
      },
      {
        postId: 'pc1',
        relatedPostId: 'p2',
        type: PostRelationType.Collection,
      },
    ]);

    for (const postRelation of postRelations) {
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after: postRelation as unknown as ChangeObject<PostRelation>,
          before: undefined,
          op: 'c',
          table: 'post_relation',
        }),
      );
    }

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: postRelations[0] as unknown as ChangeObject<PostRelation>,
        before: undefined,
        op: 'c',
        table: 'post_relation',
      }),
    );

    const collectionAfterWorker = await con
      .getRepository(CollectionPost)
      .findOneByOrFail({
        id: 'pc1',
      });

    expect(collectionAfterWorker.collectionSources.length).toBe(2);
    expect(collectionAfterWorker.collectionSources).toIncludeSameMembers([
      'a',
      'b',
    ]);
  });

  it(`shouldn't deduplicate collection sources`, async () => {
    const collection = await con.getRepository(CollectionPost).findOneByOrFail({
      id: 'pc1',
    });

    expect(collection.collectionSources.length).toBe(0);

    await con.getRepository(ArticlePost).save([
      {
        id: 'p1',
        sourceId: 'a',
      },
      {
        id: 'p2',
        sourceId: 'a',
      },
    ]);

    const postRelations = await con.getRepository(PostRelation).save([
      {
        postId: 'pc1',
        relatedPostId: 'p1',
        type: PostRelationType.Collection,
      },
      {
        postId: 'pc1',
        relatedPostId: 'p2',
        type: PostRelationType.Collection,
      },
    ]);

    for (const postRelation of postRelations) {
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after: postRelation as unknown as ChangeObject<PostRelation>,
          before: undefined,
          op: 'c',
          table: 'post_relation',
        }),
      );
    }

    const collectionAfterWorker = await con
      .getRepository(CollectionPost)
      .findOneByOrFail({
        id: 'pc1',
      });

    expect(collectionAfterWorker.collectionSources.length).toBe(2);
    expect(collectionAfterWorker.collectionSources).toIncludeSameMembers([
      'a',
      'a',
    ]);
  });
});

describe('post downvote', () => {
  type ObjectType = UserPost;
  const base: ChangeObject<ObjectType> = {
    userId: '1',
    postId: 'p1',
    votedAt: 0,
    vote: UserVote.Down,
    hidden: false,
    updatedAt: 0,
    createdAt: 0,
    flags: {},
  };

  it('should notify on new downvote', async () => {
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
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.post-downvoted',
      {
        postId: 'p1',
        userId: '1',
      },
    ]);
  });

  it('should notify on downvote deleted', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: null,
        before: base,
        op: 'd',
        table: 'user_post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.post-downvote-canceled',
      { postId: 'p1', userId: '1' },
    ]);
  });

  it('should notify on downvote updated', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: base,
        before: {
          ...base,
          vote: UserVote.None,
        },
        op: 'u',
        table: 'user_post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.post-downvoted',
      {
        postId: 'p1',
        userId: '1',
      },
    ]);
  });

  it('should notify on downvote canceled', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: {
          ...base,
          vote: UserVote.None,
        },
        before: base,
        op: 'u',
        table: 'user_post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.post-downvote-canceled',
      { postId: 'p1', userId: '1' },
    ]);
  });

  it('should notify on downvote from upvote', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: {
          ...base,
          vote: UserVote.Down,
        },
        before: {
          ...base,
          vote: UserVote.Up,
        },
        op: 'u',
        table: 'user_post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(2);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'post-upvote-canceled',
      { postId: 'p1', userId: '1' },
    ]);
    expect(jest.mocked(triggerTypedEvent).mock.calls[1].slice(1)).toEqual([
      'api.v1.post-downvoted',
      { postId: 'p1', userId: '1' },
    ]);
  });

  it('should not notify when vote stays the same', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: base,
        before: base,
        op: 'u',
        table: 'user_post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
  });
});

describe('comment downvote', () => {
  type ObjectType = UserComment;
  const base: ChangeObject<ObjectType> = {
    userId: '1',
    commentId: 'c1',
    votedAt: 0,
    vote: UserVote.Down,
    updatedAt: 0,
    createdAt: 0,
    flags: {},
  };

  it('should notify on new downvote', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'user_comment',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.comment-downvoted',
      {
        commentId: 'c1',
        userId: '1',
      },
    ]);
  });

  it('should notify on downvote deleted', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: null,
        before: base,
        op: 'd',
        table: 'user_comment',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.comment-downvote-canceled',
      { commentId: 'c1', userId: '1' },
    ]);
  });

  it('should notify on downvote updated', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: base,
        before: {
          ...base,
          vote: UserVote.None,
        },
        op: 'u',
        table: 'user_comment',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.comment-downvoted',
      {
        commentId: 'c1',
        userId: '1',
      },
    ]);
  });

  it('should notify on downvote canceled', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: {
          ...base,
          vote: UserVote.None,
        },
        before: base,
        op: 'u',
        table: 'user_comment',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.comment-downvote-canceled',
      { commentId: 'c1', userId: '1' },
    ]);
  });

  it('should notify on downvote from upvote', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: {
          ...base,
          vote: UserVote.Down,
        },
        before: {
          ...base,
          vote: UserVote.Up,
        },
        op: 'u',
        table: 'user_comment',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(2);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'comment-upvote-canceled',
      { commentId: 'c1', userId: '1' },
    ]);
    expect(jest.mocked(triggerTypedEvent).mock.calls[1].slice(1)).toEqual([
      'api.v1.comment-downvoted',
      { commentId: 'c1', userId: '1' },
    ]);
  });

  it('should not notify when vote stays the same', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: base,
        before: base,
        op: 'u',
        table: 'user_comment',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
  });
});

describe('marketing cta', () => {
  type ObjectType = MarketingCta;
  const base: ChangeObject<ObjectType> = {
    campaignId: 'worlds-best-campaign',
    variant: 'card',
    status: MarketingCtaStatus.Active,
    createdAt: 0,
    flags: {
      title: 'Join the best community in the world',
      description: 'Join the best community in the world',
      ctaUrl: 'http://localhost:5002',
      ctaText: 'Join now',
    },
  };

  beforeEach(async () => {
    await ioRedisPool.execute((client) => client.flushall());
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, MarketingCta, [
      { ...base, createdAt: new Date('2024-03-13 12:00:00') },
    ]);
    await saveFixtures(
      con,
      UserMarketingCta,
      usersFixture.map((user) => ({
        marketingCtaId: 'worlds-best-campaign',
        userId: user.id,
        createdAt: new Date('2024-03-13 12:00:00'),
      })),
    );

    for (const user of usersFixture) {
      await setRedisObject(
        generateStorageKey(
          StorageTopic.Boot,
          StorageKey.MarketingCta,
          user.id as string,
        ),
        // Don't really care about the value in these tests
        'not null',
      );
    }
  });

  describe('on create', () => {
    it('should not clear any keys when a new marketing cta is created', async () => {
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after: base,
          before: null,
          op: 'c',
          table: 'marketing_cta',
        }),
      );

      expect(
        await getRedisObject(
          generateStorageKey(
            StorageTopic.Boot,
            StorageKey.MarketingCta,
            usersFixture[0].id as string,
          ),
        ),
      ).not.toBeNull();
      expect(
        await getRedisObject(
          generateStorageKey(
            StorageTopic.Boot,
            StorageKey.MarketingCta,
            usersFixture[1].id as string,
          ),
        ),
      ).not.toBeNull();

      expect(
        await getRedisKeysByPattern(
          generateStorageKey(StorageTopic.Boot, StorageKey.MarketingCta, '*'),
        ),
      ).toHaveLength(4);
    });
  });

  describe('on update', () => {
    it('should clear boot cache for users assigned to the campaign and have not interacted with it', async () => {
      await con.getRepository(UserMarketingCta).update(
        {
          userId: usersFixture[0].id,
        },
        {
          readAt: new Date('2024-03-13 13:00:00'),
        },
      );

      expect(
        await getRedisObject(
          generateStorageKey(
            StorageTopic.Boot,
            StorageKey.MarketingCta,
            usersFixture[0].id as string,
          ),
        ),
      ).not.toBeNull();
      expect(
        await getRedisObject(
          generateStorageKey(
            StorageTopic.Boot,
            StorageKey.MarketingCta,
            usersFixture[1].id as string,
          ),
        ),
      ).not.toBeNull();

      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after: base,
          before: base,
          op: 'u',
          table: 'marketing_cta',
        }),
      );

      expect(
        await getRedisObject(
          generateStorageKey(
            StorageTopic.Boot,
            StorageKey.MarketingCta,
            usersFixture[0].id as string,
          ),
        ),
      ).not.toBeNull();
      expect(
        await getRedisObject(
          generateStorageKey(
            StorageTopic.Boot,
            StorageKey.MarketingCta,
            usersFixture[1].id as string,
          ),
        ),
      ).toBeNull();

      expect(
        await getRedisKeysByPattern(
          generateStorageKey(StorageTopic.Boot, StorageKey.MarketingCta, '*'),
        ),
      ).toHaveLength(1);
    });
  });

  describe('on delete', () => {
    // This is handled by the the UserMarketingCta deletion
    it('should not clear boot cache for users assigned to the campaign', async () => {
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after: null,
          before: base,
          op: 'd',
          table: 'marketing_cta',
        }),
      );

      expect(
        await getRedisObject(
          generateStorageKey(
            StorageTopic.Boot,
            StorageKey.MarketingCta,
            usersFixture[0].id as string,
          ),
        ),
      ).not.toBeNull();
      expect(
        await getRedisObject(
          generateStorageKey(
            StorageTopic.Boot,
            StorageKey.MarketingCta,
            usersFixture[1].id as string,
          ),
        ),
      ).not.toBeNull();

      expect(
        await getRedisKeysByPattern(
          generateStorageKey(StorageTopic.Boot, StorageKey.MarketingCta, '*'),
        ),
      ).toHaveLength(4);
    });
  });
});

describe('squad public request', () => {
  type ObjectType = SquadPublicRequest;
  const base: ChangeObject<ObjectType> = {
    requestorId: '1',
    sourceId: 'a',
    status: SquadPublicRequestStatus.Pending,
    id: generateUUID(),
    createdAt: new Date().getTime(),
    updatedAt: null,
  };

  it('should notify on new request', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'squad_public_request',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.squad-public-request',
      { request: base },
    ]);
  });

  it('should notify on approved request', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      updatedAt: new Date().getTime(),
      status: SquadPublicRequestStatus.Approved,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'squad_public_request',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.squad-public-request',
      { request: after },
    ]);
  });

  it('should notify on rejected request', async () => {
    const after: ChangeObject<ObjectType> = {
      ...base,
      updatedAt: new Date().getTime(),
      status: SquadPublicRequestStatus.Rejected,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'squad_public_request',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.squad-public-request',
      { request: after },
    ]);
  });

  it('should not notify on delete request', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: null,
        before: base,
        op: 'd',
        table: 'squad_public_request',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
  });
});

describe('post content updated', () => {
  beforeEach(async () => {
    jest.resetAllMocks();

    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Source, [
      {
        ...sourcesFixture[0],
        id: 'a',
        name: 'A',
        image: 'http://image.com/a',
        handle: 'a',
        type: SourceType.Machine,
        headerImage: 'http://image.com/header',
        color: 'avocado',
        twitter: '@a',
        website: 'http://a.com',
        description: 'A description',
      },
      ...sourcesFixture.slice(1),
    ]);
    await saveFixtures(con, ArticlePost, postsFixture);
    await saveFixtures(con, PostRelation, relatedPostsFixture);
    await saveFixtures(con, PostKeyword, postKeywordsFixture);
  });

  it('should notify on post updated', async () => {
    const after: ChangeObject<ArticlePost> = {
      ...contentUpdatedPost,
      type: PostType.Article,
      url: 'http://p4.com',
      canonicalUrl: 'http://p4c.com',
      contentMeta: {
        cleaned: [
          {
            provider: 'test',
            resource_location: 'gs://path.xml',
          },
        ],
        scraped: {
          resource_location: 'gs://path.html',
        },
        storedCodeSnippets: '',
        enriched: { provider: 'test' },
        language: { provider: 'translate' },
        embedding: {
          size: 999,
          model: 'test',
          provider: 'test',
          content_type: 'title_summary',
          resource_location: 'yggdrasil',
          updated_at: 1725878687,
        },
        aigc_detect: { provider: 'test' },
      },
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ArticlePost>({
        after,
        before: after,
        op: 'u',
        table: 'post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.content-updated',
      {
        banned: false,
        canonicalUrl: 'http://p4c.com',
        contentCuration: ['c1', 'c2'],
        contentMeta: {
          cleaned: [
            {
              provider: 'test',
              resourceLocation: 'gs://path.xml',
            },
          ],
          scraped: {
            resourceLocation: 'gs://path.html',
          },
          storedCodeSnippets: '',
          enriched: { provider: 'test' },
          language: { provider: 'translate' },
          embedding: {
            size: 999,
            model: 'test',
            provider: 'test',
            contentType: 'title_summary',
            resourceLocation: 'yggdrasil',
            updatedAt: 1725878687,
          },
          aigcDetect: { provider: 'test' },
        },
        contentQuality: {
          isAiProbability: 0.9,
        },
        createdAt: expect.any(Number),
        description: 'Post for testing',
        image: 'https://daily.dev/image.jpg',
        keywords: ['backend', 'data', 'javascript'],
        language: 'en',
        origin: 'crawler',
        postId: 'p4',
        private: false,
        readTime: 5,
        relatedPosts: [
          {
            createdAt: expect.any(Number),
            postId: 'p1',
            relatedPostId: 'p4',
            type: 'COLLECTION',
          },
          {
            createdAt: expect.any(Number),
            postId: 'p2',
            relatedPostId: 'p4',
            type: 'COLLECTION',
          },
          {
            createdAt: expect.any(Number),
            postId: 'p3',
            relatedPostId: 'p4',
            type: 'COLLECTION',
          },
        ],
        source: {
          active: true,
          color: 'avocado',
          createdAt: expect.any(Number),
          description: 'A description',
          handle: 'a',
          headerImage: 'http://image.com/header',
          id: 'a',
          image: 'http://image.com/a',
          name: 'A',
          private: false,
          twitter: '@a',
          type: 'machine',
          website: 'http://a.com',
        },
        summary: 'Post for testing',
        tags: ['javascript', 'webdev', 'react'],
        title: 'Post for testing',
        type: PostType.Article,
        updatedAt: expect.any(Number),
        url: 'http://p4.com',
        visible: true,
        yggdrasilId: 'f30cdfd4-80cd-4955-bed1-0442dc5511bf',
        deleted: false,
      },
    ]);
  });

  it('should notify on freeform post updated', async () => {
    const after: ChangeObject<FreeformPost> = {
      ...contentUpdatedPost,
      type: PostType.Freeform,
      content: 'Freeform content',
      contentHtml: '<p>Freeform content</p>',
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<FreeformPost>({
        after,
        before: after,
        op: 'u',
        table: 'post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.content-updated',
      {
        banned: false,
        content: 'Freeform content',
        contentCuration: ['c1', 'c2'],
        contentMeta: {
          cleaned: [],
          storedCodeSnippets: '',
        },
        contentQuality: {
          isAiProbability: 0.9,
        },
        createdAt: expect.any(Number),
        description: 'Post for testing',
        image: 'https://daily.dev/image.jpg',
        keywords: ['backend', 'data', 'javascript'],
        language: 'en',
        origin: 'crawler',
        postId: 'p4',
        private: false,
        readTime: 5,
        relatedPosts: [
          {
            createdAt: expect.any(Number),
            postId: 'p1',
            relatedPostId: 'p4',
            type: 'COLLECTION',
          },
          {
            createdAt: expect.any(Number),
            postId: 'p2',
            relatedPostId: 'p4',
            type: 'COLLECTION',
          },
          {
            createdAt: expect.any(Number),
            postId: 'p3',
            relatedPostId: 'p4',
            type: 'COLLECTION',
          },
        ],
        source: {
          active: true,
          color: 'avocado',
          createdAt: expect.any(Number),
          description: 'A description',
          handle: 'a',
          headerImage: 'http://image.com/header',
          id: 'a',
          image: 'http://image.com/a',
          name: 'A',
          private: false,
          twitter: '@a',
          type: 'machine',
          website: 'http://a.com',
        },
        summary: 'Post for testing',
        tags: ['javascript', 'webdev', 'react'],
        title: 'Post for testing',
        type: PostType.Freeform,
        updatedAt: expect.any(Number),
        url: '',
        visible: true,
        yggdrasilId: 'f30cdfd4-80cd-4955-bed1-0442dc5511bf',
        deleted: false,
      },
    ]);
  });

  it('should not notify on post created', async () => {
    const after: ChangeObject<Post> = {
      ...contentUpdatedPost,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<Post>({
        after,
        before: undefined,
        op: 'c',
        table: 'post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
  });

  it('should not notify on post deleted', async () => {
    const before: ChangeObject<Post> = {
      ...contentUpdatedPost,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<Post>({
        after: undefined,
        before,
        op: 'd',
        table: 'post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
  });

  it('should notify on collection post updated', async () => {
    await saveFixtures(con, Source, [
      {
        id: 'collections',
        name: 'Collections',
        image: 'http://image.com/collections',
        handle: 'collections',
        type: SourceType.Machine,
      },
    ]);

    const after: ChangeObject<CollectionPost> = {
      ...contentUpdatedPost,
      type: PostType.Collection,
      id: 'p1',
      slug: 'post-for-testing-p1',
      shortId: 'sp1',
      sourceId: 'collections',
      content: 'Collection content',
      contentHtml: '<p>Collection content</p>',
      collectionSources: ['a', 'b'],
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<FreeformPost>({
        after,
        before: after,
        op: 'u',
        table: 'post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.content-updated',
      {
        banned: false,
        content: 'Collection content',
        contentCuration: ['c1', 'c2'],
        contentMeta: {
          cleaned: [],
          storedCodeSnippets: '',
        },
        contentQuality: {
          isAiProbability: 0.9,
        },
        createdAt: expect.any(Number),
        description: 'Post for testing',
        image: 'https://daily.dev/image.jpg',
        keywords: ['javascript', 'webdev'],
        language: 'en',
        origin: 'crawler',
        postId: 'p1',
        private: false,
        readTime: 5,
        relatedPosts: [
          {
            createdAt: expect.any(Number),
            postId: 'p1',
            relatedPostId: 'p2',
            type: 'COLLECTION',
          },
          {
            createdAt: expect.any(Number),
            postId: 'p1',
            relatedPostId: 'p3',
            type: 'COLLECTION',
          },
          {
            createdAt: expect.any(Number),
            postId: 'p1',
            relatedPostId: 'p4',
            type: 'COLLECTION',
          },
        ],
        source: {
          active: true,
          createdAt: expect.any(Number),
          handle: 'collections',
          id: 'collections',
          image: 'http://image.com/collections',
          name: 'Collections',
          private: false,
          type: 'machine',
        },
        summary: 'Post for testing',
        tags: ['javascript', 'webdev', 'react'],
        title: 'Post for testing',
        type: PostType.Collection,
        updatedAt: expect.any(Number),
        url: '',
        visible: true,
        yggdrasilId: 'f30cdfd4-80cd-4955-bed1-0442dc5511bf',
        deleted: false,
      },
    ]);
  });

  it('should notify on youtube post updated', async () => {
    const after: ChangeObject<YouTubePost> = {
      ...contentUpdatedPost,
      type: PostType.VideoYouTube,
      url: 'http://youtube.com/watch?v=123',
      videoId: '123',
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<YouTubePost>({
        after,
        before: after,
        op: 'u',
        table: 'post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.content-updated',
      {
        banned: false,
        contentCuration: ['c1', 'c2'],
        contentMeta: {
          cleaned: [],
          storedCodeSnippets: '',
        },
        contentQuality: {
          isAiProbability: 0.9,
        },
        createdAt: expect.any(Number),
        description: 'Post for testing',
        image: 'https://daily.dev/image.jpg',
        keywords: ['backend', 'data', 'javascript'],
        language: 'en',
        origin: 'crawler',
        postId: 'p4',
        private: false,
        readTime: 5,
        relatedPosts: [
          {
            createdAt: expect.any(Number),
            postId: 'p1',
            relatedPostId: 'p4',
            type: 'COLLECTION',
          },
          {
            createdAt: expect.any(Number),
            postId: 'p2',
            relatedPostId: 'p4',
            type: 'COLLECTION',
          },
          {
            createdAt: expect.any(Number),
            postId: 'p3',
            relatedPostId: 'p4',
            type: 'COLLECTION',
          },
        ],
        source: {
          active: true,
          color: 'avocado',
          createdAt: expect.any(Number),
          description: 'A description',
          handle: 'a',
          headerImage: 'http://image.com/header',
          id: 'a',
          image: 'http://image.com/a',
          name: 'A',
          private: false,
          twitter: '@a',
          type: 'machine',
          website: 'http://a.com',
        },
        summary: 'Post for testing',
        tags: ['javascript', 'webdev', 'react'],
        title: 'Post for testing',
        type: PostType.VideoYouTube,
        updatedAt: expect.any(Number),
        url: 'http://youtube.com/watch?v=123',
        visible: true,
        yggdrasilId: 'f30cdfd4-80cd-4955-bed1-0442dc5511bf',
        deleted: false,
      },
    ]);
  });

  it('should handle JSON string from jsonb fields', async () => {
    type ArticlePostJsonB = Omit<ArticlePost, 'contentMeta'> & {
      contentMeta: string;
    };
    const after: ChangeObject<ArticlePostJsonB> = {
      ...contentUpdatedPost,
      type: PostType.Article,
      url: 'http://p4.com',
      canonicalUrl: 'http://p4c.com',
      contentMeta:
        '{"cleaned":[{"provider":"test","resource_location":"gs://path.xml"}]}',
      contentQuality:
        '{"is_ai_probability":0.9}' as ArticlePost['contentQuality'],
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ArticlePostJsonB>({
        after,
        before: after,
        op: 'u',
        table: 'post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toMatchObject(
      [
        'api.v1.content-updated',
        {
          contentMeta: {
            cleaned: [{ provider: 'test', resourceLocation: 'gs://path.xml' }],
          },
          contentQuality: {
            isAiProbability: 0.9,
          },
        },
      ],
    );
  });

  it('should transform ns timestamp to seconds', async () => {
    type ArticlePostJsonB = Omit<ArticlePost, 'contentMeta'> & {
      contentMeta: string;
    };
    const after: ChangeObject<ArticlePostJsonB> = {
      ...contentUpdatedPost,
      type: PostType.Article,
      url: 'http://p4.com',
      canonicalUrl: 'http://p4c.com',
      contentMeta: '{}',
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ArticlePostJsonB>({
        after,
        before: after,
        op: 'u',
        table: 'post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toMatchObject(
      [
        'api.v1.content-updated',
        {
          createdAt: Math.floor(contentUpdatedPost.createdAt / 1_000_000),
          updatedAt: Math.floor(
            contentUpdatedPost.metadataChangedAt / 1_000_000,
          ),
        },
      ],
    );
  });

  it('should send deleted field', async () => {
    type ArticlePostJsonB = Omit<ArticlePost, 'contentMeta'> & {
      contentMeta: string;
    };
    const after: ChangeObject<ArticlePostJsonB> = {
      ...contentUpdatedPost,
      type: PostType.Article,
      url: 'http://p4.com',
      canonicalUrl: 'http://p4c.com',
      contentMeta: '{}',
      deleted: true,
    };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ArticlePostJsonB>({
        after,
        before: after,
        op: 'u',
        table: 'post',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toMatchObject(
      [
        'api.v1.content-updated',
        {
          deleted: true,
        },
      ],
    );
  });
});

describe('user streak change', () => {
  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => ({
        ...item,
        id: `${item.id}-cusc`,
        username: `${item.username}-cusc`,
        coresRole: CoresRole.User,
        github: item.github ? `${item.github}-cusc` : undefined,
      })),
    );
  });

  type ObjectType = UserStreak;
  const base: ChangeObject<ObjectType> = {
    userId: '1-cusc',
    currentStreak: 2,
    totalStreak: 3,
    maxStreak: 4,
    lastViewAt: new Date().toISOString() as never,
    updatedAt: new Date().toISOString() as never,
  };

  it('should not notify on creation', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'user_streak',
      }),
    );
    expect(triggerTypedEvent).not.toHaveBeenCalled();
  });

  it('should notify on update', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: { ...after },
        op: 'u',
        table: 'user_streak',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.user-streak-updated',
      { streak: base },
    ]);
  });

  describe('streak recovery', () => {
    const dates: Record<string, unknown> = {
      lastViewAt: '2024-06-24T12:00:00',
      updatedAt: '2024-06-24T12:00:00',
    };

    beforeEach(async () => {
      await ioRedisPool.execute((client) => client.flushall());
      await con.getRepository(UserStreak).save({
        ...base,
        lastViewAt: new Date(base.lastViewAt as never),
        updatedAt: new Date(base.updatedAt),
      });

      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-06-26T12:00:00')); // Wednesday
    });

    it('should NOT set cache for reset streak when the days past is more than two', async () => {
      const after: ChangeObject<ObjectType> = { ...base, currentStreak: 0 };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: base,
          op: 'u',
          table: 'user_streak',
        }),
      );
      const key = generateStorageKey(
        StorageTopic.Streak,
        StorageKey.Reset,
        after.userId,
      );
      const lastStreak = await getRedisObject(key);
      expect(lastStreak).toBeFalsy();
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(false);
    });

    it('should NOT set cache if the new streak value is not 0', async () => {
      const after: ChangeObject<ObjectType> = {
        ...base,
        currentStreak: base.currentStreak + 1,
      };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: base,
          op: 'u',
          table: 'user_streak',
        }),
      );
      const key = generateStorageKey(
        StorageTopic.Streak,
        StorageKey.Reset,
        after.userId,
      );
      const lastStreak = await getRedisObject(key);
      expect(lastStreak).toBeFalsy();
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(false);
    });

    it('should set cache of previous streak for recovery', async () => {
      const spy = jest.spyOn(redisFile, 'setRedisObjectWithExpiry');
      const after: ChangeObject<ObjectType> = {
        ...base,
        ...dates,
        currentStreak: 0,
      };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: { ...base, ...dates, currentStreak: 3 },
          op: 'u',
          table: 'user_streak',
        }),
      );

      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert!.showRecoverStreak).toEqual(true);
      expect(spy).toHaveBeenCalledWith('streak:reset:1-cusc', 3, 43200); // 12 hours
    });

    it('should set cache until next weekday as expiry', async () => {
      const spy = jest.spyOn(redisFile, 'setRedisObjectWithExpiry');
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-08-31T12:00:00.123Z')); // Saturday
      const lastViewAt = new Date('2024-08-29T12:00:00'); // previous Thursday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con
        .getRepository(UserStreak)
        .update({ userId: '1-cusc' }, { lastViewAt });
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            currentStreak: 3,
            lastViewAt: lastViewAt.toISOString() as never,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );
      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert!.showRecoverStreak).toEqual(true);
      expect(spy).toHaveBeenCalledWith('streak:reset:1-cusc', 3, 216000); // 60 hours --- 2 days = 48 hours + 12 hours
    });

    it('should set cache of previous streak even when weekend had passed if it has only been 2 valid days', async () => {
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-09-02T12:00:00.123Z')); // Monday
      const lastViewAt = new Date('2024-08-29T12:00:00'); // previous Thursday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con
        .getRepository(UserStreak)
        .update({ userId: '1-cusc' }, { lastViewAt });
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            currentStreak: 3,
            lastViewAt: lastViewAt.toISOString() as never,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );
      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(true);
    });

    it('should set cache of previous streak if it has only been 2 valid days even when less than 48 hours', async () => {
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-09-04T07:15:10')); // Wednesday
      const lastViewAt = new Date('2024-09-02T10:25:27'); // Monday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con
        .getRepository(UserStreak)
        .update({ userId: '1-cusc' }, { lastViewAt });
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            currentStreak: 3,
            lastViewAt: lastViewAt.toISOString() as never,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );
      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(true);
    });

    it('should set cache of previous streak even when weekend had passed if it has only been 2 valid days', async () => {
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-09-03T12:00:00')); // Tuesday
      const lastViewAt = new Date('2024-08-30T12:00:00'); // previous Friday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con
        .getRepository(UserStreak)
        .update({ userId: '1-cusc' }, { lastViewAt });
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            currentStreak: 3,
            lastViewAt: lastViewAt.toISOString() as never,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );
      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(true);
    });

    it('should set cache of previous streak even when last view was at first day of weekend', async () => {
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-09-03T12:00:00')); // Tuesday
      const lastViewAt = new Date('2024-08-31T12:00:00'); // previous Saturday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con
        .getRepository(UserStreak)
        .update({ userId: '1-cusc' }, { lastViewAt });
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            currentStreak: 3,
            lastViewAt: lastViewAt.toISOString() as never,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );
      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(true);
    });

    it('should set cache of previous streak even when last view was at second day of weekend', async () => {
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-09-03T12:00:00')); // Tuesday
      const lastViewAt = new Date('2024-09-01T12:00:00'); // previous Sunday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con
        .getRepository(UserStreak)
        .update({ userId: '1-cusc' }, { lastViewAt });
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            currentStreak: 3,
            lastViewAt: lastViewAt.toISOString() as never,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );
      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(true);
    });

    it('should NOT set cache of previous streak over the weekend if 3 valid days had passed', async () => {
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-06-25T12:00:00')); // Tuesday
      const lastViewAt = new Date('2024-06-20T12:00:00'); // previous Thursday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con
        .getRepository(UserStreak)
        .update({ userId: '1-cusc' }, { lastViewAt });
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            currentStreak: 3,
            lastViewAt: lastViewAt.toISOString() as never,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );
      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toBeFalsy();
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(false);
    });

    it('should set cache value of previous streak while considering existing streak recoveries', async () => {
      // on a regular check similar to one of the tests, this should not set the cache
      // but since we will add a recovery date, this should consider the existing streak recovery
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-06-27T12:00:00')); // Thursday
      const lastRecoveryAt = new Date('2024-06-26T12:00:00'); // Wednesday is when the reset did happen since Tuesday was missed
      const lastViewAt = new Date('2024-06-24T12:00:00'); // Monday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con.getRepository(UserStreakAction).save({
        userId: '1-cusc',
        type: UserStreakActionType.Recover,
        createdAt: lastRecoveryAt,
      });
      await con
        .getRepository(UserStreak)
        .update({ userId: '1-cusc' }, { lastViewAt });
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            currentStreak: 3,
            lastViewAt: lastViewAt.toISOString() as never,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );
      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(true);
    });

    it('should set cache value of previous streak over the weekend while considering existing streak recoveries', async () => {
      // you should be able to see a similar test BUT without recovery, and cache is not set
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-06-25T12:00:00')); // Tuesday
      const lastRecoveryAt = new Date('2024-06-24T12:00:00'); // Monday is when the reset did happen since Friday was missed
      const lastViewAt = new Date('2024-06-20T12:00:00'); // previous Thursday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con.getRepository(UserStreakAction).save({
        userId: '1-cusc',
        type: UserStreakActionType.Recover,
        createdAt: lastRecoveryAt,
      });
      await con
        .getRepository(UserStreak)
        .update({ userId: '1-cusc' }, { lastViewAt });
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            currentStreak: 3,
            lastViewAt: lastViewAt.toISOString() as never,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );
      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(true);
    });

    it('should set cache of previous streak for recovery considering the timezone', async () => {
      const spy = jest.spyOn(redisFile, 'setRedisObjectWithExpiry');
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-09-05T18:32:53')); // Thursday UTC - Friday Asia/Manila
      const lastViewAt = new Date('2024-09-04T14:24:32'); // Wednesday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con
        .getRepository(User)
        .update({ id: '1-cusc' }, { timezone: 'Asia/Manila' });
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            ...dates,
            lastViewAt: lastViewAt.toISOString() as never,
            currentStreak: 3,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );

      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(true);
      expect(spy).toHaveBeenCalledWith('streak:reset:1-cusc', 3, 77227);
    });

    it('should set cache of previous streak for recovery considering the timezone earlier than UTC', async () => {
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-09-07T01:32:53')); // Saturday UTC - Friday Pacific/Easter
      const lastViewAt = new Date('2024-09-04T14:24:32'); // Wednesday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con
        .getRepository(User)
        .update({ id: '1-cusc' }, { timezone: 'Pacific/Easter' }); // UTC-6
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            ...dates,
            lastViewAt: lastViewAt.toISOString() as never,
            currentStreak: 3,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );

      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(true);
    });

    it('should not set cache of previous streak for recovery if user does not have Cores access', async () => {
      await con
        .getRepository(User)
        .update({ id: '4-cusc' }, { coresRole: CoresRole.None });

      const spy = jest.spyOn(redisFile, 'setRedisObjectWithExpiry');
      const after: ChangeObject<ObjectType> = {
        ...base,
        ...dates,
        userId: '4-cusc',
        currentStreak: 0,
      };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: { ...base, ...dates, userId: '4-cusc', currentStreak: 3 },
          op: 'u',
          table: 'user_streak',
        }),
      );

      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toBeNull();
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '4-cusc' });
      expect(alert!.showRecoverStreak).toEqual(false);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('streak recovery with Sunday as start of the week', () => {
    const dates: Record<string, unknown> = {
      lastViewAt: '2024-06-23T12:00:00',
      updatedAt: '2024-06-2312:00:00',
    };

    beforeEach(async () => {
      await ioRedisPool.execute((client) => client.flushall());
      await saveFixtures(con, User, [
        {
          id: '1-cusc',
          weekStart: DayOfWeek.Sunday,
        },
      ]);
      await con.getRepository(UserStreak).save({
        ...base,
        lastViewAt: new Date(base.lastViewAt as never),
        updatedAt: new Date(base.updatedAt),
      });

      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-06-25T12:00:00')); // Tuesday
    });

    it('should NOT set cache for reset streak when the days past is more than two', async () => {
      const after: ChangeObject<ObjectType> = { ...base, currentStreak: 0 };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: base,
          op: 'u',
          table: 'user_streak',
        }),
      );
      const key = generateStorageKey(
        StorageTopic.Streak,
        StorageKey.Reset,
        after.userId,
      );
      const lastStreak = await getRedisObject(key);
      expect(lastStreak).toBeFalsy();
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(false);
    });

    it('should NOT set cache if the new streak value is not 0', async () => {
      const after: ChangeObject<ObjectType> = {
        ...base,
        currentStreak: base.currentStreak + 1,
      };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: base,
          op: 'u',
          table: 'user_streak',
        }),
      );
      const key = generateStorageKey(
        StorageTopic.Streak,
        StorageKey.Reset,
        after.userId,
      );
      const lastStreak = await getRedisObject(key);
      expect(lastStreak).toBeFalsy();
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(false);
    });

    it('should set cache of previous streak for recovery', async () => {
      const after: ChangeObject<ObjectType> = {
        ...base,
        ...dates,
        currentStreak: 0,
      };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: { ...base, ...dates, currentStreak: 3 },
          op: 'u',
          table: 'user_streak',
        }),
      );

      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(true);
    });

    it('should set cache of previous streak even when weekend had passed if it has only been 2 valid days', async () => {
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-09-01T12:00:00')); // Sunday
      const lastViewAt = new Date('2024-08-28T12:00:00'); // previous Wednesday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con
        .getRepository(UserStreak)
        .update({ userId: '1-cusc' }, { lastViewAt });
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            currentStreak: 3,
            lastViewAt: lastViewAt.toISOString() as never,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );
      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(true);
    });

    it('should set cache of previous streak even when weekend had passed if it has only been 2 valid days', async () => {
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-09-02T12:00:00')); // Monday
      const lastViewAt = new Date('2024-08-30T12:00:00'); // previous Thursday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con
        .getRepository(UserStreak)
        .update({ userId: '1-cusc' }, { lastViewAt });
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            currentStreak: 3,
            lastViewAt: lastViewAt.toISOString() as never,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );
      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(true);
    });

    it('should set cache of previous streak even when last view was at first day of weekend', async () => {
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-09-02T12:00:00')); // Monday
      const lastViewAt = new Date('2024-08-30T12:00:00'); // previous Friday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con
        .getRepository(UserStreak)
        .update({ userId: '1-cusc' }, { lastViewAt });
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            currentStreak: 3,
            lastViewAt: lastViewAt.toISOString() as never,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );
      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(true);
    });

    it('should set cache of previous streak even when last view was at second day of weekend', async () => {
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-09-02T12:00:00')); // Monday
      const lastViewAt = new Date('2024-08-31T12:00:00'); // previous Saturday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con
        .getRepository(UserStreak)
        .update({ userId: '1-cusc' }, { lastViewAt });
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            currentStreak: 3,
            lastViewAt: lastViewAt.toISOString() as never,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );
      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(true);
    });

    it('should NOT set cache of previous streak over the weekend if 3 valid days had passed', async () => {
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-06-24T12:00:00')); // Monday
      const lastViewAt = new Date('2024-06-19T12:00:00'); // previous Wednesday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con
        .getRepository(UserStreak)
        .update({ userId: '1-cusc' }, { lastViewAt });
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            currentStreak: 3,
            lastViewAt: lastViewAt.toISOString() as never,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );
      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toBeFalsy();
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(false);
    });

    it('should set cache value of previous streak while considering existing streak recoveries', async () => {
      // on a regular check similar to one of the tests, this should not set the cache
      // but since we will add a recovery date, this should consider the existing streak recovery
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-06-26T12:00:00')); // Wednesday
      const lastRecoveryAt = new Date('2024-06-25T12:00:00'); // Tuesday is when the reset did happen since Tuesday was missed
      const lastViewAt = new Date('2024-06-23T12:00:00'); // Sunday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con.getRepository(UserStreakAction).save({
        userId: '1-cusc',
        type: UserStreakActionType.Recover,
        createdAt: lastRecoveryAt,
      });
      await con
        .getRepository(UserStreak)
        .update({ userId: '1-cusc' }, { lastViewAt });
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            currentStreak: 3,
            lastViewAt: lastViewAt.toISOString() as never,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );
      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(true);
    });

    it('should set cache value of previous streak over the weekend while considering existing streak recoveries', async () => {
      // you should be able to see a similar test BUT without recovery, and cache is not set
      jest
        .useFakeTimers({ doNotFake })
        .setSystemTime(new Date('2024-06-24T12:00:00')); // Monday
      const lastRecoveryAt = new Date('2024-06-23T12:00:00'); // Sunday is when the reset did happen since Friday was missed
      const lastViewAt = new Date('2024-06-19T12:00:00'); // previous Wednesday
      const after: ChangeObject<ObjectType> = {
        ...base,
        lastViewAt: lastViewAt.toISOString() as never,
        currentStreak: 0,
      };
      await con.getRepository(UserStreakAction).save({
        userId: '1-cusc',
        type: UserStreakActionType.Recover,
        createdAt: lastRecoveryAt,
      });
      await con
        .getRepository(UserStreak)
        .update({ userId: '1-cusc' }, { lastViewAt });
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            currentStreak: 3,
            lastViewAt: lastViewAt.toISOString() as never,
          },
          op: 'u',
          table: 'user_streak',
        }),
      );
      const lastStreak = await getRestoreStreakCache({ userId: after.userId });
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.user-streak-updated',
        { streak: after },
      ]);
      expect(lastStreak).toEqual(3);
      const alert = await con
        .getRepository(Alerts)
        .findOneBy({ userId: '1-cusc' });
      expect(alert.showRecoverStreak).toEqual(true);
    });
  });
});

describe('user company approved', () => {
  type ObjectType = UserCompany;
  const base: ChangeObject<ObjectType> = {
    userId: '1',
    code: '123456',
    email: 'chris@daily.dev',
    verified: true,
    createdAt: new Date().getTime(),
    updatedAt: new Date().getTime(),
    companyId: null,
    flags: {},
  };

  it('should not notify on creation when company id not set', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'user_company',
      }),
    );
    expect(triggerTypedEvent).not.toHaveBeenCalled();
  });

  it('should notify on creation when company id is set', async () => {
    const after: ChangeObject<ObjectType> = { ...base, companyId: '1-cusc' };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'user_company',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalled();
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.user-company-approved',
      { userCompany: after },
    ]);
  });

  it('should not notify on update when company not changed', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: { ...after },
        op: 'u',
        table: 'user_company',
      }),
    );
    expect(triggerTypedEvent).not.toHaveBeenCalled();
  });

  it('should notify on update when company id is changed', async () => {
    const after: ChangeObject<ObjectType> = { ...base, companyId: '1' };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: base,
        op: 'u',
        table: 'user_company',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalled();
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.user-company-approved',
      { userCompany: after },
    ]);
  });

  describe('updates user experience work', () => {
    let experienceId: string;

    beforeEach(async () => {
      await saveFixtures(con, User, usersFixture);
      // Create company records
      await con.getRepository(Company).save({
        id: 'comp1',
        name: 'Test Company 1',
        image: 'https://example.com/image.png',
        domains: ['testcompany1.com'],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      // Create a user experience work entry
      const experience = await con.getRepository(UserExperienceWork).save({
        userId: '1',
        companyId: 'comp1',
        title: 'Software Engineer',
        startedAt: new Date('2020-01-01'),
        verified: false,
        type: UserExperienceType.Work,
      });
      experienceId = experience.id;
    });

    it('should not update user experience work on creation when company id not set', async () => {
      const after: ChangeObject<ObjectType> = base;
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: null,
          op: 'c',
          table: 'user_company',
        }),
      );

      const experience = await con
        .getRepository(UserExperienceWork)
        .findOneBy({ id: experienceId });
      expect(experience?.verified).toBe(false);
    });

    it('should update user experience work on creation when company id is set', async () => {
      const after: ChangeObject<ObjectType> = { ...base, companyId: 'comp1' };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: null,
          op: 'c',
          table: 'user_company',
        }),
      );

      const experience = await con
        .getRepository(UserExperienceWork)
        .findOneBy({ id: experienceId });
      expect(experience?.verified).toBe(true);
    });

    it('should not update user experience work on update when company not changed', async () => {
      const after: ChangeObject<ObjectType> = { ...base, companyId: 'comp1' };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: { ...after },
          op: 'u',
          table: 'user_company',
        }),
      );

      const experience = await con
        .getRepository(UserExperienceWork)
        .findOneBy({ id: experienceId });
      expect(experience?.verified).toBe(false);
    });

    it('should update user experience work on update when company id is changed', async () => {
      const after: ChangeObject<ObjectType> = { ...base, companyId: 'comp1' };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: base,
          op: 'u',
          table: 'user_company',
        }),
      );

      const experience = await con
        .getRepository(UserExperienceWork)
        .findOneBy({ id: experienceId });
      expect(experience?.verified).toBe(true);
    });

    it('should update all user experience work entries for the user and company', async () => {
      // Create another experience work entry for the same user and company
      await con.getRepository(UserExperienceWork).save({
        userId: '1',
        companyId: 'comp1',
        title: 'Senior Software Engineer',
        startedAt: new Date('2022-01-01'),
        verified: false,
        type: UserExperienceType.Work,
      });

      const after: ChangeObject<ObjectType> = { ...base, companyId: 'comp1' };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: null,
          op: 'c',
          table: 'user_company',
        }),
      );

      const experiences = await con
        .getRepository(UserExperienceWork)
        .findBy({ userId: '1', companyId: 'comp1' });

      expect(experiences).toHaveLength(2);
      expect(experiences.every((exp) => exp.verified)).toBe(true);
    });
  });
});

describe('bookmark change', () => {
  type ObjectType = Bookmark;
  const base: ChangeObject<ObjectType> = {
    userId: '1',
    postId: 'p1',
    createdAt: new Date().getTime(),
    listId: null,
    remindAt: null,
  };
  const debeziumTime = new Date().getTime() * 1000;

  describe('on create', () => {
    it('should not run reminder workflow', async () => {
      const after: ChangeObject<ObjectType> = base;
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: null,
          op: 'c',
          table: 'bookmark',
        }),
      );
      expect(runReminderWorkflow).not.toHaveBeenCalled();
    });

    it('should run reminder workflow if remind at is present', async () => {
      const after: ChangeObject<ObjectType> = {
        ...base,
        remindAt: debeziumTime,
      };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: null,
          op: 'c',
          table: 'bookmark',
        }),
      );
      expect(runReminderWorkflow).toHaveBeenCalledWith({
        postId: 'p1',
        remindAt: debeziumTimeToDate(debeziumTime).getTime(),
        userId: '1',
      });
    });
  });

  describe('on update', () => {
    it('should NOT cancel reminder workflow if remind at is NOT present before', async () => {
      const after: ChangeObject<ObjectType> = base;
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: base,
          op: 'u',
          table: 'bookmark',
        }),
      );
      expect(cancelReminderWorkflow).not.toHaveBeenCalled();
    });

    it('should cancel reminder workflow if remind at is present before', async () => {
      const after: ChangeObject<ObjectType> = base;
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: { ...base, remindAt: debeziumTime },
          op: 'u',
          table: 'bookmark',
        }),
      );
      expect(cancelReminderWorkflow).toHaveBeenCalledWith({
        postId: 'p1',
        remindAt: debeziumTimeToDate(debeziumTime).getTime(),
        userId: '1',
      });
    });

    it('should NOT run reminder workflow if remind at is NOT present after', async () => {
      const after: ChangeObject<ObjectType> = base;
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: base,
          op: 'u',
          table: 'bookmark',
        }),
      );
      expect(runReminderWorkflow).not.toHaveBeenCalled();
    });

    it('should run reminder workflow if remind at is present after', async () => {
      const after: ChangeObject<ObjectType> = {
        ...base,
        remindAt: debeziumTime,
      };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: base,
          op: 'u',
          table: 'bookmark',
        }),
      );
      expect(runReminderWorkflow).toHaveBeenCalledWith({
        postId: 'p1',
        remindAt: debeziumTimeToDate(debeziumTime).getTime(),
        userId: '1',
      });
    });
  });

  describe('on delete', () => {
    it('should not run reminder workflow', async () => {
      const before: ChangeObject<ObjectType> = base;
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after: null,
          before,
          op: 'd',
          table: 'bookmark',
        }),
      );
      expect(runReminderWorkflow).not.toHaveBeenCalled();
    });

    it('should cancel reminder workflow if remind at is present before', async () => {
      const before: ChangeObject<ObjectType> = {
        ...base,
        remindAt: debeziumTime,
      };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after: null,
          before,
          op: 'd',
          table: 'bookmark',
        }),
      );
      expect(cancelReminderWorkflow).toHaveBeenCalledWith({
        postId: 'p1',
        remindAt: debeziumTimeToDate(debeziumTime).getTime(),
        userId: '1',
      });
    });
  });
});

describe('source_post_moderation', () => {
  type ObjectType = ChangeObject<SourcePostModeration>;

  const base: ObjectType = {
    type: PostType.Freeform,
    id: generateUUID(),
    createdById: '1',
    sourceId: 'a',
    status: SourcePostModerationStatus.Pending,
    createdAt: new Date().getTime(),
    updatedAt: new Date().getTime(),
    flags: '{}',
  };

  it('should notify mods on create', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: base,
        before: null,
        op: 'c',
        table: 'source_post_moderation',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.source-post-moderation-submitted',
      { post: base },
    ]);
  });

  it('should notify mods on create if vordr is false', async () => {
    const after = { ...base, flags: JSON.stringify({ vordr: false }) };
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'source_post_moderation',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.source-post-moderation-submitted',
      { post: after },
    ]);
  });

  it('should not notify mods on create if submission was vordred', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: { ...base, flags: JSON.stringify({ vordr: true }) },
        before: null,
        op: 'c',
        table: 'source_post_moderation',
      }),
    );
    expect(triggerTypedEvent).not.toHaveBeenCalled();
  });

  it('should notify author on rejected', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: { ...base, status: SourcePostModerationStatus.Rejected },
        before: base,
        op: 'u',
        table: 'source_post_moderation',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.source-post-moderation-rejected',
      { post: { ...base, status: SourcePostModerationStatus.Rejected } },
    ]);
  });

  it('should clear all relevant notifications about the submission after rejection', async () => {
    await con.getRepository(NotificationV2).save([
      {
        referenceId: base.id,
        referenceType: 'post_moderation',
        targetUrl: 'https//a.b.c',
        type: NotificationType.SourcePostSubmitted,
        icon: 'Timer',
        title: 'Test',
      },
      {
        targetUrl: 'https//a.b.c',
        type: NotificationType.SourcePostApproved,
        icon: 'Timer',
        title: 'Test',
      },
    ]);
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: { ...base, status: SourcePostModerationStatus.Rejected },
        before: base,
        op: 'u',
        table: 'source_post_moderation',
      }),
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.source-post-moderation-rejected',
      { post: { ...base, status: SourcePostModerationStatus.Rejected } },
    ]);
    const submitted = await con
      .getRepository(NotificationV2)
      .findOneBy({ type: NotificationType.SourcePostSubmitted });
    expect(submitted).toBeNull();
  });

  it('should clear all relevant notifications about the submission on delete', async () => {
    await con.getRepository(User).save(usersFixture[0]);
    const [submission] = await con.getRepository(NotificationV2).save([
      {
        referenceId: base.id,
        referenceType: 'post_moderation',
        targetUrl: 'https//a.b.c',
        type: NotificationType.SourcePostSubmitted,
        icon: 'Timer',
        title: 'Test',
      },
      {
        targetUrl: 'https//a.b.c',
        type: NotificationType.SourcePostApproved,
        icon: 'Timer',
        title: 'Test',
      },
    ]);
    await con.getRepository(UserNotification).save([
      {
        userId: '1',
        notificationId: submission.id,
      },
    ]);
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after: null,
        before: base,
        op: 'd',
        table: 'source_post_moderation',
      }),
    );
    const submitted = await con
      .getRepository(NotificationV2)
      .findOneBy({ type: NotificationType.SourcePostSubmitted });
    expect(submitted).toBeNull();
    const notifications = await con.getRepository(UserNotification).find();
    expect(notifications.length).toEqual(0);
  });

  describe('on approved', () => {
    beforeEach(async () => {
      await saveFixtures(con, User, usersFixture);
      await saveFixtures(con, Source, sourcesFixture);
      await con
        .getRepository(Source)
        .update({ id: 'a' }, { type: SourceType.Squad });
    });

    const mockUpdate = async (
      props: Partial<ObjectType> = {},
      beforeProps: Partial<ObjectType> = {},
    ) => {
      const after = { ...base, ...props };

      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: { ...base, ...beforeProps },
          op: 'u',
          table: 'source_post_moderation',
        }),
      );
    };

    it('should create freeform post', async () => {
      const repo = con.getRepository(Post);
      const before = await repo.find();
      expect(before.length).toEqual(1);
      const after = {
        ...base,
        status: SourcePostModerationStatus.Approved,
        title: '# Test',
        titleHtml: '# Test',
        content: '## Sample',
        contentHtml: '## SampleHtml',
        image: 'http://image',
      };
      await mockUpdate(after);
      const freeform = (await repo.findOneBy({
        sourceId: 'a',
      })) as FreeformPost;
      expect(freeform).toBeTruthy();
      expect(freeform.type).toEqual(PostType.Freeform);
      expect(freeform.title).toEqual('# Test');
      expect(freeform.titleHtml).toEqual('# Test');
      expect(freeform.content).toEqual('## Sample');
      expect(freeform.contentHtml).toEqual('## SampleHtml');
      expect(freeform.image).toEqual('http://image');
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.source-post-moderation-approved',
        { post: { ...after, postId: freeform.id } },
      ]);
    });

    it('should create banned freeform post if author is vordred', async () => {
      await saveFixtures(con, User, badUsersFixture);
      const repo = con.getRepository(Post);
      const before = await repo.find();
      expect(before.length).toEqual(1);
      const after = {
        ...base,
        createdById: 'vordr',
        status: SourcePostModerationStatus.Approved,
        title: '# Test',
        titleHtml: '# Test',
        content: '## Sample',
        contentHtml: '## SampleHtml',
        image: 'http://image',
      };
      await mockUpdate(after);
      const freeform = (await repo.findOneBy({
        sourceId: 'a',
      })) as FreeformPost;
      expect(freeform).toBeTruthy();
      expect(freeform.type).toEqual(PostType.Freeform);
      expect(freeform.title).toEqual('# Test');
      expect(freeform.titleHtml).toEqual('# Test');
      expect(freeform.content).toEqual('## Sample');
      expect(freeform.contentHtml).toEqual('## SampleHtml');
      expect(freeform.image).toEqual('http://image');
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.source-post-moderation-approved',
        { post: { ...after, postId: freeform.id } },
      ]);
      expect(freeform.banned).toBeTruthy();
      expect(freeform.flags.vordr).toBeTruthy();
    });

    it('should clear all relevant notifications about the submission', async () => {
      await con.getRepository(NotificationV2).save([
        {
          referenceId: base.id,
          referenceType: 'post_moderation',
          targetUrl: 'https//a.b.c',
          type: NotificationType.SourcePostSubmitted,
          icon: 'Timer',
          title: 'Test',
        },
        {
          targetUrl: 'https//a.b.c',
          type: NotificationType.SourcePostApproved,
          icon: 'Timer',
          title: 'Test',
        },
      ]);
      const repo = con.getRepository(Post);
      const before = await repo.find();
      expect(before.length).toEqual(1);
      const after = {
        ...base,
        status: SourcePostModerationStatus.Approved,
        title: '# Test',
        titleHtml: '# Test',
        content: '## Sample',
        contentHtml: '## SampleHtml',
        image: 'http://image',
      };
      await mockUpdate(after);
      const freeform = (await repo.findOneBy({
        sourceId: 'a',
      })) as FreeformPost;
      expect(freeform).toBeTruthy();
      const submitted = await con
        .getRepository(NotificationV2)
        .findOneBy({ type: NotificationType.SourcePostSubmitted });
      expect(submitted).toBeNull();
    });

    it('should not create post if status did not change', async () => {
      const repo = con.getRepository(Post);
      const before = await repo.find();
      expect(before.length).toEqual(1);
      const after = {
        ...base,
        status: SourcePostModerationStatus.Approved,
        title: '# Test',
        titleHtml: '# Test',
        content: '## Sample',
        contentHtml: '## SampleHtml',
        image: 'http://image',
      };
      await mockUpdate(after, { status: SourcePostModerationStatus.Approved });
      const freeform = (await repo.findOneBy({
        sourceId: 'a',
      })) as FreeformPost;
      expect(freeform).toBeNull();
    });

    it('should not create share post when share post id is null', async () => {
      const repo = con.getRepository(Post);
      const before = await repo.find();
      expect(before.length).toEqual(1);
      await mockUpdate({
        type: PostType.Share,
        status: SourcePostModerationStatus.Approved,
        title: '# Test',
        titleHtml: 'TestHtml',
        content: 'Sample',
        contentHtml: 'SampleHtml',
      });
      const share = await repo.findOneBy({ sourceId: 'a' });
      expect(share).toBeNull();
    });

    it('should create share post', async () => {
      await saveFixtures(con, Post, [postsFixture[0]]);
      const repo = con.getRepository(Post);
      const after = {
        ...base,
        type: PostType.Share,
        status: SourcePostModerationStatus.Approved,
        title: '# Test',
        titleHtml: 'TestHtml',
        sharedPostId: 'p1',
        sourceId: 'b',
      };
      await mockUpdate(after);
      const share = (await repo.findOneBy({
        sourceId: 'b',
      })) as SharePost;
      expect(share).toBeTruthy();
      expect(share.type).toEqual(PostType.Share);
      expect(share.title).toEqual('# Test');
      expect(share.titleHtml).toEqual('<p># Test</p>');
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.source-post-moderation-approved',
        { post: { ...after, postId: share.id } },
      ]);
    });

    it('should not create share post when user is vordred', async () => {
      await saveFixtures(con, User, badUsersFixture);
      await saveFixtures(con, Post, [postsFixture[0]]);
      const repo = con.getRepository(Post);
      const after = {
        ...base,
        createdById: 'vordr',
        type: PostType.Share,
        status: SourcePostModerationStatus.Approved,
        title: '# Test',
        titleHtml: 'TestHtml',
        sharedPostId: 'p1',
        sourceId: 'b',
      };
      await mockUpdate(after);
      const share = (await repo.findOneBy({
        sourceId: 'b',
      })) as SharePost;
      expect(share).toBeTruthy();
      expect(share.type).toEqual(PostType.Share);
      expect(share.title).toEqual('# Test');
      expect(share.titleHtml).toEqual('<p># Test</p>');
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.source-post-moderation-approved',
        { post: { ...after, postId: share.id } },
      ]);
      expect(share.banned).toBeTruthy();
      expect(share.flags.vordr).toBeTruthy();
    });

    it('should not create share post if link is not found', async () => {
      const repo = con.getRepository(Post);
      const before = await repo.find();
      expect(before.length).toEqual(1);
      await mockUpdate({
        sourceId: 'a',
        type: PostType.Share,
        status: SourcePostModerationStatus.Approved,
        title: 'Test',
        content: '# Sample',
        contentHtml: '# Sample',
      });
      const unknown = await repo.findBy({ sourceId: UNKNOWN_SOURCE });
      expect(unknown.length).toEqual(1);
      const share = await repo.findOneBy({ sourceId: 'a' });
      expect(share).toBeNull();
    });

    it('should create share post from external link', async () => {
      const repo = con.getRepository(Post);
      const before = await repo.find();
      expect(before.length).toEqual(1);
      const after = {
        ...base,
        sourceId: 'a',
        type: PostType.Share,
        status: SourcePostModerationStatus.Approved,
        title: 'Test',
        content: '# Sample',
        contentHtml: '# Sample',
        externalLink: 'https://daily.dev/blog-post/sauron',
      };
      await mockUpdate(after);
      const unknown = await repo.findOneByOrFail({
        sourceId: UNKNOWN_SOURCE,
        id: Not('404'),
      });
      expect(unknown).toBeTruthy();
      expect(unknown.title).toEqual('Test');
      const share = (await repo.findOneBy({
        sourceId: 'a',
      })) as SharePost;
      expect(share).toBeTruthy();
      expect(share.type).toEqual(PostType.Share);
      expect(share.title).toEqual('# Sample');
      expect(share.titleHtml).toEqual('<p># Sample</p>');
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.source-post-moderation-approved',
        { post: { ...after, postId: share.id } },
      ]);
    });

    it('should create share post from external link which is now available internally', async () => {
      const repo = con.getRepository(Post);
      await repo.save([
        {
          ...postsFixture[0],
          sourceId: 'c',
          url: 'https://daily.dev/blog-post/sauron',
        },
      ]);
      const before = await repo.find();
      expect(before.length).toEqual(2);
      const after = {
        ...base,
        sourceId: 'a',
        type: PostType.Share,
        status: SourcePostModerationStatus.Approved,
        title: 'Test',
        content: '# Sample',
        contentHtml: '# Sample',
        externalLink: 'https://daily.dev/blog-post/sauron',
      };
      await mockUpdate(after);
      const share = (await repo.findOneBy({
        sourceId: 'a',
      })) as SharePost;
      expect(share).toBeTruthy();
      expect(share.type).toEqual(PostType.Share);
      expect(share.title).toEqual('# Sample');
      expect(share.titleHtml).toEqual('<p># Sample</p>');
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.source-post-moderation-approved',
        { post: { ...after, postId: share.id } },
      ]);

      const list = await con.getRepository(Post).find();
      expect(list.length).toEqual(3); // to ensure nothing new was created other than the share post
    });

    it('should update the content if post id is present', async () => {
      const repo = con.getRepository(Post);
      await saveFixtures(con, Post, [postsFixture[0]]);
      const before = await repo.findOneBy({ id: 'p1' });
      expect(before.title).toEqual('P1');
      const afterProps = {
        ...base,
        sourceId: 'a',
        type: PostType.Share,
        status: SourcePostModerationStatus.Approved,
        title: 'Test',
        postId: 'p1',
      };
      await mockUpdate(afterProps);
      const after = await repo.findOneBy({ id: 'p1' });
      expect(after.title).toEqual('Test');
      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.source-post-moderation-approved',
        { post: { ...afterProps, postId: after.id } },
      ]);
    });

    it('should create poll post with options and duration', async () => {
      const repo = con.getRepository(Post);
      const before = await repo.find();
      expect(before.length).toEqual(1);

      const pollOptions = [
        { text: 'Option 1', order: 0 },
        { text: 'Option 2', order: 1 },
        { text: 'Option 3', order: 2 },
      ];

      const after = {
        ...base,
        type: PostType.Poll,
        status: SourcePostModerationStatus.Approved,
        title: 'What is your favorite tech stack?',
        pollOptions,
        duration: 7,
      };

      await mockUpdate(after);

      const poll = (await repo.findOneBy({
        sourceId: 'a',
      })) as PollPost;

      expect(poll).toBeTruthy();
      expect(poll.type).toEqual(PostType.Poll);
      expect(poll.title).toEqual('What is your favorite tech stack?');
      expect(poll.endsAt).toBeTruthy();
      expect(
        isSameDay(new Date(poll.endsAt!), addDays(new Date(), 7)),
      ).toBeTruthy();
      expect(poll.contentCuration).toEqual(['poll']);

      // Verify poll options were created
      const options = await con.getRepository(PollOption).find({
        where: { postId: poll.id },
        order: { order: 'ASC' },
      });

      expect(options).toHaveLength(3);
      expect(options[0].text).toEqual('Option 1');
      expect(options[0].order).toEqual(0);
      expect(options[1].text).toEqual('Option 2');
      expect(options[1].order).toEqual(1);
      expect(options[2].text).toEqual('Option 3');
      expect(options[2].order).toEqual(2);

      expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
        'api.v1.source-post-moderation-approved',
        { post: { ...after, postId: poll.id } },
      ]);
    });

    it('should create poll post without duration (no end date)', async () => {
      const repo = con.getRepository(Post);
      const before = await repo.find();
      expect(before.length).toEqual(1);

      const pollOptions = [
        { text: 'Yes', order: 0 },
        { text: 'No', order: 1 },
      ];

      const after = {
        ...base,
        type: PostType.Poll,
        status: SourcePostModerationStatus.Approved,
        title: 'Do you like polls?',
        pollOptions,
        // duration not specified
      };

      await mockUpdate(after);

      const poll = (await repo.findOneBy({
        sourceId: 'a',
      })) as PollPost;

      expect(poll).toBeTruthy();
      expect(poll.type).toEqual(PostType.Poll);
      expect(poll.title).toEqual('Do you like polls?');
      expect(poll.endsAt).toBeNull();
      expect(poll.contentCuration).toEqual(['poll']);

      // Verify poll options were created
      const options = await con.getRepository(PollOption).find({
        where: { postId: poll.id },
        order: { order: 'ASC' },
      });

      expect(options).toHaveLength(2);
      expect(options[0].text).toEqual('Yes');
      expect(options[1].text).toEqual('No');
    });
  });
});

describe('content_preference', () => {
  describe('content_preference user', () => {
    it('should trigger user follow event', async () => {
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ContentPreferenceUser>({
          after: {
            referenceId: 'rWrhZmPsXHnsgEAL8nwAk',
            userId: 'LJSkpBexOSCWc8INyu3Eu',
            type: ContentPreferenceType.User,
            createdAt: 1752842329637000,
            status: ContentPreferenceStatus.Follow,
            referenceUserId: 'rWrhZmPsXHnsgEAL8nwAk',
            feedId: 'LJSkpBexOSCWc8INyu3Eu',
          },
          op: 'c',
          table: 'content_preference',
        }),
      );

      expectTypedEvent('api.v1.user-follow', {
        payload: {
          referenceId: 'rWrhZmPsXHnsgEAL8nwAk',
          userId: 'LJSkpBexOSCWc8INyu3Eu',
          type: ContentPreferenceType.User,
          createdAt: 1752842329637000,
          status: ContentPreferenceStatus.Follow,
          referenceUserId: 'rWrhZmPsXHnsgEAL8nwAk',
          feedId: 'LJSkpBexOSCWc8INyu3Eu',
        },
      });
    });

    it('should not trigger user follow if status is blocked', async () => {
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ContentPreferenceUser>({
          after: {
            referenceId: 'rWrhZmPsXHnsgEAL8nwAk',
            userId: 'LJSkpBexOSCWc8INyu3Eu',
            type: ContentPreferenceType.User,
            createdAt: 1752842329637000,
            status: ContentPreferenceStatus.Blocked,
            referenceUserId: 'rWrhZmPsXHnsgEAL8nwAk',
            feedId: 'LJSkpBexOSCWc8INyu3Eu',
          },
          op: 'c',
          table: 'content_preference',
        }),
      );

      expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
    });

    it('should not trigger user follow on update', async () => {
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ContentPreferenceUser>({
          after: {
            referenceId: 'rWrhZmPsXHnsgEAL8nwAk',
            userId: 'LJSkpBexOSCWc8INyu3Eu',
            type: ContentPreferenceType.User,
            createdAt: 1752842329637000,
            status: ContentPreferenceStatus.Follow,
            referenceUserId: 'rWrhZmPsXHnsgEAL8nwAk',
            feedId: 'LJSkpBexOSCWc8INyu3Eu',
          },
          before: {
            referenceId: 'rWrhZmPsXHnsgEAL8nwAk',
            userId: 'LJSkpBexOSCWc8INyu3Eu',
            type: ContentPreferenceType.User,
            createdAt: 1752842329637000,
            status: ContentPreferenceStatus.Blocked,
            referenceUserId: 'rWrhZmPsXHnsgEAL8nwAk',
            feedId: 'LJSkpBexOSCWc8INyu3Eu',
          },
          op: 'u',
          table: 'content_preference',
        }),
      );

      expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
    });
  });
});

describe('opportunity match', () => {
  type ObjectType = OpportunityMatch;
  const base: ChangeObject<ObjectType> = {
    opportunityId: opportunitiesFixture[0].id!,
    userId: '1',
    status: OpportunityMatchStatus.Pending,
    createdAt: new Date().getTime(),
    updatedAt: new Date().getTime(),
    description: '',
    screening: [],
    applicationRank: {},
  };

  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
    await con.getRepository(User).update(
      { id: usersFixture[0].id },
      {
        title: 'CTO',
        bio: 'Here to break things',
      },
    );
    await saveFixtures(con, Organization, organizationsFixture);
    await saveFixtures(con, Opportunity, opportunitiesFixture);
    await con.getRepository(UserCandidatePreference).save({
      userId: '1',
      status: CandidateStatus.OPEN_TO_OFFERS,
    });
    await con.getRepository(OpportunityMatch).save({
      opportunityId: opportunitiesFixture[0].id,
      userId: '1',
      status: OpportunityMatchStatus.Pending,
      createdAt: new Date(),
      updatedAt: new Date(),
      description: {},
      screening: [],
      applicationRank: {},
    });
    await con.getRepository(OpportunityUser).save({
      userId: usersFixture[0].id,
      opportunityId: opportunitiesFixture[0].id,
      type: OpportunityUserType.Recruiter,
    });
  });

  describe('candidate accepted', () => {
    it('should notify on candidate accepted opportunity', async () => {
      const after: ChangeObject<ObjectType> = {
        ...base,
        status: OpportunityMatchStatus.CandidateAccepted,
      };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: base,
          op: 'u',
          table: 'opportunity_match',
        }),
      );
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    });

    it('should not notify when status stays the same', async () => {
      const after: ChangeObject<ObjectType> = {
        ...base,
        status: OpportunityMatchStatus.CandidateAccepted,
      };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            status: OpportunityMatchStatus.CandidateAccepted,
          },
          op: 'u',
          table: 'opportunity_match',
        }),
      );
      expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
    });

    it('should not notify when candidate preference is not found', async () => {
      await con.getRepository(UserCandidatePreference).delete({ userId: '1' });
      const after: ChangeObject<ObjectType> = {
        ...base,
        status: OpportunityMatchStatus.CandidateAccepted,
      };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: base,
          op: 'u',
          table: 'opportunity_match',
        }),
      );
      expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
    });
  });

  describe('candidate rejected', () => {
    it('should notify on candidate rejected opportunity', async () => {
      const after: ChangeObject<ObjectType> = {
        ...base,
        status: OpportunityMatchStatus.CandidateRejected,
      };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: base,
          op: 'u',
          table: 'opportunity_match',
        }),
      );
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    });

    it('should not notify when candidate rejected status stays the same', async () => {
      const after: ChangeObject<ObjectType> = {
        ...base,
        status: OpportunityMatchStatus.CandidateRejected,
      };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            status: OpportunityMatchStatus.CandidateRejected,
          },
          op: 'u',
          table: 'opportunity_match',
        }),
      );
      expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
    });

    it('should not notify when opportunity match is not found for candidate rejection', async () => {
      await con.getRepository(OpportunityMatch).delete({
        opportunityId: opportunitiesFixture[0].id,
        userId: '1',
      });
      const after: ChangeObject<ObjectType> = {
        ...base,
        status: OpportunityMatchStatus.CandidateRejected,
      };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: base,
          op: 'u',
          table: 'opportunity_match',
        }),
      );
      expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
    });
  });

  describe('recruiter accepted', () => {
    it('should notify on recruiter accepted candidate match', async () => {
      const after: ChangeObject<ObjectType> = {
        ...base,
        status: OpportunityMatchStatus.RecruiterAccepted,
      };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: base,
          op: 'u',
          table: 'opportunity_match',
        }),
      );
      expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
      expect(triggerTypedEvent).toHaveBeenCalledWith(
        expect.any(Object),
        'api.v1.recruiter-accepted-candidate-match',
        expect.objectContaining({
          opportunityId: opportunitiesFixture[0].id,
          userId: '1',
          recruiter: {
            name: 'Ido',
            role: 'CTO',
            bio: 'Here to break things',
          },
        }),
      );
    });

    it('should not notify when recruiter accepted status stays the same', async () => {
      const after: ChangeObject<ObjectType> = {
        ...base,
        status: OpportunityMatchStatus.RecruiterAccepted,
      };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: {
            ...base,
            status: OpportunityMatchStatus.RecruiterAccepted,
          },
          op: 'u',
          table: 'opportunity_match',
        }),
      );
      expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
    });

    it('should not notify when opportunity match is not found for recruiter acceptance', async () => {
      await con.getRepository(OpportunityMatch).delete({
        opportunityId: opportunitiesFixture[0].id,
        userId: '1',
      });
      const after: ChangeObject<ObjectType> = {
        ...base,
        status: OpportunityMatchStatus.RecruiterAccepted,
      };
      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: base,
          op: 'u',
          table: 'opportunity_match',
        }),
      );
      expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
    });
  });
});

describe('opportunity', () => {
  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Organization, organizationsFixture);
    await saveFixtures(con, Opportunity, opportunitiesFixture);
    await con.getRepository(Feed).save([
      { id: usersFixture[0].id, userId: usersFixture[0].id },
      {
        id: usersFixture[1].id,
        userId: usersFixture[1].id,
      },
    ]);
    await con.getRepository(ContentPreferenceOrganization).save([
      {
        organizationId: organizationsFixture[0].id,
        userId: usersFixture[0].id,
        referenceId: usersFixture[0].id,
        type: ContentPreferenceType.Organization,
        status: ContentPreferenceOrganizationStatus.Free,
        feedId: usersFixture[0].id,
      },
      {
        organizationId: organizationsFixture[0].id,
        userId: usersFixture[1].id,
        referenceId: usersFixture[1].id,
        type: ContentPreferenceType.Organization,
        status: ContentPreferenceOrganizationStatus.Free,
        feedId: usersFixture[0].id,
      },
    ]);
    await con.getRepository(OpportunityUser).save({
      userId: usersFixture[3].id,
      opportunityId: opportunitiesFixture[0].id,
      type: OpportunityUserType.Recruiter,
    });
  });

  it('should trigger on new opportunity', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<OpportunityJob>({
        after: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          createdAt: new Date().getTime(),
          updatedAt: new Date().getTime(),
          type: OpportunityType.JOB,
          title: 'Senior Backend Engineer',
          tldr: 'We are looking for a Senior Backend Engineer...',
          content: [],
          meta: {},
          state: OpportunityState.LIVE,
          organizationId: organizationsFixture[0].id,
        },
        op: 'c',
        table: 'opportunity',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0][1]).toEqual(
      'api.v1.opportunity-added',
    );
    expect(
      jest.mocked(triggerTypedEvent).mock.calls[0][2].excludedUserIds,
    ).toEqual(['1', '2', '4']);
  });

  it('should trigger opportunity job for demo company', async () => {
    await con.getRepository(Feed).save([
      { id: '1', userId: '1' },
      { id: '2', userId: '2' },
    ]);
    await con.getRepository(ContentPreferenceOrganization).save([
      {
        feedId: '1',
        userId: '1',
        referenceId: demoCompany.id,
        organizationId: demoCompany.id,
        type: ContentPreferenceType.Organization,
        status: ContentPreferenceOrganizationStatus.Free,
        createdAt: new Date(),
      },
      {
        feedId: '2',
        userId: '2',
        referenceId: demoCompany.id,
        organizationId: demoCompany.id,
        type: ContentPreferenceType.Organization,
        status: ContentPreferenceOrganizationStatus.Plus,
        createdAt: new Date(),
      },
    ]);
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<OpportunityJob>({
        after: {
          id: '550e8400-e29b-41d4-a716-446655440005',
          createdAt: new Date().getTime(),
          updatedAt: new Date().getTime(),
          type: OpportunityType.JOB,
          title: 'Senior Backend Engineer',
          tldr: 'We are looking for a Senior Backend Engineer...',
          content: [],
          meta: {},
          state: OpportunityState.LIVE,
          organizationId: demoCompany.id,
        },
        op: 'c',
        table: 'opportunity',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(2);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0][1]).toEqual(
      'gondul.v1.candidate-opportunity-match',
    );
    expect(jest.mocked(triggerTypedEvent).mock.calls[0][2].userId).toEqual('1');
    expect(jest.mocked(triggerTypedEvent).mock.calls[1][1]).toEqual(
      'gondul.v1.candidate-opportunity-match',
    );
    expect(jest.mocked(triggerTypedEvent).mock.calls[1][2].userId).toEqual('2');
  });

  it('should not trigger on new opportunity when state is not live', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<OpportunityJob>({
        after: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          createdAt: new Date().getTime(),
          updatedAt: new Date().getTime(),
          type: OpportunityType.JOB,
          title: 'Senior Backend Engineer',
          tldr: 'We are looking for a Senior Backend Engineer...',
          content: [],
          meta: {},
          state: OpportunityState.DRAFT,
          organizationId: 'org-1',
        },
        op: 'c',
        table: 'opportunity',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
  });

  it('should not trigger on new opportunity when state is job', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<OpportunityJob>({
        after: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          createdAt: new Date().getTime(),
          updatedAt: new Date().getTime(),
          type: 'not-job' as OpportunityType,
          title: 'Senior Backend Engineer',
          tldr: 'We are looking for a Senior Backend Engineer...',
          content: [],
          meta: {},
          state: OpportunityState.LIVE,
          organizationId: 'org-1',
        },
        op: 'c',
        table: 'opportunity',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
  });

  it('should trigger on updated opportunity', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<OpportunityJob>({
        after: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          createdAt: new Date().getTime(),
          updatedAt: new Date().getTime(),
          type: OpportunityType.JOB,
          title: 'Senior Backend Engineer',
          tldr: 'We are looking for a Senior Backend Engineer...',
          content: [],
          meta: {},
          state: OpportunityState.LIVE,
          organizationId: 'org-1',
        },
        op: 'u',
        table: 'opportunity',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0][1]).toEqual(
      'api.v1.opportunity-added',
    );
  });

  it('should not trigger on updated opportunity when state is not live', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<OpportunityJob>({
        after: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          createdAt: new Date().getTime(),
          updatedAt: new Date().getTime(),
          type: OpportunityType.JOB,
          title: 'Senior Backend Engineer',
          tldr: 'We are looking for a Senior Backend Engineer...',
          content: [],
          meta: {},
          state: OpportunityState.DRAFT,
          organizationId: 'org-1',
        },
        op: 'u',
        table: 'opportunity',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
  });

  it('should not trigger on new opportunity when state is job', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<OpportunityJob>({
        after: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          createdAt: new Date().getTime(),
          updatedAt: new Date().getTime(),
          type: 'not-job' as OpportunityType,
          title: 'Senior Backend Engineer',
          tldr: 'We are looking for a Senior Backend Engineer...',
          content: [],
          meta: {},
          state: OpportunityState.LIVE,
          organizationId: 'org-1',
        },
        op: 'u',
        table: 'opportunity',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
  });

  it('should clear alerts on opportunity going from live to draft', async () => {
    await saveFixtures(con, Alerts, [
      {
        userId: '1',
        opportunityId: opportunitiesFixture[0].id!,
      },
      {
        userId: '2',
        opportunityId: opportunitiesFixture[0].id!,
      },
    ]);

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<OpportunityJob>({
        before: {
          state: OpportunityState.LIVE,
        },
        after: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          createdAt: new Date().getTime(),
          updatedAt: new Date().getTime(),
          type: OpportunityType.JOB,
          title: 'Senior Backend Engineer',
          tldr: 'We are looking for a Senior Backend Engineer...',
          content: [],
          meta: {},
          state: OpportunityState.DRAFT,
          organizationId: 'org-1',
        },
        op: 'u',
        table: 'opportunity',
      }),
    );

    expect(
      await con
        .getRepository(Alerts)
        .countBy({ opportunityId: '550e8400-e29b-41d4-a716-446655440001' }),
    ).toEqual(0);
  });
});

describe('user_candidate_preference', () => {
  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
  });

  it('should trigger candidate preference change event on creation', async () => {
    const candidatePreferenceData = {
      userId: '1',
      status: CandidateStatus.OPEN_TO_OFFERS,
      cv: {
        url: 'https://example.com/cv.pdf',
        lastModified: new Date('2023-01-01'),
      },
      cvParsed: {},
      role: 'Senior Full Stack Developer',
      roleType: 0.8,
      employmentType: [0], // EmploymentType.FULL_TIME
      salaryExpectation: {
        min: 80000,
        currency: 'USD',
      },
      location: [
        {
          type: 1, // LocationType.REMOTE
          country: 'USA',
        },
      ],
      locationType: [1], // LocationType.REMOTE
      companyStage: [2], // CompanyStage.GROWTH
      companySize: [3], // CompanySize.MEDIUM
      updatedAt: new Date('2023-01-01'),
    };

    // First, create the UserCandidatePreference record
    await con
      .getRepository(UserCandidatePreference)
      .save(candidatePreferenceData);

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<UserCandidatePreference>({
        after: candidatePreferenceData,
        op: 'c',
        table: 'user_candidate_preference',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0][1]).toEqual(
      'api.v1.candidate-preference-updated',
    );
  });

  it('should trigger candidate preference change event on update', async () => {
    const originalData = {
      userId: '1',
      status: CandidateStatus.OPEN_TO_OFFERS,
      cvParsed: {},
      cv: {
        url: 'https://example.com/cv.pdf',
        lastModified: new Date('2023-01-01'),
      },
      role: 'Senior Full Stack Developer',
      roleType: 0.8,
      employmentType: [0], // EmploymentType.FULL_TIME
      salaryExpectation: {
        min: 80000,
        currency: 'USD',
      },
      location: [
        {
          type: 1, // LocationType.REMOTE
          country: 'USA',
        },
      ],
      locationType: [1], // LocationType.REMOTE
      companyStage: [2], // CompanyStage.GROWTH
      companySize: [3], // CompanySize.MEDIUM
      updatedAt: new Date('2023-01-01'),
    };

    const updatedData = {
      ...originalData,
      role: 'Senior Backend Engineer',
      salaryExpectation: {
        min: 90000,
        currency: 'USD',
      },
      updatedAt: new Date('2023-01-02'),
    };

    // Create the UserCandidatePreference record
    await con.getRepository(UserCandidatePreference).save(updatedData);

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<UserCandidatePreference>({
        before: originalData,
        after: updatedData,
        op: 'u',
        table: 'user_candidate_preference',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0][1]).toEqual(
      'api.v1.candidate-preference-updated',
    );
  });

  it('should not trigger event on delete operation', async () => {
    const candidatePreferenceData = {
      userId: '1',
      status: CandidateStatus.OPEN_TO_OFFERS,
      cvParsed: {},
      cv: {
        url: 'https://example.com/cv.pdf',
        lastModified: new Date('2023-01-01'),
      },
      role: 'Senior Full Stack Developer',
      roleType: 0.8,
      employmentType: [0], // EmploymentType.FULL_TIME
      salaryExpectation: {
        min: 80000,
        currency: 'USD',
      },
      location: [
        {
          type: 1, // LocationType.REMOTE
          country: 'USA',
        },
      ],
      locationType: [1], // LocationType.REMOTE
      companyStage: [2], // CompanyStage.GROWTH
      companySize: [3], // CompanySize.MEDIUM
      updatedAt: new Date('2023-01-01'),
    };

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<UserCandidatePreference>({
        before: candidatePreferenceData,
        op: 'd',
        table: 'user_candidate_preference',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
  });

  it('should not trigger event on read operation', async () => {
    const candidatePreferenceData = {
      userId: '1',
      status: CandidateStatus.OPEN_TO_OFFERS,
      cvParsed: {},
      cv: {
        url: 'https://example.com/cv.pdf',
        lastModified: new Date('2023-01-01'),
      },
      role: 'Senior Full Stack Developer',
      roleType: 0.8,
      employmentType: [0], // EmploymentType.FULL_TIME
      salaryExpectation: {
        min: 80000,
        currency: 'USD',
      },
      location: [
        {
          type: 1, // LocationType.REMOTE
          country: 'USA',
        },
      ],
      locationType: [1], // LocationType.REMOTE
      companyStage: [2], // CompanyStage.GROWTH
      companySize: [3], // CompanySize.MEDIUM
      updatedAt: new Date('2023-01-01').getTime(),
    };

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<UserCandidatePreference>({
        after: candidatePreferenceData,
        op: 'r',
        table: 'user_candidate_preference',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
  });

  it('should handle disabled candidate status', async () => {
    const candidatePreferenceData = {
      userId: '2',
      status: CandidateStatus.DISABLED,
      cv: {
        url: '',
        lastModified: new Date('2023-01-01'),
      },
      role: '',
      roleType: 0.5,
      employmentType: [],
      salaryExpectation: {},
      location: [],
      locationType: [],
      companyStage: [],
      companySize: [],
      updatedAt: new Date('2023-01-01'),
    };

    // Create the UserCandidatePreference record
    await con
      .getRepository(UserCandidatePreference)
      .save(candidatePreferenceData);

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<UserCandidatePreference>({
        after: candidatePreferenceData,
        op: 'c',
        table: 'user_candidate_preference',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0][1]).toEqual(
      'api.v1.candidate-preference-updated',
    );
  });

  it('should handle missing candidate preference gracefully', async () => {
    // Don't create any UserCandidatePreference record
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<UserCandidatePreference>({
        after: {
          userId: 'non-existent-user',
          status: CandidateStatus.OPEN_TO_OFFERS,
          cvParsed: {},
          cv: {
            url: 'https://example.com/cv.pdf',
            lastModified: new Date('2023-01-01'),
          },
          role: 'Senior Developer',
          roleType: 0.8,
          employmentType: [0],
          salaryExpectation: {
            min: 80000,
            currency: 'USD',
          },
          location: [],
          locationType: [],
          companyStage: [],
          companySize: [],
          updatedAt: new Date('2023-01-01'),
        },
        op: 'c',
        table: 'user_candidate_preference',
      }),
    );

    // Should not trigger event when candidate preference is not found
    expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
  });

  it('should handle complex employment types and locations', async () => {
    const candidatePreferenceData = {
      userId: '3',
      status: CandidateStatus.OPEN_TO_OFFERS,
      cvParsed: {},
      cv: {
        url: 'https://example.com/cv.pdf',
        lastModified: new Date('2023-01-01'),
      },
      role: 'Full Stack Engineer',
      roleType: 0.9,
      employmentType: [0, 1, 2], // Multiple employment types
      salaryExpectation: {
        min: 100000,
        currency: 'EUR',
      },
      location: [
        {
          type: 1, // LocationType.REMOTE
          country: 'Germany',
        },
        {
          type: 2, // LocationType.HYBRID
          country: 'Netherlands',
          city: 'Amsterdam',
        },
      ],
      locationType: [1, 2], // Multiple location types
      companyStage: [1, 2, 3], // Multiple company stages
      companySize: [2, 3, 4], // Multiple company sizes
      updatedAt: new Date('2023-01-01'),
    };

    // Create the UserCandidatePreference record
    await con
      .getRepository(UserCandidatePreference)
      .save(candidatePreferenceData);

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<UserCandidatePreference>({
        after: candidatePreferenceData,
        op: 'u',
        table: 'user_candidate_preference',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0][1]).toEqual(
      'api.v1.candidate-preference-updated',
    );

    // Verify the message contains the complex data
    const eventCall = jest.mocked(triggerTypedEvent).mock.calls[0];
    expect(eventCall[2]).toMatchObject({
      payload: expect.objectContaining({
        userId: '3',
        employmentType: [0, 1, 2],
        location: expect.arrayContaining([
          expect.objectContaining({ country: 'Germany' }),
          expect.objectContaining({
            country: 'Netherlands',
            city: 'Amsterdam',
          }),
        ]),
        locationType: [1, 2],
        companyStage: [1, 2, 3],
        companySize: [2, 3, 4],
      }),
    });
  });
});

describe('organization', () => {
  beforeEach(async () => {
    await saveFixtures(con, Organization, organizationsFixture);
    await saveFixtures(con, Opportunity, opportunitiesFixture);
  });

  it('should not  trigger opportunity job update on organization creation', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<Organization>({
        after: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          seats: 1,
          name: 'Organization 1',
          description: 'New description',
        },
        op: 'c',
        table: 'organization',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
  });

  it('should trigger opportunity job update for live opportunities when organization description is updated', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<Organization>({
        before: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          seats: 1,
          name: 'Organization 1',
        },
        after: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          seats: 1,
          name: 'Organization 1',
          description: 'New description',
        },
        op: 'u',
        table: 'organization',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(2);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0][1]).toEqual(
      'api.v1.opportunity-added',
    );
    expect(jest.mocked(triggerTypedEvent).mock.calls[1][1]).toEqual(
      'api.v1.opportunity-added',
    );
  });

  it('should not trigger opportunity job update when organization has no live opportunities', async () => {
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<Organization>({
        before: {
          id: 'ed487a47-6f4d-480f-9712-f48ab29db27c',
          seats: 2,
          name: 'Organization 2',
        },
        after: {
          id: 'ed487a47-6f4d-480f-9712-f48ab29db27c',
          seats: 2,
          name: 'Organization 2',
          description: 'New description',
        },
        op: 'u',
        table: 'organization',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(0);
  });
});

describe('campaign post', () => {
  it('should schedule entity reminder workflow for post campaign', async () => {
    const campaignId = randomUUID();

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<CampaignPost>({
        after: {
          id: campaignId,
          referenceId: 'p1',
          userId: '1',
          type: CampaignType.Post,
          state: CampaignState.Active,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          endedAt: Date.now(),
          flags: JSON.stringify({}),
          postId: 'p1',
        },
        op: 'c',
        table: 'campaign',
      }),
    );

    expect(cancelEntityReminderWorkflow).toHaveBeenCalledTimes(0);
    expect(runEntityReminderWorkflow).toHaveBeenCalledTimes(1);
    expect(runEntityReminderWorkflow).toHaveBeenCalledWith({
      entityId: campaignId,
      entityTableName: 'campaign',
      scheduledAtMs: expect.any(Number),
      delayMs: 24 * 60 * 60 * 1000,
    } as z.infer<typeof entityReminderSchema>);
  });

  it('should not schedule entity reminder workflow for other campaign types', async () => {
    const campaignId = randomUUID();

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<CampaignSource>({
        after: {
          id: campaignId,
          referenceId: 's1',
          userId: '1',
          type: CampaignType.Squad,
          state: CampaignState.Active,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          endedAt: Date.now(),
          flags: JSON.stringify({}),
          sourceId: 's1',
        },
        op: 'c',
        table: 'campaign',
      }),
    );

    expect(runEntityReminderWorkflow).toHaveBeenCalledTimes(0);
    expect(cancelEntityReminderWorkflow).toHaveBeenCalledTimes(0);
  });

  it('should cancel entity reminder workflow for post campaign', async () => {
    const campaignId = randomUUID();

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<CampaignPost>({
        before: {
          id: campaignId,
          referenceId: 'p1',
          userId: '1',
          type: CampaignType.Post,
          state: CampaignState.Active,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          endedAt: Date.now(),
          flags: JSON.stringify({}),
          postId: 'p1',
        },
        op: 'd',
        table: 'campaign',
      }),
    );

    expect(runEntityReminderWorkflow).toHaveBeenCalledTimes(0);
    expect(cancelEntityReminderWorkflow).toHaveBeenCalledTimes(1);
    expect(cancelEntityReminderWorkflow).toHaveBeenCalledWith({
      entityId: campaignId,
      entityTableName: 'campaign',
      scheduledAtMs: 0,
      delayMs: 24 * 60 * 60 * 1000,
    } as z.infer<typeof entityReminderSchema>);
  });

  it('should not cancel entity reminder workflow for other campaign types', async () => {
    const campaignId = randomUUID();

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<CampaignSource>({
        after: {
          id: campaignId,
          referenceId: 's1',
          userId: '1',
          type: CampaignType.Squad,
          state: CampaignState.Active,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          endedAt: Date.now(),
          flags: JSON.stringify({}),
          sourceId: 's1',
        },
        op: 'c',
        table: 'campaign',
      }),
    );

    expect(runEntityReminderWorkflow).toHaveBeenCalledTimes(0);
    expect(cancelEntityReminderWorkflow).toHaveBeenCalledTimes(0);
  });
});

describe('poll post', () => {
  it('should schedule entity reminder workflow for poll creation', async () => {
    const pollId = randomUUID();
    const createdAt = new Date('2021-09-22T07:15:51.247Z').getTime() * 1000; // Convert to debezium microseconds

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<PollPost>({
        after: {
          id: pollId,
          type: PostType.Poll,
          createdAt,
        },
        op: 'c',
        table: 'post',
      }),
    );

    expect(cancelEntityReminderWorkflow).toHaveBeenCalledTimes(0);
    expect(runEntityReminderWorkflow).toHaveBeenCalledTimes(1);
    expect(runEntityReminderWorkflow).toHaveBeenCalledWith({
      entityId: pollId,
      entityTableName: 'post',
      scheduledAtMs: 0,
      delayMs: 14 * 24 * 60 * 60 * 1000, // 14 days in milliseconds (default poll duration)
    });
  });

  it('should cancel entity reminder workflow when poll is deleted', async () => {
    const pollId = randomUUID();
    const createdAt = new Date('2021-09-22T07:15:51.247Z').getTime() * 1000; // Convert to debezium microseconds

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<PollPost>({
        before: {
          id: pollId,
          type: PostType.Poll,
          createdAt,
          deleted: false,
        },
        after: {
          id: pollId,
          type: PostType.Poll,
          createdAt,
          deleted: true,
        },
        op: 'u',
        table: 'post',
      }),
    );

    expect(runEntityReminderWorkflow).toHaveBeenCalledTimes(0);
    expect(cancelEntityReminderWorkflow).toHaveBeenCalledTimes(1);
    expect(cancelEntityReminderWorkflow).toHaveBeenCalledWith({
      entityId: pollId,
      entityTableName: 'post',
      scheduledAtMs: 0,
      delayMs: 14 * 24 * 60 * 60 * 1000, // 14 days in milliseconds (default poll duration)
    });
  });

  it('should schedule entity reminder workflow for poll creation with specific endsAt', async () => {
    const pollId = randomUUID();
    const createdAt = new Date('2021-09-22T07:15:51.247Z').getTime() * 1000;
    const endsAt = new Date('2021-09-25T07:15:51.247Z').getTime() * 1000; // 3 days later, as debezium microseconds

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<PollPost>({
        after: {
          id: pollId,
          type: PostType.Poll,
          createdAt,
          endsAt: endsAt,
        },
        op: 'c',
        table: 'post',
      }),
    );

    expect(cancelEntityReminderWorkflow).toHaveBeenCalledTimes(0);
    expect(runEntityReminderWorkflow).toHaveBeenCalledTimes(1);
    expect(runEntityReminderWorkflow).toHaveBeenCalledWith({
      entityId: pollId,
      entityTableName: 'post',
      scheduledAtMs: 0,
      delayMs: 3 * 24 * 60 * 60 * 1000, // 3 days in milliseconds
    });
  });

  it('should handle poll with null endsAt field correctly', async () => {
    const pollId = randomUUID();
    const createdAt = new Date('2021-09-22T07:15:51.247Z').getTime() * 1000;

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<PollPost>({
        after: {
          id: pollId,
          type: PostType.Poll,
          createdAt,
          endsAt: null,
        },
        op: 'c',
        table: 'post',
      }),
    );

    expect(cancelEntityReminderWorkflow).toHaveBeenCalledTimes(0);
    expect(runEntityReminderWorkflow).toHaveBeenCalledTimes(1);
    expect(runEntityReminderWorkflow).toHaveBeenCalledWith({
      entityId: pollId,
      entityTableName: 'post',
      scheduledAtMs: 0,
      delayMs: 14 * 24 * 60 * 60 * 1000, // 14 days in milliseconds (default when endsAt is null)
    });
  });

  it('should cancel entity reminder workflow when poll with specific endsAt is deleted', async () => {
    const pollId = randomUUID();
    const createdAt = new Date('2021-09-22T07:15:51.247Z').getTime() * 1000; // Convert to debezium microseconds
    const endsAt = new Date('2021-09-25T07:15:51.247Z').getTime() * 1000; // 3 days later, as debezium microseconds

    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<PollPost>({
        before: {
          id: pollId,
          type: PostType.Poll,
          createdAt,
          endsAt: endsAt,
          deleted: false,
        },
        after: {
          id: pollId,
          type: PostType.Poll,
          createdAt,
          endsAt: endsAt,
          deleted: true,
        },
        op: 'u',
        table: 'post',
      }),
    );

    expect(runEntityReminderWorkflow).toHaveBeenCalledTimes(0);
    expect(cancelEntityReminderWorkflow).toHaveBeenCalledTimes(1);
    expect(cancelEntityReminderWorkflow).toHaveBeenCalledWith({
      entityId: pollId,
      entityTableName: 'post',
      scheduledAtMs: 0,
      delayMs: 3 * 24 * 60 * 60 * 1000, // 3 days in milliseconds (based on endsAt)
    });
  });
});

describe('user experience change', () => {
  type ObjectType = UserExperience;
  let experienceId: string;
  const base: ChangeObject<UserExperienceWork> = {
    id: 'test-uuid',
    userId: '1',
    companyId: 'comp1',
    title: 'Software Engineer',
    startedAt: new Date('2020-01-01').getTime(),
    verified: false,
    type: UserExperienceType.Work,
    createdAt: new Date().getTime(),
    updatedAt: new Date().getTime(),
    description: null,
    endedAt: null,
    subtitle: null,
    customCompanyName: null,
    locationId: null,
    locationType: null,
  };

  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
    // Create company records
    await con.getRepository(Company).save({
      id: 'comp1',
      name: 'Test Company 1',
      image: 'https://example.com/image.png',
      domains: ['testcompany1.com'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe('on create', () => {
    it('should not verify experience work when type is not Work', async () => {
      const after: ChangeObject<ObjectType> = {
        ...base,
        type: 'Education' as UserExperienceType,
      };

      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: null,
          op: 'c',
          table: 'user_experience',
        }),
      );

      // No database operation should happen since type is not Work
      const experience = await con
        .getRepository(UserExperienceWork)
        .findOneBy({ userId: '1', companyId: 'comp1' });
      expect(experience).toBeNull();
    });

    it('should not verify experience work when companyId is not set', async () => {
      const after: ChangeObject<UserExperienceWork> = {
        ...base,
        companyId: null,
      };

      // Create the experience
      await con.getRepository(UserExperienceWork).save({
        userId: '1',
        companyId: null,
        title: 'Software Engineer',
        startedAt: new Date('2020-01-01'),
        verified: false,
        type: UserExperienceType.Work,
      });

      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: null,
          op: 'c',
          table: 'user_experience',
        }),
      );

      const experience = await con
        .getRepository(UserExperienceWork)
        .findOneBy({ userId: '1', title: 'Software Engineer' });
      expect(experience?.verified).toBe(false);
    });

    it('should not verify experience work when user company is not verified', async () => {
      // Create unverified user company
      await con.getRepository(UserCompany).save({
        userId: '1',
        code: '123456',
        email: 'test@daily.dev',
        verified: false,
        companyId: 'comp1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create the experience
      const experience = await con.getRepository(UserExperienceWork).save({
        userId: '1',
        companyId: 'comp1',
        title: 'Software Engineer',
        startedAt: new Date('2020-01-01'),
        verified: false,
        type: UserExperienceType.Work,
      });
      experienceId = experience.id;

      const after: ChangeObject<UserExperienceWork> = {
        ...base,
        id: experienceId,
      };

      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: null,
          op: 'c',
          table: 'user_experience',
        }),
      );

      const updatedExperience = await con
        .getRepository(UserExperienceWork)
        .findOneBy({ id: experienceId });
      expect(updatedExperience?.verified).toBe(false);
    });

    it('should verify experience work when user company is verified', async () => {
      // Create verified user company
      await con.getRepository(UserCompany).save({
        userId: '1',
        code: '123456',
        email: 'test@daily.dev',
        verified: true,
        companyId: 'comp1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create the experience
      const experience = await con.getRepository(UserExperienceWork).save({
        userId: '1',
        companyId: 'comp1',
        title: 'Software Engineer',
        startedAt: new Date('2020-01-01'),
        verified: false,
        type: UserExperienceType.Work,
      });
      experienceId = experience.id;

      const after: ChangeObject<UserExperienceWork> = {
        ...base,
        id: experienceId,
      };

      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before: null,
          op: 'c',
          table: 'user_experience',
        }),
      );

      const updatedExperience = await con
        .getRepository(UserExperienceWork)
        .findOneBy({ id: experienceId });
      expect(updatedExperience?.verified).toBe(true);
    });
  });

  describe('on update', () => {
    beforeEach(async () => {
      // Create company records for comp2
      await con.getRepository(Company).save({
        id: 'comp2',
        name: 'Test Company 2',
        image: 'https://example.com/image2.png',
        domains: ['testcompany2.com'],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create verified user company for comp1
      await con.getRepository(UserCompany).save({
        userId: '1',
        code: '123456',
        email: 'test@daily.dev',
        verified: true,
        companyId: 'comp1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create unverified user company for comp2
      await con.getRepository(UserCompany).save({
        userId: '1',
        code: '789012',
        email: 'test2@daily.dev',
        verified: false,
        companyId: 'comp2',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create the experience
      const experience = await con.getRepository(UserExperienceWork).save({
        userId: '1',
        companyId: 'comp1',
        title: 'Software Engineer',
        startedAt: new Date('2020-01-01'),
        verified: false,
        type: UserExperienceType.Work,
      });
      experienceId = experience.id;
    });

    it('should not update verification when companyId has not changed', async () => {
      const before: ChangeObject<UserExperienceWork> = {
        ...base,
        id: experienceId,
      };
      const after: ChangeObject<UserExperienceWork> = {
        ...base,
        id: experienceId,
        title: 'Senior Software Engineer',
      };

      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before,
          op: 'u',
          table: 'user_experience',
        }),
      );

      const experience = await con
        .getRepository(UserExperienceWork)
        .findOneBy({ id: experienceId });
      expect(experience?.verified).toBe(false);
    });

    it('should verify when companyId changed to verified company', async () => {
      // First update experience to point to comp2
      await con
        .getRepository(UserExperienceWork)
        .update({ id: experienceId }, { companyId: 'comp2' });

      const before: ChangeObject<UserExperienceWork> = {
        ...base,
        id: experienceId,
        companyId: 'comp2',
      };
      const after: ChangeObject<UserExperienceWork> = {
        ...base,
        id: experienceId,
        companyId: 'comp1',
      };

      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before,
          op: 'u',
          table: 'user_experience',
        }),
      );

      const experience = await con
        .getRepository(UserExperienceWork)
        .findOneBy({ id: experienceId });
      expect(experience?.verified).toBe(true);
    });

    it('should unverify when companyId changed to unverified company', async () => {
      // First set experience as verified
      await con
        .getRepository(UserExperienceWork)
        .update({ id: experienceId }, { verified: true });

      const before: ChangeObject<UserExperienceWork> = {
        ...base,
        id: experienceId,
        companyId: 'comp1',
        verified: true,
      };
      const after: ChangeObject<UserExperienceWork> = {
        ...base,
        id: experienceId,
        verified: true,
        companyId: 'comp2',
      };

      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before,
          op: 'u',
          table: 'user_experience',
        }),
      );

      const experience = await con
        .getRepository(UserExperienceWork)
        .findOneBy({ id: experienceId });
      expect(experience?.verified).toBe(false);
    });

    it('should unverify when companyId changed to null', async () => {
      // First set experience as verified
      await con
        .getRepository(UserExperienceWork)
        .update({ id: experienceId }, { verified: true });

      const before: ChangeObject<UserExperienceWork> = {
        ...base,
        id: experienceId,
        companyId: 'comp1',
        verified: true,
      };
      const after: ChangeObject<UserExperienceWork> = {
        ...base,
        id: experienceId,
        verified: true,
        companyId: null,
      };

      await expectSuccessfulBackground(
        worker,
        mockChangeMessage<ObjectType>({
          after,
          before,
          op: 'u',
          table: 'user_experience',
        }),
      );

      const experience = await con
        .getRepository(UserExperienceWork)
        .findOneBy({ id: experienceId });
      expect(experience?.verified).toBe(false);
    });
  });
});

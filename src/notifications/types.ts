import {
  Bookmark,
  Comment,
  NotificationAttachmentV2,
  NotificationAvatarV2,
  NotificationV2,
  Post,
  Source,
  SourceRequest,
  SquadPublicRequest,
  Submission,
  User,
  UserStreak,
  type Keyword,
  type UserTopReader,
  SquadSource,
  type Organization,
  type Campaign,
} from '../entity';
import { ChangeObject } from '../types';
import { DeepPartial } from 'typeorm';
import { SourceMemberRoles } from '../roles';
import { SourcePostModeration } from '../entity/SourcePostModeration';
import type { UserTransaction } from '../entity/user/UserTransaction';
import type { CampaignUpdateEvent } from '../common/campaign/common';
import type { PostAnalytics } from '../entity/posts/PostAnalytics';

export type Reference<T> = ChangeObject<T> | T;

export type NotificationBundleV2 = {
  notification: DeepPartial<NotificationV2>;
  userIds: string[];
  avatars?: DeepPartial<NotificationAvatarV2>[];
  attachments?: DeepPartial<NotificationAttachmentV2>[];
};

export type NotificationBaseContext = {
  userIds: string[];
  initiatorId?: string | null;
  sendAtMs?: number;
  dedupKey?: string;
};
export type NotificationSubmissionContext = NotificationBaseContext & {
  submission: Pick<Submission, 'id'>;
};

export type NotificationSourceContext = NotificationBaseContext & {
  source: Reference<Source>;
};

export type NotificationPostModerationContext = NotificationUserContext &
  NotificationBaseContext &
  NotificationSourceContext & {
    post: Reference<SourcePostModeration>;
  };

export type NotificationPostContext<T extends Post = Post> =
  NotificationBaseContext &
    NotificationSourceContext & {
      post: Reference<T>;
      sharedPost?: Reference<Post> | null;
      moderated?: Reference<SourcePostModeration>;
    };

export type NotificationPostAnalyticsContext = NotificationPostContext & {
  analytics: Pick<PostAnalytics, 'impressions'>;
};

export type NotificationCommentContext = NotificationPostContext & {
  comment: Reference<Comment>;
};

export type NotificationBookmarkContext = NotificationBaseContext & {
  bookmark: Reference<Bookmark>;
};

export type NotificationStreakContext = NotificationBaseContext & {
  streak: Omit<Reference<UserStreak>, 'lastViewAt'> & {
    lastViewAt: number;
  };
};

export type NotificationGiftPlusContext = NotificationBaseContext & {
  gifter: Reference<User>;
  recipient: Reference<User>;
  squad: Reference<SquadSource>;
};

export type NotificationAwardContext = NotificationBaseContext & {
  transaction: Reference<UserTransaction>;
  sender: Reference<User>;
  receiver: Reference<User>;
  targetUrl: string;
  source?: Reference<Source>;
};

export type NotificationCommenterContext = NotificationCommentContext & {
  commenter: Reference<User>;
};

export type NotificationUpvotersContext = NotificationBaseContext & {
  upvotes: number;
  upvoters: Reference<User>[];
};

export type NotificationSourceRequestContext = NotificationBaseContext & {
  sourceRequest: Reference<SourceRequest>;
};

export type NotificationSquadRequestContext = NotificationBaseContext & {
  squadRequest: Reference<SquadPublicRequest>;
};

export type NotificationDoneByContext = NotificationBaseContext & {
  doneBy: Reference<User>;
  doneTo?: Reference<User>;
};

export type NotificationSourceMemberRoleContext = NotificationSourceContext & {
  role: Reference<SourceMemberRoles>;
};

export type NotificationCollectionContext = NotificationPostContext & {
  sources: Reference<Source>[];
  total: number;
};

export type NotificationUserContext = NotificationBaseContext & {
  user: Reference<User>;
};

export type NotificationUserTopReaderContext = NotificationBaseContext & {
  userTopReader: Reference<UserTopReader>;
  keyword: Reference<Keyword>;
};

export type NotificationOrganizationContext = NotificationUserContext & {
  organization: Reference<Organization>;
};

export type NotificationBoostContext = NotificationUserContext & {
  campaignId: string;
};

export interface NotificationCampaignContext extends NotificationUserContext {
  campaign: Reference<Campaign>;
  event: CampaignUpdateEvent;
}

export interface NotificationCampaignSourceContext
  extends NotificationCampaignContext {
  source: Reference<Source>;
}

export type NotificationOpportunityMatchContext = NotificationBaseContext & {
  opportunityId: string;
  reasoningShort: string;
};

export type NotificationWarmIntroContext = NotificationBaseContext & {
  description: string;
  opportunityId: string;
  recruiter: Reference<User>;
  organization: Reference<Organization>;
};

declare module 'fs' {
  interface ReadStream {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: 'data', listener: (chunk: any) => void): this;
  }
}

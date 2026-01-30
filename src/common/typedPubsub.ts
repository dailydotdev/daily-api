import {
  ChangeObject,
  type ChangeMessage,
  type ContentLanguage,
} from '../types';
import {
  Post,
  SourceRequest,
  SquadPublicRequest,
  SquadSource,
  User,
  UserStreak,
  UserCompany,
  UserTopReader,
  PostTranslation,
  Organization,
  ReputationEvent,
  CollectionPost,
  CommentMention,
  Submission,
  PostMention,
  SourceMember,
} from '../entity';
import {
  type EventLogger,
  NotificationReason,
  publishEvent,
  pubsub,
} from './pubsub';
import {
  ApplicationScored,
  CandidateAcceptedOpportunityMessage,
  CandidatePreferenceUpdated,
  CandidateRejectedOpportunityMessage,
  ContentUpdatedMessage,
  MatchedCandidate,
  type OpportunityMessage,
  type OpportunityPreviewResult,
  RecruiterAcceptedCandidateMatchMessage,
  type TransferResponse,
  type UserBriefingRequest,
  type UserProfileUpdatedMessage,
  WarmIntro,
} from '@dailydotdev/schema';
import { SourcePostModeration } from '../entity/SourcePostModeration';
import type { UserTransaction } from '../entity/user/UserTransaction';
import type { ContentPreferenceUser } from '../entity/contentPreference/ContentPreferenceUser';
import { z } from 'zod';
import type { postMetricsUpdatedTopic } from './schema/topics';
import type { CampaignUpdateEventArgs } from './campaign/common';
import type { entityReminderSchema } from './schema/reminders';
import { SourceMemberRoles } from '../roles';

export type PubSubSchema = {
  'pub-request': {
    reason: NotificationReason;
    sourceRequest: ChangeObject<SourceRequest>;
  };
  'post-upvoted': {
    postId: string;
    userId: string;
  };
  'post-upvote-canceled': {
    postId: string;
    userId: string;
  };
  'api.v1.post-downvoted': {
    postId: string;
    userId: string;
  };
  'api.v1.post-downvote-canceled': {
    postId: string;
    userId: string;
  };
  'comment-commented': {
    postId: string;
    userId: string;
    parentCommentId: string;
    childCommentId: string;
    contentHtml: string;
  };
  'comment-upvoted': {
    commentId: string;
    userId: string;
  };
  'comment-upvote-canceled': {
    commentId: string;
    userId: string;
  };
  'api.v1.comment-downvoted': {
    commentId: string;
    userId: string;
  };
  'api.v1.comment-downvote-canceled': {
    commentId: string;
    userId: string;
  };
  'user-updated': {
    user: ChangeObject<User>;
    newProfile: ChangeObject<User>;
  };
  'user-deleted': {
    id: string;
    kratosUser: boolean;
    email: string;
  };
  'api.v1.user-created': {
    user: ChangeObject<User>;
  };
  'api.v1.squad-public-request': {
    request: ChangeObject<SquadPublicRequest>;
  };
  'api.v1.content-updated': ContentUpdatedMessage;
  'api.v1.user-post-promoted': {
    postId: string;
    userId: string;
    validUntil: string; // ISO 8601 str
  };
  'api.v1.user-streak-updated': {
    streak: ChangeObject<UserStreak>;
  };
  'api.v1.source-post-moderation-approved': {
    post: ChangeObject<SourcePostModeration>;
  };
  'api.v1.source-post-moderation-rejected': {
    post: ChangeObject<SourcePostModeration>;
  };
  'api.v1.source-post-moderation-submitted': {
    post: ChangeObject<SourcePostModeration>;
  };
  'api.v1.post-bookmark-reminder': {
    postId: string;
    userId: string;
  };
  'post-commented': {
    userId: string;
    commentId: string;
    contentHtml: string;
    postId: string;
  };
  'api.v1.post-visible': {
    post: ChangeObject<Post>;
  };
  'api.v1.squad-featured-updated': {
    squad: ChangeObject<SquadSource>;
  };
  'api.v1.user-company-approved': {
    userCompany: ChangeObject<UserCompany>;
  };
  'api.v1.user-top-reader': {
    userTopReader: ChangeObject<UserTopReader>;
  };
  'kvasir.v1.post-translated': {
    id: string;
    language: ContentLanguage;
    translations: PostTranslation;
  };
  'njord.v1.balance-log': TransferResponse;
  'api.v1.user-transaction': {
    transaction: ChangeObject<UserTransaction>;
  };
  'api.v1.organization-user-joined': {
    organizationId: Organization['id'];
    memberId: User['id'];
  };
  'api.v1.organization-user-left': {
    organizationId: Organization['id'];
    memberId: User['id'];
  };
  'api.v1.organization-user-removed': {
    organizationId: Organization['id'];
    memberId: User['id'];
  };
  'api.v1.brief-generate': {
    payload: UserBriefingRequest;
    postId: string;
    sendAtMs?: number;
  };
  'api.v1.brief-ready': {
    payload: UserBriefingRequest;
    postId: string;
    sendAtMs?: number;
  };
  'api.v1.user-follow': {
    payload: ChangeObject<ContentPreferenceUser>;
  };
  'skadi.v2.campaign-updated': CampaignUpdateEventArgs;
  'api.v1.post-metrics-updated': z.infer<typeof postMetricsUpdatedTopic>;
  'api.v1.reputation-event': {
    op: ChangeMessage<unknown>['payload']['op'];
    payload: ChangeObject<ReputationEvent>;
  };
  'api.v1.candidate-accepted-opportunity': CandidateAcceptedOpportunityMessage;
  'api.v1.candidate-review-opportunity': CandidateAcceptedOpportunityMessage;
  'api.v1.opportunity-added': OpportunityMessage;
  'api.v1.opportunity-updated': OpportunityMessage;
  'api.v1.opportunity-in-review': {
    opportunityId: string;
    organizationId: string;
    title: string;
  };
  'api.v1.opportunity-went-live': {
    opportunityId: string;
    title: string;
  };
  'api.v1.opportunity-external-payment': {
    opportunityId: string;
    title: string;
  };
  'api.v1.opportunity-flags-change': {
    opportunityId: string;
    before: string | null;
    after: string | null;
  };
  'gondul.v1.candidate-opportunity-match': MatchedCandidate;
  'api.v1.candidate-preference-updated': CandidatePreferenceUpdated;
  'api.v1.delayed-notification-reminder': z.infer<typeof entityReminderSchema>;
  'send-analytics-report': {
    postId: string;
  };
  'post-banned-or-removed': {
    post: ChangeObject<Post>;
    method: 'hard' | 'soft';
  };
  'api.v1.post-collection-updated': {
    post: ChangeObject<CollectionPost>;
  };
  'api.v1.new-comment-mention': {
    commentMention: ChangeObject<CommentMention>;
  };
  'community-link-rejected': ChangeObject<Submission>;
  'user-reputation-updated': {
    user: ChangeObject<User>;
    userAfter: ChangeObject<User>;
  };
  'api.v1.new-post-mention': {
    postMention: ChangeObject<PostMention>;
  };
  'api.v1.source-member-role-changed': {
    previousRole: SourceMemberRoles;
    sourceMember: ChangeObject<SourceMember>;
  };
  'api.v1.member-joined-source': {
    sourceMember: ChangeObject<SourceMember>;
  };
  'api.v1.recruiter-accepted-candidate-match': RecruiterAcceptedCandidateMatchMessage;
  'api.v1.candidate-rejected-opportunity': CandidateRejectedOpportunityMessage;
  'api.v1.recruiter-rejected-candidate-match': CandidateRejectedOpportunityMessage;
  'gondul.v1.candidate-application-scored': ApplicationScored;
  'gondul.v1.warm-intro-generated': WarmIntro;
  'api.v1.user-profile-updated': UserProfileUpdatedMessage;
  'gondul.v1.opportunity-preview-results': OpportunityPreviewResult;
  'api.v1.opportunity-feedback-submitted': {
    opportunityId: string;
    userId: string;
  };
  'api.v1.experience-company-enriched': {
    experienceId: string;
    userId: string;
    companyId: string;
  };
  'api.v1.opportunity-parse': {
    opportunityId: string;
  };
  'api.v1.feedback-created': {
    feedbackId: string;
  };
};

export async function triggerTypedEvent<T extends keyof PubSubSchema>(
  log: EventLogger,
  topic: T,
  data: PubSubSchema[T],
): Promise<void> {
  await publishEvent(log, pubsub.topic(topic), data);
}

import z from 'zod';
import { UserPersonalizedDigestType } from '../../entity';
import { NotificationType } from '../../notifications/common';

const notificationPreferenceSchema = z.object({
  email: z.enum(['muted', 'subscribed']),
  inApp: z.enum(['muted', 'subscribed']),
});

export const notificationFlagsSchema = z
  .object({
    [NotificationType.ArticleNewComment]: notificationPreferenceSchema,
    [NotificationType.CommentReply]: notificationPreferenceSchema,
    [NotificationType.ArticleUpvoteMilestone]: notificationPreferenceSchema,
    [NotificationType.CommentUpvoteMilestone]: notificationPreferenceSchema,
    [NotificationType.PostMention]: notificationPreferenceSchema,
    [NotificationType.CommentMention]: notificationPreferenceSchema,
    [NotificationType.ArticleReportApproved]: notificationPreferenceSchema,
    [NotificationType.StreakResetRestore]: notificationPreferenceSchema,
    [UserPersonalizedDigestType.StreakReminder]: notificationPreferenceSchema,
    [NotificationType.UserTopReaderBadge]: notificationPreferenceSchema,
    [NotificationType.DevCardUnlocked]: notificationPreferenceSchema,
    [NotificationType.SourcePostAdded]: notificationPreferenceSchema,
    [NotificationType.SquadPostAdded]: notificationPreferenceSchema,
    [NotificationType.UserPostAdded]: notificationPreferenceSchema,
    [NotificationType.CollectionUpdated]: notificationPreferenceSchema,
    [NotificationType.PostBookmarkReminder]: notificationPreferenceSchema,
    [NotificationType.PromotedToAdmin]: notificationPreferenceSchema,
    [NotificationType.PromotedToModerator]: notificationPreferenceSchema,
    [NotificationType.DemotedToMember]: notificationPreferenceSchema,
    [NotificationType.SourceApproved]: notificationPreferenceSchema,
    [NotificationType.SourceRejected]: notificationPreferenceSchema,
    [NotificationType.SourcePostApproved]: notificationPreferenceSchema,
    [NotificationType.SourcePostRejected]: notificationPreferenceSchema,
    [NotificationType.SourcePostSubmitted]: notificationPreferenceSchema,
    [NotificationType.ArticlePicked]: notificationPreferenceSchema,
    [NotificationType.UserReceivedAward]: notificationPreferenceSchema,
    [NotificationType.BriefingReady]: notificationPreferenceSchema,
    [NotificationType.SquadNewComment]: notificationPreferenceSchema,
    [NotificationType.ArticleAnalytics]: notificationPreferenceSchema,
    [NotificationType.SquadMemberJoined]: notificationPreferenceSchema,
    [NotificationType.SquadReply]: notificationPreferenceSchema,
    [NotificationType.SquadBlocked]: notificationPreferenceSchema,
    [NotificationType.SquadFeatured]: notificationPreferenceSchema,
  })
  .strict();

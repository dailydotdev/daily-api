export enum NotificationType {
  CommunityPicksFailed = 'community_picks_failed',
  CommunityPicksSucceeded = 'community_picks_succeeded',
  CommunityPicksGranted = 'community_picks_granted',
  ArticlePicked = 'article_picked',
  ArticleNewComment = 'article_new_comment',
  ArticleUpvoteMilestone = 'article_upvote_milestone',
  ArticleReportApproved = 'article_report_approved',
  ArticleAnalytics = 'article_analytics',
  SourceApproved = 'source_approved',
  SourceRejected = 'source_rejected',
  CommentMention = 'comment_mention',
  CommentReply = 'comment_reply',
  CommentUpvoteMilestone = 'comment_upvote_milestone',
  SquadAccess = 'squad_access',
  SquadPostAdded = 'squad_post_added',
  SquadMemberJoined = 'squad_member_joined',
  SquadNewComment = 'squad_new_comment',
  SquadReply = 'squad_reply',
  SquadPostViewed = 'squad_post_viewed',
  SquadSubscribeToNotification = 'squad_subscribe_to_notification',
  SquadBlocked = 'squad_blocked',
  PromotedToAdmin = 'promoted_to_admin',
  DemotedToMember = 'demoted_to_member',
  PromotedToModerator = 'promoted_to_moderator',
  PostMention = 'post_mention',
}

export enum NotificationPreferenceType {
  Post = 'post',
  Comment = 'comment',
  Source = 'source',
}

export enum NotificationPreferenceStatus {
  Muted = 'muted',
}

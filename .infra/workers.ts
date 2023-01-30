interface Worker {
  topic: string;
  subscription: string;
  args?: { enableMessageOrdering?: boolean };
}

export const workers: Worker[] = [
  {
    topic: 'views',
    subscription: 'add-views-v2',
  },
  {
    topic: 'user-updated',
    subscription: 'user-updated-api-mailing',
  },
  {
    topic: 'user-deleted',
    subscription: 'user-deleted-api-mailing',
  },
  {
    topic: 'comment-upvoted',
    subscription: 'comment-upvoted-rep',
  },
  {
    topic: 'comment-upvote-canceled',
    subscription: 'comment-upvote-canceled-rep',
  },
  {
    topic: 'api.v1.post-added',
    subscription: 'api.post-scout-matched-slack',
  },
  {
    topic: 'comment-commented',
    subscription: 'comment-commented-slack-message',
  },
  {
    topic: 'post-upvoted',
    subscription: 'post-upvoted-rep',
  },
  {
    topic: 'post-upvote-canceled',
    subscription: 'post-upvote-canceled-rep',
  },
  /*{
    topic: 'post-commented',
    subscription: 'post-commented-author-tweet',
  },*/
  {
    topic: 'post-commented',
    subscription: 'post-commented-redis',
  },
  {
    topic: 'post-commented',
    subscription: 'post-commented-slack-message',
  },
  {
    topic: 'post-upvoted',
    subscription: 'post-upvoted-redis',
  },
  {
    topic: 'post-banned-or-removed',
    subscription: 'post-banned-rep',
  },
  {
    topic: 'pub-request',
    subscription: 'pub-request-rep',
  },
  {
    topic: 'username-changed',
    subscription: 'username-changed-api',
  },
  {
    topic: 'username-changed',
    subscription: 'api.username-changed-update-notifications',
  },
  {
    topic: 'update-comments',
    subscription: 'update-comments-mention',
  },
  {
    topic: 'api.changes',
    subscription: 'api-cdc',
    args: { enableMessageOrdering: true },
  },
  {
    topic: 'api.v1.new-notification',
    subscription: 'api.unread-notification-count',
  },
  {
    topic: 'api.v1.new-notification',
    subscription: 'api.new-notification-real-time',
  },
  {
    topic: 'api.v1.new-notification',
    subscription: 'api.new-notification-mail',
  },
  {
    topic: 'api.v1.new-notification',
    subscription: 'api.new-notification-push',
  },
  {
    topic: 'api.v1.member-joined-source',
    subscription: 'api.squad-activation',
  },
  {
    topic: 'api.v1.source-privacy-updated',
    subscription: 'source-privacy-updated-api',
  },
  // Notifications
  {
    topic: 'community-link-rejected',
    subscription: 'api.community-picks-failed-notification',
  },
  {
    topic: 'community-link-access',
    subscription: 'api.community-picks-granted-notification',
  },
  {
    topic: 'post-commented',
    subscription: 'api.article-new-comment-notification.post-commented',
  },
  {
    topic: 'comment-commented',
    subscription: 'api.article-new-comment-notification.comment-commented',
  },
  {
    topic: 'post-upvoted',
    subscription: 'api.article-upvote-milestone-notification',
  },
  {
    topic: 'send-analytics-report',
    subscription: 'api.article-analytics-notification',
  },
  {
    topic: 'post-banned-or-removed',
    subscription: 'api.article-report-approved-notification',
  },
  {
    topic: 'pub-request',
    subscription: 'api.source-request-notification',
  },
  {
    topic: 'api.v1.new-comment-mention',
    subscription: 'api.comment-mention-notification',
  },
  {
    topic: 'comment-commented',
    subscription: 'api.comment-reply-notification',
  },
  {
    topic: 'comment-upvoted',
    subscription: 'api.comment-upvote-milestone-notification',
  },
  {
    topic: 'api.v1.post-added',
    subscription: 'api.post-added-notification',
  },
  {
    topic: 'api.v1.member-joined-source',
    subscription: 'api.member-joined-source-notification',
  },
  {
    topic: 'api.v1.member-joined-source',
    subscription: 'api.squad-feature-access',
  },
  {
    topic: 'api.v1.feature-granted',
    subscription: 'api.feature-access-notification',
  },
  {
    topic: 'views',
    subscription: 'api.post-viewed-notification',
  },
  {
    topic: 'api.v1.user-created',
    subscription: 'api.add-to-mailing-list',
  },
];

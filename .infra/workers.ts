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
    subscription: 'comment-upvoted-mail',
  },
  {
    topic: 'comment-commented',
    subscription: 'comment-commented-mail',
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
    topic: 'comment-commented',
    subscription: 'comment-commented-thread',
  },
  {
    topic: 'post-author-matched',
    subscription: 'post-author-matched-mail',
  },
  {
    topic: 'community-link-rejected',
    subscription: 'community-link-rejected-mail',
  },
  {
    topic: 'community-link-access',
    subscription: 'community-link-access-mail',
  },
  {
    topic: 'post-scout-matched',
    subscription: 'post-scout-matched-mail',
  },
  {
    topic: 'post-scout-matched',
    subscription: 'post-scout-matched-slack',
  },
  {
    topic: 'comment-commented',
    subscription: 'comment-commented-author-mail',
  },
  {
    topic: 'comment-commented',
    subscription: 'comment-commented-slack-message',
  },
  {
    topic: 'post-commented',
    subscription: 'post-commented-author-mail',
  },
  {
    topic: 'post-upvoted',
    subscription: 'post-upvoted-rep',
  },
  {
    topic: 'post-upvote-canceled',
    subscription: 'post-upvote-canceled-rep',
  },
  {
    topic: 'send-analytics-report',
    subscription: 'send-analytics-report-mail',
  },
  /*{
    topic: 'post-commented',
    subscription: 'post-commented-author-tweet',
  },*/
  {
    topic: 'post-reached-views-threshold',
    subscription: 'post-reached-views-threshold-tweet',
  },
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
    topic: 'post-banned-or-removed',
    subscription: 'post-banned-email',
  },
  {
    topic: 'pub-request',
    subscription: 'source-request-mail',
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
    subscription: 'api.new-notification-redis',
  },
  {
    topic: 'api.v1.new-comment-mention',
    subscription: 'api.comment-mention-mail',
  },
  // Notifications
  {
    topic: 'community-link-rejected',
    subscription: 'api.community-picks-failed-notification',
  },
  {
    topic: 'post-scout-matched',
    subscription: 'api.community-picks-succeeded-notification',
  },
  {
    topic: 'community-link-access',
    subscription: 'api.community-picks-granted-notification',
  },
  {
    topic: 'post-author-matched',
    subscription: 'api.article-picked-notification',
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
];

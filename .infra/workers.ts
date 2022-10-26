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
  {
    topic: 'post-commented',
    subscription: 'post-commented-author-tweet',
  },
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
];

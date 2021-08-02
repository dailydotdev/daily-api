import { Worker } from '@dailydotdev/pulumi-common';

export const workers: Worker[] = [
  {
    topic: 'views',
    subscription: 'add-views-v2',
  },
  {
    topic: 'post-image-processed',
    subscription: 'add-posts-v2',
  },
  {
    topic: 'find-segment',
    subscription: 'daily-api-v2',
  },
  {
    topic: 'user-registered',
    subscription: 'user-registered-api',
  },
  {
    topic: 'user-updated',
    subscription: 'user-updated-api',
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
    topic: 'comment-featured',
    subscription: 'comment-featured-rep',
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
    topic: 'comment-featured',
    subscription: 'comment-featured-mail',
  },
  {
    topic: 'post-author-matched',
    subscription: 'post-author-matched-mail',
  },
  {
    topic: 'comment-commented',
    subscription: 'comment-commented-author-mail',
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
    topic: 'views',
    subscription: 'check-devcard-eligibility',
  },
  {
    topic: 'devcard-eligible',
    subscription: 'devcard-eligible-amplitude',
  },
  {
    topic: 'devcard-eligible',
    subscription: 'devcard-eligible-email',
  },
];

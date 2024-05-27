import * as gcp from '@pulumi/gcp';

interface Worker {
  topic: string;
  subscription: string;
  args?: {
    enableMessageOrdering?: boolean;
    ackDeadlineSeconds?: number;
    expirationPolicy?: {
      ttl: string;
    };
    deadLetterPolicy?: {
      deadLetterTopic: string;
      maxDeliveryAttempts: number;
    };
  };
}

export const digestDeadLetter = 'api.v1.personalized-digest-email-dead-letter';

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
    topic: 'user-updated',
    subscription: 'api.user-updated-cio',
  },
  {
    topic: 'user-deleted',
    subscription: 'user-deleted-api-mailing',
  },
  {
    topic: 'user-deleted',
    subscription: 'api.user-deleted-cio',
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
    topic: 'api.v1.post-visible',
    subscription: 'api.post-scout-matched-slack-v2',
  },
  {
    topic: 'api.v1.post-visible',
    subscription: 'api.post-freeform-images',
  },
  {
    topic: 'api.v1.post-content-edited',
    subscription: 'api.post-edited-freeform-images',
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
  {
    topic: 'api.v1.post-downvoted',
    subscription: 'api.post-downvoted-rep',
  },
  {
    topic: 'api.v1.post-downvote-canceled',
    subscription: 'api.post-downvote-canceled-rep',
  },
  {
    topic: 'post-commented',
    subscription: 'api.post-commented-images',
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
    subscription: 'api.post-deleted-comments-cleanup',
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
    topic: 'api.v1.cdc-notifications',
    subscription: 'api.cdc-notifications',
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
    topic: 'api.v1.source-privacy-updated',
    subscription: 'api.source-privacy-updated',
  },
  {
    topic: 'api.v1.content-image-deleted',
    subscription: 'api.delete-cloudinary-image',
  },
  {
    topic: 'api.v1.comment-edited',
    subscription: 'api.comment-edited-images',
  },
  {
    topic: 'api.v1.comment-deleted',
    subscription: 'api.comment-deleted-images',
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
    topic: 'comment-commented',
    subscription: 'api.comment-commented-images',
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
    topic: 'api.v1.new-post-mention',
    subscription: 'api.post-mention-notification',
  },
  {
    topic: 'api.v1.new-comment-mention',
    subscription: 'api.comment-mention-notification',
  },
  {
    topic: 'user-reputation-updated',
    subscription: 'api.user-reputation-updated-notification',
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
    topic: 'api.v1.post-visible',
    subscription: 'api.post-added-notification-v2',
  },
  {
    topic: 'api.v1.member-joined-source',
    subscription: 'api.member-joined-source-notification',
  },
  {
    topic: 'api.v1.user-created',
    subscription: 'api.add-to-mailing-list',
  },
  {
    topic: 'api.v1.user-created',
    subscription: 'api.user-created-cio',
  },
  {
    topic: 'api.v1.banner-added',
    subscription: 'api.banner-added',
  },
  {
    topic: 'api.v1.banner-deleted',
    subscription: 'api.banner-deleted',
  },
  {
    topic: 'yggdrasil.v1.content-published',
    subscription: 'api.content-published',
  },
  {
    topic: 'api.v1.source-member-role-changed',
    subscription: 'api.source-member-role-changed-notification',
  },
  {
    topic: 'analytics-api.v1.experiment-allocated',
    subscription: 'api.experiment-allocated',
  },
  {
    topic: 'api.v1.source-created',
    subscription: 'api.source-created-squad-user-action',
  },
  {
    topic: 'api.v1.source-created',
    subscription: 'api.source-created-squad-owner-mailing',
  },
  {
    topic: 'api.v1.post-collection-updated',
    subscription: 'api.post-collection-updated-notification',
  },
  {
    topic: 'api.v1.user-readme-updated',
    subscription: 'api.user-readme-images',
  },
  {
    topic: 'api.v1.user-created',
    subscription: 'api.user-created-personalized-digest-send-type',
  },
  {
    topic: 'api.v1.comment-downvoted',
    subscription: 'api.comment-downvoted-rep',
  },
  {
    topic: 'api.v1.comment-downvote-canceled',
    subscription: 'api.comment-downvote-canceled-rep',
  },
  {
    topic: 'api.v1.squad-public-request',
    subscription: 'api.v1.squad-public-request-notification',
  },
];

export const personalizedDigestWorkers = [
  {
    topic: 'api.v1.generate-personalized-digest',
    subscription: 'api.personalized-digest-email',
    args: {
      ackDeadlineSeconds: 60,
      deadLetterPolicy: {
        deadLetterTopic: `projects/${gcp.config.project}/topics/${digestDeadLetter}`,
        maxDeliveryAttempts: 5,
      },
    },
  },
  {
    topic: digestDeadLetter,
    subscription: 'api.personalized-digest-email-dead-letter-log',
    args: {
      expirationPolicy: {
        ttl: '',
      },
    },
  },
];

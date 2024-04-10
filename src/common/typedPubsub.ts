import { ChangeObject } from '../types';
import { SourceRequest } from '../entity';
import {
  EventLogger,
  NotificationReason,
  publishEvent,
  pubsub,
} from './pubsub';

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
};

export async function triggerTypedEvent<T extends keyof PubSubSchema>(
  log: EventLogger,
  topic: T,
  data: PubSubSchema[T],
): Promise<void> {
  await publishEvent(log, pubsub.topic(topic), data);
}

import { PubSub, Topic } from '@google-cloud/pubsub';
import { Logger } from 'fastify';
import { SourceRequest } from '../entity';
import { toLegacySourceRequest } from '../compatibility/entity';

const pubsub = new PubSub();
const sourceRequestTopic = pubsub.topic('pub-request');
const postUpvotedTopic = pubsub.topic('post-upvoted');

type NotificationReason = 'new' | 'publish' | 'approve' | 'decline';

const publishEvent = async (
  log: Logger,
  topic: Topic,
  payload: object,
): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    try {
      await sourceRequestTopic.publishJSON(payload);
    } catch (err) {
      log.error(
        { err, topic: topic.name, payload },
        'failed to publish message',
      );
    }
  }
};

export const notifySourceRequest = async (
  log: Logger,
  reason: NotificationReason,
  sourceReq: SourceRequest,
): Promise<void> =>
  publishEvent(log, sourceRequestTopic, {
    type: reason,
    pubRequest: toLegacySourceRequest(sourceReq),
  });

export const notifyPostUpvoted = async (
  log: Logger,
  postId: string,
  userId: string,
): Promise<void> =>
  publishEvent(log, postUpvotedTopic, {
    postId,
    userId,
  });

import { PubSub } from '@google-cloud/pubsub';
import { SourceRequest } from '../entity';
import { toLegacySourceRequest } from '../compatibility/entity';

const pubsub = new PubSub();
const sourceRequestTopic = pubsub.topic('pub-request');

type NotificationReason = 'new';

export const notifySourceRequest = async (
  reason: NotificationReason,
  sourceReq: SourceRequest,
): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    await sourceRequestTopic.publishJSON({
      type: reason,
      pubRequest: toLegacySourceRequest(sourceReq),
    });
  }
};

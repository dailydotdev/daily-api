import { messageToJson, Worker } from './worker';
import { redisPubSub } from '../redis';
import { ChangeObject } from '../types';
import { NotificationV2 } from '../entity';
import { processStream } from '../common/streaming';
import {
  getNotificationV2AndChildren,
  streamNotificationUsers,
} from '../notifications/common';
import { counters } from '../telemetry';

interface Data {
  notification: ChangeObject<NotificationV2>;
}

const QUEUE_CONCURRENCY = 10;

const worker: Worker = {
  subscription: 'api.new-notification-real-time',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    if (!data.notification.public) {
      return;
    }
    try {
      const { id } = data.notification;
      const [notification, attachments, avatars] =
        await getNotificationV2AndChildren(con, id);
      if (notification) {
        const stream = await streamNotificationUsers(con, notification.id);
        await processStream<{ userId: string }>(
          stream,
          ({ userId }) =>
            redisPubSub.publish(`events.notifications.${userId}.new`, {
              ...notification,
              attachments,
              avatars,
            }),
          QUEUE_CONCURRENCY,
        );
      }
    } catch (err) {
      // Don't throw the error because we send the notification to multiple users, retrying may spam some users
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to send new notification event to redis',
      );
      counters.background.notificationFailed.add(1, { channel: 'real-time' });
    }
  },
};

export default worker;

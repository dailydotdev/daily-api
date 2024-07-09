import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';
import { NotificationV2 } from '../entity';
import { sendPushNotification } from '../onesignal';
import { getDisconnectedUsers } from '../subscription';
import { processStreamInBatches } from '../common/streaming';
import {
  getNotificationV2AndChildren,
  streamNotificationUsers,
} from '../notifications/common';
import { counters } from '../telemetry';

interface Data {
  notification: ChangeObject<NotificationV2>;
}

const BATCH_SIZE = 100;
const QUEUE_CONCURRENCY = 10;

const worker: Worker = {
  subscription: 'api.new-notification-push',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    if (data.notification.public) {
      const [notification, , avatars] = await getNotificationV2AndChildren(
        con,
        data.notification.id,
      );
      if (notification) {
        try {
          const stream = await streamNotificationUsers(con, notification.id);
          await processStreamInBatches(
            stream,
            async (batch: { userId: string }[]) => {
              const users = await getDisconnectedUsers(
                batch.map((b) => b.userId),
              );
              if (users.length) {
                await sendPushNotification(users, notification, avatars?.[0]);
              }
            },
            QUEUE_CONCURRENCY,
            BATCH_SIZE,
          );
        } catch (err) {
          // Don't throw the error because we send the notification to multiple users, retrying may spam some users
          logger.error(
            {
              data,
              messageId: message.messageId,
              err,
            },
            'failed to send push notifications',
          );
          counters?.background?.notificationFailed?.add(1, { channel: 'push' });
        }
      }
    }
  },
};

export default worker;

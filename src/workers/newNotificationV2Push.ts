import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';
import { NotificationV2 } from '../entity';
import { sendPushNotification } from '../onesignal';
import { getDisconnectedUsers } from '../subscription';
import { processStreamInBatches } from '../common/streaming';
import { User } from '../entity/user/User';
import {
  getNotificationV2AndChildren,
  streamNotificationUsers,
} from '../notifications/common';
import { counters } from '../telemetry';
import { contentPreferenceNotificationTypes } from '../common/contentPreference';
import { In } from 'typeorm';

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
          const isFollowNotification =
            contentPreferenceNotificationTypes.includes(notification.type);

          const stream = await streamNotificationUsers(con, notification.id);
          await processStreamInBatches(
            stream,
            async (batch: { userId: string }[]) => {
              const disconnectedUsers = await getDisconnectedUsers(
                batch.map((b) => b.userId),
              );

              const users = await con.getRepository(User).find({
                select: ['id'],
                where: {
                  id: In(disconnectedUsers),
                  followNotifications: isFollowNotification ? true : undefined,
                },
              });

              if (users.length) {
                await sendPushNotification(
                  users.map((item) => item.id),
                  notification,
                  avatars?.[0],
                );
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

import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';
import { NotificationV2 } from '../entity';
import { sendPushNotification } from '../onesignal';
import { getDisconnectedUsers } from '../subscription';
import { processStreamInBatches } from '../common/streaming';
import { User } from '../entity/user/User';
import {
  getNotificationV2AndChildren,
  NotificationChannel,
  streamNotificationUsers,
} from '../notifications/common';
import { counters } from '../telemetry';
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
          // push service (OneSignal) handles scheduling via send_after, showAt is passed per user
          const stream = await streamNotificationUsers({
            con,
            id: notification.id,
            channel: NotificationChannel.InApp,
            disableShowAtFilter: true,
          });
          await processStreamInBatches(
            stream,
            async (batch: { userId: string; showAt: Date | null }[]) => {
              const disconnectedUsers = await getDisconnectedUsers(
                batch.map((b) => b.userId),
              );

              const users = await con.getRepository(User).find({
                select: ['id'],
                where: {
                  id: In(disconnectedUsers),
                },
              });

              if (!users.length) {
                return;
              }

              // group push notifications per showAt
              // to minimize calls to push service
              const showAtByUserId = new Map(
                batch.map((b) => [b.userId, b.showAt]),
              );
              const showAtGroups = new Map<string, string[]>();
              for (const user of users) {
                const showAt = showAtByUserId.get(user.id);
                const key = showAt?.toISOString() ?? '';
                const group = showAtGroups.get(key);
                if (group) {
                  group.push(user.id);
                } else {
                  showAtGroups.set(key, [user.id]);
                }
              }

              await Promise.all(
                [...showAtGroups.entries()].map(([showAtKey, userIds]) =>
                  sendPushNotification(
                    userIds,
                    notification,
                    avatars?.[0],
                    showAtKey ? new Date(showAtKey) : undefined,
                  ),
                ),
              );
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
  maxMessages: 5,
};

export default worker;

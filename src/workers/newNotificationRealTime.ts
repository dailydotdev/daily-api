import { messageToJson, Worker } from './worker';
import { redisPubSub } from '../redis';
import { ChangeObject } from '../types';
import {
  Notification,
  NotificationAttachment,
  NotificationAvatar,
} from '../entity';

interface Data {
  notification: ChangeObject<Notification>;
}

const worker: Worker = {
  subscription: 'api.new-notification-real-time',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const { id } = data.notification;
      const [notification, attachments, avatars] = await Promise.all([
        con.getRepository(Notification).findOneBy({ id }),
        con.getRepository(NotificationAttachment).find({
          where: { notificationId: id },
          order: { order: 'asc' },
        }),
        con.getRepository(NotificationAvatar).find({
          where: { notificationId: id },
          order: { order: 'asc' },
        }),
      ]);
      if (notification) {
        await redisPubSub.publish(
          `events.notifications.${notification.userId}.new`,
          {
            ...notification,
            attachments,
            avatars,
          },
        );
      }
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to send new notification event to redis',
      );
      throw err;
    }
  },
};

export default worker;

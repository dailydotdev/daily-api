import { messageToJson, Worker } from './worker';
import { redisPubSub } from '../redis';
import { ChangeObject } from '../types';
import { Notification } from '../entity';

interface Data {
  notification: ChangeObject<Notification>;
}

const worker: Worker = {
  subscription: 'api.new-notification-redis',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const { userId } = data.notification;
      await redisPubSub.publish(
        `events.notifications.${userId}.new`,
        data.notification,
      );
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

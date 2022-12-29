import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';
import { Notification } from '../entity';
import { sendPushNotification } from '../onesignal';
import { isUserConnected } from '../subscription';

interface Data {
  notification: ChangeObject<Notification>;
}

const worker: Worker = {
  subscription: 'api.new-notification-push',
  handler: async (message, con, logger): Promise<void> => {
    const { notification }: Data = messageToJson(message);
    if (notification.public) {
      const isConnected = isUserConnected(notification.userId);
      // Don't send push when user is connected
      if (!isConnected) {
        await sendPushNotification(notification);
        logger.info(
          {
            notificationId: notification.id,
            userId: notification.userId,
          },
          'push notification sent',
        );
      } else {
        logger.info(
          {
            notificationId: notification.id,
            userId: notification.userId,
          },
          'user is connected, skipping push',
        );
      }
    }
  },
};

export default worker;

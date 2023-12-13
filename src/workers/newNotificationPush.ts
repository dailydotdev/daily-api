import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';
import { Notification, NotificationAvatar } from '../entity';
import { sendPushNotification } from '../onesignal';
import { isUserConnected } from '../subscription';

interface Data {
  notification: ChangeObject<Notification>;
}

const worker: Worker = {
  subscription: 'api.new-notification-push',
  handler: async (message, con): Promise<void> => {
    const { notification }: Data = messageToJson(message);
    if (notification.public) {
      const isConnected = await isUserConnected(notification.userId);
      // Don't send push when user is connected
      if (!isConnected) {
        const avatar = await con.getRepository(NotificationAvatar).findOneBy({
          notificationId: notification.id,
          order: 0,
        });
        await sendPushNotification([notification.userId], notification, avatar);
      }
    }
  },
};

export default worker;

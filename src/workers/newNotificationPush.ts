import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';
import { Notification } from '../entity';
import { sendPushNotification } from '../onesignal';

interface Data {
  notification: ChangeObject<Notification>;
}

const worker: Worker = {
  subscription: 'api.new-notification-push',
  handler: async (message): Promise<void> => {
    const { notification }: Data = messageToJson(message);
    if (notification.public) {
      await sendPushNotification(notification);
    }
  },
};

export default worker;

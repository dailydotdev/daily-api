import { notifyNotificationsRead } from '../common';
import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';
import { getUnreadNotificationsCount, Notification } from '../entity';

interface Data {
  notification: ChangeObject<Notification>;
}

const worker: Worker = {
  subscription: 'api.unread-notification-count',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const unreadNotificationsCount = await getUnreadNotificationsCount(
      con,
      data.notification.userId,
    );
    await notifyNotificationsRead(logger, { unreadNotificationsCount });
  },
};

export default worker;

import { messageToJson } from '../worker';
import { NotificationBaseContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { NotificationWorker } from './worker';

export const DEFAULT_DEV_CARD_UNLOCKED_THRESHOLD = 20;

interface Data {
  userId: string;
}

const worker: NotificationWorker = {
  subscription: 'api.dev-card-unlocked-notification',
  handler: async (message) => {
    const data: Data = messageToJson(message);

    const ctx: NotificationBaseContext = {
      userIds: [data.userId],
    };

    return [{ type: NotificationType.DevCardUnlocked, ctx }];
  },
};

export default worker;

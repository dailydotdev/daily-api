import { messageToJson } from '../worker';
import { NotificationBaseContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { NotificationWorker } from './worker';
import { ChangeObject } from '../../types';
import { User } from '../../entity';

export const DEFAULT_DEV_CARD_UNLOCKED_THRESHOLD = 20;

interface Data {
  user: ChangeObject<User>;
  userAfter: ChangeObject<User>;
}

const worker: NotificationWorker = {
  subscription: 'api.user-reputation-updated-notification',
  handler: async (message) => {
    const data: Data = messageToJson(message);
    if (data.userAfter.reputation < DEFAULT_DEV_CARD_UNLOCKED_THRESHOLD) return;

    const ctx: NotificationBaseContext = {
      userIds: [data.userAfter.id],
    };

    return [{ type: NotificationType.DevCardUnlocked, ctx }];
  },
};

export default worker;

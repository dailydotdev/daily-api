import { messageToJson } from '../worker';
import { NotificationBaseContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { NotificationWorker } from './worker';
import { UserAction, UserActionType } from '../../entity';

export const DEFAULT_DEV_CARD_UNLOCKED_THRESHOLD = 20;

interface Data {
  userId: string;
}

const worker: NotificationWorker = {
  subscription: 'api.dev-card-unlocked-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);

    const userAction = await con
      .getRepository(UserAction)
      .findOneBy({ userId: data.userId, type: UserActionType.DevCardUnlocked });

    if (userAction) return null;

    await con.getRepository(UserAction).insert({
      userId: data.userId,
      type: UserActionType.DevCardUnlocked,
    });

    const ctx: NotificationBaseContext = {
      userIds: [data.userId],
    };

    return [{ type: NotificationType.DevCardUnlocked, ctx }];
  },
};

export default worker;

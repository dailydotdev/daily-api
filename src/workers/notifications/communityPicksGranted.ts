import { messageToJson } from '../worker';
import { NotificationBaseContext, NotificationType } from '../../notifications';
import { NotificationWorker } from './worker';

interface Data {
  userId: string;
}

const worker: NotificationWorker = {
  subscription: 'api.community-picks-granted-notification',
  handler: async (message) => {
    const data: Data = messageToJson(message);
    const ctx: NotificationBaseContext = {
      userId: data.userId,
    };
    return [{ type: NotificationType.CommunityPicksGranted, ctx }];
  },
};

export default worker;

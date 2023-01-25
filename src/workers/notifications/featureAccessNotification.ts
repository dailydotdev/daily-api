import { messageToJson } from '../worker';
import { ChangeObject } from '../../types';
import { Feature } from '../../entity/Feature';
import { NotificationWorker } from './worker';

interface Data {
  feature: ChangeObject<Feature>;
}

const worker: NotificationWorker = {
  subscription: 'api.feature-access-notification',
  handler: async (message) => {
    const { feature: changeFeature }: Data = messageToJson(message);

    // We only support notifications for squad access
    if (changeFeature.feature !== 'squad') {
      return;
    }

    return [{ type: 'squad_access', ctx: { userId: changeFeature.userId } }];
  },
};

export default worker;

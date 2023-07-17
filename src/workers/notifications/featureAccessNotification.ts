import { messageToJson } from '../worker';
import { ChangeObject } from '../../types';
import { Feature } from '../../entity/Feature';
import { NotificationWorker } from './worker';
import { SourceMember } from '../../entity';
import { NotificationType } from '../../notifications';

interface Data {
  feature: ChangeObject<Feature>;
}

const worker: NotificationWorker = {
  subscription: 'api.feature-access-notification',
  handler: async (message, con) => {
    const { feature: changeFeature }: Data = messageToJson(message);

    // We only support notifications for squad access
    if (changeFeature.feature !== 'squad') {
      return;
    }

    // We don't need to show this if user is already part of squad
    const sourceMember = await con
      .getRepository(SourceMember)
      .findOne({ where: { userId: changeFeature.userId } });
    if (sourceMember) {
      return;
    }

    return [
      {
        type: NotificationType.SquadAccess,
        ctx: { userId: changeFeature.userId },
      },
    ];
  },
};

export default worker;

import { TypedNotificationWorker } from '../worker';
import { NotificationWorldDistrictLevelUpContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { Niche } from '../../entity/Niche';

export const worldDistrictLevelUpNotification: TypedNotificationWorker<'api.v1.world-district-level-up'> =
  {
    subscription: 'api.world-district-level-up-notification',
    handler: async ({ userId, nicheId, level }, con) => {
      const niche = await con
        .getRepository(Niche)
        .findOne({ select: ['title'], where: { id: nicheId } });

      // The catalogue is curated and small, so a niche the cron saw a moment
      // ago should still be here. If it is not, the district it named is gone
      // from the world too, and there is nothing left to congratulate.
      if (!niche) {
        return;
      }

      const ctx: NotificationWorldDistrictLevelUpContext = {
        userIds: [userId],
        nicheId,
        nicheTitle: niche.title,
        level,
      };

      return [{ type: NotificationType.WorldDistrictLevelUp, ctx }];
    },
  };

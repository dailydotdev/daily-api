import { TypedNotificationWorker } from '../worker';
import { NotificationAchievementContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { Achievement } from '../../entity/Achievement';

export const achievementUnlockedNotification: TypedNotificationWorker<'api.v1.achievement-unlocked'> =
  {
    subscription: 'api.achievement-unlocked-notification',
    handler: async ({ achievementId, userId }, con) => {
      const achievement = await con
        .getRepository(Achievement)
        .findOneBy({ id: achievementId });

      if (!achievement) {
        return;
      }

      const ctx: NotificationAchievementContext = {
        userIds: [userId],
        achievementId: achievement.id,
        achievementName: achievement.name,
        achievementDescription: achievement.description,
        achievementImage: achievement.image,
      };

      return [{ type: NotificationType.AchievementUnlocked, ctx }];
    },
  };

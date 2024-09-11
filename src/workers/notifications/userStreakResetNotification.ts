import { NotificationType } from '../../notifications/common';
import { generateTypedNotificationWorker } from './worker';
import { NotificationStreakContext } from '../../notifications';
import { generateStorageKey, StorageKey, StorageTopic } from '../../config';
import { getRedisObject } from '../../redis';
import { isNumber } from '../../common';

const worker = generateTypedNotificationWorker<'api.v1.user-streak-updated'>({
  subscription: 'api.user-streak-reset-notification',
  handler: async ({ streak }) => {
    const { userId } = streak;
    const key = generateStorageKey(
      StorageTopic.Streak,
      StorageKey.Reset,
      userId,
    );

    const lastStreak = await getRedisObject(key);

    if (!lastStreak || !isNumber(lastStreak)) {
      return;
    }

    const ctx: NotificationStreakContext = {
      userIds: [userId],
      streak: {
        ...streak,
        currentStreak: parseInt(lastStreak, 10),
        lastViewAt: streak.lastViewAt ? new Date(streak.lastViewAt) : null,
      },
    };

    return [{ type: NotificationType.StreakResetRestore, ctx }];
  },
});

export default worker;

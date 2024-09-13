import { NotificationType } from '../../notifications/common';
import { generateTypedNotificationWorker } from './worker';
import { NotificationStreakContext } from '../../notifications';
import { generateStorageKey, StorageKey, StorageTopic } from '../../config';
import { getRedisObject } from '../../redis';
import { isNumber } from '../../common';
import { Settings } from '../../entity';

const worker = generateTypedNotificationWorker<'api.v1.user-streak-updated'>({
  subscription: 'api.user-streak-reset-notification',
  handler: async ({ streak }, con) => {
    const { userId } = streak;
    const key = generateStorageKey(
      StorageTopic.Streak,
      StorageKey.Reset,
      userId,
    );

    const [settings, lastStreak] = await Promise.all([
      con.getRepository(Settings).findOneBy({ userId }),
      getRedisObject(key),
    ]);

    if (settings?.optOutReadingStreak || !lastStreak || !isNumber(lastStreak)) {
      return;
    }

    const ctx: NotificationStreakContext = {
      userIds: [userId],
      streak: {
        ...streak,
        currentStreak: parseInt(lastStreak, 10),
        lastViewAt: new Date(streak.lastViewAt!).getTime(),
      },
    };

    return [{ type: NotificationType.StreakResetRestore, ctx }];
  },
});

export default worker;

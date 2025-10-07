import { NotificationType } from '../../notifications/common';
import { generateStorageKey, StorageKey, StorageTopic } from '../../config';
import { getRedisObject, getRedisObjectExpiryTime } from '../../redis';
import { isNumber } from '../../common';
import { Settings, User } from '../../entity';
import { queryReadReplica } from '../../common/queryReadReplica';
import { checkUserCoresAccess } from '../../common/user';
import { CoresRole } from '../../types';
import { TypedNotificationWorker } from '../worker';
import type { NotificationStreakRestoreContext } from '../../notifications';

const worker: TypedNotificationWorker<'api.v1.user-streak-updated'> = {
  subscription: 'api.user-streak-reset-notification',
  handler: async ({ streak }, con) => {
    const { userId } = streak;
    const key = generateStorageKey(
      StorageTopic.Streak,
      StorageKey.Reset,
      userId,
    );

    const [user, settings, lastStreak, redisExpiryTime] = await Promise.all([
      queryReadReplica(con, ({ queryRunner }) => {
        return queryRunner.manager.getRepository(User).findOneOrFail({
          select: ['id', 'coresRole'],
          where: {
            id: userId,
          },
        });
      }),
      queryReadReplica(con, ({ queryRunner }) => {
        return queryRunner.manager
          .getRepository(Settings)
          .findOne({ where: { userId }, select: ['optOutReadingStreak'] });
      }),
      getRedisObject(key),
      getRedisObjectExpiryTime(key),
    ]);

    if (!user) {
      return;
    }

    if (!checkUserCoresAccess({ user, requiredRole: CoresRole.User })) {
      return;
    }

    if (
      settings?.optOutReadingStreak ||
      !lastStreak ||
      !redisExpiryTime ||
      !isNumber(lastStreak)
    ) {
      return;
    }

    const restorationValidUntil = redisExpiryTime * 1000; // unix timestamp in ms

    const ctx: NotificationStreakRestoreContext = {
      userIds: [userId],
      streak,
      restore: {
        expiry: restorationValidUntil,
        amount: parseInt(lastStreak, 10),
      },
    };

    return [{ type: NotificationType.StreakResetRestore, ctx }];
  },
};

export default worker;

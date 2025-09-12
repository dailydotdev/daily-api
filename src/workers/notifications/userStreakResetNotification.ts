import { NotificationType } from '../../notifications/common';
import { NotificationStreakContext } from '../../notifications';
import { generateStorageKey, StorageKey, StorageTopic } from '../../config';
import { getRedisObject } from '../../redis';
import { isNumber } from '../../common';
import { Settings, User } from '../../entity';
import { queryReadReplica } from '../../common/queryReadReplica';
import { checkUserCoresAccess } from '../../common/user';
import { CoresRole } from '../../types';
import { TypedNotificationWorker } from '../worker';

const worker: TypedNotificationWorker<'api.v1.user-streak-updated'> = {
  subscription: 'api.user-streak-reset-notification',
  handler: async ({ streak }, con) => {
    const { userId } = streak;
    const key = generateStorageKey(
      StorageTopic.Streak,
      StorageKey.Reset,
      userId,
    );

    const [user, settings, lastStreak] = await Promise.all([
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
    ]);

    if (!user) {
      return;
    }

    if (!checkUserCoresAccess({ user, requiredRole: CoresRole.User })) {
      return;
    }

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
};

export default worker;

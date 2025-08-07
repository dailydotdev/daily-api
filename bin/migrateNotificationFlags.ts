import '../src/config';
import createOrGetConnection from '../src/db';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationPreferenceStatus,
  NotificationType,
} from '../src/notifications/common';
import { User } from '../src/entity/user/User';
import type { UserNotificationFlags } from '../src/entity/user/User';

interface UserData {
  id: string;
  notificationEmail: boolean;
  followingEmail: boolean;
  followNotifications: boolean;
  awardEmail: boolean;
  awardNotifications: boolean;
  notificationFlags: UserNotificationFlags;
}

function buildNotificationFlags(user: UserData): UserNotificationFlags {
  const flags: UserNotificationFlags = { ...DEFAULT_NOTIFICATION_SETTINGS };

  if (!user.notificationEmail) {
    Object.keys(flags).forEach((type) => {
      if (flags[type]) {
        flags[type]!.email = NotificationPreferenceStatus.Muted;
      }
    });
  }

  if (!user.followingEmail) {
    flags[NotificationType.UserPostAdded]!.email =
      NotificationPreferenceStatus.Muted;
  }

  if (!user.followNotifications) {
    flags[NotificationType.UserPostAdded]!.inApp =
      NotificationPreferenceStatus.Muted;
  }

  if (!user.awardEmail) {
    flags[NotificationType.UserReceivedAward]!.email =
      NotificationPreferenceStatus.Muted;
  }

  if (!user.awardNotifications) {
    flags[NotificationType.UserReceivedAward]!.inApp =
      NotificationPreferenceStatus.Muted;
  }

  return flags;
}

(async (): Promise<void> => {
  const limitArgument = process.argv[2];
  const offsetArgument = process.argv[3];

  if (!limitArgument || !offsetArgument) {
    throw new Error('limit and offset arguments are required');
  }

  const limit = +limitArgument;
  if (Number.isNaN(limit)) {
    throw new Error('limit argument is invalid, it should be a number');
  }

  const offset = +offsetArgument;
  if (Number.isNaN(offset)) {
    throw new Error('offset argument is invalid, it should be a number');
  }

  const con = await createOrGetConnection();

  try {
    const userRepo = con.getRepository(User);

    const users = await userRepo
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.notificationEmail',
        'user.followingEmail',
        'user.followNotifications',
        'user.awardEmail',
        'user.awardNotifications',
        'user.notificationFlags',
      ])
      .orderBy('user.id')
      .limit(limit)
      .offset(offset)
      .getMany();

    console.log(
      `Processing ${users.length} users (offset ${offset} to ${offset + users.length - 1})...`,
    );

    await con.transaction(async (manager) => {
      for (const user of users) {
        const userData: UserData = {
          id: user.id,
          notificationEmail: user.notificationEmail,
          followingEmail: user.followingEmail,
          followNotifications: user.followNotifications,
          awardEmail: user.awardEmail,
          awardNotifications: user.awardNotifications,
          notificationFlags: user.notificationFlags,
        };

        const newFlags = buildNotificationFlags(userData);

        await manager
          .getRepository(User)
          .update({ id: user.id }, { notificationFlags: newFlags });
      }
    });

    console.log(
      `Migration completed successfully. Updated ${users.length} users (offset ${offset} to ${offset + users.length - 1}).`,
    );
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }

  process.exit(0);
})();

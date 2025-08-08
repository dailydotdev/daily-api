import fastq from 'fastq';
import '../src/config';
import createOrGetConnection from '../src/db';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationPreferenceStatus,
  NotificationType,
} from '../src/notifications/common';
import { User } from '../src/entity/user/User';
import type { UserNotificationFlags } from '../src/entity/user/User';

const QUEUE_CONCURRENCY = 1;

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
    console.log(
      `Processing users starting from offset ${offset} (limit ${limit})...`,
    );

    let processedCount = 0;

    await con.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);

      const builder = userRepo
        .createQueryBuilder('user')
        .select('user.id', 'id')
        .addSelect('user.notificationEmail', 'notificationEmail')
        .addSelect('user.followingEmail', 'followingEmail')
        .addSelect('user.followNotifications', 'followNotifications')
        .addSelect('user.awardEmail', 'awardEmail')
        .addSelect('user.awardNotifications', 'awardNotifications')
        .addSelect('user.notificationFlags', 'notificationFlags')
        .orderBy('user.id')
        .limit(limit)
        .offset(offset);

      const stream = await builder.stream();

      const insertQueue = fastq.promise(async (user: UserData) => {
        const newFlags = buildNotificationFlags(user);

        await manager
          .getRepository(User)
          .update({ id: user.id }, { notificationFlags: newFlags });

        processedCount++;
      }, QUEUE_CONCURRENCY);

      stream.on('data', (user: UserData) => {
        insertQueue.push(user);
      });

      await new Promise((resolve, reject) => {
        stream.on('error', reject);
        stream.on('end', () => resolve(true));
      });
      await insertQueue.drained();
    });

    console.log(
      `Migration completed successfully. Updated ${processedCount} users (offset ${offset} to ${offset + processedCount - 1}).`,
    );
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }

  process.exit(0);
})();

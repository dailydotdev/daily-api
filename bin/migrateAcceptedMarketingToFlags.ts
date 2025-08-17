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
  acceptedMarketing: boolean;
  notificationFlags: UserNotificationFlags;
}

function updateMarketingFlags(user: UserData): UserNotificationFlags {
  const flags: UserNotificationFlags = { ...user.notificationFlags };

  // If user has acceptedMarketing = false, mute Marketing email notifications
  if (!user.acceptedMarketing) {
    if (!flags[NotificationType.Marketing]) {
      flags[NotificationType.Marketing] = {
        ...DEFAULT_NOTIFICATION_SETTINGS[NotificationType.Marketing],
      };
    }
    flags[NotificationType.Marketing]!.email =
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
        .addSelect('user.acceptedMarketing', 'acceptedMarketing')
        .addSelect('user.notificationFlags', 'notificationFlags')
        .where('user.acceptedMarketing = false')
        .orderBy('user.createdAt')
        .limit(limit)
        .offset(offset);

      const stream = await builder.stream();

      const insertQueue = fastq.promise(async (user: UserData) => {
        const newFlags = updateMarketingFlags(user);

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

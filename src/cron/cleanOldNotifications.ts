import { subDays } from 'date-fns';
import { Cron } from './cron';
import { UserNotification } from '../entity/notifications/UserNotification';

const RETENTION_DAYS = 90;
const BATCH_SIZE = 5_000;
const MAX_BATCHES_PER_RUN = 200;
const MAX_DURATION_MS = 4 * 60 * 1_000;

const cleanOldNotifications: Cron = {
  name: 'clean-old-notifications',
  handler: async (con, logger) => {
    const cutoff = subDays(new Date(), RETENTION_DAYS);
    const startedAt = Date.now();
    const repo = con.getRepository(UserNotification);

    let totalDeleted = 0;
    let batches = 0;

    while (
      batches < MAX_BATCHES_PER_RUN &&
      Date.now() - startedAt < MAX_DURATION_MS
    ) {
      const result = await repo
        .createQueryBuilder()
        .delete()
        .where(
          `ctid IN (
            SELECT ctid FROM "user_notification"
            WHERE "createdAt" < :cutoff
            LIMIT :limit
          )`,
          { cutoff, limit: BATCH_SIZE },
        )
        .execute();

      const deleted = result.affected ?? 0;
      totalDeleted += deleted;
      batches += 1;

      if (deleted < BATCH_SIZE) {
        break;
      }
    }

    logger.info(
      {
        totalDeleted,
        batches,
        durationMs: Date.now() - startedAt,
        cutoff: cutoff.toISOString(),
      },
      'cleaned old user_notification rows',
    );
  },
};

export default cleanOldNotifications;

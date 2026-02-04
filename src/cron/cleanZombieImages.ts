import { Cron } from './cron';
import { IsNull, LessThan } from 'typeorm';
import { subDays } from 'date-fns';
import { ContentImage, ContentImageUsedByType } from '../entity';
import { FeedbackStatus } from '../entity/Feedback';

const cron: Cron = {
  name: 'clean-zombie-images',
  handler: async (con, logger) => {
    logger.info('cleaning zombie images...');
    const timeThreshold = subDays(new Date(), 30);

    // Clean images where usedByType is NULL and older than 30 days (existing behavior)
    const { affected: orphanAffected } = await con
      .getRepository(ContentImage)
      .delete({
        createdAt: LessThan(timeThreshold),
        usedByType: IsNull(),
      });
    logger.info({ count: orphanAffected }, 'orphan zombie images cleaned! 🧟');

    // Clean feedback images where:
    // 1. The feedback no longer exists (orphaned), OR
    // 2. The feedback is in a terminal state (Completed, Cancelled, Spam) and older than 30 days
    const feedbackOrphanCleanup = await con.query(
      `
      DELETE FROM content_image ci
      WHERE ci."usedByType" = $1
      AND (
        ci."usedById" NOT IN (SELECT id::text FROM feedback)
        OR ci."usedById" IN (
          SELECT id::text FROM feedback
          WHERE status IN ($2, $3, $4)
          AND "updatedAt" < $5
        )
      )
      `,
      [
        ContentImageUsedByType.Feedback,
        FeedbackStatus.Completed,
        FeedbackStatus.Cancelled,
        FeedbackStatus.Spam,
        timeThreshold,
      ],
    );
    const feedbackOrphanAffected = feedbackOrphanCleanup?.[1] ?? 0;
    logger.info(
      { count: feedbackOrphanAffected },
      'feedback zombie images cleaned! 🧟',
    );

    const totalAffected = (orphanAffected ?? 0) + feedbackOrphanAffected;
    logger.info({ count: totalAffected }, 'total zombie images cleaned! 🧟');
  },
};

export default cron;

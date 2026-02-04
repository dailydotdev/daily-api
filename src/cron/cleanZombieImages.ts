import { Cron } from './cron';
import { IsNull, LessThan, In } from 'typeorm';
import { subDays } from 'date-fns';
import { ContentImage, ContentImageUsedByType, Feedback } from '../entity';
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

    // Get all existing feedback IDs for orphan check
    const existingFeedbackIds = await con
      .getRepository(Feedback)
      .createQueryBuilder('f')
      .select('f.id')
      .getMany();
    const existingIds = existingFeedbackIds.map((f) => f.id);

    // Get terminal feedback IDs
    const terminalFeedbackIds = await con.getRepository(Feedback).find({
      select: ['id'],
      where: {
        status: In([
          FeedbackStatus.Completed,
          FeedbackStatus.Cancelled,
          FeedbackStatus.Spam,
        ]),
        updatedAt: LessThan(timeThreshold),
      },
    });
    const terminalIds = terminalFeedbackIds.map((f) => f.id);

    // Delete orphaned images (feedback no longer exists)
    const orphanedImages = await con
      .getRepository(ContentImage)
      .createQueryBuilder('ci')
      .where('ci.usedByType = :type', { type: ContentImageUsedByType.Feedback })
      .andWhere('ci.usedById NOT IN (:...ids)', {
        ids: existingIds.length > 0 ? existingIds : [''],
      })
      .getMany();

    let feedbackOrphanAffected = 0;
    if (orphanedImages.length > 0) {
      const { affected: orphanCount } = await con
        .getRepository(ContentImage)
        .delete(orphanedImages.map((img) => img.url));
      feedbackOrphanAffected += orphanCount ?? 0;
    }

    // Delete terminal state images
    if (terminalIds.length > 0) {
      const { affected: terminalCount } = await con
        .getRepository(ContentImage)
        .delete({
          usedByType: ContentImageUsedByType.Feedback,
          usedById: In(terminalIds),
        });
      feedbackOrphanAffected += terminalCount ?? 0;
    }

    logger.info(
      { count: feedbackOrphanAffected },
      'feedback zombie images cleaned! 🧟',
    );

    const totalAffected = (orphanAffected ?? 0) + feedbackOrphanAffected;
    logger.info({ count: totalAffected }, 'total zombie images cleaned! 🧟');
  },
};

export default cron;

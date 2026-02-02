import { Cron } from './cron';
import { User, UserDecoration } from '../entity';
import { isPlusMember } from '../paddle';
import { IsNull, Not } from 'typeorm';

// Decoration IDs and their required subscription duration in milliseconds
const SUBSCRIBER_DECORATIONS = [
  { id: 'activesubscriber', durationMs: 0 }, // Immediate
  { id: 'threemonth', durationMs: 3 * 30 * 24 * 60 * 60 * 1000 }, // ~3 months
  { id: 'sixmonth', durationMs: 6 * 30 * 24 * 60 * 60 * 1000 }, // ~6 months
  { id: 'oneyear', durationMs: 365 * 24 * 60 * 60 * 1000 }, // 1 year
  { id: 'twoyears', durationMs: 2 * 365 * 24 * 60 * 60 * 1000 }, // 2 years
] as const;

const cron: Cron = {
  name: 'unlock-subscriber-decorations',
  handler: async (con, logger) => {
    logger.debug('checking subscriber decorations to unlock...');

    const now = new Date();
    let totalUnlocked = 0;

    // Get all users with Plus subscription
    const plusUsers = await con.getRepository(User).find({
      where: {
        subscriptionFlags: Not(IsNull()),
      },
      select: ['id', 'subscriptionFlags'],
    });

    const activePlusUsers = plusUsers.filter((user) =>
      isPlusMember(user.subscriptionFlags?.cycle),
    );

    logger.debug(
      { count: activePlusUsers.length },
      'found active Plus members',
    );

    for (const user of activePlusUsers) {
      const subscriptionCreatedAt = user.subscriptionFlags?.createdAt;

      if (!subscriptionCreatedAt) {
        continue;
      }

      const subscriptionStartDate = new Date(subscriptionCreatedAt);
      const subscriptionDurationMs =
        now.getTime() - subscriptionStartDate.getTime();

      // Get user's existing decorations
      const existingDecorations = await con.getRepository(UserDecoration).find({
        where: { userId: user.id },
        select: ['decorationId'],
      });
      const existingDecorationIds = new Set(
        existingDecorations.map((ud) => ud.decorationId),
      );

      // Check which decorations user qualifies for
      const decorationsToUnlock = SUBSCRIBER_DECORATIONS.filter(
        (decoration) =>
          subscriptionDurationMs >= decoration.durationMs &&
          !existingDecorationIds.has(decoration.id),
      );

      if (decorationsToUnlock.length > 0) {
        await con.getRepository(UserDecoration).insert(
          decorationsToUnlock.map((decoration) => ({
            userId: user.id,
            decorationId: decoration.id,
          })),
        );

        totalUnlocked += decorationsToUnlock.length;

        logger.debug(
          {
            userId: user.id,
            decorations: decorationsToUnlock.map((d) => d.id),
          },
          'unlocked decorations for user',
        );
      }
    }

    logger.info({ totalUnlocked }, 'subscriber decorations unlock completed');
  },
};

export default cron;

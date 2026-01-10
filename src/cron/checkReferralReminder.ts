import { Cron } from './cron';
import { Alerts } from '../entity';

const cron: Cron = {
  name: 'generic-referral-reminder',
  handler: async (con, logger) => {
    logger.info('updating referral reminders...');
    const { affected } = await con
      .getRepository(Alerts)
      .createQueryBuilder()
      .update()
      .where({ showGenericReferral: false })
      .andWhere(
        `(
              dateCastIndex(flags, 'lastReferralReminder') <= NOW() - INTERVAL '6 months'
          OR  (dateCastIndex(flags, 'lastReferralReminder') IS NULL AND (SELECT u."createdAt" FROM "user" AS u WHERE u.id = "userId") <= NOW() - INTERVAL '2 weeks')
        )`,
      )
      .set({ showGenericReferral: true })
      .execute();
    logger.info({ count: affected }, 'finished updating referral reminders!');
  },
};

export default cron;

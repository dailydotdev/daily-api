import { Cron } from './cron';
import { IsNull, LessThan } from 'typeorm';
import { subHours } from 'date-fns';
import { UserCompany } from '../entity/UserCompany';

export const cleanZombieUserCompany: Cron = {
  name: 'clean-zombie-user-companies',
  handler: async (con, logger) => {
    logger.info('cleaning zombie user companies...');
    const timeThreshold = subHours(new Date(), 1);
    const { affected } = await con.getRepository(UserCompany).delete({
      verified: false,
      companyId: IsNull(),
      updatedAt: LessThan(timeThreshold),
    });
    logger.info({ count: affected }, 'zombies user companies cleaned! 🧟');
  },
};

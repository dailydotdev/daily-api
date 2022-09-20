import { Cron } from './cron';
import { User } from '../entity';
import { LessThan } from 'typeorm';
import { subHours } from 'date-fns';

const cron: Cron = {
  subscription: 'clean-zombie-users-sub',
  handler: async (con, logger) => {
    logger.info('cleaning zombie users...');
    const timeThreshold = subHours(new Date(), 1);
    const { affected } = await con.getRepository(User).delete({
      infoConfirmed: false,
      createdAt: LessThan(timeThreshold.toISOString()),
    });
    logger.info({ count: affected }, 'zombies users cleaned! 🧟');
  },
};

export default cron;

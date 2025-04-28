import { Cron } from './cron';
import { User } from '../entity';
import { LessThan } from 'typeorm';
import { subHours } from 'date-fns';

const cron: Cron = {
  name: 'clean-zombie-users',
  handler: async (con, logger) => {
    logger.info('cleaning zombie users...');
    const timeThreshold = subHours(new Date(), 1);
    const query = con
      .createQueryBuilder()
      .delete()
      .from(User)
      .where([
        {
          infoConfirmed: false,
        },
        {
          emailConfirmed: false,
        },
      ])
      .andWhere({
        createdAt: LessThan(timeThreshold),
      });

    const { affected } = await query.execute();
    logger.info({ count: affected }, 'zombies users cleaned! 🧟');
  },
};

export default cron;

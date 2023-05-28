import { Cron } from './cron';
import { IsNull, LessThan } from 'typeorm';
import { subDays } from 'date-fns';
import { ContentImage } from '../entity';

const cron: Cron = {
  name: 'clean-zombie-images',
  handler: async (con, logger) => {
    logger.info('cleaning zombie images...');
    const timeThreshold = subDays(new Date(), 30);
    const { affected } = await con.getRepository(ContentImage).delete({
      createdAt: LessThan(timeThreshold),
      usedByType: IsNull(),
    });
    logger.info({ count: affected }, 'zombies images cleaned! 🧟');
  },
};

export default cron;

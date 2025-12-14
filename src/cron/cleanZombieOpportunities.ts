import { subDays } from 'date-fns';
import { Cron } from './cron';
import { logger } from '../logger';
import { IsNull, LessThan } from 'typeorm';
import { Opportunity } from '../entity/opportunities/Opportunity';

export const cleanZombieOpportunities: Cron = {
  name: 'clean-zombie-opportunities',
  handler: async (con) => {
    const timeThreshold = subDays(new Date(), 2);

    const query = await con
      .getRepository(Opportunity)
      .createQueryBuilder()
      .delete()
      .where({
        organizationId: IsNull(),
      })
      .andWhere({
        createdAt: LessThan(timeThreshold),
      })
      .andWhere(`flags->'anonUserId' IS NOT NULL`);

    const { affected } = await query.execute();

    logger.info({ count: affected }, 'zombies opportunities cleaned! 🧟');
  },
};

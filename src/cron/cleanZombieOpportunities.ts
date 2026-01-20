import { subDays } from 'date-fns';
import { Cron } from './cron';
import { logger } from '../logger';
import { IsNull, LessThan } from 'typeorm';
import { Opportunity } from '../entity/opportunities/Opportunity';
import { OpportunityState } from '@dailydotdev/schema';
import { ClaimableItem } from '../entity/ClaimableItem';

export const cleanZombieOpportunities: Cron = {
  name: 'clean-zombie-opportunities',
  handler: async (con) => {
    const timeThreshold = subDays(new Date(), 2);

    con.transaction(async (entityManager) => {
      const query = entityManager
        .getRepository(Opportunity)
        .createQueryBuilder()
        .delete()
        .where({
          organizationId: IsNull(),
        })
        .andWhere({
          createdAt: LessThan(timeThreshold),
        })
        .andWhere({
          state: OpportunityState.DRAFT,
        })
        .returning('id');

      const { affected, raw } = await query.execute();

      const { affected: claimables } = await entityManager
        .getRepository(ClaimableItem)
        .createQueryBuilder()
        .delete()
        .where(`flags->>'opportunityId' IN (:...ids)`, {
          ids: raw
            .filter((item: { id: string }) => item)
            .map((item: { id: string }) => item.id),
        })
        .execute();

      logger.info(
        { count: affected, claimables },
        'zombies opportunities cleaned! 🧟',
      );
    });
  },
};

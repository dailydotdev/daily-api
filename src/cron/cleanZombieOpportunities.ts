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

    await con.transaction(async (entityManager) => {
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

      const ids = raw
        .filter((item: { id: string }) => item)
        .map((item: { id: string }) => item.id);

      let claimables = 0;

      if (ids.length) {
        const { affected } = await entityManager
          .getRepository(ClaimableItem)
          .createQueryBuilder()
          .delete()
          .where(`flags->>'opportunityId' IN (:...ids)`, {
            ids,
          })
          .execute();

        if (affected) {
          claimables += affected;
        }
      }

      logger.info(
        { count: affected || 0, claimables },
        'zombies opportunities cleaned! 🧟',
      );
    });
  },
};

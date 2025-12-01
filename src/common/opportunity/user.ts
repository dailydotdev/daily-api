import { IsNull, type EntityManager } from 'typeorm';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import { updateFlagsStatement } from '../utils';
import type { Opportunity } from '../../entity/opportunities/Opportunity';
import { OpportunityUserRecruiter } from '../../entity/opportunities/user/OpportunityUserRecruiter';
import { logger } from '../../logger';

export const claimAnonOpportunities = async ({
  anonUserId,
  userId,
  con,
}: {
  anonUserId: string;
  userId: string;
  con: EntityManager;
}): Promise<Pick<Opportunity, 'id'>[]> => {
  try {
    if (!anonUserId || !userId) {
      throw new Error('anonUserId and userId are required');
    }

    const result = await con.transaction(async (entityManager) => {
      const opportunityUpdateResult = await entityManager
        .getRepository(OpportunityJob)
        .createQueryBuilder()
        .update()
        .set({
          flags: updateFlagsStatement<OpportunityJob>({
            anonUserId: null,
          }),
        })
        .where("flags->>'anonUserId' = :anonUserId", {
          anonUserId,
        })
        .andWhere({
          organizationId: IsNull(), // only claim opportunities not linked to an organization yet
        })
        .returning(['id'])
        .execute();

      const opportunities = opportunityUpdateResult.raw as { id: string }[];

      const opportunityUserUpsertResult = await entityManager
        .getRepository(OpportunityUserRecruiter)
        .upsert(
          opportunities.map((opportunity) => {
            return entityManager
              .getRepository(OpportunityUserRecruiter)
              .create({
                opportunityId: opportunity.id,
                userId,
              });
          }),
          {
            conflictPaths: ['opportunityId', 'userId'],
          },
        );

      return opportunityUserUpsertResult.identifiers.map((item) => {
        return {
          id: item.opportunityId,
        };
      });
    });

    return result;
  } catch (error) {
    logger.error(
      {
        err: error,
        anonUserId,
        userId,
      },
      'Error claiming anon opportunities',
    );

    return [];
  }
};

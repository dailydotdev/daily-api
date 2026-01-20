import { In, IsNull, type EntityManager } from 'typeorm';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import type { Opportunity } from '../../entity/opportunities/Opportunity';
import { OpportunityUserRecruiter } from '../../entity/opportunities/user/OpportunityUserRecruiter';
import { logger } from '../../logger';
import { ClaimableItem, ClaimableItemTypes } from '../../entity/ClaimableItem';

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
      const claimableItems = await entityManager
        .getRepository(ClaimableItem)
        .findBy({
          identifier: anonUserId,
          type: ClaimableItemTypes.Opportunity,
          claimedById: IsNull(),
        });

      const opportunities = await entityManager
        .getRepository(OpportunityJob)
        .find({
          where: {
            id: In(
              claimableItems
                .filter((item) => item.flags.opportunityId)
                .map((item) => item.flags.opportunityId),
            ),
            organizationId: IsNull(), // only claim opportunities not linked to an organization yet
          },
        });

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

      await entityManager.getRepository(ClaimableItem).update(
        {
          id: In(claimableItems.map((item) => item.id)),
        },
        {
          claimedById: userId,
          claimedAt: new Date(),
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

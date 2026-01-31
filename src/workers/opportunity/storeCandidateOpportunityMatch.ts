import { TypedWorker } from '../worker';
import { MatchedCandidate } from '@dailydotdev/schema';
import { OpportunityMatch } from '../../entity/OpportunityMatch';
import { opportunityMatchDescriptionSchema } from '../../common/schema/opportunities';
import { Alerts, User } from '../../entity';
import { IsNull } from 'typeorm';
import { logger } from '../../logger';
import { systemUserIds, updateFlagsStatement } from '../../common';

export const storeCandidateOpportunityMatch: TypedWorker<'gondul.v1.candidate-opportunity-match'> =
  {
    subscription: 'api.store-candidate-opportunity-match',
    handler: async ({ data }, con): Promise<void> => {
      const { userId, opportunityId, matchScore, reasoning, reasoningShort } =
        data;
      if (!userId || !opportunityId) {
        throw new Error(
          'Missing userId or opportunityId in candidate opportunity match',
        );
      }

      const user = await con.getRepository(User).findOneBy({ id: userId });
      if (!user) {
        logger.error(
          { opportunityId, userId },
          'storeCandidateOpportunityMatch: User not found',
        );
        return;
      }

      if (systemUserIds.includes(userId)) {
        return;
      }

      const description = opportunityMatchDescriptionSchema.parse({
        reasoning,
        reasoningShort,
        matchScore,
      });

      await con.transaction(async (manager) => {
        // Check if match already exists to determine if this is a new insert
        const existingMatch = await manager
          .getRepository(OpportunityMatch)
          .findOne({
            where: { userId, opportunityId },
            select: ['userId', 'opportunityId'],
          });

        await manager.getRepository(OpportunityMatch).upsert(
          {
            userId,
            opportunityId,
            description,
          },
          {
            conflictPaths: ['userId', 'opportunityId'],
            skipUpdateIfNoValuesChanged: true,
          },
        );

        // Only update alert if this is a new match (insert)
        if (!existingMatch) {
          await manager.getRepository(Alerts).update(
            { userId, opportunityId: IsNull() },
            {
              opportunityId,
              flags: updateFlagsStatement<Alerts>({
                hasSeenOpportunity: false,
              }),
            },
          );
        }
      });
    },
    parseMessage: (message) => {
      return MatchedCandidate.fromBinary(message.data);
    },
  };

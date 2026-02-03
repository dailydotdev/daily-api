import { TypedWorker } from '../worker';
import { MatchedCandidate } from '@dailydotdev/schema';
import {
  OpportunityMatch,
  OpportunityMatchHistoryEntry,
} from '../../entity/OpportunityMatch';
import { opportunityMatchDescriptionSchema } from '../../common/schema/opportunities';
import { Alerts, User } from '../../entity';
import { IsNull } from 'typeorm';
import { logger } from '../../logger';
import { systemUserIds, updateFlagsStatement } from '../../common';
import { OpportunityMatchStatus } from '../../entity/opportunities/types';

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
        const existingMatch = await manager
          .getRepository(OpportunityMatch)
          .findOne({
            where: { userId, opportunityId },
            select: [
              'userId',
              'opportunityId',
              'status',
              'feedback',
              'history',
              'description',
            ],
          });

        const isReMatch =
          existingMatch?.status === OpportunityMatchStatus.CandidateRejected;

        if (isReMatch) {
          const historyEntry: OpportunityMatchHistoryEntry = {
            status: existingMatch.status,
            feedback: existingMatch.feedback,
            description: existingMatch.description,
            archivedAt: new Date().toISOString(),
          };

          await manager
            .getRepository(OpportunityMatch)
            .createQueryBuilder()
            .update()
            .set({
              status: OpportunityMatchStatus.Pending,
              description,
              feedback: [],
              history: () => `history || :historyJson::jsonb`,
            })
            .where({ userId, opportunityId })
            .setParameter('historyJson', JSON.stringify([historyEntry]))
            .execute();

          await manager.getRepository(Alerts).update(
            { userId, opportunityId },
            {
              flags: updateFlagsStatement<Alerts>({
                hasSeenOpportunity: false,
              }),
            },
          );
        } else {
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
        }
      });
    },
    parseMessage: (message) => {
      return MatchedCandidate.fromBinary(message.data);
    },
  };

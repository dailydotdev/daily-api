import { TypedWorker } from '../worker';
import { MatchedCandidate } from '@dailydotdev/schema';
import { OpportunityMatch } from '../../entity/OpportunityMatch';
import { opportunityMatchDescriptionSchema } from '../../common/schema/opportunities';
import { Alerts, Feature, FeatureType } from '../../entity';
import { IsNull } from 'typeorm';

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

      const description = opportunityMatchDescriptionSchema.parse({
        reasoning,
        reasoningShort,
        matchScore,
      });

      await con.transaction(async (manager) => {
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
      });
    },
    parseMessage: (message) => {
      return MatchedCandidate.fromBinary(message.data);
    },
  };

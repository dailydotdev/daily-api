import { TypedWorker } from '../worker';
import { ApplicationScored } from '@dailydotdev/schema';
import { OpportunityMatch } from '../../entity/OpportunityMatch';
import { applicationScoreSchema } from '../../common/schema/opportunities';

export const storeCandidateApplicationScore: TypedWorker<'gondul.v1.candidate-application-scored'> =
  {
    subscription: 'api.store-candidate-application-score',
    handler: async ({ data }, con): Promise<void> => {
      const { userId, opportunityId, score, description } = data;
      if (!userId || !opportunityId) {
        throw new Error(
          'Missing userId or opportunityId in candidate application score',
        );
      }
 
      const applicationRank = applicationScoreSchema.parse({
        score,
        description,
      });

      await con.getRepository(OpportunityMatch).upsert(
        {
          userId,
          opportunityId,
          applicationRank,
        },
        {
          conflictPaths: ['userId', 'opportunityId'],
          skipUpdateIfNoValuesChanged: true,
        },
      );
    },
    parseMessage: (message) => ApplicationScored.fromBinary(message.data),
  };

import { TypedWorker } from '../worker';
import { TypeORMQueryFailedError } from '../../errors';
import { ApplicationScored } from '@dailydotdev/schema';
import { OpportunityMatch } from '../../entity/OpportunityMatch';
import { applicationScoreSchema } from '../../common/schema/opportunities';

export const storeCandidateApplicationScore: TypedWorker<'gondul.v1.candidate-application-scored'> =
  {
    subscription: 'api.store-candidate-application-score',
    handler: async ({ data }, con, logger): Promise<void> => {
      try {
        const { userId, opportunityId, score, description } = data;
        if (!userId || !opportunityId) {
          logger.warn(
            { data },
            'Missing userId or opportunityId in candidate application score',
          );
          return;
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
      } catch (originalError) {
        const err = originalError as TypeORMQueryFailedError;
        if (err?.name === 'QueryFailedError') {
          logger.error({ err, data }, 'could not update application score');

          return;
        }

        throw err;
      }
    },
    parseMessage: (message) => ApplicationScored.fromBinary(message.data),
  };

import { TypedWorker } from '../worker';
import { TypeORMQueryFailedError } from '../../errors';
import { MatchedCandidate } from '@dailydotdev/schema';
import { OpportunityMatch } from '../../entity/OpportunityMatch';
import { opportunityMatchDescriptionSchema } from '../../common/schema/opportunities';
import { Alerts, Feature, FeatureType } from '../../entity';
import { IsNull } from 'typeorm';

export const storeCandidateOpportunityMatch: TypedWorker<'gondul.v1.candidate-opportunity-match'> =
  {
    subscription: 'api.store-candidate-opportunity-match',
    handler: async ({ data }, con, logger): Promise<void> => {
      try {
        const { userId, opportunityId, matchScore, reasoning, reasoningShort } =
          data;
        if (!userId || !opportunityId) {
          logger.warn(
            { data },
            'Missing userId or opportunityId in candidate opportunity match',
          );
          return;
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

          // TODO: Temporary until we happy to launch
          const isTeamMember = await con.getRepository(Feature).exists({
            where: {
              userId,
              feature: FeatureType.Team,
              value: 1,
            },
          });
          if (isTeamMember) {
            await manager
              .getRepository(Alerts)
              .update({ userId, opportunityId: IsNull() }, { opportunityId });
          }
        });
      } catch (originalError) {
        const err = originalError as TypeORMQueryFailedError;
        if (err?.name === 'QueryFailedError') {
          logger.error({ err, data }, 'could not store opportunity match');

          return;
        }

        throw err;
      }
    },
    parseMessage: (message) => {
      return MatchedCandidate.fromBinary(message.data);
    },
  };

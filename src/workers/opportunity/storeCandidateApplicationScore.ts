import { TypedWorker } from '../worker';
import { ApplicationScored } from '@dailydotdev/schema';
import { OpportunityMatch } from '../../entity/OpportunityMatch';
import { applicationScoreSchema } from '../../common/schema/opportunities';
import { User } from '../../entity';
import { logger } from '../../logger';

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

      const user = await con.getRepository(User).findOneBy({ id: userId });
      if (!user) {
        logger.error(
          { opportunityId, userId },
          'storeCandidateApplicationScore: User not found',
        );
        return;
      }

      const applicationRank = applicationScoreSchema.parse({
        score,
        description,
      });

      const matchExists = await con.getRepository(OpportunityMatch).exists({
        where: { userId, opportunityId },
      });

      if (matchExists) {
        await con
          .getRepository(OpportunityMatch)
          .createQueryBuilder()
          .update({
            applicationRank: () => `"applicationRank" || :applicationRankJson`,
          })
          .where({
            userId,
            opportunityId,
          })
          .setParameter('applicationRankJson', JSON.stringify(applicationRank))
          .execute();
      } else {
        await con.getRepository(OpportunityMatch).insert({
          userId,
          opportunityId,
          applicationRank,
        });
      }
    },
    parseMessage: (message) => ApplicationScored.fromBinary(message.data),
  };

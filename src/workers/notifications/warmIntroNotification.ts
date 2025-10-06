import { TypedNotificationWorker } from '../worker';
import { NotificationType } from '../../notifications/common';
import { logger } from '../../logger';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import { OpportunityUserType } from '../../entity/opportunities/types';
import { WarmIntro } from '@dailydotdev/schema';
import { Feature, FeatureType } from '../../entity';
import { OpportunityMatch } from '../../entity/OpportunityMatch';

export const warmIntroNotification: TypedNotificationWorker<'gondul.v1.warm-intro-generated'> =
  {
    subscription: 'api.recruiter-warm-intro-notification',
    handler: async ({ userId, opportunityId, description }, con) => {
      const opportunity = await con.getRepository(OpportunityJob).findOne({
        where: {
          id: opportunityId,
        },
        relations: ['organization', 'users'],
      });

      if (!opportunity) {
        logger.error(
          { opportunityId, userId, opportunity },
          'warmIntroNotification: Opportunity not found',
        );
        return;
      }

      await con
        .getRepository(OpportunityMatch)
        .createQueryBuilder()
        .update({
          applicationRank: () => `applicationRank || :applicationRankJson`,
        })
        .where({
          userId,
          opportunityId,
        })
        .setParameter(
          'applicationRankJson',
          JSON.stringify({ warmIntro: description || {} }),
        )
        .execute();

      // TODO: Temporary until we happy to launch
      const isTeamMember = await con.getRepository(Feature).exists({
        where: {
          userId,
          feature: FeatureType.Team,
          value: 1,
        },
      });
      if (!isTeamMember) {
        return;
      }

      const organization = await opportunity.organization;
      const users = await opportunity.users;

      const recruiters = users.find(
        (user) => user.type === OpportunityUserType.Recruiter,
      );
      const recruiter = await recruiters?.user;

      return [
        {
          type: NotificationType.WarmIntro,
          ctx: {
            userIds: [userId],
            opportunityId,
            description,
            recruiter,
            organization,
          },
        },
      ];
    },
    parseMessage: (message) => WarmIntro.fromBinary(message.data),
  };

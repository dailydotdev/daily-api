import { TypedNotificationWorker } from '../worker';
import { OpportunityUser } from '../../entity/opportunities/user';
import { OpportunityUserType } from '../../entity/opportunities/types';
import { NotificationType } from '../../notifications/common';

export const recruiterOpportunityLiveNotification: TypedNotificationWorker<'api.v1.opportunity-went-live'> =
  {
    subscription: 'api.recruiter-opportunity-live-notification',
    handler: async (data, con, logger) => {
      const { opportunityId, title } = data;

      try {
        // Fetch recruiters for the opportunity
        const opportunityUsers = await con.getRepository(OpportunityUser).find({
          where: {
            opportunityId,
            type: OpportunityUserType.Recruiter,
          },
        });

        const recruiterIds = opportunityUsers.map((ou) => ou.userId);

        if (recruiterIds.length === 0) {
          logger.warn(
            { opportunityId },
            'No recruiters found for opportunity going live',
          );
          return [];
        }

        return [
          {
            type: NotificationType.RecruiterOpportunityLive,
            ctx: {
              userIds: recruiterIds,
              opportunityId,
              opportunityTitle: title,
            },
          },
        ];
      } catch (err) {
        logger.error(
          { data, err },
          'failed to generate recruiter opportunity live notification',
        );
        return [];
      }
    },
  };

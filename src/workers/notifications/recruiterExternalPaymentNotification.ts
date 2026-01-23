import { TypedNotificationWorker } from '../worker';
import { OpportunityUser } from '../../entity/opportunities/user';
import { OpportunityUserType } from '../../entity/opportunities/types';
import { NotificationType } from '../../notifications/common';

export const recruiterExternalPaymentNotification: TypedNotificationWorker<'api.v1.opportunity-external-payment'> =
  {
    subscription: 'api.recruiter-external-payment-notification',
    handler: async (data, con, logger) => {
      const { opportunityId, title } = data;

      try {
        // Fetch recruiters for the opportunity, excluding the payer
        const opportunityUsers = await con.getRepository(OpportunityUser).find({
          where: {
            opportunityId,
            type: OpportunityUserType.Recruiter,
          },
        });

        const recruiterIds = opportunityUsers.map((ou) => ou.userId);

        if (recruiterIds.length === 0) {
          logger.info(
            { opportunityId },
            'No other recruiters found to notify for external payment',
          );
          return [];
        }

        return [
          {
            type: NotificationType.RecruiterExternalPayment,
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
          'failed to generate recruiter external payment notification',
        );
        return [];
      }
    },
  };

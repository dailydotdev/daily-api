import { NotificationType } from '../../notifications/common';
import { TypedNotificationWorker } from '../worker';

export const experienceCompanyEnrichedNotification: TypedNotificationWorker<'api.v1.experience-company-enriched'> =
  {
    subscription: 'api.experience-company-enriched-notification',
    handler: async (data) => {
      const {
        experienceId,
        userId,
        experienceTitle,
        experienceType,
        companyId,
        companyName,
      } = data;

      return [
        {
          type: NotificationType.ExperienceCompanyEnriched,
          ctx: {
            userIds: [userId],
            experienceId,
            experienceTitle,
            experienceType,
            companyId,
            companyName,
          },
        },
      ];
    },
  };

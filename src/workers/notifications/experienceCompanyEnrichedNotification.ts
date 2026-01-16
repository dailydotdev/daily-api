import { NotificationType } from '../../notifications/common';
import { TypedNotificationWorker } from '../worker';
import { UserExperience } from '../../entity/user/experiences/UserExperience';
import { Company } from '../../entity/Company';

export const experienceCompanyEnrichedNotification: TypedNotificationWorker<'api.v1.experience-company-enriched'> =
  {
    subscription: 'api.experience-company-enriched-notification',
    handler: async (data, con) => {
      const { experienceId, userId, companyId } = data;

      const experience = await con
        .getRepository(UserExperience)
        .findOneBy({ id: experienceId });

      if (!experience) {
        return [];
      }

      const company = await con
        .getRepository(Company)
        .findOneBy({ id: companyId });

      if (!company) {
        return [];
      }

      return [
        {
          type: NotificationType.ExperienceCompanyEnriched,
          ctx: {
            userIds: [userId],
            experienceId,
            experienceTitle: experience.title,
            experienceType: experience.type,
            companyId,
            companyName: company.name,
          },
        },
      ];
    },
  };

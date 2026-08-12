import { enrichCompanyForExperience } from '../common/companyEnrichment';
import { triggerTypedEvent } from '../common/typedPubsub';
import { UserExperience } from '../entity/user/experiences/UserExperience';
import { UserExperienceType } from '../entity/user/experiences/types';
import type { TypedWorker } from './worker';

const worker: TypedWorker<'api.v1.experience-company-enrichment'> = {
  subscription: 'api.experience-company-enrichment',
  handler: async (message, con, logger): Promise<void> => {
    const { experienceId } = message.data;

    const experience = await con
      .getRepository(UserExperience)
      .findOneBy({ id: experienceId });

    if (
      !experience ||
      experience.companyId ||
      !experience.customCompanyName ||
      ![UserExperienceType.Work, UserExperienceType.Education].includes(
        experience.type,
      )
    ) {
      return;
    }

    const { success, companyId } = await enrichCompanyForExperience(
      con,
      {
        experienceId,
        customCompanyName: experience.customCompanyName,
        experienceType: experience.type,
      },
      logger,
    );

    if (success && companyId) {
      await triggerTypedEvent(logger, 'api.v1.experience-company-enriched', {
        experienceId,
        userId: experience.userId,
        companyId,
      });
    }
  },
};

export default worker;

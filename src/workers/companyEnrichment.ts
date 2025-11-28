import { TypedWorker } from './worker';
import { enrichCompanyForExperience } from '../common/companyEnrichment';
import { UserExperienceType } from '../entity/user/experiences/types';

const worker: TypedWorker<'api.v1.company-enrichment'> = {
  subscription: 'api.company-enrichment-worker',
  handler: async (message, con, logger) => {
    const { experienceId, customCompanyName, userId, experienceType } =
      message.data;

    logger.info(
      { experienceId, customCompanyName, userId, experienceType },
      'Company enrichment triggered',
    );

    const type =
      experienceType === 'education'
        ? UserExperienceType.Education
        : UserExperienceType.Work;

    await enrichCompanyForExperience(
      con,
      {
        experienceId,
        customCompanyName,
        experienceType: type,
      },
      logger,
    );
  },
};

export default worker;

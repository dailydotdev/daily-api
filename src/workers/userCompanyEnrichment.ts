import {
  enrichCompanyForUserCompany,
  syncVerifiedUserWorkExperiences,
} from '../common/companyEnrichment';
import type { TypedWorker } from './worker';

const worker: TypedWorker<'api.v1.user-company-enrichment'> = {
  subscription: 'api.user-company-enrichment',
  handler: async (message, con, logger): Promise<void> => {
    const { email, userId } = message.data;

    if (!email || !userId) {
      return;
    }

    const domain = email.toLowerCase().split('@')[1];

    if (!domain) {
      return;
    }

    const { companyId } = await enrichCompanyForUserCompany(
      con,
      {
        userCompanyEmail: email,
        userCompanyUserId: userId,
        domain,
      },
      logger,
    );

    // Enrichment usually resolves the company after the user has already
    // entered their verification code, and nothing else revisits the
    // experience once that moment has passed.
    await syncVerifiedUserWorkExperiences(con, userId, companyId ?? null);
  },
};

export default worker;

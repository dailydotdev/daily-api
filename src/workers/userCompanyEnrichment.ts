import { enrichCompanyForUserCompany } from '../common/companyEnrichment';
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

    await enrichCompanyForUserCompany(
      con,
      {
        userCompanyEmail: email,
        userCompanyUserId: userId,
        domain,
      },
      logger,
    );
  },
};

export default worker;

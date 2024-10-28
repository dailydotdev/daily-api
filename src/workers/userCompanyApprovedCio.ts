import { TypedWorker } from './worker';
import { Company } from '../entity/Company';
import { cioV2, identifyUserCompany } from '../cio';

const worker: TypedWorker<'api.v1.user-company-approved'> = {
  subscription: 'api.user-company-approved-cio',
  handler: async (message, con, log) => {
    if (!process.env.CIO_SITE_ID) {
      return;
    }

    const {
      data: { userCompany },
    } = message;

    if (!userCompany.companyId) {
      return;
    }

    const company = await con
      .getRepository(Company)
      .findOneBy({ id: userCompany.companyId });
    if (!company) {
      log.warn(
        { userCompany },
        'company not found during CIO user company update',
      );
      return;
    }

    await identifyUserCompany({ cio: cioV2, userCompany, company });
  },
};

export default worker;

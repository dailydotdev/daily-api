import { TypedWorker } from './worker';
import { Company } from '../entity/Company';
import { cioV2, identifyUserCompany } from '../cio';
import { queryReadReplica } from '../common/queryReadReplica';

const worker: TypedWorker<'api.v1.user-company-approved'> = {
  subscription: 'api.user-company-approved-cio',
  handler: async (message, con, log) => {
    if (!process.env.CIO_SITE_ID) {
      return;
    }

    const {
      data: { userCompany },
    } = message;

    const { companyId } = userCompany;

    if (!companyId) {
      return;
    }

    const company = await queryReadReplica(con, async ({ queryRunner }) => {
      return queryRunner.manager
        .getRepository(Company)
        .findOneBy({ id: companyId });
    });

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

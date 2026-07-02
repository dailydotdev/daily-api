import { grantFoundingContributorAward } from '../common/contribution/founding';
import { TypedWorker } from './worker';

const worker: TypedWorker<'api.v1.contribution-action-completed'> = {
  subscription: 'api.contribution-action-completed-founding',
  handler: async ({ data }, con): Promise<void> => {
    await grantFoundingContributorAward({
      con,
      userId: data.submission.userId,
    });
  },
};

export default worker;

import { detectContributionMilestones } from '../common/contribution';
import { TypedWorker } from './worker';

const worker: TypedWorker<'api.v1.contribution-action-completed'> = {
  subscription: 'api.contribution-action-completed-milestone',
  handler: async (_, con): Promise<void> => {
    await detectContributionMilestones({ con: con.manager });
  },
};

export default worker;

import { CONTRIBUTION_ACTION_COMPLETED_CHANNEL } from '../common/contribution';
import { redisPubSub } from '../redis';
import { TypedWorker } from './worker';

const worker: TypedWorker<'api.v1.contribution-action-completed'> = {
  subscription: 'api.contribution-action-completed-real-time',
  handler: async (message): Promise<void> => {
    const { submission } = message.data;

    await redisPubSub.publish(CONTRIBUTION_ACTION_COMPLETED_CHANNEL, {
      submissionId: submission.id,
      userId: submission.userId,
      actionId: submission.actionId,
      awardedPoints: submission.awardedPoints,
    });
  },
};

export default worker;

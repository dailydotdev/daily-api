import { CONTRIBUTION_ACTION_COMPLETED_CHANNEL } from '../common/contribution';
import { redisPubSub } from '../redis';
import { TypedWorker } from './worker';

const worker: TypedWorker<'api.v1.contribution-action-completed'> = {
  subscription: 'api.contribution-action-completed-real-time',
  handler: async (message): Promise<void> => {
    const { submissionId, userId, actionId, awardedPoints } = message.data;

    await redisPubSub.publish(CONTRIBUTION_ACTION_COMPLETED_CHANNEL, {
      submissionId,
      userId,
      actionId,
      awardedPoints,
    });
  },
};

export default worker;

import { messageToJson } from '../worker';
import { Submission } from '../../entity';
import { NotificationSubmissionContext } from '../../notifications';
import { ChangeObject } from '../../types';
import { NotificationWorker } from './worker';

type Data = ChangeObject<Submission>;

const worker: NotificationWorker = {
  subscription: 'api.community-picks-failed-notification',
  handler: async (message) => {
    const data: Data = messageToJson(message);
    const ctx: NotificationSubmissionContext = {
      userId: data.userId,
      submission: data,
    };
    return [{ type: 'community_picks_failed', ctx }];
  },
};

export default worker;

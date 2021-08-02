import { DeepPartial } from 'typeorm';
import { messageToJson, Worker } from './worker';
import amplitude from '../amplitude';

const worker: Worker = {
  subscription: 'devcard-eligible-amplitude',
  handler: async (message): Promise<void> => {
    const data: DeepPartial<{ userId: string }> = messageToJson(message);
    await amplitude.logEvent({
      event_type: 'devcard eligible',
      user_id: data.userId,
    });
    await amplitude.flush();
  },
};

export default worker;

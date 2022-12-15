import { messageToJson, Worker } from './worker';
import { NotificationAvatar, User } from '../entity';

interface Data {
  userId: string;
  oldUsername: string;
  newUsername: string;
}

const worker: Worker = {
  subscription: 'api.username-changed-update-notifications',
  handler: async (message, con): Promise<void> => {
    const { userId }: Data = messageToJson(message);
    const user = await con.getRepository(User).findOneBy({ id: userId });
    if (!user) {
      return;
    }
    await con.getRepository(NotificationAvatar).update(
      {
        referenceId: userId,
        type: 'user',
      },
      { targetUrl: user.permalink },
    );
  },
};

export default worker;

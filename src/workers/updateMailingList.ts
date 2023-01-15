import { updateUserContactLists, User } from '../common';
import { messageToJson, Worker } from './worker';

interface Data {
  newProfile: User;
  user: User;
}

const worker: Worker = {
  subscription: 'user-updated-api-mailing',
  handler: async (message, con, log) => {
    const data = messageToJson<Data>(message);
    const { user: oldProfile, newProfile } = data;
    if (
      newProfile.infoConfirmed &&
      (newProfile.email !== oldProfile.email ||
        !oldProfile.infoConfirmed ||
        newProfile.acceptedMarketing !== oldProfile.acceptedMarketing)
    ) {
      await updateUserContactLists(log, newProfile, oldProfile);
    }
  },
};

export default worker;

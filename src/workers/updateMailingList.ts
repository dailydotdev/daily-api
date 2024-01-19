import { ghostUser, updateUserContactLists, User } from '../common';
import { messageToJson, Worker } from './worker';

interface Data {
  newProfile: User;
  user: User;
}

const worker: Worker = {
  subscription: 'user-updated-api-mailing',
  handler: async (message, con, log) => {
    if (!process.env.SENDGRID_API_KEY) {
      return;
    }
    const data = messageToJson<Data>(message);
    const { user: oldProfile, newProfile } = data;

    if (oldProfile.id === ghostUser.id) {
      return;
    }

    if (
      newProfile.infoConfirmed &&
      (newProfile.email !== oldProfile.email ||
        !oldProfile.infoConfirmed ||
        newProfile.acceptedMarketing !== oldProfile.acceptedMarketing ||
        newProfile.name !== oldProfile.name)
    ) {
      await updateUserContactLists(log, newProfile, oldProfile);
    }
  },
};

export default worker;

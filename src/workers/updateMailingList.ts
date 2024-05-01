import { ghostUser, updateUserContactLists } from '../common';
import { TypedWorker } from './worker';

const worker: TypedWorker<'user-updated'> = {
  subscription: 'user-updated-api-mailing',
  handler: async (message, con, log) => {
    if (!process.env.SENDGRID_API_KEY) {
      return;
    }
    const { data } = message;
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

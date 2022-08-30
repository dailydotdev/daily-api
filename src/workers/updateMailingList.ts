import {
  getContactIdByEmail,
  removeUserFromList,
  updateUserContact,
  User,
} from '../common';
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
    if (!newProfile.email || !newProfile.email.length) {
      log.warn(
        { messageId: message.messageId, userId: oldProfile.id },
        'no email in user-updated message',
      );
      return;
    }

    if (newProfile.email === oldProfile.email) {
      return;
    }

    try {
      const lists = ['85a1951f-5f0c-459f-bf5e-e5c742986a50'];
      if (!newProfile.acceptedMarketing && oldProfile.email?.trim?.()) {
        const contactId = await getContactIdByEmail(oldProfile.email);
        if (contactId) {
          await removeUserFromList(
            '53d09271-fd3f-4e38-ac21-095bf4f52de6',
            contactId,
          );
        }
      } else {
        lists.push('53d09271-fd3f-4e38-ac21-095bf4f52de6');
      }
      await updateUserContact(newProfile, oldProfile.email, lists);
    } catch (err) {
      if (
        err.code === 400 &&
        err.response?.body?.errors?.[0]?.message ===
          'length should be less than 50 chars'
      ) {
        log.warn(
          { messageId: message.messageId, err, userId: oldProfile.id },
          'skipped updating user in mailing list',
        );
      } else {
        log.error(
          { messageId: message.messageId, err, userId: oldProfile.id },
          'failed to update user in mailing list',
        );
        throw err;
      }
    }
  },
};

export default worker;

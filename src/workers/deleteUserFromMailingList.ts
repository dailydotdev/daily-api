import { getContactIdByEmail, removeUserContact } from '../common';
import { TypedWorker } from './worker';

const worker: TypedWorker<'user-deleted'> = {
  subscription: 'user-deleted-api-mailing',
  handler: async (message, _, log) => {
    if (!process.env.SENDGRID_API_KEY) {
      return;
    }

    const { data } = message;
    if (!data.email || !data.email.trim()) {
      log.warn(
        { messageId: message.messageId, userId: data.id },
        'no email in user-deleted message',
      );
      return;
    }
    try {
      const contactId = await getContactIdByEmail(data.email);
      await removeUserContact(contactId);
    } catch (err) {
      log.error(
        { messageId: message.messageId, err, userId: data.id },
        'failed to delete user from mailing list',
      );
      throw err;
    }
  },
};

export default worker;

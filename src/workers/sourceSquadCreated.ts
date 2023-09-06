import {
  getContactIdByEmail,
  addUserToContacts,
  LIST_DRIP_CAMPAIGN,
} from '../common';
import { Source, SourceMember, User, UserActionType } from '../entity';
import { SourceMemberRoles } from '../roles';
import { insertOrIgnoreAction } from '../schema/actions';
import { ChangeObject } from '../types';
import { messageToJson, Worker } from './worker';

interface Data {
  source: ChangeObject<Source>;
}

const worker: Worker = {
  subscription: 'api.source-squad-created',
  handler: async (message, con, logger) => {
    const data: Data = messageToJson(message);

    try {
      const { source } = data;
      const owner = await con.getRepository(SourceMember).findOne({
        select: ['userId'],
        where: {
          sourceId: source.id,
          role: SourceMemberRoles.Admin,
        },
        order: {
          createdAt: 'ASC',
        },
      });

      if (!owner) {
        return;
      }

      const user = await con
        .getRepository(User)
        .findOneBy({ id: owner.userId });

      if (!user) {
        return;
      }

      await insertOrIgnoreAction(con, user.id, UserActionType.CreateSquad);

      if (user.acceptedMarketing) {
        const contactId = await getContactIdByEmail(user.email);

        await addUserToContacts(user, [LIST_DRIP_CAMPAIGN], contactId);
      }
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to add source member to mailing list',
      );
    }
  },
};

export default worker;

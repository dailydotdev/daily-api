import {
  getContactIdByEmail,
  addUserToContacts,
  LIST_DRIP_CAMPAIGN,
} from '../common';
import { SourceMember, SquadSource, User } from '../entity';
import { SourceMemberRoles } from '../roles';
import { ChangeObject } from '../types';
import { messageToJson, Worker } from './worker';

interface Data {
  sourceMember: ChangeObject<SourceMember>;
}

const worker: Worker = {
  subscription: 'api.member-joined-source-mailing',
  handler: async (message, con, logger) => {
    const data: Data = messageToJson(message);

    try {
      const { sourceMember } = data;

      const [user, source] = await Promise.all([
        con.getRepository(User).findOneBy({ id: sourceMember.userId }),
        con.getRepository(SquadSource).findOneBy({ id: sourceMember.sourceId }),
      ]);

      // currently we treat admins as owners
      const isOwner = sourceMember.role === SourceMemberRoles.Admin;

      if (source && user && user.acceptedMarketing && isOwner) {
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

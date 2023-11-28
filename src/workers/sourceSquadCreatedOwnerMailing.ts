import {
  getContactIdByEmail,
  addUserToContacts,
  LIST_SQUAD_DRIP_CAMPAIGN,
} from '../common';
import { Source, SourceMember, SourceType } from '../entity';
import { SourceMemberRoles } from '../roles';
import { ChangeObject } from '../types';
import { messageToJson, Worker } from './worker';

interface Data {
  source: ChangeObject<Source>;
}

const worker: Worker = {
  subscription: 'api.source-created-squad-owner-mailing',
  handler: async (message, con, logger) => {
    const data: Data = messageToJson(message);

    const { source } = data;

    if (source.type !== SourceType.Squad) {
      return;
    }

    const owner = await con.getRepository(SourceMember).findOne({
      select: ['userId', 'sourceId', 'createdAt'],
      where: {
        sourceId: source.id,
        role: SourceMemberRoles.Admin,
      },
      order: {
        createdAt: 'ASC',
      },
      relations: ['user'],
    });

    if (!owner) {
      return;
    }

    const user = await owner.user;

    if (!user) {
      return;
    }

    if (user.acceptedMarketing) {
      if (process.env.NODE_ENV === 'development') {
        return;
      }

      const contactId = await getContactIdByEmail(user.email);

      await addUserToContacts(
        user,
        [LIST_SQUAD_DRIP_CAMPAIGN],
        contactId,
        logger,
      );
    }
  },
};

export default worker;

import { Source, SourceMember, SourceType, UserActionType } from '../entity';
import { SourceMemberRoles } from '../roles';
import { insertOrIgnoreAction } from '../schema/actions';
import { ChangeObject } from '../types';
import { messageToJson, Worker } from './worker';

interface Data {
  source: ChangeObject<Source>;
}

const worker: Worker = {
  subscription: 'api.source-created-squad-user-action',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);

    const { source } = data;

    if (source.type !== SourceType.Squad) {
      return;
    }

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

    await insertOrIgnoreAction(con, owner.userId, UserActionType.CreateSquad);
  },
};

export default worker;

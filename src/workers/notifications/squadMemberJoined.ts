import { messageToJson } from '../worker';
import {
  NotificationDoneByContext,
  NotificationSourceContext,
} from '../../notifications';
import { NotificationWorker } from './worker';
import { ChangeObject } from '../../types';
import { Source, SourceMember, SourceType, User } from '../../entity';
import { In, Not } from 'typeorm';
import { SourceMemberRoles } from '../../roles';

interface Data {
  sourceMember: ChangeObject<SourceMember>;
}

const worker: NotificationWorker = {
  subscription: 'api.member-joined-source-notification',
  handler: async (message, con) => {
    const { sourceMember: member }: Data = messageToJson(message);
    const owner = await con.getRepository(SourceMember).findOne({
      where: {
        sourceId: member.sourceId,
        userId: Not(In([member.userId])),
        role: SourceMemberRoles.Owner,
      },
    });
    if (!owner) {
      return;
    }
    const [doneBy, source] = await Promise.all([
      con.getRepository(User).findOneBy({ id: member.userId }),
      con.getRepository(Source).findOneBy({ id: member.sourceId }),
    ]);
    if (!doneBy || !source || source.type !== SourceType.Squad) {
      return;
    }
    const ctx: NotificationSourceContext & NotificationDoneByContext = {
      userId: owner.userId,
      source,
      doneBy,
    };
    return [{ type: 'squad_member_joined', ctx }];
  },
};

export default worker;

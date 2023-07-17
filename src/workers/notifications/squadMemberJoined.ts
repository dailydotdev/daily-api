import { messageToJson } from '../worker';
import {
  NotificationDoneByContext,
  NotificationPostContext,
} from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { NotificationWorker } from './worker';
import { ChangeObject } from '../../types';
import {
  Source,
  SourceMember,
  SourceType,
  User,
  UserActionType,
  WelcomePost,
} from '../../entity';
import { In, Not } from 'typeorm';
import { SourceMemberRoles } from '../../roles';
import { insertOrIgnoreAction } from '../../schema/actions';

interface Data {
  sourceMember: ChangeObject<SourceMember>;
}

const worker: NotificationWorker = {
  subscription: 'api.member-joined-source-notification',
  handler: async (message, con) => {
    const { sourceMember: member }: Data = messageToJson(message);
    const admin = await con.getRepository(SourceMember).findOne({
      where: {
        sourceId: member.sourceId,
        userId: Not(In([member.userId])),
        role: SourceMemberRoles.Admin,
      },
    });

    const actionType =
      member.role === SourceMemberRoles.Admin
        ? UserActionType.CreateSquad
        : UserActionType.JoinSquad;

    await insertOrIgnoreAction(con, member.userId, actionType);

    if (!admin) {
      return;
    }
    const [doneBy, source, post] = await Promise.all([
      con.getRepository(User).findOneBy({ id: member.userId }),
      con.getRepository(Source).findOneBy({ id: member.sourceId }),
      con.getRepository(WelcomePost).findOneBy({ sourceId: member.sourceId }),
    ]);
    if (!doneBy || !post || source.type !== SourceType.Squad) {
      return;
    }
    const ctx: NotificationPostContext & NotificationDoneByContext = {
      userId: admin.userId,
      post,
      source,
      doneBy,
    };
    return [{ type: NotificationType.SquadMemberJoined, ctx }];
  },
};

export default worker;

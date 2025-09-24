import { TypedNotificationWorker } from '../worker';
import { NotificationType } from '../../notifications/common';
import {
  Source,
  SourceType,
  User,
  UserActionType,
  WelcomePost,
} from '../../entity';
import { In, Not } from 'typeorm';
import { SourceMemberRoles } from '../../roles';
import { insertOrIgnoreAction } from '../../schema/actions';
import { getSubscribedMembers } from './utils';

export const squadMemberJoined: TypedNotificationWorker<'api.v1.member-joined-source'> =
  {
    subscription: 'api.member-joined-source-notification',
    handler: async ({ sourceMember: member }, con, logger) => {
      const logDetails = { member };
      const admins = await getSubscribedMembers(
        con,
        NotificationType.SquadMemberJoined,
        member.sourceId,
        {
          sourceId: member.sourceId,
          userId: Not(In([member.userId])),
          role: In([SourceMemberRoles.Admin, SourceMemberRoles.Moderator]),
        },
      );

      const doneBy = await con
        .getRepository(User)
        .findOneBy({ id: member.userId });

      if (!doneBy) {
        logger.info(logDetails, 'doneBy user does not exist');

        return;
      }

      if (member.role !== SourceMemberRoles.Admin) {
        await insertOrIgnoreAction(
          con,
          member.userId,
          UserActionType.JoinSquad,
        );
      }

      if (!admins?.length) {
        return;
      }
      const [source, post] = await Promise.all([
        con.getRepository(Source).findOneBy({ id: member.sourceId }),
        con.getRepository(WelcomePost).findOneBy({ sourceId: member.sourceId }),
      ]);

      if (!source) {
        logger.info(logDetails, 'source does not exist');

        return;
      }

      if (!post || source.type !== SourceType.Squad) {
        return;
      }

      return [
        {
          type: NotificationType.SquadMemberJoined,
          ctx: {
            userIds: admins.map(({ userId }) => userId),
            post,
            source,
            doneBy,
          },
        },
      ];
    },
  };

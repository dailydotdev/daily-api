import { messageToJson } from '../worker';
import { NotificationSourceContext } from '../../notifications';
import { NotificationWorker } from './worker';
import { ChangeObject } from '../../types';
import { Source, SourceMember } from '../../entity';
import { SourceMemberRoles } from '../../roles';
import { NotificationType } from '../../notifications/common';

interface Data {
  previousRole: SourceMemberRoles;
  sourceMember: ChangeObject<SourceMember>;
}

const previousRoleToNewRole: Partial<
  Record<
    Partial<SourceMemberRoles>,
    Partial<Record<SourceMemberRoles, NotificationType>>
  >
> = {
  [SourceMemberRoles.Member]: {
    [SourceMemberRoles.Blocked]: NotificationType.SquadBlocked,
    [SourceMemberRoles.Admin]: NotificationType.PromotedToAdmin,
    [SourceMemberRoles.Moderator]: NotificationType.PromotedToModerator,
  },
  [SourceMemberRoles.Moderator]: {
    [SourceMemberRoles.Blocked]: NotificationType.SquadBlocked,
    [SourceMemberRoles.Admin]: NotificationType.PromotedToAdmin,
    [SourceMemberRoles.Member]: NotificationType.DemotedToMember,
  },
  [SourceMemberRoles.Admin]: {
    [SourceMemberRoles.Blocked]: NotificationType.SquadBlocked,
    [SourceMemberRoles.Moderator]: NotificationType.PromotedToModerator,
    [SourceMemberRoles.Member]: NotificationType.DemotedToMember,
  },
};

const worker: NotificationWorker = {
  subscription: 'api.source-member-role-changed-notification',
  handler: async (message, con) => {
    const { previousRole, sourceMember: member }: Data = messageToJson(message);

    const source = await con
      .getRepository(Source)
      .findOneBy({ id: member.sourceId });
    const baseCtx: NotificationSourceContext = {
      userId: member.userId,
      source,
    };
    if (!source) {
      return;
    }

    const roleToNotificationMap =
      previousRoleToNewRole[previousRole]?.[member.role];

    switch (roleToNotificationMap) {
      case 'demoted_to_member':
        return [
          {
            type: roleToNotificationMap,
            ctx: { ...baseCtx, role: previousRole },
          },
        ];
        break;
      case 'promoted_to_admin':
      case 'promoted_to_moderator':
      case 'squad_blocked':
        return [{ type: roleToNotificationMap, ctx: baseCtx }];
        break;
    }
  },
};

export default worker;

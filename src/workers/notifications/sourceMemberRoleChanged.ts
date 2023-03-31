import { messageToJson } from '../worker';
import { NotificationSourceContext } from '../../notifications';
import { NotificationWorker } from './worker';
import { ChangeObject } from '../../types';
import { NotificationType, Source, SourceMember } from '../../entity';
import { SourceMemberRoles } from '../../roles';

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
    [SourceMemberRoles.Blocked]: 'squad_blocked',
    [SourceMemberRoles.Owner]: 'role_promote_to_role',
    [SourceMemberRoles.Moderator]: 'role_promote_to_moderator',
  },
  [SourceMemberRoles.Moderator]: {
    [SourceMemberRoles.Blocked]: 'squad_blocked',
    [SourceMemberRoles.Owner]: 'role_promote_to_role',
    [SourceMemberRoles.Member]: 'role_demote_to_member',
  },
  [SourceMemberRoles.Owner]: {
    [SourceMemberRoles.Blocked]: 'squad_blocked',
    [SourceMemberRoles.Moderator]: 'role_promote_to_role',
    [SourceMemberRoles.Member]: 'role_demote_to_member',
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

    const roleToNotificationMap =
      previousRoleToNewRole[previousRole][member.role];

    switch (roleToNotificationMap) {
      case 'role_promote_to_role':
        return [
          {
            type: roleToNotificationMap,
            ctx: { ...baseCtx, role: member.role },
          },
        ];
        break;
      case 'role_demote_to_member':
        return [
          {
            type: roleToNotificationMap,
            ctx: { ...baseCtx, role: previousRole },
          },
        ];
        break;
      case 'role_promote_to_moderator':
      case 'squad_blocked':
        return [{ type: roleToNotificationMap, ctx: baseCtx }];
        break;
    }
  },
};

export default worker;

import { TypedNotificationWorker } from '../worker';
import { NotificationSourceContext } from '../../notifications';
import { Source } from '../../entity';
import { SourceMemberRoles } from '../../roles';
import { NotificationType } from '../../notifications/common';
import { queryReadReplica } from '../../common/queryReadReplica';

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

export const sourceMemberRoleChanged: TypedNotificationWorker<'api.v1.source-member-role-changed'> =
  {
    subscription: 'api.source-member-role-changed-notification',
    handler: async ({ previousRole, sourceMember: member }, con, logger) => {
      const logDetails = { member };

      const source = await queryReadReplica(con, ({ queryRunner }) => {
        return queryRunner.manager
          .getRepository(Source)
          .findOneBy({ id: member.sourceId });
      });

      if (!source) {
        logger.info(logDetails, 'source does not exist');

        return;
      }

      const baseCtx: NotificationSourceContext = {
        userIds: [member.userId],
        source,
      };

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
        case 'promoted_to_admin':
        case 'promoted_to_moderator':
        case 'squad_blocked':
          return [{ type: roleToNotificationMap, ctx: baseCtx }];
      }
    },
  };

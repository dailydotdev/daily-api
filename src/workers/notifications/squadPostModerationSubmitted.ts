import { generateTypedNotificationWorker } from './worker';
import { SourceMember } from '../../entity';
import { In } from 'typeorm';
import { SourceMemberRoles } from '../../roles';
import { NotificationType } from '../../notifications/common';
import { NotificationPostModerationContext } from '../../notifications';
import { SquadPostModerationStatus } from '../../entity/SquadPostModeration';

const worker =
  generateTypedNotificationWorker<'api.v1.squad-post-moderation-submitted'>({
    subscription: 'api.v1.squad-post-moderation-submitted-notification',
    handler: async ({ post }, con) => {
      if (post.status !== SquadPostModerationStatus.Pending) {
        return;
      }

      const mods = await con.getRepository(SourceMember).find({
        select: ['userId'],
        where: {
          sourceId: post.sourceId,
          role: In([SourceMemberRoles.Admin, SourceMemberRoles.Moderator]),
        },
      });

      const ctx: NotificationPostModerationContext = {
        post,
        userIds: mods.map((m) => m.userId),
      };

      return [{ type: NotificationType.SquadPostSubmitted, ctx }];
    },
  });

export default worker;

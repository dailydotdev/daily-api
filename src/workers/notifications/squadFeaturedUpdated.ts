import { NotificationType } from '../../notifications/common';
import { generateTypedNotificationWorker } from './worker';
import { NotificationSourceContext } from '../../notifications';
import { SourceMemberRoles } from '../../roles';
import { SourceMember } from '../../entity';
import { In } from 'typeorm';

const toNotify = [SourceMemberRoles.Admin, SourceMemberRoles.Moderator];

const worker = generateTypedNotificationWorker<'api.v1.squad-featured-updated'>(
  {
    subscription: 'api.squad-featured-updated-notification',
    handler: async ({ squad }, con) => {
      if (!squad.flags.featured) {
        return undefined;
      }

      const users = await con.getRepository(SourceMember).findBy({
        sourceId: squad.id,
        role: In(toNotify),
      });

      if (!users.length) {
        return undefined;
      }

      const ctx: NotificationSourceContext = {
        userIds: users.map((u) => u.userId),
        source: squad,
      };

      return [{ type: NotificationType.SquadFeatured, ctx }];
    },
  },
);

export default worker;

import { NotificationType } from '../../notifications/common';
import { TypedNotificationWorker } from '../worker';
import { NotificationSourceContext } from '../../notifications';
import { SourceMemberRoles } from '../../roles';
import { In } from 'typeorm';
import { getSubscribedMembers } from './utils';

const toNotify = [SourceMemberRoles.Admin, SourceMemberRoles.Moderator];

const worker: TypedNotificationWorker<'api.v1.squad-featured-updated'> = {
  subscription: 'api.squad-featured-updated-notification',
  handler: async ({ squad }, con) => {
    if (!squad.flags.featured) {
      return undefined;
    }

    const members = await getSubscribedMembers(
      con,
      NotificationType.SquadFeatured,
      squad.id,
      {
        sourceId: squad.id,
        role: In(toNotify),
      },
    );

    if (!members.length) {
      return undefined;
    }

    const ctx: NotificationSourceContext = {
      userIds: members.map((u) => u.userId),
      source: squad,
    };

    return [{ type: NotificationType.SquadFeatured, ctx }];
  },
};

export default worker;

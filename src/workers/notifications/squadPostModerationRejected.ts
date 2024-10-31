import { generateTypedNotificationWorker } from './worker';
import { NotificationType } from '../../notifications/common';
import { NotificationPostModerationContext } from '../../notifications';
import { User } from '../../entity';
import { SquadPostModerationStatus } from '../../entity/SquadPostModeration';

const worker =
  generateTypedNotificationWorker<'api.v1.squad-post-moderation-submitted'>({
    subscription: 'api.v1.squad-post-moderation-rejected-notification',
    handler: async ({ post }, con) => {
      if (
        !post?.createdById ||
        post.status !== SquadPostModerationStatus.Rejected
      ) {
        return;
      }

      await con
        .getRepository(User)
        .findOneOrFail({ where: { id: post.createdById } });

      const ctx: NotificationPostModerationContext = {
        post,
        userIds: [post.createdById],
      };

      return [{ type: NotificationType.SquadPostRejected, ctx }];
    },
  });

export default worker;

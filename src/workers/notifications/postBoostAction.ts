import { Post, User } from '../../entity';
import { NotificationType } from '../../notifications/common';
import { generateTypedNotificationWorker } from './worker';
import { type NotificationBoostContext } from '../../notifications';
import { queryReadReplica } from '../../common/queryReadReplica';
import { updateFlagsStatement } from '../../common';

const worker = generateTypedNotificationWorker<'skadi.v1.campaign-updated'>({
  subscription: 'api.campaign-updated-notification',
  handler: async (params, con) => {
    const { userId, postId, campaignId, action } = params;

    const user = await queryReadReplica(con, ({ queryRunner }) => {
      return queryRunner.manager
        .getRepository(User)
        .findOneByOrFail({ id: userId });
    });

    const ctx: NotificationBoostContext = {
      user,
      campaignId,
      userIds: [userId],
    };

    switch (action) {
      case 'first_milestone':
        return [{ type: NotificationType.PostBoostFirstMilestone, ctx }];
      case 'completed':
        await con
          .getRepository(Post)
          .update(
            { id: postId },
            { flags: updateFlagsStatement<Post>({ campaignId: null }) },
          );
        return [{ type: NotificationType.PostBoostCompleted, ctx }];
      default:
        return;
    }
  },
});

export default worker;

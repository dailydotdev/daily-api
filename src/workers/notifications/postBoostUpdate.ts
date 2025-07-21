import { Post, User } from '../../entity';
import { NotificationType } from '../../notifications/common';
import { generateTypedNotificationWorker } from './worker';
import { type NotificationBoostContext } from '../../notifications';
import { queryReadReplica } from '../../common/queryReadReplica';
import { updateFlagsStatement } from '../../common';
import { logger } from '../../logger';

const worker = generateTypedNotificationWorker<'api.v1.post-boost-update'>({
  subscription: 'api.post-boost-update-notification',
  handler: async (params, con) => {
    const { userId, postId, campaignId, update } = params;

    await con
      .getRepository(Post)
      .update(
        { id: postId },
        { flags: updateFlagsStatement<Post>({ campaignId: null }) },
      );

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

    switch (update) {
      case 'first_milestone':
        return [{ type: NotificationType.PostBoostFirstMilestone, ctx }];
      case 'completed':
      case 'cancelled':
        return [{ type: NotificationType.PostBoostCompleted, ctx }];
      default:
        logger.info({ params }, `Sent 0 notification for action: ${update}`);
        return;
    }
  },
});

export default worker;

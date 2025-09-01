import { Post, User } from '../../entity';
import { NotificationType } from '../../notifications/common';
import { generateTypedNotificationWorker } from './worker';
import { type NotificationBoostContext } from '../../notifications';
import { queryReadReplica } from '../../common/queryReadReplica';
import { updateFlagsStatement } from '../../common';
import { logger } from '../../logger';

const worker = generateTypedNotificationWorker<'skadi.v1.campaign-updated'>({
  subscription: 'api.campaign-updated-notification',
  handler: async (params, con) => {
    const { userId, postId, campaignId, action } = params;

    if (!userId) {
      logger.error({ data: params }, `skadi v1 worker: user id is empty!`);
      return;
    }

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

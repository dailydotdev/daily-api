import { Post, User } from '../../entity';
import { NotificationType } from '../../notifications/common';
import { generateTypedNotificationWorker } from './worker';
import { type NotificationBoostContext } from '../../notifications';
import { queryReadReplica } from '../../common/queryReadReplica';
import { updateFlagsStatement } from '../../common';

const worker = generateTypedNotificationWorker<'api.v1.post-boost-action'>({
  subscription: 'api.post-boost-action-notification',
  handler: async (params, con) => {
    const { userId, postId, campaignId, action } = params;

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

    switch (action) {
      case 'first_milestone':
        return [{ type: NotificationType.PostBoostFirstMilestone, ctx }];
      case 'completed':
        return [{ type: NotificationType.PostBoostCompleted, ctx }];
      default:
        return;
    }
  },
});

export default worker;

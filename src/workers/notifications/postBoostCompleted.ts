import { Post, User } from '../../entity';
import { NotificationType } from '../../notifications/common';
import { generateTypedNotificationWorker } from './worker';
import { type NotificationBoostContext } from '../../notifications';
import { queryReadReplica } from '../../common/queryReadReplica';
import { updateFlagsStatement } from '../../common';

const worker = generateTypedNotificationWorker<'api.v1.post-boost-completed'>({
  subscription: 'api.post-boost-completed-notification',
  handler: async ({ userId, postId, campaignId }, con) => {
    await queryReadReplica(con, ({ queryRunner }) => {
      return queryRunner.manager
        .getRepository(Post)
        .update(
          { id: postId },
          { flags: updateFlagsStatement<Post>({ boosted: false }) },
        );
    });

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

    return [{ type: NotificationType.PostBoostCompleted, ctx }];
  },
});

export default worker;

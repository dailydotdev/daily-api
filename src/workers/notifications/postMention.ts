import { TypedNotificationWorker } from '../worker';
import { User } from '../../entity';
import {
  NotificationDoneByContext,
  NotificationPostContext,
} from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { buildPostContext } from './utils';
import { queryReadReplica } from '../../common/queryReadReplica';

export const postMention: TypedNotificationWorker<'api.v1.new-post-mention'> = {
  subscription: 'api.post-mention-notification',
  handler: async ({ postMention }, con) => {
    const { postId, mentionedByUserId, mentionedUserId } = postMention;
    const postCtx = await queryReadReplica(con, ({ queryRunner }) => {
      return buildPostContext(queryRunner.manager, postId);
    });

    if (!postCtx) {
      return;
    }

    const [doneBy, doneTo] = await queryReadReplica(con, ({ queryRunner }) => {
      const repo = queryRunner.manager.getRepository(User);

      return Promise.all([
        repo.findOneBy({ id: mentionedByUserId }),
        repo.findOneBy({ id: mentionedUserId }),
      ]);
    });

    if (!doneBy || !doneTo) {
      return;
    }

    const ctx: NotificationPostContext & NotificationDoneByContext = {
      ...postCtx,
      initiatorId: mentionedByUserId,
      userIds: [mentionedUserId],
      doneBy,
      doneTo,
    };
    return [{ type: NotificationType.PostMention, ctx }];
  },
};

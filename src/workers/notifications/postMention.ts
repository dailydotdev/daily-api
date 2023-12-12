import { messageToJson } from '../worker';
import { PostMention, User } from '../../entity';
import {
  NotificationDoneByContext,
  NotificationPostContext,
} from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { NotificationWorker } from './worker';
import { ChangeObject } from '../../types';
import { buildPostContext } from './utils';

interface Data {
  postMention: ChangeObject<PostMention>;
}

const worker: NotificationWorker = {
  subscription: 'api.post-mention-notification',
  handler: async (message, con) => {
    const { postMention }: Data = messageToJson(message);
    const { postId, mentionedByUserId, mentionedUserId } = postMention;
    const postCtx = await buildPostContext(con, postId);
    const repo = con.getRepository(User);

    if (!postCtx) {
      return;
    }

    const [doneBy, doneTo] = await Promise.all([
      repo.findOneBy({ id: mentionedByUserId }),
      repo.findOneBy({ id: mentionedUserId }),
    ]);

    if (!doneBy) {
      return;
    }

    const ctx: NotificationPostContext & NotificationDoneByContext = {
      ...postCtx,
      userIds: [mentionedUserId],
      doneBy,
      doneTo,
    };
    return [{ type: NotificationType.PostMention, ctx }];
  },
};

export default worker;

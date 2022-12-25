import { messageToJson } from '../worker';
import { Post, SourceMember, User } from '../../entity';
import {
  NotificationDoneByContext,
  NotificationPostContext,
} from '../../notifications';
import { NotificationHandlerReturn, NotificationWorker } from './worker';
import { ChangeObject } from '../../types';
import { buildPostContext } from './utils';
import { In, Not } from 'typeorm';

interface Data {
  post: ChangeObject<Post>;
}

const worker: NotificationWorker = {
  subscription: 'api.v2.post-added-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const baseCtx = await buildPostContext(con, data.post.id);
    if (!baseCtx) {
      return;
    }
    const { post, source } = baseCtx;
    const notifs: NotificationHandlerReturn = [];
    // community_picks_succeeded notification
    if (post.scoutId) {
      const ctx: NotificationPostContext = {
        ...baseCtx,
        userId: post.scoutId,
      };
      notifs.push({ type: 'community_picks_succeeded', ctx });
    }

    if (source) {
      // article_picked notification
      if (source.type === 'machine') {
        if (post.authorId) {
          const ctx: NotificationPostContext = {
            ...baseCtx,
            userId: post.authorId,
          };
          notifs.push({ type: 'article_picked', ctx });
        }
      }
      // post_added notification
      let doneBy: User;
      if (post.authorId) {
        doneBy = await con.getRepository(User).findOneBy({ id: post.authorId });
      }
      const members = await con.getRepository(SourceMember).find({
        where: { sourceId: source.id, userId: Not(In([post.authorId])) },
      });
      members.forEach((member) =>
        notifs.push({
          type: 'post_added',
          ctx: {
            ...baseCtx,
            doneBy,
            userId: member.userId,
          } as NotificationPostContext & Partial<NotificationDoneByContext>,
        }),
      );
    }
    return notifs;
  },
};

export default worker;

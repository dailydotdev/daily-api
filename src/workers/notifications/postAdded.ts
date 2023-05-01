import { messageToJson } from '../worker';
import { Post, SourceMember, SourceType, User } from '../../entity';
import {
  NotificationDoneByContext,
  NotificationPostContext,
} from '../../notifications';
import { NotificationHandlerReturn, NotificationWorker } from './worker';
import { ChangeObject } from '../../types';
import { buildPostContext } from './utils';
import { In, Not } from 'typeorm';
import { SourceMemberRoles } from '../../roles';

interface Data {
  post: ChangeObject<Post>;
}

const worker: NotificationWorker = {
  subscription: 'api.post-added-notification-v2',
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
      if (source.type === SourceType.Machine) {
        if (post.authorId && !post.private) {
          const ctx: NotificationPostContext = {
            ...baseCtx,
            userId: post.authorId,
          };
          notifs.push({ type: 'article_picked', ctx });
        }
      }
      if (source.type === SourceType.Squad && post.authorId) {
        // squad_post_added notification
        const doneBy = await con
          .getRepository(User)
          .findOneBy({ id: post.authorId });
        const members = await con.getRepository(SourceMember).find({
          where: {
            sourceId: source.id,
            userId: Not(In([post.authorId])),
            role: Not(SourceMemberRoles.Blocked),
          },
        });
        members.forEach((member) =>
          notifs.push({
            type: 'squad_post_added',
            ctx: {
              ...baseCtx,
              doneBy,
              userId: member.userId,
            } as NotificationPostContext & Partial<NotificationDoneByContext>,
          }),
        );
      }
    }
    return notifs;
  },
};

export default worker;

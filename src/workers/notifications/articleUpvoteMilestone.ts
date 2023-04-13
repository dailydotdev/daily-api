import { messageToJson } from '../worker';
import { SourceMember, SourceType, Upvote } from '../../entity';
import {
  NotificationPostContext,
  NotificationUpvotersContext,
} from '../../notifications';
import { NotificationWorker } from './worker';
import { buildPostContext, uniquePostOwners, UPVOTE_MILESTONES } from './utils';
import { In, Not } from 'typeorm';
import { SourceMemberRoles } from '../../roles';

interface Data {
  userId: string;
  postId: string;
}

const worker: NotificationWorker = {
  subscription: 'api.article-upvote-milestone-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const postCtx = await buildPostContext(con, data.postId);
    if (!postCtx) {
      return;
    }
    const { post, source } = postCtx;
    const users = uniquePostOwners(post, [data.userId]);
    if (!users.length || !UPVOTE_MILESTONES.includes(post.upvotes.toString())) {
      return;
    }
    const upvotes = await con.getRepository(Upvote).find({
      where: { postId: post.id },
      take: 5,
      order: { createdAt: 'desc' },
      relations: ['user'],
    });
    const upvoters = await Promise.all(upvotes.map((upvote) => upvote.user));
    const ctx: Omit<
      NotificationPostContext & NotificationUpvotersContext,
      'userId'
    > = {
      ...postCtx,
      upvoters,
      upvotes: post.upvotes,
    };

    if (source.type === SourceType.Squad) {
      const members = await con.getRepository(SourceMember).findBy({
        userId: In(users),
        sourceId: source.id,
        role: Not(SourceMemberRoles.Blocked),
      });

      if (!members.length) {
        return;
      }

      return members.map(({ userId }) => ({
        type: 'article_upvote_milestone',
        ctx: { ...ctx, userId },
      }));
    }

    return users.map((userId) => ({
      type: 'article_upvote_milestone',
      ctx: { ...ctx, userId },
    }));
  },
};

export default worker;

import { messageToJson } from '../worker';
import { SourceMember, SourceType, UserPost } from '../../entity';
import {
  NotificationPostContext,
  NotificationUpvotersContext,
} from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { NotificationWorker } from './worker';
import { buildPostContext, uniquePostOwners, UPVOTE_MILESTONES } from './utils';
import { In, Not } from 'typeorm';
import { SourceMemberRoles } from '../../roles';
import { UserVote } from '../../types';

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
    const upvotes = await con.getRepository(UserPost).find({
      where: { postId: post.id, vote: UserVote.Up },
      take: 5,
      order: { createdAt: 'desc' },
      relations: ['user'],
    });
    const upvoters = await Promise.all(upvotes.map((upvote) => upvote.user));
    const ctx: Omit<
      NotificationPostContext & NotificationUpvotersContext,
      'userIds'
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

      return [
        {
          type: NotificationType.ArticleUpvoteMilestone,
          ctx: { ...ctx, userIds: members.map(({ userId }) => userId) },
        },
      ];
    }

    return [
      {
        type: NotificationType.ArticleUpvoteMilestone,
        ctx: { ...ctx, userIds: users },
      },
    ];
  },
};

export default worker;

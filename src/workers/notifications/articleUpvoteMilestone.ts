import { TypedNotificationWorker } from '../worker';
import { SourceMember, SourceType, UserPost } from '../../entity';
import {
  NotificationPostContext,
  NotificationUpvotersContext,
} from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { buildPostContext, uniquePostOwners, UPVOTE_MILESTONES } from './utils';
import { In, Not } from 'typeorm';
import { SourceMemberRoles } from '../../roles';
import { UserVote } from '../../types';

export const articleUpvoteMilestone: TypedNotificationWorker<'post-upvoted'> = {
  subscription: 'api.article-upvote-milestone-notification',
  handler: async ({ postId, userId }, con) => {
    const postCtx = await buildPostContext(con, postId);
    if (!postCtx) {
      return;
    }
    const { post, source } = postCtx;
    const users = uniquePostOwners(post, [userId]);
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

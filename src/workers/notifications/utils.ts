import { NotificationHandlerReturn } from './worker';
import {
  Comment,
  NotificationPreferencePost,
  Post,
  PostType,
  SharePost,
  SourceMember,
  SourceType,
  UserActionType,
} from '../../entity';
import {
  NotificationCommenterContext,
  NotificationPostContext,
} from '../../notifications';
import {
  notificationPreferenceMap,
  NotificationPreferenceStatus,
  NotificationType,
} from '../../notifications/common';
import { DataSource, In, Not } from 'typeorm';
import { SourceMemberRoles } from '../../roles';
import { insertOrIgnoreAction } from '../../schema/actions';
import { ObjectLiteral } from 'typeorm/common/ObjectLiteral';

export const uniquePostOwners = (
  post: Pick<Post, 'scoutId' | 'authorId'>,
  ignoreIds: string[] = [],
): string[] =>
  [...new Set([post.scoutId, post.authorId])].filter(
    (userId) => userId && !ignoreIds.includes(userId),
  );

export const getSubscribedMembers = (
  con: DataSource,
  type: NotificationType,
  referenceId: string,
  where: ObjectLiteral,
) =>
  con
    .getRepository(SourceMember)
    .createQueryBuilder('sm')
    .select('"userId"')
    .where(where)
    .andWhere(
      `
              EXISTS(
                SELECT  np."userId"
                FROM    "notification_preference" np
                WHERE   np."userId" = "sm"."userId"
                AND     np."notificationType" = :type
                AND     np."referenceId" = :referenceId
                AND     np."type" = '${notificationPreferenceMap[type]}'
                AND     np."status" = '${NotificationPreferenceStatus.Muted}'
              ) IS FALSE
            `,
      { type, referenceId },
    )
    .getRawMany<SourceMember>();

export const buildPostContext = async (
  con: DataSource,
  postId: string,
): Promise<Omit<NotificationPostContext, 'userId'> | null> => {
  const post = await con
    .getRepository(Post)
    .findOne({ where: { id: postId }, relations: ['source'] });
  let sharedPost: Post;
  if (post) {
    if (post.type === PostType.Share) {
      sharedPost = await con
        .getRepository(Post)
        .findOneBy({ id: (post as SharePost).sharedPostId });
    }
    return {
      post,
      source: await post.source,
      sharedPost,
    };
  }
  return null;
};

export async function articleNewCommentHandler(
  con: DataSource,
  commentId: string,
): Promise<NotificationHandlerReturn> {
  const repo = con.getRepository(Comment);
  const comment = await repo.findOne({
    where: { id: commentId },
    relations: ['user'],
  });
  if (!comment) {
    return;
  }
  const postCtx = await buildPostContext(con, comment.postId);
  if (!postCtx) {
    return;
  }

  const { post, source } = postCtx;
  const excludedUsers = [comment.userId];
  const isReply = !!comment.parentId;

  if (source.type === SourceType.Squad) {
    await insertOrIgnoreAction(
      con,
      comment.userId,
      UserActionType.SquadFirstComment,
    );
  }

  if (isReply && (post.authorId || post.scoutId)) {
    const ids = [...new Set([post.authorId, post.scoutId])];
    const threadFollower = await repo
      .createQueryBuilder()
      .select('"userId"')
      .where(`(id = :id OR "parentId" = :id)`, { id: comment.parentId })
      .andWhere({ userId: In(ids) })
      .groupBy('"userId"')
      .getRawMany();

    if (threadFollower.length) {
      threadFollower.forEach(({ userId }) => excludedUsers.push(userId));
    }
  }

  const excluded = [...new Set(excludedUsers)];
  // Get unique user id which are not the author of the comment
  const users = uniquePostOwners(post, excluded);
  if (!users.length) {
    return;
  }

  const commenter = await comment.user;
  const ctx: Omit<NotificationCommenterContext, 'userId'> = {
    ...postCtx,
    commenter,
    comment,
  };
  const type =
    ctx.source.type === SourceType.Squad
      ? NotificationType.SquadNewComment
      : NotificationType.ArticleNewComment;

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
      type,
      ctx: { ...ctx, userId },
    }));
  }

  const muted = await con.getRepository(NotificationPreferencePost).findBy({
    userId: In(users),
    referenceId: post.id,
    status: NotificationPreferenceStatus.Muted,
  });

  return users
    .filter((id) => muted.every(({ userId }) => userId !== id))
    .map((userId) => ({ type, ctx: { ...ctx, userId } }));
}

export const UPVOTE_TITLES = {
  1: 'Congrats! You just <span class="text-theme-color-avocado">earned 1 upvote 🎉</span>',
  3: 'Wow! You <span class="text-theme-color-avocado">earned 3 upvotes ✨</span>',
  5: 'You rock! You <span class="text-theme-color-avocado">earned 5 upvotes 🎸</span>',
  10: 'Well done! You <span class="text-theme-color-avocado">earned 10 upvotes 🙌</span>',
  20: 'Brilliant! You <span class="text-theme-color-avocado">earned 20 upvotes 🥳</span>',
  50: 'Good job! You <span class="text-theme-color-avocado">earned 50 upvotes 🚴‍♀️</span>',
  100: 'Excellent! You <span class="text-theme-color-avocado">earned 100 upvotes ⚡️</span>',
  200: 'Way to go! You <span class="text-theme-color-avocado">earned 200 upvotes 🚀</span>',
  500: 'Clever! You <span class="text-theme-color-avocado">earned 500 upvotes 🦸‍</span>',
  1000: 'Superb! You <span class="text-theme-color-avocado">earned 1,000 upvotes 😱</span>',
  2000: 'Legendary! You <span class="text-theme-color-avocado">earned 2,000 upvotes 💥</span>',
  5000: 'Unbelievable! You <span class="text-theme-color-avocado">earned 5,000 upvotes 😳</span>',
  10000: `We're speechless! You <span class="text-theme-color-avocado">earned 10,000 upvotes 🙉</span>`,
};
export const UPVOTE_MILESTONES = Object.keys(UPVOTE_TITLES);

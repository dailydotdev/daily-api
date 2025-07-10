import { NotificationHandlerReturn } from './worker';
import {
  Comment,
  NotificationPreference,
  NotificationPreferencePost,
  Post,
  PostType,
  SharePost,
  Source,
  SourceMember,
  SourceType,
  User,
  UserActionType,
} from '../../entity';
import {
  NotificationCommenterContext,
  NotificationPostContext,
  NotificationPostModerationContext,
} from '../../notifications';
import {
  notificationPreferenceMap,
  NotificationPreferenceStatus,
  NotificationType,
} from '../../notifications/common';
import { DataSource, EntityManager, In, Not } from 'typeorm';
import { SourceMemberRoles } from '../../roles';
import { insertOrIgnoreAction } from '../../schema/actions';
import { ObjectLiteral } from 'typeorm/common/ObjectLiteral';
import { SourcePostModeration } from '../../entity/SourcePostModeration';
import { ChangeObject } from '../../types';

export const uniquePostOwners = (
  post: Pick<Post, 'scoutId' | 'authorId'>,
  ignoreIds: string[] = [],
): string[] =>
  [...new Set([post.scoutId, post.authorId])].filter(
    (userId) => userId && !ignoreIds.includes(userId),
  ) as string[];

type GetSubscribedMembersBase = {
  con: DataSource;
  type: NotificationType;
  referenceId: string;
  where: ObjectLiteral;
};

type GetSubscribedMembers = GetSubscribedMembersBase &
  (
    | {
        byStatus: NotificationPreferenceStatus;
        byNotStatus?: never;
      }
    | {
        byStatus?: never;
        byNotStatus: NotificationPreferenceStatus;
      }
    | {
        byStatus?: never;
        byNotStatus?: never;
      }
  );

/**
 * Get members based on their notification preferences for a specific notification type and reference ID.
 * This function allows filtering members who are 'subscribed' (opt-in) or
 * who are NOT 'muted' (opt-out) for the given notification criteria.
 *
 * @param {object} params - The parameters for filtering members.
 * @param {DataSource} params.con - The database connection (TypeORM DataSource instance).
 * @param {NotificationType} params.type - The type of notification (e.g., `NotificationType.ArticleNewComment`).
 * @param {string} params.referenceId - The reference ID associated with the notification (e.g., 'post123').
 * @param {ObjectLiteral} params.where - Additional conditions for filtering `SourceMember` (e.g., `{ sourceId: '...', role: Not(SourceMemberRoles.Blocked) }`).
 * @param {NotificationPreferenceStatus} [params.byStatus] - **Mutually Exclusive with `byNotStatus`**.
 *   Filter by a specific `NotificationPreferenceStatus`. Use this for 'opt-in' scenarios (e.g., `NotificationPreferenceStatus.Subscribed`).
 *   If provided, only members with a preference matching this status will be returned.
 * @param {NotificationPreferenceStatus} [params.byNotStatus] - **Mutually Exclusive with `byStatus`**.
 *   Filter by members who do NOT have a preference matching this status. Use this for 'opt-out' scenarios
 *   (e.g., `NotificationPreferenceStatus.Muted`). If provided, members who have *no preference*
 *   for the given type/referenceId, or whose preference is *not* this status, will be returned.
 * @returns {Promise<SourceMember[]>} A promise that resolves to an array of `SourceMember` objects.
 * @throws {Error} If the database query fails or if both `byStatus` and `byNotStatus` are provided simultaneously.
 * @example
 * // Get members subscribed to new comments on 'post123' in 'source123', excluding blocked roles
 * const subscribedMembers = await getSubscribedMembers({
 *   con: dataSource,
 *   type: NotificationType.ArticleNewComment,
 *   byStatus: NotificationPreferenceStatus.Subscribed,
 *   referenceId: 'post123',
 *   where: { sourceId: 'source123', role: Not('blocked') }, // Assuming Not() is imported or defined
 * });
 *
 * @example
 * // Get members who are NOT muted for new comments on 'post123' in 'source123', excluding blocked roles
 * const notMutedMembers = await getSubscribedMembers({
 *   con: dataSource,
 *   type: NotificationType.ArticleNewComment,
 *   byNotStatus: NotificationPreferenceStatus.Muted,
 *   referenceId: 'post123',
 *   where: { sourceId: 'source123', role: Not('blocked') },
 * });
 */
export const getSubscribedMembers = ({
  con,
  type,
  byStatus,
  byNotStatus,
  referenceId,
  where,
}: GetSubscribedMembers) => {
  const builder = con.getRepository(SourceMember).createQueryBuilder('sm');
  const memberQuery = builder.select('"userId"').where(where);
  const muteQuery = builder
    .subQuery()
    .select('np."userId"')
    .from(NotificationPreference, 'np')
    .where(`"np"."userId" = "${memberQuery.alias}"."userId"`)
    .andWhere({
      notificationType: type,
      referenceId,
      type: notificationPreferenceMap[type],
      status: byStatus || byNotStatus,
    });

  return memberQuery
    .andWhere(
      `EXISTS(${muteQuery.getQuery()}) IS ${!!byStatus ? 'TRUE' : 'FALSE'}`,
    )
    .getRawMany<SourceMember>();
};

export const buildPostContext = async (
  con: DataSource | EntityManager,
  postId: string,
): Promise<Omit<NotificationPostContext, 'userIds'> | null> => {
  const post = await con
    .getRepository(Post)
    .findOne({ where: { id: postId }, relations: ['source'] });
  let sharedPost: Post | null = null;
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
  if (comment.flags?.vordr) {
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
  const ctx: Omit<NotificationCommenterContext, 'userIds'> = {
    ...postCtx,
    commenter,
    comment,
  };
  const type =
    ctx.source.type === SourceType.Squad
      ? NotificationType.SquadNewComment
      : NotificationType.ArticleNewComment;

  if (source.type === SourceType.Squad) {
    const members = await getSubscribedMembers({
      con,
      type,
      referenceId: post.id,
      byNotStatus: NotificationPreferenceStatus.Muted,
      where: {
        userId: In(users),
        sourceId: source.id,
        role: Not(SourceMemberRoles.Blocked),
      },
    });

    if (!members.length) {
      return;
    }

    return [
      {
        type,
        ctx: { ...ctx, userIds: members.map(({ userId }) => userId) },
      },
    ];
  }

  const muted = await con.getRepository(NotificationPreferencePost).findBy({
    userId: In(users),
    referenceId: post.id,
    notificationType: type,
    type: notificationPreferenceMap[type],
    status: NotificationPreferenceStatus.Muted,
  });

  return [
    {
      type,
      ctx: {
        ...ctx,
        userIds: users.filter((id) =>
          muted.every(({ userId }) => userId !== id),
        ),
        initiatorId: post.authorId,
      },
    },
  ];
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

export const getPostModerationContext = async (
  con: DataSource | EntityManager,
  post: ChangeObject<SourcePostModeration>,
): Promise<Omit<NotificationPostModerationContext, 'userIds'>> => {
  const [user, source] = await Promise.all([
    con.getRepository(User).findOneOrFail({ where: { id: post.createdById } }),
    con.getRepository(Source).findOneOrFail({ where: { id: post.sourceId } }),
  ]);

  return { post, user, source };
};

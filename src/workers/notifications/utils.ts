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
  type UserNotificationFlags,
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
  type NotificationChannel,
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

type GetMembersParams = {
  con: DataSource;
  type: NotificationType;
  referenceId: string;
  where: ObjectLiteral;
};

export const getOptInSubscribedMembers = async ({
  con,
  type,
  referenceId,
  where,
}: GetMembersParams) => {
  const members = await con
    .getRepository(SourceMember)
    .createQueryBuilder('sm')
    .innerJoin(User, 'u', 'u.id = sm."userId"')
    .innerJoin(
      NotificationPreference,
      'np',
      'np."userId" = sm."userId" AND np."notificationType" = :type AND np."referenceId" = :referenceId AND np."type" = :preferenceType AND np."status" = :status',
      {
        type,
        referenceId,
        preferenceType: notificationPreferenceMap[type],
        status: NotificationPreferenceStatus.Subscribed,
      },
    )
    .select('sm."userId"', 'userId')
    .where(where)
    // Filter out users who have muted the notification type globally
    .andWhere(
      `COALESCE(u."notificationFlags"->:notificationType->>'inApp', 'subscribed') = 'subscribed'`,
      { notificationType: type },
    )
    .getRawMany<{ userId: string }>();

  return members;
};

export const getSubscribedMembers = async (
  con: DataSource,
  type: NotificationType,
  referenceId: string,
  where: ObjectLiteral,
) => {
  const members = await con
    .getRepository(SourceMember)
    .createQueryBuilder('sm')
    .innerJoin(User, 'u', 'u.id = sm."userId"')
    .leftJoin(
      NotificationPreference,
      'np',
      'np."userId" = sm."userId" AND np."notificationType" = :type AND np."referenceId" = :referenceId AND np."type" = :preferenceType AND np."status" = :muteStatus',
      {
        type,
        referenceId,
        preferenceType: notificationPreferenceMap[type],
        muteStatus: NotificationPreferenceStatus.Muted,
      },
    )
    .select('sm."userId"', 'userId')
    .where(where)
    .andWhere('np."userId" IS NULL')
    // Filter out users who have muted the notification type globally
    .andWhere(
      `COALESCE(u."notificationFlags"->:notificationType->>'inApp', 'subscribed') = 'subscribed'`,
      { notificationType: type },
    )
    .getRawMany<{ userId: string }>();

  return members;
};

export const buildPostContext = async (
  con: DataSource | EntityManager,
  postId: string,
): Promise<Omit<NotificationPostContext, 'userIds'> | null> => {
  if (!postId) {
    return null;
  }

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
      dedupKey: post.flags.dedupKey,
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

  if (source.type === SourceType.Squad) {
    await insertOrIgnoreAction(
      con,
      comment.userId,
      UserActionType.SquadFirstComment,
    );
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
    const members = await getSubscribedMembers(con, type, post.id, {
      userId: In(users),
      sourceId: source.id,
      role: Not(SourceMemberRoles.Blocked),
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

  const muted = await con
    .getRepository(User)
    .createQueryBuilder('u')
    .innerJoin(
      NotificationPreferencePost,
      'npp',
      'npp."userId" = u.id AND npp."referenceId" = :postId AND npp."notificationType" = :type AND npp."type" = :preferenceType AND npp."status" = :status',
      {
        postId: post.id,
        type,
        preferenceType: notificationPreferenceMap[type],
        status: NotificationPreferenceStatus.Muted,
      },
    )
    .select('u.id', 'userId')
    .where({ id: In(users) })
    .andWhere(
      `COALESCE(u."notificationFlags"->:notificationType->>'inApp', 'subscribed') = 'subscribed'`,
      { notificationType: type },
    )
    .getRawMany<{ userId: string }>();

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

export const isSubscribedToEmails = (flags: UserNotificationFlags): boolean => {
  return Object.values(flags).some(
    (notif) => notif?.email === NotificationPreferenceStatus.Subscribed,
  );
};

export const isSubscribedToNotificationType = (
  flags: UserNotificationFlags,
  type: NotificationType,
  channel: NotificationChannel,
): boolean => {
  return flags[type]?.[channel] === NotificationPreferenceStatus.Subscribed;
};

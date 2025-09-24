import { TypedNotificationWorker } from '../worker';
import {
  NotificationPreferenceSource,
  PostFlags,
  PostMention,
  PostType,
  SourceMember,
  SourceType,
  User,
  UserAction,
  UserActionType,
} from '../../entity';
import {
  NotificationDoneByContext,
  NotificationPostContext,
  NotificationSourceContext,
} from '../../notifications';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../../notifications/common';
import { NotificationHandlerReturn } from './worker';
import { buildPostContext, getOptInSubscribedMembers } from './utils';
import { SourceMemberRoles } from '../../roles';
import { insertOrIgnoreAction } from '../../schema/actions';
import { In, Not } from 'typeorm';

const blockedTypes = Object.freeze([PostType.Welcome, PostType.Brief]);

export const postAdded: TypedNotificationWorker<'api.v1.post-visible'> = {
  subscription: 'api.post-added-notification-v2',
  handler: async ({ post: inputPost }, con) => {
    const baseCtx = await buildPostContext(con, inputPost.id);
    if (!baseCtx) {
      return;
    }
    const { post, source } = baseCtx;

    if (blockedTypes.includes(post.type)) {
      return;
    }

    if ((post.flags as PostFlags)?.vordr) {
      return;
    }

    if (
      source?.type === SourceType.Machine &&
      (post.flags as PostFlags)?.showOnFeed === false
    ) {
      return;
    }

    const notifs: NotificationHandlerReturn = [];
    // community_picks_succeeded notification
    if (post.scoutId) {
      const ctx: NotificationPostContext = {
        ...baseCtx,
        userIds: [post.scoutId],
      };
      notifs.push({ type: NotificationType.CommunityPicksSucceeded, ctx });
    }

    if (source) {
      // article_picked notification
      if (source.type === SourceType.Machine) {
        if (post.authorId && !post.private) {
          const ctx: NotificationPostContext = {
            ...baseCtx,
            userIds: [post.authorId],
          };
          notifs.push({ type: NotificationType.ArticlePicked, ctx });
        }
      }
      if (source.type === SourceType.Squad && post.authorId) {
        const [doneBy, mentions, blockedMembers] = await Promise.all([
          con.getRepository(User).findOneBy({ id: post.authorId }),
          con.getRepository(PostMention).find({
            select: { mentionedUserId: true },
            where: { postId: post.id },
          }),
          con.getRepository(SourceMember).find({
            select: { userId: true },
            where: {
              sourceId: source.id,
              role: SourceMemberRoles.Blocked,
            },
          }),
        ]);

        const members = await getOptInSubscribedMembers({
          con,
          type: NotificationType.SquadPostAdded,
          referenceId: source.id,
          where: {
            sourceId: source.id,
            userId: Not(
              In([
                post.authorId,
                ...mentions.flatMap(({ mentionedUserId }) => mentionedUserId),
                ...blockedMembers.flatMap(({ userId }) => userId),
              ]),
            ),
          },
        });

        if (members.length) {
          notifs.push({
            type: NotificationType.SquadPostAdded,
            ctx: {
              ...baseCtx,
              doneBy,
              initiatorId: post.authorId,
              userIds: members.map(({ userId }) => userId),
            } as NotificationPostContext & Partial<NotificationDoneByContext>,
          });
        }

        const hasPostShared = await con.getRepository(UserAction).findOneBy({
          userId: post.authorId,
          type: UserActionType.SquadFirstPost,
        });
        if (!hasPostShared) {
          await insertOrIgnoreAction(
            con,
            post.authorId,
            UserActionType.SquadFirstPost,
          );
          const subscribed = await con.getRepository(UserAction).findOneBy({
            userId: post.authorId,
            type: UserActionType.EnableNotification,
          });

          if (!subscribed) {
            notifs.push({
              type: NotificationType.SquadSubscribeToNotification,
              ctx: { ...baseCtx, userIds: [post.authorId] },
            });
          }
        }
      }

      if (source.type === SourceType.Machine) {
        const members = await con
          .getRepository(NotificationPreferenceSource)
          .findBy({
            notificationType: NotificationType.SourcePostAdded,
            referenceId: source.id,
            status: NotificationPreferenceStatus.Subscribed,
          });

        if (members.length) {
          notifs.push({
            type: NotificationType.SourcePostAdded,
            ctx: {
              ...baseCtx,
              userIds: members.map(({ userId }) => userId),
            } as NotificationSourceContext & NotificationPostContext,
          });
        }
      }
    }
    return notifs;
  },
};

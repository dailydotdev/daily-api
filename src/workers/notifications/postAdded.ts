import { messageToJson } from '../worker';
import {
  Post,
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
  NotificationType,
} from '../../notifications';
import { NotificationHandlerReturn, NotificationWorker } from './worker';
import { ChangeObject } from '../../types';
import { buildPostContext } from './utils';
import { In, Not } from 'typeorm';
import { SourceMemberRoles } from '../../roles';
import { insertOrIgnoreAction } from '../../schema/actions';

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

    if (post.type === PostType.Welcome) {
      return;
    }

    const notifs: NotificationHandlerReturn = [];
    // community_picks_succeeded notification
    if (post.scoutId) {
      const ctx: NotificationPostContext = {
        ...baseCtx,
        userId: post.scoutId,
      };
      notifs.push({ type: NotificationType.CommunityPicksSucceeded, ctx });
    }

    if (source) {
      // article_picked notification
      if (source.type === SourceType.Machine) {
        if (post.authorId && !post.private) {
          const ctx: NotificationPostContext = {
            ...baseCtx,
            userId: post.authorId,
          };
          notifs.push({ type: NotificationType.ArticlePicked, ctx });
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
            type: NotificationType.SquadPostAdded,
            ctx: {
              ...baseCtx,
              doneBy,
              userId: member.userId,
            } as NotificationPostContext & Partial<NotificationDoneByContext>,
          }),
        );

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
              ctx: { ...baseCtx, userId: post.authorId },
            });
          }
        }
      }
    }
    return notifs;
  },
};

export default worker;

import { In, Not } from 'typeorm';
import { messageToJson } from '../worker';
import {
  Post,
  PostRelation,
  PostRelationType,
  PostType,
  Source,
} from '../../entity';
import { ChangeObject } from '../../types';
import { NotificationHandlerReturn, NotificationWorker } from './worker';
import { buildPostContext, getSubscribedMembers } from './utils';
import { NotificationCollectionContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { SourceMemberRoles } from '../../roles';

interface Data {
  post: ChangeObject<Post>;
}

export const collectionUpdated: NotificationWorker = {
  subscription: 'api.post-collection-updated-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);

    const baseCtx = await buildPostContext(con, data.post.id);
    if (!baseCtx) {
      return;
    }
    const { post, source } = baseCtx;

    if (post.type !== PostType.Collection) {
      return;
    }

    const notifs: NotificationHandlerReturn = [];

    const distinctSources = await con
      .createQueryBuilder()
      .select(
        's."name" as name, s."image" as image, count(s."id"), count(s."id") OVER() AS total',
      )
      .from(PostRelation, 'pr')
      .leftJoin(Post, 'p', 'p.id = pr."relatedPostId"')
      .leftJoin(Source, 's', 's.id = p."sourceId"')
      .where('pr."postId" = :postId', { postId: post.id })
      .andWhere('pr."type" = :type', { type: PostRelationType.Collection })
      .groupBy('s.id, pr."createdAt"')
      .orderBy('pr."createdAt"', 'DESC')
      .limit(3)
      .getRawMany<Source & { total: number }>();

    const numTotalAvatars = distinctSources[0].total;

    const members = await getSubscribedMembers(
      con,
      NotificationType.CollectionUpdated,
      source.id,
      {
        sourceId: source.id,
        userId: Not(In([post.authorId])),
        role: Not(SourceMemberRoles.Blocked),
      },
    );

    members.forEach(({ userId }) =>
      notifs.push({
        type: NotificationType.CollectionUpdated,
        ctx: {
          ...baseCtx,
          userId,
          distinctSources,
          total: numTotalAvatars,
        } as NotificationCollectionContext,
      }),
    );
    return notifs;
  },
};

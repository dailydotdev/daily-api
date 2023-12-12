import { messageToJson } from '../worker';
import {
  NotificationPreferencePost,
  Post,
  PostRelationType,
  PostType,
  Source,
  getDistinctSourcesBaseQuery,
} from '../../entity';
import { ChangeObject } from '../../types';
import { NotificationWorker } from './worker';
import { buildPostContext } from './utils';
import { NotificationCollectionContext } from '../../notifications';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../../notifications/common';

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
    const { post } = baseCtx;

    if (post.type !== PostType.Collection) {
      return;
    }

    const distinctSources = await getDistinctSourcesBaseQuery({
      con,
      postId: post.id,
      relationType: PostRelationType.Collection,
    })
      .select(
        's.id as id, s."name" as name, s."image" as image, count(s."id") OVER() AS total',
      )
      .limit(3)
      .getRawMany<Source & { total: number }>();

    const numTotalAvatars = distinctSources[0].total;

    const members = await con.getRepository(NotificationPreferencePost).findBy({
      notificationType: NotificationType.CollectionUpdated,
      referenceId: post.id,
      status: NotificationPreferenceStatus.Subscribed,
    });

    return [
      {
        type: NotificationType.CollectionUpdated,
        ctx: {
          ...baseCtx,
          distinctSources,
          total: numTotalAvatars,
          userIds: members.map(({ userId }) => userId),
        } as NotificationCollectionContext,
      },
    ];
  },
};

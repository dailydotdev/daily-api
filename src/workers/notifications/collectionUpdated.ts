import { messageToJson } from '../worker';
import {
  NotificationPreferencePost,
  Post,
  PostRelationType,
  PostType,
  Source,
  getAllSourcesBaseQuery,
} from '../../entity';
import { ChangeObject } from '../../types';
import { NotificationWorker } from './worker';
import { buildPostContext } from './utils';
import { NotificationCollectionContext } from '../../notifications';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../../notifications/common';
import { queryReadReplica } from '../../common/queryReadReplica';

interface Data {
  post: ChangeObject<Post>;
}

export const collectionUpdated: NotificationWorker = {
  subscription: 'api.post-collection-updated-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);

    const baseCtx = await queryReadReplica(con, ({ queryRunner }) => {
      return buildPostContext(queryRunner.manager, data.post.id);
    });

    if (!baseCtx) {
      return;
    }

    const { post } = baseCtx;

    if (post.type !== PostType.Collection) {
      return;
    }

    const [sources, members] = await queryReadReplica(
      con,
      ({ queryRunner }) => {
        return Promise.all([
          getAllSourcesBaseQuery({
            con: queryRunner.manager,
            postId: post.id,
            relationType: PostRelationType.Collection,
          })
            .select(
              's.id as id, s."name" as name, s."image" as image, count(s."id") OVER() AS total, s."handle" as handle',
            )
            .limit(3)
            .getRawMany<Source & { total: number }>(),
          queryRunner.manager.getRepository(NotificationPreferencePost).findBy({
            notificationType: NotificationType.CollectionUpdated,
            referenceId: post.id,
            status: NotificationPreferenceStatus.Subscribed,
          }),
        ]);
      },
    );

    const numTotalAvatars = sources[0]?.total || 0;

    return [
      {
        type: NotificationType.CollectionUpdated,
        ctx: {
          ...baseCtx,
          sources,
          total: numTotalAvatars,
          userIds: members.map(({ userId }) => userId),
        } as NotificationCollectionContext,
      },
    ];
  },
};

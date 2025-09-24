import { TypedNotificationWorker } from '../worker';
import { Source } from '../../entity';
import { NotificationSourceRequestContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { NotificationReason } from '../../common';
import { queryReadReplica } from '../../common/queryReadReplica';

export const sourceRequest: TypedNotificationWorker<'pub-request'> = {
  subscription: 'api.source-request-notification',
  handler: async ({ reason, sourceRequest }, con) => {
    const ctx: NotificationSourceRequestContext = {
      userIds: [sourceRequest.userId],
      sourceRequest,
    };
    switch (reason) {
      case NotificationReason.Publish: {
        const source = await queryReadReplica(con, ({ queryRunner }) => {
          return queryRunner.manager
            .getRepository(Source)
            .findOneBy({ id: sourceRequest.sourceId });
        });
        return [
          { type: NotificationType.SourceApproved, ctx: { ...ctx, source } },
        ];
      }
      case NotificationReason.Decline:
      case NotificationReason.Exists: {
        return [{ type: NotificationType.SourceRejected, ctx }];
      }
      default:
        return;
    }
  },
};

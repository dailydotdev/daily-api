import { messageToJson } from '../worker';
import { Source, SourceRequest } from '../../entity';
import { NotificationSourceRequestContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { NotificationWorker } from './worker';
import { NotificationReason } from '../../common';
import { ChangeObject } from '../../types';

type Data = {
  reason: NotificationReason;
  sourceRequest: ChangeObject<SourceRequest>;
};

const worker: NotificationWorker = {
  subscription: 'api.source-request-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const ctx: NotificationSourceRequestContext = {
      userIds: [data.sourceRequest.userId],
      sourceRequest: data.sourceRequest,
    };
    switch (data.reason) {
      case NotificationReason.Publish: {
        const source = await con
          .getRepository(Source)
          .findOneBy({ id: data.sourceRequest.sourceId });
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

export default worker;

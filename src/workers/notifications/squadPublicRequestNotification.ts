import { TypedNotificationWorker } from '../worker';
import {
  NotificationSourceContext,
  NotificationSquadRequestContext,
} from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { Source, SquadPublicRequestStatus } from '../../entity';
import { queryReadReplica } from '../../common/queryReadReplica';

const statusToTypeMap: Record<SquadPublicRequestStatus, NotificationType> = {
  [SquadPublicRequestStatus.Approved]: NotificationType.SquadPublicApproved,
  [SquadPublicRequestStatus.Rejected]: NotificationType.SquadPublicRejected,
  [SquadPublicRequestStatus.Pending]: NotificationType.SquadPublicSubmitted,
};

export const squadPublicRequestNotification: TypedNotificationWorker<'api.v1.squad-public-request'> =
  {
    subscription: 'api.v1.squad-public-request-notification',
    handler: async ({ request }, con, logger) => {
      const { requestorId, status, sourceId } = request;
      const logDetails = {
        requestorId,
        status,
        sourceId,
      };
      const source = await queryReadReplica(con, ({ queryRunner }) => {
        return queryRunner.manager
          .getRepository(Source)
          .findOneBy({ id: sourceId });
      });

      if (!source) {
        logger.info(logDetails, 'source does not exist');

        return [];
      }

      const ctx: NotificationSquadRequestContext & NotificationSourceContext = {
        squadRequest: request,
        userIds: [requestorId],
        source,
      };
      const type = statusToTypeMap[status];

      if (!type) {
        return [];
      }

      return [{ type, ctx }];
    },
  };

import { messageToJson } from '../worker';
import {
  NotificationSourceContext,
  NotificationSquadRequestContext,
} from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { NotificationWorker } from './worker';
import { ChangeObject } from '../../types';
import {
  Source,
  SquadPublicRequest,
  SquadPublicRequestStatus,
} from '../../entity';

interface Data {
  request: ChangeObject<SquadPublicRequest>;
}

const statusToTypeMap: Record<SquadPublicRequestStatus, NotificationType> = {
  [SquadPublicRequestStatus.Approved]: NotificationType.SquadPublicApproved,
  [SquadPublicRequestStatus.Rejected]: NotificationType.SquadPublicRejected,
  [SquadPublicRequestStatus.Pending]: NotificationType.SquadPublicSubmitted,
};

const worker: NotificationWorker = {
  subscription: 'api.v1.squad-public-request-notification',
  handler: async (message, con, logger) => {
    const data: Data = messageToJson(message);
    const { requestorId, status, sourceId } = data.request;
    const logDetails = {
      requestorId,
      status,
      sourceId,
      messageId: message.messageId,
    };
    const source = await con.getRepository(Source).findOneBy({ id: sourceId });

    if (!source) {
      logger.info(logDetails, 'source does not exist');

      return [];
    }

    const ctx: NotificationSquadRequestContext & NotificationSourceContext = {
      squadRequest: data.request,
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

export default worker;

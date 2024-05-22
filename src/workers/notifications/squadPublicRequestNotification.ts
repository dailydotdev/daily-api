import { messageToJson } from '../worker';
import { NotificationBaseContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { NotificationWorker } from './worker';
import { ChangeObject } from '../../types';
import { SquadPublicRequest, SquadPublicRequestStatus } from '../../entity';

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
  handler: async (message) => {
    const data: Data = messageToJson(message);
    const { requestorId, status } = data.request;
    const ctx: NotificationBaseContext = { userIds: [requestorId] };
    const type = statusToTypeMap[status];

    if (!type) {
      return [];
    }

    return [{ type, ctx }];
  },
};

export default worker;

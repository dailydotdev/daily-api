import { LiveRoom } from '../../entity/LiveRoom';
import type { NotificationLiveRoomContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { TypedNotificationWorker } from '../worker';
import { loadLiveRoomSubscriberIds } from '../liveRoomNotifications';
import { LiveRoomStatus } from '../../common/schema/liveRooms';
import { User } from '../../entity/user/User';

export const liveRoomStartingSoonNotification: TypedNotificationWorker<'api.v1.delayed-notification-reminder'> =
  {
    subscription: 'api.live-room-starting-soon-notification',
    handler: async (data, con) => {
      if (
        data.entityTableName !== con.getRepository(LiveRoom).metadata.tableName
      ) {
        return;
      }

      const room = await con.getRepository(LiveRoom).findOneBy({
        id: data.entityId,
      });

      if (
        !room ||
        room.status !== LiveRoomStatus.Created ||
        !room.scheduledStart
      ) {
        return;
      }

      const { subscriberIds } = await loadLiveRoomSubscriberIds({
        manager: con.manager,
        roomId: room.id,
      });

      if (!subscriberIds.length) {
        return;
      }

      const host = await con.getRepository(User).findOneByOrFail({
        id: room.hostId,
      });
      const notificationContext: NotificationLiveRoomContext = {
        host,
        room,
        userIds: subscriberIds,
      };

      return [
        {
          type: NotificationType.LiveRoomStartingSoon,
          ctx: notificationContext,
        },
      ];
    },
  };

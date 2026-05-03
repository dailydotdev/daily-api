import { LiveRoom } from '../entity/LiveRoom';
import { LiveRoomSubscription } from '../entity/LiveRoomSubscription';
import {
  LiveRoomStatus,
  liveRoomLifecycleEventSchema,
} from '../common/schema/liveRooms';
import { getFlytingClient } from '../integrations/flyting/client';
import { generateAndStoreNotificationsV2 } from '../notifications';
import { NotificationType } from '../notifications/common';
import type { NotificationLiveRoomContext } from '../notifications/types';
import { TypedWorker } from './worker';

export const liveRoomStartedWorker: TypedWorker<'flyting.v1.room-started'> = {
  subscription: 'api.live-room-started',
  handler: async ({ data }, con, logger) => {
    const input = liveRoomLifecycleEventSchema.parse(data);
    const roomRepo = con.getRepository(LiveRoom);
    const room = await roomRepo.findOneBy({ id: input.roomId });

    if (!room) {
      logger.warn(
        { roomId: input.roomId },
        'Live room not found for lifecycle event',
      );
      return;
    }

    if (room.status === LiveRoomStatus.Ended) {
      return;
    }

    const subscriptions = await con.getRepository(LiveRoomSubscription).findBy({
      roomId: room.id,
    });
    const connectedUserIds = new Set<string>();
    if (subscriptions.length) {
      try {
        const connected = await getFlytingClient().getConnectedUsers({
          roomId: room.id,
        });

        for (const userId of connected.userIds) {
          connectedUserIds.add(userId);
        }
      } catch (err) {
        logger.warn(
          { err, roomId: room.id },
          'Failed to fetch connected live room users; notifying all subscribers',
        );
      }
    }
    const disconnectedSubscriberIds = subscriptions
      .map(({ userId }) => userId)
      .filter((userId) => !connectedUserIds.has(userId));

    await con.transaction(async (manager) => {
      await manager.getRepository(LiveRoom).update(
        { id: input.roomId },
        {
          status: LiveRoomStatus.Live,
          startedAt: room.startedAt ?? new Date(input.occurredAt),
        },
      );

      if (disconnectedSubscriberIds.length) {
        const notificationContext: NotificationLiveRoomContext = {
          userIds: disconnectedSubscriberIds,
          room,
        };

        await generateAndStoreNotificationsV2(manager, [
          {
            type: NotificationType.LiveRoomStarted,
            ctx: notificationContext,
          },
        ]);
      }

      if (subscriptions.length) {
        await manager.getRepository(LiveRoomSubscription).delete({
          roomId: room.id,
        });
      }
    });
  },
};

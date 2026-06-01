import { LiveRoom } from '../entity/LiveRoom';
import { LiveRoomSubscription } from '../entity/LiveRoomSubscription';
import {
  LiveRoomStatus,
  liveRoomLifecycleEventSchema,
} from '../common/schema/liveRooms';
import { NotificationType } from '../notifications/common';
import { TypedWorker } from './worker';
import type { DataSource } from 'typeorm';
import {
  loadLiveRoomSubscriberIds,
  notifyLiveRoomSubscribers,
} from './liveRoomNotifications';

const markLiveRoomStarted = async ({
  con,
  occurredAt,
  room,
}: {
  con: DataSource;
  occurredAt: string;
  room: LiveRoom;
}): Promise<void> => {
  await con.getRepository(LiveRoom).update(
    { id: room.id },
    {
      status: LiveRoomStatus.Live,
      startedAt: room.startedAt ?? new Date(occurredAt),
    },
  );
};

const notifyLiveRoomStartedSubscribers = async ({
  con,
  room,
}: {
  con: DataSource;
  room: LiveRoom;
}): Promise<void> => {
  const { subscriberIds, subscriptionCount } = await loadLiveRoomSubscriberIds({
    manager: con.manager,
    roomId: room.id,
  });

  await con.transaction(async (manager) => {
    await notifyLiveRoomSubscribers({
      manager,
      room,
      type: NotificationType.LiveRoomStarted,
      userIds: subscriberIds,
    });

    if (subscriptionCount) {
      await manager.getRepository(LiveRoomSubscription).delete({
        roomId: room.id,
      });
    }
  });
};

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

    await markLiveRoomStarted({
      con,
      occurredAt: input.occurredAt,
      room,
    });

    await notifyLiveRoomStartedSubscribers({ con, room });
  },
};

import { LiveRoom } from '../entity/LiveRoom';
import { LiveRoomSubscription } from '../entity/LiveRoomSubscription';
import { User } from '../entity/user/User';
import {
  LiveRoomStatus,
  liveRoomLifecycleEventSchema,
} from '../common/schema/liveRooms';
import { generateAndStoreNotificationsV2 } from '../notifications';
import { NotificationType } from '../notifications/common';
import type { NotificationLiveRoomContext } from '../notifications/types';
import { TypedWorker } from './worker';
import type { DataSource, EntityManager } from 'typeorm';

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

const loadSubscriberIds = async ({
  con,
  roomId,
}: {
  con: DataSource;
  roomId: string;
}): Promise<{ subscriberIds: string[]; subscriptionCount: number }> => {
  const subscriptions = await con.getRepository(LiveRoomSubscription).findBy({
    roomId,
  });

  return {
    subscriberIds: subscriptions.map(({ userId }) => userId),
    subscriptionCount: subscriptions.length,
  };
};

const notifySubscribers = async ({
  manager,
  room,
  userIds,
}: {
  manager: EntityManager;
  room: LiveRoom;
  userIds: string[];
}): Promise<void> => {
  if (!userIds.length) {
    return;
  }

  const host = await manager.getRepository(User).findOneByOrFail({
    id: room.hostId,
  });
  const notificationContext: NotificationLiveRoomContext = {
    host,
    userIds,
    room,
  };

  await generateAndStoreNotificationsV2(manager, [
    {
      type: NotificationType.LiveRoomStarted,
      ctx: notificationContext,
    },
  ]);
};

const notifyLiveRoomStartedSubscribers = async ({
  con,
  room,
}: {
  con: DataSource;
  room: LiveRoom;
}): Promise<void> => {
  const { subscriberIds, subscriptionCount } = await loadSubscriberIds({
    con,
    roomId: room.id,
  });

  await con.transaction(async (manager) => {
    await notifySubscribers({
      manager,
      room,
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

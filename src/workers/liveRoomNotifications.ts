import type { EntityManager } from 'typeorm';
import { LiveRoom } from '../entity/LiveRoom';
import { LiveRoomSubscription } from '../entity/LiveRoomSubscription';
import { User } from '../entity/user/User';
import { generateAndStoreNotificationsV2 } from '../notifications';
import { NotificationType } from '../notifications/common';
import type {
  NotificationLiveRoomContext,
  Reference,
} from '../notifications/types';

export const loadLiveRoomSubscriberIds = async ({
  manager,
  roomId,
}: {
  manager: EntityManager;
  roomId: string;
}): Promise<{ subscriberIds: string[]; subscriptionCount: number }> => {
  const subscriptions = await manager
    .getRepository(LiveRoomSubscription)
    .findBy({ roomId });

  return {
    subscriberIds: subscriptions.map(({ userId }) => userId),
    subscriptionCount: subscriptions.length,
  };
};

export const notifyLiveRoomSubscribers = async ({
  manager,
  room,
  type,
  userIds,
}: {
  manager: EntityManager;
  room: Reference<LiveRoom>;
  type:
    | NotificationType.LiveRoomStarted
    | NotificationType.LiveRoomStartingSoon;
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
      type,
      ctx: notificationContext,
    },
  ]);
};

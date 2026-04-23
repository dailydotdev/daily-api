import { LiveRoom } from '../entity/LiveRoom';
import {
  LiveRoomStatus,
  liveRoomLifecycleEventSchema,
} from '../common/schema/liveRooms';
import { TypedWorker } from './worker';

export const liveRoomStartedWorker: TypedWorker<'api.v1.live-room-started'> = {
  subscription: 'api.live-room-started',
  handler: async ({ data }, con, logger) => {
    const input = liveRoomLifecycleEventSchema.parse(data);

    await con.transaction(async (manager) => {
      const roomRepo = manager.getRepository(LiveRoom);
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

      await roomRepo.update(
        { id: input.roomId },
        {
          status: LiveRoomStatus.Live,
          startedAt: room.startedAt ?? new Date(input.occurredAt),
        },
      );
    });
  },
};

import { LiveRoom } from '../entity/LiveRoom';
import {
  LiveRoomStatus,
  liveRoomLifecycleEventSchema,
} from '../common/schema/liveRooms';
import { TypedWorker } from './worker';

export const liveRoomEndedWorker: TypedWorker<'flyting.v1.room-ended'> = {
  subscription: 'api.live-room-ended',
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
          status: LiveRoomStatus.Ended,
          endedAt: room.endedAt ?? new Date(input.occurredAt),
        },
      );
    });
  },
};

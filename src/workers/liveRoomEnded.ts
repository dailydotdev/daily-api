import { TypeOrmError } from '../errors';
import { LiveRoom } from '../entity/LiveRoom';
import { LiveRoomLifecycleEvent } from '../entity/LiveRoomLifecycleEvent';
import {
  LiveRoomLifecycleEventType,
  LiveRoomStatus,
} from '../common/schema/liveRooms';
import { TypedWorker } from './worker';
import type { TypeORMQueryFailedError } from '../errors';

export const liveRoomEndedWorker: TypedWorker<'api.v1.live-room-ended'> = {
  subscription: 'api.live-room-ended',
  handler: async ({ data }, con, logger) => {
    await con.transaction(async (manager) => {
      try {
        await manager.getRepository(LiveRoomLifecycleEvent).insert({
          eventId: data.eventId,
          roomId: data.roomId,
          type: data.type as LiveRoomLifecycleEventType,
          occurredAt: new Date(data.occurredAt),
        });
      } catch (error) {
        const queryError = error as TypeORMQueryFailedError;
        if (queryError.code === TypeOrmError.DUPLICATE_ENTRY) {
          return;
        }

        throw error;
      }

      const roomRepo = manager.getRepository(LiveRoom);
      const room = await roomRepo.findOneBy({ id: data.roomId });

      if (!room) {
        logger.warn(
          { roomId: data.roomId },
          'Live room not found for lifecycle event',
        );
        return;
      }

      if (room.status === LiveRoomStatus.Ended) {
        return;
      }

      await roomRepo.update(
        { id: data.roomId },
        {
          status: LiveRoomStatus.Ended,
          endedAt: room.endedAt ?? new Date(data.occurredAt),
        },
      );
    });
  },
};

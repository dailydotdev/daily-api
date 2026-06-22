import { z } from 'zod';
import type { Context } from '../../Context';
import { StorageKey, StorageTopic, generateStorageKey } from '../../config';
import { getFlytingClient } from '../../integrations/flyting/client';
import { ioRedisPool } from '../../redis';
import { liveRoomActivityStatusSchema } from '../schema/liveRooms';

const LIVE_ROOM_RUNTIME_STATE_CACHE_TTL_SECONDS = 30;

const liveRoomRuntimeStateSchema = z.object({
  activityStatus: liveRoomActivityStatusSchema.nullable(),
  participantCount: z.number().nullable().catch(null),
});

export type LiveRoomRuntimeState = z.infer<typeof liveRoomRuntimeStateSchema>;

const cachedLiveRoomRuntimeStateSchema = z.union([
  liveRoomRuntimeStateSchema,
  z.number().transform(
    (participantCount): LiveRoomRuntimeState => ({
      activityStatus: null,
      participantCount,
    }),
  ),
]);

const getParticipantCountCacheKey = (roomId: string): string =>
  generateStorageKey(
    StorageTopic.LiveRoom,
    StorageKey.ParticipantCount,
    roomId,
  );

const parseCachedRuntimeState = (
  value: string | null,
): LiveRoomRuntimeState | null => {
  if (value === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    const result = cachedLiveRoomRuntimeStateSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

export const getLiveRoomRuntimeStates = async ({
  ctx,
  roomIds,
}: {
  ctx: Context;
  roomIds: string[];
}): Promise<Map<string, LiveRoomRuntimeState>> => {
  if (roomIds.length === 0) {
    return new Map();
  }

  const cacheKeys = roomIds.map(getParticipantCountCacheKey);
  const cachedValues = await ioRedisPool.execute((client) =>
    client.mget(cacheKeys),
  );
  const statesByRoomId = new Map<string, LiveRoomRuntimeState>();
  const missingRoomIds: string[] = [];

  roomIds.forEach((roomId, index) => {
    const cachedState = parseCachedRuntimeState(cachedValues[index]);

    if (cachedState === null) {
      missingRoomIds.push(roomId);
      return;
    }

    statesByRoomId.set(roomId, cachedState);
  });

  if (missingRoomIds.length === 0) {
    return statesByRoomId;
  }

  try {
    const response = await getFlytingClient().getParticipantCounts({
      roomIds: missingRoomIds,
    });
    const fetchedStatesByRoomId = new Map(
      response.rooms.map(({ activityStatus, roomId, participantCount }) => [
        roomId,
        {
          activityStatus: activityStatus ?? null,
          participantCount,
        },
      ]),
    );

    await ioRedisPool.execute(async (client) => {
      const multi = client.multi();

      for (const roomId of missingRoomIds) {
        const state = fetchedStatesByRoomId.get(roomId) ?? {
          activityStatus: null,
          participantCount: null,
        };
        statesByRoomId.set(roomId, state);

        if (
          typeof state.participantCount === 'number' ||
          state.activityStatus !== null
        ) {
          multi.set(
            getParticipantCountCacheKey(roomId),
            JSON.stringify(state),
            'EX',
            LIVE_ROOM_RUNTIME_STATE_CACHE_TTL_SECONDS,
          );
        }
      }

      await multi.exec();
    });
  } catch (error) {
    ctx.log.warn(
      { err: error, roomIds: missingRoomIds },
      'Unable to load live room participant counts from flyting',
    );

    for (const roomId of missingRoomIds) {
      statesByRoomId.set(roomId, {
        activityStatus: null,
        participantCount: null,
      });
    }
  }

  return statesByRoomId;
};

export const getLiveRoomParticipantCounts = async (
  input: Parameters<typeof getLiveRoomRuntimeStates>[0],
): Promise<Map<string, number | null>> => {
  const statesByRoomId = await getLiveRoomRuntimeStates(input);
  return new Map(
    [...statesByRoomId.entries()].map(([roomId, state]) => [
      roomId,
      state.participantCount,
    ]),
  );
};

export const liveRoomParticipantCountCacheKey = getParticipantCountCacheKey;

import type { Context } from '../../Context';
import { StorageKey, StorageTopic, generateStorageKey } from '../../config';
import { getFlytingClient } from '../../integrations/flyting/client';
import { ioRedisPool } from '../../redis';
import { ONE_MINUTE_IN_SECONDS } from '../constants';

const LIVE_ROOM_PARTICIPANT_COUNT_CACHE_TTL_SECONDS = 2 * ONE_MINUTE_IN_SECONDS;

const getParticipantCountCacheKey = (roomId: string): string =>
  generateStorageKey(
    StorageTopic.LiveRoom,
    StorageKey.ParticipantCount,
    roomId,
  );

const parseCachedParticipantCount = (value: string | null): number | null => {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const getLiveRoomParticipantCounts = async ({
  ctx,
  roomIds,
}: {
  ctx: Context;
  roomIds: string[];
}): Promise<Map<string, number | null>> => {
  if (roomIds.length === 0) {
    return new Map();
  }

  const cacheKeys = roomIds.map(getParticipantCountCacheKey);
  const cachedValues = await ioRedisPool.execute((client) =>
    client.mget(cacheKeys),
  );
  const countsByRoomId = new Map<string, number | null>();
  const missingRoomIds: string[] = [];

  roomIds.forEach((roomId, index) => {
    const cachedCount = parseCachedParticipantCount(cachedValues[index]);

    if (cachedCount === null && cachedValues[index] === null) {
      missingRoomIds.push(roomId);
      return;
    }

    countsByRoomId.set(roomId, cachedCount);
  });

  if (missingRoomIds.length === 0) {
    return countsByRoomId;
  }

  try {
    const response = await getFlytingClient().getParticipantCounts({
      roomIds: missingRoomIds,
    });
    const fetchedCountsByRoomId = new Map(
      response.rooms.map(({ roomId, participantCount }) => [
        roomId,
        participantCount,
      ]),
    );

    await ioRedisPool.execute(async (client) => {
      const multi = client.multi();

      for (const roomId of missingRoomIds) {
        const participantCount = fetchedCountsByRoomId.get(roomId) ?? null;
        countsByRoomId.set(roomId, participantCount);

        if (typeof participantCount === 'number') {
          multi.set(
            getParticipantCountCacheKey(roomId),
            participantCount.toString(),
            'EX',
            LIVE_ROOM_PARTICIPANT_COUNT_CACHE_TTL_SECONDS,
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
      countsByRoomId.set(roomId, null);
    }
  }

  return countsByRoomId;
};

export const liveRoomParticipantCountCacheKey = getParticipantCountCacheKey;

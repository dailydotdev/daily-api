import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { LiveRoom } from '../../src/entity/LiveRoom';
import { User } from '../../src/entity/user/User';
import {
  LiveRoomLifecycleEventType,
  LiveRoomStatus,
} from '../../src/common/schema/liveRooms';
import { saveFixtures, expectSuccessfulTypedBackground } from '../helpers';
import { usersFixture } from '../fixture/user';
import { liveRoomStartedWorker } from '../../src/workers/liveRoomStarted';
import { liveRoomEndedWorker } from '../../src/workers/liveRoomEnded';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, User, usersFixture);
});

describe('live room lifecycle workers', () => {
  it('marks a room live when a started event arrives', async () => {
    await saveFixtures(con, LiveRoom, [
      {
        id: 'f5f3db20-7f40-4dd8-9ac5-0e2a693dad8c',
        hostId: '1',
        topic: 'Lifecycle room',
        mode: 'debate',
        status: LiveRoomStatus.Created,
      },
    ]);

    await expectSuccessfulTypedBackground<'api.v1.live-room-started'>(
      liveRoomStartedWorker,
      {
        eventId: '91cf8383-bac0-4da4-8a2a-e472b2ef5ce3',
        roomId: 'f5f3db20-7f40-4dd8-9ac5-0e2a693dad8c',
        occurredAt: '2026-04-23T15:00:00.000Z',
        type: LiveRoomLifecycleEventType.RoomStarted,
      },
    );

    const room = await con.getRepository(LiveRoom).findOneByOrFail({
      id: 'f5f3db20-7f40-4dd8-9ac5-0e2a693dad8c',
    });

    expect(room.status).toBe(LiveRoomStatus.Live);
    expect(room.startedAt?.toISOString()).toBe('2026-04-23T15:00:00.000Z');
  });

  it('marks a room ended when an ended event arrives', async () => {
    await saveFixtures(con, LiveRoom, [
      {
        id: '94ba1d11-9831-4fb2-bda2-c7377f790f36',
        hostId: '1',
        topic: 'Lifecycle room',
        mode: 'debate',
        status: LiveRoomStatus.Live,
        startedAt: new Date('2026-04-23T15:00:00.000Z'),
      },
    ]);

    await expectSuccessfulTypedBackground<'api.v1.live-room-ended'>(
      liveRoomEndedWorker,
      {
        eventId: '688260d3-d16f-4e96-85e8-e2eb2bdb52b0',
        roomId: '94ba1d11-9831-4fb2-bda2-c7377f790f36',
        occurredAt: '2026-04-23T16:00:00.000Z',
        type: LiveRoomLifecycleEventType.RoomEnded,
      },
    );

    const room = await con.getRepository(LiveRoom).findOneByOrFail({
      id: '94ba1d11-9831-4fb2-bda2-c7377f790f36',
    });

    expect(room.status).toBe(LiveRoomStatus.Ended);
    expect(room.endedAt?.toISOString()).toBe('2026-04-23T16:00:00.000Z');
  });

  it('deduplicates repeated lifecycle events', async () => {
    await saveFixtures(con, LiveRoom, [
      {
        id: '4d84f9a2-29ce-4a15-92e0-f3f1f31cb26e',
        hostId: '1',
        topic: 'Lifecycle room',
        mode: 'debate',
        status: LiveRoomStatus.Created,
      },
    ]);

    const payload = {
      eventId: 'b58e916d-5e6c-42d9-a950-a5ebfd60c887',
      roomId: '4d84f9a2-29ce-4a15-92e0-f3f1f31cb26e',
      occurredAt: '2026-04-23T15:00:00.000Z',
      type: LiveRoomLifecycleEventType.RoomStarted,
    };

    await expectSuccessfulTypedBackground<'api.v1.live-room-started'>(
      liveRoomStartedWorker,
      payload,
    );
    await expectSuccessfulTypedBackground<'api.v1.live-room-started'>(
      liveRoomStartedWorker,
      payload,
    );

    const room = await con.getRepository(LiveRoom).findOneByOrFail({
      id: '4d84f9a2-29ce-4a15-92e0-f3f1f31cb26e',
    });

    expect(room).toMatchObject({
      status: LiveRoomStatus.Live,
      startedAt: new Date('2026-04-23T15:00:00.000Z'),
    });
  });
});

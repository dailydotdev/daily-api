import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { LiveRoom } from '../../../src/entity/LiveRoom';
import { LiveRoomSubscription } from '../../../src/entity/LiveRoomSubscription';
import { User } from '../../../src/entity/user/User';
import { NotificationType } from '../../../src/notifications/common';
import { liveRoomStartingSoonNotification as worker } from '../../../src/workers/notifications/liveRoomStartingSoonNotification';
import { workers } from '../../../src/workers';
import { getTableName } from '../../../src/workers/cdc/common';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { usersFixture } from '../../fixture/user';
import { LiveRoomStatus } from '../../../src/common/schema/liveRooms';

let con: DataSource;

describe('liveRoomStartingSoonNotification worker', () => {
  beforeAll(async () => {
    con = await createOrGetConnection();
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, User, usersFixture);
  });

  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should send notifications to room subscribers', async () => {
    await saveFixtures(con, LiveRoom, [
      {
        id: 'ca8f8dfd-5575-4f7b-b302-012cf2589c0e',
        hostId: '1',
        topic: 'Design review',
        mode: 'moderated',
        status: LiveRoomStatus.Created,
        scheduledStart: new Date('2026-05-05T15:10:00.000Z'),
      },
    ]);
    await saveFixtures(con, LiveRoomSubscription, [
      {
        roomId: 'ca8f8dfd-5575-4f7b-b302-012cf2589c0e',
        userId: '2',
      },
      {
        roomId: 'ca8f8dfd-5575-4f7b-b302-012cf2589c0e',
        userId: '3',
      },
    ]);

    const result =
      await invokeTypedNotificationWorker<'api.v1.delayed-notification-reminder'>(
        worker,
        {
          entityId: 'ca8f8dfd-5575-4f7b-b302-012cf2589c0e',
          entityTableName: getTableName(con, LiveRoom),
          scheduledAtMs: Date.now(),
          delayMs: 1_000,
        },
      );

    expect(result).toHaveLength(1);
    expect(result![0].type).toBe(NotificationType.LiveRoomStartingSoon);
    expect(result![0].ctx.userIds).toEqual(['2', '3']);
  });

  it('should return nothing when room has no subscribers', async () => {
    await saveFixtures(con, LiveRoom, [
      {
        id: '1f0c69ca-feba-4eb1-a366-35eff25ccb1e',
        hostId: '1',
        topic: 'Empty room',
        mode: 'moderated',
        status: LiveRoomStatus.Created,
        scheduledStart: new Date('2026-05-05T15:10:00.000Z'),
      },
    ]);

    const result =
      await invokeTypedNotificationWorker<'api.v1.delayed-notification-reminder'>(
        worker,
        {
          entityId: '1f0c69ca-feba-4eb1-a366-35eff25ccb1e',
          entityTableName: getTableName(con, LiveRoom),
          scheduledAtMs: Date.now(),
          delayMs: 1_000,
        },
      );

    expect(result).toBeUndefined();
  });
});

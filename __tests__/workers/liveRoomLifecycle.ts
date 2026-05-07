import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { LiveRoom } from '../../src/entity/LiveRoom';
import { LiveRoomSubscription } from '../../src/entity/LiveRoomSubscription';
import { NotificationV2 } from '../../src/entity/notifications/NotificationV2';
import { NotificationAvatarV2 } from '../../src/entity/notifications/NotificationAvatarV2';
import { UserNotification } from '../../src/entity/notifications/UserNotification';
import { User } from '../../src/entity/user/User';
import {
  LiveRoomLifecycleEventType,
  LiveRoomStatus,
} from '../../src/common/schema/liveRooms';
import { saveFixtures, expectSuccessfulTypedBackground } from '../helpers';
import { usersFixture } from '../fixture/user';
import { liveRoomStartedWorker } from '../../src/workers/liveRoomStarted';
import { liveRoomEndedWorker } from '../../src/workers/liveRoomEnded';
import { NotificationType } from '../../src/notifications/common';

let con: DataSource;

beforeAll(async () => {
  process.env.COMMENTS_PREFIX = 'http://localhost:5002';
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
        mode: 'moderated',
        status: LiveRoomStatus.Created,
      },
    ]);

    await expectSuccessfulTypedBackground<'flyting.v1.room-started'>(
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

  it('notifies subscribers and hard deletes room subscriptions when the room starts', async () => {
    await saveFixtures(con, LiveRoom, [
      {
        id: '7250df5f-f9e0-4b47-898a-fbb975695e83',
        hostId: '1',
        topic: 'Scheduled lobby',
        mode: 'moderated',
        status: LiveRoomStatus.Created,
        scheduledStart: new Date('2026-05-05T15:00:00.000Z'),
      },
    ]);
    await saveFixtures(con, LiveRoomSubscription, [
      {
        roomId: '7250df5f-f9e0-4b47-898a-fbb975695e83',
        userId: '2',
      },
      {
        roomId: '7250df5f-f9e0-4b47-898a-fbb975695e83',
        userId: '3',
      },
    ]);

    await expectSuccessfulTypedBackground<'flyting.v1.room-started'>(
      liveRoomStartedWorker,
      {
        eventId: '9e56ed30-440f-40ef-bb0b-59e8d871a30a',
        roomId: '7250df5f-f9e0-4b47-898a-fbb975695e83',
        occurredAt: '2026-05-05T15:01:00.000Z',
        type: LiveRoomLifecycleEventType.RoomStarted,
      },
    );

    const notification = await con
      .getRepository(NotificationV2)
      .findOneByOrFail({
        referenceId: '7250df5f-f9e0-4b47-898a-fbb975695e83',
        referenceType: 'live_room',
        type: NotificationType.LiveRoomStarted,
      });
    expect(notification.title).toBe(
      '<b>Ido</b> is live: <b>Scheduled lobby</b>',
    );
    expect(notification.targetUrl).toBe(
      'http://localhost:5002/standups/7250df5f-f9e0-4b47-898a-fbb975695e83',
    );
    const avatars = await con.getRepository(NotificationAvatarV2).findBy({
      id: notification.avatars[0],
    });
    expect(avatars).toMatchObject([
      {
        referenceId: '1',
        type: 'user',
      },
    ]);

    const userNotifications = await con.getRepository(UserNotification).findBy({
      notificationId: notification.id,
    });
    expect(userNotifications.map(({ userId }) => userId).sort()).toEqual([
      '2',
      '3',
    ]);
    expect(
      await con.getRepository(LiveRoomSubscription).countBy({
        roomId: '7250df5f-f9e0-4b47-898a-fbb975695e83',
      }),
    ).toBe(0);
  });

  it('adds user notifications when the room notification already exists', async () => {
    const roomId = '38bf0f69-942f-412f-bd4e-a64b08b0b66e';

    await saveFixtures(con, LiveRoom, [
      {
        id: roomId,
        hostId: '1',
        topic: 'Existing notification lobby',
        mode: 'moderated',
        status: LiveRoomStatus.Created,
        scheduledStart: new Date('2026-05-05T15:00:00.000Z'),
      },
    ]);
    await saveFixtures(con, NotificationV2, [
      {
        type: NotificationType.LiveRoomStarted,
        icon: 'bell',
        title: '<b>Ido</b> is live: <b>Existing notification lobby</b>',
        targetUrl: `http://localhost:5002/standups/${roomId}`,
        referenceId: roomId,
        referenceType: 'live_room',
        uniqueKey: roomId,
        avatars: [],
        attachments: [],
      },
    ]);
    await saveFixtures(con, LiveRoomSubscription, [
      {
        roomId,
        userId: '2',
      },
    ]);

    await expectSuccessfulTypedBackground<'flyting.v1.room-started'>(
      liveRoomStartedWorker,
      {
        eventId: '955f8422-87eb-4e91-8b32-4a13cf2d481d',
        roomId,
        occurredAt: '2026-05-05T15:01:00.000Z',
        type: LiveRoomLifecycleEventType.RoomStarted,
      },
    );

    const notification = await con
      .getRepository(NotificationV2)
      .findOneByOrFail({
        referenceId: roomId,
        referenceType: 'live_room',
        type: NotificationType.LiveRoomStarted,
      });
    const userNotifications = await con.getRepository(UserNotification).findBy({
      notificationId: notification.id,
    });

    expect(userNotifications.map(({ userId }) => userId)).toEqual(['2']);
    expect(
      await con.getRepository(LiveRoomSubscription).countBy({ roomId }),
    ).toBe(0);
  });

  it('marks a room ended when an ended event arrives', async () => {
    await saveFixtures(con, LiveRoom, [
      {
        id: '94ba1d11-9831-4fb2-bda2-c7377f790f36',
        hostId: '1',
        topic: 'Lifecycle room',
        mode: 'moderated',
        status: LiveRoomStatus.Live,
        startedAt: new Date('2026-04-23T15:00:00.000Z'),
      },
    ]);

    await expectSuccessfulTypedBackground<'flyting.v1.room-ended'>(
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
        mode: 'moderated',
        status: LiveRoomStatus.Created,
      },
    ]);

    const payload = {
      eventId: 'b58e916d-5e6c-42d9-a950-a5ebfd60c887',
      roomId: '4d84f9a2-29ce-4a15-92e0-f3f1f31cb26e',
      occurredAt: '2026-04-23T15:00:00.000Z',
      type: LiveRoomLifecycleEventType.RoomStarted,
    };

    await expectSuccessfulTypedBackground<'flyting.v1.room-started'>(
      liveRoomStartedWorker,
      payload,
    );
    await expectSuccessfulTypedBackground<'flyting.v1.room-started'>(
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

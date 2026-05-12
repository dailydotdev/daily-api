import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import cron from '../../src/cron/liveRoomStartingSoonNotifications';
import { crons } from '../../src/cron/index';
import { LiveRoom } from '../../src/entity/LiveRoom';
import { User } from '../../src/entity/user/User';
import { LiveRoomStatus } from '../../src/common/schema/liveRooms';
import { getTableName } from '../../src/workers/cdc/common';
import { doNotFake, expectSuccessfulCron, saveFixtures } from '../helpers';
import { usersFixture } from '../fixture/user';
import { createMockTemporalClient } from '../helpers';

const { mock, client, notFoundError } = createMockTemporalClient();

jest.mock('../../src/temporal/client', () => ({
  getTemporalClient: () => client,
}));

jest.mock('../../src/temporal/common', () => {
  const actual = jest.requireActual('../../src/temporal/common');

  return {
    ...actual,
    getWorkflowDescription: jest.fn(),
  };
});

const { getWorkflowDescription } = jest.requireMock(
  '../../src/temporal/common',
);

let con: DataSource;

beforeAll(async () => {
  process.env.COMMENTS_PREFIX = 'http://localhost:5002';
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();
  jest
    .useFakeTimers({ doNotFake })
    .setSystemTime(new Date('2026-05-05T14:55:00.000Z'));
  mock.describe.mockRejectedValue(notFoundError());
  await saveFixtures(con, User, usersFixture);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('live room starting soon notifications cron', () => {
  it('should be registered', () => {
    const registeredCron = crons.find((item) => item.name === cron.name);

    expect(registeredCron).toBeDefined();
  });

  it('schedules a delayed reminder for rooms in the next hour batch', async () => {
    await saveFixtures(con, LiveRoom, [
      {
        id: 'e624ca91-5bde-4304-ae0a-c82f46edb6f8',
        hostId: '1',
        topic: 'Design review',
        mode: 'moderated',
        status: LiveRoomStatus.Created,
        scheduledStart: new Date('2026-05-05T15:10:00.000Z'),
      },
    ]);

    await expectSuccessfulCron(cron);

    expect(getWorkflowDescription).toHaveBeenCalledTimes(1);
    expect(mock.start).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        args: [
          {
            entityId: 'e624ca91-5bde-4304-ae0a-c82f46edb6f8',
            entityTableName: getTableName(con, LiveRoom),
            scheduledAtMs: new Date('2026-05-05T15:05:00.000Z').getTime(),
            delayMs: 10 * 60 * 1000,
          },
        ],
      }),
    );
  });

  it('ignores rooms outside the next hour reminder batch', async () => {
    await saveFixtures(con, LiveRoom, [
      {
        id: 'fbe81b0d-f2a7-4b6a-b5f2-2cb8908fa5db',
        hostId: '1',
        topic: 'Reminder already due',
        mode: 'moderated',
        status: LiveRoomStatus.Created,
        scheduledStart: new Date('2026-05-05T14:59:00.000Z'),
      },
      {
        id: '86fbd8fa-354d-4a72-8b26-1166ea32245d',
        hostId: '1',
        topic: 'Next batch',
        mode: 'moderated',
        status: LiveRoomStatus.Created,
        scheduledStart: new Date('2026-05-05T16:00:01.000Z'),
      },
    ]);

    await expectSuccessfulCron(cron);

    expect(getWorkflowDescription).not.toHaveBeenCalled();
    expect(mock.start).not.toHaveBeenCalled();
  });
});

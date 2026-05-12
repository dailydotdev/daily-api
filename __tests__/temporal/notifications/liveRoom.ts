import {
  getLiveRoomStartingSoonReminderWorkflowId,
  scheduleLiveRoomStartingSoonReminder,
} from '../../../src/temporal/notifications/liveRoom';
import { createMockTemporalClient } from '../../helpers';

const { mock, client } = createMockTemporalClient();

jest.mock('../../../src/temporal/client', () => ({
  getTemporalClient: () => client,
}));

jest.mock('../../../src/temporal/common', () => {
  const actual = jest.requireActual('../../../src/temporal/common');

  return {
    ...actual,
    getWorkflowDescription: jest.fn(),
  };
});

const { getWorkflowDescription } = jest.requireMock(
  '../../../src/temporal/common',
);

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getLiveRoomStartingSoonReminderWorkflowId', () => {
  it('should generate workflow id', () => {
    expect(
      getLiveRoomStartingSoonReminderWorkflowId(
        'e624ca91-5bde-4304-ae0a-c82f46edb6f8',
      ),
    ).toBe(
      'notification:entity:live-room-starting-soon:e624ca91-5bde-4304-ae0a-c82f46edb6f8',
    );
  });
});

describe('scheduleLiveRoomStartingSoonReminder', () => {
  it('should start reminder workflow', async () => {
    getWorkflowDescription.mockResolvedValueOnce(undefined);
    mock.start.mockResolvedValueOnce({ describe: mock.describe });
    jest.useFakeTimers().setSystemTime(new Date('2026-05-05T14:55:00.000Z'));

    await scheduleLiveRoomStartingSoonReminder({
      roomId: 'e624ca91-5bde-4304-ae0a-c82f46edb6f8',
      entityTableName: 'live_room',
      scheduledStart: new Date('2026-05-05T15:10:00.000Z'),
    });

    expect(mock.start).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        workflowId: getLiveRoomStartingSoonReminderWorkflowId(
          'e624ca91-5bde-4304-ae0a-c82f46edb6f8',
        ),
        taskQueue: 'notification-queue',
        startDelay: 10 * 60 * 1000,
        args: [
          {
            entityId: 'e624ca91-5bde-4304-ae0a-c82f46edb6f8',
            entityTableName: 'live_room',
            scheduledAtMs: new Date('2026-05-05T15:05:00.000Z').getTime(),
            delayMs: 10 * 60 * 1000,
          },
        ],
      }),
    );

    jest.useRealTimers();
  });

  it('should not start reminder workflow when workflow exists', async () => {
    getWorkflowDescription.mockResolvedValueOnce({
      status: { name: 'RUNNING' },
    });

    await scheduleLiveRoomStartingSoonReminder({
      roomId: 'e624ca91-5bde-4304-ae0a-c82f46edb6f8',
      entityTableName: 'live_room',
      scheduledStart: new Date(Date.now() + 15 * 60 * 1000),
    });

    expect(mock.start).not.toHaveBeenCalled();
  });
});

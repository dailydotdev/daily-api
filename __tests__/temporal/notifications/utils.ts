import {
  cancelEntityReminderWorkflow,
  cancelReminderWorkflow,
  getEntityReminderWorkflowId,
  getReminderWorkflowId,
  runEntityReminderWorkflow,
  runReminderWorkflow,
} from '../../../src/temporal/notifications/utils';
import { createMockTemporalClient } from '../../helpers';

const { mock, client, notFoundError } = createMockTemporalClient();

jest.mock('../../../src/temporal/client', () => ({
  getTemporalClient: () => client,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getReminderWorkflowId', () => {
  it('should generate reminder workflow id', () => {
    const params = {
      postId: 'p1',
      userId: '1',
      remindAt: 12345,
    };

    expect(getReminderWorkflowId(params)).toBe(
      'notification:bookmark:1:p1:12345',
    );
  });
});

describe('runReminderWorkflow', () => {
  it('should start reminder workflow', async () => {
    mock.describe.mockRejectedValueOnce(notFoundError());
    mock.start.mockResolvedValueOnce({ describe: mock.describe });

    const params = {
      postId: 'p1',
      userId: '1',
      remindAt: Date.now() + 10_000,
    };

    const result = await runReminderWorkflow(params);

    expect(result).toBeDefined();
    expect(mock.start).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        workflowId: getReminderWorkflowId(params),
        taskQueue: 'notification-queue',
      }),
    );
  });

  it('should not start reminder workflow when workflow exists', async () => {
    mock.describe.mockResolvedValueOnce({ status: { name: 'RUNNING' } });

    const params = {
      postId: 'p1',
      userId: '1',
      remindAt: Date.now() + 10_000,
    };

    const result = await runReminderWorkflow(params);

    expect(result).toBeUndefined();
    expect(mock.start).not.toHaveBeenCalled();
  });
});

describe('cancelReminderWorkflow', () => {
  it('should cancel workflow', async () => {
    mock.describe.mockResolvedValueOnce({ status: { name: 'RUNNING' } });
    mock.terminate.mockResolvedValueOnce(undefined);

    const params = {
      postId: 'p1',
      userId: '1',
      remindAt: Date.now() + 10_000,
    };

    await cancelReminderWorkflow(params);

    expect(mock.terminate).toHaveBeenCalled();
  });

  it('should do nothing when workflow does not exist', async () => {
    mock.describe.mockRejectedValueOnce(notFoundError());

    const params = {
      postId: 'p1',
      userId: '1',
      remindAt: Date.now() + 10_000,
    };

    await cancelReminderWorkflow(params);

    expect(mock.terminate).not.toHaveBeenCalled();
  });
});

describe('getEntityReminderWorkflowId', () => {
  it('should generate workflow id', () => {
    const params = {
      entityId: '1',
      entityTableName: 'campaign',
      scheduledAtMs: 0,
      delayMs: 1_000,
    };

    expect(getEntityReminderWorkflowId(params)).toBe(
      `notification:entity:${JSON.stringify({
        entityId: '1',
        entityTableName: 'campaign',
        delayMs: 1_000,
      })}`,
    );
  });
});

describe('runEntityReminderWorkflow', () => {
  it('should start reminder workflow', async () => {
    mock.describe.mockRejectedValueOnce(notFoundError());
    mock.start.mockResolvedValueOnce({ describe: mock.describe });

    const params = {
      entityId: '1',
      entityTableName: 'campaign',
      scheduledAtMs: 0,
      delayMs: 1_000,
    };

    const result = await runEntityReminderWorkflow(params);

    expect(result).toBeDefined();
    expect(mock.start).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        workflowId: getEntityReminderWorkflowId(params),
        taskQueue: 'notification-queue',
      }),
    );
  });

  it('should not start reminder workflow when workflow exists', async () => {
    mock.describe.mockResolvedValueOnce({ status: { name: 'RUNNING' } });

    const params = {
      entityId: '1',
      entityTableName: 'campaign',
      scheduledAtMs: 0,
      delayMs: 1_000,
    };

    const result = await runEntityReminderWorkflow(params);

    expect(result).toBeUndefined();
    expect(mock.start).not.toHaveBeenCalled();
  });
});

describe('cancelEntityReminderWorkflow', () => {
  it('should cancel workflow', async () => {
    mock.describe.mockResolvedValueOnce({ status: { name: 'RUNNING' } });
    mock.terminate.mockResolvedValueOnce(undefined);

    const params = {
      entityId: '1',
      entityTableName: 'campaign',
      scheduledAtMs: 0,
      delayMs: 1_000,
    };

    await cancelEntityReminderWorkflow(params);

    expect(mock.terminate).toHaveBeenCalled();
  });

  it('should do nothing when workflow does not exist', async () => {
    mock.describe.mockRejectedValueOnce(notFoundError());

    const params = {
      entityId: '1',
      entityTableName: 'campaign',
      scheduledAtMs: 0,
      delayMs: 1_000,
    };

    await cancelEntityReminderWorkflow(params);

    expect(mock.terminate).not.toHaveBeenCalled();
  });
});

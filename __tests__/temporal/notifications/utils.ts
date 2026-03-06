import { BookmarkActivities } from '../../../src/temporal/notifications/activities';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import {
  cancelEntityReminderWorkflow,
  cancelReminderWorkflow,
  getEntityReminderWorkflowId,
  getReminderWorkflowId,
  runEntityReminderWorkflow,
  runReminderWorkflow,
} from '../../../src/temporal/notifications/utils';

let testEnv: TestWorkflowEnvironment;

const validateBookmark = jest.fn();
const sendBookmarkReminder = jest.fn();
const mockActivities: BookmarkActivities = {
  validateBookmark,
  sendBookmarkReminder,
  sendEntityReminder: jest.fn(),
};

jest.mock('../../../src/temporal/client', () => ({
  getTemporalClient: () => testEnv.client,
}));

beforeAll(async () => {
  testEnv = await TestWorkflowEnvironment.createTimeSkipping();
});

afterAll(async () => {
  await testEnv?.teardown();
});

beforeEach(() => {
  jest.clearAllMocks();
});

const createWorker = () =>
  Worker.create({
    connection: testEnv.nativeConnection,
    taskQueue: 'test',
    activities: mockActivities,
    workflowsPath:
      require.resolve('../../../src/temporal/notifications/workflows'),
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
    const worker = await createWorker();
    const params = {
      postId: 'p1',
      userId: '1',
      remindAt: Date.now() + 1000,
    };

    const result = await worker.runUntil(runReminderWorkflow(params));
    const description = await result!.describe();

    expect(description.status.name).toEqual('RUNNING');
  });

  it('should not start reminder workflow when workflow exists', async () => {
    const worker = await createWorker();
    const params = {
      postId: 'p1',
      userId: '1',
      remindAt: Date.now() + 1000,
    };

    const result = await worker.runUntil(runReminderWorkflow(params));
    const description = await result!.describe();

    expect(description.status.name).toEqual('RUNNING');

    const newWorkflow = await runReminderWorkflow(params);

    expect(newWorkflow).not.toBeDefined();
  });
});

describe('cancelReminderWorkflow', () => {
  it('should cancel workflow', async () => {
    const worker = await createWorker();
    const params = {
      postId: 'p1',
      userId: '1',
      remindAt: Date.now() + 1000,
    };

    const result = await worker.runUntil(runReminderWorkflow(params));
    const description = await result!.describe();

    expect(description.status.name).toEqual('RUNNING');

    const worker2 = await createWorker();
    const cancelledResult = await worker2.runUntil(
      cancelReminderWorkflow(params),
    );
    const cancelled = await result!.describe();
    expect(cancelledResult).toBeDefined();
    expect(cancelled.status.name).toEqual('TERMINATED');
  });

  it('should do nothing when workflow does not exist', async () => {
    const worker = await createWorker();
    const params = {
      postId: 'p1',
      userId: '1',
      remindAt: Date.now() + 1000,
    };

    const result = await worker.runUntil(cancelReminderWorkflow(params));

    expect(result).not.toBeDefined();
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
    const worker = await createWorker();
    const params = {
      entityId: 'run-start',
      entityTableName: 'campaign',
      scheduledAtMs: 0,
      delayMs: 1_000,
    };

    const result = await worker.runUntil(runEntityReminderWorkflow(params));
    expect(result).toBeDefined();
    const description = await result!.describe();

    expect(description.status.name).toEqual('RUNNING');
  });

  it('should not start reminder workflow when workflow exists', async () => {
    const worker = await createWorker();
    const params = {
      entityId: 'run-duplicate',
      entityTableName: 'campaign',
      scheduledAtMs: 0,
      delayMs: 1_000,
    };

    const result = await worker.runUntil(runEntityReminderWorkflow(params));
    expect(result).toBeDefined();
    const description = await result!.describe();

    expect(description.status.name).toEqual('RUNNING');

    const newWorkflow = await runEntityReminderWorkflow(params);

    expect(newWorkflow).not.toBeDefined();
  });
});

describe('cancelEntityReminderWorkflow', () => {
  it('should cancel workflow', async () => {
    const worker = await createWorker();
    const params = {
      entityId: 'cancel-existing',
      entityTableName: 'campaign',
      scheduledAtMs: 0,
      delayMs: 1_000,
    };

    const result = await worker.runUntil(runEntityReminderWorkflow(params));
    expect(result).toBeDefined();
    const description = await result!.describe();

    expect(description.status.name).toEqual('RUNNING');

    const worker2 = await createWorker();
    const cancelledResult = await worker2.runUntil(
      cancelEntityReminderWorkflow(params),
    );
    expect(cancelledResult).toBeDefined();
    const cancelled = await result!.describe();
    expect(cancelledResult).toBeDefined();
    expect(cancelled.status.name).toEqual('TERMINATED');
  });

  it('should do nothing when workflow does not exist', async () => {
    const worker = await createWorker();
    const params = {
      entityId: 'cancel-nonexistent',
      entityTableName: 'campaign',
      scheduledAtMs: 0,
      delayMs: 1_000,
    };

    const result = await worker.runUntil(cancelEntityReminderWorkflow(params));

    expect(result).not.toBeDefined();
  });
});

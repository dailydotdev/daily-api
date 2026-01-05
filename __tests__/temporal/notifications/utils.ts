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
};

let worker: Worker;

jest.mock('../../../src/temporal/client', () => ({
  getTemporalClient: () => testEnv.client,
}));

const setupTestEnv = async () => {
  testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  worker = await Worker.create({
    connection: testEnv.nativeConnection,
    taskQueue: 'test',
    activities: mockActivities,
    workflowsPath:
      require.resolve('../../../src/temporal/notifications/workflows'),
  });
};

const cleanupTestEnv = async () => {
  await testEnv?.teardown();
  testEnv = null;
  worker = null;
};

beforeEach(async () => {
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
  beforeEach(async () => {
    await setupTestEnv();
  });

  afterEach(async () => {
    await cleanupTestEnv();
  });

  it('should start reminder workflow', async () => {
    const params = {
      postId: 'p1',
      userId: '1',
      remindAt: Date.now() + 1000,
    };

    const result = await worker.runUntil(runReminderWorkflow(params));
    const description = await result.describe();

    expect(description.status.name).toEqual('RUNNING');
  });

  it('should not start reminder workflow when workflow exists', async () => {
    const params = {
      postId: 'p1',
      userId: '1',
      remindAt: Date.now() + 1000,
    };

    const result = await worker.runUntil(runReminderWorkflow(params));
    const description = await result.describe();

    expect(description.status.name).toEqual('RUNNING');

    const newWorkflow = await runReminderWorkflow(params);

    expect(newWorkflow).not.toBeDefined();
  });
});

describe('cancelReminderWorkflow', () => {
  beforeEach(async () => {
    await setupTestEnv();
  });

  afterEach(async () => {
    await cleanupTestEnv();
  });

  it('should cancel workflow', async () => {
    const params = {
      postId: 'p1',
      userId: '1',
      remindAt: Date.now() + 1000,
    };

    const result = await runReminderWorkflow(params);
    const description = await result.describe();

    expect(description.status.name).toEqual('RUNNING');

    const cancelledResult = await worker.runUntil(
      cancelReminderWorkflow(params),
    );
    const cancelled = await result.describe();
    expect(cancelledResult).toBeDefined();
    expect(cancelled.status.name).toEqual('TERMINATED');
  });

  it('should do nothing when workflow does not exist', async () => {
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
  beforeEach(async () => {
    await setupTestEnv();
  });

  afterEach(async () => {
    await cleanupTestEnv();
  });

  it('should start reminder workflow', async () => {
    const params = {
      entityId: '1',
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
    const params = {
      entityId: '1',
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
  beforeEach(async () => {
    await setupTestEnv();
  });

  afterEach(async () => {
    await cleanupTestEnv();
  });

  it('should cancel workflow', async () => {
    const params = {
      entityId: '1',
      entityTableName: 'campaign',
      scheduledAtMs: 0,
      delayMs: 1_000,
    };

    const result = await runEntityReminderWorkflow(params);
    expect(result).toBeDefined();
    const description = await result!.describe();

    expect(description.status.name).toEqual('RUNNING');

    const cancelledResult = await worker.runUntil(
      cancelEntityReminderWorkflow(params),
    );
    expect(cancelledResult).toBeDefined();
    const cancelled = await result!.describe();
    expect(cancelledResult).toBeDefined();
    expect(cancelled.status.name).toEqual('TERMINATED');
  });

  it('should do nothing when workflow does not exist', async () => {
    const params = {
      entityId: '1',
      entityTableName: 'campaign',
      scheduledAtMs: 0,
      delayMs: 1_000,
    };

    const result = await worker.runUntil(cancelEntityReminderWorkflow(params));

    expect(result).not.toBeDefined();
  });
});

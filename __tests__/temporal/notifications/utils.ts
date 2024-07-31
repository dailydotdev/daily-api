import { BookmarkActivities } from '../../../src/temporal/notifications/activities';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import {
  cancelReminderWorkflow,
  getReminderWorkflowId,
  runReminderWorkflow,
} from '../../../src/temporal/notifications/utils';

let testEnv: TestWorkflowEnvironment;

const validateBookmark = jest.fn();
const sendBookmarkReminder = jest.fn();
const mockActivities: BookmarkActivities = {
  validateBookmark,
  sendBookmarkReminder,
};

afterAll(async () => {
  await testEnv?.teardown();
});

let worker: Worker;

beforeAll(async () => {
  testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  worker = await Worker.create({
    connection: testEnv.nativeConnection,
    taskQueue: 'test',
    activities: mockActivities,
    workflowsPath: require.resolve(
      '../../../src/temporal/notifications/workflows',
    ),
  });
});

jest.mock('../../../src/temporal/client', () => ({
  getTemporalClient: () => testEnv.client,
}));

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

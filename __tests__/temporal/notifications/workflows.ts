import {
  bookmarkReminderWorkflow,
  entityReminderWorkflow,
} from '../../../src/temporal/notifications/workflows';
import { BookmarkActivities } from '../../../src/temporal/notifications/activities';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import {
  getEntityReminderWorkflowId,
  getReminderWorkflowId,
} from '../../../src/temporal/notifications/utils';

let testEnv: TestWorkflowEnvironment;

const validateBookmark = jest.fn();
const sendBookmarkReminder = jest.fn();
const sendEntityReminder = jest.fn();
const mockActivities: BookmarkActivities = {
  validateBookmark,
  sendBookmarkReminder,
  sendEntityReminder,
};

let worker: Worker;

jest.mock('../../../src/temporal/client', () => ({
  getTemporalClient: () => testEnv.client,
}));

beforeEach(async () => {
  testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  worker = await Worker.create({
    connection: testEnv.nativeConnection,
    taskQueue: 'test',
    activities: mockActivities,
    workflowsPath:
      require.resolve('../../../src/temporal/notifications/workflows'),
  });
  jest.clearAllMocks();
});

afterEach(async () => {
  await testEnv?.teardown();
});

describe('bookmarkReminderWorkflow workflow', () => {
  it('should validate bookmark and do nothing if bookmark is not valid', async () => {
    const params = {
      postId: 'p1',
      userId: '1',
      remindAt: Date.now() + 1000,
    };

    validateBookmark.mockReturnValueOnce(false);

    await worker.runUntil(
      testEnv.client.workflow.execute(bookmarkReminderWorkflow, {
        workflowId: getReminderWorkflowId(params),
        args: [params],
        taskQueue: 'test',
      }),
    );

    expect(mockActivities.sendBookmarkReminder).not.toHaveBeenCalled();
  });

  it('should validate bookmark and send bookmark reminder', async () => {
    const params = {
      postId: 'p1',
      userId: '1',
      remindAt: Date.now() + 1000,
    };

    validateBookmark.mockReturnValueOnce(true);

    await worker.runUntil(
      testEnv.client.workflow.execute(bookmarkReminderWorkflow, {
        workflowId: getReminderWorkflowId(params),
        args: [params],
        taskQueue: 'test',
      }),
    );

    expect(mockActivities.sendBookmarkReminder).toHaveBeenCalledWith({
      postId: 'p1',
      userId: '1',
    });
  });
});

describe('entityReminderWorkflow workflow', () => {
  it('should send reminder event', async () => {
    const params = {
      entityId: '1',
      entityTableName: 'campaign',
      scheduledAtMs: 0,
      delayMs: 1_000,
    };

    sendEntityReminder.mockReturnValueOnce(undefined);

    await worker.runUntil(
      testEnv.client.workflow.execute(entityReminderWorkflow, {
        workflowId: getEntityReminderWorkflowId(params),
        args: [params],
        taskQueue: 'test',
      }),
    );

    expect(mockActivities.sendEntityReminder).toHaveBeenCalledTimes(1);
    expect(mockActivities.sendEntityReminder).toHaveBeenCalledWith(params);
  });
});

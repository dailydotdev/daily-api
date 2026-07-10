import {
  bookmarkReminderWorkflow,
  entityReminderWorkflow,
  scheduledPostPublishWorkflow,
} from '../../../src/temporal/notifications/workflows';
import { BookmarkActivities } from '../../../src/temporal/notifications/activities';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import {
  getEntityReminderWorkflowId,
  getReminderWorkflowId,
  getScheduledPostPublishWorkflowId,
} from '../../../src/temporal/notifications/utils';

let testEnv: TestWorkflowEnvironment;

const validateBookmark = jest.fn();
const sendBookmarkReminder = jest.fn();
const sendEntityReminder = jest.fn();
const publishScheduledPost = jest.fn();
const mockActivities: BookmarkActivities = {
  validateBookmark,
  sendBookmarkReminder,
  sendEntityReminder,
  publishScheduledPost,
};

jest.mock('../../../src/temporal/client', () => ({
  getTemporalClient: () => testEnv.client,
}));

beforeAll(async () => {
  testEnv = await TestWorkflowEnvironment.createTimeSkipping();
}, 15_000);

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

describe('bookmarkReminderWorkflow workflow', () => {
  it('should validate bookmark and do nothing if bookmark is not valid', async () => {
    const worker = await createWorker();
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
    const worker = await createWorker();
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
    const worker = await createWorker();
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

describe('scheduledPostPublishWorkflow workflow', () => {
  it('should publish scheduled post', async () => {
    const worker = await createWorker();
    const params = {
      postId: 'p1',
      scheduledAt: new Date().toISOString(),
    };

    publishScheduledPost.mockReturnValueOnce(undefined);

    await worker.runUntil(
      testEnv.client.workflow.execute(scheduledPostPublishWorkflow, {
        workflowId: getScheduledPostPublishWorkflowId(params),
        args: [params],
        taskQueue: 'test',
      }),
    );

    expect(mockActivities.publishScheduledPost).toHaveBeenCalledTimes(1);
    expect(mockActivities.publishScheduledPost).toHaveBeenCalledWith(params);
  });
});

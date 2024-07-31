import { bookmarkReminderWorkflow } from '../../../src/temporal/notifications/workflows';
import { BookmarkActivities } from '../../../src/temporal/notifications/activities';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { getReminderWorkflowId } from '../../../src/temporal/notifications/utils';

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

    await testEnv.client.workflow.execute(bookmarkReminderWorkflow, {
      workflowId: getReminderWorkflowId(params),
      args: [params],
      taskQueue: 'test',
    });

    expect(mockActivities.sendBookmarkReminder).toHaveBeenCalledWith({
      postId: 'p1',
      userId: '1',
    });
  });
});

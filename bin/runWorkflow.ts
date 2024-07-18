import { WorkflowQueue } from '../src/queue/common';
import { Client } from '@temporalio/client';
import { bookmarkReminderWorkflow } from '../src/queue/bookmark/workflows';
import { getReminderWorkflowId } from '../src/queue/bookmark/utils';

const userId = 'B4AdaAXLKy1SdZxDhZwL1';
const postId = 's-UJPyk4i';

const runWorkflow = async () => {
  const afterFiveSeconds = Date.now() + 5000;
  const client = new Client();
  const params = {
    userId,
    postId,
    remindAt: afterFiveSeconds,
  };
  const workflowId = getReminderWorkflowId(params);
  await client.workflow.start(bookmarkReminderWorkflow, {
    args: [params],
    workflowId,
    taskQueue: WorkflowQueue.Bookmark,
  });
};

runWorkflow()
  .then(() => {
    console.log('Workflow started');
  })
  .finally(() => {
    process.exit(1);
  });

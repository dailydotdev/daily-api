import {
  generateWorkflowId,
  WorkflowQueue,
  WorkflowTopic,
  WorkflowTopicScope,
} from '../src/queue/common';
import { Client } from '@temporalio/client';
import { bookmarkReminderWorkflow } from '../src/queue/bookmark/workflows';
import { generateUUID } from '../src/ids';

const userId = 'B4AdaAXLKy1SdZxDhZwL1';
const postId = 's-UJPyk4i';

const runWorkflow = async () => {
  const afterFiveSeconds = new Date(Date.now() + 5000);
  const params = {
    userId,
    postId,
    remindAt: afterFiveSeconds.toISOString(),
  };
  const uuid = generateUUID();
  const workflowId = generateWorkflowId(
    WorkflowTopic.Bookmark,
    WorkflowTopicScope.Reminder,
    [userId, postId, uuid],
  );
  const client = new Client();
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

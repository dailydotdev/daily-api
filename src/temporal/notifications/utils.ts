import {
  generateWorkflowId,
  WorkflowQueue,
  WorkflowTopic,
  WorkflowTopicScope,
} from '../common';
import { BookmarkReminderParams, bookmarkReminderWorkflow } from './workflows';
import { getTemporalClient } from '../client';

export const getReminderWorkflowId = ({
  userId,
  postId,
  remindAt,
}: BookmarkReminderParams) =>
  generateWorkflowId(WorkflowTopic.Notification, WorkflowTopicScope.Bookmark, [
    userId,
    postId,
    remindAt.toString(),
  ]);

export const runReminderWorkflow = async (params: BookmarkReminderParams) => {
  const workflowId = getReminderWorkflowId(params);
  const client = await getTemporalClient();

  return client.workflow.start(bookmarkReminderWorkflow, {
    args: [params],
    workflowId,
    taskQueue: WorkflowQueue.Notification,
  });
};

export const cancelReminderWorkflow = async (
  params: BookmarkReminderParams,
) => {
  const client = await getTemporalClient();
  const workflowId = getReminderWorkflowId(params);
  const handle = client.workflow.getHandle(workflowId);
  const description = await handle.describe();

  if (description.status.name === 'RUNNING') {
    await handle.terminate();
  }
};

import {
  generateWorkflowId,
  getDescribeOrError,
  getWorkflowDescription,
  getWorkflowHandle,
  WorkflowQueue,
  WorkflowTopic,
  WorkflowTopicScope,
} from '../common';
import { BookmarkReminderParams, bookmarkReminderWorkflow } from './workflows';
import { getTemporalClient } from '../client';

interface ReminderWorkflowParams extends BookmarkReminderParams {
  remindAt: number;
}

export const getReminderWorkflowId = ({
  userId,
  postId,
  remindAt,
}: ReminderWorkflowParams) =>
  generateWorkflowId(WorkflowTopic.Notification, WorkflowTopicScope.Bookmark, [
    userId,
    postId,
    remindAt.toString(),
  ]);

export const runReminderWorkflow = async (params: ReminderWorkflowParams) => {
  const workflowId = getReminderWorkflowId(params);
  const client = await getTemporalClient();
  const delay = params.remindAt - Date.now();
  const description = await getWorkflowDescription(workflowId);

  if (description?.status.name === 'RUNNING') {
    return;
  }

  return client.workflow.start(bookmarkReminderWorkflow, {
    args: [params],
    workflowId,
    taskQueue: WorkflowQueue.Notification,
    startDelay: delay,
  });
};

export const cancelReminderWorkflow = async (
  params: ReminderWorkflowParams,
) => {
  const workflowId = getReminderWorkflowId(params);
  const handle = await getWorkflowHandle(workflowId);

  if (!handle) {
    return;
  }

  const description = await getDescribeOrError(handle);

  if (description?.status.name === 'RUNNING') {
    return await handle.terminate();
  }
};

import {
  generateWorkflowId,
  getDescribeOrError,
  getWorkflowDescription,
  getWorkflowHandle,
  WorkflowQueue,
  WorkflowTopic,
  WorkflowTopicScope,
} from '../common';
import {
  BookmarkReminderParams,
  bookmarkReminderWorkflow,
  entityReminderWorkflow,
} from './workflows';
import { getTemporalClient } from '../client';
import type z from 'zod';
import type { entityReminderSchema } from '../../common/schema/reminders';

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

  if (description?.status.name === 'RUNNING' || delay <= 0) {
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

export const getEntityReminderWorkflowId = (
  params: z.infer<typeof entityReminderSchema>,
) => {
  // exclude scheduledAtMs from the workflow ID becausse its always unique
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { scheduledAtMs, ...restParams } = params;

  return generateWorkflowId(
    WorkflowTopic.Notification,
    WorkflowTopicScope.Entity,
    [JSON.stringify(restParams)],
  );
};

export const runEntityReminderWorkflow = async (
  params: z.infer<typeof entityReminderSchema>,
) => {
  const workflowId = getEntityReminderWorkflowId(params);
  const client = await getTemporalClient();
  const description = await getWorkflowDescription(workflowId);

  if (description?.status.name === 'RUNNING' || params.delayMs <= 0) {
    return;
  }

  return client.workflow.start(entityReminderWorkflow, {
    args: [params],
    workflowId,
    taskQueue: WorkflowQueue.Notification,
    startDelay: params.delayMs,
  });
};

export const cancelEntityReminderWorkflow = async (
  params: z.infer<typeof entityReminderSchema>,
) => {
  const workflowId = getEntityReminderWorkflowId(params);
  const handle = await getWorkflowHandle(workflowId);

  if (!handle) {
    return;
  }

  const description = await getDescribeOrError(handle);

  if (description?.status.name === 'RUNNING') {
    return await handle.terminate();
  }
};

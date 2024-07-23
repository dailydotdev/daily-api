import {
  generateWorkflowId,
  WorkflowQueue,
  WorkflowTopic,
  WorkflowTopicScope,
} from '../common';
import { BookmarkReminderParams, bookmarkReminderWorkflow } from './workflows';
import { getTemporalClient } from '../client';
import { logger } from '../../logger';

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
  try {
    const workflowId = getReminderWorkflowId(params);
    const client = await getTemporalClient();
    const delay = params.remindAt - Date.now();

    return client.workflow.start(bookmarkReminderWorkflow, {
      args: [params],
      workflowId,
      taskQueue: WorkflowQueue.Notification,
      startDelay: delay,
    });
  } catch (error) {
    logger.info('error running workflow', error);
  }
};

export const cancelReminderWorkflow = async (
  params: ReminderWorkflowParams,
) => {
  try {
    const client = await getTemporalClient();
    const workflowId = getReminderWorkflowId(params);
    const handle = client.workflow.getHandle(workflowId);
    const description = await handle.describe();

    if (description.status.name === 'RUNNING') {
      await handle.terminate();
    }
  } catch (error) {
    logger.info('error cancelling workflow', error);
  }
};

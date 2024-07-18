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
  generateWorkflowId(WorkflowTopic.Bookmark, WorkflowTopicScope.Reminder, [
    userId,
    postId,
    remindAt.toString(),
  ]);

export const runReminderWorkflow = async (params: BookmarkReminderParams) => {
  const workflowId = getReminderWorkflowId(params);
  const client = await getTemporalClient();
  client.workflow.start(bookmarkReminderWorkflow, {
    args: [params],
    workflowId,
    taskQueue: WorkflowQueue.Bookmark,
  });
};

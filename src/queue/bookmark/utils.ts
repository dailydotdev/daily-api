import {
  generateWorkflowId,
  WorkflowTopic,
  WorkflowTopicScope,
} from '../common';
import { BookmarkReminderParams } from './workflows';

export const getReminderWorkflowId = ({
  userId,
  postId,
}: Pick<BookmarkReminderParams, 'userId' | 'postId'>) =>
  generateWorkflowId(WorkflowTopic.Bookmark, WorkflowTopicScope.Reminder, [
    userId,
    postId,
  ]);

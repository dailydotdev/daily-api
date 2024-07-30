import { DataSource } from 'typeorm';
import { WorkflowHandle } from '@temporalio/client';
import { WorkflowExecutionDescription } from '@temporalio/client/src/types';
import { getTemporalClient } from './client';

export enum WorkflowTopic {
  Notification = 'notification',
}

export enum WorkflowTopicScope {
  Bookmark = 'bookmark',
}

export enum WorkflowQueue {
  Notification = 'notification-queue',
}

export const generateWorkflowId = (
  topic: WorkflowTopic,
  scope: WorkflowTopicScope,
  identifiers: string[],
) => `${topic}:${scope}:${identifiers.join(':')}`;

export interface InjectedProps {
  con: DataSource;
}

export enum TemporalError {
  NotFound = 'WorkflowNotFoundError',
}

export const getWorkflowHandle = async (
  workflowId: string,
): Promise<WorkflowHandle> => {
  const client = await getTemporalClient();

  return client.workflow.getHandle(workflowId);
};

export const getDescribeOrError = (handle: WorkflowHandle) => {
  try {
    return handle.describe();
  } catch (error) {
    if (error.name === TemporalError.NotFound) {
      return;
    }

    throw error;
  }
};

export const getWorkflowDescription = async (
  workflowId: string,
): Promise<WorkflowExecutionDescription> => {
  const handle = await getWorkflowHandle(workflowId);

  return getDescribeOrError(handle);
};

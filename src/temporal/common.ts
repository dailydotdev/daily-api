import { DataSource } from 'typeorm';

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

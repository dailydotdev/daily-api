import { DataSource } from 'typeorm';
import { EventLogger } from '../common';

export enum WorkflowTopic {
  Bookmark = 'bookmark',
}

export enum WorkflowTopicScope {
  Reminder = 'reminder',
}

export enum WorkflowQueue {
  Bookmark = 'bookmark-queue',
}

export const generateWorkflowId = (
  topic: WorkflowTopic,
  scope: WorkflowTopicScope,
  identifiers: string[],
) => `${topic}:${scope}:${identifiers.join(':')}`;

export interface InjectedProps {
  con: DataSource;
}

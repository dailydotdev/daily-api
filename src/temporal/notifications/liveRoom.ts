import { ONE_MINUTE_IN_MS } from '../../common/constants';
import {
  generateWorkflowId,
  getWorkflowDescription,
  WorkflowQueue,
  WorkflowTopic,
  WorkflowTopicScope,
} from '../common';
import { getTemporalClient } from '../client';
import { entityReminderWorkflow } from './workflows';

const LIVE_ROOM_STARTING_SOON_OFFSET_MS = 5 * ONE_MINUTE_IN_MS;

export const getLiveRoomStartingSoonReminderWorkflowId = (roomId: string) =>
  generateWorkflowId(WorkflowTopic.Notification, WorkflowTopicScope.Entity, [
    'live-room-starting-soon',
    roomId,
  ]);

export const scheduleLiveRoomStartingSoonReminder = async ({
  roomId,
  entityTableName,
  scheduledStart,
}: {
  roomId: string;
  entityTableName: string;
  scheduledStart: Date;
}): Promise<void> => {
  const workflowId = getLiveRoomStartingSoonReminderWorkflowId(roomId);
  const description = await getWorkflowDescription(workflowId);
  const scheduledAtMs =
    scheduledStart.getTime() - LIVE_ROOM_STARTING_SOON_OFFSET_MS;
  const delayMs = scheduledAtMs - Date.now();

  if (description?.status.name === 'RUNNING' || delayMs < 0) {
    return;
  }

  const client = await getTemporalClient();

  await client.workflow.start(entityReminderWorkflow, {
    args: [
      {
        entityId: roomId,
        entityTableName,
        scheduledAtMs,
        delayMs,
      },
    ],
    workflowId,
    taskQueue: WorkflowQueue.Notification,
    startDelay: delayMs,
  });
};

import { addMilliseconds } from 'date-fns';
import { Between } from 'typeorm';
import { ONE_MINUTE_IN_MS } from '../common/constants';
import { LiveRoomStatus } from '../common/schema/liveRooms';
import { LiveRoom } from '../entity/LiveRoom';
import {
  generateWorkflowId,
  getWorkflowDescription,
  WorkflowQueue,
  WorkflowTopic,
  WorkflowTopicScope,
} from '../temporal/common';
import { getTemporalClient } from '../temporal/client';
import { entityReminderWorkflow } from '../temporal/notifications/workflows';
import type { Cron } from './cron';
import { getTableName } from '../workers/cdc/common';

const FIVE_MINUTES_IN_MS = 5 * ONE_MINUTE_IN_MS;
const ONE_HOUR_IN_MS = 60 * ONE_MINUTE_IN_MS;
const getLiveRoomReminderWorkflowId = (roomId: string) =>
  generateWorkflowId(WorkflowTopic.Notification, WorkflowTopicScope.Entity, [
    'live-room-starting-soon',
    roomId,
  ]);

const scheduleLiveRoomStartingSoonReminder = async ({
  delayMs,
  entityId,
  entityTableName,
  scheduledAtMs,
}: {
  delayMs: number;
  entityId: string;
  entityTableName: string;
  scheduledAtMs: number;
}): Promise<void> => {
  const workflowId = getLiveRoomReminderWorkflowId(entityId);
  const description = await getWorkflowDescription(workflowId);

  if (description?.status.name === 'RUNNING' || delayMs <= 0) {
    return;
  }

  const client = await getTemporalClient();
  await client.workflow.start(entityReminderWorkflow, {
    args: [
      {
        delayMs,
        entityId,
        entityTableName,
        scheduledAtMs,
      },
    ],
    workflowId,
    taskQueue: WorkflowQueue.Notification,
    startDelay: delayMs,
  });
};

const cron: Cron = {
  name: 'live-room-starting-soon-notifications',
  handler: async (con) => {
    const now = new Date();
    const nowMs = now.getTime();
    const scheduledStartWindowStart = addMilliseconds(now, FIVE_MINUTES_IN_MS);
    const scheduledStartWindowEnd = addMilliseconds(
      now,
      ONE_HOUR_IN_MS + FIVE_MINUTES_IN_MS,
    );
    const entityTableName = getTableName(con, LiveRoom);
    const rooms = await con.getRepository(LiveRoom).find({
      where: {
        status: LiveRoomStatus.Created,
        scheduledStart: Between(
          scheduledStartWindowStart,
          scheduledStartWindowEnd,
        ),
      },
    });

    await Promise.all(
      rooms.map(async (room) => {
        if (!room.scheduledStart) {
          return;
        }
        const scheduledAtMs =
          room.scheduledStart.getTime() - FIVE_MINUTES_IN_MS;

        await scheduleLiveRoomStartingSoonReminder({
          entityId: room.id,
          entityTableName,
          scheduledAtMs,
          delayMs: scheduledAtMs - nowMs,
        });
      }),
    );
  },
};

export default cron;

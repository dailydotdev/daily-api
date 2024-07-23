import { Worker } from '@temporalio/worker';
import { createActivities } from './activities';
import createOrGetConnection from '../../db';
import { WorkflowQueue } from '../common';
import { getTemporalWorkerConnection } from '../worker';
import { TEMPORAL_NAMESPACE } from '../config';

export async function run() {
  const connection = await getTemporalWorkerConnection();
  const dbCon = await createOrGetConnection();
  const worker = await Worker.create({
    connection,
    namespace: TEMPORAL_NAMESPACE,
    workflowsPath: require.resolve('./workflows'),
    taskQueue: WorkflowQueue.Notification,
    activities: createActivities({ con: dbCon }),
  });

  await worker.run();
}

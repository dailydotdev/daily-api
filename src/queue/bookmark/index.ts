import { NativeConnection, Worker } from '@temporalio/worker';
import { createActivities } from './activities';
import createOrGetConnection from '../../db';
import { WorkflowQueue } from '../common';
import { logger } from '../../logger';

export async function run() {
  const connection = await NativeConnection.connect({
    address: 'host.docker.internal:7233',
  });
  const dbCon = await createOrGetConnection();
  const worker = await Worker.create({
    connection,
    workflowsPath: require.resolve('./workflows'),
    taskQueue: WorkflowQueue.Bookmark,
    activities: createActivities({ logger, con: dbCon }),
  });

  await worker.run();
}

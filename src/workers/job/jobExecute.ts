import type { TypedWorker } from '../worker';
import type { DataSource } from 'typeorm';
import { WorkerJob } from '../../entity/WorkerJob';
import { JobStatus, type JobType } from '@dailydotdev/schema';
import type { FastifyBaseLogger } from 'fastify';

type JobHandlerParams = {
  payload: Record<string, unknown>;
  con: DataSource;
  logger: FastifyBaseLogger;
  jobId: string;
};

const getJobHandler = (
  type: JobType,
): ((params: JobHandlerParams) => Promise<Record<string, unknown>>) | null => {
  switch (type) {
    default:
      return null;
  }
};

export const jobExecuteWorker: TypedWorker<'api.v1.worker-job-execute'> = {
  subscription: 'api.worker-job-execute',
  handler: async ({ data }, con, logger) => {
    const { jobId } = data;
    const repo = con.getRepository(WorkerJob);

    const job = await repo.findOneBy({ id: jobId });
    if (!job || job.status !== JobStatus.PENDING) {
      return;
    }

    const handler = getJobHandler(job.type);
    if (!handler) {
      await repo
        .createQueryBuilder()
        .update()
        .set({
          status: JobStatus.FAILED,
          error: `No handler for job type: ${job.type}`,
          completedAt: new Date(),
        })
        .where({ id: jobId })
        .execute();
      return;
    }

    await repo.update(jobId, {
      status: JobStatus.RUNNING,
      startedAt: new Date(),
    });

    try {
      const result = await handler({
        payload: job.payload ?? {},
        con,
        logger,
        jobId: job.id,
      });

      await repo
        .createQueryBuilder()
        .update()
        .set({
          status: JobStatus.COMPLETED,
          result: () => `:result`,
          completedAt: new Date(),
        })
        .where({ id: jobId })
        .setParameter('result', JSON.stringify(result))
        .execute();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      await repo
        .createQueryBuilder()
        .update()
        .set({
          status: JobStatus.FAILED,
          error: errorMessage,
          completedAt: new Date(),
        })
        .where({ id: jobId })
        .execute();

      logger.error({ jobId, type: job.type, err }, 'job failed');
    }
  },
};

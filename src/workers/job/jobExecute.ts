import type { TypedWorker } from '../worker';
import type { DataSource, Repository } from 'typeorm';
import { Not, In } from 'typeorm';
import { WorkerJob } from '../../entity/WorkerJob';
import { WorkerJobStatus, type WorkerJobType } from '@dailydotdev/schema';
import type { FastifyBaseLogger } from 'fastify';

export type JobHandlerParams = {
  input: Record<string, unknown>;
  con: DataSource;
  logger: FastifyBaseLogger;
  jobId: string;
};

const checkParentCompletion = async (
  repo: Repository<WorkerJob>,
  parentId: string,
) => {
  const remaining = await repo.count({
    where: {
      parentId,
      status: Not(In([WorkerJobStatus.COMPLETED, WorkerJobStatus.FAILED])),
    },
  });

  if (remaining === 0) {
    const failedCount = await repo.count({
      where: { parentId, status: WorkerJobStatus.FAILED },
    });

    await repo.update(parentId, {
      status:
        failedCount > 0 ? WorkerJobStatus.FAILED : WorkerJobStatus.COMPLETED,
      completedAt: new Date(),
    });
  }
};

const getJobHandler = (
  type: WorkerJobType,
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
    if (!job || job.status !== WorkerJobStatus.PENDING) {
      return;
    }

    try {
      const handler = getJobHandler(job.type);
      if (!handler) {
        await repo
          .createQueryBuilder()
          .update()
          .set({
            status: WorkerJobStatus.FAILED,
            error: `No handler for job type: ${job.type}`,
            completedAt: new Date(),
          })
          .where({ id: jobId })
          .execute();
        return;
      }

      await repo.update(jobId, {
        status: WorkerJobStatus.RUNNING,
        startedAt: new Date(),
      });

      const result = await handler({
        input: job.input ?? {},
        con,
        logger,
        jobId: job.id,
      });

      await repo
        .createQueryBuilder()
        .update()
        .set({
          status: WorkerJobStatus.COMPLETED,
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
          status: WorkerJobStatus.FAILED,
          error: errorMessage,
          completedAt: new Date(),
        })
        .where({ id: jobId })
        .execute();

      logger.error({ jobId, type: job.type, err }, 'job failed');
    } finally {
      if (job.parentId) {
        await checkParentCompletion(repo, job.parentId);
      }
    }
  },
};

import type { HandlerContext } from '@connectrpc/connect';
import { Code, ConnectError, ConnectRouter } from '@connectrpc/connect';
import { baseRpcContext } from '../../common/connectRpc';
import {
  GetBatchWorkerJobStatusResponse,
  GetWorkerJobStatusResponse,
  WorkerJobService,
  WorkerJobStatus,
} from '@dailydotdev/schema';
import createOrGetConnection from '../../db';
import { WorkerJob } from '../../entity/WorkerJob';

const toUnixTimestamp = (date: Date | null): number | undefined =>
  date ? Math.floor(date.getTime() / 1000) : undefined;

const verifyAuth = (context: HandlerContext) => {
  if (!context.values.get(baseRpcContext).service) {
    throw new ConnectError('unauthenticated', Code.Unauthenticated);
  }
};

export default function workerJobRpc(router: ConnectRouter) {
  router.rpc(
    WorkerJobService,
    WorkerJobService.methods.getJobStatus,
    async (req, context) => {
      verifyAuth(context);

      const con = await createOrGetConnection();
      const job = await con
        .getRepository(WorkerJob)
        .findOneBy({ id: req.jobId });

      if (!job) {
        throw new ConnectError('job not found', Code.NotFound);
      }

      return new GetWorkerJobStatusResponse({
        jobId: job.id,
        type: job.type,
        status: job.status,
        createdAt: Math.floor(job.createdAt.getTime() / 1000),
        startedAt: toUnixTimestamp(job.startedAt),
        completedAt: toUnixTimestamp(job.completedAt),
        error: job.error ?? undefined,
      });
    },
  );

  router.rpc(
    WorkerJobService,
    WorkerJobService.methods.getBatchStatus,
    async (req, context) => {
      verifyAuth(context);

      const con = await createOrGetConnection();
      const repo = con.getRepository(WorkerJob);

      const parent = await repo.findOneBy({ id: req.jobId });
      if (!parent) {
        throw new ConnectError('job not found', Code.NotFound);
      }

      const counts = await repo
        .createQueryBuilder('job')
        .select('job.status', 'status')
        .addSelect('COUNT(*)::int', 'count')
        .where('job.parentId = :parentId', { parentId: parent.id })
        .groupBy('job.status')
        .getRawMany<{ status: number; count: number }>();

      const statusMap = new Map(counts.map((c) => [c.status, c.count]));

      return new GetBatchWorkerJobStatusResponse({
        jobId: parent.id,
        status: parent.status,
        total: counts.reduce((sum, c) => sum + c.count, 0),
        completed: statusMap.get(WorkerJobStatus.COMPLETED) ?? 0,
        failed: statusMap.get(WorkerJobStatus.FAILED) ?? 0,
        pending: statusMap.get(WorkerJobStatus.PENDING) ?? 0,
        running: statusMap.get(WorkerJobStatus.RUNNING) ?? 0,
      });
    },
  );
}

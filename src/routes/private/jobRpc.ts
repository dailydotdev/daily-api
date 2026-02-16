import { Code, ConnectError, ConnectRouter } from '@connectrpc/connect';
import { baseRpcContext } from '../../common/connectRpc';
import { GetJobStatusResponse, JobService } from '@dailydotdev/schema';
import createOrGetConnection from '../../db';
import { Job } from '../../entity/Job';

const toUnixTimestamp = (date: Date | null): number | undefined =>
  date ? Math.floor(date.getTime() / 1000) : undefined;

export default function jobRpc(router: ConnectRouter) {
  router.rpc(JobService, JobService.methods.getStatus, async (req, context) => {
    if (!context.values.get(baseRpcContext).service) {
      throw new ConnectError('unauthenticated', Code.Unauthenticated);
    }

    const con = await createOrGetConnection();
    const job = await con.getRepository(Job).findOneBy({ id: req.jobId });

    if (!job) {
      throw new ConnectError('job not found', Code.NotFound);
    }

    return new GetJobStatusResponse({
      jobId: job.id,
      type: job.type,
      status: job.status,
      createdAt: Math.floor(job.createdAt.getTime() / 1000),
      startedAt: toUnixTimestamp(job.startedAt),
      completedAt: toUnixTimestamp(job.completedAt),
      error: job.error ?? undefined,
    });
  });
}

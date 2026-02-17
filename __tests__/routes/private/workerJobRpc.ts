import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { JobService, JobStatus } from '@dailydotdev/schema';
import {
  CallOptions,
  Code,
  ConnectError,
  createClient,
  createRouterTransport,
} from '@connectrpc/connect';
import workerJobRpc from '../../../src/routes/private/workerJobRpc';
import { baseRpcContext } from '../../../src/common/connectRpc';
import { WorkerJob } from '../../../src/entity/WorkerJob';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const mockTransport = createRouterTransport(workerJobRpc, {
  router: {
    interceptors: [
      (next) => {
        return async (req) => {
          if (
            req.header.get('Authorization') ===
            `Service ${process.env.SERVICE_SECRET}`
          ) {
            req.contextValues.set(baseRpcContext, {
              service: true,
            });
          }
          return next(req);
        };
      },
    ],
  },
});

const defaultClientAuthOptions: CallOptions = {
  headers: {
    Authorization: `Service ${process.env.SERVICE_SECRET}`,
  },
};

describe('JobService.GetStatus', () => {
  const mockClient = createClient(JobService, mockTransport);

  it('should reject unauthenticated requests', async () => {
    await expect(
      mockClient.getStatus({
        jobId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow(
      new ConnectError('unauthenticated', Code.Unauthenticated),
    );
  });

  it('should return not found for non-existent job', async () => {
    await expect(
      mockClient.getStatus(
        { jobId: '00000000-0000-0000-0000-000000000000' },
        defaultClientAuthOptions,
      ),
    ).rejects.toThrow(new ConnectError('job not found', Code.NotFound));
  });

  it('should return job status', async () => {
    const job = await con.getRepository(WorkerJob).save({
      type: 0,
      status: JobStatus.PENDING,
      payload: { key: 'value' },
    });

    const result = await mockClient.getStatus(
      { jobId: job.id },
      defaultClientAuthOptions,
    );

    expect(result).toMatchObject({
      jobId: job.id,
      type: 0,
      status: JobStatus.PENDING,
      createdAt: expect.any(Number),
    });
    expect(result.startedAt).toBeUndefined();
    expect(result.completedAt).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('should return completed job with timestamps', async () => {
    const startedAt = new Date('2025-01-01T00:00:00Z');
    const completedAt = new Date('2025-01-01T00:01:00Z');

    const job = await con.getRepository(WorkerJob).save({
      type: 0,
      status: JobStatus.COMPLETED,
      payload: {},
      result: { downloadUrl: 'https://example.com/file.csv' },
      startedAt,
      completedAt,
    });

    const result = await mockClient.getStatus(
      { jobId: job.id },
      defaultClientAuthOptions,
    );

    expect(result).toMatchObject({
      jobId: job.id,
      status: JobStatus.COMPLETED,
      startedAt: Math.floor(startedAt.getTime() / 1000),
      completedAt: Math.floor(completedAt.getTime() / 1000),
    });
  });

  it('should return failed job with error', async () => {
    const job = await con.getRepository(WorkerJob).save({
      type: 0,
      status: JobStatus.FAILED,
      payload: {},
      error: 'something went wrong',
      completedAt: new Date(),
    });

    const result = await mockClient.getStatus(
      { jobId: job.id },
      defaultClientAuthOptions,
    );

    expect(result).toMatchObject({
      jobId: job.id,
      status: JobStatus.FAILED,
      error: 'something went wrong',
    });
  });
});

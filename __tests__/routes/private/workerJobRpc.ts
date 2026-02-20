import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { WorkerJobService, WorkerJobStatus } from '@dailydotdev/schema';
import {
  CallOptions,
  Code,
  ConnectError,
  createClient,
  createRouterTransport,
} from '@connectrpc/connect';
import { createWorkerJobRpc } from '../../../src/routes/private/workerJobRpc';
import { baseRpcContext } from '../../../src/common/connectRpc';
import { WorkerJob } from '../../../src/entity/WorkerJob';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const workerJobRpc = createWorkerJobRpc((context) => {
  if (!context.values.get(baseRpcContext).service) {
    throw new ConnectError('unauthenticated', Code.Unauthenticated);
  }
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

describe('WorkerJobService.GetJobStatus', () => {
  const mockClient = createClient(WorkerJobService, mockTransport);

  it('should reject unauthenticated requests', async () => {
    await expect(
      mockClient.getJobStatus({
        jobId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow(
      new ConnectError('unauthenticated', Code.Unauthenticated),
    );
  });

  it('should return not found for non-existent job', async () => {
    await expect(
      mockClient.getJobStatus(
        { jobId: '00000000-0000-0000-0000-000000000000' },
        defaultClientAuthOptions,
      ),
    ).rejects.toThrow(new ConnectError('job not found', Code.NotFound));
  });

  it('should return job status', async () => {
    const job = await con.getRepository(WorkerJob).save({
      type: 0,
      status: WorkerJobStatus.PENDING,
      input: { key: 'value' },
    });

    const result = await mockClient.getJobStatus(
      { jobId: job.id },
      defaultClientAuthOptions,
    );

    expect(result).toMatchObject({
      jobId: job.id,
      type: 0,
      status: WorkerJobStatus.PENDING,
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
      status: WorkerJobStatus.COMPLETED,
      input: {},
      result: { downloadUrl: 'https://example.com/file.csv' },
      startedAt,
      completedAt,
    });

    const result = await mockClient.getJobStatus(
      { jobId: job.id },
      defaultClientAuthOptions,
    );

    expect(result).toMatchObject({
      jobId: job.id,
      status: WorkerJobStatus.COMPLETED,
      startedAt: Math.floor(startedAt.getTime() / 1000),
      completedAt: Math.floor(completedAt.getTime() / 1000),
    });
  });

  it('should return failed job with error', async () => {
    const job = await con.getRepository(WorkerJob).save({
      type: 0,
      status: WorkerJobStatus.FAILED,
      input: {},
      error: 'something went wrong',
      completedAt: new Date(),
    });

    const result = await mockClient.getJobStatus(
      { jobId: job.id },
      defaultClientAuthOptions,
    );

    expect(result).toMatchObject({
      jobId: job.id,
      status: WorkerJobStatus.FAILED,
      error: 'something went wrong',
    });
  });
});

describe('WorkerJobService.GetBatchStatus', () => {
  const mockClient = createClient(WorkerJobService, mockTransport);

  it('should reject unauthenticated requests', async () => {
    await expect(
      mockClient.getBatchStatus({
        jobId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow(
      new ConnectError('unauthenticated', Code.Unauthenticated),
    );
  });

  it('should return not found for non-existent parent job', async () => {
    await expect(
      mockClient.getBatchStatus(
        { jobId: '00000000-0000-0000-0000-000000000000' },
        defaultClientAuthOptions,
      ),
    ).rejects.toThrow(new ConnectError('job not found', Code.NotFound));
  });

  it('should return aggregate status counts for batch', async () => {
    const repo = con.getRepository(WorkerJob);

    const parent = await repo.save(
      repo.create({
        type: 0,
        status: WorkerJobStatus.RUNNING,
        input: null,
      }),
    );

    await repo.save([
      repo.create({
        type: 0,
        status: WorkerJobStatus.COMPLETED,
        parentId: parent.id,
        input: {},
        completedAt: new Date(),
      }),
      repo.create({
        type: 0,
        status: WorkerJobStatus.COMPLETED,
        parentId: parent.id,
        input: {},
        completedAt: new Date(),
      }),
      repo.create({
        type: 0,
        status: WorkerJobStatus.FAILED,
        parentId: parent.id,
        input: {},
        completedAt: new Date(),
      }),
      repo.create({
        type: 0,
        status: WorkerJobStatus.PENDING,
        parentId: parent.id,
        input: {},
      }),
      repo.create({
        type: 0,
        status: WorkerJobStatus.RUNNING,
        parentId: parent.id,
        input: {},
      }),
    ]);

    const result = await mockClient.getBatchStatus(
      { jobId: parent.id },
      defaultClientAuthOptions,
    );

    expect(result).toMatchObject({
      jobId: parent.id,
      status: WorkerJobStatus.RUNNING,
      total: 5,
      completed: 2,
      failed: 1,
      pending: 1,
      running: 1,
    });
  });

  it('should return zero counts for batch with no children', async () => {
    const repo = con.getRepository(WorkerJob);

    const parent = await repo.save(
      repo.create({
        type: 0,
        status: WorkerJobStatus.RUNNING,
        input: null,
      }),
    );

    const result = await mockClient.getBatchStatus(
      { jobId: parent.id },
      defaultClientAuthOptions,
    );

    expect(result).toMatchObject({
      jobId: parent.id,
      status: WorkerJobStatus.RUNNING,
      total: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      running: 0,
    });
  });
});

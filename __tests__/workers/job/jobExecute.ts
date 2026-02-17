import { expectSuccessfulTypedBackground } from '../../helpers';
import { jobExecuteWorker as worker } from '../../../src/workers/job/jobExecute';
import { WorkerJob } from '../../../src/entity/WorkerJob';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { workerJobWorkers } from '../../../src/workers';
import { JobStatus } from '@dailydotdev/schema';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('jobExecute worker', () => {
  it('should be registered', () => {
    const registeredWorker = workerJobWorkers.find(
      (item) => item.subscription === worker.subscription,
    );
    expect(registeredWorker).toBeDefined();
  });

  it('should skip if job not found', async () => {
    await expectSuccessfulTypedBackground<'api.v1.worker-job-execute'>(worker, {
      jobId: '00000000-0000-0000-0000-000000000000',
    });
  });

  it('should skip if job is not pending', async () => {
    const job = await con.getRepository(WorkerJob).save(
      con.getRepository(WorkerJob).create({
        type: 0,
        status: JobStatus.RUNNING,
        payload: {},
      }),
    );

    await expectSuccessfulTypedBackground<'api.v1.worker-job-execute'>(worker, {
      jobId: job.id,
    });

    const updated = await con
      .getRepository(WorkerJob)
      .findOneBy({ id: job.id });
    expect(updated?.status).toBe(JobStatus.RUNNING);
  });

  it('should mark job as failed when no handler exists', async () => {
    const job = await con.getRepository(WorkerJob).save(
      con.getRepository(WorkerJob).create({
        type: 0,
        status: JobStatus.PENDING,
        payload: {},
      }),
    );

    await expectSuccessfulTypedBackground<'api.v1.worker-job-execute'>(worker, {
      jobId: job.id,
    });

    const updated = await con
      .getRepository(WorkerJob)
      .findOneBy({ id: job.id });
    expect(updated).toMatchObject({
      status: JobStatus.FAILED,
      error: expect.stringContaining('No handler for job type'),
    });
    expect(updated?.completedAt).toBeTruthy();
  });
});

import { expectSuccessfulTypedBackground } from '../../helpers';
import { jobExecuteWorker as worker } from '../../../src/workers/job/jobExecute';
import { WorkerJob } from '../../../src/entity/WorkerJob';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { workerJobWorkers } from '../../../src/workers';
import { WorkerJobStatus } from '@dailydotdev/schema';

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
        status: WorkerJobStatus.RUNNING,
        input: {},
      }),
    );

    await expectSuccessfulTypedBackground<'api.v1.worker-job-execute'>(worker, {
      jobId: job.id,
    });

    const updated = await con
      .getRepository(WorkerJob)
      .findOneBy({ id: job.id });
    expect(updated?.status).toBe(WorkerJobStatus.RUNNING);
  });

  it('should mark job as failed when no handler exists', async () => {
    const job = await con.getRepository(WorkerJob).save(
      con.getRepository(WorkerJob).create({
        type: 0,
        status: WorkerJobStatus.PENDING,
        input: {},
      }),
    );

    await expectSuccessfulTypedBackground<'api.v1.worker-job-execute'>(worker, {
      jobId: job.id,
    });

    const updated = await con
      .getRepository(WorkerJob)
      .findOneBy({ id: job.id });
    expect(updated).toMatchObject({
      status: WorkerJobStatus.FAILED,
      error: expect.stringContaining('No handler for job type'),
    });
    expect(updated?.completedAt).toBeTruthy();
  });

  it('should mark parent as completed when all children complete', async () => {
    const repo = con.getRepository(WorkerJob);

    const parent = await repo.save(
      repo.create({
        type: 0,
        status: WorkerJobStatus.RUNNING,
        input: null,
      }),
    );

    const child1 = await repo.save(
      repo.create({
        type: 0,
        status: WorkerJobStatus.PENDING,
        parentId: parent.id,
        input: {},
      }),
    );
    const child2 = await repo.save(
      repo.create({
        type: 0,
        status: WorkerJobStatus.PENDING,
        parentId: parent.id,
        input: {},
      }),
    );

    await expectSuccessfulTypedBackground<'api.v1.worker-job-execute'>(worker, {
      jobId: child1.id,
    });

    const parentAfterFirst = await repo.findOneBy({ id: parent.id });
    expect(parentAfterFirst?.status).toBe(WorkerJobStatus.RUNNING);

    await expectSuccessfulTypedBackground<'api.v1.worker-job-execute'>(worker, {
      jobId: child2.id,
    });

    const parentAfterAll = await repo.findOneBy({ id: parent.id });
    expect(parentAfterAll?.status).toBe(WorkerJobStatus.FAILED);
    expect(parentAfterAll?.completedAt).toBeTruthy();
  });

  it('should mark parent as failed when any child fails', async () => {
    const repo = con.getRepository(WorkerJob);

    const parent = await repo.save(
      repo.create({
        type: 0,
        status: WorkerJobStatus.RUNNING,
        input: null,
      }),
    );

    await repo.save(
      repo.create({
        type: 0,
        status: WorkerJobStatus.COMPLETED,
        parentId: parent.id,
        input: {},
        completedAt: new Date(),
      }),
    );
    const child2 = await repo.save(
      repo.create({
        type: 0,
        status: WorkerJobStatus.PENDING,
        parentId: parent.id,
        input: {},
      }),
    );

    await expectSuccessfulTypedBackground<'api.v1.worker-job-execute'>(worker, {
      jobId: child2.id,
    });

    const updatedParent = await repo.findOneBy({ id: parent.id });
    expect(updatedParent?.status).toBe(WorkerJobStatus.FAILED);
    expect(updatedParent?.completedAt).toBeTruthy();
  });

  it('should not update parent when siblings are still pending', async () => {
    const repo = con.getRepository(WorkerJob);

    const parent = await repo.save(
      repo.create({
        type: 0,
        status: WorkerJobStatus.RUNNING,
        input: null,
      }),
    );

    const child1 = await repo.save(
      repo.create({
        type: 0,
        status: WorkerJobStatus.PENDING,
        parentId: parent.id,
        input: {},
      }),
    );
    await repo.save(
      repo.create({
        type: 0,
        status: WorkerJobStatus.PENDING,
        parentId: parent.id,
        input: {},
      }),
    );

    await expectSuccessfulTypedBackground<'api.v1.worker-job-execute'>(worker, {
      jobId: child1.id,
    });

    const updatedParent = await repo.findOneBy({ id: parent.id });
    expect(updatedParent?.status).toBe(WorkerJobStatus.RUNNING);
    expect(updatedParent?.completedAt).toBeNull();
  });
});

import {
  createGarmrMock,
  createMockBragiPipelinesTransport,
  createMockBragiPipelinesNotFoundTransport,
  expectSuccessfulTypedBackground,
} from '../../helpers';
import { jobExecuteWorker as worker } from '../../../src/workers/job/jobExecute';
import { WorkerJob } from '../../../src/entity/WorkerJob';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { Pipelines, WorkerJobStatus, WorkerJobType } from '@dailydotdev/schema';
import { createClient } from '@connectrpc/connect';
import * as bragiClients from '../../../src/integrations/bragi/clients';
import type { ServiceClient } from '../../../src/types';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(() => {
  jest
    .spyOn(bragiClients, 'getBragiClient')
    .mockImplementation((): ServiceClient<typeof Pipelines> => {
      const transport = createMockBragiPipelinesTransport();

      return {
        instance: createClient(Pipelines, transport),
        garmr: createGarmrMock(),
      };
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('findJobVacancies handler', () => {
  it('should call Bragi, save result, and mark COMPLETED', async () => {
    const job = await con.getRepository(WorkerJob).save(
      con.getRepository(WorkerJob).create({
        type: WorkerJobType.FIND_JOB_VACANCIES,
        status: WorkerJobStatus.PENDING,
        input: { companyName: 'Acme Corp', website: 'https://acme.com' },
      }),
    );

    await expectSuccessfulTypedBackground<'api.v1.worker-job-execute'>(worker, {
      jobId: job.id,
    });

    const updated = await con
      .getRepository(WorkerJob)
      .findOneBy({ id: job.id });
    expect(updated).toMatchObject({
      status: WorkerJobStatus.COMPLETED,
      result: {
        id: 'mock-id',
        vacancies: [
          {
            role: 'Senior Engineer',
            seniority: 'Senior',
            stack: ['TypeScript'],
            description: 'Build things',
            sweScore: expect.closeTo(0.9, 1),
          },
        ],
      },
    });
    expect(updated?.startedAt).toBeTruthy();
    expect(updated?.completedAt).toBeTruthy();
  });

  it('should return empty result on NotFound ConnectError from Bragi', async () => {
    jest.restoreAllMocks();
    jest
      .spyOn(bragiClients, 'getBragiClient')
      .mockImplementation((): ServiceClient<typeof Pipelines> => {
        const transport = createMockBragiPipelinesNotFoundTransport();

        return {
          instance: createClient(Pipelines, transport),
          garmr: createGarmrMock(),
        };
      });

    const job = await con.getRepository(WorkerJob).save(
      con.getRepository(WorkerJob).create({
        type: WorkerJobType.FIND_JOB_VACANCIES,
        status: WorkerJobStatus.PENDING,
        input: { companyName: 'Unknown Corp' },
      }),
    );

    await expectSuccessfulTypedBackground<'api.v1.worker-job-execute'>(worker, {
      jobId: job.id,
    });

    const updated = await con
      .getRepository(WorkerJob)
      .findOneBy({ id: job.id });
    expect(updated).toMatchObject({
      status: WorkerJobStatus.COMPLETED,
      result: {},
    });
  });

  it('should mark child COMPLETED and update parent on batch completion', async () => {
    const repo = con.getRepository(WorkerJob);

    const parent = await repo.save(
      repo.create({
        type: WorkerJobType.FIND_JOB_VACANCIES,
        status: WorkerJobStatus.RUNNING,
        input: null,
      }),
    );

    const child = await repo.save(
      repo.create({
        type: WorkerJobType.FIND_JOB_VACANCIES,
        status: WorkerJobStatus.PENDING,
        parentId: parent.id,
        input: { companyName: 'Test Inc' },
      }),
    );

    await expectSuccessfulTypedBackground<'api.v1.worker-job-execute'>(worker, {
      jobId: child.id,
    });

    const updatedChild = await repo.findOneBy({ id: child.id });
    expect(updatedChild?.status).toBe(WorkerJobStatus.COMPLETED);

    const updatedParent = await repo.findOneBy({ id: parent.id });
    expect(updatedParent?.status).toBe(WorkerJobStatus.COMPLETED);
    expect(updatedParent?.completedAt).toBeTruthy();
  });
});

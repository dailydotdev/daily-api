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

describe('findContactActivity handler', () => {
  it('should call Bragi, save result, and mark COMPLETED', async () => {
    const job = await con.getRepository(WorkerJob).save(
      con.getRepository(WorkerJob).create({
        type: WorkerJobType.FIND_CONTACT_ACTIVITY,
        status: WorkerJobStatus.PENDING,
        input: {
          firstName: 'John',
          lastName: 'Doe',
          companyName: 'Acme Corp',
          title: 'CTO',
        },
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
        activities: [
          {
            title: 'Scaling our platform',
            summary: 'Blog post about infrastructure',
            activityType: 'linkedin_post',
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
        type: WorkerJobType.FIND_CONTACT_ACTIVITY,
        status: WorkerJobStatus.PENDING,
        input: {
          firstName: 'John',
          lastName: 'Doe',
          companyName: 'Unknown Corp',
          title: 'CTO',
        },
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
});

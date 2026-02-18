import {
  createGarmrMock,
  createMockBragiPipelinesTransport,
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

describe('findCompanyNews handler', () => {
  it('should call Bragi, save result, and mark COMPLETED', async () => {
    const job = await con.getRepository(WorkerJob).save(
      con.getRepository(WorkerJob).create({
        type: WorkerJobType.FIND_COMPANY_NEWS,
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
        newsItems: [
          {
            headline: 'Acme raises $10M',
            summary: 'Series A funding round',
            newsType: 'funding',
          },
        ],
      },
    });
    expect(updated?.startedAt).toBeTruthy();
    expect(updated?.completedAt).toBeTruthy();
  });
});

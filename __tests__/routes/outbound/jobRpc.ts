import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import {
  WorkerJobService,
  WorkerJobStatus,
  WorkerJobType,
} from '@dailydotdev/schema';
import {
  CallOptions,
  Code,
  ConnectError,
  createClient,
  createRouterTransport,
} from '@connectrpc/connect';
import { createJobRpc } from '../../../src/routes/outbound/jobRpc';
import { outboundRpcContext } from '../../../src/routes/outbound/context';
import { WorkerJob } from '../../../src/entity/WorkerJob';
import { triggerTypedEvent } from '../../../src/common/typedPubsub';

jest.mock('../../../src/common/typedPubsub', () => ({
  ...(jest.requireActual('../../../src/common/typedPubsub') as Record<
    string,
    unknown
  >),
  triggerTypedEvent: jest.fn(),
}));

let con: DataSource;

const outboundSecret = 'topsecret';

beforeAll(async () => {
  process.env.OUTBOUND_SERVICE_SECRET = outboundSecret;
  con = await createOrGetConnection();
});

beforeEach(() => {
  jest.clearAllMocks();
});

const jobRpc = createJobRpc((context) => {
  if (!context.values.get(outboundRpcContext).authorized) {
    throw new ConnectError('unauthenticated', Code.Unauthenticated);
  }
});

const mockTransport = createRouterTransport(jobRpc, {
  router: {
    interceptors: [
      (next) => {
        return async (req) => {
          if (req.header.get('Authorization') === `Bearer ${outboundSecret}`) {
            req.contextValues.set(outboundRpcContext, { authorized: true });
          }
          return next(req);
        };
      },
    ],
  },
});

const mockClient = createClient(WorkerJobService, mockTransport);

const authOptions: CallOptions = {
  headers: { Authorization: `Bearer ${outboundSecret}` },
};

describe('StartFindJobVacanciesBatch', () => {
  it('should reject unauthenticated requests', async () => {
    await expect(
      mockClient.startFindJobVacanciesBatch({ items: [] }),
    ).rejects.toThrow(
      new ConnectError('unauthenticated', Code.Unauthenticated),
    );
  });

  it('should create parent + children and return parent jobId', async () => {
    const result = await mockClient.startFindJobVacanciesBatch(
      {
        items: [
          { companyName: 'Acme Corp', website: 'https://acme.com' },
          { companyName: 'Beta Inc' },
        ],
      },
      authOptions,
    );

    expect(result.jobId).toBeTruthy();

    const repo = con.getRepository(WorkerJob);
    const parent = await repo.findOneBy({ id: result.jobId });
    expect(parent).toMatchObject({
      type: WorkerJobType.FIND_JOB_VACANCIES,
      status: WorkerJobStatus.RUNNING,
    });

    const children = await repo.find({
      where: { parentId: result.jobId },
      order: { createdAt: 'ASC' },
    });
    expect(children).toHaveLength(2);
    expect(children[0]).toMatchObject({
      type: WorkerJobType.FIND_JOB_VACANCIES,
      status: WorkerJobStatus.PENDING,
    });

    expect(triggerTypedEvent).toHaveBeenCalledTimes(2);
  });

  it('should reject batch exceeding max size', async () => {
    const items = Array.from({ length: 101 }, (_, i) => ({
      companyName: `Company ${i}`,
    }));

    await expect(
      mockClient.startFindJobVacanciesBatch({ items }, authOptions),
    ).rejects.toThrow(
      new ConnectError(
        'batch size exceeds maximum of 100',
        Code.InvalidArgument,
      ),
    );
  });
});

describe('GetFindJobVacanciesBatchResult', () => {
  it('should reject unauthenticated requests', async () => {
    await expect(
      mockClient.getFindJobVacanciesBatchResult({
        jobId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow(
      new ConnectError('unauthenticated', Code.Unauthenticated),
    );
  });

  it('should return not found for non-existent job', async () => {
    await expect(
      mockClient.getFindJobVacanciesBatchResult(
        { jobId: '00000000-0000-0000-0000-000000000000' },
        authOptions,
      ),
    ).rejects.toThrow(new ConnectError('job not found', Code.NotFound));
  });

  it('should return children with results and pagination', async () => {
    const repo = con.getRepository(WorkerJob);

    const parent = await repo.save(
      repo.create({
        type: WorkerJobType.FIND_JOB_VACANCIES,
        status: WorkerJobStatus.COMPLETED,
        input: null,
      }),
    );

    await repo.save([
      repo.create({
        type: WorkerJobType.FIND_JOB_VACANCIES,
        status: WorkerJobStatus.COMPLETED,
        parentId: parent.id,
        input: { companyName: 'Acme Corp' },
        result: {
          vacancies: [
            {
              role: 'Engineer',
              seniority: 'Senior',
              stack: ['TypeScript'],
              description: 'Building things',
              sweScore: 0.8,
            },
          ],
        },
        completedAt: new Date(),
      }),
      repo.create({
        type: WorkerJobType.FIND_JOB_VACANCIES,
        status: WorkerJobStatus.FAILED,
        parentId: parent.id,
        input: { companyName: 'Beta Inc' },
        error: 'timeout',
        completedAt: new Date(),
      }),
    ]);

    const result = await mockClient.getFindJobVacanciesBatchResult(
      { jobId: parent.id },
      authOptions,
    );

    expect(result).toMatchObject({
      jobId: parent.id,
      status: WorkerJobStatus.COMPLETED,
      total: 2,
      hasMore: false,
    });
    expect(result.children).toHaveLength(2);

    const completed = result.children.find(
      (c) => c.status === WorkerJobStatus.COMPLETED,
    );
    expect(completed?.results).toHaveLength(1);

    const failed = result.children.find(
      (c) => c.status === WorkerJobStatus.FAILED,
    );
    expect(failed?.error).toBe('timeout');
  });

  it('should return empty children for batch with no items', async () => {
    const repo = con.getRepository(WorkerJob);

    const parent = await repo.save(
      repo.create({
        type: WorkerJobType.FIND_JOB_VACANCIES,
        status: WorkerJobStatus.COMPLETED,
        input: null,
      }),
    );

    const result = await mockClient.getFindJobVacanciesBatchResult(
      { jobId: parent.id },
      authOptions,
    );

    expect(result).toMatchObject({
      jobId: parent.id,
      total: 0,
      hasMore: false,
    });
    expect(result.children).toHaveLength(0);
  });
});

describe('StartFindCompanyNewsBatch', () => {
  it('should create parent + children', async () => {
    const result = await mockClient.startFindCompanyNewsBatch(
      {
        items: [{ companyName: 'Acme Corp' }],
      },
      authOptions,
    );

    expect(result.jobId).toBeTruthy();

    const repo = con.getRepository(WorkerJob);
    const parent = await repo.findOneBy({ id: result.jobId });
    expect(parent?.type).toBe(WorkerJobType.FIND_COMPANY_NEWS);

    const children = await repo.find({ where: { parentId: result.jobId } });
    expect(children).toHaveLength(1);
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
  });
});

describe('StartFindContactActivityBatch', () => {
  it('should create parent + children', async () => {
    const result = await mockClient.startFindContactActivityBatch(
      {
        items: [{ firstName: 'John', companyName: 'Acme Corp' }],
      },
      authOptions,
    );

    expect(result.jobId).toBeTruthy();

    const repo = con.getRepository(WorkerJob);
    const parent = await repo.findOneBy({ id: result.jobId });
    expect(parent?.type).toBe(WorkerJobType.FIND_CONTACT_ACTIVITY);

    const children = await repo.find({ where: { parentId: result.jobId } });
    expect(children).toHaveLength(1);
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
  });
});

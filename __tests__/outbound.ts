import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import { saveFixtures } from './helpers';
import { Source } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import request from 'supertest';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { OpportunityJob } from '../src/entity/opportunities/OpportunityJob';
import { OpportunityState, PreviewType } from '@dailydotdev/schema';
import { ClaimableItem, ClaimableItemTypes } from '../src/entity/ClaimableItem';
import { ValidationError } from 'apollo-server-errors';
import {
  getOpportunityFileBuffer,
  validateOpportunityFileType,
} from '../src/common/opportunity/parse';
import { uploadResumeFromBuffer } from '../src/common/googleCloud';
import { triggerTypedEvent } from '../src/common/typedPubsub';

jest.mock('../src/common/opportunity/parse', () => ({
  ...(jest.requireActual('../src/common/opportunity/parse') as Record<
    string,
    unknown
  >),
  getOpportunityFileBuffer: jest.fn(),
  validateOpportunityFileType: jest.fn(),
}));

jest.mock('../src/common/googleCloud', () => ({
  ...(jest.requireActual('../src/common/googleCloud') as Record<
    string,
    unknown
  >),
  uploadResumeFromBuffer: jest.fn(),
}));

jest.mock('../src/common/typedPubsub', () => ({
  ...(jest.requireActual('../src/common/typedPubsub') as Record<
    string,
    unknown
  >),
  triggerTypedEvent: jest.fn(),
}));

let app: FastifyInstance;
let con: DataSource;

const outboundSecret = 'topsecret';

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
});

describe('POST /outbound/opportunities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 without Bearer auth', async () => {
    const res = await request(app.server)
      .post('/outbound/opportunities')
      .send({ url: 'https://example.com/job.pdf' });

    expect(res.statusCode).toBe(401);
  });

  it('should return 400 for invalid URL', async () => {
    const res = await request(app.server)
      .post('/outbound/opportunities')
      .set('authorization', `Bearer ${outboundSecret}`)
      .set('content-type', 'application/json')
      .send({ url: 'not-a-url' });

    expect(res.statusCode).toBe(400);
  });

  it('should return 400 for invalid email', async () => {
    const res = await request(app.server)
      .post('/outbound/opportunities')
      .set('authorization', `Bearer ${outboundSecret}`)
      .set('content-type', 'application/json')
      .send({ url: 'https://example.com/job.pdf', emails: ['not-an-email'] });

    expect(res.statusCode).toBe(400);
  });

  it('should create opportunity and return opportunityId', async () => {
    jest.mocked(getOpportunityFileBuffer).mockResolvedValue({
      buffer: Buffer.from('test'),
      extension: 'pdf',
    });
    jest
      .mocked(validateOpportunityFileType)
      .mockResolvedValue({ mime: 'application/pdf' });
    jest
      .mocked(uploadResumeFromBuffer)
      .mockResolvedValue('https://storage.example.com/file');
    jest.mocked(triggerTypedEvent).mockResolvedValue(undefined);

    const res = await request(app.server)
      .post('/outbound/opportunities')
      .set('authorization', `Bearer ${outboundSecret}`)
      .set('content-type', 'application/json')
      .send({ url: 'https://example.com/job.pdf' });

    expect(res.statusCode).toBe(201);
    expect(res.body.opportunityId).toBeDefined();
    expect(res.body.state).toBe(OpportunityState.PARSING);

    const opportunity = await con.getRepository(OpportunityJob).findOne({
      where: { id: res.body.opportunityId },
    });
    expect(opportunity).toBeDefined();
    expect(opportunity!.flags.source).toBe('machine');
    expect(opportunity!.flags.sourceUrl).toBe('https://example.com/job.pdf');

    expect(triggerTypedEvent).toHaveBeenCalledWith(
      expect.anything(),
      'api.v1.opportunity-parse',
      { opportunityId: res.body.opportunityId },
    );
  });

  it('should create claimable items for provided emails', async () => {
    jest.mocked(getOpportunityFileBuffer).mockResolvedValue({
      buffer: Buffer.from('test'),
      extension: 'pdf',
    });
    jest
      .mocked(validateOpportunityFileType)
      .mockResolvedValue({ mime: 'application/pdf' });
    jest
      .mocked(uploadResumeFromBuffer)
      .mockResolvedValue('https://storage.example.com/file');
    jest.mocked(triggerTypedEvent).mockResolvedValue(undefined);

    const emails = ['user1@example.com', 'user2@example.com'];
    const res = await request(app.server)
      .post('/outbound/opportunities')
      .set('authorization', `Bearer ${outboundSecret}`)
      .set('content-type', 'application/json')
      .send({ url: 'https://example.com/job.pdf', emails });

    expect(res.statusCode).toBe(201);

    const claimableItems = await con.getRepository(ClaimableItem).find({
      where: { type: ClaimableItemTypes.Opportunity },
    });

    const relatedItems = claimableItems.filter(
      (item) =>
        (item.flags as { opportunityId?: string }).opportunityId ===
        res.body.opportunityId,
    );

    expect(relatedItems).toHaveLength(2);
    expect(relatedItems.map((i) => i.identifier).sort()).toEqual(emails.sort());

    const opportunity = await con.getRepository(OpportunityJob).findOne({
      where: { id: res.body.opportunityId },
    });
    expect(opportunity).toBeDefined();
    expect(opportunity!.flags.public_draft).toBe(true);
  });

  it('should return 400 for validation error', async () => {
    jest.mocked(getOpportunityFileBuffer).mockResolvedValue({
      buffer: Buffer.from('test'),
      extension: 'pdf',
    });
    jest
      .mocked(validateOpportunityFileType)
      .mockRejectedValue(new ValidationError('File type not supported'));

    const res = await request(app.server)
      .post('/outbound/opportunities')
      .set('authorization', `Bearer ${outboundSecret}`)
      .set('content-type', 'application/json')
      .send({ url: 'https://example.com/job.pdf' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('File type not supported');
  });

  it('should set previewType for opportunity', async () => {
    jest.mocked(getOpportunityFileBuffer).mockResolvedValue({
      buffer: Buffer.from('test'),
      extension: 'pdf',
    });
    jest
      .mocked(validateOpportunityFileType)
      .mockResolvedValue({ mime: 'application/pdf' });
    jest
      .mocked(uploadResumeFromBuffer)
      .mockResolvedValue('https://storage.example.com/file');
    jest.mocked(triggerTypedEvent).mockResolvedValue(undefined);

    const res = await request(app.server)
      .post('/outbound/opportunities')
      .set('authorization', `Bearer ${outboundSecret}`)
      .set('content-type', 'application/json')
      .send({
        url: 'https://example.com/job.pdf',
        previewType: PreviewType.ANALYSIS,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.opportunityId).toBeDefined();

    const opportunity = await con.getRepository(OpportunityJob).findOne({
      where: { id: res.body.opportunityId },
    });
    expect(opportunity).toBeDefined();
    expect(opportunity!.flags.preview?.type).toBe(PreviewType.ANALYSIS);
  });
});

describe('GET /outbound/opportunities/:id', () => {
  let testOpportunity: OpportunityJob;

  beforeEach(async () => {
    testOpportunity = await con.getRepository(OpportunityJob).save(
      con.getRepository(OpportunityJob).create({
        state: OpportunityState.DRAFT,
        title: 'Test Opportunity',
        tldr: 'Test description',
        content: {},
        flags: { source: 'machine', sourceUrl: 'https://example.com/test' },
      }),
    );
  });

  afterEach(async () => {
    await con.getRepository(OpportunityJob).delete({ id: testOpportunity.id });
  });

  it('should return 401 without Bearer auth', async () => {
    const res = await request(app.server).get(
      `/outbound/opportunities/${testOpportunity.id}`,
    );

    expect(res.statusCode).toBe(401);
  });

  it('should return 400 for invalid UUID', async () => {
    const res = await request(app.server)
      .get('/outbound/opportunities/not-a-uuid')
      .set('authorization', `Bearer ${outboundSecret}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Invalid opportunity ID');
  });

  it('should return opportunity', async () => {
    const res = await request(app.server)
      .get(`/outbound/opportunities/${testOpportunity.id}`)
      .set('authorization', `Bearer ${outboundSecret}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(testOpportunity.id);
    expect(res.body.title).toBe('Test Opportunity');
    expect(res.body.flags.source).toBe('machine');
  });

  it('should return 404 for non-existent opportunity', async () => {
    const res = await request(app.server)
      .get('/outbound/opportunities/00000000-0000-0000-0000-000000000000')
      .set('authorization', `Bearer ${outboundSecret}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Opportunity not found');
  });
});

describe('outbound RPC auth', () => {
  const rpcPath = (method: string) =>
    `/outbound/rpc/bragi.pipelines.Pipelines/${method}`;

  it.each([
    'FindJobVacancies',
    'FindCompanyNews',
    'FindContactActivity',
    'GenerateRecruiterEmail',
  ])('should return 401 for %s without Bearer token', async (method) => {
    const res = await request(app.server)
      .post(rpcPath(method))
      .set('content-type', 'application/json')
      .send({});

    expect(res.statusCode).toBe(401);
  });
});

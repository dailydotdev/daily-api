import {
  expectSuccessfulTypedBackground,
  saveFixtures,
  createMockBrokkrTransport,
  createGarmrMock,
} from '../../helpers';
import { parseOpportunityWorker as worker } from '../../../src/workers/opportunity/parseOpportunity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { OpportunityJob } from '../../../src/entity/opportunities/OpportunityJob';
import { OpportunityKeyword } from '../../../src/entity/OpportunityKeyword';
import { OpportunityLocation } from '../../../src/entity/opportunities/OpportunityLocation';
import { OpportunityUserRecruiter } from '../../../src/entity/opportunities/user/OpportunityUserRecruiter';
import { DatasetLocation } from '../../../src/entity/dataset/DatasetLocation';
import { User } from '../../../src/entity';
import { usersFixture } from '../../fixture';
import {
  datasetLocationsFixture,
  organizationsFixture,
} from '../../fixture/opportunity';
import {
  OpportunityState,
  OpportunityType,
  OpportunityContent,
  EmploymentType,
  SeniorityLevel,
  LocationType,
  SalaryPeriod,
  BrokkrService,
  Location,
} from '@dailydotdev/schema';
import { RoleType } from '../../../src/common/schema/userCandidate';
import { Storage } from '@google-cloud/storage';
import { Organization } from '../../../src/entity/Organization';
import { RESUME_BUCKET_NAME } from '../../../src/config';
import { createClient } from '@connectrpc/connect';
import type { ServiceClient } from '../../../src/types';
import * as brokkrCommon from '../../../src/common/brokkr';

const mockStorageDownload = jest.fn();
const mockStorageDelete = jest.fn();

// Mock GCS Storage
jest.mock('@google-cloud/storage');

let con: DataSource;
const testOpportunityId = '550e8400-e29b-41d4-a716-446655440000';
const testBlobName = 'opportunity-test-123.pdf';
const testUserId = '1';

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();

  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, DatasetLocation, datasetLocationsFixture);
  await saveFixtures(con, Organization, organizationsFixture);

  // Mock Brokkr client
  const transport = createMockBrokkrTransport();

  const serviceClient = {
    instance: createClient(BrokkrService, transport),
    garmr: createGarmrMock(),
  };

  jest
    .spyOn(brokkrCommon, 'getBrokkrClient')
    .mockImplementation((): ServiceClient<typeof BrokkrService> => {
      return serviceClient;
    });

  // Mock GCS Storage
  const mockFile = {
    download: mockStorageDownload,
    delete: mockStorageDelete,
  };
  const mockBucket = {
    file: jest.fn().mockReturnValue(mockFile),
  };
  (Storage as unknown as jest.Mock).mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue(mockBucket),
  }));

  // Mock GCS operations
  mockStorageDownload.mockResolvedValue([Buffer.from('mock-pdf-content')]);
  mockStorageDelete.mockResolvedValue([]);
});

afterEach(async () => {
  await con.getRepository(OpportunityJob).delete({ id: testOpportunityId });
});

describe('parseOpportunity worker', () => {
  it('should process opportunity successfully', async () => {
    // Spy on Brokkr parseOpportunity
    const parseOpportunitySpy = jest.spyOn(
      brokkrCommon.getBrokkrClient().instance,
      'parseOpportunity',
    );

    // Create opportunity in PARSING state with file data
    await con.getRepository(OpportunityJob).save({
      id: testOpportunityId,
      type: OpportunityType.JOB,
      state: OpportunityState.PARSING,
      title: 'Processing...',
      tldr: '',
      content: new OpportunityContent({}),
      flags: {
        batchSize: 100,
        file: {
          blobName: testBlobName,
          bucketName: RESUME_BUCKET_NAME,
          mimeType: 'application/pdf',
          extension: 'pdf',
          userId: testUserId,
          trackingId: 'anon1',
        },
      },
    });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-parse'>(worker, {
      opportunityId: testOpportunityId,
    });

    // Verify GCS download was called
    expect(mockStorageDownload).toHaveBeenCalled();

    // Verify Brokkr was called
    expect(parseOpportunitySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        blobName: expect.stringContaining('job-opportunity-parse'),
        blob: expect.objectContaining({
          mime: 'application/pdf',
          ext: 'pdf',
          content: expect.any(Buffer),
        }),
      }),
    );

    // Verify opportunity was updated with parsed data
    const opportunity = await con.getRepository(OpportunityJob).findOne({
      where: { id: testOpportunityId },
      relations: [
        'keywords',
        'locations',
        'users',
        'questions',
        'feedbackQuestions',
      ],
    });

    expect(opportunity).toBeDefined();
    expect(opportunity!.state).toBe(OpportunityState.DRAFT);

    // Verify basic fields
    expect(opportunity!.title).toBe('Mocked Opportunity Title');
    expect(opportunity!.tldr).toBe(
      'This is a mocked TL;DR of the opportunity.',
    );

    // Verify keywords
    const keywords = await con.getRepository(OpportunityKeyword).find({
      where: { opportunityId: testOpportunityId },
    });
    expect(keywords).toHaveLength(3);
    expect(keywords.map((k) => k.keyword).sort()).toEqual([
      'mock',
      'opportunity',
      'test',
    ]);

    // Verify meta
    expect(opportunity!.meta).toMatchObject({
      employmentType: EmploymentType.FULL_TIME,
      seniorityLevel: SeniorityLevel.SENIOR,
      roleType: RoleType.Auto,
      salary: {
        min: 1000,
        max: 2000,
        period: SalaryPeriod.MONTHLY,
      },
    });

    // Verify content
    expect(opportunity!.content).toMatchObject({
      overview: {
        content: 'This is the overview of the mocked opportunity.',
        html: '<p>This is the overview of the mocked opportunity.</p>\n',
      },
      responsibilities: {
        content: 'These are the responsibilities of the mocked opportunity.',
        html: '<p>These are the responsibilities of the mocked opportunity.</p>\n',
      },
      requirements: {
        content: 'These are the requirements of the mocked opportunity.',
        html: '<p>These are the requirements of the mocked opportunity.</p>\n',
      },
    });

    // Verify locations
    const locations = await con.getRepository(OpportunityLocation).find({
      where: { opportunityId: testOpportunityId },
      relations: ['location'],
    });
    expect(locations).toHaveLength(1);
    expect(locations[0].type).toBe(LocationType.REMOTE);
    const locationData = await locations[0].location;
    expect(locationData).toMatchObject({
      country: 'USA',
    });

    // Verify questions (empty by default for new opportunities)
    const questions = await opportunity!.questions;
    expect(questions).toHaveLength(0);

    // Verify feedback questions
    const feedbackQuestions = await opportunity!.feedbackQuestions;
    expect(feedbackQuestions).toHaveLength(1);
    expect(feedbackQuestions[0]).toMatchObject({
      title: 'Why did you reject this opportunity?',
      placeholder: `E.g., Not interested in the tech stack, location doesn't work for me, compensation too low...`,
    });

    // Verify file was deleted from GCS and flags.file was cleared
    expect(mockStorageDelete).toHaveBeenCalled();
    expect(opportunity!.flags?.file).toBeNull();

    // Verify recruiter was assigned
    const recruiter = await con
      .getRepository(OpportunityUserRecruiter)
      .findOne({
        where: { opportunityId: testOpportunityId, userId: testUserId },
      });
    expect(recruiter).toBeDefined();
  });

  it('should set ERROR state on Brokkr failure', async () => {
    // Spy on Brokkr parseOpportunity and make it fail
    const parseOpportunitySpy = jest.spyOn(
      brokkrCommon.getBrokkrClient().instance,
      'parseOpportunity',
    );
    parseOpportunitySpy.mockRejectedValue(new Error('Brokkr parsing failed'));

    await con.getRepository(OpportunityJob).save({
      id: testOpportunityId,
      type: OpportunityType.JOB,
      state: OpportunityState.PARSING,
      title: 'Processing...',
      tldr: '',
      content: new OpportunityContent({}),
      flags: {
        batchSize: 100,
        file: {
          blobName: testBlobName,
          bucketName: RESUME_BUCKET_NAME,
          mimeType: 'application/pdf',
          extension: 'pdf',
          trackingId: 'anon1',
        },
      },
    });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-parse'>(worker, {
      opportunityId: testOpportunityId,
    });

    const opportunity = await con.getRepository(OpportunityJob).findOne({
      where: { id: testOpportunityId },
    });

    expect(opportunity!.state).toBe(OpportunityState.ERROR);
    expect(opportunity!.flags?.parseError).toContain('Brokkr parsing failed');
  });

  it('should skip if state is not PARSING', async () => {
    await con.getRepository(OpportunityJob).save({
      id: testOpportunityId,
      type: OpportunityType.JOB,
      state: OpportunityState.DRAFT,
      title: 'Already processed',
      tldr: 'Test',
      content: new OpportunityContent({}),
      flags: {
        batchSize: 100,
      },
    });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-parse'>(worker, {
      opportunityId: testOpportunityId,
    });

    // Verify Brokkr was NOT called
    const parseOpportunitySpy = jest.spyOn(
      brokkrCommon.getBrokkrClient().instance,
      'parseOpportunity',
    );
    expect(parseOpportunitySpy).not.toHaveBeenCalled();
    expect(mockStorageDownload).not.toHaveBeenCalled();

    // Verify opportunity unchanged
    const opportunity = await con.getRepository(OpportunityJob).findOne({
      where: { id: testOpportunityId },
    });
    expect(opportunity!.state).toBe(OpportunityState.DRAFT);
    expect(opportunity!.title).toBe('Already processed');
  });

  it('should handle missing opportunity', async () => {
    // Spy on Brokkr parseOpportunity
    const parseOpportunitySpy = jest.spyOn(
      brokkrCommon.getBrokkrClient().instance,
      'parseOpportunity',
    );

    // Don't create opportunity - use valid UUID that doesn't exist
    await expectSuccessfulTypedBackground<'api.v1.opportunity-parse'>(worker, {
      opportunityId: '550e8400-e29b-41d4-a716-446655440099',
    });

    // Worker should log error and return gracefully
    expect(parseOpportunitySpy).not.toHaveBeenCalled();
  });

  it('should set ERROR state on GCS download failure', async () => {
    mockStorageDownload.mockRejectedValue(new Error('GCS download failed'));

    await con.getRepository(OpportunityJob).save({
      id: testOpportunityId,
      type: OpportunityType.JOB,
      state: OpportunityState.PARSING,
      title: 'Processing...',
      tldr: '',
      content: new OpportunityContent({}),
      flags: {
        batchSize: 100,
        file: {
          blobName: testBlobName,
          bucketName: RESUME_BUCKET_NAME,
          mimeType: 'application/pdf',
          extension: 'pdf',
          trackingId: 'anon1',
        },
      },
    });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-parse'>(worker, {
      opportunityId: testOpportunityId,
    });

    const opportunity = await con.getRepository(OpportunityJob).findOne({
      where: { id: testOpportunityId },
    });

    expect(opportunity!.state).toBe(OpportunityState.ERROR);
    expect(opportunity!.flags?.parseError).toContain('GCS download failed');
  });

  it('should set ERROR state on missing flags.file data', async () => {
    await con.getRepository(OpportunityJob).save({
      id: testOpportunityId,
      type: OpportunityType.JOB,
      state: OpportunityState.PARSING,
      title: 'Processing...',
      tldr: '',
      content: new OpportunityContent({}),
      flags: {
        batchSize: 100,
        // No file data
      },
    });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-parse'>(worker, {
      opportunityId: testOpportunityId,
    });

    const opportunity = await con.getRepository(OpportunityJob).findOne({
      where: { id: testOpportunityId },
    });

    expect(opportunity!.state).toBe(OpportunityState.ERROR);
    expect(opportunity!.flags?.parseError).toContain('Missing file data');
  });

  it('should assign recruiter for authenticated user', async () => {
    await con.getRepository(OpportunityJob).save({
      id: testOpportunityId,
      type: OpportunityType.JOB,
      state: OpportunityState.PARSING,
      title: 'Processing...',
      tldr: '',
      content: new OpportunityContent({}),
      flags: {
        batchSize: 100,
        file: {
          blobName: testBlobName,
          bucketName: RESUME_BUCKET_NAME,
          mimeType: 'application/pdf',
          extension: 'pdf',
          userId: testUserId,
        },
      },
    });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-parse'>(worker, {
      opportunityId: testOpportunityId,
    });

    const recruiter = await con
      .getRepository(OpportunityUserRecruiter)
      .findOne({
        where: { opportunityId: testOpportunityId, userId: testUserId },
      });

    expect(recruiter).toBeDefined();
  });

  it('should link organization if user has one', async () => {
    // Use the organization from the fixture
    const existingOrgId = '550e8400-e29b-41d4-a716-446655440000';

    // First create an opportunity with organization for the user
    const existingOppId = '550e8400-e29b-41d4-a716-446655440001';
    await con.getRepository(OpportunityJob).save({
      id: existingOppId,
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'Existing opportunity',
      tldr: 'Test',
      content: new OpportunityContent({}),
      organizationId: existingOrgId,
      flags: { batchSize: 100 },
    });

    await con.getRepository(OpportunityUserRecruiter).save({
      opportunityId: existingOppId,
      userId: testUserId,
    });

    // Now create new opportunity
    await con.getRepository(OpportunityJob).save({
      id: testOpportunityId,
      type: OpportunityType.JOB,
      state: OpportunityState.PARSING,
      title: 'Processing...',
      tldr: '',
      content: new OpportunityContent({}),
      flags: {
        batchSize: 100,
        file: {
          blobName: testBlobName,
          bucketName: RESUME_BUCKET_NAME,
          mimeType: 'application/pdf',
          extension: 'pdf',
          userId: testUserId,
        },
      },
    });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-parse'>(worker, {
      opportunityId: testOpportunityId,
    });

    const opportunity = await con.getRepository(OpportunityJob).findOne({
      where: { id: testOpportunityId },
    });

    expect(opportunity!.organizationId).toBe(existingOrgId);

    // Cleanup
    await con.getRepository(OpportunityJob).delete({ id: existingOppId });
  });

  it('should handle anonymous user (trackingId only)', async () => {
    await con.getRepository(OpportunityJob).save({
      id: testOpportunityId,
      type: OpportunityType.JOB,
      state: OpportunityState.PARSING,
      title: 'Processing...',
      tldr: '',
      content: new OpportunityContent({}),
      flags: {
        batchSize: 100,
        anonUserId: 'anon1',
        file: {
          blobName: testBlobName,
          bucketName: RESUME_BUCKET_NAME,
          mimeType: 'application/pdf',
          extension: 'pdf',
          trackingId: 'anon1',
        },
      },
    });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-parse'>(worker, {
      opportunityId: testOpportunityId,
    });

    const opportunity = await con.getRepository(OpportunityJob).findOne({
      where: { id: testOpportunityId },
    });

    expect(opportunity!.state).toBe(OpportunityState.DRAFT);
    expect(opportunity!.flags?.anonUserId).toBe('anon1');

    // Verify no recruiter was assigned
    const recruiter = await con
      .getRepository(OpportunityUserRecruiter)
      .findOne({
        where: { opportunityId: testOpportunityId },
      });
    expect(recruiter).toBeNull();
  });

  it('should assign Europe as continent when no country specified', async () => {
    // Create a custom mock with just continent: 'Europe' (no country)
    const transport = createMockBrokkrTransport({
      opportunity: {
        location: [
          new Location({
            continent: 'Europe',
            type: LocationType.REMOTE,
          }),
        ],
      },
    });

    const serviceClient = {
      instance: createClient(BrokkrService, transport),
      garmr: createGarmrMock(),
    };

    jest
      .spyOn(brokkrCommon, 'getBrokkrClient')
      .mockImplementation((): ServiceClient<typeof BrokkrService> => {
        return serviceClient;
      });

    // Add Europe dataset location
    await con.getRepository(DatasetLocation).save({
      continent: 'Europe',
    });

    await con.getRepository(OpportunityJob).save({
      id: testOpportunityId,
      type: OpportunityType.JOB,
      state: OpportunityState.PARSING,
      title: 'Processing...',
      tldr: '',
      content: new OpportunityContent({}),
      flags: {
        batchSize: 100,
        file: {
          blobName: testBlobName,
          bucketName: RESUME_BUCKET_NAME,
          mimeType: 'application/pdf',
          extension: 'pdf',
          userId: testUserId,
        },
      },
    });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-parse'>(worker, {
      opportunityId: testOpportunityId,
    });

    // Verify location was assigned with Europe as continent
    const locations = await con.getRepository(OpportunityLocation).find({
      where: { opportunityId: testOpportunityId },
      relations: ['location'],
    });

    expect(locations).toHaveLength(1);
    expect(locations[0].type).toBe(LocationType.REMOTE);

    const locationData = await locations[0].location;
    expect(locationData.continent).toBe('Europe');
  });
});

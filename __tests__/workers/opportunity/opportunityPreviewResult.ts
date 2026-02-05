import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { opportunityPreviewResultWorker as worker } from '../../../src/workers/opportunity/opportunityPreviewResult';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { User, Organization } from '../../../src/entity';
import { Opportunity } from '../../../src/entity/opportunities/Opportunity';
import { usersFixture } from '../../fixture';
import {
  datasetLocationsFixture,
  opportunitiesFixture,
  organizationsFixture,
} from '../../fixture/opportunity';
import { OpportunityPreviewResult, PreviewType } from '@dailydotdev/schema';
import { OpportunityJob } from '../../../src/entity/opportunities/OpportunityJob';
import { OpportunityPreviewStatus } from '../../../src/common/opportunity/types';
import { DatasetLocation } from '../../../src/entity/dataset/DatasetLocation';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('opportunityPreviewResult worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, DatasetLocation, datasetLocationsFixture);
    await saveFixtures(con, Organization, organizationsFixture);
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Opportunity, opportunitiesFixture);
  });

  it('should save preview result', async () => {
    const applicationScoreData = new OpportunityPreviewResult({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userIds: ['1', '2', '3'],
      totalCount: 3,
    });

    await expectSuccessfulTypedBackground<'gondul.v1.opportunity-preview-results'>(
      worker,
      applicationScoreData,
    );

    const opportunity = await con.getRepository(OpportunityJob).findOne({
      where: {
        id: '550e8400-e29b-41d4-a716-446655440001',
      },
    });

    expect(opportunity).toBeDefined();
    expect(opportunity!.flags.preview).toEqual({
      userIds: ['1', '2', '3'],
      totalCount: 3,
      status: OpportunityPreviewStatus.READY,
    });
  });

  it('should throw error if opportunityId is missing', async () => {
    const applicationScoreData = new OpportunityPreviewResult({
      userIds: ['1', '2', '3'],
      totalCount: 3,
    });

    await expect(
      expectSuccessfulTypedBackground<'gondul.v1.opportunity-preview-results'>(
        worker,
        applicationScoreData,
      ),
    ).rejects.toThrow('Missing opportunityId in opportunity preview result');
  });

  it('should save only first 20 userIds', async () => {
    const applicationScoreData = new OpportunityPreviewResult({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userIds: new Array(25).fill(undefined).map((_, i) => `${i + 1}`),
      totalCount: 3,
    });

    await expectSuccessfulTypedBackground<'gondul.v1.opportunity-preview-results'>(
      worker,
      applicationScoreData,
    );

    const opportunity = await con.getRepository(OpportunityJob).findOne({
      where: {
        id: '550e8400-e29b-41d4-a716-446655440001',
      },
    });

    expect(opportunity).toBeDefined();
    expect(opportunity!.flags.preview?.userIds.length).toBe(20);
  });

  it('should save preview type when provided', async () => {
    const applicationScoreData = new OpportunityPreviewResult({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userIds: ['1', '2', '3'],
      totalCount: 3,
      previewType: PreviewType.ANALYSIS,
    });

    await expectSuccessfulTypedBackground<'gondul.v1.opportunity-preview-results'>(
      worker,
      applicationScoreData,
    );

    const opportunity = await con.getRepository(OpportunityJob).findOne({
      where: {
        id: '550e8400-e29b-41d4-a716-446655440001',
      },
    });

    expect(opportunity).toBeDefined();
    expect(opportunity!.flags.preview).toEqual({
      userIds: ['1', '2', '3'],
      totalCount: 3,
      status: OpportunityPreviewStatus.READY,
      type: PreviewType.ANALYSIS,
    });
  });

  it('should save preview type as default when provided', async () => {
    const applicationScoreData = new OpportunityPreviewResult({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userIds: ['1', '2'],
      totalCount: 2,
      previewType: PreviewType.DEFAULT,
    });

    await expectSuccessfulTypedBackground<'gondul.v1.opportunity-preview-results'>(
      worker,
      applicationScoreData,
    );

    const opportunity = await con.getRepository(OpportunityJob).findOne({
      where: {
        id: '550e8400-e29b-41d4-a716-446655440001',
      },
    });

    expect(opportunity).toBeDefined();
    expect(opportunity!.flags.preview).toEqual({
      userIds: ['1', '2'],
      totalCount: 2,
      status: OpportunityPreviewStatus.READY,
      type: PreviewType.DEFAULT,
    });
  });

  it('should save preview result without type when not provided', async () => {
    const applicationScoreData = new OpportunityPreviewResult({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userIds: ['1'],
      totalCount: 1,
    });

    await expectSuccessfulTypedBackground<'gondul.v1.opportunity-preview-results'>(
      worker,
      applicationScoreData,
    );

    const opportunity = await con.getRepository(OpportunityJob).findOne({
      where: {
        id: '550e8400-e29b-41d4-a716-446655440001',
      },
    });

    expect(opportunity).toBeDefined();
    expect(opportunity!.flags.preview).toEqual({
      userIds: ['1'],
      totalCount: 1,
      status: OpportunityPreviewStatus.READY,
      type: undefined,
    });
  });
});

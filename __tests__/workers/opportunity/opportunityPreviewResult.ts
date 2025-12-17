import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { opportunityPreviewResultWorker as worker } from '../../../src/workers/opportunity/opportunityPreviewResult';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { User, Organization } from '../../../src/entity';
import { Opportunity } from '../../../src/entity/opportunities/Opportunity';
import { usersFixture } from '../../fixture';
import {
  opportunitiesFixture,
  organizationsFixture,
} from '../../fixture/opportunity';
import { OpportunityPreviewResult } from '@dailydotdev/schema';
import { OpportunityJob } from '../../../src/entity/opportunities/OpportunityJob';
import { OpportunityPreviewStatus } from '../../../src/common/opportunity/types';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('opportunityPreviewResult worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
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
});

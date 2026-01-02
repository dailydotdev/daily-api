import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { syncOpportunityRemindersCio as worker } from '../../../src/workers/opportunity/syncOpportunityRemindersCio';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { OpportunityMatch } from '../../../src/entity/OpportunityMatch';
import { User, Organization } from '../../../src/entity';
import { Opportunity } from '../../../src/entity/opportunities/Opportunity';
import { usersFixture } from '../../fixture';
import {
  datasetLocationsFixture,
  opportunitiesFixture,
  organizationsFixture,
  opportunityMatchesFixture,
} from '../../fixture/opportunity';
import { DatasetLocation } from '../../../src/entity/dataset/DatasetLocation';
import { identifyUserOpportunities } from '../../../src/cio';

jest.mock('../../../src/cio', () => ({
  ...jest.requireActual('../../../src/cio'),
  identifyUserOpportunities: jest.fn(),
}));

const mockIdentifyUserOpportunities =
  identifyUserOpportunities as jest.MockedFunction<
    typeof identifyUserOpportunities
  >;

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('syncOpportunityRemindersCio worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, DatasetLocation, datasetLocationsFixture);
    await saveFixtures(con, Organization, organizationsFixture);
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Opportunity, opportunitiesFixture);
    await saveFixtures(con, OpportunityMatch, opportunityMatchesFixture);
  });

  it('should skip syncing when reminders flag did not change', async () => {
    const flagsJson = JSON.stringify({ reminders: true, batchSize: 10 });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-flags-change'>(
      worker,
      {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        before: flagsJson,
        after: flagsJson, // Same flags - reminders didn't change
      },
    );

    // Should not have called identifyUserOpportunities
    expect(mockIdentifyUserOpportunities).not.toHaveBeenCalled();
  });

  it('should sync CIO when reminders flag changes from false to true', async () => {
    const beforeFlags = JSON.stringify({ reminders: false });
    const afterFlags = JSON.stringify({ reminders: true });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-flags-change'>(
      worker,
      {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        before: beforeFlags,
        after: afterFlags,
      },
    );

    // Should have called identifyUserOpportunities for users with pending matches
    expect(mockIdentifyUserOpportunities).toHaveBeenCalledTimes(1);
    expect(mockIdentifyUserOpportunities).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '1',
      }),
    );
  });

  it('should sync CIO when reminders flag changes from true to false', async () => {
    const beforeFlags = JSON.stringify({ reminders: true });
    const afterFlags = JSON.stringify({ reminders: false });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-flags-change'>(
      worker,
      {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        before: beforeFlags,
        after: afterFlags,
      },
    );

    // Should have called identifyUserOpportunities
    expect(mockIdentifyUserOpportunities).toHaveBeenCalledTimes(1);
    expect(mockIdentifyUserOpportunities).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '1',
      }),
    );
  });

  it('should skip syncing when other flags change but reminders stays the same', async () => {
    const beforeFlags = JSON.stringify({ reminders: true, batchSize: 10 });
    const afterFlags = JSON.stringify({ reminders: true, batchSize: 20 });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-flags-change'>(
      worker,
      {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        before: beforeFlags,
        after: afterFlags,
      },
    );

    // Should not have called identifyUserOpportunities since reminders didn't change
    expect(mockIdentifyUserOpportunities).not.toHaveBeenCalled();
  });

  it('should handle null before flags (opportunity creation)', async () => {
    const afterFlags = JSON.stringify({ reminders: true });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-flags-change'>(
      worker,
      {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        before: null,
        after: afterFlags,
      },
    );

    // Should have called identifyUserOpportunities since reminders changed from undefined to true
    expect(mockIdentifyUserOpportunities).toHaveBeenCalledTimes(1);
  });
});

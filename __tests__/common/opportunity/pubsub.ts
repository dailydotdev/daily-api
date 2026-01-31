import { DataSource } from 'typeorm';
import { LocationType } from '@dailydotdev/schema';
import createOrGetConnection from '../../../src/db';
import { saveFixtures } from '../../helpers';
import { notifyJobOpportunity } from '../../../src/common/opportunity/pubsub';
import { OpportunityJob } from '../../../src/entity/opportunities/OpportunityJob';
import { Organization } from '../../../src/entity/Organization';
import { DatasetLocation } from '../../../src/entity/dataset/DatasetLocation';
import { OpportunityLocation } from '../../../src/entity/opportunities/OpportunityLocation';
import { OpportunityKeyword } from '../../../src/entity/OpportunityKeyword';
import {
  datasetLocationsFixture,
  opportunitiesFixture,
  opportunityKeywordsFixture,
  opportunityLocationsFixture,
  organizationsFixture,
} from '../../fixture/opportunity';
import * as typedPubsub from '../../../src/common/typedPubsub';
import { logger } from '../../../src/logger';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();
  await saveFixtures(con, DatasetLocation, datasetLocationsFixture);
  await saveFixtures(con, Organization, organizationsFixture);
  await saveFixtures(con, OpportunityJob, opportunitiesFixture);
  await saveFixtures(con, OpportunityKeyword, opportunityKeywordsFixture);
  await saveFixtures(con, OpportunityLocation, opportunityLocationsFixture);
});

describe('notifyJobOpportunity', () => {
  beforeEach(() => {
    jest.spyOn(typedPubsub, 'triggerTypedEvent').mockResolvedValue(undefined);
  });

  it('should include all locations in the pubsub message', async () => {
    // Add multiple locations to an opportunity
    const opportunityId = '550e8400-e29b-41d4-a716-446655440001';

    // Add a second location to this opportunity
    await con.getRepository(OpportunityLocation).save({
      opportunityId,
      locationId: '660e8400-e29b-41d4-a716-446655440002',
      type: LocationType.HYBRID,
    });

    await notifyJobOpportunity({
      con,
      logger,
      opportunityId,
    });

    expect(typedPubsub.triggerTypedEvent).toHaveBeenCalledTimes(1);
    const [, topic, message] = (typedPubsub.triggerTypedEvent as jest.Mock).mock
      .calls[0];

    expect(topic).toBe('api.v1.opportunity-added');
    expect(message.opportunity.location).toHaveLength(2);

    // Verify both locations are present with correct data
    const locations = message.opportunity.location;
    expect(locations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: 'Norway',
          iso2: 'NO',
          type: LocationType.REMOTE,
        }),
        expect.objectContaining({
          country: 'USA',
          iso2: 'US',
          type: LocationType.HYBRID,
        }),
      ]),
    );
  });

  it('should handle opportunity with single location', async () => {
    const opportunityId = '550e8400-e29b-41d4-a716-446655440001';

    await notifyJobOpportunity({
      con,
      logger,
      opportunityId,
    });

    expect(typedPubsub.triggerTypedEvent).toHaveBeenCalledTimes(1);
    const [, topic, message] = (typedPubsub.triggerTypedEvent as jest.Mock).mock
      .calls[0];

    expect(topic).toBe('api.v1.opportunity-added');
    expect(message.opportunity.location).toHaveLength(1);
    expect(message.opportunity.location[0]).toMatchObject({
      country: 'Norway',
      iso2: 'NO',
      type: LocationType.REMOTE,
    });
  });

  it('should handle opportunity with no locations', async () => {
    const opportunityId = '550e8400-e29b-41d4-a716-446655440001';

    // Remove all locations for this opportunity
    await con.getRepository(OpportunityLocation).delete({ opportunityId });

    await notifyJobOpportunity({
      con,
      logger,
      opportunityId,
    });

    expect(typedPubsub.triggerTypedEvent).toHaveBeenCalledTimes(1);
    const [, , message] = (typedPubsub.triggerTypedEvent as jest.Mock).mock
      .calls[0];

    expect(message.opportunity.location).toHaveLength(0);
  });
});

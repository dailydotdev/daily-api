import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/campaignUpdatedAction';
import { Campaign, Post, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { usersFixture } from '../fixture/user';
import { campaignsFixture } from '../fixture/campaign';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  CampaignUpdateEvent,
  type CampaignStatsUpdateEvent,
} from '../../src/common/campaign/common';
import { CampaignState } from '../../src/entity/campaign/Campaign';

let con: DataSource;

beforeAll(async () => {
  jest.clearAllMocks();
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Post, postsFixture);
  await saveFixtures(con, Campaign, campaignsFixture);
});

describe('campaignUpdatedAction worker', () => {
  it('should update campaign stats when StatsUpdated event is received', async () => {
    const eventData: CampaignStatsUpdateEvent = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.StatsUpdated,
      unique_users: 150,
      data: {
        impressions: 1000,
        clicks: 50,
        unique_users: 150,
      },
      d_update: Date.now(),
    };

    await expectSuccessfulTypedBackground(worker, eventData);

    // Verify campaign flags were updated
    const updatedCampaign = await con
      .getRepository(Campaign)
      .findOneByOrFail({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });

    expect(updatedCampaign.flags).toMatchObject({
      budget: 1000,
      spend: 100,
      impressions: 1000,
      clicks: 50,
      users: 150,
      lastUpdatedAt: expect.any(Date),
    });
  });

  it('should handle campaign completion for Post campaigns', async () => {
    // First, set a campaignId on a post to simulate an active campaign
    await con
      .getRepository(Post)
      .update(
        { id: 'p1' },
        { flags: { campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' } },
      );

    const eventData: CampaignStatsUpdateEvent = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.Completed,
      unique_users: 200,
      data: {
        budget: '10.00',
      },
      d_update: Date.now(),
    };

    await expectSuccessfulTypedBackground(worker, eventData);

    // Verify campaign state was updated to Completed
    const updatedCampaign = await con
      .getRepository(Campaign)
      .findOneByOrFail({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });

    expect(updatedCampaign.state).toBe(CampaignState.Completed);
    expect(updatedCampaign.flags.lastUpdatedAt).toBeInstanceOf(Date);

    // Verify post campaignId was cleared
    const updatedPost = await con
      .getRepository(Post)
      .findOneByOrFail({ id: 'p1' });

    expect(updatedPost.flags?.campaignId).toBeNull();
  });

  it('should handle campaign completion for Squad campaigns', async () => {
    // First, set a campaignId on a source to simulate an active campaign
    await con
      .getRepository(Source)
      .update(
        { id: 'squad' },
        { flags: { campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d481' } },
      );

    const eventData: CampaignStatsUpdateEvent = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
      event: CampaignUpdateEvent.Completed,
      unique_users: 75,
      data: {
        budget: '5.00',
      },
      d_update: Date.now(),
    };

    await expectSuccessfulTypedBackground(worker, eventData);

    // Verify campaign state was updated to Completed
    const updatedCampaign = await con
      .getRepository(Campaign)
      .findOneByOrFail({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d481' });

    expect(updatedCampaign.state).toBe(CampaignState.Completed);
    expect(updatedCampaign.flags.lastUpdatedAt).toBeInstanceOf(Date);

    // Verify source campaignId was cleared
    const updatedSource = await con
      .getRepository(Source)
      .findOneByOrFail({ id: 'squad' });

    expect(updatedSource.flags?.campaignId).toBeNull();
  });

  it('should not process non-handled events', async () => {
    const eventData: CampaignStatsUpdateEvent = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.Started,
      unique_users: 100,
      data: { budget: '10.00', spend: '0.00' },
      d_update: Date.now(),
    };

    await expectSuccessfulTypedBackground(worker, eventData);

    // Verify campaign was not modified
    const campaign = await con
      .getRepository(Campaign)
      .findOneByOrFail({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });

    expect(campaign.state).toBe(CampaignState.Active); // Should remain unchanged
    expect(campaign.flags.lastUpdatedAt).toBeUndefined();
  });

  it('should update campaign state when StateUpdated event is received', async () => {
    const eventData: CampaignStatsUpdateEvent = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.StateUpdated,
      unique_users: 100,
      data: { budget: '15.00', spend: '5.00' },
      d_update: Date.now(),
    };

    await expectSuccessfulTypedBackground(worker, eventData);

    // Verify campaign flags were updated with new budget and spend
    const updatedCampaign = await con
      .getRepository(Campaign)
      .findOneByOrFail({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });

    expect(updatedCampaign.flags).toMatchObject({
      budget: 1500, // $15.00 converted to cores
      spend: 500, // $5.00 converted to cores
      lastUpdatedAt: expect.any(Date),
    });

    // Original budget was 1000, spend was 100 - should be overwritten
    expect(updatedCampaign.flags.budget).not.toBe(1000);
    expect(updatedCampaign.flags.spend).not.toBe(100);
  });

  it('should handle state update with zero values', async () => {
    const eventData: CampaignStatsUpdateEvent = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.StateUpdated,
      unique_users: 0,
      data: { budget: '0.00', spend: '0.00' },
      d_update: Date.now(),
    };

    await expectSuccessfulTypedBackground(worker, eventData);

    // Verify campaign flags were updated
    const updatedCampaign = await con
      .getRepository(Campaign)
      .findOneByOrFail({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });

    expect(updatedCampaign.flags).toMatchObject({
      budget: 0,
      spend: 0,
      lastUpdatedAt: expect.any(Date),
    });
  });

  it('should handle multiple sequential state updates', async () => {
    // First state update
    const firstUpdate: CampaignStatsUpdateEvent = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.StateUpdated,
      unique_users: 100,
      data: { budget: '10.00', spend: '2.50' },
      d_update: Date.now(),
    };

    await expectSuccessfulTypedBackground(worker, firstUpdate);

    // Second state update
    const secondUpdate: CampaignStatsUpdateEvent = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.StateUpdated,
      unique_users: 200,
      data: { budget: '20.00', spend: '7.50' },
      d_update: Date.now() + 1000,
    };

    await expectSuccessfulTypedBackground(worker, secondUpdate);

    // Verify final state reflects the latest update
    const updatedCampaign = await con
      .getRepository(Campaign)
      .findOneByOrFail({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });

    expect(updatedCampaign.flags).toMatchObject({
      budget: 2000, // $20.00 converted to cores
      spend: 750, // $7.50 converted to cores
      lastUpdatedAt: expect.any(Date),
    });
  });

  it('should handle when campaign is not found for stats update', async () => {
    const eventData: CampaignStatsUpdateEvent = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d999', // Non-existent campaign
      event: CampaignUpdateEvent.StatsUpdated,
      unique_users: 100,
      data: {
        impressions: 500,
        clicks: 25,
        unique_users: 100,
      },
      d_update: Date.now(),
    };

    // This should not throw an error since we're using update() which doesn't fail on missing records
    await expectSuccessfulTypedBackground(worker, eventData);
  });

  it('should handle when campaign is not found for state update', async () => {
    const eventData: CampaignStatsUpdateEvent = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d999', // Non-existent campaign
      event: CampaignUpdateEvent.StateUpdated,
      unique_users: 100,
      data: { budget: '10.00', spend: '5.00' },
      d_update: Date.now(),
    };

    // This should not throw an error since we're using update() which doesn't fail on missing records
    await expectSuccessfulTypedBackground(worker, eventData);
  });

  it('should throw when campaign is not found for completion', async () => {
    const eventData: CampaignStatsUpdateEvent = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d999', // Non-existent campaign
      event: CampaignUpdateEvent.Completed,
      unique_users: 100,
      data: {
        budget: '10.00',
      },
      d_update: Date.now(),
    };

    // This should throw because we're using findOneByOrFail()
    await expect(
      expectSuccessfulTypedBackground(worker, eventData),
    ).rejects.toThrow();
  });

  it('should update multiple campaign stats correctly', async () => {
    // First stats update
    const firstUpdate: CampaignStatsUpdateEvent = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.StatsUpdated,
      unique_users: 100,
      data: {
        impressions: 500,
        clicks: 25,
        unique_users: 100,
      },
      d_update: Date.now(),
    };

    await expectSuccessfulTypedBackground(worker, firstUpdate);

    // Second stats update
    const secondUpdate: CampaignStatsUpdateEvent = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.StatsUpdated,
      unique_users: 250,
      data: {
        impressions: 1500,
        clicks: 75,
        unique_users: 250,
      },
      d_update: Date.now() + 1000,
    };

    await expectSuccessfulTypedBackground(worker, secondUpdate);

    // Verify final stats reflect the latest update
    const updatedCampaign = await con
      .getRepository(Campaign)
      .findOneByOrFail({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });

    expect(updatedCampaign.flags).toMatchObject({
      budget: 1000,
      spend: 100,
      impressions: 1500,
      clicks: 75,
      users: 250,
      lastUpdatedAt: expect.any(Date),
    });
  });
});

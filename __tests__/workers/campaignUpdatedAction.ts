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
  type CampaignUpdateEventArgs,
} from '../../src/common/campaign/common';
import { CampaignState } from '../../src/entity/campaign/Campaign';
import { randomUUID } from 'crypto';

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
    const eventData: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.StatsUpdated,
      unique_users: 150,
      data: {
        impressions: 1000,
        clicks: 50,
        unique_users: 150,
      },
      d_update: Date.now() * 1000,
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

    const eventData: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.Completed,
      unique_users: 200,
      data: {
        budget: '10.00',
      },
      d_update: Date.now() * 1000,
    };

    await expectSuccessfulTypedBackground(worker, eventData);

    // Verify campaign state was updated to Completed
    const updatedCampaign = await con
      .getRepository(Campaign)
      .findOneByOrFail({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });

    expect(updatedCampaign.state).toBe(CampaignState.Completed);

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

    const eventData: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
      event: CampaignUpdateEvent.Completed,
      unique_users: 75,
      data: {
        budget: '5.00',
      },
      d_update: Date.now() * 1000,
    };

    await expectSuccessfulTypedBackground(worker, eventData);

    // Verify campaign state was updated to Completed
    const updatedCampaign = await con
      .getRepository(Campaign)
      .findOneByOrFail({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d481' });

    expect(updatedCampaign.state).toBe(CampaignState.Completed);

    // Verify source campaignId was cleared
    const updatedSource = await con
      .getRepository(Source)
      .findOneByOrFail({ id: 'squad' });

    expect(updatedSource.flags?.campaignId).toBeNull();
  });

  it('should not process non-handled events', async () => {
    const eventData: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.Started,
      unique_users: 100,
      data: { budget: '10.00' },
      d_update: Date.now() * 1000,
    };

    await expectSuccessfulTypedBackground(worker, eventData);

    // Verify campaign was not modified
    const campaign = await con
      .getRepository(Campaign)
      .findOneByOrFail({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });

    expect(campaign.state).toBe(CampaignState.Active); // Should remain unchanged
  });

  it('should update campaign spend when BudgetUpdated event is received', async () => {
    const eventData: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.BudgetUpdated,
      unique_users: 100,
      data: { budget: '5.00' }, // Used budget in USD
      d_update: Date.now() * 1000,
    };

    await expectSuccessfulTypedBackground(worker, eventData);

    // Verify campaign spend was updated with used budget
    const updatedCampaign = await con
      .getRepository(Campaign)
      .findOneByOrFail({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });

    expect(updatedCampaign.flags).toMatchObject({
      budget: 1000, // Original budget should remain unchanged
      spend: 500, // $5.00 converted to cores
    });

    // Original spend was 100 - should be overwritten with new used budget
    expect(updatedCampaign.flags.spend).not.toBe(100);
  });

  it('should handle budget update with zero values', async () => {
    const eventData: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.BudgetUpdated,
      unique_users: 0,
      data: { budget: '0.00' }, // Zero used budget
      d_update: Date.now() * 1000,
    };

    await expectSuccessfulTypedBackground(worker, eventData);

    // Verify campaign flags were updated
    const updatedCampaign = await con
      .getRepository(Campaign)
      .findOneByOrFail({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });

    expect(updatedCampaign.flags).toMatchObject({
      budget: 1000,
      spend: 0,
    });
  });

  it('should handle multiple sequential budget updates', async () => {
    // First budget update
    const firstUpdate: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.BudgetUpdated,
      unique_users: 100,
      data: { budget: '2.50' }, // First used budget
      d_update: Date.now() * 1000,
    };

    await expectSuccessfulTypedBackground(worker, firstUpdate);

    // Second budget update
    const secondUpdate: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.BudgetUpdated,
      unique_users: 200,
      data: { budget: '7.50' }, // Updated used budget
      d_update: (Date.now() + 1000) * 1000,
    };

    await expectSuccessfulTypedBackground(worker, secondUpdate);

    // Verify final state reflects the latest update
    const updatedCampaign = await con
      .getRepository(Campaign)
      .findOneByOrFail({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });

    expect(updatedCampaign.flags).toMatchObject({
      budget: 1000, // Original budget remains unchanged
      spend: 750, // $7.50 converted to cores (latest update)
    });
  });

  it('should handle when campaign is not found for stats update', async () => {
    const eventData: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d999', // Non-existent campaign
      event: CampaignUpdateEvent.StatsUpdated,
      unique_users: 100,
      data: {
        impressions: 500,
        clicks: 25,
        unique_users: 100,
      },
      d_update: Date.now() * 1000,
    };

    // This should throw an error since worker now checks campaign existence first
    await expect(
      expectSuccessfulTypedBackground(worker, eventData),
    ).rejects.toThrow(
      'Campaign not found! f47ac10b-58cc-4372-a567-0e02b2c3d999',
    );
  });

  it('should handle when campaign is not found for budget update', async () => {
    const eventData: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d999', // Non-existent campaign
      event: CampaignUpdateEvent.BudgetUpdated,
      unique_users: 100,
      data: { budget: '5.00' }, // Used budget in USD
      d_update: Date.now() * 1000,
    };

    // This should throw an error since worker now checks campaign existence first
    await expect(
      expectSuccessfulTypedBackground(worker, eventData),
    ).rejects.toThrow(
      'Campaign not found! f47ac10b-58cc-4372-a567-0e02b2c3d999',
    );
  });

  it('should throw when campaign is not found for completion', async () => {
    const eventData: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d999', // Non-existent campaign
      event: CampaignUpdateEvent.Completed,
      unique_users: 100,
      data: {
        budget: '10.00',
      },
      d_update: Date.now() * 1000,
    };

    // This should throw an error since worker now checks campaign existence first
    await expect(
      expectSuccessfulTypedBackground(worker, eventData),
    ).rejects.toThrow(
      'Campaign not found! f47ac10b-58cc-4372-a567-0e02b2c3d999',
    );
  });

  it('should throw error for unknown campaign type during completion', async () => {
    // Create a campaign with an unknown type by directly inserting into database
    const unknownCampaignId = 'f47ac10b-58cc-4372-a567-0e02b2c3d999';
    await con.query(
      `INSERT INTO campaign (id, "creativeId", "referenceId", "userId", type, state, "createdAt", "updatedAt", "endedAt", flags) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        unknownCampaignId,
        randomUUID(),
        'ref-id',
        '1',
        'UNKNOWN_TYPE', // Invalid type that's not in CampaignType enum
        'ACTIVE',
        new Date(),
        new Date(),
        new Date(),
        JSON.stringify({ budget: 1000, spend: 0 }),
      ],
    );

    const eventData: CampaignUpdateEventArgs = {
      campaignId: unknownCampaignId,
      event: CampaignUpdateEvent.Completed,
      unique_users: 100,
      data: {
        budget: '5.00',
      },
      d_update: Date.now() * 1000,
    };

    // This should throw an error for unknown campaign type
    await expect(
      expectSuccessfulTypedBackground(worker, eventData),
    ).rejects.toThrow(
      `Completed campaign with unkonwn type: ${unknownCampaignId}`,
    );
  });

  it('should update multiple campaign stats correctly', async () => {
    // First stats update
    const firstUpdate: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.StatsUpdated,
      unique_users: 100,
      data: {
        impressions: 500,
        clicks: 25,
        unique_users: 100,
      },
      d_update: Date.now() * 1000,
    };

    await expectSuccessfulTypedBackground(worker, firstUpdate);

    // Second stats update
    const secondUpdate: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.StatsUpdated,
      unique_users: 250,
      data: {
        impressions: 1500,
        clicks: 75,
        unique_users: 250,
      },
      d_update: (Date.now() + 1000) * 1000,
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
    });
  });
});

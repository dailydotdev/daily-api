import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/campaignUpdatedSlack';
import { Campaign, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { usersFixture } from '../fixture/user';
import { campaignsFixture } from '../fixture/campaign';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  CampaignUpdateEvent,
  type CampaignUpdateEventArgs,
} from '../../src/common/campaign/common';
import { webhooks } from '../../src/common/slack';
import {
  CampaignState,
  CampaignType,
} from '../../src/entity/campaign/Campaign';

// Spy on the webhooks.ads.send method
const mockAdsSend = jest
  .spyOn(webhooks.ads, 'send')
  .mockResolvedValue(undefined);

let con: DataSource;

beforeAll(async () => {
  jest.clearAllMocks();
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Campaign, campaignsFixture);
});

describe('campaignUpdatedSlack worker', () => {
  it('should send a slack notification when a post campaign starts', async () => {
    const eventData: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.Started,
      unique_users: 100,
      data: { budget: '10.00' },
      d_update: Date.now(),
    };

    await expectSuccessfulTypedBackground(worker, eventData);

    expect(mockAdsSend).toHaveBeenCalledWith({
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: ':boost: New boost has started',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*Post:*\n<http://localhost:5002/posts/p1|p1>',
            },
            {
              type: 'mrkdwn',
              text: '*Boosted by:*\n<https://app.daily.dev/1|1>',
            },
          ],
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*Budget:*\n1000 :cores:',
            },
            {
              type: 'mrkdwn',
              text: '*Duration:*\n7 days',
            },
          ],
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*Campaign:*\nf47ac10b-58cc-4372-a567-0e02b2c3d479',
            },
            {
              type: 'mrkdwn',
              text: '*Type:*\nPost',
            },
          ],
        },
      ],
    });
  });

  it('should send a slack notification when a squad campaign starts', async () => {
    const eventData: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
      event: CampaignUpdateEvent.Started,
      unique_users: 50,
      data: { budget: '5.00' },
      d_update: Date.now(),
    };

    await expectSuccessfulTypedBackground(worker, eventData);

    expect(mockAdsSend).toHaveBeenCalledWith({
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: ':boost: New boost has started',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*Squad:*\n<http://localhost:5002/squads/squad|squad>',
            },
            {
              type: 'mrkdwn',
              text: '*Boosted by:*\n<https://app.daily.dev/1|1>',
            },
          ],
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*Budget:*\n500 :cores:',
            },
            {
              type: 'mrkdwn',
              text: '*Duration:*\n3 days',
            },
          ],
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*Campaign:*\nf47ac10b-58cc-4372-a567-0e02b2c3d481',
            },
            {
              type: 'mrkdwn',
              text: '*Type:*\nSquad',
            },
          ],
        },
      ],
    });
  });

  it('should not send notification for non-started events', async () => {
    const eventData: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.Completed,
      unique_users: 200,
      data: { budget: '10.00' },
      d_update: Date.now(),
    };

    await expectSuccessfulTypedBackground(worker, eventData);

    expect(mockAdsSend).not.toHaveBeenCalled();
  });

  it('should not send notification for stats updated events', async () => {
    const eventData: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.StatsUpdated,
      unique_users: 150,
      data: { impressions: 1000, clicks: 50, unique_users: 150 },
      d_update: Date.now(),
    };

    await expectSuccessfulTypedBackground(worker, eventData);

    expect(mockAdsSend).not.toHaveBeenCalled();
  });

  it('should not send notification for state updated events', async () => {
    const eventData: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.BudgetUpdated,
      unique_users: 100,
      data: { budget: '15.00' },
      d_update: Date.now(),
    };

    await expectSuccessfulTypedBackground(worker, eventData);

    expect(mockAdsSend).not.toHaveBeenCalled();
  });

  it('should handle when campaign is not found', async () => {
    const eventData: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d999',
      event: CampaignUpdateEvent.Started,
      unique_users: 100,
      data: { budget: '10.00' },
      d_update: Date.now(),
    };

    await expect(
      expectSuccessfulTypedBackground(worker, eventData),
    ).rejects.toThrow();

    expect(mockAdsSend).not.toHaveBeenCalled();
  });

  it('should handle when source is not found for squad campaign', async () => {
    // Create a campaign with non-existent source
    const campaignWithInvalidSource = {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d485',
      creativeId: 'f47ac10b-58cc-4372-a567-0e02b2c3d486',
      referenceId: 'nonexistent-source',
      userId: '1',
      type: CampaignType.Squad,
      state: CampaignState.Active,
      createdAt: new Date(),
      updatedAt: new Date(),
      endedAt: new Date(),
      flags: { budget: 1000, spend: 0 },
    };

    await saveFixtures(con, Campaign, [campaignWithInvalidSource]);

    const eventData: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d485',
      event: CampaignUpdateEvent.Started,
      unique_users: 100,
      data: { budget: '10.00' },
      d_update: Date.now(),
    };

    await expect(
      expectSuccessfulTypedBackground(worker, eventData),
    ).rejects.toThrow();

    expect(mockAdsSend).not.toHaveBeenCalled();
  });

  it('should skip in development environment', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const eventData: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.Started,
      unique_users: 100,
      data: { budget: '10.00' },
      d_update: Date.now(),
    };

    await expectSuccessfulTypedBackground(worker, eventData);

    expect(mockAdsSend).not.toHaveBeenCalled();

    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  });
});

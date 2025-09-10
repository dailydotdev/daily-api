import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { Campaign, Source, User } from '../../../src/entity';
import worker from '../../../src/workers/notifications/campaignUpdatedAction';
import { campaignsFixture } from '../../fixture/campaign';
import { sourcesFixture } from '../../fixture/source';
import { usersFixture } from '../../fixture/user';
import { workers } from '../../../src/workers/notifications';
import { invokeNotificationWorker, saveFixtures } from '../../helpers';
import { NotificationType } from '../../../src/notifications/common';
import {
  BudgetMilestone,
  CampaignUpdateEvent,
  type CampaignUpdateEventArgs,
} from '../../../src/common/campaign/common';
import { CampaignType } from '../../../src/entity/campaign/Campaign';
import { NotificationCampaignContext } from '../../../src/notifications';
import { SourceType } from '../../../src/entity/Source';

let con: DataSource;

describe('campaignUpdatedAction worker', () => {
  beforeAll(async () => {
    con = await createOrGetConnection();
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, Campaign, campaignsFixture);
  });

  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should handle Post campaign completion', async () => {
    const eventArgs: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.Completed,
      unique_users: 200,
      data: {
        budget: '10.00',
      },
      d_update: Date.now() * 1000,
    };

    const result = await invokeNotificationWorker(worker, eventArgs);

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.CampaignPostCompleted);

    const campaignContext = result![0].ctx as NotificationCampaignContext;
    expect(campaignContext.userIds).toEqual(['1']);
    expect(campaignContext.campaign.id).toEqual(
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    );
    expect(campaignContext.campaign.type).toEqual(CampaignType.Post);
    expect(campaignContext.event).toEqual(CampaignUpdateEvent.Completed);
    expect(campaignContext.source).toBeUndefined();
  });

  it('should handle Squad campaign completion', async () => {
    // Update the source to be a squad for the test
    await con
      .getRepository(Source)
      .update({ id: 'squad' }, { type: SourceType.Squad });

    const eventArgs: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
      event: CampaignUpdateEvent.Completed,
      unique_users: 75,
      data: {
        budget: '5.00',
      },
      d_update: Date.now() * 1000,
    };

    const result = await invokeNotificationWorker(worker, eventArgs);

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.CampaignSquadCompleted);

    const campaignContext = result![0].ctx as NotificationCampaignContext;
    expect(campaignContext.userIds).toEqual(['1']);
    expect(campaignContext.campaign.id).toEqual(
      'f47ac10b-58cc-4372-a567-0e02b2c3d481',
    );
    expect(campaignContext.campaign.type).toEqual(CampaignType.Squad);
    expect(campaignContext.event).toEqual(CampaignUpdateEvent.Completed);
    expect(campaignContext.source).toBeDefined();
    expect(campaignContext.source!.id).toEqual('squad');
  });

  it('should return nothing for non-completed events', async () => {
    const eventArgs: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.Started,
      unique_users: 100,
      data: { budget: '10.00' },
      d_update: Date.now() * 1000,
    };

    const result = await invokeNotificationWorker(worker, eventArgs);

    expect(result).toBeUndefined();
  });

  it('should return nothing when campaign is not found', async () => {
    const eventArgs: CampaignUpdateEventArgs = {
      campaignId: 'c3d4e5f6-a7b8-4012-9abc-def123456789',
      event: CampaignUpdateEvent.Completed,
      unique_users: 100,
      data: { budget: '10.00' },
      d_update: Date.now() * 1000,
    };

    const result = await invokeNotificationWorker(worker, eventArgs);

    expect(result).toBeUndefined();
  });

  it('should handle stats updated events (no-op)', async () => {
    const eventArgs: CampaignUpdateEventArgs = {
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

    const result = await invokeNotificationWorker(worker, eventArgs);

    expect(result).toBeUndefined();
  });

  it('should handle budget updated events without milestone (no-op)', async () => {
    const eventArgs: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.BudgetUpdated,
      unique_users: 100,
      data: { budget: '15.00' },
      d_update: Date.now() * 1000,
    };

    const result = await invokeNotificationWorker(worker, eventArgs);

    expect(result).toBeUndefined();
  });

  it('should handle budget updated events with wrong milestone (no-op)', async () => {
    const eventArgs: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.BudgetUpdated,
      unique_users: 100,
      data: {
        budget: '15.00',
        labels: {
          milestone: '50' as BudgetMilestone, // not the 70% milestone
        },
      },
      d_update: Date.now() * 1000,
    };

    const result = await invokeNotificationWorker(worker, eventArgs);

    expect(result).toBeUndefined();
  });

  it('should handle Post campaign first milestone via budget updated event', async () => {
    const eventArgs: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      event: CampaignUpdateEvent.BudgetUpdated,
      unique_users: 50,
      data: {
        budget: '7.00',
        labels: {
          milestone: BudgetMilestone.Spent70Percent,
        },
      },
      d_update: Date.now() * 1000,
    };

    const result = await invokeNotificationWorker(worker, eventArgs);

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(
      NotificationType.CampaignPostFirstMilestone,
    );

    const campaignContext = result![0].ctx as NotificationCampaignContext;
    expect(campaignContext.userIds).toEqual(['1']);
    expect(campaignContext.campaign.id).toEqual(
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    );
    expect(campaignContext.campaign.type).toEqual(CampaignType.Post);
    expect(campaignContext.event).toEqual(CampaignUpdateEvent.BudgetUpdated);
    expect(campaignContext.source).toBeUndefined();
  });

  it('should handle Squad campaign first milestone via budget updated event', async () => {
    // Update the source to be a squad for the test
    await con
      .getRepository(Source)
      .update({ id: 'squad' }, { type: SourceType.Squad });

    const eventArgs: CampaignUpdateEventArgs = {
      campaignId: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
      event: CampaignUpdateEvent.BudgetUpdated,
      unique_users: 25,
      data: {
        budget: '3.50',
        labels: {
          milestone: BudgetMilestone.Spent70Percent,
        },
      },
      d_update: Date.now() * 1000,
    };

    const result = await invokeNotificationWorker(worker, eventArgs);

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(
      NotificationType.CampaignSquadFirstMilestone,
    );

    const campaignContext = result![0].ctx as NotificationCampaignContext;
    expect(campaignContext.userIds).toEqual(['1']);
    expect(campaignContext.campaign.id).toEqual(
      'f47ac10b-58cc-4372-a567-0e02b2c3d481',
    );
    expect(campaignContext.campaign.type).toEqual(CampaignType.Squad);
    expect(campaignContext.event).toEqual(CampaignUpdateEvent.BudgetUpdated);
    expect(campaignContext.source).toBeDefined();
    expect(campaignContext.source!.id).toEqual('squad');
  });

});

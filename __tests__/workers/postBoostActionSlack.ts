import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postBoostActionSlack';
import { ArticlePost, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { usersFixture } from '../fixture/user';
import { CampaignUpdateAction } from '../../src/integrations/skadi/api/types';
import { webhooks } from '../../src/common/slack';
import { skadiApiClient } from '../../src/integrations/skadi/api/clients';
import { addDays } from 'date-fns';

// Mock the skadi API client
jest.mock('../../src/integrations/skadi/api/clients', () => ({
  skadiApiClient: {
    getCampaignById: jest.fn(),
  },
}));

// Spy on the webhooks.ads.send method
const mockAdsSend = jest
  .spyOn(webhooks.ads, 'send')
  .mockResolvedValue(undefined);

let con: DataSource;

beforeAll(async () => {
  jest.clearAllMocks();
  con = await createOrGetConnection();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
});

describe('postBoostActionSlack worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  it('should send a slack notification when a post boost starts', async () => {
    const mockCampaign = {
      campaignId: 'campaign123',
      postId: 'p1',
      userId: '1',
      status: 'active',
      spend: '0.00',
      budget: '10.00',
      startedAt: new Date().getTime() * 1000,
      endedAt: addDays(new Date(), 1).getTime() * 1000, // 1 day later
      impressions: 0,
      clicks: 0,
    };

    (skadiApiClient.getCampaignById as jest.Mock).mockResolvedValue(
      mockCampaign,
    );

    await expectSuccessfulTypedBackground(worker, {
      postId: 'p1',
      campaignId: 'campaign123',
      userId: '1',
      action: CampaignUpdateAction.Started,
    });

    expect(skadiApiClient.getCampaignById).toHaveBeenCalledWith({
      campaignId: 'campaign123',
      userId: '1',
    });

    expect(mockAdsSend).toHaveBeenCalled();
    expect(mockAdsSend).toHaveBeenCalledWith({
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: ':boost: New post boosted',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Post:*\n<http://localhost:5002/posts/p1|p1>',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Boosted by:*\n<https://app.daily.dev/1|1>',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Budget:*\n1000 :cores:',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Duration:*\n1',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Campaign:*\ncampaign123',
          },
        },
      ],
    });
  });

  it('should not send notification for actions other than "started"', async () => {
    await expectSuccessfulTypedBackground(worker, {
      postId: 'p1',
      campaignId: 'campaign123',
      userId: '1',
      action: CampaignUpdateAction.Completed,
    });

    expect(skadiApiClient.getCampaignById).not.toHaveBeenCalled();
    expect(mockAdsSend).not.toHaveBeenCalled();
  });

  it('should not send notification for "first_milestone" action', async () => {
    await expectSuccessfulTypedBackground(worker, {
      postId: 'p1',
      campaignId: 'campaign123',
      userId: '1',
      action: CampaignUpdateAction.FirstMilestone,
    });

    expect(skadiApiClient.getCampaignById).not.toHaveBeenCalled();
    expect(mockAdsSend).not.toHaveBeenCalled();
  });

  it('should handle when post is not found', async () => {
    await expectSuccessfulTypedBackground(worker, {
      postId: 'nonexistent',
      campaignId: 'campaign123',
      userId: '1',
      action: CampaignUpdateAction.Started,
    });

    expect(skadiApiClient.getCampaignById).not.toHaveBeenCalled();
    expect(mockAdsSend).not.toHaveBeenCalled();
  });

  it('should handle when campaign is not found', async () => {
    (skadiApiClient.getCampaignById as jest.Mock).mockResolvedValue(null);

    await expectSuccessfulTypedBackground(worker, {
      postId: 'p1',
      campaignId: 'nonexistent',
      userId: '1',
      action: CampaignUpdateAction.Started,
    });

    expect(skadiApiClient.getCampaignById).toHaveBeenCalledWith({
      campaignId: 'nonexistent',
      userId: '1',
    });

    expect(mockAdsSend).not.toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
    (skadiApiClient.getCampaignById as jest.Mock).mockRejectedValue(
      new Error('API Error'),
    );

    await expect(
      expectSuccessfulTypedBackground(worker, {
        postId: 'p1',
        campaignId: 'campaign123',
        userId: '1',
        action: CampaignUpdateAction.Started,
      }),
    ).rejects.toThrow('API Error');

    expect(skadiApiClient.getCampaignById).toHaveBeenCalledWith({
      campaignId: 'campaign123',
      userId: '1',
    });

    expect(mockAdsSend).not.toHaveBeenCalled();
  });
});

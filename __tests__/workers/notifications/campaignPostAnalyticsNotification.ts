import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { campaignsFixture, sourcesFixture, usersFixture } from '../../fixture';
import { workers } from '../../../src/workers';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { User } from '../../../src/entity/user/User';
import { Source } from '../../../src/entity/Source';
import { Post } from '../../../src/entity/posts/Post';
import { Campaign, CampaignType } from '../../../src/entity/campaign/Campaign';
import { randomUUID } from 'node:crypto';
import { campaignPostAnalyticsNotification as worker } from '../../../src/workers/notifications/campaignPostAnalyticsNotification';
import { CampaignPost, CampaignSource } from '../../../src/entity';
import { postsFixture } from '../../fixture/post';
import { PostAnalytics } from '../../../src/entity/posts/PostAnalytics';
import { NotificationType } from '../../../src/notifications/common';
import type { NotificationPostAnalyticsContext } from '../../../src/notifications';

let con: DataSource;

describe('campaignPostAnalyticsNotification worker', () => {
  beforeAll(async () => {
    con = await createOrGetConnection();
  });

  beforeEach(async () => {
    jest.resetAllMocks();

    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `cpanw-${item.id}`,
          username: `cpanw-${item.username}`,
        };
      }),
    );
    await saveFixtures(
      con,
      Post,
      postsFixture.map((item) => {
        return {
          ...item,
          id: `cpanw-${item.id}`,
        };
      }),
    );
    await saveFixtures(
      con,
      Campaign,
      campaignsFixture.map((campaign) => {
        return {
          ...campaign,
          id: randomUUID(),
          userId: `cpanw-${campaign.userId}`,
          postId:
            campaign.type === CampaignType.Post
              ? `cpanw-${campaign.referenceId}`
              : null,
        };
      }),
    );
    await saveFixtures(
      con,
      PostAnalytics,
      postsFixture.map((item) => {
        return {
          id: `cpanw-${item.id}`,
          impressions: 12_101,
        };
      }),
    );
  });

  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should not send notification if no campaign found', async () => {
    const result =
      await invokeTypedNotificationWorker<'api.v1.delayed-notification-reminder'>(
        worker,
        {
          entityId: '00000000-0000-0000-0000-000000000000',
          entityTableName: 'campaign',
          scheduledAtMs: 0,
          delayMs: 1_000,
        },
      );

    expect(result).toBeUndefined();
  });

  it('should not send notification if campaign is not for post', async () => {
    const campaign = await con.getRepository(CampaignSource).findOneOrFail({
      where: {
        userId: 'cpanw-1',
      },
    });

    expect(campaign).toBeDefined();

    const result =
      await invokeTypedNotificationWorker<'api.v1.delayed-notification-reminder'>(
        worker,
        {
          entityId: campaign.id,
          entityTableName: 'campaign',
          scheduledAtMs: 0,
          delayMs: 1_000,
        },
      );

    expect(result).toBeUndefined();
  });

  it('should throw if no post analytics found', async () => {
    const campaign = await con.getRepository(CampaignPost).findOneOrFail({
      where: {
        userId: 'cpanw-1',
      },
    });

    expect(campaign?.postId).toBeDefined();

    await con.getRepository(PostAnalytics).delete({
      id: campaign.postId as string,
    });

    await expect(
      invokeTypedNotificationWorker<'api.v1.delayed-notification-reminder'>(
        worker,
        {
          entityId: campaign.id,
          entityTableName: 'campaign',
          scheduledAtMs: 0,
          delayMs: 1_000,
        },
      ),
    ).rejects.toThrow('Post analytics not found for post');
  });

  it('should send notification', async () => {
    const campaign = await con.getRepository(CampaignPost).findOneOrFail({
      where: {
        userId: 'cpanw-1',
      },
    });

    expect(campaign).toBeDefined();

    const result =
      await invokeTypedNotificationWorker<'api.v1.delayed-notification-reminder'>(
        worker,
        {
          entityId: campaign.id,
          entityTableName: 'campaign',
          scheduledAtMs: 0,
          delayMs: 1_000,
        },
      );

    expect(result).toHaveLength(1);
    const notification = result![0];

    expect(notification.type).toBe(NotificationType.PostAnalytics);
    expect(notification.ctx).toBeDefined();

    const notificationContext =
      notification.ctx as NotificationPostAnalyticsContext;

    expect(notificationContext.userIds).toEqual(['cpanw-1']);
    expect(notificationContext.analytics?.impressions).toBe(12_101);

    expect(notificationContext.post?.id).toBe(campaign.postId);
    const post = await con.getRepository(Post).findOneOrFail({
      where: { id: campaign.postId as string },
    });
    expect(notificationContext.source?.id).toBe(post.sourceId);
  });
});

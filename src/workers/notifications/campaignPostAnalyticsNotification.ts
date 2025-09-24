import { CampaignPost } from '../../entity/campaign/CampaignPost';
import { PostAnalytics } from '../../entity/posts/PostAnalytics';
import { User } from '../../entity/user/User';
import type { NotificationPostAnalyticsContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { TypedNotificationWorker } from '../worker';
import { buildPostContext } from './utils';

const impressionsThreshold = 10_000;

export const campaignPostAnalyticsNotification: TypedNotificationWorker<'api.v1.delayed-notification-reminder'> =
  {
    subscription: 'api.campaign-post-analytics-notification',
    handler: async (data, con) => {
      if (
        data.entityTableName !==
        con.getRepository(CampaignPost).metadata.tableName
      ) {
        return;
      }

      const campaign: Pick<CampaignPost, 'id' | 'userId' | 'postId'> | null =
        await con.getRepository(CampaignPost).findOne({
          select: ['id', 'userId', 'postId'],
          where: { id: data.entityId },
        });

      if (!campaign) {
        return;
      }

      const user: Pick<User, 'id'> | null = await con
        .getRepository(User)
        .findOne({
          select: ['id'],
          where: { id: campaign.userId },
        });

      if (!user) {
        return;
      }

      if (!campaign.postId) {
        return;
      }

      const [postCtx, postAnalytics] = await Promise.all([
        buildPostContext(con, campaign.postId),
        con.getRepository(PostAnalytics).findOne({
          select: ['impressions'],
          where: { id: campaign.postId },
        }) as Promise<Pick<PostAnalytics, 'impressions'> | null>,
      ]);

      if (!postCtx) {
        return;
      }

      if (!postAnalytics) {
        throw new Error('Post analytics not found for post');
      }

      if (postAnalytics.impressions < impressionsThreshold) {
        return;
      }

      const notificationContext: NotificationPostAnalyticsContext = {
        ...postCtx,
        userIds: [user.id],
        analytics: postAnalytics,
      };

      return [
        {
          type: NotificationType.PostAnalytics,
          ctx: notificationContext,
        },
      ];
    },
  };

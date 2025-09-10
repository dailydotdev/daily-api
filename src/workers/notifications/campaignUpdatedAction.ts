import { Campaign, Source } from '../../entity';
import { NotificationType } from '../../notifications/common';
import { generateTypedNotificationWorker } from './worker';
import {
  isSquadCampaignNotification,
  type NotificationCampaignContext,
  type NotificationCampaignSourceContext,
} from '../../notifications';
import { queryReadReplica } from '../../common/queryReadReplica';
import {
  BudgetMilestone,
  CampaignUpdateEvent,
  type CampaignBudgetUpdate,
  type CampaignUpdateEventArgs,
} from '../../common/campaign/common';
import { CampaignType } from '../../entity/campaign/Campaign';
import { type DataSource } from 'typeorm';
import { logger } from '../../logger';
import type { TypeORMQueryFailedError } from '../../errors';

const worker = generateTypedNotificationWorker<'skadi.v2.campaign-updated'>({
  subscription: 'api.campaign-updated-v2-notification',
  handler: async (params, con) => {
    const { event } = params;

    try {
      const campaign = await con.getRepository(Campaign).findOneOrFail({
        where: { id: params.campaignId },
        relations: ['user'],
      });

      switch (event) {
        case CampaignUpdateEvent.Completed:
          return handleCampaignCompleted({ con, params, campaign });
        case CampaignUpdateEvent.BudgetUpdated:
          const data = params.data as CampaignBudgetUpdate;
          if (data.labels?.milestone === BudgetMilestone.Spent70Percent) {
            return handleCampaignFirstMilestone({ con, params, campaign });
          }
          break;
        default:
          return;
      }
    } catch (originalError) {
      const err = originalError as TypeORMQueryFailedError;

      if (err?.name === 'EntityNotFoundError') {
        // some campaigns do not exist on API so just warn in case we need to check later
        logger.warn({ err, params }, 'could not find campaign');

        return;
      }

      throw err;
    }
  },
});

interface GenerateNotificationProps {
  con: DataSource;
  params: CampaignUpdateEventArgs;
  campaign: Campaign;
}

const campaignTypeToNotification: Record<CampaignType, NotificationType> = {
  [CampaignType.Post]: NotificationType.CampaignPostCompleted,
  [CampaignType.Squad]: NotificationType.CampaignSquadCompleted,
};

const getCampaignContext = async ({
  con,
  params,
  campaign,
}: GenerateNotificationProps) => {
  const { event } = params;
  const user = await campaign.user;
  const ctx: NotificationCampaignContext | NotificationCampaignSourceContext = {
    user,
    campaign,
    event,
    userIds: [campaign.userId],
  };

  if (isSquadCampaignNotification(ctx)) {
    const source = await queryReadReplica(con, ({ queryRunner }) => {
      return queryRunner.manager
        .getRepository(Source)
        .findOneByOrFail({ id: campaign.referenceId });
    });

    ctx.source = source;
  }

  return { ctx };
};

const handleCampaignCompleted = async ({
  con,
  params,
  campaign,
}: GenerateNotificationProps) => {
  try {
    const { ctx } = await getCampaignContext({ con, params, campaign });

    return [{ type: campaignTypeToNotification[campaign.type], ctx }];
  } catch (error) {
    const err = error as TypeORMQueryFailedError;

    if (err?.name === 'EntityNotFoundError') {
      logger.warn(
        { err, campaignId: campaign.id, sourceId: campaign.referenceId },
        'could not find source for squad campaign completed notification',
      );
    }
  }
};

const campaignMilestoneToNotification: Record<CampaignType, NotificationType> =
  {
    [CampaignType.Post]: NotificationType.CampaignPostFirstMilestone,
    [CampaignType.Squad]: NotificationType.CampaignSquadFirstMilestone,
  };

const handleCampaignFirstMilestone = async ({
  con,
  params,
  campaign,
}: GenerateNotificationProps) => {
  try {
    const { ctx } = await getCampaignContext({ con, params, campaign });

    return [{ type: campaignMilestoneToNotification[campaign.type], ctx }];
  } catch (error) {
    const err = error as TypeORMQueryFailedError;

    if (err?.name === 'EntityNotFoundError') {
      logger.warn(
        { err, campaignId: campaign.id, sourceId: campaign.referenceId },
        'could not find source for squad campaign first milestone notification',
      );
    }
  }
};

export default worker;

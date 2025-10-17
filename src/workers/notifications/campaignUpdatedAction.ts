import { Campaign, Source } from '../../entity';
import { NotificationType } from '../../notifications/common';
import { TypedNotificationWorker } from '../worker';
import {
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
import type { TypeORMQueryFailedError } from '../../errors';

const worker: TypedNotificationWorker<'skadi.v2.campaign-updated'> = {
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
        return;
      }

      throw err;
    }
  },
};

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
  const ctx: NotificationCampaignContext = {
    user,
    campaign,
    event,
    userIds: [campaign.userId],
  };

  if (campaign.type === CampaignType.Squad) {
    (ctx as NotificationCampaignSourceContext).source = await queryReadReplica(
      con,
      ({ queryRunner }) => {
        return queryRunner.manager
          .getRepository(Source)
          .findOneByOrFail({ id: campaign.referenceId });
      },
    );
  }

  return { ctx };
};

const handleCampaignCompleted = async ({
  con,
  params,
  campaign,
}: GenerateNotificationProps) => {
  const { ctx } = await getCampaignContext({ con, params, campaign });

  return [{ type: campaignTypeToNotification[campaign.type], ctx }];
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
  const { ctx } = await getCampaignContext({ con, params, campaign });

  return [{ type: campaignMilestoneToNotification[campaign.type], ctx }];
};

export default worker;

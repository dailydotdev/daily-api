import { Campaign, Source } from '../../entity';
import { NotificationType } from '../../notifications/common';
import { generateTypedNotificationWorker } from './worker';
import { type NotificationCampaignContext } from '../../notifications';
import { queryReadReplica } from '../../common/queryReadReplica';
import {
  CampaignUpdateEvent,
  type CampaignUpdateEventArgs,
} from '../../common/campaign/common';
import { CampaignType } from '../../entity/campaign/Campaign';
import type { DataSource } from 'typeorm';

const worker = generateTypedNotificationWorker<'skadi.v2.campaign-updated'>({
  subscription: 'api.campaign-updated-v2-notification',
  handler: async (params, con) => {
    const { event } = params;

    switch (event) {
      case CampaignUpdateEvent.Completed:
        return handleCampaignCompleted(con, params);
      default:
        return;
    }
  },
});

const handleCampaignCompleted = async (
  con: DataSource,
  params: CampaignUpdateEventArgs,
) => {
  const { campaignId, event } = params;

  const campaign = await queryReadReplica(con, async ({ queryRunner }) =>
    queryRunner.manager
      .getRepository(Campaign)
      .findOneOrFail({ where: { id: campaignId }, relations: ['user'] }),
  );

  if (!campaign) {
    return;
  }

  const user = await campaign.user;

  const ctx: NotificationCampaignContext = {
    user,
    campaign,
    event,
    userIds: [campaign.userId],
  };

  if (campaign.type === CampaignType.Squad) {
    ctx.source = await queryReadReplica(con, ({ queryRunner }) => {
      return queryRunner.manager
        .getRepository(Source)
        .findOneByOrFail({ id: campaign.referenceId });
    });
  }

  return [{ type: NotificationType.CampaignCompleted, ctx }];
};

export default worker;

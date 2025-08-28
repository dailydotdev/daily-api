import { Campaign, Source, User } from '../../entity';
import { NotificationType } from '../../notifications/common';
import { generateTypedNotificationWorker } from './worker';
import { type NotificationCampaignContext } from '../../notifications';
import { queryReadReplica } from '../../common/queryReadReplica';
import {
  CampaignUpdateEvent,
  type CampaignStatsUpdateEvent,
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
  params: CampaignStatsUpdateEvent,
) => {
  const { campaignId, event } = params;

  const [campaign, user] = await queryReadReplica(con, ({ queryRunner }) => {
    const promises: Promise<[Campaign, User]> = Promise.all([
      queryRunner.manager
        .getRepository(Campaign)
        .findOneByOrFail({ id: campaignId }),
      queryRunner.manager
        .getRepository(User)
        .findOneByOrFail({ id: campaign.userId }),
    ]);

    return promises;
  });

  let source = undefined;
  if (campaign.type === CampaignType.Squad) {
    source = await queryReadReplica(con, ({ queryRunner }) => {
      return queryRunner.manager
        .getRepository(Source)
        .findOneByOrFail({ id: campaign.referenceId });
    });
  }

  const ctx: NotificationCampaignContext = {
    user,
    campaign,
    source,
    event,
    userIds: [campaign.userId],
  };

  return [{ type: NotificationType.CampaignCompleted, ctx }];
};

export default worker;

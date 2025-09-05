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

const handleCampaignCompleted = async ({
  con,
  params,
  campaign,
}: {
  con: DataSource;
  params: CampaignUpdateEventArgs;
  campaign: Campaign;
}) => {
  const { event } = params;

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

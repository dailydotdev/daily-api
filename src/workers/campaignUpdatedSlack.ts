import { TypedWorker } from './worker';
import {
  Campaign,
  CampaignType,
  Source,
  type ConnectionManager,
} from '../entity';
import type { DataSource } from 'typeorm';
import {
  getDiscussionLink,
  getSourceLink,
  notifyNewPostBoostedSlack,
} from '../common';
import {
  CampaignUpdateEvent,
  type CampaignStatsUpdateEvent,
} from '../common/campaign/common';
import { logger } from '../logger';

const worker: TypedWorker<'skadi.v2.campaign-updated'> = {
  subscription: 'api.campaign-updated-slack',
  handler: async (message, con): Promise<void> => {
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    switch (message.data.event) {
      case CampaignUpdateEvent.Started:
        return handleCampaignStarted(
          con,
          message.data as CampaignStatsUpdateEvent,
        );
      default:
        return;
    }
  },
};

export default worker;

const getMdLink = async (con: ConnectionManager, campaign: Campaign) => {
  switch (campaign.type) {
    case CampaignType.Post:
      return `<${getDiscussionLink(campaign.referenceId)}|${campaign.referenceId}>`;
    case CampaignType.Squad:
      const source = await con
        .getRepository(Source)
        .findOneByOrFail({ id: campaign.referenceId });
      return `<${getSourceLink(source)}|${source.handle}>`;
    default:
      logger.warn({ campaign }, `Started campaign with unkonwn type`);
  }
};

const handleCampaignStarted = async (
  con: DataSource,
  data: CampaignStatsUpdateEvent,
) => {
  const campaign = await con
    .getRepository(Campaign)
    .findOneByOrFail({ id: data.campaignId });

  const mdLink = await getMdLink(con, campaign);

  if (!mdLink) {
    return;
  }

  await notifyNewPostBoostedSlack({
    mdLink,
    campaign,
  });
};

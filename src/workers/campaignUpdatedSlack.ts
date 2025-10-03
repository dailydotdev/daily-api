import { TypedWorker } from './worker';
import {
  Campaign,
  CampaignType,
  Source,
  type ConnectionManager,
  Feature,
  FeatureType,
} from '../entity';
import { type DataSource } from 'typeorm';
import {
  getDiscussionLink,
  getSourceLink,
  notifyNewPostBoostedSlack,
} from '../common';
import {
  CampaignUpdateEvent,
  type CampaignUpdateEventArgs,
} from '../common/campaign/common';
import { logger } from '../logger';
import type { TypeORMQueryFailedError } from '../errors';

const worker: TypedWorker<'skadi.v2.campaign-updated'> = {
  subscription: 'api.campaign-updated-v2-slack',
  handler: async (params, con): Promise<void> => {
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    try {
      const campaign = await con
        .getRepository(Campaign)
        .findOneByOrFail({ id: params.data.campaignId });

      switch (params.data.event) {
        case CampaignUpdateEvent.Started:
          return handleCampaignStarted({ con, data: params.data, campaign });
        default:
          return;
      }
    } catch (originalError) {
      const err = originalError as TypeORMQueryFailedError;

      if (err?.name !== 'EntityNotFoundError') {
        return;
      }

      throw err;
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
      logger.warn({ campaign }, `Started campaign with unknown type`);
  }
};

const handleCampaignStarted = async ({
  con,
  campaign,
}: {
  con: DataSource;
  data: CampaignUpdateEventArgs;
  campaign: Campaign;
}) => {
  const mdLink = await getMdLink(con, campaign);

  if (!mdLink) {
    return;
  }

  const isTeamMember = await con.getRepository(Feature).exists({
    where: {
      userId: campaign.userId,
      feature: FeatureType.Team,
      value: 1,
    },
  });

  await notifyNewPostBoostedSlack({
    mdLink,
    campaign,
    isTeamMember,
  });
};

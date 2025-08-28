import { TypedWorker } from './worker';
import { Campaign, CampaignState, CampaignType, Post, Source } from '../entity';
import type { DataSource } from 'typeorm';
import { debeziumTimeToDate, updateFlagsStatement } from '../common';
import {
  CampaignUpdateEvent,
  type CampaignStateUpdate,
  type CampaignStatsUpdate,
  type CampaignStatsUpdateEvent,
} from '../common/campaign/common';
import { logger } from '../logger';
import { usdToCores } from '../common/number';

const worker: TypedWorker<'skadi.v2.campaign-updated'> = {
  subscription: 'api.campaign-updated-action',
  handler: async (message, con): Promise<void> => {
    switch (message.data.event) {
      case CampaignUpdateEvent.StatsUpdated:
        return handleCampaignStatsUpdate(
          con,
          message.data as CampaignStatsUpdateEvent,
        );
      case CampaignUpdateEvent.StateUpdated:
        return handleCampaignStateUpdate(
          con,
          message.data as CampaignStatsUpdateEvent,
        );
      case CampaignUpdateEvent.Completed:
        return handleCampaignCompleted(
          con,
          message.data as CampaignStatsUpdateEvent,
        );
      default:
        return;
    }
  },
};

export default worker;

const handleCampaignStateUpdate = async (
  con: DataSource,
  { data, campaignId, d_update }: CampaignStatsUpdateEvent,
) => {
  const { spend, budget } = data as CampaignStateUpdate;

  await con.getRepository(Campaign).update(
    { id: campaignId },
    {
      flags: updateFlagsStatement<Campaign>({
        spend: usdToCores(parseFloat(spend)),
        budget: usdToCores(parseFloat(budget)),
        lastUpdatedAt: debeziumTimeToDate(d_update),
      }),
    },
  );
};

const handleCampaignStatsUpdate = async (
  con: DataSource,
  { data, campaignId, d_update }: CampaignStatsUpdateEvent,
) => {
  const { impressions, clicks, unique_users } = data as CampaignStatsUpdate;

  await con.getRepository(Campaign).update(
    { id: campaignId },
    {
      flags: updateFlagsStatement<Campaign>({
        impressions,
        clicks,
        users: unique_users,
        lastUpdatedAt: debeziumTimeToDate(d_update),
      }),
    },
  );
};

const handleCampaignCompleted = async (
  con: DataSource,
  data: CampaignStatsUpdateEvent,
) => {
  const { campaignId, d_update } = data;
  const campaign = await con
    .getRepository(Campaign)
    .findOneByOrFail({ id: campaignId });

  await con.getRepository(Campaign).update(
    { id: campaignId },
    {
      state: CampaignState.Completed,
      flags: updateFlagsStatement<Campaign>({
        lastUpdatedAt: debeziumTimeToDate(d_update),
      }),
    },
  );

  switch (campaign.type) {
    case CampaignType.Post:
      await con
        .getRepository(Post)
        .update(
          { id: campaign.referenceId },
          { flags: updateFlagsStatement<Post>({ campaignId: null }) },
        );
    case CampaignType.Squad:
      await con
        .getRepository(Source)
        .update(
          { id: campaign.referenceId },
          { flags: updateFlagsStatement<Source>({ campaignId: null }) },
        );
    default:
      logger.warn({ data, campaign }, `Completed campaign with unkonwn type`);
  }
};

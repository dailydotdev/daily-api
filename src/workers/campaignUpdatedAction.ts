import { TypedWorker } from './worker';
import {
  Campaign,
  CampaignState,
  CampaignType,
  Post,
  Source,
  type ConnectionManager,
} from '../entity';
import { updateFlagsStatement } from '../common';
import {
  CampaignUpdateEvent,
  type CampaignStateUpdate,
  type CampaignStatsUpdate,
  type CampaignUpdateEventArgs,
} from '../common/campaign/common';
import { usdToCores } from '../common/number';

const worker: TypedWorker<'skadi.v2.campaign-updated'> = {
  subscription: 'api.campaign-updated-v2-action',
  handler: async (message, con): Promise<void> => {
    const campaign = await con
      .getRepository(Campaign)
      .findOneBy({ id: message.data.campaignId });

    if (!campaign) {
      return;
    }

    await con.transaction(async (manager) => {
      switch (message.data.event) {
        case CampaignUpdateEvent.StatsUpdated:
          return handleCampaignStatsUpdate(manager, message.data);
        case CampaignUpdateEvent.BudgetUpdated:
          return handleCampaignBudgetUpdate(manager, message.data);
        case CampaignUpdateEvent.Completed:
          return handleCampaignCompleted(manager, message.data);
        default:
          return Promise.resolve();
      }
    });
  },
};

export default worker;

const handleCampaignBudgetUpdate = async (
  con: ConnectionManager,
  { data, campaignId }: CampaignUpdateEventArgs,
) => {
  const { budget: usedBudget } = data as CampaignStateUpdate;

  await con.getRepository(Campaign).update(
    { id: campaignId },
    {
      flags: updateFlagsStatement<Campaign>({
        spend: usdToCores(parseFloat(usedBudget)),
      }),
    },
  );
};

const handleCampaignStatsUpdate = async (
  con: ConnectionManager,
  { data, campaignId }: CampaignUpdateEventArgs,
) => {
  const { impressions, clicks, unique_users } = data as CampaignStatsUpdate;

  await con.getRepository(Campaign).update(
    { id: campaignId },
    {
      flags: updateFlagsStatement<Campaign>({
        impressions,
        clicks,
        users: unique_users,
      }),
    },
  );
};

const handleCampaignCompleted = async (
  con: ConnectionManager,
  data: CampaignUpdateEventArgs,
) => {
  const { campaignId } = data;
  const campaign = await con
    .getRepository(Campaign)
    .findOneByOrFail({ id: campaignId });

  await con
    .getRepository(Campaign)
    .update({ id: campaignId }, { state: CampaignState.Completed });

  switch (campaign.type) {
    case CampaignType.Post:
      return await con
        .getRepository(Post)
        .update(
          { id: campaign.referenceId },
          { flags: updateFlagsStatement<Post>({ campaignId: null }) },
        );
    case CampaignType.Squad:
      return await con
        .getRepository(Source)
        .update(
          { id: campaign.referenceId },
          { flags: updateFlagsStatement<Source>({ campaignId: null }) },
        );
    default:
      throw new Error(`Completed campaign with unkonwn type: ${campaign.id}`);
  }
};

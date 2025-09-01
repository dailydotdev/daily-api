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
import { logger } from '../logger';
import type { TypeORMQueryFailedError } from '../errors';

const worker: TypedWorker<'skadi.v2.campaign-updated'> = {
  subscription: 'api.campaign-updated-v2-action',
  handler: async (params, con): Promise<void> => {
    try {
      const campaign = await con.getRepository(Campaign).findOneOrFail({
        where: { id: params.data.campaignId },
      });

      await con.transaction(async (manager) => {
        switch (params.data.event) {
          case CampaignUpdateEvent.StatsUpdated:
            return handleCampaignStatsUpdate({
              con: manager,
              params: params.data,
              campaign,
            });
          case CampaignUpdateEvent.BudgetUpdated:
            return handleCampaignBudgetUpdate({
              con: manager,
              params: params.data,
              campaign,
            });
          case CampaignUpdateEvent.Completed:
            return handleCampaignCompleted({
              con: manager,
              params: params.data,
              campaign,
            });
          default:
            return Promise.resolve();
        }
      });
    } catch (originalError) {
      const err = originalError as TypeORMQueryFailedError;

      if (err?.name === 'EntityNotFoundError') {
        logger.error({ err, params }, 'could not find campaign');

        return;
      }

      throw err;
    }
  },
};

export default worker;

const handleCampaignBudgetUpdate = async ({
  con,
  params: { data, campaignId },
}: {
  con: ConnectionManager;
  params: CampaignUpdateEventArgs;
  campaign: Campaign;
}) => {
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

const handleCampaignStatsUpdate = async ({
  con,
  params: { data, campaignId },
}: {
  con: ConnectionManager;
  params: CampaignUpdateEventArgs;
  campaign: Campaign;
}) => {
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

const handleCampaignCompleted = async ({
  con,
  params,
  campaign,
}: {
  con: ConnectionManager;
  params: CampaignUpdateEventArgs;
  campaign: Campaign;
}) => {
  const { campaignId } = params;

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
      throw new Error(`Completed campaign with unknown type: ${campaign.id}`);
  }
};

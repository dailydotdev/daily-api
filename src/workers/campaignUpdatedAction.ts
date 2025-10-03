import z from 'zod';
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
  type CampaignBudgetUpdate,
  type CampaignExtraStatsUpdate,
  type CampaignStatsUpdate,
  type CampaignUpdateEventArgs,
} from '../common/campaign/common';
import { usdToCores } from '../common/number';
import type { TypeORMQueryFailedError } from '../errors';

interface HandlerEventArgs {
  con: ConnectionManager;
  params: CampaignUpdateEventArgs;
  campaign: Campaign;
}

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
          case CampaignUpdateEvent.ExtraStatsUpdated:
            return handleExtraCampaignStatsUpdate({
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
}: HandlerEventArgs) => {
  const { budget: usedBudget } = data as CampaignBudgetUpdate;

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
}: HandlerEventArgs) => {
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

const handleExtraCampaignStatsUpdate = async ({
  con,
  params: { data, campaignId },
}: HandlerEventArgs) => {
  const update = data as CampaignExtraStatsUpdate;
  const newMembersCount = update['complete joining squad']?.unique_events_count;
  const newMembers = z.coerce.number().safeParse(newMembersCount)?.data;

  await con.getRepository(Campaign).update(
    { id: campaignId },
    {
      flags: updateFlagsStatement<Campaign>({
        newMembers,
      }),
    },
  );
};

const handleCampaignCompleted = async ({
  con,
  params,
  campaign,
}: HandlerEventArgs) => {
  const { campaignId } = params;

  await con.getRepository(Campaign).update(
    { id: campaignId, state: CampaignState.Active }, // only update if still active - for example if cancelled, do not update
    { state: CampaignState.Completed },
  );

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

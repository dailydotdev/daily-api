import { CampaignSource, CampaignState, Source } from '../../entity';

import { updateFlagsStatement } from '../utils';
import type { AuthContext } from '../../Context';
import {
  startCampaign,
  validateCampaignArgs,
  type StartCampaignArgs,
} from './common';
import {
  ensureSourcePermissions,
  SourcePermissions,
} from '../../schema/sources';
import { ValidationError } from 'apollo-server-errors';
import { randomUUID } from 'crypto';

export interface StartSourceBoostArgs {
  postId: string;
  userId: string;
  duration: number;
  budget: number;
}

const validateSquadBoostPermissions = async (
  ctx: AuthContext,
  sourceId: string,
) => {
  const source = await ensureSourcePermissions(
    ctx,
    sourceId,
    SourcePermissions.BoostSquad,
  );

  if (source.flags.campaignId) {
    throw new ValidationError('Source already has a campaign');
  }

  return source;
};

interface StartSourceCampaign {
  ctx: AuthContext;
  args: StartCampaignArgs;
}

export const startCampaignSource = async ({
  ctx,
  args,
}: StartSourceCampaign) => {
  const { value, duration, budget } = args;
  validateCampaignArgs(args);
  const source = await validateSquadBoostPermissions(ctx, value);

  const { userId } = ctx;
  const total = budget * duration;

  const request = await ctx.con.transaction(async (manager) => {
    const id = randomUUID();
    const campaign = manager.getRepository(CampaignSource).create({
      id,
      flags: {
        budget: total,
        spend: 0,
        users: 0,
        clicks: 0,
        impressions: 0,
      },
      userId,
      referenceId: value,
      sourceId: source.id,
      state: CampaignState.Active,
    });

    return startCampaign({
      campaign,
      manager,
      args,
      ctx,
      onCampaignSaved: async () =>
        manager.getRepository(Source).update(
          { id: value },
          {
            flags: updateFlagsStatement<Source>({ campaignId: campaign.id }),
          },
        ),
    });
  });

  return request.transaction;
};

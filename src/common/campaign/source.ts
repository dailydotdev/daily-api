import { CampaignSource, CampaignType, Source } from '../../entity';

import { updateFlagsStatement } from '../utils';
import type { AuthContext } from '../../Context';
import {
  createNewCampaign,
  startCampaign,
  validateCampaignArgs,
  type StartCampaignMutationArgs,
} from './common';
import {
  ensureSourcePermissions,
  SourcePermissions,
} from '../../schema/sources';
import { ValidationError } from 'apollo-server-errors';

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

export const startCampaignSource = async (props: StartCampaignMutationArgs) => {
  const { ctx, args } = props;
  const { value } = args;
  validateCampaignArgs(args);
  const source = await validateSquadBoostPermissions(ctx, value);

  const request = await ctx.con.transaction(async (manager) => {
    const campaign = createNewCampaign(props, CampaignSource, {
      sourceId: source.id,
      type: CampaignType.Source,
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

import {
  CampaignSource,
  CampaignState,
  CampaignType,
  Post,
  Source,
  type ConnectionManager,
} from '../../entity';

import type { AuthContext } from '../../Context';
import {
  startCampaignTransferCores,
  stopCampaignTransferCores,
  type StartCampaignMutationArgs,
  type StopCampaignProps,
} from './common';
import {
  ensureSourcePermissions,
  SourcePermissions,
} from '../../schema/sources';
import { ValidationError } from 'apollo-server-errors';
import { randomUUID } from 'crypto';
import { addDays } from 'date-fns';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
  UserTransactionType,
} from '../../entity/user/UserTransaction';
import { usdToCores } from '../number';
import { systemUser, updateFlagsStatement } from '../utils';
import { skadiApiClientV2 } from '../../integrations/skadi/api/v2/clients';
import { NotificationIcon } from '../../notifications/icons';
import { notificationsLink } from '../links';
import type { NotificationBuilder } from '../../notifications/builder';
import { formatMailDate, addNotificationEmailUtm } from '../mailing';
import type { TemplateDataFunc } from '../../workers/newNotificationV2Mail';
import type { NotificationCampaignSourceContext } from '../../notifications';

export const validateSquadBoostPermissions = async (
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

export const getSourceTags = async (
  con: ConnectionManager,
  sourceId: string,
): Promise<string[]> => {
  const result = await con.getRepository(Post).query<{ tag: string }[]>(
    `
      WITH recent_posts AS (
        SELECT id, "sharedPostId"
        FROM post
        WHERE "sourceId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 30
      )
      SELECT DISTINCT ps.keyword AS tag
      FROM post_keyword ps
      INNER JOIN recent_posts rp
        ON ps."postId" = rp.id
        OR ps."postId" = rp."sharedPostId"
      WHERE ps.status = 'allow'
      LIMIT 30;
    `,
    [sourceId],
  );

  return result.map(({ tag }) => tag.trim()).filter(Boolean);
};

export const startCampaignSource = async (props: StartCampaignMutationArgs) => {
  const { ctx, args } = props;
  const { value } = args;
  const source = await validateSquadBoostPermissions(ctx, value);

  const request = await ctx.con.transaction(async (manager) => {
    const id = randomUUID();
    const { budget, duration } = args;
    const total = budget * duration;
    const userId = ctx.userId;
    const endedAt = addDays(new Date(), duration);

    const campaign = await manager.getRepository(CampaignSource).save(
      manager.getRepository(CampaignSource).create({
        id,
        flags: {
          budget: total,
          spend: 0,
          users: 0,
          clicks: 0,
          impressions: 0,
        },
        userId,
        referenceId: source.id,
        state: CampaignState.Active,
        endedAt,
        sourceId: source.id,
        type: CampaignType.Squad,
      }),
    );

    const campaignId = campaign.id;
    const last30tags = await getSourceTags(manager, source.id);
    const finalTags = last30tags.length > 3 ? last30tags : []; // when it is 3 or below, we set global targeting

    await skadiApiClientV2.startCampaign(campaign, finalTags);

    await manager
      .getRepository(Source)
      .update(
        { id: source.id },
        { flags: updateFlagsStatement<Source>({ campaignId: id }) },
      );

    const userTransaction = await manager.getRepository(UserTransaction).save(
      manager.getRepository(UserTransaction).create({
        id: randomUUID(),
        processor: UserTransactionProcessor.Njord,
        receiverId: systemUser.id,
        status: UserTransactionStatus.Success,
        productId: null,
        senderId: userId,
        value: total,
        valueIncFees: 0,
        fee: 0,
        request: ctx.requestMeta,
        flags: { note: `Squad Boost started` },
        referenceId: campaignId,
        referenceType: UserTransactionType.SquadBoost,
      }),
    );

    return await startCampaignTransferCores({
      ctx,
      manager,
      campaignId,
      userTransaction,
    });
  });

  return request.transaction;
};

export const stopCampaignSource = async ({
  campaign,
  ctx,
}: StopCampaignProps) => {
  const { id: campaignId, userId, referenceId } = campaign;

  const { budget } = await skadiApiClientV2.cancelCampaign({
    campaignId,
    userId,
  });

  const result = await ctx.con.transaction(async (manager) => {
    const toRefund = parseFloat(budget);

    await manager
      .getRepository(CampaignSource)
      .update({ id: campaignId }, { state: CampaignState.Cancelled });

    await manager
      .getRepository(Source)
      .update(
        { id: referenceId },
        { flags: updateFlagsStatement<Source>({ campaignId: null }) },
      );

    const userTransaction = await manager.getRepository(UserTransaction).save(
      manager.getRepository(UserTransaction).create({
        id: randomUUID(),
        processor: UserTransactionProcessor.Njord,
        receiverId: userId,
        status: UserTransactionStatus.Success,
        productId: null,
        senderId: systemUser.id,
        value: usdToCores(toRefund),
        valueIncFees: 0,
        fee: 0,
        flags: { note: `Squad Boost refund` },
        referenceId: campaignId,
        referenceType: UserTransactionType.SquadBoost,
      }),
    );

    return await stopCampaignTransferCores({
      ctx,
      manager,
      campaignId,
      userTransaction,
    });
  });

  return result.transaction;
};

export const generateCampaignSquadNotification = (
  builder: NotificationBuilder,
  ctx: NotificationCampaignSourceContext,
) => {
  const { campaign, source, event, user } = ctx;

  return builder
    .icon(NotificationIcon.DailyDev)
    .referenceCampaign(ctx)
    .targetUrl(notificationsLink)
    .setTargetUrlParameter([['c_id', campaign.id]])
    .uniqueKey(`${campaign.id}-${user.id}-${event}`)
    .avatarSource(source);
};

export const generateCampaignSquadEmail: TemplateDataFunc = async (
  con,
  user,
  notification,
) => {
  const campaign = await con
    .getRepository(CampaignSource)
    .findOneBy({ id: notification.referenceId });

  if (!campaign) {
    return null;
  }

  const source = await con
    .getRepository(Source)
    .findOneByOrFail({ id: campaign.sourceId });

  return {
    start_date: formatMailDate(campaign.createdAt),
    end_date: formatMailDate(campaign.endedAt),
    analytics_link: addNotificationEmailUtm(
      notification.targetUrl,
      notification.type,
    ),
    source_image: source.image,
    source_handle: source.handle,
    source_name: source.name,
  };
};

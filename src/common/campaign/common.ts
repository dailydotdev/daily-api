import { ValidationError } from 'apollo-server-errors';
import {
  Campaign,
  CampaignPost,
  CampaignType,
  type ConnectionManager,
} from '../../entity';
import { UserTransaction } from '../../entity/user/UserTransaction';
import { parseBigInt } from '../utils';
import { TransferError } from '../../errors';
import { transferCores, throwUserTransactionError, getBalance } from '../njord';
import type { AuthContext } from '../../Context';
import type { EntityManager } from 'typeorm';
import { CAMPAIGN_VALIDATION_SCHEMA } from '../schema/campaigns';
import { getSourceTags } from './source';
import { generatePostBoostEmail, getPostTags } from './post';
import type { NotificationBuilder } from '../../notifications/builder';
import { NotificationIcon } from '../../notifications/icons';
import { notificationsLink } from '../links';
import type { NotificationCampaignContext } from '../../notifications';
import type { TemplateDataFunc } from '../../workers/newNotificationV2Mail';
import { queryReadReplica } from '../queryReadReplica';

export interface StartCampaignArgs {
  value: string;
  duration: number;
  budget: number;
}

export interface StartCampaignMutationArgs {
  ctx: AuthContext;
  args: StartCampaignArgs;
}

export const validateCampaignArgs = (
  args: Pick<StartCampaignArgs, 'budget' | 'duration'>,
) => {
  const result = CAMPAIGN_VALIDATION_SCHEMA.safeParse(args);

  if (result.error) {
    throw new ValidationError(result.error.issues[0].message);
  }
};

interface StartCampaignTransferCoresProps {
  ctx: AuthContext;
  campaignId: string;
  userTransaction: UserTransaction;
  manager: EntityManager;
}

export const startCampaignTransferCores = async ({
  ctx,
  campaignId,
  userTransaction,
  manager,
}: StartCampaignTransferCoresProps) => {
  if (ctx.isTeamMember) {
    return {
      transaction: {
        referenceId: campaignId,
        transactionId: userTransaction.id,
        balance: { amount: (await getBalance({ userId: ctx.userId })).amount },
      },
    };
  }

  try {
    const transfer = await transferCores({
      ctx,
      transaction: userTransaction,
      entityManager: manager,
    });

    return {
      transfer,
      transaction: {
        referenceId: campaignId,
        transactionId: userTransaction.id,
        balance: {
          amount: parseBigInt(transfer.senderBalance?.newBalance),
        },
      },
    };
  } catch (error) {
    if (error instanceof TransferError) {
      await throwUserTransactionError({
        ctx,
        entityManager: manager,
        error,
        transaction: userTransaction,
      });
    }

    throw error;
  }
};

export const stopCampaignTransferCores = async ({
  ctx,
  campaignId,
  userTransaction,
  manager,
}: StartCampaignTransferCoresProps) => {
  if (ctx.isTeamMember) {
    return {
      transaction: {
        referenceId: campaignId,
        transactionId: userTransaction.id,
        balance: { amount: (await getBalance({ userId: ctx.userId })).amount },
      },
    };
  }

  try {
    const transfer = await transferCores({
      ctx,
      transaction: userTransaction,
      entityManager: manager,
    });

    return {
      transfer,
      transaction: {
        referenceId: campaignId,
        transactionId: userTransaction.id,
        balance: {
          amount: parseBigInt(transfer.receiverBalance?.newBalance),
        },
      },
    };
  } catch (error) {
    if (error instanceof TransferError) {
      await throwUserTransactionError({
        ctx,
        entityManager: manager,
        error,
        transaction: userTransaction,
      });
    }

    throw error;
  }
};

export interface StopCampaignProps {
  campaign: Campaign;
  ctx: AuthContext;
}

export const getReferenceTags = (
  con: ConnectionManager,
  type: CampaignType,
  referenceId: string,
) => {
  switch (type) {
    case CampaignType.Post:
      return getPostTags(con, referenceId);
    case CampaignType.Squad:
      return getSourceTags(con, referenceId);
    default:
      throw new ValidationError('Unknown campaign type to estimate reach');
  }
};

export enum CampaignUpdateEvent {
  Started = 'CAMPAIGN_STARTED',
  Completed = 'CAMPAIGN_COMPLETED',
  StatsUpdated = 'STATS_UPDATED',
  BudgetUpdated = 'BUDGET_UPDATED',
}

export interface CampaignCompleted {
  budget: string;
}

export interface CampaignStatsUpdate {
  impressions: number;
  clicks: number;
  unique_users: number;
}

export interface CampaignStateUpdate {
  budget: string; // used budget
}

export interface CampaignUpdateEventArgs {
  campaignId: string;
  event: CampaignUpdateEvent;
  unique_users: number;
  data: CampaignCompleted | CampaignStatsUpdate | CampaignStateUpdate;
  d_update: number;
}

export const generateCampaignCompletedNotification = (
  builder: NotificationBuilder,
  ctx: NotificationCampaignContext,
) => {
  const { campaign, source, event, user } = ctx;

  const nb = builder
    .icon(NotificationIcon.DailyDev)
    .referenceCampaign(ctx)
    .targetUrl(notificationsLink)
    .setTargetUrlParameter([['c_id', campaign.id]])
    .uniqueKey(`${campaign.id}-${user.id}-${event}`);

  switch (campaign.type) {
    case CampaignType.Post:
      return nb.avatarUser(user);
    case CampaignType.Squad:
      if (!source) {
        throw new Error(
          `Can't generate Squad Campaign Notification without the Squad`,
        );
      }
      return nb.avatarSource(source);
    default:
      throw new Error(
        `Unable to generate notification for unknown type: ${campaign.type}`,
      );
  }
};

export const generateCampaignCompletedEmail: TemplateDataFunc = async (
  con,
  user,
  notification,
) => {
  const campaign = await con
    .getRepository(Campaign)
    .findOneBy({ id: notification.referenceId });

  if (!campaign) {
    return null;
  }

  switch (campaign.type) {
    case CampaignType.Post:
      return generatePostBoostEmail({
        con,
        postId: campaign.referenceId,
        notification,
        campaign,
      });
    // TODO: MI-1007 - generate email once template id is provided
    default:
      return null;
  }
};

export interface UserCampaignStats {
  impressions: number;
  clicks: number;
  spend: number;
  users: number;
}

export const getUserCampaignStats = async (
  ctx: AuthContext,
): Promise<UserCampaignStats> => {
  const result = await queryReadReplica(ctx.con, ({ queryRunner }) =>
    queryRunner.manager
      .getRepository(CampaignPost)
      .createQueryBuilder('c')
      .select(`SUM(COALESCE((c.flags->>'impressions')::int, 0))`, 'impressions')
      .addSelect(`SUM(COALESCE((c.flags->>'users')::int, 0))`, 'users')
      .addSelect(`SUM(COALESCE((c.flags->>'clicks')::int, 0))`, 'clicks')
      .addSelect(`SUM(COALESCE((c.flags->>'spend')::int, 0))`, 'spend')
      .where(`c."userId" = :user`, { user: ctx.userId })
      .getRawOne(),
  );

  return {
    clicks: result.clicks ?? 0,
    impressions: result.impressions ?? 0,
    users: result.users ?? 0,
    spend: result.spend ?? 0,
  };
};

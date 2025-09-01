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
import { transferCores, throwUserTransactionError } from '../njord';
import type { AuthContext } from '../../Context';
import type { EntityManager } from 'typeorm';
import { CAMPAIGN_VALIDATION_SCHEMA } from '../schema/campaigns';
import { getSourceTags } from './source';
import { getPostTags } from './post';
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

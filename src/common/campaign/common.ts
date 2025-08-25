import { ValidationError } from 'apollo-server-errors';
import { Campaign, CampaignType, type ConnectionManager } from '../../entity';
import { UserTransaction } from '../../entity/user/UserTransaction';
import { parseBigInt } from '../utils';
import { TransferError } from '../../errors';
import { transferCores, throwUserTransactionError } from '../njord';
import type { AuthContext } from '../../Context';
import type { EntityManager } from 'typeorm';
import { CAMPAIGN_VALIDATION_SCHEMA } from '../schema/campaigns';
import { getSourceTags } from './source';
import { getPostTags } from './post';

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
    throw new ValidationError(result.error.errors[0].message);
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
    case CampaignType.Source:
      return getSourceTags(con, referenceId);
    default:
      throw new ValidationError('Unknown campaign type to estimate reach');
  }
};

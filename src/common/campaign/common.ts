import { ValidationError } from 'apollo-server-errors';
import z from 'zod';
import {
  Campaign,
  CampaignState,
  CampaignType,
  Post,
  Source,
} from '../../entity';
import { skadiApiClient } from '../../integrations/skadi/api/clients';
import { coresToUsd, usdToCores } from '../number';
import { randomUUID } from 'crypto';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
  UserTransactionType,
} from '../../entity/user/UserTransaction';
import { parseBigInt, systemUser, updateFlagsStatement } from '../utils';
import { TransferError } from '../../errors';
import { transferCores, throwUserTransactionError } from '../njord';
import type { AuthContext } from '../../Context';
import type { DeepPartial, EntityManager, EntityTarget } from 'typeorm';
import { capitalize } from 'lodash';
import { logger } from '../../logger';
import { addDays } from 'date-fns';

export const CAMPAIGN_VALIDATION_SCHEMA = z.object({
  budget: z
    .number()
    .int()
    .min(1000)
    .max(100000)
    .refine((value) => value % 1000 === 0, {
      message: 'Budget must be divisible by 1000',
    }),
  duration: z
    .number()
    .int()
    .min(1)
    .max(30)
    .refine((value) => value % 1 === 0, {
      message: 'Duration must be a whole number',
    }),
});

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

const campaignTypeToTransactionType: Record<CampaignType, UserTransactionType> =
  {
    [CampaignType.Post]: UserTransactionType.PostBoost,
    [CampaignType.Source]: UserTransactionType.SquadBoost,
  };

interface StartCampaignProps {
  campaign: Campaign;
  manager: EntityManager;
  args: StartCampaignArgs;
  ctx: AuthContext;
  onCampaignSaved: () => Promise<unknown>;
}

export const startCampaign = async ({
  campaign,
  manager,
  args,
  ctx,
  onCampaignSaved,
}: StartCampaignProps) => {
  const { budget, duration } = args;
  const total = budget * duration;
  const userId = campaign.userId;

  await manager.getRepository(Campaign).save(campaign);
  const campaignId = campaign.id;
  await skadiApiClient.startCampaign({
    value: campaign.id,
    type: campaign.type,
    durationInDays: duration,
    budget: coresToUsd(budget),
    userId: campaign.userId,
  });

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
      flags: { note: `${capitalize(campaign.type)} Boost started` },
      referenceId: campaignId,
      referenceType: campaignTypeToTransactionType[campaign.type],
    }),
  );

  await onCampaignSaved();

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

interface StopCampaignProps {
  campaign: Campaign;
  manager: EntityManager;
  ctx: AuthContext;
  onCancelled: () => Promise<unknown>;
}

export const stopCampaign = async ({
  campaign,
  manager,
  ctx,
  onCancelled,
}: StopCampaignProps) => {
  const { id: campaignId, userId } = campaign;

  const { currentBudget } = await skadiApiClient.cancelCampaign({
    campaignId,
    userId,
  });

  const toRefund = parseFloat(currentBudget);

  await onCancelled();

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
      flags: { note: `${capitalize(campaign.type)} Boost refund` },
      referenceId: campaignId,
      referenceType: campaignTypeToTransactionType[campaign.type],
    }),
  );

  try {
    const transfer = await transferCores({
      ctx: { userId },
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
    } else {
      logger.error({ campaign }, 'Error cancelling boost');
    }

    throw error;
  }
};

export const typeToCancelFn: Record<
  CampaignType,
  (manager: EntityManager, referenceId: string) => Promise<unknown>
> = {
  [CampaignType.Post]: (manager, referenceId) =>
    manager
      .getRepository(Post)
      .update(
        { id: referenceId },
        { flags: updateFlagsStatement<Post>({ campaignId: null }) },
      ),
  [CampaignType.Source]: (manager, referenceId) =>
    manager
      .getRepository(Source)
      .update(
        { id: referenceId },
        { flags: updateFlagsStatement<Source>({ campaignId: null }) },
      ),
};

export const createNewCampaign = <T extends Campaign>(
  { ctx, args }: StartCampaignMutationArgs,
  entity: EntityTarget<T>,
  partial: DeepPartial<T>,
): T => {
  const { userId } = ctx;
  const { budget, duration, value } = args;
  const id = randomUUID();
  const total = budget * duration;
  const endedAt = addDays(new Date(), duration);

  return ctx.con.getRepository(entity).create({
    ...partial,
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
    state: CampaignState.Active,
    endedAt,
  });
};

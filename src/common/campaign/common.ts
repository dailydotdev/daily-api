import { ValidationError } from 'apollo-server-errors';
import z from 'zod';
import { Campaign } from '../../entity';
import { skadiApiClient } from '../../integrations/skadi/api/clients';
import { coresToUsd } from '../number';
import { randomUUID } from 'crypto';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
  UserTransactionType,
} from '../../entity/user/UserTransaction';
import { parseBigInt, systemUser } from '../utils';
import { TransferError } from '../../errors';
import { transferCores, throwUserTransactionError } from '../njord';
import type { AuthContext } from '../../Context';
import type { EntityManager } from 'typeorm';
import { capitalize } from 'lodash';

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

export const validateCampaignArgs = (
  args: Pick<StartCampaignArgs, 'budget' | 'duration'>,
) => {
  const result = CAMPAIGN_VALIDATION_SCHEMA.safeParse(args);

  if (result.error) {
    throw new ValidationError(result.error.errors[0].message);
  }
};

interface StartCampaignProps {
  campaign: Campaign;
  manager: EntityManager;
  args: StartCampaignArgs;
  ctx: AuthContext;
  onCampaignSaved: (campaign: Campaign) => Promise<unknown>;
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

  const { campaignId } = await skadiApiClient.startCampaign({
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
      referenceType: UserTransactionType.PostBoost,
    }),
  );

  await onCampaignSaved(campaign);

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

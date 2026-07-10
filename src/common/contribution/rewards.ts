import { ValidationError } from 'apollo-server-errors';
import { addDays } from 'date-fns';
import type { EntityManager } from 'typeorm';
import { v5 } from 'uuid';
import type z from 'zod';
import type { AuthContext } from '../../Context';
import {
  contributionCoresRewardMetadataSchema,
  contributionPlusDaysRewardMetadataSchema,
} from '../schema/contributions';
import { updateSubscriptionFlags } from '../utils';
import { transferCores } from '../njord';
import { systemUser } from '../utils';
import { isPlusMember, SubscriptionCycles } from '../../paddle';
import { SubscriptionStatus } from '../plus';
import { User } from '../../entity/user/User';
import { Feature, FeatureType, FeatureValue } from '../../entity/Feature';
import {
  ContributionRewardTier,
  ContributionRewardType,
} from '../../entity/contribution/ContributionRewardTier';
import {
  UserContributionReward,
  UserContributionRewardStatus,
} from '../../entity/contribution/UserContributionReward';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
  UserTransactionType,
} from '../../entity/user/UserTransaction';

const contributionRewardTransactionNamespace =
  '3507776f-51a3-41e6-bd53-3653ecf10690';

const parseRewardMetadata = <TSchema extends z.ZodType>({
  schema,
  metadata,
}: {
  schema: TSchema;
  metadata: ContributionRewardTier['metadata'];
}): z.infer<TSchema> => {
  const result = schema.safeParse(metadata);

  if (!result.success) {
    throw new ValidationError('Invalid reward metadata');
  }

  return result.data;
};

const markContributionRewardFulfilled = async ({
  con,
  reward,
  fulfilledAt,
}: {
  con: EntityManager;
  reward: UserContributionReward;
  fulfilledAt: Date;
}): Promise<UserContributionReward> => {
  await con.getRepository(UserContributionReward).update(
    {
      userId: reward.userId,
      tierId: reward.tierId,
    },
    {
      status: UserContributionRewardStatus.Fulfilled,
      fulfilledAt,
    },
  );

  return {
    ...reward,
    status: UserContributionRewardStatus.Fulfilled,
    fulfilledAt,
  };
};

const fulfillContributionCoresReward = async ({
  con,
  ctx,
  tier,
  reward,
  now,
}: {
  con: EntityManager;
  ctx: AuthContext;
  tier: ContributionRewardTier;
  reward: UserContributionReward;
  now: Date;
}): Promise<UserContributionReward> => {
  const { amount } = parseRewardMetadata({
    schema: contributionCoresRewardMetadataSchema,
    metadata: tier.metadata,
  });
  const transactionId = v5(
    `${reward.userId}:${reward.tierId}:cores`,
    contributionRewardTransactionNamespace,
  );
  const existingTransaction = await con.getRepository(UserTransaction).findOne({
    select: ['id', 'status'],
    where: { id: transactionId },
  });

  if (existingTransaction?.status === UserTransactionStatus.Success) {
    return markContributionRewardFulfilled({ con, reward, fulfilledAt: now });
  }

  const transaction = await con.getRepository(UserTransaction).save(
    con.getRepository(UserTransaction).create({
      id: transactionId,
      processor: UserTransactionProcessor.Njord,
      receiverId: reward.userId,
      status: UserTransactionStatus.Success,
      productId: null,
      senderId: systemUser.id,
      value: amount,
      valueIncFees: amount,
      fee: 0,
      request: ctx.requestMeta ?? {},
      flags: {
        note: `Contribution reward: ${tier.title}`,
      },
      referenceId: tier.id,
      referenceType: UserTransactionType.ContributionReward,
    }),
  );

  await transferCores({
    ctx,
    transaction,
    entityManager: con,
  });

  return markContributionRewardFulfilled({ con, reward, fulfilledAt: now });
};

const getContributionPlusExpiration = ({
  currentExpiration,
  days,
  now,
}: {
  currentExpiration?: Date | string | null;
  days: number;
  now: Date;
}): Date => {
  const parsedExpiration = currentExpiration
    ? new Date(currentExpiration)
    : null;
  const startsAt =
    parsedExpiration &&
    !Number.isNaN(parsedExpiration.getTime()) &&
    parsedExpiration > now
      ? parsedExpiration
      : now;

  return addDays(startsAt, days);
};

const fulfillContributionPlusDaysReward = async ({
  con,
  tier,
  reward,
  now,
}: {
  con: EntityManager;
  tier: ContributionRewardTier;
  reward: UserContributionReward;
  now: Date;
}): Promise<UserContributionReward> => {
  const { days } = parseRewardMetadata({
    schema: contributionPlusDaysRewardMetadataSchema,
    metadata: tier.metadata,
  });
  const user = await con.getRepository(User).findOne({
    select: ['id', 'subscriptionFlags'],
    where: { id: reward.userId },
  });

  if (
    isPlusMember(user?.subscriptionFlags?.cycle) &&
    !user?.subscriptionFlags?.giftExpirationDate
  ) {
    return reward;
  }

  const giftExpirationDate = getContributionPlusExpiration({
    currentExpiration: user?.subscriptionFlags?.giftExpirationDate,
    days,
    now,
  });
  const cycle =
    days >= 365 ? SubscriptionCycles.Yearly : SubscriptionCycles.Monthly;

  await con.getRepository(User).update(reward.userId, {
    subscriptionFlags: updateSubscriptionFlags({
      cycle,
      createdAt: user?.subscriptionFlags?.createdAt ?? now,
      updatedAt: now,
      giftExpirationDate,
      status: SubscriptionStatus.Active,
    }),
  });

  return markContributionRewardFulfilled({ con, reward, fulfilledAt: now });
};

const fulfillContributionSuggestCausesReward = async ({
  con,
  reward,
  now,
}: {
  con: EntityManager;
  reward: UserContributionReward;
  now: Date;
}): Promise<UserContributionReward> => {
  // Grant the right through the feature table (wired to the feature-flag system),
  // idempotent on the (feature, userId) PK so a re-claim is a no-op.
  await con
    .getRepository(Feature)
    .createQueryBuilder()
    .insert()
    .values({
      userId: reward.userId,
      feature: FeatureType.ContributionSuggestCauses,
      value: FeatureValue.Allow,
    })
    .orIgnore()
    .execute();

  return markContributionRewardFulfilled({ con, reward, fulfilledAt: now });
};

export const fulfillContributionReward = async ({
  con,
  ctx,
  tier,
  reward,
}: {
  con: EntityManager;
  ctx: AuthContext;
  tier: ContributionRewardTier;
  reward: UserContributionReward;
}): Promise<UserContributionReward> => {
  if (reward.status === UserContributionRewardStatus.Fulfilled) {
    return reward;
  }

  const now = new Date();

  switch (tier.rewardType) {
    case ContributionRewardType.Cores:
      return fulfillContributionCoresReward({ con, ctx, tier, reward, now });
    case ContributionRewardType.PlusDays:
      return fulfillContributionPlusDaysReward({ con, tier, reward, now });
    case ContributionRewardType.SuggestCauses:
      return fulfillContributionSuggestCausesReward({ con, reward, now });
    // The team is notified on Slack to email the coupon / council invite (see
    // the claim resolver); content-only rewards (Patchy, joke, trivia) render
    // straight from the tier. All just flip the reward to fulfilled.
    case ContributionRewardType.StoreDiscount:
    case ContributionRewardType.Council:
    case ContributionRewardType.PatchyPicture:
    case ContributionRewardType.Joke:
    case ContributionRewardType.Trivia:
      return markContributionRewardFulfilled({ con, reward, fulfilledAt: now });
    default:
      return reward;
  }
};

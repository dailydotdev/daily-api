import type {
  TransactionCompletedEvent,
  SubscriptionStatus as PaddleSubscriptionStatus,
} from '@paddle/paddle-node-sdk';
import {
  dropClaimableItem,
  extractSubscriptionCycle,
  updateClaimableItem,
  type PaddleCustomData,
} from '../index';
import { updateFlagsStatement, updateSubscriptionFlags } from '../..//utils';
import createOrGetConnection from '../../../db';
import { User } from '../../../entity/user/User';
import {
  PurchaseType,
  SubscriptionProvider,
  SubscriptionStatus,
} from '../../plus';
import { logger } from '../../../logger';
import {
  isPlusMember,
  plusGiftDuration,
  SubscriptionCycles,
  type PaddleSubscriptionEvent,
} from '../../../paddle';
import { addMilliseconds } from 'date-fns';
import { notifyNewPaddlePlusTransaction } from '../slack';
import { revokeAllUserTokens } from '../../personalAccessToken';

/**
 * Maps Paddle subscription status to internal SubscriptionStatus.
 * - 'active' and 'trialing' map to Active (user has access)
 * - 'canceled', 'past_due', and 'paused' map to Cancelled (access revoked)
 */
export const getPaddleSubscriptionStatus = (
  paddleStatus: PaddleSubscriptionStatus,
): SubscriptionStatus => {
  switch (paddleStatus) {
    case 'active':
    case 'trialing':
      return SubscriptionStatus.Active;
    case 'canceled':
    case 'past_due':
    case 'paused':
      return SubscriptionStatus.Cancelled;
    default:
      return SubscriptionStatus.None;
  }
};

export const updateUserSubscription = async ({
  event,
}: {
  event: PaddleSubscriptionEvent | undefined;
}) => {
  if (!event) {
    return;
  }

  const { data } = event;
  const customData: PaddleCustomData = data?.customData ?? {};

  const con = await createOrGetConnection();
  const userId = customData?.user_id;

  const subscriptionType = extractSubscriptionCycle(data.items);
  const mappedStatus = getPaddleSubscriptionStatus(data.status);
  const isActive = mappedStatus === SubscriptionStatus.Active;

  if (!subscriptionType) {
    logger.error(
      {
        provider: SubscriptionProvider.Paddle,
        purchaseType: PurchaseType.Plus,
        data: event,
      },
      'Subscription type missing in payload',
    );
    return false;
  }
  if (!userId) {
    if (isActive) {
      await updateClaimableItem(con, data);
    } else {
      await dropClaimableItem(con, data);
    }
  } else {
    const user = await con.getRepository(User).findOneBy({ id: userId });
    if (!user) {
      logger.error(
        {
          provider: SubscriptionProvider.Paddle,
          purchaseType: PurchaseType.Plus,
          data: event,
        },
        'User not found',
      );
      return false;
    }

    if (
      user.subscriptionFlags?.provider === SubscriptionProvider.AppleStoreKit
    ) {
      logger.error(
        {
          user,
          data: event,
          provider: SubscriptionProvider.Paddle,
          purchaseType: PurchaseType.Plus,
        },
        'User already has a Apple subscription',
      );
      throw new Error('User already has a StoreKit subscription');
    }

    const currentUpdatedAt = user.subscriptionFlags?.updatedAt
      ? new Date(user.subscriptionFlags.updatedAt)
      : new Date(0);
    const eventUpdatedAt = data?.updatedAt ? new Date(data.updatedAt) : null;

    if (eventUpdatedAt && eventUpdatedAt <= currentUpdatedAt) {
      logger.warn(
        {
          provider: SubscriptionProvider.Paddle,
          purchaseType: PurchaseType.Plus,
          userId,
          eventUpdatedAt,
          currentUpdatedAt,
          eventType: event.eventType,
          subscriptionId: data?.id,
        },
        'Stale Paddle subscription event received, skipping',
      );
      return;
    }

    await con.getRepository(User).update(
      {
        id: userId,
      },
      {
        subscriptionFlags: updateSubscriptionFlags({
          cycle: isActive ? subscriptionType : null,
          createdAt: isActive ? data?.startedAt : null,
          subscriptionId: isActive ? data?.id : null,
          provider: isActive ? SubscriptionProvider.Paddle : null,
          status: isActive ? mappedStatus : null,
          updatedAt: data?.updatedAt ?? null,
        }),
      },
    );

    // Revoke all API tokens when subscription becomes inactive
    if (!isActive) {
      await revokeAllUserTokens(con, userId);
    }
  }
};

export const processGiftedPayment = async ({
  event,
}: {
  event: TransactionCompletedEvent;
}) => {
  const { data } = event;
  const con = await createOrGetConnection();
  const { gifter_id, user_id } = data.customData as PaddleCustomData;

  if (user_id === gifter_id) {
    logger.error(
      {
        provider: SubscriptionProvider.Paddle,
        purchaseType: PurchaseType.Plus,
        data: event,
      },
      'User and gifter are the same',
    );
    return;
  }

  const gifterUser = await con.getRepository(User).findOneBy({ id: gifter_id });

  if (!gifterUser) {
    logger.error(
      {
        provider: SubscriptionProvider.Paddle,
        purchaseType: PurchaseType.Plus,
        data: event,
      },
      'Gifter user not found',
    );
    return;
  }

  const targetUser = await con.getRepository(User).findOne({
    select: ['subscriptionFlags'],
    where: { id: user_id },
  });

  if (isPlusMember(targetUser?.subscriptionFlags?.cycle)) {
    logger.error(
      {
        provider: SubscriptionProvider.Paddle,
        purchaseType: PurchaseType.Plus,
        data: event,
      },
      'User is already a Plus member',
    );
    return;
  }

  await con.getRepository(User).update(
    { id: user_id },
    {
      subscriptionFlags: updateSubscriptionFlags({
        cycle: SubscriptionCycles.Yearly,
        createdAt: data?.createdAt,
        subscriptionId: data?.id,
        gifterId: gifter_id,
        giftExpirationDate: addMilliseconds(
          new Date(),
          plusGiftDuration,
        ).toISOString(),
        provider: SubscriptionProvider.Paddle,
      }),
      flags: updateFlagsStatement({ showPlusGift: true }),
    },
  );
};

export const processPlusTransactionCompleted = async ({
  event,
}: {
  event: TransactionCompletedEvent;
}) => {
  const { gifter_id } = (event?.data?.customData ?? {}) as PaddleCustomData;

  if (gifter_id) {
    await processGiftedPayment({ event });
  }

  await notifyNewPaddlePlusTransaction({ event });
};

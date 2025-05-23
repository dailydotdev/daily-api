import type {
  TransactionCompletedEvent,
  TransactionCreatedEvent,
  TransactionPaidEvent,
  TransactionPaymentFailedEvent,
  TransactionUpdatedEvent,
} from '@paddle/paddle-node-sdk';
import {
  getPaddleTransactionData,
  getTransactionForProviderId,
  paddleInstance,
} from '../index';
import createOrGetConnection from '../../../db';
import { logger } from '../../../logger';
import { PurchaseType, SubscriptionProvider } from '../../plus';
import { User } from '../../../entity';
import {
  UserTransaction,
  UserTransactionStatus,
} from '../../../entity/user/UserTransaction';
import { updateFlagsStatement } from '../../utils';
import { purchaseCores, UserTransactionError } from '../../njord';
import { TransferError } from '../../../errors';
import { checkUserCoresAccess } from '../../user';
import { CoresRole } from '../../../types';
import { remoteConfig } from '../../../remoteConfig';
import { checkTransactionStatusValid, updateUserTransaction } from '../cores';
import { notifyNewPaddleCoresTransaction } from '../slack';

export const processCoresTransactionCreated = async ({
  event,
}: {
  event: TransactionCreatedEvent;
}) => {
  const transactionData = getPaddleTransactionData({ event });

  const con = await createOrGetConnection();

  const transaction = await getTransactionForProviderId({
    con,
    providerId: transactionData.id,
  });

  if (transaction) {
    logger.warn(
      {
        eventType: event.eventType,
        provider: SubscriptionProvider.Paddle,
        purchaseType: PurchaseType.Cores,
        currentStatus: transaction.status,
        data: transactionData,
      },
      'Transaction already exists',
    );

    return;
  }

  await updateUserTransaction({
    con,
    transaction,
    nextStatus: UserTransactionStatus.Created,
    data: transactionData,
    event,
  });

  try {
    // update checkout url to point to cores since default is plus checkout
    await paddleInstance.transactions.update(transactionData.id, {
      checkout: {
        url: `${process.env.COMMENTS_PREFIX}/cores`,
      },
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        provider: SubscriptionProvider.Paddle,
        purchaseType: PurchaseType.Cores,
        transactionId: transactionData.id,
      },
      'Failed to update checkout url',
    );
  }
};

export const processCoresTransactionPaid = async ({
  event,
}: {
  event: TransactionPaidEvent;
}) => {
  const transactionData = getPaddleTransactionData({ event });

  const con = await createOrGetConnection();

  const transaction = await getTransactionForProviderId({
    con,
    providerId: transactionData.id,
  });

  const nextStatus = UserTransactionStatus.Processing;

  if (
    transaction &&
    !checkTransactionStatusValid({
      event,
      transaction,
      nextStatus,
      validStatus: [
        UserTransactionStatus.Created,
        UserTransactionStatus.Processing,
        UserTransactionStatus.Error,
        UserTransactionStatus.ErrorRecoverable,
      ],
      data: transactionData,
    })
  ) {
    return;
  }

  await updateUserTransaction({
    con,
    transaction,
    nextStatus,
    data: transactionData,
    event,
  });
};

export const processCoresTransactionPaymentFailed = async ({
  event,
}: {
  event: TransactionPaymentFailedEvent;
}) => {
  const transactionData = getPaddleTransactionData({ event });

  const con = await createOrGetConnection();

  const transaction = await getTransactionForProviderId({
    con,
    providerId: transactionData.id,
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  const paymentErrorCode = event.data.payments[0]?.errorCode;

  // for declined payments user can retry checkout
  const nextStatus = UserTransactionStatus.ErrorRecoverable;

  if (
    !checkTransactionStatusValid({
      event,
      transaction,
      nextStatus,
      validStatus: [
        UserTransactionStatus.Created,
        UserTransactionStatus.Processing,
        UserTransactionStatus.Error,
        UserTransactionStatus.ErrorRecoverable,
      ],
      data: transactionData,
    })
  ) {
    return;
  }

  await con.getRepository(UserTransaction).update(
    { id: transaction.id },
    {
      status: nextStatus,
      flags: updateFlagsStatement<UserTransaction>({
        error: `Payment failed: ${paymentErrorCode ?? 'unknown'}`,
      }),
    },
  );
};

export const processCoresTransactionUpdated = async ({
  event,
}: {
  event: TransactionUpdatedEvent;
}) => {
  const transactionData = getPaddleTransactionData({ event });

  const con = await createOrGetConnection();

  const transaction = await getTransactionForProviderId({
    con,
    providerId: transactionData.id,
  });

  if (transaction && transaction.updatedAt > transactionData.updatedAt) {
    logger.warn(
      {
        eventType: event.eventType,
        provider: SubscriptionProvider.Paddle,
        purchaseType: PurchaseType.Cores,
        currentStatus: transaction.status,
        data: transactionData,
      },
      'Transaction already updated',
    );

    return;
  }

  // get status from update event, other events we don't handle as update
  // but wait for the dedicated eventType to process transaction
  const getUpdatedStatus = (): UserTransactionStatus | undefined => {
    if (transaction) {
      return transaction.status;
    }

    switch (event.data.status) {
      case 'draft':
      case 'ready':
        return UserTransactionStatus.Created;
      case 'billed':
        return UserTransactionStatus.Processing;
      default:
        return undefined;
    }
  };

  const nextStatus = getUpdatedStatus();

  if (typeof nextStatus === 'undefined') {
    logger.warn(
      {
        eventType: event.eventType,
        provider: SubscriptionProvider.Paddle,
        purchaseType: PurchaseType.Cores,
        currentStatus: transaction?.status ?? 'unknown',
        data: transactionData,
      },
      'Transaction update skipped',
    );

    return;
  }

  await updateUserTransaction({
    con,
    transaction,
    data: transactionData,
    nextStatus: transaction ? undefined : nextStatus,
    event,
  });
};

export const processCoresTransactionCompleted = async ({
  event,
}: {
  event: TransactionCompletedEvent;
}) => {
  const transactionData = getPaddleTransactionData({ event });
  const con = await createOrGetConnection();

  let transaction = await getTransactionForProviderId({
    con,
    providerId: transactionData.id,
  });

  transaction = await con.transaction(async (entityManager) => {
    const userTransaction = await updateUserTransaction({
      con: entityManager,
      transaction,
      nextStatus: UserTransactionStatus.Success,
      data: transactionData,
      event,
    });

    const user: Pick<User, 'id' | 'coresRole'> = await entityManager
      .getRepository(User)
      .findOneOrFail({
        select: ['id', 'coresRole'],
        where: {
          id: transactionData.customData.user_id,
        },
      });

    if (
      checkUserCoresAccess({
        user,
        requiredRole: CoresRole.User,
      }) === false
    ) {
      throw new Error('User does not have access to cores purchase');
    }

    // skip njord if transaction has test discount
    const shouldSkipNjord =
      !!transactionData.discountId &&
      !!remoteConfig.vars.paddleTestDiscountIds?.includes(
        transactionData.discountId,
      );

    if (shouldSkipNjord) {
      await entityManager.getRepository(UserTransaction).update(
        {
          id: userTransaction.id,
        },
        {
          flags: updateFlagsStatement<UserTransaction>({
            note: 'NJORD_SKIPPED_FOR_TEST_DISCOUNT',
          }),
        },
      );
    }

    if (!shouldSkipNjord) {
      try {
        await purchaseCores({
          transaction: userTransaction,
        });
      } catch (error) {
        if (error instanceof TransferError) {
          const userTransactionError = new UserTransactionError({
            status: error.transfer.status,
            transaction: userTransaction,
          });

          // update transaction status to error
          await entityManager.getRepository(UserTransaction).update(
            {
              id: userTransaction.id,
            },
            {
              status: error.transfer.status as number,
              flags: updateFlagsStatement<UserTransaction>({
                error: userTransactionError.message,
              }),
            },
          );

          return entityManager.getRepository(UserTransaction).create({
            ...userTransaction,
            status: error.transfer.status as number,
            flags: {
              ...userTransaction.flags,
              error: userTransactionError.message,
            },
          });
        }

        throw error;
      }
    }

    return userTransaction;
  });

  if (transaction.status === UserTransactionStatus.Success) {
    await notifyNewPaddleCoresTransaction({
      data: transactionData,
      transaction: transaction,
      event,
    });
  }

  return;
};

import type { EventEntity } from '@paddle/paddle-node-sdk';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../../../entity/user/UserTransaction';
import type { getPaddleTransactionData } from '../index';
import { logger } from '../../../logger';
import { SubscriptionProvider } from '../../../entity';
import { updateFlagsStatement } from '../../utils';
import type { DataSource, EntityManager } from 'typeorm';

export const checkTransactionStatusValid = ({
  event,
  transaction,
  nextStatus,
  validStatus,
  data,
}: {
  event: EventEntity;
  transaction: UserTransaction;
  nextStatus: UserTransactionStatus;
  validStatus: UserTransactionStatus[];
  data: ReturnType<typeof getPaddleTransactionData>;
}): boolean => {
  if (!validStatus.includes(transaction.status)) {
    logger.warn(
      {
        eventType: event.eventType,
        provider: SubscriptionProvider.Paddle,
        currentStatus: transaction.status,
        nextStatus,
        data,
      },
      'Transaction with invalid status',
    );

    return false;
  }

  return true;
};

export const updateUserTransaction = async ({
  con,
  transaction,
  nextStatus,
  data,
}: {
  con: DataSource | EntityManager;
  transaction: UserTransaction | null;
  nextStatus?: UserTransactionStatus;
  data: ReturnType<typeof getPaddleTransactionData>;
  event: EventEntity;
}): Promise<UserTransaction> => {
  const providerTransactionId = data.id;

  const itemData = data.items[0];

  if (transaction) {
    if (transaction.receiverId !== data.customData.user_id) {
      throw new Error('Transaction receiver does not match user ID');
    }

    if (
      transaction.status === UserTransactionStatus.Success &&
      transaction.value !== itemData.price.customData.cores
    ) {
      throw new Error('Transaction value changed after success');
    }
  }

  const payload = con.getRepository(UserTransaction).create({
    processor: UserTransactionProcessor.Paddle,
    id: transaction?.id,
    receiverId: data.customData.user_id,
    status: nextStatus,
    productId: null, // no product user is buying cores directly
    senderId: null, // no sender, user is buying cores
    value: itemData.price.customData.cores,
    valueIncFees: itemData.price.customData.cores,
    fee: 0, // no fee when buying cores
    request: {},
    flags: {
      providerId: providerTransactionId,
    },
  });

  if (!transaction) {
    const insertResult = await con
      .getRepository(UserTransaction)
      .createQueryBuilder()
      .insert()
      .values(payload)
      .onConflict(
        `((flags->>'providerId')) DO UPDATE SET status = EXCLUDED.status,
            value = EXCLUDED.value,
            "valueIncFees" = EXCLUDED."valueIncFees",
            "updatedAt" = NOW()`,
      )
      .returning(['id'])
      .execute();

    payload.id = insertResult.raw[0].id;

    return payload;
  } else {
    await con.getRepository(UserTransaction).update(
      { id: transaction.id },
      {
        value: itemData.price.customData.cores,
        valueIncFees: itemData.price.customData.cores,
        status: nextStatus,
        flags: updateFlagsStatement<UserTransaction>({
          error: null,
        }),
      },
    );

    return con.getRepository(UserTransaction).create({
      ...transaction,
      value: itemData.price.customData.cores,
      valueIncFees: itemData.price.customData.cores,
      status: nextStatus ?? transaction.status,
      flags: {
        ...transaction.flags,
        error: null,
      },
    });
  }
};

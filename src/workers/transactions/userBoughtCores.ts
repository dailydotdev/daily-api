import {
  CioTransactionalMessageTemplateId,
  sendEmail,
  updateFlagsStatement,
} from '../../common';
import { formatCoresCurrency } from '../../common/number';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../../entity/user/UserTransaction';
import type { TypedWorker } from '../worker';

const purchaseProcessors = [
  // UserTransactionProcessor.AppleStoreKit,
  UserTransactionProcessor.Paddle,
];

export const userBoughtCores: TypedWorker<'api.v1.user-transaction'> = {
  subscription: 'api.user-bought-cores',
  handler: async ({ data }, con, logger): Promise<void> => {
    const transaction = await con.getRepository(UserTransaction).findOneBy({
      id: data.transaction.id,
    });

    if (!transaction) {
      logger.error(
        { transactionId: data.transaction.id },
        'Transaction not found',
      );
      return;
    }

    if (!purchaseProcessors.includes(transaction.processor)) {
      return;
    }

    if (transaction.status !== UserTransactionStatus.Success) {
      return;
    }

    if (transaction.flags.emailSent) {
      return;
    }

    const user = await transaction.receiver;

    const coreAmount = formatCoresCurrency(transaction.value);

    await sendEmail({
      send_to_unsubscribed: true,
      transactional_message_id:
        CioTransactionalMessageTemplateId.UserBoughtCores,
      message_data: {
        core_amount: `+${coreAmount}`,
      },
      identifiers: {
        id: user.id,
      },
      to: user.email,
    });

    await con.getRepository(UserTransaction).update(transaction.id, {
      flags: updateFlagsStatement({
        emailSent: true,
      }),
    });
  },
};

import {
  CioTransactionalMessageTemplateId,
  isSpecialUser,
  sendEmail,
  updateFlagsStatement,
} from '../../common';
import { formatCoresCurrency } from '../../common/number';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../../entity/user/UserTransaction';
import {
  NotificationChannel,
  NotificationType,
} from '../../notifications/common';
import { isSubscribedToNotificationType } from '../notifications/utils';
import type { TypedWorker } from '../worker';

const purchaseProcessors = [
  UserTransactionProcessor.AppleStoreKit,
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
      logger.info(
        { transactionId: transaction.id },
        'Email already sent for this transaction',
      );
      return;
    }

    if (isSpecialUser({ userId: transaction.receiverId })) {
      return;
    }

    const user = await transaction.receiver;

    const shouldReceiveEmail = isSubscribedToNotificationType(
      user.notificationFlags,
      NotificationType.InAppPurchases,
      NotificationChannel.Email,
    );

    if (!shouldReceiveEmail) {
      return;
    }

    const coreAmount = formatCoresCurrency(transaction.valueIncFees);

    await con.getRepository(UserTransaction).update(
      {
        id: transaction.id,
      },
      {
        flags: updateFlagsStatement({
          emailSent: true,
        }),
      },
    );

    try {
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

      logger.info(
        { transactionId: transaction.id },
        'Email sent for user bought cores',
      );
    } catch (_err) {
      const err = _err as Error;
      logger.error(
        { err, transactionId: transaction.id },
        'failed to send email for user bought cores',
      );
      await con.getRepository(UserTransaction).update(
        {
          id: transaction.id,
        },
        {
          flags: updateFlagsStatement({
            emailSent: false,
          }),
        },
      );
      throw err;
    }
  },
};

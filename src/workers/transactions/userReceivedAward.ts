import {
  UserTransaction,
  UserTransactionProcessor,
} from '../../entity/user/UserTransaction';
import { NotificationType } from '../../notifications/common';
import { generateTypedNotificationWorker } from '../notifications/worker';

export const userReceivedAward =
  generateTypedNotificationWorker<'api.v1.user-transaction'>({
    subscription: 'api.user-received-award',
    handler: async (data, con, logger) => {
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

      if (transaction.processor !== UserTransactionProcessor.Njord) {
        return;
      }

      logger.info({ transaction }, 'userReceivedAward');

      const awarder = await transaction.sender;
      const recipient = await transaction.receiver;

      return [
        {
          type: NotificationType.UserReceivedAward,
          ctx: {
            userIds: [transaction.receiverId],
            transaction,
            awarder,
            recipient,
          },
        },
      ];
    },
  });

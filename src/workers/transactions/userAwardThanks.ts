import { env } from 'node:process';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../../entity/user/UserTransaction';
import { NotificationType } from '../../notifications/common';
import { isSpecialUser } from '../../common/utils';
import { TypedNotificationWorker } from '../worker';

export const userAwardThanks: TypedNotificationWorker<'api.v1.user-award-thanks'> =
  {
    subscription: 'api.user-award-thanks-notification',
    handler: async (data, con, logger) => {
      const transaction = await con.getRepository(UserTransaction).findOne({
        where: { id: data.transactionId },
        relations: {
          sender: true,
          receiver: true,
        },
      });

      if (!transaction) {
        logger.error(
          { transactionId: data.transactionId },
          'Transaction not found',
        );
        return;
      }

      if (
        !transaction.productId ||
        transaction.status !== UserTransactionStatus.Success ||
        transaction.processor !== UserTransactionProcessor.Njord ||
        !transaction.senderId ||
        isSpecialUser({ userId: transaction.senderId })
      ) {
        return;
      }

      const thanker = await transaction.receiver;
      const awardSender = await transaction.sender;

      return [
        {
          type: NotificationType.UserAwardThanks,
          ctx: {
            userIds: [transaction.senderId],
            transaction,
            sender: thanker,
            receiver: awardSender,
            targetUrl: `${env.COMMENTS_PREFIX}/${thanker.username}`,
          },
        },
      ];
    },
  };

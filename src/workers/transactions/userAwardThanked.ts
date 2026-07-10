import { env } from 'node:process';
import {
  UserTransaction,
  UserTransactionProcessor,
} from '../../entity/user/UserTransaction';
import { NotificationType } from '../../notifications/common';
import { isSpecialUser } from '../../common';
import { TypedNotificationWorker } from '../worker';

export const userAwardThanked: TypedNotificationWorker<'api.v1.user-award-thanked'> =
  {
    subscription: 'api.user-award-thanked-notification',
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
          type: NotificationType.UserAwardThanked,
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

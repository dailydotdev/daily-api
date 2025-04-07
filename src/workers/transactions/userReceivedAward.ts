import { Feature, FeatureType } from '../../entity';
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

      if (!transaction.productId) {
        logger.info(
          { transactionId: transaction.id },
          'userReceivedAward: transaction has no productId',
        );
        return;
      }

      if (transaction.processor !== UserTransactionProcessor.Njord) {
        return;
      }

      const isRecipientTeamMember = await con.getRepository(Feature).existsBy({
        feature: FeatureType.Team,
        userId: transaction.receiverId,
        value: 1,
      });

      if (!isRecipientTeamMember) {
        logger.info(
          { transactionId: transaction.id },
          'userReceivedAward: recipient is not a team member',
        );
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

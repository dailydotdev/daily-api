import { queryReadReplica } from '../../common/queryReadReplica';
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
    handler: async (data, con, logger) =>
      queryReadReplica(con, async ({ queryRunner }) => {
        const transaction = await queryRunner.manager
          .getRepository(UserTransaction)
          .findOne({
            where: { id: data.transaction.id },
            relations: {
              sender: true,
              receiver: true,
            },
          });

        if (!transaction) {
          logger.error(
            { transactionId: data.transaction.id },
            'Transaction not found',
          );
          return;
        }

        if (!transaction.productId) {
          return;
        }

        if (transaction.processor !== UserTransactionProcessor.Njord) {
          return;
        }

        const isReceiverTeamMember = await queryRunner.manager
          .getRepository(Feature)
          .existsBy({
            feature: FeatureType.Team,
            userId: transaction.receiverId,
            value: 1,
          });

        if (!isReceiverTeamMember) {
          logger.debug(
            { transactionId: transaction.id },
            'userReceivedAward: receiver is not a team member',
          );
          return;
        }

        logger.info({ transaction }, 'userReceivedAward');

        const sender = await transaction.sender;
        const receiver = await transaction.receiver;

        return [
          {
            type: NotificationType.UserReceivedAward,
            ctx: {
              userIds: [transaction.receiverId],
              transaction,
              sender,
              receiver,
            },
          },
        ];
      }),
  });

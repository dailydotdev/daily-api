import { randomUUID } from 'node:crypto';
import { systemUser } from '../common';
import { transferCores, usdToCores } from '../common/njord';
import { Post } from '../entity';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
  UserTransactionType,
} from '../entity/user/UserTransaction';
import { TypedWorker } from './worker';

const worker: TypedWorker<'api.v1.post-boost-canceled'> = {
  subscription: 'api.post-boost-canceled-cores',
  handler: async (message, con, logger): Promise<void> => {
    const { data } = message;
    const { userId, postId, refundAmountUsd, campaignId } = data;

    try {
      const { transactionId } = await con.transaction(async (entityManager) => {
        const post = await entityManager
          .getRepository(Post)
          .findOneBy({ id: postId });

        if (!post) {
          return {};
        }

        const userTransaction = await entityManager
          .getRepository(UserTransaction)
          .save(
            entityManager.getRepository(UserTransaction).create({
              id: randomUUID(),
              processor: UserTransactionProcessor.Njord,
              receiverId: userId,
              status: UserTransactionStatus.Success,
              productId: null,
              senderId: systemUser.id,
              value: usdToCores(refundAmountUsd),
              valueIncFees: 0,
              fee: 0,
              flags: { note: 'Post boost canceled' },
              referenceId: campaignId,
              referenceType: UserTransactionType.PostBoost,
            }),
          );

        await transferCores({
          ctx: { userId },
          transaction: userTransaction,
          entityManager,
        });

        return { transactionId: userTransaction.id };
      });

      logger.info(
        {
          data,
          transactionId,
          messageId: message.messageId,
        },
        'post boost canceled, cores transferred',
      );
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to transfer cores for post boost cancelation',
      );
    }
  },
};

export default worker;

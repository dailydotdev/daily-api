import { env } from 'node:process';
import { Source, UserPost } from '../../entity';
import { UserComment } from '../../entity/user/UserComment';
import {
  UserTransaction,
  UserTransactionProcessor,
} from '../../entity/user/UserTransaction';
import { NotificationType } from '../../notifications/common';
import { isSpecialUser } from '../../common';
import { TypedNotificationWorker } from '../worker';

export const userReceivedAward: TypedNotificationWorker<'api.v1.user-transaction'> =
  {
    subscription: 'api.user-received-award',
    handler: async (data, con, logger) => {
      const transaction = await con.getRepository(UserTransaction).findOne({
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

      if (isSpecialUser({ userId: transaction.receiverId })) {
        return;
      }

      const sender = await transaction.sender;
      const receiver = await transaction.receiver;

      const [userPost, userComment, source] = await Promise.all([
        con.manager.getRepository(UserPost).findOneBy({
          awardTransactionId: transaction.id,
        }),
        con.manager.getRepository(UserComment).findOneBy({
          awardTransactionId: transaction.id,
        }),
        transaction.flags?.sourceId
          ? con.manager.getRepository(Source).findOneBy({
              id: transaction.flags.sourceId,
            })
          : undefined,
      ]);

      let targetUrl = `/${receiver.username}`;

      if (userPost) {
        targetUrl = `/posts/${userPost.postId}`;
      } else if (userComment) {
        const comment = await userComment.comment;
        targetUrl = `/posts/${comment.postId}#c-${userComment.commentId}`;
      }

      return [
        {
          type: NotificationType.UserReceivedAward,
          ctx: {
            userIds: [transaction.receiverId],
            transaction,
            sender,
            receiver,
            targetUrl: `${env.COMMENTS_PREFIX}${targetUrl}`,
            source,
          },
        },
      ];
    },
  };

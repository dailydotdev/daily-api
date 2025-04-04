import { createClient, type ConnectError } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import {
  Credits,
  Currency,
  EntityType,
  GetBalanceResponse,
  TransferStatus,
  TransferType,
  type BalanceChange,
  type TransferResult,
} from '@dailydotdev/schema';
import type { AuthContext } from '../Context';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../entity/user/UserTransaction';
import {
  isProd,
  isSpecialUser,
  parseBigInt,
  systemUser,
  updateFlagsStatement,
} from './utils';
import { ForbiddenError } from 'apollo-server-errors';
import { checkCoresAccess, createAuthProtectedFn } from './user';
import {
  deleteRedisKey,
  getRedisObject,
  setRedisObjectWithExpiry,
} from '../redis';
import { generateStorageKey, StorageKey, StorageTopic } from '../config';
import { coresBalanceExpirationSeconds } from './constants';
import { ConflictError, NjordErrorMessages, TransferError } from '../errors';
import { GarmrService } from '../integrations/garmr';
import { BrokenCircuitError } from 'cockatiel';
import type { EntityManager } from 'typeorm';
import { Product, ProductType } from '../entity/Product';
import { remoteConfig } from '../remoteConfig';
import { queryReadReplica } from './queryReadReplica';
import { UserPost } from '../entity/user/UserPost';
import { Post } from '../entity/posts/Post';
import { Comment } from '../entity';
import { UserComment } from '../entity/user/UserComment';
import { saveComment } from '../schema/comments';
import { generateShortId } from '../ids';
import { checkWithVordr, VordrFilterType } from './vordr';
import { CoresRole } from '../types';
import { GraphQLError } from 'graphql';
import { randomUUID } from 'node:crypto';
import { logger } from '../logger';

const transport = createGrpcTransport({
  baseUrl: process.env.NJORD_ORIGIN,
  httpVersion: '2',
});

const garmNjordService = new GarmrService({
  service: 'njord',
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
  retryOpts: {
    maxAttempts: 1,
  },
});

export const getNjordClient = (clientTransport = transport) => {
  return createClient<typeof Credits>(Credits, clientTransport);
};

export type TransferProps = {
  ctx: Pick<AuthContext, 'userId' | 'isTeamMember'>;
  transaction: UserTransaction;
};

export type TransactionProps = {
  ctx: Omit<AuthContext, 'con'>;
  productId: string;
  receiverId: string;
  note?: string;
};

export const createTransaction = createAuthProtectedFn(
  async ({
    ctx,
    entityManager,
    id,
    productId,
    receiverId,
    note,
  }: TransactionProps & {
    id?: string;
    entityManager: EntityManager;
  }): Promise<UserTransaction> => {
    const { userId: senderId } = ctx;

    const product = await entityManager.getRepository(Product).findOneByOrFail({
      id: productId,
    });

    const userTransaction = entityManager
      .getRepository(UserTransaction)
      .create({
        id: id || randomUUID(),
        processor: UserTransactionProcessor.Njord,
        receiverId,
        status: UserTransactionStatus.Success,
        productId: product.id,
        senderId,
        value: product.value,
        fee: remoteConfig.vars.fees?.transfer || 0,
        request: ctx.requestMeta,
        flags: {
          note,
        },
      });

    const userTransactionResult = await entityManager
      .getRepository(UserTransaction)
      .insert(userTransaction);

    userTransaction.id = userTransactionResult.identifiers[0].id as string;

    return userTransaction;
  },
);

const parseBalanceUpdate = ({
  balance,
  userId,
}: {
  balance?: BalanceChange;
  userId: string;
}):
  | {
      balance: BalanceChange;
      userId: string;
    }
  | undefined => {
  if (!balance || !userId) {
    return undefined;
  }

  return {
    balance,
    userId,
  };
};

export const transferCores = createAuthProtectedFn(
  async ({ ctx, transaction }: TransferProps): Promise<TransferResult> => {
    // TODO feat/transactions check if user is team member, remove check when prod is ready
    if (!ctx.isTeamMember && isProd) {
      throw new ForbiddenError('Not allowed for you yet');
    }

    // TODO feat/transactions check if session is valid for real on whoami endpoint

    const njordClient = getNjordClient();

    if (!transaction.id) {
      throw new Error('No transaction id');
    }

    if (!transaction.senderId) {
      throw new Error('No sender id');
    }

    const senderId = transaction.senderId;
    const receiverId = transaction.receiverId;

    const response = await garmNjordService.execute(async () => {
      const response = await njordClient.transfer({
        idempotencyKey: transaction.id,
        transfers: [
          {
            transferType: TransferType.TRANSFER,
            currency: Currency.CORES,
            sender: {
              id: senderId,
              type: EntityType.USER,
            },
            receiver: {
              id: receiverId,
              type: EntityType.USER,
            },
            amount: transaction.value,
            fee: {
              percentage: transaction.fee,
            },
          },
        ],
      });

      return response;
    });

    if (response.status !== TransferStatus.SUCCESS) {
      throw new TransferError(response);
    }

    const { results } = response;

    // we always have single transfer
    const result = results.find(
      (item) => item.transferType === TransferType.TRANSFER,
    );

    if (!result) {
      throw new Error('No transfer result');
    }

    await Promise.allSettled([
      [
        parseBalanceUpdate({
          balance: result.senderBalance,
          userId: transaction.senderId,
        }),
        parseBalanceUpdate({
          balance: result.receiverBalance,
          userId: transaction.receiverId,
        }),
      ].map(async (balanceUpdate) => {
        if (!balanceUpdate) {
          return;
        }

        await updateBalanceCache({
          ctx: {
            userId: balanceUpdate.userId,
          },
          value: {
            amount: parseBigInt(balanceUpdate.balance.newBalance),
          },
        });
      }),
    ]);

    return result;
  },
);

export const purchaseCores = async ({
  transaction,
}: {
  transaction: UserTransaction;
}): Promise<TransferResult> => {
  if (!transaction.id) {
    throw new Error('No transaction id');
  }

  if (transaction.senderId) {
    throw new Error('Purchase cores transaction can not have sender');
  }

  if (transaction.productId) {
    throw new Error('Purchase cores transaction can not have product');
  }

  const njordClient = getNjordClient();

  const response = await garmNjordService.execute(async () => {
    const response = await njordClient.transfer({
      idempotencyKey: transaction.id,
      transfers: [
        {
          transferType: TransferType.TRANSFER,
          currency: Currency.CORES,
          sender: {
            id: systemUser.id,
            type: EntityType.SYSTEM,
          },
          receiver: {
            id: transaction.receiverId,
            type: EntityType.USER,
          },
          amount: transaction.value,
          fee: {
            percentage: transaction.fee,
          },
        },
      ],
    });

    return response;
  });

  if (response.status !== TransferStatus.SUCCESS) {
    throw new TransferError(response);
  }

  const { results } = response;

  // we always have single transfer
  const result = results.find(
    (item) => item.transferType === TransferType.TRANSFER,
  );

  if (!result) {
    throw new Error('No transfer result');
  }

  await Promise.allSettled([
    [
      parseBalanceUpdate({
        balance: result.receiverBalance,
        userId: transaction.receiverId,
      }),
    ].map(async (balanceUpdate) => {
      if (!balanceUpdate) {
        return;
      }

      await updateBalanceCache({
        ctx: {
          userId: balanceUpdate.userId,
        },
        value: {
          amount: parseBigInt(balanceUpdate.balance.newBalance),
        },
      });
    }),
  ]);

  return result;
};

export type GetBalanceProps = Pick<AuthContext, 'userId'>;

export type GetBalanceResult = {
  amount: number;
};

const getBalanceRedisKey = createAuthProtectedFn(({ ctx }) => {
  const redisKey = generateStorageKey(
    StorageTopic.Njord,
    StorageKey.CoresBalance,
    ctx.userId,
  );

  return redisKey;
});

export const getFreshBalance = async ({
  userId,
}: GetBalanceProps): Promise<GetBalanceResult> => {
  const njordClient = getNjordClient();

  const balance = await garmNjordService.execute(async () => {
    try {
      const result = await njordClient.getBalance({
        account: {
          userId: userId,
          currency: Currency.CORES,
        },
      });

      return result;
    } catch (originalError) {
      const error = originalError as ConnectError;

      // user has no account yet, account is created on first transfer
      if (error.rawMessage === NjordErrorMessages.BalanceAccountNotFound) {
        return new GetBalanceResponse({
          amount: 0,
        } as GetBalanceResult);
      }

      throw originalError;
    }
  });

  return {
    amount: parseBigInt(balance.amount),
  };
};

export const updateBalanceCache = createAuthProtectedFn(
  async ({
    ctx,
    value,
  }: { ctx: Pick<AuthContext, 'userId'> } & {
    value: GetBalanceResult;
  }) => {
    const redisKey = getBalanceRedisKey({ ctx });

    await setRedisObjectWithExpiry(
      redisKey,
      JSON.stringify(value),
      coresBalanceExpirationSeconds,
    );
  },
);

export const expireBalanceCache = createAuthProtectedFn(async ({ ctx }) => {
  const redisKey = getBalanceRedisKey({ ctx });

  await deleteRedisKey(redisKey);
});

export const getBalance = async ({ userId }: GetBalanceProps) => {
  const redisKey = getBalanceRedisKey({ ctx: { userId } });

  const redisResult = await getRedisObject(redisKey);

  if (redisResult) {
    const cachedBalance = JSON.parse(redisResult) as GetBalanceResult;

    return cachedBalance;
  }

  try {
    const freshBalance = await getFreshBalance({ userId });

    await updateBalanceCache({ ctx: { userId }, value: freshBalance });

    return freshBalance;
  } catch (originalError) {
    if (originalError instanceof BrokenCircuitError) {
      // if njord is down, return 0 balance for now
      return {
        amount: 0,
      };
    }

    throw originalError;
  }
};

export enum AwardType {
  Post = 'POST',
  User = 'USER',
  Comment = 'COMMENT',
}

export type AwardInput = Pick<TransactionProps, 'productId' | 'note'> & {
  entityId: string;
  type: AwardType;
};

export type TransactionCreated = {
  transactionId: string;
  balance: GetBalanceResult;
};

const canAward = async ({
  ctx,
  receiverId,
}: {
  ctx: AuthContext;
  receiverId?: string | null;
}): Promise<void> => {
  if (!receiverId) {
    throw new ConflictError('Can not award this entity');
  }

  if (ctx.userId === receiverId) {
    throw new ForbiddenError('Can not award yourself');
  }

  if (isSpecialUser({ userId: receiverId })) {
    throw new ForbiddenError('Can not award this user');
  }

  if (
    (await checkCoresAccess({
      ctx,
      userId: receiverId,
      requiredRole: CoresRole.Creator,
    })) === false
  ) {
    throw new ForbiddenError('You can not award this user');
  }
};

export const awardUser = async (
  props: AwardInput,
  ctx: AuthContext,
): Promise<TransactionCreated> => {
  const newTransactionId = randomUUID();

  try {
    await canAward({ ctx, receiverId: props.entityId });

    const product = await queryReadReplica<Pick<Product, 'id' | 'type'>>(
      ctx.con,
      async ({ queryRunner }) => {
        return queryRunner.manager.getRepository(Product).findOneOrFail({
          select: ['id', 'type'],
          where: {
            id: props.productId,
          },
        });
      },
    );

    if (product.type !== ProductType.Award) {
      throw new ForbiddenError('Can not award this product');
    }

    const { transaction, transfer } = await ctx.con.transaction(
      async (entityManager) => {
        const { entityId: receiverId, note } = props;

        const transaction = await createTransaction({
          ctx,
          id: newTransactionId,
          entityManager,
          productId: product.id,
          receiverId,
          note,
        });

        try {
          const transfer = await transferCores({
            ctx,
            transaction,
          });

          return { transaction, transfer };
        } catch (error) {
          if (error instanceof TransferError) {
            await throwUserTransactionError({
              ctx,
              entityManager,
              error,
              transaction,
            });
          }

          throw error;
        }
      },
    );

    return {
      transactionId: transaction.id,
      balance: {
        amount: parseBigInt(transfer.senderBalance!.newBalance),
      },
    };
  } catch (error) {
    logger.error(
      {
        context: 'award',
        err: error,
        props,
        userId: ctx.userId,
        transactionId: newTransactionId,
      },
      'Award error',
    );

    throw error;
  }
};

export const awardPost = async (
  props: AwardInput,
  ctx: AuthContext,
): Promise<TransactionCreated> => {
  const newTransactionId = randomUUID();

  try {
    const [product, post, userPost] = await queryReadReplica<
      [
        Pick<Product, 'id' | 'type'>,
        Pick<Post, 'id' | 'authorId' | 'sourceId'>,
        Pick<UserPost, 'awardTransactionId'> | null,
      ]
    >(ctx.con, async ({ queryRunner }) => {
      return Promise.all([
        queryRunner.manager.getRepository(Product).findOneOrFail({
          select: ['id', 'type'],
          where: {
            id: props.productId,
          },
        }),
        queryRunner.manager.getRepository(Post).findOneOrFail({
          select: ['id', 'authorId', 'sourceId'],
          where: {
            id: props.entityId,
          },
        }),
        queryRunner.manager.getRepository(UserPost).findOne({
          select: ['awardTransactionId'],
          where: {
            postId: props.entityId,
            userId: ctx.userId,
          },
        }),
      ]);
    });

    await canAward({ ctx, receiverId: post.authorId });

    if (product.type !== ProductType.Award) {
      throw new ForbiddenError('Can not award this product');
    }

    if (userPost?.awardTransactionId) {
      throw new ConflictError('Post already awarded');
    }

    const { transaction, transfer } = await ctx.con.transaction(
      async (entityManager) => {
        if (!post.authorId) {
          throw new ConflictError('Post does not have an author');
        }

        const { note } = props;

        const transaction = await createTransaction({
          ctx,
          id: newTransactionId,
          entityManager,
          productId: product.id,
          receiverId: post.authorId,
          note,
        });

        if (!transaction.productId) {
          throw new Error('Product missing from transaction');
        }

        await entityManager
          .getRepository(UserPost)
          .createQueryBuilder()
          .insert()
          .into(UserPost)
          .values({
            postId: post.id,
            userId: ctx.userId,
            awardTransactionId: transaction.id,
            flags: {
              awardId: transaction.productId,
            },
          })
          .onConflict(
            `("postId", "userId") DO UPDATE SET "awardTransactionId" = EXCLUDED."awardTransactionId", "flags" = user_post.flags || EXCLUDED."flags"`,
          )
          .execute();

        let newComment: Comment | undefined;

        if (note) {
          newComment = entityManager.getRepository(Comment).create({
            id: await generateShortId(),
            postId: post.id,
            parentId: null,
            userId: ctx.userId,
            content: note,
            awardTransactionId: transaction.id,
            flags: {
              awardId: transaction.productId,
            },
          });

          newComment.flags = {
            ...newComment.flags,
            vordr: await checkWithVordr(
              {
                id: newComment.id,
                type: VordrFilterType.Comment,
                content: newComment.content,
              },
              ctx,
            ),
          };

          await saveComment(entityManager, newComment, post.sourceId);
        }

        try {
          const transfer = await transferCores({
            ctx,
            transaction,
          });

          return { transaction, transfer };
        } catch (error) {
          if (error instanceof TransferError) {
            if (newComment) {
              await entityManager.getRepository(Comment).delete({
                id: newComment.id,
              });
            }

            await entityManager.getRepository(UserPost).delete({
              awardTransactionId: transaction.id,
            });

            await throwUserTransactionError({
              ctx,
              entityManager,
              error,
              transaction,
            });
          }

          throw error;
        }
      },
    );

    return {
      transactionId: transaction.id,
      balance: {
        amount: parseBigInt(transfer.senderBalance!.newBalance),
      },
    };
  } catch (error) {
    logger.error(
      {
        context: 'award',
        err: error,
        props,
        userId: ctx.userId,
        transactionId: newTransactionId,
      },
      'Award error',
    );

    throw error;
  }
};

export const awardComment = async (
  props: AwardInput,
  ctx: AuthContext,
): Promise<TransactionCreated> => {
  const newTransactionId = randomUUID();

  try {
    const [product, comment, userComment] = await queryReadReplica<
      [
        Pick<Product, 'id' | 'type'>,
        Pick<Comment, 'id' | 'userId' | 'postId' | 'post' | 'parentId'>,
        Pick<UserComment, 'awardTransactionId'> | null,
      ]
    >(ctx.con, async ({ queryRunner }) => {
      return Promise.all([
        queryRunner.manager.getRepository(Product).findOneOrFail({
          select: ['id', 'type'],
          where: {
            id: props.productId,
          },
        }),
        queryRunner.manager.getRepository(Comment).findOneOrFail({
          select: ['id', 'userId', 'postId', 'parentId'],
          where: {
            id: props.entityId,
          },
          relations: {
            post: true,
          },
        }),
        queryRunner.manager.getRepository(UserComment).findOne({
          select: ['awardTransactionId'],
          where: {
            commentId: props.entityId,
            userId: ctx.userId,
          },
        }),
      ]);
    });

    await canAward({ ctx, receiverId: comment.userId });

    if (product.type !== ProductType.Award) {
      throw new ForbiddenError('Can not award this product');
    }

    if (userComment?.awardTransactionId) {
      throw new ConflictError('Comment already awarded');
    }

    const { transaction, transfer } = await ctx.con.transaction(
      async (entityManager) => {
        const { note } = props;

        const transaction = await createTransaction({
          ctx,
          id: newTransactionId,
          entityManager,
          productId: product.id,
          receiverId: comment.userId,
          note,
        });

        if (!transaction.productId) {
          throw new Error('Product missing from transaction');
        }

        await entityManager
          .getRepository(UserComment)
          .createQueryBuilder()
          .insert()
          .into(UserComment)
          .values({
            commentId: comment.id,
            userId: ctx.userId,
            awardTransactionId: transaction.id,
            flags: {
              awardId: transaction.productId,
            },
          })
          .onConflict(
            `("commentId", "userId") DO UPDATE SET "awardTransactionId" = EXCLUDED."awardTransactionId", "flags" = user_comment.flags || EXCLUDED."flags"`,
          )
          .execute();

        let newComment: Comment | undefined;

        if (note) {
          const post = await comment.post;

          newComment = entityManager.getRepository(Comment).create({
            id: await generateShortId(),
            postId: comment.postId,
            parentId: comment.parentId || comment.id,
            userId: ctx.userId,
            content: note,
            awardTransactionId: transaction.id,
            flags: {
              awardId: transaction.productId,
            },
          });

          newComment.flags = {
            ...newComment.flags,
            vordr: await checkWithVordr(
              {
                id: newComment.id,
                type: VordrFilterType.Comment,
                content: newComment.content,
              },
              ctx,
            ),
          };

          await saveComment(entityManager, newComment, post.sourceId);
        }

        try {
          const transfer = await transferCores({
            ctx,
            transaction,
          });

          return { transaction, transfer };
        } catch (error) {
          if (error instanceof TransferError) {
            if (newComment) {
              await entityManager.getRepository(Comment).delete({
                id: newComment.id,
              });
            }

            await entityManager.getRepository(UserComment).delete({
              awardTransactionId: transaction.id,
            });

            await throwUserTransactionError({
              ctx,
              entityManager,
              error,
              transaction,
            });
          }

          throw error;
        }
      },
    );

    return {
      transactionId: transaction.id,
      balance: {
        amount: parseBigInt(transfer.senderBalance!.newBalance),
      },
    };
  } catch (error) {
    logger.error(
      {
        context: 'award',
        err: error,
        props,
        userId: ctx.userId,
        transactionId: newTransactionId,
      },
      'Award error',
    );

    throw error;
  }
};

const userTransactionErrorMessageMap: Partial<
  Record<UserTransactionStatus, string>
> = {
  [UserTransactionStatus.InsufficientFunds]: 'Insufficient Cores balance.',
};

export class UserTransactionError extends GraphQLError {
  constructor(props: {
    status: UserTransactionStatus | TransferStatus;
    balance?: GetBalanceResult;
    transaction: UserTransaction;
  }) {
    const message =
      userTransactionErrorMessageMap[props.status] ||
      `Failed, code: ${props.status}`;

    super(message, {
      extensions: {
        code: 'BALANCE_TRANSACTION_ERROR',
        status: props.status,
        balance: props.balance,
        transactionId: props.transaction.id,
      },
    });
  }
}

export const throwUserTransactionError = async ({
  ctx,
  entityManager,
  error,
  transaction,
}: {
  ctx: AuthContext;
  entityManager: EntityManager;
  error: TransferError;
  transaction: UserTransaction;
}): Promise<never> => {
  const userBalance = error.transfer.results.find(
    (item) =>
      item.transferType === TransferType.TRANSFER &&
      item.senderId === ctx.userId,
  )?.senderBalance?.newBalance;

  const userTransactionError = new UserTransactionError({
    status: error.transfer.status,
    balance: userBalance
      ? {
          amount: parseBigInt(userBalance),
        }
      : undefined,
    transaction,
  });

  await entityManager.getRepository(UserTransaction).update(
    {
      id: transaction.id,
    },
    {
      status: error.transfer.status as number,
      flags: updateFlagsStatement<UserTransaction>({
        error: userTransactionError.message,
      }),
    },
  );

  // commit transaction after updating the transaction status
  await entityManager.queryRunner?.commitTransaction();

  // throw error for client after committing the transaction in error state
  throw userTransactionError;
};

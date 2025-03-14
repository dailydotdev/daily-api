import { createClient, type ConnectError } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import {
  Credits,
  Currency,
  EntityType,
  GetBalanceResponse,
  TransferType,
  type BalanceChange,
  type TransferResult,
} from '@dailydotdev/schema';
import type { AuthContext } from '../Context';
import {
  UserTransaction,
  UserTransactionStatus,
} from '../entity/user/UserTransaction';
import { isProd, isSpecialUser, parseBigInt, systemUser } from './utils';
import { ForbiddenError } from 'apollo-server-errors';
import { createAuthProtectedFn } from './user';
import {
  deleteRedisKey,
  getRedisObject,
  setRedisObjectWithExpiry,
} from '../redis';
import { generateStorageKey, StorageKey, StorageTopic } from '../config';
import { coresBalanceExpirationSeconds } from './constants';
import { ConflictError, NjordErrorMessages } from '../errors';
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
    productId,
    receiverId,
    note,
  }: TransactionProps & {
    entityManager: EntityManager;
  }): Promise<UserTransaction> => {
    const { userId: senderId } = ctx;

    const product = await entityManager.getRepository(Product).findOneByOrFail({
      id: productId,
    });

    const userTransaction = entityManager
      .getRepository(UserTransaction)
      .create({
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

    const transferResult = await garmNjordService.execute(async () => {
      if (!transaction.id) {
        throw new Error('No transaction id');
      }

      if (!transaction.senderId) {
        throw new Error('No sender id');
      }

      const { results } = await njordClient.transfer({
        idempotencyKey: transaction.id,
        transfers: [
          {
            transferType: TransferType.TRANSFER,
            currency: Currency.CORES,
            sender: {
              id: transaction.senderId,
              type: EntityType.USER,
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

      // TODO feat/transactions error handling

      return result;
    });

    return transferResult;
  },
);

export const purchaseCores = async ({
  transaction,
}: {
  transaction: UserTransaction;
}): Promise<TransferResult> => {
  const transferResult = await garmNjordService.execute(async () => {
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

    const { results } = await njordClient.transfer({
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

    // TODO feat/transactions error handling

    return result;
  });

  return transferResult;
};

export type GetBalanceProps = {
  ctx: Pick<AuthContext, 'userId'>;
};

export type GetBalanceResult = {
  amount: number;
};

const getBalanceRedisKey = createAuthProtectedFn(
  ({ ctx }: Pick<GetBalanceProps, 'ctx'>) => {
    const redisKey = generateStorageKey(
      StorageTopic.Njord,
      StorageKey.CoresBalance,
      ctx.userId,
    );

    return redisKey;
  },
);

export const getFreshBalance = createAuthProtectedFn(
  async ({ ctx }: GetBalanceProps): Promise<GetBalanceResult> => {
    const njordClient = getNjordClient();

    const balance = await garmNjordService.execute(async () => {
      try {
        const result = await njordClient.getBalance({
          account: {
            userId: ctx.userId,
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
  },
);

export const updateBalanceCache = createAuthProtectedFn(
  async ({ ctx, value }: GetBalanceProps & { value: GetBalanceResult }) => {
    const redisKey = getBalanceRedisKey({ ctx });

    await setRedisObjectWithExpiry(
      redisKey,
      JSON.stringify(value),
      coresBalanceExpirationSeconds,
    );
  },
);

export const expireBalanceCache = createAuthProtectedFn(
  async ({ ctx }: GetBalanceProps) => {
    const redisKey = getBalanceRedisKey({ ctx });

    await deleteRedisKey(redisKey);
  },
);

export const getBalance = createAuthProtectedFn(
  async ({ ctx }: GetBalanceProps) => {
    const redisKey = getBalanceRedisKey({ ctx });

    const redisResult = await getRedisObject(redisKey);

    if (redisResult) {
      const cachedBalance = JSON.parse(redisResult) as GetBalanceResult;

      return cachedBalance;
    }

    try {
      const freshBalance = await getFreshBalance({ ctx });

      await updateBalanceCache({ ctx, value: freshBalance });

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
  },
);

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
  if (ctx.userId === receiverId) {
    throw new ForbiddenError('Can not award yourself');
  }

  if (isSpecialUser({ userId: receiverId })) {
    throw new ForbiddenError('Can not award this user');
  }
};

export const awardUser = async (
  props: AwardInput,
  ctx: AuthContext,
): Promise<TransactionCreated> => {
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
        entityManager,
        productId: product.id,
        receiverId,
        note,
      });

      const transfer = await transferCores({
        ctx,
        transaction,
      });

      return { transaction, transfer };
    },
  );

  return {
    transactionId: transaction.id,
    balance: {
      amount: parseBigInt(transfer.senderBalance!.newBalance),
    },
  };
};

export const awardPost = async (
  props: AwardInput,
  ctx: AuthContext,
): Promise<TransactionCreated> => {
  const [product, post, userPost] = await queryReadReplica<
    [
      Pick<Product, 'id' | 'type'>,
      Pick<Post, 'id' | 'authorId'>,
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
        select: ['id', 'authorId'],
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

      const transfer = await transferCores({
        ctx,
        transaction,
      });

      return { transaction, transfer };
    },
  );

  return {
    transactionId: transaction.id,
    balance: {
      amount: parseBigInt(transfer.senderBalance!.newBalance),
    },
  };
};

export const awardComment = async (
  props: AwardInput,
  ctx: AuthContext,
): Promise<TransactionCreated> => {
  const [product, comment, userComment] = await queryReadReplica<
    [
      Pick<Product, 'id' | 'type'>,
      Pick<Comment, 'id' | 'userId' | 'postId' | 'post'>,
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
        select: ['id', 'userId', 'postId'],
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

      if (note) {
        const post = await comment.post;

        const newComment = entityManager.getRepository(Comment).create({
          id: await generateShortId(),
          postId: comment.postId,
          parentId: comment.id,
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

      const transfer = await transferCores({
        ctx,
        transaction,
      });

      return { transaction, transfer };
    },
  );

  return {
    transactionId: transaction.id,
    balance: {
      amount: parseBigInt(transfer.senderBalance!.newBalance),
    },
  };
};

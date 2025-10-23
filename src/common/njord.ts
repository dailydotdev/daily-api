import {
  type CallOptions,
  type ConnectError,
  createClient,
} from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import {
  type BalanceChange,
  Credits,
  Currency,
  EntityType,
  GetBalanceRequest,
  GetBalanceResponse,
  TransferRequest,
  type TransferResult,
  TransferStatus,
  TransferType,
} from '@dailydotdev/schema';
import type { AuthContext } from '../Context';
import {
  UserTransaction,
  UserTransactionFlags,
  UserTransactionProcessor,
  UserTransactionStatus,
  UserTransactionType,
} from '../entity/user/UserTransaction';
import { isSpecialUser, parseBigInt, systemUser } from './utils';
import { ForbiddenError } from 'apollo-server-errors';
import {
  checkCoresAccess,
  checkUserCoresAccess,
  createAuthProtectedFn,
} from './user';
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
import { UserPost } from '../entity/user/UserPost';
import { Post } from '../entity/posts/Post';
import { Comment, SourceMember } from '../entity';
import { UserComment } from '../entity/user/UserComment';
import { saveComment } from '../schema/comments';
import { generateShortId } from '../ids';
import { checkWithVordr, VordrFilterType } from './vordr';
import { CoresRole, serviceClientId } from '../types';
import { GraphQLError } from 'graphql';
import crypto, { randomUUID } from 'node:crypto';
import { logger } from '../logger';
import { signJwt } from '../auth';
import { Message } from '@bufbuild/protobuf';
import { ensureSourcePermissions } from '../schema/sources';
import { SourceMemberRoles } from '../roles';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { usdToCores } from './number';

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

export type NjordJwtPayload = {
  client_id: string;
  message_hash: string;
};

export const createNjordAuth = async (
  payload: Message,
): Promise<Pick<CallOptions, 'headers'>> => {
  const authHeaders = new Headers();

  const { token } = await signJwt<NjordJwtPayload>(
    {
      client_id: serviceClientId,
      message_hash: crypto
        .createHash('sha256')
        .update(payload.toBinary())
        .digest('hex'),
    },
    0,
  );

  authHeaders.set('authorization', `Bearer ${token}`);

  return {
    headers: authHeaders,
  };
};

export type TransferProps = {
  ctx: Pick<AuthContext, 'userId'>;
  transaction: UserTransaction;
  entityManager: EntityManager;
};

export type TransactionProps = {
  ctx: Omit<AuthContext, 'con'>;
  productId: string;
  receiverId: string;
  note?: string;
  flags?: Pick<UserTransactionFlags, 'sourceId'>;
  entityReference?: {
    id: string;
    type: UserTransactionType;
  };
};

export const createTransaction = createAuthProtectedFn(
  async ({
    ctx,
    entityManager,
    id,
    productId,
    receiverId,
    note,
    flags,
    entityReference,
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
        status: UserTransactionStatus.Processing,
        productId: product.id,
        senderId,
        value: product.value,
        valueIncFees: product.value,
        fee: remoteConfig.vars.fees?.transfer || 0,
        request: ctx.requestMeta,
        flags: {
          note,
          ...flags,
        },
        referenceId: entityReference?.id,
        referenceType: entityReference?.type,
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
  async ({
    transaction,
    entityManager,
  }: TransferProps): Promise<TransferResult> => {
    // TODO feat/transactions check if session is valid for real on whoami endpoint

    const njordClient = getNjordClient();

    if (!transaction.id) {
      throw new Error('No transaction id');
    }

    if (!transaction.senderId) {
      throw new Error('No sender id');
    }

    const senderId = transaction.senderId;
    const senderType =
      senderId === systemUser.id ? EntityType.SYSTEM : EntityType.USER;
    const receiverId = transaction.receiverId;
    const receiverType =
      receiverId === systemUser.id ? EntityType.SYSTEM : EntityType.USER;

    const response = await garmNjordService.execute(async () => {
      const payload = new TransferRequest({
        idempotencyKey: transaction.id,
        transfers: [
          {
            transferType: TransferType.TRANSFER,
            currency: Currency.CORES,
            sender: {
              id: senderId,
              type: senderType,
            },
            receiver: {
              id: receiverId,
              type: receiverType,
            },
            amount: transaction.value,
            fee: {
              percentage: transaction.fee,
            },
          },
        ],
      });
      const response = await njordClient.transfer(
        payload,
        await createNjordAuth(payload),
      );

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

    const successTransactionUpdatePayload: QueryDeepPartialEntity<UserTransaction> =
      {
        status: UserTransactionStatus.Success,
      };

    // update transaction with received value after any fees are applied
    if (typeof result.receiverBalance?.changeAmount === 'bigint') {
      successTransactionUpdatePayload.valueIncFees = parseBigInt(
        result.receiverBalance.changeAmount,
      );
    }

    await entityManager.getRepository(UserTransaction).update(
      {
        id: transaction.id,
      },
      successTransactionUpdatePayload,
    );

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
    const payload = new TransferRequest({
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
    const response = await njordClient.transfer(
      payload,
      await createNjordAuth(payload),
    );

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
      const payload = new GetBalanceRequest({
        account: {
          userId: userId,
          currency: Currency.CORES,
        },
      });
      const result = await njordClient.getBalance(
        payload,
        await createNjordAuth(payload),
      );

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
  Squad = 'SQUAD',
}

export type AwardInput = Pick<
  TransactionProps,
  'productId' | 'note' | 'flags'
> & {
  entityId: string;
  type: AwardType;
};

export type TransactionCreated = {
  transactionId: string;
  balance: GetBalanceResult;
  referenceId?: string;
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

export const awardSquad = async (
  props: AwardInput,
  ctx: AuthContext,
): Promise<TransactionCreated> => {
  const sourceId = props.entityId;
  if (!sourceId) {
    throw new ForbiddenError('You can not award this Squad');
  }
  await ensureSourcePermissions(ctx, sourceId);
  // Extract the first eligible admin for this squad.
  const privilegedMembers = await ctx.con.manager
    .getRepository(SourceMember)
    .find({
      where: {
        sourceId,
        role: SourceMemberRoles.Admin,
      },
      relations: {
        user: true,
      },
      order: { createdAt: 'ASC' },
      take: 10,
    });
  if (!privilegedMembers) {
    throw new ForbiddenError(`Couldn't find users to award for this Squad`);
  }

  let firstAdminUser: SourceMember | undefined;
  for (const pm of privilegedMembers) {
    const specialUser = isSpecialUser({ userId: pm.userId });
    const canAward = checkUserCoresAccess({
      user: await pm.user,
      requiredRole: CoresRole.Creator,
    });
    if (!specialUser && canAward) {
      firstAdminUser = pm;
      break;
    }
  }

  if (!firstAdminUser?.userId) {
    throw new ForbiddenError(`Couldn't find users to award for this Squad`);
  }

  return awardUser(
    {
      ...props,
      entityId: firstAdminUser.userId,
      flags: { sourceId: props.entityId },
    },
    ctx,
  );
};

export const awardUser = async (
  props: AwardInput,
  ctx: AuthContext,
): Promise<TransactionCreated> => {
  const newTransactionId = randomUUID();

  try {
    await canAward({ ctx, receiverId: props.entityId });

    const product: Pick<Product, 'id' | 'type'> = await ctx.con.manager
      .getRepository(Product)
      .findOneOrFail({
        select: ['id', 'type'],
        where: {
          id: props.productId,
        },
      });

    if (product.type !== ProductType.Award) {
      throw new ForbiddenError('Can not award this product');
    }

    const { transaction, transfer } = await ctx.con.transaction(
      async (entityManager) => {
        const { entityId: receiverId, note, flags } = props;

        const transaction = await createTransaction({
          ctx,
          id: newTransactionId,
          entityManager,
          productId: product.id,
          receiverId,
          note,
          flags,
        });

        try {
          const transfer = await transferCores({
            ctx,
            transaction,
            entityManager,
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
    const [product, post, userPost]: [
      Pick<Product, 'id' | 'type'>,
      Pick<Post, 'id' | 'authorId' | 'sourceId'>,
      Pick<UserPost, 'awardTransactionId'> | null,
    ] = await Promise.all([
      ctx.con.manager.getRepository(Product).findOneOrFail({
        select: ['id', 'type'],
        where: {
          id: props.productId,
        },
      }),
      ctx.con.manager.getRepository(Post).findOneOrFail({
        select: ['id', 'authorId', 'sourceId'],
        where: {
          id: props.entityId,
        },
      }),
      ctx.con.manager.getRepository(UserPost).findOne({
        select: ['awardTransactionId'],
        where: {
          postId: props.entityId,
          userId: ctx.userId,
        },
      }),
    ]);

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
          entityReference: {
            id: post.id,
            type: UserTransactionType.Post,
          },
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
            entityManager,
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

export const awardComment = async (
  props: AwardInput,
  ctx: AuthContext,
): Promise<TransactionCreated> => {
  const newTransactionId = randomUUID();

  try {
    const [product, comment, userComment]: [
      Pick<Product, 'id' | 'type'>,
      Pick<Comment, 'id' | 'userId' | 'postId' | 'post' | 'parentId'>,
      Pick<UserComment, 'awardTransactionId'> | null,
    ] = await Promise.all([
      ctx.con.manager.getRepository(Product).findOneOrFail({
        select: ['id', 'type'],
        where: {
          id: props.productId,
        },
      }),
      ctx.con.manager.getRepository(Comment).findOneOrFail({
        select: ['id', 'userId', 'postId', 'parentId'],
        where: {
          id: props.entityId,
        },
        relations: {
          post: true,
        },
      }),
      ctx.con.manager.getRepository(UserComment).findOne({
        select: ['awardTransactionId'],
        where: {
          commentId: props.entityId,
          userId: ctx.userId,
        },
      }),
    ]);

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
          entityReference: {
            id: comment.id,
            type: UserTransactionType.Comment,
          },
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
            entityManager,
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
  ctx: Pick<AuthContext, 'userId' | 'con'>;
  entityManager: EntityManager;
  error: TransferError;
  transaction: UserTransaction;
}): Promise<never> => {
  // if user who is transfering cores is the same as sender
  // we pass in his new balance for clients to display and update state
  const userResult = error.transfer.results.find(
    (item) =>
      item.transferType === TransferType.TRANSFER &&
      item.senderId === ctx.userId,
  );
  const userBalance = userResult?.senderBalance?.newBalance;

  const userTransactionError = new UserTransactionError({
    status: error.transfer.status,
    balance:
      typeof userBalance === 'bigint'
        ? {
            amount: parseBigInt(userBalance),
          }
        : undefined,
    transaction,
  });

  await entityManager.queryRunner?.rollbackTransaction();

  // save outside of entity manager to escape rollback
  await ctx.con.getRepository(UserTransaction).save({
    ...transaction,
    status: error.transfer.status as number,
    flags: {
      ...transaction.flags,
      error: userTransactionError.message,
    },
  });

  // throw error for client after saving the transaction in error state
  throw userTransactionError;
};

export const awardReferral = async ({
  id,
  ctx,
}: {
  id: string;
  ctx: Pick<AuthContext, 'userId' | 'con'>;
}) => {
  await ctx.con.transaction(async (entityManager) => {
    const transaction = await entityManager.getRepository(UserTransaction).save(
      entityManager.getRepository(UserTransaction).create({
        id: randomUUID(),
        processor: UserTransactionProcessor.Njord,
        receiverId: ctx.userId,
        status: UserTransactionStatus.Success,
        productId: null,
        senderId: systemUser.id,
        value: usdToCores(10),
        valueIncFees: 0,
        fee: 0,
        flags: { note: 'Linkedin recruiter referral' },
        referenceId: id,
        referenceType: UserTransactionType.ReferralLinkedin,
      }),
    );

    try {
      await transferCores({
        ctx,
        transaction,
        entityManager,
      });
    } catch (error) {
      if (error instanceof TransferError) {
        await throwUserTransactionError({
          ctx,
          transaction,
          entityManager,
          error,
        });
      }
      throw error;
    }
  });
};

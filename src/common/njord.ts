import { createClient, type ConnectError } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import {
  Credits,
  Currency,
  EntityType,
  GetBalanceResponse,
  TransferType,
  type TransferResponse,
} from '@dailydotdev/schema';
import type { AuthContext } from '../Context';
import { UserTransaction } from '../entity/user/UserTransaction';
import { isProd, parseBigInt } from './utils';
import { ForbiddenError } from 'apollo-server-errors';
import { createAuthProtectedFn } from './user';
import {
  deleteRedisKey,
  getRedisObject,
  setRedisObjectWithExpiry,
} from '../redis';
import { generateStorageKey, StorageKey, StorageTopic } from '../config';
import { coresBalanceExpirationSeconds } from './constants';
import { NjordErrorMessages } from '../errors';
import { GarmrService } from '../integrations/garmr';
import { BrokenCircuitError } from 'cockatiel';
import type { EntityManager } from 'typeorm';

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
  ctx: Omit<AuthContext, 'con'>;
  transaction: UserTransaction;
};

export type TransactionProps = {
  ctx: Omit<AuthContext, 'con'>;
  productId: string;
  receiverId: string;
  note?: string;
};

export const createTransaction = async ({
  ctx,
  entityManager,
  productId,
  receiverId,
  note,
}: TransactionProps & {
  entityManager: EntityManager;
}): Promise<UserTransaction> => {
  if (!ctx.userId) {
    throw new ForbiddenError('Auth is required');
  }

  const { userId: senderId } = ctx;

  const userTransaction = entityManager.getRepository(UserTransaction).create({
    receiverId,
    status: 0, // TODO feat/transactions enum from schema later
    productId,
    senderId,
    value: 0,
    fee: 0,
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
};

export const transferCores = async ({
  ctx,
  transaction,
}: TransferProps): Promise<TransferResponse> => {
  if (!ctx.userId) {
    throw new ForbiddenError('Auth is required');
  }

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

    const result = await njordClient.transfer({
      transferType: TransferType.TRANSFER,
      currency: Currency.CORES,
      idempotencyKey: transaction.id,
      sender: {
        id: transaction.senderId,
        type: EntityType.USER,
      },
      receiver: {
        id: transaction.receiverId,
        type: EntityType.USER,
      },
      amount: transaction.value,
    });

    // TODO feat/transactions error handling
    // TODO feat/transactions update users balance

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

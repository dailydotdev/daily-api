import { createClient, type ConnectError } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import {
  Credits,
  Currency,
  EntityType,
  TransferType,
} from '@dailydotdev/schema';
import type { AuthContext } from '../Context';
import { UserTransaction } from '../entity/user/UserTransaction';
import { Product } from '../entity/Product';
import { remoteConfig } from '../remoteConfig';
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
  ctx: AuthContext;
  receiverId: string;
  productId: string;
  note?: string;
};

export const transferCores = async ({
  ctx,
  receiverId,
  productId,
}: TransferProps): Promise<UserTransaction> => {
  if (!ctx.userId) {
    throw new ForbiddenError('Auth is required');
  }

  // TODO feat/transactions check if user is team member, remove check when prod is ready
  if (!ctx.isTeamMember && isProd) {
    throw new ForbiddenError('Not allowed for you yet');
  }

  // TODO feat/transactions check if session is valid for real on whoami endpoint

  const { con, userId: senderId } = ctx;

  const transferResult = await ctx.con.transaction(async (manager) => {
    const product = await manager.getRepository(Product).findOneByOrFail({
      id: productId,
    });

    const userTransaction = con.getRepository(UserTransaction).create({
      receiverId,
      status: 0, // TODO feat/transactions enum from schema later
      productId: product.id,
      senderId,
      value: product.value,
      fee: remoteConfig.vars.fees?.transfer || 0,
      request: ctx.requestMeta,
      // TODO feat/transactions add note
    });

    const userTransactionResult = await manager
      .getRepository(UserTransaction)
      .insert(userTransaction);

    userTransaction.id = userTransactionResult.identifiers[0].id as string;

    const njordClient = getNjordClient();

    await garmNjordService.execute(() => {
      if (!userTransaction.id) {
        throw new Error('No transaction id');
      }

      if (!userTransaction.senderId) {
        throw new Error('No sender id');
      }

      return njordClient.transfer({
        transferType: TransferType.TRANSFER,
        currency: Currency.CORES,
        idempotencyKey: userTransaction.id,
        sender: {
          id: userTransaction.senderId,
          type: EntityType.USER,
        },
        receiver: {
          id: userTransaction.receiverId,
          type: EntityType.USER,
        },
        amount: userTransaction.value,
      });
    });

    // TODO feat/transactions error handling
    // TODO feat/transactions update users balance

    return userTransaction;
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
    try {
      const njordClient = getNjordClient();

      const balance = await garmNjordService.execute(() => {
        return njordClient.getBalance({
          account: {
            userId: ctx.userId,
            currency: Currency.CORES,
          },
        });
      });

      return {
        amount: parseBigInt(balance.amount),
      };
    } catch (originalError) {
      if (originalError instanceof BrokenCircuitError) {
        // if njord is down, return 0 balance for now
        return {
          amount: 0,
        };
      }

      const error = originalError as ConnectError;

      if (error.rawMessage === NjordErrorMessages.BalanceAccountNotFound) {
        return {
          amount: 0,
        };
      }

      throw originalError;
    }
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

    const freshBalance = await getFreshBalance({ ctx });

    await updateBalanceCache({ ctx, value: freshBalance });

    return freshBalance;
  },
);

import { DataSource } from 'typeorm';
import { MercuriusCommonOptions } from 'mercurius';
import { SubscriptionContext } from './Context';
import { verifyJwt } from './auth';
import { ioRedisPool } from './redis';

const getKey = (userId: string) => `connected:${userId}`;

const ONE_HOUR_SECONDS = 60 * 60;
const DEFAULT_VALUE = '1';

export const cacheConnectedUser = async (userId: string): Promise<void> => {
  await ioRedisPool.execute((client) =>
    client.set(getKey(userId), DEFAULT_VALUE, 'EX', ONE_HOUR_SECONDS),
  );
};

export const clearCacheForConnectedUser = async (
  userId: string,
): Promise<void> => {
  await ioRedisPool.execute((client) => client.del(getKey(userId)));
};

export const isUserConnected = async (userId: string): Promise<boolean> => {
  const val = await ioRedisPool.execute((client) => client.get(getKey(userId)));
  return val === DEFAULT_VALUE;
};

export const getDisconnectedUsers = async (
  userIds: string[],
): Promise<string[]> => {
  const val = await ioRedisPool.execute((client) =>
    client.mget(userIds.map(getKey)),
  );
  const connected: string[] = [];
  for (let i = 0; i < userIds.length; i++) {
    if (val[i] !== DEFAULT_VALUE) {
      connected.push(userIds[i]);
    }
  }
  return connected;
};

export const getSubscriptionSettings = (
  connection: DataSource,
): MercuriusCommonOptions['subscription'] | undefined => {
  if (process.env.ENABLE_SUBSCRIPTIONS) {
    return {
      context: (wsConnection, request): Omit<SubscriptionContext, 'userId'> => {
        return { req: request, con: connection, log: request.log };
      },
      onConnect: async ({
        payload,
      }): Promise<Pick<SubscriptionContext, 'userId'> | boolean> => {
        try {
          if (payload?.token) {
            const jwtPayload = await verifyJwt(payload?.token);
            const userId = jwtPayload.userId;
            // Don't block connection for caching
            cacheConnectedUser(userId);
            return { userId };
          }
        } catch (err) {
          // JWT is invalid
        }
        return true;
      },
      onDisconnect: async (mercuriusCtx) => {
        const ctx = mercuriusCtx as unknown as SubscriptionContext;
        if (ctx.userId) {
          await clearCacheForConnectedUser(ctx.userId);
        }
      },
    };
  }
  return undefined;
};

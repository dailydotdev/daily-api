import { createClient } from '@connectrpc/connect';
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
import { dispatchWhoami } from '../kratos';
import { isProd } from './utils';

const transport = createGrpcTransport({
  baseUrl: process.env.NJORD_ORIGIN,
  httpVersion: '2',
});

const njordClient = createClient<typeof Credits>(Credits, transport);

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
    throw new Error('Auth is required');
  }

  // TODO feat/transactions check if user is team member, remove check when prod is ready
  if (!ctx.isTeamMember && isProd) {
    throw new Error('Not allowed for you yet');
  }

  const whoami = await dispatchWhoami(ctx.req);

  if (!whoami.valid) {
    throw new Error('Auth is no longer valid');
  }

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
      fee: remoteConfig.vars.fees?.transfer,
      request: ctx.requestMeta,
    });

    const userTransactionResult = await manager
      .getRepository(UserTransaction)
      .insert(userTransaction);

    userTransaction.id = userTransactionResult.identifiers[0].id as string;

    if (!userTransaction.id) {
      throw new Error('No transaction id');
    }

    if (!userTransaction.senderId) {
      throw new Error('No sender id');
    }

    await njordClient.transfer({
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

    // TODO feat/transactions error handling
    // TODO feat/transactions update users balance

    return userTransaction;
  });

  return transferResult;
};

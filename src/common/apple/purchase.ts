import type {
  Environment,
  JWSTransactionDecodedPayload,
  ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library';
import type { User } from '../../entity/user/User';
import { getAppleTransactionType } from './utils';
import { AppleTransactionType } from './types';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../../entity/user/UserTransaction';
import createOrGetConnection from '../../db';

export const isCorePurchaseApple = ({
  transactionInfo,
}: {
  transactionInfo: JWSTransactionDecodedPayload;
}) => {
  return (
    getAppleTransactionType({ transactionInfo }) ===
      AppleTransactionType.Consumable &&
    !!transactionInfo.productId?.startsWith('cores_')
  );
};

export const handleCoresPurchase = async ({
  transactionInfo,
  user,
}: {
  transactionInfo: JWSTransactionDecodedPayload;
  user: User;
  environment: Environment;
  notification: ResponseBodyV2DecodedPayload;
}): Promise<UserTransaction> => {
  if (!transactionInfo.transactionId) {
    throw new Error('Missing transactionId in transactionInfo');
  }

  if (!transactionInfo.productId) {
    throw new Error('Missing productId in transactionInfo');
  }

  const con = await createOrGetConnection();

  // TODO feat/cores-iap load from api metadata/new endpoint
  const coresValue = Number(transactionInfo.productId.match(/\d+/)?.[0]);

  const payload = con.getRepository(UserTransaction).create({
    processor: UserTransactionProcessor.AppleStoreKit,
    receiverId: user.id,
    status: UserTransactionStatus.Success,
    productId: null, // no product user is buying cores directly
    senderId: null, // no sender, user is buying cores
    value: coresValue,
    valueIncFees: coresValue,
    fee: 0, // no fee when buying cores
    request: {},
    flags: {
      providerId: transactionInfo.transactionId,
    },
  });

  const userTransaction = await con
    .getRepository(UserTransaction)
    .save(payload);

  return userTransaction;
};

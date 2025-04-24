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
  decodedInfo,
}: {
  decodedInfo: JWSTransactionDecodedPayload;
}) => {
  return (
    getAppleTransactionType({ decodedInfo }) ===
      AppleTransactionType.Consumable &&
    !!decodedInfo.productId?.startsWith('cores_')
  );
};

export const handleCoresPurchase = async ({
  decodedInfo,
  user,
}: {
  decodedInfo: JWSTransactionDecodedPayload;
  user: User;
  environment: Environment;
  notification: ResponseBodyV2DecodedPayload;
}): Promise<UserTransaction> => {
  if (!decodedInfo.transactionId) {
    throw new Error('Missing transactionId in decodedInfo');
  }

  if (!decodedInfo.productId) {
    throw new Error('Missing productId in decodedInfo');
  }

  const con = await createOrGetConnection();

  // TODO feat/cores-iap load from api metadata/new endpoint
  const coresValue = Number(decodedInfo.productId.match(/\d+/)?.[0]);

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
      providerId: decodedInfo.transactionId,
    },
  });

  const userTransaction = await con
    .getRepository(UserTransaction)
    .save(payload);

  return userTransaction;
};

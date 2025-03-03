/* eslint-disable unused-imports/no-unused-imports */
import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import {
  Credits,
  Currency,
  EntityType,
  TransferType,
} from '@dailydotdev/schema';
import { randomUUID } from 'crypto';

const transport = createGrpcTransport({
  baseUrl: 'http://localhost:50051',
  httpVersion: '2',
});

const main = async () => {
  const creditsClient = createClient<typeof Credits>(Credits, transport);

  const id = 'LJSkpBexOSCWc8INyu3Eu';
  const transactionId = randomUUID();

  // const transaction = await creditsClient.getBalance({
  //   account: {
  //     userId: id,
  //     currency: Currency.CORES,
  //   },
  // });

  console.log(transactionId);

  const transaction = await creditsClient.transfer({
    transferType: TransferType.TRANSFER,
    currency: Currency.CORES,
    idempotencyKey: transactionId,
    sender: {
      id: 'ghost',
      type: EntityType.SYSTEM,
    },
    receiver: {
      id,
      type: EntityType.USER,
    },
    amount: 100,
  });

  console.log(transaction);
};

main();

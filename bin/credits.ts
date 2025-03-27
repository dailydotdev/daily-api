/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable unused-imports/no-unused-imports */
import { createGrpcTransport } from '@connectrpc/connect-node';
import '../src/config';
import {
  Credits,
  Currency,
  EntityType,
  TransferType,
} from '@dailydotdev/schema';
import { createClient } from '@connectrpc/connect';
import { parseBigInt } from '../src/common';

const main = async () => {
  const transport = createGrpcTransport({
    baseUrl: 'http://9.tcp.eu.ngrok.io:23305',
    httpVersion: '2',
  });

  const njordClient = createClient<typeof Credits>(Credits, transport);

  const senderId = 'system';
  const receiverId = '5GHEUpildSXvvbOdcfing';

  const transactionId = crypto.randomUUID();

  // const result = await njordClient.getBalance({
  //   account: {
  //     userId: receiverId,
  //     currency: Currency.CORES,
  //   },
  // });

  const transferResult = await njordClient.transfer({
    idempotencyKey: transactionId,
    transfers: [
      {
        transferType: TransferType.TRANSFER,
        currency: Currency.CORES,
        sender: {
          id: senderId,
          type: EntityType.SYSTEM,
        },
        receiver: {
          id: receiverId,
          type: EntityType.USER,
        },
        amount: 100,
        fee: {
          percentage: 5,
        },
      },
    ],
  });
  const result = transferResult.results.find(
    (item) => item.transferType === TransferType.TRANSFER,
  );

  console.log(
    JSON.stringify(
      result,
      (key, value) => {
        if (typeof value === 'bigint') {
          return parseBigInt(value);
        }

        return value;
      },
      2,
    ),
  );
};

main();

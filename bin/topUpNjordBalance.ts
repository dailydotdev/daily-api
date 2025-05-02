import '../src/config';
import {
  Currency,
  EntityType,
  TransferRequest,
  TransferStatus,
  TransferType,
} from '@dailydotdev/schema';

import { createNjordAuth, getNjordClient } from '../src/common/njord';
import { TransferError } from '../src/errors';
import { loadAuthKeys } from '../src/auth';
import { systemUser } from '../src/common';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { z } from 'zod';

const main = async () => {
  try {
    const { values } = parseArgs({
      options: {
        cores: {
          type: 'string',
          short: 'c',
        },
        origin: {
          type: 'string',
          short: 'o',
        },
        receiver: {
          type: 'string',
          short: 'r',
        },
      },
    });

    const paramsSchema = z.object({
      // amount of Cores to top up
      cores: z.coerce.number().int().positive(),

      // should be unique or specify why the Cores were sent, it is also used dedup
      // in case of repeated script runs in assignCores script
      origin: z.string().min(4),

      // which njord account to top up
      receiver: z.string().nonempty(),
    });

    const dataResult = paramsSchema.safeParse(values);

    if (dataResult.error) {
      throw new Error(
        `Error '${dataResult.error.errors[0].path}': ${dataResult.error.errors[0].message}`,
      );
    }

    const { cores, origin, receiver } = dataResult.data;

    const njordClient = getNjordClient();

    loadAuthKeys();

    console.log(`Topping up system account '${receiver}' with ${cores} Cores`);

    const payload = new TransferRequest({
      idempotencyKey: randomUUID(),
      transfers: [
        {
          transferType: TransferType.TRANSFER,
          currency: Currency.CORES,
          sender: {
            id: systemUser.id,
            type: EntityType.SYSTEM,
          },
          receiver: {
            id: receiver,
            type: EntityType.USER,
          },
          amount: cores,
          fee: {
            percentage: 0,
          },
          description: origin,
        },
      ],
    });

    const response = await njordClient.transfer(
      payload,
      await createNjordAuth(payload),
    );

    if (response.status !== TransferStatus.SUCCESS) {
      throw new TransferError(response);
    }

    console.log('Success', response.idempotencyKey);
  } catch (error) {
    console.error((error as Error).message);
  }

  process.exit(0);
};

main();

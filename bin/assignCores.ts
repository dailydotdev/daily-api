import '../src/config';
import {
  Currency,
  EntityType,
  TransferRequest,
  TransferStatus,
  TransferType,
} from '@dailydotdev/schema';
import { parseBigInt } from '../src/common';
import createOrGetConnection from '../src/db';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../src/entity/user/UserTransaction';
import {
  createNjordAuth,
  getBalance,
  getNjordClient,
  updateBalanceCache,
} from '../src/common/njord';
import { TransferError } from '../src/errors';
import { loadAuthKeys } from '../src/auth';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import fs from 'node:fs';
import { parse } from 'csv-parse';

const main = async () => {
  const con = await createOrGetConnection();

  try {
    const { values } = parseArgs({
      options: {
        usersPath: {
          type: 'string',
          short: 'p',
        },
        sender: {
          type: 'string',
          short: 's',
          default: 'system',
        },
        njordSender: {
          type: 'string',
          short: 'n',
        },
        origin: {
          type: 'string',
          short: 'o',
        },
        delimiter: {
          type: 'string',
          short: 'd',
          default: ',',
        },
      },
    });

    const paramsSchema = z.object({
      // path to the file with user ids, with one (user,cores) per line
      usersPath: z.string(),

      // which account to top up, it will appear on user wallet
      // defaults to system
      sender: z.string().nonempty().optional(),

      // which njord account to top up, it will appear on njord side
      njordSender: z.string().nonempty(),

      // should be unique or specify why the Cores were sent, it is also used for dedupe
      // in case of repeated script runs
      origin: z.string().min(4),

      // delimiter used in the file
      delimiter: z.string().nonempty().default(','),
    });

    const dataResult = paramsSchema.safeParse(values);

    if (dataResult.error) {
      throw new Error(
        `Error '${dataResult.error.errors[0].path}': ${dataResult.error.errors[0].message}`,
      );
    }

    const {
      usersPath,
      sender,
      njordSender,
      origin: requestOrigin,
      delimiter,
    } = dataResult.data;

    const njordClient = getNjordClient();

    loadAuthKeys();

    const stream = fs
      .createReadStream(usersPath)
      .pipe(parse({ delimiter, from_line: 2 }));

    stream.on('error', (err) => {
      console.error('Failed to read file: ', err.message);
    });

    const userSchema = z.object({
      userId: z.string().nonempty(),
      cores: z.coerce.number().int().positive(),
    });

    const users: z.infer<typeof userSchema>[] = [];

    stream.on('data', ([userId, cores]) => {
      const userResult = userSchema.safeParse({
        userId,
        cores,
      });

      if (userResult.error) {
        stream.destroy(new Error('Invalid user data in file'));

        return;
      }

      users.push(userResult.data);
    });

    await new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    for (const { userId, cores } of users) {
      try {
        console.log(`Processing user: '${userId}', adding ${cores} Cores`);

        const existingTransaction = await con
          .getRepository(UserTransaction)
          .createQueryBuilder()
          .where('"receiverId" = :receiverId AND status = :status', {
            receiverId: userId,
            status: UserTransactionStatus.Success,
          })
          .andWhere(`request->>'origin' = :requestOrigin`, {
            requestOrigin,
          })
          .getCount();

        if (existingTransaction > 0) {
          throw new Error(`Transaction already exists for user: '${userId}'`);
        }

        const response = await con.transaction(async (entityManager) => {
          const transaction = await entityManager
            .getRepository(UserTransaction)
            .save(
              entityManager.getRepository(UserTransaction).create({
                processor: UserTransactionProcessor.Njord,
                receiverId: userId,
                status: UserTransactionStatus.Success,
                productId: null,
                senderId: sender,
                value: cores,
                valueIncFees: cores,
                fee: 0,
                request: {
                  origin: requestOrigin,
                },
                flags: {},
              }),
            );

          const payload = new TransferRequest({
            idempotencyKey: transaction.id,
            transfers: [
              {
                transferType: TransferType.TRANSFER,
                currency: Currency.CORES,
                sender: {
                  id: njordSender,
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

          if (response.status !== TransferStatus.SUCCESS) {
            throw new TransferError(response);
          }

          return response;
        });

        console.log('Transfer success', response.idempotencyKey);

        const { results } = response;

        const result = results.find(
          (item) => item.transferType === TransferType.TRANSFER,
        );

        if (!result) {
          throw new Error('No transfer result');
        }

        const receiverBalance = parseBigInt(result.receiverBalance!.newBalance);

        await updateBalanceCache({
          ctx: {
            userId: result.receiverId,
          },
          value: {
            amount: receiverBalance,
          },
        });

        const userBalance = await getBalance({
          userId,
        });

        if (userBalance.amount < cores) {
          throw new Error(
            'User balance might not be applied or cache busted, use checkNjordBalance script to verify',
          );
        }
      } catch (error) {
        console.error('Error in user:', userId);
        console.error((error as Error).message);
      }

      console.log();
    }
  } catch (error) {
    console.error((error as Error).message);
  }

  con.destroy();

  process.exit(0);
};

main();

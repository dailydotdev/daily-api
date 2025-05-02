import '../src/config';

import { getFreshBalance } from '../src/common/njord';
import { loadAuthKeys } from '../src/auth';
import { parseArgs } from 'node:util';
import { z } from 'zod';

const main = async () => {
  try {
    const { values } = parseArgs({
      options: {
        user: {
          type: 'string',
          short: 'u',
        },
      },
    });

    const paramsSchema = z.object({
      // which njord account to check balance for
      user: z.string().nonempty(),
    });

    const dataResult = paramsSchema.safeParse(values);

    if (dataResult.error) {
      throw new Error(
        `Error '${dataResult.error.errors[0].path}': ${dataResult.error.errors[0].message}`,
      );
    }

    const { user: userId } = dataResult.data;

    loadAuthKeys();

    console.log(
      await getFreshBalance({
        userId,
      }),
    );
  } catch (error) {
    console.error((error as Error).message);
  }

  process.exit(0);
};

main();

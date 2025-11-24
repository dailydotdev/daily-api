import '../src/config';

import { parseArgs } from 'node:util';
import { z } from 'zod';
import createOrGetConnection from '../src/db';
import { type DataSource } from 'typeorm';
import { readFile } from 'node:fs/promises';
import { importUserExperienceFromJSON } from '../src/common/profile/import';

/**
 * Import profile from JSON to user by id
 *
 * npx ts-node bin/importProfileFromJSON.ts --path ~/Downloads/testuser.json -u testuser
 */
const main = async () => {
  let con: DataSource | null = null;

  try {
    const { values } = parseArgs({
      options: {
        path: {
          type: 'string',
          short: 'p',
        },
        userId: {
          type: 'string',
          short: 'u',
        },
      },
    });

    const paramsSchema = z.object({
      path: z.string().nonempty(),
      userId: z.string().nonempty(),
    });

    const params = paramsSchema.parse(values);

    con = await createOrGetConnection();

    const dataJSON = JSON.parse(await readFile(params.path, 'utf-8'));

    await importUserExperienceFromJSON({
      con: con.manager,
      dataJson: dataJSON,
      userId: params.userId,
    });
  } catch (error) {
    console.error(error instanceof z.ZodError ? z.prettifyError(error) : error);
  } finally {
    if (con) {
      con.destroy();
    }

    process.exit(0);
  }
};

main();

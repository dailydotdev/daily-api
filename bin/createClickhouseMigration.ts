import { parseArgs } from 'node:util';
import z from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { clickhouseMigrationsDir } from '../src/types';

const main = async () => {
  try {
    const { values } = parseArgs({
      options: {
        name: {
          type: 'string',
          short: 'n',
        },
      },
    });

    const paramsSchema = z.object({
      name: z
        .string()
        .lowercase()
        .regex(/^[a-z_]+$/),
    });

    const dataResult = paramsSchema.safeParse(values);

    if (dataResult.error) {
      throw new Error(
        `Error '${dataResult.error.issues[0].path}': ${dataResult.error.issues[0].message}`,
      );
    }

    const migrationName = `${Date.now()}_${dataResult.data.name}`;

    console.log(`Created migration ${migrationName} files 🎉`);

    await Promise.all([
      fs.writeFile(
        path.join(clickhouseMigrationsDir, `${migrationName}.up.sql`),
        '-- up\n\n',
        'utf-8',
      ),
      fs.writeFile(
        path.join(clickhouseMigrationsDir, `${migrationName}.down.sql`),
        '-- down\n\n',
        'utf-8',
      ),
    ]);
  } catch (originalError) {
    const error = originalError as Error;

    console.error(error.message);
  }
};

main();

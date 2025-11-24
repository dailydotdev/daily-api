import '../src/config';

import { parseArgs } from 'node:util';
import { z } from 'zod';
import createOrGetConnection from '../src/db';
import { QueryFailedError, type DataSource } from 'typeorm';
import { readFile, stat, readdir } from 'node:fs/promises';
import { importUserExperienceFromJSON } from '../src/common/profile/import';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Import profile from JSON to user by id
 *
 * npx ts-node bin/importProfileFromJSON.ts --path ~/Downloads/testuser.json -u testuser
 */
const main = async () => {
  let con: DataSource | null = null;
  let failedImports = 0;

  try {
    const { values } = parseArgs({
      options: {
        path: {
          type: 'string',
          short: 'p',
        },
        limit: {
          type: 'string',
          short: 'l',
        },
        offset: {
          type: 'string',
          short: 'o',
        },
        uid: {
          type: 'string',
        },
      },
    });

    const paramsSchema = z.object({
      path: z.string().nonempty(),
      limit: z.coerce.number().int().positive().default(10),
      offset: z.coerce.number().int().positive().default(0),
      uid: z.string().nonempty().default(randomUUID()),
    });

    const params = paramsSchema.parse(values);

    console.log('Starting import with ID:', params.uid);

    con = await createOrGetConnection();

    const pathStat = await stat(params.path);

    let filePaths = [params.path];

    if (pathStat.isDirectory()) {
      filePaths = await readdir(params.path, 'utf-8');
    }

    filePaths.sort(); // ensure consistent order for offset/limit

    console.log('Found files:', filePaths.length);

    console.log(
      `Importing:`,
      Math.min(params.limit, filePaths.length),
      `(limit ${params.limit})`,
    );

    for (const [index, fileName] of filePaths
      .slice(params.offset, params.offset + params.limit)
      .entries()) {
      const filePath =
        params.path === fileName ? fileName : path.join(params.path, fileName);

      try {
        if (!filePath.endsWith('.json')) {
          throw { type: 'not_json_ext', filePath };
        }

        const userId = filePath.split('/').pop()?.split('.json')[0];

        if (!userId) {
          throw { type: 'no_user_id', filePath };
        }

        const dataJSON = JSON.parse(await readFile(filePath, 'utf-8'));

        await importUserExperienceFromJSON({
          con: con.manager,
          dataJson: dataJSON,
          userId: 'testuser',
          importId: params.uid,
        });
      } catch (error) {
        failedImports += 1;

        if (error instanceof QueryFailedError) {
          console.error({
            type: 'db_query_failed',
            message: error.message,
            query: error.query,
            filePath,
          });
        } else if (error instanceof z.ZodError) {
          console.error({
            type: 'zod_error',
            message: error.issues[0].message,
            path: error.issues[0].path,
            filePath,
          });
        } else {
          console.error(error);
        }
      }

      if (index && index % 100 === 0) {
        console.log('Done so far:', index, ', failed:', failedImports);
      }
    }
  } catch (error) {
    console.error(error instanceof z.ZodError ? z.prettifyError(error) : error);
  } finally {
    if (con) {
      con.destroy();
    }

    if (failedImports > 0) {
      console.log(`Failed imports: ${failedImports}`);
    }

    process.exit(0);
  }
};

main();

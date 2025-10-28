import '../src/config';

import { parseArgs } from 'node:util';
import { z } from 'zod';
import createOrGetConnection from '../src/db';
import { type DataSource } from 'typeorm';
import { readFile } from 'node:fs/promises';
import { userExperienceInputBaseSchema } from '../src/common/schema/profile';
import { UserExperienceType } from '../src/entity/user/experiences/types';
import {
  importUserExperienceWork,
  importUserExperienceEducation,
  importUserExperienceCertification,
  importUserExperienceProject,
} from '../src/common/profile/import';

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

    const data = z
      .array(
        userExperienceInputBaseSchema
          .pick({
            type: true,
          })
          .loose(),
      )
      .parse(dataJSON);

    await con.transaction(async (entityManager) => {
      for (const item of data) {
        switch (item.type) {
          case UserExperienceType.Work:
            await importUserExperienceWork({
              data: item,
              con: entityManager,
              userId: params.userId,
            });

            break;
          case UserExperienceType.Education:
            await importUserExperienceEducation({
              data: item,
              con: entityManager,
              userId: params.userId,
            });

            break;
          case UserExperienceType.Certification:
            await importUserExperienceCertification({
              data: item,
              con: entityManager,
              userId: params.userId,
            });

            break;
          case UserExperienceType.Project:
            await importUserExperienceProject({
              data: item,
              con: entityManager,
              userId: params.userId,
            });

            break;
          default:
            throw new Error(`Unsupported experience type: ${item.type}`);
        }
      }
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

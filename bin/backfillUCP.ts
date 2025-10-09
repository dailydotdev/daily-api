import { parseArgs } from 'node:util';
import z from 'zod';

import { acceptedResumeFiles } from '../src/common/schema/files';
import type { UserCandidateCV } from '../src/common/schema/userCandidate';
import createOrGetConnection from '../src/db';
import { Storage, type GetFilesOptions, File } from '@google-cloud/storage';
import { logger } from '../src/logger';
import { UserCandidatePreference } from '../src/entity/user/UserCandidatePreference';
import { queryReadReplica } from '../src/common/queryReadReplica';
import { JsonContains } from 'typeorm';
import { User } from '../src/entity/user/User';

const storage = new Storage();

const getExtension = (contentType: string) => {
  switch (contentType) {
    case acceptedResumeFiles.pdf.mime[0]:
      return 'pdf';
    case acceptedResumeFiles.docx.mime[0]:
      return 'docx';
    default:
      return null;
  }
};

(async () => {
  console.log('Starting script...');

  const bucketName = 'daily-dev-resumes';
  const bucket = storage.bucket(bucketName);

  const { values } = parseArgs({
    options: { maxResults: { type: 'string', short: 'm' } },
  });

  const schema = z.object({
    maxResults: z.coerce.number().positive(),
  });

  const { error, data } = schema.safeParse(values);
  if (error) {
    logger.error({ err: error }, 'Invalid arguments');
    process.exit(1);
  }
  const con = await createOrGetConnection();
  const { maxResults } = data;

  const options: GetFilesOptions = {
    autoPaginate: false,
    maxResults: maxResults,
  };

  const files: File[] = [];

  let pageToken: string | undefined;

  do {
    const [pageFiles, nextQuery] = await bucket.getFiles({
      ...options,
      pageToken,
    });

    files.push(...pageFiles);

    logger.info(`Fetched ${files.length} files so far...`);

    const updates: UserCandidateCV[] = [];

    for (const file of pageFiles) {
      const contentType = file.metadata.contentType as string;
      const ext = getExtension(contentType);
      if (!ext) {
        logger.error(
          `Skipping file ${file.name} with unsupported content type ${contentType}`,
        );
        continue;
      }
      if (file.name === 'XDCZD-PHG') {
        logger.info('found myself!');
      }
      const cv: UserCandidateCV = {
        blob: file.name,
        bucket: bucketName,
        fileName: `${file.name}.${ext}`,
        contentType: contentType,
        lastModified: new Date(file.metadata.updated as string),
      };
      const [userExists, ucpExists] = await queryReadReplica(
        con,
        async ({ queryRunner }) => {
          return await Promise.all([
            queryRunner.manager.getRepository(User).exists({
              where: {
                id: file.name,
              },
            }),
            queryRunner.manager.getRepository(UserCandidatePreference).exists({
              where: {
                userId: file.name,
                cv: JsonContains({ blob: file.name }),
              },
            }),
          ]);
        },
      );

      if (!userExists) {
        logger.warn(
          `User with ID ${file.name} does not exist but their CV is present, skipping...`,
        );
        continue;
      }

      if (userExists && !ucpExists) {
        updates.push(cv);
      }
    }

    logger.info(`Updating ${updates.length} user candidate preferences...`);
    try {
      await con.getRepository(UserCandidatePreference).upsert(
        updates.map((cv) => ({
          userId: cv.blob!,
          cv: cv,
        })),
        ['userId'],
      );
    } catch (_err) {
      const err = _err as Error;
      logger.error({ err }, 'Error inserting user candidate preferences:');
      throw err;
    }

    pageToken = nextQuery?.pageToken;
    logger.info({ pageToken }, `Page token for next iteration...`);
  } while (pageToken);

  con.destroy();
  process.exit(0);
})();

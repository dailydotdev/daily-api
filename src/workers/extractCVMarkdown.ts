import { CandidatePreferenceUpdated } from '@dailydotdev/schema';
import type { TypedWorker } from './worker';
import { UserCandidatePreference } from '../entity/user/UserCandidatePreference';
import { extractMarkdownFromCV } from '../common/brokkr';

export const extractCVMarkdown: TypedWorker<'api.v1.candidate-preference-updated'> =
  {
    subscription: 'api.extract-cv-markdown',
    parseMessage: ({ data }) => CandidatePreferenceUpdated.fromBinary(data),
    handler: async ({ data }, con, logger) => {
      const { userId, cv, cvParsedMarkdown } = data.payload || {};
      const blobName = cv?.blob;
      const bucketName = cv?.bucket;
      if (!!cvParsedMarkdown) {
        logger.info('CV markdown already extracted, skipping');
        return;
      }

      if (!blobName || !bucketName) {
        logger.warn({ userId, blobName, bucketName }, 'No CV found, skipping');
        return;
      }

      try {
        const markdown = await extractMarkdownFromCV(blobName, bucketName);
        if (!markdown?.content) {
          logger.warn(
            { userId, blobName, bucketName },
            'No markdown content extracted from CV',
          );
          return;
        }

        await con
          .getRepository(UserCandidatePreference)
          .update({ userId }, { cvParsedMarkdown: markdown.content });

        logger.info({ userId }, 'Extracted markdown');
      } catch (_err) {
        const err = _err as Error;
        logger.error(
          { userId, blobName, bucketName, err },
          'Failed to extract markdown from CV',
        );
      }
    },
  };

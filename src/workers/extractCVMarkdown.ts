import { CandidatePreferenceUpdated } from '@dailydotdev/schema';
import type { TypedWorker } from './worker';
import { UserCandidatePreference } from '../entity/user/UserCandidatePreference';
import { extractMarkdownFromCV } from '../common/brokkr';
import { ConnectError } from '@connectrpc/connect';

export const extractCVMarkdown: TypedWorker<'api.v1.candidate-preference-updated'> =
  {
    subscription: 'api.extract-cv-markdown',
    parseMessage: ({ data }) => CandidatePreferenceUpdated.fromBinary(data),
    handler: async ({ data }, con, logger) => {
      const { userId, cv, cvParsedMarkdown } = data.payload || {};
      const blobName = cv?.blob;
      const bucketName = cv?.bucket;
      if (!!cvParsedMarkdown) {
        logger.debug('CV markdown already extracted, skipping');
        return;
      }

      if (!blobName || !bucketName) {
        logger.debug({ userId, blobName, bucketName }, 'No CV found, skipping');
        return;
      }

      try {
        const markdown = await extractMarkdownFromCV(blobName, bucketName);
        if (!markdown?.content) {
          logger.warn(
            { userId, blobName, bucketName },
            'No markdown content extracted from CV',
          );
          await con
            .getRepository(UserCandidatePreference)
            .update({ userId }, { cvParsedMarkdown: '@@NoMarkdownContent' });
          return;
        }

        await con
          .getRepository(UserCandidatePreference)
          .update({ userId }, { cvParsedMarkdown: markdown.content });
      } catch (err) {
        if (err instanceof ConnectError) {
          logger.error({ err }, 'ConnectError when extracting CV markdown');
          await con
            .getRepository(UserCandidatePreference)
            .update({ userId }, { cvParsedMarkdown: '@@ConnectError' });
          return;
        }

        throw err;
      }

      logger.debug({ userId }, 'Extracted markdown');
    },
  };

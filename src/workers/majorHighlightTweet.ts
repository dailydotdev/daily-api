import { PostHighlightedMessage } from '@dailydotdev/schema';
import { ONE_DAY_IN_SECONDS, ONE_MINUTE_IN_SECONDS } from '../common/constants';
import { PostHighlightSignificance } from '../entity/PostHighlight';
import { getTwitterClient } from '../integrations/twitter/clients';
import { withRedisDoneLock } from './withRedisDoneLock';
import type { TypedWorker } from './worker';

const MAJOR_HIGHLIGHT_TWEET_PREFIX = 'BREAKING: ';
const MAJOR_HIGHLIGHT_TWEET_DONE_TTL_SECONDS = 7 * ONE_DAY_IN_SECONDS;
const MAJOR_HIGHLIGHT_TWEET_LOCK_TTL_SECONDS = 10 * ONE_MINUTE_IN_SECONDS;

const worker: TypedWorker<'api.v1.post-highlighted'> = {
  subscription: 'api.major-highlight-tweet',
  parseMessage: (message) => PostHighlightedMessage.fromBinary(message.data),
  handler: async ({ data, messageId }, _con, logger): Promise<void> => {
    const { highlightId, significance } = data;

    if (
      significance !== PostHighlightSignificance.Breaking &&
      significance !== PostHighlightSignificance.Major
    ) {
      return;
    }

    try {
      await withRedisDoneLock({
        doneKey: `major-highlight:tweet:done:${highlightId}`,
        lockKey: `major-highlight:tweet:lock:${highlightId}`,
        lockValue: messageId || highlightId,
        lockTtlSeconds: MAJOR_HIGHLIGHT_TWEET_LOCK_TTL_SECONDS,
        doneTtlSeconds: MAJOR_HIGHLIGHT_TWEET_DONE_TTL_SECONDS,
        execute: async () => {
          const twitterClient = getTwitterClient();

          if (!twitterClient) {
            throw new Error('twitter client is not configured');
          }

          await twitterClient.postTweet({
            text: `${MAJOR_HIGHLIGHT_TWEET_PREFIX}${data.headline}`,
          });
        },
      });
    } catch (err) {
      logger.error(
        {
          highlightId,
          messageId,
          err,
        },
        'failed to publish major highlight tweet',
      );
      throw err;
    }
  },
};

export default worker;

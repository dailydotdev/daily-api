import { PostHighlightedMessage } from '@dailydotdev/schema';
import { ONE_DAY_IN_SECONDS, ONE_MINUTE_IN_SECONDS } from '../common/constants';
import { PostHighlightSignificance } from '../entity/PostHighlight';
import { getTwitterClient } from '../integrations/twitter/clients';
import { withRedisDoneLock } from './withRedisDoneLock';
import type { TypedWorker } from './worker';

const MAJOR_HIGHLIGHT_TWEET_PREFIX = 'BREAKING: ';
const MAX_TWEET_LENGTH = 280;
const MAJOR_HIGHLIGHT_TWEET_DONE_TTL_SECONDS = 7 * ONE_DAY_IN_SECONDS;
const MAJOR_HIGHLIGHT_TWEET_LOCK_TTL_SECONDS = 10 * ONE_MINUTE_IN_SECONDS;

const getTweetDoneKey = (highlightId: string): string =>
  `major-highlight:tweet:done:${highlightId}`;

const getTweetLockKey = (highlightId: string): string =>
  `major-highlight:tweet:lock:${highlightId}`;

const shouldPublishHighlightTweet = (
  significance: number,
): significance is
  | PostHighlightSignificance.Breaking
  | PostHighlightSignificance.Major =>
  significance === PostHighlightSignificance.Breaking ||
  significance === PostHighlightSignificance.Major;

const truncateHeadlineForTweet = (headline: string): string => {
  const maxHeadlineLength =
    MAX_TWEET_LENGTH - MAJOR_HIGHLIGHT_TWEET_PREFIX.length;

  if (headline.length <= maxHeadlineLength) {
    return headline;
  }

  return `${headline.substring(0, maxHeadlineLength - 3)}...`;
};

const buildTweetText = (headline: string): string =>
  `${MAJOR_HIGHLIGHT_TWEET_PREFIX}${truncateHeadlineForTweet(headline)}`;

const worker: TypedWorker<'api.v1.post-highlighted'> = {
  subscription: 'api.major-highlight-tweet',
  parseMessage: (message) => PostHighlightedMessage.fromBinary(message.data),
  handler: async ({ data, messageId }, _con, logger): Promise<void> => {
    const { highlightId, significance, headline } = data;

    if (!shouldPublishHighlightTweet(significance)) {
      return;
    }

    try {
      await withRedisDoneLock({
        doneKey: getTweetDoneKey(highlightId),
        lockKey: getTweetLockKey(highlightId),
        lockValue: messageId || highlightId,
        lockTtlSeconds: MAJOR_HIGHLIGHT_TWEET_LOCK_TTL_SECONDS,
        doneTtlSeconds: MAJOR_HIGHLIGHT_TWEET_DONE_TTL_SECONDS,
        execute: async () => {
          const twitterClient = getTwitterClient();

          if (!twitterClient) {
            throw new Error('twitter client is not configured');
          }

          await twitterClient.postTweet({
            text: buildTweetText(headline),
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

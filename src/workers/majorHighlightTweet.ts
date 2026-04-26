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
const MAX_HEADLINE_LENGTH =
  MAX_TWEET_LENGTH - MAJOR_HIGHLIGHT_TWEET_PREFIX.length;

const buildTweetText = (headline: string): string => {
  const trimmedHeadline = headline.trim();

  if (!trimmedHeadline) {
    return '';
  }

  if (trimmedHeadline.length <= MAX_HEADLINE_LENGTH) {
    return `${MAJOR_HIGHLIGHT_TWEET_PREFIX}${trimmedHeadline}`;
  }

  return `${MAJOR_HIGHLIGHT_TWEET_PREFIX}${trimmedHeadline.substring(0, MAX_HEADLINE_LENGTH - 3)}...`;
};

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

    const tweetText = buildTweetText(data.headline);

    if (!tweetText) {
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
            text: tweetText,
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

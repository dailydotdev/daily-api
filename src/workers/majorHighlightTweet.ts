import { PostHighlightedMessage } from '@dailydotdev/schema';
import { ONE_DAY_IN_SECONDS, ONE_MINUTE_IN_SECONDS } from '../common/constants';
import { PostHighlightSignificance } from '../entity/PostHighlight';
import { getTwitterClient } from '../integrations/twitter/clients';
import { withRedisDoneLock } from './withRedisDoneLock';
import type { TypedWorker } from './worker';

const MAJOR_HIGHLIGHT_TWEET_PREFIX = 'BREAKING: ';
const MAJOR_HIGHLIGHT_TWEET_DONE_TTL_SECONDS = 7 * ONE_DAY_IN_SECONDS;
const MAJOR_HIGHLIGHT_TWEET_LOCK_TTL_SECONDS = 10 * ONE_MINUTE_IN_SECONDS;

const withMajorHighlightTweetLock = ({
  scope,
  id,
  lockValue,
  execute,
}: {
  scope: 'highlight' | 'post';
  id: string;
  lockValue: string;
  execute: () => Promise<void>;
}) =>
  withRedisDoneLock({
    doneKey: `major-highlight:tweet:${scope}-done:${id}`,
    lockKey: `major-highlight:tweet:${scope}-lock:${id}`,
    lockValue,
    lockTtlSeconds: MAJOR_HIGHLIGHT_TWEET_LOCK_TTL_SECONDS,
    doneTtlSeconds: MAJOR_HIGHLIGHT_TWEET_DONE_TTL_SECONDS,
    execute,
  });

const worker: TypedWorker<'api.v1.post-highlighted'> = {
  subscription: 'api.major-highlight-tweet',
  parseMessage: (message) => PostHighlightedMessage.fromBinary(message.data),
  handler: async ({ data, messageId }, _con, logger): Promise<void> => {
    const { headline, highlightId, postId, significance } = data;

    if (
      significance !== PostHighlightSignificance.Breaking &&
      significance !== PostHighlightSignificance.Major
    ) {
      return;
    }

    try {
      const lockValue = messageId || highlightId;

      await withMajorHighlightTweetLock({
        scope: 'highlight',
        id: highlightId,
        lockValue,
        execute: async () => {
          await withMajorHighlightTweetLock({
            scope: 'post',
            id: postId,
            lockValue,
            execute: async () => {
              const twitterClient = getTwitterClient();

              if (!twitterClient) {
                throw new Error('twitter client is not configured');
              }

              await twitterClient.postTweet({
                text: `${MAJOR_HIGHLIGHT_TWEET_PREFIX}${headline}`,
              });
            },
          });
        },
      });
    } catch (err) {
      logger.error(
        {
          highlightId,
          postId,
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

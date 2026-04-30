import { ONE_DAY_IN_SECONDS, ONE_MINUTE_IN_SECONDS } from '../common/constants';
import { generateHighlights } from '../common/channelHighlight/generate';
import { triggerTypedEvent } from '../common/typedPubsub';
import { TypedWorker } from './worker';
import { withRedisDoneLock } from './withRedisDoneLock';

const HIGHLIGHTS_LOCK_TTL_SECONDS = 10 * ONE_MINUTE_IN_SECONDS;
const HIGHLIGHTS_DONE_TTL_SECONDS = 2 * ONE_DAY_IN_SECONDS;

const getHighlightsDoneKey = ({
  scheduledAt,
}: {
  scheduledAt: string;
}): string => `highlights:done:${scheduledAt}`;

const getHighlightsLockKey = ({
  scheduledAt,
}: {
  scheduledAt: string;
}): string => `highlights:lock:${scheduledAt}`;

const worker: TypedWorker<'api.v1.generate-highlights'> = {
  subscription: 'api.generate-highlights-v2',
  handler: async (message, con, logger): Promise<void> => {
    const { scheduledAt } = message.data;
    const logDetails = { scheduledAt, messageId: message.messageId };
    const now = new Date(scheduledAt);

    if (Number.isNaN(now.getTime())) {
      logger.error(logDetails, 'Highlight scheduledAt is invalid');
      return;
    }

    try {
      await withRedisDoneLock({
        doneKey: getHighlightsDoneKey({
          scheduledAt,
        }),
        lockKey: getHighlightsLockKey({
          scheduledAt,
        }),
        lockValue: message.messageId || scheduledAt,
        lockTtlSeconds: HIGHLIGHTS_LOCK_TTL_SECONDS,
        doneTtlSeconds: HIGHLIGHTS_DONE_TTL_SECONDS,
        execute: async () => {
          const { createdHighlights } = await generateHighlights({
            con,
            now,
          });

          await Promise.all(
            createdHighlights.map((highlight) =>
              triggerTypedEvent(logger, 'api.v1.highlight-created', highlight),
            ),
          );
        },
      });
    } catch (err) {
      logger.error({ ...logDetails, err }, 'Failed to generate highlights');
      throw err;
    }
  },
};

export default worker;

import { ONE_DAY_IN_SECONDS, ONE_MINUTE_IN_SECONDS } from '../common/constants';
import { getChannelHighlightDefinitionByChannel } from '../common/channelHighlight/definitions';
import { generateChannelHighlight } from '../common/channelHighlight/generate';
import { TypedWorker } from './worker';
import { withRedisDoneLock } from './withRedisDoneLock';

const CHANNEL_HIGHLIGHT_LOCK_TTL_SECONDS = 10 * ONE_MINUTE_IN_SECONDS;
const CHANNEL_HIGHLIGHT_DONE_TTL_SECONDS = 2 * ONE_DAY_IN_SECONDS;

const getChannelHighlightDoneKey = ({
  channel,
  scheduledAt,
}: {
  channel: string;
  scheduledAt: string;
}): string => `channel-highlight:done:${channel}:${scheduledAt}`;

const getChannelHighlightLockKey = ({
  channel,
  scheduledAt,
}: {
  channel: string;
  scheduledAt: string;
}): string => `channel-highlight:lock:${channel}:${scheduledAt}`;

const worker: TypedWorker<'api.v1.generate-channel-highlight'> = {
  subscription: 'api.generate-channel-highlight',
  handler: async (message, con, logger): Promise<void> => {
    const { channel, scheduledAt } = message.data;
    const logDetails = { channel, scheduledAt, messageId: message.messageId };
    const definition = await getChannelHighlightDefinitionByChannel({
      con,
      channel,
    });

    if (!definition) {
      logger.error(logDetails, 'Channel highlight definition not found');
      return;
    }

    const now = new Date(scheduledAt);
    if (Number.isNaN(now.getTime())) {
      logger.error(logDetails, 'Channel highlight scheduledAt is invalid');
      return;
    }

    try {
      await withRedisDoneLock({
        doneKey: getChannelHighlightDoneKey({
          channel,
          scheduledAt,
        }),
        lockKey: getChannelHighlightLockKey({
          channel,
          scheduledAt,
        }),
        lockValue: message.messageId || channel,
        lockTtlSeconds: CHANNEL_HIGHLIGHT_LOCK_TTL_SECONDS,
        doneTtlSeconds: CHANNEL_HIGHLIGHT_DONE_TTL_SECONDS,
        execute: () =>
          generateChannelHighlight({
            con,
            definition,
            now,
          }).then(() => undefined),
      });
    } catch (err) {
      logger.error(
        { ...logDetails, err },
        'Failed to generate channel highlight',
      );
      throw err;
    }
  },
};

export default worker;

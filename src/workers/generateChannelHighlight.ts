import { ONE_DAY_IN_SECONDS, ONE_MINUTE_IN_SECONDS } from '../common/constants';
import { getChannelHighlightDefinitionByChannel } from '../common/channelHighlight/definitions';
import { generateChannelHighlight } from '../common/channelHighlight/generate';
import {
  checkRedisObjectExists,
  deleteRedisKey,
  setRedisObjectIfNotExistsWithExpiry,
  setRedisObjectWithExpiry,
} from '../redis';
import { TypedWorker } from './worker';

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

    const doneKey = getChannelHighlightDoneKey({
      channel,
      scheduledAt,
    });
    if (await checkRedisObjectExists(doneKey)) {
      return;
    }

    const lockKey = getChannelHighlightLockKey({
      channel,
      scheduledAt,
    });
    const lockAcquired = await setRedisObjectIfNotExistsWithExpiry(
      lockKey,
      message.messageId || channel,
      CHANNEL_HIGHLIGHT_LOCK_TTL_SECONDS,
    );
    if (!lockAcquired) {
      return;
    }

    try {
      await generateChannelHighlight({
        con,
        definition,
        now,
      });
      await setRedisObjectWithExpiry(
        doneKey,
        '1',
        CHANNEL_HIGHLIGHT_DONE_TTL_SECONDS,
      );
    } catch (err) {
      logger.error(
        { ...logDetails, err },
        'Failed to generate channel highlight',
      );
      throw err;
    } finally {
      await deleteRedisKey(lockKey);
    }
  },
};

export default worker;

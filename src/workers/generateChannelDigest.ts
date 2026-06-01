import { getChannelDigestDefinitionByKey } from '../common/channelDigest/definitions';
import { generateChannelDigest } from '../common/channelDigest/generate';
import {
  ONE_DAY_IN_SECONDS,
  ONE_MINUTE_IN_SECONDS,
  ONE_WEEK_IN_SECONDS,
} from '../common/constants';
import { TypedWorker } from './worker';
import { withRedisDoneLock } from './withRedisDoneLock';

const CHANNEL_DIGEST_LOCK_TTL_SECONDS = 10 * ONE_MINUTE_IN_SECONDS;

const getChannelDigestDoneTtl = (frequency: 'daily' | 'weekly'): number => {
  switch (frequency) {
    case 'weekly':
      return 2 * ONE_WEEK_IN_SECONDS;
    case 'daily':
    default:
      return 2 * ONE_DAY_IN_SECONDS;
  }
};

const getChannelDigestDoneKey = ({
  digestKey,
  scheduledAt,
}: {
  digestKey: string;
  scheduledAt: string;
}): string => `channel-digest:done:${digestKey}:${scheduledAt}`;

const getChannelDigestLockKey = ({
  digestKey,
  scheduledAt,
}: {
  digestKey: string;
  scheduledAt: string;
}): string => `channel-digest:lock:${digestKey}:${scheduledAt}`;

const worker: TypedWorker<'api.v1.generate-channel-digest'> = {
  subscription: 'api.generate-channel-digest',
  handler: async (message, con, logger): Promise<void> => {
    const { digestKey, scheduledAt } = message.data;
    const logDetails = { digestKey, scheduledAt, messageId: message.messageId };
    const definition = await getChannelDigestDefinitionByKey({
      con,
      key: digestKey,
    });

    if (!definition) {
      logger.error(logDetails, 'Channel digest definition not found');
      return;
    }

    const now = new Date(scheduledAt);
    if (Number.isNaN(now.getTime())) {
      logger.error(logDetails, 'Channel digest scheduledAt is invalid');
      return;
    }

    try {
      await withRedisDoneLock({
        doneKey: getChannelDigestDoneKey({
          digestKey,
          scheduledAt,
        }),
        lockKey: getChannelDigestLockKey({
          digestKey,
          scheduledAt,
        }),
        lockValue: message.messageId || digestKey,
        lockTtlSeconds: CHANNEL_DIGEST_LOCK_TTL_SECONDS,
        doneTtlSeconds: getChannelDigestDoneTtl(definition.frequency),
        execute: () =>
          generateChannelDigest({
            con,
            definition,
            now,
          }).then(() => undefined),
      });
    } catch (err) {
      logger.error({ ...logDetails, err }, 'Failed to generate channel digest');
      throw err;
    }
  },
};

export default worker;

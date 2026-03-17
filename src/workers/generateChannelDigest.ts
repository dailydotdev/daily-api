import {
  channelDigestDefinitionsByKey,
  getChannelDigestCadence,
  type ChannelDigestDefinition,
} from '../common/channelDigest/definitions';
import { generateChannelDigest } from '../common/channelDigest/generate';
import {
  ONE_DAY_IN_SECONDS,
  ONE_MINUTE_IN_SECONDS,
  ONE_WEEK_IN_SECONDS,
} from '../common/constants';
import {
  checkRedisObjectExists,
  deleteRedisKey,
  setRedisObjectIfNotExistsWithExpiry,
  setRedisObjectWithExpiry,
} from '../redis';
import { TypedWorker } from './worker';

const CHANNEL_DIGEST_LOCK_TTL_SECONDS = 10 * ONE_MINUTE_IN_SECONDS;

const getChannelDigestDoneTtl = (
  definition: ChannelDigestDefinition,
): number => {
  switch (getChannelDigestCadence(definition)) {
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
    const definition = channelDigestDefinitionsByKey.get(digestKey);

    if (!definition) {
      logger.error(logDetails, 'Channel digest definition not found');
      return;
    }

    const now = new Date(scheduledAt);
    if (Number.isNaN(now.getTime())) {
      logger.error(logDetails, 'Channel digest scheduledAt is invalid');
      return;
    }

    const doneKey = getChannelDigestDoneKey({
      digestKey,
      scheduledAt,
    });
    if (await checkRedisObjectExists(doneKey)) {
      return;
    }

    const lockKey = getChannelDigestLockKey({
      digestKey,
      scheduledAt,
    });
    const lockAcquired = await setRedisObjectIfNotExistsWithExpiry(
      lockKey,
      message.messageId || digestKey,
      CHANNEL_DIGEST_LOCK_TTL_SECONDS,
    );
    if (!lockAcquired) {
      return;
    }

    try {
      await generateChannelDigest({
        con,
        definition,
        now,
      });
      await setRedisObjectWithExpiry(
        doneKey,
        '1',
        getChannelDigestDoneTtl(definition),
      );
    } catch (err) {
      logger.error({ ...logDetails, err }, 'Failed to generate channel digest');
      throw err;
    } finally {
      await deleteRedisKey(lockKey);
    }
  },
};

export default worker;

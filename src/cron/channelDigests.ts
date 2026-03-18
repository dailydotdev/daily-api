import {
  getChannelDigestDefinitions,
  isChannelDigestScheduledForDate,
} from '../common/channelDigest/definitions';
import { triggerTypedEvent } from '../common/typedPubsub';
import { Cron } from './cron';

export const getChannelDigestsNow = (): Date => new Date();

const cron: Cron = {
  name: 'channel-digests',
  handler: async (con, logger) => {
    const now = getChannelDigestsNow();
    const scheduledAt = now.toISOString();
    const definitions = await getChannelDigestDefinitions({
      con,
    });

    await Promise.all(
      definitions
        .filter((definition) =>
          isChannelDigestScheduledForDate({
            definition,
            now,
          }),
        )
        .map(({ key }) =>
          triggerTypedEvent(logger, 'api.v1.generate-channel-digest', {
            digestKey: key,
            scheduledAt,
          }),
        ),
    );
  },
};

export default cron;

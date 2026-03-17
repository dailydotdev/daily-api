import {
  channelDigestDefinitions,
  isChannelDigestScheduledForDate,
} from '../common/channelDigest/definitions';
import { triggerTypedEvent } from '../common/typedPubsub';
import { Cron } from './cron';

const cron: Cron = {
  name: 'channel-digests',
  handler: async (_, logger) => {
    const now = new Date();
    const scheduledAt = now.toISOString();

    await Promise.all(
      channelDigestDefinitions
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

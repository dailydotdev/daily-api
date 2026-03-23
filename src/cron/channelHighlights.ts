import { getChannelHighlightDefinitions } from '../common/channelHighlight/definitions';
import { triggerTypedEvent } from '../common/typedPubsub';
import { Cron } from './cron';

const cron: Cron = {
  name: 'channel-highlights',
  handler: async (con, logger) => {
    const scheduledAt = new Date().toISOString();
    const definitions = await getChannelHighlightDefinitions({
      con,
    });

    await Promise.all(
      definitions.map(({ channel }) =>
        triggerTypedEvent(logger, 'api.v1.generate-channel-highlight', {
          channel,
          scheduledAt,
        }),
      ),
    );
  },
};

export default cron;

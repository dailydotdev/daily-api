import { getChannelHighlightDefinitions } from '../common/channelHighlight/definitions';
import { triggerTypedEvent } from '../common/typedPubsub';
import { Cron } from './cron';

export const getChannelHighlightsNow = (): Date => new Date();

const cron: Cron = {
  name: 'channel-highlights',
  handler: async (con, logger) => {
    const now = getChannelHighlightsNow();
    const scheduledAt = now.toISOString();
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

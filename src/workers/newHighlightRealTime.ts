import { HighlightsCanonicalPublishedMessage } from '@dailydotdev/schema';
import { toHighlightSignificanceLabel } from '../common/channelHighlight/significance';
import { NEW_HIGHLIGHT_CHANNEL } from '../common/highlights';
import { HighlightsCanonical } from '../entity/HighlightsCanonical';
import { redisPubSub } from '../redis';
import { TypedWorker } from './worker';

const worker: TypedWorker<'api.v1.post-highlighted'> = {
  subscription: 'api.new-highlight-real-time',
  handler: async (message, con, logger): Promise<void> => {
    const { channels, highlightId, publishedChannels } = message.data;
    const targetChannels = publishedChannels.length
      ? publishedChannels
      : channels;

    if (!targetChannels.length) {
      return;
    }

    const highlight = await con.getRepository(HighlightsCanonical).findOne({
      where: { id: highlightId },
    });

    if (!highlight) {
      logger.error(
        { highlightId, messageId: message.messageId },
        'failed to find highlighted post for redis broadcast',
      );
      return;
    }

    const post = await highlight.post;
    const source = await post.source;

    await Promise.all(
      targetChannels.map((channel: string) =>
        redisPubSub.publish(NEW_HIGHLIGHT_CHANNEL, {
          ...highlight,
          channel,
          significance: toHighlightSignificanceLabel(highlight.significance),
          post: {
            ...post,
            source,
          },
        }),
      ),
    );
  },
  parseMessage: (message) =>
    HighlightsCanonicalPublishedMessage.fromBinary(message.data),
};

export default worker;

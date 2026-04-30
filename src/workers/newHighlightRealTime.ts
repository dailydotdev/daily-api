import { NEW_HIGHLIGHT_CHANNEL } from '../common/highlights';
import { PostHighlight } from '../entity/PostHighlight';
import { PostHighlightChannel } from '../entity/PostHighlightChannel';
import { redisPubSub } from '../redis';
import { TypedWorker } from './worker';
import { IsNull } from 'typeorm';

const worker: TypedWorker<'api.v1.highlight-created'> = {
  subscription: 'api.new-highlight-real-time-v2',
  handler: async (message, con, logger): Promise<void> => {
    const { highlightId } = message.data;
    const [highlight, placements] = await Promise.all([
      con.getRepository(PostHighlight).findOne({
        where: { id: highlightId },
      }),
      con.getRepository(PostHighlightChannel).find({
        where: {
          highlightId,
          retiredAt: IsNull(),
        },
      }),
    ]);

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
      placements.map((placement) =>
        redisPubSub.publish(NEW_HIGHLIGHT_CHANNEL, {
          ...highlight,
          channel: placement.channel,
          post: {
            ...post,
            source,
          },
        }),
      ),
    );
  },
};

export default worker;

import { PostHighlightedMessage } from '@dailydotdev/schema';
import { NEW_HIGHLIGHT_CHANNEL } from '../common/highlights';
import { PostHighlight } from '../entity/PostHighlight';
import { redisPubSub } from '../redis';
import { TypedWorker } from './worker';

const worker: TypedWorker<'api.v1.post-highlighted'> = {
  subscription: 'api.new-highlight-real-time',
  handler: async (message, con, logger): Promise<void> => {
    const { highlightId } = message.data;
    const highlight = await con.getRepository(PostHighlight).findOne({
      select: [
        'id',
        'postId',
        'channel',
        'highlightedAt',
        'headline',
        'createdAt',
        'updatedAt',
      ],
      where: { id: highlightId },
    });

    if (!highlight) {
      logger.error(
        { highlightId, messageId: message.messageId },
        'failed to find highlighted post for redis broadcast',
      );
      return;
    }

    await redisPubSub.publish(NEW_HIGHLIGHT_CHANNEL, highlight);
  },
  parseMessage: (message) => PostHighlightedMessage.fromBinary(message.data),
};

export default worker;

import { messageToJson, Worker } from './worker';
import { Post } from '../entity';
import { getDiscussionLink, webhook } from '../common';
import { ChangeObject } from '../types';

interface Data {
  post: ChangeObject<Post>;
}

const worker: Worker = {
  subscription: 'post-scout-matched-slack',
  handler: async (message, _, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const { post } = data;
    try {
      if (!post.scoutId) {
        return;
      }

      await webhook.send({
        text: 'Post submission was approved!',
        attachments: [
          {
            title: post.title,
            title_link: getDiscussionLink(post.id),
            fields: [
              {
                title: 'User',
                value: post.scoutId,
              },
            ],
            color: '#FF1E1F',
          },
        ],
      });
      logger.info(
        { data, messageId: message.messageId },
        'post scout matched slack message sent',
      );
    } catch (err) {
      logger.error(
        { data, messageId: message.messageId, err },
        'failed to send post scout matched slack message',
      );
    }
  },
};

export default worker;

import { messageToJson, Worker } from './worker';
import { Post } from '../entity';
import { getDiscussionLink, webhooks } from '../common';
import { ChangeObject } from '../types';

interface Data {
  post: ChangeObject<Post>;
}

const worker: Worker = {
  subscription: 'api.post-scout-matched-slack-v2',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const { post } = data;
    if (!post.scoutId) {
      return;
    }
    try {
      await webhooks.content.send({
        text: 'New community link!',
        attachments: [
          {
            title: post.title ?? `Post: ${post.id}`,
            title_link: getDiscussionLink(post.id),
            fields: [
              {
                title: 'User',
                value: post.scoutId,
              },
            ],
            color: '#CE3DF3',
          },
        ],
      });
    } catch (err) {
      logger.error(
        { data, messageId: message.messageId, err },
        'failed to send post scout matched slack message',
      );
    }
  },
};

export default worker;

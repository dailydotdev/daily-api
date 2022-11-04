import { messageToJson, Worker } from './worker';
import { Post } from '../entity';
import { getDiscussionLink, webhook } from '../common';

interface Data {
  postId: string;
  scoutId: string;
}

const worker: Worker = {
  subscription: 'post-scout-matched-slack',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const post = await con
        .getRepository(Post)
        .findOneByOrFail({ id: data.postId });

      if (!post.scoutId) {
        return;
      }

      await webhook.send({
        text: 'New community link!',
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
            color: '#CE3DF3',
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

import { envBasedName, messageToJson, Worker } from './worker';
import { Post } from '../entity';
import { getDiscussionLink, truncatePostToTweet, tweet } from '../common';

interface Data {
  userId: string;
  commentId: string;
  postId: string;
}

const worker: Worker = {
  topic: 'post-commented',
  subscription: envBasedName('post-commented-author-tweet'),
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const post = await con.getRepository(Post).findOne(data.postId);
      if (post.creatorTwitter && !post.authorId) {
        const title = truncatePostToTweet(post);
        const link = getDiscussionLink(post.id);
        const handle = post.creatorTwitter;
        const version = Math.floor(Math.random() * 3);
        let status = `${handle} `;
        if (version === 0) {
          status += `You have a new comment on “${title}” ✏️`;
        } else if (version === 1) {
          status += `A new comment on “${title}” is waiting for you 🤓`;
        } else {
          status += `There’s a new comment on your article “${title}” 🎉`;
        }
        status += `\n\nLet your readers know you’re there: ${link}`;
        await tweet(status, 'AUTHOR_TWITTER');
        logger.info(
          {
            data,
            messageId: message.id,
          },
          'tweeted about the new post comment',
        );
      }
      message.ack();
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.id,
          err,
        },
        'failed to tweet about the new post comment',
      );
      if (err.name === 'QueryFailedError') {
        message.ack();
      } else {
        message.nack();
      }
    }
  },
};

export default worker;

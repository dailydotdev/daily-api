import { messageToJson, Worker } from './worker';
import { Post } from '../entity';
import { getDiscussionLink, truncatePostToTweet, tweet } from '../common';

interface Data {
  threshold: number;
  postId: string;
}

const worker: Worker = {
  topic: 'post-reached-views-threshold',
  subscription: 'post-reached-views-threshold-tweet',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const post = await con.getRepository(Post).findOne(data.postId);
      if (post.creatorTwitter && !post.authorId && data.threshold <= 500) {
        const title = truncatePostToTweet(post);
        const link = `${getDiscussionLink(post.id)}?author=true`;
        const handle = post.creatorTwitter;
        const version = Math.floor(Math.random() * 3);
        let status = `${handle} `;
        if (data.threshold === 250) {
          if (version === 0) {
            status += `your article “${title}” was viewed 250 times. Your parents would be proud 😄`;
          } else if (version === 1) {
            status += `Welcome to the 250 views club for your article “${title}” 🚀`;
          } else {
            status += `“${title}” just reached 250 views ⚡️`;
          }
        } else {
          if (version === 0) {
            status += `“${title}” is trending fast with 500 views. Epic 🤯`;
          } else if (version === 1) {
            status += `your article “${title}” is gaining serious interest with 500 views. Well done 🥳`;
          } else {
            status += `You just got 500 views for “${title}” . You rock 🎸`;
          }
        }
        status += `\n\nClaim ownership on your post: ${link}`;
        await tweet(status, 'AUTHOR_TWITTER');
        logger.info(
          {
            data,
            messageId: message.id,
          },
          'tweeted about views threshold',
        );
      }
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.id,
          err,
        },
        'failed to tweet about views threshold',
      );
      // Query failed or status is duplicate
      if (err.name === 'QueryFailedError' || err.code === 187) {
        return;
      }
      throw err;
    }
  },
};

export default worker;

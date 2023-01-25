import { messageToJson, Worker } from './worker';
import { ArticlePost } from '../entity';
import { getDiscussionLink, truncatePostToTweet, tweet } from '../common';
import { TypeOrmError } from '../errors';

interface Data {
  userId: string;
  commentId: string;
  postId: string;
}

const worker: Worker = {
  subscription: 'post-commented-author-tweet',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const post = await con
        .getRepository(ArticlePost)
        .findOneBy({ id: data.postId });
      if (post?.creatorTwitter && !post.authorId) {
        const title = truncatePostToTweet(post);
        const link = `${getDiscussionLink(post.id)}?author=true`;
        const handle = post.creatorTwitter;
        const version = Math.floor(Math.random() * 3);
        const plural = post.comments > 1;
        const comments = `comment${plural ? 's' : ''}`;
        const are = plural ? 'are' : 'is';
        let status = `${handle} `;
        if (version === 0) {
          status += `You have ${post.comments} new ${comments} on “${title}” ✏️`;
        } else if (version === 1) {
          status += `${post.comments} new ${comments} on “${title}” ${are} waiting for you 🤓`;
        } else {
          status += `There ${are} ${post.comments} new ${comments} on your article “${title}” 🎉`;
        }
        status += `\n\nLet your readers know you’re there: ${link}`;
        await tweet(status, 'AUTHOR_TWITTER');
        logger.info(
          {
            data,
            messageId: message.messageId,
          },
          'tweeted about the new post comment',
        );
      }
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to tweet about the new post comment',
      );
      // Query failed or status is duplicate
      if (
        err.name === 'QueryFailedError' ||
        err.code === TypeOrmError.DUPLICATE_ENTRY
      ) {
        return;
      }
      throw err;
    }
  },
};

export default worker;

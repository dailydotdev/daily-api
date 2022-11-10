import { templateId } from './../common/mailing';
import { messageToJson, Worker } from './worker';
import { Comment } from '../entity';
import { baseNotificationEmailData, sendEmail } from '../common';
import { fetchUser, getDiscussionLink } from '../common';

interface Data {
  userId: string;
  commentId: string;
}

const upvoteTitles = {
  1: 'Congrats! You just earned one upvote 🎉',
  5: 'You rock! You just earned 5 upvotes  🎸',
  10: 'Well done! You just earned 10 upvotes 🙌',
  25: 'Brilliant! You just earned 25 upvotes 🥳',
  50: 'Good job! You just earned 50 upvotes 🚴‍♀️',
  100: 'Excellent! You just earned 100 upvotes ⚡️',
  250: 'Way to go! You just earned 250 upvotes 🚀',
  500: 'Clever! You just earned 500 upvotes 🦸‍',
  1000: 'Superb! You just earned 1000 upvotes 😱',
};

const worker: Worker = {
  subscription: 'comment-upvoted-mail',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const comment = await con
        .getRepository(Comment)
        .findOne({ where: { id: data.commentId }, relations: ['post'] });
      if (!comment) {
        logger.info(
          {
            data,
            messageId: message.messageId,
          },
          'comment does not exist',
        );
        return;
      }
      const author = await fetchUser(comment.userId, con);
      const post = await comment.post;
      const title = upvoteTitles[comment.upvotes];
      if (title && author.id !== data.userId) {
        const commentTruncated =
          comment.content.length <= 85
            ? comment.content
            : `${comment.content.substr(0, 82)}...`;
        await sendEmail({
          ...baseNotificationEmailData,
          to: author.email,
          templateId: templateId.commentUpvoted,
          dynamicTemplateData: {
            upvote_title: title,
            main_comment: commentTruncated,
            post_title: post.title,
            discussion_link: getDiscussionLink(post.id),
            profile_image: author.image,
            profile_link: author.permalink,
          },
        });
        logger.info(
          {
            data,
            messageId: message.messageId,
          },
          'upvote email sent',
        );
      }
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to send upvote email',
      );
      if (err.name === 'QueryFailedError') {
        return;
      }
      throw err;
    }
  },
};

export default worker;

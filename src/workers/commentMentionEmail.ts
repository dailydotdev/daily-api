import { getUserPermalink } from './../schema/users';
import { FastifyLoggerInstance } from 'fastify';
import { CommentMention } from './../entity/CommentMention';
import { Comment } from '../entity';
import { pickImageUrl } from '../common';
import { baseNotificationEmailData, sendEmail, truncatePost } from '../common';
import { Connection } from 'typeorm';

export const sendEmailToMentionedUser = async (
  con: Connection,
  commentMention: CommentMention,
  logger: FastifyLoggerInstance,
): Promise<void> => {
  const comment = await con
    .getRepository(Comment)
    .findOne(commentMention.commentId);
  const post = await comment.post;
  const user = await comment.user;
  const [firstname] = user.name.split(' ');
  await sendEmail({
    ...baseNotificationEmailData,
    to: user.email,
    templateId: 'd-6949e2e50def4c6698900032973d469b',
    dynamicTemplateData: {
      firstname,
      post_title: truncatePost(post),
      profile_image: user.image,
      post_image: post.image || pickImageUrl(post),
      profile_link: getUserPermalink(user),
      content: comment.contentHtml,
    },
  });
  logger.info('comment mention email sent to: ' + user.id);
};

import { FastifyLoggerInstance } from 'fastify';
import { CommentMention } from './../entity/CommentMention';
import { Comment, User } from '../entity';
import { pickImageUrl } from '../common';
import { baseNotificationEmailData, sendEmail, truncatePost } from '../common';
import { Connection } from 'typeorm';
import { getPostPermalink } from '../schema/posts';

export const sendEmailToMentionedUser = async (
  con: Connection,
  commentMention: CommentMention,
  logger: FastifyLoggerInstance,
): Promise<void> => {
  const comment = await con
    .getRepository(Comment)
    .findOne(commentMention.commentId);
  const post = await comment.post;
  const commenter = await comment.user;
  const mentioned = await con
    .getRepository(User)
    .findOne(commentMention.mentionedUserId);
  const [first_name] = mentioned.name.split(' ');
  await sendEmail({
    ...baseNotificationEmailData,
    to: mentioned.email,
    templateId: 'd-6949e2e50def4c6698900032973d469b',
    dynamicTemplateData: {
      first_name,
      full_name: commenter.name,
      comment: comment.content,
      user_handle: mentioned.username,
      profile_image: commenter.image,
      post_title: truncatePost(post),
      post_image: post.image || pickImageUrl(post),
      post_link: getPostPermalink(post),
    },
  });
  logger.info('comment mention email sent to: ' + commenter.id);
};

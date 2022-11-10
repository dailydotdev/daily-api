import { templateId } from './../common/mailing';
import { FastifyLoggerInstance } from 'fastify';
import { CommentMention } from './../entity/CommentMention';
import { Comment, User } from '../entity';
import { getDiscussionLink, pickImageUrl } from '../common';
import { baseNotificationEmailData, sendEmail, truncatePost } from '../common';
import { DataSource } from 'typeorm';

const removeFirstWordIfMention = (comment: string, username: string) => {
  const mention = `@${username}`;

  if (comment === mention) {
    return '';
  }

  const [firstWord, ...content] = comment.split(' ');

  return firstWord === mention ? content.join(' ') : comment;
};

export const sendEmailToMentionedUser = async (
  con: DataSource,
  { commentId, mentionedUserId }: CommentMention,
  logger: FastifyLoggerInstance,
): Promise<void> => {
  const comment = await con.getRepository(Comment).findOneBy({ id: commentId });
  const post = await comment.post;

  if (post.authorId === mentionedUserId) {
    return;
  }

  if (comment.parentId !== null) {
    const commentOnSameThread = await con
      .getRepository(Comment)
      .findOneBy({ parentId: comment.parentId, userId: mentionedUserId });

    if (commentOnSameThread) {
      return;
    }
  }

  const commenter = await comment.user;
  const mentioned = await con
    .getRepository(User)
    .findOneBy({ id: mentionedUserId });
  const [first_name] = mentioned.name.split(' ');
  const content = removeFirstWordIfMention(comment.content, mentioned.username);

  await sendEmail({
    ...baseNotificationEmailData,
    to: mentioned.email,
    templateId: templateId.commentMentionedUser,
    dynamicTemplateData: {
      first_name,
      full_name: commenter.name,
      comment: content,
      user_handle: mentioned.username,
      commenter_profile_image: commenter.image,
      post_title: truncatePost(post),
      post_image: post.image || pickImageUrl(post),
      post_link: getDiscussionLink(post.id),
    },
  });
  logger.info('comment mention email sent to: ' + commenter.id);
};

import { messageToJson } from '../worker';
import { Comment, CommentMention } from '../../entity';
import { NotificationCommenterContext } from '../../notifications';
import { NotificationWorker } from './worker';
import { ChangeObject } from '../../types';

interface Data {
  commentMention: ChangeObject<CommentMention>;
}

const worker: NotificationWorker = {
  subscription: 'api.comment-mention-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const comment = await con.getRepository(Comment).findOne({
      where: { id: data.commentMention.commentId },
      relations: ['post', 'user'],
    });
    if (!comment) {
      return;
    }
    const post = await comment.post;
    const commenter = await comment.user;
    const ctx: NotificationCommenterContext = {
      userId: data.commentMention.mentionedUserId,
      post,
      commenter,
      comment,
    };
    return [{ type: 'comment_mention', ctx }];
  },
};

export default worker;

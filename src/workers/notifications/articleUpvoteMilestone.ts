import { messageToJson } from '../worker';
import { Post, Upvote } from '../../entity';
import {
  NotificationPostContext,
  NotificationUpvotersContext,
} from '../../notifications';
import { NotificationWorker } from './worker';
import { uniquePostOwners, UPVOTE_MILESTONES } from './utils';

interface Data {
  userId: string;
  postId: string;
}

const worker: NotificationWorker = {
  subscription: 'api.article-upvote-milestone-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const post = await con
      .getRepository(Post)
      .findOne({ where: { id: data.postId } });
    const users = uniquePostOwners(post, data.userId);
    if (!users.length || !UPVOTE_MILESTONES.includes(post.upvotes.toString())) {
      return;
    }
    const upvotes = await con.getRepository(Upvote).find({
      where: { postId: post.id },
      take: 5,
      order: { createdAt: 'desc' },
      relations: ['user'],
    });
    const upvoters = await Promise.all(upvotes.map((upvote) => upvote.user));
    const ctx: Omit<
      NotificationPostContext & NotificationUpvotersContext,
      'userId'
    > = {
      post,
      upvoters,
      upvotes: post.upvotes,
    };
    return users.map((userId) => ({
      type: 'article_upvote_milestone',
      ctx: { ...ctx, userId },
    }));
  },
};

export default worker;

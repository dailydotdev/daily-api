import { messageToJson, Worker } from './worker';
import {
  Alerts,
  Bookmark,
  BookmarkList,
  Comment,
  Post,
  User,
  View,
} from '../entity';
import { CommentUpvote } from '../entity/CommentUpvote';
import { DevCard } from '../entity/DevCard';
import { Feed } from '../entity/Feed';
import { HiddenPost } from '../entity/HiddenPost';
import { PostReport } from '../entity/PostReport';
import { Settings } from '../entity/Settings';
import { SourceDisplay } from '../entity/SourceDisplay';
import { SourceRequest } from '../entity/SourceRequest';
import { Upvote } from '../entity/Upvote';
interface Data {
  id: string;
}

const worker: Worker = {
  subscription: 'user-deleted-api',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      await con.transaction(async (entityManager): Promise<void> => {
        await entityManager.getRepository(View).delete({ userId: data.id });
        await entityManager.getRepository(Alerts).delete({ userId: data.id });
        await entityManager
          .getRepository(BookmarkList)
          .delete({ userId: data.id });
        await entityManager.getRepository(Bookmark).delete({ userId: data.id });
        await entityManager
          .getRepository(CommentUpvote)
          .delete({ userId: data.id });
        await entityManager.getRepository(Comment).delete({ userId: data.id });
        await entityManager.getRepository(DevCard).delete({ userId: data.id });
        await entityManager.getRepository(Feed).delete({ userId: data.id });
        await entityManager
          .getRepository(HiddenPost)
          .delete({ userId: data.id });
        await entityManager
          .getRepository(PostReport)
          .delete({ userId: data.id });
        await entityManager.getRepository(Settings).delete({ userId: data.id });
        await entityManager
          .getRepository(SourceDisplay)
          .delete({ userId: data.id });
        await entityManager
          .getRepository(SourceRequest)
          .delete({ userId: data.id });
        await entityManager.getRepository(Upvote).delete({ userId: data.id });
        await entityManager
          .getRepository(Post)
          .update({ authorId: data.id }, { authorId: null });
        await entityManager.getRepository(User).delete(data.id);
      });
      logger.info(
        {
          userId: data.id,
          messageId: message.messageId,
        },
        'deleted user',
      );
    } catch (err) {
      logger.error(
        {
          userId: data.id,
          messageId: message.messageId,
          err,
        },
        'failed to delete user',
      );
      throw err;
    }
  },
};

export default worker;

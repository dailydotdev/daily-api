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

interface UserData {
  id: string;
  name: string;
  email: string;
  image: string;
  company?: string;
  title?: string;
  infoConfirmed: boolean;
  username?: string;
  bio?: string;
  twitter?: string;
  github?: string;
  createdAt: Date;
  acceptedMarketing: boolean;
  portfolio?: string;
  hashnode?: string;
  timezone?: string;
}

interface Data {
  user: UserData;
}

const worker: Worker = {
  subscription: 'user-deleted-api',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      await con.getRepository(View).delete({ userId: data.user.id });
      await con.getRepository(Alerts).delete({ userId: data.user.id });
      await con.getRepository(BookmarkList).delete({ userId: data.user.id });
      await con.getRepository(Bookmark).delete({ userId: data.user.id });
      await con.getRepository(CommentUpvote).delete({ userId: data.user.id });
      await con.getRepository(Comment).delete({ userId: data.user.id });
      await con.getRepository(DevCard).delete({ userId: data.user.id });
      await con.getRepository(Feed).delete({ userId: data.user.id });
      await con.getRepository(HiddenPost).delete({ userId: data.user.id });
      await con.getRepository(PostReport).delete({ userId: data.user.id });
      await con.getRepository(Settings).delete({ userId: data.user.id });
      await con.getRepository(SourceDisplay).delete({ userId: data.user.id });
      await con.getRepository(SourceRequest).delete({ userId: data.user.id });
      await con.getRepository(Upvote).delete({ userId: data.user.id });
      await con
        .getRepository(Post)
        .update({ authorId: data.user.id }, { authorId: null });
      await con.getRepository(User).delete(data.user.id);
      logger.info(
        {
          userId: data.user.id,
          messageId: message.messageId,
        },
        'deleted user',
      );
    } catch (err) {
      logger.error(
        {
          userId: data.user.id,
          messageId: message.messageId,
          err,
        },
        'failed to delete user',
      );
      if (err.name === 'QueryFailedError') {
        return;
      }
      throw err;
    }
  },
};

export default worker;

import { Bookmark } from '../../entity';
import { InjectedProps } from '../common';
import { triggerTypedEvent } from '../../common';

interface CommonBookmarkReminderParams {
  userId: string;
  postId: string;
}

interface ValidateBookmarkReminderParams extends CommonBookmarkReminderParams {
  remindAt: string;
}

export const createActivities = ({ con, logger }: InjectedProps) => ({
  async validateReminder({
    userId,
    postId,
    remindAt,
  }: ValidateBookmarkReminderParams): Promise<boolean> {
    const bookmark = await con
      .getRepository(Bookmark)
      .findOneBy({ userId, postId });

    return bookmark && remindAt === bookmark.remindAt.toISOString();
  },
  async sendBookmarkReminder({
    userId,
    postId,
  }: CommonBookmarkReminderParams): Promise<void> {
    await triggerTypedEvent(logger, 'api.v1.post-bookmark-reminder', {
      userId,
      postId,
    });
  },
});

export type BookmarkActivities = ReturnType<typeof createActivities>;

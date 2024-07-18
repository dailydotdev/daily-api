import { InjectedProps } from '../common';
import { triggerTypedEvent } from '../../common';
import { Bookmark } from '../../entity';
import { logger } from '../../logger';

interface CommonBookmarkReminderParams {
  userId: string;
  postId: string;
}

export const createActivities = ({ con }: InjectedProps) => ({
  async validateBookmark({
    userId,
    postId,
  }: CommonBookmarkReminderParams): Promise<boolean> {
    const bookmark = await con
      .getRepository(Bookmark)
      .findOneBy({ userId, postId });

    return !!bookmark;
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

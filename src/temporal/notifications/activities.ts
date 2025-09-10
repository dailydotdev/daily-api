import { InjectedProps } from '../common';
import { triggerTypedEvent } from '../../common';
import { Bookmark } from '../../entity/Bookmark';
import { logger } from '../../logger';
import type { entityReminderSchema } from '../../common/schema/reminders';
import type z from 'zod';

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
  async sendEntityReminder(
    params: z.infer<typeof entityReminderSchema>,
  ): Promise<void> {
    await triggerTypedEvent(logger, 'api.v1.entity-reminder', params);
  },
});

export type BookmarkActivities = ReturnType<typeof createActivities>;

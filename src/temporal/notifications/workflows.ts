import { proxyActivities } from '@temporalio/workflow';
import { BookmarkActivities, type createActivities } from './activities';
import type { entityReminderSchema } from '../../common/schema/reminders';
import type z from 'zod';

export interface BookmarkReminderParams {
  userId: string;
  postId: string;
}

export async function bookmarkReminderWorkflow({
  userId,
  postId,
}: BookmarkReminderParams): Promise<void> {
  const { validateBookmark, sendBookmarkReminder } =
    proxyActivities<BookmarkActivities>({ scheduleToCloseTimeout: '15s' }); // the amount of time the process is willing to wait for the activity to complete

  const isValid = await validateBookmark({ userId, postId });

  if (!isValid) {
    return;
  }

  await sendBookmarkReminder({ userId, postId });
}

export const entityReminderWorkflow = async (
  params: z.infer<typeof entityReminderSchema>,
): Promise<void> => {
  const { sendEntityReminder } = proxyActivities<
    ReturnType<typeof createActivities>
  >({
    scheduleToCloseTimeout: '15s',
  }); // the amount of time the process is willing to wait for the activity to complete

  await sendEntityReminder(params);
};

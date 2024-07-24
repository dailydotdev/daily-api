import { proxyActivities } from '@temporalio/workflow';
import { BookmarkActivities } from './activities';

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

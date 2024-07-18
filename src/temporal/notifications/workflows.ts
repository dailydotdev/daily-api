import { proxyActivities, sleep } from '@temporalio/workflow';
import { BookmarkActivities } from './activities';

export interface BookmarkReminderParams {
  userId: string;
  postId: string;
  remindAt: number;
}

export async function bookmarkReminderWorkflow({
  userId,
  postId,
  remindAt,
}: BookmarkReminderParams): Promise<void> {
  const { validateBookmark, sendBookmarkReminder } =
    proxyActivities<BookmarkActivities>({ scheduleToCloseTimeout: '15s' }); // the amount of time the process is willing to wait for the activity to complete

  const isValid = await validateBookmark({ userId, postId });

  if (!isValid) {
    return;
  }

  const diff = remindAt - Date.now();

  await sleep(diff);
  await sendBookmarkReminder({ userId, postId });
}

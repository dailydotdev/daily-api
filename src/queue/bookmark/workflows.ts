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
  const diff = remindAt - Date.now();
  // consider specifying heartbeat timeout for long-running workflows
  const { validateBookmark, sendBookmarkReminder } =
    proxyActivities<BookmarkActivities>({
      startToCloseTimeout: diff + 5000,
    });

  const isValid = await validateBookmark({ userId, postId });

  if (!isValid) {
    return;
  }

  await sleep(diff);
  await sendBookmarkReminder({ userId, postId });
}

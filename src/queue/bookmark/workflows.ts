import { proxyActivities, sleep } from '@temporalio/workflow';
import { BookmarkActivities } from './activities';

interface BookmarkReminderParams {
  userId: string;
  postId: string;
  remindAt: string;
}

export async function bookmarkReminderWorkflow({
  userId,
  postId,
  remindAt,
}: BookmarkReminderParams): Promise<void> {
  const diff = new Date(remindAt).getTime() - Date.now();
  // consider specifying heartbeat timeout for long-running workflows
  const { validateReminder, sendBookmarkReminder } =
    proxyActivities<BookmarkActivities>({ startToCloseTimeout: diff + 5000 });
  const isValid = await validateReminder({ userId, postId, remindAt });

  if (!isValid) {
    return;
  }

  await sleep(diff);
  await sendBookmarkReminder({ userId, postId });
}

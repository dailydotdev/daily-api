import * as OneSignal from '@onesignal/node-onesignal';
import { NotificationV2, NotificationAvatarV2 } from './entity';
import { addNotificationUtm, basicHtmlStrip } from './common';

const appId = process.env.ONESIGNAL_APP_ID;
const apiKey = process.env.ONESIGNAL_API_KEY;

const configuration = OneSignal.createConfiguration({
  appKey: apiKey,
});

const client = new OneSignal.DefaultApi(configuration);

export async function sendPushNotification(
  userIds: string[],
  {
    id,
    title,
    type,
    targetUrl,
  }: Pick<NotificationV2, 'id' | 'title' | 'type' | 'targetUrl'>,
  avatar?: Pick<NotificationAvatarV2, 'image'>,
): Promise<void> {
  if (!appId || !apiKey) return;

  const push = new OneSignal.Notification();
  push.app_id = appId;
  push.include_external_user_ids = userIds;
  push.contents = { en: basicHtmlStrip(title) };
  push.headings = { en: 'New update' };
  push.url = addNotificationUtm(targetUrl, 'push', type);
  push.data = { notificationId: id };
  push.chrome_web_badge =
    'https://daily-now-res.cloudinary.com/image/upload/v1672745846/public/dailydev.png';
  if (avatar) {
    push.chrome_web_icon = avatar.image;
  }
  await client.createNotification(push);
}

export async function sendReadingReminderPush(
  userIds: string[],
  at: Date,
): Promise<void> {
  if (!appId || !apiKey) return;

  const push = new OneSignal.Notification();
  push.app_id = appId;
  push.include_external_user_ids = userIds;
  push.send_after = at.toISOString();
  push.contents = { en: 'Build a habit and become more knowledgeable' };
  push.headings = { en: "Hi, It's reading time" };
  push.url = addNotificationUtm(
    process.env.COMMENTS_PREFIX,
    'push',
    'reminder',
  );
  push.chrome_web_badge =
    'https://daily-now-res.cloudinary.com/image/upload/v1672745846/public/dailydev.png';
  await client.createNotification(push);
}

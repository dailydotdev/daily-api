import * as OneSignal from '@onesignal/node-onesignal';
import { Notification, NotificationAvatar } from './entity';
import { addNotificationUtm, basicHtmlStrip } from './common';
import { ChangeObject } from './types';

const appId = process.env.ONESIGNAL_APP_ID;
const apiKey = process.env.ONESIGNAL_API_KEY;

const configuration = OneSignal.createConfiguration({
  appKey: apiKey,
});

const client = new OneSignal.DefaultApi(configuration);

export async function sendPushNotification(
  {
    id,
    userId,
    title,
    type,
    targetUrl,
  }: Notification | ChangeObject<Notification>,
  avatar?: NotificationAvatar,
): Promise<void> {
  const push = new OneSignal.Notification();
  push.app_id = appId;
  push.include_external_user_ids = [userId];
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

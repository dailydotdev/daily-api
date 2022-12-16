import * as OneSignal from '@onesignal/node-onesignal';
import { Notification } from './entity';
import { addNotificationUtm, basicHtmlStrip } from './common';
import { ChangeObject } from './types';

const appId = process.env.ONESIGNAL_APP_ID;
const apiKey = process.env.ONESIGNAL_API_KEY;

const configuration = OneSignal.createConfiguration({
  appKey: apiKey,
});

const client = new OneSignal.DefaultApi(configuration);

export async function sendPushNotification({
  id,
  userId,
  title,
  type,
  targetUrl,
}: Notification | ChangeObject<Notification>): Promise<void> {
  const push = new OneSignal.Notification();
  push.app_id = appId;
  push.include_external_user_ids = [userId];
  push.contents = { en: basicHtmlStrip(title) };
  push.url = addNotificationUtm(targetUrl, 'push', type);
  push.data = { notificationId: id };
  await client.createNotification(push);
}

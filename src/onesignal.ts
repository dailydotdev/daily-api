import * as OneSignal from '@onesignal/node-onesignal';
import { NotificationV2, NotificationAvatarV2 } from './entity';
import { addNotificationUtm, basicHtmlStrip, mapCloudinaryUrl } from './common';
import { escapeRegExp } from 'lodash';

const appId = process.env.ONESIGNAL_APP_ID;
const apiKey = process.env.ONESIGNAL_API_KEY;
const safeCommentsPrefix = escapeRegExp(process.env.COMMENTS_PREFIX || '');

const configuration = OneSignal.createConfiguration({
  appKey: apiKey,
});

const client = new OneSignal.DefaultApi(configuration);
const chromeWebBadge =
  'https://media.daily.dev/image/upload/v1672745846/public/dailydev.png';
const chromeWebIcon =
  'https://media.daily.dev/image/upload/s--9vc188bS--/f_auto/v1712221649/1_smcxpz';

function createPush(
  userIds: string[],
  url: string | undefined,
  notificationType: string,
): OneSignal.Notification {
  const push = new OneSignal.Notification();
  push.app_id = appId;
  push.include_external_user_ids = userIds;
  push.chrome_web_badge = chromeWebBadge;
  push.chrome_web_icon = chromeWebIcon;
  push.ios_badge_type = 'Increase';
  push.ios_badge_count = 1;

  if (url) {
    push.web_url = addNotificationUtm(url, 'push', notificationType);
    push.app_url = push.web_url.replace(
      new RegExp(`${safeCommentsPrefix}/?`),
      'dailydev://',
    );
  }

  return push;
}

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

  const push = createPush(userIds, targetUrl, type);
  push.contents = { en: basicHtmlStrip(title) };
  push.headings = { en: 'New update' };
  push.data = { notificationId: id };
  if (avatar) {
    push.chrome_web_icon = mapCloudinaryUrl(avatar.image);
  }
  await client.createNotification(push);
}

const readingReminderHeadings = [
  "It's this time of the day",
  'Catch up on your feed',
  'Sustain your learning streak',
  "Don't let your feed feel lonely",
  'Breaking: Your feed misses you',
  'Your brain requested knowledge',
  'You already know the drill',
  "It's us again",
];

const readingReminderContents = [
  "Let's find something interesting to read",
  "Dive into today's top picks on your daily.dev feed",
  'Your next favorite post is just a tap away',
  "There's always something new to learn. Let's find it together",
  "Feed your brain with today's latest tech buzzwords",
  'Transform your break into a knowledge feast. Start reading',
];

const streakReminderHeading = '⚡ Streak Saver Alert!';
const streakReminderContent =
  'Read a post today and protect your streak. Keep it going strong! 💪';

export async function sendReadingReminderPush(
  userIds: string[],
  at: Date,
): Promise<void> {
  if (!appId || !apiKey) return;

  const seed = Math.floor(new Date().getTime() / 1000);

  const push = createPush(
    userIds,
    `${process.env.COMMENTS_PREFIX}`,
    'reminder',
  );
  push.send_after = at.toISOString();
  push.contents = {
    en: readingReminderContents[seed % readingReminderContents.length],
  };
  push.headings = {
    en: readingReminderHeadings[seed % readingReminderHeadings.length],
  };
  await client.createNotification(push);
}

export async function sendStreakReminderPush(
  userIds: string[],
): Promise<null | OneSignal.CreateNotificationSuccessResponse> {
  if (!appId || !apiKey) return null;
  const push = createPush(
    userIds,
    process.env.COMMENTS_PREFIX,
    'streak_reminder',
  );
  push.contents = {
    en: streakReminderContent,
  };
  push.headings = {
    en: streakReminderHeading,
  };
  return await client.createNotification(push);
}

export type GenericPushPayload = {
  title: string;
  body: string;
  url?: string;
  utm_campaign?: string;
};

export const sendGenericPush = async (
  userIds: string[],
  notification: GenericPushPayload,
) => {
  if (!appId || !apiKey) return null;
  const push = createPush(
    userIds,
    notification.url,
    notification.utm_campaign ?? 'generic',
  );
  push.contents = {
    en: notification.body,
  };
  push.headings = {
    en: notification.title,
  };
  return client.createNotification(push);
};

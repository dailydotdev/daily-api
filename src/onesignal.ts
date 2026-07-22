import * as OneSignal from '@onesignal/node-onesignal';
import type { NotificationAvatarV2 } from './entity/notifications/NotificationAvatarV2';
import type { NotificationV2 } from './entity/notifications/NotificationV2';
import { mapCloudinaryUrl } from './common/cloudinary';
import { addNotificationUtm, basicHtmlStrip } from './common/notificationUtils';
import { escapeRegExp } from 'lodash';
import { NotificationType } from './notifications/common';

const safeCommentsPrefix = escapeRegExp(process.env.COMMENTS_PREFIX || '');

const chromeWebBadge =
  'https://media.daily.dev/image/upload/v1672745846/public/dailydev.png';
const chromeWebIcon =
  'https://media.daily.dev/image/upload/s--9vc188bS--/f_auto/v1712221649/1_smcxpz';
const webPushSubscriptionTypes: ReadonlySet<OneSignal.SubscriptionObjectTypeEnum> =
  new Set(['ChromePush', 'FirefoxPush', 'SafariLegacyPush', 'SafariPush']);

type OneSignalApp = {
  appId: string;
  apiKey: string;
};

const clientByApiKey = new Map<string, OneSignal.DefaultApi>();

const getOneSignalClient = (apiKey: string): OneSignal.DefaultApi => {
  const existing = clientByApiKey.get(apiKey);
  if (existing) return existing;

  const client = new OneSignal.DefaultApi(
    OneSignal.createConfiguration({ appKey: apiKey }),
  );
  clientByApiKey.set(apiKey, client);
  return client;
};

const oneSignalApp = (
  appId: string | undefined,
  apiKey: string | undefined,
): OneSignalApp | null => {
  if (!appId || !apiKey) {
    return null;
  }

  return { appId, apiKey };
};

const getOneSignalDeliveryApps = (): OneSignalApp[] => {
  const primary = oneSignalApp(
    process.env.ONESIGNAL_APP_ID,
    process.env.ONESIGNAL_API_KEY,
  );
  if (!primary) {
    return [];
  }

  const web = oneSignalApp(
    process.env.ONESIGNAL_WEB_APP_ID,
    process.env.ONESIGNAL_WEB_API_KEY,
  );
  if (!web || web.appId === primary.appId) {
    return [primary];
  }

  return [primary, web];
};

const isNotFoundError = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') {
    return false;
  }

  return (
    ('code' in err && err.code === 404) ||
    ('status' in err && err.status === 404)
  );
};

const fetchOneSignalUser = async (
  app: OneSignalApp,
  userId: string,
): Promise<OneSignal.User | null> => {
  try {
    return await getOneSignalClient(app.apiKey).fetchUser(
      app.appId,
      'external_id',
      userId,
    );
  } catch (err) {
    if (isNotFoundError(err)) {
      return null;
    }

    throw err;
  }
};

const deleteOneSignalSubscription = async (
  app: OneSignalApp,
  subscriptionId: string,
): Promise<void> => {
  try {
    await getOneSignalClient(app.apiKey).deleteSubscription(
      app.appId,
      subscriptionId,
    );
  } catch (err) {
    if (isNotFoundError(err)) {
      return;
    }

    throw err;
  }
};

const sendToOneSignalApps = async (
  createNotification: (appId: string) => OneSignal.Notification,
): Promise<OneSignal.CreateNotificationSuccessResponse[]> => {
  const apps = getOneSignalDeliveryApps();
  if (!apps.length) {
    return [];
  }

  return Promise.all(
    apps.map((app) =>
      getOneSignalClient(app.apiKey).createNotification(
        createNotification(app.appId),
      ),
    ),
  );
};

export const cleanupStaleOneSignalWebSubscriptions = async (
  userId: string,
): Promise<number> => {
  const legacyApp = oneSignalApp(
    process.env.ONESIGNAL_APP_ID,
    process.env.ONESIGNAL_API_KEY,
  );
  const webApp = oneSignalApp(
    process.env.ONESIGNAL_WEB_APP_ID,
    process.env.ONESIGNAL_WEB_API_KEY,
  );
  if (!legacyApp || !webApp || webApp.appId === legacyApp.appId) {
    return 0;
  }

  const oneSignalUser = await fetchOneSignalUser(legacyApp, userId);

  if (!oneSignalUser?.subscriptions?.length) {
    return 0;
  }

  const staleWebSubscriptions = oneSignalUser.subscriptions.filter(
    ({ id, type }) => !!id && !!type && webPushSubscriptionTypes.has(type),
  );

  await Promise.all(
    staleWebSubscriptions.map(({ id }) =>
      deleteOneSignalSubscription(legacyApp, id!),
    ),
  );

  return staleWebSubscriptions.length;
};

const pushHeadingMap: Partial<Record<NotificationType, string>> = {
  [NotificationType.ArticleNewComment]: 'New comment',
  [NotificationType.SquadNewComment]: 'New comment',
  [NotificationType.CommentReply]: 'New reply',
  [NotificationType.SquadReply]: 'New reply',
  [NotificationType.CommentMention]: 'You were mentioned',
  [NotificationType.PostMention]: 'You were mentioned',
  [NotificationType.ArticleUpvoteMilestone]: 'New milestone',
  [NotificationType.CommentUpvoteMilestone]: 'New milestone',
  [NotificationType.SquadPostAdded]: 'New squad post',
  [NotificationType.SquadMemberJoined]: 'New member',
  [NotificationType.UserFollow]: 'New follower',
  [NotificationType.NewOpportunityMatch]: 'Job match',
  [NotificationType.ReMatchedOpportunity]: 'Job match',
  [NotificationType.BriefingReady]: 'Briefing ready',
  [NotificationType.DigestReady]: 'Digest ready',
  [NotificationType.StreakResetRestore]: 'Streak broken',
  [NotificationType.UserGiftedPlus]: 'Plus gift',
  [NotificationType.AchievementUnlocked]: 'Level up!',
  [NotificationType.PollResult]: 'Poll results',
  [NotificationType.PollResultAuthor]: 'Poll results',
  [NotificationType.FeedbackResolved]: 'Feedback update',
  [NotificationType.FeedbackCancelled]: 'Feedback update',
  [NotificationType.ArticlePicked]: 'Post live',
  [NotificationType.CommunityPicksSucceeded]: 'Post live',
  [NotificationType.SourceApproved]: 'Source approved',
  [NotificationType.SourcePostAdded]: 'New post',
  [NotificationType.UserPostAdded]: 'New post',
  [NotificationType.PromotedToAdmin]: 'Role change',
  [NotificationType.PromotedToModerator]: 'Role change',
  [NotificationType.DemotedToMember]: 'Role change',
  [NotificationType.SquadBlocked]: 'Squad update',
  [NotificationType.SquadFeatured]: 'Squad featured',
  [NotificationType.SquadPublicApproved]: 'Squad public',
  [NotificationType.CollectionUpdated]: 'Collection updated',
  [NotificationType.DevCardUnlocked]: 'DevCard ready',
  [NotificationType.PostBookmarkReminder]: 'Reading reminder',
  [NotificationType.UserTopReaderBadge]: 'Top Reader badge',
  [NotificationType.UserReceivedAward]: 'Award received',
  [NotificationType.UserAwardThanks]: 'You got thanks',
  [NotificationType.OrganizationMemberJoined]: 'New team member',
  [NotificationType.CampaignPostCompleted]: 'Boost ended',
  [NotificationType.CampaignSquadCompleted]: 'Boost ended',
  [NotificationType.CampaignPostFirstMilestone]: 'Boost update',
  [NotificationType.CampaignSquadFirstMilestone]: 'Boost update',
  [NotificationType.PostAnalytics]: 'Post analytics',
  [NotificationType.WarmIntro]: 'Warm intro',
  [NotificationType.ParsedCVProfile]: 'CV update',
  [NotificationType.RecruiterNewCandidate]: 'New candidate',
  [NotificationType.RecruiterOpportunityLive]: 'Opportunity live',
  [NotificationType.RecruiterExternalPayment]: 'Payment received',
  [NotificationType.ExperienceCompanyEnriched]: 'Profile updated',
  [NotificationType.SourcePostApproved]: 'Post approved',
  [NotificationType.SourcePostRejected]: 'Post review',
  [NotificationType.SourcePostSubmitted]: 'Post pending review',
  [NotificationType.SquadSubscribeToNotification]: 'Squad notifications',
  [NotificationType.LiveRoomStarted]: 'Room is live',
  [NotificationType.LiveRoomStartingSoon]: 'Standup starts soon',
};

const pushHeadingFnMap: Partial<
  Record<NotificationType, (title: string) => string>
> = {
  [NotificationType.SquadPostAdded]: (title) => {
    const twoMatch = title.match(/<b>([^<]+)<\/b>[^<]*<b>([^<]+)<\/b>/);
    if (twoMatch) {
      return `New post in ${twoMatch[2]}`;
    }
    const oneMatch = title.match(/<b>([^<]+)<\/b>/);
    return oneMatch ? `New post in ${oneMatch[1]}` : 'New squad post';
  },
  [NotificationType.SquadNewComment]: (title) => {
    const match = title.match(/<b>([^<]+)<\/b>/);
    return match ? `${match[1]} commented` : 'New comment';
  },
  [NotificationType.ArticleNewComment]: (title) => {
    const match = title.match(/<b>([^<]+)<\/b>/);
    return match ? `${match[1]} commented` : 'New comment';
  },
  [NotificationType.LiveRoomStarted]: (title) => {
    const match = title.match(/<b>([^<]+)<\/b>/);
    return match ? `${match[1]} is live` : 'Room is live';
  },
  [NotificationType.LiveRoomStartingSoon]: (title) => {
    const match = title.match(/<b>([^<]+)<\/b>/);
    return match ? `${match[1]} starts soon` : 'Standup starts soon';
  },
};

const getPushHeading = (type: string, title?: string): string => {
  const fn = pushHeadingFnMap[type as NotificationType];
  if (fn && title) return fn(title);
  return pushHeadingMap[type as NotificationType] ?? 'daily.dev';
};

type PushOpts = { increaseBadge?: boolean };

function createPush(
  appId: string,
  userIds: string[],
  url: string | undefined,
  notificationType: string,
  opts?: PushOpts,
): OneSignal.Notification {
  const push = new OneSignal.Notification();
  push.app_id = appId;
  push.include_external_user_ids = userIds;
  push.channel_for_external_user_ids = 'push';
  push.chrome_web_badge = chromeWebBadge;
  push.chrome_web_icon = chromeWebIcon;
  if (opts?.increaseBadge) {
    push.ios_badge_type = 'Increase';
    push.ios_badge_count = 1;
  }

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
  sendAfter?: Date,
): Promise<void> {
  await sendToOneSignalApps((appId) => {
    const push = createPush(appId, userIds, targetUrl, type, {
      increaseBadge: true,
    });
    push.contents = { en: basicHtmlStrip(title) };
    push.headings = { en: getPushHeading(type, title) };
    push.data = { notificationId: id };
    if (avatar) {
      push.chrome_web_icon = mapCloudinaryUrl(avatar.image);
    }
    if (sendAfter) {
      push.send_after = sendAfter.toISOString();
    }
    return push;
  });
}

const readingReminderHeadings = [
  'Your daily reading time',
  "What's new in tech today",
  'Fresh posts in your feed',
  'Time for a quick read',
  'New posts since your last visit',
  'Your feed has new posts',
  'Quick reading break?',
  "Today's top developer posts",
];

const readingReminderContents = [
  'See what the community is reading and discussing',
  'Top posts from sources you follow are waiting',
  'A few minutes of reading can spark your next idea',
  'Curated posts based on your interests are ready',
  'Catch up on what you missed',
  'New articles, discussions, and insights from your feed',
];

const streakReminderHeading = '⚡ Streak reminder';
const streakReminderContent = 'Read a post today to keep your streak going';

export async function sendReadingReminderPush(
  userIds: string[],
  at: Date,
): Promise<void> {
  const seed = Math.floor(new Date().getTime() / 1000);

  await sendToOneSignalApps((appId) => {
    const push = createPush(
      appId,
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
    return push;
  });
}

export async function sendStreakReminderPush(
  userIds: string[],
): Promise<null | OneSignal.CreateNotificationSuccessResponse> {
  const responses = await sendToOneSignalApps((appId) => {
    const push = createPush(
      appId,
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
    return push;
  });
  return responses[0] ?? null;
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
  const responses = await sendToOneSignalApps((appId) => {
    const push = createPush(
      appId,
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
    return push;
  });
  return responses[0] ?? null;
};

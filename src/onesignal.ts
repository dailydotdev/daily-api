import * as OneSignal from '@onesignal/node-onesignal';
import { NotificationV2, NotificationAvatarV2 } from './entity';
import { addNotificationUtm, basicHtmlStrip, mapCloudinaryUrl } from './common';
import { escapeRegExp } from 'lodash';
import { NotificationType } from './notifications/common';

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
};

const pushHeadingFnMap: Partial<
  Record<NotificationType, (title: string) => string>
> = {
  [NotificationType.SquadPostAdded]: (title) => {
    const match = title.match(/<b>([^<]+)<\/b>[^<]*<b>([^<]+)<\/b>/);
    return match ? `New post in ${match[2]}` : 'New squad post';
  },
  [NotificationType.SquadNewComment]: (title) => {
    const match = title.match(/<b>([^<]+)<\/b>/);
    return match ? `${match[1]} commented` : 'New comment';
  },
  [NotificationType.ArticleNewComment]: (title) => {
    const match = title.match(/<b>([^<]+)<\/b>/);
    return match ? `${match[1]} commented` : 'New comment';
  },
};

const getPushHeading = (type: string, title?: string): string => {
  const fn = pushHeadingFnMap[type as NotificationType];
  if (fn && title) return fn(title);
  return pushHeadingMap[type as NotificationType] ?? 'daily.dev';
};

type PushOpts = { increaseBadge?: boolean };

function createPush(
  userIds: string[],
  url: string | undefined,
  notificationType: string,
  opts?: PushOpts,
): OneSignal.Notification {
  const push = new OneSignal.Notification();
  push.app_id = appId;
  push.include_external_user_ids = userIds;
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
  if (!appId || !apiKey) return;

  const push = createPush(userIds, targetUrl, type, { increaseBadge: true });
  push.contents = { en: basicHtmlStrip(title) };
  push.headings = { en: getPushHeading(type, title) };
  push.data = { notificationId: id };
  if (avatar) {
    push.chrome_web_icon = mapCloudinaryUrl(avatar.image);
  }
  if (sendAfter) {
    push.send_after = sendAfter.toISOString();
  }
  await client.createNotification(push);
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

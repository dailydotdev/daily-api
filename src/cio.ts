import { CustomerIORequestError, TrackClient } from 'customerio-node';
import { ChangeObject } from './types';
import {
  ConnectionManager,
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestType,
  UserStreak,
} from './entity';
import { camelCaseToSnakeCase, getDateBaseFromType } from './common/utils';
import { getFirstName } from './common/mailing';

export enum CioUnsubscribeTopic {
  Announcements = '1',
  NewUserWelcome = '5',
  Marketing = '4',
  Notifications = '7',
  Digest = '8',
  Follow = '9',
  Award = '10',
  ArticleUpvoteMilestone = '11',
  CommentUpvoteMilestone = '12',
  UserReceivedAward = '13',
  SquadPostAdded = '14',
  ArticleReportApproved = '15',
  UsernameMention = '16',
  CollectionUpdated = '17',
  CommentReply = '18',
  Achievements = '19',
  CreatorUpdate = '20',
  PaidSubscription = '21',
  CommentsOnPost = '22',
  SourcePostAdded = '23',
  Streaks = '24',
  InAppPurchases = '25',
  UserPostAdded = '26',
  JobOpportunities = '27',
  PollResult = '28',
}
import { getShortGenericInviteLink } from './common/links';
import {
  NotificationType,
  NotificationPreferenceStatus,
} from './notifications/common';
import type { UserCompany } from './entity/UserCompany';
import type { Company } from './entity/Company';
import { DataSource, In } from 'typeorm';
import { logger } from './logger';
import { OpportunityMatch } from './entity/OpportunityMatch';
import { OpportunityMatchStatus } from './entity/opportunities/types';

export const cio = new TrackClient(
  process.env.CIO_SITE_ID,
  process.env.CIO_API_KEY,
);

/**
 * Specific client for using v2 of the Customer.io API.
 */
export const cioV2 = new TrackClient(
  process.env.CIO_SITE_ID,
  process.env.CIO_API_KEY,
  { url: 'https://track.customer.io/api/v2' },
);

// Magic number from customer.io
const CIO_COMPANY_OBJECT_ID = '4';

export function dateToCioTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

const OMIT_FIELDS: (keyof ChangeObject<User>)[] = [
  'id',
  'bio',
  'devcardEligible',
  'readme',
  'readmeHtml',
  'infoConfirmed',
  'notificationFlags',
];

export const CIO_REQUIRED_FIELDS: (keyof ChangeObject<User>)[] = [
  'username',
  'name',
  'createdAt',
  'updatedAt',
  'notificationFlags',
];

const CIO_TOPIC_TO_NOTIFICATION_MAP: Record<string, NotificationType> = {
  [CioUnsubscribeTopic.CommentsOnPost]: NotificationType.ArticleNewComment,
  [CioUnsubscribeTopic.UsernameMention]: NotificationType.PostMention,
  [CioUnsubscribeTopic.Streaks]: NotificationType.StreakResetRestore,
  [CioUnsubscribeTopic.Achievements]: NotificationType.UserTopReaderBadge,
  [CioUnsubscribeTopic.ArticleUpvoteMilestone]:
    NotificationType.ArticleUpvoteMilestone,
  [CioUnsubscribeTopic.CommentUpvoteMilestone]:
    NotificationType.CommentUpvoteMilestone,
  [CioUnsubscribeTopic.UserReceivedAward]: NotificationType.UserReceivedAward,
  [CioUnsubscribeTopic.SquadPostAdded]: NotificationType.SquadPostAdded,
  [CioUnsubscribeTopic.ArticleReportApproved]:
    NotificationType.ArticleReportApproved,
  [CioUnsubscribeTopic.CollectionUpdated]: NotificationType.CollectionUpdated,
  [CioUnsubscribeTopic.CommentReply]: NotificationType.CommentReply,
  [CioUnsubscribeTopic.CreatorUpdate]: NotificationType.ArticlePicked,
  [CioUnsubscribeTopic.SourcePostAdded]: NotificationType.SourcePostAdded,
  [CioUnsubscribeTopic.UserPostAdded]: NotificationType.UserPostAdded,
  [CioUnsubscribeTopic.Marketing]: NotificationType.Marketing,
  [CioUnsubscribeTopic.NewUserWelcome]: NotificationType.NewUserWelcome,
  [CioUnsubscribeTopic.Announcements]: NotificationType.Announcements,
  [CioUnsubscribeTopic.InAppPurchases]: NotificationType.InAppPurchases,
  [CioUnsubscribeTopic.JobOpportunities]: NotificationType.NewOpportunityMatch,
  [CioUnsubscribeTopic.PollResult]: NotificationType.PollResult,
};

export async function identifyUserStreak({
  cio,
  data,
}: {
  cio: TrackClient;
  data: ChangeObject<UserStreak> & {
    lastSevenDays: { [key: string]: boolean };
  };
}): Promise<void> {
  const {
    userId,
    currentStreak,
    totalStreak,
    maxStreak,
    lastSevenDays,
    lastViewAt,
  } = data;

  try {
    await cio.identify(userId, {
      current_streak: currentStreak,
      total_streak: totalStreak,
      max_streak: maxStreak,
      last_view_at: lastViewAt
        ? dateToCioTimestamp(new Date(lastViewAt))
        : undefined,
      last_seven_days_streak: lastSevenDays,
    });
  } catch (err) {
    if (err instanceof CustomerIORequestError && err.statusCode === 400) {
      logger.warn({ err }, 'failed to update user streak in cio');
      return;
    }
    throw err;
  }
}

export const identifyUserOpportunities = async ({
  cio,
  con,
  userId,
}: {
  cio: TrackClient;
  con: ConnectionManager;
  userId: string;
}): Promise<void> => {
  const opportunities = await con.getRepository(OpportunityMatch).find({
    where: {
      userId,
      status: OpportunityMatchStatus.Pending,
    },
    select: ['opportunityId'],
    order: { createdAt: 'ASC' },
  });
  const ids = opportunities.map((opportunity) => opportunity.opportunityId);
  await cio.identify(userId, {
    opportunities: ids?.length > 0 ? ids : null,
  });
};

export const generateIdentifyObject = async (
  con: ConnectionManager,
  user: ChangeObject<User>,
) => {
  const { id } = user;
  const identify = await getIdentifyAttributes(con, user);

  return {
    action: 'identify',
    type: 'person',
    identifiers: { id },
    attributes: identify,
  };
};

export const getNotificationFlagsCioTopics = (
  notificationFlags: User['notificationFlags'],
) => {
  const isSubscribed = (notificationType: NotificationType | string) =>
    notificationFlags?.[notificationType]?.email !==
    NotificationPreferenceStatus.Muted;

  const result: Record<string, boolean> = {};

  Object.entries(CIO_TOPIC_TO_NOTIFICATION_MAP).forEach(
    ([topicId, notificationType]) => {
      result[`cio_subscription_preferences.topics.topic_${topicId}`] =
        isSubscribed(notificationType);
    },
  );

  return result;
};

export const getCioTopicsToNotificationFlags = (
  subscriptionPreferences: {
    topics?: Record<string, boolean>;
  },
  existingNotificationFlags: User['notificationFlags'] = {},
): User['notificationFlags'] => {
  const mergedNotificationFlags: User['notificationFlags'] = {
    ...existingNotificationFlags,
  };

  const isSubscribed = (topicId: string): NotificationPreferenceStatus =>
    subscriptionPreferences?.topics?.[`topic_${topicId}`] === false
      ? NotificationPreferenceStatus.Muted
      : NotificationPreferenceStatus.Subscribed;

  Object.entries(CIO_TOPIC_TO_NOTIFICATION_MAP).forEach(
    ([topicId, notificationType]) => {
      mergedNotificationFlags[notificationType] = {
        ...mergedNotificationFlags[notificationType],
        // CIO is only email, so we don't touch inApp
        email: isSubscribed(topicId),
      };
    },
  );

  return mergedNotificationFlags;
};

export const getIdentifyAttributes = async (
  con: ConnectionManager,
  user: ChangeObject<User>,
) => {
  const dup = { ...user };
  const id = dup.id;
  for (const field of OMIT_FIELDS) {
    delete dup[field];
  }

  const [genericInviteURL, personalizedDigest] = await Promise.all([
    getShortGenericInviteLink(logger, id),
    con.getRepository(UserPersonalizedDigest).findOne({
      select: ['userId'],
      where: {
        userId: id,
        type: In([
          UserPersonalizedDigestType.Digest,
          UserPersonalizedDigestType.Brief,
        ]),
      },
    }),
  ]);

  return {
    ...camelCaseToSnakeCase(dup),
    first_name: getFirstName(dup.name),
    created_at: dateToCioTimestamp(getDateBaseFromType(dup.createdAt)),
    updated_at: dup.updatedAt
      ? dateToCioTimestamp(getDateBaseFromType(dup.updatedAt))
      : undefined,
    referral_link: genericInviteURL,
    [`cio_subscription_preferences.topics.topic_${CioUnsubscribeTopic.Digest}`]:
      !!personalizedDigest,
    ...(user.notificationFlags
      ? getNotificationFlagsCioTopics(
          typeof user.notificationFlags === 'string'
            ? JSON.parse(user.notificationFlags)
            : user.notificationFlags,
        )
      : {}),
  };
};

export async function identifyUser({
  con,
  cio,
  user,
}: {
  con: DataSource;
  cio: TrackClient;
  user: ChangeObject<User>;
}): Promise<void> {
  const data = await getIdentifyAttributes(con, user);

  try {
    await cio.identify(user.id, data);
  } catch (err) {
    if (err instanceof CustomerIORequestError && err.statusCode === 400) {
      logger.warn({ err, user }, 'failed to update user in cio');
      return;
    }
    throw err;
  }
}

export async function syncNotificationFlagsToCio({
  userId,
  notificationFlags,
}: {
  userId: string;
  notificationFlags: User['notificationFlags'];
}): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  const cioTopics = getNotificationFlagsCioTopics(notificationFlags);

  try {
    await cio.identify(userId, cioTopics);
  } catch (err) {
    if (err instanceof CustomerIORequestError && err.statusCode === 400) {
      logger.warn(
        { err, userId },
        'failed to update notification flags in cio',
      );
      return;
    }
    throw err;
  }
}

export async function identifyUserCompany({
  cio,
  userCompany,
  company,
}: {
  cio: TrackClient;
  userCompany: ChangeObject<UserCompany>;
  company: Company;
}): Promise<void> {
  try {
    await cio.request.post(`${cio.trackRoot}/entity`, {
      identifiers: {
        object_type_id: CIO_COMPANY_OBJECT_ID,
        object_id: company.id,
      },
      type: 'object',
      action: 'identify',
      attributes: {
        name: company.name,
        image: company.image,
        domains: company.domains,
      },
      cio_relationships: [
        {
          identifiers: {
            id: userCompany.userId,
          },
        },
      ],
    });
  } catch (err) {
    if (err instanceof CustomerIORequestError && err.statusCode === 400) {
      logger.warn({ err }, 'failed to update user company in cio');
      return;
    }
    throw err;
  }
}

export async function identifyUserPersonalizedDigest({
  userId,
  subscribed,
}: {
  cio: TrackClient;
  userId: string;
  subscribed: boolean;
}): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  try {
    await cio.identify(userId, {
      [`cio_subscription_preferences.topics.topic_${CioUnsubscribeTopic.Digest}`]:
        subscribed,
    });
  } catch (err) {
    if (err instanceof CustomerIORequestError && err.statusCode === 400) {
      logger.warn(
        { err },
        'failed to update user personalized digest subscription in cio',
      );
      return;
    }
    throw err;
  }
}

export async function identifyAnonymousFunnelSubscription({
  cio,
  email,
  claimedSub,
}: {
  cio: TrackClient;
  email: string;
  claimedSub: boolean;
}): Promise<void> {
  try {
    await cio.identify(email, {
      funnel: true,
      claimed_sub: claimedSub,
    });
  } catch (err) {
    logger.warn({ err }, 'failed to identify anonymous funnel subscription');
  }
}

export async function destroyAnonymousFunnelSubscription({
  cio,
  email,
}: {
  cio: TrackClient;
  email: string;
}): Promise<void> {
  try {
    await cio.destroy(email);
  } catch (err) {
    logger.warn({ err }, 'failed to destroy anonymous funnel subscription');
  }
}

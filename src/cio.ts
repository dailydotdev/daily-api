import { CustomerIORequestError, TrackClient } from 'customerio-node';
import { ChangeObject } from './types';
import { User, UserStreak } from './entity';
import {
  camelCaseToSnakeCase,
  CioUnsubscribeTopic,
  debeziumTimeToDate,
  getFirstName,
  getShortGenericInviteLink,
} from './common';
import { FastifyBaseLogger } from 'fastify';

export const cio = new TrackClient(
  process.env.CIO_SITE_ID,
  process.env.CIO_API_KEY,
);

export function dateToCioTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

const OMIT_FIELDS: (keyof User)[] = [
  'id',
  'bio',
  'devcardEligible',
  'readme',
  'readmeHtml',
  'infoConfirmed',
  'profileConfirmed',
  'notificationEmail',
];

export async function identifyUserStreak(
  log: FastifyBaseLogger,
  cio: TrackClient,
  data: ChangeObject<UserStreak> & {
    lastSevenDays: { [key: string]: boolean };
  },
): Promise<void> {
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
        ? dateToCioTimestamp(debeziumTimeToDate(lastViewAt))
        : undefined,
      last_seven_days_streak: lastSevenDays,
    });
  } catch (err) {
    if (err instanceof CustomerIORequestError && err.statusCode === 400) {
      log.warn({ err }, 'failed to update user streak in cio');
      return;
    }
    throw err;
  }
}

export async function identifyUser(
  log: FastifyBaseLogger,
  cio: TrackClient,
  user: ChangeObject<User>,
): Promise<void> {
  const dup = { ...user };
  const id = dup.id;
  for (const field of OMIT_FIELDS) {
    delete dup[field];
  }

  const genericInviteURL = await getShortGenericInviteLink(log, id);
  try {
    await cio.identify(id, {
      ...camelCaseToSnakeCase(dup),
      first_name: getFirstName(dup.name),
      created_at: dateToCioTimestamp(debeziumTimeToDate(dup.createdAt)),
      updated_at: dateToCioTimestamp(debeziumTimeToDate(dup.updatedAt)),
      referral_link: genericInviteURL,
      cio_subscription_preferences: {
        topics: {
          [`topic_${CioUnsubscribeTopic.Marketing}`]: user.acceptedMarketing,
          [`topic_${CioUnsubscribeTopic.Notifications}`]:
            user.notificationEmail,
        },
      },
    });
  } catch (err) {
    if (err instanceof CustomerIORequestError && err.statusCode === 400) {
      log.warn({ err, user }, 'failed to update user in cio');
      return;
    }
    throw err;
  }
}

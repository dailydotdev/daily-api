import { TrackClient } from 'customerio-node';
import { ChangeObject } from './types';
import { User } from './entity';
import {
  camelCaseToSnakeCase,
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
  await cio.identify(id, {
    ...camelCaseToSnakeCase(dup),
    first_name: getFirstName(dup.name),
    created_at: dateToCioTimestamp(debeziumTimeToDate(dup.createdAt)),
    updated_at: dateToCioTimestamp(debeziumTimeToDate(dup.updatedAt)),
    referral_link: genericInviteURL,
    cio_subscription_preferences: {
      topics: {
        topic_4: user.acceptedMarketing,
        topic_7: user.notificationEmail,
      },
    },
  });
}

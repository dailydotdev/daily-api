import { APIClient, SendEmailRequest, TrackClient } from 'customerio-node';
import { SendEmailRequestOptionalOptions } from 'customerio-node/lib/api/requests';
import { SendEmailRequestWithTemplate } from 'customerio-node/dist/lib/api/requests';
import { signJwt } from '../auth';
import { DataSource } from 'typeorm';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestType,
} from '../entity';

export enum UnsubscribeGroup {
  Notifications = 'notifications',
  Digest = 'digest',
}

export const cioApi = new APIClient(process.env.CIO_APP_KEY);

export const addNotificationUtm = (
  url: string,
  medium: string,
  notificationType: string,
): string => {
  const urlObj = new URL(url);
  urlObj.searchParams.append('utm_source', 'notification');
  urlObj.searchParams.append('utm_medium', medium);
  urlObj.searchParams.append('utm_campaign', notificationType);
  return urlObj.toString();
};

export const addNotificationEmailUtm = (
  url: string,
  notificationType: string,
): string => addNotificationUtm(url, 'email', notificationType);

export const basicHtmlStrip = (html: string) => html.replace(/<[^>]*>?/gm, '');

export const getFirstName = (name: string): string =>
  name?.split?.(' ')?.[0] ?? '';

export const formatMailDate = (date: Date): string =>
  date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

export const baseNotificationEmailData: SendEmailRequestOptionalOptions = {
  reply_to: 'noreply@daily.dev',
  tracked: true,
  send_to_unsubscribed: false,
  queue_draft: false,
};

const isSubscribed = (
  subs: { topics?: Record<string, boolean> },
  topic: string,
): boolean => !(subs?.topics?.[`topic_${topic}`] === false);

export const resubscribeUser = async (
  cio: TrackClient,
  userId: string,
): Promise<void> => {
  if (!process.env.CIO_APP_KEY) {
    return;
  }

  await cio.identify(userId, { unsubscribed: true });
};

export const syncSubscription = async function (
  userId: string,
  con: DataSource,
): Promise<void> {
  if (!process.env.CIO_APP_KEY) {
    return;
  }

  const atts = await cioApi.getAttributes(userId);
  const subs = JSON.parse(
    atts?.customer?.attributes?.cio_subscription_preferences || '{}',
  );
  const marketing = isSubscribed(subs, '4');
  const notifications = isSubscribed(subs, '7');
  const digest = isSubscribed(subs, '8');
  await con.transaction(async (manager) => {
    await manager
      .getRepository(User)
      .update(
        { id: userId },
        { notificationEmail: notifications, acceptedMarketing: marketing },
      );
    if (!digest) {
      await manager
        .getRepository(UserPersonalizedDigest)
        .delete({ userId, type: UserPersonalizedDigestType.Digest });
    }
  });
};

export const sendEmail = async (
  data: SendEmailRequestWithTemplate,
  unsubscribeGroup = UnsubscribeGroup.Notifications,
): Promise<void> => {
  if (process.env.CIO_APP_KEY) {
    if (!('id' in data.identifiers)) {
      throw new Error('identifiers.id is required');
    }
    const token = await signJwt({
      userId: data.identifiers.id,
      group: unsubscribeGroup,
    });
    const req = new SendEmailRequest({
      ...baseNotificationEmailData,
      ...data,
      headers: {
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'List-Unsubscribe': `<https://api.daily.dev/notifications/unsubscribe?token=${token.token}>`,
      },
    });
    await cioApi.sendEmail(req);
  }
};

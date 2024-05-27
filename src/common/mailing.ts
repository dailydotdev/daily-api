import sgMail from '@sendgrid/mail';
import client from '@sendgrid/client';
import { User } from './users';
import { ChangeObject } from '../types';
import { FastifyBaseLogger } from 'fastify';
import { getShortGenericInviteLink } from './links';
import { APIClient, SendEmailRequest } from 'customerio-node';
import { SendEmailRequestOptionalOptions } from 'customerio-node/lib/api/requests';
import { SendEmailRequestWithTemplate } from 'customerio-node/dist/lib/api/requests';
import { signJwt } from '../auth';

if (process.env.SENDGRID_API_KEY) {
  client.setApiKey(process.env.SENDGRID_API_KEY);
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

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
        'List-Unsubscribe': `<https://api.daily.dev/unsubscribe?token=${token.token}>`,
      },
    });
    await cioApi.sendEmail(req);
  }
};

// taken from sendgrid library itself
type HttpMethod =
  | 'get'
  | 'GET'
  | 'post'
  | 'POST'
  | 'put'
  | 'PUT'
  | 'patch'
  | 'PATCH'
  | 'delete'
  | 'DELETE';

interface EmailContact {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  custom_fields: Record<string, string>;
}

const profileToContact = async (
  profile: User,
  contactId: string,
  log: FastifyBaseLogger,
) => {
  const genericInviteURL = await getShortGenericInviteLink(log, profile.id);
  const contact: EmailContact = {
    id: contactId,
    email: profile.email,
    custom_fields: {
      e1_T: profile.id,
      e2_T: genericInviteURL,
    },
  };

  const name = profile.name && profile.name.trim();
  if (name && name.length && name.length < 50) {
    const [firstName, ...lastName] = name.trim().split(' ');
    contact.first_name = firstName;
    if (lastName.length) {
      contact.last_name = lastName.join(' ');
    }
  }

  return contact;
};

export const addUserToContacts = async (
  profile: User,
  lists: string[],
  contactId: string,
  log: FastifyBaseLogger,
) => {
  const contact = await profileToContact(profile, contactId, log);
  const request = {
    method: 'PUT' as HttpMethod,
    url: '/v3/marketing/contacts',
    body: {
      list_ids: lists || undefined,
      contacts: [contact],
    },
  };
  return client.request(request);
};

export const removeUserFromList = (list: string, contactId: string) => {
  const request = {
    method: 'DELETE' as HttpMethod,
    url: `/v3/marketing/lists/${list}/contacts?contact_ids=${contactId}`,
  };
  return client.request(request);
};

export const removeUserContact = (contactId: string[]) => {
  const request = {
    method: 'DELETE' as HttpMethod,
    url: `/v3/marketing/contacts?ids=${contactId}`,
  };
  return client.request(request);
};

export const getContactIdByEmail = async (email: string) => {
  if (!email || !email.trim()) {
    return null;
  }
  const request = {
    method: 'POST' as HttpMethod,
    url: '/v3/marketing/contacts/search',
    body: { query: `email = '${email}'` },
  };
  const [, body] = await client.request(request);

  return body && body.result && body.result.length ? body.result[0].id : null;
};

// Id of "Registered users" contact list on SendGrid
const LIST_REGISTERED_USERS = '85a1951f-5f0c-459f-bf5e-e5c742986a50';
// Id of "Weekly recap" contact list on SendGrid
const LIST_MARKETING_EMAILS = '53d09271-fd3f-4e38-ac21-095bf4f52de6';
// Id of "Drop campaign" contact list on SendGrid
export const LIST_SQUAD_DRIP_CAMPAIGN = '919b5624-ccc9-46df-960d-f6a60eb8241b';

export const updateUserContactLists = async (
  log: FastifyBaseLogger,
  newProfile: ChangeObject<User>,
  oldProfile?: ChangeObject<User>,
): Promise<void> => {
  try {
    let contactId: string | null = null;
    // If the user already exists fetch their sendgrid contact id
    if (oldProfile) {
      contactId = await getContactIdByEmail(oldProfile.email);
    }
    const lists = [LIST_REGISTERED_USERS];
    if (newProfile.acceptedMarketing) {
      lists.push(LIST_MARKETING_EMAILS);
    } else if (contactId) {
      // If they no longer subscribe to marketing emails remove them from the contact list
      await Promise.all([
        removeUserFromList(LIST_MARKETING_EMAILS, contactId),
        removeUserFromList(LIST_SQUAD_DRIP_CAMPAIGN, contactId),
      ]);
    }
    await addUserToContacts(newProfile, lists, contactId, log);
  } catch (err) {
    if (
      err.code === 400 &&
      err.response?.body?.errors?.[0]?.message ===
        'length should be less than 50 chars'
    ) {
      log.warn(
        { err, userId: oldProfile?.id },
        'skipped updating user in mailing list',
      );
    } else {
      log.error(
        { err, userId: oldProfile?.id },
        'failed to update user in mailing list',
      );
      throw err;
    }
  }
};

export const createEmailBatchId = async (): Promise<string | undefined> => {
  const request = {
    method: 'POST' as HttpMethod,
    url: '/v3/mail/batch',
  };

  const [, body] = await client.request(request);

  return body?.batch_id;
};

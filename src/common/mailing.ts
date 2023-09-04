import sgMail from '@sendgrid/mail';
import client from '@sendgrid/client';
import { MailDataRequired } from '@sendgrid/helpers/classes/mail';
import { User } from './users';
import { ChangeObject } from '../types';
import { FastifyBaseLogger } from 'fastify';

if (process.env.SENDGRID_API_KEY) {
  client.setApiKey(process.env.SENDGRID_API_KEY);
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

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

export const baseNotificationEmailData: Pick<
  MailDataRequired,
  'from' | 'replyTo' | 'trackingSettings' | 'asm' | 'category'
> = {
  from: {
    email: 'informer@daily.dev',
    name: 'daily.dev',
  },
  replyTo: {
    email: 'hi@daily.dev',
    name: 'daily.dev',
  },
  trackingSettings: {
    openTracking: { enable: true },
  },
  asm: {
    groupId: 12850,
  },
  category: 'Notification',
};

export const sendEmail: typeof sgMail.send = (data) => {
  if (process.env.SENDGRID_API_KEY) {
    return sgMail.send(data);
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

const profileToContact = (profile: User, contactId: string) => {
  const contact: EmailContact = {
    id: contactId,
    email: profile.email,
    custom_fields: { e1_T: profile.id },
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

export const addUserToContacts = (
  profile: User,
  lists: string[],
  contactId: string,
) => {
  const request = {
    method: 'PUT' as HttpMethod,
    url: '/v3/marketing/contacts',
    body: {
      list_ids: lists || undefined,
      contacts: [profileToContact(profile, contactId)],
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
export const LIST_DRIP_CAMPAIGN = '919b5624-ccc9-46df-960d-f6a60eb8241b';

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
      await removeUserFromList(LIST_MARKETING_EMAILS, contactId);
    }
    await addUserToContacts(newProfile, lists, contactId);
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

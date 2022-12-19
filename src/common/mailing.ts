import sgMail from '@sendgrid/mail';
import client from '@sendgrid/client';
import { MailDataRequired } from '@sendgrid/helpers/classes/mail';
import { User } from './users';

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

export const updateUserContact = async (
  newProfile: User,
  oldEmail: string,
  lists: string[],
) => {
  const contactId = await getContactIdByEmail(oldEmail);
  return addUserToContacts(newProfile, lists, contactId);
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

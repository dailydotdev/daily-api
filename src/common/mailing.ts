import {
  APIClient,
  RegionUS,
  SendEmailRequest,
  TrackClient,
} from 'customerio-node';
import CIORequest from 'customerio-node/dist/lib/request';
import { SendEmailRequestOptionalOptions } from 'customerio-node/lib/api/requests';
import { SendEmailRequestWithTemplate } from 'customerio-node/dist/lib/api/requests';
import { DataSource, In, Raw } from 'typeorm';
import {
  Source,
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserPersonalizedDigestType,
} from '../entity';
import { blockingBatchRunner, callWithRetryDefault } from './async';
import {
  CIO_REQUIRED_FIELDS,
  cioV2,
  generateIdentifyObject,
  getCioTopicsToNotificationFlags,
  CioUnsubscribeTopic,
} from '../cio';
import { setTimeout } from 'node:timers/promises';
import { toChangeObject, updateFlagsStatement } from './utils';
import { GetUsersActiveState } from './googleCloud';
import { logger } from '../logger';
import { notificationFlagsSchema } from './schema/notificationFlagsSchema';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../notifications/common';

export enum CioTransactionalMessageTemplateId {
  VerifyCompany = '51',
  UserGivenTopReader = '52',
  UserSentPlusGift = '65',
  UserReceivedPlusGift = '66',
  UserBoughtCores = '72',
  UserReceivedAward = '73',
  OrganizationMemberJoined = '76',
  OrganizationMemberLeft = '77',
  OrganizationMemberRemoved = '78',
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
  topic: CioUnsubscribeTopic,
): boolean => !(subs?.topics?.[`topic_${topic}`] === false);

export const resubscribeUser = async (
  cio: TrackClient,
  userId: string,
): Promise<void> => {
  if (!process.env.CIO_APP_KEY) {
    return;
  }

  await cio.identify(userId, { unsubscribed: false });
};

export const syncSubscription = async function (
  userIds: string[],
  con: DataSource,
): Promise<void> {
  if (!process.env.CIO_APP_KEY) {
    return;
  }

  // This is fetched from APIClient source code
  // TODO: Remove this once APIClient supports fetching attributes in bulk
  const request = new CIORequest(process.env.CIO_APP_KEY, {});

  // Return attributes and devices for up to 100 customers by ID. If an ID in the request does not exist, the response omits it.
  // https://customer.io/docs/api/app/#operation/getPeopleById
  const userAttributes = await request.post(
    `${RegionUS.apiUrl}/customers/attributes`,
    { ids: userIds },
  );

  if (!Array.isArray(userAttributes?.customers)) {
    return;
  }

  if (userAttributes.customers.length === 0) {
    return;
  }

  await con.transaction(async (manager) => {
    for (const customer of userAttributes.customers as {
      id: string;
      attributes: { cio_subscription_preferences: string };
      unsubscribed: boolean;
    }[]) {
      const subs = JSON.parse(
        customer?.attributes?.cio_subscription_preferences || '{}',
      );
      const unsubscribed = customer?.unsubscribed;
      const digest =
        isSubscribed(subs, CioUnsubscribeTopic.Digest) && !unsubscribed;

      const user = await manager.getRepository(User).findOne({
        where: { id: customer.id },
        select: ['notificationFlags'],
      });

      const existingFlags = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...(user?.notificationFlags || {}),
      };

      const mergedNotificationFlags = getCioTopicsToNotificationFlags(
        subs,
        existingFlags,
      );

      const validation = notificationFlagsSchema.safeParse(
        mergedNotificationFlags,
      );
      if (validation.success) {
        await manager.getRepository(User).update(
          { id: customer.id },
          {
            acceptedMarketing:
              mergedNotificationFlags.marketing?.email === 'subscribed',
            notificationFlags: mergedNotificationFlags,
          },
        );
      } else {
        logger.error(
          {
            userId: customer.id,
            errors: validation.error.issues,
            flags: mergedNotificationFlags,
          },
          'Failed to validate merged notification flags from CIO sync, skipping notification flags update',
        );
      }

      if (!digest) {
        await manager.getRepository(UserPersonalizedDigest).delete({
          userId: customer.id,
          type: In([
            UserPersonalizedDigestType.Digest,
            UserPersonalizedDigestType.Brief,
          ]),
        });
      }
    }
  });
};

export const sendEmail = async (
  data: SendEmailRequestWithTemplate,
): Promise<void> => {
  if (process.env.CIO_APP_KEY) {
    if (!('id' in data.identifiers)) {
      throw new Error('identifiers.id is required');
    }
    const req = new SendEmailRequest({
      ...baseNotificationEmailData,
      ...data,
    });
    await cioApi.sendEmail(req);
  }
};

export const addPrivateSourceJoinParams = ({
  url,
  source,
  referralToken,
}: {
  url: string;
  source: Pick<Source, 'handle' | 'type'>;
  referralToken: string;
}): string => {
  const urlObj = new URL(url);
  urlObj.searchParams.set('jt', referralToken);
  urlObj.searchParams.set('source', source.handle);
  urlObj.searchParams.set('type', source.type);

  return urlObj.toString();
};

const ITEMS_PER_DESTROY = 4000;
const ITEMS_PER_IDENTIFY = 250;

interface SyncSubscriptionsWithActiveStateProps {
  con: DataSource;
  users: GetUsersActiveState;
}

interface SyncSubscriptionsWithActiveState {
  hasAnyFailed: boolean;
}

export const syncSubscriptionsWithActiveState = async ({
  con,
  users: { inactiveUsers, downgradeUsers, reactivateUsers },
}: SyncSubscriptionsWithActiveStateProps): Promise<SyncSubscriptionsWithActiveState> => {
  let hasAnyFailed = false;

  // user is active again: reactivate to CIO
  await blockingBatchRunner({
    batchLimit: ITEMS_PER_IDENTIFY,
    data: reactivateUsers,
    runner: async (batch) => {
      const users = await con.getRepository(User).find({
        where: { id: In(batch), cioRegistered: false },
        select: CIO_REQUIRED_FIELDS.concat('id'),
      });

      if (users.length === 0) {
        return true;
      }

      const data = await Promise.all(
        users.map((user) => generateIdentifyObject(con, toChangeObject(user))),
      );

      await callWithRetryDefault({
        callback: () =>
          cioV2.request.post(`${cioV2.trackRoot}/batch`, { batch: data }),
        onFailure: (err) => {
          hasAnyFailed = true;
          logger.info({ err }, 'Failed to reactivate users to CIO');
        },
      });

      const ids = users.map(({ id }) => id);
      await con
        .getRepository(User)
        .update({ id: In(ids) }, { cioRegistered: true });

      await setTimeout(20); // wait for a bit to avoid rate limiting
    },
  });

  // inactive for 12 weeks: remove from CIO
  await blockingBatchRunner({
    batchLimit: ITEMS_PER_DESTROY,
    data: inactiveUsers,
    runner: async (batch) => {
      const users = await con.getRepository(User).find({
        select: ['id'],
        where: { id: In(batch), cioRegistered: true },
      });

      if (users.length === 0) {
        return true;
      }

      const data = users.map(({ id }) => ({
        action: 'delete',
        type: 'person',
        identifiers: { id },
      }));

      await callWithRetryDefault({
        callback: () =>
          cioV2.request.post(`${cioV2.trackRoot}/batch`, { batch: data }),
        onFailure: (err) => {
          hasAnyFailed = true;
          logger.info({ err }, 'Failed to remove users from CIO');
        },
      });

      const ids = users.map(({ id }) => id);
      await con.transaction(async (manager) => {
        await Promise.all([
          manager.getRepository(User).update(
            { id: In(ids) },
            {
              cioRegistered: false,
              acceptedMarketing: false,
              followingEmail: false,
              followNotifications: false,
              notificationEmail: false,
              awardEmail: false,
              awardNotifications: false,
            },
          ),
          manager
            .getRepository(UserPersonalizedDigest)
            .delete({ userId: In(ids) }),
        ]);
      });

      await setTimeout(20); // wait for a bit to avoid rate limiting
    },
  });

  // inactive for 6 weeks: downgrade from daily to weekly digest
  await blockingBatchRunner({
    data: downgradeUsers,
    runner: async (current) => {
      // set digest to weekly on Wednesday 9am
      await con.getRepository(UserPersonalizedDigest).update(
        {
          userId: In(current),
          type: In([
            UserPersonalizedDigestType.Digest,
            UserPersonalizedDigestType.Brief,
          ]),
          flags: Raw(() => `flags->>'sendType' IN (:...sendTypes)`, {
            sendTypes: [
              UserPersonalizedDigestSendType.workdays,
              UserPersonalizedDigestSendType.daily,
            ],
          }),
        },
        {
          preferredDay: 3,
          preferredHour: 9,
          flags: updateFlagsStatement({
            sendType: UserPersonalizedDigestSendType.weekly,
          }),
        },
      );
    },
  });

  return { hasAnyFailed };
};

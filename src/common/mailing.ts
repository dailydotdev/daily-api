import {
  APIClient,
  RegionUS,
  SendEmailRequest,
  TrackClient,
} from 'customerio-node';
import CIORequest from 'customerio-node/dist/lib/request';
import { SendEmailRequestOptionalOptions } from 'customerio-node/lib/api/requests';
import { SendEmailRequestWithTemplate } from 'customerio-node/dist/lib/api/requests';
import { DataSource, In } from 'typeorm';
import {
  Source,
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserPersonalizedDigestType,
} from '../entity';
import { blockingBatchRunner, callWithRetryDefault } from './async';
import { cioV2, generateIdentifyObject } from '../cio';
import { setTimeout } from 'node:timers/promises';
import { updateFlagsStatement } from './utils';
import { GetUsersActiveState } from './googleCloud';
import { logger } from '../logger';
import { toChangeObject } from './typedPubsub';

export enum CioUnsubscribeTopic {
  Marketing = '4',
  Notifications = '7',
  Digest = '8',
  Follow = '9',
}

export enum CioTransactionalMessageTemplateId {
  VerifyCompany = '51',
  UserGivenTopReader = '52',
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

  await con.transaction(async (manager) => {
    userAttributes?.customers.forEach(
      async (customer: {
        id: string;
        attributes: { cio_subscription_preferences: string };
        unsubscribed: boolean;
      }) => {
        const subs = JSON.parse(
          customer?.attributes?.cio_subscription_preferences || '{}',
        );
        const unsubscribed = customer?.unsubscribed;
        const marketing =
          isSubscribed(subs, CioUnsubscribeTopic.Marketing) && !unsubscribed;
        const notifications =
          isSubscribed(subs, CioUnsubscribeTopic.Notifications) &&
          !unsubscribed;
        const digest =
          isSubscribed(subs, CioUnsubscribeTopic.Digest) && !unsubscribed;
        const isFollowSubscribed =
          isSubscribed(subs, CioUnsubscribeTopic.Follow) && !unsubscribed;

        await manager.getRepository(User).update(
          { id: customer.id },
          {
            notificationEmail: notifications,
            acceptedMarketing: marketing,
            followingEmail: isFollowSubscribed,
          },
        );
        if (!digest) {
          await manager.getRepository(UserPersonalizedDigest).delete({
            userId: customer.id,
            type: UserPersonalizedDigestType.Digest,
          });
        }
      },
    );
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

export const syncSubscriptionsWithActiveState = async ({
  con,
  users: { inactiveUsers, downgradeUsers, reactivateUsers },
}: SyncSubscriptionsWithActiveStateProps) => {
  const validReactivateUsers = await con.getRepository(User).find({
    where: { id: In(reactivateUsers), cioRegistered: false },
  });

  // user is active again: reactivate to CIO
  await blockingBatchRunner({
    batchLimit: ITEMS_PER_IDENTIFY,
    data: validReactivateUsers,
    runner: async (batch) => {
      const data = await Promise.all(
        batch.map((batch) =>
          generateIdentifyObject(con, toChangeObject(batch)),
        ),
      );

      await callWithRetryDefault({
        callback: () => cioV2.request.post('/users', { batch: data }),
        onSuccess: async () => {
          const ids = batch.map(({ id }) => id);
          await con
            .getRepository(User)
            .update({ id: In(ids) }, { cioRegistered: true });
        },
        onFailure: (err) => {
          logger.info({ err }, 'Failed to add users to CIO');
        },
      });

      await setTimeout(20); // wait for a bit to avoid rate limiting
    },
  });

  const validInactiveUsers = await con.getRepository(User).find({
    select: ['id'],
    where: { id: In(inactiveUsers), cioRegistered: true },
  });
  // inactive for 12 weeks: remove from CIO
  await blockingBatchRunner({
    batchLimit: ITEMS_PER_DESTROY,
    data: validInactiveUsers.map(({ id }) => id),
    runner: async (batch) => {
      const data = batch.map((id) => ({
        action: 'destroy',
        type: 'person',
        identifiers: { id },
      }));

      await callWithRetryDefault({
        callback: () => cioV2.request.post('/users', { batch: data }),
        onSuccess: async () => {
          await con.getRepository(User).update(
            { id: In(batch) },
            {
              cioRegistered: false,
              acceptedMarketing: false,
              followingEmail: false,
              notificationEmail: false,
            },
          );
        },
        onFailure: (err) => {
          logger.info({ err }, 'Failed to remove users from CIO');
        },
      });

      await setTimeout(20); // wait for a bit to avoid rate limiting
    },
  });

  // inactive for 6 weeks: downgrade from daily to weekly digest
  await blockingBatchRunner({
    data: downgradeUsers,
    runner: async (current) => {
      const validDowngradeUsers = await con
        .getRepository(User)
        .createQueryBuilder('u')
        .select('id')
        .innerJoin(UserPersonalizedDigest, 'upd', 'u.id = upd."userId"')
        .where('u.id IN (:...ids)', { ids: current })
        .andWhere(`upd.flags->>'sendType' = 'daily'`)
        .getRawMany<Pick<User, 'id'>>();

      // set digest to weekly on Wednesday 9am
      await con.getRepository(UserPersonalizedDigest).update(
        { userId: In(validDowngradeUsers.map(({ id }) => id)) },
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
};
